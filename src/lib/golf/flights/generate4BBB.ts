import { pairKey, hasPair } from '@/lib/utils/pairs'

export type Player4BBB = {
  id: string
  first_name: string
  surname: string
  whs: number | null
}

export type EventSlot = {
  eventId: string
  title: string
  starts_at: string
  going: Player4BBB[]
}

export type Flight4BBB = {
  flight_no: number
  players: Player4BBB[]
  avgWhs: number
}

export type RoundResult = {
  eventId: string
  flights: Flight4BBB[]
}

/**
 * Forme 2 paires (1 fort + 1 faible) à partir de 4 joueurs triés par WHS.
 * [fort, moyen-fort, moyen-faible, faible]
 * Paire 1 : fort + faible
 * Paire 2 : moyen-fort + moyen-faible
 */
function formPairs(players: Player4BBB[]): Flight4BBB[] {
  const sorted = [...players].sort((a, b) => (a.whs ?? 99) - (b.whs ?? 99))
  const pairs: Player4BBB[][] = []

  if (sorted.length === 4) {
    pairs.push([sorted[0], sorted[3]]) // fort + faible
    pairs.push([sorted[1], sorted[2]]) // moyen-fort + moyen-faible
  } else if (sorted.length === 3) {
    pairs.push([sorted[0], sorted[2]])
    pairs.push([sorted[1]])
  } else {
    pairs.push(sorted)
  }

  return pairs.map((group, i) => ({
    flight_no: i + 1,
    players:   group,
    avgWhs:    group.length > 0
      ? group.reduce((s, p) => s + (p.whs ?? 0), 0) / group.length
      : 0,
  }))
}

/**
 * Score WHS : écart de moyenne WHS entre les 2 flights.
 * Plus l'écart est faible, mieux c'est.
 */
function whsBalance(group: Player4BBB[]): number {
  const sorted = [...group].sort((a, b) => (a.whs ?? 99) - (b.whs ?? 99))
  if (sorted.length < 4) return 0
  const avg1 = ((sorted[0].whs ?? 0) + (sorted[3].whs ?? 0)) / 2
  const avg2 = ((sorted[1].whs ?? 0) + (sorted[2].whs ?? 0)) / 2
  return Math.abs(avg1 - avg2)
}

/**
 * Algorithme principal 4BBB Challenge.
 *
 * Pour chaque event :
 *   - 4 joueurs sélectionnés parmi les GOING
 *   - Contrainte : chaque joueur joue ≥ 2 fois sur l'ensemble (sauf GOING 1 seule fois)
 *   - Équilibrage WHS moyen entre events pour les slots restants
 *   - Forbidden/preferred respectés
 */
export function generate4BBB(
  events: EventSlot[],
  options: {
    forbiddenPairs?: Set<string>
    preferredPairs?: Set<string>
    iterations?: number
  } = {}
): RoundResult[] {
  const {
    forbiddenPairs = new Set<string>(),
    preferredPairs = new Set<string>(),
    iterations     = 500,
  } = options

  const SLOTS_PER_EVENT = 4

  // ── Compter les events disponibles par joueur ────────────────────────────
  const playerEventCount = new Map<string, number>() // id → nb events GOING
  for (const ev of events) {
    for (const p of ev.going) {
      playerEventCount.set(p.id, (playerEventCount.get(p.id) ?? 0) + 1)
    }
  }

  // ── Nb de participations minimum requis ──────────────────────────────────
  function minRequired(playerId: string): number {
    const count = playerEventCount.get(playerId) ?? 0
    return count <= 1 ? 1 : 2
  }

  // ── Score d'une assignation complète ────────────────────────────────────
  // Pénalités :
  //   - joueur joue moins que son minimum requis : +5000
  //   - paire forbidden dans le même flight : +10000
  //   - écart WHS moyen entre events : +100 * écart
  //   - paire preferred pas ensemble : +200
  function scoreAssignment(assignments: Map<string, string[]>): number {
    let score = 0

    // Participation minimum
    for (const [playerId, minReq] of [...playerEventCount.keys()].map(id => [id, minRequired(id)] as [string, number])) {
      const played = assignments.get(playerId)?.length ?? 0
      if (played < minReq) score += 5000 * (minReq - played)
    }

    // WHS moyen par event (équilibrage entre events)
    const eventAvgWhs: number[] = events.map(ev => {
      const selected = ev.going.filter(p => assignments.get(p.id)?.includes(ev.eventId))
      if (selected.length === 0) return 0
      return selected.reduce((s, p) => s + (p.whs ?? 0), 0) / selected.length
    })
    const globalAvg = eventAvgWhs.reduce((s, v) => s + v, 0) / (eventAvgWhs.length || 1)
    for (const avg of eventAvgWhs) {
      score += Math.abs(avg - globalAvg) * 100
    }

    // Forbidden/preferred dans les flights
    for (const ev of events) {
      const selected = ev.going.filter(p => assignments.get(p.id)?.includes(ev.eventId))
      const sorted   = [...selected].sort((a, b) => (a.whs ?? 99) - (b.whs ?? 99))
      const pairs    = sorted.length >= 4
        ? [[sorted[0], sorted[3]], [sorted[1], sorted[2]]]
        : [sorted]

      for (const pair of pairs) {
        for (let i = 0; i < pair.length; i++) {
          for (let j = i + 1; j < pair.length; j++) {
            const key = pairKey(pair[i].id, pair[j].id)
            if (forbiddenPairs.has(key)) score += 10000
            if (preferredPairs.has(key)) score -= 300
          }
        }
      }
    }

    return score
  }

  // ── Générer une assignation ──────────────────────────────────────────────
  // Stratégie : pour chaque joueur, choisir aléatoirement parmi ses events GOING
  // en respectant le minimum requis, puis équilibrer le WHS moyen.
  function generateAssignment(): Map<string, string[]> {
    const assignment = new Map<string, string[]>() // playerId → [eventIds]

    // Initialiser
    for (const ev of events) {
      for (const p of ev.going) {
        if (!assignment.has(p.id)) assignment.set(p.id, [])
      }
    }

    // Compter les slots disponibles par event
    const slotsLeft = new Map<string, number>()
    for (const ev of events) slotsLeft.set(ev.eventId, SLOTS_PER_EVENT)

    // Trier les joueurs par nb d'events GOING croissant (contrainte la plus forte d'abord)
    const allPlayers = [...new Set(events.flatMap(ev => ev.going.map(p => p.id)))]
      .map(id => {
        const player = events.flatMap(ev => ev.going).find(p => p.id === id)!
        return { id, whs: player.whs ?? 99, eventCount: playerEventCount.get(id) ?? 0 }
      })
      .sort((a, b) => a.eventCount - b.eventCount)

    // Phase 1 : garantir le minimum requis
    for (const player of allPlayers) {
      const minReq   = minRequired(player.id)
      const eventsOk = events.filter(ev =>
        ev.going.some(p => p.id === player.id) && (slotsLeft.get(ev.eventId) ?? 0) > 0
      )
      // Mélanger pour varier
      const shuffledEvents = [...eventsOk].sort(() => Math.random() - 0.5)
      let assigned = 0
      for (const ev of shuffledEvents) {
        if (assigned >= minReq) break
        assignment.get(player.id)!.push(ev.eventId)
        slotsLeft.set(ev.eventId, (slotsLeft.get(ev.eventId) ?? 0) - 1)
        assigned++
      }
    }

    // Phase 2 : remplir les slots restants en équilibrant le WHS moyen
    for (const ev of events) {
      let slots = slotsLeft.get(ev.eventId) ?? 0
      if (slots <= 0) continue

      // Joueurs GOING pas encore assignés à cet event
      const candidates = ev.going
        .filter(p => !assignment.get(p.id)?.includes(ev.eventId))
        .sort((a, b) => (a.whs ?? 99) - (b.whs ?? 99))

      // Calculer WHS moyen actuel de cet event
      const currentSelected = ev.going.filter(p => assignment.get(p.id)?.includes(ev.eventId))
      const currentAvg = currentSelected.length > 0
        ? currentSelected.reduce((s, p) => s + (p.whs ?? 0), 0) / currentSelected.length
        : 0

      // Choisir les candidats qui rapprochent le plus de la moyenne globale cible
      const globalAvgTarget = events.flatMap(e => e.going).reduce((s, p) => s + (p.whs ?? 0), 0)
        / events.flatMap(e => e.going).length

      // Trier par distance à la cible
      const sorted = [...candidates].sort((a, b) => {
        const distA = Math.abs((a.whs ?? 0) - globalAvgTarget)
        const distB = Math.abs((b.whs ?? 0) - globalAvgTarget)
        return distA - distB
      })

      for (const candidate of sorted) {
        if (slots <= 0) break
        assignment.get(candidate.id)!.push(ev.eventId)
        slotsLeft.set(ev.eventId, (slotsLeft.get(ev.eventId) ?? 0) - 1)
        slots--
      }
    }

    return assignment
  }

  // ── Optimisation : garder la meilleure assignation ───────────────────────
  let bestAssignment: Map<string, string[]> | null = null
  let bestScore = Infinity

  for (let i = 0; i < iterations; i++) {
    const candidate = generateAssignment()
    const score     = scoreAssignment(candidate)
    if (score < bestScore) {
      bestAssignment = candidate
      bestScore      = score
      if (bestScore <= 0) break
    }
  }

  const assignment = bestAssignment ?? generateAssignment()

  // ── Convertir en RoundResult ─────────────────────────────────────────────
  return events.map(ev => {
    const selected = ev.going.filter(p => assignment.get(p.id)?.includes(ev.eventId))
    return {
      eventId: ev.eventId,
      flights: formPairs(selected),
    }
  })
}

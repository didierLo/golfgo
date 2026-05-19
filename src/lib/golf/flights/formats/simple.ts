import { shuffle } from "@/lib/utils/shuffle"
import { pairKey } from "@/lib/utils/pairs"

/**
 * Calcule la distribution optimale des flights.
 * Ex: 10 joueurs, size 4 → [4, 3, 3] (pas [4, 4, 2])
 */
function computeSizes(total: number, size: number): number[] {
  const n = Math.ceil(total / size)
  const sizes: number[] = []
  let remaining = total
  for (let i = 0; i < n; i++) {
    const s = Math.ceil(remaining / (n - i))
    sizes.push(s)
    remaining -= s
  }
  return sizes
}

/**
 * Convertit un tableau plat de joueurs en tableau de flights.
 */
function toFlightArrays(players: any[], sizes: number[]): any[][] {
  const flights: any[][] = []
  let cursor = 0
  for (const size of sizes) {
    flights.push(players.slice(cursor, cursor + size))
    cursor += size
  }
  return flights
}

/**
 * Construit une Map de co-occurrences depuis l'historique des flights.
 */
function buildCoOccurrences(pastFlights: any[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const flight of pastFlights) {
    const ps: any[] = flight.players ?? []
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        if (!ps[i]?.id || !ps[j]?.id) continue
        const key = pairKey(ps[i].id, ps[j].id)
        map.set(key, (map.get(key) ?? 0) + 1)
      }
    }
  }
  return map
}

/**
 * Score de pénalité pour une paire dans le même flight.
 * Plus le score est bas, mieux c'est.
 */
function pairPenalty(
  a: any,
  b: any,
  forbiddenPairs: Set<string>,
  preferredPairs: Set<string>,
  pastCoOccurrences: Map<string, number>,
  historyWeight: number,
): number {
  const key = pairKey(a.id, b.id)
  let score = 0

  if (forbiddenPairs.has(key)) score += 10000  // pénalité maximale
  if (preferredPairs.has(key)) score -= 500     // bonus
  const coOcc = pastCoOccurrences.get(key) ?? 0
  score += coOcc * historyWeight

  return score
}

/**
 * Score total d'une assignation : somme des pénalités de toutes les paires
 * dans chaque flight. Détecte bien A+B dans le même flight de 4,
 * même si la paire directe n'est pas listée.
 */
function assignmentScore(
  flights: any[][],
  forbiddenPairs: Set<string>,
  preferredPairs: Set<string>,
  pastCoOccurrences: Map<string, number>,
  historyWeight: number,
): number {
  let total = 0
  for (const flight of flights) {
    for (let i = 0; i < flight.length; i++) {
      for (let j = i + 1; j < flight.length; j++) {
        total += pairPenalty(
          flight[i], flight[j],
          forbiddenPairs, preferredPairs,
          pastCoOccurrences, historyWeight,
        )
      }
    }
  }
  return total
}

export function simpleFlights(players: any[], options: any) {
  const flightSize     = options.flightSize     ?? 4
  const forbiddenPairs = options.forbiddenPairs ?? new Set<string>()
  const preferredPairs = options.preferredPairs ?? new Set<string>()
  const pastFlights    = options.pastFlights    ?? []
  const balanceWHS     = options.balanceWHS     ?? true
  const iterations     = options.iterations     ?? 800
  const historyWeight  = 100

  const coOccurrences = buildCoOccurrences(pastFlights)
  const sizes = computeSizes(players.length, flightSize)

  // Essayer `iterations` shuffles complets et garder la meilleure assignation.
  // À chaque tentative, assignmentScore vérifie TOUTES les paires dans chaque
  // flight → A et B interdits dans le même flight de 4 sont bien détectés.
  let best: any[][] | null = null
  let bestScore = Infinity

  for (let iter = 0; iter < iterations; iter++) {
    const shuffled  = shuffle([...players])
    const candidate = toFlightArrays(shuffled, sizes)
    const score     = assignmentScore(
      candidate, forbiddenPairs, preferredPairs, coOccurrences, historyWeight,
    )

    if (score < bestScore) {
      best      = candidate
      bestScore = score
      // Solution parfaite : aucune contrainte violée → on arrête immédiatement
      if (bestScore <= 0) break
    }
  }

  let flightArrays = best ?? toFlightArrays(shuffle([...players]), sizes)

  // Équilibrage WHS : dans chaque flight, trier du plus faible au plus fort
  if (balanceWHS) {
    flightArrays = flightArrays.map(flight => {
      const withWHS    = flight.filter(p => p.whs !== null && p.whs !== undefined)
        .sort((a, b) => (a.whs ?? 0) - (b.whs ?? 0))
      const withoutWHS = flight.filter(p => p.whs === null || p.whs === undefined)
      return [...withWHS, ...withoutWHS]
    })
  }

  return flightArrays.map((players, i) => ({ flight_no: i + 1, players }))
}

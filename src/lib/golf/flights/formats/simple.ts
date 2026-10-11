import { shuffle } from "@/lib/utils/shuffle"
import { pairKey } from "@/lib/utils/pairs"

/**
 * Génération des flights « standard » — recherche par échanges de joueurs.
 *
 * Principe :
 *  1. on calcule, pour chaque paire de joueurs, une pénalité qui tient compte de
 *     l'historique (poids décroissant dans le temps), des paires interdites et des
 *     paires souhaitées ;
 *  2. on part d'une répartition au hasard, puis on échange des joueurs entre flights
 *     en gardant les échanges qui font baisser la pénalité totale (avec un peu de
 *     « recuit simulé » pour ne pas rester coincé) ;
 *  3. on recommence plusieurs fois depuis des départs différents et on garde le meilleur.
 */

// ── Réglages ────────────────────────────────────────────────────────────────

/** Une partie jouée il y a ce nombre de jours compte moitié moins qu'une partie récente. */
export const PAIR_HISTORY_HALF_LIFE_DAYS = 60

const HISTORY_WEIGHT    = 100     // pénalité de base d'une paire déjà jouée ensemble (récemment)
const FORBIDDEN_PENALTY = 10000
const PREFERRED_BONUS   = 500
const DAY_MS            = 24 * 60 * 60 * 1000

// ── Historique des paires (utilisé aussi par la matrice affichée sous les flights) ──

export type PairHistoryEntry = {
  /** Nombre de fois où la paire a joué ensemble sur la période chargée. */
  count: number
  /** Même chose, mais chaque partie est pondérée selon sa proximité avec l'événement (1 = très proche). */
  weight: number
}

/**
 * Construit l'historique des paires à partir des flights passés.
 * Chaque élément de `pastFlights` : { date, players: [{ id }, ...] } où `date` est la date
 * de l'événement concerné. `referenceDate` = date de l'événement pour lequel on prépare les flights
 * (par défaut : maintenant). Une partie très proche (avant ou après) pèse plus qu'une partie lointaine.
 */
export function buildPairHistory(
  pastFlights: any[],
  referenceDate?: string | number | Date | null,
  halfLifeDays: number = PAIR_HISTORY_HALF_LIFE_DAYS,
): Map<string, PairHistoryEntry> {
  const map = new Map<string, PairHistoryEntry>()
  const ref = referenceDate ? new Date(referenceDate).getTime() : Date.now()

  for (const flight of pastFlights ?? []) {
    const ps: any[] = (flight.players ?? []).filter((p: any) => p?.id)

    let weight = 1
    const t = flight.date ? new Date(flight.date).getTime() : NaN
    if (!Number.isNaN(t) && !Number.isNaN(ref)) {
      const days = Math.abs(ref - t) / DAY_MS
      weight = Math.pow(0.5, days / halfLifeDays)
    }

    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const key = pairKey(ps[i].id, ps[j].id)
        const e = map.get(key) ?? { count: 0, weight: 0 }
        e.count += 1
        e.weight += weight
        map.set(key, e)
      }
    }
  }
  return map
}

// ── Structure des flights ───────────────────────────────────────────────────

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

/** Découpe une liste d'indices en flights selon les tailles données. */
function splitBySizes(items: number[], sizes: number[]): number[][] {
  const flights: number[][] = []
  let cursor = 0
  for (const size of sizes) {
    flights.push(items.slice(cursor, cursor + size))
    cursor += size
  }
  return flights
}

// ── Pénalités ───────────────────────────────────────────────────────────────

/**
 * Matrice n×n des pénalités par paire (plus bas = mieux).
 * Historique : pénalité convexe (w + w²/2) pour mieux répartir les rencontres
 * plutôt que de répéter toujours les mêmes paires.
 */
function buildPenaltyMatrix(
  players: any[],
  forbiddenPairs: Set<string>,
  preferredPairs: Set<string>,
  history: Map<string, PairHistoryEntry>,
): number[][] {
  const n = players.length
  const pen: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const key = pairKey(players[i].id, players[j].id)
      let p = 0
      if (forbiddenPairs.has(key)) p += FORBIDDEN_PENALTY
      if (preferredPairs.has(key)) p -= PREFERRED_BONUS
      const w = history.get(key)?.weight ?? 0
      p += HISTORY_WEIGHT * (w + 0.5 * w * w)
      pen[i][j] = p
      pen[j][i] = p
    }
  }
  return pen
}

function totalPenalty(flights: number[][], pen: number[][]): number {
  let total = 0
  for (const f of flights) {
    for (let a = 0; a < f.length; a++) {
      for (let b = a + 1; b < f.length; b++) total += pen[f[a]][f[b]]
    }
  }
  return total
}

// ── Recherche par échanges (recuit simulé avec redémarrages) ────────────────

function searchBest(n: number, sizes: number[], pen: number[][], totalSteps: number): number[][] {
  const base = Array.from({ length: n }, (_, i) => i)

  // Un seul flight, ou aucun échange possible : rien à optimiser.
  if (sizes.length < 2) return splitBySizes(shuffle(base), sizes)

  const restarts      = 6
  const stepsPerStart = Math.max(500, Math.floor(totalSteps / restarts))
  const T0            = HISTORY_WEIGHT * 0.8   // température de départ (≈ une paire récente)

  let best: number[][] = splitBySizes(shuffle(base), sizes)
  let bestScore = totalPenalty(best, pen)

  for (let r = 0; r < restarts; r++) {
    const cur = splitBySizes(shuffle(base), sizes)
    let curScore = totalPenalty(cur, pen)

    if (curScore < bestScore) { best = cur.map(f => f.slice()); bestScore = curScore }

    for (let s = 0; s < stepsPerStart; s++) {
      const i = Math.floor(Math.random() * cur.length)
      let j = Math.floor(Math.random() * (cur.length - 1))
      if (j >= i) j++                                   // j ≠ i

      const fi = cur[i], fj = cur[j]
      if (!fi.length || !fj.length) continue

      const xi = Math.floor(Math.random() * fi.length)
      const yi = Math.floor(Math.random() * fj.length)
      const x = fi[xi], y = fj[yi]

      // Variation de pénalité si on échange x (flight i) et y (flight j) — calcul incrémental.
      let delta = 0
      for (const z of fi) if (z !== x) delta += pen[y][z] - pen[x][z]
      for (const z of fj) if (z !== y) delta += pen[x][z] - pen[y][z]

      const temperature = T0 * (1 - s / stepsPerStart) + 0.01
      if (delta <= 0 || Math.random() < Math.exp(-delta / temperature)) {
        fi[xi] = y
        fj[yi] = x
        curScore += delta
        if (curScore < bestScore - 1e-9) {
          best = cur.map(f => f.slice())
          bestScore = curScore
        }
      }
    }
  }
  return best
}

// ── Point d'entrée ──────────────────────────────────────────────────────────

export function simpleFlights(players: any[], options: any) {
  const flightSize     = options.flightSize     ?? 4
  const forbiddenPairs = options.forbiddenPairs ?? new Set<string>()
  const preferredPairs = options.preferredPairs ?? new Set<string>()
  const pastFlights    = options.pastFlights    ?? []
  const balanceWHS     = options.balanceWHS     ?? true
  const iterations     = options.iterations     ?? 800

  if (players.length === 0) return []

  const history = buildPairHistory(pastFlights, options.referenceDate)
  const sizes   = computeSizes(players.length, flightSize)
  const pen     = buildPenaltyMatrix(players, forbiddenPairs, preferredPairs, history)

  // « iterations » du formulaire = nombre d'essais ; ici chaque essai est un échange de joueurs (très rapide).
  const totalSteps = Math.max(3000, iterations * 40)
  const best       = searchBest(players.length, sizes, pen, totalSteps)

  let flightArrays: any[][] = best.map(flight => flight.map(idx => players[idx]))

  // Équilibrage WHS : dans chaque flight, trier du plus faible au plus fort
  if (balanceWHS) {
    flightArrays = flightArrays.map(flight => {
      const withWHS    = flight.filter(p => p.whs !== null && p.whs !== undefined)
        .sort((a, b) => (a.whs ?? 0) - (b.whs ?? 0))
      const withoutWHS = flight.filter(p => p.whs === null || p.whs === undefined)
      return [...withWHS, ...withoutWHS]
    })
  }

  return flightArrays.map((flightPlayers, i) => ({ flight_no: i + 1, players: flightPlayers }))
}

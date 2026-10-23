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
 *
 * Contrainte permanente « 9 trous » (flights mixtes) :
 *  - les joueurs 9 trous Front (9F) sont répartis équitablement entre les flights ;
 *  - les joueurs 9 trous Back (9B) aussi, en commençant par les flights où il y a un 9F à remplacer
 *    (au 10e trou, le 9B prend la place du 9F qui s'arrête).
 *  Cette contrainte passe avant l'historique et les handicaps ; seules les paires interdites la dépassent.
 *
 * Équilibre WHS (option) : on ajoute au coût la somme, sur les flights, de (moyenne WHS du flight − moyenne
 * WHS générale)². Les flights ont ainsi des niveaux proches, sans jamais l'emporter sur les paires interdites
 * ni sur la contrainte 9F / 9B. Un joueur sans WHS compte comme la moyenne générale (neutre).
 */

// ── Réglages ────────────────────────────────────────────────────────────────

/** Une partie jouée il y a ce nombre de jours compte moitié moins qu'une partie récente. */
export const PAIR_HISTORY_HALF_LIFE_DAYS = 60

const HISTORY_WEIGHT    = 100     // pénalité de base d'une paire déjà jouée ensemble (récemment)
const FORBIDDEN_PENALTY = 10000
const PREFERRED_BONUS   = 500
const DAY_MS            = 24 * 60 * 60 * 1000
const WHS_WEIGHT        = 10      // équilibre des handicaps : par (écart de moyenne WHS d'un flight)² ; 3 coups d'écart ≈ 90, un peu moins qu'une paire récente
const BALANCE_WEIGHT    = 2000    // répartition 9F / 9B : bien au-dessus de l'historique, sous les paires interdites

// Catégorie d'un joueur : 0 = normal (18 trous ou 9 trous sans section), 1 = 9 trous Front, 2 = 9 trous Back
type Cat = 0 | 1 | 2
function categoryOf(p: any): Cat {
  if (p?.holes_played === 9) {
    if (p.holes_section === 'out') return 1
    if (p.holes_section === 'in')  return 2
  }
  return 0
}

/**
 * Coût de répartition d'un flight : nF² + nB² + (nF − nB)².
 * Minimal quand les 9F sont répartis également, les 9B aussi, et que chaque flight
 * a autant de 9B que de 9F (le 9B remplace le 9F).
 */
function balanceCost(nF: number, nB: number): number {
  return nF * nF + nB * nB + (nF - nB) * (nF - nB)
}

// ── Historique des paires (utilisé aussi par la matrice affichée sous les flights) ──

export type PairHistoryEntry = {
  /** Nombre de fois où la paire a joué ensemble sur la période chargée. */
  count: number
  /** Même chose, mais chaque partie est pondérée selon sa proximité avec l'événement (1 = très proche). */
  weight: number
  /** Date (ms) de la rencontre la plus proche de l'événement, ou null si les dates sont inconnues. */
  lastDate: number | null
  /** Nombre de jours entre cette rencontre et l'événement (valeur absolue), ou null si inconnu. */
  daysAway: number | null
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
    let days: number | null = null
    const t = flight.date ? new Date(flight.date).getTime() : NaN
    if (!Number.isNaN(t) && !Number.isNaN(ref)) {
      days = Math.abs(ref - t) / DAY_MS
      weight = Math.pow(0.5, days / halfLifeDays)
    }

    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const key = pairKey(ps[i].id, ps[j].id)
        const e = map.get(key) ?? { count: 0, weight: 0, lastDate: null, daysAway: null }
        e.count += 1
        e.weight += weight
        if (days !== null && (e.daysAway === null || days < e.daysAway)) { e.daysAway = days; e.lastDate = t }
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

/**
 * Répartition de départ qui respecte déjà la contrainte 9F / 9B :
 * les 9F sont distribués un par flight (tour à tour), puis les 9B dans le même ordre de flights
 * (donc d'abord là où il y a un 9F), puis tous les autres joueurs remplissent les places libres.
 */
function buildInitial(n: number, sizes: number[], cat: Cat[]): number[][] {
  const all = shuffle(Array.from({ length: n }, (_, i) => i))
  const flights: number[][] = sizes.map(() => [])
  const order = shuffle(sizes.map((_, i) => i))

  const placeRoundRobin = (members: number[]) => {
    let ptr = 0
    for (const idx of members) {
      let guard = 0
      while (flights[order[ptr % order.length]].length >= sizes[order[ptr % order.length]] && guard++ < order.length) ptr++
      const f = order[ptr % order.length]
      if (flights[f].length < sizes[f]) flights[f].push(idx)
      ptr++
    }
  }

  placeRoundRobin(all.filter(i => cat[i] === 1))
  placeRoundRobin(all.filter(i => cat[i] === 2))

  const others = all.filter(i => cat[i] === 0)
  let o = 0
  for (let f = 0; f < flights.length; f++) {
    while (flights[f].length < sizes[f] && o < others.length) flights[f].push(others[o++])
  }
  return flights
}

function searchBest(n: number, sizes: number[], pen: number[][], totalSteps: number, cat: Cat[], whs: number[] | null): number[][] {
  // Un seul flight, ou aucun échange possible : rien à optimiser.
  if (sizes.length < 2) return buildInitial(n, sizes, cat)

  const restarts      = 6
  const stepsPerStart = Math.max(500, Math.floor(totalSteps / restarts))
  const T0            = HISTORY_WEIGHT * 0.8   // température de départ (≈ une paire récente)

  const countOf = (flight: number[], c: Cat) => flight.reduce((k, idx) => k + (cat[idx] === c ? 1 : 0), 0)
  const structural = (flights: number[][]) =>
    flights.reduce((sum, f) => sum + balanceCost(countOf(f, 1), countOf(f, 2)), 0) * BALANCE_WEIGHT

  // Équilibre WHS : coût d'un flight = (moyenne du flight − moyenne générale)²
  const mu = whs && n > 0 ? whs.reduce((a, b) => a + b, 0) / n : 0
  const whsCost = (sum: number, size: number) => size > 0 ? WHS_WEIGHT * (sum / size - mu) ** 2 : 0
  const whsTotal = (flights: number[][]) =>
    whs ? flights.reduce((acc, f) => acc + whsCost(f.reduce((a, idx) => a + whs[idx], 0), f.length), 0) : 0

  let best: number[][] = buildInitial(n, sizes, cat)
  let bestScore = totalPenalty(best, pen) + structural(best) + whsTotal(best)

  for (let r = 0; r < restarts; r++) {
    const cur = buildInitial(n, sizes, cat)
    let curScore = totalPenalty(cur, pen) + structural(cur) + whsTotal(cur)
    const nF = cur.map(f => countOf(f, 1))
    const nB = cur.map(f => countOf(f, 2))
    const sumW = cur.map(f => whs ? f.reduce((a, idx) => a + whs[idx], 0) : 0)   // somme des WHS par flight

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

      // Variation de la contrainte 9F / 9B (seulement si on échange deux catégories différentes).
      const cx = cat[x], cy = cat[y]
      let newFi = nF[i], newBi = nB[i], newFj = nF[j], newBj = nB[j]
      if (cx !== cy) {
        newFi += (cy === 1 ? 1 : 0) - (cx === 1 ? 1 : 0)
        newBi += (cy === 2 ? 1 : 0) - (cx === 2 ? 1 : 0)
        newFj += (cx === 1 ? 1 : 0) - (cy === 1 ? 1 : 0)
        newBj += (cx === 2 ? 1 : 0) - (cy === 2 ? 1 : 0)
        delta += BALANCE_WEIGHT * (
          balanceCost(newFi, newBi) + balanceCost(newFj, newBj)
          - balanceCost(nF[i], nB[i]) - balanceCost(nF[j], nB[j])
        )
      }

      // Variation de l'équilibre WHS (les tailles de flights ne changent pas dans un échange).
      let newSi = sumW[i], newSj = sumW[j]
      if (whs) {
        newSi += whs[y] - whs[x]
        newSj += whs[x] - whs[y]
        delta += whsCost(newSi, fi.length) + whsCost(newSj, fj.length)
               - whsCost(sumW[i], fi.length) - whsCost(sumW[j], fj.length)
      }

      const temperature = T0 * (1 - s / stepsPerStart) + 0.01
      if (delta <= 0 || Math.random() < Math.exp(-delta / temperature)) {
        fi[xi] = y
        fj[yi] = x
        nF[i] = newFi; nB[i] = newBi; nF[j] = newFj; nB[j] = newBj
        sumW[i] = newSi; sumW[j] = newSj
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
  const cat: Cat[] = players.map(categoryOf)
  // Valeurs WHS pour l'équilibrage (sans WHS = moyenne générale) ; null si l'option est désactivée.
  let whsVals: number[] | null = null
  if (balanceWHS) {
    const known = players.map(p => (p.whs === null || p.whs === undefined || Number.isNaN(Number(p.whs))) ? null : Number(p.whs))
    const vals  = known.filter((v): v is number => v !== null)
    const avg   = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    whsVals = vals.length >= 2 ? known.map(v => v ?? avg) : null
  }
  const best       = searchBest(players.length, sizes, pen, totalSteps, cat, whsVals)

  let flightArrays: any[][] = best.map(flight => flight.map(idx => players[idx]))

  // Affichage : dans chaque flight, trier du plus faible au plus fort WHS
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

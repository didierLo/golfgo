// ===================== TYPES =====================

export type ScoringHole = {
  hole_number: number
  par: number
  stroke_index: number
}

export type ScoringScore = {
  player_id: string
  hole: number
  strokes: number
}

// ===================== HELPERS =====================

/**
 * Strokes received by a player on a specific hole.
 * phcp=18 → 1 stroke per hole
 * phcp=20 → 1 stroke per hole + 1 extra on holes SI ≤ 2
 * phcp=36 → 2 strokes per hole
 */
export function strokesReceived(phcp: number, strokeIndex: number): number {
  if (phcp <= 0) return 0
  const full = Math.floor(phcp / 18)
  const remainder = phcp % 18
  return full + (strokeIndex <= remainder ? 1 : 0)
}

/**
 * Stableford points for one hole with handicap.
 * net = brut - strokesReceived
 * points: net ≤ par-2 → 4, par-1 → 3, par → 2, par+1 → 1, else → 0
 */
export function getStablefordPoints(
  strokes: number,
  par: number,
  recv: number = 0
): number {
  const net = strokes - recv
  return Math.max(0, par - net + 2)
}

/**
 * Total Stableford points for a player over a set of holes.
 */
export function getStablefordTotal(
  playerId: string,
  phcp: number,
  scores: ScoringScore[],
  holes: ScoringHole[]
): number {
  return holes.reduce((total, h) => {
    const score = scores.find(s => s.player_id === playerId && s.hole === h.hole_number)
    if (!score) return total
    const recv = strokesReceived(phcp, h.stroke_index)
    return total + getStablefordPoints(score.strokes, h.par, recv)
  }, 0)
}

/**
 * Total brut (gross strokes) for a player over a set of holes.
 */
export function getBrutTotal(
  playerId: string,
  scores: ScoringScore[],
  holes: ScoringHole[]
): number {
  return holes.reduce((total, h) => {
    const score = scores.find(s => s.player_id === playerId && s.hole === h.hole_number)
    return score ? total + score.strokes : total
  }, 0)
}

/**
 * Total net strokes for a player over a set of holes.
 */
export function getNetTotal(
  playerId: string,
  phcp: number,
  scores: ScoringScore[],
  holes: ScoringHole[]
): number {
  return holes.reduce((total, h) => {
    const score = scores.find(s => s.player_id === playerId && s.hole === h.hole_number)
    if (!score) return total
    const recv = strokesReceived(phcp, h.stroke_index)
    return total + (score.strokes - recv)
  }, 0)
}

/**
 * Computing Playing Handicap from WHS index + tee info.
 */
export function computePhcp(
  whs: number,
  slope: number,
  courseRating: number,
  parTotal: number
): number {
  return Math.round(whs * (slope / 113) + courseRating - parTotal)
}

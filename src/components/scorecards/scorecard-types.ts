export type Hole    = { hole_number: number; par: number; stroke_index: number }
export type TeeInfo = { id: string; tee_name: string; par_total: number; course_rating: number; slope: number }
export type Player  = { id: string; first_name: string; surname: string; whs: number; tee_id: string | null; tee?: TeeInfo; phcp: number }
export type ScoreMap = Record<string, Record<number, number | null>>

export function computePhcp(whs: number, tee?: TeeInfo): number {
  if (!tee) return Math.round(whs)
  return Math.round(whs * (tee.slope / 113) + tee.course_rating - tee.par_total)
}

/**
 * Retrouve le départ par défaut d'un joueur (couleur + genre) parmi les départs
 * du parcours, quand aucun départ n'a été explicitement choisi pour l'événement.
 * Sans ce fallback, computePhcp() retombe sur un simple arrondi du WHS brut —
 * sans ajustement slope/course rating — ce qui a été la source d'un vrai bug
 * (coups reçus incorrects sur la carte de score en direct).
 */
export function findDefaultTee(teesData: TeeInfo[], color: string, gender?: string): TeeInfo | undefined {
  const c = color.toLowerCase()
  const gw = gender === 'F' ? 'lad' : 'men'
  return (
    teesData.find(t => t.tee_name.toLowerCase().includes(c) && t.tee_name.toLowerCase().includes(gw)) ??
    teesData.find(t => t.tee_name.toLowerCase() === c) ??
    teesData.find(t => t.tee_name.toLowerCase().startsWith(c)) ??
    teesData.find(t => t.tee_name.toLowerCase().includes(c))
  )
}

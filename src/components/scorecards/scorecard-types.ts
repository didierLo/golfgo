export type Hole    = { hole_number: number; par: number; stroke_index: number }
export type TeeInfo = { id: string; tee_name: string; par_total: number; course_rating: number; slope: number }
export type Player  = { id: string; first_name: string; surname: string; whs: number; tee_id: string | null; tee?: TeeInfo; phcp: number }
export type ScoreMap = Record<string, Record<number, number | null>>

export function computePhcp(whs: number, tee?: TeeInfo): number {
  if (!tee) return Math.round(whs)
  return Math.round(whs * (tee.slope / 113) + tee.course_rating - tee.par_total)
}

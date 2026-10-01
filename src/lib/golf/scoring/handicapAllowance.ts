// Allocations de handicap par formule — WHS, Règles de Handicap, Appendice C.
//
// Une formule porte une liste de coefficients, du plus bas handicap au plus haut :
//   Stableford / Strokeplay      [100]            (choix GolfGo ; le WHS recommande 95)
//   Matchplay                    [100] + match_play : on joue sur la différence avec le plus bas
//   4BBB                         [85]             chaque joueur, sa propre balle
//   Foursome                     [50, 50]         50 % de la somme
//   Greensome                    [60, 40]         60 % du plus bas + 40 % du plus haut
//   Scramble à 2 / 3 / 4         [35,15] / [30,20,10] / [25,20,15,10]
//                                (adapté automatiquement au nombre réel de joueurs de l'équipe)
//
// Le réglage d'un événement (hcp_percentage_override) remplace la liste par un pourcentage
// unique appliqué à chaque joueur — c'est la dérogation ponctuelle voulue par l'organisateur.
//
// Les coefficients s'appliquent au handicap de parcours NON arrondi (WHS 6.1b), puis on arrondit.

import type { TeeInfo } from '@/components/scorecards/scorecard-types'

export type HcpRule = { allowances: number[]; matchPlay: boolean }

export const DEFAULT_HCP_RULE: HcpRule = { allowances: [100], matchPlay: false }

type FormatRow = {
  hcp_allowances?: (number | string)[] | null
  hcp_percentage?: number | string | null
  match_play?: boolean | null
} | null | undefined

export function resolveHcpRule(format: FormatRow, override?: number | string | null): HcpRule {
  const matchPlay = !!format?.match_play
  if (override != null && override !== '' && !Number.isNaN(Number(override))) {
    return { allowances: [Number(override)], matchPlay }
  }
  const list = (format?.hcp_allowances ?? []).map(Number).filter(n => !Number.isNaN(n))
  if (list.length) return { allowances: list, matchPlay }
  const pct = format?.hcp_percentage != null ? Number(format.hcp_percentage) : 100
  return { allowances: [Number.isNaN(pct) ? 100 : pct], matchPlay }
}

/** Texte lisible des coefficients : « 100 % », « 60 % / 40 % », « 25 % / 20 % / 15 % / 10 % ». */
export function formatAllowances(allowances: number[]): string {
  return allowances.map(a => `${a} %`).join(' / ')
}

type HcpSource = { phcp: number; whs?: number | null; tee?: TeeInfo | null }

/** Handicap de parcours non arrondi si le départ est connu, sinon le handicap déjà calculé. */
export function courseHandicap(p: HcpSource): number {
  if (p.tee && p.whs != null) {
    return p.whs * (p.tee.slope / 113) + p.tee.course_rating - p.tee.par_total
  }
  return p.phcp
}

function roundHcp(x: number): number {
  // Arrondi WHS : .5 vers le haut ; un handicap « plus » remonte vers zéro.
  return Math.round(x)
}

/** Handicap de jeu individuel (individuel, matchplay, 4BBB). */
export function individualPlayingHcp(p: HcpSource, rule: HcpRule): number {
  return roundHcp(courseHandicap(p) * (rule.allowances[0] ?? 100) / 100)
}

/**
 * Handicap de jeu d'une équipe (foursome, greensome, scrambles) : les joueurs sont classés
 * du plus bas au plus haut handicap, chacun reçoit son coefficient. S'il y a plus de joueurs
 * que de coefficients, le dernier coefficient s'applique aux suivants.
 */
export function teamPlayingHcp(members: HcpSource[], rule: HcpRule): number {
  const sorted = [...members].map(courseHandicap).sort((a, b) => a - b)
  const allowances = scrambleAllowancesFor(rule.allowances, sorted.length) ?? rule.allowances
  const last = allowances[allowances.length - 1] ?? 100
  const total = sorted.reduce((s, ch, i) => s + ch * (allowances[i] ?? last) / 100, 0)
  return roundHcp(total)
}

// Scramble : les coefficients dépendent du nombre de joueurs de l'équipe. Une équipe de 3 dans un
// « Scramble (4) » (flights incomplets) reçoit donc 30/20/10, et non 25/20/15.
const SCRAMBLE: Record<number, number[]> = { 2: [35, 15], 3: [30, 20, 10], 4: [25, 20, 15, 10] }
function scrambleAllowancesFor(allowances: number[], teamSize: number): number[] | null {
  const isScramble = Object.values(SCRAMBLE).some(set => set.length === allowances.length && set.every((v, i) => v === allowances[i]))
  return isScramble ? (SCRAMBLE[teamSize] ?? null) : null
}

/**
 * Matchplay : le joueur le plus bas joue à 0, les autres reçoivent la différence.
 * `flight` = les joueurs entre lesquels se jouent les matchs (le flight).
 */
export function matchPlayStrokes(p: HcpSource, flight: HcpSource[], rule: HcpRule): number {
  const mine = individualPlayingHcp(p, rule)
  if (!rule.matchPlay || flight.length < 2) return mine
  const lowest = Math.min(...flight.map(f => individualPlayingHcp(f, rule)))
  return Math.max(0, mine - lowest)
}

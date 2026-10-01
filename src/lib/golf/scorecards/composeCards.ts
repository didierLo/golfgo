import type { PrintPlayer } from '@/components/scorecards/buildScorecardHtml'
import type { ScoreEntrant } from '@/components/scorecards/ScorecardTable'
import {
  individualPlayingHcp, teamPlayingHcp, matchPlayStrokes, type HcpRule,
} from '@/lib/golf/scoring/handicapAllowance'

export type TeamFormat = 'individual' | '4bbb' | 'team2' | 'team3_4'

export type CardRow    = { names: string[]; playingHcp: number }
export type CardRefRow = { label: string }
export type ComposedCard = {
  headerLabel: string
  mainRows: CardRow[]
  refRows: CardRefRow[]
}

function fullName(p: PrintPlayer) { return `${p.first_name} ${p.surname}` }
function shortName(p: PrintPlayer) {
  const initial = p.first_name?.trim()?.[0]?.toUpperCase() ?? ''
  return `${initial}. ${p.surname}`
}
type HcpPlayer = { id: string; phcp: number; whs?: number | null; tee?: PrintPlayer['tee'] }

/** Handicap de jeu d'un joueur seul, selon la formule (matchplay : différence avec le plus bas du flight). */
export function playerHcp(p: HcpPlayer, rule: HcpRule, flight: HcpPlayer[] = []): number {
  return rule.matchPlay ? matchPlayStrokes(p, flight, rule) : individualPlayingHcp(p, rule)
}

/**
 * Ce qu'affiche une carte de saisie (ScorecardTable) pour le groupe d'un joueur :
 *   - individuel / matchplay : le joueur seul
 *   - 4bbb : les 2 joueurs de la paire, chacun avec son handicap de jeu
 *   - team2 / team3_4 : une « carte d'équipe » portée par le 1er joueur du groupe (ancre),
 *     avec le handicap d'équipe pondéré (60/40, 25/20/15/10…)
 */
export function cardEntrants(
  group: HcpPlayer[], teamFormat: TeamFormat, rule: HcpRule, activePlayerId: string | null, flight: HcpPlayer[] = [],
): ScoreEntrant[] {
  if (teamFormat === '4bbb') return group.map(p => ({ id: p.id, phcp: individualPlayingHcp(p, rule) }))
  if (teamFormat === 'team2' || teamFormat === 'team3_4') {
    if (!group.length) return []
    return [{ id: group[0].id, phcp: teamPlayingHcp(group, rule) }]
  }
  const solo = group.find(p => p.id === activePlayerId) ?? group[0]
  return solo ? [{ id: solo.id, phcp: playerHcp(solo, rule, flight) }] : []
}

// Regroupement "qui partage une carte/équipe" — même logique de position que composeCards,
// réutilisée par la saisie digitale pour rester cohérente avec l'impression
export function getTeamGroups<T extends { id: string }>(players: T[], teamFormat: TeamFormat): T[][] {
  if (teamFormat === '4bbb' || teamFormat === 'team2') {
    const pairs = [[0, 1], [2, 3]].filter(t => t.every(i => players[i]))
    return pairs.map(([a, b]) => [players[a], players[b]])
  }
  if (teamFormat === 'team3_4') return players.length ? [players] : []
  return players.map(p => [p]) // individuel : chacun seul
}

// Ordre attendu : players triés par flight_players.position (P1..P4)

// 1) Stroke-play / Stableford — cycle asymétrique confirmé : 1↔3, 2↔4, 3↔2, 4↔1
const INDIVIDUAL_PARTNER = [2, 3, 1, 0]

function composeIndividual(players: PrintPlayer[], rule: HcpRule): ComposedCard[] {
  if (players.length !== 4) {
    return players.map((p, i) => ({
      headerLabel: fullName(p),
      mainRows: [{ names: [shortName(p)], playingHcp: playerHcp(p, rule, players) }],
      refRows: players.length > 1 ? [{ label: shortName(players[(i + 1) % players.length]) }] : [],
    }))
  }
  return players.map((p, i) => ({
    headerLabel: fullName(p),
    mainRows: [{ names: [shortName(p)], playingHcp: playerHcp(p, rule, players) }],
    refRows: [{ label: shortName(players[INDIVIDUAL_PARTNER[i]]) }],
  }))
}

function compose4BBB(players: PrintPlayer[], rule: HcpRule, teamLabel: (n: number) => string): ComposedCard[] {
  const teams = [[0, 1], [2, 3]].filter(t => t.every(i => players[i]))
  return teams.map(([a, b], idx) => {
    const other = teams[1 - idx] ?? []
    return {
      headerLabel: teamLabel(idx + 1),
      mainRows: [a, b].map(i => ({ names: [shortName(players[i])], playingHcp: individualPlayingHcp(players[i], rule) })),
      refRows: other.map(i => ({ label: shortName(players[i]) })),
    }
  })
}

function composeTeam2(players: PrintPlayer[], rule: HcpRule): ComposedCard[] {
  const teams = [[0, 1], [2, 3]].filter(t => t.every(i => players[i]))
  const teamLabels = teams.map(([a, b]) => [players[a], players[b]].map(shortName).join(' & '))
  return teams.map(([a, b], idx) => {
    const members = [players[a], players[b]]
    return {
      headerLabel: teamLabels[idx],
      mainRows: [{ names: members.map(shortName), playingHcp: teamPlayingHcp(members, rule) }],
      refRows: [{ label: teamLabels[1 - idx] ?? '' }],
    }
  })
}
function composeTeam34(players: PrintPlayer[], rule: HcpRule): ComposedCard[] {
  return [{
    headerLabel: players.map(shortName).join(' & '),
    mainRows: [{ names: players.map(shortName), playingHcp: teamPlayingHcp(players, rule) }],
    refRows: [],
  }]
}

export function composeCards(
  players: PrintPlayer[], teamFormat: TeamFormat, rule: HcpRule,
  teamLabel: (n: number) => string = n => `Équipe ${n}`,
): ComposedCard[] {
  switch (teamFormat) {
    case '4bbb':     return compose4BBB(players, rule, teamLabel)
    case 'team2':    return composeTeam2(players, rule)
    case 'team3_4':  return composeTeam34(players, rule)
    default:         return composeIndividual(players, rule)
  }
}
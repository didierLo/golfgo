import type { PrintPlayer } from '@/components/scorecards/buildScorecardHtml'

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
function playingHcp(phcp: number, pct: number) { return Math.round(phcp * (pct / 100)) }
function teamPhcp(members: PrintPlayer[], pct: number) {
  return Math.round(members.reduce((s, p) => s + p.phcp, 0) * (pct / 100))
}

// Ordre attendu : players triés par flight_players.position (P1..P4)

// 1) Stroke-play / Stableford — cycle asymétrique confirmé : 1↔3, 2↔4, 3↔2, 4↔1
const INDIVIDUAL_PARTNER = [2, 3, 1, 0]

function composeIndividual(players: PrintPlayer[], pct: number): ComposedCard[] {
  if (players.length !== 4) {
    return players.map((p, i) => ({
      headerLabel: fullName(p),
      mainRows: [{ names: [shortName(p)], playingHcp: playingHcp(p.phcp, pct) }],
      refRows: players.length > 1 ? [{ label: shortName(players[(i + 1) % players.length]) }] : [],
    }))
  }
  return players.map((p, i) => ({
    headerLabel: fullName(p),
    mainRows: [{ names: [shortName(p)], playingHcp: playingHcp(p.phcp, pct) }],
    refRows: [{ label: shortName(players[INDIVIDUAL_PARTNER[i]]) }],
  }))
}

function compose4BBB(players: PrintPlayer[], pct: number): ComposedCard[] {
  const teams = [[0, 1], [2, 3]].filter(t => t.every(i => players[i]))
  return teams.map(([a, b], idx) => {
    const other = teams[1 - idx] ?? []
    return {
      headerLabel: `Équipe ${idx + 1}`,
      mainRows: [a, b].map(i => ({ names: [shortName(players[i])], playingHcp: playingHcp(players[i].phcp, pct) })),
      refRows: other.map(i => ({ label: shortName(players[i]) })),
    }
  })
}

function composeTeam2(players: PrintPlayer[], pct: number): ComposedCard[] {
  const teams = [[0, 1], [2, 3]].filter(t => t.every(i => players[i]))
  const teamLabels = teams.map(([a, b]) => [players[a], players[b]].map(shortName).join(' & '))
  return teams.map(([a, b], idx) => {
    const members = [players[a], players[b]]
    return {
      headerLabel: teamLabels[idx],
      mainRows: [{ names: members.map(shortName), playingHcp: teamPhcp(members, pct) }],
      refRows: [{ label: teamLabels[1 - idx] ?? '' }],
    }
  })
}
function composeTeam34(players: PrintPlayer[], pct: number): ComposedCard[] {
  return [{
    headerLabel: players.map(shortName).join(' & '),
    mainRows: [{ names: players.map(shortName), playingHcp: teamPhcp(players, pct) }],
    refRows: [],
  }]
}

export function composeCards(players: PrintPlayer[], teamFormat: TeamFormat, hcpPercentage: number): ComposedCard[] {
  switch (teamFormat) {
    case '4bbb':     return compose4BBB(players, hcpPercentage)
    case 'team2':    return composeTeam2(players, hcpPercentage)
    case 'team3_4':  return composeTeam34(players, hcpPercentage)
    default:         return composeIndividual(players, hcpPercentage)
  }
}
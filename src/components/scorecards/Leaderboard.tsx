'use client'

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { getBrutTotal, getStablefordPoints, strokesReceived, type ScoringHole, type ScoringScore } from '@/lib/golf/scoring/stableford'
import type { Player } from '@/components/scorecards/scorecard-types'
import { getTeamGroups, type TeamFormat } from '@/lib/golf/scorecards/composeCards'
import {
  resolveHcpRule, individualPlayingHcp, teamPlayingHcp, matchPlayStrokes, DEFAULT_HCP_RULE, type HcpRule,
} from '@/lib/golf/scoring/handicapAllowance'

// Une ligne du classement : un joueur (individuel, matchplay) ou une équipe (4BBB, foursome, greensome, scramble).
type LeaderboardEntry = {
  key: string; name: string; phcpLabel: string; holesPlayed: number; brut: number; net: number; pts: number; score: number
}

// Points / net d'un trou pour un handicap de jeu donné
function holeResult(strokes: number, h: ScoringHole, phcp: number) {
  const recv = strokesReceived(phcp, h.stroke_index)
  return { net: strokes - recv, pts: getStablefordPoints(strokes, h.par, recv) }
}

type Props = {
  eventId: string; scorecardId: string; players: Player[]
  holes: ScoringHole[]; eventFormat: 'stroke' | 'stableford'
  isOwner?: boolean
  eventTitle?: string
  eventDate?: string
}

const supabase = createClient()
export default function Leaderboard({ eventId, scorecardId, players, holes, eventFormat, isOwner = false, eventTitle = '', eventDate = '' }: Props) {
 
  const t      = useTranslations()
  const locale = useLocale()
  const isStableford = eventFormat === 'stableford'

  const [entries,   setEntries]   = useState<LeaderboardEntry[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => { if (players.length > 0 && holes.length > 0) loadScores() }, [scorecardId, players, holes])

  async function loadScores() {
    setLoading(true)
    // Formule de l'événement (coefficients WHS, dérogation éventuelle) + flights ordonnés
    // (le regroupement par équipe suit l'ordre des positions, comme l'impression et la saisie)
    const [{ data: scoresData }, { data: ev }, { data: flightsData }] = await Promise.all([
      supabase.from('scores').select('player_id, hole, strokes')
        .eq('scorecard_id', scorecardId).eq('event_id', eventId).in('player_id', players.map(p => p.id)),
      supabase.from('events').select('hcp_percentage_override, competition_formats(team_format, hcp_percentage, hcp_allowances, match_play)')
        .eq('id', eventId).single(),
      supabase.from('flights').select('flight_number, flight_players(position, player_id)').eq('event_id', eventId).order('flight_number'),
    ])
    const fmt = (ev as any)?.competition_formats
    const teamFormat: TeamFormat = fmt?.team_format ?? 'individual'
    const rule: HcpRule = ev ? resolveHcpRule(fmt, (ev as any).hcp_percentage_override) : DEFAULT_HCP_RULE
    const byId = new Map(players.map(p => [p.id, p]))
    const flights: Player[][] = (flightsData || []).map((f: any) =>
      (f.flight_players || []).slice().sort((a: any, b: any) => a.position - b.position)
        .map((fp: any) => byId.get(fp.player_id)).filter(Boolean) as Player[])
    const placed = new Set(flights.flat().map(p => p.id))
    const loose = players.filter(p => !placed.has(p.id))
    const scores: ScoringScore[] = (scoresData || []).map(s => ({ player_id: s.player_id, hole: s.hole, strokes: s.strokes }))
    buildEntries(scores, teamFormat, rule, flights, loose)
    setLoading(false)
  }

  function buildEntries(scores: ScoringScore[], teamFormat: TeamFormat, rule: HcpRule, flights: Player[][], loose: Player[]) {
    const scoreOf = (pid: string, hole: number) => scores.find(s => s.player_id === pid && s.hole === hole)?.strokes
    const fullName = (p: Player) => `${p.first_name} ${p.surname}`
    const built: LeaderboardEntry[] = []

    // Individuel / matchplay : chaque joueur avec son handicap de jeu
    function individual(p: Player, flight: Player[]) {
      const phcp = rule.matchPlay ? matchPlayStrokes(p, flight, rule) : individualPlayingHcp(p, rule)
      let net = 0, pts = 0, played = 0
      holes.forEach(h => {
        const st = scoreOf(p.id, h.hole_number); if (st == null) return
        const r = holeResult(st, h, phcp); net += r.net; pts += r.pts; played++
      })
      built.push({ key: p.id, name: fullName(p), phcpLabel: String(phcp), holesPlayed: played,
        brut: getBrutTotal(p.id, scores, holes), net, pts, score: isStableford ? pts : net })
    }

    // 4BBB : meilleure balle de la paire sur chaque trou, chacun avec son handicap de jeu
    function fourBall(pair: Player[]) {
      const phcps = pair.map(p => individualPlayingHcp(p, rule))
      let net = 0, pts = 0, played = 0, brut = 0
      holes.forEach(h => {
        const results = pair.map((p, i) => {
          const st = scoreOf(p.id, h.hole_number)
          return st == null ? null : { st, ...holeResult(st, h, phcps[i]) }
        }).filter(Boolean) as { st: number; net: number; pts: number }[]
        if (!results.length) return
        played++
        pts += Math.max(...results.map(r => r.pts))
        net += Math.min(...results.map(r => r.net))
        brut += Math.min(...results.map(r => r.st))
      })
      built.push({ key: pair.map(p => p.id).join('-'), name: pair.map(fullName).join(' & '),
        phcpLabel: phcps.join(' / '), holesPlayed: played, brut, net, pts, score: isStableford ? pts : net })
    }

    // Foursome, greensome, scramble : une carte d'équipe, portée par le 1er joueur (ancre)
    function team(group: Player[]) {
      const anchor = group[0]
      const phcp = teamPlayingHcp(group, rule)
      let net = 0, pts = 0, played = 0
      holes.forEach(h => {
        const st = scoreOf(anchor.id, h.hole_number); if (st == null) return
        const r = holeResult(st, h, phcp); net += r.net; pts += r.pts; played++
      })
      built.push({ key: group.map(p => p.id).join('-'), name: group.map(fullName).join(' & '), phcpLabel: String(phcp),
        holesPlayed: played, brut: getBrutTotal(anchor.id, scores, holes), net, pts, score: isStableford ? pts : net })
    }

    for (const flight of flights) {
      if (teamFormat === 'individual') { flight.forEach(p => individual(p, flight)); continue }
      const groups = getTeamGroups(flight, teamFormat)
      const grouped = new Set(groups.flat().map(p => p.id))
      groups.forEach(g => (teamFormat === '4bbb' ? fourBall(g) : team(g)))
      flight.filter(p => !grouped.has(p.id)).forEach(p => individual(p, flight))   // joueur sans équipe complète
    }
    loose.forEach(p => individual(p, [p]))   // pas encore dans un flight

    // Seules les lignes qui ont au moins un score comptent dans le classement
    const withScores = built.filter(e => e.holesPlayed > 0)
    withScores.sort((a, b) => isStableford ? b.score - a.score : a.score - b.score)
    setEntries(withScores)
  }

  if (loading) return <div className="text-[13px] text-slate-400 py-4">{t('common.loading')}</div>
  if (entries.length === 0) return <div className="text-[13px] text-slate-400 py-4">{t('leaderboard.noScores')}</div>

  return (
    <>
      <style jsx global>{`
        @media print {
          nav, header, aside, .no-print { display: none !important; }
          body { background: white; margin: 0; }
          .print-lb-header {
            display: flex !important; align-items: center; justify-content: space-between;
            padding: 16px 0 12px; border-bottom: 3px solid #185FA5; margin-bottom: 20px;
          }
          .print-lb-logo-golf { font-size: 20px; font-weight: 900; color: #185FA5; }
          .print-lb-logo-go   { font-size: 20px; font-weight: 900; color: #4CAF1A; }
          .print-lb-title     { font-size: 15px; font-weight: 700; color: #1a1a1a; text-align: right; }
          .print-lb-date      { font-size: 12px; color: #6B7280; text-align: right; margin-top: 2px; }
          .print-lb-footer {
            display: flex !important; justify-content: space-between;
            margin-top: 20px; padding-top: 10px;
            border-top: 1px solid #E5E7EB; font-size: 10px; color: #9CA3AF;
          }
        }
        .print-lb-header, .print-lb-footer { display: none; }
      `}</style>

      <div className="print-lb-header">
        <div>
          <span className="print-lb-logo-golf">Golf</span>
          <span className="print-lb-logo-go">Go</span>
        </div>
        <div>
          <div className="print-lb-title">{eventTitle} — {t('leaderboard.title')}</div>
          <div className="print-lb-date">{eventDate}</div>
        </div>
      </div>

      <div className="mt-6">
        
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-3 py-2.5 text-center w-8 text-[11px] font-semibold text-slate-500">#</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500">{t('participants.player')}</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-500">Phcp</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-500">{t('participants.holes')}</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-500">{t('scoring.gross')}</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-bold text-slate-700">
                  {isStableford ? t('scoring.pts') : t('scoring.net')}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.key} className={`border-t border-slate-100 ${i === 0 ? 'bg-amber-50/60' : 'hover:bg-slate-50'} transition-colors`}>
                  <td className="px-3 py-2.5 text-center font-black text-slate-500">{i === 0 ? '🏆' : i + 1}</td>
                  <td className="px-3 py-2.5 font-semibold text-slate-900">{e.name}</td>
                  <td className="px-3 py-2.5 text-center text-slate-500">{e.phcpLabel}</td>
                  <td className="px-3 py-2.5 text-center text-slate-500">{e.holesPlayed}</td>
                  <td className="px-3 py-2.5 text-center text-slate-500">{e.brut || '—'}</td>
                  <td className="px-3 py-2.5 text-center font-black text-slate-900">{e.score || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="print-lb-footer">
          <span>{t('teesheet.printFooter.siteUrl')}</span>
          <span>{t('teesheet.printFooter.printedOn', { date: new Date().toLocaleDateString(locale) })}</span>
        </div>
      </div>
    </>
  )
}

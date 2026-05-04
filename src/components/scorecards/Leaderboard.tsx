'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getStablefordTotal, getBrutTotal, getNetTotal, type ScoringHole, type ScoringScore } from '@/lib/golf/scoring/stableford'
import type { Player } from '@/app/(app)/groups/[id]/events/[eventId]/scorecards/page'

type LeaderboardEntry = {
  player: Player; holesPlayed: number; brut: number; net: number; pts: number; score: number
}

type Props = {
  eventId: string; scorecardId: string; players: Player[]
  holes: ScoringHole[]; eventFormat: 'stroke' | 'stableford'
  isOwner?: boolean
  eventTitle?: string
  eventDate?: string
}

export default function Leaderboard({ eventId, scorecardId, players, holes, eventFormat, isOwner = false, eventTitle = '', eventDate = '' }: Props) {
  const supabase = createClient()
  const isStableford = eventFormat === 'stableford'

  const [entries,         setEntries]         = useState<LeaderboardEntry[]>([])
  const [loading,         setLoading]         = useState(true)
  const [savingLb,        setSavingLb]        = useState(false)
  const [saveMsgLb,       setSaveMsgLb]       = useState('')
  const [savingSc,        setSavingSc]        = useState(false)
  const [saveMsgSc,       setSaveMsgSc]       = useState('')

  useEffect(() => { if (players.length > 0 && holes.length > 0) loadScores() }, [scorecardId, players, holes])

  async function loadScores() {
    setLoading(true)
    const { data: scoresData } = await supabase.from('scores').select('player_id, hole, strokes')
      .eq('scorecard_id', scorecardId).eq('event_id', eventId).in('player_id', players.map(p => p.id))
    const scores: ScoringScore[] = (scoresData || []).map(s => ({ player_id: s.player_id, hole: s.hole, strokes: s.strokes }))
    const built: LeaderboardEntry[] = players.map(player => {
      const phcp = player.phcp ?? 0
      const brut = getBrutTotal(player.id, scores, holes)
      const net  = getNetTotal(player.id, phcp, scores, holes)
      const pts  = getStablefordTotal(player.id, phcp, scores, holes)
      const holesPlayed = scores.filter(s => s.player_id === player.id).length
      return { player, holesPlayed, brut, net, pts, score: isStableford ? pts : net }
    })
    built.sort((a, b) => isStableford ? b.score - a.score : a.score - b.score)
    setEntries(built)
    setLoading(false)
  }

  async function handleSaveLeaderboard() {
    setSavingLb(true); setSaveMsgLb('')
    try {
      await supabase.from('leaderboard').upsert(
        entries.map(e => ({ player_id: e.player.id, total: e.score })),
        { onConflict: 'player_id' }
      )
      setSaveMsgLb('✓ Sauvegardé')
    } catch { setSaveMsgLb('Erreur') }
    finally { setSavingLb(false); setTimeout(() => setSaveMsgLb(''), 3000) }
  }

  async function handleSaveScorecard() {
    setSavingSc(true); setSaveMsgSc('')
    try {
      // Récupère tous les scores bruts de l'event
      const { data: scoresData } = await supabase.from('scores')
        .select('player_id, hole, strokes')
        .eq('scorecard_id', scorecardId)
        .eq('event_id', eventId)

      // Upsert dans saved_scorecards : une ligne par (event × player × hole)
      const rows = (scoresData || []).map(s => ({
        event_id:    eventId,
        scorecard_id: scorecardId,
        player_id:   s.player_id,
        hole:        s.hole,
        strokes:     s.strokes,
        saved_at:    new Date().toISOString(),
      }))

      if (rows.length > 0) {
        await supabase.from('saved_scorecards').upsert(rows, {
          onConflict: 'scorecard_id,player_id,hole',
        })
      }
      setSaveMsgSc('✓ Sauvegardé')
    } catch { setSaveMsgSc('Erreur') }
    finally { setSavingSc(false); setTimeout(() => setSaveMsgSc(''), 3000) }
  }

  if (loading) return <div className="text-[13px] text-slate-400 py-4">Chargement…</div>
  if (entries.length === 0) return <div className="text-[13px] text-slate-400 py-4">Aucun score pour l'instant.</div>

  return (
    <>
      {/* ── CSS print ── */}
      <style jsx global>{`
        @media print {
          nav, header, aside, .no-print { display: none !important; }
          body { background: white; margin: 0; }
          .print-lb-header {
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            padding: 16px 0 12px;
            border-bottom: 3px solid #185FA5;
            margin-bottom: 20px;
          }
          .print-lb-logo-golf { font-size: 20px; font-weight: 900; color: #185FA5; }
          .print-lb-logo-go   { font-size: 20px; font-weight: 900; color: #4CAF1A; }
          .print-lb-title     { font-size: 15px; font-weight: 700; color: #1a1a1a; text-align: right; }
          .print-lb-date      { font-size: 12px; color: #6B7280; text-align: right; margin-top: 2px; }
          .print-lb-footer {
            display: flex !important;
            justify-content: space-between;
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid #E5E7EB;
            font-size: 10px;
            color: #9CA3AF;
          }
        }
        .print-lb-header, .print-lb-footer { display: none; }
      `}</style>

      {/* Header print only */}
      <div className="print-lb-header">
        <div>
          <span className="print-lb-logo-golf">Golf</span>
          <span className="print-lb-logo-go">Go</span>
        </div>
        <div>
          <div className="print-lb-title">{eventTitle} — Leaderboard</div>
          <div className="print-lb-date">{eventDate}</div>
        </div>
      </div>

      <div className="mt-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2 no-print">
          <h3 className="text-[15px] font-black text-slate-900">Leaderboard</h3>
          <div className="flex items-center gap-2 flex-wrap">

            {/* Save Scorecard */}
            {saveMsgSc && <span className="text-[12px] font-semibold text-[#3B6D11]">{saveMsgSc}</span>}
            <button
              onClick={handleSaveScorecard}
              disabled={savingSc || !isOwner}
              className={`text-[12px] font-semibold px-3 py-1.5 rounded-xl border disabled:opacity-50 transition-colors ${
                isOwner
                  ? 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  : 'border-slate-200 text-slate-400 cursor-not-allowed'
              }`}>
              {savingSc ? 'Saving…' : 'Save scorecard'}
            </button>

            {/* Save Leaderboard */}
            {saveMsgLb && <span className="text-[12px] font-semibold text-[#3B6D11]">{saveMsgLb}</span>}
            <button
              onClick={handleSaveLeaderboard}
              disabled={savingLb || !isOwner}
              className={`text-[12px] font-semibold px-3 py-1.5 rounded-xl disabled:opacity-50 transition-colors ${
                isOwner
                  ? 'bg-slate-900 text-white hover:bg-slate-700'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}>
              {savingLb ? 'Saving…' : 'Save leaderboard'}
            </button>

            {/* Print */}
            <button
              onClick={() => window.print()}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
              🖨 Imprimer
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-3 py-2.5 text-center w-8 text-[11px] font-semibold text-slate-500">#</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-slate-500">Joueur</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-500">Phcp</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-500">Trous</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-slate-500">Brut</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-bold text-slate-700">
                  {isStableford ? 'Pts' : 'Net'}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.player.id} className={`border-t border-slate-100 ${i === 0 ? 'bg-amber-50/60' : 'hover:bg-slate-50'} transition-colors`}>
                  <td className="px-3 py-2.5 text-center font-black text-slate-500">
                    {i === 0 ? '🏆' : i + 1}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-slate-900">
                    {e.player.first_name} {e.player.surname}
                  </td>
                  <td className="px-3 py-2.5 text-center text-slate-500">{e.player.phcp}</td>
                  <td className="px-3 py-2.5 text-center text-slate-500">{e.holesPlayed}</td>
                  <td className="px-3 py-2.5 text-center text-slate-500">{e.brut || '—'}</td>
                  <td className="px-3 py-2.5 text-center font-black text-slate-900">{e.score || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer print only */}
        <div className="print-lb-footer">
          <span>GolfGo — golfgo-drab.vercel.app</span>
          <span>Imprimé le {new Date().toLocaleDateString('fr-BE')}</span>
        </div>
      </div>
    </>
  )
}

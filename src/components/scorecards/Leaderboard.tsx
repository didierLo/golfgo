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
  isOwner: boolean
}

export default function Leaderboard({ eventId, scorecardId, players, holes, eventFormat, isOwner }: Props) {
  const supabase = createClient()
  const isStableford = eventFormat === 'stableford'

  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

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
    setSaving(true); setSaveMsg('')
    try {
      await supabase.from('leaderboard').upsert(entries.map(e => ({ player_id: e.player.id, total: e.score })), { onConflict: 'player_id' })
      setSaveMsg('✓ Sauvegardé')
    } catch { setSaveMsg('Erreur') }
    finally { setSaving(false); setTimeout(() => setSaveMsg(''), 3000) }
  }

  if (loading) return <div className="text-[13px] text-slate-400 py-4">Chargement…</div>
  if (entries.length === 0) return <div className="text-[13px] text-slate-400 py-4">Aucun score pour l'instant.</div>

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-black text-slate-900">Leaderboard</h3>
        <div className="flex items-center gap-2">
          {saveMsg && <span className="text-[12px] font-semibold text-[#3B6D11]">{saveMsg}</span>}
          <button onClick={handleSaveLeaderboard} disabled={saving}
            className="text-[12px] font-semibold bg-slate-900 text-white px-3 py-1.5 rounded-xl disabled:opacity-50 hover:bg-slate-700 transition-colors">
            {saving ? 'Saving…' : 'Save leaderboard'}
          </button>
        </div>
      </div>

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
    </div>
  )
}

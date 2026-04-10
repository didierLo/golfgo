'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getStablefordTotal,
  getBrutTotal,
  getNetTotal,
  strokesReceived,
  type ScoringHole,
  type ScoringScore,
} from '@/lib/golf/scoring/stableford'
import type { Player, TeeInfo } from '@/app/(app)/groups/[id]/events/[eventId]/scorecards/page'
// ===================== TYPES =====================

type LeaderboardEntry = {
  player: Player
  holesPlayed: number
  brut: number
  net: number
  pts: number        // stableford points (0 if stroke play)
  score: number      // primary sort key: pts for stableford, net for stroke
}

type Props = {
  eventId: string
  scorecardId: string
  players: Player[]
  holes: ScoringHole[]
  eventFormat: 'stroke' | 'stableford'
}

// ===================== COMPONENT =====================

export default function Leaderboard({
  eventId,
  scorecardId,
  players,
  holes,
  eventFormat,
}: Props) {
  const supabase = createClient()
  const isStableford = eventFormat === 'stableford'

  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // ===================== LOAD =====================

  useEffect(() => {
    if (players.length > 0 && holes.length > 0) loadScores()
  }, [scorecardId, players, holes])

  async function loadScores() {
    setLoading(true)
    const { data: scoresData } = await supabase
      .from('scores')
      .select('player_id, hole, strokes')
      .eq('scorecard_id', scorecardId)
      .eq('event_id', eventId)
      .in('player_id', players.map(p => p.id))

    const scores: ScoringScore[] = (scoresData || []).map(s => ({
      player_id: s.player_id,
      hole: s.hole,
      strokes: s.strokes,
    }))

    const built: LeaderboardEntry[] = players.map(player => {
      const phcp = player.phcp ?? 0
      const brut = getBrutTotal(player.id, scores, holes)
      const net  = getNetTotal(player.id, phcp, scores, holes)
      const pts  = getStablefordTotal(player.id, phcp, scores, holes)
      const holesPlayed = scores.filter(s => s.player_id === player.id).length
      const score = isStableford ? pts : net

      return { player, holesPlayed, brut, net, pts, score }
    })

    // Sort: stableford → highest pts first / stroke → lowest net first
    built.sort((a, b) => isStableford ? b.score - a.score : a.score - b.score)

    setEntries(built)
    setLoading(false)
  }

  // ===================== SAVE TO LEADERBOARD TABLE =====================

  async function handleSaveLeaderboard() {
    setSaving(true)
    setSaveMsg('')
    try {
      const rows = entries.map(e => ({
        player_id: e.player.id,
        total: e.score,
      }))
      await supabase
        .from('leaderboard')
        .upsert(rows, { onConflict: 'player_id' })
      setSaveMsg('✓ Leaderboard saved')
    } catch {
      setSaveMsg('Error saving')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }

  // ===================== RENDER =====================

  if (loading) return (
    <div className="text-sm text-gray-400 py-4">Loading leaderboard…</div>
  )

  if (entries.length === 0) return (
    <div className="text-sm text-gray-400 py-4">No scores yet.</div>
  )

  return (
    <div className="mt-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800">Leaderboard</h3>
        <div className="flex items-center gap-2">
          {saveMsg && <span className="text-xs text-green-600">{saveMsg}</span>}
          <button
            onClick={handleSaveLeaderboard}
            disabled={saving}
            className="text-xs bg-black text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save leaderboard'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500">
              <th className="px-3 py-2 text-center w-8">#</th>
              <th className="px-3 py-2 text-left">Player</th>
              <th className="px-3 py-2 text-center">Phcp</th>
              <th className="px-3 py-2 text-center">Holes</th>
              <th className="px-3 py-2 text-center">Brut</th>
              {isStableford
                ? <th className="px-3 py-2 text-center font-semibold text-gray-700">Pts</th>
                : <th className="px-3 py-2 text-center font-semibold text-gray-700">Net</th>
              }
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr
                key={e.player.id}
                className={`border-t ${i === 0 ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}
              >
                <td className="px-3 py-2.5 text-center font-bold text-gray-500">
                  {i === 0 ? '🏆' : i + 1}
                </td>
                <td className="px-3 py-2.5 font-medium text-gray-800">
                  {e.player.first_name} {e.player.surname}
                </td>
                <td className="px-3 py-2.5 text-center text-gray-500">{e.player.phcp}</td>
                <td className="px-3 py-2.5 text-center text-gray-500">{e.holesPlayed}</td>
                <td className="px-3 py-2.5 text-center text-gray-500">{e.brut || '—'}</td>
                <td className="px-3 py-2.5 text-center font-bold text-gray-800">
                  {e.score || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

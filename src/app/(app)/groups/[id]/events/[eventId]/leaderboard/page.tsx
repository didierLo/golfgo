'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Leaderboard from '@/components/scorecards/Leaderboard'
import type { Hole, Player, TeeInfo } from '@/app/(app)/groups/[id]/events/[eventId]/scorecards/page1'
import { computePhcp } from '@/lib/golf/scoring/stableford'

const supabase = createClient()

export default function LeaderboardPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [clubName, setClubName] = useState('')
  const [courseName, setCourseName] = useState('')
  const [eventTitle, setEventTitle] = useState('')
  const [holes, setHoles] = useState<Hole[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [scorecardId, setScorecardId] = useState<string | null>(null)
  const [eventFormat, setEventFormat] = useState<'stroke' | 'stableford'>('stableford')

  useEffect(() => { loadAll() }, [eventId])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const { data: event, error: evErr } = await supabase
        .from('events')
        .select('title, course_id, competition_format:competition_format_id(scoring_type)')
        .eq('id', eventId)
        .single()
      if (evErr) throw new Error('Event not found')

      setEventTitle(event.title ?? '')
      setEventFormat((event.competition_format as any)?.scoring_type ?? 'stableford')
      const courseId = event.course_id
      if (!courseId) throw new Error('Aucun parcours lié à cet événement.')

      const { data: course } = await supabase
        .from('courses')
        .select('course_name, clubs(name)')
        .eq('id', courseId)
        .single()
      setCourseName(course?.course_name ?? '')
      setClubName((course?.clubs as any)?.name ?? '')

      const { data: holesData } = await supabase
        .from('course_holes')
        .select('hole_number, par, stroke_index')
        .eq('course_id', courseId)
        .order('hole_number')
      setHoles(holesData || [])

      const { data: teesData } = await supabase
        .from('course_tees')
        .select('id, tee_name, par_total, course_rating, slope')
        .eq('course_id', courseId)

      const { data: scorecard } = await supabase
        .from('scorecards')
        .select('id')
        .eq('event_id', eventId)
        .maybeSingle()
      setScorecardId(scorecard?.id ?? null)

      const { data: participants } = await supabase
        .from('event_participants')
        .select('player_id, tee_id, players(id, first_name, surname, whs)')
        .eq('event_id', eventId)
        .order('created_at')

      const built: Player[] = (participants || []).map((ep: any) => {
        const p = ep.players
        const teeId = ep.tee_id ?? null
        const tee = (teesData || []).find((t: TeeInfo) => t.id === teeId)
        return {
          id: p.id,
          first_name: p.first_name,
          surname: p.surname,
          whs: p.whs ?? 0,
          tee_id: teeId,
          tee,
          phcp: tee
            ? computePhcp(p.whs ?? 0, tee.slope, tee.course_rating, tee.par_total)
            : Math.round(p.whs ?? 0),
        }
      })
      setPlayers(built)

    } catch (e: any) {
      setError(e.message ?? 'Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="p-6 space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
      ))}
    </div>
  )

  if (error) return (
    <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-600">
      {error}
    </div>
  )

  return (
    <div className="p-6 max-w-2xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6 pb-4 border-b border-gray-200">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-medium text-gray-900">{clubName}</h2>
            <p className="text-[13px] text-gray-400">{courseName}</p>
          </div>
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-[#E6F1FB] text-[#0C447C]">
            {eventFormat === 'stableford' ? 'Stableford' : 'Stroke play'}
          </span>
        </div>
        {eventTitle && (
          <p className="text-[13px] text-gray-500 mt-2">{eventTitle}</p>
        )}
      </div>

      {/* ── Leaderboard ────────────────────────────────────────────────────── */}
      {scorecardId ? (
        <Leaderboard
          eventId={eventId}
          scorecardId={scorecardId}
          players={players}
          holes={holes}
          eventFormat={eventFormat}
        />
      ) : (
        <div className="text-center py-12 text-[13px] text-gray-400 border border-dashed border-gray-200 rounded-lg">
          Aucune scorecard trouvée pour cet événement
        </div>
      )}

    </div>
  )
}

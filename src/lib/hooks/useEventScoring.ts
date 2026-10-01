'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type TeamFormat } from '@/lib/golf/scorecards/composeCards'
import { resolveHcpRule, DEFAULT_HCP_RULE, type HcpRule } from '@/lib/golf/scoring/handicapAllowance'

const supabase = createClient()

export function useEventScoring(eventId: string | null) {
  const [loading, setLoading]               = useState(true)
  const [eventTitle, setEventTitle]         = useState('')
  const [eventStartsAt, setEventStartsAt]   = useState('')
  const [courseId, setCourseId]             = useState<string | null>(null)
  const [groupId, setGroupId]               = useState<string | null>(null)
  const [clubName, setClubName]             = useState('')
  const [courseName, setCourseName]         = useState('')
  const [eventFormat, setEventFormat]       = useState<'stroke' | 'stableford'>('stableford')
  const [teamFormat, setTeamFormat]         = useState<TeamFormat>('individual')
  const [hcpRule, setHcpRule]               = useState<HcpRule>(DEFAULT_HCP_RULE)
  const [formatName, setFormatName]         = useState('')
  const [scorecardNotes, setScorecardNotes] = useState('')

  const load = useCallback(async () => {
    if (!eventId) { setLoading(false); return }
    setLoading(true)
    const { data: event } = await supabase.from('events')
      .select(`
        title, starts_at, course_id, group_id, scorecard_notes, hcp_percentage_override,
        competition_formats(name, scoring_type, team_format, hcp_percentage, hcp_allowances, match_play),
        courses(course_name, clubs(name))
      `)
      .eq('id', eventId).single()

    if (event) {
      const fmt = event.competition_formats as any
      setEventTitle(event.title ?? '')
      setEventStartsAt(event.starts_at ?? '')
      setCourseId(event.course_id ?? null)
      setGroupId(event.group_id ?? null)
      setScorecardNotes(event.scorecard_notes ?? '')
      setEventFormat(fmt?.scoring_type ?? 'stableford')
      setTeamFormat(fmt?.team_format ?? 'individual')
      setHcpRule(resolveHcpRule(fmt, event.hcp_percentage_override))
      setFormatName(fmt?.name ?? '')
      setClubName((event.courses as any)?.clubs?.name ?? '')
      setCourseName((event.courses as any)?.course_name ?? '')
    }
    setLoading(false)
  }, [eventId])

  useEffect(() => { load() }, [load])

  // Corrige le bug "formule pas à jour" : re-fetch quand l'onglet redevient visible/actif,
  // au cas où la formule a été changée depuis l'édition de l'événement pendant que
  // cette page était restée ouverte en arrière-plan.
  useEffect(() => {
    function onVisible() { if (document.visibilityState === 'visible') load() }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [load])

  return {
    loading, eventTitle, eventStartsAt, courseId, groupId, clubName, courseName,
    eventFormat, teamFormat, hcpRule, formatName, scorecardNotes,
    refresh: load,
  }
}
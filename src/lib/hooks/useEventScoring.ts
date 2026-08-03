'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getTeamGroups, teamPhcp, playingHcp, type TeamFormat } from '@/lib/golf/scorecards/composeCards'
import type { Player } from '@/components/scorecards/scorecard-types'

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
  const [hcpPercentage, setHcpPercentage]   = useState<number>(100)
  const [formatName, setFormatName]         = useState('')
  const [scorecardNotes, setScorecardNotes] = useState('')

  const load = useCallback(async () => {
    if (!eventId) { setLoading(false); return }
    setLoading(true)
    const { data: event } = await supabase.from('events')
      .select(`
        title, starts_at, course_id, group_id, scorecard_notes, hcp_percentage_override,
        competition_formats(name, scoring_type, team_format, hcp_percentage),
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
      setHcpPercentage(event.hcp_percentage_override ?? fmt?.hcp_percentage ?? 100)
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

  // Construit le tableau `players[]` à passer à ScorecardTable pour un joueur donné,
  // en tenant compte de la formule ET du % HCP variable (event override > format > 100).
  //   - individuel : [lui-même], hcp ajusté au %
  //   - 4bbb       : [lui, son partenaire], hcp de CHACUN ajusté au % (chacun sa balle)
  //   - team2/team3_4 : [carte virtuelle unique], hcp = somme équipe ajustée au %
  function getPlayersForCard(orderedFlightPlayers: Player[], targetPlayerId: string): Player[] {
    if (teamFormat === '4bbb') {
      const groups = getTeamGroups(orderedFlightPlayers, '4bbb')
      const group = groups.find(g => g.some(p => p.id === targetPlayerId))
        ?? orderedFlightPlayers.filter(p => p.id === targetPlayerId)
      return group.map(p => ({ ...p, phcp: playingHcp(p.phcp, hcpPercentage) }))
    }
    if (teamFormat === 'team2' || teamFormat === 'team3_4') {
      const groups = getTeamGroups(orderedFlightPlayers, teamFormat)
      const group = groups.find(g => g.some(p => p.id === targetPlayerId))
      if (!group) {
        const solo = orderedFlightPlayers.find(p => p.id === targetPlayerId)
        return solo ? [{ ...solo, phcp: playingHcp(solo.phcp, hcpPercentage) }] : []
      }
      const anchor = group[0]
      return [{ ...anchor, phcp: teamPhcp(group, hcpPercentage) }]
    }
    const player = orderedFlightPlayers.find(p => p.id === targetPlayerId)
    return player ? [{ ...player, phcp: playingHcp(player.phcp, hcpPercentage) }] : []
  }

  return {
    loading, eventTitle, eventStartsAt, courseId, groupId, clubName, courseName,
    eventFormat, teamFormat, hcpPercentage, formatName, scorecardNotes,
    getPlayersForCard, refresh: load,
  }
}
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ScorecardTable from '@/components/scorecards/ScorecardTable'
import { useGroupRole } from '@/lib/hooks/useGroupRole'
import { useWhatsAppLink } from '@/lib/hooks/useWhatsAppLink'
import type { Hole, TeeInfo, Player, ScoreMap } from '@/components/scorecards/scorecard-types'
import { computePhcp } from '@/components/scorecards/scorecard-types'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'

const supabase = createClient()

export type { Hole, TeeInfo, Player, ScoreMap }
export { computePhcp }

type EventItem = {
  id: string
  title: string
  starts_at: string
  isPast: boolean
}

function fallbackHoles(): Hole[] {
  return Array.from({ length: 18 }, (_, i) => ({
    hole_number: i + 1, par: [4, 4, 3, 5, 4, 4, 3, 4, 5][i % 9], stroke_index: i + 1,
  }))
}

function formatShortDate(d: string, locale: string) {
  return new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

function twoMonthsAgo(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 2)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function getTeeColor(teeName: string): { bg: string; text: string } {
  const n = teeName.toLowerCase()
  if (n.includes('yellow')) return { bg: '#FEF3C7', text: '#92400E' }
  if (n.includes('red'))    return { bg: '#FEE2E2', text: '#991B1B' }
  if (n.includes('white'))  return { bg: '#F3F4F6', text: '#374151' }
  if (n.includes('blue'))   return { bg: '#DBEAFE', text: '#1E40AF' }
  if (n.includes('black'))  return { bg: '#1F2937', text: '#F9FAFB' }
  if (n.includes('gold'))   return { bg: '#FDE68A', text: '#78350F' }
  return { bg: '#F3F4F6', text: '#374151' }
}

function findDefaultTee(teesData: TeeInfo[], color: string, gender?: string): TeeInfo | undefined {
  const c = color.toLowerCase()
  const genderWord = gender === 'F' ? 'lad' : 'men'
  return (
    teesData.find(t => t.tee_name.toLowerCase().includes(c) && t.tee_name.toLowerCase().includes(genderWord)) ??
    teesData.find(t => t.tee_name.toLowerCase() === c) ??
    teesData.find(t => t.tee_name.toLowerCase().startsWith(c)) ??
    teesData.find(t => t.tee_name.toLowerCase().includes(c))
  )
}

function EventPill({ event, isSelected, onSelect, locale }: {
  event: EventItem; isSelected: boolean; onSelect: () => void; locale: string
}) {
  return (
    <button onClick={onSelect}
      className={`flex flex-col items-start px-3 py-1.5 rounded-xl border text-left transition-all ${
        isSelected
          ? 'bg-[#185FA5] text-white border-[#185FA5] shadow-sm'
          : event.isPast
            ? 'bg-white/70 text-slate-500 border-slate-200 hover:border-slate-300'
            : 'bg-white text-slate-700 border-slate-200 hover:border-[#185FA5]'
      }`}>
      <span className={`text-[12px] font-bold leading-tight ${isSelected ? 'text-white' : ''}`}>
        {event.title}
      </span>
      <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-blue-200' : 'text-slate-400'}`}>
        {formatShortDate(event.starts_at, locale)}
      </span>
    </button>
  )
}

const WhatsAppIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

const selectClass = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] bg-white"

export default function ScorecardsPage() {
  const params  = useParams()
  const groupId = params.id as string
  const urlEventId                              = params.eventId as string
  const [activeEventId, setActiveEventId]       = useState<string>(urlEventId)
  const t                                       = useTranslations()
  const locale                                  = useLocale()

  const { role, loading: roleLoading }          = useGroupRole(groupId)
  const isOwner                                 = role === 'owner'

  const { whatsappLink, loading: waLoading }    = useWhatsAppLink(activeEventId || null, groupId)

  const [allEvents, setAllEvents]               = useState<EventItem[]>([])
  const [eventsLoading, setEventsLoading]       = useState(true)

  const [clubs, setClubs]                       = useState<{ id: string; name: string }[]>([])
  const [selectedClubId, setSelectedClubId]     = useState('')
  const [courses, setCourses]                   = useState<{ id: string; course_name: string }[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [newClubName, setNewClubName]           = useState('')
  const [showNewClub, setShowNewClub]           = useState(false)
  const [newCourseName, setNewCourseName]       = useState('')
  const [showNewCourse, setShowNewCourse]       = useState(false)
  const [creating, setCreating]                 = useState(false)

  const [loading, setLoading]                   = useState(true)
  const [scorecardLoading, setScorecardLoading] = useState(false)
  const [error, setError]                       = useState<string | null>(null)
  const [saving, setSaving]                     = useState(false)
  const [saveMsg, setSaveMsg]                   = useState('')
  const [validating, setValidating]             = useState(false)

  const [holes, setHoles]                       = useState<Hole[]>([])
  const [tees, setTees]                         = useState<TeeInfo[]>([])
  const [players, setPlayers]                   = useState<Player[]>([])
  const [scores, setScores]                     = useState<ScoreMap>({})
  const [scorecardId, setScorecardId]           = useState<string | null>(null)
  const [eventFormat, setEventFormat]           = useState<'stroke' | 'stableford'>('stableford')
  const [activePlayerId, setActivePlayerId]     = useState<string | null>(null)
  const [validatedAt, setValidatedAt]           = useState<string | null>(null)
  const [playersWithPush, setPlayersWithPush]   = useState<Set<string>>(new Set())

  const isValidated = !!validatedAt

  useEffect(() => { loadGroupEvents() }, [groupId])

  async function loadGroupEvents() {
    setEventsLoading(true)
    const { data } = await supabase.from('events')
      .select('id, title, starts_at, group_id')
      .eq('group_id', groupId)
      .gte('starts_at', twoMonthsAgo())
      .order('starts_at', { ascending: false })

    if (data?.length) {
      const now = new Date()
      setAllEvents(data.map(e => ({
        id: e.id, title: e.title, starts_at: e.starts_at,
        isPast: new Date(e.starts_at) < now,
      })))
    }
    setEventsLoading(false)
  }

  useEffect(() => { loadInit() }, [activeEventId])

  useEffect(() => {
    if (selectedClubId) loadCourses(selectedClubId)
    else { setCourses([]); setSelectedCourseId('') }
  }, [selectedClubId])

  useEffect(() => {
    if (selectedCourseId) loadScorecard(selectedCourseId)
  }, [selectedCourseId])

  async function loadInit() {
    setLoading(true)
    setValidatedAt(null)
    setPlayers([])
    setScores({})
    setScorecardId(null)

    const { data: clubsData } = await supabase.from('clubs').select('id, name').order('name')
    setClubs(clubsData || [])

    const { data: event } = await supabase
      .from('events')
      .select('course_id, competition_format:competition_format_id(scoring_type)')
      .eq('id', activeEventId).single()

    if (event) {
      setEventFormat((event.competition_format as any)?.scoring_type ?? 'stableford')
      if (event.course_id) {
        const { data: course } = await supabase
          .from('courses').select('id, course_name, club_id').eq('id', event.course_id).single()
        if (course) {
          setSelectedClubId(course.club_id)
          setSelectedCourseId(event.course_id)
          const { data: coursesData } = await supabase
            .from('courses').select('id, course_name').eq('club_id', course.club_id).order('course_name')
          setCourses(coursesData || [])
        }
      } else {
        setSelectedClubId('')
        setSelectedCourseId('')
      }
    }
    setLoading(false)
  }

  async function loadCourses(clubId: string) {
    const { data } = await supabase.from('courses').select('id, course_name').eq('club_id', clubId).order('course_name')
    setCourses(data || [])
  }

  async function loadScorecard(courseId: string) {
    setScorecardLoading(true); setError(null)
    try {
      if (isOwner) await supabase.from('events').update({ course_id: courseId }).eq('id', activeEventId)

      const { data: holesData } = await supabase.from('course_holes')
        .select('hole_number, par, stroke_index').eq('course_id', courseId).order('hole_number')
      setHoles(holesData?.length ? holesData : fallbackHoles())

      const { data: teesData } = await supabase.from('course_tees')
        .select('id, tee_name, par_total, course_rating, slope').eq('course_id', courseId).order('tee_name')
      setTees(teesData || [])

      let scId: string | null = null
      const { data: existing } = await supabase.from('scorecards')
        .select('id, validated_at').eq('event_id', activeEventId).maybeSingle()
      if (existing) {
        scId = existing.id
        setValidatedAt(existing.validated_at ?? null)
      } else if (isOwner) {
        const { data: created } = await supabase.from('scorecards')
          .insert({ event_id: activeEventId }).select('id').single()
        scId = created?.id ?? null
        setValidatedAt(null)
      }
      setScorecardId(scId)

      const { data: participants } = await supabase
        .from('event_participants')
        .select('player_id, tee_id, players(id, first_name, surname, whs, default_tee_color, gender)')
        .eq('event_id', activeEventId).order('created_at')

      const teeUpdates: { player_id: string; tee_id: string }[] = []
      const built: Player[] = (participants || []).map((ep: any) => {
        const p = ep.players
        let teeId = ep.tee_id ?? null
        let tee: TeeInfo | undefined = (teesData || []).find(t => t.id === teeId)
        if (!teeId && p.default_tee_color) {
          const defaultTee = findDefaultTee(teesData || [], p.default_tee_color, p.gender)
          if (defaultTee) {
            teeId = defaultTee.id; tee = defaultTee
            teeUpdates.push({ player_id: p.id, tee_id: defaultTee.id })
          }
        }
        return {
          id: p.id, first_name: p.first_name, surname: p.surname,
          whs: p.whs ?? 0, tee_id: teeId, tee,
          phcp: computePhcp(p.whs ?? 0, tee),
        }
      })
      setPlayers(built)
      if (built.length > 0) setActivePlayerId(built[0].id)

      if (isOwner) {
        for (const u of teeUpdates) {
          await supabase.from('event_participants')
            .update({ tee_id: u.tee_id }).eq('event_id', activeEventId).eq('player_id', u.player_id)
        }
      }

      if (scId && built.length > 0) {
        if (isOwner) {
          const { count } = await supabase.from('scorecard_players')
            .select('*', { count: 'exact', head: true }).eq('scorecard_id', scId)
          if (count === 0)
            await supabase.from('scorecard_players').insert(
              built.map((p, i) => ({ scorecard_id: scId, player_id: p.id, position: i + 1 }))
            )
        }

        const playerIds = built.map(p => p.id)
        const { data: savedData } = await supabase.from('saved_scorecards')
          .select('player_id, hole, strokes')
          .eq('scorecard_id', scId).eq('event_id', activeEventId)
          .in('player_id', playerIds)

        const { data: scoresData } = await supabase.from('scores')
          .select('player_id, hole, strokes')
          .eq('scorecard_id', scId).eq('event_id', activeEventId)
          .in('player_id', playerIds)

        const map: ScoreMap = {}
        built.forEach(p => { map[p.id] = {} })
        scoresData?.forEach(s => { map[s.player_id][s.hole] = s.strokes })
        savedData?.forEach(s => { map[s.player_id][s.hole] = s.strokes })
        setScores(map)
        setPlayersWithPush(new Set(savedData?.map(s => s.player_id) ?? []))
      }
    } catch (e: any) {
      setError(e.message ?? t('common.error'))
    } finally {
      setScorecardLoading(false)
    }
  }

  async function handleTeeChange(playerId: string, teeId: string) {
    if (!isOwner) return
    await supabase.from('event_participants')
      .update({ tee_id: teeId }).eq('event_id', activeEventId).eq('player_id', playerId)
    const tee = tees.find(t => t.id === teeId)
    const player = players.find(p => p.id === playerId)
    setPlayers(prev => prev.map(p =>
      p.id === playerId ? { ...p, tee_id: teeId, tee, phcp: computePhcp(player?.whs ?? 0, tee) } : p
    ))
  }

  async function handleRemovePlayer(playerId: string) {
    if (!isOwner || !scorecardId) return
    await supabase.from('scorecard_players').delete()
      .eq('scorecard_id', scorecardId).eq('player_id', playerId)
    const remaining = players.filter(p => p.id !== playerId)
    setPlayers(remaining)
    if (activePlayerId === playerId) setActivePlayerId(remaining[0]?.id ?? null)
  }

  async function handleSave() {
    if (!isOwner || !scorecardId) return
    setSaving(true)
    try {
      const rows = players.flatMap(player =>
        Object.entries(scores[player.id] ?? {}).filter(([, s]) => s != null).map(([hole, strokes]) => ({
          scorecard_id: scorecardId, event_id: activeEventId,
          player_id: player.id, hole: Number(hole), strokes: strokes as number,
        }))
      )
      if (rows.length > 0)
        await supabase.from('scores').upsert(rows, { onConflict: 'scorecard_id,player_id,hole' })
      setSaveMsg(t('scorecards.saved'))
    } catch { setSaveMsg(t('scorecards.error')) }
    finally { setSaving(false); setTimeout(() => setSaveMsg(''), 3000) }
  }

  async function handleValidate() {
    if (!isOwner || !scorecardId || isValidated) return
    const confirmed = window.confirm(t('scorecards.validateConfirm'))
    if (!confirmed) return
    setValidating(true)
    try {
      await handleSave()
      const now = new Date().toISOString()
      await supabase.from('scorecards').update({ validated_at: now }).eq('id', scorecardId)
      setValidatedAt(now)
      setSaveMsg(t('scorecards.validated') + ' ✓')
    } catch { setSaveMsg(t('scorecards.error')) }
    finally { setValidating(false); setTimeout(() => setSaveMsg(''), 4000) }
  }

  function buildWhatsAppLeaderboard(): string {
    // Si un lien WhatsApp est configuré, on ouvre directement le groupe
    if (whatsappLink) return whatsappLink
    // Sinon, message pré-rempli avec le leaderboard
    const eventTitle = allEvents.find(e => e.id === activeEventId)?.title ?? 'Leaderboard'
    const lines = [`🏆 *${eventTitle}*`, '']
    players.forEach((p, i) => {
      const total = Object.values(scores[p.id] ?? {}).reduce((sum, s) => (sum ?? 0) + (s ?? 0), 0) ?? 0
      lines.push(`${i + 1}. ${p.first_name} ${p.surname} — ${total} (Phcp ${p.phcp})`)
    })
    return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`
  }

  async function handleCreateClub() {
    if (!newClubName.trim() || !isOwner) return
    setCreating(true)
    const { data, error } = await supabase.from('clubs').insert({ name: newClubName.trim() }).select('id, name').single()
    if (error) { alert(error.message); setCreating(false); return }
    setClubs(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setSelectedClubId(data.id)
    setNewClubName(''); setShowNewClub(false); setCreating(false)
  }

  async function handleCreateCourse() {
    if (!newCourseName.trim() || !selectedClubId || !isOwner) return
    setCreating(true)
    const { data, error } = await supabase.from('courses')
      .insert({ club_id: selectedClubId, course_name: newCourseName.trim() })
      .select('id, course_name').single()
    if (error) { alert(error.message); setCreating(false); return }
    setCourses(prev => [...prev, data].sort((a, b) => a.course_name.localeCompare(b.course_name)))
    setSelectedCourseId(data.id)
    setNewCourseName(''); setShowNewCourse(false); setCreating(false)
  }

  if (loading || roleLoading) return (
    <div className="p-6 space-y-3 max-w-2xl">
      {[1,2].map(i => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  )

  const activePlayer   = players.find(p => p.id === activePlayerId) ?? null
  const upcomingEvents = allEvents.filter(e => !e.isPast)
  const pastEvents     = allEvents.filter(e => e.isPast)

  return (
    <div className="p-5 sm:p-6 max-w-2xl">

      {!eventsLoading && allEvents.length > 1 && (
        <div className="mb-6 rounded-xl border border-white/60 shadow-sm p-4"
          style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">{t('scorecards.events')}</p>

          {upcomingEvents.length > 0 && (
            <div className={pastEvents.length > 0 ? 'mb-3' : ''}>
              <p className="text-[10px] text-slate-400 font-semibold mb-2 uppercase tracking-wide">{t('scorecards.upcoming')}</p>
              <div className="flex gap-2 flex-wrap">
                {upcomingEvents.map(e => (
                  <EventPill key={e.id} event={e} locale={locale}
                    isSelected={activeEventId === e.id}
                    onSelect={() => setActiveEventId(e.id)} />
                ))}
              </div>
            </div>
          )}

          {pastEvents.length > 0 && (
            <div className={upcomingEvents.length > 0 ? 'pt-3 border-t border-slate-100' : ''}>
              <p className="text-[10px] text-slate-400 font-semibold mb-2 uppercase tracking-wide">
                {upcomingEvents.length > 0 ? t('scorecards.last2months') : t('scorecards.recent')}
              </p>
              <div className="flex gap-2 flex-wrap">
                {pastEvents.map(e => (
                  <EventPill key={e.id} event={e} locale={locale}
                    isSelected={activeEventId === e.id}
                    onSelect={() => setActiveEventId(e.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isValidated && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
          <span className="text-[16px]">🏆</span>
          <div>
            <p className="text-[12px] font-bold text-amber-800">{t('scorecards.validated')}</p>
            <p className="text-[11px] text-amber-600">
              {t('scorecards.validatedOn', { date: new Date(validatedAt!).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}
            </p>
          </div>
        </div>
      )}

      {!isOwner && !isValidated && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-blue-200/60 text-[12px] text-blue-700 font-medium"
          style={{ background: "rgba(219,234,254,0.6)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
          {t('scorecards.readOnly')}
        </div>
      )}

      {/* ── Bandeau WhatsApp non configuré (admin uniquement) ── */}
      {isOwner && !waLoading && !whatsappLink && activeEventId && (
        <div className="flex items-center justify-between gap-3 mb-4 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <p className="text-[12px] text-amber-800 font-medium">
              {t('whatsapp.noGroupConfigured')}
            </p>
          </div>
          <Link href={`/groups/${groupId}/edit`}
            className="text-[11px] font-bold text-amber-700 hover:underline whitespace-nowrap">
            {t('whatsapp.configureNow')}
          </Link>
        </div>
      )}

      <div className="rounded-xl border border-white/60 shadow-sm p-5 mb-6"
        style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">{t('scorecards.clubCourse')}</p>

        <div className="mb-4">
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('scorecards.club')}</label>
          <div className="flex gap-2">
            <select value={selectedClubId}
              onChange={e => { setSelectedClubId(e.target.value); setSelectedCourseId('') }}
              className={selectClass} disabled={!isOwner || isValidated}>
              <option value="">{t('scorecards.chooseClub')}</option>
              {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {isOwner && !isValidated && (
              <button type="button" onClick={() => setShowNewClub(v => !v)}
                className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 whitespace-nowrap transition-colors">
                {showNewClub ? t('scorecards.cancel') : t('scorecards.newClub')}
              </button>
            )}
          </div>
          {isOwner && !isValidated && showNewClub && (
            <div className="flex gap-2 mt-2">
              <input value={newClubName} onChange={e => setNewClubName(e.target.value)}
                placeholder={t('scorecards.clubName')} className={selectClass}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateClub())} />
              <button type="button" onClick={handleCreateClub} disabled={creating || !newClubName.trim()}
                className="bg-[#185FA5] text-white text-[12px] font-semibold px-4 py-2 rounded-xl disabled:opacity-50 whitespace-nowrap hover:bg-[#0C447C] transition-colors">
                {creating ? t('scorecards.creating') : t('scorecards.create')}
              </button>
            </div>
          )}
        </div>

        {selectedClubId && (
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('scorecards.course')}</label>
            <div className="flex gap-2">
              <select value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)}
                className={selectClass} disabled={!isOwner || isValidated}>
                <option value="">{t('scorecards.chooseCourse')}</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.course_name}</option>)}
              </select>
              {isOwner && !isValidated && (
                <button type="button" onClick={() => setShowNewCourse(v => !v)}
                  className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 whitespace-nowrap transition-colors">
                  {showNewCourse ? t('scorecards.cancel') : t('scorecards.newCourse')}
                </button>
              )}
            </div>
            {isOwner && !isValidated && showNewCourse && (
              <div className="flex gap-2 mt-2">
                <input value={newCourseName} onChange={e => setNewCourseName(e.target.value)}
                  placeholder={t('scorecards.courseName')} className={selectClass}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateCourse())} />
                <button type="button" onClick={handleCreateCourse} disabled={creating || !newCourseName.trim()}
                  className="bg-[#185FA5] text-white text-[12px] font-semibold px-4 py-2 rounded-xl disabled:opacity-50 whitespace-nowrap hover:bg-[#0C447C] transition-colors">
                  {creating ? t('scorecards.creating') : t('scorecards.create')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-600 font-medium">{error}</div>}
      {scorecardLoading && (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      )}

      {!scorecardLoading && selectedCourseId && (
        <>
          <div className="flex gap-2 items-center mb-5 flex-wrap">
            {players.map(p => {
              const initials = `${p.first_name?.[0] ?? ''}${p.surname?.[0] ?? ''}`.toUpperCase()
              const isActive = p.id === activePlayerId
              const hasPush  = playersWithPush.has(p.id)
              return (
                <div key={p.id} className="relative">
                  <button onClick={() => setActivePlayerId(p.id)}
                    title={`${p.first_name} ${p.surname}`}
                    className={`w-11 h-11 rounded-full text-[12px] font-bold border-2 transition-all flex-shrink-0 ${
                      isActive
                        ? 'bg-[#185FA5] text-white border-[#185FA5] shadow-sm'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-[#185FA5]'
                    }`}>
                    {initials}
                  </button>
                  {hasPush && (
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#3B6D11] rounded-full border-2 border-white"
                      title={t('scorecards.pushScores')} />
                  )}
                </div>
              )
            })}
          </div>

          {activePlayer && (
            <div className="rounded-xl border border-white/60 shadow-sm p-4 mb-5"
              style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>

              {playersWithPush.has(activePlayer.id) && (
                <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-lg bg-[#3B6D11]/10 border border-[#3B6D11]/20 w-fit">
                  <span className="w-2 h-2 rounded-full bg-[#3B6D11]" />
                  <span className="text-[11px] font-semibold text-[#3B6D11]">{t('scorecards.pushScores')}</span>
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-black text-slate-900 truncate">
                    {activePlayer.first_name} {activePlayer.surname}
                  </p>
                  <div className="flex gap-3 mt-0.5">
                    <span className="text-[12px] text-slate-500">
                      Hcp <span className="font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded-lg text-[11px] ml-0.5">{activePlayer.whs}</span>
                    </span>
                    <span className="text-[12px] text-slate-500">
                      Phcp <span className="font-bold text-slate-800 ml-0.5">{activePlayer.phcp}</span>
                    </span>
                    {activePlayer.tee && (
                      <span className="text-[12px] text-slate-500">
                        Tee <span className="font-bold text-slate-800 ml-0.5">{activePlayer.tee.tee_name}</span>
                      </span>
                    )}
                  </div>
                </div>
                {isOwner && !isValidated && (
                  <button onClick={() => handleRemovePlayer(activePlayer.id)}
                    className="w-8 h-8 border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 transition-colors text-lg">
                    −
                  </button>
                )}
              </div>

              {isOwner && !isValidated && tees.length > 0 && (
                <div className="flex gap-1.5 flex-wrap pt-3 border-t border-slate-100">
                  {tees.map(tee => {
                    const teeColor  = getTeeColor(tee.tee_name)
                    const isSelected = activePlayer.tee_id === tee.id
                    return (
                      <button key={tee.id} onClick={() => handleTeeChange(activePlayer.id, tee.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border-2 transition-all ${
                          isSelected ? 'border-slate-500 shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                        style={{ background: teeColor.bg, color: teeColor.text }}>
                        {tee.tee_name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Barre d'actions ── */}
          {isOwner && (
            <div className="flex items-center justify-between gap-3 mb-4 print:hidden">
              <div className="flex items-center gap-2">
                {saveMsg && (
                  <span className={`text-[12px] font-semibold ${
                    saveMsg.includes(t('scorecards.error')) ? 'text-red-500' : 'text-[#3B6D11]'
                  }`}>
                    {saveMsg}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {players.length > 0 && (
                  <a
                    href={buildWhatsAppLeaderboard()}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={whatsappLink ? t('whatsapp.openGroup') : t('whatsapp.sendMessage')}
                    className="flex items-center gap-1.5 text-[12px] font-semibold px-4 py-2.5 rounded-xl border border-[#25D366] text-[#25D366] hover:bg-green-50 transition-colors">
                    <WhatsAppIcon />
                    WhatsApp
                  </a>
                )}
                {!isValidated && (
                  <>
                    <button onClick={handleSave} disabled={saving}
                      className="bg-white border border-slate-200 text-slate-700 text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors">
                      {saving ? t('scorecards.saving') : t('scorecards.save')}
                    </button>
                    <button onClick={handleValidate} disabled={validating || saving}
                      className="bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-50 transition-colors flex items-center gap-1.5">
                      <span>🏆</span>
                      {validating ? t('scorecards.validating') : t('scorecards.validate')}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {activePlayer ? (
            <div className="rounded-xl border border-white/60 shadow-sm overflow-hidden"
              style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
              <ScorecardTable
                holes={holes}
                player={activePlayer}
                scores={scores}
                setScores={isOwner && !isValidated ? setScores : () => {}}
                eventFormat={eventFormat}
                readOnly={!isOwner || isValidated}
              />
            </div>
          ) : (
            <div className="text-center py-12 text-[13px] text-slate-500 border border-dashed border-slate-200 rounded-xl">
              {t('scorecards.noParticipants')}
            </div>
          )}
        </>
      )}

      {!scorecardLoading && !selectedCourseId && (
        <div className="text-center py-12 text-[13px] text-slate-500 border border-dashed border-slate-200 rounded-xl">
          {isOwner ? t('scorecards.noCourse') : t('scorecards.noCourseReadOnly')}
        </div>
      )}
    </div>
  )
}

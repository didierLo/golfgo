'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ScorecardTable from '@/components/scorecards/ScorecardTable'
import { useGroupRole } from '@/lib/hooks/useGroupRole'
import type { Hole, TeeInfo, Player, ScoreMap } from '@/components/scorecards/scorecard-types'
import { computePhcp } from '@/components/scorecards/scorecard-types'

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

function formatShortDate(d: string) {
  return new Date(d).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })
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

const selectClass = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] bg-white"

export default function ScorecardsPage() {
  const params  = useParams()
  const groupId = params.id as string

  // eventId comes from URL but can be overridden by the pill
  const urlEventId                              = params.eventId as string
  const [activeEventId, setActiveEventId]       = useState<string>(urlEventId)

  const { role, loading: roleLoading }          = useGroupRole(groupId)
  const isOwner                                 = role === 'owner'

  // ── Event pill ─────────────────────────────────────────────────────────────
  const [allEvents, setAllEvents]               = useState<EventItem[]>([])
  const [eventsLoading, setEventsLoading]       = useState(true)

  // ── Club / course pickers ─────────────────────────────────────────────────
  const [clubs, setClubs]                       = useState<{ id: string; name: string }[]>([])
  const [selectedClubId, setSelectedClubId]     = useState('')
  const [courses, setCourses]                   = useState<{ id: string; course_name: string }[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [newClubName, setNewClubName]           = useState('')
  const [showNewClub, setShowNewClub]           = useState(false)
  const [newCourseName, setNewCourseName]       = useState('')
  const [showNewCourse, setShowNewCourse]       = useState(false)
  const [creating, setCreating]                 = useState(false)

  // ── Scorecard ─────────────────────────────────────────────────────────────
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

  // ── Load group events for the pill (2-month window) ──────────────────────
  useEffect(() => { loadGroupEvents() }, [groupId])

  async function loadGroupEvents() {
    setEventsLoading(true)
    // Get all events that belong to this group
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

  // ── Init: load clubs + resolve course for the active event ───────────────
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

      // Scorecard row + validation status
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

        // saved_scorecards (pushed from My-scorecard) overrides manual scores
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
        savedData?.forEach(s => { map[s.player_id][s.hole] = s.strokes })  // overrides
        setScores(map)

        // Track which players have pushed data from My-scorecard
        setPlayersWithPush(new Set(savedData?.map(s => s.player_id) ?? []))
      }
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors du chargement')
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

  // Save manual edits → `scores` (does NOT touch saved_scorecards)
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
      setSaveMsg('Sauvegardé')
    } catch { setSaveMsg('Erreur') }
    finally { setSaving(false); setTimeout(() => setSaveMsg(''), 3000) }
  }

  // Validate & close → sets validated_at, locks My-scorecard for this event
  async function handleValidate() {
    if (!isOwner || !scorecardId || isValidated) return
    const confirmed = window.confirm(
      'Valider et clôturer ce Scorecard ?\n\nLes joueurs ne pourront plus envoyer de modifications depuis My Scorecard.'
    )
    if (!confirmed) return
    setValidating(true)
    try {
      // First save any pending changes
      await handleSave()
      // Then stamp validated_at
      const now = new Date().toISOString()
      await supabase.from('scorecards').update({ validated_at: now }).eq('id', scorecardId)
      setValidatedAt(now)
      setSaveMsg('Scorecard clôturé ✓')
    } catch { setSaveMsg('Erreur lors de la clôture') }
    finally { setValidating(false); setTimeout(() => setSaveMsg(''), 4000) }
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

  const activePlayer = players.find(p => p.id === activePlayerId) ?? null
  const upcomingEvents = allEvents.filter(e => !e.isPast)
  const pastEvents     = allEvents.filter(e => e.isPast)

  return (
    <div className="p-5 sm:p-6 max-w-2xl">

      {/* ── Event pill selector (2-month window) ─────────────────────────── */}
      {!eventsLoading && allEvents.length > 1 && (
        <div className="mb-6 rounded-xl border border-white/60 shadow-sm p-4"
          style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Événements</p>

          {upcomingEvents.length > 0 && (
            <div className={pastEvents.length > 0 ? 'mb-3' : ''}>
              <p className="text-[10px] text-slate-400 font-semibold mb-2 uppercase tracking-wide">À venir</p>
              <div className="flex gap-2 flex-wrap">
                {upcomingEvents.map(e => (
                  <EventPill key={e.id} event={e}
                    isSelected={activeEventId === e.id}
                    onSelect={() => setActiveEventId(e.id)} />
                ))}
              </div>
            </div>
          )}

          {pastEvents.length > 0 && (
            <div className={upcomingEvents.length > 0 ? 'pt-3 border-t border-slate-100' : ''}>
              <p className="text-[10px] text-slate-400 font-semibold mb-2 uppercase tracking-wide">
                {upcomingEvents.length > 0 ? '2 derniers mois' : 'Récents'}
              </p>
              <div className="flex gap-2 flex-wrap">
                {pastEvents.map(e => (
                  <EventPill key={e.id} event={e}
                    isSelected={activeEventId === e.id}
                    onSelect={() => setActiveEventId(e.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Validated banner */}
      {isValidated && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50">
          <span className="text-[16px]">🏆</span>
          <div>
            <p className="text-[12px] font-bold text-amber-800">Scorecard clôturé</p>
            <p className="text-[11px] text-amber-600">
              Clôturé le {new Date(validatedAt!).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      )}

      {!isOwner && !isValidated && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-blue-200/60 text-[12px] text-blue-700 font-medium"
          style={{ background: "rgba(219,234,254,0.6)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
          Vue en lecture seule
        </div>
      )}

      {/* ── Club & Parcours ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/60 shadow-sm p-5 mb-6"
        style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Club & Parcours</p>

        <div className="mb-4">
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Club</label>
          <div className="flex gap-2">
            <select value={selectedClubId}
              onChange={e => { setSelectedClubId(e.target.value); setSelectedCourseId('') }}
              className={selectClass} disabled={!isOwner || isValidated}>
              <option value="">Choisir un club…</option>
              {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {isOwner && !isValidated && (
              <button type="button" onClick={() => setShowNewClub(v => !v)}
                className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 whitespace-nowrap transition-colors">
                {showNewClub ? 'Annuler' : '+ Nouveau'}
              </button>
            )}
          </div>
          {isOwner && !isValidated && showNewClub && (
            <div className="flex gap-2 mt-2">
              <input value={newClubName} onChange={e => setNewClubName(e.target.value)}
                placeholder="Nom du club" className={selectClass}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateClub())} />
              <button type="button" onClick={handleCreateClub} disabled={creating || !newClubName.trim()}
                className="bg-[#185FA5] text-white text-[12px] font-semibold px-4 py-2 rounded-xl disabled:opacity-50 whitespace-nowrap hover:bg-[#0C447C] transition-colors">
                {creating ? '…' : 'Créer'}
              </button>
            </div>
          )}
        </div>

        {selectedClubId && (
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Parcours</label>
            <div className="flex gap-2">
              <select value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)}
                className={selectClass} disabled={!isOwner || isValidated}>
                <option value="">Choisir un parcours…</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.course_name}</option>)}
              </select>
              {isOwner && !isValidated && (
                <button type="button" onClick={() => setShowNewCourse(v => !v)}
                  className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 whitespace-nowrap transition-colors">
                  {showNewCourse ? 'Annuler' : '+ Nouveau'}
                </button>
              )}
            </div>
            {isOwner && !isValidated && showNewCourse && (
              <div className="flex gap-2 mt-2">
                <input value={newCourseName} onChange={e => setNewCourseName(e.target.value)}
                  placeholder="Nom du parcours" className={selectClass}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateCourse())} />
                <button type="button" onClick={handleCreateCourse} disabled={creating || !newCourseName.trim()}
                  className="bg-[#185FA5] text-white text-[12px] font-semibold px-4 py-2 rounded-xl disabled:opacity-50 whitespace-nowrap hover:bg-[#0C447C] transition-colors">
                  {creating ? '…' : 'Créer'}
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
          {/* Player selector */}
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
                  {/* Green dot = scores received from My-scorecard */}
                  {hasPush && (
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#3B6D11] rounded-full border-2 border-white"
                      title="Scores reçus depuis My Scorecard" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Active player banner */}
          {activePlayer && (
            <div className="rounded-xl border border-white/60 shadow-sm p-4 mb-5"
              style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>

              {/* Push indicator */}
              {playersWithPush.has(activePlayer.id) && (
                <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 rounded-lg bg-[#3B6D11]/10 border border-[#3B6D11]/20 w-fit">
                  <span className="w-2 h-2 rounded-full bg-[#3B6D11]" />
                  <span className="text-[11px] font-semibold text-[#3B6D11]">Scores reçus depuis My Scorecard</span>
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
                  {tees.map(t => {
                    const teeColor  = getTeeColor(t.tee_name)
                    const isSelected = activePlayer.tee_id === t.id
                    return (
                      <button key={t.id} onClick={() => handleTeeChange(activePlayer.id, t.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border-2 transition-all ${
                          isSelected ? 'border-slate-500 shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                        style={{ background: teeColor.bg, color: teeColor.text }}>
                        {t.tee_name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Scorecard table */}
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
              Aucun joueur confirmé pour cet événement
            </div>
          )}

          {/* Owner actions */}
          {isOwner && (
            <div className="flex items-center justify-between gap-3 mt-6 print:hidden">
              <div className="flex items-center gap-2">
                {saveMsg && (
                  <span className={`text-[12px] font-semibold ${
                    saveMsg.includes('Erreur') ? 'text-red-500' : 'text-[#3B6D11]'
                  }`}>
                    {saveMsg}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!isValidated && (
                  <>
                    <button onClick={handleSave} disabled={saving}
                      className="bg-white border border-slate-200 text-slate-700 text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors">
                      {saving ? 'Saving…' : 'Sauvegarder'}
                    </button>
                    <button onClick={handleValidate} disabled={validating || saving}
                      className="bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-50 transition-colors flex items-center gap-1.5">
                      <span>🏆</span>
                      {validating ? 'Clôture…' : 'Valider & Clôturer'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {!scorecardLoading && !selectedCourseId && (
        <div className="text-center py-12 text-[13px] text-slate-500 border border-dashed border-slate-200 rounded-xl">
          {isOwner
            ? 'Sélectionne un club et un parcours pour accéder aux scorecards'
            : 'Aucun parcours configuré pour cet événement'}
        </div>
      )}
    </div>
  )
}

// ─── EventPill ────────────────────────────────────────────────────────────────

function EventPill({ event, isSelected, onSelect }: {
  event: EventItem; isSelected: boolean; onSelect: () => void
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
        {formatShortDate(event.starts_at)}
      </span>
    </button>
  )
}

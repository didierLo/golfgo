'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import ScorecardTable from '@/components/scorecards/ScorecardTable'

const supabase = createClient()

type TeeInfo  = { id: string; tee_name: string; par_total: number; course_rating: number; slope: number }
type Hole     = { hole_number: number; par: number; stroke_index: number }
type Player   = { id: string; first_name: string; surname: string; whs: number; tee_id: string | null; tee?: TeeInfo; phcp: number }
type ScoreMap = Record<string, Record<number, number | null>>

type EventItem = {
  id: string
  title: string
  starts_at: string
  isPast: boolean
}

function computePhcp(whs: number, tee?: TeeInfo): number {
  if (!tee) return Math.round(whs)
  return Math.round(whs * (tee.slope / 113) + tee.course_rating - tee.par_total)
}

function fallbackHoles(): Hole[] {
  return Array.from({ length: 18 }, (_, i) => ({
    hole_number: i + 1, par: [4,4,3,5,4,4,3,4,5][i % 9], stroke_index: i + 1,
  }))
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' })
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

export default function MyScorecardPage() {
  const [playerId, setPlayerId]               = useState<string | null>(null)
  const [loading, setLoading]                 = useState(true)
  const [scorecardLoading, setScorecardLoading] = useState(false)
  const [error, setError]                     = useState<string | null>(null)

  // Event pill
  const [allEvents, setAllEvents]             = useState<EventItem[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  // Scorecard data
  const [eventTitle, setEventTitle]           = useState('')
  const [eventDate, setEventDate]             = useState('')
  const [eventFormat, setEventFormat]         = useState<'stroke' | 'stableford'>('stableford')
  const [clubName, setClubName]               = useState('')
  const [courseName, setCourseName]           = useState('')
  const [flightPlayers, setFlightPlayers]     = useState<Player[]>([])
  const [activePlayerId, setActivePlayerId]   = useState<string | null>(null)
  const [holes, setHoles]                     = useState<Hole[]>([])
  const [scores, setScores]                   = useState<ScoreMap>({})
  const [saving, setSaving]                   = useState(false)
  const [saveStatus, setSaveStatus]           = useState<'idle' | 'saving' | 'sent' | 'error'>('idle')

  // Lock states
  const [isPastEvent, setIsPastEvent]         = useState(false)  // date passed
  const [isValidated, setIsValidated]         = useState(false)  // owner clôturé

  const scoresRef    = useRef<ScoreMap>({})
  const scorecardRef = useRef<string | null>(null)
  const eventRef     = useRef<string | null>(null)
  const playerRef    = useRef<string | null>(null)

  // ── Auto-save draft → `scores` ──────────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const autoSave = useCallback(async (newScores: ScoreMap, evId: string, scId: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      try {
        const rows = Object.entries(newScores).flatMap(([pid, holeMap]) =>
          Object.entries(holeMap).filter(([, s]) => s != null).map(([hole, strokes]) => ({
            scorecard_id: scId, event_id: evId, player_id: pid,
            hole: Number(hole), strokes: strokes as number,
          }))
        )
        if (rows.length > 0)
          await supabase.from('scores').upsert(rows, { onConflict: 'scorecard_id,player_id,hole' })
      } catch (e) { console.error('auto-save error', e) }
    }, 800)
  }, [])

  // Read-only when past OR validated by owner
  const isReadOnly = isPastEvent || isValidated

  function handleSetScores(newScores: ScoreMap | ((prev: ScoreMap) => ScoreMap)) {
    if (isReadOnly) return
    setScores(prev => {
      const updated = typeof newScores === 'function' ? newScores(prev) : newScores
      scoresRef.current = updated
      const scId = scorecardRef.current
      const evId = eventRef.current
      if (scId && evId) autoSave(updated, evId, scId)
      return updated
    })
  }

  // ── Push to Scorecards → `saved_scorecards` ─────────────────────────────
  // Blocked when scorecard is validated (leaderboard established).
  async function handlePushToScorecards() {
    const scId = scorecardRef.current
    const evId = eventRef.current
    if (!scId || !evId || isValidated) return
    setSaving(true); setSaveStatus('saving')
    try {
      const rows = Object.entries(scoresRef.current).flatMap(([pid, holeScores]) =>
        Object.entries(holeScores).filter(([, s]) => s != null).map(([hole, strokes]) => ({
          scorecard_id: scId, event_id: evId, player_id: pid,
          hole: Number(hole), strokes: strokes as number,
          saved_at: new Date().toISOString(),
        }))
      )
      if (rows.length > 0)
        await supabase.from('saved_scorecards').upsert(rows, { onConflict: 'scorecard_id,player_id,hole' })
      setSaveStatus('sent')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch { setSaveStatus('error') }
    finally { setSaving(false) }
  }

  // ── Bootstrap: load player + events in 2-month window ──────────────────
  useEffect(() => { init() }, [])

  async function init() {
    setLoading(true); setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setError('Non connecté'); setLoading(false); return }

    const { data: p } = await supabase.from('players')
      .select('id, first_name, surname').eq('user_id', session.user.id).single()
    if (!p) { setError('Profil joueur introuvable'); setLoading(false); return }
    setPlayerId(p.id)
    playerRef.current = p.id

    const { data: participations } = await supabase.from('event_participants')
      .select('event_id').eq('player_id', p.id).eq('status', 'GOING')
    if (!participations?.length) { setError('Aucun événement trouvé'); setLoading(false); return }

    const eventIds = participations.map(x => x.event_id)

    // 2-month lookback + all future
    const { data: eventsData } = await supabase.from('events')
      .select('id, title, starts_at')
      .in('id', eventIds)
      .gte('starts_at', twoMonthsAgo())
      .order('starts_at', { ascending: false })

    if (!eventsData?.length) { setError('Aucun événement dans les 2 derniers mois'); setLoading(false); return }

    const now = new Date()
    const items: EventItem[] = eventsData.map(e => ({
      id: e.id, title: e.title, starts_at: e.starts_at,
      isPast: new Date(e.starts_at) < now,
    }))
    setAllEvents(items)

    // Default: nearest upcoming, else most recent past
    const defaultEvent = items.find(e => !e.isPast) ?? items[0]
    setSelectedEventId(defaultEvent.id)
    setLoading(false)
  }

  // ── Reload when selected event changes ──────────────────────────────────
  useEffect(() => {
    if (!selectedEventId || !playerId) return
    loadEvent(selectedEventId, playerId)
  }, [selectedEventId, playerId])

  async function loadEvent(evId: string, pId: string) {
    setScorecardLoading(true); setError(null); setSaveStatus('idle')
    const now = new Date()

    try {
      const { data: participations } = await supabase.from('event_participants')
        .select('event_id, tee_id').eq('player_id', pId).eq('status', 'GOING')

      const { data: events } = await supabase.from('events')
        .select('id, title, starts_at, course_id, competition_formats(scoring_type), courses(course_name, clubs(name))')
        .eq('id', evId).limit(1)

      const event = events?.[0] as any
      if (!event) { setError('Événement introuvable'); return }

      setIsPastEvent(new Date(event.starts_at) < now)

      const myTeeId = participations?.find(p => p.event_id === event.id)?.tee_id ?? null
      setEventTitle(event.title)
      setEventDate(event.starts_at)
      setEventFormat((event.competition_formats as any)?.scoring_type ?? 'stableford')
      setClubName((event.courses as any)?.clubs?.name ?? '')
      setCourseName((event.courses as any)?.course_name ?? '')
      eventRef.current = event.id

      if (!event.course_id) { setError('Aucun parcours configuré'); return }
      await loadScorecardData(event.id, event.course_id, pId, myTeeId)
    } finally {
      setScorecardLoading(false)
    }
  }

  async function loadScorecardData(evId: string, courseId: string, pId: string, myTeeId: string | null) {
    const { data: holesData } = await supabase.from('course_holes')
      .select('hole_number, par, stroke_index').eq('course_id', courseId).order('hole_number')
    setHoles(holesData?.length ? holesData : fallbackHoles())

    const { data: teesData } = await supabase.from('course_tees')
      .select('id, tee_name, par_total, course_rating, slope').eq('course_id', courseId)

    // Flight members
    const { data: myFlight } = await supabase.from('flight_players')
      .select('flights(id, event_id)').eq('player_id', pId)
    const myFlightRow = (myFlight || []).find((f: any) => f.flights?.event_id === evId)
    const flightId = (myFlightRow as any)?.flights?.id ?? null
    let flightPlayerIds: string[] = [pId]
    if (flightId) {
      const { data: fp } = await supabase.from('flight_players').select('player_id').eq('flight_id', flightId)
      flightPlayerIds = (fp || []).map(f => f.player_id)
    }

    const { data: participants } = await supabase.from('event_participants')
      .select('player_id, tee_id, players(id, first_name, surname, whs)')
      .eq('event_id', evId).in('player_id', flightPlayerIds)

    const built: Player[] = (participants || []).map((ep: any) => {
      const pl = ep.players
      const teeId = ep.tee_id ?? myTeeId ?? null
      const tee = (teesData || []).find(t => t.id === teeId)
      return {
        id: pl.id, first_name: pl.first_name, surname: pl.surname,
        whs: pl.whs ?? 0, tee_id: teeId, tee,
        phcp: computePhcp(pl.whs ?? 0, tee),
      }
    })

    const sorted = [...built.filter(p => p.id === pId), ...built.filter(p => p.id !== pId)]
    setFlightPlayers(sorted)
    setActivePlayerId(pId)

    // Scorecard + check validation status
    const { data: sc } = await supabase.from('scorecards')
      .select('id, validated_at').eq('event_id', evId).maybeSingle()
    let scId = sc?.id ?? null
    if (!scId) {
      const { data: created } = await supabase.from('scorecards')
        .insert({ event_id: evId }).select('id').single()
      scId = created?.id ?? null
    }
    scorecardRef.current = scId
    setIsValidated(!!sc?.validated_at)

    if (!scId) return

    // Scores: saved_scorecards overrides live scores
    const { data: savedData } = await supabase.from('saved_scorecards')
      .select('player_id, hole, strokes')
      .eq('scorecard_id', scId).eq('event_id', evId)
      .in('player_id', flightPlayerIds)

    const { data: liveData } = await supabase.from('scores')
      .select('player_id, hole, strokes')
      .eq('scorecard_id', scId).eq('event_id', evId)
      .in('player_id', flightPlayerIds)

    const map: ScoreMap = {}
    sorted.forEach(p => { map[p.id] = {} })
    liveData?.forEach(s => { map[s.player_id][s.hole] = s.strokes })
    savedData?.forEach(s => { map[s.player_id][s.hole] = s.strokes })
    setScores(map)
    scoresRef.current = map
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="p-6 space-y-3 max-w-2xl">
      {[1,2,3].map(i => <div key={i} className="h-14 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )

  if (error && !selectedEventId) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="#94A3B8" strokeWidth="1.5"/>
          <path d="M7 8h10M7 12h10M7 16h6" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <p className="text-[15px] font-bold text-slate-700 mb-1">{error}</p>
      <p className="text-[13px] text-slate-500">Tes scores apparaîtront ici dès que tu seras inscrit à un événement</p>
    </div>
  )

  const activePlayer = flightPlayers.find(p => p.id === activePlayerId) ?? null
  const upcomingEvents = allEvents.filter(e => !e.isPast)
  const pastEvents     = allEvents.filter(e => e.isPast)

  return (
    <div className="p-5 sm:p-6 max-w-2xl">

      {/* ── Event pill selector ─────────────────────────────────────────── */}
      {allEvents.length > 0 && (
        <div className="mb-5 rounded-xl border border-white/60 shadow-sm p-4"
          style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Événements</p>

          {upcomingEvents.length > 0 && (
            <div className={pastEvents.length > 0 ? 'mb-3' : ''}>
              <p className="text-[10px] text-slate-400 font-semibold mb-2 uppercase tracking-wide">À venir</p>
              <div className="flex gap-2 flex-wrap">
                {upcomingEvents.map(e => (
                  <EventPill key={e.id} event={e}
                    isSelected={selectedEventId === e.id}
                    onSelect={() => setSelectedEventId(e.id)} />
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
                    isSelected={selectedEventId === e.id}
                    onSelect={() => setSelectedEventId(e.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">{eventTitle}</h1>
          {eventDate && <p className="text-[13px] text-slate-500 mt-0.5">{formatDate(eventDate)}</p>}
          {(clubName || courseName) && (
            <p className="text-[14px] text-slate-700 font-medium mt-0.5">
              {clubName}{courseName && ` · ${courseName}`}
            </p>
          )}
        </div>

        {/* Right-side action area */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1.5 mt-1">
          {isValidated ? (
            // Scorecard clôturé par l'owner — plus d'envoi possible
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-[13px]">🏆</span>
              <span className="text-[11px] font-bold text-amber-700">Scorecards clôturé</span>
            </div>
          ) : isPastEvent ? (
            // Event passed but not yet validated — can still send
            <>
              <button onClick={handlePushToScorecards} disabled={saving}
                className="text-[12px] font-semibold px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                <UploadIcon />
                {saving ? 'Envoi…' : 'Envoyer aux Scorecards'}
              </button>
              <span className="text-[10px] text-slate-400 font-medium">Partie terminée · lecture seule</span>
              <SaveFeedback status={saveStatus} />
            </>
          ) : (
            // Active event — full edit + send
            <>
              <button onClick={handlePushToScorecards} disabled={saving}
                className="text-[12px] font-semibold px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                <UploadIcon />
                {saving ? 'Envoi…' : 'Envoyer aux Scorecards'}
              </button>
              <SaveFeedback status={saveStatus} />
            </>
          )}
        </div>
      </div>

      {error && selectedEventId && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-600">{error}</div>
      )}

      {/* Scorecard loading skeleton */}
      {scorecardLoading && (
        <div className="space-y-2 mb-4">
          {[1,2,3].map(i => <div key={i} className="h-10 bg-white/40 rounded-xl animate-pulse" />)}
        </div>
      )}

      {/* ── Flight selector ─────────────────────────────────────────────── */}
      {!scorecardLoading && flightPlayers.length > 1 && (
        <div className="mb-5 rounded-xl border border-white/60 shadow-sm p-4"
          style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Mon flight</p>
          <div className="flex gap-2 flex-wrap">
            {flightPlayers.map(p => {
              const initials = `${p.first_name?.[0] ?? ''}${p.surname?.[0] ?? ''}`.toUpperCase()
              const isActive = p.id === activePlayerId
              const isMe = p.id === playerId
              return (
                <button key={p.id} onClick={() => setActivePlayerId(p.id)}
                  title={`${p.first_name} ${p.surname}`}
                  className="flex flex-col items-center gap-1 transition-all">
                  <div className={`w-11 h-11 rounded-full text-[12px] font-bold border-2 flex items-center justify-center transition-all ${
                    isActive
                      ? 'bg-[#185FA5] text-white border-[#185FA5]'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-[#185FA5]'
                  }`}>
                    {initials}
                  </div>
                  <span className={`text-[10px] font-semibold ${isActive ? 'text-[#185FA5]' : 'text-slate-400'}`}>
                    {isMe ? 'Moi' : p.first_name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Active player banner ─────────────────────────────────────────── */}
      {!scorecardLoading && activePlayer && (
        <div className="rounded-xl border border-white/60 shadow-sm p-3.5 mb-5"
          style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-black text-slate-900">
              {activePlayer.id === playerId ? 'My scorecard' : `${activePlayer.first_name} ${activePlayer.surname}`}
            </p>
            {activePlayer.tee && (
              <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                {activePlayer.tee.tee_name}
              </span>
            )}
          </div>
          <div className="flex gap-3 mt-1">
            <span className="text-[12px] text-slate-500">WHS <span className="font-bold text-slate-800 ml-0.5">{activePlayer.whs}</span></span>
            <span className="text-[12px] text-slate-500">Phcp <span className="font-bold text-slate-800 ml-0.5">{activePlayer.phcp}</span></span>
          </div>
        </div>
      )}

      {/* ── Scorecard table ──────────────────────────────────────────────── */}
      {!scorecardLoading && activePlayer && (
        <div className="rounded-xl border border-white/60 shadow-sm overflow-hidden"
          style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          <ScorecardTable
            holes={holes}
            player={activePlayer}
            scores={scores}
            setScores={handleSetScores}
            eventFormat={eventFormat}
            readOnly={isReadOnly}
          />
        </div>
      )}

      {!scorecardLoading && !activePlayer && selectedEventId && !error && (
        <div className="text-center py-12 text-[13px] text-slate-500 border border-dashed border-white/40 rounded-xl"
          style={{ background: "rgba(255,255,255,0.5)" }}>
          Aucun joueur dans ce flight
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

// ─── Small helpers ────────────────────────────────────────────────────────────

function UploadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7"/>
    </svg>
  )
}

function SaveFeedback({ status }: { status: 'idle' | 'saving' | 'sent' | 'error' }) {
  if (status === 'idle') return null
  return (
    <span className={`text-[11px] font-semibold ${
      status === 'sent'   ? 'text-[#3B6D11]' :
      status === 'error'  ? 'text-red-500'   :
      'text-slate-400'
    }`}>
      {status === 'sent'   && '✓ Envoyé aux Scorecards'}
      {status === 'error'  && 'Erreur lors de l\'envoi'}
      {status === 'saving' && 'Envoi en cours…'}
    </span>
  )
}

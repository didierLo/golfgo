'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import ScorecardTable from '@/components/scorecards/ScorecardTable'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useGroupRole } from '@/lib/hooks/useGroupRole'
import { buildScorecardCardsHtml, SCORECARD_PRINT_STYLES, type PrintPlayer } from '@/components/scorecards/buildScorecardHtml'
import { getTeamGroups, playingHcp, teamPhcp, type TeamFormat } from '@/lib/golf/scorecards/composeCards'
import type { ScoreEntrant } from '@/components/scorecards/ScorecardTable'

const supabase = createClient()


type TeeInfo  = { id: string; tee_name: string; par_total: number; course_rating: number; slope: number }
type Hole     = { hole_number: number; par: number; stroke_index: number }
type Player   = { id: string; first_name: string; surname: string; whs: number; tee_id: string | null; tee?: TeeInfo; phcp: number }
type ScoreMap = Record<string, Record<number, number | null>>
type EventItem = { id: string; title: string; starts_at: string; isPast: boolean }

function computePhcp(whs: number, tee?: TeeInfo): number {
  if (!tee) return Math.round(whs)
  return Math.round(whs * (tee.slope / 113) + tee.course_rating - tee.par_total)
}

function twoMonthsAgo(): string {
  const d = new Date(); d.setMonth(d.getMonth() - 2); d.setHours(0,0,0,0); return d.toISOString()
}

const selectClass = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] bg-white"

// ── Bouton icône (même style que Communications) ────────────────────────────
// "locked" = visible mais grisé + toast au clic (réservé à l'owner), distinct de "disabled" (vraiment inactif, ex. WhatsApp)
function IconBtn({ onClick, title, disabled, locked, color, children }: {
  onClick?: () => void; title: string
  disabled?: boolean; locked?: boolean; color?: 'blue'; children: React.ReactNode
}) {
  const base = `w-9 h-9 flex items-center justify-center rounded-xl border text-[16px] transition-colors flex-shrink-0`
  const cls = (disabled || locked)
    ? `${base} border-slate-200 text-slate-300 bg-slate-50 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`
    : color === 'blue'
      ? `${base} border-[#185FA5] bg-[#185FA5] text-white hover:bg-[#0C447C]`
      : `${base} border-slate-200 text-slate-600 hover:bg-slate-50`
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={cls}>
      {children}
    </button>
  )
}

export default function MyScorecardPage() {
  const t      = useTranslations()
  const locale = useLocale()
  const router = useRouter()

  function formatShortDate(d: string) {
    return new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const [playerId, setPlayerId]                 = useState<string | null>(null)
  const [groupId, setGroupId]                   = useState<string | null>(null)
  const [loading, setLoading]                   = useState(true)
  const [scorecardLoading, setScorecardLoading] = useState(false)
  const [error, setError]                       = useState<string | null>(null)

  const { role } = useGroupRole(groupId ?? '')
  const isOwner  = role === 'owner'

  const [allEvents, setAllEvents]               = useState<EventItem[]>([])
  const [selectedEventId, setSelectedEventId]   = useState<string | null>(null)

  const [eventTitle, setEventTitle]             = useState('')
  const [eventStartsAt, setEventStartsAt]       = useState('')
  const [eventFormat, setEventFormat]           = useState<'stroke' | 'stableford'>('stableford')
  const [clubName, setClubName]                 = useState('')
  const [courseName, setCourseName]             = useState('')
  const [flightPlayers, setFlightPlayers]       = useState<Player[]>([])
  const [activePlayerId, setActivePlayerId]     = useState<string | null>(null)
  const [holes, setHoles]                       = useState<Hole[]>([])
  const [scores, setScores]                     = useState<ScoreMap>({})
  const [saving, setSaving]                     = useState(false)
  const [saveStatus, setSaveStatus]             = useState<'idle' | 'saving' | 'sent' | 'error'>('idle')
  const [isPastEvent, setIsPastEvent]           = useState(false)
  const [isValidated, setIsValidated]           = useState(false)

const [allFlights, setAllFlights]             = useState<PrintPlayer[][]>([])
const [teamFormat, setTeamFormat]             = useState<TeamFormat>('individual')
const [hcpPercentage, setHcpPercentage]       = useState<number>(100)
const [formatName, setFormatName]             = useState('')
const [scorecardNotes, setScorecardNotes]     = useState('')
const [bulkSending, setBulkSending]           = useState(false)
const [logoUrl, setLogoUrl]                   = useState<string | null>(null)

useEffect(() => {
  if (!groupId) return
  supabase.from('groups').select('template_logo_url').eq('id', groupId).single()
    .then(({ data }) => setLogoUrl(data?.template_logo_url ?? null))
}, [groupId])

  const scoresRef    = useRef<ScoreMap>({})
  const scorecardRef = useRef<string | null>(null)
  const eventRef     = useRef<string | null>(null)
  const playerRef    = useRef<string | null>(null)
  const saveTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const isReadOnly = isPastEvent || isValidated

  function handleSetScores(newScores: ScoreMap | ((prev: ScoreMap) => ScoreMap)) {
    if (isReadOnly) return
    setScores(prev => {
      const updated = typeof newScores === 'function' ? newScores(prev) : newScores
      scoresRef.current = updated
      const scId = scorecardRef.current; const evId = eventRef.current
      if (scId && evId) autoSave(updated, evId, scId)
      return updated
    })
  }

  // Signe la carte du flight (tous les scores saisis pour ce flight) et l'envoie au leaderboard
  async function handleSignScorecard() {
    const scId = scorecardRef.current; const evId = eventRef.current
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

  useEffect(() => { init() }, [])

  async function init() {
    setLoading(true); setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setError(t('scorecard.notConnected')); setLoading(false); return }

    const { data: p } = await supabase.from('players')
      .select('id, first_name, surname').eq('user_id', session.user.id).single()
    if (!p) { setError(t('scorecard.noProfile')); setLoading(false); return }
    setPlayerId(p.id); playerRef.current = p.id

    const { data: participations } = await supabase.from('event_participants')
      .select('event_id').eq('player_id', p.id).eq('status', 'GOING')
    if (!participations?.length) { setError(t('scorecard.noEvents')); setLoading(false); return }

    const eventIds = participations.map(x => x.event_id)
    const activeGroupId = localStorage.getItem('golfgo-last-group')
    setGroupId(activeGroupId)

    const { data: eventsData } = await supabase.from('events')
      .select('id, title, starts_at').in('id', eventIds)
      .gte('starts_at', twoMonthsAgo())
      .eq('group_id', activeGroupId ?? '')
      .order('starts_at', { ascending: true })

    if (!eventsData?.length) { setError(t('scorecard.noRecentEvents')); setLoading(false); return }

    const now = new Date()
    const items: EventItem[] = eventsData.map(e => ({
      id: e.id, title: e.title, starts_at: e.starts_at,
      isPast: new Date(e.starts_at) < now,
    }))
    setAllEvents(items)
   const retained = localStorage.getItem(`golfgo-active-event-${activeGroupId}`)
   const retainedExists = items.find(e => e.id === retained)
    setSelectedEventId(retainedExists?.id ?? (items.find(e => !e.isPast) ?? items[items.length - 1]).id)
    setLoading(false)
      }

  useEffect(() => {
    if (!selectedEventId || !playerId) return
    loadEvent(selectedEventId, playerId)
  }, [selectedEventId, playerId])

  // Re-fetch la formule/l'événement quand l'onglet redevient visible : corrige le cas où la
  // formule de jeu a été changée depuis la page "modifier l'événement" pendant que cette page
  // était restée ouverte en arrière-plan.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible' && selectedEventId && playerId) {
        loadEvent(selectedEventId, playerId)
      }
    }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [selectedEventId, playerId])

  async function loadEvent(evId: string, pId: string) {
    setScorecardLoading(true); setError(null); setSaveStatus('idle')
    setFlightPlayers([]); setActivePlayerId(null); setHoles([]); setScores({}); setAllFlights([])
    const now = new Date() 
    try {
      const [{ data: participations }, { data: events }] = await Promise.all([
  supabase.from('event_participants')
    .select('event_id, tee_id')
    .eq('player_id', pId).eq('status', 'GOING'),
  supabase.from('events')
    .select('id, title, starts_at, course_id, group_id, scorecard_notes, competition_formats(name, scoring_type, team_format, hcp_percentage), courses(course_name, clubs(name)), hcp_percentage_override')
    .eq('id', evId).limit(1),
])
      const event = events?.[0] as any
      if (!event) { setError(t('common.error')); return }

      setIsPastEvent(new Date(event.starts_at) < now)
      const myTeeId = participations?.find(p => p.event_id === event.id)?.tee_id ?? null
      setEventTitle(event.title)
      setEventStartsAt(event.starts_at)
      setEventFormat((event.competition_formats as any)?.scoring_type ?? 'stableford')
      setTeamFormat((event.competition_formats as any)?.team_format ?? 'individual')
      setHcpPercentage(event.hcp_percentage_override ?? (event.competition_formats as any)?.hcp_percentage ?? 100)
      setFormatName((event.competition_formats as any)?.name ?? '')
      setScorecardNotes(event.scorecard_notes ?? '')
      setClubName((event.courses as any)?.clubs?.name ?? '')
      setCourseName((event.courses as any)?.course_name ?? '')
      eventRef.current = event.id
      if (event.group_id) {
      setGroupId(event.group_id)
      const { data: groupData } = await supabase.from('groups')
        .select('template_logo_url').eq('id', event.group_id).single()
      setLogoUrl(groupData?.template_logo_url ?? null)
    }
      if (!event.course_id) { setError(t('scorecard.noCourse')); return }
      await Promise.all([
        loadScorecardData(event.id, event.course_id, pId, myTeeId),
        loadAllParticipants(event.id, event.course_id),
      ])
    } finally { setScorecardLoading(false) }
  }

  // Charge TOUS les participants GOING de l'événement (pas seulement mon flight), pour le bloc "Toutes les cartes"
    async function loadAllParticipants(evId: string, courseId: string) {
      const [{ data: teesData }, { data: flightsData }, { data: participants }] = await Promise.all([
        supabase.from('course_tees').select('id, tee_name, par_total, course_rating, slope')
          .eq('course_id', courseId),
        supabase.from('flights')
          .select('flight_number, flight_players(position, player_id)')
          .eq('event_id', evId).order('flight_number'),
        supabase.from('event_participants')
          .select('player_id, tee_id, players(id, first_name, surname, whs)')
          .eq('event_id', evId).eq('status', 'GOING'),
      ])

      const byPlayerId = new Map<string, any>((participants || []).map((p: any) => [p.player_id, p]))

      const grouped: PrintPlayer[][] = (flightsData || [])
        .sort((a: any, b: any) => a.flight_number - b.flight_number)
        .map((f: any) => (f.flight_players || [])
          .sort((a: any, b: any) => a.position - b.position)
          .map((fp: any) => {
            const ep = byPlayerId.get(fp.player_id)
            const pl = ep?.players
            const tee = (teesData || []).find((t: any) => t.id === ep?.tee_id)
            return {
              id: fp.player_id, first_name: pl?.first_name ?? '', surname: pl?.surname ?? '',
              whs: pl?.whs ?? 0, phcp: computePhcp(pl?.whs ?? 0, tee), tee,
            }
          }))

  setAllFlights(grouped)
}

  async function loadScorecardData(evId: string, courseId: string, pId: string, myTeeId: string | null) {
    const [{ data: holesData }, { data: teesData }, { data: myFlight }] = await Promise.all([supabase.from('course_holes')
    
    .select('hole_number, par, stroke_index')
    .eq('course_id', courseId).order('hole_number'),
  supabase.from('course_tees')
    .select('id, tee_name, par_total, course_rating, slope')
    .eq('course_id', courseId),
  supabase.from('flight_players')
    .select('flights(id, event_id)')
    .eq('player_id', pId),
])
    setHoles(holesData || []) 
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
      return { id: pl.id, first_name: pl.first_name, surname: pl.surname, whs: pl.whs ?? 0, tee_id: teeId, tee, phcp: computePhcp(pl.whs ?? 0, tee) }
    })

    const sorted = [...built.filter(p => p.id === pId), ...built.filter(p => p.id !== pId)]
    setFlightPlayers(sorted); setActivePlayerId(pId)

    const { data: sc } = await supabase.from('scorecards')
      .select('id, validated_at').eq('event_id', evId).maybeSingle()
    let scId = sc?.id ?? null
    if (!scId) {
      const { data: created } = await supabase.from('scorecards').insert({ event_id: evId }).select('id').single()
      scId = created?.id ?? null
    }
    scorecardRef.current = scId
    setIsValidated(!!sc?.validated_at)
    if (!scId) return

    const [{ data: savedData }, { data: liveData }] = await Promise.all([
  supabase.from('saved_scorecards')
    .select('player_id, hole, strokes')
    .eq('scorecard_id', scId).eq('event_id', evId)
    .in('player_id', flightPlayerIds),
  supabase.from('scores')
    .select('player_id, hole, strokes')
    .eq('scorecard_id', scId).eq('event_id', evId)
    .in('player_id', flightPlayerIds),
])

    const map: ScoreMap = {}
    sorted.forEach(p => { map[p.id] = {} })
    liveData?.forEach(s => { map[s.player_id][s.hole] = s.strokes })
    savedData?.forEach(s => { map[s.player_id][s.hole] = s.strokes })
    setScores(map); scoresRef.current = map
  }

  function requireOwner(): boolean {
    if (!isOwner) { toast.error('Action réservée à l\'organisateur du groupe'); return false }
    return true
  }

  function openAllScorecardsWindow() {
    if (!requireOwner()) return
    if (allFlights.length === 0) { toast.error('Aucun flight pour cet événement'); return }
    if (holes.length === 0) { toast.error(t('scorecard.noCourse')); return }

    const eventDate = eventStartsAt
      ? new Date(eventStartsAt).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })
      : ''

  

    const htmlBody = allFlights
      .map(flightPlayers => buildScorecardCardsHtml(
       flightPlayers, holes, eventTitle, eventDate, clubName, courseName, logoUrl, teamFormat, hcpPercentage, formatName, scorecardNotes
      ))
      .join('')

    const html = `<!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8"/>
    <title>Scorecards — ${eventTitle}</title>
    <style>${SCORECARD_PRINT_STYLES}</style>
    </head>
    <body>
    ${htmlBody}
    <script>window.onload = () => window.print()</script>
    </body>
    </html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const win  = window.open(url, '_blank')
    if (!win) {
      toast.error('Pop-up bloquée — autorisez les pop-ups pour continuer')
      URL.revokeObjectURL(url)
    } else {
      setTimeout(() => URL.revokeObjectURL(url), 300000)
    }
  }

  async function handleSendAllScorecards() {
    if (!requireOwner()) return
    if (!selectedEventId) return
    if (allFlights.length === 0) { toast.error('Aucun flight pour cet événement'); return }

    setBulkSending(true)
    try {
      const res  = await fetch('/api/send-scorecards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: selectedEventId }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`${json.sent} carte${json.sent > 1 ? 's' : ''} envoyée${json.sent > 1 ? 's' : ''}${json.skipped ? ` · ${json.skipped} ignoré(s)` : ''}`)
      } else {
        toast.error(json.error ?? t('common.error'))
      }
      if (json.errors?.length) toast.error(`Erreurs : ${json.errors.join(', ')}`)
    } catch (e: any) {
      toast.error(e.message ?? t('common.error'))
    } finally {
      setBulkSending(false)
    }
  }

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
      <p className="text-[13px] text-slate-500">{t('scorecard.noEventsHint')}</p>
    </div>
  )

  const activePlayer = flightPlayers.find(p => p.id === activePlayerId) ?? null

  // allFlights est trié par position réelle du flight (contrairement à flightPlayers, réordonné
  // "moi en premier") — c'est la source fiable pour le regroupement par équipe, cohérente avec l'impression.
  const orderedFlight: PrintPlayer[] = allFlights.find(fl => fl.some(p => p.id === playerId)) ?? flightPlayers
  const teamGroups = getTeamGroups(orderedFlight, teamFormat)
  const activeGroup = teamGroups.find(g => g.some(p => p.id === activePlayerId)) ?? []

  // Construit le tableau players[] pour ScorecardTable selon la formule, en appliquant le % HCP
  // de l'événement (event override > format > 100) — jusqu'ici jamais appliqué à la carte digitale.
  function buildCardPlayers(group: PrintPlayer[]): ScoreEntrant[] {
    if (teamFormat === '4bbb') {
      return group.map(p => ({ id: p.id, phcp: playingHcp(p.phcp, hcpPercentage) }))
    }
    if (teamFormat === 'team2' || teamFormat === 'team3_4') {
      if (!group.length) return []
      return [{ id: group[0].id, phcp: teamPhcp(group, hcpPercentage) }]
    }
    const solo = group.find(p => p.id === activePlayerId) ?? group[0]
    return solo ? [{ id: solo.id, phcp: playingHcp(solo.phcp, hcpPercentage) }] : []
  }

  return (
   <div className="p-5 sm:p-6 max-w-2xl">
      <h1 className="text-[22px] font-black text-slate-900 tracking-tight mb-4">{t('scorecard.title')}</h1>

      {allEvents.length > 0 && (
        <div className="rounded-xl border border-white/60 shadow-sm p-4 mb-5"
          style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
            {t('scorecard.event')}
          </label>
          <select value={selectedEventId ?? ''} onChange={e => {
            setSelectedEventId(e.target.value)
            const gid = localStorage.getItem('golfgo-last-group')
            if (gid) localStorage.setItem(`golfgo-active-event-${gid}`, e.target.value)
          }}className={selectClass}>
            {allEvents.map(e => (
              <option key={e.id} value={e.id}>
                {e.title} · {formatShortDate(e.starts_at)}{e.isPast ? ' ✓' : ''}
              </option>
            ))}
          </select>
          {(clubName || courseName) && (
            <p className="text-[12px] text-slate-500 mt-2.5 font-medium">
              {clubName}{courseName && ` · ${courseName}`}
            </p>
          )}
        </div>
      )}

      {/* ── Bloc owner : Toutes les cartes de score ── */}
      {!scorecardLoading && selectedEventId && (
        <div className="rounded-xl border border-white/60 shadow-sm p-4 mb-6"
          style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[14px] font-black text-slate-900">Toutes les cartes de score</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
              {allFlights.flat().length} participant{allFlights.flat().length > 1 ? 's' : ''} confirmé{allFlights.flat().length > 1 ? 's' : ''}
            </p>
            </div>
            <div className="flex items-center gap-1.5">
              <IconBtn onClick={openAllScorecardsWindow} locked={!isOwner} title="Imprimer">🖨</IconBtn>
              <IconBtn onClick={openAllScorecardsWindow} locked={!isOwner} title="Aperçu">👁</IconBtn>
              <IconBtn disabled title="WhatsApp">💬</IconBtn>
              <IconBtn onClick={handleSendAllScorecards} locked={!isOwner} color="blue"
                title={bulkSending ? 'Envoi…' : 'Envoyer'}>
                {bulkSending ? '⏳' : '📤'}
              </IconBtn>
            </div>
          </div>
        </div>
      )}

      {error && selectedEventId && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-600">{error}</div>
      )}

      {scorecardLoading && (
        <div className="space-y-2 mb-4">
          {[1,2,3].map(i => <div key={i} className="h-10 bg-white/40 rounded-xl animate-pulse" />)}
        </div>
      )}

      {!scorecardLoading && flightPlayers.length > 1 && (
        <div className="mb-5 rounded-xl border border-white/60 shadow-sm p-4"
          style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{t('scorecard.myFlight')}</p>
          <div className="flex gap-3 flex-wrap">
            {teamGroups.map((group, gi) => {
              const isTeamCard = teamFormat === 'team2' || teamFormat === 'team3_4'
              const isTeamGroup = isTeamCard || teamFormat === '4bbb'
              const groupIsActive = group.some(p => p.id === activePlayerId)
              return (
                <div key={gi} className={`flex gap-1.5 ${isTeamGroup ? 'p-1.5 rounded-2xl' : ''} ${
                  isTeamGroup && groupIsActive ? 'bg-[#185FA5]/10 border border-[#185FA5]/30' : isTeamGroup ? 'border border-transparent' : ''
                }`}>
                  {group.map(p => {
                    const initials = `${p.first_name?.[0] ?? ''}${p.surname?.[0] ?? ''}`.toUpperCase()
                    const isActive = isTeamCard ? groupIsActive : p.id === activePlayerId
                    const isMe     = p.id === playerId
                    return (
                      <button key={p.id} onClick={() => setActivePlayerId(p.id)}
                        title={`${p.first_name} ${p.surname}`}
                        className="flex flex-col items-center gap-1 transition-all">
                        <div className={`w-11 h-11 rounded-full text-[12px] font-bold border-2 flex items-center justify-center transition-all ${
                          isActive ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'bg-white text-slate-600 border-slate-300 hover:border-[#185FA5]'
                        }`}>
                          {initials}
                        </div>
                        <span className={`text-[10px] font-semibold ${isActive ? 'text-[#185FA5]' : 'text-slate-400'}`}>
                          {isMe ? t('scorecard.me') : p.first_name}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!scorecardLoading && activePlayer && (
        <div className="rounded-xl border border-white/60 shadow-sm p-3.5 mb-5"
          style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-black text-slate-900">
              {activePlayer.id === playerId ? t('scorecard.myScorecard') : `${activePlayer.first_name} ${activePlayer.surname}`}
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

      {!scorecardLoading && activePlayer && (
        <div className="flex items-center justify-end gap-2 mb-5">
          {isValidated ? (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-[13px]">🏆</span>
              <span className="text-[11px] font-bold text-amber-700">{t('scorecard.closed')}</span>
            </div>
          ) : (
            <>
              <SaveFeedback status={saveStatus} />
              {isPastEvent && (
                <span className="text-[10px] text-slate-400 font-medium">{t('scorecard.readOnly')}</span>
              )}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                  Cliquez ici en fin de partie
                </span>
                <span className="text-[18px] animate-bounce" style={{ animationDuration: '1.4s' }}>👉</span>
                <button onClick={handleSignScorecard} disabled={saving}
                  className="text-[12px] font-semibold px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                  {saving ? '⏳' : '✅'} {saving ? 'Envoi…' : 'Signer la carte et terminer la partie'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {!scorecardLoading && activePlayer && (
        <div className="rounded-xl border border-white/60 shadow-sm overflow-hidden"
          style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          <ScorecardTable
            holes={holes}
            players={buildCardPlayers(activeGroup.length ? activeGroup : (activePlayer ? [activePlayer] : []))}
            scores={scores}
            setScores={handleSetScores} eventFormat={eventFormat} readOnly={isReadOnly}
          />
        </div>
      )}

      {!scorecardLoading && !activePlayer && selectedEventId && !error && (
        <div className="text-center py-12 text-[13px] text-slate-500 border border-dashed border-white/40 rounded-xl"
          style={{ background: "rgba(255,255,255,0.5)" }}>
          {t('scorecard.noFlight')}
        </div>
      )}
    </div>
  )
}

function SaveFeedback({ status }: { status: 'idle' | 'saving' | 'sent' | 'error' }) {
  if (status === 'idle') return null
  if (status === 'sent')  return <span className="text-[11px] font-semibold text-emerald-600">La carte de score a été signée et envoyée au leaderboard.</span>
  if (status === 'error') return <span className="text-[11px] font-semibold text-red-500">Erreur — réessaie</span>
  return <span className="text-[11px] font-semibold text-slate-900">Envoi…</span>
}

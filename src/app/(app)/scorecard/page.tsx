'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import ScorecardTable from '@/components/scorecards/ScorecardTable'

const supabase = createClient()

type TeeInfo  = { id: string; tee_name: string; par_total: number; course_rating: number; slope: number }
type Hole     = { hole_number: number; par: number; stroke_index: number }
type Player   = { id: string; first_name: string; surname: string; whs: number; tee_id: string | null; tee?: TeeInfo; phcp: number }
type ScoreMap = Record<string, Record<number, number | null>>

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

export default function MyScorecardPage() {
  const [playerId, setPlayerId]         = useState<string | null>(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [eventId, setEventId]           = useState<string | null>(null)
  const [eventTitle, setEventTitle]     = useState('')
  const [eventDate, setEventDate]       = useState('')
  const [eventFormat, setEventFormat]   = useState<'stroke' | 'stableford'>('stableford')
  const [clubName, setClubName]         = useState('')
  const [courseName, setCourseName]     = useState('')
  const [flightPlayers, setFlightPlayers] = useState<Player[]>([])
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null)
  const [holes, setHoles]               = useState<Hole[]>([])
  const [scores, setScores]             = useState<ScoreMap>({})
  const [scorecardId, setScorecardId]   = useState<string | null>(null)
  const [saveStatus, setSaveStatus]     = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scoresRef = useRef<ScoreMap>({})

  useEffect(() => { init() }, [])

  async function init() {
    setLoading(true); setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setError('Non connecté'); setLoading(false); return }

    const { data: p } = await supabase.from('players')
      .select('id, first_name, surname').eq('user_id', session.user.id).single()
    if (!p) { setError('Profil joueur introuvable'); setLoading(false); return }
    setPlayerId(p.id)

    const { data: participations } = await supabase.from('event_participants')
      .select('event_id, tee_id').eq('player_id', p.id).eq('status', 'GOING')
    if (!participations?.length) { setError('Aucun événement à venir pour toi'); setLoading(false); return }

    const eventIds = participations.map(p => p.event_id)
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

    const { data: events } = await supabase.from('events')
      .select(`id, title, starts_at, course_id, competition_formats(scoring_type), courses(course_name, clubs(name))`)
      .in('id', eventIds).gte('starts_at', todayStart.toISOString())
      .order('starts_at', { ascending: true }).limit(1)

    const event = events?.[0] as any
    if (!event) { setError('Aucun événement à venir pour toi'); setLoading(false); return }

    const myTeeId = participations.find(p => p.event_id === event.id)?.tee_id ?? null
    setEventId(event.id); setEventTitle(event.title); setEventDate(event.starts_at)
    setEventFormat((event.competition_formats as any)?.scoring_type ?? 'stableford')
    setClubName((event.courses as any)?.clubs?.name ?? '')
    setCourseName((event.courses as any)?.course_name ?? '')

    if (!event.course_id) { setError('Aucun parcours configuré pour cet événement'); setLoading(false); return }
    await loadScorecardData(event.id, event.course_id, p.id, myTeeId)
    setLoading(false)
  }

  async function loadScorecardData(evId: string, courseId: string, pId: string, myTeeId: string | null) {
    const { data: holesData } = await supabase.from('course_holes')
      .select('hole_number, par, stroke_index').eq('course_id', courseId).order('hole_number')
    setHoles(holesData?.length ? holesData : fallbackHoles())

    const { data: teesData } = await supabase.from('course_tees')
      .select('id, tee_name, par_total, course_rating, slope').eq('course_id', courseId)

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
      return { id: pl.id, first_name: pl.first_name, surname: pl.surname, whs: pl.whs ?? 0, tee_id: teeId, tee, phcp: computePhcp(pl.whs ?? 0, tee) }
    })

    const sorted = [...built.filter(p => p.id === pId), ...built.filter(p => p.id !== pId)]
    setFlightPlayers(sorted); setActivePlayerId(pId)

    const { data: sc } = await supabase.from('scorecards').select('id').eq('event_id', evId).maybeSingle()
    let scId = sc?.id ?? null
    if (!scId) {
      const { data: created } = await supabase.from('scorecards').insert({ event_id: evId }).select('id').single()
      scId = created?.id ?? null
    }
    setScorecardId(scId)

    if (scId && flightPlayerIds.length > 0) {
      const { data: scoresData } = await supabase.from('scores').select('player_id, hole, strokes')
        .eq('scorecard_id', scId).eq('event_id', evId).in('player_id', flightPlayerIds)
      const map: ScoreMap = {}
      sorted.forEach(p => { map[p.id] = {} })
      scoresData?.forEach(s => { map[s.player_id][s.hole] = s.strokes })
      setScores(map); scoresRef.current = map
    }
  }

  const autoSave = useCallback(async (newScores: ScoreMap, pId: string, evId: string, scId: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    saveTimer.current = setTimeout(async () => {
      try {
        const rows = Object.entries(newScores).flatMap(([playerId, holes]) =>
          Object.entries(holes).filter(([, strokes]) => strokes != null).map(([hole, strokes]) => ({
            scorecard_id: scId, event_id: evId, player_id: playerId, hole: Number(hole), strokes: strokes as number,
          }))
        )
        if (rows.length > 0) {
          await supabase.from('scores').upsert(rows, { onConflict: 'scorecard_id,player_id,hole' })
        }
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch { setSaveStatus('error') }
    }, 800)
  }, [])

  function handleSetScores(newScores: ScoreMap | ((prev: ScoreMap) => ScoreMap)) {
    setScores(prev => {
      const updated = typeof newScores === 'function' ? newScores(prev) : newScores
      scoresRef.current = updated
      if (scorecardId && eventId && playerId) autoSave(updated, playerId, eventId, scorecardId)
      return updated
    })
  }

  if (loading) return (
    <div className="p-6 space-y-3 max-w-2xl">
      {[1,2,3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  )

  if (error) return (
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

  return (
    <div className="p-5 sm:p-6 max-w-2xl">

      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">{eventTitle}</h1>
          <p className="text-[13px] text-slate-600 mt-0.5">{formatDate(eventDate)}</p>
          {(clubName || courseName) && (
            <p className="text-[12px] text-slate-500 mt-0.5">{clubName}{courseName && ` · ${courseName}`}</p>
          )}
        </div>
        <div className="flex-shrink-0 mt-1">
          {saveStatus === 'saving' && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <div className="w-3 h-3 border-2 border-slate-300 border-t-[#185FA5] rounded-full animate-spin" />
              Sauvegarde…
            </div>
          )}
          {saveStatus === 'saved'  && <span className="text-[11px] text-[#3B6D11] font-semibold">✓ Sauvegardé</span>}
          {saveStatus === 'error'  && <span className="text-[11px] text-red-500 font-semibold">Erreur de sauvegarde</span>}
        </div>
      </div>

      {/* Sélecteur flight */}
      {flightPlayers.length > 1 && (
        <div className="mb-5">
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
                    isActive ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'bg-white text-slate-600 border-slate-300 hover:border-[#185FA5]'
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

      {/* Bandeau joueur actif */}
      {activePlayer && (
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 mb-5">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-black text-slate-900">
              {activePlayer.id === playerId ? 'Ma scorecard' : `${activePlayer.first_name} ${activePlayer.surname}`}
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

      {activePlayer ? (
        <ScorecardTable holes={holes} player={activePlayer} scores={scores}
          setScores={handleSetScores} eventFormat={eventFormat} readOnly={false} />
      ) : (
        <div className="text-center py-12 text-[13px] text-slate-500 border border-dashed border-slate-200 rounded-xl">
          Aucun joueur dans ce flight
        </div>
      )}
    </div>
  )
}

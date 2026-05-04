'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ScorecardTable from '@/components/scorecards/ScorecardTable'
import Leaderboard from '@/components/scorecards/Leaderboard'
import { useGroupRole } from '@/lib/hooks/useGroupRole'
import { computePhcp } from '@/components/scorecards/scorecard-types'
import type { Hole, TeeInfo, Player, ScoreMap } from '@/components/scorecards/scorecard-types'

const supabase = createClient()

type EventOption = { id: string; title: string; starts_at: string }

// ─── EventPill ────────────────────────────────────────────────────────────────

function EventPill({ events, selectedId, onSelect }: {
  events: EventOption[]; selectedId: string; onSelect: (id: string) => void
}) {
  const selected = events.find(e => e.id === selectedId)
  const [open, setOpen] = useState(false)

  if (events.length === 0) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 bg-white/80 border border-white/60 rounded-full pl-3 pr-2.5 py-1.5 shadow-sm hover:bg-white transition-all"
        style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      >
        <span className="text-[12px] font-semibold text-slate-800 leading-none truncate max-w-[200px]">
          {selected?.title ?? '—'}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200/80 rounded-2xl shadow-xl py-2 z-50 overflow-hidden">
            <div className="px-4 pt-2 pb-2 border-b border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Changer d'événement</span>
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {events.map(e => {
                const isSelected = e.id === selectedId
                const past = new Date(e.starts_at) < new Date()
                return (
                  <button key={e.id} onClick={() => { onSelect(e.id); setOpen(false) }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/60' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-900 truncate">{e.title}</p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(e.starts_at).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {past && <span className="ml-1 text-slate-300">· passé</span>}
                      </p>
                    </div>
                    {isSelected && (
                      <svg width="13" height="13" viewBox="0 0 12 12" fill="none" className="text-[#185FA5] flex-shrink-0">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── View toggle ──────────────────────────────────────────────────────────────

type Tab = 'scorecards' | 'leaderboard'

// ─── Page ─────────────────────────────────────────────────────────────────────

function fallbackHoles(): Hole[] {
  return Array.from({ length: 18 }, (_, i) => ({
    hole_number: i + 1, par: [4,4,3,5,4,4,3,4,5][i % 9], stroke_index: i + 1,
  }))
}

function findDefaultTee(teesData: TeeInfo[], color: string, gender?: string): TeeInfo | undefined {
  const c = color.toLowerCase()
  const gw = gender === 'F' ? 'lad' : 'men'
  return (
    teesData.find(t => t.tee_name.toLowerCase().includes(c) && t.tee_name.toLowerCase().includes(gw)) ??
    teesData.find(t => t.tee_name.toLowerCase() === c) ??
    teesData.find(t => t.tee_name.toLowerCase().startsWith(c)) ??
    teesData.find(t => t.tee_name.toLowerCase().includes(c))
  )
}

export default function ResultsPage() {
  const params  = useParams()
  const groupId = params.id      as string
  const eventId = params.eventId as string
  const router  = useRouter()

  const { role, loading: roleLoading } = useGroupRole(groupId)
  const isOwner = role === 'owner'

  const [tab,            setTab]            = useState<Tab>('leaderboard')
  const [events,         setEvents]         = useState<EventOption[]>([])
  const [selectedId,     setSelectedId]     = useState(eventId)
  const [loading,        setLoading]        = useState(true)
  const [holes,          setHoles]          = useState<Hole[]>([])
  const [players,        setPlayers]        = useState<Player[]>([])
  const [scores,         setScores]         = useState<ScoreMap>({})
  const [scorecardId,    setScorecardId]    = useState<string | null>(null)
  const [eventFormat,    setEventFormat]    = useState<'stroke' | 'stableford'>('stableford')
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null)

  // Charger tous les events du groupe
  useEffect(() => {
    async function loadEvents() {
      const { data } = await supabase.from('events').select('id, title, starts_at')
        .eq('group_id', groupId).order('starts_at', { ascending: false })
      setEvents(data ?? [])
    }
    loadEvents()
  }, [groupId])

  // Charger scorecard quand selectedId change
  useEffect(() => {
    if (!selectedId) return
    loadScorecard(selectedId)
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadScorecard(evtId: string) {
    setLoading(true)
    try {
      const { data: event } = await supabase.from('events')
        .select('course_id, competition_format:competition_format_id(scoring_type)').eq('id', evtId).single()
      setEventFormat((event?.competition_format as any)?.scoring_type ?? 'stableford')

      let holesData: Hole[] = fallbackHoles()
      let teesData:  TeeInfo[] = []

      if (event?.course_id) {
        const { data: h } = await supabase.from('course_holes').select('hole_number, par, stroke_index')
          .eq('course_id', event.course_id).order('hole_number')
        if (h?.length) holesData = h
        const { data: t } = await supabase.from('course_tees').select('id, tee_name, par_total, course_rating, slope')
          .eq('course_id', event.course_id).order('tee_name')
        teesData = t ?? []
      }
      setHoles(holesData)

      const { data: existing } = await supabase.from('scorecards').select('id').eq('event_id', evtId).maybeSingle()
      const scId = existing?.id ?? null
      setScorecardId(scId)

      const { data: participants } = await supabase.from('event_participants')
        .select('player_id, tee_id, players(id, first_name, surname, whs, default_tee_color, gender)')
        .eq('event_id', evtId).order('created_at')

      const built: Player[] = (participants || []).map((ep: any) => {
        const p = ep.players
        let teeId = ep.tee_id ?? null
        let tee: TeeInfo | undefined = teesData.find(t => t.id === teeId)
        if (!teeId && p.default_tee_color) {
          const def = findDefaultTee(teesData, p.default_tee_color, p.gender)
          if (def) { teeId = def.id; tee = def }
        }
        return { id: p.id, first_name: p.first_name, surname: p.surname, whs: p.whs ?? 0, tee_id: teeId, tee, phcp: computePhcp(p.whs ?? 0, tee) }
      })
      setPlayers(built)
      if (built.length > 0) setActivePlayerId(built[0].id)

      if (scId && built.length > 0) {
        const { data: scoresData } = await supabase.from('scores').select('player_id, hole, strokes')
          .eq('scorecard_id', scId).eq('event_id', evtId).in('player_id', built.map(p => p.id))
        const map: ScoreMap = {}
        built.forEach(p => { map[p.id] = {} })
        scoresData?.forEach(s => { map[s.player_id][s.hole] = s.strokes })
        setScores(map)
      } else {
        setScores({})
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const activePlayer = players.find(p => p.id === activePlayerId) ?? null

  if (roleLoading) return (
    <div className="p-6 space-y-3 max-w-2xl">
      {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Results</h1>
          <p className="text-[13px] text-slate-600 mt-0.5">{players.length} joueurs · {eventFormat}</p>
        </div>
        <EventPill events={events} selectedId={selectedId} onSelect={id => { setSelectedId(id); router.replace(`/groups/${groupId}/events/${id}/results`) }} />
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6 w-fit">
        {([['leaderboard', '🏆 Leaderboard'], ['scorecards', '📋 Scorecards']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* ── LEADERBOARD ── */}
          {tab === 'leaderboard' && (
            scorecardId && players.length > 0 ? (
              <Leaderboard
                eventId={selectedId}
                scorecardId={scorecardId}
                players={players}
                holes={holes}
                eventFormat={eventFormat}
                isOwner={isOwner}
              />
            ) : (
              <div className="text-center py-16 text-slate-500 border border-dashed border-slate-200 rounded-xl">
                <div className="text-3xl mb-3">🏌️</div>
                <p className="text-[14px] font-semibold">Aucun score pour cet événement</p>
                <p className="text-[12px] mt-1 text-slate-400">Les scores apparaîtront ici une fois encodés</p>
              </div>
            )
          )}

          {/* ── SCORECARDS ── */}
          {tab === 'scorecards' && (
            players.length === 0 ? (
              <div className="text-center py-16 text-slate-500 border border-dashed border-slate-200 rounded-xl">
                <div className="text-3xl mb-3">📋</div>
                <p className="text-[14px] font-semibold">Aucun participant pour cet événement</p>
              </div>
            ) : (
              <>
                {/* Sélecteur joueur */}
                <div className="flex gap-2 items-center mb-5 flex-wrap">
                  {players.map(p => {
                    const initials = `${p.first_name?.[0] ?? ''}${p.surname?.[0] ?? ''}`.toUpperCase()
                    const isActive = p.id === activePlayerId
                    return (
                      <button key={p.id} onClick={() => setActivePlayerId(p.id)}
                        title={`${p.first_name} ${p.surname}`}
                        className={`w-11 h-11 rounded-full text-[12px] font-bold border-2 transition-all flex-shrink-0 ${isActive ? 'bg-[#185FA5] text-white border-[#185FA5] shadow-sm' : 'bg-white text-slate-600 border-slate-300 hover:border-[#185FA5]'}`}>
                        {initials}
                      </button>
                    )
                  })}
                </div>

                {/* Bandeau joueur */}
                {activePlayer && (
                  <div className="rounded-xl border border-white/60 shadow-sm p-4 mb-5"
                    style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
                    <p className="text-[14px] font-black text-slate-900">{activePlayer.first_name} {activePlayer.surname}</p>
                    <div className="flex gap-3 mt-0.5">
                      <span className="text-[12px] text-slate-500">Hcp <span className="font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded-lg text-[11px] ml-0.5">{activePlayer.whs}</span></span>
                      <span className="text-[12px] text-slate-500">Phcp <span className="font-bold text-slate-800 ml-0.5">{activePlayer.phcp}</span></span>
                      {activePlayer.tee && <span className="text-[12px] text-slate-500">Tee <span className="font-bold text-slate-800 ml-0.5">{activePlayer.tee.tee_name}</span></span>}
                    </div>
                  </div>
                )}

                {/* Scorecard (lecture seule) */}
                {activePlayer && (
                  <div className="rounded-xl border border-white/60 shadow-sm overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
                    <ScorecardTable
                      holes={holes}
                      player={activePlayer}
                      scores={scores}
                      setScores={() => {}}
                      eventFormat={eventFormat}
                      readOnly
                    />
                  </div>
                )}
              </>
            )
          )}
        </>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useFlights } from '@/lib/hooks/useFlights'
import { createClient } from '@/lib/supabase/client'
import { pairKey } from '@/lib/utils/pairs'
import { useGroupRole } from '@/lib/hooks/useGroupRole'
import { useTranslations, useLocale } from 'next-intl'
import Challenge4BBBTab from '@/components/flights/Challenge4BBBTab'


const supabase = createClient()

type HolesSection = 'out' | 'in' | null
type DragState = { playerId: string; playerName: string; fromFlightNo: number }
type EventRow = { id: string; title: string; starts_at: string }

function formatEventDate(dateStr: string, locale: string) {
  return new Date(dateStr).toLocaleDateString(locale, {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

function holesBadge(p: { holes_played?: number | null; holes_section?: HolesSection }) {
  if (!p.holes_played || p.holes_played === 18) return null
  const label = p.holes_section === 'out' ? '9F'
              : p.holes_section === 'in'  ? '9B'
              : '9T'
  const color = p.holes_section === 'in'  ? 'bg-orange-100 text-orange-700'
              : p.holes_section === 'out' ? 'bg-amber-100 text-amber-700'
              : 'bg-slate-100 text-slate-500'
  return <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${color}`}>{label}</span>
}

export default function FlightsPage() {
  const params  = useParams()
  const groupId = params.id as string
  const t       = useTranslations()
  const locale  = useLocale()

  const { role, loading: roleLoading } = useGroupRole(groupId)
  const isOwner = role === 'owner'

  const [events,        setEvents]        = useState<EventRow[]>([])
  const [activeEventId, setActiveEventId] = useState<string>(params.eventId as string)
  const [eventsLoading, setEventsLoading] = useState(true)
  const [activeTab,     setActiveTab]     = useState<'standard' | '4bbb'>('standard')

  useEffect(() => { loadEvents() }, [groupId])

  async function loadEvents() {
    setEventsLoading(true)
    const { data } = await supabase
      .from('events')
      .select('id, title, starts_at')
      .eq('group_id', groupId)
      .order('starts_at', { ascending: true })
    const evts = data ?? []
    setEvents(evts)
    if (evts.length) {
      const retained = localStorage.getItem(`golfgo-active-event-${groupId}`)
      const retainedExists = evts.find((e: { id: string }) => e.id === retained)
      if (retainedExists) {
        setActiveEventId(retainedExists.id)
      } else {
        const now = new Date()
        const upcoming = evts.find(e => new Date(e.starts_at) >= now)
        setActiveEventId(upcoming?.id ?? evts[evts.length - 1].id)
      }
    }
    setEventsLoading(false)
  }

  const { players, flights, setFlights, loading, loadData, generate, save, remove } = useFlights(activeEventId)

  useEffect(() => { if (activeEventId) loadData() }, [activeEventId])

 useEffect(() => {
  if (!groupId) return
  Promise.all([loadConstraints(), loadPastFlights(historyWindow)])
}, [groupId, activeEventId])

  const [flightSize,     setFlightSize]     = useState(4)
  const [balanceWHS,     setBalanceWHS]     = useState(true)
  const [iterations,     setIterations]     = useState(800)
  const [historyWindow,  setHistoryWindow]  = useState(180)
  const [holesMode,      setHolesMode]      = useState<'mixed' | 'separated'>('mixed')
  const [pastFlights,    setPastFlights]    = useState<any[]>([])
  const [forbiddenPairs, setForbiddenPairs] = useState<Set<string>>(new Set())
  const [preferredPairs, setPreferredPairs] = useState<Set<string>>(new Set())
  const [generating,     setGenerating]     = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [dragState,      setDragState]      = useState<DragState | null>(null)
  const [dragOverFlight, setDragOverFlight] = useState<number | null>(null)
  const [dragOverPlayer, setDragOverPlayer] = useState<string | null>(null)
  const [manualEdits,    setManualEdits]    = useState(false)
  const [adminToast,     setAdminToast]     = useState<string | null>(null)
  const [touchPos,       setTouchPos]       = useState<{ x: number; y: number } | null>(null)

  function showAdminToast() {
    setAdminToast(t('flights.adminOnly'))
    setTimeout(() => setAdminToast(null), 3000)
  }

  async function loadConstraints() {
    const { data } = await supabase.from('player_pair_constraints').select('*').eq('group_id', groupId)
    const forbidden = new Set<string>()
    const preferred = new Set<string>()
    for (const c of data ?? []) {
      const key = pairKey(c.player_a, c.player_b)
      if (c.constraint_type === 'forbidden') forbidden.add(key)
      if (c.constraint_type === 'preferred') preferred.add(key)
    }
    setForbiddenPairs(forbidden)
    setPreferredPairs(preferred)
  }

  async function loadPastFlights(historyWindowDays: number = 180) {
    if (historyWindowDays === 0) { setPastFlights([]); return }
    const since = new Date()
    since.setDate(since.getDate() - historyWindowDays)
    const { data: groupEvents } = await supabase
      .from('events')
      .select('id')
      .eq('group_id', groupId)
      .neq('id', activeEventId)
      .gte('starts_at', since.toISOString())
    const eventIds = (groupEvents ?? []).map((e: any) => e.id)
    if (!eventIds.length) { setPastFlights([]); return }
    const { data } = await supabase
      .from('flights')
      .select('id, created_at, flight_players(player_id, players(id, first_name, surname, whs))')
      .in('event_id', eventIds)
    setPastFlights((data ?? []).map((f: any) => ({
      date:    f.created_at,
      players: f.flight_players.map((fp: any) => fp.players),
    })))
  }

  useEffect(() => {
    if (groupId && activeEventId) loadPastFlights(historyWindow)
  }, [historyWindow])

const { players9front, players9back, players9, players18, has9holers } = useMemo(() => {
  const players9front = players.filter((p: any) => p.holes_played === 9 && p.holes_section === 'out')
  const players9back  = players.filter((p: any) => p.holes_played === 9 && p.holes_section === 'in')
  const players9      = players.filter((p: any) => p.holes_played === 9)
  const players18     = players.filter((p: any) => !p.holes_played || p.holes_played === 18)
  return { players9front, players9back, players9, players18, has9holers: players9.length > 0 }
}, [players])

  async function handleGenerate() {
    setGenerating(true)
    setManualEdits(false)
    try {
      const baseOpts = { flightSize, balanceWHS, iterations, historyWindowDays: historyWindow, pastFlights, forbiddenPairs, preferredPairs, debug: true }
      if (holesMode === 'mixed' || !has9holers) {
        await generate(baseOpts)
      } else {
        await generate({ ...baseOpts, overridePlayers: players18, flightNoOffset: 0, groupLabel: '18T' })
        if (players9front.length > 0) {
          await generate({ ...baseOpts, overridePlayers: players9front, flightSize: Math.min(flightSize, players9front.length), flightNoOffset: Math.ceil(players18.length / flightSize), groupLabel: '9F' })
        }
        if (players9back.length > 0) {
          await generate({ ...baseOpts, overridePlayers: players9back, flightSize: Math.min(flightSize, players9back.length), flightNoOffset: Math.ceil(players18.length / flightSize) + Math.ceil(players9front.length / flightSize), groupLabel: '9B' })
        }
      }
    } catch (err) { console.error(err) }
    finally { setGenerating(false) }
  }

  async function handleSave() {
    setSaving(true)
    try { await save() } finally { setSaving(false) }
  }

  function onDragStart(e: React.DragEvent, player: any, fromFlightNo: number) {
    e.dataTransfer.effectAllowed = 'move'
    setDragState({ playerId: player.id, playerName: `${player.first_name} ${player.surname}`, fromFlightNo })
  }
  function onDragEnd() { setDragState(null); setDragOverFlight(null); setDragOverPlayer(null) }
  function onDragOverFlight(e: React.DragEvent, flightNo: number) {
    e.preventDefault(); setDragOverFlight(flightNo); setDragOverPlayer(null)
  }
  function onDragOverPlayer(e: React.DragEvent, flightNo: number, targetPlayerId: string) {
    e.preventDefault(); e.stopPropagation(); setDragOverFlight(flightNo); setDragOverPlayer(targetPlayerId)
  }
  function onDropOnFlight(e: React.DragEvent, toFlightNo: number) {
    e.preventDefault()
    if (!dragState || dragState.fromFlightNo === toFlightNo) { onDragEnd(); return }
    setFlights((prev: any[]) => {
      const next = prev.map((f: any) => {
        const fps = Array.isArray(f.players) ? f.players : []
        if (f.flight_no === dragState.fromFlightNo) return { ...f, players: fps.filter((p: any) => p.id !== dragState.playerId) }
        if (f.flight_no === toFlightNo) {
          const moved = prev.find((ff: any) => ff.flight_no === dragState.fromFlightNo)?.players?.find((p: any) => p.id === dragState.playerId)
          return moved ? { ...f, players: [...fps, moved] } : f
        }
        return f
      })
      setManualEdits(true)
      return next
    })
    onDragEnd()
  }

  function onTouchStart(e: React.TouchEvent, player: any, fromFlightNo: number) {
  e.preventDefault()
    const touch = e.touches[0]
  setDragState({ playerId: player.id, playerName: `${player.first_name} ${player.surname}`, fromFlightNo })
  setTouchPos({ x: touch.clientX, y: touch.clientY })
}

function onTouchMove(e: React.TouchEvent) {
  e.preventDefault()
  const touch = e.touches[0]
  setTouchPos({ x: touch.clientX, y: touch.clientY })
  const el = document.elementFromPoint(touch.clientX, touch.clientY)
  const flightEl = el?.closest('[data-flight-no]')
  if (flightEl) {
    const flightNo = parseInt(flightEl.getAttribute('data-flight-no') ?? '0')
    setDragOverFlight(flightNo)
  } else {
    setDragOverFlight(null)
  }
}

function onTouchEnd(e: React.TouchEvent) {
  const touch = e.changedTouches[0]
  const el = document.elementFromPoint(touch.clientX, touch.clientY)
  const flightEl = el?.closest('[data-flight-no]')
  if (flightEl && dragState) {
    const toFlightNo = parseInt(flightEl.getAttribute('data-flight-no') ?? '0')
    if (toFlightNo && toFlightNo !== dragState.fromFlightNo) {
      setFlights((prev: any[]) => {
        const next = prev.map((f: any) => {
          const fps = Array.isArray(f.players) ? f.players : []
          if (f.flight_no === dragState.fromFlightNo) return { ...f, players: fps.filter((p: any) => p.id !== dragState.playerId) }
          if (f.flight_no === toFlightNo) {
            const moved = prev.find((ff: any) => ff.flight_no === dragState.fromFlightNo)?.players?.find((p: any) => p.id === dragState.playerId)
            return moved ? { ...f, players: [...fps, moved] } : f
          }
          return f
        })
        setManualEdits(true)
        return next
      })
    }
  }
  setTouchPos(null)
  onDragEnd()
}

const sortedFlights = useMemo(() => 
  [...flights].sort((a: any, b: any) => a.flight_no - b.flight_no)
, [flights])

const flightGroups = useMemo(() => 
  holesMode === 'separated' && has9holers
    ? [
        { label: t('holes.18'),   color: '#185FA5', bg: '#EBF3FC', flights: sortedFlights.filter((f: any) => f.groupLabel === '18T' || !f.groupLabel) },
        { label: t('holes.9out'), color: '#92400E', bg: '#FEF3C7', flights: sortedFlights.filter((f: any) => f.groupLabel === '9F') },
        { label: t('holes.9in'),  color: '#9a3412', bg: '#FFF7ED', flights: sortedFlights.filter((f: any) => f.groupLabel === '9B') },
      ].filter(g => g.flights.length > 0)
    : [{ label: null, color: null, bg: null, flights: sortedFlights }]
, [holesMode, has9holers, sortedFlights])

  if (loading || roleLoading || eventsLoading) return (
    <div className="p-6 space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-4xl">

      {adminToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-[13px] font-medium px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#EF9F27" strokeWidth="1.5"/>
            <path d="M8 5v3.5M8 11h.01" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {adminToast}
        </div>
      )}

      {/* ── Onglets ── */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-4">
        <button onClick={() => setActiveTab('standard')}
          className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
            activeTab === 'standard' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
          }`}>
          Flights
        </button>
        <button onClick={() => setActiveTab('4bbb')}
          className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
            activeTab === '4bbb' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
          }`}>
          Challenge 4BBB
        </button>
      </div>

      {/* ── Onglet 4BBB ── */}
      {activeTab === '4bbb' && (
        <Challenge4BBBTab groupId={groupId} isOwner={isOwner} />
      )}

      {/* ── Onglet Standard ── */}
      {activeTab === 'standard' && (
        <>
          {/* Sélecteur d'événement */}
          {events.length > 0 && (
            <div className="mb-4">
              <div className="relative">
                <select
                  value={activeEventId}
                  onChange={e => {
                    setActiveEventId(e.target.value)
                    localStorage.setItem(`golfgo-active-event-${groupId}`, e.target.value)
                    setManualEdits(false)
                  }}
                  className="w-full appearance-none bg-white/80 backdrop-blur border border-white/60 rounded-2xl px-5 py-3.5 pr-10 text-[14px] font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]/20 cursor-pointer"
                  style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
                  {events.map(evt => (
                    <option key={evt.id} value={evt.id}>
                      {evt.title} — {formatEventDate(evt.starts_at, locale)}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Paramètres */}
          <div className={`rounded-2xl border border-white/60 shadow-sm mb-6 overflow-hidden ${!isOwner ? 'opacity-80' : ''}`}
            style={{ background: 'rgba(255, 255, 255, 0.80)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>

            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.14em]">{t('flights.parameters')}</span>
              <div className="flex items-center gap-2">
                <a href={`/groups/${groupId}/events/${activeEventId}/flights/history`}
                  className="text-[11px] font-medium text-slate-800 hover:text-[#185FA5] transition-colors flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M1 5h14M5 1v4M11 1v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  {t('flights.matrix')}
                </a>
                <span className="text-slate-200 text-[10px]">·</span>
                <a href={`/groups/${groupId}/constraints`}
                  className="text-[11px] font-medium text-slate-800 hover:text-[#185FA5] transition-colors">
                  {t('flights.constraints')}
                </a>
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="flex flex-wrap gap-x-6 gap-y-4 items-end mb-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t('flights.flightSize')}</label>
                  <div className="flex gap-1 p-0.5 bg-slate-100 rounded-xl">
                    {[2, 3, 4].map(n => (
                      <button key={n} onClick={() => isOwner ? setFlightSize(n) : showAdminToast()}
                        className={`w-9 h-8 rounded-lg text-[13px] font-bold transition-all ${
                          flightSize === n ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                        } ${!isOwner ? 'cursor-not-allowed' : ''}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t('flights.history')}</label>
                  <select value={historyWindow} onChange={e => isOwner ? setHistoryWindow(Number(e.target.value)) : showAdminToast()}
                    disabled={!isOwner}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-[13px] bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/20 disabled:cursor-not-allowed">
                    <option value={0}>{t('flights.historyOptions.none')}</option>
                    <option value={30}>{t('flights.historyOptions.30d')}</option>
                    <option value={90}>{t('flights.historyOptions.3m')}</option>
                    <option value={180}>{t('flights.historyOptions.6m')}</option>
                    <option value={365}>{t('flights.historyOptions.1y')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t('flights.iterations')}</label>
                  <input type="number" value={iterations} onChange={e => isOwner ? setIterations(Number(e.target.value)) : showAdminToast()}
                    disabled={!isOwner}
                    className="border border-slate-200 rounded-xl px-3 py-2 text-[13px] bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/20 w-24 disabled:cursor-not-allowed" />
                </div>

                <label className="flex items-center gap-2 cursor-pointer mb-1">
                  <div onClick={() => isOwner ? setBalanceWHS(v => !v) : showAdminToast()}
                    className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors ${balanceWHS ? 'bg-[#185FA5]' : 'bg-slate-200'} ${!isOwner ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${balanceWHS ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-[13px] font-medium text-slate-700">{t('flights.balanceWHS')}</span>
                </label>
              </div>

              {has9holers && (
                <div className="flex items-center gap-4 py-3 px-4 rounded-xl mb-4"
                  style={{ background: 'rgba(254,243,199,0.6)', border: '1px solid rgba(217,119,6,0.2)' }}>
                  <div>
                    <p className="text-[12px] font-bold text-amber-800">
                      {t('flights.holes9Warning', { count: players9.length })}
                      {players9front.length > 0 && <span className="ml-1 font-normal text-amber-700">({players9front.length} 9F{players9back.length > 0 ? ` · ${players9back.length} 9B` : ''})</span>}
                    </p>
                    <p className="text-[11px] text-amber-600 mt-0.5">{t('flights.holes9Question')}</p>
                  </div>
                  <div className="ml-auto flex gap-1 p-0.5 bg-amber-100 rounded-xl">
                    <button onClick={() => isOwner ? setHolesMode('mixed') : showAdminToast()}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                        holesMode === 'mixed' ? 'bg-white text-slate-800 shadow-sm' : 'text-amber-700 hover:text-amber-900'
                      } ${!isOwner ? 'cursor-not-allowed' : ''}`}>
                      {t('flights.mixed')}
                    </button>
                    <button onClick={() => isOwner ? setHolesMode('separated') : showAdminToast()}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                        holesMode === 'separated' ? 'bg-white text-slate-800 shadow-sm' : 'text-amber-700 hover:text-amber-900'
                      } ${!isOwner ? 'cursor-not-allowed' : ''}`}>
                      {t('flights.separated')}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button onClick={() => isOwner ? remove() : showAdminToast()}
                  className={`text-[12px] font-semibold px-3 py-2 rounded-xl transition-colors ${
                    isOwner ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-100' : 'text-slate-300 cursor-not-allowed'}`}>
                  {t('flights.clear')}
                </button>
                <button onClick={() => isOwner ? handleSave() : showAdminToast()} disabled={saving || flights.length === 0}
                  className={`text-[12px] font-semibold px-3 py-2 rounded-xl border transition-colors disabled:opacity-40 ${
                    isOwner ? 'border-slate-200 text-slate-700 hover:bg-slate-50' : 'border-slate-100 text-slate-300 cursor-not-allowed'}`}>
                  {saving ? t('flights.saving') : t('flights.save')}
                </button>
                <button onClick={() => isOwner ? handleGenerate() : showAdminToast()} disabled={generating}
                  className={`text-[12px] font-semibold px-5 py-2 rounded-xl text-white disabled:opacity-60 transition-colors shadow-sm ${
                    isOwner ? 'bg-[#185FA5] hover:bg-[#0C447C]' : 'bg-slate-300 cursor-not-allowed'}`}>
                  {generating ? t('flights.generating') : t('flights.generate')}
                </button>
              </div>
            </div>
          </div>

          {/* Joueurs confirmés */}
          <div className="mb-6">
            <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-3">
              {t('flights.confirmedPlayers', { count: players.length })}
              {players9front.length > 0 && <span className="ml-2 text-amber-700 normal-case font-semibold text-[10px]">· {players9front.length} 9F</span>}
              {players9back.length > 0  && <span className="ml-1 text-orange-700 normal-case font-semibold text-[10px]">· {players9back.length} 9B</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {players.length === 0 && <p className="text-[13px] text-slate-500">{t('flights.noConfirmed')}</p>}
              {players.map((p: any) => (
                <div key={p.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
                  <span className="text-[13px] font-medium text-slate-800">{p.first_name} {p.surname}</span>
                  {p.whs !== null && (
                    <span className="text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-lg">{p.whs}</span>
                  )}
                  {holesBadge(p)}
                </div>
              ))}
            </div>
          </div>

          {/* Flights */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {t('flights.flightsTitle')} {flights.length > 0 && `(${flights.length})`}
              </p>
              {manualEdits && flights.length > 0 && (
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                  {t('flights.unsaved')}
                </span>
              )}
            </div>

            {isOwner && flights.length > 0 && (
              <p className="text-[11px] text-slate-400 mb-3 flex items-center gap-1.5">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="5 9 2 12 5 15"/><polyline points="19 9 22 12 19 15"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                </svg>
                {t('flights.dragHint')}
              </p>
            )}

            {flights.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl text-slate-400">
                <p className="text-[14px] font-medium">{t('flights.noFlights')}</p>
                {isOwner && <p className="text-[12px] mt-1">{t('flights.generateHint')}</p>}
              </div>
            ) : (
              <div className="space-y-6">
                {flightGroups.map(group => (
                  <div key={group.label ?? 'all'}>
                    {group.label && (
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                          style={{ background: group.bg ?? '#EBF3FC', color: group.color ?? '#185FA5' }}>
                          {group.label}
                        </span>
                        <div className="flex-1 h-px bg-slate-100" />
                        <span className="text-[11px] text-slate-400">{group.flights.length} flight{group.flights.length > 1 ? 's' : ''}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {group.flights.map((flight: any) => {
                        const flightPlayers = Array.isArray(flight.players) ? flight.players : []
                        const whsValues     = flightPlayers.filter((p: any) => p.whs !== null)
                        const avgWHS        = whsValues.length > 0
                          ? (whsValues.reduce((s: number, p: any) => s + (p.whs ?? 0), 0) / whsValues.length).toFixed(1)
                          : null
                        const isDragTarget  = dragOverFlight === flight.flight_no && dragState?.fromFlightNo !== flight.flight_no

                        return (
                         <div key={flight.flight_no}
                          data-flight-no={flight.flight_no}
                          style={{ userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
                          className={`bg-white border rounded-xl overflow-hidden transition-all ${    
                              isDragTarget ? 'border-[#185FA5] shadow-[0_0_0_2px_rgba(24,95,165,0.15)] scale-[1.01]' : 'border-slate-200'}`}
                            onDragOver={e => onDragOverFlight(e, flight.flight_no)}
                            onDrop={e => isOwner ? onDropOnFlight(e, flight.flight_no) : undefined}
                            onDragLeave={() => { setDragOverFlight(null); setDragOverPlayer(null) }}>

                            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                              <span className="text-[13px] font-bold text-slate-800">Flight {flight.flight_no}</span>
                              <div className="flex items-center gap-2">
                                {avgWHS && <span className="text-[11px] text-slate-400">{t('flights.avgWHS')} {avgWHS}</span>}
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                  flightPlayers.length === flightSize ? 'bg-[#EAF3DE] text-[#3B6D11]' : 'bg-amber-50 text-amber-600'}`}>
                                  {flightPlayers.length}/{flightSize}
                                </span>
                              </div>
                            </div>

                            {isDragTarget && (
                              <div className="mx-3 mt-2 h-8 border-2 border-dashed border-[#185FA5]/40 rounded-lg bg-[#EBF3FC]/50 flex items-center justify-center">
                                <span className="text-[11px] font-semibold text-[#185FA5]/70">{t('flights.dropHere')}</span>
                              </div>
                            )}

                            <div className="p-3 space-y-1">
                              {flightPlayers.map((p: any, i: number) => {
                                const isDragging   = dragState?.playerId === p.id
                                const isDropTarget = dragOverPlayer === p.id && dragState?.fromFlightNo !== flight.flight_no
                                return (
                       <div key={p.id}
                          draggable={isOwner}
                          onDragStart={e => onDragStart(e, p, flight.flight_no)}
                          onDragEnd={onDragEnd}
                          onDragOver={e => onDragOverPlayer(e, flight.flight_no, p.id)}
                          onTouchStart={e => isOwner ? onTouchStart(e, p, flight.flight_no) : undefined}
                          onTouchMove={e => isOwner ? onTouchMove(e) : undefined}
                          onTouchEnd={e => isOwner ? onTouchEnd(e) : undefined}
                          style={isOwner ? { touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' } : undefined}
                          className={`flex items-center justify-between rounded-lg px-2 py-1.5 transition-all ${
                                      isDragging     ? 'opacity-40 bg-slate-100'
                                      : isDropTarget ? 'bg-[#EBF3FC] border border-[#B5D4F4]'
                                      : 'hover:bg-slate-50'
                                    } ${isOwner ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                                    <div className="flex items-center gap-2">
                                      {isOwner && (
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-slate-300 flex-shrink-0">
                                          <circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/>
                                          <circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>
                                          <circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/>
                                        </svg>
                                      )}
                                      <span className="text-[11px] text-slate-300 w-3">{i + 1}</span>
                                      <span className="text-[13px] font-medium text-slate-800">{p.first_name} {p.surname}</span>
                                      {holesBadge(p)}
                                    </div>
                                    {p.whs !== null && (
                                      <span className="text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-lg">{p.whs}</span>
                                    )}
                                  </div>
                                )
                              })}
                              {flightPlayers.length === 0 && (
                                <div className="text-center py-4 text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-lg">
                                  {t('flights.emptyFlight')}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {dragState && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
              <div className="flex items-center gap-2 bg-slate-900 text-white text-[12px] font-semibold px-4 py-2.5 rounded-xl shadow-xl">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="5 9 2 12 5 15"/><polyline points="19 9 22 12 19 15"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                </svg>
                {dragState.playerName}
                <span className="text-white/50 text-[11px]">Flight {dragState.fromFlightNo} →</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

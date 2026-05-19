'use client'

import { useEffect, useState, Fragment } from 'react'
import { use4BBB } from '@/lib/hooks/use4BBB'
import { useTranslations, useLocale } from 'next-intl'
import type { RoundResult, Flight4BBB, Player4BBB } from '@/lib/golf/flights/generate4BBB'

const BENCH_FLIGHT_NO = 0

type DragState4BBB = {
  playerId:     string
  playerName:   string
  fromEventId:  string
  fromFlightNo: number
}

function formatDate(d: string, locale: string) {
  return new Date(d).toLocaleDateString(locale, {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  })
}

function WhsTag({ whs }: { whs: number | null }) {
  if (whs === null || whs === undefined) return null
  return (
    <span className="text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-lg font-mono">
      {Number(whs).toFixed(1)}
    </span>
  )
}

// ── Planning global ──────────────────────────────────────────────────────────
function GlobalPlanning({
  events, rounds, locale, avg,
}: {
  events: { eventId: string; title: string; starts_at: string }[]
  rounds: RoundResult[]
  locale: string
  avg: string
}) {
  const roundMap = new Map(rounds.map(r => [r.eventId, r]))

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="text-[12px] border-collapse min-w-full">
        <thead>
          <tr>
            <td className="px-3 py-2 border border-slate-100 text-slate-400 font-semibold w-28"></td>
            {events.map(ev => (
              <td key={ev.eventId} className="px-3 py-2 border border-slate-100 text-center min-w-[140px]">
                <div className="text-[11px] text-slate-400 font-medium">{ev.title}</div>
                <div className="text-[11px] text-slate-500 font-semibold">{formatDate(ev.starts_at, locale)}</div>
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1].map(flightIdx => (
            <Fragment key={flightIdx}>
              {[0, 1].map(playerIdx => (
                <tr key={`${flightIdx}-${playerIdx}`} className={playerIdx === 0 ? 'border-t-2 border-slate-200' : ''}>
                  {playerIdx === 0 && (
                    <td rowSpan={3}
                      className="px-3 py-2 border border-slate-100 text-center font-bold text-[11px] text-[#185FA5] bg-[#EBF3FC]/50">
                      Flight {flightIdx + 1}
                    </td>
                  )}
                  {events.map(ev => {
                    const round  = roundMap.get(ev.eventId)
                    const flight = round?.flights[flightIdx]
                    const player = flight?.players[playerIdx]
                    return (
                      <td key={ev.eventId} className="px-3 py-1.5 border border-slate-100">
                        {player ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-slate-800">{player.first_name} {player.surname}</span>
                            <span className="text-[11px] text-slate-400 font-mono flex-shrink-0">
                              {player.whs !== null ? Number(player.whs).toFixed(1) : '—'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr>
                {events.map(ev => {
                  const round  = roundMap.get(ev.eventId)
                  const flight = round?.flights[flightIdx]
                  return (
                    <td key={ev.eventId} className="px-3 py-1 border border-slate-100 bg-slate-50/60">
                      {flight ? (
                        <span className="text-[11px] font-bold text-[#185FA5]">{avg} {flight.avgWhs.toFixed(2)}</span>
                      ) : (
                        <span className="text-slate-300 text-[11px]">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Carte d'un flight ────────────────────────────────────────────────────────
function FlightCard({
  flight, flightSize, eventId, isOwner,
  dragState, dragOverFlight, avg, dropHere,
  onDragStart, onDragEnd, onDragOver, onDrop, onDragLeave,
}: {
  flight:         Flight4BBB
  flightSize:     number
  eventId:        string
  isOwner:        boolean
  dragState:      DragState4BBB | null
  dragOverFlight: { eventId: string; flightNo: number } | null
  avg:            string
  dropHere:       string
  onDragStart:    (p: Player4BBB, flightNo: number) => void
  onDragEnd:      () => void
  onDragOver:     (e: React.DragEvent, flightNo: number) => void
  onDrop:         (e: React.DragEvent, flightNo: number) => void
  onDragLeave:    () => void
}) {
  const isDragTarget =
    dragOverFlight?.eventId === eventId &&
    dragOverFlight?.flightNo === flight.flight_no &&
    dragState?.fromFlightNo !== flight.flight_no

  return (
    <div
      className={`bg-white border rounded-xl overflow-hidden transition-all ${
        isDragTarget
          ? 'border-[#185FA5] shadow-[0_0_0_2px_rgba(24,95,165,0.15)] scale-[1.01]'
          : 'border-slate-200'
      }`}
      onDragOver={e => onDragOver(e, flight.flight_no)}
      onDrop={e => onDrop(e, flight.flight_no)}
      onDragLeave={onDragLeave}>

      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <span className="text-[13px] font-bold text-slate-800">Flight {flight.flight_no}</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400">{avg} {flight.avgWhs.toFixed(1)}</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            flight.players.length === flightSize ? 'bg-[#EAF3DE] text-[#3B6D11]' : 'bg-amber-50 text-amber-600'
          }`}>
            {flight.players.length}/{flightSize}
          </span>
        </div>
      </div>

      {isDragTarget && (
        <div className="mx-3 mt-2 h-8 border-2 border-dashed border-[#185FA5]/40 rounded-lg bg-[#EBF3FC]/50 flex items-center justify-center">
          <span className="text-[11px] font-semibold text-[#185FA5]/70">{dropHere}</span>
        </div>
      )}

      <div className="p-3 space-y-1">
        {flight.players.map((p, i) => {
          const isDragging = dragState?.playerId === p.id && dragState?.fromEventId === eventId
          return (
            <div key={p.id}
              draggable={isOwner}
              onDragStart={() => onDragStart(p, flight.flight_no)}
              onDragEnd={onDragEnd}
              className={`flex items-center justify-between rounded-lg px-2 py-1.5 transition-all ${
                isDragging ? 'opacity-40 bg-slate-100' : 'hover:bg-slate-50'
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
              </div>
              <WhsTag whs={p.whs} />
            </div>
          )
        })}
        {flight.players.length === 0 && (
          <div className="text-center py-4 text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-lg">
            {dropHere}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Bench ────────────────────────────────────────────────────────────────────
function BenchArea({
  bench, eventId, isOwner,
  dragState, isDragTarget,
  benchLabel, benchDropLabel,
  onDragStart, onDragEnd, onDragOver, onDrop, onDragLeave,
}: {
  bench:         Player4BBB[]
  eventId:       string
  isOwner:       boolean
  dragState:     DragState4BBB | null
  isDragTarget:  boolean
  benchLabel:    string
  benchDropLabel: string
  onDragStart:   (p: Player4BBB) => void
  onDragEnd:     () => void
  onDragOver:    (e: React.DragEvent) => void
  onDrop:        (e: React.DragEvent) => void
  onDragLeave:   () => void
}) {
  if (!bench.length && !isDragTarget) return null

  return (
    <div
      className={`mt-3 rounded-xl border transition-all ${
        isDragTarget ? 'border-slate-400 bg-slate-50 shadow-sm' : 'border-dashed border-slate-200'
      } p-3`}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
        {benchLabel} {isDragTarget && `— ${benchDropLabel}`}
      </p>
      <div className="flex flex-wrap gap-2">
        {bench.map(p => {
          const isDragging = dragState?.playerId === p.id && dragState?.fromEventId === eventId
          return (
            <div key={p.id}
              draggable={isOwner}
              onDragStart={() => onDragStart(p)}
              onDragEnd={onDragEnd}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 border transition-all ${
                isDragging
                  ? 'opacity-40 bg-slate-100 border-slate-200'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              } ${isOwner ? 'cursor-grab active:cursor-grabbing' : ''}`}>
              {isOwner && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-slate-300 flex-shrink-0">
                  <circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/>
                  <circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>
                  <circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/>
                </svg>
              )}
              <span className="text-[12px] font-medium text-slate-600">{p.first_name} {p.surname}</span>
              <WhsTag whs={p.whs} />
            </div>
          )
        })}
        {bench.length === 0 && isDragTarget && (
          <div className="text-[11px] text-slate-400 italic">{benchDropLabel}</div>
        )}
      </div>
    </div>
  )
}

// ── Composant principal ──────────────────────────────────────────────────────
export default function Challenge4BBBTab({
  groupId,
  isOwner,
}: {
  groupId: string
  isOwner: boolean
}) {
  const locale = useLocale()
  const t      = useTranslations('challenge4bbb')

  const {
    events, rounds, setRounds,
    loading, saving, generated,
    loadEvents, generate, save, loadSaved,
  } = use4BBB(groupId)

  const [historyWindow,  setHistoryWindow]  = useState(180)
  const [iterations,     setIterations]     = useState(500)
  const [generating,     setGenerating]     = useState(false)
  const [manualEdits,    setManualEdits]    = useState(false)
  const [view,           setView]           = useState<'byEvent' | 'global'>('byEvent')
  const [dragState,      setDragState]      = useState<DragState4BBB | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<{ eventId: string; flightNo: number } | null>(null)

  useEffect(() => { loadEvents(historyWindow) }, [groupId])
  useEffect(() => { if (events.length) loadSaved() }, [events])

  async function handleLoadEvents() { await loadEvents(historyWindow) }

  async function handleGenerate() {
    setGenerating(true)
    setManualEdits(false)
    try { await generate({ iterations }) }
    finally { setGenerating(false) }
  }

  async function handleSave() {
    await save()
    setManualEdits(false)
  }

  // ── Drag handlers ────────────────────────────────────────────────────────
  function onDragStartFlight(eventId: string, player: Player4BBB, flightNo: number) {
    setDragState({ playerId: player.id, playerName: `${player.first_name} ${player.surname}`, fromEventId: eventId, fromFlightNo: flightNo })
  }

  function onDragStartBench(eventId: string, player: Player4BBB) {
    setDragState({ playerId: player.id, playerName: `${player.first_name} ${player.surname}`, fromEventId: eventId, fromFlightNo: BENCH_FLIGHT_NO })
  }

  function onDragEnd() { setDragState(null); setDragOverTarget(null) }

  function onDragOverFlight(e: React.DragEvent, eventId: string, flightNo: number) {
    e.preventDefault()
    setDragOverTarget({ eventId, flightNo })
  }

  function onDragOverBench(e: React.DragEvent, eventId: string) {
    e.preventDefault()
    setDragOverTarget({ eventId, flightNo: BENCH_FLIGHT_NO })
  }

  function recalcAvg(flight: Flight4BBB): Flight4BBB {
    const avg = flight.players.length
      ? flight.players.reduce((s, p) => s + (p.whs ?? 0), 0) / flight.players.length
      : 0
    return { ...flight, avgWhs: avg }
  }

  function onDropFlight(e: React.DragEvent, eventId: string, toFlightNo: number) {
    e.preventDefault()
    if (!dragState || dragState.fromEventId !== eventId) { onDragEnd(); return }
    if (dragState.fromFlightNo === toFlightNo) { onDragEnd(); return }

    setRounds(prev => prev.map(round => {
      if (round.eventId !== eventId) return round

      const ev = events.find(e => e.eventId === eventId)
      const allPlayers = ev?.going ?? []
      const fromFlight = dragState.fromFlightNo === BENCH_FLIGHT_NO
        ? null
        : round.flights.find(f => f.flight_no === dragState.fromFlightNo)

      const player = allPlayers.find(p => p.id === dragState.playerId)
        ?? fromFlight?.players.find(p => p.id === dragState.playerId)
      if (!player) return round

      const toFlight = round.flights.find(f => f.flight_no === toFlightNo)
      if (!toFlight) return round

      let ejected: Player4BBB | null = null
      if (toFlight.players.length >= 2) {
        ejected = toFlight.players[toFlight.players.length - 1]
      }

      const newFlights = round.flights.map(f => {
        if (f.flight_no === dragState.fromFlightNo) {
          const updated = { ...f, players: f.players.filter(p => p.id !== dragState.playerId) }
          if (ejected && f.flight_no === dragState.fromFlightNo) {
            updated.players = [...updated.players, ejected]
          }
          return recalcAvg(updated)
        }
        if (f.flight_no === toFlightNo) {
          const withoutEjected = ejected ? f.players.filter(p => p.id !== ejected!.id) : f.players
          const updated = { ...f, players: [...withoutEjected.filter(p => p.id !== dragState.playerId), player] }
          return recalcAvg(updated)
        }
        return f
      })

      return { ...round, flights: newFlights }
    }))

    setManualEdits(true)
    onDragEnd()
  }

  function onDropBench(e: React.DragEvent, eventId: string) {
    e.preventDefault()
    if (!dragState || dragState.fromEventId !== eventId) { onDragEnd(); return }
    if (dragState.fromFlightNo === BENCH_FLIGHT_NO) { onDragEnd(); return }

    setRounds(prev => prev.map(round => {
      if (round.eventId !== eventId) return round
      return {
        ...round,
        flights: round.flights.map(f => {
          if (f.flight_no !== dragState.fromFlightNo) return f
          return recalcAvg({ ...f, players: f.players.filter(p => p.id !== dragState.playerId) })
        }),
      }
    }))

    setManualEdits(true)
    onDragEnd()
  }

  // ── Stats participation ──────────────────────────────────────────────────
  const participationStats = (() => {
    const stats = new Map<string, { name: string; count: number; going: number }>()
    for (const ev of events) {
      for (const p of ev.going) {
        if (!stats.has(p.id)) stats.set(p.id, { name: `${p.first_name} ${p.surname}`, count: 0, going: 0 })
        stats.get(p.id)!.going++
      }
    }
    for (const round of rounds) {
      for (const flight of round.flights) {
        for (const p of flight.players) {
          if (stats.has(p.id)) stats.get(p.id)!.count++
        }
      }
    }
    return [...stats.entries()].sort((a, b) => b[1].count - a[1].count)
  })()

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="space-y-6">

      {/* ── Paramètres ── */}
      <div className="rounded-2xl border border-white/60 shadow-sm overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>

        <div className="px-5 pt-4 pb-3 border-b border-slate-100">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.14em]">
            {t('parameters')}
          </span>
        </div>

        <div className="px-5 py-4 flex flex-wrap gap-x-6 gap-y-4 items-end">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t('period')}</label>
            <select value={historyWindow} onChange={e => setHistoryWindow(Number(e.target.value))}
              disabled={!isOwner}
              className="border border-slate-200 rounded-xl px-3 py-2 text-[13px] bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/20">
              <option value={30}>30 jours</option>
              <option value={90}>3 mois</option>
              <option value={180}>6 mois</option>
              <option value={365}>1 an</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t('iterations')}</label>
            <input type="number" value={iterations} onChange={e => setIterations(Number(e.target.value))}
              disabled={!isOwner}
              className="border border-slate-200 rounded-xl px-3 py-2 text-[13px] bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/20 w-24" />
          </div>

          <button onClick={handleLoadEvents} disabled={!isOwner}
            className="text-[12px] font-semibold px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
            {t('refresh')}
          </button>

          <div className="flex items-center gap-2 ml-auto">
            {manualEdits && (
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                {t('modified')}
              </span>
            )}
            {generated && (
              <button onClick={handleSave} disabled={saving || !isOwner}
                className="text-[12px] font-semibold px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                {saving ? t('saving') : t('save')}
              </button>
            )}
            <button onClick={handleGenerate} disabled={generating || !isOwner || events.length === 0}
              className="text-[12px] font-semibold px-5 py-2 rounded-xl text-white bg-[#185FA5] hover:bg-[#0C447C] disabled:opacity-50 transition-colors shadow-sm">
              {generating ? t('generating') : t('generate')}
            </button>
          </div>
        </div>

        {events.length > 0 && (
          <div className="px-5 pb-4">
            <p className="text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">{t('eventsCount', { count: events.length })}</span>
              {' · '}
              <span className="font-semibold text-slate-700">
                {t('playersCount', { count: [...new Set(events.flatMap(e => e.going.map(p => p.id)))].length })}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* ── Vue ── */}
      {generated && rounds.length > 0 && (
        <>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
            {([
              { key: 'byEvent', label: t('viewByEvent') },
              { key: 'global',  label: t('viewGlobal') },
            ] as const).map(tab => (
              <button key={tab.key} onClick={() => setView(tab.key)}
                className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                  view === tab.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Vue par event ── */}
          {view === 'byEvent' && (
            <div className="space-y-8">
              {rounds.map(round => {
                const ev = events.find(e => e.eventId === round.eventId)
                if (!ev) return null

                const selectedIds = new Set(round.flights.flatMap(f => f.players.map(p => p.id)))
                const bench = ev.going.filter(p => !selectedIds.has(p.id))

                const isBenchDragTarget =
                  dragOverTarget?.eventId === round.eventId &&
                  dragOverTarget?.flightNo === BENCH_FLIGHT_NO &&
                  dragState?.fromFlightNo !== BENCH_FLIGHT_NO

                return (
                  <div key={round.eventId}>
                    <div className="mb-3">
                      <p className="text-[13px] font-bold text-slate-800">{ev.title}</p>
                      <p className="text-[11px] text-slate-400">
                        {formatDate(ev.starts_at, locale)} · {t('registered', { count: ev.going.length })}
                      </p>
                    </div>

                    {isOwner && (
                      <p className="text-[11px] text-slate-400 mb-2 flex items-center gap-1.5">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="5 9 2 12 5 15"/><polyline points="19 9 22 12 19 15"/>
                          <line x1="2" y1="12" x2="22" y2="12"/>
                        </svg>
                        {t('dragHint')}
                      </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {round.flights.map(flight => (
                        <FlightCard
                          key={flight.flight_no}
                          flight={flight}
                          flightSize={2}
                          eventId={round.eventId}
                          isOwner={isOwner}
                          dragState={dragState}
                          dragOverFlight={dragOverTarget}
                          avg={t('avg')}
                          dropHere={t('dropHere')}
                          onDragStart={(p, flightNo) => onDragStartFlight(round.eventId, p, flightNo)}
                          onDragEnd={onDragEnd}
                          onDragOver={(e, flightNo) => onDragOverFlight(e, round.eventId, flightNo)}
                          onDrop={(e, flightNo) => onDropFlight(e, round.eventId, flightNo)}
                          onDragLeave={() => setDragOverTarget(null)}
                        />
                      ))}
                    </div>

                    <BenchArea
                      bench={bench}
                      eventId={round.eventId}
                      isOwner={isOwner}
                      dragState={dragState}
                      isDragTarget={isBenchDragTarget}
                      benchLabel={t('bench')}
                      benchDropLabel={t('benchDrop')}
                      onDragStart={p => onDragStartBench(round.eventId, p)}
                      onDragEnd={onDragEnd}
                      onDragOver={e => onDragOverBench(e, round.eventId)}
                      onDrop={e => onDropBench(e, round.eventId)}
                      onDragLeave={() => setDragOverTarget(null)}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Planning global ── */}
          {view === 'global' && (
            <div className="space-y-6">
              <GlobalPlanning events={events} rounds={rounds} locale={locale} avg={t('avg')} />

              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{t('participations')}</p>
                </div>
                <div className="p-4 flex flex-wrap gap-2">
                  {participationStats.map(([id, stat]) => (
                    <div key={id} className="flex items-center gap-2 border border-slate-100 rounded-lg px-3 py-1.5">
                      <span className="text-[13px] font-medium text-slate-800">{stat.name}</span>
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                        stat.count >= 2
                          ? 'bg-[#EAF3DE] text-[#3B6D11]'
                          : stat.going === 1
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-amber-50 text-amber-600'
                      }`}>
                        {stat.count}/{stat.going}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-3 flex gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#3B6D11] inline-block"/>{t('stat2plus')}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>{t('statLess2')}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block"/>{t('stat1event')}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {events.length === 0 && !loading && (
        <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl text-slate-400">
          <p className="text-[14px] font-medium">{t('noEvents')}</p>
          <p className="text-[12px] mt-1">{t('noEventsHint')}</p>
        </div>
      )}

      {dragState && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="flex items-center gap-2 bg-slate-900 text-white text-[12px] font-semibold px-4 py-2.5 rounded-xl shadow-xl">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="5 9 2 12 5 15"/><polyline points="19 9 22 12 19 15"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
            </svg>
            {dragState.playerName}
            {dragState.fromFlightNo === BENCH_FLIGHT_NO
              ? <span className="text-white/50 text-[11px]">{t('fromBench')}</span>
              : <span className="text-white/50 text-[11px]">{t('fromFlight', { no: dragState.fromFlightNo })}</span>
            }
          </div>
        </div>
      )}
    </div>
  )
}

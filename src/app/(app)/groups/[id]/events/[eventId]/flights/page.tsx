'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useFlights } from '@/lib/hooks/useFlights'
import { createClient } from '@/lib/supabase/client'
import { pairKey } from '@/lib/utils/pairs'
import { useGroupRole } from '@/lib/hooks/useGroupRole'

const supabase = createClient()

const selectClass = "border border-slate-200 rounded-xl px-3 py-2 text-[13px] bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5]"

type HolesMode = 'mixed' | 'separated'

type DragState = {
  playerId:     string
  playerName:   string
  fromFlightNo: number
  group?:       '18' | '9'
}

export default function FlightsPage() {
  const params  = useParams()
  const groupId = params.id      as string
  const eventId = params.eventId as string

  const { role, loading: roleLoading } = useGroupRole(groupId)
  const isOwner = role === 'owner'

  const { players, flights, setFlights, loading, loadData, generate, save, remove } = useFlights(eventId)

  const [flightSize,     setFlightSize]     = useState(4)
  const [balanceWHS,     setBalanceWHS]     = useState(true)
  const [iterations,     setIterations]     = useState(800)
  const [historyWindow,  setHistoryWindow]  = useState(180)
  const [holesMode,      setHolesMode]      = useState<HolesMode>('mixed')
  const [pastFlights,    setPastFlights]    = useState<any[]>([])
  const [forbiddenPairs, setForbiddenPairs] = useState<Set<string>>(new Set())
  const [preferredPairs, setPreferredPairs] = useState<Set<string>>(new Set())
  const [generating,     setGenerating]     = useState(false)
  const [saving,         setSaving]         = useState(false)

  const [dragState,      setDragState]      = useState<DragState | null>(null)
  const [dragOverFlight, setDragOverFlight] = useState<number | null>(null)
  const [dragOverPlayer, setDragOverPlayer] = useState<string | null>(null)
  const [manualEdits,    setManualEdits]    = useState(false)

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (!groupId) return; loadConstraints(); loadPastFlights() }, [groupId])

  async function loadConstraints() {
    const { data, error } = await supabase.from('player_pair_constraints').select('*').eq('group_id', groupId)
    if (error) return
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

  async function loadPastFlights() {
    const { data, error } = await supabase
      .from('flights')
      .select(`id, created_at, flight_players(player_id, players(id, first_name, surname, whs))`)
    if (error) return
    setPastFlights((data ?? []).map((f: any) => ({
      date: f.created_at,
      players: f.flight_players.map((fp: any) => fp.players),
    })))
  }

  // ─── Génération avec gestion 9/18 trous ──────────────────────────────────

  async function handleGenerate() {
    setGenerating(true)
    setManualEdits(false)
    try {
      if (holesMode === 'mixed') {
        // Tous ensemble
        await generate({
          flightSize, balanceWHS, iterations,
          historyWindowDays: historyWindow,
          pastFlights, forbiddenPairs, preferredPairs, debug: true,
        })
      } else {
        // Séparés : générer deux groupes indépendants
        const players18 = players.filter((p: any) => !p.holes_played || p.holes_played === 18)
        const players9  = players.filter((p: any) => p.holes_played === 9)

        // Générer 18 trous
        await generate({
          flightSize, balanceWHS, iterations,
          historyWindowDays: historyWindow,
          pastFlights, forbiddenPairs, preferredPairs, debug: true,
          overridePlayers: players18,
          flightNoOffset: 0,
          groupLabel: '18T',
        })

        // Générer 9 trous (offset pour ne pas écraser les flight_no)
        if (players9.length > 0) {
          await generate({
            flightSize: Math.min(flightSize, players9.length),
            balanceWHS, iterations,
            historyWindowDays: historyWindow,
            pastFlights, forbiddenPairs, preferredPairs, debug: true,
            overridePlayers: players9,
            flightNoOffset: Math.ceil(players18.length / flightSize),
            groupLabel: '9T',
          })
        }
      }
    } catch (err) { console.error(err) }
    finally { setGenerating(false) }
  }

  async function handleSave() {
    setSaving(true)
    try { await save() } finally { setSaving(false) }
  }

  // ─── Drag & Drop ─────────────────────────────────────────────────────────

  function onDragStart(e: React.DragEvent, player: any, fromFlightNo: number) {
    e.dataTransfer.effectAllowed = 'move'
    setDragState({ playerId: player.id, playerName: `${player.first_name} ${player.surname}`, fromFlightNo })
  }
  function onDragEnd() { setDragState(null); setDragOverFlight(null); setDragOverPlayer(null) }

  function onDragOverFlight(e: React.DragEvent, flightNo: number) {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'
    setDragOverFlight(flightNo); setDragOverPlayer(null)
  }
  function onDragOverPlayer(e: React.DragEvent, flightNo: number, targetPlayerId: string) {
    e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'
    setDragOverFlight(flightNo); setDragOverPlayer(targetPlayerId)
  }
  function onDropOnFlight(e: React.DragEvent, toFlightNo: number) {
    e.preventDefault()
    if (!dragState) return
    if (dragState.fromFlightNo === toFlightNo) { onDragEnd(); return }
    movePlayer(dragState.playerId, dragState.fromFlightNo, toFlightNo)
    onDragEnd()
  }
  function movePlayer(playerId: string, fromFlightNo: number, toFlightNo: number) {
    setFlights((prev: any[]) => {
      const next = prev.map((f: any) => {
        const fps = Array.isArray(f.players) ? f.players : []
        if (f.flight_no === fromFlightNo) return { ...f, players: fps.filter((p: any) => p.id !== playerId) }
        if (f.flight_no === toFlightNo) {
          const moved = prev.find((ff: any) => ff.flight_no === fromFlightNo)?.players?.find((p: any) => p.id === playerId)
          return moved ? { ...f, players: [...fps, moved] } : f
        }
        return f
      })
      setManualEdits(true)
      return next
    })
  }

  // ─── Grouper les flights par label (séparés) ──────────────────────────────

  const sortedFlights = [...flights].sort((a: any, b: any) => a.flight_no - b.flight_no)

  // Regrouper si mode séparé
  const flightGroups: { label: string | null; flights: any[] }[] =
    holesMode === 'separated'
      ? [
          { label: '18 trous', flights: sortedFlights.filter((f: any) => f.groupLabel === '18T' || !f.groupLabel) },
          { label: '9 trous',  flights: sortedFlights.filter((f: any) => f.groupLabel === '9T') },
        ].filter(g => g.flights.length > 0)
      : [{ label: null, flights: sortedFlights }]

  // Stats joueurs
  const players18 = players.filter((p: any) => !p.holes_played || p.holes_played === 18)
  const players9  = players.filter((p: any) => p.holes_played === 9)

  if (loading || roleLoading) return (
    <div className="p-6 space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-4xl">

      {/* Bannière lecture seule */}
      {!isOwner && (
        <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-[12px] text-blue-700 font-medium">
          Vue en lecture seule — seul l'organisateur peut générer et modifier les flights
        </div>
      )}

      {/* ── Paramètres ── */}
      {isOwner && (
        <div className="rounded-xl border border-white/60 shadow-sm p-5 mb-6"
          style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Paramètres</p>

          <div className="flex flex-wrap items-end gap-4 mb-4">
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Taille flight</label>
              <select value={flightSize} onChange={e => setFlightSize(Number(e.target.value))} className={selectClass}>
                <option value={4}>4 joueurs</option>
                <option value={3}>3 joueurs</option>
                <option value={2}>2 joueurs</option>
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Historique</label>
              <select value={historyWindow} onChange={e => setHistoryWindow(Number(e.target.value))} className={selectClass}>
                <option value={0}>Sans historique</option>
                <option value={30}>30 derniers jours</option>
                <option value={90}>90 derniers jours</option>
                <option value={180}>6 derniers mois</option>
                <option value={365}>Dernière année</option>
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Itérations</label>
              <input type="number" value={iterations} onChange={e => setIterations(Number(e.target.value))}
                className={`${selectClass} w-24`} />
            </div>

            <label className="flex items-center gap-2 text-[13px] font-medium text-slate-700 cursor-pointer mb-0.5">
              <input type="checkbox" checked={balanceWHS} onChange={() => setBalanceWHS(v => !v)} className="rounded" />
              Équilibrer WHS
            </label>
          </div>

          {/* Toggle 9/18 trous — uniquement si des joueurs 9T existent */}
          {players9.length > 0 && (
            <div className="mb-4 p-3.5 rounded-xl border border-slate-100 bg-slate-50/60">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                Joueurs 9 trous ({players9.length})
              </p>
              <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
                <button type="button" onClick={() => setHolesMode('mixed')}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                    holesMode === 'mixed' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  Mélangés
                </button>
                <button type="button" onClick={() => setHolesMode('separated')}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${
                    holesMode === 'separated' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  Séparés
                </button>
              </div>
              {holesMode === 'separated' && (
                <p className="text-[11px] text-slate-400 mt-2">
                  Flights 18T et 9T générés indépendamment
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-2">
              <a href={`/groups/${groupId}/events/${eventId}/flights/history`}
                className="text-[12px] font-medium text-slate-400 hover:text-[#185FA5] transition-colors flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
                </svg>
                Matrice historique
              </a>
              <span className="text-slate-200">·</span>
              <a href={`/groups/${groupId}/constraints`}
                className="text-[12px] font-medium text-slate-400 hover:text-[#185FA5] transition-colors">
                Contraintes
              </a>
            </div>
            <div className="flex gap-2">
              <button onClick={remove}
                className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                Effacer
              </button>
              <button onClick={handleSave} disabled={saving || flights.length === 0}
                className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                {saving ? 'Saving...' : 'Sauvegarder'}
              </button>
              <button onClick={handleGenerate} disabled={generating}
                className="text-[12px] font-semibold px-4 py-2 rounded-xl bg-[#185FA5] text-white hover:bg-[#0C447C] disabled:opacity-60 transition-colors">
                {generating ? 'Génération...' : 'Générer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Joueurs confirmés ── */}
      <div className="mb-6">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          Joueurs confirmés ({players.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {players.length === 0 && <p className="text-[13px] text-slate-500">Aucun joueur confirmé (GOING)</p>}
          {players.map((p: any) => (
            <div key={p.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
              <span className="text-[13px] font-medium text-slate-800">{p.first_name} {p.surname}</span>
              {p.whs !== null && (
                <span className="text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-lg">{p.whs}</span>
              )}
              {p.holes_played === 9 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700">9T</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Flights ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Flights {flights.length > 0 && `(${flights.length})`}
          </p>
          {manualEdits && flights.length > 0 && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              Modifié — pensez à sauvegarder
            </span>
          )}
        </div>

        {isOwner && flights.length > 0 && (
          <p className="text-[11px] text-slate-400 mb-3 flex items-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="5 9 2 12 5 15"/><polyline points="19 9 22 12 19 15"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
            </svg>
            Glissez un joueur vers un autre flight pour le déplacer
          </p>
        )}

        {flights.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl text-slate-400">
            <p className="text-[14px] font-medium">Aucun flight généré</p>
            {isOwner && <p className="text-[12px] mt-1">Configure les paramètres et clique sur "Générer"</p>}
          </div>
        ) : (
          <div className="space-y-6">
            {flightGroups.map(group => (
              <div key={group.label ?? 'all'}>
                {/* Label groupe (mode séparé uniquement) */}
                {group.label && (
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                      group.label === '18 trous'
                        ? 'bg-[#EBF3FC] text-[#0C447C]'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
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
                        className={`bg-white border rounded-xl overflow-hidden transition-all ${
                          isDragTarget
                            ? 'border-[#185FA5] shadow-[0_0_0_2px_rgba(24,95,165,0.15)] scale-[1.01]'
                            : 'border-slate-200'
                        }`}
                        onDragOver={e => onDragOverFlight(e, flight.flight_no)}
                        onDrop={e => onDropOnFlight(e, flight.flight_no)}
                        onDragLeave={() => { setDragOverFlight(null); setDragOverPlayer(null) }}>

                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                          <span className="text-[13px] font-bold text-slate-800">Flight {flight.flight_no}</span>
                          <div className="flex items-center gap-2">
                            {avgWHS && <span className="text-[11px] text-slate-400">moy. {avgWHS}</span>}
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              flightPlayers.length === flightSize
                                ? 'bg-[#EAF3DE] text-[#3B6D11]'
                                : 'bg-amber-50 text-amber-600'
                            }`}>
                              {flightPlayers.length}/{flightSize}
                            </span>
                          </div>
                        </div>

                        {isDragTarget && (
                          <div className="mx-3 mt-2 h-8 border-2 border-dashed border-[#185FA5]/40 rounded-lg bg-[#EBF3FC]/50 flex items-center justify-center">
                            <span className="text-[11px] font-semibold text-[#185FA5]/70">Déposer ici</span>
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
                                className={`flex items-center justify-between rounded-lg px-2 py-1.5 transition-all ${
                                  isDragging    ? 'opacity-40 bg-slate-100'
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
                                  {p.holes_played === 9 && (
                                    <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-amber-100 text-amber-700">9T</span>
                                  )}
                                </div>
                                {p.whs !== null && (
                                  <span className="text-[11px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-lg">{p.whs}</span>
                                )}
                              </div>
                            )
                          })}

                          {flightPlayers.length === 0 && (
                            <div className="text-center py-4 text-[11px] text-slate-400 border border-dashed border-slate-200 rounded-lg">
                              Flight vide
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

      {/* Ghost drag overlay */}
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
    </div>
  )
}

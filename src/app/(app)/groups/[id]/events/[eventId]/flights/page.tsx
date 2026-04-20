'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useFlights } from '@/lib/hooks/useFlights'
import { createClient } from '@/lib/supabase/client'
import { pairKey } from '@/lib/utils/pairs'
import { useGroupRole } from '@/lib/hooks/useGroupRole'

const supabase = createClient()

const selectClass = "border border-slate-200 rounded-xl px-3 py-2 text-[13px] bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5]"

export default function FlightsPage() {
  const params  = useParams()
  const groupId = params.id as string
  const eventId = params.eventId as string

  const { role, loading: roleLoading } = useGroupRole(groupId)
  const isOwner = role === 'owner'

  const { players, flights, loading, loadData, generate, save, remove } = useFlights(eventId)

  const [flightSize, setFlightSize]         = useState(4)
  const [balanceWHS, setBalanceWHS]         = useState(true)
  const [iterations, setIterations]         = useState(800)
  const [historyWindow, setHistoryWindow]   = useState(180)
  const [pastFlights, setPastFlights]       = useState<any[]>([])
  const [forbiddenPairs, setForbiddenPairs] = useState<Set<string>>(new Set())
  const [preferredPairs, setPreferredPairs] = useState<Set<string>>(new Set())
  const [generating, setGenerating]         = useState(false)
  const [saving, setSaving]                 = useState(false)

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

  async function handleGenerate() {
    setGenerating(true)
    try {
      await generate({ flightSize, balanceWHS, iterations, historyWindowDays: historyWindow, pastFlights, forbiddenPairs, preferredPairs, debug: true })
    } catch (err) { console.error(err) }
    finally { setGenerating(false) }
  }

  async function handleSave() {
    setSaving(true)
    try { await save() } finally { setSaving(false) }
  }

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

      {/* Paramètres */}
      {isOwner && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Paramètres</p>
          <div className="flex flex-wrap items-end gap-4">
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
            <div className="flex gap-2 ml-auto">
              <button onClick={remove}
                className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                Effacer
              </button>
              <button onClick={handleSave} disabled={saving || flights.length === 0}
                className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
                {saving ? 'Saving...' : 'Sauvegarder'}
              </button>
              <button onClick={handleGenerate} disabled={generating}
                className="text-[12px] font-semibold px-4 py-2 rounded-xl bg-[#185FA5] text-white hover:bg-[#0C447C] disabled:opacity-60 transition-colors">
                {generating ? 'Génération...' : 'Générer flights'}
              </button>
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <a href={`/groups/${groupId}/constraints`}
              className="text-[12px] font-medium text-slate-400 hover:text-[#185FA5] transition-colors">
              Gérer les contraintes de flights →
            </a>
          </div>
        </div>
      )}

      {/* Joueurs */}
      <div className="mb-6">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          Joueurs confirmés ({players.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {players.map((p: any) => (
            <div key={p.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
              <span className="text-[13px] font-medium text-slate-800">{p.first_name} {p.surname}</span>
              {p.whs !== null && (
                <span className="text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-lg">{p.whs}</span>
              )}
            </div>
          ))}
          {players.length === 0 && <p className="text-[13px] text-slate-500">Aucun joueur confirmé (GOING)</p>}
        </div>
      </div>

      {/* Flights */}
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          Flights {flights.length > 0 && `(${flights.length})`}
        </p>
        {flights.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl text-slate-400">
            <p className="text-[14px] font-medium">Aucun flight généré</p>
            {isOwner && <p className="text-[12px] mt-1">Configure les paramètres et clique sur "Générer flights"</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
           {[...flights].sort((a: any, b: any) => {
              const aLen = (Array.isArray(a.players) ? a.players : Array.isArray(a) ? a : []).length
              const bLen = (Array.isArray(b.players) ? b.players : Array.isArray(b) ? b : []).length
              return aLen - bLen
            }).map((flight: any) => {
              const flightPlayers = Array.isArray(flight.players) ? flight.players : Array.isArray(flight) ? flight : []
              const whsValues = flightPlayers.filter((p: any) => p.whs !== null)
              const avgWHS = whsValues.length > 0
                ? (whsValues.reduce((s: number, p: any) => s + (p.whs ?? 0), 0) / whsValues.length).toFixed(1)
                : null

              return (
                <div key={flight.flight_no} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                    <span className="text-[13px] font-bold text-slate-800">Flight {flight.flight_no}</span>
                    {avgWHS && <span className="text-[11px] text-slate-500">moy. {avgWHS}</span>}
                  </div>
                  <div className="p-3 space-y-2">
                    {flightPlayers.map((p: any, i: number) => (
                      <div key={p.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-300 w-4">{i + 1}</span>
                          <span className="text-[13px] font-medium text-slate-800">{p.first_name} {p.surname}</span>
                        </div>
                        {p.whs !== null && (
                          <span className="text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-lg">{p.whs}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

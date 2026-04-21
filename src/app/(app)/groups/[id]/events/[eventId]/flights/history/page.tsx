'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Player = { id: string; first_name: string; surname: string }

export default function FlightHistoryPage() {
  const params  = useParams()
  const groupId = params.id      as string
  const eventId = params.eventId as string
  const router  = useRouter()

  const [players,    setPlayers]    = useState<Player[]>([])
  const [matrix,     setMatrix]     = useState<Record<string, number>>({})
  const [edits,      setEdits]      = useState<Record<string, number>>({})
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [maxCount,   setMaxCount]   = useState(1)
  const [tooltip,    setTooltip]    = useState<{ x: number; y: number; text: string } | null>(null)
  const [sortKey,    setSortKey]    = useState<'name' | 'count'>('name')
  const [periodDays, setPeriodDays] = useState<number>(365)

  useEffect(() => { loadData() }, [groupId, periodDays])

  async function loadData() {
    setLoading(true)

    const { data: membersData } = await supabase
      .from('groups_players')
      .select('player:players(id, first_name, surname)')
      .eq('group_id', groupId)
    const allPlayers: Player[] = (membersData ?? []).map((r: any) => r.player)

    const eventIds = await getGroupEventIds()

    let query = supabase
      .from('flights')
      .select(`id, created_at, flight_players(player_id)`)
      .in('event_id', eventIds.length ? eventIds : ['_none_'])

    if (periodDays > 0) {
      const since = new Date()
      since.setDate(since.getDate() - periodDays)
      query = query.gte('created_at', since.toISOString())
    }

    const { data: flightsData } = await query

    const counts: Record<string, number> = {}
    for (const flight of flightsData ?? []) {
      const ids = (flight.flight_players ?? []).map((fp: any) => fp.player_id as string)
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = pairKey(ids[i], ids[j])
          counts[key] = (counts[key] ?? 0) + 1
        }
      }
    }

    const { data: overrides } = await supabase
      .from('flight_history_overrides')
      .select('player_a, player_b, count')
      .eq('group_id', groupId)
    const savedEdits: Record<string, number> = {}
    for (const o of overrides ?? []) {
      savedEdits[pairKey(o.player_a, o.player_b)] = o.count
    }

    const effective = { ...counts, ...savedEdits }
    const max = Math.max(1, ...Object.values(effective))

    setPlayers(allPlayers)
    setMatrix(counts)
    setEdits(savedEdits)
    setMaxCount(max)
    setLoading(false)
  }

  async function getGroupEventIds(): Promise<string[]> {
    const { data } = await supabase.from('events').select('id').eq('group_id', groupId)
    return (data ?? []).map((e: any) => e.id)
  }

  function pairKey(a: string, b: string) {
    return a < b ? `${a}|${b}` : `${b}|${a}`
  }

  function getValue(aId: string, bId: string): number {
    if (aId === bId) return -1
    const key = pairKey(aId, bId)
    return edits[key] ?? matrix[key] ?? 0
  }

  function adjustCell(aId: string, bId: string, delta: number) {
    const key      = pairKey(aId, bId)
    const current  = edits[key] ?? matrix[key] ?? 0
    const next     = Math.max(0, current + delta)
    const newEdits = { ...edits, [key]: next }
    setEdits(newEdits)
    setMaxCount(Math.max(1, ...Object.values({ ...matrix, ...newEdits })))
  }

  async function saveOverrides() {
    setSaving(true)
    const rows = Object.entries(edits).map(([key, count]) => {
      const [a, b] = key.split('|')
      return { group_id: groupId, player_a: a, player_b: b, count }
    })
    const { error } = await supabase
      .from('flight_history_overrides')
      .upsert(rows, { onConflict: 'group_id,player_a,player_b' })
    if (error) alert(error.message)
    setSaving(false)
  }

  function cellColor(value: number): string {
    if (value <= 0) return 'transparent'
    const ratio = Math.min(value / maxCount, 1)
    const r = Math.round(255 - ratio * (255 - 59))
    const g = Math.round(255 - ratio * (255 - 109))
    const b = Math.round(255 - ratio * (255 - 17))
    return `rgb(${r},${g},${b})`
  }

  function cellTextColor(value: number): string {
    if (value <= 0) return '#CBD5E1'
    return Math.min(value / maxCount, 1) > 0.5 ? '#ffffff' : '#1e3a12'
  }

  const sortedPlayers = useMemo(() => {
    if (sortKey === 'name') {
      return [...players].sort((a, b) => a.surname.localeCompare(b.surname, 'fr'))
    }
    return [...players].sort((a, b) => {
      const tot = (p: Player) => players.reduce((s, q) => s + Math.max(0, getValue(p.id, q.id)), 0)
      return tot(b) - tot(a)
    })
  }, [players, sortKey, matrix, edits])

  const hasEdits = Object.keys(edits).length > 0

  const PERIOD_OPTIONS = [
    { label: 'Tout',   value: 0   },
    { label: '30 j',   value: 30  },
    { label: '3 mois', value: 90  },
    { label: '6 mois', value: 180 },
    { label: '1 an',   value: 365 },
  ]

  return (
    <div className="p-5 sm:p-6">

      {/* Header */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Historique flights</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Co-participations · hover pour corriger manuellement</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasEdits && (
            <button onClick={saveOverrides} disabled={saving}
              className="text-[12px] font-semibold px-4 py-2 rounded-xl bg-[#185FA5] text-white hover:bg-[#0C447C] disabled:opacity-60 transition-colors">
              {saving ? 'Sauvegarde...' : 'Sauvegarder corrections'}
            </button>
          )}
          <button onClick={() => router.back()}
            className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            ← Retour
          </button>
        </div>
      </div>

      {/* Contrôles */}
      <div className="flex flex-wrap items-end gap-4 mb-5">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Période</span>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {PERIOD_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setPeriodDays(opt.value)}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  periodDays === opt.value ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tri</span>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {(['name', 'count'] as const).map(k => (
              <button key={k} onClick={() => setSortKey(k)}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  sortKey === k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {k === 'name' ? 'Alphabétique' : 'Activité'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1 ml-auto">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Intensité</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">0</span>
            <div className="flex h-5 w-32 rounded-lg overflow-hidden border border-slate-200">
              {[0, 0.15, 0.3, 0.5, 0.7, 0.85, 1].map((r, i) => {
                const rv = Math.round(255 - r * (255 - 59))
                const gv = Math.round(255 - r * (255 - 109))
                const bv = Math.round(255 - r * (255 - 17))
                return <div key={i} className="flex-1" style={{ background: r === 0 ? '#F8FAFC' : `rgb(${rv},${gv},${bv})` }} />
              })}
            </div>
            <span className="text-[11px] text-slate-400">{maxCount}×</span>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 mb-4">● = correction manuelle</p>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="h-8 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : players.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-[13px]">Aucun membre dans ce groupe</div>
      ) : (
        <div className="overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="border-collapse" style={{ fontSize: '11px' }}>
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-slate-50 border-b border-r border-slate-200 w-28 min-w-28" />
                {sortedPlayers.map(p => (
                  <th key={p.id}
                    className="bg-slate-50 border-b border-slate-200 px-1 py-2 font-semibold text-slate-600 whitespace-nowrap"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: '90px', verticalAlign: 'bottom', minWidth: '32px' }}>
                    {p.first_name[0]}. {p.surname}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((rowPlayer, ri) => (
                <tr key={rowPlayer.id} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className="sticky left-0 z-10 bg-inherit border-r border-slate-200 px-3 py-1.5 font-semibold text-slate-700 whitespace-nowrap text-[12px]">
                    {rowPlayer.first_name[0]}. {rowPlayer.surname}
                  </td>
                  {sortedPlayers.map(colPlayer => {
                    const isSelf = rowPlayer.id === colPlayer.id
                    const val    = getValue(rowPlayer.id, colPlayer.id)
                    const isEdit = !isSelf && edits[pairKey(rowPlayer.id, colPlayer.id)] !== undefined

                    if (isSelf) return (
                      <td key={colPlayer.id} className="border border-slate-100 text-center"
                        style={{ background: '#F1F5F9', width: '32px', height: '32px' }}>
                        <span className="text-slate-300">—</span>
                      </td>
                    )

                    return (
                      <td key={colPlayer.id}
                        className="border border-slate-100 text-center relative group cursor-default select-none"
                        style={{ background: val > 0 ? cellColor(val) : '#F8FAFC', width: '32px', height: '32px', transition: 'background 0.2s' }}
                        onMouseEnter={e => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 8,
                            text: `${rowPlayer.first_name} & ${colPlayer.first_name} : ${val}×${isEdit ? ' ✎' : ''}` })
                        }}
                        onMouseLeave={() => setTooltip(null)}>
                        <span className="text-[11px] font-bold" style={{ color: val > 0 ? cellTextColor(val) : '#CBD5E1' }}>
                          {val > 0 ? val : ''}
                        </span>
                        {isEdit && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-0.5 bg-black/10 transition-opacity">
                          <button onClick={e => { e.stopPropagation(); adjustCell(rowPlayer.id, colPlayer.id, +1) }}
                            className="w-5 h-5 rounded text-white bg-black/40 hover:bg-black/60 flex items-center justify-center text-[10px] font-bold leading-none">+</button>
                          <button onClick={e => { e.stopPropagation(); adjustCell(rowPlayer.id, colPlayer.id, -1) }}
                            className="w-5 h-5 rounded text-white bg-black/40 hover:bg-black/60 flex items-center justify-center text-[10px] font-bold leading-none">−</button>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tooltip && (
        <div className="fixed z-50 pointer-events-none px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-medium shadow-lg -translate-x-1/2 -translate-y-full"
          style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </div>
      )}

      <p className="mt-4 text-[11px] text-slate-400">
        Corrections sauvegardées dans <code className="bg-slate-100 px-1 rounded">flight_history_overrides</code> (group_id, player_a, player_b, count)
      </p>
    </div>
  )
}

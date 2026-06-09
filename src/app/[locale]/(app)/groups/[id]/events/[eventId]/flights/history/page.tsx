'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations, useLocale } from 'next-intl'

const supabase = createClient()

type Player = { id: string; first_name: string; surname: string }
type FlightRow = { id: string; created_at: string; players: Player[] }

export default function FlightHistoryPage() {
  const params  = useParams()
  const groupId = params.id      as string
  const eventId = params.eventId as string
  const router  = useRouter()
  const t       = useTranslations()
  const locale  = useLocale()

  const [players,    setPlayers]    = useState<Player[]>([])
  const [matrix,     setMatrix]     = useState<Record<string, number>>({})
  const [edits,      setEdits]      = useState<Record<string, number>>({})
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [maxCount,   setMaxCount]   = useState(1)
  const [tooltip,    setTooltip]    = useState<{ x: number; y: number; text: string } | null>(null)
  const [sortKey,    setSortKey]    = useState<'name' | 'count'>('name')
  const [periodDays, setPeriodDays] = useState<number>(365)
  const [flightRows, setFlightRows] = useState<FlightRow[]>([])

  useEffect(() => { loadData() }, [groupId, periodDays])

  async function loadData() {
    setLoading(true)
    const { data: membersData } = await supabase
      .from('groups_players')
      .select('player:players(id, first_name, surname)')
      .eq('group_id', groupId)
    const allPlayers: Player[] = (membersData ?? []).map((r: any) => r.player)
    const playerMap: Record<string, Player> = {}
    for (const p of allPlayers) playerMap[p.id] = p

    const eventIds = await getGroupEventIds()

    let query = supabase
      .from('flights')
      .select(`id, created_at, flight_players(player_id)`)
      .in('event_id', eventIds.length ? eventIds : ['_none_'])
      .order('created_at', { ascending: false })

    if (periodDays > 0) {
      const since = new Date()
      since.setDate(since.getDate() - periodDays)
      query = query.gte('created_at', since.toISOString())
    }

    const { data: flightsData } = await query

    const counts: Record<string, number> = {}
    const rows: FlightRow[] = []

    for (const flight of flightsData ?? []) {
      const ids = (flight.flight_players ?? []).map((fp: any) => fp.player_id as string)
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = pairKey(ids[i], ids[j])
          counts[key] = (counts[key] ?? 0) + 1
        }
      }
      rows.push({
        id: flight.id,
        created_at: flight.created_at,
        players: ids.map((id: string) => playerMap[id]).filter(Boolean),
      })
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
    setFlightRows(rows)
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

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(locale, {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }

  const sortedPlayers = useMemo(() => {
    if (sortKey === 'name') {
      return [...players].sort((a, b) => a.surname.localeCompare(b.surname, locale))
    }
    return [...players].sort((a, b) => {
      const tot = (p: Player) => players.reduce((s, q) => s + Math.max(0, getValue(p.id, q.id)), 0)
      return tot(b) - tot(a)
    })
  }, [players, sortKey, matrix, edits])

  const hasEdits = Object.keys(edits).length > 0

  const PERIOD_OPTIONS = [
    { label: t('flightHistory.periods.all'), value: 0   },
    { label: t('flightHistory.periods.30d'), value: 30  },
    { label: t('flightHistory.periods.3m'),  value: 90  },
    { label: t('flightHistory.periods.6m'),  value: 180 },
    { label: t('flightHistory.periods.1y'),  value: 365 },
  ]

  return (
    <div className="p-5 sm:p-6">
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">{t('flightHistory.title')}</h1>
          <p className="text-[13px] text-slate-900 mt-0.5">{t('flightHistory.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasEdits && (
            <button onClick={saveOverrides} disabled={saving}
              className="text-[12px] font-semibold px-4 py-2 rounded-xl bg-[#185FA5] text-white hover:bg-[#0C447C] disabled:opacity-60 transition-colors">
              {saving ? t('flightHistory.saving') : t('flightHistory.saveCorrections')}
            </button>
          )}
          <button onClick={() => router.back()}
            className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            {t('flightHistory.back')}
          </button>
        </div>
      </div>

      {/* Période + tri */}
      <div className="flex flex-wrap items-end gap-4 mb-5">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('flightHistory.period')}</span>
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
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('flightHistory.sort')}</span>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {(['name', 'count'] as const).map(k => (
              <button key={k} onClick={() => setSortKey(k)}
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  sortKey === k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {k === 'name' ? t('flightHistory.sortAlpha') : t('flightHistory.sortActivity')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1 ml-auto">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('flightHistory.intensity')}</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">0</span>
            <div className="flex h-5 w-32 rounded-lg overflow-hidden border border-slate-200">
              {[0, 0.15, 0.3, 0.5, 0.7, 0.85, 1].map((r, i) => {
                const rv = Math.round(255 - r * (255 - 59))
                const gv = Math.round(255 - r * (255 - 109))
                const bv = Math.round(255 - r * (255 - 17))
                return <div key={i} className="flex-1" style={{ background: r === 0 ? '#F8FAFC' :
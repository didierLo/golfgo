'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useTranslations, useLocale } from 'next-intl'

const supabase = createClient()

type PlayerInfo = { id: string; first_name: string; surname: string }
type EventRow   = { id: string; title: string | null; starts_at: string; is_golf: boolean | null }
type GameRow    = {
  eventId: string
  title: string
  date: string
  nbFlights: number
  playerIds: string[]
  flightSizes: number[]
}

function Bar({ value, max, color = '#185FA5' }: { value: number; max: number; color?: string }) {
  return (
    <div className="flex-1 h-5 bg-slate-100 rounded-md overflow-hidden">
      <div className="h-full rounded-md" style={{ width: `${Math.max(4, (value / max) * 100)}%`, background: color }} />
    </div>
  )
}

// Une « partie jouée » = un événement de golf déjà passé qui a au moins un flight.
export default function GroupStatsPage() {
  const params  = useParams()
  const groupId = params.id as string
  const t       = useTranslations()
  const locale  = useLocale()

  const [loading,    setLoading]    = useState(true)
  const [periodDays, setPeriodDays] = useState<number>(0)
  const [games,      setGames]      = useState<GameRow[]>([])
  const [names,      setNames]      = useState<Record<string, PlayerInfo>>({})
  const [showAll,    setShowAll]    = useState(false)

  useEffect(() => { loadData() }, [groupId, periodDays]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true)

    // 1. Événements passés du groupe
    let evQuery = supabase
      .from('events')
      .select('id, title, starts_at, is_golf')
      .eq('group_id', groupId)
      .lt('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: false })

    if (periodDays > 0) {
      const since = new Date()
      since.setDate(since.getDate() - periodDays)
      evQuery = evQuery.gte('starts_at', since.toISOString())
    }

    const { data: evData } = await evQuery
    const events: EventRow[] = ((evData ?? []) as EventRow[]).filter(e => e.is_golf !== false)
    const eventIds = events.map(e => e.id)

    if (eventIds.length === 0) {
      setGames([]); setNames({}); setLoading(false)
      return
    }

    // 2. Flights + joueurs de ces événements
    const { data: flightsData } = await supabase
      .from('flights')
      .select('id, event_id, flight_players(player_id)')
      .in('event_id', eventIds)

    const byEvent: Record<string, { sizes: number[]; players: Set<string> }> = {}
    for (const f of flightsData ?? []) {
      const ids = ((f as any).flight_players ?? []).map((fp: any) => fp.player_id as string)
      if (!byEvent[f.event_id]) byEvent[f.event_id] = { sizes: [], players: new Set() }
      byEvent[f.event_id].sizes.push(ids.length)
      for (const id of ids) byEvent[f.event_id].players.add(id)
    }

    const rows: GameRow[] = []
    for (const e of events) {
      const agg = byEvent[e.id]
      if (!agg || agg.sizes.length === 0) continue   // pas de flights → pas une partie jouée
      rows.push({
        eventId:     e.id,
        title:       e.title ?? '',
        date:        e.starts_at,
        nbFlights:   agg.sizes.length,
        playerIds:   [...agg.players],
        flightSizes: agg.sizes,
      })
    }

    // 3. Noms des joueurs
    const allIds = [...new Set(rows.flatMap(r => r.playerIds))]
    const map: Record<string, PlayerInfo> = {}
    if (allIds.length) {
      const { data: pl } = await supabase
        .from('players')
        .select('id, first_name, surname')
        .in('id', allIds)
      for (const p of pl ?? []) map[p.id] = p as PlayerInfo
    }

    setGames(rows)
    setNames(map)
    setLoading(false)
  }

  // ── Calculs ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const nbGames   = games.length
    const nbFlights = games.reduce((s, g) => s + g.nbFlights, 0)

    // Combien de parties avaient 3 flights, 4 flights, 5 flights…
    const byFlightCount: Record<number, number> = {}
    for (const g of games) byFlightCount[g.nbFlights] = (byFlightCount[g.nbFlights] ?? 0) + 1

    // Combien de flights de 4 joueurs, de 3 joueurs…
    const bySize: Record<number, number> = {}
    for (const g of games) for (const s of g.flightSizes) bySize[s] = (bySize[s] ?? 0) + 1

    // Nombre de parties jouées par joueur
    const perPlayer: Record<string, number> = {}
    for (const g of games) for (const id of g.playerIds) perPlayer[id] = (perPlayer[id] ?? 0) + 1

    // Combien de joueurs ont joué 1 fois, 2 fois…
    const byTimes: Record<number, number> = {}
    for (const c of Object.values(perPlayer)) byTimes[c] = (byTimes[c] ?? 0) + 1

    const totalSlots = games.reduce((s, g) => s + g.playerIds.length, 0)

    return {
      nbGames,
      nbFlights,
      nbPlayers:  Object.keys(perPlayer).length,
      avgPlayers: nbGames ? totalSlots / nbGames : 0,
      avgFlights: nbGames ? nbFlights / nbGames : 0,
      byFlightCount: Object.entries(byFlightCount).map(([k, v]) => ({ n: Number(k), count: v })).sort((a, b) => a.n - b.n),
      bySize:        Object.entries(bySize).map(([k, v]) => ({ n: Number(k), count: v })).sort((a, b) => b.n - a.n),
      byTimes:       Object.entries(byTimes).map(([k, v]) => ({ n: Number(k), count: v })).sort((a, b) => b.n - a.n),
      ranking: Object.entries(perPlayer)
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => b.count - a.count || playerName(a.id).localeCompare(playerName(b.id), locale)),
    }
  }, [games, names]) // eslint-disable-line react-hooks/exhaustive-deps

  function playerName(id: string) {
    const p = names[id]
    return p ? `${p.first_name} ${p.surname}` : '—'
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  }

  const PERIOD_OPTIONS = [
    { label: t('stats.periods.all'), value: 0   },
    { label: t('stats.periods.1y'),  value: 365 },
    { label: t('stats.periods.6m'),  value: 180 },
    { label: t('stats.periods.3m'),  value: 90  },
  ]

  const maxByFlightCount = Math.max(1, ...stats.byFlightCount.map(r => r.count))
  const maxBySize        = Math.max(1, ...stats.bySize.map(r => r.count))
  const maxByTimes       = Math.max(1, ...stats.byTimes.map(r => r.count))
  const maxRanking       = Math.max(1, ...stats.ranking.map(r => r.count))
  const rankingShown     = showAll ? stats.ranking : stats.ranking.slice(0, 15)

  const cardCls  = 'rounded-xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5'
  const titleCls = 'text-[10px] font-black text-slate-500 uppercase tracking-[0.14em] mb-3'

  return (
    <div className="p-5 sm:p-6 max-w-4xl">

      {/* En-tête */}
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">{t('stats.title')}</h1>
          <p className="text-[13px] text-slate-900 mt-0.5">{t('stats.subtitle')}</p>
        </div>
        <Link href={`/groups/${groupId}/events`}
          className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
          {t('stats.toEvents')}
        </Link>
      </div>

      {/* Période */}
      <div className="flex flex-col gap-1 mb-5">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest on-bg">{t('stats.period')}</span>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
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

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-white/40 rounded-xl animate-pulse" />)}
        </div>
      ) : stats.nbGames === 0 ? (
        <div className="text-center py-16 text-slate-400 text-[13px] on-bg-card">{t('stats.empty')}</div>
      ) : (
        <div className="space-y-4">

          {/* Chiffres clés */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: t('stats.kpiGames'),      value: String(stats.nbGames) },
              { label: t('stats.kpiFlights'),    value: String(stats.nbFlights) },
              { label: t('stats.kpiPlayers'),    value: String(stats.nbPlayers) },
              { label: t('stats.kpiAvgPlayers'), value: stats.avgPlayers.toFixed(1) },
              { label: t('stats.kpiAvgFlights'), value: stats.avgFlights.toFixed(1) },
            ].map(k => (
              <div key={k.label} className="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3">
                <p className="text-[24px] font-black text-[#185FA5] leading-none">{k.value}</p>
                <p className="text-[11px] font-semibold text-slate-500 mt-1.5 leading-tight">{k.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Parties par nombre de flights */}
            <div className={cardCls}>
              <p className={titleCls}>{t('stats.gamesByFlights')}</p>
              <div className="space-y-2">
                {stats.byFlightCount.map(r => (
                  <div key={r.n} className="flex items-center gap-3">
                    <span className="text-[12px] font-semibold text-slate-700 w-24 flex-shrink-0">
                      {t('stats.flightsLabel', { count: r.n })}
                    </span>
                    <Bar value={r.count} max={maxByFlightCount} />
                    <span className="text-[12px] font-bold text-slate-800 w-20 text-right flex-shrink-0">
                      {t('stats.gamesLabel', { count: r.count })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Flights par taille */}
            <div className={cardCls}>
              <p className={titleCls}>{t('stats.flightsBySize')}</p>
              <div className="space-y-2">
                {stats.bySize.map(r => (
                  <div key={r.n} className="flex items-center gap-3">
                    <span className="text-[12px] font-semibold text-slate-700 w-24 flex-shrink-0">
                      {t('stats.playersLabel', { count: r.n })}
                    </span>
                    <Bar value={r.count} max={maxBySize} color="#3B6D11" />
                    <span className="text-[12px] font-bold text-slate-800 w-20 text-right flex-shrink-0">
                      {t('stats.flightsLabel', { count: r.count })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Classement des joueurs */}
          <div className={cardCls}>
            <p className={titleCls}>{t('stats.ranking')}</p>
            <div className="space-y-1.5">
              {rankingShown.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-300 w-5 text-right flex-shrink-0">{i + 1}</span>
                  <span className="text-[12px] font-semibold text-slate-700 w-36 sm:w-48 truncate flex-shrink-0">{playerName(r.id)}</span>
                  <Bar value={r.count} max={maxRanking} color="#EF9F27" />
                  <span className="text-[12px] font-bold text-slate-800 w-16 text-right flex-shrink-0">
                    {t('stats.timesLabel', { count: r.count })}
                  </span>
                </div>
              ))}
            </div>
            {stats.ranking.length > 15 && (
              <button onClick={() => setShowAll(v => !v)}
                className="mt-3 text-[12px] font-semibold text-[#185FA5] hover:underline">
                {showAll ? t('stats.showLess') : t('stats.showAll', { count: stats.ranking.length })}
              </button>
            )}
          </div>

          {/* Répartition : combien de joueurs ont joué x fois */}
          <div className={cardCls}>
            <p className={titleCls}>{t('stats.playersByTimes')}</p>
            <div className="space-y-2">
              {stats.byTimes.map(r => (
                <div key={r.n} className="flex items-center gap-3">
                  <span className="text-[12px] font-semibold text-slate-700 w-24 flex-shrink-0">
                    {t('stats.timesLabel', { count: r.n })}
                  </span>
                  <Bar value={r.count} max={maxByTimes} color="#7F77DD" />
                  <span className="text-[12px] font-bold text-slate-800 w-20 text-right flex-shrink-0">
                    {t('stats.playersLabel', { count: r.count })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Détail des parties */}
          <div className={cardCls}>
            <p className={titleCls}>{t('stats.gamesList')}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-1.5 pr-3">{t('stats.colDate')}</th>
                    <th className="py-1.5 pr-3">{t('stats.colEvent')}</th>
                    <th className="py-1.5 pr-3 text-right">{t('stats.colPlayers')}</th>
                    <th className="py-1.5 text-right">{t('stats.colFlights')}</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map(g => (
                    <tr key={g.eventId} className="border-t border-slate-100">
                      <td className="py-1.5 pr-3 text-slate-500 whitespace-nowrap">{formatDate(g.date)}</td>
                      <td className="py-1.5 pr-3 font-semibold text-slate-700">{g.title}</td>
                      <td className="py-1.5 pr-3 text-right font-bold text-slate-800">{g.playerIds.length}</td>
                      <td className="py-1.5 text-right font-bold text-slate-800">{g.nbFlights}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

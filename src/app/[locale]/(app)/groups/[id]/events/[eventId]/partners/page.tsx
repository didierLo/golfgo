'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations, useLocale } from 'next-intl'

const supabase = createClient()

type Player = {
  id: string
  first_name: string
  surname: string
  whs: number | null
}

type PastRound = {
  eventId: string
  eventTitle: string
  date: string
  partners: Player[]
}

export default function PartnersPage() {
  const params  = useParams()
  const router  = useRouter()
  const groupId = params.id      as string
  const eventId = params.eventId as string
  const locale  = useLocale()

  const [me,          setMe]          = useState<Player | null>(null)
  const [allPlayers,  setAllPlayers]  = useState<Player[]>([])
  const [matrix,      setMatrix]      = useState<Record<string, number>>({})   // partnerId → count
  const [pastRounds,  setPastRounds]  = useState<PastRound[]>([])
  const [loading,     setLoading]     = useState(true)

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(locale, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      timeZone: 'UTC',
    })
  }
  function formatDateShort(d: string) {
    return new Date(d).toLocaleDateString(locale, {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    })
  }

  useEffect(() => { loadData() }, [eventId, groupId])

  async function loadData() {
    setLoading(true)

    // 1. Joueur courant
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { setLoading(false); return }

    const { data: playerRow } = await supabase
      .from('players')
      .select('id, first_name, surname, whs')
      .eq('user_id', user.id)
      .single()
    if (!playerRow) { setLoading(false); return }
    const myPlayer: Player = playerRow
    setMe(myPlayer)

    // 2. Tous les événements du groupe
    const { data: groupEvents } = await supabase
      .from('events')
      .select('id, title, starts_at')
      .eq('group_id', groupId)
      .order('starts_at', { ascending: false })
    const allEventIds = (groupEvents ?? []).map((e: any) => e.id)

    // 3. Tous les flights du groupe qui contiennent le joueur courant
    const { data: myFlightPlayers } = await supabase
      .from('flight_players')
      .select('flight_id')
      .eq('player_id', myPlayer.id)
    const myFlightIds = (myFlightPlayers ?? []).map((fp: any) => fp.flight_id)

    if (myFlightIds.length === 0) {
      setLoading(false)
      return
    }

    // 4. Tous les co-joueurs dans ces flights
    const { data: coPlayers } = await supabase
      .from('flight_players')
      .select('player_id, flight_id, flights(event_id, id)')
      .in('flight_id', myFlightIds)
      .neq('player_id', myPlayer.id)

    // 5. Détails des joueurs uniques rencontrés
    const uniquePartnerIds = [...new Set((coPlayers ?? []).map((cp: any) => cp.player_id))]
    const { data: partnerDetails } = await supabase
      .from('players')
      .select('id, first_name, surname, whs')
      .in('id', uniquePartnerIds)

    const playerMap: Record<string, Player> = {}
    for (const p of partnerDetails ?? []) playerMap[p.id] = p
    setAllPlayers(Object.values(playerMap).sort((a, b) =>
      `${a.first_name} ${a.surname}`.localeCompare(`${b.first_name} ${b.surname}`)
    ))

    // 6. Matrice : compte combien de fois joué avec chaque partenaire
    const counts: Record<string, number> = {}
    for (const cp of coPlayers ?? []) {
      counts[cp.player_id] = (counts[cp.player_id] ?? 0) + 1
    }
    setMatrix(counts)

    // 7. Historique : par événement, quels partenaires ?
    const flightsByEvent: Record<string, { flightId: string; eventId: string }[]> = {}
    for (const flightId of myFlightIds) {
      const fp = (coPlayers ?? []).find((cp: any) => cp.flight_id === flightId)
      const evId = (fp as any)?.flights?.event_id
      if (!evId) continue
      if (!flightsByEvent[evId]) flightsByEvent[evId] = []
      if (!flightsByEvent[evId].find(x => x.flightId === flightId)) {
        flightsByEvent[evId].push({ flightId, eventId: evId })
      }
    }

    // Construire la liste des parties
    const rounds: PastRound[] = []
    for (const evt of groupEvents ?? []) {
      const flightsForEvt = flightsByEvent[evt.id]
      if (!flightsForEvt?.length) continue
      const flightId = flightsForEvt[0].flightId
      const partners = (coPlayers ?? [])
        .filter((cp: any) => cp.flight_id === flightId)
        .map((cp: any) => playerMap[cp.player_id])
        .filter(Boolean) as Player[]
      rounds.push({
        eventId: evt.id,
        eventTitle: evt.title,
        date: evt.starts_at,
        partners,
      })
    }
    setPastRounds(rounds)
    setLoading(false)
  }

  // Valeur max de la matrice pour normaliser les couleurs
  const maxCount = Math.max(1, ...Object.values(matrix))

  function cellColor(count: number): string {
    if (!count) return 'bg-slate-50 text-slate-300'
    const intensity = count / maxCount
    if (intensity >= 0.8) return 'bg-[#185FA5] text-white'
    if (intensity >= 0.5) return 'bg-[#5B9BD5] text-white'
    if (intensity >= 0.25) return 'bg-[#B5D4F4] text-[#0C447C]'
    return 'bg-[#EBF3FC] text-[#185FA5]'
  }

  if (loading) return (
    <div className="p-6 space-y-3 max-w-3xl">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-16 bg-white/40 rounded-xl animate-pulse" />
      ))}
    </div>
  )

  if (!me) return (
    <div className="p-6 text-[13px] text-slate-500">Joueur introuvable.</div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-4xl">

      {/* ── En-tête ── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center w-8 h-8 rounded-xl border border-slate-200 bg-white/80 text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-all shadow-sm"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div>
          <h1 className="text-[20px] font-black text-slate-900 tracking-tight leading-none">Mes partenaires</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">{me.first_name} {me.surname}</p>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          PARTIE 1 — Matrice des partenaires
      ══════════════════════════════════════════ */}
      <section className="mb-8">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.14em] mb-3">
          Matrice des partenaires
        </p>

        {allPlayers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-[13px] text-slate-400">
            Aucune partie enregistrée pour le moment.
          </div>
        ) : (
          <div
            className="rounded-2xl border border-white/60 shadow-sm overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: `${allPlayers.length * 52 + 160}px` }}>
                <thead>
                  <tr>
                    {/* Cellule coin haut-gauche vide */}
                    <th className="w-40 min-w-[10rem]" />

                    {/* En-têtes colonnes — noms HORIZONTAUX corrigés */}
                    {allPlayers.map(p => (
                      <th
                        key={p.id}
                        className="px-1 pt-3 pb-2 text-center align-bottom"
                        style={{ width: 52, minWidth: 52 }}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span
                            className="text-[10px] font-bold text-slate-600 leading-tight"
                            style={{ writingMode: 'horizontal-tb' }}
                          >
                            {p.first_name}
                          </span>
                          <span
                            className="text-[9px] font-medium text-slate-400 leading-tight"
                            style={{ writingMode: 'horizontal-tb' }}
                          >
                            {p.surname}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {/* Une seule ligne : moi vs chaque partenaire */}
                  <tr className="border-t border-slate-100">
                    {/* Mon nom en ligne */}
                    <td className="px-4 py-3 border-r border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#185FA5] flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] font-bold text-white">
                            {me.first_name[0]}{me.surname[0]}
                          </span>
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-slate-900 leading-tight">{me.first_name} {me.surname}</p>
                          {me.whs !== null && (
                            <p className="text-[10px] text-slate-400">WHS {me.whs}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Cellules de la matrice */}
                    {allPlayers.map(p => {
                      const count = matrix[p.id] ?? 0
                      return (
                        <td key={p.id} className="p-1 text-center">
                          <div
                            className={`mx-auto w-9 h-9 rounded-lg flex items-center justify-center text-[12px] font-black transition-all ${cellColor(count)}`}
                          >
                            {count || '—'}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Légende */}
            <div className="flex items-center gap-3 px-4 py-3 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Légende</span>
              <div className="flex items-center gap-1.5">
                {[
                  { label: '1×', cls: 'bg-[#EBF3FC] text-[#185FA5]' },
                  { label: '2×', cls: 'bg-[#B5D4F4] text-[#0C447C]' },
                  { label: '3×', cls: 'bg-[#5B9BD5] text-white' },
                  { label: '4×+', cls: 'bg-[#185FA5] text-white' },
                ].map(({ label, cls }) => (
                  <div key={label} className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${cls}`}>
                    {label}
                  </div>
                ))}
              </div>
              <span className="text-[10px] text-slate-400 ml-auto">Nombre de parties jouées ensemble</span>
            </div>
          </div>
        )}
      </section>

      {/* ══════════════════════════════════════════
          PARTIE 2 — Mes parties (historique)
      ══════════════════════════════════════════ */}
      <section>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.14em] mb-3">
          Mes parties · {pastRounds.length} {pastRounds.length === 1 ? 'partie' : 'parties'}
        </p>

        {pastRounds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-[13px] text-slate-400">
            Aucune partie jouée pour l'instant.
          </div>
        ) : (
          <div className="space-y-2">
            {pastRounds.map(round => (
              <div
                key={round.eventId}
                className="rounded-2xl border border-white/60 shadow-sm px-4 py-3.5 flex items-start gap-4"
                style={{
                  background: round.eventId === eventId
                    ? 'rgba(235,243,252,0.95)'
                    : 'rgba(255,255,255,0.80)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  borderColor: round.eventId === eventId ? 'rgba(24,95,165,0.25)' : undefined,
                }}
              >
                {/* Date */}
                <div className="flex-shrink-0 w-28">
                  <p className="text-[11px] font-black text-slate-500 leading-tight">
                    {formatDateShort(round.date)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-tight line-clamp-2">
                    {round.eventTitle}
                  </p>
                  {round.eventId === eventId && (
                    <span className="inline-block mt-1 text-[9px] font-bold text-[#185FA5] bg-[#EBF3FC] px-1.5 py-0.5 rounded-md">
                      Cet événement
                    </span>
                  )}
                </div>

                {/* Séparateur */}
                <div className="w-px self-stretch bg-slate-100 flex-shrink-0" />

                {/* Partenaires */}
                <div className="flex flex-wrap gap-2 flex-1">
                  {round.partners.length === 0 ? (
                    <span className="text-[12px] text-slate-400 italic">Solo</span>
                  ) : (
                    round.partners.map(p => (
                      <div
                        key={p.id}
                        className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1"
                      >
                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-[8px] font-bold text-slate-500">
                            {p.first_name[0]}{p.surname[0]}
                          </span>
                        </div>
                        <span className="text-[12px] font-medium text-slate-800">
                          {p.first_name} {p.surname}
                        </span>
                        {p.whs !== null && (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1 py-0.5 rounded-md">
                            {p.whs}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

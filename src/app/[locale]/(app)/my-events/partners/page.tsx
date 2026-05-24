'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLocale } from 'next-intl'

const supabase = createClient()

type Player = { id: string; first_name: string; surname: string; whs: number | null }
type PastRound = { eventId: string; eventTitle: string; date: string; partners: Player[] }

export default function MyPartnersPage() {
  const router = useRouter()
  const locale = useLocale()

  const [me,         setMe]         = useState<Player | null>(null)
  const [partners,   setPartners]   = useState<Player[]>([])
  const [matrix,     setMatrix]     = useState<Record<string, number>>({})
  const [pastRounds, setPastRounds] = useState<PastRound[]>([])
  const [loading,    setLoading]    = useState(true)

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(locale, {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    })
  }
  function formatDateLong(d: string) {
    return new Date(d).toLocaleDateString(locale, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    })
  }

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)

    // 1. Joueur courant
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: playerRow } = await supabase.from('players')
      .select('id, first_name, surname, whs').eq('user_id', user.id).single()
    if (!playerRow) { setLoading(false); return }
    const me: Player = playerRow
    setMe(me)

    // 2. Tous les flight_ids où je suis
    const { data: myFP } = await supabase
      .from('flight_players')
      .select('flight_id')
      .eq('player_id', me.id)
    const myFlightIds = (myFP ?? []).map((r: any) => r.flight_id)
    if (!myFlightIds.length) { setLoading(false); return }

    // 3. Pour chaque flight, récupérer event_id depuis flights
    const { data: flightRows } = await supabase
      .from('flights')
      .select('id, event_id')
      .in('id', myFlightIds)

    // Map flight_id → event_id
    const flightToEvent: Record<string, string> = {}
    for (const f of flightRows ?? []) flightToEvent[f.id] = f.event_id

    // 4. Tous les co-joueurs dans ces flights (sauf moi)
    const { data: coFP } = await supabase
      .from('flight_players')
      .select('flight_id, player_id')
      .in('flight_id', myFlightIds)
      .neq('player_id', me.id)

    // 5. Détails des partenaires uniques
    const partnerIds = [...new Set((coFP ?? []).map((r: any) => r.player_id))]
    const { data: partnerRows } = await supabase
      .from('players')
      .select('id, first_name, surname, whs')
      .in('id', partnerIds)

    const playerMap: Record<string, Player> = {}
    for (const p of partnerRows ?? []) playerMap[p.id] = p

    setPartners(
      Object.values(playerMap).sort((a, b) =>
        `${a.first_name} ${a.surname}`.localeCompare(`${b.first_name} ${b.surname}`)
      )
    )

    // 6. Matrice : nombre de parties jouées avec chaque partenaire
    const counts: Record<string, number> = {}
    for (const fp of coFP ?? []) {
      counts[fp.player_id] = (counts[fp.player_id] ?? 0) + 1
    }
    setMatrix(counts)

    // 7. Historique : regrouper par event_id
    // Pour chaque flight où je suis, trouver l'event et les partenaires
    const eventIds = [...new Set(Object.values(flightToEvent))]
    const { data: eventRows } = await supabase
      .from('events')
      .select('id, title, starts_at')
      .in('id', eventIds)
      .order('starts_at', { ascending: false })

    // Par flight, quels partenaires ?
    const coByFlight: Record<string, Player[]> = {}
    for (const fp of coFP ?? []) {
      if (!coByFlight[fp.flight_id]) coByFlight[fp.flight_id] = []
      const p = playerMap[fp.player_id]
      if (p) coByFlight[fp.flight_id].push(p)
    }

    // Par event, prendre le premier flight qui me contient
    const rounds: PastRound[] = []
    for (const evt of eventRows ?? []) {
      // Trouver un flight de cet event où je joue
      const flightId = myFlightIds.find(fid => flightToEvent[fid] === evt.id)
      if (!flightId) continue
      rounds.push({
        eventId:    evt.id,
        eventTitle: evt.title,
        date:       evt.starts_at,
        partners:   coByFlight[flightId] ?? [],
      })
    }
    setPastRounds(rounds)
    setLoading(false)
  }

  const maxCount = Math.max(1, ...Object.values(matrix))

  function cellBg(count: number) {
    if (!count) return { background: '#F8FAFC', color: '#CBD5E1' }
    const i = count / maxCount
    if (i >= 0.75) return { background: '#185FA5', color: 'white' }
    if (i >= 0.5)  return { background: '#5B9BD5', color: 'white' }
    if (i >= 0.25) return { background: '#B5D4F4', color: '#0C447C' }
    return { background: '#EBF3FC', color: '#185FA5' }
  }

  if (loading) return (
    <div className="p-6 space-y-3 max-w-3xl">
      {[1,2,3,4].map(i => <div key={i} className="h-16 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )

  if (!me) return (
    <div className="p-6 text-[13px] text-slate-500">Joueur introuvable.</div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-4xl">

      {/* En-tête */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()}
          className="flex items-center justify-center w-8 h-8 rounded-xl border border-slate-200 bg-white/80 text-slate-500 hover:text-slate-800 transition-all shadow-sm">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div>
          <h1 className="text-[20px] font-black text-slate-900 tracking-tight leading-none">Mes partenaires</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">{me.first_name} {me.surname}</p>
        </div>
      </div>

      {/* ══ PARTIE 1 : Matrice ══ */}
      <section className="mb-8">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.14em] mb-3">
          Matrice des partenaires
        </p>

        {partners.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-[13px] text-slate-400">
            Aucune partie enregistrée.
          </div>
        ) : (
          <div className="rounded-2xl border border-white/60 shadow-sm overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
            <div className="overflow-x-auto">
              <table className="border-collapse" style={{ minWidth: `${partners.length * 56 + 180}px` }}>
                <thead>
                  <tr>
                    {/* Coin vide */}
                    <th className="w-44" />
                    {/* Noms en colonnes — horizontaux */}
                    {partners.map(p => (
                      <th key={p.id} className="px-1 pt-3 pb-2 text-center align-bottom" style={{ width: 56, minWidth: 56 }}>
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[10px] font-bold text-slate-700 leading-tight">{p.first_name}</span>
                          <span className="text-[9px] font-medium text-slate-400 leading-tight">{p.surname}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100">
                    {/* Mon nom */}
                    <td className="px-4 py-3 border-r border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#185FA5] flex items-center justify-center flex-shrink-0">
                          <span className="text-[9px] font-bold text-white">
                            {me.first_name[0]}{me.surname[0]}
                          </span>
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-slate-900 leading-tight">{me.first_name} {me.surname}</p>
                          {me.whs !== null && <p className="text-[10px] text-slate-400">WHS {me.whs}</p>}
                        </div>
                      </div>
                    </td>
                    {/* Cellules */}
                    {partners.map(p => {
                      const count = matrix[p.id] ?? 0
                      const style = cellBg(count)
                      return (
                        <td key={p.id} className="p-1 text-center">
                          <div className="mx-auto w-10 h-10 rounded-lg flex items-center justify-center text-[12px] font-black transition-all"
                            style={style}>
                            {count || '—'}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        )}
      </section>

      {/* ══ PARTIE 2 : Mes parties ══ */}
      <section>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.14em] mb-3">
          Mes parties · {pastRounds.length} {pastRounds.length === 1 ? 'partie' : 'parties'}
        </p>

        {pastRounds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-[13px] text-slate-400">
            Aucune partie enregistrée.
          </div>
        ) : (
          <div className="space-y-2">
            {pastRounds.map(round => (
              <div key={round.eventId}
                className="rounded-2xl border border-white/60 shadow-sm px-4 py-3.5 flex flex-col gap-2.5"
                style={{ background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>

                {/* Date + titre */}
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-black text-slate-700 leading-tight">{formatDate(round.date)}</p>
                  <span className="text-slate-300">·</span>
                  <p className="text-[11px] text-slate-400 leading-tight truncate">{round.eventTitle}</p>
                </div>

                {/* Partenaires */}
                <div className="flex flex-wrap gap-2">
                  {round.partners.length === 0 ? (
                    <span className="text-[12px] text-slate-400 italic">Solo</span>
                  ) : round.partners.map(p => (
                    <div key={p.id} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5">
                      <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-[8px] font-bold text-slate-500">{p.first_name[0]}{p.surname[0]}</span>
                      </div>
                      <span className="text-[12px] font-medium text-slate-800">{p.first_name} {p.surname}</span>
                      {p.whs !== null && (
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1 py-0.5 rounded-md">{p.whs}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

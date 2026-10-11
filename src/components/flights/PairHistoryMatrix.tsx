'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { buildPairHistory } from '@/lib/golf/flights/formats/simple'
import { pairKey } from '@/lib/utils/pairs'

type Props = {
  /** Flights actuellement affichés (générés ou modifiés à la main) : seuls leurs joueurs figurent dans la matrice */
  flights: any[]
  /** Flights des autres événements du groupe : { date, players: [{ id }] } */
  pastFlights: any[]
  /** Date de l'événement en cours (sert à pondérer : plus c'est proche, plus c'est foncé) */
  referenceDate?: string | null
  /** Période d'historique choisie (jours) : 0 = aucun */
  historyWindow: number
}

const WINDOW_KEY: Record<number, string> = { 0: 'none', 30: '30d', 90: '3m', 180: '6m', 365: '1y' }

function shortName(p: any) {
  const s = (p.surname ?? '').trim()
  return `${p.first_name ?? ''} ${s ? s[0] + '.' : ''}`.trim()
}

export default function PairHistoryMatrix({ flights, pastFlights, referenceDate, historyWindow }: Props) {
  const t = useTranslations()
  const [open, setOpen] = useState(true)

  const history = useMemo(
    () => buildPairHistory(pastFlights, referenceDate),
    [pastFlights, referenceDate]
  )

  // Ordre des lignes/colonnes : joueurs flight par flight (les flights forment des blocs
  // le long de la diagonale). Seuls les joueurs placés dans un flight apparaissent.
  const { ordered, flightOf } = useMemo(() => {
    const flightOf = new Map<string, number>()
    const ordered: any[] = []
    const sortedFlights = [...flights].sort((a: any, b: any) => a.flight_no - b.flight_no)
    for (const f of sortedFlights) {
      for (const p of (Array.isArray(f.players) ? f.players : [])) {
        if (!p?.id || flightOf.has(p.id)) continue
        flightOf.set(p.id, f.flight_no)
        ordered.push(p)
      }
    }
    return { ordered, flightOf }
  }, [flights])

  if (ordered.length === 0) return null

  const windowLabel = t(`flights.historyOptions.${WINDOW_KEY[historyWindow] ?? '6m'}`)

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest on-bg">
          {t('flights.pairMatrix.title')}
          <span className="ml-2 normal-case font-semibold text-slate-400">· {windowLabel}</span>
        </p>
        <button type="button" onClick={() => setOpen(v => !v)}
          className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">
          {open ? t('flights.pairMatrix.hide') : t('flights.pairMatrix.show')}
        </button>
      </div>

      {open && (
        historyWindow === 0 ? (
          <p className="text-[12px] text-slate-500 on-bg">{t('flights.pairMatrix.noHistory')}</p>
        ) : (
          <>
            <p className="text-[11px] text-slate-500 mb-3 on-bg">{t('flights.pairMatrix.hint')}</p>

            <div className="overflow-auto max-h-[70vh] rounded-xl border border-slate-200 bg-white">
              <table className="border-separate border-spacing-0 text-[11px]">
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-30 bg-white border-b border-slate-100" />
                    {ordered.map((c: any) => (
                      <th key={c.id}
                        className="sticky top-0 z-20 bg-white border-b border-slate-100 px-0 pb-1 pt-2 font-semibold text-slate-600 align-bottom">
                        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                          className="whitespace-nowrap mx-auto h-[84px] text-left">
                          {shortName(c)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((r: any) => (
                    <tr key={r.id}>
                      <th className="sticky left-0 z-10 bg-white border-b border-slate-50 px-3 py-0.5 text-left font-semibold text-slate-700 whitespace-nowrap">
                        {shortName(r)}
                        {flightOf.has(r.id) && (
                          <span className="ml-1.5 text-[10px] font-medium text-slate-400">F{flightOf.get(r.id)}</span>
                        )}
                      </th>
                      {ordered.map((c: any) => {
                        if (r.id === c.id) {
                          return <td key={c.id} className="w-7 h-7 min-w-[28px] bg-slate-200 border-b border-slate-50" />
                        }
                        const e = history.get(pairKey(r.id, c.id))
                        const count = e?.count ?? 0
                        const same  = flightOf.has(r.id) && flightOf.get(r.id) === flightOf.get(c.id)
                        const alpha = count > 0 ? 0.12 + 0.55 * Math.min(1, e!.weight) : 0
                        const ring  = same ? (count === 0 ? '#3B6D11' : '#A32D2D') : null
                        return (
                          <td key={c.id}
                            className="w-7 h-7 min-w-[28px] text-center border-b border-slate-50"
                            style={{
                              background: count > 0 ? `rgba(24,95,165,${alpha.toFixed(2)})` : undefined,
                              color: alpha > 0.45 ? '#ffffff' : '#334155',
                              boxShadow: ring ? `inset 0 0 0 2px ${ring}` : undefined,
                              fontWeight: same ? 700 : 500,
                            }}>
                            {count > 0 ? count : <span className="text-slate-300">·</span>}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}
    </div>
  )
}

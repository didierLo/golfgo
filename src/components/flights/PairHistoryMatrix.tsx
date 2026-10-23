'use client'

import { useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { buildPairHistory } from '@/lib/golf/flights/formats/simple'
import { pairKey } from '@/lib/utils/pairs'

type Props = {
  /** Flights actuellement affichés (générés ou modifiés à la main) : un petit tableau par flight */
  flights: any[]
  /** Flights des autres événements du groupe : { date, players: [{ id }] } */
  pastFlights: any[]
  /** Date de l'événement en cours (sert à donner plus de poids aux parties proches) */
  referenceDate?: string | null
  /** Période d'historique choisie (jours) : 0 = aucun */
  historyWindow: number
}

const WINDOW_KEY: Record<number, string> = { 0: 'none', 30: '30d', 90: '3m', 180: '6m', 365: '1y' }

// Couleur d'un carré : vert seulement pour « jamais joué ensemble » ; sinon la couleur dépend de la date de la
// dernière rencontre de la paire (par rapport à la date de l'événement) : rouge très récent → orange → jaune → sable.
// Jamais de vert pour une paire qui a déjà joué ensemble, même il y a longtemps.
const RECENCY_BANDS: { maxDays: number; background: string; color: string; border: string }[] = [
  { maxDays: 7,        background: '#D94040', color: '#FFFFFF', border: '1px solid #B92E2E' },   // ≤ 1 semaine
  { maxDays: 14,       background: '#F59E42', color: '#5C2E00', border: '1px solid #D9822A' },   // ≤ 2 semaines
  { maxDays: 21,       background: '#F8C15A', color: '#5C3D00', border: '1px solid #DDA43C' },   // ≤ 3 semaines
  { maxDays: 31,       background: '#FBE28F', color: '#5C4A00', border: '1px solid #E4C766' },   // ≤ 1 mois
  { maxDays: 62,       background: '#FDF1C7', color: '#6B5A1E', border: '1px solid #EBDDA4' },   // ≤ 2 mois
  { maxDays: Infinity, background: '#F1EBDD', color: '#6B6250', border: '1px solid #DDD4BF' },   // plus ancien
]

function cellStyle(count: number, daysAway: number | null): { background: string; color: string; border: string } {
  if (count === 0) return { background: '#EAF3DE', color: '#3B6D11', border: '1px solid #C0DD97' }
  const band = daysAway === null ? RECENCY_BANDS[RECENCY_BANDS.length - 1] : (RECENCY_BANDS.find(b => daysAway <= b.maxDays) ?? RECENCY_BANDS[RECENCY_BANDS.length - 1])
  return { background: band.background, color: band.color, border: band.border }
}

function shortName(p: any) {
  const s = (p.surname ?? '').trim()
  return `${p.first_name ?? ''} ${s ? s[0] + '.' : ''}`.trim()
}

export default function PairHistoryMatrix({ flights, pastFlights, referenceDate, historyWindow }: Props) {
  const t = useTranslations()
  const locale = useLocale()
  const [open, setOpen] = useState(true)

  const history = useMemo(
    () => buildPairHistory(pastFlights, referenceDate),
    [pastFlights, referenceDate]
  )

  // Un bloc par flight (au moins 2 joueurs), avec le nombre de paires nouvelles.
  const blocks = useMemo(() => {
    return [...flights]
      .sort((a: any, b: any) => a.flight_no - b.flight_no)
      .map((f: any) => {
        const ps: any[] = (Array.isArray(f.players) ? f.players : []).filter((p: any) => p?.id)
        let total = 0, fresh = 0
        for (let i = 0; i < ps.length; i++) {
          for (let j = i + 1; j < ps.length; j++) {
            total++
            if (!history.has(pairKey(ps[i].id, ps[j].id))) fresh++
          }
        }
        return { flight_no: f.flight_no, label: f.groupLabel ?? null, players: ps, total, fresh }
      })
      .filter(b => b.players.length >= 2)
  }, [flights, history])

  if (blocks.length === 0) return null

  const totalPairs = blocks.reduce((s, b) => s + b.total, 0)
  const totalFresh = blocks.reduce((s, b) => s + b.fresh, 0)
  const windowLabel = t(`flights.historyOptions.${WINDOW_KEY[historyWindow] ?? '6m'}`)

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-2 gap-3">
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
            {/* Légende */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-2">
              <span className="inline-flex items-center gap-2 text-[12px] font-medium text-slate-700">
                <span className="w-6 h-6 rounded-md flex items-center justify-center text-[12px] font-bold"
                  style={cellStyle(0, 0)}>0</span>
                {t('flights.pairMatrix.legendNew')}
              </span>
              {[
                { band: 0, label: t('flights.pairMatrix.legendWeeks', { count: 1 }) },
                { band: 1, label: t('flights.pairMatrix.legendWeeks', { count: 2 }) },
                { band: 2, label: t('flights.pairMatrix.legendWeeks', { count: 3 }) },
                { band: 3, label: t('flights.pairMatrix.legendMonths', { count: 1 }) },
                { band: 4, label: t('flights.pairMatrix.legendMonths', { count: 2 }) },
                { band: 5, label: t('flights.pairMatrix.legendOlder') },
              ].map(({ band, label }) => (
                <span key={band} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-700">
                  <span className="w-5 h-5 rounded-md"
                    style={{ background: RECENCY_BANDS[band].background, border: RECENCY_BANDS[band].border }} />
                  {band < 5 ? `≤ ${label}` : label}
                </span>
              ))}
              <span className="text-[12px] font-semibold text-slate-600">
                · {t('flights.pairMatrix.newPairs', { fresh: totalFresh, total: totalPairs })}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-3 on-bg">{t('flights.pairMatrix.hint')}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {blocks.map(b => {
                const cols = b.players.slice(0, -1)   // colonnes : tous sauf le dernier
                const rows = b.players.slice(1)       // lignes : tous sauf le premier
                return (
                  <div key={b.flight_no} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                      <span className="text-[13px] font-bold text-slate-800">
                        Flight {b.flight_no}{b.label ? ` · ${b.label}` : ''}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        b.fresh === b.total ? 'bg-[#EAF3DE] text-[#3B6D11]' : 'bg-amber-50 text-amber-700'}`}>
                        {t('flights.pairMatrix.newPairs', { fresh: b.fresh, total: b.total })}
                      </span>
                    </div>

                    <div className="p-3 overflow-x-auto">
                      <table className="border-separate" style={{ borderSpacing: 3 }}>
                        <thead>
                          <tr>
                            <th />
                            {cols.map((c: any) => (
                              <th key={c.id} className="font-semibold text-[11px] text-slate-600 align-bottom px-0">
                                <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                                  className="whitespace-nowrap mx-auto h-[78px] text-left">
                                  {shortName(c)}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r: any, ri: number) => (
                            <tr key={r.id}>
                              <th className="text-right pr-2 text-[12px] font-semibold text-slate-700 whitespace-nowrap">
                                {shortName(r)}
                              </th>
                              {cols.map((c: any, ci: number) => {
                                // triangle : on ne montre que les paires (ligne i+1, colonne j) avec j ≤ i
                                if (ci > ri) return <td key={c.id} />
                                const e = history.get(pairKey(r.id, c.id))
                                const count = e?.count ?? 0
                                return (
                                  <td key={c.id}>
                                    <div title={`${shortName(c)} × ${shortName(r)} — ${count}×${e?.lastDate != null ? ` — ${t('flights.pairMatrix.lastTogether', { date: new Date(e.lastDate).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) })}` : ''}`}
                                      className="w-9 h-9 rounded-md flex items-center justify-center text-[14px] font-bold"
                                      style={cellStyle(count, e?.daysAway ?? null)}>
                                      {count}
                                    </div>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )
      )}
    </div>
  )
}

'use client'

import { useTranslations } from 'next-intl'
import type { FlightPositionPref, PositionCheck } from '@/lib/golf/flights/positionPrefs'

/**
 * Petit badge à côté du nom d'un joueur qui souhaite partir en 1er ou en dernier flight.
 *  - sans `check` (joueur pas encore placé dans un flight) : badge bleu neutre ;
 *  - souhait respecté : vert avec ✓ ;
 *  - souhait non respecté : rouge avec ⚠ (le symbole reste lisible sans distinguer les couleurs).
 * Masqué à l'impression.
 */
export function PositionPrefBadge({ pref, check }: { pref: FlightPositionPref; check?: PositionCheck }) {
  const t = useTranslations()
  const label = pref === 'first' ? t('flightPositionPref.badgeFirst') : t('flightPositionPref.badgeLast')

  const state = !check ? 'neutral' : check.ok ? 'ok' : 'ko'
  const symbol = state === 'ok' ? '✓' : state === 'ko' ? '⚠' : pref === 'first' ? '↑' : '↓'
  const cls =
    state === 'ok' ? 'bg-[#EAF3DE] text-[#3B6D11]'
    : state === 'ko' ? 'bg-[#FCEBEB] text-[#A32D2D]'
    : 'bg-[#EBF3FC] text-[#185FA5]'

  let title: string
  if (state === 'ko') {
    title = pref === 'first'
      ? t('flightPositionPref.koTitleFirst', { flight: check!.flightNumber })
      : t('flightPositionPref.koTitleLast',  { flight: check!.flightNumber })
  } else if (state === 'ok') {
    title = t('flightPositionPref.okTitle')
  } else {
    title = pref === 'first' ? t('flightPositionPref.wantsFirst') : t('flightPositionPref.wantsLast')
  }

  return (
    <span title={title}
      className={`print:hidden text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap ${cls}`}>
      {symbol} {label}
    </span>
  )
}

/** Bandeau rouge listant les souhaits de position qui ne sont plus respectés. Rien n'est affiché s'il n'y en a pas. */
export function PositionPrefWarning({ violations, className = '' }: { violations: PositionCheck[]; className?: string }) {
  const t = useTranslations()
  if (violations.length === 0) return null

  return (
    <div role="alert" className={`print:hidden rounded-xl border border-[#F7C1C1] bg-[#FCEBEB] px-4 py-3 ${className}`}>
      <p className="text-[12px] font-bold text-[#A32D2D]">
        ⚠ {t('flightPositionPref.warningTitle', { count: violations.length })}
      </p>
      <ul className="mt-1.5 space-y-0.5">
        {violations.map(v => (
          <li key={v.playerId} className="text-[12px] text-[#A32D2D]">
            {v.pref === 'first'
              ? t('flightPositionPref.warningFirst', { name: v.name, flight: v.flightNumber })
              : t('flightPositionPref.warningLast',  { name: v.name, flight: v.flightNumber })}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-[#A32D2D]/80 mt-1.5">{t('flightPositionPref.warningHint')}</p>
    </div>
  )
}

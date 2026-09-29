'use client'

// ─── ScorecardCell ────────────────────────────────────────────────────────────
// Trou pas encore saisi : le par s'affiche en gris.
//   − → par - 1   |   + → par + 1   |   toucher le chiffre gris → par
// (avant : le bouton − restait grisé tant qu'on n'avait pas appuyé sur +)

type CellProps = {
  value: number | null
  defaultValue?: number
  onDecrement?: () => void
  onIncrement?: () => void
  onSetDefault?: () => void
  readOnly?: boolean
}

export function ScorecardCell({ value, defaultValue, onDecrement, onIncrement, onSetDefault, readOnly = false }: CellProps) {
  const hasValue = value != null && value > 0
  const canDecrement = hasValue ? value! > 1 : (defaultValue ?? 0) > 1

  if (readOnly) {
    return (
      <div className="flex items-center justify-center">
        <span className={`w-10 text-center font-bold text-[13px] rounded-lg py-1 ${
          hasValue ? 'bg-amber-100 text-slate-800' : 'bg-slate-50 text-slate-300'
        }`}>
          {hasValue ? value : (defaultValue ?? '·')}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <button type="button" onClick={onDecrement} disabled={!canDecrement}
        className="w-8 h-8 rounded-lg bg-[#EBF3FC] text-[#185FA5] font-black text-lg hover:bg-blue-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center leading-none transition-colors">
        −
      </button>
      {hasValue ? (
        <span className="w-10 text-center font-bold text-[13px] rounded-lg py-1 bg-amber-100 text-slate-800">
          {value}
        </span>
      ) : (
        <button type="button" onClick={onSetDefault}
          className="w-10 text-center font-bold text-[13px] rounded-lg py-1 bg-slate-50 text-slate-400 border border-dashed border-slate-300 hover:bg-amber-50">
          {defaultValue ?? '·'}
        </button>
      )}
      <button type="button" onClick={onIncrement}
        className="w-8 h-8 rounded-lg bg-[#EBF3FC] text-[#185FA5] font-black text-lg hover:bg-blue-200 flex items-center justify-center leading-none transition-colors">
        +
      </button>
    </div>
  )
}

export default ScorecardCell


// ─── ScorecardTable ───────────────────────────────────────────────────────────
// Note: ScorecardTable is kept in its own file (ScorecardTable.tsx)
// This file exports ScorecardCell only — import ScorecardTable from './ScorecardTable'

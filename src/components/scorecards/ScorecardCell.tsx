'use client'

// ─── ScorecardCell ────────────────────────────────────────────────────────────

type CellProps = { 
  value: number | null
  defaultValue?: number  // ← nouveau
  onDecrement?: () => void
  onIncrement?: () => void
  readOnly?: boolean 
}

export function ScorecardCell({ value, defaultValue, onDecrement, onIncrement, readOnly = false }: CellProps) {
  const hasValue = value != null && value > 0

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
      <button onClick={onDecrement} disabled={!hasValue}
        className="w-8 h-8 rounded-lg bg-[#EBF3FC] text-[#185FA5] font-black text-lg hover:bg-blue-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center leading-none transition-colors">
        −
      </button>
      <span className={`w-10 text-center font-bold text-[13px] rounded-lg py-1 ${
        hasValue ? 'bg-amber-100 text-slate-800' : 'bg-slate-50 text-slate-400'
      }`}>
        {hasValue ? value : (defaultValue ?? '·')}
      </span>
      <button onClick={onIncrement}
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

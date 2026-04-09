'use client'

type Props = {
  value: number | null
  onDecrement?: () => void
  onIncrement?: () => void
  readOnly?: boolean
}

export default function ScorecardCell({ value, onDecrement, onIncrement, readOnly = false }: Props) {
  const hasValue = value != null && value > 0

  if (readOnly) {
    return (
      <div className="flex items-center justify-center">
        <span className={`w-10 text-center font-semibold text-sm rounded-lg py-1
          ${hasValue ? 'bg-yellow-100 text-gray-800' : 'bg-gray-50 text-gray-300'}`}>
          {hasValue ? value : '·'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={onDecrement}
        disabled={!hasValue}
        className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-bold text-lg
                   hover:bg-blue-200 disabled:opacity-30 disabled:cursor-not-allowed
                   flex items-center justify-center leading-none transition-colors"
      >
        −
      </button>

      <span className={`w-10 text-center font-semibold text-sm rounded-lg py-1
        ${hasValue ? 'bg-yellow-100 text-gray-800' : 'bg-blue-50 text-transparent'}`}>
        {hasValue ? value : '·'}
      </span>

      <button
        onClick={onIncrement}
        className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-bold text-lg
                   hover:bg-blue-200 flex items-center justify-center leading-none transition-colors"
      >
        +
      </button>
    </div>
  )
}

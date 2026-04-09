'use client'

type Props = {
  onYes: () => void
  onNo: () => void
  onReset: () => void
}

export default function ParticipantButtons({
  onYes,
  onNo,
  onReset
}:Props){

  return(

    <div className="flex gap-3 text-sm">

      <button
        type="button"
        onClick={onYes}
        className="text-green-600 hover:underline"
      >
        YES
      </button>

      <button
        type="button"
        onClick={onNo}
        className="text-red-600 hover:underline"
      >
        NO
      </button>

      <button
        type="button"
        onClick={onReset}
        className="text-gray-600 hover:underline"
      >
        RESET
      </button>

    </div>

  )
}
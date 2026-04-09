'use client'

type Props = {
  
  onView?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export default function CrudButtons({ onView, onEdit, onDelete }: Props) {

  return (

    <div className="inline-flex rounded-lg border overflow-hidden">

        <button
        onClick={onView}
        className="px-4 py-1 text-sm bg-white text-blue-600 hover:bg-blue-50"
      >
        View
      </button>

      <button
        onClick={onEdit}
        className="px-4 py-1 text-sm bg-white text-yellow-600 hover:bg-yellow-50"
      >
        Edit
      </button>

      <button
        onClick={onDelete}
        className="px-4 py-1 text-sm bg-white text-red-600 hover:bg-red-50"
      >
        Delete
      </button>

    </div>

  )

}
'use client'

type Club = {
  id: string
  name: string
}

type Props = {
  clubs: Club[]
  value: string | null
  onChange: (clubId: string | null) => void
}

export default function ClubSelect({ clubs, value, onChange }: Props) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">Club</label>

      <select
        className="border p-2 w-full"
        value={value ?? ''}
        onChange={(e) =>
          onChange(e.target.value === '' ? null : e.target.value)
        }
      >
        <option value="">Select a club</option>

        {clubs.map((club) => (
          <option key={club.id} value={club.id}>
            {club.name}
          </option>
        ))}
      </select>
    </div>
  )
}
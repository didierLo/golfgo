'use client'

type Club = { id: string; name: string }

type Props = {
  clubs: Club[]
  value: string | null
  onChange: (clubId: string | null) => void
}

export default function ClubSelect({ clubs, value, onChange }: Props) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Club</label>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : e.target.value)}
        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5]"
      >
        <option value="">Sélectionner un club</option>
        {clubs.map(club => (
          <option key={club.id} value={club.id}>{club.name}</option>
        ))}
      </select>
    </div>
  )
}

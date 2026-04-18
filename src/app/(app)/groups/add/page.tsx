'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

const GROUP_COLORS = [
  '#378ADD', '#EF9F27', '#7F77DD',
  '#1D9E75', '#D85A30', '#D4537E',
]

const inputClass = "w-full border border-white/60 rounded-xl px-3 py-2.5 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] bg-white/70 backdrop-blur-sm"

export default function AddGroupPage() {
  const router = useRouter()

  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor]             = useState(GROUP_COLORS[0])
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Le nom est requis'); return }
    setSaving(true); setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Non connecté'); setSaving(false); return }

    const { data: group, error: insertError } = await supabase
      .from('groups')
      .insert({ name: name.trim(), description: description.trim() || null, color, owner_id: user.id })
      .select('id').single()

    if (insertError || !group) {
      setError(insertError?.message ?? 'Erreur création groupe')
      setSaving(false); return
    }

    const { data: player } = await supabase.from('players').select('id').eq('user_id', user.id).single()
    if (player) {
      await supabase.from('groups_players').upsert({
        group_id: group.id, player_id: player.id, role: 'owner', user_id: user.id,
      }, { onConflict: 'group_id,player_id' })
    }

    window.location.href = `/groups/${group.id}/members`
  }

  return (
    <div className="p-5 sm:p-6 max-w-lg">
      <div className="mb-6">
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Nouveau groupe</h1>
        <p className="text-[13px] text-slate-600 mt-0.5">Crée un groupe pour organiser tes événements</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Nom du groupe *</label>
          <input value={name} onChange={e => setName(e.target.value)} required
            placeholder="Ex: SudEst Cat 1 Vert 2026" className={inputClass} />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
            Description <span className="text-slate-400 font-normal">— optionnel</span>
          </label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={2} placeholder="Ex: Groupe de golf du jeudi soir"
            className={`${inputClass} resize-none`} />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-2">Couleur du groupe</label>
          <div className="flex gap-2.5">
            {GROUP_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full transition-transform hover:scale-110 flex-shrink-0"
                style={{ background: c, outline: color === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }} />
            ))}
          </div>
        </div>

        {error && <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>}

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving}
            className="bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
            {saving ? 'Création…' : 'Créer le groupe'}
          </button>
          <button type="button" onClick={() => router.push('/groups')}
            className="text-[13px] font-semibold px-5 py-2.5 rounded-xl border border-white/50 text-slate-600 hover:bg-white/30 transition-colors">
            Annuler
          </button>
        </div>
      </form>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

const GROUP_COLORS = [
  '#378ADD', '#EF9F27', '#7F77DD',
  '#1D9E75', '#D85A30', '#D4537E',
]

const inputClass = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] bg-white"

export default function EditGroupPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [name, setName]               = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor]             = useState(GROUP_COLORS[0])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)

  useEffect(() => { fetchGroup() }, [])

  async function fetchGroup() {
    const { data, error } = await supabase
      .from('groups').select('name, description, color').eq('id', id).single()
    if (error) { alert(error.message); router.push('/groups'); return }
    setName(data.name)
    setDescription(data.description || '')
    setColor(data.color ?? GROUP_COLORS[0])
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { alert('Le nom est requis'); return }
    setSaving(true)
    const { error } = await supabase
      .from('groups')
      .update({ name: name.trim(), description: description.trim() || null, color })
      .eq('id', id)
    if (error) { alert(error.message); setSaving(false); return }
    router.push('/groups')
  }

  if (loading) return (
    <div className="p-6 space-y-3 max-w-lg">
      {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-lg">
      <div className="mb-6">
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Modifier le groupe</h1>
        <p className="text-[13px] text-slate-900 mt-0.5">{name}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Nom du groupe *</label>
          <input value={name} onChange={e => setName(e.target.value)} required className={inputClass} />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={3} className={`${inputClass} resize-none`} />
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

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving}
            className="bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Sauvegarder'}
          </button>
          <button type="button" onClick={() => router.push('/groups')}
            className="text-[13px] font-semibold px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            Annuler
          </button>
        </div>
      </form>
    </div>
  )
}

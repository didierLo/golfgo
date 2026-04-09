'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export type PlayerFormData = {
  surname: string
  first_name: string
  federal_no: string
  whs: string
  email: string
  phone: string
  home_club: string
  gender: 'M' | 'F'
  default_tee_color: 'yellow' | 'red' | 'white' | 'blue'
}

type Props = {
  initialData?: Partial<PlayerFormData>
  playerId?: string
  onSubmit: (data: any) => Promise<void>
  submitLabel?: string
}

const TEE_OPTIONS: { value: PlayerFormData['default_tee_color']; label: string; color: string }[] = [
  { value: 'yellow', label: 'Yellow', color: '#EF9F27' },
  { value: 'red',    label: 'Red',    color: '#E24B4A' },
  { value: 'white',  label: 'White',  color: '#B4B2A9' },
  { value: 'blue',   label: 'Blue',   color: '#378ADD' },
]

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

const inputClass = "w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] placeholder-gray-300 focus:outline-none focus:border-blue-300"

export default function PlayerForm({ initialData, playerId, onSubmit, submitLabel = 'Sauvegarder' }: Props) {

  const empty: PlayerFormData = {
    surname: '', first_name: '', federal_no: '',
    whs: '', email: '', phone: '', home_club: '',
    gender: 'M', default_tee_color: 'yellow',
  }

  const [form, setForm] = useState<PlayerFormData>({ ...empty, ...initialData })
  const [loading, setLoading] = useState(false)
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([])
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])

  useEffect(() => {
    if (initialData) setForm({ ...empty, ...initialData })
    loadGroups()
    if (playerId) loadPlayerGroups()
  }, [playerId])

  async function loadGroups() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('groups').select('id, name').eq('owner_id', user.id)
    setGroups(data ?? [])
  }

  async function loadPlayerGroups() {
    const { data } = await supabase.from('groups_players').select('group_id').eq('player_id', playerId)
    setSelectedGroups((data ?? []).map((g: any) => g.group_id))
  }

  function update<K extends keyof PlayerFormData>(field: K, value: PlayerFormData[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function setGender(gender: 'M' | 'F') {
    setForm(prev => ({
      ...prev,
      gender,
      default_tee_color: gender === 'M' ? 'yellow' : 'red',
    }))
  }

  function toggleGroup(groupId: string) {
    setSelectedGroups(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.surname.trim() || !form.first_name.trim()) { alert('Nom et prénom requis'); return }
    if (!form.federal_no.trim()) { alert('Numéro fédéral obligatoire'); return }

    setLoading(true)
    await onSubmit({
      surname:           form.surname.trim(),
      first_name:        form.first_name.trim(),
      federal_no:        form.federal_no.trim().toUpperCase(),
      whs:               form.whs ? parseFloat(form.whs.replace(',', '.')) : null,
      email:             form.email.trim() || null,
      phone:             form.phone.trim() || null,
      home_club:         form.home_club.trim() || null,
      gender:            form.gender,
      default_tee_color: form.default_tee_color,
      groups:            selectedGroups,
    })
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* Nom / Prénom */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nom *">
          <input value={form.surname} onChange={e => update('surname', e.target.value)}
            placeholder="Dupont" required className={inputClass} />
        </Field>
        <Field label="Prénom *">
          <input value={form.first_name} onChange={e => update('first_name', e.target.value)}
            placeholder="Jean" required className={inputClass} />
        </Field>
      </div>

      {/* N° fédéral / WHS */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="N° fédéral *">
          <input value={form.federal_no} onChange={e => update('federal_no', e.target.value)}
            placeholder="123456" required className={inputClass} />
        </Field>
        <Field label="WHS">
          <input value={form.whs} onChange={e => update('whs', e.target.value)}
            placeholder="18.4" className={inputClass} />
        </Field>
      </div>

      {/* Email / Téléphone */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email">
          <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
            placeholder="jean@example.com" className={inputClass} />
        </Field>
        <Field label="Téléphone">
          <input value={form.phone} onChange={e => update('phone', e.target.value)}
            placeholder="+32 ..." className={inputClass} />
        </Field>
      </div>

      {/* Club */}
      <Field label="Club domicile">
        <input value={form.home_club} onChange={e => update('home_club', e.target.value)}
          placeholder="GC Louvain-La-Neuve" className={inputClass} />
      </Field>

      {/* Genre + Tee */}
      <div>
        <label className="block text-[12px] font-medium text-gray-500 mb-1.5">
          Genre & tee de départ par défaut
        </label>
        <div className="flex items-center gap-3 flex-wrap">

          {/* Toggle M/F */}
          <div className="flex gap-1 p-0.5 bg-gray-100 rounded-md">
            {(['M', 'F'] as const).map(g => (
              <button key={g} type="button" onClick={() => setGender(g)}
                className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                  form.gender === g
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}>
                {g === 'M' ? 'Homme' : 'Femme'}
              </button>
            ))}
          </div>

          <span className="text-gray-300 text-[12px]">→</span>

          {/* Tee selector */}
          <div className="flex gap-1.5">
            {TEE_OPTIONS.map(t => (
              <button key={t.value} type="button"
                onClick={() => update('default_tee_color', t.value)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[12px] font-medium transition-colors ${
                  form.default_tee_color === t.value
                    ? 'border-gray-400 bg-white shadow-sm text-gray-700'
                    : 'border-gray-200 text-gray-400 hover:border-gray-300'
                }`}>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">
          Homme → Yellow par défaut · Femme → Red par défaut · modifiable par event
        </p>
      </div>

      {/* Groupes */}
      {groups.length > 0 && (
        <div>
          <label className="block text-[12px] font-medium text-gray-500 mb-2">
            Ajouter au(x) groupe(s)
          </label>
          <div className="border border-gray-200 rounded-md overflow-hidden">
            {groups.map((group, i) => (
              <label key={group.id}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                  i < groups.length - 1 ? 'border-b border-gray-100' : ''
                }`}>
                <input type="checkbox" checked={selectedGroups.includes(group.id)}
                  onChange={() => toggleGroup(group.id)} className="rounded" />
                <span className="text-[13px] text-gray-700">{group.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={loading}
          className="bg-[#185FA5] text-white text-[13px] font-medium px-5 py-2 rounded-md hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
          {loading ? 'Saving…' : submitLabel}
        </button>
      </div>

    </form>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
const inputClass = "w-full border border-white/60 rounded-xl px-3 py-2.5 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] bg-white/70 backdrop-blur-sm"

const TEE_OPTIONS = [
  { value: 'yellow', label: 'Yellow', color: '#EF9F27' },
  { value: 'red',    label: 'Red',    color: '#E24B4A' },
  { value: 'white',  label: 'White',  color: '#B4B2A9' },
  { value: 'blue',   label: 'Blue',   color: '#378ADD' },
]

type Gender   = 'M' | 'F'
type TeeColor = 'yellow' | 'red' | 'white' | 'blue'
type Role     = 'member' | 'guest' | 'owner'

export default function EditPlayerPage() {
  const params       = useParams()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const playerId     = params.id as string
  const groupId      = searchParams.get('groupId')

  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [role,    setRole]    = useState<Role>('member')

  const [form, setForm] = useState({
    first_name:        '',
    surname:           '',
    federal_no:        '',
    whs:               '',
    email:             '',
    phone:             '',
    gender:            'M' as Gender,
    default_tee_color: 'yellow' as TeeColor,
  })

  useEffect(() => { loadPlayer() }, [playerId])

  async function loadPlayer() {
    const { data: player, error: pErr } = await supabase
      .from('players')
      .select('first_name, surname, federal_no, whs, email, phone, gender, default_tee_color')
      .eq('id', playerId)
      .single()

    if (pErr || !player) { setError('Joueur introuvable'); setLoading(false); return }

    setForm({
      first_name:        player.first_name ?? '',
      surname:           player.surname ?? '',
      federal_no:        player.federal_no ?? '',
      whs:               player.whs != null ? String(player.whs) : '',
      email:             player.email ?? '',
      phone:             player.phone ?? '',
      gender:            player.gender ?? 'M',
      default_tee_color: player.default_tee_color ?? 'yellow',
    })

    if (groupId) {
      const { data: gp } = await supabase
        .from('groups_players')
        .select('role')
        .eq('group_id', groupId)
        .eq('player_id', playerId)
        .maybeSingle()
      if (gp) setRole(gp.role as Role)
    }

    setLoading(false)
  }

  function setGender(gender: Gender) {
    setForm(f => ({ ...f, gender, default_tee_color: gender === 'M' ? 'yellow' : 'red' }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.surname.trim() || !form.first_name.trim()) { setError('Nom et prénom requis'); return }
    setSaving(true); setError('')

    const { error: pErr } = await supabase.from('players').update({
      first_name:        form.first_name.trim(),
      surname:           form.surname.trim(),
      federal_no:        form.federal_no.trim() || null,
      whs:               form.whs ? parseFloat(form.whs.replace(',', '.')) : null,
      email:             form.email.trim() || null,
      phone:             form.phone.trim() || null,
      gender:            form.gender,
      default_tee_color: form.default_tee_color,
    }).eq('id', playerId)

    if (pErr) { setError(pErr.message); setSaving(false); return }

    if (groupId) {
      const { error: gpErr } = await supabase.from('groups_players')
        .update({ role })
        .eq('group_id', groupId)
        .eq('player_id', playerId)
      if (gpErr) { setError(gpErr.message); setSaving(false); return }
    }

    router.push(groupId ? `/groups/${groupId}/members` : '/')
  }

  if (loading) return (
    <div className="p-6 space-y-2">
      {[1,2,3,4].map(i => <div key={i} className="h-11 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-xl">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Modifier le joueur</h1>
          <p className="text-[13px] text-slate-900 mt-0.5">{form.first_name} {form.surname}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-4">

        <div className="border border-white/60 rounded-xl p-5 bg-white/70 backdrop-blur-sm flex flex-col gap-3">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Prénom *</label>
              <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                required placeholder="Jean" className={inputClass} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Nom *</label>
              <input value={form.surname} onChange={e => setForm(f => ({ ...f, surname: e.target.value }))}
                required placeholder="Dupont" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">N° fédéral</label>
              <input value={form.federal_no} onChange={e => setForm(f => ({ ...f, federal_no: e.target.value }))}
                placeholder="123456" className={inputClass} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">WHS</label>
              <input value={form.whs} onChange={e => setForm(f => ({ ...f, whs: e.target.value }))}
                placeholder="18.4" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jean@example.com" className={inputClass} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Téléphone</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+32 ..." className={inputClass} />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Genre & tee de départ par défaut</label>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                {(['M', 'F'] as const).map(g => (
                  <button key={g} type="button" onClick={() => setGender(g)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                      form.gender === g ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                    {g === 'M' ? 'Homme' : 'Femme'}
                  </button>
                ))}
              </div>
              <span className="text-slate-300 text-[12px]">→</span>
              <div className="flex gap-1.5">
                {TEE_OPTIONS.map(t => (
                  <button key={t.value} type="button"
                    onClick={() => setForm(f => ({ ...f, default_tee_color: t.value as TeeColor }))}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[12px] font-semibold transition-colors ${
                      form.default_tee_color === t.value
                        ? 'border-slate-400 bg-white shadow-sm text-slate-700'
                        : 'border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Rôle dans le groupe */}
        {groupId && (
          <div className="border border-white/60 rounded-xl p-5 bg-white/70 backdrop-blur-sm">
            <label className="block text-[12px] font-semibold text-slate-600 mb-2">Statut dans le groupe</label>
            <div className="flex gap-2">
              {(['member', 'guest'] as const).map(r => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition-colors ${
                    role === r
                      ? r === 'guest'
                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                        : 'bg-[#EBF3FC] border-[#185FA5] text-[#185FA5]'
                      : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}>
                  {r === 'guest' ? 'Visiteur' : 'Membre'}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>
        )}

        <button type="submit" disabled={saving}
          className="bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>

      </form>

      <div className="mt-6 pt-4 border-t border-slate-100">
        <button onClick={() => router.push(groupId ? `/groups/${groupId}/members` : '/')}
          className="text-[13px] font-medium text-slate-500 hover:text-slate-700 transition-colors">
          ← Retour aux membres
        </button>
      </div>

    </div>
  )
}

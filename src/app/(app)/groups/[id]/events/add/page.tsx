'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
const inputClass = "w-full border border-white/60 rounded-xl px-3 py-2.5 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] bg-white/70 backdrop-blur-sm"

export default function AddEventPage() {
  const params  = useParams()
  const groupId = params.id as string

  const [title, setTitle]               = useState('')
  const [location, setLocation]         = useState('')
  const [start, setStart]               = useState('')
  const [end, setEnd]                   = useState('')
  const [isGolf, setIsGolf]             = useState(true)
  const [fee, setFee]                   = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSaving(true)
    try {
      const { error: insertError } = await supabase.from('events').insert({
        group_id:       groupId,
        title:          title.trim(),
        location:       location.trim() || null,
        starts_at:      start,
        ends_at:        end || null,
        is_golf:        isGolf,
        fee_per_person: fee ? parseFloat(fee.replace(',', '.')) : null,
        email_message:  emailMessage || null,
      })
      if (insertError) { setError(insertError.message); setSaving(false); return }
      window.location.href = `/groups/${groupId}/events`
    } catch (e: any) {
      setError(e.message ?? 'Erreur inattendue')
      setSaving(false)
    }
  }

  return (
    <div className="p-5 sm:p-6 max-w-lg">
      <div className="mb-6">
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Nouvel événement</h1>
        <p className="text-[13px] text-slate-600 mt-0.5">Ajouter un événement au groupe</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Titre *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} required
            placeholder="Ex: Partie du 2 avril" className={inputClass} />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Lieu</label>
          <input value={location} onChange={e => setLocation(e.target.value)}
            placeholder="Ex: GC Louvain-La-Neuve" className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Début *</label>
            <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Fin</label>
            <input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-2">Type d'événement</label>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
            <button type="button" onClick={() => setIsGolf(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                isGolf ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              ⛳ Partie de golf
            </button>
            <button type="button" onClick={() => setIsGolf(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                !isGolf ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              🎉 Autre événement
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            {isGolf ? 'Flights, scorecards et leaderboard seront disponibles' : 'Seulement participants et paiements'}
          </p>
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
            Frais par personne (€) <span className="text-slate-400 font-normal">— optionnel</span>
          </label>
          <input value={fee} onChange={e => setFee(e.target.value)} placeholder="Ex: 35" className={inputClass} />
          {fee && <p className="text-[11px] text-slate-500 mt-1">Un onglet "Paiements" sera disponible pour suivre qui a payé</p>}
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
            Message d'invitation <span className="text-slate-400 font-normal">— optionnel</span>
          </label>
          <textarea value={emailMessage} onChange={e => setEmailMessage(e.target.value)}
            placeholder="Ex: Rendez-vous au départ n°1 à 9h00..." rows={3}
            className={`${inputClass} resize-none`} />
          <p className="text-[11px] text-slate-500 mt-1">Inclus dans l'email d'invitation</p>
        </div>

        {error && <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>}

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving}
            className="bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : "Créer l'événement"}
          </button>
          <button type="button" onClick={() => { window.location.href = `/groups/${groupId}/events` }}
            className="text-[13px] font-semibold px-5 py-2.5 rounded-xl border border-white/50 text-slate-600 hover:bg-white/30 transition-colors">
            Annuler
          </button>
        </div>
      </form>
    </div>
  )
}

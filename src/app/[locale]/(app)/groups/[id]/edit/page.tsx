'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

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
  const t = useTranslations()

  const [name,          setName]          = useState('')
  const [description,   setDescription]   = useState('')
  const [color,         setColor]         = useState(GROUP_COLORS[0])
  const [whatsappLink,  setWhatsappLink]  = useState('')
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)

  useEffect(() => { fetchGroup() }, [])

  async function fetchGroup() {
    const { data, error } = await supabase
      .from('groups').select('name, description, color, whatsapp_link').eq('id', id).single()
    if (error) { alert(error.message); router.push('/groups'); return }
    setName(data.name)
    setDescription(data.description || '')
    setColor(data.color ?? GROUP_COLORS[0])
    setWhatsappLink(data.whatsapp_link || '')
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { alert(t('editGroup.nameRequired')); return }
    setSaving(true)
    const { error } = await supabase
      .from('groups')
      .update({
        name:           name.trim(),
        description:    description.trim() || null,
        color,
        whatsapp_link:  whatsappLink.trim() || null,
      })
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
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">{t('editGroup.title')}</h1>
        <p className="text-[13px] text-slate-900 mt-0.5">{name}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('editGroup.nameLabel')}</label>
          <input value={name} onChange={e => setName(e.target.value)} required className={inputClass} />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('editGroup.description')}</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={3} className={`${inputClass} resize-none`} />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-2">{t('editGroup.color')}</label>
          <div className="flex gap-2.5">
            {GROUP_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full transition-transform hover:scale-110 flex-shrink-0"
                style={{ background: c, outline: color === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }} />
            ))}
          </div>
        </div>

        {/* ── Lien WhatsApp ── */}
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
            Lien WhatsApp du groupe
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <input
              value={whatsappLink}
              onChange={e => setWhatsappLink(e.target.value)}
              placeholder="https://chat.whatsapp.com/XXXXXXXX"
              className={`${inputClass} pl-8`}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Dans WhatsApp : Infos du groupe → Lien d'invitation → Copier le lien
          </p>
          {whatsappLink && (
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-[#25D366] hover:underline">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Tester le lien
            </a>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving}
            className="bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
            {saving ? t('editGroup.saving') : t('editGroup.save')}
          </button>
          <button type="button" onClick={() => router.push('/groups')}
            className="text-[13px] font-semibold px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            {t('editGroup.cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}

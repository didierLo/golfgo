'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { LOCALES, LOCALE_NAMES, normalizeLocale, type Locale } from '@/lib/i18n/types'
import { getGroupOwners, type OwnerContact } from '@/lib/groups/owner'

const supabase = createClient()

const GROUP_COLORS = [
  '#378ADD', '#EF9F27', '#7F77DD',
  '#1D9E75', '#D85A30', '#D4537E',
]

const inputClass = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] bg-white"

function Toggle({ value, onChange, label, desc }: {
  value: boolean; onChange: (v: boolean) => void; label: string; desc: string
}) {
  return (
    <div className="flex items-start gap-3">
      <button type="button" onClick={() => onChange(!value)}
        style={{ backgroundColor: value ? '#185FA5' : '#CBD5E1', transition: 'background-color 0.2s' }}
        className="mt-0.5 w-9 h-5 rounded-full flex items-center px-0.5 flex-shrink-0 cursor-pointer">
        <div style={{ transform: value ? 'translateX(16px)' : 'translateX(0)', transition: 'transform 0.2s' }}
          className="w-4 h-4 rounded-full bg-white shadow-sm" />
      </button>
      <div>
        <p className="text-[13px] font-semibold text-slate-800">{label}</p>
        <p className="text-[11px] text-slate-500 mt-0.5 on-bg">{desc}</p>
      </div>
    </div>
  )
}

export default function EditGroupPage() {
  const router = useRouter()
  const params = useParams()
  const id     = params.id as string
  const t      = useTranslations()

  const [name,           setName]           = useState('')
  const [description,    setDescription]    = useState('')
  const [color,          setColor]          = useState(GROUP_COLORS[0])
  const [autoReminders,  setAutoReminders]  = useState(false)
  const [autoTeesheet,   setAutoTeesheet]   = useState(false)
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState(false)

const [autoInvitation,   setAutoInvitation] = useState(false)
  const [groupLocale,     setGroupLocale]    = useState<Locale>('fr')
  const [initialLocale,   setInitialLocale]  = useState<Locale>('fr')

  const [owners,          setOwners]         = useState<OwnerContact[]>([])
  const [signerUserId,    setSignerUserId]   = useState<string | null>(null)   // = groups.owner_id : qui signe les emails

  // Fond de l'application pour ce groupe (visible sur ordinateur, tablette et smartphone).
  // L'upload et la réinitialisation écrivent tout de suite en base, comme le logo/l'image des emails
  // dans Communications → Réglages : pas besoin de cliquer sur « Enregistrer » pour que ça prenne effet.
  const [backgroundUrl,   setBackgroundUrl]   = useState<string | null>(null)
  const [bgUploading,     setBgUploading]     = useState(false)
  const bgFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchGroup() }, [])

  async function fetchGroup() {
    const { data, error } = await supabase
      .from('groups')
      .select('name, description, color, auto_reminders, auto_teesheet, auto_invitation, background_url')
      .eq('id', id).single()
    if (error) { alert(error.message); router.push('/groups'); return }
    setName(data.name)
    setDescription(data.description || '')
    setColor(data.color ?? GROUP_COLORS[0])
    setAutoReminders(data.auto_reminders ?? false)
    setAutoTeesheet(data.auto_teesheet ?? false)
    setLoading(false)
    setAutoInvitation(data.auto_invitation ?? false)
    setBackgroundUrl(data.background_url ?? null)

    // Langue du groupe : requête séparée, pour ne pas casser cette page si la migration SQL n'est pas encore passée
    const { data: loc } = await supabase.from('groups').select('locale').eq('id', id).maybeSingle()
    const l = normalizeLocale(loc?.locale)
    setGroupLocale(l); setInitialLocale(l)

    // Signataire des documents : même logique que celle utilisée pour les emails (src/lib/groups/owner.ts)
    const groupOwners = await getGroupOwners(supabase, id)
    setOwners(groupOwners.all)
    setSignerUserId(groupOwners.primary?.userId ?? null)
  }

  async function handleBackgroundUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setBgUploading(true)
    // Tout est protégé par un filet de sécurité : la version précédente pouvait échouer sans jamais
    // afficher le moindre message. On distingue aussi « erreur » de « 0 ligne modifiée » (une écriture
    // peut être acceptée par Supabase sans rien changer si les droits d'accès ne correspondent pas —
    // ça ne remonte alors PAS comme une erreur classique, d'où l'ajout de .select() ci-dessous).
    try {
      const path = `${id}/appbg.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from('templates').upload(path, file, { upsert: true })
      if (error) { alert(`Envoi impossible : ${error.message}`); setBgUploading(false); return }
      const { data: { publicUrl } } = supabase.storage.from('templates').getPublicUrl(path)
      const bustedUrl = `${publicUrl}?v=${Date.now()}`
      const { data: updated, error: dbError } = await supabase.from('groups')
        .update({ background_url: bustedUrl }).eq('id', id).select('id')
      if (dbError) { alert(`Enregistrement impossible : ${dbError.message}`); setBgUploading(false); return }
      if (!updated || updated.length === 0) {
        alert("L'image a bien été envoyée, mais l'enregistrement n'a modifié aucune ligne (probablement un problème de droits d'accès sur ce groupe). Rien n'a changé.")
        setBgUploading(false)
        return
      }
      setBackgroundUrl(bustedUrl)
      // Le fond de l'application (AppLayout) est chargé une seule fois à l'ouverture de GolfGo et gardé
      // en mémoire : sans ce rechargement complet, la nouvelle image resterait invisible ailleurs dans
      // l'app tant que la page n'est pas rouverte — même mécanique que le changement de groupe actif.
      window.location.reload()
    } catch (e: any) {
      alert(`Erreur inattendue lors de l'envoi de l'image : ${e?.message ?? e}`)
      setBgUploading(false)
    }
  }

  async function handleBackgroundReset() {
    try {
      const { data: updated, error } = await supabase.from('groups')
        .update({ background_url: null }).eq('id', id).select('id')
      if (error) { alert(`Réinitialisation impossible : ${error.message}`); return }
      if (!updated || updated.length === 0) {
        alert("La réinitialisation n'a modifié aucune ligne (probablement un problème de droits d'accès sur ce groupe).")
        return
      }
      setBackgroundUrl(null)
      window.location.reload()
    } catch (e: any) {
      alert(`Erreur inattendue lors de la réinitialisation : ${e?.message ?? e}`)
    }
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
        auto_reminders: autoReminders,
        auto_teesheet:  autoTeesheet,
        auto_invitation: autoInvitation,
      })
      .eq('id', id)
    if (error) { alert(error.message); setSaving(false); return }

    // Langue du groupe : enregistrée seulement si elle a changé
    if (groupLocale !== initialLocale) {
      const { error: localeError } = await supabase.from('groups').update({ locale: groupLocale }).eq('id', id)
      if (localeError) { alert(localeError.message); setSaving(false); return }
    }

    // Signataire des documents : enregistré seulement s'il a changé
    if (signerUserId) {
      const { error: signerError } = await supabase.from('groups').update({ owner_id: signerUserId }).eq('id', id)
      if (signerError) { alert(signerError.message); setSaving(false); return }
    }
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 on-bg-card">
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('editGroup.nameLabel')}</label>
          <input value={name} onChange={e => setName(e.target.value)} required className={inputClass} />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('editGroup.description')}</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            rows={8} className={`${inputClass} resize-none`} />
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

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('editGroup.languageLabel')}</label>
          <select value={groupLocale} onChange={e => setGroupLocale(e.target.value as Locale)} className={inputClass}>
            {LOCALES.map(l => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
          </select>
          <p className="text-[11px] text-slate-500 mt-1 on-bg">{t('editGroup.languageHint')}</p>
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('editGroup.backgroundLabel')}</label>
          {backgroundUrl ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={backgroundUrl} alt="" className="h-16 w-28 object-cover rounded-xl border border-white/50" />
              <div className="flex flex-col gap-1">
                <button type="button" onClick={() => bgFileInputRef.current?.click()} className="text-[11px] font-semibold text-[#185FA5] hover:underline">{t('communications.templates.changeLogo')}</button>
                <button type="button" onClick={handleBackgroundReset} className="text-[11px] font-semibold text-red-500 hover:underline">{t('editGroup.backgroundReset')}</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => bgFileInputRef.current?.click()} disabled={bgUploading}
              className="w-full border border-dashed border-slate-300 rounded-xl py-4 text-[12px] font-medium text-slate-400 hover:border-[#185FA5] hover:text-[#185FA5] transition-colors">
              {bgUploading ? t('communications.templates.uploading') : t('editGroup.backgroundAdd')}
            </button>
          )}
          <input ref={bgFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBackgroundUpload} />
          <p className="text-[11px] text-slate-500 mt-1 on-bg">{t('editGroup.backgroundHint')}</p>
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('editGroup.signerLabel')}</label>
          {owners.length > 0 ? (
            <select value={signerUserId ?? ''} onChange={e => setSignerUserId(e.target.value)} className={inputClass}>
              {owners.filter(o => o.userId).map(o => (
                <option key={o.playerId} value={o.userId!}>{o.firstName} {o.surname}</option>
              ))}
            </select>
          ) : (
            <p className="text-[13px] text-slate-400 italic">{t('editGroup.signerNoOwners')}</p>
          )}
          <p className="text-[11px] text-slate-500 mt-1 on-bg">{t('editGroup.signerHint')}</p>
        </div>

        {/* ── Automatisations ── */}
        <div className="rounded-xl border border-white/60 shadow-sm p-4 flex flex-col gap-4"
          style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {t('editGroup.automations')}
          </p>
          <Toggle
            value={autoInvitation}
            onChange={setAutoInvitation}
            label={t('editGroup.autoInvitationLabel')}
            desc={t('editGroup.autoInvitationDesc')}
/>
          <Toggle
            value={autoReminders}
            onChange={setAutoReminders}
            label={t('editGroup.autoRemindersLabel')}
            desc={t('editGroup.autoRemindersDesc')}
          />
          <Toggle
            value={autoTeesheet}
            onChange={setAutoTeesheet}
            label={t('editGroup.autoTeesheetLabel')}
            desc={t('editGroup.autoTeesheetDesc')}
          />
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

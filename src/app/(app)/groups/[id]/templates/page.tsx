'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useGroupRole } from '@/lib/hooks/useGroupRole'
import toast from 'react-hot-toast'

const supabase = createClient()

const inputClass = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] bg-white"
const textareaClass = `${inputClass} resize-none`

type Template = {
  template_logo_url:           string | null
  template_header_color:       string
  template_bg_image_url:       string | null
  template_invitation_subject: string | null
  template_invitation_body:    string | null
  template_teesheet_subject:   string | null
  template_teesheet_body:      string | null
}

const DEFAULTS: Template = {
  template_logo_url:           null,
  template_header_color:       '#185FA5',
  template_bg_image_url:       null,
  template_invitation_subject: 'Invitation : {{event_title}}',
  template_invitation_body:    'Bonjour {{player_name}},\n\nTu es invité(e) à {{event_title}} le {{event_date}} à {{event_time}}.\n\nSeras-tu présent(e) ?',
  template_teesheet_subject:   'Tee Sheet — {{event_title}}',
  template_teesheet_body:      "Bonjour {{player_name}},\n\nVoici l'ordre de départ pour {{event_title}}.\n\nTon flight est le numéro {{flight_number}} avec départ à {{start_time}}.",
}

const VARIABLES = [
  { label: 'Nom complet',   value: '{{player_name}}' },
  { label: 'Prénom',        value: '{{player_first_name}}' },
  { label: 'Nom de famille',value: '{{player_surname}}' },
  { label: 'Titre event',   value: '{{event_title}}' },
  { label: 'Date event',    value: '{{event_date}}' },
  { label: 'Heure event',   value: '{{event_time}}' },
  { label: 'N° flight',     value: '{{flight_number}}' },
  { label: 'Heure départ',  value: '{{start_time}}' },
]

type EventRow = { id: string; title: string; starts_at: string }

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export default function TemplatesPage() {
  const params  = useParams()
  const groupId = params.id as string

  const { role, loading: roleLoading } = useGroupRole(groupId)
  const isOwner = role === 'owner'

  const [groupTemplate, setGroupTemplate]     = useState<Template>(DEFAULTS)
  const [events, setEvents]                   = useState<EventRow[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [useGroupTemplate, setUseGroupTemplate] = useState(true)
  const [eventTemplate, setEventTemplate]     = useState<Template>(DEFAULTS)
  const [loading, setLoading]                 = useState(true)
  const [saving, setSaving]                   = useState(false)
  const [uploading, setUploading]             = useState(false)
  const [activeTab, setActiveTab]             = useState<'invitation' | 'teesheet' | 'print'>('invitation')
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const bgFileInputRef = useRef<HTMLInputElement>(null)

  const template    = useGroupTemplate ? groupTemplate : eventTemplate
  const setTemplate = useGroupTemplate
    ? (fn: (t: Template) => Template) => setGroupTemplate(fn)
    : (fn: (t: Template) => Template) => setEventTemplate(fn)

  useEffect(() => { loadAll() }, [groupId])
  useEffect(() => { if (selectedEventId) loadEventTemplate(selectedEventId) }, [selectedEventId])

  async function loadAll() {
    setLoading(true)
    const { data: group } = await supabase.from('groups')
      .select('template_logo_url, template_header_color, template_bg_image_url, template_invitation_subject, template_invitation_body, template_teesheet_subject, template_teesheet_body')
      .eq('id', groupId).single()
    if (group) {
      setGroupTemplate({
        template_logo_url:           group.template_logo_url ?? null,
        template_header_color:       group.template_header_color ?? '#185FA5',
        template_bg_image_url:       group.template_bg_image_url ?? null,
        template_invitation_subject: group.template_invitation_subject ?? DEFAULTS.template_invitation_subject,
        template_invitation_body:    group.template_invitation_body ?? DEFAULTS.template_invitation_body,
        template_teesheet_subject:   group.template_teesheet_subject ?? DEFAULTS.template_teesheet_subject,
        template_teesheet_body:      group.template_teesheet_body ?? DEFAULTS.template_teesheet_body,
      })
    }
    const { data: evts } = await supabase.from('events').select('id, title, starts_at')
      .eq('group_id', groupId).order('starts_at', { ascending: false })
    setEvents(evts || [])
    if (evts && evts.length > 0) setSelectedEventId(evts[0].id)
    setLoading(false)
  }

  async function loadEventTemplate(eventId: string) {
    const { data } = await supabase.from('events')
      .select('use_group_template, template_logo_url, template_header_color, template_bg_image_url, template_invitation_subject, template_invitation_body, template_teesheet_subject, template_teesheet_body')
      .eq('id', eventId).single()
    if (data) {
      setUseGroupTemplate(data.use_group_template ?? true)
      setEventTemplate({
        template_logo_url:           data.template_logo_url ?? groupTemplate.template_logo_url,
        template_header_color:       data.template_header_color ?? groupTemplate.template_header_color,
        template_bg_image_url:       data.template_bg_image_url ?? groupTemplate.template_bg_image_url,
        template_invitation_subject: data.template_invitation_subject ?? groupTemplate.template_invitation_subject,
        template_invitation_body:    data.template_invitation_body ?? groupTemplate.template_invitation_body,
        template_teesheet_subject:   data.template_teesheet_subject ?? groupTemplate.template_teesheet_subject,
        template_teesheet_body:      data.template_teesheet_body ?? groupTemplate.template_teesheet_body,
      })
    }
  }

  async function handleSave() {
    setSaving(true)
    if (useGroupTemplate) {
      const { error } = await supabase.from('groups').update(groupTemplate).eq('id', groupId)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Template groupe sauvegardé')
    } else {
      const { error } = await supabase.from('events').update({ use_group_template: false, ...eventTemplate }).eq('id', selectedEventId)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Template event sauvegardé')
    }
    setSaving(false)
  }

  async function handleToggleGroupTemplate(val: boolean) {
    setUseGroupTemplate(val)
    if (val && selectedEventId) {
      await supabase.from('events').update({ use_group_template: true }).eq('id', selectedEventId)
      setEventTemplate({ ...groupTemplate })
    }
  }

  async function handleReset() {
    if (!confirm('Réinitialiser ce template aux valeurs par défaut GolfGo ?')) return
    if (useGroupTemplate) {
      const { error } = await supabase.from('groups').update({
        template_invitation_subject: DEFAULTS.template_invitation_subject,
        template_invitation_body:    DEFAULTS.template_invitation_body,
        template_teesheet_subject:   DEFAULTS.template_teesheet_subject,
        template_teesheet_body:      DEFAULTS.template_teesheet_body,
        template_logo_url:           null,
        template_header_color:       '#185FA5',
      }).eq('id', groupId)
      if (error) { toast.error(error.message); return }
      setGroupTemplate({ ...DEFAULTS })
      toast.success('Template groupe réinitialisé')
    } else {
      const { error } = await supabase.from('events').update({
        use_group_template:          true,
        template_invitation_subject: null,
        template_invitation_body:    null,
        template_teesheet_subject:   null,
        template_teesheet_body:      null,
        template_logo_url:           null,
        template_header_color:       null,
      }).eq('id', selectedEventId)
      if (error) { toast.error(error.message); return }
      setUseGroupTemplate(true)
      setEventTemplate({ ...groupTemplate })
      toast.success('Template event réinitialisé — utilise maintenant le template du groupe')
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext   = file.name.split('.').pop()
    const scope = useGroupTemplate ? groupId : selectedEventId
    const path  = `${scope}/logo.${ext}`
    const { error: uploadError } = await supabase.storage.from('templates').upload(path, file, { upsert: true })
    if (uploadError) { toast.error(uploadError.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('templates').getPublicUrl(path)
    setTemplate(t => ({ ...t, template_logo_url: publicUrl }))
    toast.success('Logo uploadé')
    setUploading(false)
  }

  async function handleBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `${groupId}/bg.${ext}`
    const { error: uploadError } = await supabase.storage.from('templates').upload(path, file, { upsert: true })
    if (uploadError) { toast.error(uploadError.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('templates').getPublicUrl(path)
    setTemplate(t => ({ ...t, template_bg_image_url: publicUrl }))
    // Sauvegarder immédiatement en base
    await supabase.from('groups').update({ template_bg_image_url: publicUrl }).eq('id', groupId)
    toast.success('Image de fond uploadée')
    setUploading(false)
  }

  function set(field: keyof Template, value: string) { setTemplate(t => ({ ...t, [field]: value })) }
  function insertVariable(field: keyof Template, variable: string) {
    setTemplate(t => ({ ...t, [field]: ((t[field] as string) ?? '') + variable }))
  }

  if (loading || roleLoading) return (
    <div className="p-6 space-y-3 max-w-2xl">
      {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  )

  if (!isOwner) return (
    <div className="p-5 sm:p-6">
      <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-[12px] text-blue-700 font-medium">
        Seul l'organisateur peut modifier les templates
      </div>
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Templates</h1>
        <p className="text-[13px] text-slate-600 mt-0.5">Personnalise les emails et documents de ce groupe</p>
      </div>

      {/* Scope */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Appliquer à</p>
        <div className="flex items-start gap-3 mb-3">
          <button type="button" onClick={() => handleToggleGroupTemplate(!useGroupTemplate)}
            style={{ backgroundColor: useGroupTemplate ? '#185FA5' : '#CBD5E1', transition: 'background-color 0.2s' }}
            className="mt-0.5 w-9 h-5 rounded-full flex items-center px-0.5 flex-shrink-0 cursor-pointer">
            <div style={{ transform: useGroupTemplate ? 'translateX(16px)' : 'translateX(0)', transition: 'transform 0.2s' }}
              className="w-4 h-4 rounded-full bg-white shadow-sm" />
          </button>
          <div>
            <p className="text-[13px] font-semibold text-slate-800">
              {useGroupTemplate ? 'Template du groupe (par défaut pour tous les events)' : 'Template spécifique à un event'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {useGroupTemplate
                ? 'Tous les events utiliseront ce template sauf ceux personnalisés'
                : "Ce template sera utilisé uniquement pour l'event sélectionné"}
            </p>
          </div>
        </div>
        {!useGroupTemplate && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Événement</label>
            <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30">
              {events.map(e => <option key={e.id} value={e.id}>{e.title} — {formatDate(e.starts_at)}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Identité visuelle */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Identité visuelle</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-2">Logo d'en-tête</label>
            {template.template_logo_url ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={template.template_logo_url} alt="Logo" className="h-12 object-contain border border-slate-200 rounded-xl p-1 bg-slate-50" />
                <div className="flex flex-col gap-1">
                  <button onClick={() => fileInputRef.current?.click()} className="text-[11px] font-semibold text-[#185FA5] hover:underline">Changer</button>
                  <button onClick={() => setTemplate(t => ({ ...t, template_logo_url: null }))} className="text-[11px] font-semibold text-red-500 hover:underline">Supprimer</button>
                </div>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="w-full border border-dashed border-slate-300 rounded-xl py-4 text-[12px] font-medium text-slate-400 hover:border-[#185FA5] hover:text-[#185FA5] transition-colors">
                {uploading ? 'Upload…' : '+ Ajouter un logo'}
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <p className="text-[10px] text-slate-400 mt-1">PNG, JPG — remplace le logo GolfGo</p>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-2">Couleur d'en-tête</label>
            <div className="flex items-center gap-3">
              <input type="color" value={template.template_header_color}
                onChange={e => set('template_header_color', e.target.value)}
                className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer p-0.5" />
              <div>
                <p className="text-[13px] font-semibold text-slate-700">{template.template_header_color}</p>
                <button onClick={() => set('template_header_color', '#185FA5')}
                  className="text-[11px] font-medium text-slate-400 hover:text-slate-600">Défaut GolfGo</button>
              </div>
            </div>
            <div className="mt-3 rounded-xl px-4 py-3 flex items-center justify-between"
              style={{ background: template.template_header_color }}>
              <div>
                {template.template_logo_url
                  ? <img src={template.template_logo_url} alt="Logo" className="h-6 object-contain" />
                  : <><span className="text-[15px] font-black text-white">Golf</span><span className="text-[15px] font-black" style={{ color: '#4CAF1A' }}>Go</span></>
                }
              </div>
              <span className="text-[10px] text-white/70 uppercase tracking-wider font-semibold">Aperçu</span>
            </div>
          </div>
        </div>

        {/* Image de fond mobile */}
        <div className="mt-5 pt-5 border-t border-slate-100">
          <label className="block text-[12px] font-semibold text-slate-600 mb-2">
            Image de fond <span className="text-slate-400 font-normal">— cards mobile uniquement</span>
          </label>
          {template.template_bg_image_url ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={template.template_bg_image_url} alt="Fond" className="h-16 w-32 object-cover rounded-xl border border-slate-200" />
              <div className="flex flex-col gap-1">
                <button onClick={() => bgFileInputRef.current?.click()} className="text-[11px] font-semibold text-[#185FA5] hover:underline">Changer</button>
                <button onClick={async () => {
                  setTemplate(t => ({ ...t, template_bg_image_url: null }))
                  await supabase.from('groups').update({ template_bg_image_url: null }).eq('id', groupId)
                  toast.success('Image supprimée')
                }} className="text-[11px] font-semibold text-red-500 hover:underline">Supprimer</button>
              </div>
            </div>
          ) : (
            <button onClick={() => bgFileInputRef.current?.click()} disabled={uploading}
              className="w-full border border-dashed border-slate-300 rounded-xl py-4 text-[12px] font-medium text-slate-400 hover:border-[#185FA5] hover:text-[#185FA5] transition-colors">
              {uploading ? 'Upload…' : '+ Ajouter une image de fond'}
            </button>
          )}
          <input ref={bgFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
          <p className="text-[10px] text-slate-400 mt-1.5">JPG, PNG — affiché en arrière-plan des cards événements sur mobile</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-5">
        {([
          { key: 'invitation', label: 'Email invitation' },
          { key: 'teesheet',   label: 'Email tee sheet' },
          { key: 'print',      label: 'Documents' },
        ] as const).map(tab => (
          <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
              activeTab === tab.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Email invitation */}
      {activeTab === 'invitation' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Objet</label>
            <input value={template.template_invitation_subject ?? ''} onChange={e => set('template_invitation_subject', e.target.value)}
              className={inputClass} placeholder="Objet de l'email..." />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Corps du message</label>
            <textarea value={template.template_invitation_body ?? ''} onChange={e => set('template_invitation_body', e.target.value)}
              rows={6} className={textareaClass} />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {VARIABLES.map(v => (
                <button key={v.value} type="button" onClick={() => insertVariable('template_invitation_body', v.value)}
                  className="text-[10px] font-mono bg-blue-50 text-[#185FA5] border border-blue-200 px-2 py-0.5 rounded-lg hover:bg-blue-100 transition-colors">
                  {v.value}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Ce texte apparaît dans le bloc bleu de l'email, avant les boutons de réponse</p>
          </div>
        </div>
      )}

      {/* Email tee sheet */}
      {activeTab === 'teesheet' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Objet</label>
            <input value={template.template_teesheet_subject ?? ''} onChange={e => set('template_teesheet_subject', e.target.value)}
              className={inputClass} placeholder="Objet de l'email..." />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Corps du message</label>
            <textarea value={template.template_teesheet_body ?? ''} onChange={e => set('template_teesheet_body', e.target.value)}
              rows={6} className={textareaClass} />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {VARIABLES.map(v => (
                <button key={v.value} type="button" onClick={() => insertVariable('template_teesheet_body', v.value)}
                  className="text-[10px] font-mono bg-blue-50 text-[#185FA5] border border-blue-200 px-2 py-0.5 rounded-lg hover:bg-blue-100 transition-colors">
                  {v.value}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Ce texte apparaît avant le tableau des flights dans l'email</p>
          </div>
        </div>
      )}

      {/* Documents */}
      {activeTab === 'print' && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M9 21h6v-6H9v6z" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="text-[14px] font-bold text-slate-700 mb-1">Personnalisation des documents</p>
          <p className="text-[12px] text-slate-500">En-tête, pied de page et logo sur les tee sheets imprimées — bientôt disponible</p>
        </div>
      )}

      {/* Save */}
      <div className="flex items-center justify-between mt-5 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={handleReset}
            className="text-[12px] font-semibold px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
            ↺ Réinitialiser
          </button>
          <p className="text-[12px] text-slate-500">
            {useGroupTemplate ? 'Sauvegarde pour tout le groupe' : `Sauvegarde pour : ${events.find(e => e.id === selectedEventId)?.title ?? ''}`}
          </p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
          {saving ? 'Sauvegarde…' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  )
}

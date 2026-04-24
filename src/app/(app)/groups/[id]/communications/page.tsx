'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useGroupRole } from '@/lib/hooks/useGroupRole'
import toast from 'react-hot-toast'

const supabase = createClient()

const inputClass    = "w-full border border-white/60 rounded-xl px-3 py-2.5 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] bg-white/70 backdrop-blur-sm"
const textareaClass = `${inputClass} resize-none`
const selectClass   = "border border-slate-200 rounded-xl px-3 py-2 text-[12px] bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30"

// ─── Types ────────────────────────────────────────────────────────────────────

type Template = {
  template_logo_url:           string | null
  template_header_color:       string
  template_bg_image_url:       string | null
  template_invitation_subject: string | null
  template_invitation_body:    string | null
  template_teesheet_subject:   string | null
  template_teesheet_body:      string | null
}

type Member = { id: string; first_name: string; surname: string; email: string | null; role: string }
type EventRow = { id: string; title: string; starts_at: string }
type ParticipantStatus = 'GOING' | 'INVITED' | 'DECLINED' | 'WAITLIST'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULTS: Template = {
  template_logo_url:           null,
  template_header_color:       '#185FA5',
  template_bg_image_url:       null,
  template_invitation_subject: 'Invitation : {{event_title}}',
  template_invitation_body:    'Bonjour {{first_name}},\n\nTu es invité(e) à {{event_title}} le {{event_date}} à {{event_time}}.\n\nSeras-tu présent(e) ?',
  template_teesheet_subject:   'Tee Sheet — {{event_title}}',
  template_teesheet_body:      "Bonjour {{first_name}},\n\nVoici l'ordre de départ pour {{event_title}}.\n\nTon flight est le numéro {{flight_number}} avec départ à {{start_time}}.",
}

const TEMPLATE_VARS = [
  { label: 'Prénom',         value: '{{first_name}}' },
  { label: 'Nom',            value: '{{player_surname}}' },
  { label: 'Titre event',    value: '{{event_title}}' },
  { label: 'Date event',     value: '{{event_date}}' },
  { label: 'Heure event',    value: '{{event_time}}' },
  { label: 'N° flight',      value: '{{flight_number}}' },
  { label: 'Heure départ',   value: '{{start_time}}' },
  { label: '✓ Boutons oui/non', value: '{{yes_button}}' },
  { label: '✍️ Signature',   value: '{{owner_name}}' },
]

const COMM_TEMPLATES = [
  { id: 'reminder', label: '⏰ Rappel',
    subject: 'Rappel — {{group_name}}',
    body: `Bonjour {{first_name}},\n\nIl reste des places pour la semaine prochaine.\n\nSi tu veux jouer, clique sur le bouton ci-dessous\n\nÀ bientôt sur le parcours !\n\n{{owner_name}}\n\n{{yes_button}}` },
  { id: 'info', label: '📢 Information',
    subject: 'Information — {{group_name}}',
    body: `Bonjour {{first_name}},\n\nVoici une information importante concernant notre groupe.\n\nDidier L.` },
  { id: 'weather', label: '🌧️ Météo',
    subject: 'Information météo — {{group_name}}',
    body: `Bonjour {{first_name}},\n\nSuite aux prévisions météo, notre rencontre est annulée.\n\nNous reviendrons vers toi dès que possible.\n\nMerci de ta compréhension.\n\nDidier L.` },
  { id: 'cancel', label: '❌ Annulation',
    subject: 'Annulation — {{group_name}}',
    body: `Bonjour {{first_name}},\n\nNous sommes au regret de t'informer que l'événement est annulé.\n\nNous t'informerons dès que possible d'une nouvelle date.\n\nToutes nos excuses pour la gêne occasionnée.\n\nDidier L.` },
  { id: 'free', label: '✏️ Libre', subject: '', body: '' },
]

const COMM_VARS = [
  { key: '{{first_name}}',  label: 'Prénom' },
  { key: '{{surname}}',     label: 'Nom' },
  { key: '{{player_name}}', label: 'Prénom + Nom' },
  { key: '{{group_name}}',  label: 'Groupe' },
  { key: '{{yes_button}}',  label: '✓/✗ Boutons réponse' },
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CommunicationsPage() {
  const params  = useParams()
  const groupId = params.id as string
  const { role, loading: roleLoading } = useGroupRole(groupId)
  const isOwner = role === 'owner'

  const [mainTab, setMainTab] = useState<'send' | 'templates'>('send')

  // ── Shared state ────────────────────────────────────────────────────────
  const [members,  setMembers]  = useState<Member[]>([])
  const [events,   setEvents]   = useState<EventRow[]>([])
  const [loading,  setLoading]  = useState(true)

  // ── Templates state ──────────────────────────────────────────────────────
  const [groupTemplate,     setGroupTemplate]     = useState<Template>(DEFAULTS)
  const [useGroupTemplate,  setUseGroupTemplate]  = useState(true)
  const [eventTemplate,     setEventTemplate]     = useState<Template>(DEFAULTS)
  const [selectedEventId,   setSelectedEventId]   = useState<string>('')
  const [saving,            setSaving]            = useState(false)
  const [uploading,         setUploading]         = useState(false)
  const [templateTab,       setTemplateTab]       = useState<'invitation' | 'teesheet' | 'print'>('invitation')
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const bgFileInputRef = useRef<HTMLInputElement>(null)

  const template    = useGroupTemplate ? groupTemplate : eventTemplate
  const setTemplate = useGroupTemplate
    ? (fn: (t: Template) => Template) => setGroupTemplate(fn)
    : (fn: (t: Template) => Template) => setEventTemplate(fn)

  // ── Communications state ─────────────────────────────────────────────────
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set())
  const [filterMode,    setFilterMode]    = useState<'all' | 'event' | 'role'>('all')
  const [filterEventId, setFilterEventId] = useState<string>('')
  const [filterStatus,  setFilterStatus]  = useState<ParticipantStatus>('GOING')
  const [commSubject,   setCommSubject]   = useState('')
  const [commBody,      setCommBody]      = useState('')
  const [activeCommTpl, setActiveCommTpl] = useState<string | null>(null)
  const [sending,       setSending]       = useState(false)
  const [preview,       setPreview]       = useState(false)

  // ── Load ─────────────────────────────────────────────────────────────────

  useEffect(() => { loadAll() }, [groupId])
  useEffect(() => { if (selectedEventId) loadEventTemplate(selectedEventId) }, [selectedEventId])

  async function loadAll() {
    setLoading(true)
    const { data: group } = await supabase.from('groups')
      .select('template_logo_url, template_header_color, template_bg_image_url, template_invitation_subject, template_invitation_body, template_teesheet_subject, template_teesheet_body')
      .eq('id', groupId).single()
    if (group) setGroupTemplate({
      template_logo_url:           group.template_logo_url ?? null,
      template_header_color:       group.template_header_color ?? '#185FA5',
      template_bg_image_url:       group.template_bg_image_url ?? null,
      template_invitation_subject: group.template_invitation_subject ?? DEFAULTS.template_invitation_subject,
      template_invitation_body:    group.template_invitation_body ?? DEFAULTS.template_invitation_body,
      template_teesheet_subject:   group.template_teesheet_subject ?? DEFAULTS.template_teesheet_subject,
      template_teesheet_body:      group.template_teesheet_body ?? DEFAULTS.template_teesheet_body,
    })

    const { data: evts } = await supabase.from('events').select('id, title, starts_at')
      .eq('group_id', groupId).order('starts_at', { ascending: false })
    setEvents(evts || [])
    if (evts?.length) { setSelectedEventId(evts[0].id); setFilterEventId(evts[0].id) }

    const { data: membersData } = await supabase
      .from('groups_players').select('role, player:players(id, first_name, surname, email)').eq('group_id', groupId)
    setMembers((membersData ?? []).map((r: any) => ({ ...r.player, role: r.role })))
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

  // ── Templates handlers ───────────────────────────────────────────────────

  async function handleSaveTemplate() {
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
      await supabase.from('events').update({ use_group_template: true, template_invitation_subject: null, template_invitation_body: null, template_teesheet_subject: null, template_teesheet_body: null, template_logo_url: null, template_header_color: null }).eq('id', selectedEventId)
      setUseGroupTemplate(true); setEventTemplate({ ...groupTemplate })
      toast.success('Template event réinitialisé')
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    const path = `${useGroupTemplate ? groupId : selectedEventId}/logo.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('templates').upload(path, file, { upsert: true })
    if (error) { toast.error(error.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('templates').getPublicUrl(path)
    setTemplate(t => ({ ...t, template_logo_url: publicUrl }))
    toast.success('Logo uploadé'); setUploading(false)
  }

  async function handleBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    const path = `${groupId}/bg.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('templates').upload(path, file, { upsert: true })
    if (error) { toast.error(error.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('templates').getPublicUrl(path)
    setTemplate(t => ({ ...t, template_bg_image_url: publicUrl }))
    await supabase.from('groups').update({ template_bg_image_url: publicUrl }).eq('id', groupId)
    toast.success('Image de fond uploadée'); setUploading(false)
  }

  function setTpl(field: keyof Template, value: string) { setTemplate(t => ({ ...t, [field]: value })) }
  function insertTplVar(field: keyof Template, v: string) { setTemplate(t => ({ ...t, [field]: ((t[field] as string) ?? '') + v })) }

  // ── Communications handlers ──────────────────────────────────────────────

  const membersWithEmail = useMemo(() =>
    [...members].sort((a, b) => a.surname.localeCompare(b.surname, 'fr')), [members])
  const selectedMembers = membersWithEmail.filter(m => selectedIds.has(m.id))

  function toggleMember(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function selectAll()  { setSelectedIds(new Set(membersWithEmail.filter(m => m.email).map(m => m.id))) }
  function selectNone() { setSelectedIds(new Set()) }

  async function applyEventFilter() {
    if (!filterEventId) return
    const { data } = await supabase.from('event_participants').select('player_id').eq('event_id', filterEventId).eq('status', filterStatus)
    const memberIds = new Set(members.map(m => m.id))
    setSelectedIds(new Set((data ?? []).map((r: any) => r.player_id as string).filter(id => memberIds.has(id))))
  }

  function applyCommTemplate(tplId: string) {
    const tpl = COMM_TEMPLATES.find(t => t.id === tplId); if (!tpl) return
    setActiveCommTpl(tplId); setCommSubject(tpl.subject); setCommBody(tpl.body)
  }

  const previewVars = selectedMembers[0] ? {
    first_name: selectedMembers[0].first_name, surname: selectedMembers[0].surname,
    player_name: `${selectedMembers[0].first_name} ${selectedMembers[0].surname}`, group_name: 'Mon groupe',
  } : {}

  function applyPreviewVars(text: string) {
    return Object.entries(previewVars).reduce((r, [k, v]) => r.replace(new RegExp(`{{${k}}}`, 'g'), v), text)
  }

  async function handleSend() {
    if (!commSubject.trim()) { toast.error('Sujet manquant'); return }
    if (!commBody.trim())    { toast.error('Message manquant'); return }
    if (selectedIds.size === 0) { toast.error('Aucun destinataire'); return }
    setSending(true)
    try {
      const res = await fetch('/api/send-communication', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groupId, playerIds: [...selectedIds], subject: commSubject, body: commBody, eventId: filterEventId || null }),
      })
      const json = await res.json()
      if (json.success) toast.success(`${json.sent} email${json.sent > 1 ? 's' : ''} envoyé${json.sent > 1 ? 's' : ''}${json.skipped ? ` · ${json.skipped} ignoré(s)` : ''}`)
      else toast.error(json.error ?? 'Erreur envoi')
      if (json.errors?.length) toast.error(`Erreurs : ${json.errors.join(', ')}`)
    } catch (e: any) { toast.error(e.message) }
    finally { setSending(false) }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading || roleLoading) return (
    <div className="p-6 space-y-3 max-w-3xl">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )

  if (!isOwner) return (
    <div className="p-5 sm:p-6">
      <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-[12px] text-blue-700 font-medium">
        Seul l'organisateur peut accéder à cette section
      </div>
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Communications</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Emails et templates du groupe</p>
      </div>

      {/* Tabs principaux */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-6">
        {([
          { key: 'send',      label: '✉️ Nouveau message' },
          { key: 'templates', label: '🎨 Templates' },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setMainTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors ${
              mainTab === tab.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════ NOUVEAU MESSAGE ══════════ */}
      {mainTab === 'send' && (
        <div className="flex flex-col gap-6">

          {/* Destinataires */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <p className="text-[13px] font-bold text-slate-800">
                Destinataires
                {selectedIds.size > 0 && (
                  <span className="ml-2 text-[11px] font-semibold text-white bg-[#185FA5] px-2 py-0.5 rounded-full">
                    {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
                  </span>
                )}
              </p>
              <div className="flex gap-1">
                <button onClick={selectAll}  className="text-[11px] font-semibold text-[#185FA5] hover:underline px-2 py-1">Tous</button>
                <button onClick={selectNone} className="text-[11px] font-semibold text-slate-400 hover:underline px-2 py-1">Aucun</button>
              </div>
            </div>

            {/* Filtres */}
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-2 items-end">
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                {(['all', 'event', 'role'] as const).map(mode => (
                  <button key={mode} onClick={() => setFilterMode(mode)}
                    className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                      filterMode === mode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    {mode === 'all' ? 'Tous' : mode === 'event' ? 'Par événement' : 'Par rôle'}
                  </button>
                ))}
              </div>
              {filterMode === 'event' && (<>
                <select value={filterEventId} onChange={e => setFilterEventId(e.target.value)} className={selectClass}>
                  <option value="">Choisir un événement...</option>
                  {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as ParticipantStatus)} className={selectClass}>
                  <option value="GOING">Confirmés</option>
                  <option value="INVITED">Invités</option>
                  <option value="DECLINED">Déclinés</option>
                  <option value="WAITLIST">Liste d'attente</option>
                </select>
                <button onClick={applyEventFilter} disabled={!filterEventId}
                  className="text-[12px] font-semibold px-3 py-2 rounded-xl bg-[#185FA5] text-white hover:bg-[#0C447C] disabled:opacity-40 transition-colors">
                  Appliquer
                </button>
              </>)}
              {filterMode === 'role' && (
                <div className="flex gap-2">
                  <button onClick={() => setSelectedIds(new Set(membersWithEmail.filter(m => m.role === 'owner').map(m => m.id)))}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-[#B5D4F4] bg-[#EBF3FC] text-[#185FA5] hover:bg-blue-100 transition-colors">Admins</button>
                  <button onClick={() => setSelectedIds(new Set(membersWithEmail.filter(m => m.role !== 'owner' && m.role !== 'guest').map(m => m.id)))}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">Membres</button>
                  <button onClick={() => setSelectedIds(new Set(membersWithEmail.filter(m => m.role === 'guest').map(m => m.id)))}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">Visiteurs</button>
                </div>
              )}
            </div>

            {/* Liste membres */}
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {membersWithEmail.map(member => {
                const hasEmail = !!member.email; const isSelected = selectedIds.has(member.id)
                return (
                  <label key={member.id} className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors ${!hasEmail ? 'opacity-40 cursor-not-allowed' : isSelected ? 'bg-[#EBF3FC]/50' : 'hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={isSelected} disabled={!hasEmail} onChange={() => hasEmail && toggleMember(member.id)}
                      className="rounded border-slate-300 text-[#185FA5] focus:ring-[#185FA5]/30" />
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                      style={{ background: member.role === 'guest' ? '#FEF3C7' : '#EBF3FC', color: member.role === 'guest' ? '#92400E' : '#0C447C' }}>
                      {member.first_name[0]}{member.surname[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] font-semibold text-slate-800">{member.first_name} {member.surname}</span>
                      {member.email ? <span className="text-[11px] text-slate-400 ml-2">{member.email}</span>
                        : <span className="text-[11px] text-red-400 ml-2">Pas d'email</span>}
                    </div>
                    {member.role === 'owner' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EBF3FC] text-[#185FA5]">Admin</span>}
                    {member.role === 'guest' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E]">Visiteur</span>}
                  </label>
                )
              })}
            </div>
          </div>

          {/* Éditeur */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-[13px] font-bold text-slate-800 mb-3">Message</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {COMM_TEMPLATES.map(tpl => (
                  <button key={tpl.id} onClick={() => applyCommTemplate(tpl.id)}
                    className={`text-[11px] font-semibold px-3 py-1.5 rounded-xl border transition-colors ${activeCommTpl === tpl.id ? 'bg-[#185FA5] border-[#185FA5] text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                    {tpl.label}
                  </button>
                ))}
              </div>
              <div className="mb-3">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Sujet</label>
                <input type="text" value={commSubject} onChange={e => setCommSubject(e.target.value)} placeholder="Sujet de l'email..." className={inputClass} />
              </div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[11px] font-semibold text-slate-400">Insérer :</span>
                {COMM_VARS.map(v => (
                  <button key={v.key} onClick={() => setCommBody(p => p + v.key)}
                    className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
                    {v.key}
                  </button>
                ))}
              </div>
              <div className="mb-3">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Corps du message</label>
                <textarea value={commBody} onChange={e => setCommBody(e.target.value)} rows={10}
                  placeholder="Écris ton message ici..." className={`${textareaClass} font-mono leading-relaxed`} />
              </div>
              {selectedMembers.length > 0 && (commSubject || commBody) && (
                <div>
                  <button onClick={() => setPreview(v => !v)} className="text-[12px] font-semibold text-[#185FA5] hover:underline mb-2">
                    {preview ? '▲ Masquer' : `▼ Prévisualiser pour ${selectedMembers[0].first_name}`}
                  </button>
                  {preview && (
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 text-[13px] text-slate-700 leading-relaxed">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Sujet : {applyPreviewVars(commSubject)}</p>
                      <div className="whitespace-pre-wrap">{applyPreviewVars(commBody)}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="px-5 py-4 bg-slate-50/50 flex items-center justify-between gap-4">
              <p className="text-[12px] text-slate-500">
                {selectedIds.size === 0 ? 'Aucun destinataire' : `${selectedIds.size} destinataire${selectedIds.size > 1 ? 's' : ''}`}
              </p>
              <button onClick={handleSend} disabled={sending || selectedIds.size === 0 || !commSubject.trim() || !commBody.trim()}
                className="flex items-center gap-2 bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-40 transition-colors">
                {sending
                  ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Envoi...</>
                  : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Envoyer</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ TEMPLATES ══════════ */}
      {mainTab === 'templates' && (
        <div>
          {/* Scope */}
          <div className="rounded-xl border border-white/60 shadow-sm p-4 mb-5" style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
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
                  {useGroupTemplate ? 'Template du groupe (par défaut)' : 'Template spécifique à un event'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {useGroupTemplate ? 'Tous les events utiliseront ce template sauf ceux personnalisés' : "Uniquement pour l'event sélectionné"}
                </p>
              </div>
            </div>
            {!useGroupTemplate && (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Événement</label>
                <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}
                  className="w-full border border-white/50 rounded-xl px-3 py-2.5 text-[13px] bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30">
                  {events.map(e => <option key={e.id} value={e.id}>{e.title} — {formatDate(e.starts_at)}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Identité visuelle */}
          <div className="rounded-xl border border-white/60 shadow-sm p-5 mb-5" style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Identité visuelle</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-2">Logo d'en-tête</label>
                {template.template_logo_url ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={template.template_logo_url} alt="Logo" className="h-12 object-contain border border-white/50 rounded-xl p-1 bg-white/30" />
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
                  <input type="color" value={template.template_header_color} onChange={e => setTpl('template_header_color', e.target.value)}
                    className="w-10 h-10 rounded-xl border border-white/50 cursor-pointer p-0.5" />
                  <div>
                    <p className="text-[13px] font-semibold text-slate-700">{template.template_header_color}</p>
                    <button onClick={() => setTpl('template_header_color', '#185FA5')} className="text-[11px] font-medium text-slate-400 hover:text-slate-600">Défaut GolfGo</button>
                  </div>
                </div>
                <div className="mt-3 rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: template.template_header_color }}>
                  {template.template_logo_url
                    ? <img src={template.template_logo_url} alt="Logo" className="h-6 object-contain" />
                    : <><span className="text-[15px] font-black text-white">Golf</span><span className="text-[15px] font-black" style={{ color: '#4CAF1A' }}>Go</span></>
                  }
                  <span className="text-[10px] text-white/70 uppercase tracking-wider font-semibold">Aperçu</span>
                </div>
              </div>
            </div>
            <div className="mt-5 pt-5 border-t border-slate-100">
              <label className="block text-[12px] font-semibold text-slate-600 mb-2">
                Image de fond <span className="text-slate-400 font-normal">— cards mobile uniquement</span>
              </label>
              {template.template_bg_image_url ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={template.template_bg_image_url} alt="Fond" className="h-16 w-32 object-cover rounded-xl border border-white/50" />
                  <div className="flex flex-col gap-1">
                    <button onClick={() => bgFileInputRef.current?.click()} className="text-[11px] font-semibold text-[#185FA5] hover:underline">Changer</button>
                    <button onClick={async () => { setTemplate(t => ({ ...t, template_bg_image_url: null })); await supabase.from('groups').update({ template_bg_image_url: null }).eq('id', groupId); toast.success('Image supprimée') }}
                      className="text-[11px] font-semibold text-red-500 hover:underline">Supprimer</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => bgFileInputRef.current?.click()} disabled={uploading}
                  className="w-full border border-dashed border-slate-300 rounded-xl py-4 text-[12px] font-medium text-slate-400 hover:border-[#185FA5] hover:text-[#185FA5] transition-colors">
                  {uploading ? 'Upload…' : '+ Ajouter une image de fond'}
                </button>
              )}
              <input ref={bgFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
              <p className="text-[10px] text-slate-400 mt-1.5">JPG, PNG — arrière-plan des cards événements sur mobile</p>
            </div>
          </div>

          {/* Sous-onglets */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-5">
            {([
              { key: 'invitation', label: 'Email invitation' },
              { key: 'teesheet',   label: 'Email tee sheet' },
              { key: 'print',      label: 'Documents' },
            ] as const).map(tab => (
              <button key={tab.key} onClick={() => setTemplateTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${templateTab === tab.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {templateTab === 'invitation' && (
            <div className="rounded-xl border border-white/60 shadow-sm p-5 space-y-4" style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Objet</label>
                <input value={template.template_invitation_subject ?? ''} onChange={e => setTpl('template_invitation_subject', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Corps du message</label>
                <textarea value={template.template_invitation_body ?? ''} onChange={e => setTpl('template_invitation_body', e.target.value)} rows={6} className={textareaClass} />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {TEMPLATE_VARS.map(v => (
                    <button key={v.value} onClick={() => insertTplVar('template_invitation_body', v.value)}
                      className="text-[10px] font-mono bg-blue-50 text-[#185FA5] border border-blue-200 px-2 py-0.5 rounded-lg hover:bg-blue-100 transition-colors">{v.value}</button>
                  ))}
                </div>
                 <p className="text-[11px] text-slate-500 mt-2">
                  Utilise <code className="bg-slate-100 px-1 rounded">{'{{yes_button}}'}</code> pour insérer les boutons "Je participe / Je ne peux pas" à l'endroit de ton choix dans le message.
                </p>
              </div>
            </div>
          )}

          {templateTab === 'teesheet' && (
            <div className="rounded-xl border border-white/60 shadow-sm p-5 space-y-4" style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Objet</label>
                <input value={template.template_teesheet_subject ?? ''} onChange={e => setTpl('template_teesheet_subject', e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Corps du message</label>
                <textarea value={template.template_teesheet_body ?? ''} onChange={e => setTpl('template_teesheet_body', e.target.value)} rows={6} className={textareaClass} />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {TEMPLATE_VARS.map(v => (
                    <button key={v.value} onClick={() => insertTplVar('template_teesheet_body', v.value)}
                      className="text-[10px] font-mono bg-blue-50 text-[#185FA5] border border-blue-200 px-2 py-0.5 rounded-lg hover:bg-blue-100 transition-colors">{v.value}</button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Ce texte apparaît avant le tableau des flights dans l'email</p>
              </div>
            </div>
          )}

          {templateTab === 'print' && (
            <div className="rounded-xl border border-white/60 shadow-sm p-8 text-center" style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
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
              <button onClick={handleReset} className="text-[12px] font-semibold px-4 py-2 rounded-xl border border-white/50 text-slate-500 hover:bg-white/30 transition-colors">↺ Réinitialiser</button>
              <p className="text-[12px] text-slate-500">
                {useGroupTemplate ? 'Sauvegarde pour tout le groupe' : `Pour : ${events.find(e => e.id === selectedEventId)?.title ?? ''}`}
              </p>
            </div>
            <button onClick={handleSaveTemplate} disabled={saving}
              className="bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
              {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

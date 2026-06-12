'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useGroupRole } from '@/lib/hooks/useGroupRole'
import toast from 'react-hot-toast'
import EmailPreviewModal from '@/components/email/EmailPreviewModal'
import { useTranslations, useLocale } from 'next-intl'

const supabase = createClient()

const inputClass    = "w-full border border-white/60 rounded-xl px-3 py-2.5 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] bg-white/70 backdrop-blur-sm"
const textareaClass = `${inputClass} resize-none`
const selectClass   = "border border-slate-200 rounded-xl px-3 py-2 text-[12px] bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30"

type Template = {
  template_logo_url:           string | null
  template_header_color:       string
  template_bg_image_url:       string | null
  template_invitation_subject: string | null
  template_invitation_body:    string | null
  template_teesheet_subject:   string | null
  template_teesheet_body:      string | null
  template_reminder_subject:   string | null
  template_reminder_body:      string | null
  template_newmember_subject:  string | null
  template_newmember_body:     string | null
}
type Member = { id: string; first_name: string; surname: string; email: string | null; role: string }
type EventRow = { id: string; title: string; starts_at: string }
type ParticipantStatus = 'GOING' | 'INVITED' | 'DECLINED' | 'WAITLIST'
type MessageType = 'invitation' | 'reminder' | 'teesheet' | 'newmember' | 'free'

const INVITATION_BODY_DEFAULT = "Bonjour {{first_name}},\n\nJ'ai le plaisir de t'inviter à notre prochaine rencontre.\nPourras-tu être des nôtres ?\n\nAu plaisir de te revoir,\n{{owner_name}}"
const DEFAULTS: Template = {
  template_logo_url: null, template_header_color: '#185FA5', template_bg_image_url: null,
  template_invitation_subject: 'Invitation : {{event_title}}',
  template_invitation_body: INVITATION_BODY_DEFAULT,
  template_teesheet_subject: 'Tee Sheet — {{event_title}}',
  template_teesheet_body: "Bonjour {{first_name}},\n\nVoici l'ordre de départ pour {{event_title}}.\n\nTon flight est le numéro {{flight_number}} avec départ à {{start_time}}.",
  template_reminder_subject:  '⏰ Rappel — {{event_title}} dans 3 jours',
  template_reminder_body:     "Bonjour {{first_name}},\n\nRappel pour {{event_title}} qui a lieu dans 3 jours.\n\nAu plaisir de te voir,\n{{owner_name}}",
  template_newmember_subject: 'Bienvenue dans le groupe !',
  template_newmember_body: "Bonjour {{first_name}},\n\nBienvenue dans notre groupe GolfGo !\n\nPour accéder à l'app, clique sur le lien ou scanne le QR code :\n{{app_url}}\n\n{{qr_code}}\n\n📱 iPhone : {{install_iphone}}\n🤖 Android : {{install_android}}\n\nÀ bientôt,\n{{owner_name}}",
}

const COMM_VARS = [
  { key: '{{first_name}}', label: 'Prénom' },
  { key: '{{surname}}', label: 'Nom' },
  { key: '{{player_name}}', label: 'Prénom + Nom' },
  { key: '{{group_name}}', label: 'Groupe' },
  { key: '{{owner_name}}', label: 'Signature' },
  { key: '{{event_title}}', label: 'Titre event' },
  { key: '{{event_date}}', label: 'Date event' },
  { key: '{{event_time}}', label: 'Heure event' },
  { key: '{{yes_button}}', label: '✓/✗ Boutons réponse' },
  { key: '{{places_restantes}}', label: 'Places restantes' },
  { key: '{{app_url}}',          label: 'URL app' },
  { key: '{{qr_code}}',          label: 'QR Code' },
  { key: '{{install_iphone}}',   label: 'Instructions iPhone' },
  { key: '{{install_android}}',  label: 'Instructions Android' },
]

function IconBtn({ onClick, href, title, disabled, color, children }: {
  onClick?: () => void; href?: string; title: string
  disabled?: boolean; color?: 'blue'; children: React.ReactNode
}) {
  const base = `w-9 h-9 flex items-center justify-center rounded-xl border text-[16px] transition-colors flex-shrink-0`
  const cls = disabled
    ? `${base} border-slate-200 text-slate-300 bg-slate-50 cursor-not-allowed`
    : color === 'blue'
      ? `${base} border-[#185FA5] bg-[#185FA5] text-white hover:bg-[#0C447C]`
      : `${base} border-slate-200 text-slate-600 hover:bg-slate-50`
  if (href) return (
    <a href={disabled ? undefined : href} target="_blank" rel="noopener noreferrer"
      title={title} className={cls} style={disabled ? { pointerEvents: 'none' } : {}}>
      {children}
    </a>
  )
  return <button type="button" onClick={onClick} disabled={disabled} title={title} className={cls}>{children}</button>
}

function formatDate(d: string, locale: string) {
  return new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export default function CommunicationsPage() {
  const params  = useParams()
  const groupId = params.id as string
  const { role, loading: roleLoading } = useGroupRole(groupId)
  const isOwner = role === 'owner'
  const t      = useTranslations()
  const locale = useLocale()

  const [members,         setMembers]         = useState<Member[]>([])
  const [events,          setEvents]          = useState<EventRow[]>([])
  const [loading,         setLoading]         = useState(true)
  const [groupTemplate,   setGroupTemplate]   = useState<Template>(DEFAULTS)
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [saving,          setSaving]          = useState(false)
  const [uploading,       setUploading]       = useState(false)
  const [showSettings,    setShowSettings]    = useState(false)

  const fileInputRef   = useRef<HTMLInputElement>(null)
  const bgFileInputRef = useRef<HTMLInputElement>(null)

  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set())
  const [filterMode,    setFilterMode]    = useState<'all' | 'event' | 'role'>('all')
  const [filterEventId, setFilterEventId] = useState<string>('')
  const [filterStatus,  setFilterStatus]  = useState<ParticipantStatus>('GOING')

  const [messageType,   setMessageType]   = useState<MessageType>('invitation')
  const [commSubject,   setCommSubject]   = useState('')
  const [commBody,      setCommBody]      = useState('')
  const [sending,       setSending]       = useState(false)
  const [preview,       setPreview]       = useState(false)
  const [showPreview,   setShowPreview]   = useState(false)

  const MESSAGE_TYPES: { id: MessageType; label: string }[] = [
    { id: 'invitation', label: t('communications.msgTypes.invitation') },
    { id: 'reminder',   label: t('communications.msgTypes.reminder') },
    { id: 'teesheet',   label: t('communications.msgTypes.teesheet') },
    { id: 'newmember',  label: t('communications.msgTypes.newmember') },
    { id: 'free',       label: t('communications.msgTypes.free') },
  ]

  useEffect(() => { loadAll() }, [groupId])

  async function loadAll() {
    setLoading(true)
    const [{ data: group }, { data: evts }, { data: membersData }] = await Promise.all([
      supabase.from('groups')
      .select('template_logo_url, template_header_color, template_bg_image_url, template_invitation_subject, template_invitation_body, template_teesheet_subject, template_teesheet_body, template_reminder_subject, template_reminder_body, template_newmember_subject, template_newmember_body')
      .eq('id', groupId).single(),
      supabase.from('events').select('id, title, starts_at').eq('group_id', groupId).order('starts_at', { ascending: false }),
      supabase.from('groups_players').select('role, player:players(id, first_name, surname, email)').eq('group_id', groupId)
    ])

    if (group) setGroupTemplate({
      template_logo_url:           group.template_logo_url ?? null,
      template_header_color:       group.template_header_color ?? '#185FA5',
      template_bg_image_url:       group.template_bg_image_url ?? null,
      template_invitation_subject: group.template_invitation_subject ?? DEFAULTS.template_invitation_subject,
      template_invitation_body:    group.template_invitation_body ?? DEFAULTS.template_invitation_body,
      template_teesheet_subject:   group.template_teesheet_subject ?? DEFAULTS.template_teesheet_subject,
      template_teesheet_body:      group.template_teesheet_body ?? DEFAULTS.template_teesheet_body,
      template_reminder_subject:  group.template_reminder_subject  ?? DEFAULTS.template_reminder_subject,
      template_reminder_body:     group.template_reminder_body     ?? DEFAULTS.template_reminder_body,
      template_newmember_subject: group.template_newmember_subject ?? DEFAULTS.template_newmember_subject,
      template_newmember_body:    group.template_newmember_body    ?? DEFAULTS.template_newmember_body,
    })

    setEvents(evts || [])
    if (evts?.length) {
      const retained = localStorage.getItem(`golfgo-active-event-${groupId}`)
      const retainedExists = evts.find((e: { id: string }) => e.id === retained)
      const defaultId = retainedExists?.id ?? evts[0].id
      setSelectedEventId(defaultId)
      setFilterEventId(defaultId)
    }

    setMembers((membersData ?? []).map((r: any) => ({ ...r.player, role: r.role })))
    setLoading(false)
  }

  // Pré-remplir sujet/corps selon le type de message
  useEffect(() => {
    switch (messageType) {
      case 'invitation':
        setCommSubject(groupTemplate.template_invitation_subject ?? DEFAULTS.template_invitation_subject ?? '')
        setCommBody(groupTemplate.template_invitation_body ?? DEFAULTS.template_invitation_body ?? '')
        break
      case 'reminder':
        setCommSubject(groupTemplate.template_reminder_subject ?? DEFAULTS.template_reminder_subject ?? '')
        setCommBody(groupTemplate.template_reminder_body ?? DEFAULTS.template_reminder_body ?? '')
        break
      case 'newmember':
        setCommSubject(groupTemplate.template_newmember_subject ?? DEFAULTS.template_newmember_subject ?? '')
        setCommBody(groupTemplate.template_newmember_body ?? DEFAULTS.template_newmember_body ?? '')
        break
      case 'teesheet':
        setCommSubject(groupTemplate.template_teesheet_subject ?? DEFAULTS.template_teesheet_subject ?? '')
        setCommBody(groupTemplate.template_teesheet_body ?? DEFAULTS.template_teesheet_body ?? '')
        break
      case 'newmember':
        setCommSubject(t('communications.msgTypes.newmemberSubject'))
        setCommBody(t('communications.msgTypes.newmemberBody'))
        break
      case 'free':
        setCommSubject('')
        setCommBody('')
        break
    }
  }, [messageType, groupTemplate])

  async function handleSaveTemplate() {
    setSaving(true)
    const { error } = await supabase.from('groups').update(groupTemplate).eq('id', groupId)
    if (error) { toast.error(error.message); setSaving(false); return }
    toast.success(t('communications.toasts.groupSaved'))
    setSaving(false)
  }

  async function handleReset() {
    if (!confirm(t('communications.templates.reset'))) return
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
    toast.success(t('communications.toasts.groupReset'))
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; setUploading(true)
    const path = `${groupId}/logo.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('templates').upload(path, file, { upsert: true })
    if (error) { toast.error(error.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('templates').getPublicUrl(path)
    setGroupTemplate(prev => ({ ...prev, template_logo_url: publicUrl }))
    toast.success(t('communications.toasts.logoUploaded')); setUploading(false)
  }

  async function handleBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return; setUploading(true)
    const path = `${groupId}/bg.${file.name.split('.').pop()}`
    const { error } = await supabase.storage.from('templates').upload(path, file, { upsert: true })
    if (error) { toast.error(error.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('templates').getPublicUrl(path)
    setGroupTemplate(prev => ({ ...prev, template_bg_image_url: publicUrl }))
    await supabase.from('groups').update({ template_bg_image_url: publicUrl }).eq('id', groupId)
    toast.success(t('communications.toasts.bgUploaded')); setUploading(false)
  }

  const membersWithEmail = useMemo(() =>
    [...members].sort((a, b) => a.surname.localeCompare(b.surname, locale))
  , [members, locale])

  const selectedMembers = membersWithEmail.filter(m => selectedIds.has(m.id))

  function toggleMember(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function selectAll()  { setSelectedIds(new Set(membersWithEmail.filter(m => m.email).map(m => m.id))) }
  function selectNone() { setSelectedIds(new Set()) }

  async function applyEventFilter() {
    if (!filterEventId) return
    const { data } = await supabase.from('event_participants')
      .select('player_id').eq('event_id', filterEventId).eq('status', filterStatus)
    const memberIds = new Set(members.map(m => m.id))
    setSelectedIds(new Set((data ?? []).map((r: any) => r.player_id as string).filter((id: string) => memberIds.has(id))))
  }

  const previewVars = selectedMembers[0] ? {
    first_name: selectedMembers[0].first_name,
    surname: selectedMembers[0].surname,
    player_name: `${selectedMembers[0].first_name} ${selectedMembers[0].surname}`,
    group_name: 'Mon groupe',
  } : {}

  function applyPreviewVars(text: string) {
    return Object.entries(previewVars).reduce((r, [k, v]) => r.replace(new RegExp(`{{${k}}}`, 'g'), v), text)
  }

  function buildWhatsAppComm(): string {
    const text = `*${commSubject}*\n\n${commBody.replace(/\{\{[^}]+\}\}/g, '…')}`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }

 async function handleSend() {
  if (!commSubject.trim()) { toast.error(t('communications.toasts.missingSubject')); return }
  if (!commBody.trim())    { toast.error(t('communications.toasts.missingBody')); return }
  if (selectedIds.size === 0) { toast.error(t('communications.toasts.noRecipients')); return }

  // Sauvegarder le template si ce n'est pas un message libre
  if (messageType !== 'free') {
    const update: Partial<Template> = {}
    if (messageType === 'invitation') {
      update.template_invitation_subject = commSubject
      update.template_invitation_body    = commBody
    } else if (messageType === 'teesheet') {
      update.template_teesheet_subject = commSubject
      update.template_teesheet_body    = commBody
    } else if (messageType === 'reminder') {
      update.template_reminder_subject = commSubject
      update.template_reminder_body    = commBody
    } else if (messageType === 'newmember') {
      update.template_newmember_subject = commSubject
      update.template_newmember_body    = commBody
    }
    if (Object.keys(update).length > 0) {
      await supabase.from('groups').update(update).eq('id', groupId)
      setGroupTemplate(prev => ({ ...prev, ...update }))
    }
  }

  setSending(true)
    try {
      const res = await fetch('/api/send-communication', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId, playerIds: [...selectedIds],
          subject: commSubject, body: commBody,
          eventId: filterEventId || selectedEventId || null,
        }),
      })
      const json = await res.json()
      if (json.success) toast.success(`${json.sent} email${json.sent > 1 ? 's' : ''} envoyé${json.sent > 1 ? 's' : ''}${json.skipped ? ` · ${json.skipped} ignoré(s)` : ''}`)
      else toast.error(json.error ?? t('common.error'))
      if (json.errors?.length) toast.error(`Erreurs : ${json.errors.join(', ')}`)
    } catch (e: any) { toast.error(e.message) }
    finally { setSending(false) }
  }

  const canSend = !sending && selectedIds.size > 0 && !!commSubject.trim() && !!commBody.trim() && isOwner
  const hasMsg  = !!commSubject && !!commBody

  if (loading || roleLoading) return (
    <div className="p-6 space-y-3 max-w-3xl">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-3xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">{t('communications.title')}</h1>
          <p className="text-[13px] text-slate-900 mt-0.5">{t('communications.subtitle')}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <IconBtn onClick={() => window.print()} title="Imprimer">🖨</IconBtn>
          <IconBtn onClick={() => setShowPreview(true)} disabled={!hasMsg || selectedIds.size === 0 || !isOwner} title={t('communications.message.preview')}>👁</IconBtn>
          <IconBtn href={hasMsg ? buildWhatsAppComm() : undefined} disabled={!hasMsg} title="WhatsApp">💬</IconBtn>
          <IconBtn onClick={handleSend} disabled={!canSend} title={sending ? t('communications.message.sending') : t('communications.message.send')} color="blue">
            {sending ? '⏳' : '📤'}
          </IconBtn>
          <button
            onClick={() => setShowSettings(v => !v)}
            className={`w-9 h-9 flex items-center justify-center rounded-xl border text-[16px] transition-colors flex-shrink-0 ${showSettings ? 'border-[#185FA5] bg-[#EBF3FC] text-[#185FA5]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            title={t('communications.settings.title')}>
            ⚙️
          </button>
        </div>
      </div>

      {/* ── Panneau Paramètres (collapsible) ── */}
      {showSettings && (
        <div className="rounded-xl border border-white/60 shadow-sm p-5 mb-6" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">{t('communications.settings.visualIdentity')}</p>
          <p className="text-[11px] text-slate-400 mb-4">{t('communications.settings.visualDesc')}</p>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-2">{t('communications.templates.headerLogo')}</label>
              {groupTemplate.template_logo_url ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={groupTemplate.template_logo_url} alt="Logo" className="h-12 object-contain border border-white/50 rounded-xl p-1 bg-white/30" />
                  <div className="flex flex-col gap-1">
                    <button onClick={() => fileInputRef.current?.click()} className="text-[11px] font-semibold text-[#185FA5] hover:underline">{t('communications.templates.changeLogo')}</button>
                    <button onClick={() => setGroupTemplate(prev => ({ ...prev, template_logo_url: null }))} className="text-[11px] font-semibold text-red-500 hover:underline">{t('communications.templates.deleteLogo')}</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  className="w-full border border-dashed border-slate-300 rounded-xl py-4 text-[12px] font-medium text-slate-400 hover:border-[#185FA5] hover:text-[#185FA5] transition-colors">
                  {uploading ? t('communications.templates.uploading') : t('communications.templates.addLogo')}
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-2">{t('communications.templates.headerColor')}</label>
              <div className="flex items-center gap-3">
                <input type="color" value={groupTemplate.template_header_color}
                  onChange={e => setGroupTemplate(prev => ({ ...prev, template_header_color: e.target.value }))}
                  className="w-10 h-10 rounded-xl border border-white/50 cursor-pointer p-0.5" />
                <div>
                  <p className="text-[13px] font-semibold text-slate-700">{groupTemplate.template_header_color}</p>
                  <button onClick={() => setGroupTemplate(prev => ({ ...prev, template_header_color: '#185FA5' }))}
                    className="text-[11px] font-medium text-slate-400 hover:text-slate-600">{t('communications.templates.defaultColor')}</button>
                </div>
              </div>
              <div className="mt-3 rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: groupTemplate.template_header_color }}>
                {groupTemplate.template_logo_url
                  ? <img src={groupTemplate.template_logo_url} alt="Logo" className="h-6 object-contain" />
                  : <><span className="text-[15px] font-black text-white">Golf</span><span className="text-[15px] font-black" style={{ color: '#4CAF1A' }}>Go</span></>}
                <span className="text-[10px] text-white/70 uppercase tracking-wider font-semibold">Aperçu</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <label className="block text-[12px] font-semibold text-slate-600 mb-2">
              {t('communications.templates.bgImage')}
            </label>
            {groupTemplate.template_bg_image_url ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={groupTemplate.template_bg_image_url} alt="Fond" className="h-16 w-32 object-cover rounded-xl border border-white/50" />
                <div className="flex flex-col gap-1">
                  <button onClick={() => bgFileInputRef.current?.click()} className="text-[11px] font-semibold text-[#185FA5] hover:underline">{t('communications.templates.changeLogo')}</button>
                  <button onClick={async () => {
                    setGroupTemplate(prev => ({ ...prev, template_bg_image_url: null }))
                    await supabase.from('groups').update({ template_bg_image_url: null }).eq('id', groupId)
                    toast.success(t('communications.toasts.bgDeleted'))
                  }} className="text-[11px] font-semibold text-red-500 hover:underline">{t('communications.templates.deleteLogo')}</button>
                </div>
              </div>
            ) : (
              <button onClick={() => bgFileInputRef.current?.click()} disabled={uploading}
                className="w-full border border-dashed border-slate-300 rounded-xl py-4 text-[12px] font-medium text-slate-400 hover:border-[#185FA5] hover:text-[#185FA5] transition-colors">
                {uploading ? t('communications.templates.uploading') : t('communications.templates.addBgImage')}
              </button>
            )}
            <input ref={bgFileInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
          </div>

          <div className="flex items-center justify-between mt-5 gap-3">
            <button onClick={handleReset} className="text-[12px] font-semibold px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
              {t('communications.templates.reset')}
            </button>
            <button onClick={handleSaveTemplate} disabled={saving}
              className="bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
              {saving ? t('communications.templates.saving') : t('communications.templates.save')}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">

        {/* ── Destinataires ── */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <p className="text-[13px] font-bold text-slate-800">
              {t('communications.recipients.title')}
              {selectedIds.size > 0 && (
                <span className="ml-2 text-[11px] font-semibold text-white bg-[#185FA5] px-2 py-0.5 rounded-full">
                  {t('communications.recipients.selected', { count: selectedIds.size })}
                </span>
              )}
            </p>
            <div className="flex gap-1">
              <button onClick={selectAll}  className="text-[11px] font-semibold text-[#185FA5] hover:underline px-2 py-1">{t('communications.recipients.all')}</button>
              <button onClick={selectNone} className="text-[11px] font-semibold text-slate-400 hover:underline px-2 py-1">{t('communications.recipients.none')}</button>
            </div>
          </div>
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-2 items-end">
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {(['all', 'event', 'role'] as const).map(mode => (
                <button key={mode} onClick={() => setFilterMode(mode)}
                  className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${filterMode === mode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  {mode === 'all' ? t('communications.recipients.filter.all') : mode === 'event' ? t('communications.recipients.filter.byEvent') : t('communications.recipients.filter.byRole')}
                </button>
              ))}
            </div>
            {filterMode === 'event' && (<>
              <select value={filterEventId} onChange={e => { setFilterEventId(e.target.value); localStorage.setItem(`golfgo-active-event-${groupId}`, e.target.value) }} className={selectClass}>
                <option value="">{t('communications.recipients.chooseEvent')}</option>
                {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as ParticipantStatus)} className={selectClass}>
                <option value="GOING">{t('communications.status.GOING')}</option>
                <option value="INVITED">{t('communications.status.INVITED')}</option>
                <option value="DECLINED">{t('communications.status.DECLINED')}</option>
                <option value="WAITLIST">{t('communications.status.WAITLIST')}</option>
              </select>
              <button onClick={applyEventFilter} disabled={!filterEventId}
                className="text-[12px] font-semibold px-3 py-2 rounded-xl bg-[#185FA5] text-white hover:bg-[#0C447C] disabled:opacity-40 transition-colors">
                {t('communications.recipients.apply')}
              </button>
            </>)}
            {filterMode === 'role' && (
              <div className="flex gap-2">
                <button onClick={() => setSelectedIds(new Set(membersWithEmail.filter(m => m.role === 'owner').map(m => m.id)))} className="text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-[#B5D4F4] bg-[#EBF3FC] text-[#185FA5] hover:bg-blue-100 transition-colors">{t('communications.recipients.roles.admins')}</button>
                <button onClick={() => setSelectedIds(new Set(membersWithEmail.filter(m => m.role !== 'owner' && m.role !== 'guest').map(m => m.id)))} className="text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">{t('communications.recipients.roles.members')}</button>
                <button onClick={() => setSelectedIds(new Set(membersWithEmail.filter(m => m.role === 'guest').map(m => m.id)))} className="text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">{t('communications.recipients.roles.visitors')}</button>
              </div>
            )}
          </div>
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {membersWithEmail.map(member => {
              const hasEmail = !!member.email; const isSelected = selectedIds.has(member.id)
              return (
                <label key={member.id} className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors ${!hasEmail ? 'opacity-40 cursor-not-allowed' : isSelected ? 'bg-[#EBF3FC]/50' : 'hover:bg-slate-50'}`}>
                  <input type="checkbox" checked={isSelected} disabled={!hasEmail} onChange={() => hasEmail && toggleMember(member.id)} className="rounded border-slate-300 text-[#185FA5] focus:ring-[#185FA5]/30" />
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                    style={{ background: member.role === 'guest' ? '#FEF3C7' : '#EBF3FC', color: member.role === 'guest' ? '#92400E' : '#0C447C' }}>
                    {member.first_name[0]}{member.surname[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-semibold text-slate-800">{member.first_name} {member.surname}</span>
                    {member.email
                      ? <span className="text-[11px] text-slate-400 ml-2">{member.email}</span>
                      : <span className="text-[11px] text-red-400 ml-2">{t('communications.recipients.noEmail')}</span>}
                  </div>
                  {member.role === 'owner' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EBF3FC] text-[#185FA5]">{t('nav.admin')}</span>}
                  {member.role === 'guest' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E]">{t('communications.recipients.roles.visitors')}</span>}
                </label>
              )
            })}
          </div>
        </div>

        {/* ── Message ── */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-[13px] font-bold text-slate-800 mb-3">{t('communications.message.title')}</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {MESSAGE_TYPES.map(type => (
                <button key={type.id} onClick={() => setMessageType(type.id)}
                  className={`text-[11px] font-semibold px-3 py-1.5 rounded-xl border transition-colors ${messageType === type.id ? 'bg-[#185FA5] border-[#185FA5] text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {type.label}
                </button>
              ))}
            </div>

            {/* Sélecteur event pour teesheet/invitation/rappel */}
            {(messageType === 'invitation' || messageType === 'reminder' || messageType === 'teesheet') && events.length > 0 && (
              <div className="mb-3">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{t('communications.message.event')}</label>
                <select value={selectedEventId} onChange={e => { setSelectedEventId(e.target.value); localStorage.setItem(`golfgo-active-event-${groupId}`, e.target.value) }} className={`${selectClass} w-full`}>
                  {events.map(e => <option key={e.id} value={e.id}>{e.title} — {formatDate(e.starts_at, locale)}</option>)}
                </select>
              </div>
            )}

            <div className="mb-3">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{t('communications.message.subject')}</label>
              <input type="text" value={commSubject} onChange={e => setCommSubject(e.target.value)}
                readOnly={!isOwner} placeholder={t('communications.message.subjectPlaceholder')} className={inputClass} />
            </div>

            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-400">{t('communications.message.insert')}</span>
              {COMM_VARS.map(v => (
                <button key={v.key} onClick={() => setCommBody(p => p + v.key)}
                  className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">{v.key}</button>
              ))}
            </div>

            <div className="mb-3">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{t('communications.message.body')}</label>
              <textarea value={commBody} onChange={e => setCommBody(e.target.value)} rows={10}
                readOnly={!isOwner} placeholder={t('communications.message.bodyPlaceholder')}
                className={`${textareaClass} font-mono leading-relaxed`} />
            </div>

            {/* Note pour les templates auto */}
            {messageType !== 'free' && (
            <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-[11px] text-amber-700">
                {t('communications.msgTypes.templateWarning')}
              </p>
            </div>
          )}

            {selectedMembers.length > 0 && (commSubject || commBody) && (
              <div>
                <button onClick={() => setPreview(v => !v)} className="text-[12px] font-semibold text-[#185FA5] hover:underline mb-2">
                  {preview
                    ? t('communications.message.hidePreview')
                    : t('communications.message.showPreview', { name: selectedMembers[0].first_name })}
                </button>
                {preview && (
                  <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 text-[13px] text-slate-700 leading-relaxed">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                      {t('communications.message.subject')} : {applyPreviewVars(commSubject)}
                    </p>
                    <div className="whitespace-pre-wrap">{applyPreviewVars(commBody)}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showPreview && (
        <EmailPreviewModal
          onClose={() => setShowPreview(false)}
          onConfirm={() => { setShowPreview(false); handleSend() }}
          confirmLabel={`${t('communications.message.send')} (${selectedIds.size})`}
          loading={sending}
          fetchPreview={() => fetch('/api/preview-email', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'communication', subject: commSubject, body: commBody,
              groupId, eventId: filterEventId || selectedEventId || null,
            }),
          }).then(r => r.json())}
        />
      )}
    </div>
  )
}
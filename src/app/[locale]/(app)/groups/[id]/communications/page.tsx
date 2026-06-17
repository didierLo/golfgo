'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useGroupRole } from '@/lib/hooks/useGroupRole'
import toast from 'react-hot-toast'
import EmailPreviewModal from '@/components/email/EmailPreviewModal'
import { useTranslations, useLocale } from 'next-intl'
import { buildScorecardHtml, type PrintPlayer } from '@/components/scorecards/buildScorecardHtml'
import type { Hole, TeeInfo } from '@/components/scorecards/scorecard-types'
import { computePhcp } from '@/components/scorecards/scorecard-types'
import CommSettingsPanel from '@/components/communications/CommSettingsPanel'
import CommMessageComposer from '@/components/communications/CommMessageComposer'
import CommRecipientsPanel from '@/components/communications/CommRecipientsPanel'


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
type MessageType = 'invitation' | 'reminder' | 'teesheet' | 'newmember' | 'scorecards' | 'free'



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

// ── Styles print ──────────────────────────────────────────────────────────────





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
  
  const [printPhcpMap, setPrintPhcpMap] = useState<Record<string, { phcp: number; whs: number; tee?: TeeInfo }>>({})
  const [printClubName,   setPrintClubName]   = useState('')
  const [printCourseName, setPrintCourseName] = useState('')

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

  const [mainTab, setMainTab] = useState<'send' | 'settings' | 'invite' | 'scorecards'>('send')

  const [printHoles, setPrintHoles] = useState<Hole[]>([])


  const MESSAGE_TYPES: { id: MessageType; label: string }[] = [
  { id: 'invitation', label: t('communications.msgTypes.invitation') },
  { id: 'reminder',   label: t('communications.msgTypes.reminder') },
  { id: 'teesheet',   label: t('communications.msgTypes.teesheet') },
  { id: 'newmember',  label: t('communications.msgTypes.newmember') },
  { id: 'scorecards', label: '🖨 Scorecards' },
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
      case 'scorecards':
        setCommSubject('')
        setCommBody('')
        break
      case 'free':
        setCommSubject('')
        setCommBody('')
        break
    }
  }, [messageType, groupTemplate])

  useEffect(() => {
  if (messageType === 'scorecards' && filterEventId) loadPrintHoles(filterEventId)
  }, [messageType, filterEventId])

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

  async function handleBgDelete() {
    setGroupTemplate(prev => ({ ...prev, template_bg_image_url: null }))
    await supabase.from('groups').update({ template_bg_image_url: null }).eq('id', groupId)
    toast.success(t('communications.toasts.bgDeleted'))
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
    const { error: tplError, data: tplData } = await supabase
      .from('groups')
      .update(update)
      .eq('id', groupId)
      .select('id, template_reminder_subject, template_reminder_body')
    if (tplError) {
      console.error('Erreur sauvegarde template:', tplError)
      toast.error('Template non sauvegardé : ' + tplError.message)
    } else {
      console.log('Template sauvegardé:', tplData)
    }
    setGroupTemplate(prev => ({ ...prev, ...update }))
    }
  }

  setSending(true)
    try {
    let res: Response
      if (messageType === 'teesheet') {
        const eventId = filterEventId || selectedEventId || ''
        const activeEvent = events.find(e => e.id === eventId)

        const { data: flightsData } = await supabase
          .from('flights')
          .select('id, flight_number, flight_players(player_id, players(id, first_name, surname, whs))')
          .eq('event_id', eventId)
          .order('flight_number')

        const { data: eventParticipants } = await supabase
          .from('event_participants')
          .select('player_id, holes_played, holes_section')
          .eq('event_id', eventId)

        const holesMap: Record<string, { holes_played: number | null; holes_section: string | null }> = {}
        eventParticipants?.forEach((p: any) => {
          holesMap[p.player_id] = { holes_played: p.holes_played, holes_section: p.holes_section }
        })

        const startsAt = activeEvent?.starts_at ?? ''
        const flights = (flightsData || [])
          .map((f: any) => ({
            flight_number: f.flight_number,
            players: (f.flight_players || []).map((fp: any) => ({
              ...fp.players,
              holes_played:  holesMap[fp.player_id]?.holes_played  ?? null,
              holes_section: holesMap[fp.player_id]?.holes_section ?? null,
            })).filter(Boolean),
          }))
          .sort((a: any, b: any) => a.players.length - b.players.length)
          .map((f: any, i: number) => ({
            ...f,
            flight_number: i + 1,
            start_time: startsAt
              ? new Date(new Date(startsAt).getTime() + i * 9 * 60 * 1000)
                  .toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
              : '',
          }))

        res = await fetch('/api/send-teesheet', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId, flights }),
        })
      } else {
        res = await fetch('/api/send-communication', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupId, playerIds: [...selectedIds],
            subject: commSubject, body: commBody,
            eventId: filterEventId || selectedEventId || null,
          }),
        })
      }
      
      const json = await res.json()
      if (json.success) toast.success(`${json.sent} email${json.sent > 1 ? 's' : ''} envoyé${json.sent > 1 ? 's' : ''}${json.skipped ? ` · ${json.skipped} ignoré(s)` : ''}`)
      else toast.error(json.error ?? t('common.error'))
      if (json.errors?.length) toast.error(`Erreurs : ${json.errors.join(', ')}`)
    } catch (e: any) { toast.error(e.message) }
    finally { setSending(false) }
  }

  const isTeesheet = messageType === 'teesheet'
  const canSend = !sending && selectedIds.size > 0 && isOwner && (isTeesheet || (!!commSubject.trim() && !!commBody.trim()))
  const hasMsg  = isTeesheet || (!!commSubject && !!commBody)

  if (loading || roleLoading) return (
    <div className="p-6 space-y-3 max-w-3xl">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )
async function loadPrintHoles(eventId: string) {
  const { data: event } = await supabase.from('events')
    .select('course_id, courses(course_name, clubs(name))')
    .eq('id', eventId).single()

  setPrintClubName((event as any)?.courses?.clubs?.name ?? '')
  setPrintCourseName((event as any)?.courses?.course_name ?? '')

  if (!(event as any)?.course_id) { setPrintHoles([]); setPrintPhcpMap({}); return }

  const [{ data: holesData }, { data: teesData }, { data: participants }] = await Promise.all([
    supabase.from('course_holes').select('hole_number, par, stroke_index')
      .eq('course_id', (event as any).course_id).order('hole_number'),
    supabase.from('course_tees').select('id, tee_name, par_total, course_rating, slope')
      .eq('course_id', (event as any).course_id),
    supabase.from('event_participants')
      .select('player_id, tee_id, players(id, first_name, surname, whs)')
      .eq('event_id', eventId).eq('status', 'GOING'),
  ])

  setPrintHoles(holesData || [])

  const phcpMap: Record<string, { phcp: number; whs: number; tee?: TeeInfo }> = {}
  for (const ep of participants || []) {
    const p = (ep as any).players
    const tee = (teesData || []).find((t: any) => t.id === (ep as any).tee_id)
    phcpMap[p.id] = { phcp: computePhcp(p.whs ?? 0, tee), whs: p.whs ?? 0, tee }
  }
  setPrintPhcpMap(phcpMap)
}

function handleFilterEventChange(eventId: string) {
    setFilterEventId(eventId)
    localStorage.setItem(`golfgo-active-event-${groupId}`, eventId)
  }

  function handleSelectedEventChange(eventId: string) {
    setSelectedEventId(eventId)
    localStorage.setItem(`golfgo-active-event-${groupId}`, eventId)
    if (messageType === 'scorecards') loadPrintHoles(eventId)
  }



  


  return (
    <div className="p-5 sm:p-6 max-w-3xl">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">{t('communications.title')}</h1>
          <p className="text-[13px] text-slate-900 mt-0.5">{t('communications.subtitle')}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <IconBtn
            onClick={() => {
              if (messageType === 'scorecards') {
                if (printHoles.length === 0) { toast.error('Aucun parcours lié'); return }
                const printableMembers = selectedMembers.filter(m => printPhcpMap[m.id])
                if (printableMembers.length === 0) {
                  toast.error('Aucun joueur sélectionné n\'est inscrit (GOING) à cet événement')
                  return
                }
                if (printableMembers.length < selectedMembers.length) {
                  toast.error(`${selectedMembers.length - printableMembers.length} joueur(s) ignoré(s) (non inscrits)`)
                }
                const activeEvent = events.find(e => e.id === filterEventId)
                const html = buildScorecardHtml(
                  printableMembers.map((m): PrintPlayer => ({
                    id: m.id,
                    first_name: m.first_name,
                    surname: m.surname,
                    whs: printPhcpMap[m.id].whs,
                    phcp: printPhcpMap[m.id].phcp,
                    tee: printPhcpMap[m.id].tee,
                  })),
                  printHoles,
                  activeEvent?.title ?? '',
                  activeEvent ? new Date(activeEvent.starts_at).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' }) : '',
                  printClubName,
                  printCourseName,
                )
                const blob = new Blob([html], { type: 'text/html' })
                const url  = URL.createObjectURL(blob)
                const win  = window.open(url, '_blank')
                if (!win) {
                  toast.error('Pop-up bloquée — autorisez les pop-ups pour imprimer')
                  URL.revokeObjectURL(url)
                } else {
                  setTimeout(() => URL.revokeObjectURL(url), 10000)
                }
              } else if (messageType !== 'teesheet') {
                window.print()
              }
            }}
            disabled={messageType === 'teesheet'}
            title="Imprimer">🖨
          </IconBtn>        

         <IconBtn onClick={() => setShowPreview(true)} disabled={isTeesheet || !hasMsg || selectedIds.size === 0 || !isOwner} title={t('communications.message.preview')}>👁</IconBtn>
          <IconBtn href={!isTeesheet && hasMsg ? buildWhatsAppComm() : undefined} disabled={isTeesheet || !hasMsg} title="WhatsApp">💬</IconBtn>
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
        <CommSettingsPanel
          groupTemplate={groupTemplate}
          setGroupTemplate={setGroupTemplate}
          saving={saving}
          uploading={uploading}
          onSaveTemplate={handleSaveTemplate}
          onReset={handleReset}
          onLogoUpload={handleLogoUpload}
          onBgUpload={handleBgUpload}
          onBgDelete={handleBgDelete}
        />
      )}

       {/* ── Onglets ── */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-6">
        {([
          { key: 'send',       label: t('communications.tabs.send') },
          { key: 'settings',   label: t('communications.tabs.settings') },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setMainTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors ${mainTab === tab.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {mainTab === 'send' && (
      <div className="flex flex-col gap-6">

        <CommRecipientsPanel
          membersWithEmail={membersWithEmail}
          selectedIds={selectedIds}
          toggleMember={toggleMember}
          selectAll={selectAll}
          selectNone={selectNone}
          filterMode={filterMode}
          setFilterMode={setFilterMode}
          filterEventId={filterEventId}
          onFilterEventChange={handleFilterEventChange}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          events={events}
          applyEventFilter={applyEventFilter}
          setSelectedIds={setSelectedIds}
        />

        <CommMessageComposer
          messageTypes={MESSAGE_TYPES}
          messageType={messageType}
          setMessageType={setMessageType}
          events={events}
          selectedEventId={selectedEventId}
          onSelectedEventChange={handleSelectedEventChange}
          commSubject={commSubject}
          setCommSubject={setCommSubject}
          commBody={commBody}
          setCommBody={setCommBody}
          isOwner={isOwner}
          selectedMembers={selectedMembers}
          preview={preview}
          setPreview={setPreview}
        applyPreviewVars={applyPreviewVars}
        />
      </div>
      )}

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
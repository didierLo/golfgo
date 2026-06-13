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
type MessageType = 'invitation' | 'reminder' | 'teesheet' | 'newmember' | 'scorecards' | 'free'
type HolePrint    = { hole_number: number; par: number; stroke_index: number }
type PlayerPrint  = { id: string; first_name: string; surname: string; whs: number; phcp: number; tee_name: string | null }


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



const thCard: React.CSSProperties = {
  padding: '4px 2px', textAlign: 'center', fontWeight: '700',
  border: '1px solid rgba(255,255,255,0.3)', fontSize: '10px',
}
const tdCell: React.CSSProperties = {
  padding: '3px 2px', textAlign: 'center',
  border: '1px solid #CBD5E1', color: '#334155', fontSize: '10px',
}
const tdLabel: React.CSSProperties = {
  padding: '3px 6px', textAlign: 'left', fontWeight: '600',
  border: '1px solid #CBD5E1', color: '#475569', fontSize: '9px',
  whiteSpace: 'nowrap' as const, background: '#fff',
}

function formatDate(d: string, locale: string) {
  return new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function strokesReceived(phcp: number, strokeIndex: number): number {
  if (phcp <= 0) return 0
  const full = Math.floor(phcp / 18)
  const remainder = phcp % 18
  return full + (strokeIndex <= remainder ? 1 : 0)
}


function buildPrintHtml(
  players: PlayerPrint[],
  holes: HolePrint[],
  eventTitle: string,
  clubName: string,
  courseName: string,
  eventDate: string,
): string {
  const front9   = holes.filter(h => h.hole_number <= 9)
  const back9    = holes.filter(h => h.hole_number > 9)
  const frontPar = front9.reduce((s, h) => s + h.par, 0)
  const backPar  = back9.reduce((s, h) => s + h.par, 0)
  const totalPar = frontPar + backPar

  function getMarker(idx: number): PlayerPrint {
    return players[(idx + 1) % players.length]
  }

  function recvFront(phcp: number) {
    return front9.reduce((s, h) => s + strokesReceived(phcp, h.stroke_index), 0)
  }
  function recvBack(phcp: number) {
    return back9.reduce((s, h) => s + strokesReceived(phcp, h.stroke_index), 0)
  }
  function recvTotal(phcp: number) {
    return holes.reduce((s, h) => s + strokesReceived(phcp, h.stroke_index), 0)
  }

  const cards = players.map((player, idx) => {
    const marker = getMarker(idx)

    const holeHeaders = [
      ...front9.map(h => `<th>${h.hole_number}</th>`),
      `<th class="sub">Out</th>`,
      ...back9.map(h => `<th>${h.hole_number}</th>`),
      `<th class="sub">In</th>`,
      `<th class="tot">Total</th>`,
    ].join('')

    const parRow = [
      ...front9.map(h => `<td>${h.par}</td>`),
      `<td class="sub-val">${frontPar}</td>`,
      ...back9.map(h => `<td>${h.par}</td>`),
      `<td class="sub-val">${backPar}</td>`,
      `<td class="tot-val">${totalPar}</td>`,
    ].join('')

    const siRow = [
      ...front9.map(h => `<td class="si">${h.stroke_index}</td>`),
      `<td class="sub-val"></td>`,
      ...back9.map(h => `<td class="si">${h.stroke_index}</td>`),
      `<td class="sub-val"></td>`,
      `<td class="tot-val"></td>`,
    ].join('')

    const hcpRow = [
      ...front9.map(h => {
        const r = strokesReceived(player.phcp, h.stroke_index)
        return `<td class="hcp-cell">${r > 0 ? '*'.repeat(r) : '·'}</td>`
      }),
      `<td class="hcp-sub">${recvFront(player.phcp)}</td>`,
      ...back9.map(h => {
        const r = strokesReceived(player.phcp, h.stroke_index)
        return `<td class="hcp-cell">${r > 0 ? '*'.repeat(r) : '·'}</td>`
      }),
      `<td class="hcp-sub">${recvBack(player.phcp)}</td>`,
      `<td class="hcp-tot">${recvTotal(player.phcp)}</td>`,
    ].join('')

    const brutRow = [
      ...front9.map(() => `<td class="score-cell"></td>`),
      `<td class="sub-val"></td>`,
      ...back9.map(() => `<td class="score-cell"></td>`),
      `<td class="sub-val"></td>`,
      `<td class="tot-val"></td>`,
    ].join('')

    const netRow = [
      ...front9.map(() => `<td class="net-cell"></td>`),
      `<td class="sub-val"></td>`,
      ...back9.map(() => `<td class="net-cell"></td>`),
      `<td class="sub-val"></td>`,
      `<td class="tot-val"></td>`,
    ].join('')

    return `
<div class="card">
  <div class="header">
    <div class="logo">
      <img src="https://zykywwjmaqcjhciffsbi.supabase.co/storage/v1/object/public/apple-touch-icon/apple-touch-icon.png" width="32" height="32"/>
      <span class="golf">Golf</span><span class="go">Go</span>
    </div>
    <div class="event-info">
      <div class="event-title">${eventTitle}</div>
      <div class="event-sub">${eventDate}${clubName ? ' · ' + clubName : ''}${courseName ? ' · ' + courseName : ''}</div>
    </div>
    <div class="player-info">
      <div><strong>Player : <u>${player.first_name} ${player.surname}</u></strong> &nbsp; HCP ${player.whs} · Phcp ${player.phcp}</div>
      <div>Marker : <u>${marker.first_name} ${marker.surname}</u></div>
    </div>
  </div>

  <table>
    <thead>
      <tr class="hole-row">
        <th class="label-col">Hole</th>
        ${holeHeaders}
      </tr>
    </thead>
    <tbody>
      <tr class="par-row">
        <td class="label-col">Par</td>
        ${parRow}
      </tr>
      <tr class="si-row">
        <td class="label-col">Stroke index</td>
        ${siRow}
      </tr>
      <tr class="hcp-row">
        <td class="label-col hcp-label">HCP</td>
        ${hcpRow}
      </tr>
      <tr class="score-row">
        <td class="label-col player-label">${player.first_name} ${player.surname}</td>
        ${brutRow}
      </tr>
      <tr class="net-row">
        <td class="label-col net-label">Net</td>
        ${netRow}
      </tr>
    </tbody>
  </table>

  <div class="footer">
    <div class="footer-cell">
      <div class="footer-label">Marker's signature</div>
      <div class="footer-name">${marker.first_name} ${marker.surname}</div>
    </div>
    <div class="footer-cell">
      <div class="footer-label">Player's signature</div>
      <div class="footer-name">${player.first_name} ${player.surname}</div>
    </div>
    <div class="footer-cell footer-score">
      <div class="footer-label">Brut :</div>
    </div>
    <div class="footer-cell footer-score">
      <div class="footer-label">Net :</div>
    </div>
  </div>
</div>`
  }).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<title>Scorecards — ${eventTitle}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: white; }
  @page { size: A4 landscape; margin: 8mm; }
  @media print {
    .card { page-break-after: always; }
    .card:last-child { page-break-after: auto; }
  }
  .card { width: 100%; padding: 4mm; display: flex; flex-direction: column; gap: 4mm; min-height: 180mm; }

  /* Header */
  .header { display: flex; align-items: center; gap: 6mm; }
  .logo { display: flex; align-items: center; gap: 5px; background: #185FA5; border-radius: 8px; padding: 6px 14px; flex-shrink: 0; }
  .logo img { border-radius: 4px; }
  .golf { font-size: 18px; font-weight: 900; color: white; letter-spacing: -0.5px; }
  .go   { font-size: 18px; font-weight: 900; color: #97C459; letter-spacing: -0.5px; }
  .event-info { flex: 1; text-align: center; }
  .event-title { font-size: 16px; font-weight: 900; color: #0F172A; text-decoration: underline; }
  .event-sub { font-size: 11px; color: #64748B; margin-top: 3px; }
  .player-info { text-align: right; font-size: 13px; flex-shrink: 0; min-width: 240px; }
  .player-info div { margin-bottom: 3px; }

  /* Table */
  table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 2px solid #185FA5; flex: 1; }
  .label-col { width: 68px; text-align: left; padding: 0 6px; font-size: 10px; font-weight: 600; color: #475569; border: 1px solid #CBD5E1; white-space: nowrap; }

  /* Hole header */
  .hole-row th { background: #3B6D11; color: white; font-size: 11px; font-weight: 700; text-align: center; padding: 5px 2px; border: 1px solid rgba(255,255,255,0.3); }
  .hole-row .label-col { background: #3B6D11; color: white; font-size: 12px; }
  .hole-row th.sub { background: #2A5009; }
  .hole-row th.tot { background: #185FA5; }

  /* Par */
  .par-row td { text-align: center; padding: 5px 2px; font-size: 11px; border: 1px solid #CBD5E1; color: #334155; background: #F8FAFC; }
  .par-row .label-col { text-align: left; padding: 5px 6px; }
  .par-row .sub-val { background: #EAF3DE; font-weight: 700; border-left: 1px solid #185FA5; }
  .par-row .tot-val { background: #DBEAFE; font-weight: 900; border-left: 1px solid #185FA5; }

  /* Stroke index */
  .si-row td { text-align: center; padding: 4px 2px; font-size: 10px; border: 1px solid #CBD5E1; color: #94A3B8; }
  .si-row .label-col { text-align: left; padding: 4px 6px; color: #475569; font-weight: 600; font-size: 10px; }
  .si-row .sub-val { background: #EAF3DE; border-left: 1px solid #185FA5; }
  .si-row .tot-val { background: #DBEAFE; border-left: 1px solid #185FA5; }

  /* HCP */
  .hcp-row td { text-align: center; padding: 5px 2px; font-size: 11px; font-weight: 700; border: 1px solid #CBD5E1; background: #EBF3FC; color: #185FA5; border-bottom: 2px solid #185FA5; }
  .hcp-row .hcp-label { text-align: left; padding: 5px 6px; color: #185FA5; font-weight: 700; font-size: 11px; background: #EBF3FC; }
  .hcp-row .hcp-cell { color: #185FA5; }
  .hcp-row .hcp-sub { background: #BFDBFE; font-weight: 700; border-left: 1px solid #185FA5; }
  .hcp-row .hcp-tot { background: #93C5FD; font-weight: 900; color: #1E40AF; border-left: 1px solid #185FA5; }

  /* Score brut */
  .score-row td { border: 1px solid #CBD5E1; }
  .score-row .label-col.player-label { font-size: 10px; font-weight: 700; color: #0F172A; padding: 0 6px; }
  .score-row .score-cell { height: 28px; background: white; }
  .score-row .sub-val { background: #EAF3DE; border-left: 1px solid #185FA5; }
  .score-row .tot-val { background: #DBEAFE; border-left: 1px solid #185FA5; }

  /* Net */
  .net-row td { border: 1px solid #CBD5E1; }
  .net-row .net-label { font-size: 10px; font-style: italic; color: #64748B; padding: 0 6px; }
  .net-row .net-cell { height: 24px; background: #F8FAFC; }
  .net-row .sub-val { background: #EAF3DE; border-left: 1px solid #185FA5; }
  .net-row .tot-val { background: #DBEAFE; border-left: 1px solid #185FA5; }

  /* Footer */
  .footer { display: grid; grid-template-columns: 1fr 1fr 110px 110px; border: 2px solid #185FA5; border-radius: 4px; overflow: hidden; }
  .footer-cell { padding: 10px 14px; border-right: 1px solid #185FA5; }
  .footer-cell:last-child { border-right: none; }
  .footer-score { background: #F8FAFC; }
  .footer-label { font-size: 9px; color: #94A3B8; margin-bottom: 10px; }
  .footer-name { font-size: 12px; font-weight: 700; color: #0F172A; }
</style>
</head>
<body>
${cards}
<script>window.onload = () => window.print()</script>
</body>
</html>`
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
  

  const [printPhcpMap,  setPrintPhcpMap]  = useState<Record<string, { phcp: number; tee_name: string | null }>>({})
 
 


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

  const [mainTab, setMainTab] = useState<'send' | 'settings' | 'invite' | 'scorecards'>('send')

  const [printHoles, setPrintHoles] = useState<HolePrint[]>([])

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
  async function loadPrintHoles(eventId: string) {
    const { data: event } = await supabase.from('events')
      .select('course_id').eq('id', eventId).single()
    if (!(event as any)?.course_id) { setPrintHoles([]); return }

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

    const phcpMap: Record<string, { phcp: number; tee_name: string | null }> = {}
    for (const ep of participants || []) {
      const p = (ep as any).players
      const tee = (teesData || []).find((t: any) => t.id === (ep as any).tee_id)
      const phcp = tee
        ? Math.round((p.whs ?? 0) * (tee.slope / 113) + tee.course_rating - tee.par_total)
        : Math.round(p.whs ?? 0)
      phcpMap[p.id] = { phcp, tee_name: tee?.tee_name ?? null }
    }
    setPrintPhcpMap(phcpMap)
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
          
        
              <div className="mb-3">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{t('communications.message.event')}</label>
                <select value={selectedEventId} onChange={e => {
                        setSelectedEventId(e.target.value)
                        localStorage.setItem(`golfgo-active-event-${groupId}`, e.target.value)
                        if (messageType === 'scorecards') loadPrintHoles(e.target.value)
                      }}className={`${selectClass} w-full`}>
                  {events.map(e => <option key={e.id} value={e.id}>{e.title} — {formatDate(e.starts_at, locale)}</option>)}
                </select>
              </div>
          
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
'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useGroupRole } from '@/lib/hooks/useGroupRole'
import { useTranslations, useLocale } from 'next-intl'

const supabase = createClient()

type HolesSection = 'out' | 'in' | null

type Participant = {
  player_id: string
  status: 'GOING' | 'INVITED' | 'DECLINED' | 'WAITLIST'
  responded_at: string | null
  holes_played: number | null
  holes_section: HolesSection
  response_message: string | null
  admin_note: string | null
  extra_activity_count: number | null
  players: { first_name: string; surname: string; whs: number | null } | null  // ← nullable
}
type Event     = { id: string; title: string; starts_at: string }
type Member    = { id: string; first_name: string; surname: string }
type SortField = 'name' | 'status' | 'whs' | 'holes'
type ViewMode  = 'list' | 'overview'

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  GOING:    { bg: '#EAF3DE', text: '#3B6D11' },
  INVITED:  { bg: '#EBF3FC', text: '#0C447C' },
  DECLINED: { bg: '#FCEBEB', text: '#A32D2D' },
  WAITLIST: { bg: '#FAEEDA', text: '#854F0B' },
}
const STATUS_ICON: Record<string, { icon: string; color: string }> = {
  GOING:    { icon: '✓', color: '#3B6D11' },
  INVITED:  { icon: '~', color: '#0C447C' },
  DECLINED: { icon: '✗', color: '#A32D2D' },
  WAITLIST: { icon: '…', color: '#854F0B' },
}

function Badge({ status }: { status: string }) {
  const t = useTranslations()
  const s = STATUS_STYLE[status] ?? { bg: '#F1F5F9', text: '#64748B' }
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.text }}>
      {t(`status.${status}` as any)}
    </span>
  )
}

function HolesBadge({ holes, section }: { holes: number | null; section: HolesSection }) {
  if (!holes || holes === 18 || !section) return null   // ← ajout de !section
  const label = section === 'out' ? '9F' : '9B'
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 flex-shrink-0">
      {label}
    </span>
  )
}

function holesLabel(holes: number | null, section: HolesSection): string {
  if (!holes || holes === 18) return '18T'
  if (section === 'out') return '9F'
  if (section === 'in') return '9B'
  return '18T'   // ← fallback sécurisé si section null
}

// ─── Cellule activité annexe (nombre de personnes) ─────────────────────────
function ExtraActivityCell({
  count,
  isOwner,
  onChange,
  onCommit,
}: {
  count: number | null
  isOwner: boolean
  onChange?: (next: number | null) => void
  onCommit?: (next: number | null) => void
}) {
  if (isOwner) {
    return (
      <input
        type="number"
        min={0}
        max={20}
        value={count ?? ''}
        placeholder="—"
        title="Nombre de personnes (toi/le joueur compris) — modifiable"
        onChange={e => {
          const raw = e.target.value
          onChange?.(raw === '' ? null : Math.max(0, parseInt(raw, 10) || 0))
        }}
        onBlur={() => onCommit?.(count)}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        className={`text-[13px] font-bold w-11 h-7 rounded-lg border text-center focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 ${
          count !== null && count > 0
            ? 'bg-[#EAF3DE] border-[#C0DD97] text-[#3B6D11]'
            : count === 0
            ? 'bg-[#FCEBEB] border-[#F7C1C1] text-[#A32D2D]'
            : 'bg-white/60 border-slate-200 text-slate-400'
        }`}
      />
    )
  }
  if (count === null) return <span className="text-slate-200 text-[13px]">—</span>
  return (
    <span className={`text-[13px] font-bold ${count > 0 ? 'text-[#3B6D11]' : 'text-[#A32D2D]'}`}>
      {count}
    </span>
  )
}

// ─── Modal message + remarque ──────────────────────────────────────────────
function MessageModal({
  participant,
  canSeeMessage,
  canEditMessage,
  canEditNote,
  eventId,
  onClose,
  onSaved,
  onNoteSaved,
}: {
  participant: Participant
  canSeeMessage: boolean
  canEditMessage: boolean
  canEditNote: boolean
  eventId: string
  onClose: () => void
  onSaved: (playerId: string, msg: string) => void
  onNoteSaved: (playerId: string, note: string) => void
}) {
  const [text, setText]     = useState(participant.response_message ?? '')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  const [noteText,   setNoteText]   = useState(participant.admin_note ?? '')
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteSaved,  setNoteSaved]  = useState(false)

  // FIX L126 + L130 — optional chaining sur players
  const firstName = participant.players?.first_name ?? '?'
  const surname   = participant.players?.surname    ?? '?'

  async function handleSave() {
    if (!text.trim()) return
    setSaving(true)
    await supabase
      .from('event_participants')
      .update({ response_message: text.slice(0, 300) })
      .eq('event_id', eventId)
      .eq('player_id', participant.player_id)
    setSaved(true)
    setSaving(false)
    onSaved(participant.player_id, text.slice(0, 300))
  }

  async function handleDelete() {
    setSaving(true)
    await supabase
      .from('event_participants')
      .update({ response_message: null })
      .eq('event_id', eventId)
      .eq('player_id', participant.player_id)
    onSaved(participant.player_id, '')
    onClose()
  }

  async function handleSaveNote() {
    setNoteSaving(true)
    await supabase
      .from('event_participants')
      .update({ admin_note: noteText.trim() ? noteText.slice(0, 300) : null })
      .eq('event_id', eventId)
      .eq('player_id', participant.player_id)
    setNoteSaved(true)
    setNoteSaving(false)
    onNoteSaved(participant.player_id, noteText.trim())
  }

  async function handleDeleteNote() {
    setNoteSaving(true)
    setNoteText('')
    await supabase
      .from('event_participants')
      .update({ admin_note: null })
      .eq('event_id', eventId)
      .eq('player_id', participant.player_id)
    onNoteSaved(participant.player_id, '')
    setNoteSaving(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
        <button onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-[18px] leading-none">
          ✕
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
            style={{ background: '#EBF3FC', color: '#0C447C' }}>
            {firstName[0]}{surname[0]}
          </div>
          <div>
            <p className="text-[14px] font-bold text-slate-800">
              {firstName} {surname}
            </p>
            <p className="text-[11px] text-slate-400">Message & remarque</p>
          </div>
        </div>

        {/* ── Message du joueur ── */}
        {canSeeMessage && (
          <>
            {canEditMessage ? (
              <>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  Ton message pour l'organisateur
                </p>
                <textarea
                  value={text}
                  onChange={e => {
                    const lines = e.target.value.split('\n')
                    if (lines.length <= 3) setText(e.target.value)
                  }}
                  maxLength={300}
                  rows={3}
                  placeholder="Votre message pour l'organisateur…"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 resize-none"
                />
                <div className="flex items-center justify-between mt-1 mb-5">
                  <span className="text-[11px] text-slate-400">{text.length}/300 · max 3 lignes</span>
                  {participant.response_message && (
                    <button onClick={handleDelete}
                      className="text-[11px] text-red-400 hover:text-red-600 font-semibold">
                      Supprimer le message
                    </button>
                  )}
                </div>
                {saved ? (
                  <p className="text-center text-[13px] text-[#3B6D11] font-semibold mb-5">✓ Message enregistré</p>
                ) : (
                  <button onClick={handleSave} disabled={!text.trim() || saving}
                    className="w-full bg-[#185FA5] text-white text-[13px] font-semibold py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-40 transition-colors mb-5">
                    {saving ? 'Enregistrement…' : 'Enregistrer le message'}
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  Message du joueur
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap min-h-[60px] mb-5">
                  {participant.response_message || <span className="text-slate-400 italic">Aucun message</span>}
                </div>
              </>
            )}
          </>
        )}

        {/* ── Remarque (visible par tous, éditable par le joueur lui-même ou l'admin) ── */}
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
          Remarque
        </p>
        {canEditNote ? (
          <>
            <textarea
              value={noteText}
              onChange={e => {
                const lines = e.target.value.split('\n')
                if (lines.length <= 3) setNoteText(e.target.value)
              }}
              maxLength={300}
              rows={3}
              placeholder="Ex : viendra accompagné(e) pour le repas…"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4338CA]/30 resize-none"
            />
            <div className="flex items-center justify-between mt-1 mb-4">
              <span className="text-[11px] text-slate-400">{noteText.length}/300 · max 3 lignes</span>
              {participant.admin_note && (
                <button onClick={handleDeleteNote} disabled={noteSaving}
                  className="text-[11px] text-red-400 hover:text-red-600 font-semibold disabled:opacity-40">
                  Supprimer la remarque
                </button>
              )}
            </div>
            {noteSaved ? (
              <p className="text-center text-[13px] text-[#4338CA] font-semibold">✓ Remarque enregistrée</p>
            ) : (
              <button onClick={handleSaveNote} disabled={noteSaving}
                className="w-full text-white text-[13px] font-semibold py-2.5 rounded-xl disabled:opacity-40 transition-colors"
                style={{ background: '#4338CA' }}>
                {noteSaving ? 'Enregistrement…' : 'Enregistrer la remarque'}
              </button>
            )}
          </>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap min-h-[60px]">
            {participant.admin_note || <span className="text-slate-400 italic">Aucune remarque</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Badge "M" ───────────────────────────────────────────────────────────────
function MBadge({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Voir le message du joueur"
      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 transition-colors hover:scale-110"
      style={{ background: '#185FA5', color: '#fff' }}
    >
      M
    </button>
  )
}

// ─── Badge "R" (remarque admin) ────────────────────────────────────────────
function RBadge({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Voir la remarque admin"
      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 transition-colors hover:scale-110"
      style={{ background: '#4338CA', color: '#fff' }}
    >
      R
    </button>
  )
}

// ─── Page principale ─────────────────────────────────────────────────────────
export default function ParticipantsPage() {
  const params  = useParams()
  const groupId = params.id      as string
  const eventId = params.eventId as string
  const t       = useTranslations()
  const locale  = useLocale()

  const { role, loading: roleLoading } = useGroupRole(groupId)
  const isOwner = role === 'owner'

  const [viewMode,        setViewMode]        = useState<ViewMode>('list')
  const [events,          setEvents]          = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState(eventId)
  const [participants,    setParticipants]    = useState<Participant[]>([])
  const [loading,         setLoading]         = useState(true)
  const [sortField,       setSortField]       = useState<SortField>('status')
  const [sortDir,         setSortDir]         = useState<'asc' | 'desc'>('asc')
  const [allMembers,      setAllMembers]      = useState<Member[]>([])
  const [upcomingEvents,  setUpcomingEvents]  = useState<Event[]>([])
  const [statusMatrix,    setStatusMatrix]    = useState<Record<string, Record<string, string>>>({})
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [msgModal,        setMsgModal]        = useState<Participant | null>(null)
  const [extraActivityLabel, setExtraActivityLabel] = useState<string | null>(null)
  const [exporting,        setExporting]        = useState(false)

  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from('players').select('id').eq('user_id', data.user.id).single()
          .then(({ data: p }) => { if (p) setMyPlayerId(p.id) })
      }
    })
  }, [])

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  }
  function formatDateShort(d: string) {
    return new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  }
  function formatResponded(d: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleString(locale, {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Brussels',
    })
  }

  useEffect(() => { if (groupId) loadEvents() }, [groupId])
  useEffect(() => { if (selectedEventId) loadParticipants(selectedEventId) }, [selectedEventId, groupId])
  useEffect(() => { if (viewMode === 'overview' && isOwner && groupId) loadOverview() }, [viewMode, isOwner, groupId])

  async function loadEvents() {
    const { data } = await supabase.from('events').select('id, title, starts_at')
      .eq('group_id', groupId).order('starts_at', { ascending: false })
    setEvents(data || [])
  }

  async function loadParticipants(evId: string) {
  setLoading(true)

  // test temporaire
  const { data: me } = await supabase.rpc('auth_player_id')
  console.log('auth_player_id =', me)

  const [{ data, error }, { data: evData }] = await Promise.all([
    supabase
      .from('event_participants')
      .select(`player_id, status, responded_at, holes_played, holes_section, response_message, admin_note, extra_activity_count, players(first_name, surname, whs)`)
      .eq('event_id', evId),
    supabase.from('events').select('extra_activity_label').eq('id', evId).single(),
  ])

  console.log('participants data=', data, 'error=', error)
    
  if (error) { console.error(error); setLoading(false); return }
    // FIX — filtre les lignes orphelines (players null = joueur supprimé ou RLS)
    const clean = (data || []).filter((p: any) => p.players != null)
    setParticipants(clean as any)
    setExtraActivityLabel(evData?.extra_activity_label ?? null)
    setLoading(false)
  }

  async function loadOverview() {
    if (!groupId) return
    setOverviewLoading(true)

    const [{ data: evts }, { data: mbrs }] = await Promise.all([
      supabase.from('events').select('id, title, starts_at')
        .eq('group_id', groupId)
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true }),
      supabase.from('groups_players')
        .select(`player:players(id, first_name, surname)`)
        .eq('group_id', groupId)
    ])

    const upcoming = evts || []
    setUpcomingEvents(upcoming)

    // FIX — .filter(Boolean) éjecte les m.player null (RLS ou joueur supprimé)
    const members = (mbrs || [])
      .map((m: any) => m.player)
      .filter(Boolean)
      .sort((a: Member, b: Member) => a.surname.localeCompare(b.surname, locale))
    setAllMembers(members)

    if (upcoming.length > 0 && members.length > 0) {
      const { data: participations } = await supabase.from('event_participants')
        .select('player_id, event_id, status')
        .in('event_id', upcoming.map(e => e.id))
        .in('player_id', members.map((m: Member) => m.id))

      const matrix: Record<string, Record<string, string>> = {}
      members.forEach((m: Member) => { matrix[m.id] = {} })
      participations?.forEach(p => { matrix[p.player_id][p.event_id] = p.status })
      setStatusMatrix(matrix)
    }

    setOverviewLoading(false)
  }

  async function updateStatus(playerId: string, status: 'GOING' | 'DECLINED' | 'INVITED') {
    await supabase.from('event_participants')
      .update({ status, responded_at: new Date().toISOString() })
      .eq('event_id', selectedEventId).eq('player_id', playerId)
    loadParticipants(selectedEventId)
  }

  async function toggleHoles(playerId: string, current: number | null, currentSection: HolesSection) {
    let nextHoles: 9 | 18 = 18
    let nextSection: HolesSection = null
    if (!current || current === 18) { nextHoles = 9; nextSection = 'out' }
    else if (current === 9 && currentSection === 'out') { nextHoles = 9; nextSection = 'in' }
    else { nextHoles = 18; nextSection = null }
    await supabase.from('event_participants')
      .update({ holes_played: nextHoles, holes_section: nextSection })
      .eq('event_id', selectedEventId).eq('player_id', playerId)
    setParticipants(prev => prev.map(p =>
      p.player_id === playerId ? { ...p, holes_played: nextHoles, holes_section: nextSection } : p
    ))
  }

  async function removeParticipant(playerId: string) {
    if (!confirm(t('participants.removeConfirm'))) return
    await supabase.from('event_participants').delete()
      .eq('event_id', selectedEventId).eq('player_id', playerId)
    loadParticipants(selectedEventId)
  }

  function setExtraActivityLocal(playerId: string, next: number | null) {
    setParticipants(prev => prev.map(p =>
      p.player_id === playerId ? { ...p, extra_activity_count: next } : p
    ))
  }

  async function commitExtraActivity(playerId: string, next: number | null) {
    await supabase.from('event_participants')
      .update({ extra_activity_count: next })
      .eq('event_id', selectedEventId).eq('player_id', playerId)
  }

  async function exportToExcel() {
    setExporting(true)
    try {
      const ExcelJS = (await import('exceljs')).default
      const event = events.find(e => e.id === selectedEventId)
      const hasExtra = !!extraActivityLabel

      const statusLabelFr: Record<string, string> = {
        GOING: 'Confirmé', INVITED: 'Invité', DECLINED: 'Décliné', WAITLIST: 'Attente',
      }
      // Couleurs reprises telles quelles de STATUS_STYLE / des boutons golf de l'app
      const HOLES_COLOR: Record<string, string> = {
        '18H':      'FF16A34A', // vert — bouton 18 trous
        '9H Front': 'FFCA8A04', // ambre — bouton 9 trous Front
        '9H Back':  'FFEA580C', // orange — bouton 9 trous Back
        '—':        'FF94A3B8',
      }
      function reportHolesLabel(p: Participant): string {
        if (p.status !== 'GOING') return '—'
        if (!p.holes_played || p.holes_played === 18) return '18H'
        if (p.holes_section === 'out') return '9H Front'
        if (p.holes_section === 'in')  return '9H Back'
        return '18H'
      }
      const argb = (hex: string) => 'FF' + hex.replace('#', '').toUpperCase()

      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'GolfGo'
      workbook.created = new Date()
      const sheet = workbook.addWorksheet('Participants', {
        views: [{ showGridLines: false }],
      })

      const detailColCount = hasExtra ? 5 : 4
      const totalColCount  = hasExtra ? 7 : 6

      // Largeurs de colonnes (le tableau détail utilise les 4-5 premières)
      sheet.columns = hasExtra
        ? [{ width: 26 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 46 }, { width: 12 }, { width: 12 }]
        : [{ width: 26 }, { width: 12 }, { width: 12 }, { width: 46 }, { width: 12 }, { width: 12 }]

      // ── Titre ──
      sheet.mergeCells(1, 1, 1, totalColCount)
      const titleCell = sheet.getCell(1, 1)
      titleCell.value = event ? `${event.title} — ${formatDate(event.starts_at)}` : 'Participants'
      titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb('#185FA5') } }
      titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      sheet.getRow(1).height = 30

      // ── Ligne de synthèse (ligne 3) ──
      const summaryLabels = hasExtra
        ? ['18H', '9H Front', '9H Back', 'En attente', 'Décliné', 'Total', 'Activité annexe']
        : ['18H', '9H Front', '9H Back', 'En attente', 'Décliné', 'Total']
      const summaryValues = hasExtra
        ? [going18.length, going9front.length, going9back.length, invited, declined, participants.length, extraActivityCount]
        : [going18.length, going9front.length, going9back.length, invited, declined, participants.length]
      const summaryFill: string[] = [
        argb('#DCFCE7'), argb('#FEF9C3'), argb('#FFEDD5'), argb('#EBF3FC'), argb('#FCEBEB'), argb('#F1F5F9'), argb('#F5F0FF'),
      ]
      const summaryText: string[] = [
        argb('#15803D'), argb('#92400E'), argb('#9A3412'), argb('#0C447C'), argb('#A32D2D'), argb('#334155'), argb('#7C3AED'),
      ]
      summaryLabels.forEach((label, i) => {
        const labelCell = sheet.getCell(3, i + 1)
        labelCell.value = label
        labelCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: summaryText[i] } }
        labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: summaryFill[i] } }
        labelCell.alignment = { vertical: 'middle', horizontal: 'center' }
        labelCell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } }

        const valueCell = sheet.getCell(4, i + 1)
        valueCell.value = summaryValues[i]
        valueCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: summaryText[i] } }
        valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: summaryFill[i] } }
        valueCell.alignment = { vertical: 'middle', horizontal: 'center' }
        valueCell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } }
      })
      sheet.getRow(4).height = 22

      // ── En-tête du tableau détail (ligne 6) ──
      const headerRowIdx = 6
      const headers = hasExtra
        ? ['Prénom et Nom', 'Trous', 'Activité annexe', 'Statut', 'Message et Remarque']
        : ['Prénom et Nom', 'Trous', 'Statut', 'Message et Remarque']
      headers.forEach((h, i) => {
        const c = sheet.getCell(headerRowIdx, i + 1)
        c.value = h
        c.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb('#185FA5') } }
        c.alignment = { vertical: 'middle', horizontal: i === detailColCount - 1 ? 'left' : 'center' }
      })
      sheet.getRow(headerRowIdx).height = 20

      // ── Lignes participants ──
      displayed.forEach((p, i) => {
        const rowIdx = headerRowIdx + 1 + i
        const name   = `${p.players?.first_name ?? ''} ${p.players?.surname ?? ''}`.trim()
        const holes  = reportHolesLabel(p)
        const status = statusLabelFr[p.status] ?? p.status
        const statusStyle = STATUS_STYLE[p.status] ?? { bg: '#F1F5F9', text: '#64748B' }
        const msgLines: string[] = []
        if (p.response_message) msgLines.push(`Msg: ${p.response_message}`)
        if (p.admin_note)       msgLines.push(`Remarque: ${p.admin_note}`)
        const stripe = i % 2 === 1 ? argb('#F8FAFC') : 'FFFFFFFF'

        const cols: { value: any; align: 'left' | 'center'; color?: string; fill?: string; bold?: boolean }[] = hasExtra
          ? [
              { value: name, align: 'left' },
              { value: holes, align: 'center', color: HOLES_COLOR[holes], bold: true },
              { value: p.extra_activity_count ?? '—', align: 'center' },
              { value: status, align: 'center', color: argb(statusStyle.text), fill: argb(statusStyle.bg), bold: true },
              { value: msgLines.join('\n'), align: 'left' },
            ]
          : [
              { value: name, align: 'left' },
              { value: holes, align: 'center', color: HOLES_COLOR[holes], bold: true },
              { value: status, align: 'center', color: argb(statusStyle.text), fill: argb(statusStyle.bg), bold: true },
              { value: msgLines.join('\n'), align: 'left' },
            ]

        cols.forEach((col, ci) => {
          const c = sheet.getCell(rowIdx, ci + 1)
          c.value = col.value
          c.font = { name: 'Arial', size: 10, bold: !!col.bold, color: { argb: col.color ?? 'FF334155' } }
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col.fill ?? stripe } }
          c.alignment = { vertical: 'middle', horizontal: col.align, wrapText: ci === cols.length - 1 }
          c.border = { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } }
        })
        if (msgLines.length > 1) sheet.getRow(rowIdx).height = 15 * msgLines.length
      })

      sheet.getRow(headerRowIdx).eachCell(c => { c.border = { ...c.border, bottom: { style: 'thin', color: { argb: 'FF185FA5' } } } })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const safeTitle = (event?.title ?? 'participants').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')
      a.href = url
      a.download = `${safeTitle}-participants.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  function changeSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  function handleMessageSaved(playerId: string, msg: string) {
    setParticipants(prev => prev.map(p =>
      p.player_id === playerId ? { ...p, response_message: msg || null } : p
    ))
  }

  function handleNoteSaved(playerId: string, note: string) {
    setParticipants(prev => prev.map(p =>
      p.player_id === playerId ? { ...p, admin_note: note || null } : p
    ))
  }

  const statusOrder = { GOING: 0, INVITED: 1, WAITLIST: 2, DECLINED: 3 }

  const { going, going18, going9front, going9back, going9, invited, declined, has9holers, extraActivityCount } = useMemo(() => {
    const going  = participants.filter(p => p.status === 'GOING')
    const going9 = going.filter(p => p.holes_played === 9)
    return {
      going,
      going18:     going.filter(p => !p.holes_played || p.holes_played === 18),
      going9front: going.filter(p => p.holes_played === 9 && p.holes_section === 'out'),
      going9back:  going.filter(p => p.holes_played === 9 && p.holes_section === 'in'),
      going9,
      invited:     participants.filter(p => p.status === 'INVITED').length,
      declined:    participants.filter(p => p.status === 'DECLINED').length,
      has9holers:  going9.length > 0,
      extraActivityCount: participants.reduce((sum, p) => sum + (p.extra_activity_count ?? 0), 0),
    }
  }, [participants])

  // FIX L363–L367 — optional chaining + fallback '' pour localeCompare et ?? 999 pour whs
  const displayed = useMemo(() => [...participants].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortField === 'name') {
      const na = `${a.players?.surname ?? ''} ${a.players?.first_name ?? ''}`.toLowerCase()
      const nb = `${b.players?.surname ?? ''} ${b.players?.first_name ?? ''}`.toLowerCase()
      return na.localeCompare(nb) * dir
    }
    if (sortField === 'whs')    return ((a.players?.whs ?? 999) - (b.players?.whs ?? 999)) * dir
    if (sortField === 'status') return ((statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)) * dir
    if (sortField === 'holes')  return ((a.holes_played ?? 18) - (b.holes_played ?? 18)) * dir
    return 0
  }), [participants, sortField, sortDir])

  function SortBtn({ field, label }: { field: SortField; label: string }) {
    const active = sortField === field
    return (
      <button type="button" onClick={() => changeSort(field)}
        className={`flex items-center gap-1 text-[12px] font-semibold transition-colors ${
          active ? 'text-[#185FA5]' : 'text-slate-400 hover:text-slate-600'}`}>
        {label}
        <span className="text-[10px]">{active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    )
  }

  if (roleLoading) return (
    <div className="p-6 space-y-2">
      {[1,2,3].map(i => <div key={i} className="h-12 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )

  function canEditMessage(p: Participant): boolean {
    if (isOwner) return false
    return p.player_id === myPlayerId
  }
  function canSeeMessage(p: Participant): boolean {
    return isOwner || p.player_id === myPlayerId
  }
  // Remarque : chacun voit les remarques de tous ; chacun peut créer/éditer la sienne, l'admin peut éditer celle de n'importe qui
  function canEditNote(p: Participant): boolean {
    return isOwner || p.player_id === myPlayerId
  }

  const gridCols = isOwner
    ? (extraActivityLabel
        ? 'grid-cols-[minmax(160px,1fr)_40px_70px_54px_60px_80px_150px_130px_minmax(160px,190px)]'
        : 'grid-cols-[minmax(160px,1fr)_40px_70px_60px_80px_150px_130px_minmax(160px,190px)]')
    : (extraActivityLabel
        ? 'grid-cols-[minmax(200px,1fr)_40px_70px_54px_60px_80px_150px_130px]'
        : 'grid-cols-[minmax(200px,1fr)_40px_70px_60px_80px_150px_130px]')
  const tableMinWidth = isOwner
    ? (extraActivityLabel ? 'min-w-[920px]' : 'min-w-[880px]')
    : (extraActivityLabel ? 'min-w-[780px]' : 'min-w-[740px]')

  return (
    <div className="p-5 sm:p-6 max-w-5xl">
      {msgModal && (
        <MessageModal
          participant={msgModal}
          canSeeMessage={canSeeMessage(msgModal)}
          canEditMessage={canEditMessage(msgModal)}
          canEditNote={canEditNote(msgModal)}
          eventId={selectedEventId}
          onClose={() => setMsgModal(null)}
          onSaved={(pid, msg) => { handleMessageSaved(pid, msg); setMsgModal(null) }}
          onNoteSaved={(pid, note) => { handleNoteSaved(pid, note); setMsgModal(null) }}
        />
      )}

      <div className="flex items-center gap-4 mb-5">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          <button type="button" onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
              viewMode === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
            {t('participants.byEvent')}
          </button>
          {isOwner && (
            <button type="button" onClick={() => setViewMode('overview')}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                viewMode === 'overview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              {t('participants.overview')}
            </button>
          )}
        </div>
        {viewMode === 'list' && (
          <div className="flex items-center gap-2 ml-auto">
            {isOwner && (
              <button type="button" onClick={exportToExcel} disabled={exporting}
                className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap">
                {exporting ? 'Génération…' : '📊 Exporter Excel'}
              </button>
            )}
            <a href={`/groups/${groupId}/invitations`}
              className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-xl border border-[#185FA5] text-[#185FA5] bg-white hover:bg-[#EBF3FC] transition-colors whitespace-nowrap">
              ✉️ {t('participants.invitations')}
            </a>
          </div>
        )}
      </div>

      {viewMode === 'list' && (
        <>
          <div className="mb-5 rounded-xl border border-white/60 shadow-sm p-4"
            style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">
              {t('participants.byEvent')}
            </label>
            <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)}
              className="border border-white/50 rounded-xl px-3 py-2.5 text-[13px] bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 w-full max-w-sm">
              {events.map(e => (
                <option key={e.id} value={e.id}>{e.title} — {formatDate(e.starts_at)}</option>
              ))}
            </select>
          </div>

          {!isOwner && (
            <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-[12px] text-blue-700 font-medium">
              {t('participants.readOnly')}
            </div>
          )}

          <div className="flex gap-3 mb-5 flex-wrap">
            <div className="border border-[#C0DD97] rounded-xl px-4 py-2.5 flex flex-col items-center min-w-[68px]" style={{ background: '#EAF3DE' }}>
              <span className="text-[20px] font-black text-[#3B6D11]">{going18.length}</span>
              <span className="text-[10px] font-semibold text-[#3B6D11] uppercase tracking-wide whitespace-nowrap">
                {has9holers ? t('participants.going18') : t('participants.going')}
              </span>
            </div>
            {going9front.length > 0 && (
              <div className="border border-amber-200 rounded-xl px-4 py-2.5 flex flex-col items-center min-w-[68px]" style={{ background: '#FEF3C7' }}>
                <span className="text-[20px] font-black text-amber-700">{going9front.length}</span>
                <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide whitespace-nowrap">9H Front</span>
              </div>
            )}
            {going9back.length > 0 && (
              <div className="border border-orange-200 rounded-xl px-4 py-2.5 flex flex-col items-center min-w-[68px]" style={{ background: '#FFF7ED' }}>
                <span className="text-[20px] font-black text-orange-700">{going9back.length}</span>
                <span className="text-[10px] font-semibold text-orange-600 uppercase tracking-wide whitespace-nowrap">9H Back</span>
              </div>
            )}
            <div className="border border-white/50 rounded-xl px-4 py-2.5 flex flex-col items-center min-w-[68px]" style={{ background: '#EBF3FC' }}>
              <span className="text-[20px] font-black text-[#0C447C]">{invited}</span>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{t('participants.invited')}</span>
            </div>
            <div className="border border-white/50 rounded-xl px-4 py-2.5 flex flex-col items-center min-w-[68px]" style={{ background: '#FCEBEB' }}>
              <span className="text-[20px] font-black text-[#A32D2D]">{declined}</span>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{t('participants.declined')}</span>
            </div>
            <div className="border border-white/50 rounded-xl px-4 py-2.5 flex flex-col items-center min-w-[68px]" style={{ background: '#F1F5F9' }}>
              <span className="text-[20px] font-black text-slate-700">{participants.length}</span>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{t('participants.total')}</span>
            </div>
            {extraActivityLabel && (
              <div className="border border-purple-200 rounded-xl px-4 py-2.5 flex flex-col items-center min-w-[68px] max-w-[140px]" style={{ background: '#F5F0FF' }}>
                <span className="text-[20px] font-black text-[#7C3AED]">{extraActivityCount}</span>
                <span className="text-[10px] font-semibold text-[#7C3AED] uppercase tracking-wide truncate w-full text-center">
                  🍽️ {extraActivityLabel}
                </span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="h-12 bg-white/40 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="rounded-xl border border-white/60 shadow-sm overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
              <div className="overflow-x-auto">
              <div className={tableMinWidth}>
              {/* Header */}
              <div className={`grid gap-3 px-4 py-3 bg-white/30 border-b border-white/40 ${gridCols}`}>
                <SortBtn field="name"   label={t('participants.player')} />
                <span />
                <SortBtn field="holes"  label={t('participants.holes')} />
                {extraActivityLabel && <span className="text-[12px] font-semibold text-slate-400 text-center" title={extraActivityLabel}>🍽️</span>}
                <SortBtn field="whs"    label={t('participants.whs')} />
                <span className="text-[12px] font-semibold text-slate-400">{t('participants.respondedOn')}</span>
                <SortBtn field="status" label={t('participants.status')} />
                {isOwner && (
                  <span className="text-[12px] font-semibold text-slate-400 flex justify-center items-center">
                    {t('participants.actions')}
                  </span>
                )}
              </div>

              {displayed.length === 0 ? (
                <div className="px-4 py-10 text-center text-[13px] text-slate-500">
                  {t('participants.noParticipants')}
                </div>
              ) : (
                displayed.map((p, i) => (
                  <div key={p.player_id}
                    className={`grid gap-3 px-4 py-3 items-center ${gridCols} ${i < displayed.length - 1 ? 'border-b border-white/30' : ''}`}>

                    {/* Nom — FIX L532 */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13px] font-semibold text-slate-800 truncate">
                        {p.players?.first_name ?? '—'} {p.players?.surname ?? ''}
                      </span>
                    </div>

                    {/* Badges Message (M) + Remarque (R) */}
                    <div className="flex items-center justify-center gap-1">
                      {canSeeMessage(p) && p.response_message && (
                        <MBadge onClick={() => setMsgModal(p)} />
                      )}
                      {p.admin_note && (
                        <RBadge onClick={() => setMsgModal(p)} />
                      )}
                      {!p.admin_note && canEditNote(p) && (
                        <button
                          onClick={() => setMsgModal(p)}
                          title="Ajouter une remarque"
                          className="w-5 h-5 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-[9px] text-slate-300 hover:border-[#4338CA] hover:text-[#4338CA] transition-colors"
                        >
                          +
                        </button>
                      )}
                      {!p.response_message && canEditMessage(p) && (
                        <button
                          onClick={() => setMsgModal(p)}
                          title="Ajouter un message"
                          className="w-5 h-5 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-[9px] text-slate-300 hover:border-[#185FA5] hover:text-[#185FA5] transition-colors"
                        >
                          +
                        </button>
                      )}
                    </div>

                    {/* Holes */}
                    <div className="flex justify-start">
                      {isOwner && p.status === 'GOING' ? (
                        <button type="button"
                          onClick={() => toggleHoles(p.player_id, p.holes_played, p.holes_section)}
                          className={`text-[11px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                            p.holes_played === 9 && p.holes_section === 'out'
                              ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
                              : p.holes_played === 9 && p.holes_section === 'in'
                              ? 'bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100'
                              : 'bg-white/60 border-slate-200 text-slate-400 hover:border-amber-300 hover:text-amber-600'
                          }`}>
                                                {holesLabel(p.holes_played, p.holes_section)}</button>
                      ) : p.status === 'GOING' ? (                              // ← ajout filtre statut
                        <HolesBadge holes={p.holes_played} section={p.holes_section} />
                      ) : (
                        <span />                                                // ← rien pour DECLINED/INVITED
                      )}
                    </div>

                    {/* Activité annexe */}
                    {extraActivityLabel && (
                      <div className="flex justify-center">
                        <ExtraActivityCell
                          count={p.extra_activity_count}
                          isOwner={isOwner}
                          onChange={next => setExtraActivityLocal(p.player_id, next)}
                          onCommit={next => commitExtraActivity(p.player_id, next)}
                        />
                      </div>
                    )}

                   {/* WHS — FIX L574 */}
                    <div className="text-[13px] text-slate-600 text-center">{p.players?.whs ?? '—'}</div>

                    {/* Responded at */}
                    <div className="text-[11px] text-slate-600">{formatResponded(p.responded_at)}</div>

                    {/* Status */}
                    <div><Badge status={p.status} /></div>

                    {/* Actions owner */}
                    {isOwner && (
                      <div className="flex justify-center items-center gap-1">
                        {(['GOING', 'DECLINED', 'INVITED'] as const).map(s => (
                          <button key={s} type="button" onClick={() => updateStatus(p.player_id, s)}
                            className={`text-[11px] font-semibold px-2 py-1 rounded-lg border transition-colors ${
                              p.status === s
                                ? s === 'GOING'    ? 'bg-[#EAF3DE] border-[#C0DD97] text-[#3B6D11]'
                                : s === 'DECLINED' ? 'bg-[#FCEBEB] border-[#F7C1C1] text-[#A32D2D]'
                                :                   'bg-[#EBF3FC] border-[#B5D4F4] text-[#0C447C]'
                                : 'border-slate-200 text-slate-400 hover:bg-white/30'
                            }`}>
                            {s === 'GOING' ? t('participants.yes') : s === 'DECLINED' ? t('participants.no') : t('participants.reset')}
                          </button>
                        ))}
                        <button type="button" onClick={() => removeParticipant(p.player_id)}
                          className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors ml-1">
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
              </div>
              </div>
            </div>
          )}
        </>
      )}

      {viewMode === 'overview' && isOwner && (
        <>
          {overviewLoading ? (
            <div className="space-y-2">
              {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-white/40 rounded-xl animate-pulse" />)}
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="text-center py-12 text-[13px] text-slate-500 border border-dashed border-slate-200 rounded-xl">
              {t('participants.noUpcoming')}
            </div>
          ) : (
            <div className="rounded-xl border border-white/60 shadow-sm overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] border-collapse">
                  <thead>
                    <tr className="bg-white/30 border-b border-white/40">
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 sticky left-0 bg-white/40 min-w-[160px]">{t('participants.member')}</th>
                      {upcomingEvents.map(e => (
                        <th key={e.id} className="px-3 py-3 text-center font-semibold text-slate-500 min-w-[100px]">
                          <div className="text-[11px] text-slate-700 font-semibold truncate max-w-[90px]">{e.title}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{formatDateShort(e.starts_at)}</div>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center font-semibold text-slate-400 min-w-[60px]">{t('participants.total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allMembers.map((member, i) => {
                      const memberStatuses = statusMatrix[member.id] ?? {}
                      const goingCount = Object.values(memberStatuses).filter(s => s === 'GOING').length
                      return (
                        <tr key={member.id}
                          className={`border-b border-white/30 hover:bg-white/30 ${i % 2 === 0 ? '' : 'bg-white/20'}`}>
                          <td className="px-4 py-3 font-semibold text-slate-900 sticky left-0 bg-white/60">
                            {member.first_name} {member.surname}
                          </td>
                          {upcomingEvents.map(e => {
                            const status = memberStatuses[e.id]
                            const icon = status ? STATUS_ICON[status] : null
                            return (
                              <td key={e.id} className="px-3 py-3 text-center">
                                {icon
                                  ? <span className="text-[14px] font-black" style={{ color: icon.color }}>{icon.icon}</span>
                                  : <span className="text-slate-200 text-[14px]">—</span>}
                              </td>
                            )
                          })}
                          <td className="px-3 py-3 text-center">
                            <span className={`text-[12px] font-semibold ${goingCount > 0 ? 'text-[#3B6D11]' : 'text-slate-300'}`}>
                              {goingCount}/{upcomingEvents.length}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t border-slate-200">
                      <td className="px-4 py-2.5 text-[11px] font-bold text-slate-600 sticky left-0 bg-slate-100">{t('participants.going')}</td>
                      {upcomingEvents.map(e => {
                        const count = allMembers.filter(m => statusMatrix[m.id]?.[e.id] === 'GOING').length
                        return (
                          <td key={e.id} className="px-3 py-2.5 text-center">
                            <span className="text-[12px] font-bold text-[#3B6D11]">{count}</span>
                          </td>
                        )
                      })}
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="flex gap-4 px-4 py-3 border-t border-white/30 flex-wrap">
                {Object.entries(STATUS_ICON).map(([status, { icon, color }]) => (
                  <div key={status} className="flex items-center gap-1">
                    <span className="text-[13px] font-black" style={{ color }}>{icon}</span>
                    <span className="text-[11px] text-slate-500">{t(`status.${status}` as any)}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <span className="text-[13px] text-slate-200">—</span>
                  <span className="text-[11px] text-slate-500">{t('participants.notInvited')}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

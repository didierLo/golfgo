'use client'

import { useEffect, useState } from 'react'
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
  response_message: string | null          // ← NOUVEAU
  players: { first_name: string; surname: string; whs: number | null }
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
  if (!holes || holes === 18) return null
  const label = section === 'out' ? '9F' : section === 'in' ? '9B' : '9H'
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
  return '9T'
}

// ─── Modal message ──────────────────────────────────────────────────────────
function MessageModal({
  participant,
  isOwner,
  eventId,
  onClose,
  onSaved,
}: {
  participant: Participant
  isOwner: boolean
  eventId: string
  onClose: () => void
  onSaved: (playerId: string, msg: string) => void
}) {
  const [text, setText]     = useState(participant.response_message ?? '')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  const canEdit = !isOwner // le joueur peut éditer le sien; l'owner lit seulement

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
            {participant.players.first_name[0]}{participant.players.surname[0]}
          </div>
          <div>
            <p className="text-[14px] font-bold text-slate-800">
              {participant.players.first_name} {participant.players.surname}
            </p>
            <p className="text-[11px] text-slate-400">Message de réponse</p>
          </div>
        </div>

        {isOwner ? (
          // Owner : lecture seule
          <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap min-h-[80px]">
            {participant.response_message || <span className="text-slate-400 italic">Aucun message</span>}
          </div>
        ) : (
          // Joueur : éditable
          <>
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
            <div className="flex items-center justify-between mt-1 mb-4">
              <span className="text-[11px] text-slate-400">{text.length}/300 · max 3 lignes</span>
              {participant.response_message && (
                <button onClick={handleDelete}
                  className="text-[11px] text-red-400 hover:text-red-600 font-semibold">
                  Supprimer le message
                </button>
              )}
            </div>
            {saved ? (
              <p className="text-center text-[13px] text-[#3B6D11] font-semibold">✓ Message enregistré</p>
            ) : (
              <button onClick={handleSave} disabled={!text.trim() || saving}
                className="w-full bg-[#185FA5] text-white text-[13px] font-semibold py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-40 transition-colors">
                {saving ? 'Enregistrement…' : 'Enregistrer le message'}
              </button>
            )}
          </>
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
      title="Voir le message"
      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 transition-colors hover:scale-110"
      style={{ background: '#185FA5', color: '#fff' }}
    >
      M
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
  const [msgModal,        setMsgModal]        = useState<Participant | null>(null)  // ← NOUVEAU

  // Identifiant du joueur connecté (pour autoriser l'édition de son propre message)
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
  useEffect(() => { if (selectedEventId) loadParticipants(selectedEventId) }, [selectedEventId])
  useEffect(() => { if (viewMode === 'overview' && isOwner && groupId) loadOverview() }, [viewMode, isOwner, groupId])

  async function loadEvents() {
    const { data } = await supabase.from('events').select('id, title, starts_at')
      .eq('group_id', groupId).order('starts_at', { ascending: false })
    setEvents(data || [])
  }

  async function loadParticipants(evId: string) {
    setLoading(true)
    const { data, error } = await supabase
      .from('event_participants')
      .select(`player_id, status, responded_at, holes_played, holes_section, response_message, players(first_name, surname, whs)`)
      .eq('event_id', evId)
    if (error) { console.error(error); setLoading(false); return }
    setParticipants((data || []) as any)
    setLoading(false)
  }

  async function loadOverview() {
    if (!groupId) return
    setOverviewLoading(true)
    const { data: evts } = await supabase.from('events').select('id, title, starts_at')
      .eq('group_id', groupId).gte('starts_at', new Date().toISOString()).order('starts_at', { ascending: true })
    const upcoming = evts || []
    setUpcomingEvents(upcoming)
    const { data: mbrs } = await supabase.from('groups_players')
      .select(`player:players(id, first_name, surname)`).eq('group_id', groupId)
    const members = (mbrs || []).map((m: any) => m.player)
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

  function changeSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  // Mise à jour locale après sauvegarde du message
  function handleMessageSaved(playerId: string, msg: string) {
    setParticipants(prev => prev.map(p =>
      p.player_id === playerId ? { ...p, response_message: msg || null } : p
    ))
  }

  const statusOrder = { GOING: 0, INVITED: 1, WAITLIST: 2, DECLINED: 3 }
  const displayed = [...participants].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1
    if (sortField === 'name') {
      const na = `${a.players.surname} ${a.players.first_name}`.toLowerCase()
      const nb = `${b.players.surname} ${b.players.first_name}`.toLowerCase()
      return na.localeCompare(nb) * dir
    }
    if (sortField === 'whs')    return ((a.players.whs ?? 999) - (b.players.whs ?? 999)) * dir
    if (sortField === 'status') return ((statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)) * dir
    if (sortField === 'holes')  return ((a.holes_played ?? 18) - (b.holes_played ?? 18)) * dir
    return 0
  })

  const going       = participants.filter(p => p.status === 'GOING')
  const going18     = going.filter(p => !p.holes_played || p.holes_played === 18)
  const going9front = going.filter(p => p.holes_played === 9 && p.holes_section === 'out')
  const going9back  = going.filter(p => p.holes_played === 9 && p.holes_section === 'in')
  const going9      = going.filter(p => p.holes_played === 9)
  const invited     = participants.filter(p => p.status === 'INVITED').length
  const declined    = participants.filter(p => p.status === 'DECLINED').length
  const has9holers  = going9.length > 0

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

  // Détermine si le joueur connecté peut éditer le message d'un participant
  function canEditMessage(p: Participant): boolean {
    if (isOwner) return false            // owner lit seulement
    return p.player_id === myPlayerId   // le joueur édite uniquement le sien
  }
  function canSeeMessage(p: Participant): boolean {
    return isOwner || p.player_id === myPlayerId
  }

  return (
    <div className="p-5 sm:p-6 max-w-5xl">
      {/* Modal message */}
      {msgModal && (
        <MessageModal
          participant={msgModal}
          isOwner={isOwner}
          eventId={selectedEventId}
          onClose={() => setMsgModal(null)}
          onSaved={(pid, msg) => { handleMessageSaved(pid, msg); setMsgModal(null) }}
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
          <a href={`/groups/${groupId}/invitations`}
              className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-xl border border-[#185FA5] text-[#185FA5] bg-white hover:bg-[#EBF3FC] transition-colors whitespace-nowrap ml-auto">
    ✉️         {t('participants.invitations')}
          </a>
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
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="h-12 bg-white/40 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="rounded-xl border border-white/60 shadow-sm overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
              {/* Header */}
              <div className={`grid gap-3 px-4 py-3 bg-white/30 border-b border-white/40 ${
                isOwner
                  ? 'grid-cols-[minmax(140px,1fr)_20px_70px_55px_55px] sm:grid-cols-[minmax(160px,1fr)_20px_70px_60px_80px_150px_130px_minmax(160px,190px)]'
                  : 'grid-cols-[1fr_20px_70px_55px_70px] sm:grid-cols-[1fr_20px_70px_60px_80px_150px_130px]'
              }`}>
                <SortBtn field="name"   label={t('participants.player')} />
                <span />  {/* colonne badge M */}
                <SortBtn field="holes"  label={t('participants.holes')} />
                <SortBtn field="whs"    label={t('participants.whs')} />
                <span className="text-[12px] font-semibold text-slate-400 hidden sm:block">{t('participants.respondedOn')}</span>
                <SortBtn field="status" label={t('participants.status')} />
                {isOwner && (
                  <span className="text-[12px] font-semibold text-slate-400 hidden sm:flex justify-center items-center">
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
                    className={`grid gap-3 px-4 py-3 items-center ${
                      isOwner
                        ? 'grid-cols-[minmax(140px,1fr)_20px_70px_55px_55px] sm:grid-cols-[minmax(160px,1fr)_20px_70px_60px_80px_150px_130px_minmax(160px,190px)]'
                        : 'grid-cols-[1fr_20px_70px_55px_70px] sm:grid-cols-[1fr_20px_70px_60px_80px_150px_130px]'
                    } ${i < displayed.length - 1 ? 'border-b border-white/30' : ''}`}>

                    {/* Nom */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13px] font-semibold text-slate-800 truncate">
                        {p.players.first_name} {p.players.surname}
                      </span>
                    </div>

                    {/* Badge M */}
                    <div className="flex items-center justify-center">
                      {canSeeMessage(p) && p.response_message ? (
                        <MBadge onClick={() => setMsgModal(p)} />
                      ) : canEditMessage(p) ? (
                        /* bouton discret pour ajouter un message */
                        <button
                          onClick={() => setMsgModal(p)}
                          title="Ajouter un message"
                          className="w-5 h-5 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-[9px] text-slate-300 hover:border-[#185FA5] hover:text-[#185FA5] transition-colors"
                        >
                          +
                        </button>
                      ) : (
                        <span />
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
                          {holesLabel(p.holes_played, p.holes_section)}
                        </button>
                      ) : (
                        <HolesBadge holes={p.holes_played} section={p.holes_section} />
                      )}
                    </div>

                    {/* WHS */}
                    <div className="text-[13px] text-slate-600 text-center">{p.players.whs ?? '—'}</div>

                    {/* Responded at */}
                    <div className="text-[11px] text-slate-600 hidden sm:block">{formatResponded(p.responded_at)}</div>

                    {/* Status */}
                    <div><Badge status={p.status} /></div>

                    {/* Actions owner */}
                    {isOwner && (
                      <div className="hidden sm:flex justify-center items-center gap-1">
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

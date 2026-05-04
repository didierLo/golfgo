'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useGroupRole } from '@/lib/hooks/useGroupRole'

const supabase = createClient()

type Participant = {
  player_id: string
  status: 'GOING' | 'INVITED' | 'DECLINED' | 'WAITLIST'
  responded_at: string | null
  holes_played: number | null
  players: { first_name: string; surname: string; whs: number | null }
}
type Event     = { id: string; title: string; starts_at: string }
type Member    = { id: string; first_name: string; surname: string }
type SortField = 'name' | 'status' | 'whs' | 'holes'
type ViewMode  = 'list' | 'overview'

const STATUS_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  GOING:    { label: 'going',    bg: '#EAF3DE', text: '#3B6D11' },
  INVITED:  { label: 'invited',  bg: '#EBF3FC', text: '#0C447C' },
  DECLINED: { label: 'declined', bg: '#FCEBEB', text: '#A32D2D' },
  WAITLIST: { label: 'waitlist', bg: '#FAEEDA', text: '#854F0B' },
}
const STATUS_ICON: Record<string, { icon: string; color: string }> = {
  GOING:    { icon: '✓', color: '#3B6D11' },
  INVITED:  { icon: '~', color: '#0C447C' },
  DECLINED: { icon: '✗', color: '#A32D2D' },
  WAITLIST: { icon: '…', color: '#854F0B' },
}

function Badge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { label: status.toLowerCase(), bg: '#F1F5F9', text: '#64748B' }
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.text }}>
      {s.label}
    </span>
  )
}

function HolesBadge({ holes }: { holes: number | null }) {
  if (!holes || holes === 18) return null
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 flex-shrink-0">
      {holes}T
    </span>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatDateShort(d: string) {
  return new Date(d).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })
}
function formatResponded(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('fr-BE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Brussels',
  })
}

export default function ParticipantsPage() {
  const params  = useParams()
  const groupId = params.id      as string
  const eventId = params.eventId as string

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
      .select(`player_id, status, responded_at, holes_played, players(first_name, surname, whs)`)
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
      .sort((a: Member, b: Member) => a.surname.localeCompare(b.surname))
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

  async function toggleHoles(playerId: string, current: number | null) {
    const next = (!current || current === 18) ? 9 : 18
    await supabase.from('event_participants')
      .update({ holes_played: next })
      .eq('event_id', selectedEventId).eq('player_id', playerId)
    // optimistic update
    setParticipants(prev => prev.map(p =>
      p.player_id === playerId ? { ...p, holes_played: next } : p
    ))
  }

  async function removeParticipant(playerId: string) {
    if (!confirm('Retirer ce joueur de l\'événement ?')) return
    await supabase.from('event_participants').delete()
      .eq('event_id', selectedEventId).eq('player_id', playerId)
    loadParticipants(selectedEventId)
  }

  function changeSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
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

  // Stats
  const going   = participants.filter(p => p.status === 'GOING')
  const going18 = going.filter(p => !p.holes_played || p.holes_played === 18)
  const going9  = going.filter(p => p.holes_played === 9)
  const invited  = participants.filter(p => p.status === 'INVITED').length
  const declined = participants.filter(p => p.status === 'DECLINED').length
  const has9holers = going9.length > 0

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

  return (
  <div className="p-5 sm:p-6">

    {/* Toggle */}
    <div className="flex items-center gap-4 mb-5">
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
        <button onClick={() => setViewMode('list')}
          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold ${
            viewMode === 'list' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'
          }`}>
          Par événement
        </button>

        {isOwner && (
          <button onClick={() => setViewMode('overview')}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold ${
              viewMode === 'overview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'
            }`}>
            Vue d'ensemble
          </button>
        )}
      </div>

      <a href={`/groups/${groupId}/invitations`}
        className="text-[12px] font-semibold text-black ml-auto">
        ← Invitations
      </a>
    </div>

    {/* Select event */}
    <div className="mb-5">
      <select
        value={selectedEventId}
        onChange={e => setSelectedEventId(e.target.value)}
        className="border border-white/50 rounded-xl px-3 py-2.5 text-[13px] bg-white text-slate-900 w-full max-w-sm"
      >
        {events.map(e => (
          <option key={e.id} value={e.id}>
            {e.title} — {formatDate(e.starts_at)}
          </option>
        ))}
      </select>
    </div>

    {/* TABLE */}
    <div
      className="rounded-xl border border-white/60 overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(10px)',
      }}
    >

      {/* HEADER */}
      <div className={`grid gap-3 px-4 py-3 bg-white/40 border-b border-white/40 ${
        isOwner
          ? 'grid-cols-[minmax(220px,2fr)_70px_60px_110px_110px_180px]'
          : 'grid-cols-[minmax(220px,2fr)_70px_60px_110px_110px]'
      }`}>
        <span className="text-[12px] font-semibold text-slate-500">Joueur</span>
        <span className="text-[12px] font-semibold text-slate-500">Trous</span>
        <span className="text-[12px] font-semibold text-slate-500">WHS</span>
        <span className="text-[12px] font-semibold text-slate-500">Répondu</span>
        <span className="text-[12px] font-semibold text-slate-500">Statut</span>
        {isOwner && (
          <span className="text-[12px] font-semibold text-slate-500 text-right">
            Actions
          </span>
        )}
      </div>

      {/* ROWS */}
      {displayed.map((p, i) => (
        <div
          key={p.player_id}
          className={`grid gap-3 px-4 py-3 items-center ${
            isOwner
              ? 'grid-cols-[minmax(220px,2fr)_70px_60px_110px_110px_180px]'
              : 'grid-cols-[minmax(220px,2fr)_70px_60px_110px_110px]'
          } ${i < displayed.length - 1 ? 'border-b border-white/30' : ''}`}
        >

          {/* NOM */}
          <div className="min-w-0">
            <span className="text-[13px] font-semibold text-slate-900 truncate">
              {p.players.first_name} {p.players.surname}
            </span>
          </div>

          {/* TROUS */}
          <div>
            {isOwner && p.status === 'GOING' ? (
              <button
                onClick={() => toggleHoles(p.player_id, p.holes_played)}
                className="text-[11px] px-2 py-1 rounded-lg border"
              >
                {p.holes_played === 9 ? '9T' : '18T'}
              </button>
            ) : (
              <span className="text-[11px] text-slate-500">
                {p.holes_played === 9 ? '9T' : ''}
              </span>
            )}
          </div>

          {/* WHS */}
          <div className="text-[13px] text-slate-700">
            {p.players.whs ?? '—'}
          </div>

          {/* DATE */}
          <div className="text-[11px] text-slate-500">
            {formatResponded(p.responded_at)}
          </div>

          {/* STATUS */}
          <div>
            <Badge status={p.status} />
          </div>

          {/* ACTIONS */}
          {isOwner && (
            <div className="flex justify-end gap-0.5">
              {(['GOING', 'DECLINED', 'INVITED'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => updateStatus(p.player_id, s)}
                  className="text-[10px] px-1.5 py-0.5 rounded-md border"
                >
                  {s === 'GOING' ? 'Yes' : s === 'DECLINED' ? 'No' : 'Reset'}
                </button>
              ))}

              <button
                onClick={() => removeParticipant(p.player_id)}
                className="text-[10px] px-1.5 py-0.5 rounded-md border border-red-200 text-red-400"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
)
}

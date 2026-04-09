'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useGroupRole } from '@/lib/hooks/useGroupRole'

const supabase = createClient()

type Participant = {
  player_id: string
  status: 'GOING' | 'INVITED' | 'DECLINED' | 'WAITLIST'
  players: { first_name: string; surname: string; whs: number | null }
}

type Event  = { id: string; title: string; starts_at: string }
type Member = { id: string; first_name: string; surname: string }
type SortField = 'name' | 'status' | 'whs'
type ViewMode = 'list' | 'overview'

const STATUS_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  GOING:    { label: 'going',    bg: '#EAF3DE', text: '#3B6D11' },
  INVITED:  { label: 'invited',  bg: '#EEEDFE', text: '#3C3489' },
  DECLINED: { label: 'declined', bg: '#FCEBEB', text: '#A32D2D' },
  WAITLIST: { label: 'waitlist', bg: '#FAEEDA', text: '#854F0B' },
}

const STATUS_ICON: Record<string, { icon: string; color: string }> = {
  GOING:    { icon: '✓', color: '#3B6D11' },
  INVITED:  { icon: '~', color: '#3C3489' },
  DECLINED: { icon: '✗', color: '#A32D2D' },
  WAITLIST: { icon: '…', color: '#854F0B' },
}

function Badge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { label: status.toLowerCase(), bg: '#F1EFE8', text: '#5F5E5A' }
  return (
    <span className="text-[11px] font-medium px-2 py-1 rounded-full" style={{ background: s.bg, color: s.text }}>
      {s.label}
    </span>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateLong(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-BE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })
}

export default function ParticipantsPage() {
  const params = useParams()
  const groupId  = params.id as string
  const eventId  = params.eventId as string

  const { role, loading: roleLoading } = useGroupRole(groupId)
  const isOwner = role === 'owner'

  const [viewMode, setViewMode]           = useState<ViewMode>('list')
  const [events, setEvents]               = useState<Event[]>([])
  const [selectedEventId, setSelectedEventId] = useState(eventId)
  const [participants, setParticipants]   = useState<Participant[]>([])
  const [loading, setLoading]             = useState(true)
  const [sortField, setSortField]         = useState<SortField>('status')
  const [sortDir, setSortDir]             = useState<'asc' | 'desc'>('asc')

  // Vue d'ensemble — données croisées
  const [allMembers, setAllMembers]       = useState<Member[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [statusMatrix, setStatusMatrix]   = useState<Record<string, Record<string, string>>>({})
  const [overviewLoading, setOverviewLoading] = useState(false)

  useEffect(() => { if (groupId) loadEvents() }, [groupId])
  useEffect(() => { if (selectedEventId) loadParticipants(selectedEventId) }, [selectedEventId])
  useEffect(() => { if (viewMode === 'overview' && isOwner && groupId) loadOverview() }, [viewMode, isOwner, groupId])
  

  async function loadEvents() {
    const { data } = await supabase
      .from('events')
      .select('id, title, starts_at')
      .eq('group_id', groupId)
      .order('starts_at', { ascending: false })
      
    setEvents(data || [])
  }

  async function loadParticipants(evId: string) {
    setLoading(true)
    const { data, error } = await supabase
      .from('event_participants')
      .select(`player_id, status, players(first_name, surname, whs)`)
      .eq('event_id', evId)
    if (error) { console.error(error); setLoading(false); return }
    setParticipants(data || [])
    setLoading(false)
  }

  async function loadOverview() {
     if (!groupId) return
      setOverviewLoading(true)

    // Events à venir
    const { data: evts } = await supabase
      .from('events')
      .select('id, title, starts_at')
      .eq('group_id', groupId)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
    const upcoming = evts || []
    setUpcomingEvents(upcoming)

    // Membres du groupe
    const { data: mbrs } = await supabase
      .from('groups_players')
      .select(`player:players(id, first_name, surname)`)
      .eq('group_id', groupId)
    const members = (mbrs || []).map((m: any) => m.player)
      .sort((a: Member, b: Member) => a.surname.localeCompare(b.surname))
    setAllMembers(members)

    // Participations pour tous ces events
    if (upcoming.length > 0 && members.length > 0) {
      const { data: participations } = await supabase
        .from('event_participants')
        .select('player_id, event_id, status')
        .in('event_id', upcoming.map(e => e.id))
        .in('player_id', members.map((m: Member) => m.id))

      // Construire la matrice [playerId][eventId] = status
      const matrix: Record<string, Record<string, string>> = {}
      members.forEach((m: Member) => { matrix[m.id] = {} })
      participations?.forEach(p => { matrix[p.player_id][p.event_id] = p.status })
      setStatusMatrix(matrix)
    }

    setOverviewLoading(false)
  }

  async function updateStatus(playerId: string, status: 'GOING' | 'DECLINED' | 'INVITED') {
    await supabase
      .from('event_participants')
      .update({ status, responded_at: new Date().toISOString() })
      .eq('event_id', selectedEventId).eq('player_id', playerId)
    loadParticipants(selectedEventId)
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
    if (sortField === 'whs') return ((a.players.whs ?? 999) - (b.players.whs ?? 999)) * dir
    if (sortField === 'status') return ((statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)) * dir
    return 0
  })

  const going    = participants.filter(p => p.status === 'GOING').length
  const invited  = participants.filter(p => p.status === 'INVITED').length
  const declined = participants.filter(p => p.status === 'DECLINED').length
  const selectedEvent = events.find(e => e.id === selectedEventId)

  function SortBtn({ field, label }: { field: SortField; label: string }) {
    const active = sortField === field
    return (
      <button type="button" onClick={() => changeSort(field)}
        className={`flex items-center gap-1 text-[12px] font-medium transition-colors ${
          active ? 'text-blue-700' : 'text-gray-400 hover:text-gray-600'
        }`}>
        {label}
        <span className="text-[10px]">{active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
      </button>
    )
  }

  if (roleLoading) return (
    <div className="p-6 space-y-2">
      {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-6">

      {/* Onglets vue */}
      <div className="flex items-center gap-4 mb-5">
        <div className="flex gap-1 p-0.5 bg-gray-100 rounded-md">
          <button type="button" onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
              viewMode === 'list' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}>
            Par événement
          </button>
          {isOwner && (
            <button type="button" onClick={() => setViewMode('overview')}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${
                viewMode === 'overview' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}>
              Vue d'ensemble
            </button>
          )}
        </div>

        {viewMode === 'list' && (
          <a href={`/groups/${groupId}/invitations`}
            className="text-[12px] font-medium text-[#185FA5] hover:underline whitespace-nowrap ml-auto">
            ← Invitations
          </a>
        )}
      </div>

      {/* ── VUE PAR ÉVÉNEMENT ──────────────────────────────────────────────── */}
      {viewMode === 'list' && (
        <>
          {/* Sélecteur event */}
          <div className="mb-5">
            <select
              value={selectedEventId}
              onChange={e => setSelectedEventId(e.target.value)}
              className="border border-gray-200 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:border-blue-300 w-full max-w-sm">
              {events.map(e => (
                <option key={e.id} value={e.id}>
                  {e.title} — {formatDate(e.starts_at)}
                </option>
              ))}
            </select>
          </div>

          {selectedEvent && (
            <div className="mb-5 pb-4 border-b border-gray-100">
              <h2 className="text-[16px] font-medium text-gray-900">{selectedEvent.title}</h2>
              <p className="text-[13px] text-gray-400 mt-0.5">{formatDateLong(selectedEvent.starts_at)}</p>
            </div>
          )}

          {!isOwner && (
            <div className="mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-[12px] text-blue-700">
              Vue en lecture seule — seul l'organisateur peut modifier les participations
            </div>
          )}

          <div className="flex gap-3 mb-5">
            {[
              { n: going,               color: '#3B6D11', label: 'going' },
              { n: invited,             color: '#3C3489', label: 'invited' },
              { n: declined,            color: '#A32D2D', label: 'declined' },
              { n: participants.length, color: '#5F5E5A', label: 'total' },
            ].map(({ n, color, label }) => (
              <div key={label} className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 flex flex-col items-center min-w-[64px]">
                <span className="text-[20px] font-medium" style={{ color }}>{n}</span>
                <span className="text-[11px] text-gray-400">{label}</span>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className={`grid gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-200 ${
                isOwner ? 'grid-cols-[1fr_80px_100px_160px_32px]' : 'grid-cols-[1fr_80px_100px]'
              }`}>
                <SortBtn field="name"   label="Joueur" />
                <SortBtn field="whs"    label="WHS" />
                <SortBtn field="status" label="Statut" />
                {isOwner && <span className="text-[12px] font-medium text-gray-400 text-right">Actions</span>}
                {isOwner && <span />}
              </div>

              {displayed.length === 0 ? (
                <div className="px-4 py-10 text-center text-[13px] text-gray-400">
                  Aucun participant — envoie des invitations depuis la page Invitations
                </div>
              ) : (
                displayed.map((p, i) => (
                  <div key={p.player_id}
                    className={`grid gap-4 px-4 py-3 items-center ${
                      isOwner ? 'grid-cols-[1fr_80px_100px_160px_32px]' : 'grid-cols-[1fr_80px_100px]'
                    } ${i < displayed.length - 1 ? 'border-b border-gray-100' : ''}`}>
                    <div className="text-[13px] font-medium text-gray-900">
                      {p.players.first_name} {p.players.surname}
                    </div>
                    <div className="text-[13px] text-gray-500">{p.players.whs ?? '—'}</div>
                    <div><Badge status={p.status} /></div>
                    {isOwner && (
                      <div className="flex justify-end gap-1">
                        {(['GOING', 'DECLINED', 'INVITED'] as const).map(s => (
                          <button key={s} type="button" onClick={() => updateStatus(p.player_id, s)}
                            className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors ${
                              p.status === s
                                ? s === 'GOING'    ? 'bg-[#EAF3DE] border-[#C0DD97] text-[#3B6D11]'
                                : s === 'DECLINED' ? 'bg-[#FCEBEB] border-[#F7C1C1] text-[#A32D2D]'
                                :                   'bg-[#EEEDFE] border-[#CECBF6] text-[#3C3489]'
                                : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                            }`}>
                            {s === 'GOING' ? 'Yes' : s === 'DECLINED' ? 'No' : 'Reset'}
                          </button>
                        ))}
                      </div>
                    )}
                    {isOwner && (
                      <button type="button" onClick={() => removeParticipant(p.player_id)}
                        className="text-gray-300 hover:text-red-400 transition-colors text-[18px] leading-none text-center">
                        ×
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* ── VUE D'ENSEMBLE ─────────────────────────────────────────────────── */}
      {viewMode === 'overview' && isOwner && (
        <>
          {overviewLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="text-center py-12 text-[13px] text-gray-400 border border-dashed border-gray-200 rounded-lg">
              Aucun événement à venir
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-[12px] font-medium text-gray-500 sticky left-0 bg-gray-50 min-w-[160px]">
                      Membre
                    </th>
                    {upcomingEvents.map(e => (
                      <th key={e.id} className="px-3 py-3 text-center font-medium text-gray-500 min-w-[100px]">
                        <div className="text-[11px] text-gray-700 font-medium truncate max-w-[90px]">{e.title}</div>
                        <div className="text-[10px] text-gray-400 font-normal">{formatDateShort(e.starts_at)}</div>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center font-medium text-gray-400 min-w-[60px]">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {allMembers.map((member, i) => {
                    const memberStatuses = statusMatrix[member.id] ?? {}
                    const goingCount = Object.values(memberStatuses).filter(s => s === 'GOING').length
                    return (
                      <tr key={member.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                        <td className="px-4 py-3 font-medium text-gray-900 sticky left-0 bg-inherit">
                          {member.first_name} {member.surname}
                        </td>
                        {upcomingEvents.map(e => {
                          const status = memberStatuses[e.id]
                          const icon = status ? STATUS_ICON[status] : null
                          return (
                            <td key={e.id} className="px-3 py-3 text-center">
                              {icon ? (
                                <span className="text-[14px] font-bold" style={{ color: icon.color }}>
                                  {icon.icon}
                                </span>
                              ) : (
                                <span className="text-gray-200 text-[14px]">—</span>
                              )}
                            </td>
                          )
                        })}
                        <td className="px-3 py-3 text-center">
                          <span className={`text-[12px] font-medium ${goingCount > 0 ? 'text-[#3B6D11]' : 'text-gray-300'}`}>
                            {goingCount}/{upcomingEvents.length}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* Ligne totaux */}
                <tfoot>
                  <tr className="bg-gray-100 border-t border-gray-200">
                    <td className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 sticky left-0 bg-gray-100">
                      Going
                    </td>
                    {upcomingEvents.map(e => {
                      const count = allMembers.filter(m =>
                        statusMatrix[m.id]?.[e.id] === 'GOING'
                      ).length
                      return (
                        <td key={e.id} className="px-3 py-2.5 text-center">
                          <span className="text-[12px] font-semibold text-[#3B6D11]">{count}</span>
                        </td>
                      )
                    })}
                    <td />
                  </tr>
                </tfoot>
              </table>

              {/* Légende */}
              <div className="flex gap-4 mt-3 px-1">
                {Object.entries(STATUS_ICON).map(([status, { icon, color }]) => (
                  <div key={status} className="flex items-center gap-1">
                    <span className="text-[13px] font-bold" style={{ color }}>{icon}</span>
                    <span className="text-[11px] text-gray-400">{STATUS_STYLE[status]?.label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <span className="text-[13px] text-gray-200">—</span>
                  <span className="text-[11px] text-gray-400">non invité</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  )
}

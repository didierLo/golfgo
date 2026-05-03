'use client'

import { useEffect, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const supabase = createClient()

type Invitation = {
  id: string; player_id: string; status: 'INVITED' | 'GOING' | 'DECLINED'; invited_at: string | null
  event_id: string; players: { first_name: string; surname: string; email: string | null }
}
type Event  = { id: string; title: string; starts_at: string }
type Member = { id: string; first_name: string; surname: string; email: string | null }
type SortKey = 'first_name' | 'surname'

const STATUS_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  INVITED:  { label: 'invited',  bg: '#EBF3FC', text: '#0C447C' },
  GOING:    { label: 'going',    bg: '#EAF3DE', text: '#3B6D11' },
  DECLINED: { label: 'declined', bg: '#FCEBEB', text: '#A32D2D' },
}

function Badge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { label: status.toLowerCase(), bg: '#F1F5F9', text: '#64748B' }
  return <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.text }}>{s.label}</span>
}
function formatDate(d: string) { return new Date(d).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' }) }
function formatDateLong(d: string) { return new Date(d).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }
function sortByKey<T extends { first_name: string; surname: string }>(arr: T[], key: SortKey): T[] {
  return [...arr].sort((a, b) => a[key].localeCompare(b[key], 'fr', { sensitivity: 'base' }))
}

function MemberSearchView({
  invitations, eventsMap, members, isOwner, onCancel, cancelling,
}: {
  invitations: Invitation[]; eventsMap: Record<string, Event>; members: Member[]
  isOwner: boolean; onCancel: (ids: string[]) => Promise<void>; cancelling: boolean
}) {
  const [query, setQuery] = useState('')
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [open, setOpen] = useState(false)

  const suggestions = query.trim().length === 0 ? [] : members.filter(m => {
    const full = `${m.first_name} ${m.surname} ${m.surname} ${m.first_name}`.toLowerCase()
    return full.includes(query.toLowerCase())
  }).slice(0, 6)

  function selectMember(m: Member) { setSelectedMember(m); setQuery(`${m.first_name} ${m.surname}`); setOpen(false) }
  function clear() { setSelectedMember(null); setQuery(''); setOpen(false) }

  const memberInvitations = selectedMember
    ? invitations.filter(i => i.player_id === selectedMember.id)
        .sort((a, b) => new Date(eventsMap[b.event_id]?.starts_at ?? 0).getTime() - new Date(eventsMap[a.event_id]?.starts_at ?? 0).getTime())
    : []

  return (
    <div>
      <div className="relative mb-4">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/60 shadow-sm"
          style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input type="text" value={query}
            onChange={e => { setQuery(e.target.value); setSelectedMember(null); setOpen(true) }}
            onFocus={() => { if (query && !selectedMember) setOpen(true) }}
            placeholder="Rechercher un membre…"
            className="flex-1 bg-transparent text-[13px] text-slate-900 placeholder-slate-400 outline-none" />
          {query && (
            <button onClick={clear} className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {open && suggestions.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-xl border border-white/60 shadow-lg overflow-hidden"
            style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
            {suggestions.map((m, i) => (
              <button key={m.id} onClick={() => selectMember(m)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#EBF3FC]/60 transition-colors text-left ${i < suggestions.length - 1 ? 'border-b border-slate-100' : ''}`}>
                <div className="w-7 h-7 rounded-full bg-[#EBF3FC] flex items-center justify-center text-[10px] font-bold text-[#0C447C] flex-shrink-0">
                  {m.first_name[0]}{m.surname[0]}
                </div>
                <span className="text-[13px] text-slate-800">
                  <span className="font-normal text-slate-400">{m.first_name} </span>
                  <span className="font-semibold">{m.surname}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedMember && (
        <div className="rounded-xl border border-white/60 shadow-sm overflow-hidden"
          style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          <div className="flex items-center gap-3 px-4 py-3 bg-[#EBF3FC]/60 border-b border-white/40">
            <div className="w-8 h-8 rounded-full bg-[#185FA5] flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
              {selectedMember.first_name[0]}{selectedMember.surname[0]}
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-slate-900">{selectedMember.first_name} {selectedMember.surname}</p>
              <p className="text-[11px] text-slate-500">
                {memberInvitations.length === 0 ? 'Aucune participation' : `${memberInvitations.length} event${memberInvitations.length > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          {memberInvitations.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-slate-400">Aucune invitation trouvée pour ce membre</div>
          ) : (
            memberInvitations.map((inv, i) => {
              const evt = eventsMap[inv.event_id]
              const isInvited = inv.status === 'INVITED'
              return (
                <div key={inv.id} className={`flex items-center gap-3 px-4 py-3 ${i < memberInvitations.length - 1 ? 'border-b border-white/30' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 truncate">{evt?.title ?? '—'}</p>
                    {evt && <p className="text-[11px] text-slate-500">{formatDateLong(evt.starts_at)}</p>}
                  </div>
                  <Badge status={inv.status} />
                  {isInvited && isOwner && (
                    <button disabled={cancelling}
                      onClick={async () => { if (!confirm('Annuler cette invitation ?')) return; await onCancel([inv.id]) }}
                      className="ml-1 text-[11px] font-semibold text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors px-2 py-1 rounded-lg hover:bg-red-50">
                      Annuler
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {!selectedMember && !query && (
        <div className="text-center py-10 text-[13px] text-slate-400 border border-dashed border-slate-200 rounded-xl">
          Tape le nom d'un membre pour voir ses participations
        </div>
      )}
    </div>
  )
}

export default function InvitationsPage() {
  const params   = useParams()
  const groupId  = params.id as string
  const pathname = usePathname()

  const [invitations, setInvitations]           = useState<Invitation[]>([])
  const [eventsMap, setEventsMap]               = useState<Record<string, Event>>({})
  const [events, setEvents]                     = useState<Event[]>([])
  const [members, setMembers]                   = useState<Member[]>([])
  const [loading, setLoading]                   = useState(true)
  const [sending, setSending]                   = useState(false)
  const [resending, setResending]               = useState(false)
  const [isOwner, setIsOwner]                   = useState(false)
  const [selectedEvent, setSelectedEvent]       = useState('')
  const [selectedPlayers, setSelectedPlayers]   = useState<string[]>([])
  const [sendEmail, setSendEmail]               = useState(false)
  // 9T par joueur : Record<playerId, 9 | 18>
  const [holesMap, setHolesMap]                 = useState<Record<string, 9 | 18>>({})
  const [resendMode, setResendMode]             = useState(false)
  const [resendParticipants, setResendParticipants] = useState<Invitation[]>([])
  const [eventFilter, setEventFilter]           = useState<string>('ALL')
  const [selectedToCancel, setSelectedToCancel] = useState<string[]>([])
  const [cancelling, setCancelling]             = useState(false)
  const [sortKey, setSortKey]                   = useState<SortKey>('surname')
  const [adminToast, setAdminToast]             = useState<string | null>(null)

  function showAdminToast() {
    setAdminToast('Tu dois être Admin pour utiliser cette fonction')
    setTimeout(() => setAdminToast(null), 3000)
  }

  useEffect(() => { if (groupId) loadData() }, [groupId, pathname])
  useEffect(() => {
    const handleFocus = () => loadData()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [groupId])

  useEffect(() => {
    if (!resendMode || !selectedEvent) { setResendParticipants([]); return }
    supabase.from('event_participants')
      .select('id, player_id, status, event_id, players(first_name, surname, email)')
      .eq('event_id', selectedEvent)
      .then(({ data }) => { setResendParticipants((data || []) as any); setSelectedPlayers([]) })
  }, [resendMode, selectedEvent])

  // Reset holesMap quand on change d'event ou de mode email
  useEffect(() => { setHolesMap({}) }, [selectedEvent, sendEmail, resendMode])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: player } = await supabase.from('players').select('id').eq('user_id', user.id).single()
      if (player) {
        const { data: gp } = await supabase.from('groups_players').select('role')
          .eq('group_id', groupId).eq('player_id', player.id).single()
        setIsOwner(gp?.role === 'owner')
      }
    }

    const { data: evts } = await supabase.from('events').select('id, title, starts_at')
      .eq('group_id', groupId).order('starts_at', { ascending: true })
    const allEvents = evts || []
    const upcomingEvents = allEvents.filter(e => new Date(e.starts_at) >= new Date())
    setEvents(upcomingEvents)
    const map: Record<string, Event> = {}
    allEvents.forEach(e => { map[e.id] = e })
    setEventsMap(map)
    if (upcomingEvents.length > 0) setSelectedEvent(upcomingEvents[0].id)

    if (allEvents.length > 0) {
      const { data: inv } = await supabase.from('event_participants')
        .select('id, player_id, status, invited_at, event_id, players(first_name, surname, email)')
        .in('event_id', allEvents.map(e => e.id)).order('invited_at', { ascending: false })
      setInvitations((inv || []) as any)
    } else { setInvitations([]) }

    const { data: mbrs } = await supabase.from('groups_players')
      .select(`player:players(id, first_name, surname, email)`).eq('group_id', groupId)
    setMembers((mbrs || []).map((m: any) => m.player))
    setSelectedToCancel([])
    setLoading(false)
  }

  function toggleHoles(playerId: string) {
    setHolesMap(prev => ({ ...prev, [playerId]: prev[playerId] === 9 ? 18 : 9 }))
  }

  async function handleSend() {
    if (!isOwner) { showAdminToast(); return }
    if (!selectedEvent || selectedPlayers.length === 0) { toast('Sélectionne un event et au moins un joueur'); return }
    setSending(true)
    try {
      const { data: existing } = await supabase.from('event_participants').select('player_id')
        .eq('event_id', selectedEvent).in('player_id', selectedPlayers)
      const alreadyInvited = (existing || []).map(e => e.player_id)
      const toInvite = selectedPlayers.filter(id => !alreadyInvited.includes(id))
      if (alreadyInvited.length > 0) {
        const names = members.filter(m => alreadyInvited.includes(m.id)).map(m => `${m.first_name} ${m.surname}`).join(', ')
        toast(`Déjà invités — ignorés : ${names}`, { duration: 4000 })
      }
      if (toInvite.length === 0) { toast.error('Tous les joueurs sélectionnés sont déjà invités'); setSending(false); return }

      const rows = toInvite.map(playerId => ({
        event_id: selectedEvent,
        player_id: playerId,
        status: 'INVITED',
        invited_at: new Date().toISOString(),
        registration_source: sendEmail ? 'email' : 'manual',
        invite_token: crypto.randomUUID(),
        // 9T seulement si toggle activé pour ce joueur (et mode sans email)
        holes_played: (!sendEmail && holesMap[playerId] === 9) ? 9 : null,
      }))

      const { error: insertError } = await supabase.from('event_participants').insert(rows)
      if (insertError) throw new Error(insertError.message)

      if (sendEmail) {
        const res = await fetch('/api/send-invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: selectedEvent, playerIds: toInvite }) })
        if (!res.ok) throw new Error('Erreur envoi email')
        toast.success(`${toInvite.length} invitation(s) envoyée(s) par email`)
      } else {
        const nb9T = toInvite.filter(id => holesMap[id] === 9).length
        toast.success(`${toInvite.length} joueur(s) ajouté(s)${nb9T > 0 ? ` dont ${nb9T} en 9T` : ''}`)
      }
      setSelectedPlayers([])
      setHolesMap({})
      window.location.href = `/groups/${groupId}/events`
    } catch (e: any) { toast.error(e.message ?? 'Erreur') }
    finally { setSending(false) }
  }

  async function handleResend() {
    if (!isOwner) { showAdminToast(); return }
    if (!selectedEvent || selectedPlayers.length === 0) return
    setResending(true)
    try {
      const { error: upsertErr } = await supabase.from('event_participants').upsert(
        selectedPlayers.map(playerId => ({ event_id: selectedEvent, player_id: playerId, status: 'INVITED', invited_at: new Date().toISOString(), registration_source: 'email' })),
        { onConflict: 'event_id,player_id' }
      )
      if (upsertErr) throw new Error(upsertErr.message)
      const res = await fetch('/api/send-invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: selectedEvent, playerIds: selectedPlayers }) })
      if (!res.ok) throw new Error('Erreur envoi email')
      toast.success(`${selectedPlayers.length} invitation(s) renvoyée(s)`)
      setSelectedPlayers([])
      setResendMode(false)
      loadData()
    } catch (e: any) { toast.error(e.message ?? 'Erreur') }
    finally { setResending(false) }
  }

  async function handleCancelSelected() {
    if (!isOwner) { showAdminToast(); return }
    if (selectedToCancel.length === 0) return
    if (!confirm(`Annuler ${selectedToCancel.length} invitation(s) ?`)) return
    setCancelling(true)
    const { error } = await supabase.from('event_participants').delete().in('id', selectedToCancel)
    if (error) { toast.error(error.message) } else { toast.success(`${selectedToCancel.length} invitation(s) annulée(s)`); loadData() }
    setCancelling(false)
  }

  async function handleCancelIds(ids: string[]) {
    if (!isOwner) { showAdminToast(); return }
    setCancelling(true)
    const { error } = await supabase.from('event_participants').delete().in('id', ids)
    if (error) { toast.error(error.message) } else { toast.success(`${ids.length} invitation(s) annulée(s)`); loadData() }
    setCancelling(false)
  }

  function toggleCancel(id: string) { setSelectedToCancel(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]) }
  function toggleCancelAll() {
    const cancellable = filteredInvited.map(i => i.id)
    setSelectedToCancel(selectedToCancel.length === cancellable.length ? [] : cancellable)
  }
  function togglePlayer(id: string) {
    if (!isOwner) { showAdminToast(); return }
    setSelectedPlayers(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }
  function switchMode(mode: 'invite' | 'resend') {
    if (!isOwner) { showAdminToast(); return }
    setResendMode(mode === 'resend'); setSelectedPlayers([])
  }

  const filtered        = invitations.filter(i => eventFilter === 'ALL' || i.event_id === eventFilter)
  const filteredInvited = filtered.filter(i => i.status === 'INVITED')
  const allCancelSelected = filteredInvited.length > 0 && selectedToCancel.length === filteredInvited.length
  const invitedCount  = filtered.filter(i => i.status === 'INVITED').length
  const goingCount    = filtered.filter(i => i.status === 'GOING').length
  const declinedCount = filtered.filter(i => i.status === 'DECLINED').length
  const displayedEvent = eventFilter !== 'ALL' ? eventsMap[eventFilter] : null

  const sortedMembers = sortByKey(members, sortKey)
  const sortedFiltered = [...filtered].sort((a, b) =>
    (a.players?.[sortKey] ?? '').localeCompare(b.players?.[sortKey] ?? '', 'fr', { sensitivity: 'base' })
  )
  const sortedResendParticipants = [...resendParticipants].sort((a, b) =>
    (a.players?.[sortKey] ?? '').localeCompare(b.players?.[sortKey] ?? '', 'fr', { sensitivity: 'base' })
  )

  if (loading) return (
    <div className="p-6 space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-12 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-2xl">

      {adminToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-[13px] font-medium px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#EF9F27" strokeWidth="1.5"/>
            <path d="M8 5v3.5M8 11h.01" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {adminToast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Invitations</h1>
          <p className="text-[13px] text-slate-600 mt-0.5">
            {invitations.filter(i => i.status === 'INVITED').length} invited · {invitations.filter(i => i.status === 'GOING').length} going
          </p>
        </div>
      </div>

      {/* Formulaire */}
      <div className={`rounded-xl border border-white/60 shadow-sm p-5 mb-6 ${!isOwner ? 'opacity-60' : ''}`}
        style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>

        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5">
          <button type="button" onClick={() => switchMode('invite')}
            className={`flex-1 text-[12px] font-semibold py-1.5 rounded-lg transition-colors ${!resendMode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${!isOwner ? 'cursor-not-allowed' : ''}`}>
            Nouvelles invitations
          </button>
          <button type="button" onClick={() => switchMode('resend')}
            className={`flex-1 text-[12px] font-semibold py-1.5 rounded-lg transition-colors ${resendMode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${!isOwner ? 'cursor-not-allowed' : ''}`}>
            Renvoyer
          </button>
        </div>

        {resendMode && (
          <div className="mb-4 px-3.5 py-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-[12px] text-amber-700 leading-relaxed">
              Le statut des joueurs sélectionnés sera remis à <strong>invited</strong> et un nouvel email leur sera envoyé.
            </p>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Événement</label>
          {resendMode ? (
            <select value={selectedEvent} onChange={e => isOwner ? setSelectedEvent(e.target.value) : showAdminToast()}
              disabled={!isOwner}
              className="w-full border border-white/50 rounded-xl px-3 py-2.5 text-[13px] bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 disabled:cursor-not-allowed">
              <option value="">— choisir un événement —</option>
              {Object.values(eventsMap).sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
                .map(e => <option key={e.id} value={e.id}>{e.title} — {formatDate(e.starts_at)}</option>)}
            </select>
          ) : (
            events.length === 0 ? (
              <p className="text-[12px] text-slate-500">Aucun événement à venir</p>
            ) : (
              <select value={selectedEvent} onChange={e => isOwner ? setSelectedEvent(e.target.value) : showAdminToast()}
                disabled={!isOwner}
                className="w-full border border-white/50 rounded-xl px-3 py-2.5 text-[13px] bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 disabled:cursor-not-allowed">
                {events.map(e => <option key={e.id} value={e.id}>{e.title} — {formatDate(e.starts_at)}</option>)}
              </select>
            )
          )}
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <label className="text-[12px] font-semibold text-slate-600">
                {resendMode ? 'Participants' : 'Joueurs'} ({selectedPlayers.length} sélectionnés)
              </label>
              {!resendMode && (
                <div className="flex gap-1">
                  <button type="button" onClick={() => setSortKey('first_name')}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${sortKey === 'first_name' ? 'bg-[#185FA5] text-white' : 'bg-white/60 text-slate-500 hover:bg-white/80'}`}>
                    Prénom
                  </button>
                  <button type="button" onClick={() => setSortKey('surname')}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${sortKey === 'surname' ? 'bg-[#185FA5] text-white' : 'bg-white/60 text-slate-500 hover:bg-white/80'}`}>
                    Nom
                  </button>
                </div>
              )}
            </div>
            <button type="button"
              onClick={() => {
                if (!isOwner) { showAdminToast(); return }
                if (resendMode) {
                  setSelectedPlayers(sortedResendParticipants.filter(p => p.players?.email).map(p => p.player_id))
                } else {
                  setSelectedPlayers(members.map(m => m.id))
                }
              }}
              className={`text-[11px] font-semibold text-[#185FA5] hover:underline ${!isOwner ? 'cursor-not-allowed opacity-50' : ''}`}>
              Tout sélectionner
            </button>
          </div>

          {resendMode ? (
            !selectedEvent ? (
              <p className="text-[12px] text-slate-400 px-1">Sélectionne d'abord un événement</p>
            ) : sortedResendParticipants.length === 0 ? (
              <p className="text-[12px] text-slate-400 px-1">Aucun participant pour cet événement</p>
            ) : (
              <div className="border border-white/50 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {sortedResendParticipants.map((p, i) => (
                  <label key={p.player_id}
                    className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${i < sortedResendParticipants.length - 1 ? 'border-b border-white/30' : ''} ${!p.players?.email || !isOwner ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-white/30'}`}>
                    <input type="checkbox" disabled={!p.players?.email || !isOwner}
                      checked={selectedPlayers.includes(p.player_id)} onChange={() => togglePlayer(p.player_id)}
                      className="rounded accent-[#185FA5]" />
                    <div className="w-7 h-7 rounded-full bg-[#EBF3FC] flex items-center justify-center text-[10px] font-bold text-[#0C447C] flex-shrink-0">
                      {p.players?.first_name[0]}{p.players?.surname[0]}
                    </div>
                    <span className="text-[13px] font-medium text-slate-800 flex-1">{p.players?.first_name} {p.players?.surname}</span>
                    <Badge status={p.status} />
                    {!p.players?.email && <span className="text-[11px] text-amber-500 font-medium">pas d'email</span>}
                  </label>
                ))}
              </div>
            )
          ) : (
            <div className="border border-white/50 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              {sortedMembers.map((m, i) => {
                const isSelected = selectedPlayers.includes(m.id)
                const holes = holesMap[m.id] ?? 18
                return (
                  <div key={m.id}
                    className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${i < sortedMembers.length - 1 ? 'border-b border-white/30' : ''} ${!isOwner ? 'cursor-not-allowed' : 'hover:bg-white/30'}`}>
                    <input type="checkbox" disabled={!isOwner}
                      checked={isSelected} onChange={() => togglePlayer(m.id)}
                      className="rounded accent-[#185FA5]" />
                    <div className="w-7 h-7 rounded-full bg-[#EBF3FC] flex items-center justify-center text-[10px] font-bold text-[#0C447C]">
                      {m.first_name[0]}{m.surname[0]}
                    </div>
                    <span className="text-[13px] font-medium text-slate-800 flex-1">
                      {sortKey === 'first_name'
                        ? <>{m.first_name} <span className="font-normal text-slate-500">{m.surname}</span></>
                        : <><span className="font-normal text-slate-500">{m.first_name}</span> {m.surname}</>}
                    </span>
                    {/* Toggle 9T — visible uniquement si sélectionné ET mode sans email */}
                    {isSelected && !sendEmail && (
                      <button
                        type="button"
                        onClick={() => toggleHoles(m.id)}
                        className={`text-[11px] font-bold px-2 py-1 rounded-lg border transition-colors flex-shrink-0 ${
                          holes === 9
                            ? 'bg-amber-50 border-amber-300 text-amber-700'
                            : 'bg-white/60 border-slate-200 text-slate-400 hover:border-amber-300 hover:text-amber-600'
                        }`}>
                        {holes === 9 ? '9T' : '18T'}
                      </button>
                    )}
                    {(!isSelected || sendEmail) && (
                      m.email
                        ? <span className="text-[11px] text-slate-400 truncate max-w-[140px]">{m.email}</span>
                        : <span className="text-[11px] text-amber-500 font-medium">pas d'email</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {!resendMode && (
          <div className="flex items-start gap-3 mb-4 p-3.5 bg-white/30 rounded-xl border border-white/50">
            <button type="button" onClick={() => { if (!isOwner) { showAdminToast(); return }; setSendEmail(v => !v) }}
              style={{ backgroundColor: sendEmail ? '#185FA5' : '#CBD5E1', transition: 'background-color 0.2s' }}
              className={`mt-0.5 w-9 h-5 rounded-full flex items-center px-0.5 flex-shrink-0 ${!isOwner ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
              <div style={{ transform: sendEmail ? 'translateX(16px)' : 'translateX(0)', transition: 'transform 0.2s' }}
                className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </button>
            <div>
              <p className="text-[13px] font-semibold text-slate-800">Envoyer un email d'invitation</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {sendEmail
                  ? 'Les joueurs recevront un email avec un lien pour répondre'
                  : 'Les joueurs sont enregistrés sans notification — le toggle 9T/18T est disponible par joueur'}
              </p>
            </div>
          </div>
        )}

        {resendMode ? (
          <button onClick={handleResend} disabled={resending || selectedPlayers.length === 0 || !selectedEvent || !isOwner}
            className={`text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-40 ${isOwner ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-300 cursor-not-allowed'}`}>
            {resending ? 'Envoi…' : `Renvoyer${selectedPlayers.length > 0 ? ` (${selectedPlayers.length})` : ''}`}
          </button>
        ) : (
          <button onClick={handleSend} disabled={sending || selectedPlayers.length === 0 || !selectedEvent || !isOwner}
            className={`text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-40 ${isOwner ? 'bg-[#185FA5] hover:bg-[#0C447C]' : 'bg-slate-300 cursor-not-allowed'}`}>
            {sending ? 'En cours…' : sendEmail
              ? `Envoyer${selectedPlayers.length > 0 ? ` (${selectedPlayers.length})` : ''}`
              : `Enregistrer sans email${selectedPlayers.length > 0 ? ` (${selectedPlayers.length})` : ''}`}
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <select value={eventFilter} onChange={e => { setEventFilter(e.target.value); setSelectedToCancel([]) }}
          className="text-[12px] border border-white/50 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-[#185FA5]">
          <option value="ALL">Tous les events</option>
          {Object.values(eventsMap).sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
            .map(e => <option key={e.id} value={e.id}>{e.title} — {formatDate(e.starts_at)}</option>)}
        </select>
        <div className="flex items-center gap-2">
          {eventFilter !== 'ALL' && (
            <a href={`/groups/${groupId}/events/${eventFilter}/participants`}
              className="text-[12px] font-semibold text-[#185FA5] hover:underline whitespace-nowrap">
              Voir les participants →
            </a>
          )}
          {selectedToCancel.length > 0 && isOwner && eventFilter !== 'ALL' && (
            <button onClick={handleCancelSelected} disabled={cancelling}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-xl border border-red-200 text-red-500 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors">
              {cancelling ? 'Annulation…' : `Annuler (${selectedToCancel.length})`}
            </button>
          )}
        </div>
      </div>

      {displayedEvent && (
        <div className="mb-3 px-4 py-3 rounded-xl border border-white/60 shadow-sm flex items-center justify-between"
          style={{ background: "rgba(255,255,255,0.60)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          <div>
            <p className="text-[13px] font-bold text-slate-900">{displayedEvent.title}</p>
            <p className="text-[11px] text-slate-500">{formatDateLong(displayedEvent.starts_at)}</p>
          </div>
          <div className="flex gap-3 text-[11px] font-semibold">
            <span style={{ color: '#0C447C' }}>{invitedCount} invited</span>
            <span style={{ color: '#3B6D11' }}>{goingCount} going</span>
            {declinedCount > 0 && <span style={{ color: '#A32D2D' }}>{declinedCount} declined</span>}
          </div>
        </div>
      )}

      {eventFilter === 'ALL' ? (
        <MemberSearchView
          invitations={invitations} eventsMap={eventsMap} members={members}
          isOwner={isOwner} onCancel={handleCancelIds} cancelling={cancelling}
        />
      ) : (
        sortedFiltered.length === 0 ? (
          <div className="text-center py-12 text-[13px] text-slate-500 border border-dashed border-slate-200 rounded-xl">
            Aucune invitation pour cet événement
          </div>
        ) : (
          <div className="rounded-xl border border-white/60 shadow-sm overflow-hidden"
            style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
            <div className="flex items-center gap-3 px-4 py-2.5 bg-white/30 border-b border-white/40">
              {filteredInvited.length > 0 && isOwner && (
                <input type="checkbox" checked={allCancelSelected} onChange={toggleCancelAll} className="rounded accent-[#185FA5]" />
              )}
              <span className="text-[11px] font-semibold text-slate-500 flex-1">
                {selectedToCancel.length > 0 ? `${selectedToCancel.length} sélectionnée(s)` : 'Participant'}
              </span>
              <div className="flex gap-1">
                <button onClick={() => setSortKey('first_name')}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${sortKey === 'first_name' ? 'bg-[#185FA5] text-white' : 'bg-white/60 text-slate-500 hover:bg-white/80'}`}>
                  Prénom
                </button>
                <button onClick={() => setSortKey('surname')}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${sortKey === 'surname' ? 'bg-[#185FA5] text-white' : 'bg-white/60 text-slate-500 hover:bg-white/80'}`}>
                  Nom
                </button>
              </div>
            </div>
            {sortedFiltered.map((inv, i) => {
              const isInvited = inv.status === 'INVITED'
              return (
                <div key={inv.id} className={`flex items-center gap-3 px-4 py-3 ${selectedToCancel.includes(inv.id) ? 'bg-red-50/50' : ''} ${i < sortedFiltered.length - 1 ? 'border-b border-white/30' : ''}`}>
                  {isInvited && isOwner
                    ? <input type="checkbox" checked={selectedToCancel.includes(inv.id)} onChange={() => toggleCancel(inv.id)} className="rounded accent-[#185FA5] flex-shrink-0" />
                    : <div className="w-4 flex-shrink-0" />}
                  <div className="w-7 h-7 rounded-full bg-[#EBF3FC] flex items-center justify-center text-[11px] font-bold text-[#0C447C] flex-shrink-0">
                    {inv.players?.first_name[0]}{inv.players?.surname[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-slate-900">
                      {sortKey === 'first_name'
                        ? <>{inv.players?.first_name} <span className="font-normal text-slate-500">{inv.players?.surname}</span></>
                        : <><span className="font-normal text-slate-500">{inv.players?.first_name}</span> {inv.players?.surname}</>}
                    </div>
                    {inv.invited_at && <div className="text-[11px] text-slate-400">invité le {formatDate(inv.invited_at)}</div>}
                  </div>
                  <Badge status={inv.status} />
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}

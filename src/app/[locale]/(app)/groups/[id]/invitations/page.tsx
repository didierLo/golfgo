'use client'

import { useEffect, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import EmailPreviewModal from '@/components/email/EmailPreviewModal'
import { useTranslations, useLocale } from 'next-intl'

const supabase = createClient()

type Invitation = {
  id: string; player_id: string; status: 'INVITED' | 'GOING' | 'DECLINED'; invited_at: string | null
  event_id: string; players: { first_name: string; surname: string; email: string | null }
}
type Event  = { id: string; title: string; starts_at: string }
type Member = { id: string; first_name: string; surname: string; email: string | null }
type SortKey = 'first_name' | 'surname'
type HolesSection = 'out' | 'in' | null

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  INVITED:  { bg: '#EBF3FC', text: '#0C447C' },
  GOING:    { bg: '#EAF3DE', text: '#3B6D11' },
  DECLINED: { bg: '#FCEBEB', text: '#A32D2D' },
}

function Badge({ status }: { status: string }) {
  const t = useTranslations()
  const s = STATUS_STYLE[status] ?? { bg: '#F1F5F9', text: '#64748B' }
  return <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: s.bg, color: s.text }}>{t(`status.${status}` as any)}</span>
}

function sortByKey<T extends { first_name: string; surname: string }>(arr: T[], key: SortKey): T[] {
  return [...arr].sort((a, b) => a[key].localeCompare(b[key], undefined, { sensitivity: 'base' }))
}

function MemberSearchView({
  invitations, eventsMap, members, isOwner, onCancel, cancelling, locale,
}: {
  invitations: Invitation[]; eventsMap: Record<string, Event>; members: Member[]
  isOwner: boolean; onCancel: (ids: string[]) => Promise<void>; cancelling: boolean; locale: string
}) {
  const t = useTranslations()
  const [query, setQuery]                   = useState('')
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [open, setOpen]                     = useState(false)

  function formatDateLong(d: string) {
    return new Date(d).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

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
            placeholder={t('invitations.search')}
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
                {memberInvitations.length === 0
                  ? t('invitations.noParticipations')
                  : t('invitations.eventsCount', { count: memberInvitations.length })}
              </p>
            </div>
          </div>
          {memberInvitations.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-slate-400">{t('invitations.noParticipationsFound')}</div>
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
                      onClick={async () => { if (!confirm(t('invitations.cancelOneConfirm'))) return; await onCancel([inv.id]) }}
                      className="ml-1 text-[11px] font-semibold text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors px-2 py-1 rounded-lg hover:bg-red-50">
                      {t('invitations.cancelOne')}
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
          {t('invitations.typeToSearch')}
        </div>
      )}
    </div>
  )
}

export default function InvitationsPage() {
  const params   = useParams()
  const groupId  = params.id as string
  const pathname = usePathname()
  const t        = useTranslations()
  const locale   = useLocale()

  function formatDate(d: string) { return new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) }
  function formatDateLong(d: string) { return new Date(d).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }

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
  const [holesMap, setHolesMap]                 = useState<Record<string, { holes: 9 | 18; section: HolesSection }>>({})
  const [resendMode, setResendMode]             = useState(false)
  const [resendParticipants, setResendParticipants] = useState<Invitation[]>([])
  const [eventFilter, setEventFilter]           = useState<string>('ALL')
  const [selectedToCancel, setSelectedToCancel] = useState<string[]>([])
  const [cancelling, setCancelling]             = useState(false)
  const [sortKey, setSortKey]                   = useState<SortKey>('surname')
  const [adminToast, setAdminToast]             = useState<string | null>(null)
  const [showPreview, setShowPreview]           = useState(false)

  function showAdminToast() {
    setAdminToast(t('invitations.adminOnly'))
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
    setHolesMap(prev => {
      const cur = prev[playerId]
      if (!cur || cur.holes === 18) return { ...prev, [playerId]: { holes: 9, section: 'out' } }
      if (cur.section === 'out') return { ...prev, [playerId]: { holes: 9, section: 'in' } }
      return { ...prev, [playerId]: { holes: 18, section: null } }
    })
}

  async function handleSend() {
    if (!isOwner) { showAdminToast(); return }
    if (!selectedEvent || selectedPlayers.length === 0) { toast(t('invitations.send')); return }
    setSending(true)
    try {
      const { data: existing } = await supabase.from('event_participants').select('player_id')
        .eq('event_id', selectedEvent).in('player_id', selectedPlayers)
      const alreadyInvited = (existing || []).map(e => e.player_id)
      const toInvite = selectedPlayers.filter(id => !alreadyInvited.includes(id))
      if (alreadyInvited.length > 0) {
        const names = members.filter(m => alreadyInvited.includes(m.id)).map(m => `${m.first_name} ${m.surname}`).join(', ')
        toast(t('invitations.alreadyInvited', { names }), { duration: 4000 })
      }
      if (toInvite.length === 0) { toast.error(t('invitations.allAlreadyInvited')); setSending(false); return }

      const rows = toInvite.map(playerId => ({
        event_id: selectedEvent, player_id: playerId, status: 'INVITED',
        invited_at: new Date().toISOString(), registration_source: sendEmail ? 'email' : 'manual',
        invite_token: crypto.randomUUID(),
        holes_played: (!sendEmail && holesMap[playerId]?.holes === 9) ? 9 : 18,
        holes_section: (!sendEmail && holesMap[playerId]?.holes === 9) ? holesMap[playerId]?.section : null,
      }))

      const { error: insertError } = await supabase.from('event_participants').insert(rows)
      if (insertError) throw new Error(insertError.message)

      if (sendEmail) {
        const res = await fetch('/api/send-invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: selectedEvent, playerIds: toInvite }) })
        if (!res.ok) throw new Error(t('common.error'))
        toast.success(t('invitations.invitationsSent', { count: toInvite.length }))
      } else {
        const nb9T = toInvite.filter(id => holesMap[id]?.holes === 9).length
        toast.success(nb9T > 0 ? t('invitations.added9T', { count: toInvite.length, nb: nb9T }) : t('invitations.added', { count: toInvite.length }))
      }
      setSelectedPlayers([])
      setHolesMap({})
      window.location.href = `/groups/${groupId}/events`
    } catch (e: any) { toast.error(e.message ?? t('common.error')) }
    finally { setSending(false) }
  }

  async function handleResend() {
    if (!isOwner) { showAdminToast(); return }
    if (!selectedEvent || selectedPlayers.length === 0) return
    setResending(true)
    try {
      const { error: upsertErr } = await supabase.from('event_participants').upsert(
        selectedPlayers.map(playerId => ({ event_id: selectedEvent, player_id: playerId, status: 'INVITED', invited_at: new Date().toISOString(), registration_source: 'email', holes_played: 18 })),
        { onConflict: 'event_id,player_id' }
      )
      if (upsertErr) throw new Error(upsertErr.message)
      const res = await fetch('/api/send-invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: selectedEvent, playerIds: selectedPlayers }) })
      if (!res.ok) throw new Error(t('common.error'))
      toast.success(t('invitations.resendSuccess', { count: selectedPlayers.length }))
      setSelectedPlayers([])
      setResendMode(false)
      loadData()
    } catch (e: any) { toast.error(e.message ?? t('common.error')) }
    finally { setResending(false) }
  }

  async function handleCancelSelected() {
    if (!isOwner) { showAdminToast(); return }
    if (selectedToCancel.length === 0) return
    if (!confirm(t('invitations.cancelConfirm', { count: selectedToCancel.length }))) return
    setCancelling(true)
    const { error } = await supabase.from('event_participants').delete().in('id', selectedToCancel)
    if (error) { toast.error(error.message) } else { toast.success(t('invitations.cancelSuccess', { count: selectedToCancel.length })); loadData() }
    setCancelling(false)
  }

  async function handleCancelIds(ids: string[]) {
    if (!isOwner) { showAdminToast(); return }
    setCancelling(true)
    const { error } = await supabase.from('event_participants').delete().in('id', ids)
    if (error) { toast.error(error.message) } else { toast.success(t('invitations.cancelSuccess', { count: ids.length })); loadData() }
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
    (a.players?.[sortKey] ?? '').localeCompare(b.players?.[sortKey] ?? '', locale, { sensitivity: 'base' })
  )
  const sortedResendParticipants = [...resendParticipants].sort((a, b) =>
    (a.players?.[sortKey] ?? '').localeCompare(b.players?.[sortKey] ?? '', locale, { sensitivity: 'base' })
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

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">{t('invitations.title')}</h1>
          
        </div>
      </div>

      <div className={`rounded-xl border border-white/60 shadow-sm p-5 mb-6 ${!isOwner ? 'opacity-60' : ''}`}
        style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>

        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-5">
          <button type="button" onClick={() => switchMode('invite')}
            className={`flex-1 text-[12px] font-semibold py-1.5 rounded-lg transition-colors ${!resendMode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${!isOwner ? 'cursor-not-allowed' : ''}`}>
            {t('invitations.newInvitations')}
          </button>
          <button type="button" onClick={() => switchMode('resend')}
            className={`flex-1 text-[12px] font-semibold py-1.5 rounded-lg transition-colors ${resendMode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${!isOwner ? 'cursor-not-allowed' : ''}`}>
            {t('invitations.resend')}
          </button>
        </div>

        {resendMode && (
          <div className="mb-4 px-3.5 py-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-[12px] text-amber-700 leading-relaxed">{t('invitations.resendWarning')}</p>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('invitations.event')}</label>
          {resendMode ? (
            <select value={selectedEvent} onChange={e => isOwner ? setSelectedEvent(e.target.value) : showAdminToast()}
              disabled={!isOwner}
              className="w-full border border-white/50 rounded-xl px-3 py-2.5 text-[13px] bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 disabled:cursor-not-allowed">
              <option value="">{t('invitations.chooseEvent')}</option>
              {Object.values(eventsMap).sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
                .map(e => <option key={e.id} value={e.id}>{e.title} — {formatDate(e.starts_at)}</option>)}
            </select>
          ) : (
            events.length === 0 ? (
              <p className="text-[12px] text-slate-500">{t('invitations.noUpcomingEvents')}</p>
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
                {resendMode ? t('invitations.participants') : t('invitations.players')} ({t('invitations.selected', { count: selectedPlayers.length })})
              </label>
              {!resendMode && (
                <div className="flex gap-1">
                  <button type="button" onClick={() => setSortKey('first_name')}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${sortKey === 'first_name' ? 'bg-[#185FA5] text-white' : 'bg-white/60 text-slate-500 hover:bg-white/80'}`}>
                    {t('invitations.firstName')}
                  </button>
                  <button type="button" onClick={() => setSortKey('surname')}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${sortKey === 'surname' ? 'bg-[#185FA5] text-white' : 'bg-white/60 text-slate-500 hover:bg-white/80'}`}>
                    {t('invitations.lastName')}
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
              {t('invitations.selectAll')}
            </button>
          </div>

          {resendMode ? (
            !selectedEvent ? (
              <p className="text-[12px] text-slate-400 px-1">{t('invitations.chooseEvent')}</p>
            ) : sortedResendParticipants.length === 0 ? (
              <p className="text-[12px] text-slate-400 px-1">{t('invitations.noParticipants')}</p>
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
                    {!p.players?.email && <span className="text-[11px] text-amber-500 font-medium">{t('invitations.noEmail')}</span>}
                  </label>
                ))}
              </div>
            )
          ) : (
            <div className="border border-white/50 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              {sortedMembers.map((m, i) => {
                const isSelected = selectedPlayers.includes(m.id)
                const holesEntry = holesMap[m.id]
                const holesLabel = !holesEntry || holesEntry.holes === 18 ? '18H' : holesEntry.section === 'out' ? '9F' : '9B'
                const holesCls = !holesEntry || holesEntry.holes === 18
                      ? 'bg-white/60 border-slate-200 text-slate-400 hover:border-amber-300 hover:text-amber-600'
                      : holesEntry.section === 'out' ? 'bg-amber-50 border-amber-300 text-amber-700'
                      : 'bg-orange-50 border-orange-300 text-orange-700'

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
                    {isSelected && !sendEmail && (
                      <button type="button" onClick={() => toggleHoles(m.id)}
                      className={`text-[11px] font-bold px-2 py-1 rounded-lg border transition-colors flex-shrink-0 ${holesCls}`}>
                        {holesLabel}

                      </button>
                    )}
                    {(!isSelected || sendEmail) && (
                      m.email
                        ? <span className="text-[11px] text-slate-400 truncate max-w-[140px]">{m.email}</span>
                        : <span className="text-[11px] text-amber-500 font-medium">{t('invitations.noEmail')}</span>
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
              <p className="text-[13px] font-semibold text-slate-800">{t('invitations.sendEmail')}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {sendEmail ? t('invitations.sendEmailDesc') : t('invitations.noEmailDesc')}
              </p>
            </div>
          </div>
        )}

        {resendMode ? (
          <>
            <button onClick={() => setShowPreview(true)}
              disabled={selectedPlayers.length === 0 || !selectedEvent || !isOwner}
              className={`text-[13px] font-semibold px-5 py-2.5 rounded-xl border transition-colors disabled:opacity-40 mr-2 ${isOwner ? 'border-amber-400 text-amber-600 hover:bg-amber-50' : 'border-slate-200 text-slate-300 cursor-not-allowed'}`}>
              {t('invitations.preview')}
            </button>
            <button onClick={handleResend} disabled={resending || selectedPlayers.length === 0 || !selectedEvent || !isOwner}
              className={`text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-40 ${isOwner ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-300 cursor-not-allowed'}`}>
              {resending ? t('invitations.sending') : selectedPlayers.length > 0 ? t('invitations.resendCount', { count: selectedPlayers.length }) : t('invitations.resend')}
            </button>
          </>
        ) : (
          <div className="flex gap-2 items-center flex-wrap">
            {sendEmail && (
              <button onClick={() => setShowPreview(true)}
                disabled={selectedPlayers.length === 0 || !selectedEvent || !isOwner}
                className={`text-[13px] font-semibold px-5 py-2.5 rounded-xl border transition-colors disabled:opacity-40 ${isOwner ? 'border-[#185FA5] text-[#185FA5] hover:bg-blue-50' : 'border-slate-200 text-slate-300 cursor-not-allowed'}`}>
                {t('invitations.preview')}
              </button>
            )}
            <button onClick={handleSend} disabled={sending || selectedPlayers.length === 0 || !selectedEvent || !isOwner}
              className={`text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-40 ${isOwner ? 'bg-[#185FA5] hover:bg-[#0C447C]' : 'bg-slate-300 cursor-not-allowed'}`}>
              {sending ? t('invitations.sending') : sendEmail
                ? selectedPlayers.length > 0 ? t('invitations.sendCount', { count: selectedPlayers.length }) : t('invitations.send')
                : selectedPlayers.length > 0 ? t('invitations.saveNoEmailCount', { count: selectedPlayers.length }) : t('invitations.saveNoEmail')}
            </button>
          </div>
        )}

        {showPreview && (
          <EmailPreviewModal
            onClose={() => setShowPreview(false)}
            onConfirm={() => { setShowPreview(false); resendMode ? handleResend() : handleSend() }}
            confirmLabel={resendMode ? t('invitations.resendCount', { count: selectedPlayers.length }) : t('invitations.sendCount', { count: selectedPlayers.length })}
            loading={sending || resending}
            fetchPreview={() => fetch('/api/preview-email', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'invitation', eventId: selectedEvent }),
            }).then(r => r.json())}
          />
        )}
      </div>

      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <select value={eventFilter} onChange={e => { setEventFilter(e.target.value); setSelectedToCancel([]) }}
          className="text-[12px] border border-white/50 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-[#185FA5]">
          <option value="ALL">{t('invitations.allEvents')}</option>
          {Object.values(eventsMap).sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
            .map(e => <option key={e.id} value={e.id}>{e.title} — {formatDate(e.starts_at)}</option>)}
        </select>
        <div className="flex items-center gap-2">
          {eventFilter !== 'ALL' && (
            <a href={`/groups/${groupId}/events/${eventFilter}/participants`}
              className="text-[12px] font-semibold text-[#185FA5] hover:underline whitespace-nowrap">
              {t('invitations.viewParticipants')}
            </a>
          )}
          {selectedToCancel.length > 0 && isOwner && eventFilter !== 'ALL' && (
            <button onClick={handleCancelSelected} disabled={cancelling}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-xl border border-red-200 text-red-500 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors">
              {cancelling ? t('invitations.cancelled') : t('invitations.cancelSelected', { count: selectedToCancel.length })}
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
            <span style={{ color: '#0C447C' }}>{invitedCount} {t('status.INVITED')}</span>
            <span style={{ color: '#3B6D11' }}>{goingCount} {t('status.GOING')}</span>
            {declinedCount > 0 && <span style={{ color: '#A32D2D' }}>{declinedCount} {t('status.DECLINED')}</span>}
          </div>
        </div>
      )}

      {eventFilter === 'ALL' ? (
        <MemberSearchView
          invitations={invitations} eventsMap={eventsMap} members={members}
          isOwner={isOwner} onCancel={handleCancelIds} cancelling={cancelling} locale={locale}
        />
      ) : (
        sortedFiltered.length === 0 ? (
          <div className="text-center py-12 text-[13px] text-slate-500 border border-dashed border-slate-200 rounded-xl">
            {t('invitations.noInvitations')}
          </div>
        ) : (
          <div className="rounded-xl border border-white/60 shadow-sm overflow-hidden"
            style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
            <div className="flex items-center gap-3 px-4 py-2.5 bg-white/30 border-b border-white/40">
              {filteredInvited.length > 0 && isOwner && (
                <input type="checkbox" checked={allCancelSelected} onChange={toggleCancelAll} className="rounded accent-[#185FA5]" />
              )}
              <span className="text-[11px] font-semibold text-slate-500 flex-1">
                {selectedToCancel.length > 0 ? t('invitations.selected', { count: selectedToCancel.length }) : t('members.member')}
              </span>
              <div className="flex gap-1">
                <button onClick={() => setSortKey('first_name')}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${sortKey === 'first_name' ? 'bg-[#185FA5] text-white' : 'bg-white/60 text-slate-500 hover:bg-white/80'}`}>
                  {t('invitations.firstName')}
                </button>
                <button onClick={() => setSortKey('surname')}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${sortKey === 'surname' ? 'bg-[#185FA5] text-white' : 'bg-white/60 text-slate-500 hover:bg-white/80'}`}>
                  {t('invitations.lastName')}
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
                    {inv.invited_at && <div className="text-[11px] text-slate-400">{t('invitations.invited', { date: formatDate(inv.invited_at) })}</div>}
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

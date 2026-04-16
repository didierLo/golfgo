'use client'

import { useEffect, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const supabase = createClient()

type Invitation = {
  id: string; status: 'INVITED' | 'GOING' | 'DECLINED'; invited_at: string | null
  event_id: string; players: { first_name: string; surname: string; email: string | null }
}
type Event  = { id: string; title: string; starts_at: string }
type Member = { id: string; first_name: string; surname: string; email: string | null }

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
  const [isOwner, setIsOwner]                   = useState(false)
  const [selectedEvent, setSelectedEvent]       = useState('')
  const [selectedPlayers, setSelectedPlayers]   = useState<string[]>([])
  const [sendEmail, setSendEmail]               = useState(true)
  const [showForm, setShowForm]                 = useState(true)
  const [eventFilter, setEventFilter]           = useState<string>('ALL')
  const [selectedToCancel, setSelectedToCancel] = useState<string[]>([])
  const [cancelling, setCancelling]             = useState(false)

  useEffect(() => { if (groupId) loadData() }, [groupId, pathname])
  useEffect(() => {
    const handleFocus = () => loadData()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [groupId])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: gp } = await supabase.from('groups_players').select('role')
      .eq('group_id', groupId).eq('user_id', user?.id).single()
    setIsOwner(gp?.role === 'owner')

    const { data: evts } = await supabase.from('events').select('id, title, starts_at')
      .eq('group_id', groupId).order('starts_at', { ascending: false })
    const allEvents = evts || []
    const upcomingEvents = allEvents.filter(e => new Date(e.starts_at) >= new Date())
    setEvents(upcomingEvents)
    const map: Record<string, Event> = {}
    allEvents.forEach(e => { map[e.id] = e })
    setEventsMap(map)
    if (upcomingEvents.length > 0) setSelectedEvent(upcomingEvents[0].id)

    if (allEvents.length > 0) {
      const { data: inv } = await supabase.from('event_participants')
        .select('id, status, invited_at, event_id, players(first_name, surname, email)')
        .in('event_id', allEvents.map(e => e.id)).order('invited_at', { ascending: false })
      setInvitations((inv || []) as any)
    } else { setInvitations([]) }

    const { data: mbrs } = await supabase.from('groups_players')
      .select(`player:players(id, first_name, surname, email)`).eq('group_id', groupId)
    setMembers((mbrs || []).map((m: any) => m.player))
    setSelectedToCancel([])
    setLoading(false)
  }

  async function handleSend() {
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

      // Toujours insérer les participants — email optionnel
      const rows = toInvite.map(playerId => ({
        event_id: selectedEvent,
        player_id: playerId,
        status: 'INVITED',
        invited_at: new Date().toISOString(),
        registration_source: sendEmail ? 'email' : 'manual',
      }))
      const { error: insertError } = await supabase.from('event_participants').insert(rows)
      if (insertError) throw new Error(insertError.message)

      if (sendEmail) {
        const res = await fetch('/api/send-invitations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId: selectedEvent, playerIds: toInvite }),
        })
        if (!res.ok) throw new Error('Erreur envoi email')
        toast.success(`${toInvite.length} invitation(s) envoyée(s) par email`)
      } else {
        toast.success(`${toInvite.length} joueur(s) ajouté(s) sans email`)
      }
      setSelectedPlayers([])
      window.location.href = `/groups/${groupId}/events`
    } catch (e: any) {
      toast.error(e.message ?? 'Erreur')
    } finally { setSending(false) }
  }

  async function handleCancelSelected() {
    if (selectedToCancel.length === 0) return
    if (!confirm(`Annuler ${selectedToCancel.length} invitation(s) ?`)) return
    setCancelling(true)
    const { error } = await supabase.from('event_participants').delete().in('id', selectedToCancel)
    if (error) { toast.error(error.message) } else { toast.success(`${selectedToCancel.length} invitation(s) annulée(s)`); loadData() }
    setCancelling(false)
  }

  function toggleCancel(id: string) { setSelectedToCancel(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]) }
  function toggleCancelAll() {
    const cancellable = filteredInvited.map(i => i.id)
    setSelectedToCancel(selectedToCancel.length === cancellable.length ? [] : cancellable)
  }
  function togglePlayer(id: string) { setSelectedPlayers(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]) }

  const filtered        = invitations.filter(i => eventFilter === 'ALL' || i.event_id === eventFilter)
  const filteredInvited = filtered.filter(i => i.status === 'INVITED')
  const allCancelSelected = filteredInvited.length > 0 && selectedToCancel.length === filteredInvited.length
  const invitedCount  = filtered.filter(i => i.status === 'INVITED').length
  const goingCount    = filtered.filter(i => i.status === 'GOING').length
  const declinedCount = filtered.filter(i => i.status === 'DECLINED').length
  const displayedEvent = eventFilter !== 'ALL' ? eventsMap[eventFilter] : null

  if (loading) return (
    <div className="p-6 space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Invitations</h1>
          <p className="text-[13px] text-slate-600 mt-0.5">
            {invitations.filter(i => i.status === 'INVITED').length} invited · {invitations.filter(i => i.status === 'GOING').length} going
          </p>
        </div>
        {isOwner && (
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 bg-[#185FA5] text-white text-[13px] font-semibold px-4 py-2 rounded-xl hover:bg-[#0C447C] transition-colors">
            {showForm ? 'Fermer' : '+ Inviter'}
          </button>
        )}
      </div>

      {/* Formulaire */}
      {showForm && isOwner && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Envoyer des invitations</p>

          <div className="mb-4">
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Événement</label>
            {events.length === 0 ? (
              <p className="text-[12px] text-slate-500">Aucun événement à venir</p>
            ) : (
              <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30">
                {events.map(e => <option key={e.id} value={e.id}>{e.title} — {formatDate(e.starts_at)}</option>)}
              </select>
            )}
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] font-semibold text-slate-600">Joueurs ({selectedPlayers.length} sélectionnés)</label>
              <button type="button" onClick={() => setSelectedPlayers(members.map(m => m.id))}
                className="text-[11px] font-semibold text-[#185FA5] hover:underline">Tout sélectionner</button>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              {members.map((m, i) => (
                <label key={m.id} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors ${i < members.length - 1 ? 'border-b border-slate-100' : ''}`}>
                  <input type="checkbox" checked={selectedPlayers.includes(m.id)} onChange={() => togglePlayer(m.id)} className="rounded accent-[#185FA5]" />
                  <div className="w-7 h-7 rounded-full bg-[#EBF3FC] flex items-center justify-center text-[10px] font-bold text-[#0C447C]">
                    {m.first_name[0]}{m.surname[0]}
                  </div>
                  <span className="text-[13px] font-medium text-slate-800 flex-1">{m.first_name} {m.surname}</span>
                  {m.email
                    ? <span className="text-[11px] text-slate-400 truncate max-w-[140px]">{m.email}</span>
                    : <span className="text-[11px] text-amber-500 font-medium">pas d'email</span>}
                </label>
              ))}
            </div>
          </div>

          {/* Toggle email */}
          <div className="flex items-start gap-3 mb-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <button type="button" onClick={() => setSendEmail(v => !v)}
              style={{ backgroundColor: sendEmail ? '#185FA5' : '#CBD5E1', transition: 'background-color 0.2s' }}
              className="mt-0.5 w-9 h-5 rounded-full flex items-center px-0.5 flex-shrink-0 cursor-pointer">
              <div style={{ transform: sendEmail ? 'translateX(16px)' : 'translateX(0)', transition: 'transform 0.2s' }}
                className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </button>
            <div>
              <p className="text-[13px] font-semibold text-slate-800">Envoyer un email d'invitation</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {sendEmail ? 'Les joueurs recevront un email avec un lien pour répondre' : 'Les joueurs sont enregistrés sans notification email'}
              </p>
            </div>
          </div>

          <button onClick={handleSend} disabled={sending || selectedPlayers.length === 0 || !selectedEvent}
            className="bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-40 transition-colors">
            {sending ? 'En cours…' : sendEmail
              ? `Envoyer${selectedPlayers.length > 0 ? ` (${selectedPlayers.length})` : ''}`
              : `Enregistrer sans email${selectedPlayers.length > 0 ? ` (${selectedPlayers.length})` : ''}`}
          </button>
        </div>
      )}

      {/* Filtres */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <select value={eventFilter} onChange={e => { setEventFilter(e.target.value); setSelectedToCancel([]) }}
          className="text-[12px] border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-[#185FA5]">
          <option value="ALL">Tous les events</option>
          {Object.values(eventsMap).sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
            .map(e => <option key={e.id} value={e.id}>{e.title} — {formatDate(e.starts_at)}</option>)}
        </select>

        <div className="flex items-center gap-2">
          {eventFilter !== 'ALL' && (
            <a href={`/groups/${groupId}/events/${eventFilter}/participants`}
              className="text-[12px] font-semibold text-[#185FA5] hover:underline whitespace-nowrap">
              Voir les participants →
            </a>
          )}
          {selectedToCancel.length > 0 && isOwner && (
            <button onClick={handleCancelSelected} disabled={cancelling}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-xl border border-red-200 text-red-500 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors">
              {cancelling ? 'Annulation…' : `Annuler (${selectedToCancel.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Bandeau event */}
      {displayedEvent && (
        <div className="mb-3 px-4 py-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
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

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-[13px] text-slate-500 border border-dashed border-slate-200 rounded-xl">
          Aucune invitation pour cet événement
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {filteredInvited.length > 0 && isOwner && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <input type="checkbox" checked={allCancelSelected} onChange={toggleCancelAll} className="rounded accent-[#185FA5]" />
              <span className="text-[11px] font-semibold text-slate-500">
                {selectedToCancel.length > 0 ? `${selectedToCancel.length} sélectionnée(s)` : 'Sélectionner les invited'}
              </span>
            </div>
          )}
          {filtered.map((inv, i) => {
            const evt = eventsMap[inv.event_id]
            const isInvited = inv.status === 'INVITED'
            return (
              <div key={inv.id} className={`flex items-center gap-3 px-4 py-3 ${selectedToCancel.includes(inv.id) ? 'bg-red-50/50' : ''} ${i < filtered.length - 1 ? 'border-b border-slate-100' : ''}`}>
                {isInvited && isOwner
                  ? <input type="checkbox" checked={selectedToCancel.includes(inv.id)} onChange={() => toggleCancel(inv.id)} className="rounded accent-[#185FA5] flex-shrink-0" />
                  : <div className="w-4 flex-shrink-0" />}
                <div className="w-7 h-7 rounded-full bg-[#EBF3FC] flex items-center justify-center text-[11px] font-bold text-[#0C447C] flex-shrink-0">
                  {inv.players?.first_name[0]}{inv.players?.surname[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-slate-900">{inv.players?.first_name} {inv.players?.surname}</div>
                  {evt && eventFilter === 'ALL' && <div className="text-[11px] text-slate-500">{evt.title} · {formatDate(evt.starts_at)}</div>}
                  {inv.invited_at && <div className="text-[11px] text-slate-400">invité le {formatDate(inv.invited_at)}</div>}
                </div>
                <Badge status={inv.status} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'


const supabase = createClient()


type Invitation = {
  id: string
  status: 'INVITED' | 'GOING' | 'DECLINED'
  invited_at: string | null
  event_id: string
  players: { first_name: string; surname: string; email: string | null }
}

type Event  = { id: string; title: string; starts_at: string }
type Member = { id: string; first_name: string; surname: string; email: string | null }

const STATUS_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  INVITED:  { label: 'invited',  bg: '#EEEDFE', text: '#3C3489' },
  GOING:    { label: 'going',    bg: '#EAF3DE', text: '#3B6D11' },
  DECLINED: { label: 'declined', bg: '#FCEBEB', text: '#A32D2D' },
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
  return new Date(dateStr).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function InvitationsPage() {
  const params = useParams()
  const groupId = params.id as string
  const pathname = usePathname()   

  const [invitations, setInvitations]         = useState<Invitation[]>([])
  const [eventsMap, setEventsMap]             = useState<Record<string, Event>>({})
  const [events, setEvents]                   = useState<Event[]>([])
  const [members, setMembers]                 = useState<Member[]>([])
  const [loading, setLoading]                 = useState(true)
  const [sending, setSending]                 = useState(false)

  const [selectedEvent, setSelectedEvent]     = useState('')
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [sendEmail, setSendEmail]             = useState(true)
  const [showForm, setShowForm]               = useState(true)
  const [eventFilter, setEventFilter]         = useState<string>('ALL')

  // Sélection pour annulation — uniquement les INVITED
  const [selectedToCancel, setSelectedToCancel] = useState<string[]>([])
  const [cancelling, setCancelling]             = useState(false)

  useEffect(() => { 
    if (groupId) loadData() 
    }, [groupId, pathname])
  useEffect(() => {
    const handleFocus = () => loadData()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [groupId])

  async function loadData() {
    setLoading(true)

    const { data: evts } = await supabase
      .from('events')
      .select('id, title, starts_at')
      .eq('group_id', groupId)
      .order('starts_at', { ascending: false })

    const allEvents = evts || []
    const upcomingEvents = allEvents.filter(e => new Date(e.starts_at) >= new Date())
    setEvents(upcomingEvents)

    const map: Record<string, Event> = {}
    allEvents.forEach(e => { map[e.id] = e })
    setEventsMap(map)

    if (upcomingEvents.length > 0) setSelectedEvent(upcomingEvents[0].id)

    if (allEvents.length > 0) {
      const { data: inv } = await supabase
        .from('event_participants')
        .select('id, status, invited_at, event_id, players(first_name, surname, email)')
        .in('event_id', allEvents.map(e => e.id))
        .order('invited_at', { ascending: false })
      setInvitations((inv || []) as any)
    } else {
      setInvitations([])
    }

    const { data: mbrs } = await supabase
      .from('groups_players')
      .select(`player:players(id, first_name, surname, email)`)
      .eq('group_id', groupId)
    setMembers((mbrs || []).map((m: any) => m.player))

    console.log('groupId in invitations:', groupId)
    console.log('members loaded:', mbrs?.length)    

    setSelectedToCancel([])
    setLoading(false)
  }

  async function handleSend() {
    if (!selectedEvent || selectedPlayers.length === 0) {
      toast('Sélectionne un event et au moins un joueur')
      return
    }

    setSending(true)
    try {
      const { data: existing } = await supabase
        .from('event_participants')
        .select('player_id')
        .eq('event_id', selectedEvent)
        .in('player_id', selectedPlayers)

      const alreadyInvited = (existing || []).map(e => e.player_id)
      const toInvite = selectedPlayers.filter(id => !alreadyInvited.includes(id))

      if (alreadyInvited.length > 0) {
        const names = members
          .filter(m => alreadyInvited.includes(m.id))
          .map(m => `${m.first_name} ${m.surname}`)
          .join(', ')
        toast(`Déjà invités — ignorés : ${names}`, { duration: 4000 })
      }

      if (toInvite.length === 0) {
        toast.error('Tous les joueurs sélectionnés sont déjà invités')
        setSending(false)
        return
      }

      if (sendEmail) {
  // 1. Insérer d'abord dans event_participants
  const rows = toInvite.map(playerId => ({
    event_id:            selectedEvent,
    player_id:           playerId,
    status:              'INVITED',
    invited_at:          new Date().toISOString(),
    registration_source: 'email',
  }))
  const { error: insertError } = await supabase
    .from('event_participants').insert(rows)
  if (insertError) throw new Error(insertError.message)

  // 2. Puis envoyer les emails
  const res = await fetch('/api/send-invitations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId: selectedEvent, playerIds: toInvite }),
  })
  if (!res.ok) throw new Error('Erreur envoi')
  toast.success(`${toInvite.length} invitation(s) envoyée(s) par email`)
}

      setSelectedPlayers([])
      window.location.href = `/groups/${groupId}/events`
    } catch (e: any) {
      toast.error(e.message ?? 'Erreur')
    } finally {
      setSending(false)
    }
  }

  async function handleCancelSelected() {
    if (selectedToCancel.length === 0) return
    if (!confirm(`Annuler ${selectedToCancel.length} invitation(s) ?`)) return

    setCancelling(true)
    const { error } = await supabase
      .from('event_participants')
      .delete()
      .in('id', selectedToCancel)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(`${selectedToCancel.length} invitation(s) annulée(s)`)
      loadData()
    }
    setCancelling(false)
  }

  function toggleCancel(id: string) {
    setSelectedToCancel(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  function toggleCancelAll() {
    const cancellable = filteredInvited.map(i => i.id)
    if (selectedToCancel.length === cancellable.length) {
      setSelectedToCancel([])
    } else {
      setSelectedToCancel(cancellable)
    }
  }

  function togglePlayer(id: string) {
    setSelectedPlayers(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  // Toutes les invitations filtrées par event
  const filtered = invitations.filter(i =>
    eventFilter === 'ALL' || i.event_id === eventFilter
  )

  // Seulement les INVITED — annulables
  const filteredInvited = filtered.filter(i => i.status === 'INVITED')
  const allCancelSelected = filteredInvited.length > 0 && selectedToCancel.length === filteredInvited.length

  const invitedCount  = filtered.filter(i => i.status === 'INVITED').length
  const goingCount    = filtered.filter(i => i.status === 'GOING').length
  const declinedCount = filtered.filter(i => i.status === 'DECLINED').length

  const displayedEvent = eventFilter !== 'ALL' ? eventsMap[eventFilter] : null

  if (loading) return (
    <div className="p-6 space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[18px] font-medium text-gray-900">Invitations</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            {invitations.filter(i => i.status === 'INVITED').length} invited · {invitations.filter(i => i.status === 'GOING').length} going
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 bg-[#185FA5] text-white text-[13px] font-medium px-4 py-2 rounded-md hover:bg-[#0C447C] transition-colors">
          {showForm ? 'Fermer' : '+ Inviter'}
        </button>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Envoyer des invitations
          </p>

          <div className="mb-4">
            <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Événement</label>
            {events.length === 0 ? (
              <p className="text-[12px] text-gray-400">Aucun événement à venir</p>
            ) : (
              <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] bg-white">
                {events.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.title} — {formatDate(e.starts_at)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] font-medium text-gray-500">
                Joueurs ({selectedPlayers.length} sélectionnés)
              </label>
              <button type="button" onClick={() => setSelectedPlayers(members.map(m => m.id))}
                className="text-[11px] text-blue-600 hover:text-blue-800">
                Tout sélectionner
              </button>
            </div>
            <div className="border border-gray-200 rounded-md overflow-hidden max-h-48 overflow-y-auto">
              {members.map((m, i) => (
                <label key={m.id}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                    i < members.length - 1 ? 'border-b border-gray-100' : ''
                  }`}>
                  <input type="checkbox" checked={selectedPlayers.includes(m.id)}
                    onChange={() => togglePlayer(m.id)} className="rounded" />
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-6 h-6 rounded-full bg-[#E6F1FB] flex items-center justify-center text-[10px] font-medium text-[#0C447C]">
                      {m.first_name[0]}{m.surname[0]}
                    </div>
                    <span className="text-[13px] text-gray-800">{m.first_name} {m.surname}</span>
                  </div>
                  {m.email
                    ? <span className="text-[11px] text-gray-400 truncate max-w-[140px]">{m.email}</span>
                    : <span className="text-[11px] text-amber-500">pas d'email</span>
                  }
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-3 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <button type="button" onClick={() => setSendEmail(v => !v)}
              className={`mt-0.5 w-9 h-5 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0 ${
                sendEmail ? 'bg-[#185FA5]' : 'bg-gray-300'
              }`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                sendEmail ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
            <div>
              <p className="text-[13px] font-medium text-gray-700">Envoyer un email d'invitation</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {sendEmail
                  ? 'Les joueurs recevront un email avec un lien pour répondre'
                  : 'Les joueurs sont enregistrés comme invités sans notification par email'
                }
              </p>
            </div>
          </div>

          <button onClick={handleSend}
            disabled={sending || selectedPlayers.length === 0 || !selectedEvent}
            className="bg-[#185FA5] text-white text-[13px] font-medium px-5 py-2 rounded-md hover:bg-[#0C447C] disabled:opacity-40 transition-colors">
            {sending
              ? 'En cours…'
              : sendEmail
                ? `Envoyer${selectedPlayers.length > 0 ? ` (${selectedPlayers.length})` : ''}`
                : `Enregistrer sans email${selectedPlayers.length > 0 ? ` (${selectedPlayers.length})` : ''}`
            }
          </button>
        </div>
      )}

      {/* Filtre event + bouton annuler */}
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={eventFilter}
            onChange={e => { setEventFilter(e.target.value); setSelectedToCancel([]) }}
            className="text-[12px] border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:border-blue-300">
            <option value="ALL">Tous les events</option>
            {Object.values(eventsMap)
              .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
              .map(e => (
                <option key={e.id} value={e.id}>{e.title} — {formatDate(e.starts_at)}</option>
              ))
            }
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* Lien vers participants */}
          {eventFilter !== 'ALL' && (
            <a
              href={`/groups/${groupId}/events/${eventFilter}/participants`}
              className="text-[12px] font-medium text-[#185FA5] hover:underline whitespace-nowrap">
              Voir les participants →
            </a>
          )}

          {/* Bouton annuler sélection */}
          {selectedToCancel.length > 0 && (
            <button onClick={handleCancelSelected} disabled={cancelling}
              className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md border border-red-200 text-red-500 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors">
              {cancelling ? 'Annulation…' : `Annuler (${selectedToCancel.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Bandeau event sélectionné avec compteurs */}
      {displayedEvent && (
        <div className="mb-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-gray-900">{displayedEvent.title}</p>
            <p className="text-[11px] text-gray-400">{formatDateLong(displayedEvent.starts_at)}</p>
          </div>
          <div className="flex gap-3 text-[11px]">
            <span className="text-[#3C3489] font-medium">{invitedCount} invited</span>
            <span className="text-[#3B6D11] font-medium">{goingCount} going</span>
            {declinedCount > 0 && <span className="text-[#A32D2D] font-medium">{declinedCount} declined</span>}
          </div>
        </div>
      )}

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-[13px] text-gray-400 border border-dashed border-gray-200 rounded-lg">
          Aucune invitation pour cet événement
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">

          {/* Header — case à cocher uniquement si des INVITED */}
          {filteredInvited.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <input type="checkbox" checked={allCancelSelected}
                onChange={toggleCancelAll} className="rounded" />
              <span className="text-[11px] font-medium text-gray-400">
                {selectedToCancel.length > 0
                  ? `${selectedToCancel.length} sélectionnée(s)`
                  : 'Sélectionner les invited'
                }
              </span>
            </div>
          )}

          {filtered.map((inv, i) => {
            const evt = eventsMap[inv.event_id]
            const isInvited = inv.status === 'INVITED'
            return (
              <div key={inv.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  selectedToCancel.includes(inv.id) ? 'bg-red-50/50' : ''
                } ${i < filtered.length - 1 ? 'border-b border-gray-100' : ''}`}>

                {/* Case à cocher — seulement pour INVITED */}
                {isInvited ? (
                  <input type="checkbox"
                    checked={selectedToCancel.includes(inv.id)}
                    onChange={() => toggleCancel(inv.id)}
                    className="rounded flex-shrink-0" />
                ) : (
                  <div className="w-4 flex-shrink-0" />
                )}

                <div className="w-7 h-7 rounded-full bg-[#E6F1FB] flex items-center justify-center text-[11px] font-medium text-[#0C447C] flex-shrink-0">
                  {inv.players?.first_name[0]}{inv.players?.surname[0]}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-gray-900">
                    {inv.players?.first_name} {inv.players?.surname}
                  </div>
                  {evt && eventFilter === 'ALL' && (
                    <div className="text-[11px] text-gray-400">
                      {evt.title} · {formatDate(evt.starts_at)}
                    </div>
                  )}
                  {inv.invited_at && (
                    <div className="text-[11px] text-gray-400">
                      invité le {formatDate(inv.invited_at)}
                    </div>
                  )}
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

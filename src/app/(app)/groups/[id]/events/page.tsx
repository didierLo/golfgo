'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type EventRow = {
  id: string; title: string; location: string | null; starts_at: string
  competition_formats: { name: string } | null; max_participants: number | null
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('fr-BE', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  })
}

function isPast(dateStr: string) { return new Date(dateStr) < new Date() }

function EventCard({ event, groupId, goingCount, onDelete, isOwner, onNotOwner }: {
  event: EventRow; groupId: string; goingCount: number
  onDelete: (id: string) => void; isOwner: boolean; onNotOwner: () => void
}) {
  const base = `/groups/${groupId}/events/${event.id}`
  const past = isPast(event.starts_at)

  return (
    <div className={`rounded-xl overflow-hidden border border-white/50 hover:border-slate-300 transition-colors bg-white ${past ? 'opacity-60' : ''}`}>
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="w-[3px] h-12 rounded-full flex-shrink-0 bg-[#185FA5] mt-0.5" />
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { window.location.href = base }}>
            <div className="text-[14px] font-semibold text-slate-900 truncate">{event.title}</div>
            <div className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>{formatDate(event.starts_at)}</span>
              {event.location && <><span>·</span><span className="truncate">{event.location}</span></>}
              {event.competition_formats?.name && <><span>·</span><span>{event.competition_formats.name}</span></>}
              <span>·</span>
              <span className="font-semibold text-[#3B6D11]">
                {goingCount}{event.max_participants ? `/${event.max_participants}` : ''} going
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <a href={isOwner ? `${base}/edit` : '#'}
              onClick={e => { if (!isOwner) { e.preventDefault(); onNotOwner() } }}
              className={`text-[11px] font-semibold border px-2.5 py-1.5 rounded-lg transition-colors ${
                isOwner ? 'text-slate-600 border-slate-200 hover:bg-slate-50' : 'text-slate-300 border-slate-100 cursor-not-allowed'
              }`}>
              Edit
            </a>
            <button
              onClick={() => isOwner ? onDelete(event.id) : onNotOwner()}
              className={`text-[11px] font-semibold border px-2.5 py-1.5 rounded-lg transition-colors ${
                isOwner ? 'text-red-500 border-red-200 hover:bg-red-50' : 'text-red-200 border-red-100 cursor-not-allowed'
              }`}>
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function EventsPage() {
  const params  = useParams()
  const groupId = params.id as string

  const [events,      setEvents]      = useState<EventRow[]>([])
  const [goingCounts, setGoingCounts] = useState<Record<string, number>>({})
  const [loading,     setLoading]     = useState(true)
  const [isOwner,     setIsOwner]     = useState(false)
  const [toast,       setToast]       = useState<string | null>(null)

  useEffect(() => { if (!groupId) return; fetchData() }, [groupId])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function fetchData() {
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

    const { data, error } = await supabase
      .from('events')
      .select(`id, title, location, starts_at, max_participants, competition_formats(name)`)
      .eq('group_id', groupId).order('starts_at', { ascending: true })
    if (error) { console.error(error); setLoading(false); return }
    const evts = data ?? []
    setEvents(evts as any)

    if (evts.length > 0) {
      const { data: counts } = await supabase.from('event_participants').select('event_id')
        .in('event_id', evts.map(e => e.id)).eq('status', 'GOING')
      const countMap: Record<string, number> = {}
      evts.forEach(e => { countMap[e.id] = 0 })
      counts?.forEach(c => { countMap[c.event_id] = (countMap[c.event_id] ?? 0) + 1 })
      setGoingCounts(countMap)
    }
    setLoading(false)
  }

  async function deleteEvent(eventId: string) {
    if (!confirm('Supprimer cet événement ?')) return
    const { error } = await supabase.from('events').delete().eq('id', eventId)
    if (error) { alert(error.message); return }
    fetchData()
  }

  const upcoming = events.filter(e => !isPast(e.starts_at))
  const past     = events.filter(e =>  isPast(e.starts_at))

  if (loading) return (
    <div className="p-6 space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-2xl">

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-[13px] font-medium px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#EF9F27" strokeWidth="1.5"/>
            <path d="M8 5v3.5M8 11h.01" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Events</h1>
          <p className="text-[13px] text-slate-900 mt-0.5">{upcoming.length} à venir · {past.length} passés</p>
        </div>
        <button
          onClick={() => isOwner ? window.location.href = `/groups/${groupId}/events/add` : showToast('Tu dois être Admin pour utiliser cette fonction')}
          className={`flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-xl transition-colors ${
            isOwner ? 'bg-[#185FA5] text-white hover:bg-[#0C447C]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}>
          + New event
        </button>
      </div>

      {upcoming.length > 0 && (
        <div className="mb-8">
          <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-3">À venir</p>
          <div className="flex flex-col gap-2">
            {upcoming.map(e => <EventCard key={e.id} event={e} groupId={groupId} goingCount={goingCounts[e.id] ?? 0} onDelete={deleteEvent} isOwner={isOwner} onNotOwner={() => showToast('Tu dois être Admin pour utiliser cette fonction')} />)}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-3">Passés</p>
          <div className="flex flex-col gap-2">
            {past.slice().reverse().map(e => <EventCard key={e.id} event={e} groupId={groupId} goingCount={goingCounts[e.id] ?? 0} onDelete={deleteEvent} isOwner={isOwner} onNotOwner={() => showToast('Tu dois être Admin pour utiliser cette fonction')} />)}
          </div>
        </div>
      )}

      {events.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-[15px] font-semibold">Aucun événement pour ce groupe</p>
          <p className="text-[13px] mt-1">Crée le premier événement pour commencer</p>
        </div>
      )}
    </div>
  )
}
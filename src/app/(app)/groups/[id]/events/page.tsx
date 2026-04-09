'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type EventRow = {
  id: string
  title: string
  location: string | null
  starts_at: string
  timeZone: 'Europe/Brussels'
  competition_formats: { name: string } | null
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-BE', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    timeZone: 'Europe/Brussels',
  })
}

function isPast(dateStr: string) {
  return new Date(dateStr) < new Date()
}

function ActionBtn({ label, href, color }: { label: string; href: string; color?: string }) {
  return (
    <a href={href}
      className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap
        ${color === 'blue'
          ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
        }`}>
      {label}
    </a>
  )
}

function EventCard({
  event, groupId, goingCount, onDelete,
}: {
  event: EventRow
  groupId: string
  goingCount: number
  onDelete: (id: string) => void
}) {
  const base = `/groups/${groupId}/events/${event.id}`

  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-gray-300 transition-colors">

      <div className="flex items-start gap-3">
        <div className="w-[3px] h-12 rounded-full flex-shrink-0 bg-[#185FA5] mt-0.5" />

        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { window.location.href = base }}>
          <div className="text-[14px] font-medium text-gray-900 truncate">{event.title}</div>
          <div className="text-[12px] text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>{formatDate(event.starts_at)}</span>
            {event.location && <><span>·</span><span className="truncate">{event.location}</span></>}
            {event.competition_formats?.name && <><span>·</span><span>{event.competition_formats.name}</span></>}
            <span>·</span>
            <span className="font-medium text-[#3B6D11]">{goingCount} going</span>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <a href={`${base}/edit`}
            className="text-[11px] text-gray-500 border border-gray-200 px-2.5 py-1 rounded-md hover:bg-gray-50 transition-colors">
            Edit
          </a>
          <button onClick={() => onDelete(event.id)}
            className="text-[11px] text-red-400 border border-red-100 px-2.5 py-1 rounded-md hover:bg-red-50 transition-colors">
            ✕
          </button>
        </div>
      </div>

      <div className="flex gap-2 mt-2.5 ml-[calc(3px+12px)] flex-wrap">
        <ActionBtn label="Invitations"  href={`/groups/${groupId}/invitations`} color="blue" />
        <ActionBtn label="Participants" href={`${base}/participants`} />
        <ActionBtn label="Flights"      href={`${base}/flights`} />
        <ActionBtn label="Tee Sheet"  href={`${base}/teesheet`} />
        <ActionBtn label="Scorecards"   href={`${base}/scorecards`} />
        <ActionBtn label="Leaderboard"  href={`${base}/leaderboard`} />
      </div>

    </div>
  )
}

export default function EventsPage() {
  const params = useParams()
  const groupId = params.id as string

  const [events, setEvents]           = useState<EventRow[]>([])
  const [goingCounts, setGoingCounts] = useState<Record<string, number>>({})
  const [loading, setLoading]         = useState(true)

  useEffect(() => { if (!groupId) return; fetchData() }, [groupId])

  async function fetchData() {
    setLoading(true)

    const { data, error } = await supabase
      .from('events')
      .select(`id, title, location, starts_at, competition_formats(name)`)
      .eq('group_id', groupId)
      .order('starts_at', { ascending: true })

    if (error) { console.error(error); setLoading(false); return }
    const evts = data ?? []
    setEvents(evts)

    // Compteurs GOING en une seule requête
    if (evts.length > 0) {
      const { data: counts } = await supabase
        .from('event_participants')
        .select('event_id')
        .in('event_id', evts.map(e => e.id))
        .eq('status', 'GOING')

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
  const past     = events.filter(e => isPast(e.starts_at))

  if (loading) return (
    <div className="p-6 space-y-3">
      {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-6 max-w-2xl">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[18px] font-medium text-gray-900">Events</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            {upcoming.length} à venir · {past.length} passés
          </p>
        </div>
        <a href={`/groups/${groupId}/events/add`}
          className="flex items-center gap-1.5 bg-[#185FA5] text-white text-[13px] font-medium px-4 py-2 rounded-md hover:bg-[#0C447C] transition-colors">
          + New event
        </a>
      </div>

      {upcoming.length > 0 && (
        <div className="mb-8">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">À venir</p>
          <div className="flex flex-col gap-2">
            {upcoming.map(event => (
              <EventCard key={event.id} event={event} groupId={groupId}
                goingCount={goingCounts[event.id] ?? 0} onDelete={deleteEvent} />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Passés</p>
          <div className="flex flex-col gap-2 opacity-60">
            {past.slice().reverse().map(event => (
              <EventCard key={event.id} event={event} groupId={groupId}
                goingCount={goingCounts[event.id] ?? 0} onDelete={deleteEvent} />
            ))}
          </div>
        </div>
      )}

      {events.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-[15px]">Aucun événement pour ce groupe</p>
          <p className="text-[13px] mt-1">Crée le premier événement pour commencer</p>
        </div>
      )}

    </div>
  )
}

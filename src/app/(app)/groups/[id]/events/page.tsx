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
  competition_formats: { name: string } | null
  max_participants: number | null
}

type GroupBg = { bg: string | null }

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('fr-BE', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'UTC',
  })
}

function isPast(dateStr: string) { return new Date(dateStr) < new Date() }

function EventCard({ event, groupId, goingCount, onDelete, bgUrl }: {
  event: EventRow; groupId: string; goingCount: number; onDelete: (id: string) => void; bgUrl?: string | null
}) {
  const base = `/groups/${groupId}/events/${event.id}`
  const past = isPast(event.starts_at)

  return (
    <div className="rounded-xl overflow-hidden border border-white/50 hover:border-slate-300 transition-colors bg-white">
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
            <a href={`${base}/edit`}
              className="text-[11px] font-semibold text-slate-600 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
              Edit
            </a>
            <button onClick={() => onDelete(event.id)}
              className="text-[11px] font-semibold text-red-500 border border-red-200 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
              ✕
            </button>
          </div>
        </div>

        <div className="flex gap-1.5 mt-2.5 ml-[15px] flex-wrap">
          {[
            { label: 'Invitations',  href: `/groups/${groupId}/invitations`, blue: true },
            { label: 'Participants', href: `${base}/participants` },
            { label: 'Flights',      href: `${base}/flights` },
            { label: 'Tee Sheet',    href: `${base}/teesheet` },
            { label: 'Scorecards',   href: `${base}/scorecards` },
            { label: 'Leaderboard',  href: `${base}/leaderboard` },
          ].map(({ label, href, blue }) => (
            <a key={label} href={href}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors whitespace-nowrap ${
                blue
                  ? 'bg-[#EBF3FC] border-[#B5D4F4] text-[#185FA5] hover:bg-blue-100'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}>
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function EventsPage() {
  const params  = useParams()
  const groupId = params.id as string

  const [events, setEvents]           = useState<EventRow[]>([])
  const [goingCounts, setGoingCounts] = useState<Record<string, number>>({})
  const [loading, setLoading]         = useState(true)

  useEffect(() => { if (!groupId) return; fetchData() }, [groupId])



  async function fetchData() {
    setLoading(true)
  
  

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
  const past     = events.filter(e => isPast(e.starts_at))

  if (loading) return (
    <div className="p-6 space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-24 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Events</h1>
          <p className="text-[13px] text-slate-600 mt-0.5">{upcoming.length} à venir · {past.length} passés</p>
        </div>
        <a href={`/groups/${groupId}/events/add`}
          className="flex items-center gap-1.5 bg-[#185FA5] text-white text-[13px] font-semibold px-4 py-2 rounded-xl hover:bg-[#0C447C] transition-colors">
          + New event
        </a>
      </div>

            {upcoming.length > 0 && (
          <div className="mb-8">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">À venir</p>
            <div className="flex flex-col gap-2">
              {upcoming.map(e => <EventCard key={e.id} event={e} groupId={groupId} goingCount={goingCounts[e.id] ?? 0} onDelete={deleteEvent} />)}
            </div>
          </div>
        )}

         {past.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Passés</p>
            <div className="flex flex-col gap-2 opacity-60">
              {past.slice().reverse().map(e => <EventCard key={e.id} event={e} groupId={groupId} goingCount={goingCounts[e.id] ?? 0} onDelete={deleteEvent} />)}
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

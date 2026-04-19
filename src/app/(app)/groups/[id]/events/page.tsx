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
  return new Date(dateStr).toLocaleDateString('fr-BE', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    timeZone: 'Europe/Brussels',
  })
}

function isPast(dateStr: string) { return new Date(dateStr) < new Date() }

function EventCard({ event, groupId, goingCount, onDelete, bgUrl }: {
  event: EventRow; groupId: string; goingCount: number; onDelete: (id: string) => void; bgUrl?: string | null
}) {
  const base = `/groups/${groupId}/events/${event.id}`
  const past = isPast(event.starts_at)
  const bgImage = bgUrl ?? '/golf-bg.jpg'

  return (
    <div className="rounded-xl overflow-hidden border border-white/50 hover:border-slate-300 transition-colors">

      {/* ── Version MOBILE avec image de fond ── */}
      <div className="sm:hidden relative cursor-pointer" onClick={() => { window.location.href = base }}
        style={{ backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/70 rounded-t-xl" />

        {/* Badge statut */}
        <div className="absolute top-3 right-3 z-10">
          {past
            ? <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-700/80 text-slate-200 backdrop-blur-sm">DONE</span>
            : goingCount > 0
            ? <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#4CAF1A]/90 text-white backdrop-blur-sm">OPEN</span>
            : <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#185FA5]/90 text-white backdrop-blur-sm">NEW</span>
          }
        </div>

        {/* Boutons edit/delete */}
        <div className="absolute top-3 left-3 z-10 flex gap-1" onClick={e => e.stopPropagation()}>
          <a href={`${base}/edit`}
            className="text-[10px] font-semibold text-white/80 bg-black/30 border border-white/20 px-2 py-1 rounded-lg backdrop-blur-sm hover:bg-black/50 transition-colors">
            Edit
          </a>
          <button onClick={() => onDelete(event.id)}
            className="text-[10px] font-semibold text-white/80 bg-black/30 border border-white/20 px-2 py-1 rounded-lg backdrop-blur-sm hover:bg-red-500/60 transition-colors">
            ✕
          </button>
        </div>

        {/* Contenu */}
        <div className="relative z-10 px-4 pt-10 pb-3">
          <h3 className="text-[16px] font-black text-white leading-tight drop-shadow">{event.title}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[12px] text-white/80 font-medium">{formatDate(event.starts_at)}</span>
            {event.location && <><span className="text-white/40">·</span><span className="text-[12px] text-white/80">{event.location}</span></>}
          </div>
          <div className="flex items-center gap-3 mt-2">
            {event.competition_formats?.name && (
              <span className="text-[11px] font-semibold text-white/70 bg-white/10 px-2 py-0.5 rounded-full">
                {event.competition_formats.name}
              </span>
            )}
            <span className="text-[11px] font-bold text-[#4CAF1A]">
              👥 {goingCount}{event.max_participants ? `/${event.max_participants}` : ''} going
            </span>
          </div>
        </div>

        {/* Quick links mobile */}
        <div className="relative z-10 px-4 pb-3 flex gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
          {[
            { label: 'Invitations', href: `/groups/${groupId}/invitations` },
            { label: 'Participants', href: `${base}/participants` },
            { label: 'Flights',      href: `${base}/flights` },
          ].map(({ label, href }) => (
            <a key={label} href={href}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-white/15 border border-white/20 text-white/90 backdrop-blur-sm hover:bg-white/25 transition-colors">
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* ── Version DESKTOP/TABLETTE — inchangée ── */}
      <div className="hidden sm:block bg-white px-4 py-3">
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
              className="text-[11px] font-semibold text-slate-600 border border-white/50 px-2.5 py-1.5 rounded-lg hover:bg-white/30 transition-colors">
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
              blue ? 'bg-[#EBF3FC] border-[#B5D4F4] text-[#185FA5] hover:bg-blue-100' : 'border-slate-200 text-slate-500 hover:bg-white/30'
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

  const [bgUrl, setBgUrl] = useState<string | null>(null)

  async function fetchData() {
    setLoading(true)
    // Charger l'image de fond du groupe
    const { data: grp } = await supabase.from('groups').select('template_bg_image_url').eq('id', groupId).single()
    setBgUrl(grp?.template_bg_image_url ?? null)

    const { data, error } = await supabase
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
            {upcoming.map(e => <EventCard key={e.id} event={e} groupId={groupId} goingCount={goingCounts[e.id] ?? 0} onDelete={deleteEvent} bgUrl={bgUrl} />)}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Passés</p>
          <div className="flex flex-col gap-2 opacity-60">
            {past.slice().reverse().map(e => <EventCard key={e.id} event={e} groupId={groupId} goingCount={goingCounts[e.id] ?? 0} onDelete={deleteEvent} bgUrl={bgUrl} />)}
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

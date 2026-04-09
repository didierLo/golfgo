'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

// ─── Types ────────────────────────────────────────────────────────────────────

type MyEvent = {
  event_id: string
  status: 'GOING' | 'INVITED' | 'DECLINED' | 'WAITLIST'
  events: {
    title: string
    starts_at: string
    location: string | null
    group_id: string
    groups: {
      name: string
      color: string | null
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  GOING:    { label: 'going',    bg: '#EAF3DE', text: '#3B6D11' },
  INVITED:  { label: 'invited',  bg: '#EEEDFE', text: '#3C3489' },
  DECLINED: { label: 'declined', bg: '#FCEBEB', text: '#A32D2D' },
  WAITLIST: { label: 'waitlist', bg: '#FAEEDA', text: '#854F0B' },
}

function Badge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { label: status.toLowerCase(), bg: '#F1EFE8', text: '#5F5E5A' }
  return (
    <span
      className="text-[11px] font-medium px-2 py-1 rounded-full"
      style={{ background: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  )
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-BE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Brussels',
  })
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function MyEventsPage() {
  const router = useRouter()
  const [events, setEvents] = useState<MyEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: player } = await supabase
      .from('players')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!player) { setLoading(false); return }

    const { data, error } = await supabase
      .from('event_participants')
      .select(`
        event_id,
        status,
        events(
          title,
          starts_at,
          location,
          group_id,
          groups!events_group_id_fkey(
            name,
            color
          )
        )
      `)
      .eq('player_id', player.id)
      .order('starts_at', { foreignTable: 'events', ascending: true })

    if (error) { console.error(error); setLoading(false); return }

    setEvents(data || [])
    setLoading(false)
  }

  // ── Séparer upcoming et past ───────────────────────────────────────────────
  const now = new Date()
  const upcoming = events.filter(e => new Date(e.events.starts_at) >= now)
  const past = events.filter(e => new Date(e.events.starts_at) < now)

  if (loading) {
    return (
      <div className="p-8 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-[18px] font-medium text-gray-900">My events</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">
          {upcoming.length} à venir · {past.length} passés
        </p>
      </div>

      {/* ── Upcoming ───────────────────────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <div className="mb-8">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
            À venir
          </p>
          <div className="flex flex-col gap-2">
            {upcoming.map(e => (
              <EventCard
                key={e.event_id}
                event={e}
                onView={() => router.push(`/groups/${e.events.group_id}/events/${e.event_id}/view`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Past ───────────────────────────────────────────────────────────── */}
      {past.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Passés
          </p>
          <div className="flex flex-col gap-2 opacity-60">
            {past.slice().reverse().map(e => (
              <EventCard
                key={e.event_id}
                event={e}
                onView={() => router.push(`/groups/${e.events.group_id}/events/${e.event_id}/view`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {events.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-[15px]">Aucun événement pour l'instant</p>
          <p className="text-[13px] mt-1">Tu seras notifié par email lors d'une invitation</p>
        </div>
      )}

    </div>
  )
}

// ─── Card événement ───────────────────────────────────────────────────────────

function EventCard({ event: e, onView }: { event: MyEvent; onView: () => void }) {
  const groupColor = e.events.groups?.color ?? '#378ADD'

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg flex items-center gap-3 px-4 py-3 hover:border-gray-300 transition-colors cursor-pointer"
      onClick={onView}
    >
      {/* Barre couleur groupe */}
      <div
        className="w-[3px] h-10 rounded-full flex-shrink-0"
        style={{ background: groupColor }}
      />

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-gray-900 truncate">
          {e.events.title}
        </div>
        <div className="text-[12px] text-gray-400 mt-0.5 flex items-center gap-1.5">
          <span>{e.events.groups?.name}</span>
          <span>·</span>
          <span>{formatDate(e.events.starts_at)}</span>
          {e.events.location && (
            <>
              <span>·</span>
              <span className="truncate">{e.events.location}</span>
            </>
          )}
        </div>
      </div>

      {/* Badge statut */}
      <Badge status={e.status} />
    </div>
  )
}

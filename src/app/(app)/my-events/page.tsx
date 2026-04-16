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

const STATUS_STYLE = {
  GOING:    { label: 'going',    bg: '#EAF8E1', text: '#2F6B0F' },
  INVITED:  { label: 'invited',  bg: '#EEF2FF', text: '#3730A3' },
  DECLINED: { label: 'declined', bg: '#FEE2E2', text: '#991B1B' },
  WAITLIST: { label: 'waitlist', bg: '#FEF3C7', text: '#92400E' },
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

    setEvents((data || []) as any)
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
    <div>

      <h1 className="text-xl font-semibold mb-4 flex items-center gap-2">
        ⛳ My events
      </h1>

      {/* UPCOMING */}
      {upcoming.map(e => (
        <div
          key={e.event_id}
          onClick={() => router.push(`/groups/${e.events.group_id}/events/${e.event_id}/view`)}
          className="bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm hover:shadow-md transition cursor-pointer"
        >
          <div className="flex justify-between items-center">
            <div>
              <div className="font-semibold">{e.events.title}</div>
              <div className="text-sm text-gray-500">
                {e.events.groups?.name} · {formatDate(e.events.starts_at)}
              </div>
            </div>

            <Badge status={e.status} />
          </div>
        </div>
      ))}

      {/* PAST */}
      {past.length > 0 && (
        <>
          <p className="text-xs text-gray-400 mt-6 mb-2 uppercase">Passés</p>
          {past.map(e => (
            <div key={e.event_id} className="opacity-50 bg-white rounded-xl p-4 mb-2 border border-gray-100">
              {e.events.title}
            </div>
          ))}
        </>
      )}

      {events.length === 0 && (
        <p className="text-center text-gray-400 mt-10">
          Aucun événement pour l'instant
        </p>
      )}

    </div>
  )
}

// ─── Card événement ───────────────────────────────────────────────────────────

function EventCard({ event: e, onView }: { event: MyEvent; onView: () => void }) {
  const groupColor = e.events.groups?.color ?? '#378ADD'

  return (
    <div
      onClick={onView}
      className="
        bg-white rounded-xl px-4 py-3 flex items-center gap-3
        border border-gray-100 shadow-sm
        hover:shadow-md hover:-translate-y-[1px]
        transition-all cursor-pointer
      "
    >
      {/* Accent couleur groupe */}
      <div
        className="w-[4px] h-10 rounded-full flex-shrink-0"
        style={{ background: groupColor }}
      />

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-gray-900 truncate">
          {e.events.title}
        </div>

        <div className="text-[12px] text-gray-500 mt-1 flex items-center gap-1.5">
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

      {/* Badge amélioré */}
      <div className="ml-2">
        <Badge status={e.status} />
      </div>
    </div>
  )
}

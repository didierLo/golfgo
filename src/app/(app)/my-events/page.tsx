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
    max_participants: number | null
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  GOING:    { label: 'Inscrit',   bg: '#EAF3DE', text: '#3B6D11' },
  INVITED:  { label: 'Invité',    bg: '#EBF3FC', text: '#0C447C' },
  DECLINED: { label: 'Décliné',   bg: '#FCEBEB', text: '#A32D2D' },
  WAITLIST: { label: 'Waitlist',  bg: '#FAEEDA', text: '#854F0B' },
}

function Badge({ status }: { status: string }) {
  const s = STATUS_STYLE[status as keyof typeof STATUS_STYLE]
    ?? { label: status.toLowerCase(), bg: '#F1F5F9', text: '#64748B' }
  return (
    <span
      className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
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

function getDayMonth(dateStr: string) {
  const d = new Date(dateStr)
  return {
    day: d.toLocaleDateString('fr-BE', { day: 'numeric', timeZone: 'Europe/Brussels' }),
    month: d.toLocaleDateString('fr-BE', { month: 'short', timeZone: 'Europe/Brussels' }),
  }
}

function daysUntil(dateStr: string): number {
  // On extrait la date locale Brussels pour éviter le décalage UTC
  const nowStr = new Date().toLocaleDateString('fr-BE', { timeZone: 'Europe/Brussels' })
  const [d1, m1, y1] = nowStr.split('/').map(Number)
  const now = new Date(y1, m1 - 1, d1)

  const targetStr = new Date(dateStr).toLocaleDateString('fr-BE', { timeZone: 'Europe/Brussels' })
  const [d2, m2, y2] = targetStr.split('/').map(Number)
  const target = new Date(y2, m2 - 1, d2)

  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

// ─── Composant principal ──────────────────────────────────────────────────────

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
      .from('players').select('id').eq('user_id', user.id).single()
    if (!player) { setLoading(false); return }

    const { data, error } = await supabase
      .from('event_participants')
      .select(`
        event_id,
        status,
        location,
       events(
          title,
          starts_at,
          location,
          group_id,
          max_participants,
          groups!events_group_id_fkey(name, color)
        )
      `)
      .eq('player_id', player.id)
      .order('starts_at', { foreignTable: 'events', ascending: true })

    if (error) { console.error(error); setLoading(false); return }
    setEvents((data || []) as any)
    setLoading(false)
  }

  const now = new Date()
  // Tri côté client — garantit l'ordre correct indépendamment de Supabase
  const sorted = [...events].sort((a, b) =>
    new Date(a.events.starts_at).getTime() - new Date(b.events.starts_at).getTime()
  )
  const upcoming = sorted.filter(e => new Date(e.events.starts_at) >= now)
  const past     = sorted.filter(e => new Date(e.events.starts_at) < now)
  const nextEvent = upcoming[0] ?? null
  const goingCount = upcoming.filter(e => e.status === 'GOING').length
  const invitedCount = upcoming.filter(e => e.status === 'INVITED').length

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-2xl">
        <div className="h-8 w-48 bg-slate-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-white/40 rounded-xl animate-pulse" />)}
        </div>
        {[1,2,3].map(i => <div key={i} className="h-16 bg-white/40 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="p-5 sm:p-6 max-w-2xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-5">
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">My Events</h1>
        <p className="text-[13px] text-slate-600 mt-0.5">
          {upcoming.length} à venir · {past.length} passés
        </p>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      {events.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">

          {/* Prochain event */}
          <div className="rounded-xl border border-white/60 shadow-sm p-3.5" style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Prochain
            </p>
            {nextEvent ? (
              <>
                <p className="text-[22px] font-black text-[#185FA5] leading-none">
                  {daysUntil(nextEvent.events.starts_at) === 0
                    ? "Auj."
                    : daysUntil(nextEvent.events.starts_at) === 1
                    ? "Dem."
                    : `${daysUntil(nextEvent.events.starts_at)}j`}
                </p>
                <p className="text-[11px] text-slate-600 mt-1 truncate leading-tight">
                  {nextEvent.events.title}
                </p>
              </>
            ) : (
              <p className="text-[13px] text-slate-300 font-medium">—</p>
            )}
          </div>

          {/* Confirmés */}
          <div className="rounded-xl border border-white/60 shadow-sm p-3.5" style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Confirmés
            </p>
            <p className="text-[22px] font-black text-[#3B6D11] leading-none">{goingCount}</p>
            <p className="text-[11px] text-slate-600 mt-1">évén. à venir</p>
          </div>

          {/* En attente */}
          <div className="rounded-xl border border-white/60 shadow-sm p-3.5" style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Invitations
            </p>
            <p className="text-[22px] font-black leading-none"
              style={{ color: invitedCount > 0 ? '#0C447C' : '#CBD5E1' }}>
              {invitedCount}
            </p>
            <p className="text-[11px] text-slate-600 mt-1">
              {invitedCount > 0 ? 'à confirmer' : 'aucune'}
            </p>
          </div>

        </div>
      )}

      {/* ── Upcoming ───────────────────────────────────────────────────────── */}
      {upcoming.length > 0 && (
        <div className="mb-8">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
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
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
            Passés
          </p>
          <div className="flex flex-col gap-2">
            {past.slice().reverse().map(e => (
              <EventCard
                key={e.event_id}
                event={e}
                past
                onView={() => router.push(`/groups/${e.events.group_id}/events/${e.event_id}/view`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────────── */}
      {events.length === 0 && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">⛳</div>
          <p className="text-[15px] font-semibold text-slate-700">Aucun événement pour l'instant</p>
          <p className="text-[13px] text-slate-600 mt-1">
            Tu seras notifié par email lors d'une invitation
          </p>
        </div>
      )}

    </div>
  )
}

// ─── EventCard ────────────────────────────────────────────────────────────────

function EventCard({
  event: e,
  onView,
  past = false,
}: {
  event: MyEvent
  onView: () => void
  past?: boolean
}) {
  const groupColor = e.events.groups?.color ?? '#378ADD'
  const { day, month } = getDayMonth(e.events.starts_at)

  return (
    <div
      className={`
        bg-white border rounded-xl flex items-center gap-3 px-4 py-3
        hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer
        ${past ? 'opacity-55' : 'border-slate-200'}
      `}
      onClick={onView}
    >
      {/* Date box */}
      <div
        className="w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0"
        style={{ background: `${groupColor}18` }}
      >
        <span className="text-[13px] font-black leading-none" style={{ color: groupColor }}>
          {day}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wide leading-none mt-0.5"
          style={{ color: groupColor }}>
          {month}
        </span>
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold text-slate-900 truncate leading-tight">
          {e.events.title}
        </div>
        <div className="text-[11.5px] text-slate-600 mt-0.5 flex items-center gap-1 truncate">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: groupColor }}
          />
          <span className="truncate">{e.events.groups?.name}</span>
          {e.events.location && (
            <>
              <span className="flex-shrink-0">·</span>
              <span className="truncate">{e.events.location}</span>
            </>
          )}
            {e.events.max_participants && (
              <span className="text-[11px] text-slate-400 flex-shrink-0">
                {e.events.max_participants} places
              </span>
            )}

        </div>
      </div>

      {/* Badge statut */}
      <Badge status={e.status} />
    </div>
  )
}

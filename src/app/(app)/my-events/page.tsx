'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

// ─── Types ────────────────────────────────────────────────────────────────────

type MyEvent = {
  event_id: string
  status: 'GOING' | 'INVITED' | 'DECLINED' | 'WAITLIST'
  goingCount?: number
  events: {
    title: string
    starts_at: string
    location: string | null
    group_id: string
    max_participants: number | null
    groups: {
      name: string
      color: string | null
    }
  }
}

type View = 'list' | 'calendar'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  GOING:    { label: 'Inscrit',  bg: '#EAF3DE', text: '#3B6D11' },
  INVITED:  { label: 'Invité',   bg: '#EBF3FC', text: '#0C447C' },
  DECLINED: { label: 'Décliné',  bg: '#FCEBEB', text: '#A32D2D' },
  WAITLIST: { label: 'Waitlist', bg: '#FAEEDA', text: '#854F0B' },
}

function Badge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { label: status.toLowerCase(), bg: '#F1F5F9', text: '#64748B' }
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
      style={{ background: s.bg, color: s.text }}>
      {s.label}
    </span>
  )
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

function getDayMonth(dateStr: string) {
  const d = new Date(dateStr)
  return {
    day:   d.toLocaleDateString('fr-BE', { day: 'numeric',      timeZone: 'Europe/Brussels' }),
    month: d.toLocaleDateString('fr-BE', { month: 'short',      timeZone: 'Europe/Brussels' }),
  }
}

function formatDayFull(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-BE', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Brussels'
  })
}

function generateICS(title: string, starts_at: string, location: string | null): string {
  const start = new Date(starts_at)
  const end   = new Date(start.getTime() + 4 * 60 * 60 * 1000)
  const fmt   = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`,
    location ? `LOCATION:${location}` : '',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}

function downloadICS(e: MyEvent) {
  const blob = new Blob([generateICS(e.events.title, e.events.starts_at, e.events.location)], { type: 'text/calendar' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${e.events.title.replace(/\s+/g, '_')}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

function daysUntil(dateStr: string): number {
  const nowStr = new Date().toLocaleDateString('fr-BE', { timeZone: 'Europe/Brussels' })
  const [d1, m1, y1] = nowStr.split('/').map(Number)
  const now = new Date(y1, m1 - 1, d1)
  const targetStr = new Date(dateStr).toLocaleDateString('fr-BE', { timeZone: 'Europe/Brussels' })
  const [d2, m2, y2] = targetStr.split('/').map(Number)
  const target = new Date(y2, m2 - 1, d2)
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

// ─── EventCard ────────────────────────────────────────────────────────────────

function EventCard({ event: e, onView, onICS, past = false }: { event: MyEvent; onView: () => void; onICS: () => void; past?: boolean }) {
  const groupColor = e.events.groups?.color ?? '#378ADD'
  const { day, month } = getDayMonth(e.events.starts_at)
  return (
    <div className={`bg-white border rounded-xl flex items-center gap-3 px-4 py-3 hover:border-slate-300 hover:shadow-sm transition-all ${past ? 'opacity-55 border-slate-100' : 'border-slate-200'}`}>
      {/* Date badge — cliquable vers l'event */}
      <div onClick={onView} className="w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0 cursor-pointer"
        style={{ background: `${groupColor}18` }}>
        <span className="text-[13px] font-black leading-none" style={{ color: groupColor }}>{day}</span>
        <span className="text-[9px] font-bold uppercase tracking-wide leading-none mt-0.5" style={{ color: groupColor }}>{month}</span>
      </div>

      {/* Infos — cliquable vers l'event */}
      <div onClick={onView} className="flex-1 min-w-0 cursor-pointer">
        <div className="text-[13.5px] font-semibold text-slate-900 truncate leading-tight">{e.events.title}</div>
        <div className="text-[11.5px] text-slate-500 mt-0.5 truncate capitalize">
          {formatDayFull(e.events.starts_at)}
        </div>
        <div className="text-[11.5px] text-slate-600 mt-0.5 flex items-center gap-1 truncate">
          <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: groupColor }} />
          <span className="truncate">{e.events.groups?.name}</span>
          <span className="flex-shrink-0">·</span>
          <span className="flex-shrink-0 font-medium">{formatTime(e.events.starts_at)}</span>
          {e.events.location && (<><span className="flex-shrink-0">·</span><span className="truncate">{e.events.location}</span></>)}
        </div>
        {e.events.max_participants && (
          <span className={`text-[11px] font-medium ${
            (e.events.max_participants - (e.goingCount ?? 0)) <= 0 ? 'text-red-400'
            : (e.events.max_participants - (e.goingCount ?? 0)) <= 3 ? 'text-amber-500'
            : 'text-slate-400'}`}>
            {Math.max(0, e.events.max_participants - (e.goingCount ?? 0))} places dispo
          </span>
        )}
      </div>

      {/* Badge + bouton calendrier */}
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <Badge status={e.status} />
        <button
          onClick={e => { e.stopPropagation(); onICS() }}
          title="Ajouter à mon calendrier"
          className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-[#185FA5] hover:bg-blue-50 transition-colors">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="2" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M1 6h14" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M5 10h2M9 10h2M5 12.5h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── CalendarView ─────────────────────────────────────────────────────────────

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS_FR   = ['Lu','Ma','Me','Je','Ve','Sa','Di']

function CalendarView({ events, onView }: { events: MyEvent[]; onView: (e: MyEvent) => void }) {
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())  // 0-based

  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)

  // Lundi = 0
  const startOffset = (firstDay.getDay() + 6) % 7
  const totalCells  = startOffset + lastDay.getDate()
  const totalRows   = Math.ceil(totalCells / 7)

  // Index events par jour (yyyy-mm-dd)
  const eventsByDay: Record<string, MyEvent[]> = {}
  for (const e of events) {
    const d = new Date(e.events.starts_at)
    // Date locale Brussels
    const key = d.toLocaleDateString('fr-BE', { timeZone: 'Europe/Brussels' })
      .split('/').reverse().join('-')          // dd/mm/yyyy → yyyy-mm-dd
      .replace(/(\d{4})-(\d{1,2})-(\d{1,2})/, (_, y, m, d) =>
        `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`)
    if (!eventsByDay[key]) eventsByDay[key] = []
    eventsByDay[key].push(e)
  }

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      {/* Navigation mois */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <button onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span className="text-[14px] font-bold text-slate-800">{MONTHS_FR[month]} {year}</span>
        <button onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Jours de la semaine */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {DAYS_FR.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase py-2">{d}</div>
        ))}
      </div>

      {/* Grille */}
      <div className="grid grid-cols-7">
        {Array.from({ length: totalRows * 7 }).map((_, idx) => {
          const dayNum = idx - startOffset + 1
          const isValid = dayNum >= 1 && dayNum <= lastDay.getDate()
          const dateKey = isValid
            ? `${year}-${String(month+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`
            : null
          const dayEvents = dateKey ? (eventsByDay[dateKey] ?? []) : []
          const isToday   = dateKey === todayKey
          const isPast    = isValid && new Date(year, month, dayNum) < new Date(today.getFullYear(), today.getMonth(), today.getDate())

          return (
            <div key={idx}
              className={`min-h-[72px] p-1.5 border-b border-r border-slate-100 last:border-r-0 ${!isValid ? 'bg-slate-50/50' : ''}`}>
              {isValid && (
                <>
                  <div className={`w-6 h-6 flex items-center justify-center rounded-full text-[12px] font-semibold mb-1 mx-auto
                    ${isToday ? 'bg-[#185FA5] text-white' : isPast ? 'text-slate-300' : 'text-slate-700'}`}>
                    {dayNum}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {dayEvents.slice(0, 2).map(e => {
                      const color = e.events.groups?.color ?? '#378ADD'
                      return (
                        <button key={e.event_id} onClick={() => onView(e)}
                          className="w-full text-left rounded-md px-1 py-0.5 truncate text-[10px] font-semibold leading-tight transition-opacity hover:opacity-80"
                          style={{ background: `${color}22`, color }}>
                          {e.events.title}
                        </button>
                      )
                    })}
                    {dayEvents.length > 2 && (
                      <span className="text-[9px] text-slate-400 font-medium pl-1">+{dayEvents.length - 2}</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Légende statuts */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-slate-100 flex-wrap">
        {Object.entries(STATUS_STYLE).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: s.text }} />
            <span className="text-[10px] text-slate-500 font-medium">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function MyEventsPage() {
  const router  = useRouter()
  const [events,  setEvents]  = useState<MyEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [view,    setView]    = useState<View>('list')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: player } = await supabase.from('players').select('id').eq('user_id', user.id).single()
    if (!player) { setLoading(false); return }

    const { data, error } = await supabase
      .from('event_participants')
      .select(`event_id, status, events(title, starts_at, location, group_id, max_participants, groups!events_group_id_fkey(name, color))`)
      .eq('player_id', player.id)
      .order('starts_at', { foreignTable: 'events', ascending: true })

    if (error) { console.error(error); setLoading(false); return }

    const eventIds = (data || []).map((e: any) => e.event_id)
    const { data: counts } = await supabase
      .from('event_participants').select('event_id, status')
      .in('event_id', eventIds).eq('status', 'GOING')

    const goingByEvent: Record<string, number> = {}
    for (const row of counts || []) goingByEvent[row.event_id] = (goingByEvent[row.event_id] ?? 0) + 1

    setEvents((data || []).map((e: any) => ({ ...e, goingCount: goingByEvent[e.event_id] ?? 0 })) as any)
    setLoading(false)
  }

  const now      = new Date()
  const sorted   = [...events].sort((a, b) => new Date(a.events.starts_at).getTime() - new Date(b.events.starts_at).getTime())
  const upcoming = sorted.filter(e => new Date(e.events.starts_at) >= now)
  const past     = sorted.filter(e => new Date(e.events.starts_at) <  now)
  const nextEvent    = upcoming[0] ?? null
  const goingCount   = upcoming.filter(e => e.status === 'GOING').length
  const invitedCount = upcoming.filter(e => e.status === 'INVITED').length

  function goToEvent(e: MyEvent) {
    router.push(`/groups/${e.events.group_id}/events/${e.event_id}/view`)
  }

  if (loading) return (
    <div className="p-6 space-y-4 max-w-2xl">
      <div className="h-8 w-48 bg-slate-100 rounded-lg animate-pulse" />
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3].map(i => <div key={i} className="h-20 bg-white/40 rounded-xl animate-pulse" />)}
      </div>
      {[1,2,3].map(i => <div key={i} className="h-16 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-2xl">

      {/* ── Header + toggle ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">My Events</h1>
          <p className="text-[13px] text-slate-600 mt-0.5">{upcoming.length} à venir · {past.length} passés</p>
        </div>

        {/* Toggle Liste / Calendrier */}
        <div className="flex items-center gap-0.5 bg-slate-100 rounded-xl p-1">
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${view === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="2"  width="3" height="3" rx="0.5" fill="currentColor"/>
              <rect x="6" y="2.5" width="7" height="2" rx="1" fill="currentColor"/>
              <rect x="1" y="6"  width="3" height="3" rx="0.5" fill="currentColor"/>
              <rect x="6" y="6.5" width="7" height="2" rx="1" fill="currentColor"/>
              <rect x="1" y="10" width="3" height="3" rx="0.5" fill="currentColor"/>
              <rect x="6" y="10.5" width="7" height="2" rx="1" fill="currentColor"/>
            </svg>
            Liste
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${view === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M4.5 1v3M9.5 1v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="4.5" cy="8.5" r="1" fill="currentColor"/>
              <circle cx="7"   cy="8.5" r="1" fill="currentColor"/>
              <circle cx="9.5" cy="8.5" r="1" fill="currentColor"/>
            </svg>
            Calendrier
          </button>
        </div>
      </div>

      {/* ── Stat cards (vue liste uniquement) ───────────────────────────────── */}
      {view === 'list' && events.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-white/60 shadow-sm p-3.5"
            style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Prochain</p>
            {nextEvent ? (
              <>
                <p className="text-[22px] font-black text-[#185FA5] leading-none">
                  {daysUntil(nextEvent.events.starts_at) === 0 ? 'Auj.'
                    : daysUntil(nextEvent.events.starts_at) === 1 ? 'Dem.'
                    : `${daysUntil(nextEvent.events.starts_at)}j`}
                </p>
                <p className="text-[11px] text-slate-600 mt-1 truncate leading-tight">{nextEvent.events.title}</p>
              </>
            ) : <p className="text-[13px] text-slate-300 font-medium">—</p>}
          </div>

          <div className="rounded-xl border border-white/60 shadow-sm p-3.5"
            style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Confirmés</p>
            <p className="text-[22px] font-black text-[#3B6D11] leading-none">{goingCount}</p>
            <p className="text-[11px] text-slate-600 mt-1">évén. à venir</p>
          </div>

          <div className="rounded-xl border border-white/60 shadow-sm p-3.5"
            style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Invitations</p>
            <p className="text-[22px] font-black leading-none" style={{ color: invitedCount > 0 ? '#0C447C' : '#CBD5E1' }}>{invitedCount}</p>
            <p className="text-[11px] text-slate-600 mt-1">{invitedCount > 0 ? 'à confirmer' : 'aucune'}</p>
          </div>
        </div>
      )}

      {/* ── Vue Calendrier ──────────────────────────────────────────────────── */}
      {view === 'calendar' && (
        <CalendarView events={sorted} onView={goToEvent} />
      )}

      {/* ── Vue Liste ───────────────────────────────────────────────────────── */}
      {view === 'list' && (
        <>
          {upcoming.length > 0 && (
            <div className="mb-8">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">À venir</p>
              <div className="flex flex-col gap-2">
              {upcoming.map(e => (
              <EventCard key={e.event_id} event={e} onView={() => goToEvent(e)} onICS={() => { downloadICS(e); toast.success('Ajouté à ton calendrier !') }} />
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Passés</p>
              <div className="flex flex-col gap-2">
               {past.slice().reverse().map(e => <EventCard key={e.event_id} event={e} past onView={() => goToEvent(e)} onICS={() => { downloadICS(e); toast.success('Ajouté à ton calendrier !') }} />)}
              </div>
            </div>
          )}

          {events.length === 0 && (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">⛳</div>
              <p className="text-[15px] font-semibold text-slate-700">Aucun événement pour l'instant</p>
              <p className="text-[13px] text-slate-600 mt-1">Tu seras notifié par email lors d'une invitation</p>
            </div>
          )}
        </>
      )}

    </div>
  )
}

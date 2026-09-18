'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import { generateICS } from '@/lib/ics' 
import { geocodeEventLocation, fetchHourlyWindow, weatherCodeInfo, type HourlyPoint } from '@/lib/weather'

const supabase = createClient()

type MyEvent = {
  event_id: string
  status: 'GOING' | 'INVITED' | 'DECLINED' | 'WAITLIST'
  payment_status?: 'PENDING' | 'PAID' | 'EXEMPT' | null
  goingCount?: number
  photoCount?: number 
  events: {
    id: string
    title: string
    starts_at: string
    location: string | null
    group_id: string
    max_participants: number | null
    fee_per_person: number | null   // ← ajout
    groups: {
      name: string
      color: string | null
    }
    courses: { course_name: string; clubs: { name: string } | null } | null
  }
}

type View = 'list' | 'calendar'

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  GOING:    { bg: '#EAF3DE', text: '#3B6D11' },
  INVITED:  { bg: '#EBF3FC', text: '#0C447C' },
  DECLINED: { bg: '#FCEBEB', text: '#A32D2D' },
  WAITLIST: { bg: '#FAEEDA', text: '#854F0B' },
}

function Badge({ status }: { status: string }) {
  const t = useTranslations()
  const s = STATUS_STYLE[status] ?? { bg: '#F1F5F9', text: '#64748B' }
  const label = t(`status.${status}` as any, { default: status.toLowerCase() })
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
      style={{ background: s.bg, color: s.text }}>
      {label}
    </span>
  )
}

function formatTime(dateStr: string, locale: string) {
  return new Date(dateStr).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
}

function getDayMonth(dateStr: string, locale: string) {
  const d = new Date(dateStr)
  return {
    day:   d.toLocaleDateString(locale, { day: 'numeric', timeZone: 'UTC' }),
    month: d.toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }),
  }
}

function formatDayFull(dateStr: string, locale: string) {
  return new Date(dateStr).toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC'
  })
}

function toDateKey(dateStr: string): string {
  const d = new Date(dateStr)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}




function downloadICS(e: MyEvent) {
  const blob = new Blob([generateICS({
    eventId:  e.events.id,
    title:    e.events.title,
    startsAt: e.events.starts_at,
    location: e.events.location,
  })], { type: 'text/calendar' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${e.events.title.replace(/\s+/g, '_')}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

function daysUntil(dateStr: string): number {
  const now    = new Date(); now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  const utcTarget = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()))
  const utcNow    = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  return Math.round((utcTarget.getTime() - utcNow.getTime()) / (1000 * 60 * 60 * 24))
}

function ActionPill({ onClick, icon, label, href }: {
  onClick?: (ev: React.MouseEvent) => void; icon: React.ReactNode; label: string; href?: string
}) {
  const className = "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-600 hover:bg-white hover:text-[#185FA5] hover:shadow-sm transition-all whitespace-nowrap flex-shrink-0"
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
        {icon}<span>{label}</span>
      </a>
    )
  }
  return (
    <button onClick={onClick} className={className}>
      {icon}<span>{label}</span>
    </button>
  )
}

function EventCard({ event: e, onView, onICS, onPay, onPhotos, onWeather, past = false, locale }: {
  event: MyEvent; onView: () => void; onICS: () => void; onPay: () => void; onPhotos: () => void
  onWeather: () => void; past?: boolean; locale: string
}) {
  const t = useTranslations()
  const groupColor = e.events.groups?.color ?? '#378ADD'
  const { day, month } = getDayMonth(e.events.starts_at, locale)

  const mapsQuery = [e.events.location, e.events.courses?.course_name, e.events.courses?.clubs?.name]
    .filter(Boolean).join(' ')
  const showPhotos = true

  return (
    <div className={`bg-white border rounded-xl overflow-hidden hover:border-slate-300 hover:shadow-sm transition-all ${past ? 'opacity-55 border-slate-100' : 'border-slate-200'}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div onClick={onView} className="w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0 cursor-pointer"
          style={{ background: `${groupColor}18` }}>
          <span className="text-[13px] font-black leading-none" style={{ color: groupColor }}>{day}</span>
          <span className="text-[9px] font-bold uppercase tracking-wide leading-none mt-0.5" style={{ color: groupColor }}>{month}</span>
        </div>

        <div onClick={onView} className="flex-1 min-w-0 cursor-pointer">
          <div className="text-[13.5px] font-semibold text-slate-900 truncate leading-tight">{e.events.title}</div>
          <div className="text-[11.5px] text-slate-500 mt-0.5 truncate capitalize">
            {formatDayFull(e.events.starts_at, locale)}
          </div>
          <div className="text-[11.5px] text-slate-600 mt-0.5 flex items-center gap-1 truncate">
            <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: groupColor }} />
            <span className="truncate">{e.events.groups?.name}</span>
            <span className="flex-shrink-0">·</span>
            <span className="flex-shrink-0 font-medium">{formatTime(e.events.starts_at, locale)}</span>
            {e.events.location && (<><span className="flex-shrink-0">·</span><span className="truncate">{e.events.location}</span></>)}
          </div>
          {e.events.max_participants && (
            <span className={`text-[11px] font-medium ${
              (e.events.max_participants - (e.goingCount ?? 0)) <= 0 ? 'text-red-400'
              : (e.events.max_participants - (e.goingCount ?? 0)) <= 3 ? 'text-amber-500'
              : 'text-slate-800'}`}>
              {t('myEvents.availability.spotsLeft', { count: Math.max(0, e.events.max_participants - (e.goingCount ?? 0)) })}
            </span>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <Badge status={e.status} />

          {e.events.fee_per_person && !past && (
            e.payment_status === 'PAID' ? (
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[#EAF3DE] text-[#3B6D11]">
                ✓ Payé
              </span>
            ) : e.status === 'GOING' && (
              <button
                onClick={ev => { ev.stopPropagation(); onPay() }}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#185FA5] text-white hover:bg-[#0C447C] transition-colors">
                {t('payments.pay', { amount: e.events.fee_per_person })}
              </button>
            )
          )}
        </div>
      </div>

      {/* Barre d'actions — icône + libellé, pour que ce soit clair sans avoir à deviner */}
            <div className="flex items-center flex-wrap gap-1 px-2 py-1.5 border-t border-slate-100 bg-slate-50/60">
        <ActionPill
          onClick={ev => { ev.stopPropagation(); onICS() }}
          label={t('myEvents.calendar.addToCalendar')}
          icon={
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="2" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M1 6h14" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M5 10h2M9 10h2M5 12.5h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          }
        />

        {!past && (
          <ActionPill
            onClick={ev => { ev.stopPropagation(); onWeather() }}
            label={t('myEvents.weather')}
            icon={
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M7 1v1.5M7 12.5V14M1 7h1.5M12.5 7H14M3 3l1 1M11 11l1 1M11 3l-1 1M3 11l1-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            }
          />
        )}

        {mapsQuery && (
          <ActionPill
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`}
            onClick={ev => ev.stopPropagation()}
            label={t('myEvents.directions')}
            icon={
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 1L1 5.5v7L8 15l7-2.5v-7L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                <circle cx="8" cy="8" r="1.8" fill="currentColor"/>
              </svg>
            }
          />
        )}

        {showPhotos && (
          <ActionPill
            onClick={ev => { ev.stopPropagation(); onPhotos() }}
          label={(e.photoCount ?? 0) > 0 ? t('myEvents.photo.count', { count: e.photoCount ?? 0 }) : t('myEvents.photo.add')}
            icon={
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                <circle cx="8" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
                <path d="M5 4l1.5-2h3L11 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
          />
        )}
      </div>
    </div>
  )
}

function CalendarView({ events, onView, locale }: { events: MyEvent[]; onView: (e: MyEvent) => void; locale: string }) {
  const t = useTranslations()
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  const startOffset = (firstDay.getDay() + 6) % 7
  const totalCells  = startOffset + lastDay.getDate()
  const totalRows   = Math.ceil(totalCells / 7)

  const eventsByDay: Record<string, MyEvent[]> = {}
  for (const e of events) {
    const key = toDateKey(e.events.starts_at)
    if (!eventsByDay[key]) eventsByDay[key] = []
    eventsByDay[key].push(e)
  }

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const tKey = todayKey()
  const months = t.raw('calendar.months') as string[]
  const days   = t.raw('calendar.days') as string[]

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <button onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span className="text-[14px] font-bold text-slate-800">{months[month]} {year}</span>
        <button onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-100">
        {days.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase py-2">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: totalRows * 7 }).map((_, idx) => {
          const dayNum = idx - startOffset + 1
          const isValid = dayNum >= 1 && dayNum <= lastDay.getDate()
          const dateKey = isValid
            ? `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
            : null
          const dayEvents = dateKey ? (eventsByDay[dateKey] ?? []) : []
          const isToday   = dateKey === tKey
          const isPast    = isValid && dateKey! < tKey

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

      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-slate-100 flex-wrap">
        {Object.entries(STATUS_STYLE).map(([key, s]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: s.text }} />
            <span className="text-[10px] text-slate-500 font-medium">{t(`status.${key}` as any)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PhotoModal({ eventId, onClose, onUploaded }: { eventId: string; onClose: () => void; onUploaded?: (added: number) => void }) {
  const t = useTranslations()
  const [photos, setPhotos] = useState<{ id: string; url: string; storagePath: string; uploadedBy: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('event_photos')
      .select('id, storage_path, uploaded_by')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })

    const mapped = (data || []).map((row: { id: string; storage_path: string; uploaded_by: string | null }) => ({
      id:          row.id,
      storagePath: row.storage_path,
      uploadedBy:  row.uploaded_by,
      url:         supabase.storage.from('event-photos').getPublicUrl(row.storage_path).data.publicUrl,
    }))
    setPhotos(mapped)
    setLoading(false)
  }

  useEffect(() => {
    async function loadMyPlayerId() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: player } = await supabase.from('players').select('id').eq('user_id', user.id).single()
      setMyPlayerId(player?.id ?? null)
    }
    loadMyPlayerId()
    load()
  }, [eventId])

  async function handleDelete(photo: { id: string; storagePath: string }) {
    if (!window.confirm(t('myEvents.photo.deleteConfirm'))) return
    setDeletingId(photo.id)
    await supabase.storage.from('event-photos').remove([photo.storagePath])
    await supabase.from('event_photos').delete().eq('id', photo.id)
    await load()
    setDeletingId(null)
    onUploaded?.(-1)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: player } = await supabase.from('players').select('id').eq('user_id', user!.id).single()

    let added = 0
    for (const file of files) {
      const path = `${eventId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
      const { error } = await supabase.storage.from('event-photos').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (!error) {
        await supabase.from('event_photos').insert({
          event_id: eventId,
          storage_path: path,
          uploaded_by: player?.id,
        })
        added++
      }
    }

    await load()
    setUploading(false)
    e.target.value = ''
    if (added > 0) onUploaded?.(added)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}>
      <div className="rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-4"
  style={{ 
    background: 'rgba(255,255,255,0.75)', 
    backdropFilter: 'blur(16px)', 
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.6)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
  }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-slate-900">Photos</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>

        <label className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl p-3 mb-3 cursor-pointer transition-colors bg-white/60
          ${uploading ? 'border-slate-200 opacity-60 pointer-events-none' : 'border-slate-300 hover:border-[#185FA5] hover:bg-blue-50/40'}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-slate-400">
            <rect x="3" y="5" width="18" height="15" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="8.5" cy="10.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M3 16l5-4 4 3 3-2.5 6 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 2v5M10 4l2-2 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="text-[12px] font-semibold text-slate-600">
            {uploading ? t('myEvents.photo.uploading') : t('myEvents.photo.add')}
          </span>
          <input type="file" accept="image/*" multiple className="hidden"
            onChange={handleUpload} disabled={uploading} />
        </label>

        {loading ? (
          <div className="grid grid-cols-3 gap-2">
            {[1,2,3].map(i => <div key={i} className="aspect-square bg-slate-100 rounded-lg animate-pulse"/>)}
          </div>
        ) : photos.length === 0 ? (
          <p className="text-center text-slate-400 text-[13px] py-8">{t('myEvents.photo.empty')}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map(photo => (
              <div key={photo.id} className="relative aspect-square">
                <img src={photo.url} alt=""
                  className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90"
                  onClick={() => window.open(photo.url, '_blank')}
                  loading="lazy"
                />
                {photo.uploadedBy === myPlayerId && (
                  <button
                    onClick={ev => { ev.stopPropagation(); handleDelete(photo) }}
                    disabled={deletingId === photo.id}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-[13px] leading-none hover:bg-red-600 transition-colors disabled:opacity-50">
                    {deletingId === photo.id ? '…' : '×'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function WeatherModal({ event, onClose }: { event: MyEvent; onClose: () => void }) {
  const t = useTranslations()
  const [points, setPoints] = useState<HourlyPoint[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const geo = await geocodeEventLocation({ location: event.events.location, courses: event.events.courses })
      if (!geo) { if (!cancelled) { setUnavailable(true); setLoading(false) }; return }
      const forecast = await fetchHourlyWindow(geo.coords.lat, geo.coords.lon, event.events.starts_at, 1, 6)
      if (cancelled) return
      if (!forecast) setUnavailable(true)
      else setPoints(forecast)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [event])

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}>
      <div className="rounded-2xl w-full max-w-lg p-4"
        style={{
          background: 'rgba(255,255,255,0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.6)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-slate-900">{t('myEvents.weather')}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
        </div>
        {loading ? (
          <div className="flex gap-1.5 overflow-x-auto">
            {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="w-14 h-24 bg-slate-100 rounded-lg animate-pulse flex-shrink-0" />)}
          </div>
        ) : unavailable || !points?.length ? (
          <p className="text-center text-slate-400 text-[13px] py-6">{t('myEvents.weatherUnavailable')}</p>
        ) : (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {points.map((p, i) => {
              const info = weatherCodeInfo(p.code)
              return (
                <div key={i} className="flex flex-col items-center flex-shrink-0 w-14 py-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 mb-1">{p.label}</span>
                  <span className="text-[20px] leading-none mb-1">{info.emoji}</span>
                  <span className="text-[12px] font-bold text-slate-900">{p.temp}°</span>
                  <span className="text-[9px] text-blue-500 mt-1">💧{p.precipProb}%</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}


export default function MyEventsPage() {
  const router  = useRouter()
  const t       = useTranslations()
 
  const [events,  setEvents]  = useState<MyEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [view,    setView]    = useState<View>('list')

  const [photoEventId, setPhotoEventId] = useState<string | null>(null)
  const [weatherEventId, setWeatherEventId] = useState<string | null>(null)

  const locale = useLocale()
  const searchParams = useSearchParams()

 useEffect(() => {
  if (searchParams.get('payment') === 'success') {
    toast.success('Paiement reçu ! Merci 🎉')
  }
  loadData()
}, [])

async function loadData() {
  setLoading(true)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { setLoading(false); return }


  const { data: player } = await supabase.from('players').select('id').eq('user_id', user.id).single()
  if (!player) { setLoading(false); return }

  // ── 1. Les deux requêtes qui ne dépendent pas des event_ids ──
  const [{ data }, { data: counts }] = await Promise.all([
    supabase
      .from('event_participants')
          .select(`event_id, status, payment_status,
        events(id, title, starts_at, location, group_id,
               max_participants, fee_per_person,
               groups!events_group_id_fkey(name, color),
               courses(course_name, clubs(name)))`)
      .eq('player_id', player.id)
      .order('starts_at', { foreignTable: 'events', ascending: false }),

    supabase
      .from('event_participants')
      .select('event_id')
      .eq('status', 'GOING'),
    ])

  // ── 2. Maintenant qu'on a data, on peut extraire les ids ──
  const eventIds = (data || []).map((e: any) => e.event_id)

  const { data: photoCounts } = eventIds.length > 0
    ? await supabase
        .from('event_photo_counts')
        .select('event_id, photo_count')
        .in('event_id', eventIds)
    : { data: [] }

  // ── 3. Construire les maps ──
  const goingByEvent: Record<string, number> = {}
  for (const row of counts || []) {
  goingByEvent[row.event_id] = (goingByEvent[row.event_id] ?? 0) + 1
}

  const photoCountByEvent: Record<string, number> = {}
  for (const row of photoCounts || []) photoCountByEvent[row.event_id] = row.photo_count

  setEvents((data || []).map((e: any) => ({
    ...e,
    goingCount:  goingByEvent[e.event_id]  ?? 0,
    photoCount:  photoCountByEvent[e.event_id] ?? 0,
  })) as any)

  setLoading(false)
}

const { sorted, upcoming, past, nextEvent, goingCount, invitedCount } = useMemo(() => {
  const now    = new Date()
  const sorted = [...events].sort((a, b) =>
    new Date(a.events.starts_at).getTime() - new Date(b.events.starts_at).getTime()
  )
  const upcoming     = sorted.filter(e => new Date(e.events.starts_at) >= now)
  const past         = sorted.filter(e => new Date(e.events.starts_at) <  now)
  const nextEvent    = upcoming[0] ?? null
  const goingCount   = upcoming.filter(e => e.status === 'GOING').length
  const invitedCount = upcoming.filter(e => e.status === 'INVITED').length
  return { sorted, upcoming, past, nextEvent, goingCount, invitedCount }
}, [events])

  function goToEvent(e: MyEvent) {
    localStorage.setItem(`golfgo-active-event-${e.events.group_id}`, e.event_id)
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

      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">{t('myEvents.title')}</h1>
          <p className="text-[13px] text-slate-900 mt-0.5">{t('myEvents.subtitle', { upcoming: upcoming.length, past: past.length })}</p>
        </div>

        {/* ── Contrôles droite ── */}
        <div className="flex flex-col items-end gap-2">

          {/* Toggle Liste / Calendrier */}
          <div className="flex items-center gap-0.5 bg-slate-100 rounded-xl p-1">
            <button onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${view === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="2"  width="3" height="3" rx="0.5" fill="currentColor"/>
                <rect x="6" y="2.5" width="7" height="2" rx="1" fill="currentColor"/>
                <rect x="1" y="6"  width="3" height="3" rx="0.5" fill="currentColor"/>
                <rect x="6" y="6.5" width="7" height="2" rx="1" fill="currentColor"/>
                <rect x="1" y="10" width="3" height="3" rx="0.5" fill="currentColor"/>
                <rect x="6" y="10.5" width="7" height="2" rx="1" fill="currentColor"/>
              </svg>
              {t('myEvents.views.list')}
            </button>
            <button onClick={() => setView('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${view === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M1 5.5h12" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M4.5 1v3M9.5 1v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <circle cx="4.5" cy="8.5" r="1" fill="currentColor"/>
                <circle cx="7"   cy="8.5" r="1" fill="currentColor"/>
                <circle cx="9.5" cy="8.5" r="1" fill="currentColor"/>
              </svg>
              {t('myEvents.views.calendar')}
            </button>
          </div>

          {/* Bouton Mes partenaires — icône seule sur mobile, texte sur sm+ */}
          <a href="/my-events/partners"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all border border-[#B5D4F4] bg-[#EBF3FC] text-[#185FA5] hover:bg-[#185FA5] hover:text-white hover:border-[#185FA5]"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
              <circle cx="8"  cy="4"  r="2"   stroke="currentColor" strokeWidth="1.4"/>
              <circle cx="3"  cy="12" r="1.8" stroke="currentColor" strokeWidth="1.4"/>
              <circle cx="13" cy="12" r="1.8" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M8 6v2.5M8 8.5L3 10.2M8 8.5L13 10.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
           <span className="hidden sm:inline">{t('myEvents.partners')}</span>
           <span className="sm:hidden">{t('myEvents.partnersMobile')}</span>
          </a>

        </div>
      </div>

      {view === 'list' && events.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-white/60 shadow-sm p-3.5"
            style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t('myEvents.stats.next')}</p>
            {nextEvent ? (
              <>
                <p className="text-[22px] font-black text-[#185FA5] leading-none">
                  {daysUntil(nextEvent.events.starts_at) === 0 ? t('myEvents.countdown.today')
                    : daysUntil(nextEvent.events.starts_at) === 1 ? t('myEvents.countdown.tomorrow')
                    : t('myEvents.countdown.days', { count: daysUntil(nextEvent.events.starts_at) })}
                </p>
                <p className="text-[11px] text-slate-600 mt-1 truncate leading-tight">{nextEvent.events.title}</p>
              </>
            ) : <p className="text-[13px] text-slate-300 font-medium">{t('common.noData')}</p>}
          </div>

          <div className="rounded-xl border border-white/60 shadow-sm p-3.5"
            style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t('myEvents.stats.confirmed')}</p>
            <p className="text-[22px] font-black text-[#3B6D11] leading-none">{goingCount}</p>
            <p className="text-[11px] text-slate-600 mt-1">{t('myEvents.stats.upcomingEvents')}</p>
          </div>

          <div className="rounded-xl border border-white/60 shadow-sm p-3.5"
            style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t('myEvents.stats.invitations')}</p>
            <p className="text-[22px] font-black leading-none" style={{ color: invitedCount > 0 ? '#0C447C' : '#CBD5E1' }}>{invitedCount}</p>
            <p className="text-[11px] text-slate-600 mt-1">{invitedCount > 0 ? t('myEvents.stats.toConfirm') : t('myEvents.stats.none')}</p>
          </div>
        </div>
      )}

      {view === 'calendar' && (
        <CalendarView events={sorted} onView={goToEvent} locale={locale} />
      )}

      {view === 'list' && (
        <>
          {upcoming.length > 0 && (
            <div className="mb-8">
              <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-3">{t('myEvents.sections.upcoming')}</p>
              <div className="flex flex-col gap-2">
                {upcoming.map(e => (
                  <EventCard key={e.event_id} event={e} locale={
                    locale} onView={() => goToEvent(e)}
                    onPay={() => router.push(`/${locale}/my-events/${e.event_id}/pay`)}
                    onICS={() => { downloadICS(e); toast.success(t('myEvents.calendar.toastSuccess')) }} 
                     onPhotos={() => setPhotoEventId(e.event_id)}
                     onWeather={() => setWeatherEventId(e.event_id)} />
                ))}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-3">{t('myEvents.sections.past')}</p>
              <div className="flex flex-col gap-2">
                          {past.slice().reverse().map(e => (
                  <EventCard key={e.event_id} event={e} past locale={locale} 
                    onView={() => goToEvent(e)}
                    onPay={() => {}}
                    onICS={() => { downloadICS(e); toast.success(t('myEvents.calendar.toastSuccess')) }} 
                     onPhotos={() => setPhotoEventId(e.event_id)}
                     onWeather={() => setWeatherEventId(e.event_id)} />
                ))}
              </div>
            </div>
          )}

         {events.length === 0 && (
      <div className="flex justify-center py-12">
        <div className="text-center px-8 py-10 rounded-2xl max-w-sm w-full"
          style={{
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.6)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          }}>
          <div className="text-5xl mb-4">⛳</div>
          <p className="text-[15px] font-semibold text-slate-800">{t('myEvents.empty.title')}</p>
          <p className="text-[13px] text-slate-500 mt-1.5 leading-relaxed">{t('myEvents.empty.subtitle')}</p>
        </div>
      </div>
    )}
            </>
      )}
       {photoEventId && (
  <PhotoModal eventId={photoEventId} onClose={() => setPhotoEventId(null)}
    onUploaded={added => setEvents(prev => prev.map(e =>
      e.event_id === photoEventId ? { ...e, photoCount: (e.photoCount ?? 0) + added } : e
    ))}
  />
)}
{weatherEventId && (() => {
  const weatherEvent = events.find(e => e.event_id === weatherEventId)
  return weatherEvent ? <WeatherModal event={weatherEvent} onClose={() => setWeatherEventId(null)} /> : null
})()}
    </div>
  )
}

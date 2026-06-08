'use client'

import { useEffect, useState, useMemo, useRef} from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useGroupRole } from '@/lib/hooks/useGroupRole'
import EventPillSelector, { useNearestEvent } from '@/components/events/EventPillSelector'
import toast from 'react-hot-toast'
import EmailPreviewModal from '@/components/email/EmailPreviewModal'
import { useTranslations, useLocale } from 'next-intl'

const supabase = createClient()

type HolesSection = 'out' | 'in' | null
type FlightPlayer = {
  id: string; first_name: string; surname: string; whs: number | null
  holes_played?: number | null; holes_section?: HolesSection
}
type Flight = { flight_number: number; players: FlightPlayer[] }

function HolesBadge({ p }: { p: FlightPlayer }) {
  if (!p.holes_played || p.holes_played === 18) return null
  const label = p.holes_section === 'out' ? '9F' : p.holes_section === 'in' ? '9B' : '9H'
  const cls   = p.holes_section === 'in' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${cls}`}>{label}</span>
}

// ── Bouton icône compact ──────────────────────────────────────────────────────
function IconBtn({ onClick, href, title, disabled, active, children }: {
  onClick?: () => void; href?: string; title: string
  disabled?: boolean; active?: boolean; children: React.ReactNode
}) {
  const cls = `w-9 h-9 flex items-center justify-center rounded-xl border text-[16px] transition-colors flex-shrink-0 ${
    disabled
      ? 'border-slate-200 text-slate-300 bg-slate-50 cursor-not-allowed'
      : active
        ? 'border-[#185FA5] bg-[#185FA5] text-white'
        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
  }`
  if (href) return (
    <a href={disabled ? undefined : href} target="_blank" rel="noopener noreferrer"
      title={title} className={cls} style={disabled ? { pointerEvents: 'none' } : {}}>
      {children}
    </a>
  )
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={cls}>
      {children}
    </button>
  )
}

export default function TeeSheetPage() {
  const params           = useParams()
  const groupId          = params.id as string
  const eventIdFromRoute = params.eventId as string
  const t                = useTranslations()
  const locale           = useLocale()

  const { role, loading: roleLoading } = useGroupRole(groupId)
  const isOwner = role === 'owner'

  const { nearestEventId, loading: nearestLoading } = useNearestEvent(groupId)
  const [selectedEventId, setSelectedEventId] = useState<string>(eventIdFromRoute)

  const [flights,      setFlights]      = useState<Flight[]>([])
  const [eventTitle,   setEventTitle]   = useState('')
  const [eventDate,    setEventDate]    = useState('')
  const [startsAt,     setStartsAt]     = useState<string | null>(null)
  const [interval,     setInterval]     = useState(9)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [sending,      setSending]      = useState(false)

  const [showPreview,  setShowPreview]  = useState(false)

  useEffect(() => {
    if (!eventIdFromRoute && nearestEventId && !nearestLoading) setSelectedEventId(nearestEventId)
  }, [nearestEventId, nearestLoading, eventIdFromRoute])

  useEffect(() => { if (selectedEventId) loadData(selectedEventId) }, [selectedEventId])

 const isFirstLoad = useRef(true)

useEffect(() => {
  if (!selectedEventId) return
  if (isFirstLoad.current) { isFirstLoad.current = false; return }
  supabase.from('events')
    .update({ tee_interval: interval })
    .eq('id', selectedEventId)
    .then(() => {})
}, [interval, selectedEventId])

  async function loadData(evId: string) {
  setLoading(true); setError(null)
  
  const { data: event } = await supabase.from('events')
    .select('title, starts_at').eq('id', evId).single()
  
  if (event) {
    setEventTitle(event.title)
    setStartsAt(event.starts_at)
    setEventDate(new Date(event.starts_at).toLocaleDateString(locale, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }))
  }

  // Paralléliser flights et participants
  const [{ data: flightsData, error: fErr }, { data: participants }] = await Promise.all([
    supabase.from('flights')
      .select(`id, flight_number, flight_players(player_id, players(id, first_name, surname, whs))`)
      .eq('event_id', evId).order('flight_number'),
    supabase.from('event_participants')
      .select('player_id, holes_played, holes_section').eq('event_id', evId)
  ])

  if (fErr) { setError(fErr.message); setLoading(false); return }

  const holesMap: Record<string, { holes_played: number | null; holes_section: HolesSection }> = {}
  participants?.forEach(p => { holesMap[p.player_id] = { holes_played: p.holes_played, holes_section: p.holes_section as HolesSection } })

  const built: Flight[] = (flightsData || []).map((f: any) => ({
    flight_number: f.flight_number,
    players: (f.flight_players || []).map((fp: any) => ({
      ...fp.players,
      holes_played:  holesMap[fp.player_id]?.holes_played  ?? null,
      holes_section: holesMap[fp.player_id]?.holes_section ?? null,
    })).filter(Boolean),
  }))
  built.sort((a, b) => a.players.length - b.players.length)
  setFlights(built.map((f, i) => ({ ...f, flight_number: i + 1 })))
  setLoading(false)
}

 const flightTimes = useMemo(() =>
  flights.map((_, i) => {
    if (!startsAt) return t('common.noData')
    const ms = new Date(startsAt).getTime() + i * interval * 60 * 1000
    return new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
  })
, [flights, startsAt, interval, locale])

  function buildWhatsAppTeesheet(): string {
    const lines = [`📋 *${eventTitle}* — ${eventDate}`, '']
    flights.forEach((f, i) => {
      lines.push(`*Flight ${f.flight_number}* — ${flightTimes[i]}`)
      f.players.forEach(p => lines.push(`  • ${p.first_name} ${p.surname}${p.whs !== null ? ` (${Number(p.whs).toFixed(1)})` : ''}`))
      lines.push('')
    })
    return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`
  }

  async function handleSendEmail() {
    setSending(true)
    try {
      const teesheetFlights = flights.map((f, index) => ({
        flight_number: f.flight_number, start_time: flightTimes[index], players: f.players,
      }))
      const res = await fetch('/api/send-teesheet', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: selectedEventId, flights: teesheetFlights }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? t('common.error'))
      const skippedStr = result.skipped > 0 ? t('teesheet.email.skippedSuffix', { count: result.skipped }) : ''
      toast.success(t('teesheet.email.successToast', { sent: result.sent, skipped: skippedStr }))
    } catch (e: any) {
      toast.error(e.message ?? t('common.error'))
    } finally { setSending(false) }
  }

  if (nearestLoading || roleLoading) return (
    <div className="p-6 space-y-3 max-w-2xl">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-2xl">

      {/* Print header/footer */}
      <div className="print-header">
        <div className="print-logo">
          <span className="print-logo-golf">Golf</span>
          <span className="print-logo-go">Go</span>
        </div>
        <div className="print-event-info">
          <div className="print-event-title">{eventTitle}</div>
          <div className="print-event-date">{eventDate}</div>
        </div>
      </div>
      <div className="print-footer">
        <span>{t('teesheet.printFooter.siteUrl')}</span>
        <span>{t('teesheet.printFooter.printedOn', { date: new Date().toLocaleDateString(locale) })}</span>
      </div>

      {/* ── Header ── */}
  
      <div className="print:hidden mb-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">{t('teesheet.title')}</h1>
          <div className="flex items-center gap-1.5">
         
            <IconBtn onClick={() => window.print()} title={t('teesheet.print')}>🖨</IconBtn>
            {isOwner && flights.length > 0 && <>
          
              <IconBtn onClick={() => setShowPreview(true)} disabled={!isOwner || flights.length === 0} title={t('teesheet.email.preview')}>👁</IconBtn>
            
              <IconBtn onClick={handleSendEmail} disabled={!isOwner || sending || flights.length === 0} title={sending ? t('teesheet.email.sending') : t('teesheet.email.send')}>
                {sending ? '⏳' : '📤'}
              </IconBtn>
              {/* 💬 WhatsApp */}
              <IconBtn href={flights.length > 0 ? buildWhatsAppTeesheet() : undefined} disabled={flights.length === 0} title="WhatsApp">💬</IconBtn>
            </>}
          </div>
        </div>
        <div className="flex items-center gap-2">
    <select value={interval} onChange={e => setInterval(Number(e.target.value))}
      className="border border-slate-200 rounded-xl px-2 py-1.5 text-[12px] bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30">
      {[6,7,8,9,10,12,15].map(v => <option key={v} value={v}>{t('teesheet.intervalUnit', { count: v })}</option>)}
    </select>
  </div>
</div>

      <div className="mb-5 print:hidden">
        <EventPillSelector
          groupId={groupId}
          selectedEventId={selectedEventId}
          onChange={id => setSelectedEventId(id)}
        />
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-600 font-medium">{error}</div>}

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-white/40 rounded-xl animate-pulse" />)}
        </div>
      ) : flights.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl text-[13px] text-slate-500">
          {t('teesheet.empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {flights.map((flight, index) => (
            <div key={flight.flight_number} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                <span className="text-[13px] font-black text-slate-800">{t('teesheet.flight', { number: flight.flight_number })}</span>
                <span className="text-[15px] font-black text-[#185FA5]">{flightTimes[index]}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {flight.players.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[11px] text-slate-300 w-4">{i + 1}</span>
                      <span className="text-[13px] font-semibold text-slate-800">{p.first_name} {p.surname}</span>
                      <HolesBadge p={p} />
                    </div>
                    {p.whs !== null && (
                      <span className="text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-lg font-mono">
                        {Number(p.whs).toFixed(1)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showPreview && (
        <EmailPreviewModal
          onClose={() => setShowPreview(false)}
          onConfirm={() => { setShowPreview(false); handleSendEmail() }}
          confirmLabel={t('teesheet.email.confirmLabel')}
          loading={sending}
          fetchPreview={() => fetch('/api/preview-email', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'teesheet', eventId: selectedEventId,
              flights: flights.map((f, i) => ({ ...f, start_time: flightTimes[i] })),
            }),
          }).then(r => r.json())}
        />
      )}

      <style jsx global>{`
        @media print {
          nav, header, aside, .print\\:hidden { display: none !important; }
          body { background: white; margin: 0; }
          .print-header { display: flex !important; align-items: center; justify-content: space-between; padding: 16px 0 12px; border-bottom: 3px solid #185FA5; margin-bottom: 20px; }
          .print-logo { display: flex !important; align-items: baseline; }
          .print-logo-golf { font-size: 22px; font-weight: 900; color: #185FA5; letter-spacing: -0.5px; }
          .print-logo-go   { font-size: 22px; font-weight: 900; color: #4CAF1A; letter-spacing: -0.5px; }
          .print-event-info { text-align: right; }
          .print-event-title { font-size: 15px; font-weight: 700; color: #1a1a1a; }
          .print-event-date  { font-size: 12px; color: #6B7280; margin-top: 2px; }
          .p-5 { padding: 24px 32px; }
          .flex.flex-col.gap-3 { gap: 12px; }
          .bg-white.border { border: 1px solid #E5E7EB !important; border-radius: 8px !important; overflow: hidden; break-inside: avoid; }
          .bg-slate-50.border-b { background: #185FA5 !important; padding: 8px 16px !important; }
          .bg-slate-50.border-b span:first-child { color: white !important; font-size: 13px !important; font-weight: 700 !important; }
          .bg-slate-50.border-b span:last-child  { color: #4CAF1A !important; font-size: 15px !important; font-weight: 900 !important; }
          .divide-y > div { padding: 7px 16px !important; }
          .divide-y > div:nth-child(even) { background: #F8FAFF !important; }
          .font-mono { background: #E6F1FB !important; color: #185FA5 !important; font-weight: 600 !important; padding: 2px 6px !important; border-radius: 4px !important; }
          .print-footer { display: flex !important; justify-content: space-between; margin-top: 24px; padding-top: 12px; border-top: 1px solid #E5E7EB; font-size: 10px; color: #9CA3AF; }
        }
        .print-header, .print-logo, .print-footer { display: none; }
      `}</style>
    </div>
  )
}

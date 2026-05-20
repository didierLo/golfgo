'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useGroupRole } from '@/lib/hooks/useGroupRole'
import { useWhatsAppLink } from '@/lib/hooks/useWhatsAppLink'
import EventPillSelector, { useNearestEvent } from '@/components/events/EventPillSelector'
import toast from 'react-hot-toast'
import EmailPreviewModal from '@/components/email/EmailPreviewModal'
import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'

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
  const cls   = p.holes_section === 'in'
    ? 'bg-orange-100 text-orange-700'
    : 'bg-amber-100 text-amber-700'
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${cls}`}>{label}</span>
}

const WhatsAppIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

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

  const { whatsappLink, loading: waLoading } = useWhatsAppLink(selectedEventId || null, groupId)

  const [flights,       setFlights]       = useState<Flight[]>([])
  const [eventTitle,    setEventTitle]    = useState('')
  const [eventDate,     setEventDate]     = useState('')
  const [startsAt,      setStartsAt]      = useState<string | null>(null)
  const [interval,      setInterval]      = useState(9)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [sending,       setSending]       = useState(false)
  const [emailEnabled,  setEmailEnabled]  = useState(false)
  const [showPreview,   setShowPreview]   = useState(false)

  useEffect(() => {
    if (!eventIdFromRoute && nearestEventId && !nearestLoading) setSelectedEventId(nearestEventId)
  }, [nearestEventId, nearestLoading, eventIdFromRoute])

  useEffect(() => { if (selectedEventId) loadData(selectedEventId) }, [selectedEventId])

  async function loadData(evId: string) {
    setLoading(true); setError(null)
    const { data: event } = await supabase.from('events').select('title, starts_at').eq('id', evId).single()
    if (event) {
      setEventTitle(event.title)
      setStartsAt(event.starts_at)
      setEventDate(new Date(event.starts_at).toLocaleDateString(locale, {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
      }))
    }

    const { data: flightsData, error: fErr } = await supabase
      .from('flights')
      .select(`id, flight_number, flight_players(player_id, players(id, first_name, surname, whs))`)
      .eq('event_id', evId).order('flight_number')
    if (fErr) { setError(fErr.message); setLoading(false); return }

    const { data: participants } = await supabase
      .from('event_participants')
      .select('player_id, holes_played, holes_section')
      .eq('event_id', evId)

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

  function getFlightTime(flightIndex: number): string {
    if (!startsAt) return t('common.noData')
    const ms = new Date(startsAt).getTime() + flightIndex * interval * 60 * 1000
    return new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
  }

  function buildWhatsAppTeesheet(): string {
    // Si un lien WhatsApp est configuré, on ouvre directement le groupe
    if (whatsappLink) return whatsappLink
    // Sinon, message pré-rempli
    const lines = [`📋 *${eventTitle}* — ${eventDate}`, '']
    flights.forEach((f, i) => {
      lines.push(`*Flight ${f.flight_number}* — ${getFlightTime(i)}`)
      f.players.forEach(p => lines.push(`  • ${p.first_name} ${p.surname}${p.whs !== null ? ` (${Number(p.whs).toFixed(1)})` : ''}`))
      lines.push('')
    })
    return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`
  }

  async function handleSendEmail() {
    setSending(true)
    try {
      const teesheetFlights = flights.map((f, index) => ({
        flight_number: f.flight_number, start_time: getFlightTime(index), players: f.players,
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

  const canSend = emailEnabled && !sending

  return (
    <div className="p-5 sm:p-6 max-w-2xl">

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

      <div className="flex items-start justify-between mb-4 flex-wrap gap-3 print:hidden">
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">{t('teesheet.title')}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-[12px] font-semibold text-slate-900">{t('teesheet.interval')}</label>
          <select value={interval} onChange={e => setInterval(Number(e.target.value))}
            className="border border-slate-200 rounded-xl px-3 py-2 text-[13px] bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30">
            {[6,7,8,9,10,12,15].map(v => <option key={v} value={v}>{t('teesheet.intervalUnit', { count: v })}</option>)}
          </select>
          <button onClick={() => window.print()}
            className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            {t('teesheet.print')}
          </button>
        </div>
      </div>

      <div className="mb-5 print:hidden">
        <EventPillSelector
          groupId={groupId}
          selectedEventId={selectedEventId}
          onChange={id => { setSelectedEventId(id); setEmailEnabled(false) }}
        />
      </div>

      {/* ── Bandeau WhatsApp non configuré (admin uniquement) ── */}
      {isOwner && !waLoading && !whatsappLink && selectedEventId && (
        <div className="flex items-center justify-between gap-3 mb-4 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 print:hidden">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <p className="text-[12px] text-amber-800 font-medium">
              {t('whatsapp.noGroupConfigured')}
            </p>
          </div>
          <Link href={`/groups/${groupId}/edit`}
            className="text-[11px] font-bold text-amber-700 hover:underline whitespace-nowrap">
            {t('whatsapp.configureNow')}
          </Link>
        </div>
      )}

      {isOwner && flights.length > 0 && (
        <div className="flex items-center justify-between gap-4 mb-5 p-4 bg-white border border-slate-200 rounded-xl print:hidden">
          <div className="flex items-start gap-3">
            <button type="button" role="switch" aria-checked={emailEnabled}
              onClick={() => setEmailEnabled(v => !v)}
              style={{ backgroundColor: emailEnabled ? '#185FA5' : '#CBD5E1', transition: 'background-color 0.2s' }}
              className="mt-0.5 w-9 h-5 rounded-full flex items-center px-0.5 flex-shrink-0 cursor-pointer">
              <div style={{ transform: emailEnabled ? 'translateX(16px)' : 'translateX(0)', transition: 'transform 0.2s' }}
                className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </button>
            <div>
              <p className="text-[13px] font-semibold text-slate-800">{t('teesheet.email.label')}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{t('teesheet.email.description')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowPreview(true)} disabled={!emailEnabled}
              className={`flex-shrink-0 text-[12px] font-semibold px-4 py-2 rounded-xl border transition-colors ${
                emailEnabled ? 'border-slate-300 text-slate-600 hover:bg-slate-50 cursor-pointer' : 'border-slate-200 text-slate-300 bg-slate-50 cursor-not-allowed'}`}>
              {t('teesheet.email.preview')}
            </button>
            <button type="button" onClick={canSend ? handleSendEmail : undefined} disabled={!canSend}
              className={`flex-shrink-0 text-[12px] font-semibold px-4 py-2 rounded-xl border transition-colors ${
                canSend ? 'border-[#185FA5] text-[#185FA5] hover:bg-blue-50 cursor-pointer' : 'border-slate-200 text-slate-300 bg-slate-50 cursor-not-allowed'}`}>
              {sending ? t('teesheet.email.sending') : t('teesheet.email.send')}
            </button>
            <a
              href={buildWhatsAppTeesheet()}
              target="_blank"
              rel="noopener noreferrer"
              title={whatsappLink ? t('whatsapp.openGroup') : t('whatsapp.sendMessage')}
              className="flex-shrink-0 flex items-center gap-1.5 text-[12px] font-semibold px-4 py-2 rounded-xl border border-[#25D366] text-[#25D366] hover:bg-green-50 transition-colors">
              <WhatsAppIcon />
              WhatsApp
            </a>
          </div>
        </div>
      )}

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
                <span className="text-[15px] font-black text-[#185FA5]">{getFlightTime(index)}</span>
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
              flights: flights.map((f, i) => ({ ...f, start_time: getFlightTime(i) })),
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

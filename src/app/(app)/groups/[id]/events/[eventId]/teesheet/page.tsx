'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useGroupRole } from '@/lib/hooks/useGroupRole'
import EventPillSelector, { useNearestEvent } from '@/components/events/EventPillSelector'
import toast from 'react-hot-toast'
import EmailPreviewModal from '@/components/email/EmailPreviewModal'

const supabase = createClient()

type FlightPlayer = { id: string; first_name: string; surname: string; whs: number | null; holes_played?: number | null }
type Flight = { flight_number: number; players: FlightPlayer[] }

export default function TeeSheetPage() {
  const params  = useParams()
  const groupId = params.id as string
  const eventIdFromRoute = params.eventId as string

  const { role, loading: roleLoading } = useGroupRole(groupId)
  const isOwner = role === 'owner'

  const { nearestEventId, loading: nearestLoading } = useNearestEvent(groupId)
  const [selectedEventId, setSelectedEventId] = useState<string>(eventIdFromRoute)

  const [flights, setFlights]           = useState<Flight[]>([])
  const [eventTitle, setEventTitle]     = useState('')
  const [eventDate, setEventDate]       = useState('')
  const [startsAt, setStartsAt]         = useState<string | null>(null)
  const [interval, setInterval]         = useState(9)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [sending, setSending]           = useState(false)
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [showPreview, setShowPreview]   = useState(false)

  useEffect(() => {
    if (!eventIdFromRoute && nearestEventId && !nearestLoading) {
      setSelectedEventId(nearestEventId)
    }
  }, [nearestEventId, nearestLoading, eventIdFromRoute])

  useEffect(() => {
    if (selectedEventId) loadData(selectedEventId)
  }, [selectedEventId])

  async function loadData(evId: string) {
    setLoading(true); setError(null)
    const { data: event } = await supabase.from('events').select('title, starts_at').eq('id', evId).single()
    if (event) {
      setEventTitle(event.title)
      setStartsAt(event.starts_at)
      setEventDate(new Date(event.starts_at).toLocaleDateString('fr-BE', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
      }))
    }

    const { data: flightsData, error: fErr } = await supabase
      .from('flights')
      .select(`id, flight_number, flight_players(player_id, players(id, first_name, surname, whs))`)
      .eq('event_id', evId).order('flight_number')
    if (fErr) { setError(fErr.message); setLoading(false); return }

    // Charger holes_played depuis event_participants
    const { data: participants } = await supabase
      .from('event_participants')
      .select('player_id, holes_played')
      .eq('event_id', evId)
    const holesMap: Record<string, number | null> = {}
    participants?.forEach(p => { holesMap[p.player_id] = p.holes_played })

    const built: Flight[] = (flightsData || []).map((f: any) => ({
      flight_number: f.flight_number,
      players: (f.flight_players || []).map((fp: any) => ({
        ...fp.players,
        holes_played: holesMap[fp.player_id] ?? null,
      })).filter(Boolean),
    }))
    built.sort((a, b) => a.players.length - b.players.length)
    const renumbered = built.map((f, i) => ({ ...f, flight_number: i + 1 }))
    setFlights(renumbered)
    setLoading(false)
  }

  function getFlightTime(flightIndex: number): string {
    if (!startsAt) return '—'
    const ms = new Date(startsAt).getTime() + flightIndex * interval * 60 * 1000
    return new Date(ms).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
  }

  async function handleSendEmail() {
    setSending(true)
    try {
      const teesheetFlights = flights.map((f, index) => ({
        flight_number: f.flight_number,
        start_time: getFlightTime(index),
        players: f.players,
      }))
      const res = await fetch('/api/send-teesheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: selectedEventId, flights: teesheetFlights }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? 'Erreur envoi')
      toast.success(`Tee sheet envoyée à ${result.sent} joueur(s)${result.skipped > 0 ? ` · ${result.skipped} sans email` : ''}`)
    } catch (e: any) {
      toast.error(e.message ?? 'Erreur')
    } finally {
      setSending(false)
    }
  }

  if (nearestLoading || roleLoading) return (
    <div className="p-6 space-y-3 max-w-2xl">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  )

  const canSend = emailEnabled && !sending

  return (
    <div className="p-5 sm:p-6 max-w-2xl">

      {/* Header print */}
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
        <span>GolfGo — golfgo-drab.vercel.app</span>
        <span>Imprimé le {new Date().toLocaleDateString('fr-BE')}</span>
      </div>

      {/* Header web */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Tee Sheet</h1>
         {/*{eventDate && <p className="text-[12px] text-slate-500 mt-0.5">{eventDate}</p>}"*/}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-[12px] font-semibold text-slate-900">Intervalle</label>
          <select value={interval} onChange={e => setInterval(Number(e.target.value))}
            className="border border-slate-200 rounded-xl px-3 py-2 text-[13px] bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30">
            {[6,7,8,9,10,12,15].map(v => <option key={v} value={v}>{v} min</option>)}
          </select>
          <button onClick={() => window.print()}
            className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            🖨 Imprimer
          </button>
        </div>
      </div>

      {/* Pill sélecteur event */}
      <div className="mb-5 print:hidden">
        <EventPillSelector
          groupId={groupId}
          selectedEventId={selectedEventId}
          onChange={id => { setSelectedEventId(id); setEmailEnabled(false) }}
        />
      </div>

      {/* Envoi email */}
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
              <p className="text-[13px] font-semibold text-slate-800">Envoyer la tee sheet par email</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Chaque participant GOING recevra la tee sheet avec son flight mis en évidence
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowPreview(true)} disabled={!emailEnabled}
              className={`flex-shrink-0 text-[12px] font-semibold px-4 py-2 rounded-xl border transition-colors ${
                emailEnabled
                  ? 'border-slate-300 text-slate-600 hover:bg-slate-50 cursor-pointer'
                  : 'border-slate-200 text-slate-300 bg-slate-50 cursor-not-allowed'
              }`}>
              👁 Aperçu
            </button>
            <button type="button" onClick={canSend ? handleSendEmail : undefined} disabled={!canSend}
              className={`flex-shrink-0 text-[12px] font-semibold px-4 py-2 rounded-xl border transition-colors ${
                canSend
                  ? 'border-[#185FA5] text-[#185FA5] hover:bg-blue-50 cursor-pointer'
                  : 'border-slate-200 text-slate-300 bg-slate-50 cursor-not-allowed'
              }`}>
              {sending ? 'Envoi…' : '✉ Envoyer'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-600 font-medium">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-white/40 rounded-xl animate-pulse" />)}
        </div>
      ) : flights.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl text-[13px] text-slate-500">
          Aucun flight généré — génère les flights d'abord dans l'onglet Flights
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {flights.map((flight, index) => (
            <div key={flight.flight_number} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                <span className="text-[13px] font-black text-slate-800">Flight {flight.flight_number}</span>
                <span className="text-[15px] font-black text-[#185FA5]">{getFlightTime(index)}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {flight.players.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[11px] text-slate-300 w-4">{i + 1}</span>
                      <span className="text-[13px] font-semibold text-slate-800">{p.first_name} {p.surname}</span>
                      {p.holes_played === 9 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700">9T</span>
                      )}
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

      {/* Modal aperçu email */}
      {showPreview && (
        <EmailPreviewModal
          onClose={() => setShowPreview(false)}
          onConfirm={() => { setShowPreview(false); handleSendEmail() }}
          confirmLabel="Envoyer la tee sheet"
          loading={sending}
          fetchPreview={() => fetch('/api/preview-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'teesheet',
              eventId: selectedEventId,
              flights: flights.map((f, i) => ({ ...f, start_time: getFlightTime(i) })),
            }),
          }).then(r => r.json())}
        />
      )}

      <style jsx global>{`
        @media print {
          nav, header, aside, .print\\:hidden { display: none !important; }
          body { background: white; margin: 0; }
          .print-header {
            display: flex !important; align-items: center; justify-content: space-between;
            padding: 16px 0 12px; border-bottom: 3px solid #185FA5; margin-bottom: 20px;
          }
          .print-logo { display: flex !important; align-items: baseline; }
          .print-logo-golf { font-size: 22px; font-weight: 900; color: #185FA5; letter-spacing: -0.5px; }
          .print-logo-go   { font-size: 22px; font-weight: 900; color: #4CAF1A; letter-spacing: -0.5px; }
          .print-event-info { text-align: right; }
          .print-event-title { font-size: 15px; font-weight: 700; color: #1a1a1a; }
          .print-event-date  { font-size: 12px; color: #6B7280; margin-top: 2px; }
          .p-5 > div:nth-child(3) { display: none !important; }
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

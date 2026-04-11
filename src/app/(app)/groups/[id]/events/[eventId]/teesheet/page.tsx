'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useGroupRole } from '@/lib/hooks/useGroupRole'
import toast from 'react-hot-toast'

const supabase = createClient()

type FlightPlayer = { id: string; first_name: string; surname: string; whs: number | null }
type Flight = { flight_number: number; players: FlightPlayer[] }

export default function TeeSheetPage() {
  const params   = useParams()
  const groupId  = params.id as string
  const eventId  = params.eventId as string

  const { role, loading: roleLoading } = useGroupRole(groupId)
  const isOwner = role === 'owner'

  const [flights, setFlights]       = useState<Flight[]>([])
  const [eventTitle, setEventTitle] = useState('')
  const [eventDate, setEventDate]   = useState('')
  const [startsAt, setStartsAt]     = useState<string | null>(null)
  const [interval, setInterval]     = useState(8)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [sending, setSending]       = useState(false)
  const [emailEnabled, setEmailEnabled] = useState(false)

  useEffect(() => { loadData() }, [eventId])

  async function loadData() {
    setLoading(true)
    setError(null)

    const { data: event } = await supabase
      .from('events').select('title, starts_at').eq('id', eventId).single()
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
      .eq('event_id', eventId)
      .order('flight_number')

    if (fErr) { setError(fErr.message); setLoading(false); return }

    const built: Flight[] = (flightsData || []).map((f: any) => ({
      flight_number: f.flight_number,
      players: (f.flight_players || []).map((fp: any) => fp.players).filter(Boolean),
    }))

    setFlights(built)
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
        start_time:    getFlightTime(index),
        players:       f.players,
      }))

      const res = await fetch('/api/send-teesheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, flights: teesheetFlights }),
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

  if (loading || roleLoading) return (
    <div className="p-6 space-y-3 max-w-2xl">
      {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}
    </div>
  )

  const canSend = emailEnabled && !sending

  return (
    <div className="p-6 max-w-2xl">

      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-[18px] font-medium text-gray-900">Tee Sheet</h1>
          {eventTitle && <p className="text-[13px] text-gray-400 mt-0.5">{eventTitle}</p>}
          {eventDate  && <p className="text-[12px] text-gray-400">{eventDate}</p>}
        </div>

        <div className="flex items-center gap-2 flex-wrap print:hidden">
          <label className="text-[12px] text-gray-500">Intervalle</label>
          <select value={interval} onChange={e => setInterval(Number(e.target.value))}
            className="border border-gray-200 rounded-md px-2 py-1.5 text-[13px] bg-white focus:outline-none focus:border-blue-300">
            {[6, 7, 8, 9, 10, 12, 15].map(v => (
              <option key={v} value={v}>{v} min</option>
            ))}
          </select>
          <button onClick={() => window.print()}
            className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
            🖨 Imprimer
          </button>
        </div>
      </div>

      {/* Envoi email — owner uniquement */}
      {isOwner && flights.length > 0 && (
        <div className="flex items-center justify-between gap-4 mb-5 p-3 bg-gray-50 border border-gray-200 rounded-lg print:hidden">

          {/* Switch + label */}
          <div className="flex items-start gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={emailEnabled}
              onClick={() => setEmailEnabled(v => !v)}
              style={{
                backgroundColor: emailEnabled ? '#185FA5' : '#D1D5DB',
                transition: 'background-color 0.2s',
              }}
              className="mt-0.5 w-9 h-5 rounded-full flex items-center px-0.5 flex-shrink-0 cursor-pointer"
            >
              <div
                style={{
                  transform: emailEnabled ? 'translateX(16px)' : 'translateX(0)',
                  transition: 'transform 0.2s',
                }}
                className="w-4 h-4 rounded-full bg-white shadow-sm"
              />
            </button>
            <div>
              <p className="text-[13px] font-medium text-gray-700">Envoyer la tee sheet par email</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Chaque participant GOING recevra la tee sheet complète avec son flight mis en évidence
              </p>
            </div>
          </div>

          {/* Bouton envoi — grisé si switch OFF */}
          <button
            type="button"
            onClick={canSend ? handleSendEmail : undefined}
            disabled={!canSend}
            style={canSend ? {
              borderColor: '#185FA5',
              color: '#185FA5',
              cursor: 'pointer',
            } : {
              borderColor: '#E5E7EB',
              color: '#D1D5DB',
              backgroundColor: '#F9FAFB',
              cursor: 'not-allowed',
            }}
            className="flex-shrink-0 text-[12px] font-medium px-3 py-1.5 rounded-md border transition-colors"
          >
            {sending ? 'Envoi…' : '✉ Envoyer'}
          </button>

        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-600">{error}</div>
      )}

      {flights.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-lg text-[13px] text-gray-400">
          Aucun flight généré — génère les flights d'abord dans l'onglet Flights
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {flights.map((flight, index) => (
            <div key={flight.flight_number} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <span className="text-[13px] font-semibold text-gray-700">
                  Flight {flight.flight_number}
                </span>
                <span className="text-[14px] font-medium text-[#185FA5]">
                  {getFlightTime(index)}
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {flight.players.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-gray-300 w-4">{i + 1}</span>
                      <span className="text-[13px] text-gray-800 font-medium">
                        {p.first_name} {p.surname}
                      </span>
                    </div>
                    {p.whs !== null && (
                      <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">
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

      <style jsx global>{`
        @media print {
          nav, header, aside, .print\\:hidden { display: none !important; }
          body { background: white; }
          .p-6 { padding: 0; }
        }
      `}</style>
    </div>
  )
}

'use client'

import { useEffect, useState, useMemo, useRef} from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useGroupRole } from '@/lib/hooks/useGroupRole'
import EventPillSelector, { useNearestEvent } from '@/components/events/EventPillSelector'
import toast from 'react-hot-toast'
import EmailPreviewModal from '@/components/email/EmailPreviewModal'
import { useTranslations, useLocale } from 'next-intl'
import { buildTeesheetHtml } from '@/lib/email/buildTeesheetHtml'


const supabase = createClient()

type HolesSection = 'out' | 'in' | null
type FlightPlayer = {
  id: string; first_name: string; surname: string; whs: number | null
  holes_played?: number | null; holes_section?: HolesSection
}
type Flight = { id: string; flight_number: number; manual_start_at: string | null; players: FlightPlayer[] }

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
  const [logoUrl,      setLogoUrl]      = useState<string | null>(null)

  // ── Réorganisation manuelle des départs (glisser-déposer, souris + tactile) ──
  const [dragFlightIdx,     setDragFlightIdx]     = useState<number | null>(null)
  const [dragOverFlightIdx, setDragOverFlightIdx] = useState<number | null>(null)
  const [reordering,        setReordering]        = useState(false)

  // ── Heure de départ modifiée manuellement ──
  const [editingTimeIdx, setEditingTimeIdx] = useState<number | null>(null)
  const [timeDraft,      setTimeDraft]      = useState('')
  const [savingTime,     setSavingTime]     = useState(false)

  useEffect(() => {
    if (!eventIdFromRoute && nearestEventId && !nearestLoading) setSelectedEventId(nearestEventId)
  }, [nearestEventId, nearestLoading, eventIdFromRoute])

  useEffect(() => {
    if (!groupId) return
    supabase.from('groups').select('template_logo_url').eq('id', groupId).single()
      .then(({ data }) => setLogoUrl(data?.template_logo_url ?? null))
  }, [groupId])

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
      .select(`id, flight_number, manual_start_at, flight_players(player_id, players(id, first_name, surname, whs))`)
      .eq('event_id', evId).order('flight_number'),
    supabase.from('event_participants')
      .select('player_id, holes_played, holes_section').eq('event_id', evId)
  ])

  if (fErr) { setError(fErr.message); setLoading(false); return }

  const holesMap: Record<string, { holes_played: number | null; holes_section: HolesSection }> = {}
  participants?.forEach(p => { holesMap[p.player_id] = { holes_played: p.holes_played, holes_section: p.holes_section as HolesSection } })

  const built: Flight[] = (flightsData || []).map((f: any) => ({
    id: f.id,
    flight_number: f.flight_number,
    manual_start_at: f.manual_start_at ?? null,
    players: (f.flight_players || []).map((fp: any) => ({
      ...fp.players,
      holes_played:  holesMap[fp.player_id]?.holes_played  ?? null,
      holes_section: holesMap[fp.player_id]?.holes_section ?? null,
    })).filter(Boolean),
  }))
  // Note : l'ordre vient déjà de la requête (.order('flight_number')) — on ne le
  // retrie plus par nombre de joueurs, sinon toute réorganisation manuelle
  // serait écrasée au prochain chargement de la page. On renumérote juste
  // 1..N pour un affichage continu même si la table a des trous (flight
  // supprimé entre-temps, etc.).
  setFlights(built.map((f, i) => ({ ...f, flight_number: i + 1 })))
  setLoading(false)
}

 const flightTimes = useMemo(() => {
   let cursorMs = startsAt ? new Date(startsAt).getTime() : null
   return flights.map((f) => {
     if (cursorMs === null) return { label: t('common.noData'), ms: null as number | null }
     const thisMs = f.manual_start_at ? new Date(f.manual_start_at).getTime() : cursorMs
     cursorMs = thisMs + interval * 60 * 1000
     const label = new Date(thisMs).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
     return { label, ms: thisMs }
   })
 }, [flights, startsAt, interval, locale])

  // Heure au format HH:MM (pour l'input type="time"), en lisant l'heure "cadran UTC"
  // — même convention que le reste de l'app (starts_at stocké tel que son
  // affichage en UTC corresponde à l'heure locale voulue).
  function msToHHMM(ms: number): string {
    const d = new Date(ms)
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  }

  function hhmmToTimestamp(hhmm: string): string | null {
    if (!startsAt) return null
    const [hh, mm] = hhmm.split(':').map(Number)
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null
    const ref = new Date(startsAt)
    return new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate(), hh, mm, 0)).toISOString()
  }

  function startEditTime(idx: number) {
    if (!isOwner) return
    const ms = flightTimes[idx]?.ms
    setTimeDraft(ms != null ? msToHHMM(ms) : '')
    setEditingTimeIdx(idx)
  }

  async function saveManualTime(idx: number) {
    const flight = flights[idx]
    const iso = hhmmToTimestamp(timeDraft)
    setEditingTimeIdx(null)
    if (!flight || !iso) return
    if (iso === flight.manual_start_at) return // pas de changement

    const prevFlights = flights
    setFlights(prev => prev.map((f, i) => i === idx ? { ...f, manual_start_at: iso } : f))
    setSavingTime(true)
    const { error } = await supabase.from('flights').update({ manual_start_at: iso }).eq('id', flight.id)
    setSavingTime(false)
    if (error) {
      toast.error("Erreur lors de l'enregistrement de l'heure — réessaie")
      setFlights(prevFlights)
    }
  }

  async function clearManualTime(idx: number) {
    const flight = flights[idx]
    if (!flight) return
    const prevFlights = flights
    setFlights(prev => prev.map((f, i) => i === idx ? { ...f, manual_start_at: null } : f))
    setSavingTime(true)
    const { error } = await supabase.from('flights').update({ manual_start_at: null }).eq('id', flight.id)
    setSavingTime(false)
    if (error) {
      toast.error("Erreur lors de la réinitialisation de l'heure — réessaie")
      setFlights(prevFlights)
    }
  }

  // ── Réorganisation manuelle des départs ──────────────────────────────────
  function moveFlight(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return
    setFlights(prev => {
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      const renumbered = next.map((f, i) => ({ ...f, flight_number: i + 1 }))
      persistOrder(renumbered)
      return renumbered
    })
  }

  async function persistOrder(orderedFlights: Flight[]) {
    setReordering(true)
    try {
      // Écriture en 2 phases pour éviter tout conflit avec une contrainte
      // d'unicité sur (event_id, flight_number) : on passe d'abord tous les
      // flights concernés par des valeurs temporaires négatives uniques,
      // puis on écrit les numéros finaux.
      await Promise.all(orderedFlights.map((f, i) =>
        supabase.from('flights').update({ flight_number: -(i + 1) }).eq('id', f.id)
      ))
      const results = await Promise.all(orderedFlights.map((f, i) =>
        supabase.from('flights').update({ flight_number: i + 1 }).eq('id', f.id)
      ))
      const firstError = results.find(r => r.error)?.error
      if (firstError) throw firstError
    } catch (e: any) {
      toast.error("Erreur lors de l'enregistrement de l'ordre — " + (e.message ?? 'réessaie'))
      loadData(selectedEventId) // resynchronise avec la base en cas d'échec partiel
    } finally {
      setReordering(false)
    }
  }

  function onFlightDragStart(idx: number) {
    if (!isOwner) return
    setDragFlightIdx(idx)
  }
  function onFlightDragOver(e: React.DragEvent, idx: number) {
    if (!isOwner || dragFlightIdx === null) return
    e.preventDefault()
    setDragOverFlightIdx(idx)
  }
  function onFlightDrop(idx: number) {
    if (!isOwner || dragFlightIdx === null) { onFlightDragEnd(); return }
    moveFlight(dragFlightIdx, idx)
    onFlightDragEnd()
  }
  function onFlightDragEnd() {
    setDragFlightIdx(null)
    setDragOverFlightIdx(null)
  }

  function onFlightTouchStart(e: React.TouchEvent, idx: number) {
    if (!isOwner) return
    e.preventDefault()
    setDragFlightIdx(idx)
  }
  function onFlightTouchMove(e: React.TouchEvent) {
    if (!isOwner || dragFlightIdx === null) return
    e.preventDefault()
    const touch = e.touches[0]
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    const flightEl = el?.closest('[data-flight-idx]')
    if (flightEl) setDragOverFlightIdx(parseInt(flightEl.getAttribute('data-flight-idx') ?? '-1'))
  }
  function onFlightTouchEnd(e: React.TouchEvent) {
    if (!isOwner || dragFlightIdx === null) { onFlightDragEnd(); return }
    const touch = e.changedTouches[0]
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    const flightEl = el?.closest('[data-flight-idx]')
    if (flightEl) {
      const toIdx = parseInt(flightEl.getAttribute('data-flight-idx') ?? '-1')
      if (toIdx >= 0) moveFlight(dragFlightIdx, toIdx)
    }
    onFlightDragEnd()
  }

  function buildWhatsAppTeesheet(): string {
    const lines = [`📋 *${eventTitle}* — ${eventDate}`, '']
    flights.forEach((f, i) => {
      lines.push(`*Flight ${f.flight_number}* — ${flightTimes[i].label}`)
      f.players.forEach(p => lines.push(`  • ${p.first_name} ${p.surname}${p.whs !== null ? ` (${Number(p.whs).toFixed(1)})` : ''}`))
      lines.push('')
    })
    return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`
  }

  async function handleSendEmail() {
    setSending(true)
    try {
      const teesheetFlights = flights.map((f, index) => ({
        flight_number: f.flight_number, start_time: flightTimes[index].label, players: f.players,
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

  function openTeesheetPrintWindow() {
    if (flights.length === 0) return
    const teesheetFlights = flights.map((f, index) => ({
      flight_number: f.flight_number, start_time: flightTimes[index].label, players: f.players,
    }))
    const html = buildTeesheetHtml({
      playerName: null, playerFlightNumber: null,
      eventTitle, eventDate, eventLocation: null,
      flights: teesheetFlights, logoUrl, autoPrint: true,
    })
    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const win  = window.open(url, '_blank')
    if (!win) {
      toast.error('Pop-up bloquée — autorisez les pop-ups pour continuer')
      URL.revokeObjectURL(url)
    } else {
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    }
  }

  if (nearestLoading || roleLoading) return (
    <div className="p-6 space-y-3 max-w-2xl">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-2xl">

      {/* ── Header ── */}
  
      <div className="print:hidden mb-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">{t('teesheet.title')}</h1>
          <div className="flex items-center gap-1.5">
         
            <IconBtn onClick={openTeesheetPrintWindow} disabled={flights.length === 0} title={t('teesheet.print')}>🖨</IconBtn>
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
          {isOwner && flights.length > 0 && (
            <p className="text-[11px] text-slate-400 -mb-1 print:hidden">
              {t('teesheet.reorderHint')}{reordering || savingTime ? t('teesheet.reorderSaving') : ''}
            </p>
          )}
          {flights.map((flight, index) => (
            <div key={flight.id}
              data-flight-idx={index}
              onDragOver={e => onFlightDragOver(e, index)}
              onDrop={() => onFlightDrop(index)}
              className={`bg-white border rounded-xl overflow-hidden transition-colors ${
                dragFlightIdx === index
                  ? 'border-[#185FA5] opacity-50'
                  : dragOverFlightIdx === index && dragFlightIdx !== null
                    ? 'border-[#185FA5] ring-2 ring-[#185FA5]/30'
                    : 'border-slate-200'
              }`}>
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  {isOwner && (
                    <span
                      draggable
                      onDragStart={() => onFlightDragStart(index)}
                      onDragEnd={onFlightDragEnd}
                      onTouchStart={e => onFlightTouchStart(e, index)}
                      onTouchMove={onFlightTouchMove}
                      onTouchEnd={onFlightTouchEnd}
                      title={t('teesheet.dragHandleTitle')}
                      className="print:hidden cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 text-[16px] select-none touch-none px-1">
                      ⠿
                    </span>
                  )}
                  <span className="flight-label-text text-[13px] font-black text-slate-800">{t('teesheet.flight', { number: flight.flight_number })}</span>
                </div>
                {isOwner && editingTimeIdx === index ? (
                  <input
                    type="time"
                    autoFocus
                    value={timeDraft}
                    onChange={e => setTimeDraft(e.target.value)}
                    onBlur={() => saveManualTime(index)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      if (e.key === 'Escape') setEditingTimeIdx(null)
                    }}
                    className="text-[15px] font-black text-[#185FA5] border border-[#185FA5]/40 rounded-lg px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30"
                  />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => startEditTime(index)}
                      disabled={!isOwner}
                      title={isOwner ? t('teesheet.editTimeTitle') : undefined}
                      className={`flight-time-text text-[15px] font-black text-[#185FA5] ${isOwner ? 'hover:underline decoration-dashed underline-offset-2 cursor-pointer' : ''}`}>
                      {flightTimes[index]?.label}
                    </button>
                    {flight.manual_start_at && (
                      <button
                        type="button"
                        onClick={() => clearManualTime(index)}
                        title={t('teesheet.resetTimeTitle')}
                        className="print:hidden text-[11px] text-slate-300 hover:text-slate-500">
                        ✕
                      </button>
                    )}
                  </div>
                )}
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
              flights: flights.map((f, i) => ({ ...f, start_time: flightTimes[i].label })),
            }),
          }).then(r => r.json())}
        />
      )}

      <style jsx global>{`
        @media print {
          nav, header, aside, .print\\:hidden { display: none !important; }
          body { background: white; margin: 0; }
          .p-5 { padding: 24px 32px; }
          .flex.flex-col.gap-3 { gap: 12px; }
          .bg-white.border { border: 1px solid #E5E7EB !important; border-radius: 8px !important; overflow: hidden; break-inside: avoid; }
          .bg-slate-50.border-b { background: #185FA5 !important; padding: 8px 16px !important; }
          .bg-slate-50.border-b .flight-label-text { color: white !important; font-size: 13px !important; font-weight: 700 !important; }
          .bg-slate-50.border-b .flight-time-text  { color: #4CAF1A !important; font-size: 15px !important; font-weight: 900 !important; }
          .divide-y > div { padding: 7px 16px !important; }
          .divide-y > div:nth-child(even) { background: #F8FAFF !important; }
          .font-mono { background: #E6F1FB !important; color: #185FA5 !important; font-weight: 600 !important; padding: 2px 6px !important; border-radius: 4px !important; }
        }
      `}</style>
    </div>
  )
}
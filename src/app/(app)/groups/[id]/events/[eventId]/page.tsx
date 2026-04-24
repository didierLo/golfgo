'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const supabase = createClient()

type EventDetail = {
  id: string
  title: string
  location: string | null
  starts_at: string
  ends_at: string | null
  description: string | null
  competition_formats: { name: string } | null
  courses: { course_name: string; clubs: { name: string } | null } | null
  max_participants: number | null
}
type ParticipationStatus = 'GOING' | 'INVITED' | 'DECLINED' | 'WAITLIST' | null

const STATUS_STYLE: Record<string, { label: string; bg: string; text: string }> = {
  GOING:    { label: 'Confirmé',         bg: '#EAF3DE', text: '#3B6D11' },
  INVITED:  { label: 'En attente',       bg: '#EBF3FC', text: '#0C447C' },
  DECLINED: { label: 'Décliné',          bg: '#FCEBEB', text: '#A32D2D' },
  WAITLIST: { label: "Liste d'attente",  bg: '#FAEEDA', text: '#854F0B' },
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}


export default function EventOverviewPage() {
  const params  = useParams()
  const groupId = params.id as string
  const eventId = params.eventId as string

  const [event, setEvent]                 = useState<EventDetail | null>(null)
  const [status, setStatus]               = useState<ParticipationStatus>(null)
  const [playerId, setPlayerId]           = useState<string | null>(null)
  const [participantCount, setParticipantCount] = useState(0)
  const [loading, setLoading]             = useState(true)
  const [updating, setUpdating]           = useState(false)

  useEffect(() => { loadData() }, [eventId])

  async function loadData() {
    setLoading(true)
    const { data: eventData } = await supabase
      .from('events')
      .select(`id, title, location, starts_at, ends_at, description, max_participants, competition_formats(name), courses(course_name, clubs(name))`)
      .eq('id', eventId).single()
    if (eventData) setEvent(eventData as any)

    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (user) {
      const { data: player } = await supabase.from('players').select('id').eq('user_id', user.id).single()
      if (player) {
        setPlayerId(player.id)
        const { data: participation } = await supabase.from('event_participants')
          .select('status').eq('event_id', eventId).eq('player_id', player.id).maybeSingle()
        setStatus((participation?.status as ParticipationStatus) ?? null)
      }
    }

    const { count } = await supabase.from('event_participants')
      .select('*', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'GOING')
    setParticipantCount(count ?? 0)
    setLoading(false)
  }

  async function updateStatus(newStatus: 'GOING' | 'DECLINED') {
    if (!playerId) return
    setUpdating(true)
    const { error } = await supabase.from('event_participants')
      .update({ status: newStatus, responded_at: new Date().toISOString() })
      .eq('event_id', eventId).eq('player_id', playerId)
    if (error) {
      toast.error('Erreur lors de la mise à jour')
    } else {
      setStatus(newStatus)
      toast.success(newStatus === 'GOING' ? 'Participation confirmée !' : 'Participation déclinée')
      setParticipantCount(prev => {
        if (newStatus === 'GOING') return prev + (status !== 'GOING' ? 1 : 0)
        return prev - (status === 'GOING' ? 1 : 0)
      })
    }
    setUpdating(false)
  }

  if (loading) return (
    <div className="p-6 space-y-3 max-w-xl">
      {[1,2,3].map(i => <div key={i} className="h-16 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )

  if (!event) return (
    <div className="p-6 text-[13px] text-slate-500">Événement introuvable</div>
  )

  const s = status ? STATUS_STYLE[status] : null
  const isFull = !!event.max_participants && participantCount >= event.max_participants && status !== ('GOING' as ParticipationStatus)

  return (
    <div className="p-5 sm:p-6 max-w-xl">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">{event.title}</h1>
        {event.description && <p className="text-[13px] text-slate-600 mt-1">{event.description}</p>}
      </div>

      {/* Infos */}
      <div className="rounded-xl border border-white/60 shadow-sm p-4 mb-6 flex flex-col gap-3.5" style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>

        {/* Date */}
        <div className="flex items-start gap-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-400 mt-0.5 flex-shrink-0">
            <rect x="1" y="3" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M1 7h14M5 1v4M11 1v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <div>
            <div className="text-[13px] font-semibold text-slate-900">{formatDate(event.starts_at)}</div>
            <div className="text-[12px] text-slate-500">
              {formatTime(event.starts_at)}{event.ends_at && ` → ${formatTime(event.ends_at)}`}
            </div>
          </div>
        </div>

        {/* Lieu */}
        {event.location && (
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-400 flex-shrink-0">
              <path d="M8 1.5C5.51 1.5 3.5 3.51 3.5 6c0 3.75 4.5 8.5 4.5 8.5s4.5-4.75 4.5-8.5C12.5 3.51 10.49 1.5 8 1.5z" stroke="currentColor" strokeWidth="1.3"/>
              <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
            <span className="text-[13px] text-slate-700">{event.location}</span>
          </div>
        )}

        {/* Format */}
        {event.competition_formats?.name && (
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-400 flex-shrink-0">
              <path d="M3 13V8M6 13V5M9 13V7M12 13V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <span className="text-[13px] text-slate-700">{event.competition_formats.name}</span>
          </div>
        )}

        {/* Parcours */}
        {event.courses?.course_name && (
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-400 flex-shrink-0">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M8 5v3M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="text-[13px] text-slate-700">
              {event.courses.course_name}
              {(event.courses.clubs as any)?.name && ` · ${(event.courses.clubs as any).name}`}
            </span>
          </div>
        )}

        {/* Participants confirmés */}
       <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-400 flex-shrink-0">
            <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M1 13c0-2.76 2.24-5 5-5a5 5 0 015 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
          <span className="text-[13px] text-slate-700">
            <span className="font-black text-[#3B6D11]">{participantCount}</span>
            {event.max_participants
              ? <>
                  {' '}/ {event.max_participants} place{event.max_participants !== 1 ? 's' : ''}
                  {' — '}
                  {(() => {
                    const remaining = event.max_participants - participantCount
                    return remaining > 0
                      ? <span className="text-[#3B6D11] font-semibold">{remaining} restante{remaining !== 1 ? 's' : ''}</span>
                      : <span className="text-[#A32D2D] font-semibold">Complet</span>
                  })()}
                </>
              : <> participant{participantCount !== 1 ? 's' : ''} confirmé{participantCount !== 1 ? 's' : ''}</>
            }
          </span>
      </div>
     </div>

      {/* Ma participation */}
      {status !== null && (
        <div className="rounded-xl border border-white/60 shadow-sm p-4" style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Ma participation</p>

          {s && (
            <div className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full mb-4"
              style={{ background: s.bg, color: s.text }}>
              {s.label}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => updateStatus('GOING')}
              disabled={updating || status === 'GOING' || isFull}
              title={isFull && status !== 'GOING' ? "L'événement est complet" : undefined}
              className={`flex-1 text-[13px] font-semibold py-2.5 rounded-xl border transition-colors disabled:opacity-50 ${
                status === 'GOING'
                  ? 'bg-[#EAF3DE] border-[#C0DD97] text-[#3B6D11]'
                  : isFull
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'border-slate-200 text-slate-600 hover:bg-[#EAF3DE] hover:border-[#C0DD97] hover:text-[#3B6D11]'
              }`}>
              {status === 'GOING' ? 'Je participe' : isFull ? 'Complet' : 'Je participe'}
            </button>
            <button onClick={() => updateStatus('DECLINED')} disabled={updating || status === 'DECLINED'}
              className={`flex-1 text-[13px] font-semibold py-2.5 rounded-xl border transition-colors disabled:opacity-50 ${
                status === 'DECLINED'
                  ? 'bg-[#FCEBEB] border-[#F7C1C1] text-[#A32D2D]'
                  : 'border-slate-200 text-slate-600 hover:bg-[#FCEBEB] hover:border-[#F7C1C1] hover:text-[#A32D2D]'
              }`}>
              Je ne participe pas
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

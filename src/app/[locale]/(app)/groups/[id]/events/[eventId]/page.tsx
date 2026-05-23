'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { useTranslations, useLocale } from 'next-intl'

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
type HolesSection = 'out' | 'in' | null

export default function EventOverviewPage() {
  const params  = useParams()
  const groupId = params.id      as string
  const eventId = params.eventId as string
  const t       = useTranslations()
  const locale  = useLocale()

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }
  function formatTime(d: string) {
    return new Date(d).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
  }

  const [event,            setEvent]            = useState<EventDetail | null>(null)
  const [status,           setStatus]           = useState<ParticipationStatus>(null)
  const [holesPlayed,      setHolesPlayed]      = useState<9 | 18>(18)
  const [holesSection,     setHolesSection]     = useState<HolesSection>(null)
  const [playerId,         setPlayerId]         = useState<string | null>(null)
  const [participantCount, setParticipantCount] = useState(0)
  const [loading,          setLoading]          = useState(true)
  const [updating,         setUpdating]         = useState(false)

  useEffect(() => { loadData() }, [eventId])

  async function loadData() {
    setLoading(true)
    const { data: eventData } = await supabase
      .from('events')
      .select(`id, title, location, starts_at, ends_at, description, max_participants,
        competition_formats(name), courses(course_name, clubs(name))`)
      .eq('id', eventId).single()
    if (eventData) setEvent(eventData as any)

    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (user) {
      const { data: player } = await supabase.from('players').select('id').eq('user_id', user.id).single()
      if (player) {
        setPlayerId(player.id)
        const { data: participation } = await supabase.from('event_participants')
          .select('status, holes_played, holes_section')
          .eq('event_id', eventId).eq('player_id', player.id).maybeSingle()
        setStatus((participation?.status as ParticipationStatus) ?? null)
        setHolesPlayed((participation?.holes_played as 9 | 18) ?? 18)
        setHolesSection((participation?.holes_section as HolesSection) ?? null)
      }
    }

    const { count } = await supabase.from('event_participants')
      .select('*', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'GOING')
    setParticipantCount(count ?? 0)
    setLoading(false)
  }

  async function respond(newStatus: 'GOING' | 'DECLINED', holes?: 9 | 18, section?: HolesSection) {
    if (!playerId) return
    setUpdating(true)
    const update: any = { status: newStatus, responded_at: new Date().toISOString() }
    if (holes !== undefined) update.holes_played = holes
    update.holes_section = section ?? null

    const { error } = await supabase.from('event_participants')
      .update(update).eq('event_id', eventId).eq('player_id', playerId)

    if (error) {
      toast.error(t('eventOverview.errorUpdate'))
    } else {
      const wasGoing = status === 'GOING'
      const nowGoing = newStatus === 'GOING'
      setStatus(newStatus)
      if (holes !== undefined) setHolesPlayed(holes)
      setHolesSection(section ?? null)
      setParticipantCount(prev => {
        if (nowGoing && !wasGoing) return prev + 1
        if (!nowGoing && wasGoing) return prev - 1
        return prev
      })
      let msg = t('eventOverview.toastDeclined')
      if (newStatus === 'GOING') {
        if (holes === 9 && section === 'out') msg = t('eventOverview.toast9out')
        else if (holes === 9 && section === 'in') msg = t('eventOverview.toast9in')
        else msg = t('eventOverview.toast18')
      }
      toast.success(msg)
    }
    setUpdating(false)
  }

  if (loading) return (
    <div className="p-6 space-y-3 max-w-xl">
      {[1,2,3].map(i => <div key={i} className="h-16 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )

  if (!event) return (
    <div className="p-6 text-[13px] text-slate-500">{t('eventOverview.notFound')}</div>
  )

  const isFull    = !!event.max_participants && participantCount >= event.max_participants && status !== 'GOING'
  const active18  = status === 'GOING' && holesPlayed === 18
  const active9out = status === 'GOING' && holesPlayed === 9 && holesSection === 'out'
  const active9in  = status === 'GOING' && holesPlayed === 9 && holesSection === 'in'
  const activeNo  = status === 'DECLINED'

  return (
    <div className="p-5 sm:p-6 max-w-xl">

      <div className="mb-6">
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">{event.title}</h1>
        {event.description && <p className="text-[13px] text-slate-900 mt-1">{event.description}</p>}
      </div>

      <div className="rounded-xl border border-white/60 shadow-sm p-4 mb-6 flex flex-col gap-3.5"
        style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>

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

        {event.location && (
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-400 flex-shrink-0">
              <path d="M8 1.5C5.51 1.5 3.5 3.51 3.5 6c0 3.75 4.5 8.5 4.5 8.5s4.5-4.75 4.5-8.5C12.5 3.51 10.49 1.5 8 1.5z" stroke="currentColor" strokeWidth="1.3"/>
              <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
            <span className="text-[13px] text-slate-700">{event.location}</span>
          </div>
        )}

        {event.competition_formats?.name && (
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-400 flex-shrink-0">
              <path d="M3 13V8M6 13V5M9 13V7M12 13V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            <span className="text-[13px] text-slate-700">{event.competition_formats.name}</span>
          </div>
        )}

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

        <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-400 flex-shrink-0">
            <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M1 13c0-2.76 2.24-5 5-5a5 5 0 015 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
          <span className="text-[13px] text-slate-700">
            {event.max_participants ? (
              participantCount >= event.max_participants
                ? t('eventOverview.participantsMaxFull', { count: participantCount, max: event.max_participants })
                : t('eventOverview.participantsMax', { count: participantCount, max: event.max_participants, remaining: event.max_participants - participantCount })
            ) : (
              t('eventOverview.participants', { count: participantCount })
            )}
          </span>
        </div>
      </div>

      {/* ── Bouton Mes partenaires ── */}
      <a
        href={`/groups/${groupId}/events/${eventId}/partners`}
        className="flex items-center justify-between w-full rounded-xl border border-white/60 shadow-sm px-4 py-3 mb-6 transition-all hover:shadow-md hover:scale-[1.01] active:scale-[0.99] group"
        style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
      >
        <div className="flex items-center gap-3">
          {/* Icône réseau/partenaires */}
          <div className="w-8 h-8 rounded-xl bg-[#EBF3FC] flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[#185FA5]">
              <circle cx="8"  cy="4"  r="2"   stroke="currentColor" strokeWidth="1.3"/>
              <circle cx="3"  cy="12" r="1.8" stroke="currentColor" strokeWidth="1.3"/>
              <circle cx="13" cy="12" r="1.8" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M8 6v2.5M8 8.5L3 10.2M8 8.5L13 10.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-900 leading-tight">Mes partenaires</p>
            <p className="text-[11px] text-slate-400 leading-tight">Matrice &amp; historique des parties</p>
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0">
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </a>

      {status !== null && (
        <div className="rounded-xl border border-white/60 shadow-sm p-4"
          style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">{t('eventOverview.myParticipation')}</p>

          <div className="flex flex-col gap-2">
            {/* 18 trous */}
            <button
              onClick={() => respond('GOING', 18, null)}
              disabled={updating || active18 || isFull}
              className={`w-full text-[13px] font-semibold py-2.5 rounded-xl border-2 transition-all disabled:cursor-default ${
                active18
                  ? 'bg-[#EAF3DE] border-[#3B6D11] text-[#3B6D11]'
                  : isFull
                    ? 'bg-slate-50 border-slate-200 text-slate-300'
                    : 'border-slate-200 text-slate-600 hover:bg-[#EAF3DE] hover:border-[#3B6D11] hover:text-[#3B6D11]'
              }`}>
              {active18 ? t('eventOverview.going18active') : isFull ? t('eventOverview.full') : t('eventOverview.going18')}
            </button>

            {/* 9H Front */}
            <button
              onClick={() => respond('GOING', 9, 'out')}
              disabled={updating || active9out || isFull}
              className={`w-full text-[13px] font-semibold py-2.5 rounded-xl border-2 transition-all disabled:cursor-default ${
                active9out
                  ? 'bg-amber-50 border-amber-400 text-amber-700'
                  : isFull
                    ? 'bg-slate-50 border-slate-200 text-slate-300'
                    : 'border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-400 hover:text-amber-700'
              }`}>
              {active9out ? t('eventOverview.going9outActive') : t('eventOverview.going9out')}
            </button>

            {/* 9H Back */}
            <button
              onClick={() => respond('GOING', 9, 'in')}
              disabled={updating || active9in || isFull}
              className={`w-full text-[13px] font-semibold py-2.5 rounded-xl border-2 transition-all disabled:cursor-default ${
                active9in
                  ? 'bg-orange-50 border-orange-400 text-orange-700'
                  : isFull
                    ? 'bg-slate-50 border-slate-200 text-slate-300'
                    : 'border-slate-200 text-slate-600 hover:bg-orange-50 hover:border-orange-400 hover:text-orange-700'
              }`}>
              {active9in ? t('eventOverview.going9inActive') : t('eventOverview.going9in')}
            </button>

            {/* Décliné */}
            <button
              onClick={() => respond('DECLINED')}
              disabled={updating || activeNo}
              className={`w-full text-[13px] font-semibold py-2.5 rounded-xl border-2 transition-all disabled:cursor-default ${
                activeNo
                  ? 'bg-[#FCEBEB] border-[#A32D2D] text-[#A32D2D]'
                  : 'border-slate-200 text-slate-600 hover:bg-[#FCEBEB] hover:border-[#A32D2D] hover:text-[#A32D2D]'
              }`}>
              {activeNo ? t('eventOverview.notGoingActive') : t('eventOverview.notGoing')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

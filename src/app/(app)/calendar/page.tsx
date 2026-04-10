'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import CalendarView from '@/components/calendar/CalendarView'
import toast from 'react-hot-toast'

const supabase = createClient()

export default function CalendarPage() {
  const [events, setEvents] = useState<any[]>([])
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { init() }, [])

  useEffect(() => {
    if (playerId) loadData()
  }, [playerId])

  async function init() {
    const { data: userData } = await supabase.auth.getUser()

    if (!userData?.user) return

    const { data: player } = await supabase
      .from('players')
      .select('id')
      .eq('user_id', userData.user.id)
      .single()

    if (!player) return

        console.log('player id used for calendar:', player.id)

    setPlayerId(player.id)
  }

  async function loadData() {
    const { data, error } = await supabase
      .from('calendar_events_player')
      .select('*')
      .eq('player_id', playerId)

    if (error) { console.error(error); return }

    const formatted = (data ?? [])
      .map(row => {
       const time = new Date(row.starts_at).toLocaleTimeString('fr-BE', { 
        hour: '2-digit', minute: '2-digit',
        timeZone: 'UTC',
        })
        return {
          id: row.event_id,
          title: `${time} • ${row.title}`,
          start: row.starts_at,
          color: row.color,
          extendedProps: row,
        }
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

    setEvents(formatted)
    setLoading(false)
  }

  async function toggleParticipation(info: any) {
    if (!playerId) { toast('Player not found'); return }

    const event = info.event.extendedProps

    if (new Date(event.starts_at) < new Date()) {
      toast('This event is in the past')
      return
    }

    if (event.player_status === 'GOING') {
      const { error } = await supabase.rpc('cancel_event_participation', {
        p_event_id: event.event_id,
        p_player_id: playerId,
      })
      if (error) { console.error(error); toast('Cancellation failed'); return }
      toast('Participation cancelled')
    } else {
      const { error } = await supabase.rpc('join_event', {
        p_event_id: event.event_id,
        p_player_id: playerId,
      })
      if (error) { console.error(error); toast('Registration failed'); return }
      toast('You joined the event')
    }

    loadData()
  }

  function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('fr-BE', {
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-BE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Europe/Brussels',  // ← ajoute ça
  })
}

  const now = new Date()
  const filteredEvents = events.filter(e => showPast || new Date(e.start) >= now)

  return (
    <div className="p-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[18px] font-medium text-gray-900">Calendar</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">
            {filteredEvents.length} événement{filteredEvents.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowPast(!showPast)}
          className={`
            text-[12px] font-medium px-3 py-1.5 rounded-md border transition-colors
            ${showPast
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }
          `}
        >
          {showPast ? 'Masquer les passés' : 'Afficher les passés'}
        </button>
      </div>

      {/* ── Calendrier ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="h-96 bg-gray-50 rounded-lg animate-pulse" />
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
         <CalendarView
          events={filteredEvents}
        />
        </div>
      )}

    </div>
  )
}

'use client'

// components/events/EventPillSelector.tsx

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Event = { id: string; title: string; starts_at: string }

interface Props {
  groupId: string
  selectedEventId: string
  onChange: (eventId: string) => void
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function EventPillSelector({ groupId, selectedEventId, onChange }: Props) {
  const [events, setEvents] = useState<Event[]>([])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('events')
        .select('id, title, starts_at')
        .eq('group_id', groupId)
        .order('starts_at', { ascending: false })
      setEvents(data || [])
    }
    load()
  }, [groupId])

  if (events.length === 0) return null

  return (
    <select
      value={selectedEventId}
      onChange={e => onChange(e.target.value)}
      className="border border-white/50 rounded-xl px-3 py-2.5 text-[13px] bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] w-full max-w-sm shadow-sm"
    >
      {events.map(e => (
        <option key={e.id} value={e.id}>
          {e.title} — {formatDate(e.starts_at)}
        </option>
      ))}
    </select>
  )
}

/**
 * Hook utilitaire : retourne l'eventId futur le plus proche parmi les events d'un groupe.
 * À utiliser pour initialiser selectedEventId avec le bon défaut.
 */
export function useNearestEvent(groupId: string): { nearestEventId: string | null; loading: boolean } {
  const [nearestEventId, setNearestEventId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const now = new Date().toISOString()
      // Cherche l'event futur le plus proche
      const { data: future } = await supabase
        .from('events')
        .select('id, starts_at')
        .eq('group_id', groupId)
        .gte('starts_at', now)
        .order('starts_at', { ascending: true })
        .limit(1)

      if (future?.[0]) {
        setNearestEventId(future[0].id)
      } else {
        // Fallback : event passé le plus récent
        const { data: past } = await supabase
          .from('events')
          .select('id, starts_at')
          .eq('group_id', groupId)
          .lt('starts_at', now)
          .order('starts_at', { ascending: false })
          .limit(1)
        setNearestEventId(past?.[0]?.id ?? null)
      }
      setLoading(false)
    }
    load()
  }, [groupId])

  return { nearestEventId, loading }
}

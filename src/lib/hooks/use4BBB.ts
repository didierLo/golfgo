import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generate4BBB, EventSlot, RoundResult } from '@/lib/golf/flights/generate4BBB'
import { pairKey } from '@/lib/utils/pairs'

export function use4BBB(groupId: string) {
  const supabase = createClient()

  const [events,       setEvents]       = useState<EventSlot[]>([])
  const [rounds,       setRounds]       = useState<RoundResult[]>([])
  const [loading,      setLoading]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [generated,    setGenerated]    = useState(false)

  // ── Charger les events + GOING pour la période ───────────────────────────
  async function loadEvents(historyWindowDays: number) {
    setLoading(true)
    setGenerated(false)

    const since = new Date()
    since.setDate(since.getDate() - historyWindowDays)

    const { data: eventsData } = await supabase
      .from('events')
      .select('id, title, starts_at')
      .eq('group_id', groupId)
      .gte('starts_at', since.toISOString())
      .order('starts_at', { ascending: true })

    if (!eventsData?.length) { setEvents([]); setLoading(false); return }

    // Charger les GOING pour chaque event
    const eventSlots: EventSlot[] = []
    for (const ev of eventsData) {
      const { data: participants } = await supabase
        .from('event_participants')
        .select('players(id, first_name, surname, whs)')
        .eq('event_id', ev.id)
        .eq('status', 'GOING')

      eventSlots.push({
        eventId:   ev.id,
        title:     ev.title,
        starts_at: ev.starts_at,
        going:     (participants ?? []).map((p: any) => p.players).filter(Boolean),
      })
    }

    setEvents(eventSlots)
    setLoading(false)
  }

  // ── Générer ──────────────────────────────────────────────────────────────
  async function generate(options: {
    forbiddenPairs?: Set<string>
    preferredPairs?: Set<string>
    iterations?: number
  }) {
    // Charger les contraintes
    const { data: constraints } = await supabase
      .from('player_pair_constraints')
      .select('*')
      .eq('group_id', groupId)

    const forbidden = new Set<string>()
    const preferred = new Set<string>()
    for (const c of constraints ?? []) {
      const key = pairKey(c.player_a, c.player_b)
      if (c.constraint_type === 'forbidden') forbidden.add(key)
      if (c.constraint_type === 'preferred') preferred.add(key)
    }

    const result = generate4BBB(events, {
      forbiddenPairs: options.forbiddenPairs ?? forbidden,
      preferredPairs: options.preferredPairs ?? preferred,
      iterations:     options.iterations ?? 500,
    })

    setRounds(result)
    setGenerated(true)
  }

  // ── Sauvegarder ──────────────────────────────────────────────────────────
  async function save() {
    setSaving(true)
    try {
      for (const round of rounds) {
        // Supprimer les anciens flights 4bbb de cet event
        const { data: oldFlights } = await supabase
          .from('flights')
          .select('id')
          .eq('event_id', round.eventId)
          .eq('mode', '4bbb')

        const oldIds = (oldFlights ?? []).map(f => f.id)
        if (oldIds.length) {
          await supabase.from('flight_players').delete().in('flight_id', oldIds)
          await supabase.from('flights').delete().in('id', oldIds)
        }

        // Insérer les nouveaux flights
        for (const flight of round.flights) {
          const { data: newFlight } = await supabase
            .from('flights')
            .insert({
              event_id:      round.eventId,
              flight_number: flight.flight_no,
              mode:          '4bbb',
            })
            .select()
            .single()

          if (!newFlight) continue

          const rows = flight.players.map((p, i) => ({
            flight_id: newFlight.id,
            player_id: p.id,
            position:  i + 1,
          }))
          if (rows.length) await supabase.from('flight_players').insert(rows)
        }
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Charger les rounds sauvegardés ───────────────────────────────────────
  async function loadSaved() {
    if (!events.length) return
    const eventIds = events.map(e => e.eventId)

    const { data: flightsData } = await supabase
      .from('flights')
      .select(`id, event_id, flight_number, flight_players(position, players(id, first_name, surname, whs))`)
      .in('event_id', eventIds)
      .eq('mode', '4bbb')
      .order('flight_number')

    if (!flightsData?.length) return

    // Grouper par event
    const byEvent = new Map<string, any[]>()
    for (const f of flightsData) {
      if (!byEvent.has(f.event_id)) byEvent.set(f.event_id, [])
      byEvent.get(f.event_id)!.push(f)
    }

    const loaded: RoundResult[] = events
      .filter(ev => byEvent.has(ev.eventId))
      .map(ev => ({
        eventId: ev.eventId,
        flights: (byEvent.get(ev.eventId) ?? []).map((f: any) => {
          const players = f.flight_players
            .sort((a: any, b: any) => a.position - b.position)
            .map((fp: any) => fp.players)
          return {
            flight_no: f.flight_number,
            players,
            avgWhs: players.length
              ? players.reduce((s: number, p: any) => s + (p.whs ?? 0), 0) / players.length
              : 0,
          }
        }),
      }))

    if (loaded.length) { setRounds(loaded); setGenerated(true) }
  }

  // ── Modifier un flight manuellement (drag & drop) ────────────────────────
  function movePlayer(
    playerId:      string,
    fromEventId:   string,
    fromFlightNo:  number,
    toEventId:     string,
    toFlightNo:    number,
  ) {
    setRounds(prev => prev.map(round => {
      // Même event : déplacer entre flights
      if (round.eventId === fromEventId && round.eventId === toEventId) {
        const player = round.flights
          .find(f => f.flight_no === fromFlightNo)
          ?.players.find(p => p.id === playerId)
        if (!player) return round
        return {
          ...round,
          flights: round.flights.map(f => {
            if (f.flight_no === fromFlightNo) return { ...f, players: f.players.filter(p => p.id !== playerId) }
            if (f.flight_no === toFlightNo)   return { ...f, players: [...f.players, player] }
            return f
          }).map(f => ({
            ...f,
            avgWhs: f.players.length
              ? f.players.reduce((s, p) => s + (p.whs ?? 0), 0) / f.players.length
              : 0,
          })),
        }
      }
      return round
    }))
  }

  return {
    events, rounds, setRounds,
    loading, saving, generated,
    loadEvents, generate, save, loadSaved, movePlayer,
  }
}

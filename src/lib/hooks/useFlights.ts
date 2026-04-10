import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { generateFlights } from "@/lib/golf/flights/generateFlights"
import { pairKey } from "@/lib/utils/pairs"

export function useFlights(eventId: string) {

  const supabase = createClient()

  const [players, setPlayers] = useState<any[]>([])
  const [flights, setFlights] = useState<any[]>([])
  const [event, setEvent] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [forbiddenPairs, setForbiddenPairs] = useState<Set<string>>(new Set())
  const [preferredPairs, setPreferredPairs] = useState<Set<string>>(new Set())

  async function loadData() {

    setLoading(true)

    /* PLAYERS */
    const { data: participants } = await supabase
      .from("event_participants")
      .select(`
        player:players(
          id,
          first_name,
          surname,
          whs
        )
      `)
      .eq("event_id", eventId)
      .eq("status", "GOING")

    const list =
      participants?.map((p: any) => p.player) || []

    setPlayers(list)

    /* FLIGHTS */
    const { data: flightsData } = await supabase
      .from("flights")
      .select(`
        id,
        flight_number,
        flight_players(
          position,
          players(
            id,
            first_name,
            surname,
            whs
          )
        )
      `)
      .eq("event_id", eventId)
      .order("flight_number")

    const formatted =
      flightsData?.map((f: any) => ({
        flight_no: f.flight_number,
        players:
          f.flight_players
            .sort((a: any, b: any) => a.position - b.position)
            .map((fp: any) => fp.players)
      })) || []

    setFlights(formatted)

    /* EVENT */
    const { data: eventData, error } = await supabase
      .from("events")
      .select(`
        id,
        group_id,
        title,
        starts_at
      `)
      .eq("id", eventId)
      .single()

    if (error) {
      console.error("Event load error", error)
    } else {
      setEvent(eventData)
    }

    /* CONSTRAINTS (FORBIDDEN + PREFERRED) */
    if (eventData?.group_id) {

      const { data: constraints } = await supabase
        .from("player_pair_constraints")
        .select("*")
        .eq("group_id", eventData.group_id)

      const forbidden = new Set<string>()
      const preferred = new Set<string>()

      for (const c of constraints ?? []) {

        const key = pairKey(c.player_a, c.player_b)

        if (c.constraint_type === "forbidden") {
          forbidden.add(key)
        }

        if (c.constraint_type === "preferred") {
          preferred.add(key)
        }
      }

      setForbiddenPairs(forbidden)
      setPreferredPairs(preferred)
    }

    setLoading(false)
  }

  /* GENERATE */

  async function generate(options: any) {

    console.log("PLAYERS INPUT", players.length)

    const result = await generateFlights(
      players,
      {
        ...options,
        forbiddenPairs: options.forbiddenPairs ?? forbiddenPairs,
        preferredPairs: options.preferredPairs ?? preferredPairs
      }
    )
    console.log("ENGINE RESULT", result)

    const flights =
     Array.isArray(result)
      ? result
      : (result as any)?.flights || []

setFlights(flights)
  }

  /* SAVE */

  async function save() {

    await supabase
      .from("flights")
      .delete()
      .eq("event_id", eventId)

    for (const flight of flights) {

      const { data: newFlight } =
        await supabase
          .from("flights")
          .insert({
            event_id: eventId,
            flight_number: flight.flight_no
          })
          .select()
          .single()

      const rows =
        flight.players.map((p: any, i: number) => ({
          flight_id: newFlight.id,
          player_id: p.id,
          position: i + 1
        }))

      await supabase
        .from("flight_players")
        .insert(rows)
    }
  }

  /* REMOVE */

  async function remove() {

    const { data } = await supabase
      .from("flights")
      .select("id")
      .eq("event_id", eventId)

    const ids = data?.map(f => f.id) || []

    if (ids.length) {
      await supabase
        .from("flight_players")
        .delete()
        .in("flight_id", ids)
    }

    await supabase
      .from("flights")
      .delete()
      .eq("event_id", eventId)

    setFlights([])
  }

  return {
    players,
    flights,
    event,
    loading,
    loadData,
    generate,
    save,
    remove
  }
}
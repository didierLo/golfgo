'use client'

import { createClient } from '@/lib/supabase/client'
import JoinButton from "@/components/ui/JoinButton"
import CancelButton from "@/components/ui/CancelButton"

export default async function CalendarPage() {

  const supabase = createClient()

  const { data: user } = await supabase.auth.getUser()

  const { data: player } = await supabase
    .from("players")
    .select("id")
    .eq("user_id", user.user?.id)
    .single()

  const { data: events } = await supabase
    .from("calendar_player_view")
    .select("*")
    .eq("player_id", player.id)
    .order("starts_at")

  return (

    <div className="p-6">

      <h1 className="text-xl mb-6">Calendar</h1>

      {events?.map((e) => (

        <div key={e.event_id} className="border p-4 mb-4">

          <h2>{e.title}</h2>

          <p>
            {new Date(e.starts_at).toLocaleString()}
          </p>

          <p>Group: {e.group_name}</p>

          <p>Remaining slots: {e.remaining_slots}</p>


          {e.player_status === "GOING" && (
            <CancelButton
              eventId={e.event_id}
              playerId={player.id}
            />
          )}


          {!e.player_status && e.remaining_slots > 0 && (
            <JoinButton
              eventId={e.event_id}
              playerId={player.id}
            />
          )}


          {e.remaining_slots === 0 && (
            <span>Full</span>
          )}

        </div>

      ))}

    </div>

  )
}
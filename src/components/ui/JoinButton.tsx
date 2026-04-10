"use client"

import { createClient } from "@/lib/supabase/client"

export default function JoinButton({ eventId, playerId, onSuccess }: { eventId: any; playerId: any; onSuccess: () => void }) {

  const supabase = createClient()

  async function join() {

    const { error } = await supabase.rpc("join_event", {
      p_event_id: eventId,
      p_player_id: playerId
    })

    if (!error && onSuccess) {
      onSuccess()
    }

  }

  return (
    <button
      onClick={join}
      className="bg-green-600 text-white px-3 py-1 rounded"
    >
      Join
    </button>
  )
}
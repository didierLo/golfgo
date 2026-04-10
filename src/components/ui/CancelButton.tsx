"use client"

import { createClient } from "@/lib/supabase/client"

export default function CancelButton({ eventId, playerId, onSuccess }: { eventId: any; playerId: any; onSuccess: () => void }) {

  const supabase = createClient()

  async function cancel() {

    const { error } = await supabase.rpc("cancel_event_participation", {
      p_event_id: eventId,
      p_player_id: playerId
    })

    if (!error && onSuccess) {
      onSuccess()
    }

  }

  return (
    <button
      onClick={cancel}
      className="bg-red-600 text-white px-3 py-1 rounded"
    >
      Cancel
    </button>
  )
}
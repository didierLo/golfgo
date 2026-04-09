'use client'

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function InviteYesPage() {

  const supabase = createClient()
  const searchParams = useSearchParams()

  const [message, setMessage] = useState("Processing...")

  useEffect(() => {
    handleAccept()
  }, [])

  async function handleAccept() {

    const token = searchParams.get("token")

    if (!token) {
      setMessage("Invalid invitation")
      return
    }

    const { error } = await supabase
      .from("event_participants")
      .update({
        status: "GOING",
        responded_at: new Date().toISOString()
      })
      .eq("invite_token", token)

    if (error) {
      console.error(error)
      setMessage("Error updating invitation")
      return
    }

    setMessage("✅ You are registered for the event")

  }

  return (

    <div className="p-10 text-center">

      <h1 className="text-xl font-bold mb-4">
        GolfGo
      </h1>

      <p>{message}</p>

    </div>

  )
}
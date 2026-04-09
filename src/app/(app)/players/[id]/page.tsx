'use client'

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Player = {
  id: string
  first_name: string
  surname: string
  whs: number | null
  federal_no: string | null
  email: string | null
  phone: string | null
  home_club: string | null
}

export default function PlayerPage(){

  const supabase = createClient()
  const router = useRouter()
  const params = useParams()

  const playerId = params.id as string

  const [player,setPlayer] = useState<Player | null>(null)
  const [loading,setLoading] = useState(true)

  useEffect(()=>{

    async function loadPlayer(){

      const {data,error} = await supabase
        .from("players")
        .select("*")
        .eq("id",playerId)
        .single()

      if(error){
        alert(error.message)
        router.push("/players")
        return
      }

      setPlayer(data)
      setLoading(false)

    }

    loadPlayer()

  },[playerId])


  if(loading){

    return(
      <div className="p-8 text-gray-500">
        Loading player…
      </div>
    )

  }

  if(!player) return null


  return(

    <div className="p-8 max-w-3xl mx-auto space-y-6">

      <button
        onClick={()=>router.push("/players")}
        className="text-blue-600 hover:underline"
      >
        ← Back to players
      </button>


      <div className="bg-white p-6 rounded-xl shadow">

        <h1 className="text-3xl font-bold mb-4">
          {player.first_name} {player.surname}
        </h1>

        <div className="space-y-2 text-sm">

          <p>
            <strong>WHS:</strong> {player.whs ?? "-"}
          </p>

          <p>
            <strong>Federal #:</strong> {player.federal_no || "-"}
          </p>

          <p>
            <strong>Email:</strong> {player.email || "-"}
          </p>

          <p>
            <strong>Phone:</strong> {player.phone || "-"}
          </p>

          <p>
            <strong>Home club:</strong> {player.home_club || "-"}
          </p>

        </div>


        <div className="mt-6">

          <button
            onClick={()=>router.push(`/players/${player.id}/edit`)}
            className="bg-yellow-600 text-white px-4 py-2 rounded"
          >
            Edit player
          </button>

        </div>

      </div>

    </div>

  )

}
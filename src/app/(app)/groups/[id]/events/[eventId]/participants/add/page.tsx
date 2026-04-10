'use client'

import { useEffect,useState } from "react"
import { useParams,useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Player = {
  id:string
  first_name:string
  surname:string
}

export default function AddParticipantsPage(){

  const supabase = createClient()
  const router = useRouter()
  const params = useParams()

  const groupId = params.id as string
  const eventId = params.eventId as string

  const [players,setPlayers] = useState<Player[]>([])
  const [selected,setSelected] = useState<string[]>([])
  const [loading,setLoading] = useState(true)
  const [sending,setSending] = useState(false)

  useEffect(()=>{
    loadPlayers()
  },[])

  async function loadPlayers(){

    const {data,error} = await supabase
      .from("groups_players")
      .select(`
        player_id,
        players(
          id,
          first_name,
          surname
        )
      `)
      .eq("group_id",groupId)

    if(error){
      console.error(error)
      return
    }

    const list =
      data?.map(p=>p.players) || []

    setPlayers(
      list.sort((a,b)=>
        a.surname.localeCompare(b.surname)
      ) as any
    )

    setLoading(false)
  }

  function togglePlayer(id:string){

    if(selected.includes(id)){
      setSelected(selected.filter(p=>p!==id))
    }else{
      setSelected([...selected,id])
    }

  }

  function selectAll(){

    if(selected.length === players.length){
      setSelected([])
    }else{
      setSelected(players.map(p=>p.id))
    }

  }

  async function handleAddParticipants(){

    if(sending) return
    setSending(true)

    const rows = selected.map(playerId=>({
      event_id:eventId,
      player_id:playerId,
      status:"INVITED"
    }))

    const {error} = await supabase
      .from("event_participants")
      .upsert(rows,{
        onConflict:"event_id,player_id"
      })

    setSending(false)

    if(error){
      alert(error.message)
      return
    }

    alert(`${rows.length} players added`)
    router.back()

  }

  if(loading){
    return(
      <div className="p-8">
        Loading players...
      </div>
    )
  }

  return(

    <div className="p-8 max-w-3xl mx-auto space-y-6">

      <h1 className="text-2xl font-bold">
        Add participants
      </h1>

      <div className="flex items-center gap-3">

        <input
          type="checkbox"
          checked={selected.length === players.length}
          onChange={selectAll}
        />

        <span className="font-medium">
          Select all
        </span>

      </div>

      <div className="space-y-2">

        {players.map(player=>(

          <div
            key={player.id}
            className="flex items-center gap-3 border p-2 rounded"
          >

            <input
              type="checkbox"
              checked={selected.includes(player.id)}
              onChange={()=>togglePlayer(player.id)}
            />

            <span>
              {player.first_name} {player.surname}
            </span>

          </div>

        ))}

      </div>

      <button
        onClick={handleAddParticipants}
        disabled={sending}
        className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
      >
        {sending ? "Adding..." : "Add selected players"}
      </button>

    </div>

  )

}
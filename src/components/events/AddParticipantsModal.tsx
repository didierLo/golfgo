'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Player = {
  id: string
  first_name: string
  surname: string
  email: string | null
  whs: number | null
}

type Event = {
  title: string
  location: string | null
  starts_at: string
}

type Props = {
  groupId: string
  eventId: string
  event: Event
  onClose: () => void
}

export default function AddParticipantsModal({
  groupId,
  eventId,
  event,
  onClose
}: Props){

  const supabase = createClient()

  const [players,setPlayers] = useState<Player[]>([])
  const [filteredPlayers,setFilteredPlayers] = useState<Player[]>([])
  const [selectedPlayers,setSelectedPlayers] = useState<string[]>([])
  const [search,setSearch] = useState('')
  const [loading,setLoading] = useState(true)

  const [sendEmail,setSendEmail] = useState(true)
  

  useEffect(()=>{
    loadPlayers()
  },[])

  useEffect(()=>{
    filterPlayers()
  },[search,players])

  async function loadPlayers(){

    setLoading(true)

    const { data:groupPlayers } = await supabase
      .from('groups_players')
      .select(`
        player_id,
        players(
          id,
          first_name,
          surname,
          email,
          whs
        )
      `)
      .eq('group_id',groupId)

    const { data:participants } = await supabase
      .from('event_participants')
      .select('player_id')
      .eq('event_id',eventId)

    const participantIds =
      participants?.map(p=>p.player_id) ?? []

    const availablePlayers =
      groupPlayers
        ?.map((g:any)=>g.players)
        .filter((p:Player)=>!participantIds.includes(p.id))
        ?? []

    setPlayers(availablePlayers)
    setFilteredPlayers(availablePlayers)
    setLoading(false)
  }

  function filterPlayers(){

    if(!search){
      setFilteredPlayers(players)
      return
    }

    const s = search.toLowerCase()

    const filtered = players.filter(p =>
      `${p.first_name} ${p.surname}`
        .toLowerCase()
        .includes(s)
    )

    setFilteredPlayers(filtered)
  }

  function togglePlayer(playerId:string){

    if(selectedPlayers.includes(playerId)){
      setSelectedPlayers(
        selectedPlayers.filter(p=>p!==playerId)
      )
    }else{
      setSelectedPlayers([
        ...selectedPlayers,
        playerId
      ])
    }
  }

  function selectAll(){

    const ids = filteredPlayers.map(p=>p.id)

    setSelectedPlayers(ids)
  }

  function clearSelection(){
    setSelectedPlayers([])
  }

  async function addParticipants(){

    if(selectedPlayers.length === 0) return

    const rows = selectedPlayers.map(playerId=>({
      event_id:eventId,
      player_id:playerId,
      status:"INVITED",
      registration_source:"manual",
      invite_token:crypto.randomUUID()
    }))

    const { error } = await supabase
      .from("event_participants")
      .upsert(rows,{
        onConflict:"event_id,player_id"
      })

    if(error){
      console.error(error)
      alert("Error adding participants")
      return
    }

    const invitations = selectedPlayers.map(playerId=>{

      const player = players.find(p=>p.id===playerId)

      const row = rows.find(r=>r.player_id===playerId)

      return {
        email:player?.email,
        invite_token:row?.invite_token
      }

    })

    if(sendEmail){
    await fetch("/api/send-invitations",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        invitations,
        event:{
          title:event.title,
          location:event.location,
          starts_at:event.starts_at,
          group_id:groupId,
          event_id:eventId
        }
      })
    })
  }
    alert("Players invited")

    onClose()
  }

  return(

    <div className="fixed inset-0 bg-black/40 flex items-center justify-center">

      <div className="bg-white rounded p-6 w-[420px]">

        <h2 className="text-lg font-bold mb-4">
          Add Participants
        </h2>

        <label className="flex items-center gap-2 mt-4">

  <input
    type="checkbox"
    checked={sendEmail}
    onChange={e=>setSendEmail(e.target.checked)}
  />

  Send invitation email to players

</label>

        <input
          type="text"
          placeholder="Search player..."
          value={search}
          onChange={e=>setSearch(e.target.value)}
          className="border w-full px-2 py-1 mb-3"
        />

        <div className="flex gap-2 mb-3">

          <button
            onClick={selectAll}
            className="text-sm border px-2 py-1"
          >
            Select all
          </button>

          <button
            onClick={clearSelection}
            className="text-sm border px-2 py-1"
          >
            Clear
          </button>

        </div>

        {loading && (
          <p>Loading players...</p>
        )}

        {!loading && filteredPlayers.length===0 && (
          <p className="text-gray-500">
            All players already invited
          </p>
        )}

        <div className="space-y-2 max-h-64 overflow-y-auto">

          {filteredPlayers.map(player=>(

            <label
              key={player.id}
              className="flex items-center gap-2"
            >

              <input
                type="checkbox"
                checked={selectedPlayers.includes(player.id)}
                onChange={()=>togglePlayer(player.id)}
              />

              {player.first_name} {player.surname}

              <span className="text-gray-500 text-sm">
                {player.whs ?? '-'}
              </span>

            </label>

          ))}

        </div>

        <div className="flex justify-between mt-4 text-sm text-gray-500">
          {selectedPlayers.length} selected
        </div>

        <div className="flex justify-end gap-2 mt-2">

          <button
            onClick={onClose}
            className="border px-3 py-1"
          >
            Cancel
          </button>

          <button
            onClick={addParticipants}
            className="bg-blue-600 text-white px-3 py-1"
          >
            Invite
          </button>

        </div>

      </div>

    </div>
  )
}
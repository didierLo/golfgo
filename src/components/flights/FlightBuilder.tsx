'use client'

import {
  DndContext,
  closestCenter,
  DragEndEvent
} from "@dnd-kit/core"

import { useState } from "react"

type Player = {
  id:string
  first_name:string
  surname:string
}

type Flight = {
  id:string
  players:Player[]
}

export default function FlightBuilder({players}:{players:Player[]}){

  const [available,setAvailable] = useState<Player[]>(players)

  const [flights,setFlights] = useState<Flight[]>([
    {id:"flight1",players:[]}
  ])

  function addFlight(){

    const next = flights.length + 1

    setFlights([
      ...flights,
      {id:`flight${next}`,players:[]}
    ])

  }

  function removeFlight(id:string){

    const flight = flights.find(f=>f.id===id)

    if(!flight) return

    setAvailable([
      ...available,
      ...flight.players
    ])

    setFlights(
      flights.filter(f=>f.id!==id)
    )

  }

  function handleDragEnd(event:DragEndEvent){

    const {active,over} = event

    if(!over) return

    const playerId = String(active.id)
    const targetFlightId = String(over.id)

    const player =
      available.find(p=>p.id===playerId)

    if(!player) return

    setAvailable(
      available.filter(p=>p.id!==playerId)
    )

    setFlights(prev =>
      prev.map(f=>{

        if(f.id===targetFlightId){

          return {
            ...f,
            players:[...f.players,player]
          }

        }

        return f

      })
    )

  }

  return(

    <div>

      {/* BUTTONS */}

      <div className="mb-6 flex gap-3">

        <button
          onClick={addFlight}
          className="bg-green-600 text-white px-3 py-1 rounded"
        >
          + Add flight
        </button>

      </div>

      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >

        <div className="grid grid-cols-4 gap-6">

          {/* AVAILABLE */}

          <div className="bg-gray-50 p-4 rounded">

            <h3 className="font-semibold mb-3">
              Available players
            </h3>

            {available.map(p=>(

              <div
                key={p.id}
                id={p.id}
                className="p-2 bg-white border rounded mb-2"
              >

                {p.first_name} {p.surname}

              </div>

            ))}

          </div>

          {/* FLIGHTS */}

          {flights.map((flight,i)=>(

            <div
              key={flight.id}
              id={flight.id}
              className="bg-green-50 p-4 rounded"
            >

              <div className="flex justify-between mb-3">

                <h3 className="font-semibold">
                  Flight {i+1}
                </h3>

                <button
                  onClick={()=>removeFlight(flight.id)}
                  className="text-red-500 text-sm"
                >
                  ✕
                </button>

              </div>

              {flight.players.map(p=>(

                <div
                  key={p.id}
                  className="p-2 bg-white border rounded mb-2"
                >

                  {p.first_name} {p.surname}

                </div>

              ))}

            </div>

          ))}

        </div>

      </DndContext>

    </div>

  )

}
type Player = {
  id:string
  first_name:string
  surname:string
  whs:number | null
}

type FlightRow = {
  flight_no:number
  players:Player[]
}

type Props = {
  flights:FlightRow[]
}

export default function FlightsList({flights}:Props){

  if(flights.length === 0){

    return(
      <p className="text-gray-500">
        No flights generated
      </p>
    )

  }

  return(

    <div className="space-y-4">

      {flights.map(flight=>(

        <div
          key={flight.flight_no}
          className="bg-white p-4 rounded shadow"
        >

          <h2 className="font-semibold mb-2">
            Flight {flight.flight_no}
          </h2>

          <ul className="text-sm space-y-1">

            {flight.players.map(p=>(

              <li key={p.id}>
                {p.first_name} {p.surname}
                {' '}
                (WHS {p.whs ?? '-'})
              </li>

            ))}

          </ul>

        </div>

      ))}

    </div>

  )

}
import { simpleFlights } from "./formats/simple"
import { optimizedFlights } from "./formats/optimized"
import { scramble3Flights } from "./formats/scramble3"

function normalizeFlights(flights: any[]) {
  return flights.map((f, i) => {
    if (f.players) return f
    return { flight_no: i + 1, players: f }
  })
}

export function generateFlights(players: any[], options: any) {
  let result

  if (options.flightMode === "optimized") {
    result = optimizedFlights(players, options)
  } else if (options.flightMode === "scramble3") {
    result = scramble3Flights(players, options)
  } else {
    result = simpleFlights(players, options)
  }

  return normalizeFlights(result)
}
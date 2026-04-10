import { Player, Flight } from "../types"
import { fisherYatesShuffle } from "./fisherYatesShuffle"
import { scoreFlights } from "./scoreFlights"

function buildFlights(
  players: Player[],
  structure: number[]
): any[] {

  const flights: Flight[] = []
  let index = 0

  for (const size of structure) {
    flights.push({
      flight_no: flights.length + 1,
      players: players.slice(index, index + size)
    })
    index += size
  }

  return flights  
}

export function monteCarloOptimizer(
  players: Player[],
  structure: number[],
  iterations: number,
  forbiddenPairs?: Set<string>
): Flight[] {

  let bestFlights: Flight[] = []
  let bestScore = Infinity

  for (let i = 0; i < iterations; i++) {

    const shuffled =
      fisherYatesShuffle(players)

    const flights =
      buildFlights(shuffled, structure)

    const score = scoreFlights(flights, { 
      flightSize: structure.length,
      forbiddenPairs 
      } as any)

    if (score < bestScore) {

      bestScore = score
      bestFlights = flights

    }

  }

  return bestFlights
}
import { computeStructure } from '@/lib/golf/flights/computeStructure'

export function buildFlights(players: any[], size: number) {

  // Calcule la bonne distribution (ex: 10 joueurs size 4 → [4,3,3] pas [4,4,2])
  const sizes = computeStructure(players.length, size)

  const flights = []
  let cursor = 0

  for (let i = 0; i < sizes.length; i++) {
    const flightSize = sizes[i]
    flights.push({
      flight_no: i + 1,
      players: players.slice(cursor, cursor + flightSize)
    })
    cursor += flightSize
  }

  return flights
}

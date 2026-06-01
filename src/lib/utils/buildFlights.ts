import { computeStructure } from '@/lib/golf/flights/computeStructure'

export function buildFlights(players: any[], size: number) {
  const sizes = computeStructure(players.length, size)

  const flights: { flight_no: number; players: any[] }[] = []  // ← ici
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
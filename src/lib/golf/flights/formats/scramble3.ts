import { buildFlights } from "@/lib/utils/buildFlights"
import { shuffle } from "@/lib/utils/shuffle"

export function scramble3Flights(players: any[]) {
  const shuffled = shuffle(players)

  return buildFlights(shuffled, 3)
}
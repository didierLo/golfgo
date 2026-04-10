import { buildFlights } from "@/lib/utils/buildFlights"
import { shuffle } from "@/lib/utils/shuffle"

export function simpleFlights(players: any[], options: any) {

  const flightSize = options.flightSize ?? 4

  const shuffled = shuffle(players)

  return buildFlights(shuffled, flightSize)
}
import { Player, Flight, GenerateOptions } from "../types"
import { scoreFlights } from "./scoreFlights"
import { buildFlights } from "@/lib/utils/buildFlights"
import { shuffle } from "@/lib/utils/shuffle"

// --- MUTATIONS ---

function fullShuffle(flights: Flight[], flightSize: number): Flight[] {

  const players = flights.flatMap(f => f.players)

  return buildFlights(shuffle(players), flightSize)
}

function partialShuffle(flights: Flight[], flightSize: number): Flight[] {

  const players = flights.flatMap(f => f.players)

  const half = Math.floor(players.length / 2)

  const shuffled = shuffle(players)

  const mixed = [
    ...shuffled.slice(0, half),
    ...players.slice(half)
  ]

  return buildFlights(mixed, flightSize)
}


function swapPlayers(flights: Flight[]): Flight[] {

  const copy = structuredClone(flights)

  if (copy.length < 2) return copy

  const f1Index = Math.floor(Math.random() * copy.length)
  let f2Index = Math.floor(Math.random() * copy.length)

  // éviter même flight
  if (f1Index === f2Index) {
    f2Index = (f2Index + 1) % copy.length
  }

  const f1 = copy[f1Index]
  const f2 = copy[f2Index]

  // 🔥 ICI (sécurité importante)
  if (!f1.players.length || !f2.players.length) return copy

  const i1 = Math.floor(Math.random() * f1.players.length)
  const i2 = Math.floor(Math.random() * f2.players.length)

  ;[f1.players[i1], f2.players[i2]] =
    [f2.players[i2], f1.players[i1]]

  return copy
}

// --- OPTIMIZER ---

export function optimizeFlights(
  players: Player[],
  options: GenerateOptions
): Flight[] {

  console.log("PLAYERS IN", players.length)

  const flightSize = options.flightSize ?? 4
  const iterations = options.iterations ?? players.length * 50

  // ✅ seed initial
  let current = buildFlights(
    shuffle(players),
    flightSize
  )

  console.log("INITIAL FLIGHTS", current)

  let best = current

  let currentScore = scoreFlights(current, options)
  let bestScore = currentScore

  for (let i = 0; i < iterations; i++) {

    let candidate: Flight[]

    const r = Math.random()

    if (r < 0.2) {
      candidate = fullShuffle(current, flightSize)
    } else if (r < 0.6) {
      candidate = partialShuffle(current, flightSize)
    } else {
      candidate = swapPlayers(current)
    }

    const candidateScore = scoreFlights(candidate, options)

    if (candidateScore < bestScore) {
      best = candidate
      bestScore = candidateScore
    }

    current = candidate
  }

  console.log("BEST RESULT", best)

  return structuredClone(best)
}
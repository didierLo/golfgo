import { Flight, GenerateOptions } from "../types"
import { scoreFlight } from "./scoreFlight"
import { buildPairMatrix } from "./pairMatrix"

export function scoreFlights(
  flights: Flight[],
  options: GenerateOptions
) {

  let total = 0

  const pairMatrix =
  options.pastFlights?.length
    ? buildPairMatrix(options.pastFlights)
    : new Map()


  // 🔥 timestamp actuel
  const now = Date.now()

  for (const flight of flights) {

// 👥 PAIRS INSIDE FLIGHT (constraints + historique)
for (let i = 0; i < flight.players.length; i++) {
  for (let j = i + 1; j < flight.players.length; j++) {

    const p1 = flight.players[i]
    const p2 = flight.players[j]

    const key = [p1.id, p2.id].sort().join("-")

    // 🚫 forbidden
    if (options.forbiddenPairs?.has(key)) {
      total += 1000
    }

    // ⭐ preferred
    if (options.preferredPairs?.has(key)) {
      total -= 50
    }

    // 🧠 HISTORIQUE (Excel-like)
    const count = pairMatrix.get(key) || 0

    if (count > 0) {
      total += count * 30
    }
  }
}

    // 🎯 score de base (WHS etc)
    const result = scoreFlight(flight, options)

    if (typeof result === "number") {
      total += result
    } else {
      total += result.total
    }
  }

  // 🧠 HISTORIQUE INTELLIGENT
    if ((options.historyWindowDays ?? 0) > 0 && options.pastFlights?.length) {

    for (const past of options.pastFlights) {

      const pastTime = new Date(past.date).getTime()

      const daysAgo = (now - pastTime) / (1000 * 60 * 60 * 24)

      // 🔥 pondération temporelle
      let weight = 1

      if (daysAgo < 7) weight = 1.0
      else if (daysAgo < 30) weight = 0.7
      else if (daysAgo < 90) weight = 0.4
      else weight = 0.2

      const pastIds = new Set(past.players.map(p => p.id))

      for (const flight of flights) {

        let overlap = 0

        for (const p of flight.players) {
          if (pastIds.has(p.id)) overlap++
        }

        if (overlap >= 2) {
          total += (overlap - 1) * 80 * weight
        }
      }
    }
  }

  return total
}
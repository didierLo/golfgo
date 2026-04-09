import { Flight, GenerateOptions } from "../types"
import { hasPair } from "@/lib/utils/pairs"

const HANDICAP_WEIGHT = 1
const HISTORY_WEIGHT = 5
const PREFERENCE_BONUS = 3
const FORBIDDEN_PENALTY = 10000

export function scoreFlight(
  flight: Flight,
  options: GenerateOptions
) {

  const {
    historyMatrix,
    forbiddenPairs,
    preferredPairs,
    debug
  } = options

  let score = 0

  let handicapScore = 0
  let historyScore = 0
  let preferenceScore = 0

  // 🔴 1. FORBIDDEN (HARD STOP)
  for (let i = 0; i < flight.length; i++) {
    for (let j = i + 1; j < flight.length; j++) {

      const a = flight[i].id
      const b = flight[j].id

      if (hasPair(forbiddenPairs, a, b)) {
        return debug
          ? {
              total: FORBIDDEN_PENALTY,
              reason: "forbidden"
            }
          : FORBIDDEN_PENALTY
      }
    }
  }

  // 🎯 2. HANDICAP
 const handicaps = flight.players.map(p => p.whs ?? 36)
  const max = Math.max(...handicaps)
  const min = Math.min(...handicaps)

  handicapScore = max - min
  score += handicapScore * HANDICAP_WEIGHT

  // 🧠 3. HISTORY
  for (let i = 0; i < flight.length; i++) {
    for (let j = i + 1; j < flight.length; j++) {

      const a = flight[i].id
      const b = flight[j].id

      historyScore += historyMatrix?.[a]?.[b] ?? 0
    }
  }

  score += historyScore * HISTORY_WEIGHT

  // 🟢 4. PREFERENCES
  for (let i = 0; i < flight.length; i++) {
    for (let j = i + 1; j < flight.length; j++) {

      const a = flight[i].id
      const b = flight[j].id

      if (hasPair(preferredPairs, a, b)) {
        preferenceScore++
      }
    }
  }

  score -= preferenceScore * PREFERENCE_BONUS

  // 🧪 DEBUG MODE
 if (debug) {
  return {
    total: score,
    handicap: handicapScore,
    history: historyScore,
    historyWeighted: historyScore * HISTORY_WEIGHT,
    preference: preferenceScore,
    preferenceWeighted: preferenceScore * PREFERENCE_BONUS
  }
}

  return score
}
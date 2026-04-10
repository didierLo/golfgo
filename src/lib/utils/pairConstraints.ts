import { pairKey } from "@/lib/utils/pairs"

export function hasForbiddenPair(
  players: string[],
  forbidden: Set<string>
) {

    if (!forbidden || forbidden.size === 0) return false

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {

      if (forbidden.has(pairKey(players[i], players[j]))) {
        return true
      }
    }
  }

  return false
}
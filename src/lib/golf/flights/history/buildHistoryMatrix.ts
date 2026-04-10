import { Flight } from "../types"

export function buildHistoryMatrix(previousFlights: Flight[]) {
  const matrix: Record<string, Record<string, number>> = {}

  for (const flight of previousFlights) {
    const players = flight.players ?? []

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i].id
        const b = players[j].id

        if (!matrix[a]) matrix[a] = {}
        if (!matrix[b]) matrix[b] = {}

        matrix[a][b] = (matrix[a][b] ?? 0) + 1
        matrix[b][a] = (matrix[b][a] ?? 0) + 1
      }
    }
  }

  return matrix
}
export function buildPairMatrix(pastFlights: any[]) {

  const matrix = new Map<string, number>()

  for (const flight of pastFlights) {

    const players = flight.players

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {

        const p1 = players[i].id
        const p2 = players[j].id

        const key =
          p1 < p2 ? `${p1}-${p2}` : `${p2}-${p1}`

        matrix.set(key, (matrix.get(key) || 0) + 1)
      }
    }
  }

  return matrix
}
import { Flight } from "../types"

export function buildHistoryMatrix(
  previousFlights:Flight[]
){

  const matrix:Record<string,Record<string,number>> = {}

  for(const flight of previousFlights){

    for(let i=0;i<flight.length;i++){

      for(let j=i+1;j<flight.length;j++){

        const a = flight[i].id
        const b = flight[j].id

        if(!matrix[a]) matrix[a] = {}
        if(!matrix[b]) matrix[b] = {}

        matrix[a][b] =
          (matrix[a][b] ?? 0) + 1

        matrix[b][a] =
          (matrix[b][a] ?? 0) + 1

      }

    }

  }

  return matrix
}
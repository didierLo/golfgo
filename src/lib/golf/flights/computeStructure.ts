export function computeStructure(
  players:number,
  maxSize:number
){

  const flightsCount =
    Math.ceil(players / maxSize)

  const base =
    Math.floor(players / flightsCount)

  const remainder =
    players % flightsCount

  const flights:number[] = []

  for(let i=0;i<flightsCount;i++){

    if(i < remainder)
      flights.push(base + 1)
    else
      flights.push(base)

  }

  return flights
}
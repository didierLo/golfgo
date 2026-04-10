export function matchplayFlights(players: any[]) {

  const shuffled =
    [...players].sort(()=>Math.random()-0.5)

  const flights=[]

  while(shuffled.length){

    const flight =
      shuffled.splice(0,4)

    flights.push({
      players:flight,
      teams:bestTeams(flight)
    })

  }

  return flights

}


function bestTeams(flight: any[]) {

  const [a,b,c,d] = flight

  const combos = [

    [[a,b],[c,d]],
    [[a,c],[b,d]],
    [[a,d],[b,c]]

  ]

  let best=null
  let bestDiff=Infinity

  for(const [t1,t2] of combos){

    const s1 =
      t1[0].whs + t1[1].whs

    const s2 =
      t2[0].whs + t2[1].whs

    const diff = Math.abs(s1-s2)

    if(diff<bestDiff){
      bestDiff=diff
      best=[t1,t2]
    }

  }

  return best

}
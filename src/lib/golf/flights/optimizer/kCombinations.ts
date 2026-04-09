export function kCombinations(
  set:any[],
  k:number
){

  if(k > set.length || k <= 0)
    return []

  if(k === set.length)
    return [set]

  if(k === 1)
    return set.map(v => [v])

  const combos:any[] = []

  for(let i=0;i<set.length-k+1;i++){

    const head = set.slice(i,i+1)

    const tail =
      kCombinations(
        set.slice(i+1),
        k-1
      )

    tail.forEach(t => {

      combos.push(
        head.concat(t)
      )

    })

  }

  return combos

}
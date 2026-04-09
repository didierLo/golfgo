export type PairKey = string

export function pairKey(a: string, b: string): PairKey {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

export function hasPair(
  set: Set<PairKey> | undefined,
  a: string,
  b: string
): boolean {
  if (!set || set.size === 0) return false
  return set.has(pairKey(a, b))
}

export function buildPairSet(
  pairs: [string, string][]
): Set<PairKey> {
  const set = new Set<PairKey>()

  for (const [a, b] of pairs) {
    set.add(pairKey(a, b))
  }

  return set
}
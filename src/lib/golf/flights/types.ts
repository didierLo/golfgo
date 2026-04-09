export type Player = {
  id: string
  first_name: string
  surname: string
  whs: number | null
}

export type Flight = {
  flight_no: number
  players: Player[]
}

export type HistoryMatrix =
  Record<string, Record<string, number>>

// 🧠 Pair key
export type PairKey = string

// ⚙️ Weights
export type Weights = {
  handicap: number
  history: number
  globalBalance: number
  preference: number
  softConstraint: number
}

// 🎯 Options moteur
export type GenerateOptions = {
  flightSize: number
  iterations?: number

  historyMatrix?: HistoryMatrix

  forbiddenPairs?: Set<PairKey>
  preferredPairs?: Set<PairKey>

  weights?: Partial<Weights>

  historyWindowDays?: number

  debug?: boolean
}
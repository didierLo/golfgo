/**
 * Souhaits « premier flight » / « dernier flight » (table player_flight_preferences).
 *
 * Ce module sert aux trois endroits qui en ont besoin :
 *  - la génération des flights (le moteur reçoit la Map et la prend en compte) ;
 *  - la page Flights (signalement quand un déplacement manuel casse un souhait) ;
 *  - la page Liste des départs (signalement quand on réordonne les flights).
 *
 * Seuls les administrateurs du groupe peuvent lire cette table (droits RLS) :
 * pour les autres, la Map est simplement vide et rien n'est affiché.
 */

export type FlightPositionPref = 'first' | 'last'

/** Clé = id du joueur. */
export type PositionPrefs = Map<string, FlightPositionPref>

export type PositionCheck = {
  playerId: string
  name: string
  pref: FlightPositionPref
  /** Numéro (affiché) du flight où se trouve le joueur. */
  flightNumber: number
  /** true si le souhait est respecté. */
  ok: boolean
}

type CheckPlayer = { id: string; first_name?: string | null; surname?: string | null }
export type OrderedFlight = { number: number; players: CheckPlayer[] }

/** Lit les souhaits d'un groupe. En cas d'erreur ou sans droits : Map vide (jamais d'exception). */
export async function fetchPositionPrefs(supabase: any, groupId: string): Promise<PositionPrefs> {
  const prefs: PositionPrefs = new Map()
  try {
    const { data } = await supabase
      .from('player_flight_preferences')
      .select('player_id, preference')
      .eq('group_id', groupId)
    for (const row of data ?? []) {
      if (row.preference === 'first' || row.preference === 'last') prefs.set(row.player_id, row.preference)
    }
  } catch { /* on continue sans souhaits */ }
  return prefs
}

/**
 * Vérifie, pour chaque joueur qui a un souhait ET qui est placé dans un flight, si ce souhait est respecté.
 *
 * `flights` doit être dans l'ordre de départ. Les flights vides sont ignorés : un flight vide ajouté
 * à la main en fin de liste ne doit pas rendre « dernier flight » impossible à satisfaire.
 */
export function checkPositionPrefs(flights: OrderedFlight[], prefs: PositionPrefs): Map<string, PositionCheck> {
  const result = new Map<string, PositionCheck>()
  if (prefs.size === 0) return result

  const filled = flights.filter(f => f.players.length > 0)
  const lastIdx = filled.length - 1

  filled.forEach((flight, idx) => {
    for (const p of flight.players) {
      const pref = prefs.get(p.id)
      if (!pref) continue
      result.set(p.id, {
        playerId: p.id,
        name: `${p.first_name ?? ''} ${p.surname ?? ''}`.trim(),
        pref,
        flightNumber: flight.number,
        ok: pref === 'first' ? idx === 0 : idx === lastIdx,
      })
    }
  })
  return result
}

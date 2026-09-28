// Échecs d'envoi d'emails, vus PAR GROUPE : ce qu'un organisateur a le droit de voir et de traiter.
// Toute requête est bornée au groupe demandé ; le contenu des emails (html, pièces jointes) n'est jamais lu.

const FAILURE_COLUMNS = 'id, category, event_id, player_id, to_email, subject, last_error, created_at'

export type EmailFailure = {
  id: string
  category: string
  createdAt: string
  failedAddress: string
  subject: string
  error: string | null
  player: { id: string; name: string; currentEmail: string | null } | null
  event:  { id: string; title: string; startsAt: string } | null
  /** Renvoi direct possible : invitation, joueur connu, ET adresse corrigée depuis l'échec. */
  canResend: boolean
}

const norm = (e: string | null | undefined) => (e ?? '').trim().toLowerCase()

export async function listGroupEmailFailures(admin: any, groupId: string): Promise<EmailFailure[]> {
  const { data: rows } = await admin.from('email_queue')
    .select(FAILURE_COLUMNS)
    .eq('group_id', groupId).eq('status', 'failed').is('resolved_at', null)
    .order('created_at', { ascending: false }).limit(100)
  if (!rows?.length) return []

  const playerIds = [...new Set(rows.map((r: any) => r.player_id).filter(Boolean))] as string[]
  const eventIds  = [...new Set(rows.map((r: any) => r.event_id).filter(Boolean))] as string[]
  const [{ data: players }, { data: events }] = await Promise.all([
    playerIds.length ? admin.from('players').select('id, first_name, surname, email').in('id', playerIds) : Promise.resolve({ data: [] }),
    eventIds.length  ? admin.from('events').select('id, title, starts_at').in('id', eventIds).eq('group_id', groupId) : Promise.resolve({ data: [] }),
  ])
  const pById = new Map((players ?? []).map((p: any) => [p.id, p]))
  const eById = new Map((events  ?? []).map((e: any) => [e.id, e]))

  return rows.map((r: any) => {
    const p = r.player_id ? pById.get(r.player_id) as any : null
    const e = r.event_id  ? eById.get(r.event_id)  as any : null
    return {
      id: r.id, category: r.category, createdAt: r.created_at,
      failedAddress: r.to_email, subject: r.subject, error: r.last_error,
      player: p ? { id: p.id, name: `${p.first_name} ${p.surname}`, currentEmail: p.email ?? null } : null,
      event:  e ? { id: e.id, title: e.title, startsAt: e.starts_at } : null,
      canResend: r.category === 'invitation' && !!p && !!e && !!norm(p.email) && norm(p.email) !== norm(r.to_email),
    }
  })
}

/** Marque un échec comme traité. Retourne false si cette ligne n'existe pas DANS CE GROUPE. */
export async function resolveGroupEmailFailure(admin: any, groupId: string, id: string): Promise<boolean> {
  const { data } = await admin.from('email_queue')
    .update({ resolved_at: new Date().toISOString() })
    .eq('id', id).eq('group_id', groupId).eq('status', 'failed').select('id')
  return !!data?.length
}

// Contacts « organisateur » d'un groupe.
//
// Avant ce fichier, chaque route (invitation, rappel, communication, invitation de groupe, alertes
// de flights…) recalculait ce contact à sa façon, en piochant SANS ORDRE GARANTI dans les lignes
// `groups_players` de rôle « owner ». Avec un seul organisateur par groupe cela ne se voyait pas,
// mais dès qu'un groupe a DEUX personnes en rôle « owner » (ex. un ancien organisateur qui garde un
// accès de suivi, et un nouveau qui reprend la main), le nom affiché dans les emails pouvait changer
// de l'un à l'autre selon l'ordre renvoyé par la requête.
//
// Règle unique, fixée ici :
//   - le SIGNATAIRE des emails adressés aux joueurs (invitation, rappel, invitation à rejoindre le
//     groupe, communications libres) est TOUJOURS la personne dont le compte correspond à
//     `groups.owner_id` (« primary » ci-dessous) — un seul par groupe, déterministe.
//   - les ALERTES d'organisateur (pas de tee sheet généré, flights incohérents, changement de statut
//     d'un joueur) partent à TOUTES les personnes ayant le rôle « owner » dans le groupe (« all »),
//     pas seulement au signataire : un accès de suivi donné à quelqu'un d'autre continue de recevoir
//     ces alertes.

export type OwnerContact = {
  userId: string | null
  playerId: string
  firstName: string
  surname: string
  email: string | null
  isPrimary: boolean   // correspond à groups.owner_id : c'est cette personne qui signe les emails aux joueurs
}

export type GroupOwners = {
  logoUrl: string | null
  primary: OwnerContact | null   // à utiliser pour {{owner_name}} et toute signature d'email envoyée aux joueurs
  all: OwnerContact[]            // à utiliser pour les alertes destinées à l'organisateur (push + email)
}

export async function getGroupOwners(supabase: any, groupId: string): Promise<GroupOwners> {
  const [{ data: group }, { data: rows }] = await Promise.all([
    supabase.from('groups').select('owner_id, template_logo_url').eq('id', groupId).maybeSingle(),
    supabase.from('groups_players').select('player_id, user_id, players(first_name, surname, email)')
      .eq('group_id', groupId).eq('role', 'owner'),
  ])
  const ownerId = (group?.owner_id ?? null) as string | null
  const all: OwnerContact[] = (rows ?? []).map((r: any) => {
    const p = Array.isArray(r.players) ? r.players[0] : r.players
    return {
      userId: (r.user_id ?? null) as string | null,
      playerId: r.player_id as string,
      firstName: (p?.first_name ?? '') as string,
      surname: (p?.surname ?? '') as string,
      email: (p?.email ?? null) as string | null,
      isPrimary: !!ownerId && r.user_id === ownerId,
    }
  })
  const primary = all.find(o => o.isPrimary) ?? all[0] ?? null
  return { logoUrl: (group?.template_logo_url ?? null) as string | null, primary, all }
}

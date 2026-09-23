// Garde-fou avant de retirer le rôle « owner » à un joueur d'un groupe.
//
// Deux situations bloquées :
//   - LAST_OWNER : ce joueur est le DERNIER owner du groupe. Un groupe sans owner n'a plus
//     personne pour l'administrer (modifier les événements, générer les flights…).
//   - IS_SIGNER  : ce joueur est désigné comme signataire des emails (`groups.owner_id`), et
//     il reste d'autres owners. Le retirer laisserait un signataire qui n'est même plus owner
//     du groupe — il faut d'abord choisir un autre signataire dans les réglages du groupe.
//
// N'effectue AUCUNE écriture : ne fait que répondre « c'est possible » ou « voici pourquoi pas ».

export type RoleChangeBlock = 'LAST_OWNER' | 'IS_SIGNER' | null

export async function checkOwnerDemotion(supabase: any, groupId: string, playerId: string): Promise<RoleChangeBlock> {
  const [{ data: otherOwners }, { data: group }, { data: player }] = await Promise.all([
    supabase.from('groups_players').select('player_id')
      .eq('group_id', groupId).eq('role', 'owner').neq('player_id', playerId),
    supabase.from('groups').select('owner_id').eq('id', groupId).maybeSingle(),
    supabase.from('players').select('user_id').eq('id', playerId).maybeSingle(),
  ])
  if (!otherOwners || otherOwners.length === 0) return 'LAST_OWNER'
  if (group?.owner_id && player?.user_id && group.owner_id === player.user_id) return 'IS_SIGNER'
  return null
}

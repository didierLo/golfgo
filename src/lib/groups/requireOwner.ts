// Contrôle d'accès « organisateur du groupe » pour les routes API.
//
// Un organisateur, c'est : le propriétaire technique du groupe (groups.owner_id), OU toute personne
// dont le rôle dans groups_players est « owner » — que la ligne soit reliée à son compte directement
// (user_id) ou via sa fiche joueur (players.user_id). Même définition que celle de l'application.
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

/** Fonction pure (client Supabase passé en paramètre) : testable sans serveur. */
export async function isGroupOwner(admin: any, groupId: string, userId: string): Promise<boolean> {
  const [{ data: group }, { data: ownerRows }, { data: myPlayers }] = await Promise.all([
    admin.from('groups').select('owner_id').eq('id', groupId).maybeSingle(),
    admin.from('groups_players').select('player_id, user_id').eq('group_id', groupId).eq('role', 'owner'),
    admin.from('players').select('id').eq('user_id', userId),
  ])
  if (group?.owner_id === userId) return true
  const myPlayerIds = new Set((myPlayers ?? []).map((p: any) => p.id))
  return (ownerRows ?? []).some((r: any) => r.user_id === userId || myPlayerIds.has(r.player_id))
}

export type OwnerCheck = { ok: true; userId: string; admin: any } | { ok: false; status: 401 | 403 }

/** À appeler en tête d'une route API : vérifie la session PUIS le rôle d'organisateur sur CE groupe. */
export async function requireGroupOwner(groupId: string): Promise<OwnerCheck> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401 }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  if (!(await isGroupOwner(admin, groupId, user.id))) return { ok: false, status: 403 }
  return { ok: true, userId: user.id, admin }
}

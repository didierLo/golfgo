// Prévient les organisateurs d'un groupe (notification push) quand un email destiné à un de leurs
// joueurs n'a pas pu être envoyé pour de bon (adresse refusée, etc.).
//
// Une seule notification par « rafale » : si une notification a déjà été envoyée pour ce groupe il y a
// moins de DEBOUNCE_MINUTES, on n'en renvoie pas — sinon un envoi à 40 joueurs dont 5 adresses sont
// invalides déclencherait 5 notifications. Le détail (qui, quelle adresse) est dans Communications.
import { getGroupOwners } from '@/lib/groups/owner'
import { getGroupLocale, serverT } from '@/lib/i18n/server'
import { sendPushToUser } from '@/lib/push/send'

export const DEBOUNCE_MINUTES = 15

type Deps = {
  sendPush: (supabase: any, userId: string, payload: { title: string; body: string; url: string }) => Promise<number>
  now: () => Date
}
const defaultDeps: Deps = { sendPush: sendPushToUser, now: () => new Date() }

/** Retourne le nombre de notifications réellement envoyées (0 si dédoublonnée ou personne à prévenir). */
export async function notifyOwnersOfEmailFailure(
  supabase: any, groupId: string, queueRowId: string, deps: Deps = defaultDeps,
): Promise<number> {
  const since = new Date(deps.now().getTime() - DEBOUNCE_MINUTES * 60_000).toISOString()
  const { data: recent } = await supabase.from('email_queue')
    .select('id').eq('group_id', groupId).gt('notified_at', since).limit(1)
  if (recent?.length) return 0

  // On marque AVANT d'envoyer : limite les doublons si deux échecs arrivent presque en même temps.
  await supabase.from('email_queue').update({ notified_at: deps.now().toISOString() }).eq('id', queueRowId)

  const owners = await getGroupOwners(supabase, groupId)
  const userIds = owners.all.map(o => o.userId).filter((id): id is string => !!id)
  if (!userIds.length) return 0

  const gl = await getGroupLocale(supabase, groupId)
  const t  = serverT(gl)
  const { data: group } = await supabase.from('groups').select('name').eq('id', groupId).maybeSingle()

  let sent = 0
  for (const uid of userIds) {
    sent += await deps.sendPush(supabase, uid, {
      title: t('pushNotif.emailFailedTitle', { group: group?.name ?? '' }),
      body:  t('pushNotif.emailFailedBody'),
      url:   `/${gl}/groups/${groupId}/communications`,
    })
  }
  return sent
}

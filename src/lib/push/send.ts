// Envoi d'une notification push à un utilisateur (tous ses appareils abonnés).
// Module neutre : utilisé par la surveillance des flights, le webhook de changement de statut
// et les alertes d'échec d'email, sans dépendance circulaire entre eux.
import webpush from 'web-push'

let vapidReady = false
export async function sendPushToUser(supabase: any, userId: string, payload: { title: string; body: string; url: string }): Promise<number> {
  const { data: subs } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId)
  if (!subs?.length) return 0
  if (!vapidReady) {
    webpush.setVapidDetails('mailto:info@golfgo.be', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
    vapidReady = true
  }
  let sent = 0
  const stale: string[] = []
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload))
      sent++
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) stale.push(sub.id)
    }
  }
  if (stale.length) await supabase.from('push_subscriptions').delete().in('id', stale)
  return sent
}

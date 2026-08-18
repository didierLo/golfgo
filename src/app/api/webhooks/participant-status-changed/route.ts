import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

webpush.setVapidDetails(
  'mailto:info@golfgo.be',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(req: Request) {
  try {
    const secret = req.headers.get('x-webhook-secret')
    if (secret !== process.env.WEBHOOK_SECRET) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await req.json() as {
      type: string
      table: string
      record: { event_id: string; player_id: string; status: string }
      old_record: { status: string }
    }

    if (payload.table !== 'event_participants') {
      return Response.json({ success: true, skipped: 'wrong table' })
    }

    const oldStatus = payload.old_record?.status
    const newStatus = payload.record?.status

    const isLeavingGoing = oldStatus === 'GOING' && newStatus !== 'GOING'
    const isJoiningGoing = oldStatus !== 'GOING' && newStatus === 'GOING'

    if (!isLeavingGoing && !isJoiningGoing) {
      return Response.json({ success: true, skipped: 'status change does not affect GOING count' })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const [{ data: event }, { data: player }] = await Promise.all([
      supabase.from('events').select('id, title, group_id').eq('id', payload.record.event_id).single(),
      supabase.from('players').select('first_name, surname').eq('id', payload.record.player_id).single(),
    ])

    if (!event) return Response.json({ success: false, error: 'Event introuvable' }, { status: 404 })

    const { data: group } = await supabase.from('groups').select('owner_id').eq('id', event.group_id).single()
    if (!group?.owner_id) return Response.json({ success: false, error: 'Owner introuvable' }, { status: 404 })

    const { data: subs } = await supabase.from('push_subscriptions')
      .select('id, endpoint, p256dh, auth').eq('user_id', group.owner_id)

    if (!subs?.length) return Response.json({ success: true, sent: 0, note: 'Aucun abonnement push pour cet owner' })

    const statusLabels: Record<string, string> = {
      GOING: 'confirmé(e)', DECLINED: 'désisté(e)', WAITLIST: 'en liste d\'attente', INVITED: 'invité(e)',
    }

    const playerName = player ? `${player.first_name} ${player.surname}` : 'Un joueur'
    const notifPayload = JSON.stringify({
      title: isJoiningGoing ? `Nouvelle confirmation — ${event.title}` : `Flight à revoir — ${event.title}`,
      body: isJoiningGoing
        ? `${playerName} a confirmé sa présence.`
        : `${playerName} n'est plus confirmé(e) (désormais ${statusLabels[newStatus] ?? newStatus}).`,
      url: `/fr/groups/${event.group_id}/events/${event.id}/participants`,
    })

    let sent = 0
    const staleIds: string[] = []

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notifPayload
        )
        sent++
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) staleIds.push(sub.id)
      }
    }

    if (staleIds.length) {
      await supabase.from('push_subscriptions').delete().in('id', staleIds)
    }

    return Response.json({ success: true, sent })

  } catch (error: any) {
    console.error('PARTICIPANT STATUS WEBHOOK ERROR:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

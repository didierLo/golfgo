import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { getGroupLocale, serverT, DATE_LOCALE } from '@/lib/i18n/server'
import { detectFlightIssues, signatureOf, fetchPendingRemovals, markRemovalsNotified, sendPushToUser, type Removal, type FlightIssue } from '@/lib/flights/flightWatch'

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
      old_record: { status: string; event_id?: string; player_id?: string }
    }

    if (payload.table !== 'event_participants') {
      return Response.json({ success: true, skipped: 'wrong table' })
    }

    // Participation SUPPRIMÉE (ligne effacée) : la base a déjà retiré le joueur de ses flights (voir le journal) ;
    // on prévient l'organisateur. (Nécessite d'activer aussi l'évènement « Delete » sur ce webhook dans Supabase.)
    if (payload.type === 'DELETE') {
      const gone = payload.old_record
      if (!gone?.event_id || !gone?.player_id) return Response.json({ success: true, skipped: 'no ids' })
      return await notifyDeletedParticipation(gone.event_id, gone.player_id)
    }

    const oldStatus = payload.old_record?.status
    const newStatus = payload.record?.status

    const isLeavingGoing   = oldStatus === 'GOING'    && newStatus !== 'GOING'
    const isJoiningGoing   = oldStatus !== 'GOING'    && newStatus === 'GOING'
    const isJoiningWaitlist = oldStatus !== 'WAITLIST' && newStatus === 'WAITLIST'

    if (!isLeavingGoing && !isJoiningGoing && !isJoiningWaitlist) {
      return Response.json({ success: true, skipped: 'status change does not affect GOING/WAITLIST count' })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const [{ data: event }, { data: player }] = await Promise.all([
         supabase.from('events').select('id, title, group_id, starts_at').eq('id', payload.record.event_id).single(),
      supabase.from('players').select('first_name, surname').eq('id', payload.record.player_id).single(),
    ])

    if (!event) return Response.json({ success: false, error: 'Event introuvable' }, { status: 404 })

    const { data: group } = await supabase.from('groups').select('owner_id').eq('id', event.group_id).single()
    if (!group?.owner_id) return Response.json({ success: false, error: 'Owner introuvable' }, { status: 404 })

    const { data: subs } = await supabase.from('push_subscriptions')
      .select('id, endpoint, p256dh, auth').eq('user_id', group.owner_id)

    if (!subs?.length) return Response.json({ success: true, sent: 0, note: 'Aucun abonnement push pour cet owner' })

    // Langue du groupe : la notification à l'organisateur suit la même langue que les emails du groupe
    const gl = await getGroupLocale(supabase, event.group_id)
    const t  = serverT(gl)

    const playerName = player ? `${player.first_name} ${player.surname}` : t('pushNotif.unknownPlayer')
    const eventDate = new Date(event.starts_at).toLocaleDateString(DATE_LOCALE[gl], {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
    })
    // Certaines langues abrègent le mois avec un point (« oct. ») : on évite le double point en fin de phrase
    const eventDateEnd = eventDate.replace(/\.$/, '')
    const statusKnown = ['GOING', 'DECLINED', 'WAITLIST', 'INVITED'].includes(newStatus)
    const newStatusLabel = statusKnown ? t(`pushNotif.status.${newStatus}`) : newStatus
    // ── Impact sur les flights : retrait automatique déjà effectué par la base, ou joueur « OUI » à placer ──
    // Protégé : une erreur ici ne doit JAMAIS empêcher l'envoi de la notification d'origine.
    let removals: Removal[] = []
    let flightNote = ''
    let flightState: { hasFlights: boolean; issues: FlightIssue[] } | null = null
    try {
      removals = await fetchPendingRemovals(supabase, event.id, payload.record.player_id)
      flightNote = removals.map(r => t('pushNotif.removedFromFlight', { flight: r.flight_number ?? '?' })).join(' ')
      flightState = (isJoiningGoing || removals.length) ? await detectFlightIssues(supabase, event.id) : null
      if (isJoiningGoing && flightState?.hasFlights && flightState.issues.some(i => i.kind === 'MISSING' && i.playerId === payload.record.player_id)) {
        flightNote = t('pushNotif.toPlace')
      }
    } catch (e) {
      console.error('[webhook] flights (ignoré)', e)
      removals = []; flightNote = ''; flightState = null
    }

    const notifPayload = JSON.stringify({
      title: isJoiningWaitlist
        ? t('pushNotif.waitlistTitle', { title: event.title })
        : isJoiningGoing ? t('pushNotif.confirmedTitle', { title: event.title }) : t('pushNotif.reviewTitle', { title: event.title }),
      body: (isJoiningWaitlist
        ? t('pushNotif.waitlistBody', { name: playerName, date: eventDate })
        : isJoiningGoing
          ? t('pushNotif.confirmedBody', { name: playerName, date: eventDate })
          : t('pushNotif.leftBody', { name: playerName, status: newStatusLabel, date: eventDateEnd })) + (flightNote ? ' ' + flightNote : ''),
      url: `/${gl}/groups/${event.group_id}/events/${event.id}`,
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

    // L'organisateur vient d'être prévenu : on le note pour que le contrôle du matin ne le répète pas
    if (sent > 0) {
      try {
        await markRemovalsNotified(supabase, removals)
        if (flightState?.hasFlights) {
          if (flightState.issues.length === 0) {
            await supabase.from('flight_issue_alerts').delete().eq('event_id', event.id)
          } else if (flightState.issues.every(i => i.playerId === payload.record.player_id)) {
            // seul CE joueur pose problème et la notification vient d'en parler : rien d'autre à signaler
            await supabase.from('flight_issue_alerts').upsert({ event_id: event.id, signature: signatureOf(flightState.issues), notified_at: new Date().toISOString() })
          }
        }
      } catch (e) {
        console.error('[webhook] mémoire des alertes (ignoré)', e)
      }
    }

    return Response.json({ success: true, sent })

  } catch (error: any) {
    console.error('PARTICIPANT STATUS WEBHOOK ERROR:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

// Suppression d'une participation : prévient l'organisateur si le joueur figurait dans un flight (retiré par la base).
async function notifyDeletedParticipation(eventId: string, playerId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const removals = await fetchPendingRemovals(supabase, eventId, playerId)
  if (!removals.length) return Response.json({ success: true, skipped: 'joueur absent des flights' })

  const { data: event } = await supabase.from('events').select('id, title, group_id').eq('id', eventId).maybeSingle()
  if (!event) return Response.json({ success: true, skipped: 'event introuvable' })
  const { data: group } = await supabase.from('groups').select('owner_id').eq('id', event.group_id).maybeSingle()
  if (!group?.owner_id) return Response.json({ success: false, error: 'Owner introuvable' }, { status: 404 })

  const gl = await getGroupLocale(supabase, event.group_id)
  const t  = serverT(gl)
  const body = removals
    .map(r => t('flightWatch.lineRemoved', { name: r.name ?? t('pushNotif.unknownPlayer'), flight: r.flight_number ?? '?' }))
    .join(' ')
  const sent = await sendPushToUser(supabase, group.owner_id, {
    title: t('pushNotif.reviewTitle', { title: event.title }),
    body,
    url: `/${gl}/groups/${event.group_id}/events/${event.id}/flights`,
  })
  if (sent > 0) await markRemovalsNotified(supabase, removals)
  return Response.json({ success: true, sent })
}

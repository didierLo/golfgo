import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { getGroupLocale, serverT, DATE_LOCALE } from '@/lib/i18n/server'
import { detectFlightIssues, signatureOf, fetchPendingRemovals, markRemovalsNotified, sendPushToUser, type Removal, type FlightIssue } from '@/lib/flights/flightWatch'
import { getGroupOwners, signerDisplayName } from '@/lib/groups/owner'
import { sendOrQueueEmail } from '@/lib/email/queueEmail'
import { buildEmailLogoHeader } from '@/lib/email/logo'

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
      record: { event_id: string; player_id: string; status: string; invite_token?: string | null }
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

    // Le joueur quitte la liste d'attente (place libérée, ou admin qui l'inscrit) : on le prévient LUI-MÊME,
    // Protégé : une erreur ici ne doit jamais empêcher la notification à l'organisateur ci-dessous.
    // et, à l'inverse, quand un inscrit est repassé en liste d'attente (typiquement par l'organisateur) : il doit le savoir.
    // (Un joueur qui s'inscrit lui-même sur un événement complet voit déjà l'information à l'écran : pas d'envoi.)
    const waitlistKind = oldStatus === 'WAITLIST' && newStatus === 'GOING' ? 'promoted'
                       : oldStatus === 'GOING' && newStatus === 'WAITLIST' ? 'demoted' : null
    if (waitlistKind) {
      try {
        await notifyPlayerAboutWaitlist(supabase, event, payload.record, waitlistKind)
      } catch (e) {
        console.error('[webhook] notification du joueur (liste d\'attente, ignorée)', e)
      }
    }

    // Toutes les personnes en rôle « owner » du groupe reçoivent cette notification (pas seulement le signataire des emails)
    const owners = await getGroupOwners(supabase, event.group_id)
    const ownerUserIds = owners.all.map(o => o.userId).filter((id): id is string => !!id)
    if (!ownerUserIds.length) return Response.json({ success: false, error: 'Owner introuvable' }, { status: 404 })

    const { data: subs } = await supabase.from('push_subscriptions')
      .select('id, endpoint, p256dh, auth').in('user_id', ownerUserIds)

    if (!subs?.length) return Response.json({ success: true, sent: 0, note: 'Aucun abonnement push pour les organisateurs' })

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
  const owners = await getGroupOwners(supabase, event.group_id)
  const ownerUserIds = owners.all.map(o => o.userId).filter((id): id is string => !!id)
  if (!ownerUserIds.length) return Response.json({ success: false, error: 'Owner introuvable' }, { status: 404 })

  const gl = await getGroupLocale(supabase, event.group_id)
  const t  = serverT(gl)
  const body = removals
    .map(r => t('flightWatch.lineRemoved', { name: r.name ?? t('pushNotif.unknownPlayer'), flight: r.flight_number ?? '?' }))
    .join(' ')
  let sent = 0
  for (const uid of ownerUserIds) {
    sent += await sendPushToUser(supabase, uid, {
      title: t('pushNotif.reviewTitle', { title: event.title }),
      body,
      url: `/${gl}/groups/${event.group_id}/events/${event.id}/flights`,
    })
  }
  if (sent > 0) await markRemovalsNotified(supabase, removals)
  return Response.json({ success: true, sent })
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Prévient le joueur lui-même d'un changement de situation sur la liste d'attente :
//  - 'promoted' : il passe de la liste d'attente à « inscrit » ;
//  - 'demoted'  : il passe de « inscrit » à la liste d'attente.
// Push (s'il a l'app) + email (sauf désabonnement du groupe).
async function notifyPlayerAboutWaitlist(
  supabase: any,
  event: { id: string; title: string; group_id: string; starts_at: string },
  rec: { player_id: string; invite_token?: string | null },
  kind: 'promoted' | 'demoted',
) {
  const [{ data: player }, { data: membership }] = await Promise.all([
    supabase.from('players').select('first_name, email, user_id').eq('id', rec.player_id).maybeSingle(),
    supabase.from('groups_players').select('email_opt_out').eq('group_id', event.group_id).eq('player_id', rec.player_id).maybeSingle(),
  ])
  if (!player) return

  const gl = await getGroupLocale(supabase, event.group_id)
  const t  = serverT(gl)
  const dl = DATE_LOCALE[gl]
  // `starts_at` stocke l'heure locale belge avec un « +00 » trompeur : on lit donc en UTC
  const start = new Date(event.starts_at)
  const date  = start.toLocaleDateString(dl, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  const time  = start.toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.golfgo.be'
  const eventUrl = `${appUrl}/${gl}/groups/${event.group_id}/events/${event.id}`

  // Textes et couleurs selon le cas (clés écrites en toutes lettres pour que check:i18n les voie)
  const c = kind === 'promoted'
    ? {
        pushTitle: t('waitlistPromoted.pushTitle', { title: event.title }),
        pushBody:  t('waitlistPromoted.pushBody', { date }),
        subject:   t('waitlistPromoted.emailSubject', { title: event.title }),
        heading:   t('waitlistPromoted.emailHeading'),
        intro:     t('waitlistPromoted.emailIntro'),
        info:      t('waitlistPromoted.emailDeclineInfo'),
        boxBg: '#EAF3DE', boxBorder: '#C0DD97', boxText: '#3B6D11',
      }
    : {
        pushTitle: t('waitlistDemoted.pushTitle', { title: event.title }),
        pushBody:  t('waitlistDemoted.pushBody', { date }),
        subject:   t('waitlistDemoted.emailSubject', { title: event.title }),
        heading:   t('waitlistDemoted.emailHeading'),
        intro:     t('waitlistDemoted.emailIntro'),
        info:      t('waitlistDemoted.emailInfo'),
        boxBg: '#FAEEDA', boxBorder: '#E8C98F', boxText: '#854F0B',
      }

  if (player.user_id) {
    await sendPushToUser(supabase, player.user_id, {
      title: c.pushTitle,
      body:  c.pushBody,
      url:   `/${gl}/groups/${event.group_id}/events/${event.id}`,
    })
  }

  if (!player.email || membership?.email_opt_out || process.env.EMAIL_ENABLED !== 'true') return

  const owners = await getGroupOwners(supabase, event.group_id)
  const signer = signerDisplayName(owners)
  const unsubscribeUrl = `${appUrl}/api/unsubscribe?pid=${rec.player_id}&gid=${event.group_id}`
  // Bouton « Je ne participe plus » seulement pour un joueur qui vient d'être inscrit
  const declineUrl = kind === 'promoted' && rec.invite_token ? `${appUrl}/${gl}/invite/no?token=${rec.invite_token}` : null

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="background:#185FA5;border-radius:12px 12px 0 0;padding:20px 32px;vertical-align:middle;">
            ${buildEmailLogoHeader(owners.logoUrl)}
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:36px 32px;">
            <p style="margin:0 0 6px;font-size:14px;color:#64748B;">${escapeHtml(t('email.common.greeting', { name: player.first_name ?? '' }))}</p>
            <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0F172A;">${escapeHtml(c.heading)}</h1>
            <p style="margin:0 0 20px;font-size:14px;color:#334155;line-height:1.7;">${escapeHtml(c.intro)}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:${c.boxBg};border:1px solid ${c.boxBorder};border-radius:10px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;">
                <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:${c.boxText};">${escapeHtml(event.title)}</p>
                <p style="margin:0;font-size:13px;color:${c.boxText};">${escapeHtml(t('email.common.atTime', { date, time }))}</p>
              </td></tr>
            </table>
            <p style="margin:0 0 18px;font-size:13px;color:#64748B;line-height:1.6;">${escapeHtml(c.info)}</p>
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="padding-right:10px;">
                <a href="${eventUrl}" style="display:inline-block;background:#185FA5;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px;">${escapeHtml(t('waitlistPromoted.emailViewButton'))}</a>
              </td>
              ${declineUrl ? `<td>
                <a href="${declineUrl}" style="display:inline-block;background:#ffffff;color:#A32D2D;text-decoration:none;font-size:13px;font-weight:600;padding:9px 18px;border-radius:8px;border:1px solid #F7C1C1;">${escapeHtml(t('waitlistPromoted.emailDeclineButton'))}</a>
              </td>` : ''}
            </tr></table>
            ${signer ? `<p style="margin:28px 0 0;font-size:13px;color:#334155;">${escapeHtml(t('waitlistPromoted.emailSignoff'))}<br>${escapeHtml(signer)}</p>` : ''}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`

  await sendOrQueueEmail({
    category: 'other',
    playerId: rec.player_id,
    groupId:  event.group_id,
    eventId:  event.id,
    from:     'GolfGo <noreply@golfgo.be>',
    replyTo:  'info@golfgo.be',
    to:       player.email,
    subject:  c.subject,
    html,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })
}

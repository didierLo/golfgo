import { Resend } from 'resend'
import { createServerClient } from '@/lib/supabase/server'
import { sleep, EMAIL_SEND_DELAY_MS } from '@/lib/email/rate-limit'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-BE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('fr-BE', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  })
}
function applyTemplateVariables(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replace(new RegExp(`{{${key}}}`, 'g'), value),
    text
  )
}

function buildYesButtons(yes18Link: string, yes9frontLink: string, yes9backLink: string, noLink: string) {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
  <tr><td>
    <a href="${yes18Link}" style="display:block;text-decoration:none;background:#DCFCE7;border:2px solid #16A34A;border-radius:12px;padding:16px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:22px;width:36px;">⛳</td>
        <td style="padding-left:12px;">
          <div style="font-size:15px;font-weight:700;color:#15803D;">Je participe</div>
          <div style="font-size:12px;color:#16A34A;margin-top:2px;">18 trous · Parcours complet</div>
        </td>
        <td align="right" style="font-size:20px;">→</td>
      </tr></table>
    </a>
  </td></tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
  <tr><td>
    <a href="${yes9frontLink}" style="display:block;text-decoration:none;background:#FEF9C3;border:2px solid #CA8A04;border-radius:12px;padding:16px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:22px;width:36px;">🏌️</td>
        <td style="padding-left:12px;">
          <div style="font-size:15px;font-weight:700;color:#92400E;">Je participe</div>
          <div style="font-size:12px;color:#B45309;margin-top:2px;">9 trous Front · Trous 1–9</div>
        </td>
        <td align="right" style="font-size:20px;">→</td>
      </tr></table>
    </a>
  </td></tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
  <tr><td>
    <a href="${yes9backLink}" style="display:block;text-decoration:none;background:#FFEDD5;border:2px solid #EA580C;border-radius:12px;padding:16px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:22px;width:36px;">🏌️‍♀️</td>
        <td style="padding-left:12px;">
          <div style="font-size:15px;font-weight:700;color:#9A3412;">Je participe</div>
          <div style="font-size:12px;color:#C2410C;margin-top:2px;">9 trous Back · Trous 10–18</div>
        </td>
        <td align="right" style="font-size:20px;">→</td>
      </tr></table>
    </a>
  </td></tr>
</table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
  <tr><td>
    <a href="${noLink}" style="display:block;text-decoration:none;background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:12px;padding:14px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:22px;width:36px;">😔</td>
        <td style="padding-left:12px;font-size:14px;font-weight:500;color:#94A3B8;">Je ne peux pas participer</td>
        <td align="right" style="font-size:16px;color:#CBD5E1;">✕</td>
      </tr></table>
    </a>
  </td></tr>
</table>`
}

function buildEmailHtml({
  eventTitle, eventDate, eventTime, eventLocation, eventMessage, eventLink,
  yes18Link, yes9frontLink, yes9backLink, noLink, hasButtons,
}: {
  eventTitle: string; eventDate: string; eventTime: string
  eventLocation: string | null; eventMessage: string | null; eventLink: string
  yes18Link: string; yes9frontLink: string; yes9backLink: string
  noLink: string; hasButtons: boolean
}) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${eventTitle}</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <tr>
          <td style="background:#185FA5;border-radius:12px 12px 0 0;padding:20px 32px;vertical-align:middle;">
            <img src="https://zykywwjmaqcjhciffsbi.supabase.co/storage/v1/object/public/apple-touch-icon/apple-touch-icon.png" width="32" height="32" style="vertical-align:middle;border-radius:6px;margin-right:8px;" />
            <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;vertical-align:middle;">Golf</span>
            <span style="font-size:20px;font-weight:700;color:#97C459;letter-spacing:-0.5px;vertical-align:middle;">Go</span>
          </td>
        </tr>

        <tr>
          <td style="background:#ffffff;padding:36px 32px;">

            <p style="margin:0 0 28px;font-size:16px;font-weight:600;color:#185FA5;">${eventTitle}</p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;margin-bottom:28px;">
              <tr><td style="padding:16px 20px;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:5px 0;font-size:13px;color:#64748B;width:24px;">📅</td>
                    <td style="padding:5px 0;font-size:13px;color:#0F172A;font-weight:500;">${eventDate} à ${eventTime}</td>
                  </tr>
                  ${eventLocation ? `
                  <tr>
                    <td style="padding:5px 0;font-size:13px;color:#64748B;">📍</td>
                    <td style="padding:5px 0;font-size:13px;color:#0F172A;font-weight:500;">${eventLocation}</td>
                  </tr>` : ''}
                </table>
              </td></tr>
            </table>

            ${eventMessage ? `
            <div style="margin-bottom:28px;">
              <p style="margin:0;font-size:14px;color:#334155;line-height:1.9;">${eventMessage.replace(/\n/g, '<br/>')}</p>
            </div>` : ''}

            ${hasButtons ? `
            <div style="height:1px;background:#F1F5F9;margin-bottom:24px;"></div>
            <p style="margin:0 0 16px;font-size:12px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.08em;">Ta réponse</p>
            ${buildYesButtons(yes18Link, yes9frontLink, yes9backLink, noLink)}` : ''}

            <p style="margin:0;font-size:13px;color:#94A3B8;text-align:center;">
              Ou <a href="${eventLink}" style="color:#185FA5;text-decoration:none;font-weight:500;">voir les détails dans l'app</a>
            </p>

          </td>
        </tr>

        <tr>
          <td style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:14px 32px;">
            <p style="margin:0;font-size:12px;color:#CBD5E1;text-align:center;">
              Cet email t'a été envoyé via GolfGo · <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color:#CBD5E1;text-decoration:none;">golfgo.be</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim()
}

export async function POST(req: Request) {
  console.log('[COMM] POST called')
  try {
    const { groupId, playerIds, subject: commSubject, body: commBody, eventId } = await req.json()
    console.log('[COMM] received:', { groupId, eventId, playerIds: playerIds?.length })
    console.log('[COMM] groupId:', groupId, 'eventId:', eventId, 'playerIds:', playerIds?.length)
    if (!groupId || !playerIds?.length || !commSubject || !commBody) {
      return Response.json({ success: false, error: 'Paramètres manquants' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Charger le groupe + owner
    const { data: groupData } = await supabase
      .from('groups')
      .select('name, owner:groups_players(players(first_name, surname))')
      .eq('id', groupId)
      .eq('groups_players.role', 'owner')
      .single()
    const ownerPlayer = (groupData?.owner as any)?.[0]?.players
    const ownerName   = ownerPlayer ? `${ownerPlayer.first_name} ${ownerPlayer.surname}` : ''
    const groupName   = groupData?.name ?? ''

    // Charger l'event si fourni
    if (eventId) {
      const { data } = await supabase.from('events').select('id, title, location, starts_at, group_id, max_participants').eq('id', eventId).single()
      event = data
    }

    const eventDate = event ? formatDate(event.starts_at) : ''
    const eventTime = event ? formatTime(event.starts_at) : ''
    const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const eventLink = event ? `${appUrl}/groups/${event.group_id}/events/${event.id}` : `${appUrl}/groups`

    // Charger les membres avec tokens si event fourni
    let participantTokens: Record<string, string> = {}
    if (eventId) {
      const { data: parts } = await supabase.from('event_participants')
        .select('player_id, invite_token').eq('event_id', eventId).in('player_id', playerIds)
      parts?.forEach((p: any) => { if (p.invite_token) participantTokens[p.player_id] = p.invite_token })
    }

    // Charger les membres
    const { data: playersData } = await supabase
      .from('players').select('id, first_name, surname, email').in('id', playerIds)

    // La variable {{yes_button}} dans le body déclenche l'affichage des boutons
    const hasYesButton = commBody.includes('{{yes_button}}')

    let sent = 0, skipped = 0
    const errors: string[] = []

    for (const player of playersData || []) {
      if (!player.email) { skipped++; continue }

      const token        = participantTokens[player.id]
      const yes18Link    = token ? `${appUrl}/invite/yes?token=${token}&holes=18` : eventLink
      const yes9frontLink = token ? `${appUrl}/invite/yes?token=${token}&holes=9&section=out` : eventLink
      const yes9backLink  = token ? `${appUrl}/invite/yes?token=${token}&holes=9&section=in` : eventLink
      const noLink       = token ? `${appUrl}/invite/no?token=${token}` : eventLink

      let placesRestantes = '—'
      if (event?.max_participants) {
        const { count } = await supabase.from('event_participants')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', eventId).eq('status', 'GOING')
        placesRestantes = String(Math.max(0, event.max_participants - (count ?? 0)))
        console.log('[PLACES] max:', event.max_participants, 'count:', count, 'result:', placesRestantes)
      }

      const templateVars: Record<string, string> = {
        first_name:        player.first_name,
        surname:           player.surname,
        player_name:       `${player.first_name} ${player.surname}`,
        group_name:        groupName,
        owner_name:        ownerName,
        event_title:       event?.title ?? '',
        event_date:        eventDate,
        event_time:        eventTime,
        start_time:        eventTime,
        places_restantes:  placesRestantes,
        yes_button:        '', // sera remplacé visuellement dans le HTML
      }

      const resolvedSubject = applyTemplateVariables(commSubject, templateVars)
      // On retire {{yes_button}} du body car on l'insère via HTML
      const resolvedBody = applyTemplateVariables(
        commBody.replace('{{yes_button}}', ''),
        templateVars
      ).trim()

      if (!EMAIL_ENABLED) {
        console.log(`[PREVIEW] To: ${player.email} | Subject: ${resolvedSubject}`)
        sent++; continue
      }

      const html = buildEmailHtml({
        eventTitle:    event?.title ?? groupName,
        eventDate, eventTime,
        eventLocation: event?.location ?? null,
        eventMessage:  resolvedBody || null,
        eventLink,
        yes18Link, yes9frontLink, yes9backLink, noLink,
        hasButtons:    hasYesButton,
      })

      const { error: emailErr } = await resend.emails.send({
        from: 'GolfGo <info@golfgo.be>', to: player.email,
        subject: resolvedSubject, html,
      })

      if (emailErr) { errors.push(`${player.first_name} ${player.surname}: ${emailErr.message}`) }
      else { sent++ }
      await sleep(EMAIL_SEND_DELAY_MS)
    }

    return Response.json({ success: true, sent, skipped, errors })
  } catch (error: any) {
    console.error('COMMUNICATION EMAIL ERROR:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

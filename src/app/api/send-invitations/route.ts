import { Resend } from 'resend'
import { createServerClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-BE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('fr-BE', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Brussels',
  })
}

// ─── Remplacement des variables de template ───────────────────────────────────

function applyTemplateVariables(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replace(new RegExp(`{{${key}}}`, 'g'), value),
    text
  )
}

function buildEmailHtml({
  playerName,
  eventTitle,
  eventDate,
  eventTime,
  eventLocation,
  eventMessage,
  yesLink,
  noLink,
  eventLink,
}: {
  playerName: string
  eventTitle: string
  eventDate: string
  eventTime: string
  eventLocation: string | null
  eventMessage: string | null
  yesLink: string
  noLink: string
  eventLink: string
}) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invitation — ${eventTitle}</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#185FA5;border-radius:12px 12px 0 0;padding:24px 32px;vertical-align:middle;">
              <img src="${process.env.NEXT_PUBLIC_APP_URL}/logo/GG_Logo_avec_nom.png" alt="GolfGo" height="32" style="display:inline-block;vertical-align:middle;margin-right:8px;" />
              <span style="font-size:22px;font-weight:600;color:#ffffff;letter-spacing:-0.5px;vertical-align:middle;">Golf</span>
              <span style="font-size:22px;font-weight:600;color:#97C459;letter-spacing:-0.5px;vertical-align:middle;">Go</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px;">

              <h1 style="margin:0 0 24px;font-size:22px;font-weight:600;color:#111827;line-height:1.3;">
                Tu es invité(e) à<br/>${eventTitle}
              </h1>

              <!-- Infos event -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6B7280;width:80px;">📅 Date</td>
                        <td style="padding:4px 0;font-size:13px;color:#111827;font-weight:500;">${eventDate} à ${eventTime}</td>
                      </tr>
                      ${eventLocation ? `
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#6B7280;">📍 Lieu</td>
                        <td style="padding:4px 0;font-size:13px;color:#111827;font-weight:500;">${eventLocation}</td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              ${eventMessage ? `
              <!-- Message personnalisé -->
              <div style="margin-bottom:24px;padding:16px 20px;border-left:3px solid #185FA5;background:#EFF6FF;border-radius:0 8px 8px 0;">
                <p style="margin:0;font-size:14px;color:#1E40AF;line-height:1.6;">${eventMessage.replace(/\n/g, '<br/>')}</p>
              </div>` : ''}

              <!-- Question -->
              <p style="margin:0 0 16px;font-size:15px;font-weight:500;color:#111827;">
                Seras-tu présent(e) ?
              </p>

              <!-- Boutons réponse -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding-right:12px;">
                    <a href="${yesLink}"
                      style="display:inline-block;background:#16A34A;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;">
                      ✓ Je participe
                    </a>
                  </td>
                  <td>
                    <a href="${noLink}"
                      style="display:inline-block;background:#ffffff;color:#DC2626;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;border:1.5px solid #DC2626;">
                      ✗ Je ne peux pas
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Lien voir event -->
              <p style="margin:0;font-size:13px;color:#6B7280;">
                Ou <a href="${eventLink}" style="color:#185FA5;text-decoration:underline;">voir les détails de l'événement</a> dans l'app.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;">
                Cet email t'a été envoyé via GolfGo · <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color:#9CA3AF;">golfgo.be</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `.trim()
}

export async function POST(req: Request) {
  try {
    const { eventId, playerIds } = await req.json()

    if (!eventId || !playerIds?.length) {
      return Response.json({ success: false, error: 'eventId et playerIds requis' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Charger l'event
    const { data: event, error: evErr } = await supabase
      .from('events')
      .select('id, title, location, starts_at, group_id, email_message')
      .eq('id', eventId)
      .single()

    if (evErr || !event) {
      return Response.json({ success: false, error: 'Event introuvable' }, { status: 404 })
    }

    // Charger le template du groupe séparément (plus fiable que le join)
    const { data: groupData } = await supabase
      .from('groups')
      .select('template_invitation_subject, template_invitation_body')
      .eq('id', event.group_id)
      .single()

    // Charger les participants avec leurs tokens
    const { data: participants, error: pErr } = await supabase
      .from('event_participants')
      .select('player_id, invite_token, players(first_name, surname, email)')
      .eq('event_id', eventId)
      .in('player_id', playerIds)

    if (pErr) {
      return Response.json({ success: false, error: pErr.message }, { status: 500 })
    }

    const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const eventLink = `${appUrl}/login`
    const eventDate = formatDate(event.starts_at)
    const eventTime = formatTime(event.starts_at)

    // Template depuis le groupe
    const subjectTemplate = groupData?.template_invitation_subject ?? 'Invitation : {{event_title}}'
    const bodyTemplate    = groupData?.template_invitation_body ?? null

    let sent = 0
    let skipped = 0
    const errors: string[] = []

    for (const p of participants || []) {
      const player = p.players as any
      if (!player?.email) { skipped++; continue }

      const token = p.invite_token
      if (!token) { skipped++; continue }

      const yesLink    = `${appUrl}/invite/yes?token=${token}`
      const noLink     = `${appUrl}/invite/no?token=${token}`
      const playerName = `${player.first_name} ${player.surname}`

      // Variables de template disponibles
      const templateVars: Record<string, string> = {
        player_name:       playerName,
        player_first_name: player.first_name,
        player_surname:    player.surname,
        event_title:       event.title,
        event_date:        eventDate,
        event_time:        eventTime,
      }

      // Sujet avec variables
      const subject = applyTemplateVariables(subjectTemplate, templateVars)

      // Message personnalisé avec variables (email_message ou template body)
      const rawMessage = event.email_message ?? bodyTemplate ?? null
      const resolvedMessage = rawMessage ? applyTemplateVariables(rawMessage, templateVars) : null

      // Mode preview
      if (!EMAIL_ENABLED) {
        console.log('━━━ EMAIL PREVIEW ━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log(`To:      ${player.email}`)
        console.log(`Subject: ${subject}`)
        console.log(`Player:  ${playerName} (${player.first_name} / ${player.surname})`)
        console.log(`Date:    ${eventDate} à ${eventTime}`)
        if (event.location) console.log(`Lieu:    ${event.location}`)
        if (resolvedMessage) console.log(`Message: ${resolvedMessage}`)
        console.log(`Yes:     ${yesLink}`)
        console.log(`No:      ${noLink}`)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        sent++
        continue
      }

      // Envoi réel
      const html = buildEmailHtml({
        playerName,
        eventTitle:    event.title,
        eventDate,
        eventTime,
        eventLocation: event.location,
        eventMessage:  resolvedMessage,
        yesLink,
        noLink,
        eventLink,
      })

      const { error: emailErr } = await resend.emails.send({
        from:    'GolfGo <info@golfgo.be>',
        to:      player.email,
        subject,
        html,
      })

      if (emailErr) {
        console.error(`Email error for ${playerName}:`, emailErr)
        errors.push(`${playerName}: ${emailErr.message}`)
      } else {
        sent++
      }
    }

    return Response.json({ success: true, sent, skipped, errors })

  } catch (error: any) {
    console.error('EMAIL ERROR:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

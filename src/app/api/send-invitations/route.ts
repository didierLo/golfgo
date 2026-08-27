import { createServerClient } from '@/lib/supabase/server'
import { sleep, EMAIL_SEND_DELAY_MS } from '@/lib/email/rate-limit'
import { buildEmailLogoHeader } from '@/lib/email/logo'
import { sendOrQueueEmail } from '@/lib/email/queueEmail'

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

function buildResponseButtons(isGolf: boolean, yes18Link: string, yes9frontLink: string, yes9backLink: string, noLink: string): string {
  if (!isGolf) {
    return `
            <!-- Participation (event non-golf) -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
              <tr><td>
                <a href="${yes18Link}" style="display:block;text-decoration:none;background:#DCFCE7;border:2px solid #16A34A;border-radius:12px;padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:22px;width:36px;">🙋</td>
                      <td style="padding-left:12px;">
                        <div style="font-size:15px;font-weight:700;color:#15803D;">Je participe</div>
                      </td>
                      <td align="right" style="font-size:20px;">→</td>
                    </tr>
                  </table>
                </a>
              </td></tr>
            </table>

            <!-- Décliner -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr><td>
                <a href="${noLink}" style="display:block;text-decoration:none;background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:12px;padding:14px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:22px;width:36px;">😔</td>
                      <td style="padding-left:12px;font-size:14px;font-weight:500;color:#94A3B8;">Je ne peux pas participer</td>
                      <td align="right" style="font-size:16px;color:#CBD5E1;">✕</td>
                    </tr>
                  </table>
                </a>
              </td></tr>
            </table>`
  }

  return `
            <!-- 18 trous -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
              <tr><td>
                <a href="${yes18Link}" style="display:block;text-decoration:none;background:#DCFCE7;border:2px solid #16A34A;border-radius:12px;padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:22px;width:36px;">⛳</td>
                      <td style="padding-left:12px;">
                        <div style="font-size:15px;font-weight:700;color:#15803D;">Je participe</div>
                        <div style="font-size:12px;color:#16A34A;margin-top:2px;">18 trous · Parcours complet</div>
                      </td>
                      <td align="right" style="font-size:20px;">→</td>
                    </tr>
                  </table>
                </a>
              </td></tr>
            </table>

            <!-- 9 trous Front -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
              <tr><td>
                <a href="${yes9frontLink}" style="display:block;text-decoration:none;background:#FEF9C3;border:2px solid #CA8A04;border-radius:12px;padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:22px;width:36px;">🌅</td>
                      <td style="padding-left:12px;">
                        <div style="font-size:15px;font-weight:700;color:#92400E;">Je participe</div>
                        <div style="font-size:12px;color:#B45309;margin-top:2px;">9 trous Front · Trous 1–9</div>
                      </td>
                      <td align="right" style="font-size:20px;">→</td>
                    </tr>
                  </table>
                </a>
              </td></tr>
            </table>

            <!-- 9 trous Back -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
              <tr><td>
                <a href="${yes9backLink}" style="display:block;text-decoration:none;background:#FFEDD5;border:2px solid #EA580C;border-radius:12px;padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:22px;width:36px;">🌇</td>
                      <td style="padding-left:12px;">
                        <div style="font-size:15px;font-weight:700;color:#9A3412;">Je participe</div>
                        <div style="font-size:12px;color:#C2410C;margin-top:2px;">9 trous Back · Trous 10–18</div>
                      </td>
                      <td align="right" style="font-size:20px;">→</td>
                    </tr>
                  </table>
                </a>
              </td></tr>
            </table>

            <!-- Décliner -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr><td>
                <a href="${noLink}" style="display:block;text-decoration:none;background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:12px;padding:14px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:22px;width:36px;">😔</td>
                      <td style="padding-left:12px;font-size:14px;font-weight:500;color:#94A3B8;">Je ne peux pas participer</td>
                      <td align="right" style="font-size:16px;color:#CBD5E1;">✕</td>
                    </tr>
                  </table>
                </a>
              </td></tr>
            </table>`
}

function buildEmailHtml({
  eventTitle, eventDate, eventTime, eventLocation, eventMessage, isGolf,
  yes18Link, yes9frontLink, yes9backLink, noLink, eventLink, logoUrl,
}: {
  eventTitle: string; eventDate: string; eventTime: string
  eventLocation: string | null; eventMessage: string | null; isGolf: boolean
  yes18Link: string; yes9frontLink: string; yes9backLink: string
  noLink: string; eventLink: string; logoUrl: string | null
}) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invitation — ${eventTitle}</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#185FA5;border-radius:12px 12px 0 0;padding:20px 32px;vertical-align:middle;">
            ${buildEmailLogoHeader(logoUrl)}
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:36px 32px;">

            <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0F172A;line-height:1.3;">
              Invitation
            </h1>
            <p style="margin:0 0 28px;font-size:16px;font-weight:600;color:#185FA5;">
              ${eventTitle}
            </p>

            <!-- Infos event -->
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

            <div style="height:1px;background:#F1F5F9;margin-bottom:24px;"></div>

            <p style="margin:0 0 16px;font-size:12px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.08em;">
              Ta réponse
            </p>

            ${buildResponseButtons(isGolf, yes18Link, yes9frontLink, yes9backLink, noLink)}

            <p style="margin:0;font-size:13px;color:#94A3B8;text-align:center;">
              Ou <a href="${process.env.NEXT_PUBLIC_APP_URL}/login" style="color:#185FA5;text-decoration:none;font-weight:500;">voir les détails dans l'app</a>
            </p>

          </td>
        </tr>

        <!-- Footer -->
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
  try {
    const { eventId, playerIds } = await req.json()
    if (!eventId || !playerIds?.length) {
      return Response.json({ success: false, error: 'eventId et playerIds requis' }, { status: 400 })
    }

    const supabase = await createServerClient()

  const { data: event, error: evErr } = await supabase
  .from('events')
  .select('id, title, location, starts_at, group_id, email_message, is_golf')
  .eq('id', eventId).single()
if (evErr || !event) {
  return Response.json({ success: false, error: 'Event introuvable' }, { status: 404 })
}


const [{ data: groupData }, { data: participants, error: pErr }] = await Promise.all([
  supabase.from('groups')
    .select('template_invitation_subject, template_invitation_body, template_logo_url, owner:groups_players(players(first_name, surname))')
    .eq('id', event.group_id).eq('groups_players.role', 'owner').single(),
  supabase.from('event_participants')
    .select('player_id, invite_token, players(first_name, surname, email)')
    .eq('event_id', eventId).in('player_id', playerIds)
])

if (pErr) return Response.json({ success: false, error: pErr.message }, { status: 500 })

    // ── Opt-out : charger qui a désactivé les emails pour ce groupe ─────────
    const { data: optOuts } = await supabase
      .from('groups_players')
      .select('player_id, email_opt_out')
      .eq('group_id', event.group_id)
      .in('player_id', playerIds)

    const optOutSet = new Set((optOuts || []).filter(o => o.email_opt_out).map(o => o.player_id))

    const ownerPlayer = (groupData?.owner as any)?.[0]?.players
    const ownerName   = ownerPlayer ? `${ownerPlayer.first_name} ${ownerPlayer.surname}` : ''
    const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const eventLink = `${appUrl}/groups/${event.group_id}/events/${eventId}`
    const eventDate = formatDate(event.starts_at)
    const eventTime = formatTime(event.starts_at)
    const subjectTemplate = groupData?.template_invitation_subject ?? 'Invitation : {{event_title}}'
    const bodyTemplate    = groupData?.template_invitation_body    ?? "Bonjour {{first_name}},\n\nJ'ai le plaisir de t'inviter à notre prochaine rencontre.\nPourras-tu être des nôtres ?\n\nAu plaisir de te revoir,\n{{owner_name}}"
    const logoUrl = groupData?.template_logo_url ?? null

    let sent = 0, skipped = 0, queued = 0
    const errors: string[] = []

   for (const p of participants || []) {
      const player = p.players as any
      if (!player?.email) { skipped++; continue }
      if (optOutSet.has(p.player_id)) { skipped++; continue }

      let token = p.invite_token
      if (!token) {
        // Participant déjà présent (ex: ajouté manuellement sans email) mais sans token
        // → on lui en génère un pour pouvoir lui envoyer cette invitation, sans toucher son statut
        const { data: updated } = await supabase
          .from('event_participants')
          .update({ invite_token: crypto.randomUUID() })
          .eq('event_id', eventId)
          .eq('player_id', p.player_id)
          .select('invite_token')
          .single()
        token = updated?.invite_token
      }
      if (!token) { skipped++; continue }

      const yes18Link    = `${appUrl}/invite/yes?token=${token}&holes=18`
      const yes9frontLink = `${appUrl}/invite/yes?token=${token}&holes=9&section=out`
      const yes9backLink  = `${appUrl}/invite/yes?token=${token}&holes=9&section=in`
      const noLink       = `${appUrl}/invite/no?token=${token}`
      const playerName   = `${player.first_name} ${player.surname}`

      const templateVars: Record<string, string> = {
        player_name: playerName, player_first_name: player.first_name,
        player_surname: player.surname, first_name: player.first_name,
        event_title: event.title, event_date: eventDate,
        event_time: eventTime, owner_name: ownerName,
      }

      const subject      = applyTemplateVariables(subjectTemplate, templateVars)
      const resolvedBody = applyTemplateVariables(bodyTemplate, templateVars)
      const practicalNote = event.email_message?.trim()
        ? applyTemplateVariables(event.email_message.trim(), templateVars) : null
      const resolvedMessage = practicalNote ? `${resolvedBody}\n\n${practicalNote}` : resolvedBody

      if (!EMAIL_ENABLED) {
        sent++; continue
      }

      const html = buildEmailHtml({
        eventTitle: event.title, eventDate, eventTime,
        eventLocation: event.location, eventMessage: resolvedMessage,
        isGolf: event.is_golf ?? true,
        yes18Link, yes9frontLink, yes9backLink, noLink, eventLink, logoUrl,
      })

     const unsubscribeUrl = `${appUrl}/api/unsubscribe?pid=${p.player_id}&gid=${event.group_id}`

      const result = await sendOrQueueEmail({
        category: 'invitation',
        groupId:  event.group_id,
        eventId:  event.id,
        from:     'GolfGo <noreply@golfgo.be>', replyTo: 'info@golfgo.be', to: player.email, subject, html,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      })

      if (!result.sent && !result.queued) { errors.push(`${playerName}: ${result.error}`) }
      else if (result.sent) { sent++ }
      else { queued++ }
      await sleep(EMAIL_SEND_DELAY_MS)
    }

    return Response.json({ success: true, sent, skipped, queued, errors })
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}
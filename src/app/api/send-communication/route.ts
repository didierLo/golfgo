import { Resend } from 'resend'
import { createServerClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true'

function applyVars(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (r, [k, v]) => r.replace(new RegExp(`{{${k}}}`, 'g'), v),
    text
  )
}

function buildCommunicationHtml({
  playerName,
  subject,
  body,
  groupName,
}: {
  playerName: string
  subject: string
  body: string
  groupName: string
}) {
  const bodyHtml = body.replace(/\n/g, '<br/>')

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#185FA5;border-radius:12px 12px 0 0;padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:600;color:#ffffff;letter-spacing:-0.5px;">Golf</span>
                    <span style="font-size:22px;font-weight:600;color:#97C459;letter-spacing:-0.5px;">Go</span>
                  </td>
                  <td style="text-align:right;">
                    <span style="font-size:12px;color:rgba(255,255,255,0.7);font-weight:500;">${groupName}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px;">
              <p style="margin:0 0 8px;font-size:14px;color:#6B7280;">
                Bonjour ${playerName},
              </p>
              <div style="margin:24px 0;font-size:15px;color:#111827;line-height:1.7;">
                ${bodyHtml}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;">
                Message envoyé via GolfGo · <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color:#9CA3AF;">golfgo.be</a>
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
    const { groupId, playerIds, subject, body } = await req.json()

    if (!groupId || !playerIds?.length || !subject || !body) {
      return Response.json({ success: false, error: 'groupId, playerIds, subject et body requis' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Charger le groupe
    const { data: group } = await supabase
      .from('groups').select('name').eq('id', groupId).single()
    if (!group) return Response.json({ success: false, error: 'Groupe introuvable' }, { status: 404 })

    // Charger les joueurs destinataires
    const { data: players, error: pErr } = await supabase
      .from('players')
      .select('id, first_name, surname, email')
      .in('id', playerIds)

    if (pErr) return Response.json({ success: false, error: pErr.message }, { status: 500 })

    let sent = 0
    let skipped = 0
    const errors: string[] = []

    for (const player of players || []) {
      if (!player.email) { skipped++; continue }

      const playerName = `${player.first_name} ${player.surname}`

      const vars: Record<string, string> = {
        first_name:  player.first_name,
        surname:     player.surname,
        player_name: playerName,
        group_name:  group.name,
      }

      const resolvedSubject = applyVars(subject, vars)
      const resolvedBody    = applyVars(body, vars)

      if (!EMAIL_ENABLED) {
        console.log('━━━ COMMUNICATION PREVIEW ━━━━━━━━━━━━━━━━━━━')
        console.log(`To:      ${player.email}`)
        console.log(`Subject: ${resolvedSubject}`)
        console.log(`Body:    ${resolvedBody}`)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        sent++
        continue
      }

      const html = buildCommunicationHtml({
        playerName,
        subject: resolvedSubject,
        body:    resolvedBody,
        groupName: group.name,
      })

      const { error: emailErr } = await resend.emails.send({
        from:    'GolfGo <info@golfgo.be>',
        to:      player.email,
        subject: resolvedSubject,
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
    console.error('COMMUNICATION EMAIL ERROR:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

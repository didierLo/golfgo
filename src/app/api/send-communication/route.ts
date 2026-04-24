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
    
   const bodyHtml = body 

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
                   <td style="vertical-align:middle;">
                    <img src="${process.env.NEXT_PUBLIC_APP_URL}/logo/apple-touch-icon.png" alt="GolfGo" height="32" style="display:inline-block;vertical-align:middle;margin-right:8px;" />
                    <span style="font-size:22px;font-weight:600;color:#ffffff;letter-spacing:-0.5px;vertical-align:middle;">Golf</span>
                    <span style="font-size:22px;font-weight:600;color:#97C459;letter-spacing:-0.5px;vertical-align:middle;">Go</span>
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
              <div style="margin:0 0 0;font-size:15px;color:#111827;line-height:1.7;">
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
    const { groupId, playerIds, subject, body, eventId } = await req.json()

    if (!groupId || !playerIds?.length || !subject || !body) {
      return Response.json({ success: false, error: 'groupId, playerIds, subject et body requis' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Charger le groupe
    const { data: group } = await supabase
      .from('groups').select('name, owner_id').eq('id', groupId).single()
    if (!group) return Response.json({ success: false, error: 'Groupe introuvable' }, { status: 404 })

    // Charger le nom de l'owner
    const { data: ownerData } = await supabase
      .from('players').select('first_name, surname').eq('user_id', group.owner_id).single()
    const ownerName = ownerData ? `${ownerData.first_name} ${ownerData.surname}` : ''

    // Charger les tokens si un eventId est fourni
    const tokenMap: Record<string, string> = {}
   if (eventId) {
      const { data: participants } = await supabase
        .from('event_participants')
        .select('player_id, invite_token')
        .eq('event_id', eventId)
        .in('player_id', playerIds)

      // Générer les tokens manquants
      for (const p of participants || []) {
        if (p.invite_token) {
          tokenMap[p.player_id] = p.invite_token
        } else {
          const newToken = crypto.randomUUID()
          await supabase.from('event_participants')
            .update({ invite_token: newToken })
            .eq('event_id', eventId)
            .eq('player_id', p.player_id)
          tokenMap[p.player_id] = newToken
        }
      }
    }

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
        owner_name:  ownerName,
      }

      // Boutons oui/non si token disponible
      const token = tokenMap[player.id]
      if (token) {
        const appUrl  = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
        const yesLink = `${appUrl}/invite/yes?token=${token}`
        const noLink  = `${appUrl}/invite/no?token=${token}`
        vars.yes_button = `<table cellpadding="0" cellspacing="0" style="margin:16px 0;"><tr>
          <td style="padding-right:12px;">
            <a href="${yesLink}" style="display:inline-block;background:#16A34A;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;">✓ Je participe</a>
          </td>
          <td>
            <a href="${noLink}" style="display:inline-block;background:#ffffff;color:#DC2626;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;border:1.5px solid #DC2626;">✗ Je ne peux pas</a>
          </td>
        </tr></table>`
      }

         const resolvedSubject = applyVars(subject, vars)
         const bodyWithBreaks  = body.replace(/\n/g, '<br/>')
         const resolvedBody    = applyVars(bodyWithBreaks, vars)

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

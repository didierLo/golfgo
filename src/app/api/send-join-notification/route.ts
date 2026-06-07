import { Resend } from 'resend'
import { createServerClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true'

export async function POST(req: Request) {
  try {
    const { groupId, playerId, locale = 'fr' } = await req.json()

    if (!groupId || !playerId) {
      return Response.json({ success: false, error: 'groupId et playerId requis' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Récupérer le groupe + owner
    const { data: group } = await supabase
      .from('groups')
      .select(`
        id, name,
        owner:groups_players(
          player:players(first_name, surname, email)
        )
      `)
      .eq('id', groupId)
      .eq('groups_players.role', 'owner')
      .single()

    if (!group) {
      return Response.json({ success: false, error: 'Groupe introuvable' }, { status: 404 })
    }

    // Récupérer le demandeur
    const { data: requester } = await supabase
      .from('players')
      .select('first_name, surname, email')
      .eq('id', playerId)
      .single()

    if (!requester) {
      return Response.json({ success: false, error: 'Joueur introuvable' }, { status: 404 })
    }

    const ownerPlayer = (group.owner as any)?.[0]?.player
    if (!ownerPlayer?.email) {
      return Response.json({ success: false, error: 'Owner sans email' }, { status: 400 })
    }

    const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const membersUrl = `${appUrl}/${locale}/groups/${groupId}/members`

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nouvelle demande d'adhésion</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#185FA5;border-radius:12px 12px 0 0;padding:20px 32px;vertical-align:middle;">
            <img src="https://zykywwjmaqcjhciffsbi.supabase.co/storage/v1/object/public/apple-touch-icon/apple-touch-icon.png" width="32" height="32" style="vertical-align:middle;border-radius:6px;margin-right:8px;" />
            <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;vertical-align:middle;">Golf</span>
            <span style="font-size:20px;font-weight:700;color:#97C459;letter-spacing:-0.5px;vertical-align:middle;">Go</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:36px 32px;">

            <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0F172A;">
              Nouvelle demande d'adhésion
            </h1>
            <p style="margin:0 0 24px;font-size:14px;color:#64748B;">
              Bonjour ${ownerPlayer.first_name},
            </p>

            <!-- Carte demandeur -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;margin-bottom:28px;">
              <tr><td style="padding:20px 24px;">
                <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#0F172A;">
                  ${requester.first_name} ${requester.surname}
                </p>
                ${requester.email ? `<p style="margin:0;font-size:13px;color:#64748B;">${requester.email}</p>` : ''}
                <p style="margin:8px 0 0;font-size:13px;color:#64748B;">
                  souhaite rejoindre le groupe <strong style="color:#185FA5;">${group.name}</strong>
                </p>
              </td></tr>
            </table>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td align="center">
                <a href="${membersUrl}" style="display:inline-block;background:#185FA5;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
                  Voir la demande →
                </a>
              </td></tr>
            </table>

            <p style="margin:0;font-size:12px;color:#94A3B8;text-align:center;">
              Vous pouvez accepter ou refuser depuis la page Membres de votre groupe.
            </p>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:14px 32px;">
            <p style="margin:0;font-size:12px;color:#CBD5E1;text-align:center;">
              Notification automatique GolfGo · <a href="${appUrl}" style="color:#CBD5E1;text-decoration:none;">golfgo.be</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim()

    if (!EMAIL_ENABLED) {
      return Response.json({ success: true, sent: 0 })
    }

    const { error: emailErr } = await resend.emails.send({
      from: 'GolfGo <info@golfgo.be>',
      to: ownerPlayer.email,
      subject: `Nouvelle demande pour rejoindre ${group.name}`,
      html,
    })

    if (emailErr) {
      return Response.json({ success: false, error: emailErr.message }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

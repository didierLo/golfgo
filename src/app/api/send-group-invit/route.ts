import { Resend } from 'resend'
import { createServerClient } from '@/lib/supabase/server'
import { sleep, EMAIL_SEND_DELAY_MS } from '@/lib/email/rate-limit'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true'
const BATCH_SIZE = 10
const BATCH_DELAY_MS = 2000

function buildGroupInviteHtml({
  groupName,
  inviteUrl,
  qrUrl,
  senderName,
}: {
  groupName: string
  inviteUrl: string
  qrUrl: string
  senderName: string
}) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invitation — ${groupName}</title>
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

            <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0F172A;">
              Rejoignez notre groupe !
            </h1>
            <p style="margin:0 0 28px;font-size:16px;font-weight:600;color:#185FA5;">
              ${groupName}
            </p>

            <p style="margin:0 0 24px;font-size:14px;color:#334155;line-height:1.7;">
              ${senderName} vous invite à rejoindre le groupe <strong>${groupName}</strong> sur GolfGo, l'application de gestion de sorties golf entre amis.
            </p>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr><td align="center">
                <a href="${inviteUrl}" style="display:inline-block;background:#185FA5;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
                  Rejoindre le groupe →
                </a>
              </td></tr>
            </table>

            <!-- QR Code -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;margin-bottom:28px;">
              <tr><td style="padding:24px;text-align:center;">
                <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.08em;">Ou scannez le QR code</p>
                <img src="${qrUrl}" width="140" height="140" style="border-radius:8px;" />
              </td></tr>
            </table>

            <div style="height:1px;background:#F1F5F9;margin-bottom:24px;"></div>

            <!-- Instructions PWA -->
            <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.08em;">
              Installer l'application
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
              <tr>
                <td style="width:28px;font-size:18px;vertical-align:top;padding-top:2px;">🍎</td>
                <td style="padding-left:10px;">
                  <p style="margin:0;font-size:13px;font-weight:600;color:#0F172A;">iPhone / Safari</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#64748B;line-height:1.6;">
                    Clique sur l'icône <strong>Partager</strong> ↑ → <em>En voir plus</em> → <em>Ajouter à l'écran d'accueil</em>
                  </p>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="width:28px;font-size:18px;vertical-align:top;padding-top:2px;">🤖</td>
                <td style="padding-left:10px;">
                  <p style="margin:0;font-size:13px;font-weight:600;color:#0F172A;">Android / Chrome</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#64748B;line-height:1.6;">
                    Clique sur le <strong>menu ⋮</strong> en haut à droite → <em>Ajouter à l'écran d'accueil</em>
                  </p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:14px 32px;">
            <p style="margin:0;font-size:12px;color:#CBD5E1;text-align:center;">
              Cet email a été envoyé via GolfGo · <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color:#CBD5E1;text-decoration:none;">golfgo.be</a>
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
    const { groupId, emails, locale = 'fr' } = await req.json()

    if (!groupId || !emails?.length) {
      return Response.json({ success: false, error: 'groupId et emails requis' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Récupérer le groupe et l'owner
    const { data: group } = await supabase
      .from('groups')
      .select('name, owner:groups_players(players(first_name, surname))')
      .eq('id', groupId)
      .eq('groups_players.role', 'owner')
      .single()

    if (!group) {
      return Response.json({ success: false, error: 'Groupe introuvable' }, { status: 404 })
    }

    // Récupérer ou créer le lien d'invitation
    let { data: inviteLink } = await supabase
      .from('group_invite_links')
      .select('token, expires_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Si pas de lien ou expiré, en créer un
    if (!inviteLink || new Date(inviteLink.expires_at) < new Date()) {
      if (inviteLink) {
        await supabase.from('group_invite_links').delete().eq('group_id', groupId)
      }
      const { data: newLink } = await supabase
        .from('group_invite_links')
        .insert({ group_id: groupId })
        .select('token, expires_at')
        .single()
      inviteLink = newLink
    }

    if (!inviteLink) {
      return Response.json({ success: false, error: 'Impossible de créer le lien' }, { status: 500 })
    }

    const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const inviteUrl = `${appUrl}/${locale}/join/${inviteLink.token}`
    const qrUrl     = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(inviteUrl)}`

    const ownerPlayer   = (group.owner as any)?.[0]?.players
    const senderName    = ownerPlayer ? `${ownerPlayer.first_name} ${ownerPlayer.surname}` : 'L\'organisateur'
    const groupName     = group.name
    const subject       = `Invitation à rejoindre ${groupName} sur GolfGo`

    const html = buildGroupInviteHtml({ groupName, inviteUrl, qrUrl, senderName })

    let sent = 0, skipped = 0
    const errors: string[] = []

    // Dédoublonner et nettoyer les emails
    const uniqueEmails = [...new Set(
      (emails as string[])
        .map((e: string) => e.trim().toLowerCase())
        .filter((e: string) => e.includes('@'))
    )]

    if (!EMAIL_ENABLED) {
      return Response.json({ success: true, sent: uniqueEmails.length, skipped: 0, errors: [] })
    }

    // Envoi par batch de 10
    for (let i = 0; i < uniqueEmails.length; i += BATCH_SIZE) {
      const batch = uniqueEmails.slice(i, i + BATCH_SIZE)

      for (const email of batch) {
        const { error: emailErr } = await resend.emails.send({
          from: 'GolfGo <info@golfgo.be>',
          to: email,
          subject,
          html,
        })
        if (emailErr) { errors.push(`${email}: ${emailErr.message}`); skipped++ }
        else { sent++ }
        await sleep(EMAIL_SEND_DELAY_MS)
      }

      // Pause entre les batches (sauf dernier)
      if (i + BATCH_SIZE < uniqueEmails.length) {
        await sleep(BATCH_DELAY_MS)
      }
    }

    return Response.json({ success: true, sent, skipped, errors })
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

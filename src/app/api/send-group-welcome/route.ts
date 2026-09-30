import { buildEmailLogoHeader } from '@/lib/email/logo'
import { sleep, EMAIL_SEND_DELAY_MS } from '@/lib/email/rate-limit'
import { sendOrQueueEmail } from '@/lib/email/queueEmail'
import { getGroupLocale, serverT, type Locale, type EmailT } from '@/lib/i18n/server'
import { getGroupOwners } from '@/lib/groups/owner'
import { requireGroupOwner } from '@/lib/groups/requireOwner'

// Envoie les instructions d'arrivée (créer son compte + installer l'application) à des membres
// du groupe qui n'ont pas encore de compte. Le compte se relie tout seul à la fiche joueur
// grâce à l'adresse e-mail (trigger handle_new_user) : pas de lien d'invitation à gérer.

const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true'
const MAX_RECIPIENTS = 50

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}


function buildWelcomeHtml({
  t, lang, groupName,
  inviteUrl,
  qrUrl,
  senderName,
  recipientEmail,
  logoUrl,
}: {
  t: EmailT
  lang: string
  groupName: string
  inviteUrl: string
  qrUrl: string
  senderName: string
  recipientEmail: string
  logoUrl: string | null
}) {
  return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${t('email.groupInvite.docTitle', { group: groupName })}</title>
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

            <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0F172A;">
              ${t('email.groupInvite.heading')}
            </h1>
            <p style="margin:0 0 28px;font-size:16px;font-weight:600;color:#185FA5;">
              ${groupName}
            </p>

            <p style="margin:0 0 24px;font-size:14px;color:#334155;line-height:1.7;">
              ${t('email.groupInvite.intro', { sender: senderName, group: `<strong>${groupName}</strong>` })}
            </p>

            <p style="margin:0 0 24px;font-size:14px;color:#334155;line-height:1.7;background:#EBF3FC;border-radius:10px;padding:12px 16px;">
              ${t('email.groupInvite.useThisEmail', { email: `<strong>${recipientEmail}</strong>` })}
            </p>

            <!-- CTA -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr><td align="center">
                <a href="${inviteUrl}" style="display:inline-block;background:#185FA5;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
                  ${t('email.groupInvite.cta')}
                </a>
              </td></tr>
            </table>

            <!-- QR Code -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;margin-bottom:28px;">
              <tr><td style="padding:24px;text-align:center;">
                <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.08em;">${t('email.groupInvite.orScan')}</p>
                <img src="${qrUrl}" width="140" height="140" style="border-radius:8px;" />
              </td></tr>
            </table>

            <div style="height:1px;background:#F1F5F9;margin-bottom:24px;"></div>

            <!-- Instructions PWA -->
            <p style="margin:0 0 12px;font-size:12px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.08em;">
              ${t('email.groupInvite.install')}
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
              <tr>
                <td style="width:28px;font-size:18px;vertical-align:top;padding-top:2px;">🍎</td>
                <td style="padding-left:10px;">
                  <p style="margin:0;font-size:13px;font-weight:600;color:#0F172A;">iPhone / Safari</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#64748B;line-height:1.6;">
                    ${t('email.groupInvite.iphoneSteps', { bo: '<strong>', bc: '</strong>', eo: '<em>', ec: '</em>' })}
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
                    ${t('email.groupInvite.androidSteps', { bo: '<strong>', bc: '</strong>', eo: '<em>', ec: '</em>' })}
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
              ${t('email.groupInvite.footer')} · <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color:#CBD5E1;text-decoration:none;">golfgo.be</a>
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
    const { groupId, playerIds } = await req.json()
    if (!groupId || !Array.isArray(playerIds) || playerIds.length === 0) {
      return Response.json({ success: false, error: 'groupId et playerIds requis' }, { status: 400 })
    }
    if (playerIds.length > MAX_RECIPIENTS) {
      return Response.json({ success: false, error: `Maximum ${MAX_RECIPIENTS} destinataires` }, { status: 400 })
    }

    const auth = await requireGroupOwner(groupId)
    if (!auth.ok) return Response.json({ success: false, error: 'Unauthorized' }, { status: auth.status })
    const admin = auth.admin

    const locale: Locale = await getGroupLocale(admin, groupId)
    const t = serverT(locale)

    const { data: group } = await admin.from('groups').select('name, template_logo_url').eq('id', groupId).single()
    if (!group) return Response.json({ success: false, error: 'Groupe introuvable' }, { status: 404 })

    // Uniquement des membres de CE groupe, sans compte, avec une adresse e-mail
    const { data: rows } = await admin.from('groups_players')
      .select('player:players(id, email, user_id)')
      .eq('group_id', groupId)
      .in('player_id', playerIds)
    const recipients = (rows ?? [])
      .map((r: any) => (Array.isArray(r.player) ? r.player[0] : r.player))
      .filter((p: any) => p && !p.user_id && p.email && String(p.email).includes('@'))
      .map((p: any) => ({ id: p.id as string, email: String(p.email).trim().toLowerCase() }))

    const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const inviteUrl  = `${appUrl}/${locale}/signup`
    const qrUrl      = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(inviteUrl)}`
    const owners     = await getGroupOwners(admin, groupId)
    const senderName = owners.primary ? `${owners.primary.firstName} ${owners.primary.surname}` : t('email.common.organiser')
    const groupName  = esc(group.name ?? '')
    const logoUrl    = (group as any).template_logo_url ?? null
    const subject    = t('email.groupInvite.subject', { group: group.name ?? '' })

    if (!EMAIL_ENABLED) {
      return Response.json({ success: true, sent: recipients.length, queued: 0, skipped: 0, errors: [] })
    }

    let sent = 0, queued = 0, skipped = 0
    const errors: string[] = []
    for (const r of recipients) {
      const html = buildWelcomeHtml({
        t, lang: locale, groupName, inviteUrl, qrUrl, senderName: esc(senderName), recipientEmail: esc(r.email), logoUrl,
      })
      const result = await sendOrQueueEmail({
        category: 'group_invite',
        groupId,
        playerId: r.id,
        from:     'GolfGo <info@golfgo.be>',
        to:       r.email,
        subject,
        html,
        headers: {
          'List-Unsubscribe': `<mailto:info@golfgo.be?subject=${encodeURIComponent(t('email.common.unsubscribeSubject'))}>`,
        },
      })
      if (result.sent) sent++
      else if (result.queued) queued++
      else { skipped++; errors.push(`${r.email}: ${result.error}`) }
      await sleep(EMAIL_SEND_DELAY_MS)
    }

    return Response.json({ success: true, sent, queued, skipped, errors })
  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

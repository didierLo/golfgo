import { buildEmailLogoHeader } from '@/lib/email/logo'
import { sendOrQueueEmail } from '@/lib/email/queueEmail'
import { getGroupLocale, serverT, DATE_LOCALE } from '@/lib/i18n/server'
import { requireGroupOwner } from '@/lib/groups/requireOwner'

// Envoie par e-mail la liste des membres d'un groupe (noms, WHS, statut) à UNE adresse saisie
// par l'organisateur. Même contenu que la liste imprimée de la page Membres : aucune adresse
// e-mail ni numéro de téléphone des membres n'est transmis.
// Réservé aux organisateurs du groupe ; le texte suit la langue du groupe.

const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true'
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/

function esc(s: string) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { groupId?: string; to?: string; sortKey?: string }
    const groupId = body.groupId
    const to      = (body.to ?? '').trim()
    const sortKey = body.sortKey === 'first_name' ? 'first_name' : 'surname'

    if (!groupId) return Response.json({ success: false, error: 'groupId requis' }, { status: 400 })
    if (!to || to.length > 254 || !EMAIL_RE.test(to)) {
      return Response.json({ success: false, error: 'INVALID_EMAIL' }, { status: 400 })
    }

    const auth = await requireGroupOwner(groupId)
    if (!auth.ok) return Response.json({ success: false, error: 'Unauthorized' }, { status: auth.status })
    const admin = auth.admin

    const [{ data: group }, { data: rows }, { data: sender }] = await Promise.all([
      admin.from('groups').select('name, template_logo_url').eq('id', groupId).maybeSingle(),
      admin.from('groups_players')
        .select('role, player:players(id, surname, first_name, whs)')
        .eq('group_id', groupId),
      admin.from('players').select('first_name, surname').eq('user_id', auth.userId).maybeSingle(),
    ])
    if (!group) return Response.json({ success: false, error: 'Groupe introuvable' }, { status: 404 })

    const gl = await getGroupLocale(admin, groupId)
    const t  = serverT(gl)

    const members = (rows ?? [])
      .filter((r: any) => r.player)
      .map((r: any) => ({ ...r.player, role: r.role as string }))
      .sort((a: any, b: any) => String(a[sortKey]).localeCompare(String(b[sortKey]), DATE_LOCALE[gl], { sensitivity: 'base' }))

    const adminCount = members.filter((m: any) => m.role === 'owner').length
    const guestCount = members.filter((m: any) => m.role === 'guest').length
    const countLabel =
      t('members.subtitle', { count: members.length - guestCount })
      + (adminCount > 0 ? ' ' + t('members.adminsIncluded', { count: adminCount }) : '')
      + (guestCount > 0 ? ' · ' + t('members.guestsCount', { count: guestCount }) : '')

    const tableRows = members.map((m: any) => {
      const name = sortKey === 'first_name'
        ? `${esc(m.first_name)} <strong>${esc(m.surname)}</strong>`
        : `<strong>${esc(m.first_name)}</strong> ${esc(m.surname)}`
      const whs  = m.whs != null ? esc(String(m.whs)) : '—'
      const role = m.role === 'guest'
        ? `<span style="background:#FEF3C7;color:#92400E;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;">${t('members.visitor')}</span>`
        : m.role === 'owner'
        ? `<span style="background:#EBF3FC;color:#185FA5;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;">${t('members.admin')}</span>`
        : ''
      return `<tr>
        <td style="padding:9px 12px;border-bottom:1px solid #F1F5F9;font-size:14px;color:#0F172A;">${name}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #F1F5F9;font-size:14px;text-align:center;color:#475569;">${whs}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #F1F5F9;">${role}</td>
      </tr>`
    }).join('')

    const senderName = sender ? `${sender.first_name} ${sender.surname}` : 'GolfGo'
    const groupName  = esc(group.name)

    const html = `<!DOCTYPE html>
<html lang="${gl}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${t('email.membersList.docTitle', { group: groupName })}</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="background:#185FA5;border-radius:12px 12px 0 0;padding:20px 32px;vertical-align:middle;">
            ${buildEmailLogoHeader(group.template_logo_url ?? null)}
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:32px;border-radius:0 0 12px 12px;">
            <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#0F172A;">${t('members.title')}</h1>
            <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#185FA5;">${groupName}</p>
            <p style="margin:0 0 20px;font-size:13px;color:#64748B;">${countLabel}</p>
            <p style="margin:0 0 20px;font-size:14px;color:#334155;line-height:1.6;">
              ${t('email.membersList.intro', { sender: esc(senderName), group: `<strong>${groupName}</strong>` })}
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <thead>
                <tr style="background:#F8FAFC;">
                  <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748B;border-bottom:2px solid #E2E8F0;">${t('members.member')}</th>
                  <th style="padding:9px 12px;text-align:center;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748B;border-bottom:2px solid #E2E8F0;">${t('members.whs')}</th>
                  <th style="padding:9px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748B;border-bottom:2px solid #E2E8F0;">${t('members.status')}</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    if (!EMAIL_ENABLED) {
      return Response.json({ success: false, error: 'EMAIL_DISABLED' }, { status: 503 })
    }

    const result = await sendOrQueueEmail({
      category: 'other',
      groupId,
      from:     'GolfGo <noreply@golfgo.be>',
      replyTo:  'info@golfgo.be',
      to,
      subject:  t('email.membersList.subject', { group: group.name }),
      html,
    })

    if (!result.sent && !result.queued) {
      return Response.json({ success: false, error: result.error }, { status: 502 })
    }
    return Response.json({ success: true, queued: !result.sent })

  } catch (error: any) {
    console.error('MEMBERS LIST EMAIL ERROR:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

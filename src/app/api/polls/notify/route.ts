// Prévient les membres d'un groupe qu'un sondage de dates est ouvert (mode 'invite'),
// ou relance ceux qui n'ont pas encore répondu (mode 'remind').
// Chaque membre reçoit un lien personnel (jeton) : il vote sans avoir à se connecter.
import { sleep } from '@/lib/email/rate-limit'
import { buildEmailLogoHeader } from '@/lib/email/logo'
import { sendOrQueueEmail } from '@/lib/email/queueEmail'
import { getGroupLocale, serverT, DATE_LOCALE, type Locale } from '@/lib/i18n/server'
import { getGroupOwners, signerDisplayName } from '@/lib/groups/owner'
import { requireGroupOwner } from '@/lib/groups/requireOwner'
import { sendPushToUser } from '@/lib/push/send'

const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true'
// Délai entre deux emails (limite de débit Resend) — plus court que le délai des envois en masse existants
// pour qu'un groupe de ~50 membres reste sous la durée maximale d'une fonction.
const POLL_EMAIL_DELAY_MS = 700

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function POST(req: Request) {
  try {
    const { groupId, pollId, mode } = await req.json()
    if (!groupId || !pollId || (mode !== 'invite' && mode !== 'remind')) {
      return Response.json({ success: false, error: 'Paramètres manquants' }, { status: 400 })
    }

    const auth = await requireGroupOwner(groupId)
    if (!auth.ok) return Response.json({ success: false, error: 'Unauthorized' }, { status: auth.status })
    const admin = auth.admin

    const { data: poll } = await admin.from('polls').select('*').eq('id', pollId).eq('group_id', groupId).maybeSingle()
    if (!poll) return Response.json({ success: false, error: 'Sondage introuvable' }, { status: 404 })
    if (poll.status !== 'open') return Response.json({ success: false, error: 'Sondage clôturé' }, { status: 400 })

    const gl: Locale = await getGroupLocale(admin, groupId)
    const t  = serverT(gl)
    const dl = DATE_LOCALE[gl]
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const [{ data: options }, { data: members }, owners, { data: groupRow }] = await Promise.all([
      admin.from('poll_options').select('id, starts_at').eq('poll_id', pollId).order('starts_at'),
      admin.from('groups_players')
        .select('player_id, role, email_opt_out, players(id, first_name, surname, email, user_id)')
        .eq('group_id', groupId),
      getGroupOwners(admin, groupId),
      admin.from('groups').select('name, template_logo_url').eq('id', groupId).maybeSingle(),
    ])

    // Les « visiteurs » (guest) ne sont pas sondés
    const people = (members ?? [])
      .filter((m: any) => (m.role ?? 'member') !== 'guest')
      .map((m: any) => ({ optOut: m.email_opt_out === true, p: Array.isArray(m.players) ? m.players[0] : m.players }))
      .filter((x: any) => x.p?.id)

    // Une ligne « voter » (avec son jeton) par membre
    if (people.length) {
      await admin.from('poll_voters').upsert(
        people.map((x: any) => ({ poll_id: pollId, player_id: x.p.id })),
        { onConflict: 'poll_id,player_id', ignoreDuplicates: true },
      )
    }
    const { data: voters } = await admin.from('poll_voters').select('player_id, token').eq('poll_id', pollId)
    const tokenByPlayer = new Map((voters ?? []).map((v: any) => [v.player_id, v.token as string]))

    let targets = people
    if (mode === 'remind') {
      const { data: votes } = await admin.from('poll_votes').select('player_id').eq('poll_id', pollId)
      const answered = new Set((votes ?? []).map((v: any) => v.player_id))
      targets = people.filter((x: any) => !answered.has(x.p.id))
    }

    const fmtDate = (s: string) => new Date(s).toLocaleDateString(dl, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    const fmtTime = (s: string) => new Date(s).toLocaleTimeString(dl, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
    const optionsHtml = (options ?? []).map((o: any) => `
      <tr><td style="padding:6px 0;font-size:14px;color:#0F172A;font-weight:500;">📅 ${esc(fmtDate(o.starts_at))} · ${esc(fmtTime(o.starts_at))}</td></tr>`).join('')
    const deadlineText = poll.deadline
      ? t('pollEmail.deadline', { date: new Date(poll.deadline + 'T00:00:00Z').toLocaleDateString(dl, { day: 'numeric', month: 'long', timeZone: 'UTC' }) })
      : ''
    const ownerName = signerDisplayName(owners)
    const logoUrl   = (groupRow as any)?.template_logo_url ?? null
    const subjectKey = mode === 'remind' ? 'pollEmail.reminderSubject' : 'pollEmail.subject'

    let sent = 0, queued = 0, skipped = 0, pushed = 0
    const errors: string[] = []
    const notifiedPlayers: string[] = []

    for (const { optOut, p } of targets as any[]) {
      const token = tokenByPlayer.get(p.id)
      if (!token) { skipped++; continue }
      const link = `${appUrl}/${gl}/poll?token=${token}`

      // Notification push (si le joueur a activé les notifications) — indépendante de l'email
      if (p.user_id) {
        try {
          const n = await sendPushToUser(admin, p.user_id, {
            title: t(subjectKey, { title: poll.title }),
            body:  t('pollEmail.pushBody'),
            url:   `/${gl}/poll?token=${token}`,
          })
          pushed += n > 0 ? 1 : 0
        } catch { /* sans effet sur l'envoi des emails */ }
      }

      if (!p.email || optOut) { skipped++; continue }
      if (!EMAIL_ENABLED) { sent++; notifiedPlayers.push(p.id); continue }

      const html = `<!DOCTYPE html>
<html lang="${gl}"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${esc(poll.title)}</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
  <tr><td style="background:#185FA5;border-radius:12px 12px 0 0;padding:20px 32px;vertical-align:middle;">${buildEmailLogoHeader(logoUrl)}</td></tr>
  <tr><td style="background:#ffffff;padding:36px 32px;">
    <p style="margin:0 0 6px;font-size:13px;color:#64748B;">${esc(t('pollEmail.hello', { name: p.first_name }))}</p>
    <p style="margin:0 0 18px;font-size:18px;font-weight:700;color:#185FA5;">${esc(poll.title)}</p>
    <p style="margin:0 0 20px;font-size:14px;color:#334155;line-height:1.7;">${esc(mode === 'remind' ? t('pollEmail.reminderIntro') : t('pollEmail.intro'))}</p>
    ${poll.description ? `<p style="margin:0 0 20px;font-size:14px;color:#334155;line-height:1.7;">${esc(poll.description).replace(/\n/g, '<br/>')}</p>` : ''}
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;margin-bottom:24px;"><tr><td style="padding:14px 20px;">
      ${poll.location ? `<p style="margin:0 0 8px;font-size:13px;color:#0F172A;font-weight:600;">📍 ${esc(poll.location)}</p>` : ''}
      <table cellpadding="0" cellspacing="0">${optionsHtml}</table>
    </td></tr></table>
    <a href="${link}" style="display:block;text-decoration:none;text-align:center;background:#185FA5;color:#ffffff;font-size:16px;font-weight:700;border-radius:12px;padding:16px 20px;">${esc(t('pollEmail.cta'))} →</a>
    ${deadlineText ? `<p style="margin:16px 0 0;font-size:13px;color:#92400E;text-align:center;font-weight:600;">${esc(deadlineText)}</p>` : ''}
    ${ownerName ? `<p style="margin:24px 0 0;font-size:13px;color:#64748B;">${esc(ownerName)}</p>` : ''}
  </td></tr>
  <tr><td style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:14px 32px;">
    <p style="margin:0;font-size:12px;color:#CBD5E1;text-align:center;">${esc(t('email.common.sentViaGolfgo'))} · <a href="${appUrl}" style="color:#CBD5E1;text-decoration:none;">golfgo.be</a></p>
  </td></tr>
</table></td></tr></table></body></html>`

      const unsubscribeUrl = `${appUrl}/api/unsubscribe?pid=${p.id}&gid=${groupId}`
      const result = await sendOrQueueEmail({
        category: 'communication',
        playerId: p.id,
        groupId,
        from:     'GolfGo <noreply@golfgo.be>',
        replyTo:  'info@golfgo.be',
        to:       p.email,
        subject:  t(subjectKey, { title: poll.title }),
        html,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      })
      if (!result.sent && !result.queued) errors.push(`${p.first_name} ${p.surname}: ${result.error}`)
      else { if (result.sent) sent++; else queued++; notifiedPlayers.push(p.id) }
      await sleep(POLL_EMAIL_DELAY_MS)
    }

    if (notifiedPlayers.length) {
      await admin.from('poll_voters').update({ notified_at: new Date().toISOString() })
        .eq('poll_id', pollId).in('player_id', notifiedPlayers)
    }
    if (mode === 'remind') await admin.from('polls').update({ last_reminder_at: new Date().toISOString() }).eq('id', pollId)

    return Response.json({ success: true, targeted: targets.length, sent, queued, skipped, pushed, errors })
  } catch (error: any) {
    console.error('POLL NOTIFY ERROR:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

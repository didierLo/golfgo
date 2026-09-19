import { Resend } from 'resend'
import { sleep, EMAIL_SEND_DELAY_MS } from '@/lib/email/rate-limit'
import { createClient } from '@supabase/supabase-js'
import { generateICS } from '@/lib/ics'
import { buildEmailLogoHeader } from '@/lib/email/logo'
import { sendOrQueueEmail, drainEmailQueue } from '@/lib/email/queueEmail'
import { getGroupLocale, serverT, DATE_LOCALE, type Locale, type EmailT } from '@/lib/i18n/server'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true'
const CRON_SECRET   = process.env.CRON_SECRET

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string, loc: string) {
  return new Date(dateStr).toLocaleDateString(loc, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

function formatTime(dateStr: string, loc: string) {
  return new Date(dateStr).toLocaleTimeString(loc, {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  })
}

function daysDiff(dateStr: string): number {
  const now    = new Date(); now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  const utcTarget = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate()))
  const utcNow    = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  return Math.round((utcTarget.getTime() - utcNow.getTime()) / (1000 * 60 * 60 * 24))
}

function applyTemplateVars(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value),
    text
  )
}

// ── Boutons de réponse (golf vs event non-golf) ────────────────────────────────

function buildResponseButtons(t: EmailT, isGolf: boolean, yes18Link: string, yes9frontLink: string, yes9backLink: string, noLink: string, isFull: boolean = false): string {
  // Styles "liste d'attente" (ambre) utilisés à la place du vert/jaune/orange habituel quand l'événement est complet
  const waitBg = '#FEF3C7', waitBorder = '#D97706', waitTitle = '#92400E', waitSub = '#B45309'

  if (!isGolf) {
    return `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
              <tr><td>
                <a href="${yes18Link}" style="display:block;text-decoration:none;background:${isFull ? waitBg : '#DCFCE7'};border:2px solid ${isFull ? waitBorder : '#16A34A'};border-radius:12px;padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:22px;width:36px;">${isFull ? '⏳' : '🙋'}</td>
                    <td style="padding-left:12px;"><div style="font-size:15px;font-weight:700;color:${isFull ? waitTitle : '#15803D'};">${isFull ? t('email.respond.waitlist') : t('email.respond.yes')}</div></td>
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
                    <td style="padding-left:12px;font-size:14px;font-weight:500;color:#94A3B8;">${t('email.respond.no')}</td>
                    <td align="right" style="font-size:16px;color:#CBD5E1;">✕</td>
                  </tr></table>
                </a>
              </td></tr>
            </table>`
  }

  return `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
              <tr><td>
                <a href="${yes18Link}" style="display:block;text-decoration:none;background:${isFull ? waitBg : '#DCFCE7'};border:2px solid ${isFull ? waitBorder : '#16A34A'};border-radius:12px;padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:22px;width:36px;">${isFull ? '⏳' : '⛳'}</td>
                    <td style="padding-left:12px;"><div style="font-size:15px;font-weight:700;color:${isFull ? waitTitle : '#15803D'};">${isFull ? t('email.respond.waitlist') : t('email.respond.yes')}</div><div style="font-size:12px;color:${isFull ? waitSub : '#16A34A'};margin-top:2px;">${t('email.respond.h18')}</div></td>
                    <td align="right" style="font-size:20px;">→</td>
                  </tr></table>
                </a>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
              <tr><td>
                <a href="${yes9frontLink}" style="display:block;text-decoration:none;background:${isFull ? waitBg : '#FEF9C3'};border:2px solid ${isFull ? waitBorder : '#CA8A04'};border-radius:12px;padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:22px;width:36px;">${isFull ? '⏳' : '🌅'}</td>
                    <td style="padding-left:12px;"><div style="font-size:15px;font-weight:700;color:${isFull ? waitTitle : '#92400E'};">${isFull ? t('email.respond.waitlist') : t('email.respond.yes')}</div><div style="font-size:12px;color:${isFull ? waitSub : '#B45309'};margin-top:2px;">${t('email.respond.h9front')}</div></td>
                    <td align="right" style="font-size:20px;">→</td>
                  </tr></table>
                </a>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
              <tr><td>
                <a href="${yes9backLink}" style="display:block;text-decoration:none;background:${isFull ? waitBg : '#FFEDD5'};border:2px solid ${isFull ? waitBorder : '#EA580C'};border-radius:12px;padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:22px;width:36px;">${isFull ? '⏳' : '🌇'}</td>
                    <td style="padding-left:12px;"><div style="font-size:15px;font-weight:700;color:${isFull ? waitTitle : '#9A3412'};">${isFull ? t('email.respond.waitlist') : t('email.respond.yes')}</div><div style="font-size:12px;color:${isFull ? waitSub : '#C2410C'};margin-top:2px;">${t('email.respond.h9back')}</div></td>
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
                    <td style="padding-left:12px;font-size:14px;font-weight:500;color:#94A3B8;">${t('email.respond.no')}</td>
                    <td align="right" style="font-size:16px;color:#CBD5E1;">✕</td>
                  </tr></table>
                </a>
              </td></tr>
            </table>`
}

// ── Email rappel J-3 ─────────────────────────────────────────────────────────

function buildReminderHtml({
  t, lang, firstName, eventTitle, eventDate, eventTime, eventLocation, bodyText, isGolf,
  yes18Link, yes9frontLink, yes9backLink, noLink, logoUrl, placesRestantes,
}: {
  t: EmailT; lang: string
  firstName: string; eventTitle: string; eventDate: string; eventTime: string
  eventLocation: string | null; bodyText: string; isGolf: boolean; yes18Link: string; yes9frontLink: string
  yes9backLink: string; noLink: string; logoUrl: string | null; placesRestantes: number | null
}) {
  // placesRestantes === null → pas de limite de places (max_participants non défini) → jamais complet
  const isFull = placesRestantes !== null && placesRestantes <= 0

  return `
<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${t('email.reminder.docTitle', { title: eventTitle })}</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="background:#185FA5;border-radius:12px 12px 0 0;padding:20px 32px;vertical-align:middle;">
            ${buildEmailLogoHeader(logoUrl)}
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:36px 32px;">
            <div style="margin:0 0 24px;font-size:14px;color:#334155;line-height:1.7;white-space:pre-wrap;">${bodyText}</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;margin-bottom:28px;">
              <tr><td style="padding:16px 20px;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:5px 0;font-size:13px;color:#64748B;width:24px;">📅</td>
                    <td style="padding:5px 0;font-size:13px;color:#0F172A;font-weight:500;">${t('email.common.atTime', { date: eventDate, time: eventTime })}</td>
                  </tr>
                  ${eventLocation ? `<tr><td style="padding:5px 0;font-size:13px;color:#64748B;">📍</td><td style="padding:5px 0;font-size:13px;color:#0F172A;font-weight:500;">${eventLocation}</td></tr>` : ''}
                </table>
              </td></tr>
            </table>
            <p style="margin:0 0 16px;font-size:12px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.08em;">${t('email.common.confirmPresence')}</p>
            ${isFull ? `
            <div style="background:#FEF3C7;border:1px solid #D97706;border-radius:10px;padding:12px 16px;margin-bottom:16px;">
              <p style="margin:0;font-size:13px;color:#92400E;font-weight:600;">${t('email.common.fullNotice')}</p>
            </div>` : ''}
            ${buildResponseButtons(t, isGolf, yes18Link, yes9frontLink, yes9backLink, noLink, isFull)}
          </td>
        </tr>
        <tr>
          <td style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:14px 32px;">
            <p style="margin:0;font-size:12px;color:#CBD5E1;text-align:center;">${t('email.reminder.footer')} · <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color:#CBD5E1;text-decoration:none;">golfgo.be</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim()
}

// ── Email avertissement owner (pas de teesheet) ───────────────────────────────

function buildNoTeesheetHtml({
  t, lang, ownerFirstName, eventTitle, eventDate, eventUrl, logoUrl,
}: {
  t: EmailT; lang: string
  ownerFirstName: string; eventTitle: string; eventDate: string; eventUrl: string; logoUrl: string | null
}) {
  return `
<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"/><title>${t('email.owner.docTitle', { title: eventTitle })}</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="background:#185FA5;border-radius:12px 12px 0 0;padding:20px 32px;vertical-align:middle;">
            ${buildEmailLogoHeader(logoUrl)}
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:36px 32px;">
            <p style="margin:0 0 6px;font-size:14px;color:#64748B;">${t('email.common.greeting', { name: ownerFirstName })}</p>
            <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0F172A;">${t('email.owner.heading')}</h1>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF9C3;border:1px solid #CA8A04;border-radius:10px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;">
                <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#92400E;">${eventTitle}</p>
                <p style="margin:0;font-size:13px;color:#B45309;">${eventDate}</p>
              </td></tr>
            </table>
            <p style="margin:0 0 24px;font-size:14px;color:#334155;line-height:1.7;">
              ${t('email.owner.body')}
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${eventUrl}" style="display:inline-block;background:#185FA5;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
                  ${t('email.owner.cta')}
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:14px 32px;">
            <p style="margin:0;font-size:12px;color:#CBD5E1;text-align:center;">${t('email.owner.footer')} · <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color:#CBD5E1;text-decoration:none;">golfgo.be</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim()
}
function buildInvitationHtml({
  t, lang, firstName, eventTitle, eventDate, eventTime, eventLocation, ownerName, bodyText, isGolf,
  yes18Link, yes9frontLink, yes9backLink, noLink, logoUrl, placesRestantes,
}: {
  t: EmailT; lang: string
  firstName: string; eventTitle: string; eventDate: string; eventTime: string
  eventLocation: string | null; ownerName: string; bodyText: string; isGolf: boolean
  yes18Link: string; yes9frontLink: string; yes9backLink: string; noLink: string; logoUrl: string | null
  placesRestantes: number | null
}) {
  // placesRestantes === null → pas de limite définie sur l'événement → jamais complet
  const isFull = placesRestantes !== null && placesRestantes <= 0

  return `
<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${t('email.invitation.docTitle', { title: eventTitle })}</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="background:#185FA5;border-radius:12px 12px 0 0;padding:20px 32px;vertical-align:middle;">
            ${buildEmailLogoHeader(logoUrl)}
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:36px 32px;">
            <div style="margin:0 0 24px;font-size:14px;color:#334155;line-height:1.7;white-space:pre-wrap;">${bodyText}</div>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;margin-bottom:28px;">
              <tr><td style="padding:16px 20px;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:5px 0;font-size:13px;color:#64748B;width:24px;">📅</td>
                    <td style="padding:5px 0;font-size:13px;color:#0F172A;font-weight:500;">${t('email.common.atTime', { date: eventDate, time: eventTime })}</td>
                  </tr>
                  ${eventLocation ? `<tr><td style="padding:5px 0;font-size:13px;color:#64748B;">📍</td><td style="padding:5px 0;font-size:13px;color:#0F172A;font-weight:500;">${eventLocation}</td></tr>` : ''}
                  ${ownerName ? `<tr><td style="padding:5px 0;font-size:13px;color:#64748B;">👤</td><td style="padding:5px 0;font-size:13px;color:#0F172A;font-weight:500;">${ownerName}</td></tr>` : ''}
                </table>
              </td></tr>
            </table>
            <p style="margin:0 0 16px;font-size:12px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.08em;">${t('email.common.yourResponse')}</p>
            ${isFull ? `
            <div style="background:#FEF3C7;border:1px solid #D97706;border-radius:10px;padding:12px 16px;margin-bottom:16px;">
              <p style="margin:0;font-size:13px;color:#92400E;font-weight:600;">${t('email.common.fullNotice')}</p>
            </div>` : ''}
            ${buildResponseButtons(t, isGolf, yes18Link, yes9frontLink, yes9backLink, noLink, isFull)}
            <div style="background:#FEF9C3;border:1px solid #FDE68A;border-radius:10px;padding:12px 16px;">
              <p style="margin:0;font-size:12px;color:#92400E;font-style:italic;">
                ${t('email.common.alreadyAnswered')}
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:14px 32px;">
            <p style="margin:0;font-size:12px;color:#CBD5E1;text-align:center;">${t('email.invitation.footer')} · <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color:#CBD5E1;text-decoration:none;">golfgo.be</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim()
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function GET(req: Request) {
  // Sécurité — vérifier le secret Vercel Cron
  const authHeader = req.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const results = {
    reminders:  { sent: 0, queued: 0, skipped: 0, errors: [] as string[] },
    teesheets:  { sent: 0, skipped: 0, queued: 0, errors: [] as string[] },
    noTeesheet: { sent: 0, errors: [] as string[] },
    invitations: { sent: 0, queued: 0, skipped: 0, errors: [] as string[] },
    queue:      { sent: 0, stillPending: 0 },
  }

  // ── 0. Vider la file d'attente (emails non partis les jours précédents à
  //      cause du plafond Resend) avant tout nouvel envoi. On plafonne à 80
  //      pour garder de la marge sur les 100/jour pour les envois du jour même.
  results.queue = await drainEmailQueue(80)

  // ── 1. Récupérer les événements J-3 et J-1 ──────────────────────────────────
 const { data: events, error: eventsError } = await supabase
  .from('events')
  .select(`
    id, title, starts_at, location, group_id, tee_interval, is_golf, max_participants,
    groups!events_group_id_fkey(
      id, name, auto_reminders, auto_teesheet, auto_invitation, template_logo_url,
      template_reminder_subject, template_reminder_body,
      template_invitation_subject, template_invitation_body,
      owner:groups_players(
        role, player:players(id, first_name, surname, email)
      )
    )
  `)

  .gte('starts_at', new Date().toISOString())
  .lte('starts_at', new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString())

console.log('events count:', events?.length ?? 0)
console.log('events error:', JSON.stringify(eventsError))

for (const event of (events || []) as any[]) {
  const days        = daysDiff(event.starts_at)
  const group       = event.groups as any
  const ownerPlayer = group?.owner?.find((o: any) => o.role === 'owner')?.player
  const logoUrl     = group?.template_logo_url ?? null
  // Langue du groupe : tous les textes envoyés aux joueurs (et à l'organisateur) suivent cette langue
  const gl: Locale = await getGroupLocale(supabase, event.group_id)
  const t  = serverT(gl)
  const dl = DATE_LOCALE[gl]


    // ── J-3 : Rappel à tous les participants ─────────────────────────────────
if (days === 3 && group?.auto_reminders) {
      const { data: participants } = await supabase
        .from('event_participants')
        .select('player_id, invite_token, players(first_name, surname, email)')
        .eq('event_id', event.id)

      const reminderSubjectTpl = group?.template_reminder_subject ?? t.raw('email.defaults.reminderSubject')
      const reminderBodyTpl    = group?.template_reminder_body
        ?? t.raw('email.defaults.reminderBody')

      const ownerName = ownerPlayer ? `${ownerPlayer.first_name} ${ownerPlayer.surname}` : ''

      for (const ep of participants || []) {
        const player = ep.players as any
        if (!player?.email) { results.reminders.skipped++; continue }

        const token = ep.invite_token
        if (!token) { results.reminders.skipped++; continue }

        const yes18Link    = `${appUrl}/${gl}/invite/yes?token=${token}&holes=18`
        const yes9frontLink = `${appUrl}/${gl}/invite/yes?token=${token}&holes=9&section=out`
        const yes9backLink  = `${appUrl}/${gl}/invite/yes?token=${token}&holes=9&section=in`
        const noLink       = `${appUrl}/${gl}/invite/no?token=${token}`

        if (!EMAIL_ENABLED) { results.reminders.sent++; continue }

        // Calculer les places restantes pour cet événement
        const { count: goingCount } = await supabase
          .from('event_participants')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', event.id)
          .eq('status', 'GOING')

        // event.max_participants === null → pas de limite définie sur l'événement
        const placesRestantes = event.max_participants != null
          ? Math.max(0, event.max_participants - (goingCount ?? 0))
          : null

        const vars = {
          first_name:  player.first_name,
          surname:     player.surname,
          player_name: `${player.first_name} ${player.surname}`,
          group_name:  group?.name ?? '',
          owner_name:  ownerName,
          event_title: event.title,
          event_date:  formatDate(event.starts_at, dl),
          event_time:  formatTime(event.starts_at, dl),
          places_restantes: placesRestantes != null ? String(placesRestantes) : '',  // ← ajout
          yes_button:       '',     
        }

        const subject = applyTemplateVars(reminderSubjectTpl, vars)
        const bodyText = applyTemplateVars(reminderBodyTpl, vars)

        const html = buildReminderHtml({
          t, lang: gl,
          firstName:    player.first_name,
          eventTitle:   event.title,
          eventDate:    formatDate(event.starts_at, dl),
          eventTime:    formatTime(event.starts_at, dl),
          eventLocation: event.location,
          bodyText,
          isGolf: event.is_golf ?? true,
          yes18Link, yes9frontLink, yes9backLink, noLink,
          logoUrl,
          placesRestantes,
        })

      const icsContent = generateICS({
          eventId:       event.id,
          title:         event.title,
          startsAt:      event.starts_at,
          location:      event.location,
          method:        'PUBLISH', // pas 'REQUEST' : évite qu'Accepter/Décliner dans l'appli calendrier
          sequence:      1, // rappel J-3 = mise à jour de l'invitation J-14 (sequence 0)
          attendeeEmail: player.email,
          attendeeName:  `${player.first_name} ${player.surname}`,
        })

        const result = await sendOrQueueEmail({
          category: 'reminder',
          groupId:  event.group_id,
          eventId:  event.id,
          from:     'GolfGo <noreply@golfgo.be>',
          replyTo:  'info@golfgo.be',
          to:       player.email,
          subject,
          html,
          attachments: [
            {
              filename:    `${event.title.replace(/\s+/g, '_')}.ics`,
              content:     Buffer.from(icsContent).toString('base64'),
              contentType: 'text/calendar; charset=utf-8; method=REQUEST',
            },
          ],
        })

        if (!result.sent && !result.queued) results.reminders.errors.push(`${player.first_name} ${player.surname}: ${result.error}`)
        else if (result.sent) results.reminders.sent++
        else results.reminders.queued++
        await sleep(EMAIL_SEND_DELAY_MS)
      }
    }

    // ── J-14 : Invitation automatique à tous les membres ─────────────────────
 if (days === 14 && group?.auto_invitation) {
      // Récupérer tous les membres du groupe
      const { data: members } = await supabase
        .from('groups_players')
        .select('player_id, email_opt_out, players(id, first_name, surname, email)')
        .eq('group_id', event.group_id)

      const invitationSubjectTpl = group?.template_invitation_subject ?? t.raw('email.defaults.invitationSubject')
      const invitationBodyTpl    = group?.template_invitation_body
        ?? t.raw('email.defaults.invitationBody')

     for (const member of members || []) {

        const player = member.players as any
        if (!player?.email) { results.invitations.skipped++; continue }
        if ((member as any).email_opt_out) { results.invitations.skipped++; continue }

        // Upsert dans event_participants si absent
        const { data: existing } = await supabase
          .from('event_participants')
          .select('player_id, invite_token')
          .eq('event_id', event.id)
          .eq('player_id', member.player_id)
          .maybeSingle()

        let token = existing?.invite_token
        if (!existing) {
          const { data: inserted } = await supabase
            .from('event_participants')
            .insert({ event_id: event.id, player_id: member.player_id, status: 'PENDING' })
            .select('invite_token')
            .single()
          token = inserted?.invite_token
        } else if (!token) {
          // Participant déjà présent (ex: ajouté manuellement sans email) mais sans token
          // → on lui en génère un pour pouvoir lui envoyer ce rappel J-14, sans toucher son statut
          const { data: updated } = await supabase
            .from('event_participants')
            .update({ invite_token: crypto.randomUUID() })
            .eq('event_id', event.id)
            .eq('player_id', member.player_id)
            .select('invite_token')
            .single()
          token = updated?.invite_token
        }

        if (!token) { results.invitations.skipped++; continue }

        const unsubscribeUrl = `${appUrl}/api/unsubscribe?pid=${member.player_id}&gid=${event.group_id}`
        const yes18Link     = `${appUrl}/${gl}/invite/yes?token=${token}&holes=18`
        const yes9frontLink = `${appUrl}/${gl}/invite/yes?token=${token}&holes=9&section=out`
        const yes9backLink  = `${appUrl}/${gl}/invite/yes?token=${token}&holes=9&section=in`
        const noLink        = `${appUrl}/${gl}/invite/no?token=${token}`

if (!EMAIL_ENABLED) { results.invitations.sent++; continue }

        const ownerName = ownerPlayer
          ? `${ownerPlayer.first_name} ${ownerPlayer.surname}` : ''

        // Calculer les places restantes pour cet événement (même logique que le rappel J-3)
        const { count: goingCount } = await supabase
          .from('event_participants')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', event.id)
          .eq('status', 'GOING')

        const placesRestantes = event.max_participants != null
          ? Math.max(0, event.max_participants - (goingCount ?? 0))
          : null

        const vars = {
          first_name:  player.first_name,
          surname:     player.surname,
          player_name: `${player.first_name} ${player.surname}`,
          group_name:  group?.name ?? '',
          owner_name:  ownerName,
          event_title: event.title,
          event_date:  formatDate(event.starts_at, dl),
          event_time:  formatTime(event.starts_at, dl),
        }

        const subject  = applyTemplateVars(invitationSubjectTpl, vars)
        const bodyText = applyTemplateVars(invitationBodyTpl, vars)

        const html = buildInvitationHtml({
          t, lang: gl,
          firstName:     player.first_name,
          eventTitle:    event.title,
          eventDate:     formatDate(event.starts_at, dl),
          eventTime:     formatTime(event.starts_at, dl),
          eventLocation: event.location,
          ownerName,
          bodyText,
          isGolf: event.is_golf ?? true,
          yes18Link, yes9frontLink, yes9backLink, noLink,
          logoUrl,
          placesRestantes,
        })

       const icsContent = generateICS({
          eventId:       event.id,
          title:         event.title,
          startsAt:      event.starts_at,
          location:      event.location,
          method:        'PUBLISH', // pas 'REQUEST' : évite qu'Accepter/Décliner dans l'appli calendrier
          sequence:      0, // invitation initiale
          attendeeEmail: player.email,
          attendeeName:  `${player.first_name} ${player.surname}`,
        })

        const result = await sendOrQueueEmail({
          category: 'invitation',
          groupId:  event.group_id,
          eventId:  event.id,
          from:     'GolfGo <noreply@golfgo.be>',
          replyTo:  'info@golfgo.be',
          to:       player.email,
          subject,
          html,
          headers: {
            'List-Unsubscribe': `<${unsubscribeUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
          attachments: [
            {
              filename:    `${event.title.replace(/\s+/g, '_')}.ics`,
              content:     Buffer.from(icsContent).toString('base64'),
              contentType: 'text/calendar; charset=utf-8; method=REQUEST',
            },
          ],
        })

        if (!result.sent && !result.queued) results.invitations.errors.push(`${player.first_name} ${player.surname}: ${result.error}`)
        else if (result.sent) results.invitations.sent++
        else results.invitations.queued++
        await sleep(EMAIL_SEND_DELAY_MS)
      }
    }


    // ── J-1 : Teesheet auto ou avertissement owner ───────────────────────────
     if (days === 1 && event.is_golf && group?.auto_teesheet) {
      // Vérifier si des flights existent
      const { data: flightsData } = await supabase
        .from('flights')
        .select(`id, flight_number, manual_start_at, flight_players(player_id, players(id, first_name, surname, whs))`)
        .eq('event_id', event.id)
        .order('flight_number')

      const { data: participants } = await supabase
        .from('event_participants')
        .select('player_id, holes_played, holes_section')
        .eq('event_id', event.id)

      if (!flightsData || flightsData.length === 0) {
        // Pas de flights → email d'avertissement à l'owner
        if (!ownerPlayer?.email) continue

        const eventUrl = `${appUrl}/${gl}/groups/${event.group_id}/events/${event.id}/flights`

        if (!EMAIL_ENABLED) { results.noTeesheet.sent++; continue }

        const html = buildNoTeesheetHtml({
          t, lang: gl,
          ownerFirstName: ownerPlayer.first_name,
          eventTitle:     event.title,
          eventDate:      formatDate(event.starts_at, dl),
          eventUrl,
          logoUrl,
        })

        const result = await sendOrQueueEmail({
          category: 'other',
          groupId:  event.group_id,
          eventId:  event.id,
          from:     'GolfGo <info@golfgo.be>',
          to:       ownerPlayer.email,
          subject:  t('email.owner.subject', { title: event.title }),
          html,
        })

        if (!result.sent && !result.queued) results.noTeesheet.errors.push(result.error)
        else results.noTeesheet.sent++

      } else {
        // Flights existants → construire et envoyer la teesheet
        const holesMap: Record<string, { holes_played: number | null; holes_section: string | null }> = {}
        participants?.forEach(p => {
          holesMap[p.player_id] = { holes_played: p.holes_played, holes_section: p.holes_section }
        })

      const teeInterval = event.tee_interval ?? 9

      const flightsMapped = flightsData.map((f: any) => ({
        flight_number:   f.flight_number,
        manual_start_at: f.manual_start_at ?? null,
        players: (f.flight_players || []).map((fp: any) => ({
          ...fp.players,
          holes_played:  holesMap[fp.player_id]?.holes_played  ?? null,
          holes_section: holesMap[fp.player_id]?.holes_section ?? null,
        })).filter(Boolean),
      }))

      // On respecte l'ordre déjà trié en base (.order('flight_number')), qui
      // reflète l'éventuelle réorganisation manuelle faite dans l'écran
      // teesheet — on ne retrie plus par nombre de joueurs.

      let cursorMs = new Date(event.starts_at).getTime()
      const flights = flightsMapped.map((f: any, index: number) => {
        const thisMs = f.manual_start_at ? new Date(f.manual_start_at).getTime() : cursorMs
        cursorMs = thisMs + teeInterval * 60 * 1000
        const startTime = new Date(thisMs).toLocaleTimeString(dl, {
          hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
        })
        return {
          flight_number: index + 1,  // renuméroter pour un affichage continu (pas de trous)
          start_time:    startTime,
          players:       f.players,
        }
      })

    // Template teesheet personnalisé
        const teesheetSubjectTpl = group?.template_teesheet_subject ?? t.raw('email.defaults.teesheetSubject')
        const teesheetBodyTpl    = group?.template_teesheet_body
          ?? t.raw('email.defaults.teesheetBody')

        const ownerName = ownerPlayer ? `${ownerPlayer.first_name} ${ownerPlayer.surname}` : ''

        // Envoyer via l'API send-teesheet
        const teesheetRes = await fetch(`${appUrl}/api/send-teesheet`, {
          method:  'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-cron-secret': CRON_SECRET ?? '',
          },
          body: JSON.stringify({
            eventId: event.id,
            flights,
            bodyText: teesheetBodyTpl,        // sera substitué par joueur dans send-teesheet
            subject:  teesheetSubjectTpl,     // idem
            templateVars: {                   // variables à substituer dans send-teesheet
              group_name:  group?.name ?? '',
              owner_name:  ownerName,
              event_title: event.title,
              event_date:  formatDate(event.starts_at, dl),
              event_time:  formatTime(event.starts_at, dl),
            },
          }),
        })
        const teesheetJson = await teesheetRes.json()
        if (teesheetJson.success) {
          results.teesheets.sent    += teesheetJson.sent    ?? 0
          results.teesheets.skipped += teesheetJson.skipped ?? 0
          results.teesheets.queued  = (results.teesheets.queued ?? 0) + (teesheetJson.queued ?? 0)
        } else {
          results.teesheets.errors.push(`${event.title}: ${teesheetJson.error}`)
        }
      }
    }
  }

  console.log('[CRON reminders]', JSON.stringify(results))
  return Response.json({ success: true, ...results })
}
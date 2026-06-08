import { Resend } from 'resend'
import { sleep, EMAIL_SEND_DELAY_MS } from '@/lib/email/rate-limit'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true'
const CRON_SECRET   = process.env.CRON_SECRET

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-BE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('fr-BE', {
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

// ── Email rappel J-3 ─────────────────────────────────────────────────────────

function buildReminderHtml({
  firstName, eventTitle, eventDate, eventTime, eventLocation,
  yes18Link, yes9frontLink, yes9backLink, noLink,
}: {
  firstName: string; eventTitle: string; eventDate: string; eventTime: string
  eventLocation: string | null; yes18Link: string; yes9frontLink: string
  yes9backLink: string; noLink: string
}) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Rappel — ${eventTitle}</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="background:#185FA5;border-radius:12px 12px 0 0;padding:20px 32px;vertical-align:middle;">
            <img src="https://zykywwjmaqcjhciffsbi.supabase.co/storage/v1/object/public/apple-touch-icon/apple-touch-icon.png" width="32" height="32" style="vertical-align:middle;border-radius:6px;margin-right:8px;"/>
            <span style="font-size:20px;font-weight:700;color:#ffffff;vertical-align:middle;">Golf</span>
            <span style="font-size:20px;font-weight:700;color:#97C459;vertical-align:middle;">Go</span>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:36px 32px;">
            <p style="margin:0 0 6px;font-size:14px;color:#64748B;">Bonjour ${firstName},</p>
            <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0F172A;">⏰ Rappel — dans 3 jours</h1>
            <p style="margin:0 0 24px;font-size:16px;font-weight:600;color:#185FA5;">${eventTitle}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;margin-bottom:28px;">
              <tr><td style="padding:16px 20px;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:5px 0;font-size:13px;color:#64748B;width:24px;">📅</td>
                    <td style="padding:5px 0;font-size:13px;color:#0F172A;font-weight:500;">${eventDate} à ${eventTime}</td>
                  </tr>
                  ${eventLocation ? `<tr><td style="padding:5px 0;font-size:13px;color:#64748B;">📍</td><td style="padding:5px 0;font-size:13px;color:#0F172A;font-weight:500;">${eventLocation}</td></tr>` : ''}
                </table>
              </td></tr>
            </table>
            <p style="margin:0 0 16px;font-size:12px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.08em;">Confirmez votre présence</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
              <tr><td>
                <a href="${yes18Link}" style="display:block;text-decoration:none;background:#DCFCE7;border:2px solid #16A34A;border-radius:12px;padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:22px;width:36px;">⛳</td>
                    <td style="padding-left:12px;"><div style="font-size:15px;font-weight:700;color:#15803D;">Je participe</div><div style="font-size:12px;color:#16A34A;margin-top:2px;">18 trous</div></td>
                    <td align="right" style="font-size:20px;">→</td>
                  </tr></table>
                </a>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
              <tr><td>
                <a href="${yes9frontLink}" style="display:block;text-decoration:none;background:#FEF9C3;border:2px solid #CA8A04;border-radius:12px;padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:22px;width:36px;">🌅</td>
                    <td style="padding-left:12px;"><div style="font-size:15px;font-weight:700;color:#92400E;">Je participe</div><div style="font-size:12px;color:#B45309;margin-top:2px;">9 trous Front</div></td>
                    <td align="right" style="font-size:20px;">→</td>
                  </tr></table>
                </a>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
              <tr><td>
                <a href="${yes9backLink}" style="display:block;text-decoration:none;background:#FFEDD5;border:2px solid #EA580C;border-radius:12px;padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0"><tr>
                    <td style="font-size:22px;width:36px;">🌇</td>
                    <td style="padding-left:12px;"><div style="font-size:15px;font-weight:700;color:#9A3412;">Je participe</div><div style="font-size:12px;color:#C2410C;margin-top:2px;">9 trous Back</div></td>
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
                    <td style="padding-left:12px;font-size:14px;font-weight:500;color:#94A3B8;">Je ne peux pas participer</td>
                    <td align="right" style="font-size:16px;color:#CBD5E1;">✕</td>
                  </tr></table>
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:14px 32px;">
            <p style="margin:0;font-size:12px;color:#CBD5E1;text-align:center;">Rappel automatique GolfGo · <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color:#CBD5E1;text-decoration:none;">golfgo.be</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`.trim()
}

// ── Email avertissement owner (pas de teesheet) ───────────────────────────────

function buildNoTeesheetHtml({
  ownerFirstName, eventTitle, eventDate, eventUrl,
}: {
  ownerFirstName: string; eventTitle: string; eventDate: string; eventUrl: string
}) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/><title>Action requise — ${eventTitle}</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="background:#185FA5;border-radius:12px 12px 0 0;padding:20px 32px;vertical-align:middle;">
            <img src="https://zykywwjmaqcjhciffsbi.supabase.co/storage/v1/object/public/apple-touch-icon/apple-touch-icon.png" width="32" height="32" style="vertical-align:middle;border-radius:6px;margin-right:8px;"/>
            <span style="font-size:20px;font-weight:700;color:#ffffff;vertical-align:middle;">Golf</span>
            <span style="font-size:20px;font-weight:700;color:#97C459;vertical-align:middle;">Go</span>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:36px 32px;">
            <p style="margin:0 0 6px;font-size:14px;color:#64748B;">Bonjour ${ownerFirstName},</p>
            <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0F172A;">⚠️ Flights manquants — demain</h1>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF9C3;border:1px solid #CA8A04;border-radius:10px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;">
                <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#92400E;">${eventTitle}</p>
                <p style="margin:0;font-size:13px;color:#B45309;">${eventDate}</p>
              </td></tr>
            </table>
            <p style="margin:0 0 24px;font-size:14px;color:#334155;line-height:1.7;">
              Aucun flight n'a été généré pour cet événement. Les participants ne recevront pas de feuille de départ automatique.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${eventUrl}" style="display:inline-block;background:#185FA5;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
                  Générer les flights →
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:14px 32px;">
            <p style="margin:0;font-size:12px;color:#CBD5E1;text-align:center;">Notification automatique GolfGo · <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color:#CBD5E1;text-decoration:none;">golfgo.be</a></p>
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
    reminders:  { sent: 0, skipped: 0, errors: [] as string[] },
    teesheets:  { sent: 0, skipped: 0, errors: [] as string[] },
    noTeesheet: { sent: 0, errors: [] as string[] },
  }

  // ── 1. Récupérer les événements J-3 et J-1 ──────────────────────────────────
  const { data: events } = await supabase
    .from('events')
    .select(`
      id, title, starts_at, location, group_id, tee_interval, is_golf,
      groups!events_group_id_fkey(
        id, name, auto_reminders, auto_teesheet,
        owner:groups_players(
          role, player:players(id, first_name, surname, email)
        )
      )
    `)
    .gte('starts_at', new Date().toISOString())
    .lte('starts_at', new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString())

  console.log('events count:', events?.length ?? 0)

  for (const event of (events || []) as any[]) {
    const days        = daysDiff(event.starts_at)
    const group       = event.groups as any
    const ownerPlayer = group?.owner?.find((o: any) => o.role === 'owner')?.player

    // ── J-3 : Rappel à tous les participants ─────────────────────────────────

    // ── J-3 : Rappel à tous les participants ─────────────────────────────────
    if (days === 3 && group?.auto_reminders) {
      const { data: participants } = await supabase
        .from('event_participants')
        .select('player_id, invite_token, players(first_name, surname, email)')
        .eq('event_id', event.id)

      for (const ep of participants || []) {
        const player = ep.players as any
        if (!player?.email) { results.reminders.skipped++; continue }

        const token = ep.invite_token
        if (!token) { results.reminders.skipped++; continue }

        const yes18Link    = `${appUrl}/invite/yes?token=${token}&holes=18`
        const yes9frontLink = `${appUrl}/invite/yes?token=${token}&holes=9&section=out`
        const yes9backLink  = `${appUrl}/invite/yes?token=${token}&holes=9&section=in`
        const noLink       = `${appUrl}/invite/no?token=${token}`

        if (!EMAIL_ENABLED) { results.reminders.sent++; continue }

        const html = buildReminderHtml({
          firstName:    player.first_name,
          eventTitle:   event.title,
          eventDate:    formatDate(event.starts_at),
          eventTime:    formatTime(event.starts_at),
          eventLocation: event.location,
          yes18Link, yes9frontLink, yes9backLink, noLink,
        })

        const { error } = await resend.emails.send({
          from:    'GolfGo <info@golfgo.be>',
          to:      player.email,
          subject: `⏰ Rappel — ${event.title} dans 3 jours`,
          html,
        })

        if (error) results.reminders.errors.push(`${player.first_name} ${player.surname}: ${error.message}`)
        else results.reminders.sent++
        await sleep(EMAIL_SEND_DELAY_MS)
      }
    }

    // ── J-1 : Teesheet auto ou avertissement owner ───────────────────────────
     if (days === 1 && event.is_golf && group?.auto_teesheet) {
      // Vérifier si des flights existent
      const { data: flightsData } = await supabase
        .from('flights')
        .select(`id, flight_number, flight_players(player_id, players(id, first_name, surname, whs))`)
        .eq('event_id', event.id)
        .order('flight_number')

      const { data: participants } = await supabase
        .from('event_participants')
        .select('player_id, holes_played, holes_section')
        .eq('event_id', event.id)

      if (!flightsData || flightsData.length === 0) {
        // Pas de flights → email d'avertissement à l'owner
        if (!ownerPlayer?.email) continue

        const eventUrl = `${appUrl}/fr/groups/${event.group_id}/events/${event.id}/flights`

        if (!EMAIL_ENABLED) { results.noTeesheet.sent++; continue }

        const html = buildNoTeesheetHtml({
          ownerFirstName: ownerPlayer.first_name,
          eventTitle:     event.title,
          eventDate:      formatDate(event.starts_at),
          eventUrl,
        })

        const { error } = await resend.emails.send({
          from:    'GolfGo <info@golfgo.be>',
          to:      ownerPlayer.email,
          subject: `⚠️ Flights manquants — ${event.title} demain`,
          html,
        })

        if (error) results.noTeesheet.errors.push(error.message)
        else results.noTeesheet.sent++

      } else {
        // Flights existants → construire et envoyer la teesheet
        const holesMap: Record<string, { holes_played: number | null; holes_section: string | null }> = {}
        participants?.forEach(p => {
          holesMap[p.player_id] = { holes_played: p.holes_played, holes_section: p.holes_section }
        })

        const teeInterval = event.tee_interval ?? 9
        const flights = flightsData.map((f: any, index: number) => {
          const ms = new Date(event.starts_at).getTime() + index * teeInterval * 60 * 1000
          const startTime = new Date(ms).toLocaleTimeString('fr-BE', {
            hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
          })
          return {
            flight_number: f.flight_number,
            start_time:    startTime,
            players: (f.flight_players || []).map((fp: any) => ({
              ...fp.players,
              holes_played:  holesMap[fp.player_id]?.holes_played  ?? null,
              holes_section: holesMap[fp.player_id]?.holes_section ?? null,
            })).filter(Boolean),
          }
        })

        // Envoyer via l'API send-teesheet
        const res = await fetch(`${appUrl}/api/send-teesheet`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ eventId: event.id, flights }),
        })
        const json = await res.json()
        if (json.success) {
          results.teesheets.sent    += json.sent    ?? 0
          results.teesheets.skipped += json.skipped ?? 0
        } else {
          results.teesheets.errors.push(`${event.title}: ${json.error}`)
        }
      }
    }
  }

  console.log('[CRON reminders]', JSON.stringify(results))
  return Response.json({ success: true, ...results })
}

import { Resend } from 'resend'
import { createServerClient } from '@/lib/supabase/server'
import { sleep, EMAIL_SEND_DELAY_MS } from '@/lib/email/rate-limit'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true'

type FlightPlayer = { id: string; first_name: string; surname: string; whs: number | null }
type Flight = { flight_number: number; start_time: string; players: FlightPlayer[] }

function buildTeesheetEmail({
  playerName,
  playerFlightNumber,
  eventTitle,
  eventDate,
  eventLocation,
  flights,
}: {
  playerName: string
  playerFlightNumber: number
  eventTitle: string
  eventDate: string
  eventLocation: string | null
  flights: Flight[]
}) {
  const flightsHtml = flights.map(flight => {
    const isMyFlight = flight.flight_number === playerFlightNumber
    const headerBg   = isMyFlight ? '#185FA5' : '#F9FAFB'
    const headerText = isMyFlight ? '#ffffff' : '#374151'
    const borderColor = isMyFlight ? '#185FA5' : '#E5E7EB'

    const playersHtml = flight.players.map((p, i) => {
      const isMe = `${p.first_name} ${p.surname}` === playerName
      return `
        <tr style="border-bottom: 1px solid #F3F4F6;">
          <td style="padding: 10px 16px; font-size: 13px; color: ${isMe ? '#185FA5' : '#374151'}; font-weight: ${isMe ? '600' : '400'};">
            ${i + 1}. ${p.first_name} ${p.surname}${isMe ? ' ← vous' : ''}
          </td>
          <td style="padding: 10px 16px; font-size: 12px; color: #9CA3AF; text-align: right;">
            ${p.whs !== null ? `WHS ${p.whs}` : ''}
          </td>
        </tr>
      `
    }).join('')

    return `
      <div style="margin-bottom: 16px; border: 1.5px solid ${borderColor}; border-radius: 10px; overflow: hidden;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr style="background: ${headerBg};">
            <td style="padding: 10px 16px; font-size: 13px; font-weight: 600; color: ${headerText};">
              Flight ${flight.flight_number}${isMyFlight ? ' — Votre flight' : ''}
            </td>
            <td style="padding: 10px 16px; font-size: 14px; font-weight: 700; color: ${isMyFlight ? '#97C459' : '#185FA5'}; text-align: right;">
              ${flight.start_time}
            </td>
          </tr>
          ${playersHtml}
        </table>
      </div>
    `
  }).join('')

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tee Sheet — ${eventTitle}</title>
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
                    <img src="https://zykywwjmaqcjhciffsbi.supabase.co/storage/v1/object/public/apple-touch-icon/apple-touch-icon.png" width="36" height="36" style="vertical-align:middle;border-radius:6px;margin-right:8px;" />
                    <span style="font-size:22px;font-weight:600;color:#ffffff;letter-spacing:-0.5px;vertical-align:middle;">Golf</span>
                    <span style="font-size:22px;font-weight:600;color:#97C459;letter-spacing:-0.5px;vertical-align:middle;">Go</span>
                  </td>
                  <td style="text-align:right;">
                    <span style="font-size:12px;color:rgba(255,255,255,0.7);font-weight:500;text-transform:uppercase;letter-spacing:1px;">Tee Sheet</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px;">

              <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#111827;line-height:1.3;">
                ${eventTitle}
              </h1>

              <!-- Infos event -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:14px 20px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:3px 0;font-size:13px;color:#6B7280;width:70px;">📅 Date</td>
                        <td style="padding:3px 0;font-size:13px;color:#111827;font-weight:500;">${eventDate}</td>
                      </tr>
                      ${eventLocation ? `
                      <tr>
                        <td style="padding:3px 0;font-size:13px;color:#6B7280;">📍 Lieu</td>
                        <td style="padding:3px 0;font-size:13px;color:#111827;font-weight:500;">${eventLocation}</td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Tee sheet -->
              <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">
                Ordre de départ
              </p>

              ${flightsHtml}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;">
                Organisé avec GolfGo · <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color:#9CA3AF;">golfgo.be</a>
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
    const { eventId, flights } = await req.json() as { eventId: string; flights: Flight[] }

    if (!eventId || !flights?.length) {
      return Response.json({ success: false, error: 'eventId et flights requis' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Event
    const { data: event } = await supabase
      .from('events').select('title, starts_at, location, group_id').eq('id', eventId).single()
    if (!event) return Response.json({ success: false, error: 'Event introuvable' }, { status: 404 })

    const eventDate = new Date(event.starts_at).toLocaleDateString('fr-BE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    })

    // Participants GOING avec email
    const { data: participants } = await supabase
      .from('event_participants')
      .select('player_id, players(id, first_name, surname, email)')
      .eq('event_id', eventId)
      .eq('status', 'GOING')

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    let sent = 0
    let skipped = 0
    const errors: string[] = []

    for (const ep of participants || []) {
      const player = ep.players as any
      if (!player?.email) { skipped++; continue }

      const playerName = `${player.first_name} ${player.surname}`

      // Trouver le flight du joueur
      const playerFlight = flights.find(f =>
        f.players.some(p => p.id === player.id)
      )
      if (!playerFlight) { skipped++; continue }

      if (!EMAIL_ENABLED) {
        console.log('━━━ TEESHEET EMAIL PREVIEW ━━━━━━━━━━━━━━━━━━')
        console.log(`To:     ${player.email}`)
        console.log(`Player: ${playerName}`)
        console.log(`Flight: ${playerFlight.flight_number} @ ${playerFlight.start_time}`)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        sent++
        continue
      }

      const html = buildTeesheetEmail({
        playerName,
        playerFlightNumber: playerFlight.flight_number,
        eventTitle:  event.title,
        eventDate,
        eventLocation: event.location,
        flights,
      })

      const { error: emailErr } = await resend.emails.send({
        from:    'GolfGo <info@golfgo.be>',
        to:      player.email,
        subject: `Tee Sheet — ${event.title}`,
        html,
      })

      if (emailErr) {
        errors.push(`${playerName}: ${emailErr.message}`)
      } else {
        sent++
      }
      await sleep(EMAIL_SEND_DELAY_MS)
    }

    return Response.json({ success: true, sent, skipped, errors })

  } catch (error: any) {
    console.error('TEESHEET EMAIL ERROR:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

import { buildEmailLogoHeader } from './logo'

export type TeesheetFlightPlayer = {
  first_name: string
  surname: string
  whs: number | null
  holes_played?: number | null
  holes_section?: 'out' | 'in' | null
}

export type TeesheetFlight = {
  flight_number: number
  start_time: string
  players: TeesheetFlightPlayer[]
}

function holesLabel(p: TeesheetFlightPlayer): string | null {
  if (!p.holes_played || p.holes_played === 18) return null
  if (p.holes_section === 'out') return '9F'
  if (p.holes_section === 'in')  return '9B'
  return '9T'
}

export function buildTeesheetHtml({
  playerName, playerFlightNumber, eventTitle, eventDate, eventLocation, flights, logoUrl, autoPrint = false,
}: {
  playerName: string | null
  playerFlightNumber: number | null
  eventTitle: string
  eventDate: string
  eventLocation: string | null
  flights: TeesheetFlight[]
  logoUrl: string | null
  autoPrint?: boolean
}) {
  const flightsHtml = flights.map(flight => {
    const isMyFlight  = playerFlightNumber !== null && flight.flight_number === playerFlightNumber
    const headerBg    = isMyFlight ? '#185FA5' : '#F9FAFB'
    const headerText  = isMyFlight ? '#ffffff'  : '#374151'
    const borderColor = isMyFlight ? '#185FA5'  : '#E5E7EB'

    const playersHtml = flight.players.map((p, i) => {
      const isMe  = playerName !== null && `${p.first_name} ${p.surname}` === playerName
      const label = holesLabel(p)
      const badge9 = label
        ? `<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:${
            label === '9F' ? '#FEF3C7' : label === '9B' ? '#FFEDD5' : '#F3F4F6'
          };color:${
            label === '9F' ? '#B45309' : label === '9B' ? '#C2410C' : '#6B7280'
          };margin-left:6px;">${label}</span>`
        : ''
      return `
        <tr style="border-bottom: 1px solid #F3F4F6;">
          <td style="padding: 10px 16px; font-size: 13px; color: ${isMe ? '#185FA5' : '#374151'}; font-weight: ${isMe ? '600' : '400'};">
            ${i + 1}. ${p.first_name} ${p.surname}${isMe ? ' ← vous' : ''}${badge9}
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

          <tr>
            <td style="background:#185FA5;border-radius:12px 12px 0 0;padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    ${buildEmailLogoHeader(logoUrl)}
                  </td>
                  <td style="text-align:right;">
                    <span style="font-size:12px;color:rgba(255,255,255,0.7);font-weight:500;text-transform:uppercase;letter-spacing:1px;">Tee Sheet</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background:#ffffff;padding:32px;">
              <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#111827;line-height:1.3;">
                ${eventTitle}
              </h1>
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
              <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">
                Ordre de départ
              </p>
              ${flightsHtml}
            </td>
          </tr>

          <tr>
            <td style="background:#F9FAFB;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;">
                Organisé avec GolfGo · golfgo.be
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  ${autoPrint ? '<script>window.onload = () => window.print()</script>' : ''}
</body>
</html>
  `.trim()
}
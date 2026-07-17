function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

// Repliage des lignes à 75 octets max, requis par la RFC 5545 (sécurité si un
// titre ou lieu est long — la plupart de nos lignes resteront courtes).
function foldLine(line: string): string {
  if (line.length <= 75) return line
  let result = ''
  let first = true
  let remaining = line
  while (remaining.length > 0) {
    const chunkSize = first ? 75 : 74
    result += (first ? '' : '\r\n ') + remaining.slice(0, chunkSize)
    remaining = remaining.slice(chunkSize)
    first = false
  }
  return result
}

export interface GenerateICSOptions {
  eventId: string
  title: string
  startsAt: string
  location: string | null
  method?: 'PUBLISH' | 'REQUEST'
  sequence?: number
  attendeeEmail?: string
  attendeeName?: string
}

export function generateICS(opts: GenerateICSOptions): string {
  const {
    eventId, title, startsAt, location,
    method = 'PUBLISH', sequence = 0,
    attendeeEmail, attendeeName,
  } = opts

  const start = new Date(startsAt)
  const end   = new Date(start.getTime() + 4 * 60 * 60 * 1000)

  const fmt = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
  }

  const dtstamp = fmt(new Date())

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GolfGo//FR',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${eventId}@golfgo.be`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SEQUENCE:${sequence}`,
    `SUMMARY:${escapeICSText(title)}`,
    location ? `LOCATION:${escapeICSText(location)}` : '',
  ]

  if (method === 'REQUEST') {
    lines.push('ORGANIZER;CN=GolfGo:mailto:info@golfgo.be')
    lines.push('STATUS:CONFIRMED')
    if (attendeeEmail) {
      const cn = attendeeName ? `;CN=${escapeICSText(attendeeName)}` : ''
      lines.push(`ATTENDEE${cn};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendeeEmail}`)
    }
  }

  lines.push('END:VEVENT', 'END:VCALENDAR')

  return lines.filter(Boolean).map(foldLine).join('\r\n')
}
import { createServerClient } from '@/lib/supabase/server'

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-BE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('fr-BE', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  })
}
function applyVars(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (r, [k, v]) => r.replace(new RegExp(`{{${k}}}`, 'g'), v), text
  )
}

// ── Invitation HTML (avec 9T) ─────────────────────────────────────────────────
function buildInvitationHtml({ eventTitle, eventDate, eventTime, eventLocation, eventMessage, yes18Link, yes9Link, noLink, eventLink }: {
  eventTitle: string; eventDate: string; eventTime: string
  eventLocation: string | null; eventMessage: string | null
  yes18Link: string; yes9Link: string; noLink: string; eventLink: string
}) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>Invitation — ${eventTitle}</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
<tr><td style="background:#185FA5;border-radius:12px 12px 0 0;padding:20px 32px;">
  <span style="font-size:20px;font-weight:700;color:#ffffff;">Golf</span>
  <span style="font-size:20px;font-weight:700;color:#97C459;">Go</span>
</td></tr>
<tr><td style="background:#ffffff;padding:36px 32px;">
  <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#0F172A;">Invitation</h1>
  <p style="margin:0 0 28px;font-size:16px;font-weight:600;color:#185FA5;">${eventTitle}</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;margin-bottom:28px;">
    <tr><td style="padding:16px 20px;">
      <table cellpadding="0" cellspacing="0">
        <tr><td style="padding:5px 0;font-size:13px;color:#64748B;width:24px;">📅</td>
            <td style="padding:5px 0;font-size:13px;color:#0F172A;font-weight:500;">${eventDate} à ${eventTime}</td></tr>
        ${eventLocation ? `<tr><td style="padding:5px 0;font-size:13px;color:#64748B;">📍</td>
            <td style="padding:5px 0;font-size:13px;color:#0F172A;font-weight:500;">${eventLocation}</td></tr>` : ''}
      </table>
    </td></tr>
  </table>
  ${eventMessage ? `<div style="margin-bottom:28px;"><p style="margin:0;font-size:14px;color:#334155;line-height:1.9;">${eventMessage.replace(/\n/g, '<br/>')}</p></div>` : ''}
  <div style="height:1px;background:#F1F5F9;margin-bottom:24px;"></div>
  <p style="margin:0 0 16px;font-size:12px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:0.08em;">Ta réponse</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;"><tr><td>
    <a href="${yes18Link}" style="display:block;text-decoration:none;background:#ffffff;border:1.5px solid #16A34A;border-radius:10px;padding:14px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:15px;font-weight:600;color:#15803D;">Je participe — 18 trous</td>
        <td align="right" style="font-size:18px;">⛳</td>
      </tr></table>
    </a>
  </td></tr></table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;"><tr><td>
    <a href="${yes9Link}" style="display:block;text-decoration:none;background:#ffffff;border:1.5px solid #D97706;border-radius:10px;padding:14px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:15px;font-weight:600;color:#B45309;">Je participe — 9 trous</td>
        <td align="right" style="font-size:18px;">🏌️</td>
      </tr></table>
    </a>
  </td></tr></table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr><td>
    <a href="${noLink}" style="display:block;text-decoration:none;background:#ffffff;border:1.5px solid #E2E8F0;border-radius:10px;padding:14px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:15px;font-weight:500;color:#94A3B8;">Je ne peux pas participer</td>
        <td align="right" style="font-size:16px;color:#CBD5E1;">✕</td>
      </tr></table>
    </a>
  </td></tr></table>
  <p style="margin:0;font-size:13px;color:#94A3B8;text-align:center;">
    Ou <a href="${eventLink}" style="color:#185FA5;text-decoration:none;font-weight:500;">voir les détails dans l'app</a>
  </p>
</td></tr>
<tr><td style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:14px 32px;">
  <p style="margin:0;font-size:12px;color:#CBD5E1;text-align:center;">Envoyé via GolfGo · golfgo.be</p>
</td></tr>
</table></td></tr></table>
</body></html>`
}

// ── Teesheet HTML ─────────────────────────────────────────────────────────────
function buildTeesheetHtml({ playerName, playerFlightNumber, eventTitle, eventDate, eventLocation, flights }: {
  playerName: string; playerFlightNumber: number; eventTitle: string
  eventDate: string; eventLocation: string | null
  flights: { flight_number: number; start_time: string; players: { first_name: string; surname: string; whs: number | null }[] }[]
}) {
  const flightsHtml = flights.map(flight => {
    const isMyFlight  = flight.flight_number === playerFlightNumber
    const headerBg    = isMyFlight ? '#185FA5' : '#F9FAFB'
    const headerText  = isMyFlight ? '#ffffff'  : '#374151'
    const borderColor = isMyFlight ? '#185FA5'  : '#E5E7EB'
    const playersHtml = flight.players.map((p, i) => {
      const isMe = `${p.first_name} ${p.surname}` === playerName
      const badge9T = (p as any).holes_played === 9
        ? `<span style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:#FEF3C7;color:#B45309;margin-left:6px;">9T</span>`
        : ''
      return `
        <tr style="border-bottom:1px solid #F3F4F6;">
          <td style="padding:10px 16px;font-size:13px;color:${isMe ? '#185FA5' : '#374151'};font-weight:${isMe ? '600' : '400'};">
            ${i + 1}. ${p.first_name} ${p.surname}${isMe ? ' ← vous' : ''}${badge9T}
          </td>
          <td style="padding:10px 16px;font-size:12px;color:#9CA3AF;text-align:right;">${p.whs !== null ? `WHS ${p.whs}` : ''}</td>
        </tr>`
       }).join('')
     return `<div style="margin-bottom:16px;border:1.5px solid ${borderColor};border-radius:10px;overflow:hidden;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr style="background:${headerBg};">
          <td style="padding:10px 16px;font-size:13px;font-weight:600;color:${headerText};">
            Flight ${flight.flight_number}${isMyFlight ? ' — Votre flight' : ''}
          </td>
          <td style="padding:10px 16px;font-size:14px;font-weight:700;color:${isMyFlight ? '#97C459' : '#185FA5'};text-align:right;">${flight.start_time}</td>
        </tr>
        ${playersHtml}
      </table>
    </div>`
  }).join('')

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>Tee Sheet — ${eventTitle}</title></head>
<body style="margin:0;padding:0;background:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:32px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
<tr><td style="background:#185FA5;border-radius:12px 12px 0 0;padding:24px 32px;">
  <span style="font-size:22px;font-weight:600;color:#ffffff;">Golf</span>
  <span style="font-size:22px;font-weight:600;color:#97C459;">Go</span>
  <span style="float:right;font-size:12px;color:rgba(255,255,255,0.7);font-weight:500;text-transform:uppercase;letter-spacing:1px;line-height:2.2;">Tee Sheet</span>
</td></tr>
<tr><td style="background:#ffffff;padding:32px;">
  <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#111827;">${eventTitle}</h1>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;margin-bottom:24px;">
    <tr><td style="padding:14px 20px;">
      <table cellpadding="0" cellspacing="0">
        <tr><td style="padding:3px 0;font-size:13px;color:#6B7280;width:70px;">📅 Date</td>
            <td style="padding:3px 0;font-size:13px;color:#111827;font-weight:500;">${eventDate}</td></tr>
        ${eventLocation ? `<tr><td style="padding:3px 0;font-size:13px;color:#6B7280;">📍 Lieu</td>
            <td style="padding:3px 0;font-size:13px;color:#111827;font-weight:500;">${eventLocation}</td></tr>` : ''}
      </table>
    </td></tr>
  </table>
  <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">Ordre de départ</p>
  ${flightsHtml}
</td></tr>
<tr><td style="background:#F9FAFB;border:1px solid #E5E7EB;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;">
  <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center;">Organisé avec GolfGo · golfgo.be</p>
</td></tr>
</table></td></tr></table>
</body></html>`
}

// ── Communication HTML ────────────────────────────────────────────────────────
function buildCommHtml({ subject, body, eventTitle }: { subject: string; body: string; eventTitle?: string }) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
<tr><td style="background:#185FA5;border-radius:12px 12px 0 0;padding:20px 32px;">
  <span style="font-size:20px;font-weight:700;color:#ffffff;">Golf</span>
  <span style="font-size:20px;font-weight:700;color:#97C459;">Go</span>
</td></tr>
<tr><td style="background:#ffffff;padding:36px 32px;">
  ${eventTitle ? `<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#185FA5;">${eventTitle}</p>` : ''}
  <div style="font-size:14px;color:#334155;line-height:1.9;">${body.replace(/\n/g, '<br/>')}</div>
</td></tr>
<tr><td style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:14px 32px;">
  <p style="margin:0;font-size:12px;color:#CBD5E1;text-align:center;">Envoyé via GolfGo · golfgo.be</p>
</td></tr>
</table></td></tr></table>
</body></html>`
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { type } = body
    const supabase = await createServerClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // ── Invitation preview ──────────────────────────────────────────────────
    if (type === 'invitation') {
      const { eventId } = body
      const { data: event } = await supabase.from('events')
        .select('id, title, location, starts_at, group_id, email_message').eq('id', eventId).single()
      if (!event) return Response.json({ error: 'Event introuvable' }, { status: 404 })

      const { data: groupData } = await supabase.from('groups')
        .select('template_invitation_subject, template_invitation_body, owner:groups_players(players(first_name, surname))')
        .eq('id', event.group_id).eq('groups_players.role', 'owner').single()

      const ownerPlayer = (groupData?.owner as any)?.[0]?.players
      const ownerName   = ownerPlayer ? `${ownerPlayer.first_name} ${ownerPlayer.surname}` : 'L\'organisateur'

      const eventDate = formatDate(event.starts_at)
      const eventTime = formatTime(event.starts_at)
      const bodyTemplate = groupData?.template_invitation_body ?? "Bonjour {{first_name}},\n\nJ'ai le plaisir de t'inviter à notre prochaine rencontre.\n\nAu plaisir de te revoir,\n{{owner_name}}"

      const vars: Record<string, string> = {
        first_name: 'Prénom', player_name: 'Prénom Nom', player_surname: 'Nom',
        event_title: event.title, event_date: eventDate, event_time: eventTime,
        owner_name: ownerName,
      }

      const resolvedBody = applyVars(event.email_message ?? bodyTemplate, vars)
      const html = buildInvitationHtml({
        eventTitle: event.title, eventDate, eventTime,
        eventLocation: event.location, eventMessage: resolvedBody,
        yes18Link: `${appUrl}/invite/yes?token=PREVIEW&holes=18`,
        yes9Link:  `${appUrl}/invite/yes?token=PREVIEW&holes=9`,
        noLink:    `${appUrl}/invite/no?token=PREVIEW`,
        eventLink: `${appUrl}/groups/${event.group_id}/events/${eventId}`,
      })
      return Response.json({ html, subject: applyVars(groupData?.template_invitation_subject ?? 'Invitation : {{event_title}}', vars) })
    }

    // ── Teesheet preview ────────────────────────────────────────────────────
    if (type === 'teesheet') {
      const { eventId, flights } = body
      const { data: event } = await supabase.from('events')
        .select('title, starts_at, location').eq('id', eventId).single()
      if (!event) return Response.json({ error: 'Event introuvable' }, { status: 404 })

      const eventDate = new Date(event.starts_at).toLocaleDateString('fr-BE', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
      })

      // Aperçu pour le premier flight
      const firstFlight = flights?.[0]
      const previewPlayer = firstFlight?.players?.[0]
      const playerName = previewPlayer ? `${previewPlayer.first_name} ${previewPlayer.surname}` : 'Joueur'

      const html = buildTeesheetHtml({
        playerName, playerFlightNumber: firstFlight?.flight_number ?? 1,
        eventTitle: event.title, eventDate, eventLocation: event.location, flights,
      })
      return Response.json({ html, subject: `Tee Sheet — ${event.title}` })
    }

    // ── Communication preview ───────────────────────────────────────────────
    if (type === 'communication') {
      const { subject, body: commBody, groupId, eventId } = body
      const { data: group } = await supabase.from('groups').select('name').eq('id', groupId).single()

      let eventTitle: string | undefined
      if (eventId) {
        const { data: event } = await supabase.from('events').select('title').eq('id', eventId).single()
        eventTitle = event?.title
      }

      const vars: Record<string, string> = {
        first_name: 'Prénom', surname: 'Nom', player_name: 'Prénom Nom',
        group_name: group?.name ?? 'Mon groupe', owner_name: 'L\'organisateur',
        places_restantes: '5',
      }

      const resolvedSubject = applyVars(subject, vars)
      const resolvedBody    = applyVars(commBody, vars)
        .replace(/{{yes_button}}/g, '<a href="#" style="display:inline-block;background:#16A34A;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px;margin-right:8px;">✓ Oui</a><a href="#" style="display:inline-block;background:#fff;color:#DC2626;text-decoration:none;font-size:14px;font-weight:600;padding:10px 24px;border-radius:8px;border:1.5px solid #DC2626;">✗ Non</a>')

      const html = buildCommHtml({ subject: resolvedSubject, body: resolvedBody, eventTitle })
      return Response.json({ html, subject: resolvedSubject })
    }

    return Response.json({ error: 'Type invalide' }, { status: 400 })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

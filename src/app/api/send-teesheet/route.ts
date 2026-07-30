import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { sleep, EMAIL_SEND_DELAY_MS } from '@/lib/email/rate-limit'
import { buildTeesheetHtml, type TeesheetFlight } from '@/lib/email/buildTeesheetHtml'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true'

export async function POST(req: Request) {
  try {
    const cronSecret = req.headers.get('x-cron-secret')
    const isCron     = cronSecret === process.env.CRON_SECRET

    const { eventId, flights, playerIds } = await req.json() as { 
      eventId: string
      flights: TeesheetFlight[]
      playerIds?: string[]
    }

    if (!eventId || !flights?.length) {
      return Response.json({ success: false, error: 'eventId et flights requis' }, { status: 400 })
    }

    let supabase
    if (isCron) {
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      )
    } else {
      supabase = await createServerClient()
    }

   let participantsQuery = supabase.from('event_participants')
      .select('player_id, players(id, first_name, surname, email)')
      .eq('event_id', eventId).eq('status', 'GOING')

    if (playerIds?.length) {
      participantsQuery = participantsQuery.in('player_id', playerIds)
    }

    const [{ data: event }, { data: participants }] = await Promise.all([
      supabase.from('events')
        .select('title, starts_at, location, group_id')
        .eq('id', eventId).single(),
      participantsQuery,
    ])

    if (!event) return Response.json({ success: false, error: 'Event introuvable' }, { status: 404 })

    // ── Logo du groupe ────────────────────────────────────────────────────
    const { data: groupData } = await supabase
      .from('groups')
      .select('template_logo_url')
      .eq('id', event.group_id)
      .single()
    const logoUrl = groupData?.template_logo_url ?? null

    // ── Opt-out : charger qui a désactivé les emails pour ce groupe ─────────
    const participantIds = (participants || []).map((p: any) => p.player_id)
    const { data: optOuts } = await supabase
      .from('groups_players')
      .select('player_id, email_opt_out')
      .eq('group_id', event.group_id)
      .in('player_id', participantIds)

    const optOutSet = new Set((optOuts || []).filter(o => o.email_opt_out).map(o => o.player_id))

    const eventDate = new Date(event.starts_at).toLocaleDateString('fr-BE', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    })

    let sent = 0, skipped = 0
    const errors: string[] = []

    for (const ep of participants || []) {
      const player = ep.players as any
      if (!player?.email) { skipped++; continue }
      if (optOutSet.has(ep.player_id)) { skipped++; continue }

      const playerName   = `${player.first_name} ${player.surname}`
      const playerFlight = flights.find(f => f.players.some((p: any) => p.id === player.id))
      if (!playerFlight) { skipped++; continue }

      if (!EMAIL_ENABLED) {
        sent++
        continue
      }

      const html = buildTeesheetHtml({
        playerName,
        playerFlightNumber: playerFlight.flight_number,
        eventTitle:    event.title,
        eventDate,
        eventLocation: event.location,
        flights,
        logoUrl,
      })

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const unsubscribeUrl = `${appUrl}/api/unsubscribe?pid=${ep.player_id}&gid=${event.group_id}`

      const { error: emailErr } = await resend.emails.send({
        from:    'GolfGo <noreply@golfgo.be>',
        replyTo: 'info@golfgo.be',
        to:      player.email,
        subject: `Tee Sheet — ${event.title}`,
        html,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      })

      if (emailErr) errors.push(`${playerName}: ${emailErr.message}`)
      else sent++
      await sleep(EMAIL_SEND_DELAY_MS)
    }

    return Response.json({ success: true, sent, skipped, errors })

  } catch (error: any) {
    console.error('TEESHEET EMAIL ERROR:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}
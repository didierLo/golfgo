import { Resend } from 'resend'
import { createServerClient } from '@/lib/supabase/server'
import { buildScorecardHtml, type PrintPlayer } from '@/components/scorecards/buildScorecardHtml'
import { sleep, EMAIL_SEND_DELAY_MS } from '@/lib/email/rate-limit'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true'

type TeeInfo = { id: string; tee_name: string; par_total: number; course_rating: number; slope: number }

function computePhcp(whs: number, tee?: TeeInfo): number {
  if (!tee) return Math.round(whs)
  return Math.round(whs * (tee.slope / 113) + tee.course_rating - tee.par_total)
}

export async function POST(req: Request) {
  try {
    const { eventId } = await req.json() as { eventId: string }
    if (!eventId) return Response.json({ success: false, error: 'eventId requis' }, { status: 400 })

    const supabase = await createServerClient()

    const { data: event } = await supabase.from('events')
      .select('title, starts_at, course_id, group_id, courses(course_name, clubs(name))')
      .eq('id', eventId).single()

    if (!event) return Response.json({ success: false, error: 'Événement introuvable' }, { status: 404 })
    if (!event.course_id) return Response.json({ success: false, error: 'Aucun parcours lié à cet événement' }, { status: 400 })

    const clubName   = (event as any).courses?.clubs?.name ?? ''
    const courseName = (event as any).courses?.course_name ?? ''

    const [{ data: holesData }, { data: teesData }, { data: participants }, { data: groupData }] = await Promise.all([
      supabase.from('course_holes').select('hole_number, par, stroke_index')
        .eq('course_id', event.course_id).order('hole_number'),
      supabase.from('course_tees').select('id, tee_name, par_total, course_rating, slope')
        .eq('course_id', event.course_id),
      supabase.from('event_participants')
        .select('player_id, tee_id, players(id, first_name, surname, whs, email)')
        .eq('event_id', eventId).eq('status', 'GOING'),
      supabase.from('groups').select('template_logo_url').eq('id', event.group_id).single(),
    ])

    const holes = holesData || []
    const logoUrl = groupData?.template_logo_url ?? null

    const participantIds = (participants || []).map((p: any) => p.player_id)
    const { data: optOuts } = await supabase
      .from('groups_players')
      .select('player_id, email_opt_out')
      .eq('group_id', event.group_id)
      .in('player_id', participantIds)
    const optOutSet = new Set((optOuts || []).filter(o => o.email_opt_out).map(o => o.player_id))

    const eventDate = new Date(event.starts_at).toLocaleDateString('fr-BE', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    })

    let sent = 0, skipped = 0
    const errors: string[] = []

    for (const ep of participants || []) {
      const player = (ep as any).players
      if (!player?.email) { skipped++; continue }
      if (optOutSet.has(ep.player_id)) { skipped++; continue }

      const tee = (teesData || []).find((t: any) => t.id === ep.tee_id)
      const printPlayer: PrintPlayer = {
        id: player.id,
        first_name: player.first_name,
        surname: player.surname,
        whs: player.whs ?? 0,
        phcp: computePhcp(player.whs ?? 0, tee),
        tee,
      }

      if (!EMAIL_ENABLED) { sent++; continue }

      const html = buildScorecardHtml([printPlayer], holes, event.title, eventDate, clubName, courseName, logoUrl)

      const { error: emailErr } = await resend.emails.send({
        from:    'GolfGo <noreply@golfgo.be>',
        replyTo: 'info@golfgo.be',
        to:      player.email,
        subject: `Ta carte de score — ${event.title}`,
        html,
      })

      if (emailErr) errors.push(`${player.first_name} ${player.surname}: ${emailErr.message}`)
      else sent++
      await sleep(EMAIL_SEND_DELAY_MS)
    }

    return Response.json({ success: true, sent, skipped, errors })

  } catch (error: any) {
    console.error('SEND SCORECARDS BULK ERROR:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}
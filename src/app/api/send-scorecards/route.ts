import { createServerClient } from '@/lib/supabase/server'
import { buildScorecardHtml, type PrintPlayer } from '@/components/scorecards/buildScorecardHtml'
import { getGroupLocale, serverT, DATE_LOCALE, type Locale } from '@/lib/i18n/server'
import { sleep, EMAIL_SEND_DELAY_MS } from '@/lib/email/rate-limit'
import { sendOrQueueEmail } from '@/lib/email/queueEmail'
import { computePhcp, findDefaultTee } from '@/components/scorecards/scorecard-types'
import { getTeamGroups, type TeamFormat } from '@/lib/golf/scorecards/composeCards'

const EMAIL_ENABLED = process.env.EMAIL_ENABLED === 'true'

type TeeInfo = { id: string; tee_name: string; par_total: number; course_rating: number; slope: number }
type PlayerRow = { first_name: string; surname: string; whs: number | null; default_tee_color: string | null; gender: string | null }

export async function POST(req: Request) {
  try {
    const { eventId } = await req.json() as { eventId: string }
    if (!eventId) return Response.json({ success: false, error: 'eventId requis' }, { status: 400 })

    const supabase = await createServerClient()

    const { data: event } = await supabase.from('events')
      .select('title, starts_at, course_id, group_id, scorecard_notes, hcp_percentage_override, competition_formats(name, team_format, hcp_percentage), courses(course_name, clubs(name))')
      .eq('id', eventId).single()

    if (!event) return Response.json({ success: false, error: 'Événement introuvable' }, { status: 404 })
    if (!event.course_id) return Response.json({ success: false, error: 'Aucun parcours lié à cet événement' }, { status: 400 })

    const gl: Locale = await getGroupLocale(supabase, event.group_id)   // langue du groupe
    const t  = serverT(gl)
    // Mêmes informations que la version imprimée (page « Ma carte de score ») : format, % de handicap, notes de l'organisateur
    const format = (event as any).competition_formats
    const teamFormat: TeamFormat = format?.team_format ?? 'individual'
    const hcpPercentage: number  = (event as any).hcp_percentage_override ?? format?.hcp_percentage ?? 100
    const formatName: string     = format?.name ?? ''
    const scorecardNotes: string = (event as any).scorecard_notes ?? ''
    const clubName   = (event as any).courses?.clubs?.name ?? ''
    const courseName = (event as any).courses?.course_name ?? ''

    const [{ data: holesData }, { data: teesData }, { data: participants }, { data: groupData }, { data: flightsData }] = await Promise.all([
      supabase.from('course_holes').select('hole_number, par, stroke_index')
        .eq('course_id', event.course_id).order('hole_number'),
      supabase.from('course_tees').select('id, tee_name, par_total, course_rating, slope')
        .eq('course_id', event.course_id),
      supabase.from('event_participants')
        .select('player_id, tee_id, players(id, first_name, surname, whs, email, default_tee_color, gender)')
        .eq('event_id', eventId).eq('status', 'GOING'),
      supabase.from('groups').select('template_logo_url').eq('id', event.group_id).single(),
      supabase.from('flights').select('flight_number, flight_players(position, player_id)')
        .eq('event_id', eventId).order('flight_number'),
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

    const eventDate = new Date(event.starts_at).toLocaleDateString(DATE_LOCALE[gl], {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    })

    // ── Construction des joueurs à imprimer : strictement comme la page (tee du participant, sinon tee par défaut) ──
    const byPlayerId = new Map((participants || []).map(p => [p.player_id, p]))
    function toPrintPlayer(playerId: string): PrintPlayer {
      const ep = byPlayerId.get(playerId)
      const pl = ep?.players as unknown as PlayerRow | undefined
      let tee = (teesData || []).find(x => x.id === ep?.tee_id)
      if (!tee && pl?.default_tee_color) tee = findDefaultTee(teesData || [], pl.default_tee_color, pl.gender ?? undefined)
      return {
        id: playerId, first_name: pl?.first_name ?? '', surname: pl?.surname ?? '',
        whs: pl?.whs ?? 0, phcp: computePhcp(pl?.whs ?? 0, tee), tee,
      }
    }
    // Flight de chaque joueur, dans l'ordre des positions (P1..P4) — comme à l'impression
    const flightOf = new Map<string, PrintPlayer[]>()
    for (const f of [...(flightsData || [])].sort((a, b) => a.flight_number - b.flight_number)) {
      const players = (f.flight_players || [])
        .sort((a, b) => a.position - b.position)
        .map(fp => toPrintPlayer(fp.player_id))
      for (const p of players) flightOf.set(p.id, players)
    }

    let sent = 0, skipped = 0, queued = 0
    const errors: string[] = []

    for (const ep of participants || []) {
      const player = (ep as any).players
      if (!player?.email) { skipped++; continue }
      if (optOutSet.has(ep.player_id)) { skipped++; continue }

      // Le joueur reçoit SA carte, telle qu'elle est imprimée pour son flight (équipe, handicap, partenaire à marquer…)
      const flightPlayers = flightOf.get(ep.player_id)
      const cardIndex = flightPlayers
        ? getTeamGroups(flightPlayers, teamFormat).findIndex(g => g.some(p => p.id === ep.player_id))
        : -1
      // Sans flight (ou hors d'une équipe complète) : carte individuelle, comme avant
      const cardPlayers = cardIndex >= 0 && flightPlayers ? flightPlayers : [toPrintPlayer(ep.player_id)]
      const cardFormat: TeamFormat = cardIndex >= 0 ? teamFormat : 'individual'

      if (!EMAIL_ENABLED) { sent++; continue }

      const html = buildScorecardHtml(
        { t, lang: gl }, cardPlayers, holes, event.title, eventDate, clubName, courseName, logoUrl,
        cardFormat, hcpPercentage, formatName, scorecardNotes, cardIndex >= 0 ? cardIndex : undefined,
      )

      const result = await sendOrQueueEmail({
        category: 'scorecard',
        groupId:  event.group_id,
        eventId:  eventId,
        from:     'GolfGo <noreply@golfgo.be>',
        replyTo:  'info@golfgo.be',
        to:       player.email,
        subject:  t('email.scorecard.subject', { title: event.title }),
        html,
      })

      if (!result.sent && !result.queued) errors.push(`${player.first_name} ${player.surname}: ${result.error}`)
      else if (result.sent) sent++
      else queued++
      await sleep(EMAIL_SEND_DELAY_MS)
    }

    return Response.json({ success: true, sent, skipped, queued, errors })

  } catch (error: any) {
    console.error('SEND SCORECARDS BULK ERROR:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}
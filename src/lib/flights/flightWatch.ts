// Surveillance « participants OUI ↔ flights » (côté serveur uniquement).
//
// Règle : pour un événement qui a des flights,
//   • MISSING      : joueur « OUI » présent dans AUCUN flight
//   • STALE        : joueur dans un flight sans être « OUI » (le retrait automatique de la base l'empêche,
//                    mais on le contrôle quand même : flights générés à l'ancienne, script pas encore installé…)
//   • DUPLICATE    : joueur dans plusieurs flights
//   • EMPTY_FLIGHT : flight sans aucun joueur
//
// Principe « pas de notification si rien n'a changé » : on mémorise, par événement, l'empreinte des écarts déjà
// signalés (table flight_issue_alerts). Une alerte n'est envoyée que si cette empreinte CHANGE
// (ou s'il y a des retraits automatiques non encore signalés).

import { createHash } from 'crypto'
import webpush from 'web-push'
import { sendOrQueueEmail } from '@/lib/email/queueEmail'
import { buildEmailLogoHeader } from '@/lib/email/logo'
import { getGroupLocale, serverT, DATE_LOCALE, type ServerT } from '@/lib/i18n/server'

export type IssueKind = 'MISSING' | 'STALE' | 'DUPLICATE' | 'EMPTY_FLIGHT'
export type FlightIssue = {
  kind: IssueKind
  playerId?: string
  name?: string
  flights?: number[]      // numéros de flights concernés
  status?: string
}
export type Removal = { id: string; player_id: string; flight_number: number | null; reason: string; name?: string }
export type Phase = 'watch' | 'teesheet_sent'
export type WatchResult = 'no_flights' | 'clean' | 'unchanged' | 'sent' | 'not_sent'

export const WATCH_DAYS_AHEAD = 14

// ── Détection ────────────────────────────────────────────────────────────────────────────────
export async function detectFlightIssues(supabase: any, eventId: string): Promise<{ hasFlights: boolean; issues: FlightIssue[] }> {
  const { data: flights } = await supabase.from('flights').select('id, flight_number').eq('event_id', eventId)
  if (!flights?.length) return { hasFlights: false, issues: [] }

  const flightIds = flights.map((f: any) => f.id)
  const numberOf = new Map<string, number>(flights.map((f: any) => [f.id, f.flight_number]))
  const [{ data: fps }, { data: parts }] = await Promise.all([
    supabase.from('flight_players').select('flight_id, player_id').in('flight_id', flightIds),
    supabase.from('event_participants').select('player_id, status').eq('event_id', eventId),
  ])

  const statusOf = new Map<string, string>((parts ?? []).map((p: any) => [p.player_id, String(p.status)]))
  const flightsOf = new Map<string, number[]>()
  for (const fp of fps ?? []) {
    const arr = flightsOf.get(fp.player_id) ?? []
    arr.push(numberOf.get(fp.flight_id) as number)
    flightsOf.set(fp.player_id, arr)
  }

  // noms (participants + joueurs présents dans un flight)
  const ids = [...new Set<string>([...statusOf.keys(), ...flightsOf.keys()])]
  const nameOf = new Map<string, string>()
  if (ids.length) {
    const { data: players } = await supabase.from('players').select('id, first_name, surname').in('id', ids)
    for (const p of players ?? []) nameOf.set(p.id, `${p.first_name} ${p.surname}`.trim())
  }

  const issues: FlightIssue[] = []
  for (const [pid, st] of statusOf) {
    if (st === 'GOING' && !flightsOf.has(pid)) issues.push({ kind: 'MISSING', playerId: pid, name: nameOf.get(pid) ?? '?', status: st })
  }
  for (const [pid, nums] of flightsOf) {
    const st = statusOf.get(pid)
    if (st !== 'GOING') issues.push({ kind: 'STALE', playerId: pid, name: nameOf.get(pid) ?? '?', flights: [...new Set(nums)].sort((a, b) => a - b), status: st ?? '(deleted)' })
    if (nums.length > 1) issues.push({ kind: 'DUPLICATE', playerId: pid, name: nameOf.get(pid) ?? '?', flights: [...nums].sort((a, b) => a - b) })
  }
  const withPlayers = new Set((fps ?? []).map((fp: any) => fp.flight_id))
  for (const f of flights) if (!withPlayers.has(f.id)) issues.push({ kind: 'EMPTY_FLIGHT', flights: [f.flight_number] })

  return { hasFlights: true, issues }
}

// Empreinte stable de la liste des écarts (l'ordre ne compte pas)
export function signatureOf(issues: FlightIssue[]): string {
  const parts = issues.map(i => [i.kind, i.playerId ?? '', (i.flights ?? []).join(','), i.status ?? ''].join('|')).sort()
  return createHash('sha1').update(parts.join('\n')).digest('hex')
}

// ── Textes ───────────────────────────────────────────────────────────────────────────────────
export function issueLines(t: ServerT, issues: FlightIssue[], removals: Removal[]): string[] {
  const lines: string[] = []
  for (const r of removals) lines.push(t('flightWatch.lineRemoved', { name: r.name ?? t('pushNotif.unknownPlayer'), flight: r.flight_number ?? '?' }))
  const order: IssueKind[] = ['MISSING', 'STALE', 'DUPLICATE', 'EMPTY_FLIGHT']
  for (const kind of order) {
    for (const i of issues.filter(x => x.kind === kind)) {
      const flights = (i.flights ?? []).join(', ')
      if (kind === 'MISSING')      lines.push(t('flightWatch.lineMissing',   { name: i.name ?? '?' }))
      if (kind === 'STALE')        lines.push(t('flightWatch.lineStale',     { name: i.name ?? '?', flights }))
      if (kind === 'DUPLICATE')    lines.push(t('flightWatch.lineDuplicate', { name: i.name ?? '?', flights }))
      if (kind === 'EMPTY_FLIGHT') lines.push(t('flightWatch.lineEmpty',     { flight: flights }))
    }
  }
  return lines
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildFlightWatchHtml(o: {
  t: ServerT; lang: string; ownerFirstName: string; eventTitle: string; eventDate: string
  lines: string[]; introKey: 'flightWatch.emailIntro' | 'flightWatch.emailIntroRemoved'
  teesheetSent: boolean; url: string; logoUrl: string | null
}): string {
  const { t } = o
  const items = o.lines.map(l => `<li style="margin:0 0 8px;">${escapeHtml(l)}</li>`).join('')
  return `
<!DOCTYPE html>
<html lang="${o.lang}">
<head><meta charset="UTF-8"/><title>${escapeHtml(t('flightWatch.emailSubject', { title: o.eventTitle }))}</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="background:#185FA5;border-radius:12px 12px 0 0;padding:20px 32px;vertical-align:middle;">
            ${buildEmailLogoHeader(o.logoUrl)}
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:36px 32px;">
            <p style="margin:0 0 6px;font-size:14px;color:#64748B;">${t('email.common.greeting', { name: o.ownerFirstName })}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF9C3;border:1px solid #CA8A04;border-radius:10px;margin:12px 0 20px;">
              <tr><td style="padding:16px 20px;">
                <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#92400E;">${escapeHtml(o.eventTitle)}</p>
                <p style="margin:0;font-size:13px;color:#B45309;">${escapeHtml(o.eventDate)}</p>
              </td></tr>
            </table>
            <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.7;">${escapeHtml(t(o.introKey, { title: o.eventTitle }))}</p>
            <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;color:#0F172A;line-height:1.6;">${items}</ul>
            ${o.teesheetSent ? `<p style="margin:0 0 20px;font-size:13px;color:#B45309;font-weight:600;">${escapeHtml(t('flightWatch.emailTeesheetSent'))}</p>` : ''}
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="${o.url}" style="display:inline-block;background:#185FA5;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">
                  ${escapeHtml(t('flightWatch.emailCta'))}
                </a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;padding:14px 32px;">
            <p style="margin:0;font-size:12px;color:#94A3B8;text-align:center;">${escapeHtml(t('flightWatch.emailFooter'))}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Envoi (injectable pour les tests) ─────────────────────────────────────────────────────────
export type Deps = {
  sendEmail: (p: Parameters<typeof sendOrQueueEmail>[0]) => Promise<{ sent?: boolean; queued?: boolean; error?: any }>
  sendPush: (supabase: any, userId: string, payload: { title: string; body: string; url: string }) => Promise<number>
  emailEnabled: () => boolean
  now: () => Date
}

let vapidReady = false
export async function sendPushToUser(supabase: any, userId: string, payload: { title: string; body: string; url: string }): Promise<number> {
  const { data: subs } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId)
  if (!subs?.length) return 0
  if (!vapidReady) {
    webpush.setVapidDetails('mailto:info@golfgo.be', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
    vapidReady = true
  }
  let sent = 0
  const stale: string[] = []
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload))
      sent++
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) stale.push(sub.id)
    }
  }
  if (stale.length) await supabase.from('push_subscriptions').delete().in('id', stale)
  return sent
}

const defaultDeps: Deps = {
  sendEmail: sendOrQueueEmail as any,
  sendPush: sendPushToUser,
  emailEnabled: () => process.env.EMAIL_ENABLED === 'true',
  now: () => new Date(),
}

// ── Organisateur du groupe ───────────────────────────────────────────────────────────────────
async function resolveOwner(supabase: any, groupId: string) {
  const [{ data: group }, { data: gp }] = await Promise.all([
    supabase.from('groups').select('owner_id, template_logo_url').eq('id', groupId).maybeSingle(),
    supabase.from('groups_players').select('role, players(first_name, email)').eq('group_id', groupId).eq('role', 'owner'),
  ])
  const row = (gp ?? [])[0]
  const p = Array.isArray(row?.players) ? row.players[0] : row?.players
  return { userId: group?.owner_id as string | undefined, logoUrl: (group?.template_logo_url ?? null) as string | null, email: p?.email as string | undefined, firstName: (p?.first_name ?? '') as string }
}

// ── Retraits automatiques à signaler ─────────────────────────────────────────────────────────
export async function fetchPendingRemovals(supabase: any, eventId: string, playerId?: string): Promise<Removal[]> {
  let q = supabase.from('flight_removal_log').select('id, player_id, flight_number, reason').eq('event_id', eventId).is('notified_at', null)
  if (playerId) q = q.eq('player_id', playerId)
  const { data } = await q
  const rows: Removal[] = data ?? []
  const ids = [...new Set(rows.map(r => r.player_id))]
  if (ids.length) {
    const { data: players } = await supabase.from('players').select('id, first_name, surname').in('id', ids)
    const names = new Map<string, string>((players ?? []).map((p: any) => [p.id, `${p.first_name} ${p.surname}`.trim()]))
    for (const r of rows) r.name = names.get(r.player_id)
  }
  return rows
}
export async function markRemovalsNotified(supabase: any, removals: Removal[], now = new Date()) {
  if (!removals.length) return
  await supabase.from('flight_removal_log').update({ notified_at: now.toISOString() }).in('id', removals.map(r => r.id))
}

// ── Contrôle d'UN événement + alerte si la situation a changé ────────────────────────────────
export async function checkEventFlights(
  supabase: any, eventId: string, opts: { phase: Phase } = { phase: 'watch' }, depsIn: Partial<Deps> = {},
): Promise<WatchResult> {
  const deps: Deps = { ...defaultDeps, ...depsIn }
  const { data: event } = await supabase.from('events').select('id, title, starts_at, group_id').eq('id', eventId).maybeSingle()
  if (!event) return 'no_flights'

  const { hasFlights, issues } = await detectFlightIssues(supabase, eventId)
  const removals = await fetchPendingRemovals(supabase, eventId)

  if (!hasFlights) {                      // pas (ou plus) de flights : rien à surveiller, on purge la mémoire
    await supabase.from('flight_issue_alerts').delete().eq('event_id', eventId)
    await markRemovalsNotified(supabase, removals, deps.now())
    return 'no_flights'
  }

  const { data: alertRow } = await supabase.from('flight_issue_alerts').select('signature, teesheet_notified').eq('event_id', eventId).maybeSingle()
  const sig = signatureOf(issues)
  const hasIssues = issues.length > 0
  const changed = hasIssues && alertRow?.signature !== sig
  const teesheetNews = opts.phase === 'teesheet_sent' && hasIssues && !alertRow?.teesheet_notified

  if (!hasIssues && alertRow) await supabase.from('flight_issue_alerts').delete().eq('event_id', eventId)   // tout est rentré dans l'ordre : on réarme
  if (!changed && !teesheetNews && removals.length === 0) return hasIssues ? 'unchanged' : 'clean'

  // ── il y a du nouveau : on prévient l'organisateur ──
  const gl = await getGroupLocale(supabase, event.group_id)
  const t = serverT(gl)
  const dl = DATE_LOCALE[gl]
  const owner = await resolveOwner(supabase, event.group_id)
  const lines = issueLines(t, issues, removals)
  const url = `/${gl}/groups/${event.group_id}/events/${event.id}/flights`
  const first = lines[0] ?? ''
  const body = lines.length > 1 ? t('flightWatch.pushMore', { first, count: lines.length - 1 }) : first

  let delivered = 0
  if (owner.userId) delivered += await deps.sendPush(supabase, owner.userId, { title: t('pushNotif.reviewTitle', { title: event.title }), body, url })
  if (owner.email && deps.emailEnabled()) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await deps.sendEmail({
      category: 'other', groupId: event.group_id, eventId: event.id, from: 'GolfGo <info@golfgo.be>', to: owner.email,
      subject: t('flightWatch.emailSubject', { title: event.title }),
      html: buildFlightWatchHtml({
        t, lang: gl, ownerFirstName: owner.firstName, eventTitle: event.title,
        eventDate: new Date(event.starts_at).toLocaleDateString(dl, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
        lines, introKey: hasIssues ? 'flightWatch.emailIntro' : 'flightWatch.emailIntroRemoved',
        teesheetSent: opts.phase === 'teesheet_sent' && hasIssues, url: `${appUrl}${url}`, logoUrl: owner.logoUrl,
      }),
    })
    if (res.sent || res.queued) delivered++
  }
  if (delivered === 0) return 'not_sent'   // rien n'est parti : on NE mémorise PAS, on réessaiera au prochain passage

  await markRemovalsNotified(supabase, removals, deps.now())
  if (hasIssues) {
    await supabase.from('flight_issue_alerts').upsert({
      event_id: eventId, signature: sig,
      teesheet_notified: Boolean(alertRow?.teesheet_notified) || opts.phase === 'teesheet_sent',
      notified_at: deps.now().toISOString(),
    })
  }
  return 'sent'
}

// ── Passage complet (appelé chaque matin par le cron) ────────────────────────────────────────
export async function runFlightWatch(
  supabase: any, opts: { teesheetSentEventIds?: Set<string>; daysAhead?: number } = {}, depsIn: Partial<Deps> = {},
): Promise<Record<string, number>> {
  const deps: Deps = { ...defaultDeps, ...depsIn }
  const now = deps.now()
  const until = new Date(now.getTime() + (opts.daysAhead ?? WATCH_DAYS_AHEAD) * 86400000)
  const stats: Record<string, number> = { checked: 0, sent: 0, unchanged: 0, clean: 0, no_flights: 0, not_sent: 0, errors: 0 }

  const { data: events } = await supabase.from('events').select('id, is_golf, starts_at')
    .gte('starts_at', now.toISOString()).lte('starts_at', until.toISOString())
  for (const e of (events ?? []).filter((x: any) => (x.is_golf ?? true) !== false)) {
    try {
      const r = await checkEventFlights(supabase, e.id, { phase: opts.teesheetSentEventIds?.has(e.id) ? 'teesheet_sent' : 'watch' }, deps)
      stats.checked++; stats[r]++
    } catch (err) { stats.errors++; console.error('[flight-watch]', e.id, err) }
  }

  // ménage : mémoire d'alertes d'événements passés/supprimés, vieux journaux
  try {
    const { data: rows } = await supabase.from('flight_issue_alerts').select('event_id')
    if (rows?.length) {
      const ids = rows.map((r: any) => r.event_id)
      const { data: live } = await supabase.from('events').select('id, starts_at').in('id', ids).gte('starts_at', now.toISOString())
      const keep = new Set((live ?? []).map((x: any) => x.id))
      const drop = ids.filter((id: string) => !keep.has(id))
      if (drop.length) await supabase.from('flight_issue_alerts').delete().in('event_id', drop)
    }
    await supabase.from('flight_removal_log').delete().lt('created_at', new Date(now.getTime() - 60 * 86400000).toISOString())
  } catch (err) { console.error('[flight-watch] ménage', err) }
  return stats
}

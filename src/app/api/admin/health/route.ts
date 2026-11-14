import { createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL
  if (!user?.email || !adminEmail || user.email.toLowerCase() !== adminEmail.toLowerCase()) {
    return false
  }
  return true
}

// Traduit le vocabulaire Sentry en langage simple
function friendlyLevel(level: string): string {
  const map: Record<string, string> = {
    error: 'Erreur', warning: 'Avertissement', info: 'Info', fatal: 'Critique',
  }
  return map[level] ?? level
}

async function trySentryHost(host: string, token: string) {
  const res = await fetch(
    `https://${host}/api/0/projects/golfgo/javascript-nextjs/issues/?query=is:unresolved&limit=5&sort=freq`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  return res
}

async function fetchSentrySummary() {
  const token = process.env.SENTRY_HEALTH_API_TOKEN
  if (!token) return { available: false, reason: 'Jeton Sentry non configuré' }

  try {
    // Certaines organisations Sentry stockent leurs données en Europe, ce qui
    // change l'hôte d'API attendu — on essaie les deux plutôt que de deviner.
    let res = await trySentryHost('sentry.io', token)
    if (res.status === 401 || res.status === 404) {
      res = await trySentryHost('de.sentry.io', token)
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { available: false, reason: `Sentry a répondu ${res.status} — ${body.slice(0, 200)}` }
    }

    const issues = await res.json() as any[]
    return {
      available: true,
      unresolvedCount: issues.length,
      issues: issues.map(i => ({
        title:     i.title,
        level:     friendlyLevel(i.level),
        count:     Number(i.count ?? 0),
        lastSeen:  i.lastSeen,
        url:       `https://golfgo.sentry.io/issues/${i.id}/`,
      })),
    }
  } catch (err: any) {
    return { available: false, reason: err.message ?? 'Erreur inattendue' }
  }
}

// Ajoute à chaque email de la file le nom du joueur, son adresse ACTUELLE, le groupe et l'événement :
// l'administrateur voit ainsi tout de suite si l'adresse a déjà été corrigée dans la fiche du joueur.
async function enrichEmailRows(rows: any[]) {
  const ids = (k: string) => [...new Set(rows.map(r => r[k]).filter(Boolean))] as string[]
  const [pIds, gIds, eIds] = [ids('player_id'), ids('group_id'), ids('event_id')]
  const [{ data: players }, { data: groups }, { data: events }] = await Promise.all([
    pIds.length ? supabaseAdmin.from('players').select('id, first_name, surname, email').in('id', pIds) : Promise.resolve({ data: [] as any[] }),
    gIds.length ? supabaseAdmin.from('groups').select('id, name').in('id', gIds) : Promise.resolve({ data: [] as any[] }),
    eIds.length ? supabaseAdmin.from('events').select('id, title, starts_at').in('id', eIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const pBy = new Map((players ?? []).map((p: any) => [p.id, p]))
  const gBy = new Map((groups ?? []).map((g: any) => [g.id, g]))
  const eBy = new Map((events ?? []).map((e: any) => [e.id, e]))
  return rows.map(r => {
    const p = r.player_id ? pBy.get(r.player_id) as any : null
    const e = r.event_id ? eBy.get(r.event_id) as any : null
    return {
      ...r,
      player: p ? { name: `${p.first_name} ${p.surname}`, currentEmail: p.email ?? null } : null,
      group_name: r.group_id ? (gBy.get(r.group_id) as any)?.name ?? null : null,
      event: e ? { title: e.title, starts_at: e.starts_at } : null,
    }
  })
}

export async function GET() {
  if (!(await requireAdmin())) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const [
    { data: pendingEmails },
    { data: failedEmails },
    { count: pendingCount },
    { count: failedCount },
    { data: dmarcLog },
    { data: backupLog },
    sentry,
  ] = await Promise.all([
    supabaseAdmin.from('email_queue').select('id, status, category, group_id, event_id, player_id, to_email, subject, last_error, attempts, created_at, sent_at').eq('status', 'pending').order('created_at', { ascending: true }).limit(50),
    supabaseAdmin.from('email_queue').select('id, status, category, group_id, event_id, player_id, to_email, subject, last_error, attempts, created_at, sent_at').is('resolved_at', null).eq('status', 'failed').order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('email_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('email_queue').select('*', { count: 'exact', head: true }).is('resolved_at', null).eq('status', 'failed'),
    supabaseAdmin.from('system_health_log').select('*').eq('job', 'dmarc-report').order('run_at', { ascending: false }).limit(1),
    supabaseAdmin.from('system_health_log').select('run_at, summary').eq('job', 'backup').order('run_at', { ascending: false }).limit(10),
    fetchSentrySummary(),
  ])

  // Dernière tentative (réussie ou non) + dernière sauvegarde réussie
  const lastAttempt = backupLog?.[0] ?? null
  const lastOk      = backupLog?.find(r => r.summary?.ok === true) ?? null

  return Response.json({
    emailQueue: {
      pending: await enrichEmailRows(pendingEmails ?? []),
      failed:  await enrichEmailRows(failedEmails ?? []),
      counts:  { pending: pendingCount ?? 0, failed: failedCount ?? 0 },
    },
    dmarc: dmarcLog?.[0] ?? null,
    backup: { lastOk, lastAttempt },
    sentry,
  })
}
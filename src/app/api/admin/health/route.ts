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

async function fetchSentrySummary() {
  const token = process.env.SENTRY_HEALTH_API_TOKEN
  if (!token) return { available: false, reason: 'Jeton Sentry non configuré' }

  try {
    const res = await fetch(
      'https://sentry.io/api/0/projects/golfgo/javascript-nextjs/issues/?query=is:unresolved&statsPeriod=7d&limit=5&sort=freq',
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) return { available: false, reason: `Sentry a répondu ${res.status}` }

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
    sentry,
  ] = await Promise.all([
    supabaseAdmin.from('email_queue').select('*').eq('status', 'pending').order('created_at', { ascending: true }).limit(50),
    supabaseAdmin.from('email_queue').select('*').eq('status', 'failed').order('created_at', { ascending: false }).limit(50),
    supabaseAdmin.from('email_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('email_queue').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
    supabaseAdmin.from('system_health_log').select('*').eq('job', 'dmarc-report').order('run_at', { ascending: false }).limit(1),
    fetchSentrySummary(),
  ])

  return Response.json({
    emailQueue: {
      pending: pendingEmails ?? [],
      failed:  failedEmails ?? [],
      counts:  { pending: pendingCount ?? 0, failed: failedCount ?? 0 },
    },
    dmarc: dmarcLog?.[0] ?? null,
    sentry,
  })
}
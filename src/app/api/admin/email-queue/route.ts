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

export async function GET() {
  if (!(await requireAdmin())) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const [{ data: pending }, { data: failed }, { data: recentSent }, { count: pendingCount }, { count: failedCount }] = await Promise.all([
    supabaseAdmin.from('email_queue').select('*').eq('status', 'pending').order('created_at', { ascending: true }).limit(200),
    supabaseAdmin.from('email_queue').select('*').eq('status', 'failed').order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('email_queue').select('*').eq('status', 'sent').order('sent_at', { ascending: false }).limit(50),
    supabaseAdmin.from('email_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('email_queue').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
  ])

  return Response.json({
    pending: pending ?? [],
    failed: failed ?? [],
    recentSent: recentSent ?? [],
    counts: { pending: pendingCount ?? 0, failed: failedCount ?? 0 },
  })
}

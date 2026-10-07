import { createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { runBackup } from '@/lib/backup/runBackup'

export const runtime = 'nodejs'
export const maxDuration = 60

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL
  if (!user?.email || !adminEmail || user.email.toLowerCase() !== adminEmail.toLowerCase()) {
    return false
  }
  return true
}

// Bouton « Sauvegarder maintenant » de la page Santé du système.
export async function POST() {
  if (!(await requireAdmin())) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

  const result = await runBackup(supabaseAdmin, { force: true, trigger: 'manual' })
  return Response.json(result, { status: result.ok ? 200 : 500 })
}

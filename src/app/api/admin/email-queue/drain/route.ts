import { createServerClient } from '@/lib/supabase/server'
import { drainEmailQueue } from '@/lib/email/queueEmail'

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL
  if (!user?.email || !adminEmail || user.email.toLowerCase() !== adminEmail.toLowerCase()) {
    return false
  }
  return true
}

export async function POST() {
  if (!(await requireAdmin())) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const result = await drainEmailQueue(80)
  return Response.json(result)
}

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

// Supprime un email de la file (ou tous ceux « en échec » / « en attente »).
// On ne touche JAMAIS aux emails déjà envoyés : ils restent comme historique.
export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id, scope } = await req.json() as { id?: string; scope?: 'failed' | 'pending' }

  let query = supabaseAdmin.from('email_queue').delete()
  if (id) {
    query = query.eq('id', id).in('status', ['failed', 'pending'])
  } else if (scope === 'failed' || scope === 'pending') {
    query = query.eq('status', scope)
  } else {
    return Response.json({ error: 'id ou scope requis' }, { status: 400 })
  }

  const { data, error } = await query.select('id')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, deleted: data?.length ?? 0 })
}

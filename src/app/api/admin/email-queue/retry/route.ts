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

export async function POST(req: Request) {
  if (!(await requireAdmin())) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id, to_email } = await req.json() as { id: string; to_email?: string }
  if (!id) return Response.json({ error: 'id requis' }, { status: 400 })

  const update: Record<string, any> = { status: 'pending', attempts: 0, last_error: null }

  if (to_email !== undefined) {
    const trimmed = to_email.trim()
    // Validation basique — le vrai contrôle se fait de toute façon côté Resend à l'envoi,
    // ceci évite juste de remettre en file une adresse manifestement encore invalide.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return Response.json({ error: 'Adresse email invalide' }, { status: 400 })
    }
    update.to_email = trimmed
  }

  const { data, error } = await supabaseAdmin.from('email_queue')
    .update(update)
    .eq('id', id)
    .select('id')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!data || data.length === 0) {
    return Response.json({ error: "Aucune ligne mise à jour — id introuvable" }, { status: 404 })
  }
  return Response.json({ ok: true })
}

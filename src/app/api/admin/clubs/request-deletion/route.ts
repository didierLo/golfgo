import { createServerClient } from '@/lib/supabase/server'
import { sendOrQueueEmail } from '@/lib/email/queueEmail'

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL
  if (!user?.email || !adminEmail || user.email.toLowerCase() !== adminEmail.toLowerCase()) {
    return null
  }
  return user.email
}

export async function POST(req: Request) {
  const requesterEmail = await requireAdmin()
  if (!requesterEmail) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { type, id, name, clubName, usageNote } = await req.json() as {
    type: 'club' | 'course'; id: string; name: string; clubName?: string; usageNote?: string
  }
  if (!type || !id || !name) {
    return Response.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  const label = type === 'club' ? 'un club' : 'un parcours'
  const subject = `Demande de suppression — ${type === 'club' ? 'Club' : 'Parcours'} : ${name}`
  const html = `
    <p>${requesterEmail} a demandé la suppression de ${label} dans golfgo :</p>
    <ul>
      <li><strong>Type :</strong> ${type === 'club' ? 'Club' : 'Parcours'}</li>
      <li><strong>Nom :</strong> ${name}</li>
      ${clubName ? `<li><strong>Club :</strong> ${clubName}</li>` : ''}
      <li><strong>ID :</strong> ${id}</li>
    </ul>
    ${usageNote ? `<p>⚠️ ${usageNote}</p>` : ''}
    <p>Cette suppression n'est pas automatique — elle doit être traitée manuellement dans Supabase.</p>
  `

  const result = await sendOrQueueEmail({
    category: 'other',
    from:    'GolfGo <noreply@golfgo.be>',
    replyTo: requesterEmail,
    to:      'info@golfgo.be',
    subject,
    html,
  })

  if (!result.sent && !result.queued) {
    return Response.json({ error: result.error }, { status: 500 })
  }
  return Response.json({ ok: true })
}

import { requireGroupOwner } from '@/lib/groups/requireOwner'
import { listGroupEmailFailures, resolveGroupEmailFailure } from '@/lib/email/emailFailures'

// Échecs d'envoi d'emails de CE groupe, réservés à ses organisateurs.

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await ctx.params
  const auth = await requireGroupOwner(groupId)
  if (!auth.ok) return Response.json({ error: 'Unauthorized' }, { status: auth.status })
  return Response.json({ failures: await listGroupEmailFailures(auth.admin, groupId) })
}

// Marque un échec comme traité (renvoyé ou ignoré) : il disparaît de la liste.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await ctx.params
  const auth = await requireGroupOwner(groupId)
  if (!auth.ok) return Response.json({ error: 'Unauthorized' }, { status: auth.status })
  const { id } = await req.json().catch(() => ({})) as { id?: string }
  if (!id) return Response.json({ error: 'id requis' }, { status: 400 })
  const done = await resolveGroupEmailFailure(auth.admin, groupId, id)
  if (!done) return Response.json({ error: 'Introuvable dans ce groupe' }, { status: 404 })
  return Response.json({ ok: true })
}

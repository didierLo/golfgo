import { createServerClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const adminEmail = process.env.ADMIN_EMAIL
  if (!user?.email || !adminEmail || user.email.toLowerCase() !== adminEmail.toLowerCase()) {
    return false
  }
  return true
}

// FlyAway identifie chaque parcours par un "slug" lisible (ex: "royal-waterloo-golf-club").
// Comme l'API publique n'offre pas de recherche par nom, on déduit le slug à partir du nom
// tapé — ça marche directement pour un nom exact, et sinon la page renvoie une 404 claire.
function slugify(input: string): string {
  return input
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // enlève les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return Response.json({ error: 'Recherche trop courte (2 caractères min.)' }, { status: 400 })
  }

  const slug = slugify(q)

  try {
    const res = await fetch(`https://api.flyawaygolf.com/v2/golfs/profile/${slug}`)
    if (res.status === 404) {
      return Response.json({ error: `Aucun parcours trouvé pour « ${q} » (essayé comme « ${slug} »). Vérifie l'orthographe exacte, ou cherche le nom exact sur flyawaygolf.com/golfs.` }, { status: 404 })
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return Response.json({ error: `FlyAway a répondu ${res.status} : ${text.slice(0, 200)}` }, { status: 502 })
    }
    const json = await res.json()
    return Response.json({ course: json.data })
  } catch (e: any) {
    return Response.json({ error: e.message ?? 'Erreur réseau' }, { status: 500 })
  }
}

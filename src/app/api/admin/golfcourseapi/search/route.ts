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

export async function GET(req: Request) {
  if (!(await requireAdmin())) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return Response.json({ error: 'Recherche trop courte (2 caractères min.)' }, { status: 400 })
  }

  const apiKey = process.env.GOLFCOURSEAPI_KEY
  if (!apiKey) {
    return Response.json({ error: "GOLFCOURSEAPI_KEY n'est pas configurée" }, { status: 500 })
  }

  try {
    const res = await fetch(`https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return Response.json({ error: `GolfCourseAPI a répondu ${res.status} : ${text.slice(0, 200)}` }, { status: 502 })
    }
    const data = await res.json()
    return Response.json({ courses: data.courses ?? [] })
  } catch (e: any) {
    return Response.json({ error: e.message ?? 'Erreur réseau' }, { status: 500 })
  }
}

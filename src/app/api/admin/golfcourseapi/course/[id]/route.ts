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

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params
  const apiKey = process.env.GOLFCOURSEAPI_KEY
  if (!apiKey) {
    return Response.json({ error: "GOLFCOURSEAPI_KEY n'est pas configurée" }, { status: 500 })
  }

  try {
    const res = await fetch(`https://api.golfcourseapi.com/v1/courses/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return Response.json({ error: `GolfCourseAPI a répondu ${res.status} : ${text.slice(0, 200)}` }, { status: 502 })
    }
    const data = await res.json()
    // On renvoie tel quel — la page qui appelle cette route sait gérer
    // l'absence de certains champs (tout n'est pas garanti rempli côté GolfCourseAPI).
    return Response.json(data)
  } catch (e: any) {
    return Response.json({ error: e.message ?? 'Erreur réseau' }, { status: 500 })
  }
}

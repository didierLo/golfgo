import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { endpoint, p256dh, auth } = await req.json() as { endpoint: string; p256dh: string; auth: string }
    if (!endpoint || !p256dh || !auth) {
      return Response.json({ success: false, error: 'Paramètres manquants' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      return Response.json({ success: false, error: 'Non authentifié' }, { status: 401 })
    }

    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: session.user.id,
      endpoint,
      p256dh,
      auth,
    }, { onConflict: 'endpoint' })

    if (error) return Response.json({ success: false, error: error.message }, { status: 500 })

    return Response.json({ success: true })

  } catch (error: any) {
    console.error('PUSH SUBSCRIBE ERROR:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}

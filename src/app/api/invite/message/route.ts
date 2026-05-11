// app/api/invite/message/route.ts
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { token, message } = await req.json()

    if (!token || !message?.trim()) {
      return Response.json({ success: false, error: 'Paramètres manquants' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Retrouver le participant via son invite_token
    const { data: participant, error: findErr } = await supabase
      .from('event_participants')
      .select('player_id, event_id')
      .eq('invite_token', token)
      .single()

    if (findErr || !participant) {
      return Response.json({ success: false, error: 'Token invalide' }, { status: 404 })
    }

    // Sauvegarder le message (max 300 chars)
    const { error: updateErr } = await supabase
      .from('event_participants')
      .update({ response_message: message.slice(0, 300) })
      .eq('invite_token', token)

    if (updateErr) {
      return Response.json({ success: false, error: updateErr.message }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 })
  }
}

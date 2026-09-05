// app/api/invite/message/route.ts
import { createServerClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { token, message } = await req.json()

    if (!token || !message?.trim()) {
      return Response.json({ success: false, error: 'Paramètres manquants' }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Retrouver le participant via son invite_token — via RPC SECURITY DEFINER,
    // l'accès direct à la table est bloqué par RLS pour un visiteur anonyme
    // non connecté (cf. rsvp_get_participant, même famille que invite/yes et invite/no).
    const { data: rows, error: findErr } = await supabase
      .rpc('rsvp_get_participant', { p_token: token })

    const participant = rows?.[0] ?? null

    if (findErr || !participant?.event_id) {
      return Response.json({ success: false, error: 'Token invalide' }, { status: 404 })
    }

    // Sauvegarder le message (max 300 chars)
    const { error: updateErr } = await supabase
      .rpc('rsvp_set_message', { p_token: token, p_message: message.slice(0, 300) })

    if (updateErr) {
      return Response.json({ success: false, error: updateErr.message }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 })
  }
}

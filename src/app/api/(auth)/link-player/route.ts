import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  const supabase = await createServerClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user?.email) {
    return NextResponse.json({ linked: false, reason: 'no_user' }, { status: 401 })
  }

  const userEmail = user.email.toLowerCase()

  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('id, user_id')
    .ilike('email', userEmail)
    .maybeSingle()

  if (playerError) {
    console.error('[link-player] players lookup error:', playerError)
    return NextResponse.json({ linked: false, reason: 'lookup_error' }, { status: 500 })
  }

  if (!player) {
    // Pas de fiche joueur pour cet email — rien à lier (premier signup sans invitation)
    return NextResponse.json({ linked: false, reason: 'no_player' })
  }

  if (player.user_id === user.id) {
    return NextResponse.json({ linked: true, reason: 'already_linked' })
  }

  // Service role nécessaire : un utilisateur ne peut pas modifier sa propre
  // fiche players (registre fédéral) via ses propres droits RLS.
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const [{ error: updateError }, { error: roleError }] = await Promise.all([
    adminClient.from('players').update({ user_id: user.id }).eq('id', player.id),
    adminClient.from('groups_players').update({ role: 'member' }).eq('player_id', player.id).is('role', null),
  ])

  if (updateError) {
    console.error('[link-player] Failed to link user_id to player:', updateError)
    return NextResponse.json({ linked: false, reason: 'update_error' }, { status: 500 })
  }
  if (roleError) console.error('[link-player] Failed to set default role:', roleError)

  return NextResponse.json({ linked: true, reason: 'linked_now' })
}

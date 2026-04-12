import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    console.error('[auth/callback] No code in URL')
    return NextResponse.redirect(`${origin}/auth/error?reason=no_code`)
  }

  // 1. Échanger le code contre une session
  const supabase = await createServerClient()
  const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)

  if (sessionError || !sessionData?.user) {
    console.error('[auth/callback] exchangeCodeForSession error:', sessionError)
    return NextResponse.redirect(`${origin}/auth/error?reason=session_error`)
  }

  const authUser = sessionData.user
  const userEmail = authUser.email?.toLowerCase()

  if (!userEmail) {
    console.error('[auth/callback] No email on auth user:', authUser.id)
    return NextResponse.redirect(`${origin}${next}`)
  }

  // 2. Chercher la fiche player par email (insensible à la casse)
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('id, user_id')
    .ilike('email', userEmail)
    .maybeSingle()

  if (playerError) {
    console.error('[auth/callback] players lookup error:', playerError)
    // On laisse l'utilisateur passer quand même — le lien se fera plus tard
    return NextResponse.redirect(`${origin}${next}`)
  }

  if (!player) {
    // Pas de fiche préexistante — premier signup sans invitation
    console.log('[auth/callback] No player found for email:', userEmail)
    return NextResponse.redirect(`${origin}${next}`)
  }

  // 3. Si user_id déjà renseigné et identique → rien à faire
  if (player.user_id === authUser.id) {
    return NextResponse.redirect(`${origin}${next}`)
  }

  // 4. Écrire le user_id dans players
  // On utilise le service_role pour contourner les RLS sur cette opération système
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { error: updateError } = await adminClient
    .from('players')
    .update({ user_id: authUser.id })
    .eq('id', player.id)

  if (updateError) {
    console.error('[auth/callback] Failed to link user_id to player:', updateError)
    // Non bloquant — l'utilisateur peut quand même continuer
  } else {
    console.log(`[auth/callback] Linked auth.user ${authUser.id} → player ${player.id}`)
  }

  // 5. Mettre à jour le role dans groups_players si la ligne existe sans role
  //    (ex: invité ajouté par un admin sans role défini)
  const { error: roleError } = await adminClient
    .from('groups_players')
    .update({ role: 'member' })
    .eq('player_id', player.id)
    .is('role', null)   // seulement si pas encore de role

  if (roleError) {
    console.error('[auth/callback] Failed to set default role in groups_players:', roleError)
  }

  return NextResponse.redirect(`${origin}${next}`)
}

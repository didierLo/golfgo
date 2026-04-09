import { createClient } from '@/lib/supabase/client'

export async function getOrCreateCurrentPlayer() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  // 1️⃣ Cherche un player existant lié à ce user
  const { data: existing } = await supabase
    .from('players')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return existing
  }

  // 2️⃣ Sinon, crée-le
  const { data: created, error } = await supabase
    .from('players')
    .insert({
      user_id: user.id,
      first_name: user.email?.split('@')[0] ?? 'Player',
      surname: '',
    })
    .select('id')
    .single()

  if (error) {
    console.error('create player error', error)
    return null
  }

  return created
}
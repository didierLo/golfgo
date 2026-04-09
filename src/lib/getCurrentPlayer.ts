import { createClient } from '@/lib/supabase/client'

export async function getCurrentPlayer() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: player, error } = await supabase
    .from('players')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('getCurrentPlayer error', error)
    return null
  }

  return player // soit { id }, soit null
}
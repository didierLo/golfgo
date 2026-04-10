import { createClient } from '@/lib/supabase/client'

export async function getOrCreatePlayer() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: existing } = await supabase
    .from('players')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) return existing

  const { data: byEmail } = await supabase
    .from('players')
    .select('*')
    .eq('email', user.email)
    .maybeSingle()

  if (byEmail) {
    await supabase.from('players').update({ user_id: user.id }).eq('id', byEmail.id)
    return { ...byEmail, user_id: user.id }
  }

  const { data: created, error } = await supabase
    .from('players')
    .insert({
      user_id: user.id,
      email: user.email,
      first_name: user.user_metadata?.full_name?.split(' ')[0] || '',
      surname: user.user_metadata?.full_name?.split(' ')?.slice(1).join(' ') || '',
    })
    .select()
    .single()

  if (error) throw error
  return created
}
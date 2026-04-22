import { createClient } from '@/lib/supabase/client'

export async function updateParticipantStatus(
  eventId: string,
  status: string
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not logged')

  // ✅ Résoudre user_id → player_id (le bug était ici : on utilisait user.id directement)
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (playerError || !player) throw new Error('Player not found for this user')

  const { error } = await supabase
    .from('event_participants')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('player_id', player.id)  // ✅ player.id et non user.id

  if (error) throw error
}

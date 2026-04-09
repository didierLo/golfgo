import { createClient } from '@/lib/supabase/client'

export async function updateParticipantStatus(
  eventId:string,
  status:string
){

  const supabase = createClient()

  const { data:{ user } } = await supabase.auth.getUser()

  if(!user){
    throw new Error("User not logged")
  }

  const { error } = await supabase
    .from('event_participants')
    .update({ status })
    .eq('event_id',eventId)
    .eq('player_id',user.id)

  if(error){
    throw error
  }

}
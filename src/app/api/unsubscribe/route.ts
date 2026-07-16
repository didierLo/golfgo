import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: Request) {
  const url = new URL(req.url)
  const playerId = url.searchParams.get('pid')
  const groupId  = url.searchParams.get('gid')

  if (!playerId || !groupId) {
    return new Response('Missing parameters', { status: 400 })
  }

  const { error } = await supabase
    .from('groups_players')
    .update({ email_opt_out: true })
    .eq('player_id', playerId)
    .eq('group_id', groupId)

  if (error) {
    return new Response('Error', { status: 500 })
  }

  return new Response('OK', { status: 200 })
}

export async function GET(req: Request) {
  return POST(req)
}
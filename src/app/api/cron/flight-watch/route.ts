import { createClient } from '@supabase/supabase-js'
import { runFlightWatch } from '@/lib/flights/flightWatch'

const CRON_SECRET = process.env.CRON_SECRET

// Lance la surveillance des flights à la demande (test manuel). Elle tourne déjà chaque matin dans /api/cron/reminders.
//   curl -H "Authorization: Bearer $CRON_SECRET" https://www.golfgo.be/api/cron/flight-watch
// Comme au quotidien : aucune notification n'est envoyée si la situation n'a pas changé depuis la dernière alerte.
export async function GET(req: Request) {
  if (!CRON_SECRET || req.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
  const stats = await runFlightWatch(supabase)
  return Response.json({ success: true, ...stats })
}

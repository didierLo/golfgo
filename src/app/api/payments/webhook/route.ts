import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: Request) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')!
  
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch { return new Response('Invalid signature', { status: 400 }) }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { eventId, playerId } = session.metadata!
    const email = session.customer_details?.email

    // Paralléliser update et fetch player
    const [, { data: player }] = await Promise.all([
      supabase.from('event_participants')
        .update({ payment_status: 'PAID' })
        .eq('event_id', eventId).eq('player_id', playerId),
      supabase.from('players')
        .select('first_name, surname')
        .eq('id', playerId)
        .single()
    ])

    if (player && email) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'GolfGo <info@golfgo.be>',
          to: email,
          subject: 'Confirmation de paiement GolfGo',
          html: `<p>Bonjour ${player.first_name},</p>
                 <p>Votre paiement a bien été reçu. Merci !</p>
                 <p>À bientôt sur le parcours ⛳</p>`,
        }),
      })
    }
  }

  return new Response('OK')
}
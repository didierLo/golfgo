import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { sendOrQueueEmail } from '@/lib/email/queueEmail'
import { getGroupLocale, serverT } from '@/lib/i18n/server'

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
      // Langue du groupe de l'événement (par défaut : français)
      const { data: ev } = await supabase.from('events').select('group_id').eq('id', eventId).maybeSingle()
      const t = serverT(await getGroupLocale(supabase, ev?.group_id))
      await sendOrQueueEmail({
        category: 'other',
        eventId:  eventId,
        from:     'GolfGo <info@golfgo.be>',
        to:       email,
        subject:  t('email.payment.subject'),
        html: `<p>${t('email.common.greeting', { name: player.first_name })}</p>
               <p>${t('email.payment.received')}</p>
               <p>${t('email.payment.seeYou')}</p>`,
      })
    }
  }

  return new Response('OK')
}
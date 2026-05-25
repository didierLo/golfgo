import Stripe from 'stripe';

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const { eventId, playerId, amount, description, locale } = await req.json();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card', 'bancontact'],
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: { name: description },
        unit_amount: Math.round(amount * 100),
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${baseUrl}/${locale}/my-events?payment=success`,
    cancel_url:  `${baseUrl}/${locale}/my-events/${eventId}/pay?cancelled=true`,
    metadata: { eventId, playerId },
  });

  return Response.json({ url: session.url });
}
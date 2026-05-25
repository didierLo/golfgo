import Stripe from 'stripe';

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const { eventId, amount, description, userId } = await req.json();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card', 'bancontact'],
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: { name: description },
        unit_amount: amount * 100, // en centimes
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_URL}/groups/.../events/${eventId}/payments?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/groups/.../events/${eventId}/payments?cancelled=true`,
    metadata: { eventId, userId },
  });

  return Response.json({ url: session.url });
}
import { NextResponse } from 'next/server'
import { sendOrQueueEmail } from '@/lib/email/queueEmail'

export async function POST(req: Request) {
  const { name, email } = await req.json()
  await sendOrQueueEmail({
    category: 'other',
    from:     'GolfGo <noreply@golfgo.be>',
    to:       'info@golfgo.be',
    subject:  'Demande de suppression de compte',
    html: `
      <p>Un utilisateur a demandé la suppression de son compte :</p>
      <ul>
        <li><strong>Nom :</strong> ${name ?? 'inconnu'}</li>
        <li><strong>Email :</strong> ${email ?? 'inconnu'}</li>
      </ul>
      <p>Merci de traiter cette demande dans les 30 jours.</p>
    `,
  })
  return NextResponse.json({ ok: true })
}

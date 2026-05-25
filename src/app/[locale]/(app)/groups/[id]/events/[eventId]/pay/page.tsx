'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLocale } from 'next-intl'

const supabase = createClient()

export default function PayPage() {
  const params  = useParams()
  const eventId = params.eventId as string
  const locale  = useLocale()
  const router  = useRouter()

  const [event,   setEvent]   = useState<{ title: string; fee_per_person: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying,  setPaying]  = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('events').select('title, fee_per_person').eq('id', eventId).single()
      setEvent(data)
      setLoading(false)
    }
    load()
  }, [eventId])

  async function handlePay() {
    if (!event) return
    setPaying(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: player }   = await supabase.from('players').select('id').eq('user_id', user!.id).single()

    const res = await fetch('/api/payments/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        playerId: player!.id,
        amount: event.fee_per_person,
        description: event.title,
        locale,
      }),
    })
    const { url } = await res.json()
    window.location.href = url
  }

  if (loading) return <div className="p-6 animate-pulse h-40 bg-slate-100 rounded-xl" />

  if (!event?.fee_per_person) {
    router.push('/my-events')
    return null
  }

  return (
    <div className="p-5 sm:p-8 max-w-md mx-auto">
      <button onClick={() => router.back()} className="text-[13px] text-slate-500 hover:text-slate-700 mb-6 flex items-center gap-1">
        ← Retour
      </button>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5">
        <h1 className="text-[18px] font-black text-slate-900 mb-1">{event.title}</h1>
        <p className="text-[13px] text-slate-500 mb-4">Paiement de votre participation</p>
        <div className="text-[32px] font-black text-[#185FA5]">{event.fee_per_person} €</div>
      </div>

      {/* Bloc sécurité */}
      <div className="bg-[#EAF3DE] border border-[#C0DD97] rounded-xl p-4 mb-5">
        <p className="text-[12px] font-bold text-[#3B6D11] mb-2">🔒 Paiement 100% sécurisé</p>
        <p className="text-[12px] text-[#3B6D11] leading-relaxed">
          Votre paiement est traité par <strong>Stripe</strong>, leader mondial du paiement en ligne.
          GolfGo ne stocke jamais vos données bancaires. La transaction est chiffrée et conforme aux
          normes PCI-DSS. Vous acceptez les cartes Visa, Mastercard, Bancontact et Apple/Google Pay.
        </p>
      </div>

      <button
        onClick={handlePay}
        disabled={paying}
        className="w-full py-4 rounded-xl bg-[#185FA5] text-white font-bold text-[15px] hover:bg-[#0C447C] transition-colors disabled:opacity-60">
        {paying ? 'Redirection...' : `Payer ${event.fee_per_person} €`}
      </button>
    </div>
  )
}
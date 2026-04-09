'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { AuthCard, AuthInput, AuthButton, AuthSuccess } from '@/components/auth/AuthCard'

const supabase = createClient()

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setSent(true)
    setLoading(false)
  }

  return (
    <AuthCard
      title="Mot de passe oublié"
      subtitle="Reçois un lien de réinitialisation par email"
      footer={
        <Link href="/login" className="text-[#185FA5] hover:underline font-medium">
          ← Retour à la connexion
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col gap-4">
          <AuthSuccess message="Email envoyé ! Vérifie ta boîte mail et clique sur le lien." />
          <p className="text-[12px] text-gray-400 text-center">
            Tu n'as rien reçu ?{' '}
            <button
              onClick={() => setSent(false)}
              className="text-[#185FA5] hover:underline"
            >
              Renvoyer
            </button>
          </p>
        </div>
      ) : (
        <form onSubmit={handleReset} className="flex flex-col gap-4">
          <AuthInput
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="votre@email.com"
            required
            autoComplete="email"
          />
          <AuthButton loading={loading} label="Envoyer le lien" loadingLabel="Envoi…" />
        </form>
      )}
    </AuthCard>
  )
}

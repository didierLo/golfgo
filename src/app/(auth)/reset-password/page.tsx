'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { AuthCard, AuthInput, AuthButton, AuthError, AuthSuccess, EyeButton } from '@/components/auth/AuthCard'

const supabase = createClient()

export default function ResetPasswordPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      setLoading(false)
      return
    }

    const { error: resetError } = await supabase.auth.updateUser({
      email,
      password: newPassword,
    })

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setMessage('Mot de passe réinitialisé avec succès !')
    setTimeout(() => router.push('/login'), 2000)
    setLoading(false)
  }

  return (
    <AuthCard
      title="Nouveau mot de passe"
      subtitle="Choisis un nouveau mot de passe pour ton compte"
      footer={
        <Link href="/login" className="text-[#185FA5] hover:underline font-medium">
          ← Retour à la connexion
        </Link>
      }
    >
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

        <AuthInput
          label="Nouveau mot de passe"
          type={showPassword ? 'text' : 'password'}
          value={newPassword}
          onChange={setNewPassword}
          required
          autoComplete="new-password"
          suffix={<EyeButton show={showPassword} onToggle={() => setShowPassword(v => !v)} />}
        />

        <AuthInput
          label="Confirmer le mot de passe"
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={setConfirmPassword}
          required
          autoComplete="new-password"
        />

        <AuthError message={error} />
        <AuthSuccess message={message} />

        <AuthButton loading={loading} label="Réinitialiser" loadingLabel="Réinitialisation…" />

      </form>
    </AuthCard>
  )
}

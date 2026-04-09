'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { AuthCard, AuthInput, AuthButton, AuthError, EyeButton } from '@/components/auth/AuthCard'

const supabase = createClient()

export default function SignupPage() {
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/reset-password`,
        data: { full_name: fullName.trim() },
      },
    })

    if (signUpError) {
      setError(
        signUpError.message.includes('User already registered')
          ? 'Cet email est déjà utilisé.'
          : signUpError.message
      )
      setLoading(false)
      return
    }

    if (data.user) {
      router.push('/login?message=check-email')
    }

    setLoading(false)
  }

  return (
    <AuthCard
      title="Créer un compte"
      subtitle="Rejoins GolfGo pour organiser tes parties"
      footer={
        <>
          Déjà un compte ?{' '}
          <Link href="/login" className="text-[#185FA5] hover:underline font-medium">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={handleSignup} className="flex flex-col gap-4">

        <AuthInput
          label="Prénom et nom"
          value={fullName}
          onChange={setFullName}
          placeholder="Prénom Nom"
          required
          autoComplete="name"
        />

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
          label="Mot de passe"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={setPassword}
          required
          autoComplete="new-password"
          suffix={<EyeButton show={showPassword} onToggle={() => setShowPassword(v => !v)} />}
        />

        <AuthError message={error} />

        <AuthButton loading={loading} label="Créer mon compte" loadingLabel="Création…" />

      </form>
    </AuthCard>
  )
}

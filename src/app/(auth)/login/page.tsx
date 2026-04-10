'use client'

import { useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { AuthCard, AuthInput, AuthButton, AuthError, AuthSuccess, EyeButton } from '@/components/auth/AuthCard'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const message = searchParams.get('message')
  const supabase = useMemo(() => createClient(), [])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setErrorMsg(error.message || 'Erreur de connexion')
      setLoading(false)
    } else {
      router.push('/groups')
      router.refresh()
    }
  }

  return (
    <AuthCard
      title="Connexion"
      subtitle="Bienvenue sur GolfGo"
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link href="/signup" className="text-[#185FA5] hover:underline font-medium">
            Créer un compte
          </Link>
        </>
      }
    >
      <form onSubmit={handleLogin} className="flex flex-col gap-4">

        {message === 'check-email' && (
          <AuthSuccess message="Vérifiez votre email pour confirmer votre compte." />
        )}

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
          autoComplete="current-password"
          suffix={<EyeButton show={showPassword} onToggle={() => setShowPassword(v => !v)} />}
        />

        <div className="text-right -mt-2">
          <Link href="/forgot-password" className="text-[12px] text-gray-400 hover:text-[#185FA5] transition-colors">
            Mot de passe oublié ?
          </Link>
        </div>

        <AuthError message={errorMsg} />

        <AuthButton loading={loading} label="Se connecter" loadingLabel="Connexion…" />

      </form>
    </AuthCard>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}
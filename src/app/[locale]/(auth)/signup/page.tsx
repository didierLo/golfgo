'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { AuthCard, AuthInput, AuthButton, AuthError, EyeButton } from '@/components/auth/AuthCard'
import { useTranslations } from 'next-intl'

const supabase = createClient()

export default function SignupPage() {
  const router = useRouter()
  const t      = useTranslations()
  const searchParams = useSearchParams()

  const [fullName, setFullName]           = useState('')
  const [email, setEmail]                 = useState('')
  const [password, setPassword]           = useState('')
  const [showPassword, setShowPassword]   = useState(false)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    })

    if (signUpError) {
      setError(
        signUpError.message.includes('User already registered')
          ? t('auth.signup.alreadyUsed')
          : signUpError.message
      )
      setLoading(false); return
    }

  if (data.user) {
  const next = searchParams.get('next')
  router.push(next ? `${next}?joined=1` : '/welcome')
}

    setLoading(false)
  }

  return (
    <AuthCard
      title={t('auth.signup.title')}
      subtitle={t('auth.signup.subtitle')}
      footer={
        <>
          {t('auth.signup.alreadyAccount')}{' '}
          <Link href="/login" className="text-[#185FA5] hover:underline font-medium">
            {t('auth.signup.login')}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSignup} className="flex flex-col gap-4">
        <AuthInput
          label={t('auth.signup.fullName')}
          value={fullName}
          onChange={setFullName}
          placeholder="Prénom Nom"
          required
          autoComplete="name"
        />
        <AuthInput
          label={t('auth.signup.email')}
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="votre@email.com"
          required
          autoComplete="email"
        />
        <AuthInput
          label={t('auth.signup.password')}
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={setPassword}
          required
          autoComplete="new-password"
          suffix={<EyeButton show={showPassword} onToggle={() => setShowPassword(v => !v)} />}
        />
        <AuthError message={error} />
        <AuthButton loading={loading} label={t('auth.signup.submit')} loadingLabel={t('auth.signup.submitting')} />
      </form>
    </AuthCard>
  )
}

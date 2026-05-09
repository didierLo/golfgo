'use client'

import { useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { AuthCard, AuthInput, AuthButton, AuthError, AuthSuccess, EyeButton } from '@/components/auth/AuthCard'
import { useTranslations } from 'next-intl'

function LoginContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const message      = searchParams.get('message')
  const supabase     = useMemo(() => createClient(), [])
  const t            = useTranslations()

  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [errorMsg,     setErrorMsg]     = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErrorMsg('')

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })

    if (error) {
      setErrorMsg(error.message || t('common.error'))
      setLoading(false)
    } else {
      router.push('/my-events')
      router.refresh()
    }
  }

  return (
    <AuthCard
      title={t('auth.login.title')}
      subtitle={t('auth.login.subtitle')}
      footer={
        <>
          {t('auth.login.noAccount')}{' '}
          <Link href="/signup" className="text-[#185FA5] hover:underline font-medium">
            {t('auth.login.signup')}
          </Link>
        </>
      }
    >
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        {message === 'check-email' && (
          <AuthSuccess message={t('auth.login.checkEmail')} />
        )}

        <AuthInput
          label={t('auth.login.email')}
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="votre@email.com"
          required
          autoComplete="email"
        />

        <AuthInput
          label={t('auth.login.password')}
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={setPassword}
          required
          autoComplete="current-password"
          suffix={<EyeButton show={showPassword} onToggle={() => setShowPassword(v => !v)} />}
        />

        <div className="text-right -mt-2">
          <Link href="/forgot-password" className="text-[12px] text-gray-400 hover:text-[#185FA5] transition-colors">
            {t('auth.login.forgotPassword')}
          </Link>
        </div>

        <AuthError message={errorMsg} />

        <AuthButton loading={loading} label={t('auth.login.submit')} loadingLabel={t('auth.login.submitting')} />
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

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { AuthCard, AuthInput, AuthButton, AuthError, AuthSuccess, EyeButton } from '@/components/auth/AuthCard'
import { useTranslations } from 'next-intl'

const supabase = createClient()

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations()

  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword]       = useState(false)
  const [loading, setLoading]                 = useState(false)
  const [message, setMessage]                 = useState<string | null>(null)
  const [error, setError]                     = useState<string | null>(null)

  const [checkingLink, setCheckingLink] = useState(true)
  const [sessionReady, setSessionReady] = useState(false)

  // Le lien reçu par email contient un `code` PKCE : il faut l'échanger
  // explicitement contre une session avant de pouvoir changer le mot de
  // passe. Sans cet échange, updateUser() échoue systématiquement.
  useEffect(() => {
    const code = searchParams.get('code')

    if (!code) {
      // Pas de code dans l'URL : soit le lien est invalide, soit une
      // session existe déjà (cas rare). On vérifie avant de conclure.
      supabase.auth.getSession().then(({ data }) => {
        setSessionReady(!!data.session)
        if (!data.session) setError(t('auth.resetPassword.invalidLink'))
        setCheckingLink(false)
      })
      return
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      if (exchangeError) {
        console.error('[reset-password] exchangeCodeForSession error:', exchangeError)
        setError(t('auth.resetPassword.invalidLink'))
        setSessionReady(false)
      } else {
        setSessionReady(true)
      }
      setCheckingLink(false)
    })
  }, [searchParams, t])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setMessage(null); setError(null)

    if (newPassword !== confirmPassword) {
      setError(t('auth.resetPassword.mismatch'))
      setLoading(false); return
    }

    // Ne jamais repasser `email` ici : la session issue de l'échange du
    // code suffit à identifier l'utilisateur, et transmettre l'email
    // déclenche par erreur un changement d'adresse (avec reconfirmation).
    const { error: resetError } = await supabase.auth.updateUser({ password: newPassword })

    if (resetError) { setError(resetError.message); setLoading(false); return }

    setMessage(t('auth.resetPassword.success'))
    setTimeout(() => router.push('/login'), 2000)
    setLoading(false)
  }

  if (checkingLink) {
    return (
      <AuthCard title={t('auth.resetPassword.title')} subtitle={t('auth.resetPassword.subtitle')}>
        <p className="text-center text-gray-500">{t('auth.resetPassword.checking')}</p>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title={t('auth.resetPassword.title')}
      subtitle={t('auth.resetPassword.subtitle')}
      footer={
        <Link href="/login" className="text-[#185FA5] hover:underline font-medium">
          {t('auth.resetPassword.back')}
        </Link>
      }
    >
      {sessionReady ? (
        <form onSubmit={handleReset} className="flex flex-col gap-4">
          <AuthInput
            label={t('auth.resetPassword.newPassword')}
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={setNewPassword}
            required
            autoComplete="new-password"
            suffix={<EyeButton show={showPassword} onToggle={() => setShowPassword(v => !v)} />}
          />
          <AuthInput
            label={t('auth.resetPassword.confirmPassword')}
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={setConfirmPassword}
            required
            autoComplete="new-password"
          />
          <AuthError message={error} />
          <AuthSuccess message={message} />
          <AuthButton loading={loading} label={t('auth.resetPassword.submit')} loadingLabel={t('auth.resetPassword.submitting')} />
        </form>
      ) : (
        <AuthError message={error ?? t('auth.resetPassword.invalidLink')} />
      )}
    </AuthCard>
  )
}

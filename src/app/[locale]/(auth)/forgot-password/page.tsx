'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { AuthCard, AuthInput, AuthButton, AuthError, AuthSuccess, EyeButton } from '@/components/auth/AuthCard'
import { useTranslations } from 'next-intl'

const supabase = createClient()

export default function ForgotPasswordPage() {
  const router = useRouter()
  const t = useTranslations()

  // Étape 1 : demande du code. Étape 2 : saisie du code + nouveau mot de passe.
  const [step, setStep] = useState<'request' | 'verify'>('request')

  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const [otp, setOtp]                         = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword]       = useState(false)
  const [message, setMessage]                 = useState<string | null>(null)

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)

    // On envoie toujours le même message de succès, que l'email existe ou
    // non en base, pour ne pas révéler quels emails sont enregistrés.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setStep('verify')
    setLoading(false)
  }

  async function handleVerifyAndReset(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError(t('auth.resetPassword.mismatch'))
      return
    }

    setLoading(true)

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp.trim(),
      type: 'recovery',
    })

    if (verifyError) {
      setError(t('auth.forgotPassword.invalidOtp'))
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setMessage(t('auth.resetPassword.success'))
    setTimeout(() => router.push('/login'), 2000)
    setLoading(false)
  }

  if (step === 'verify') {
    return (
      <AuthCard
        title={t('auth.resetPassword.title')}
        subtitle={t('auth.resetPassword.subtitle')}
        footer={
          <button
            onClick={() => { setStep('request'); setError(null); setOtp('') }}
            className="text-[#185FA5] hover:underline font-medium"
          >
            {t('auth.forgotPassword.changeEmail')}
          </button>
        }
      >
        <form onSubmit={handleVerifyAndReset} className="flex flex-col gap-4">
          <AuthSuccess message={t('auth.forgotPassword.sent')} />

          <AuthInput
            label={t('auth.forgotPassword.otpLabel')}
            type="text"
            value={otp}
            onChange={setOtp}
            placeholder={t('auth.forgotPassword.otpPlaceholder')}
            required
            autoComplete="one-time-code"
          />
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
          <AuthButton
            loading={loading}
            label={t('auth.resetPassword.submit')}
            loadingLabel={t('auth.resetPassword.submitting')}
          />
        </form>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title={t('auth.forgotPassword.title')}
      subtitle={t('auth.forgotPassword.subtitle')}
      footer={
        <Link href="/login" className="text-[#185FA5] hover:underline font-medium">
          {t('auth.forgotPassword.back')}
        </Link>
      }
    >
      <form onSubmit={handleRequestCode} className="flex flex-col gap-4">
        <AuthInput
          label={t('auth.forgotPassword.emailLabel')}
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="votre@email.com"
          required
          autoComplete="email"
        />
        <AuthError message={error} />
        <AuthButton loading={loading} label={t('auth.forgotPassword.submit')} loadingLabel={t('auth.forgotPassword.submitting')} />
      </form>
    </AuthCard>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { AuthCard, AuthInput, AuthButton, AuthError, AuthSuccess, EyeButton } from '@/components/auth/AuthCard'
import { useTranslations } from 'next-intl'

const supabase = createClient()

export default function ResetPasswordPage() {
  const router = useRouter()
  const t      = useTranslations()

  const [email, setEmail]                     = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword]       = useState(false)
  const [loading, setLoading]                 = useState(false)
  const [message, setMessage]                 = useState<string | null>(null)
  const [error, setError]                     = useState<string | null>(null)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setMessage(null); setError(null)

    if (newPassword !== confirmPassword) {
      setError(t('auth.resetPassword.mismatch'))
      setLoading(false); return
    }

    const { error: resetError } = await supabase.auth.updateUser({ email, password: newPassword })

    if (resetError) { setError(resetError.message); setLoading(false); return }

    setMessage(t('auth.resetPassword.success'))
    setTimeout(() => router.push('/login'), 2000)
    setLoading(false)
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
      <form onSubmit={handleReset} className="flex flex-col gap-4">
        <AuthInput
          label={t('auth.resetPassword.email')}
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="votre@email.com"
          required
          autoComplete="email"
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
        <AuthButton loading={loading} label={t('auth.resetPassword.submit')} loadingLabel={t('auth.resetPassword.submitting')} />
      </form>
    </AuthCard>
  )
}

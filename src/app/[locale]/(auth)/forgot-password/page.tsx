'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { AuthCard, AuthInput, AuthButton, AuthSuccess } from '@/components/auth/AuthCard'
import { useTranslations } from 'next-intl'

const supabase = createClient()

export default function ForgotPasswordPage() {
  const t = useTranslations()
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)

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
      title={t('auth.forgotPassword.title')}
      subtitle={t('auth.forgotPassword.subtitle')}
      footer={
        <Link href="/login" className="text-[#185FA5] hover:underline font-medium">
          {t('auth.forgotPassword.back')}
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col gap-4">
          <AuthSuccess message={t('auth.forgotPassword.sent')} />
          <p className="text-[12px] text-gray-400 text-center">
            {t('auth.forgotPassword.noEmail')}{' '}
            <button onClick={() => setSent(false)} className="text-[#185FA5] hover:underline">
              {t('auth.forgotPassword.resend')}
            </button>
          </p>
        </div>
      ) : (
        <form onSubmit={handleReset} className="flex flex-col gap-4">
          <AuthInput
            label={t('auth.forgotPassword.title')}
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="votre@email.com"
            required
            autoComplete="email"
          />
          <AuthButton loading={loading} label={t('auth.forgotPassword.submit')} loadingLabel={t('auth.forgotPassword.submitting')} />
        </form>
      )}
    </AuthCard>
  )
}

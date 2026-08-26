'use client'

import { useState,  Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { AuthCard, AuthInput, AuthButton, AuthError, AuthSuccess, EyeButton } from '@/components/auth/AuthCard'
import { useTranslations } from 'next-intl'

 const supabase = createClient()

function LoginContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const message      = searchParams.get('message')
 
  const t            = useTranslations()

  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [errorMsg,     setErrorMsg]     = useState('')

  // ── Renvoi de l'email de confirmation (compte créé mais pas confirmé) ──
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null)
  const [resendStatus,     setResendStatus]     = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [resendCooldown,   setResendCooldown]   = useState(0)

  function friendlyAuthError(error: { code?: string; message?: string }): string {
    const code = error.code ?? ''
    const msg  = (error.message ?? '').toLowerCase()

    if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
      setUnconfirmedEmail(email.trim())
      return t('auth.login.errorEmailNotConfirmed')
    }
    setUnconfirmedEmail(null)
    if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
      return t('auth.login.errorInvalidCredentials')
    }
    if (code === 'too_many_requests' || msg.includes('too many requests') || msg.includes('rate limit')) {
      return t('auth.login.errorTooManyRequests')
    }
    if (code === 'user_not_found') {
      return t('auth.login.errorUserNotFound')
    }
    return error.message || t('common.error')
  }

  async function handleResendConfirmation() {
    if (!unconfirmedEmail || resendStatus === 'sending' || resendCooldown > 0) return
    setResendStatus('sending')
    const { error } = await supabase.auth.resend({ type: 'signup', email: unconfirmedEmail })
    if (error) {
      setResendStatus('error')
      return
    }
    setResendStatus('sent')
    setResendCooldown(30)
    const timer = setInterval(() => {
      setResendCooldown(c => {
        if (c <= 1) { clearInterval(timer); return 0 }
        return c - 1
      })
    }, 1000)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErrorMsg('')
    setUnconfirmedEmail(null); setResendStatus('idle')

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })

    if (error) {
      setErrorMsg(friendlyAuthError(error))
      setLoading(false)
    } else {
      // Filet de sécurité : relie players.user_id si ce n'est pas déjà fait
      // (comptes créés avant ce fix, ou tout cas où le lien a été raté).
      // On n'attend pas d'erreur bloquante ici : si ça échoue, on laisse
      // quand même l'utilisateur entrer, il verra juste un profil incomplet.
      try {
        await fetch('/api/link-player', { method: 'POST' })
      } catch (linkError) {
        console.error('[login] link-player call failed:', linkError)
      }

      // Rechargement complet (pas router.push + router.refresh) : on force
      // une nouvelle requête réseau qui repart du cookie de session déjà
      // committé par le navigateur, au lieu de compter sur le timing d'une
      // transition côté client. proxy.ts (garde-fou ajouté le 04/08) relit
      // la session à chaque requête ; une navigation soft juste après le
      // login pouvait dans de rares cas arriver avant que le cookie soit
      // pleinement propagé, provoquant un rebond vers /login malgré une
      // connexion réussie (boucle de reconnexion observée par des testeurs
      // Android le 06/08).
      const next = searchParams.get('next')
      window.location.href = next ?? '/welcome'
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
          <Link
            href={email ? `/forgot-password?email=${encodeURIComponent(email)}` : '/forgot-password'}
            className="text-[12px] text-gray-400 hover:text-[#185FA5] transition-colors"
          >
            {t('auth.login.forgotPassword')}
          </Link>
        </div>

        <AuthError message={errorMsg} />

        {unconfirmedEmail && (
          <div className="-mt-2">
            {resendStatus === 'sent' ? (
              <p className="text-[12px] text-green-700">
                {t('auth.login.resendSent')} {resendCooldown > 0 && t('auth.login.resendRetryIn', { seconds: resendCooldown })}
              </p>
            ) : (
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resendStatus === 'sending' || resendCooldown > 0}
                className="text-[12px] font-medium text-[#185FA5] hover:text-[#0C447C] disabled:opacity-50 disabled:cursor-not-allowed underline underline-offset-2"
              >
                {resendStatus === 'sending' ? t('auth.login.resendSending') : t('auth.login.resendConfirmation')}
              </button>
            )}
            {resendStatus === 'error' && (
              <p className="text-[12px] text-red-600 mt-1">{t('auth.login.resendError')}</p>
            )}
          </div>
        )}

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

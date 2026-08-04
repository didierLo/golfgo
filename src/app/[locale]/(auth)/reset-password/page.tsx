'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { AuthCard, AuthInput, AuthButton, AuthError, AuthSuccess, EyeButton } from '@/components/auth/AuthCard'
import { useTranslations } from 'next-intl'

const supabase = createClient()

export default function ResetPasswordPage() {
  const router = useRouter()
  const t = useTranslations()

  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword]       = useState(false)
  const [loading, setLoading]                 = useState(false)
  const [message, setMessage]                 = useState<string | null>(null)
  const [error, setError]                     = useState<string | null>(null)

  const [checkingLink, setCheckingLink] = useState(true)
  const [sessionReady, setSessionReady] = useState(false)

  // Le client Supabase (`detectSessionInUrl`, actif par défaut) traite déjà
  // tout seul le `code` PKCE présent dans l'URL au chargement de la page.
  // On ne le refait PAS nous-mêmes ici : appeler exchangeCodeForSession en
  // plus ferait une 2e tentative sur le même code à usage unique, et l'une
  // des deux échouerait avec "invalid grant" — d'où le bug "1er clic
  // invalide, 2e clic OK" observé. On se contente d'écouter le résultat.
  useEffect(() => {
    let active = true

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active || !session) return
      setSessionReady(true)
      setCheckingLink(false)
    })

    // Filet de sécurité : si après un court délai aucune session n'est
    // apparue, le lien est vraiment invalide/expiré/déjà utilisé.
    const timeout = setTimeout(async () => {
      if (!active) return
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        setError(t('auth.resetPassword.invalidLink'))
        setSessionReady(false)
      } else {
        setSessionReady(true)
      }
      setCheckingLink(false)
    }, 3000)

    return () => {
      active = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [t])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setMessage(null); setError(null)

    if (newPassword !== confirmPassword) {
      setError(t('auth.resetPassword.mismatch'))
      setLoading(false); return
    }

    // Ne jamais repasser `email` ici : la session issue du lien de reset
    // suffit à identifier l'utilisateur, et transmettre l'email
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

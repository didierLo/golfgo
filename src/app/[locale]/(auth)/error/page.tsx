'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AuthCard } from '@/components/auth/AuthCard'
import { useTranslations } from 'next-intl'

function AuthErrorContent() {
  const t = useTranslations()
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')

  const description =
    reason === 'no_code' || reason === 'session_error'
      ? t('auth.error.expiredOrInvalid')
      : t('auth.error.generic')

  return (
    <AuthCard
      title={t('auth.error.title')}
      subtitle={description}
      footer={
        <Link href="/login" className="text-[#185FA5] hover:underline font-medium">
          {t('auth.error.backToLogin')}
        </Link>
      }
    >
      <div />
    </AuthCard>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <AuthErrorContent />
    </Suspense>
  )
}

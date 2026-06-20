'use client'

import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'

export default function CguPage() {
  const t = useTranslations('legal.cgu')
  const locale = useLocale()

  const today = new Date().toLocaleDateString(locale, {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div className="min-h-screen p-5 sm:p-8 max-w-2xl">

      <Link
        href={`/${locale}`}
        className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-600 transition-colors mb-6"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {t('back')}
      </Link>

      {/* Header */}
      <div
        className="rounded-2xl border border-white/60 shadow-sm p-6 mb-6"
        style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#EAF3DE] flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="text-[#3B6D11]">
              <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M5 6h6M5 9h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 className="text-[18px] font-black text-slate-900 tracking-tight leading-tight">{t('title')}</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">{t('lastUpdated', { date: today })}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">

        {/* 1. Présentation */}
        <Section title={t('sections.presentation.title')}>
          <P>{t('sections.presentation.p1')}</P>
          <P>{t('sections.presentation.p2')}</P>
        </Section>

        {/* 2. Acceptation */}
        <Section title={t('sections.acceptance.title')}>
          <P>{t('sections.acceptance.p1')}</P>
          <P>{t('sections.acceptance.p2')}</P>
        </Section>

        {/* 3. Accès */}
        <Section title={t('sections.access.title')}>
          <P>{t('sections.access.p1')}</P>
          <P>{t('sections.access.p2')}</P>
          <P>{t('sections.access.p3')}</P>
        </Section>

        {/* 4. Utilisation */}
        <Section title={t('sections.usage.title')}>
          <P>{t('sections.usage.p1')}</P>
          <ul className="mt-2 flex flex-col gap-1.5">
            {(['i1','i2','i3','i4'] as const).map(i => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3B6D11] flex-shrink-0 mt-1.5" />
                <span className="text-[12px] text-slate-600 leading-relaxed">{t(`sections.usage.items.${i}`)}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* 5. Groupes */}
        <Section title={t('sections.groups.title')}>
          <P>{t('sections.groups.p1')}</P>
          <P>{t('sections.groups.p2')}</P>
          <P>{t('sections.groups.p3')}</P>
        </Section>

        {/* 6. Photos */}
        <Section title={t('sections.photos.title')}>
          <P>{t('sections.photos.p1')}</P>
          <P>{t('sections.photos.p2')}</P>
          <P>{t('sections.photos.p3')}</P>
        </Section>

        {/* 7. Disponibilité */}
        <Section title={t('sections.availability.title')}>
          <P>{t('sections.availability.p1')}</P>
          <P>{t('sections.availability.p2')}</P>
        </Section>

        {/* 8. Responsabilité */}
        <Section title={t('sections.liability.title')}>
          <P>{t('sections.liability.p1')}</P>
          <P>{t('sections.liability.p2')}</P>
        </Section>

        {/* 9. Droit */}
        <Section title={t('sections.law.title')}>
          <P>{t('sections.law.p1')}</P>
        </Section>

      </div>

      <div className="mt-6 text-center">
        <Link
          href={`/${locale}//legal/privacy`}
          className="text-[12px] text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2"
        >
          {t('linkToPrivacy')} →
        </Link>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border border-white/60 shadow-sm p-4"
      style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
    >
      <h2 className="text-[13px] font-bold text-slate-900 mb-2">{title}</h2>
      {children}
    </div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] text-slate-600 leading-relaxed mb-1.5 last:mb-0">{children}</p>
}

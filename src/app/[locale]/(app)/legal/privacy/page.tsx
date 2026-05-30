'use client'

import { useTranslations, useLocale } from 'next-intl'
import Link from 'next/link'

export default function PrivacyPage() {
  const t = useTranslations('legal.privacy')
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
          <div className="w-9 h-9 rounded-xl bg-[#EBF3FC] flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="text-[#185FA5]">
              <path d="M8 1.5L2 4v4c0 3.5 2.5 6 6 7 3.5-1 6-3.5 6-7V4L8 1.5z" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
          </div>
          <div>
            <h1 className="text-[18px] font-black text-slate-900 tracking-tight leading-tight">{t('title')}</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">{t('lastUpdated', { date: today })}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">

        {/* 1. Responsable */}
        <Section title={t('sections.controller.title')}>
          <P>{t('sections.controller.p1')}</P>
          <P>{t('sections.controller.p2')}</P>
        </Section>

        {/* 2. Données */}
        <Section title={t('sections.data.title')}>
          <P>{t('sections.data.p1')}</P>
          <Items section="data" keys={['i1','i2','i3','i4','i5','i6','i7']} t={t} />
        </Section>

        {/* 3. Finalités */}
        <Section title={t('sections.purposes.title')}>
          <P>{t('sections.purposes.p1')}</P>
          <Items section="purposes" keys={['i1','i2','i3','i4','i5','i6','i7']} t={t} />
        </Section>

        {/* 4. Base légale */}
        <Section title={t('sections.basis.title')}>
          <Items section="basis" keys={['i1','i2','i3']} t={t} />
        </Section>

        {/* 5. Partage */}
        <Section title={t('sections.sharing.title')}>
          <P>{t('sections.sharing.p1')}</P>
          <P>{t('sections.sharing.p2')}</P>
          <Items section="sharing" keys={['i1','i2']} t={t} />
          <P>{t('sections.sharing.p3')}</P>
        </Section>

        {/* 6. Conservation */}
        <Section title={t('sections.retention.title')}>
          <P>{t('sections.retention.p1')}</P>
          <P>{t('sections.retention.p2')}</P>
          <P>{t('sections.retention.p3')}</P>
        </Section>

        {/* 7. Droits */}
        <Section title={t('sections.rights.title')}>
          <P>{t('sections.rights.p1')}</P>
          <Items section="rights" keys={['i1','i2','i3','i4','i5','i6']} t={t} />
          <P>{t('sections.rights.p2')}</P>
          <P>{t('sections.rights.p3')}</P>
        </Section>

        {/* 8. Cookies */}
        <Section title={t('sections.cookies.title')}>
          <P>{t('sections.cookies.p1')}</P>
        </Section>

        {/* 9. Sécurité */}
        <Section title={t('sections.security.title')}>
          <Items section="security" keys={['i1','i2','i3','i4']} t={t} />
        </Section>

        {/* 10. Modifications */}
        <Section title={t('sections.updates.title')}>
          <P>{t('sections.updates.p1')}</P>
        </Section>

      </div>

      <div className="mt-6 text-center">
        <Link
          href={`/${locale}/legal/cgu`}
          className="text-[12px] text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2"
        >
          {t('linkToCgu')} →
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

function Items({ section, keys, t }: { section: string; keys: string[]; t: any }) {
  return (
    <ul className="mt-1.5 mb-1.5 flex flex-col gap-1.5">
      {keys.map(k => (
        <li key={k} className="flex items-start gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#185FA5] flex-shrink-0 mt-1.5" />
          <span className="text-[12px] text-slate-600 leading-relaxed">
            {t(`sections.${section}.items.${k}`)}
          </span>
        </li>
      ))}
    </ul>
  )
}

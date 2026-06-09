'use client'

import { useRouter } from 'next/navigation'
import ClubCourseManager from '@/components/clubs/ClubCourseManager'
import ImportClubs from '@/components/clubs/ImportClubs'
import { useTranslations } from 'next-intl'

export default function ClubsPage() {
  const router = useRouter()
  const t = useTranslations()

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <button onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-600 transition-colors mb-4">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {t('common.back')}
        </button>
        <h1 className="text-[18px] font-medium text-gray-900">{t('clubs.title')}</h1>
        <p className="text-[13px] text-gray-900 mt-0.5">{t('clubs.subtitle')}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
          {t('clubs.import')}
        </p>
        <ImportClubs />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
          {t('clubs.manual')}
        </p>
        <ClubCourseManager />
      </div>
    </div>
  )
}
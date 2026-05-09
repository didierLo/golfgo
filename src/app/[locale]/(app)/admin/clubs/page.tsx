import ClubCourseManager from '@/components/clubs/ClubCourseManager'
import ImportClubs from '@/components/clubs/ImportClubs'
import { getTranslations } from 'next-intl/server'

export default async function ClubsPage() {
  const t = await getTranslations()

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
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

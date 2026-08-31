'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import * as Sentry from '@sentry/nextjs'
import toast from 'react-hot-toast'
import ImportClubs from '@/components/clubs/ImportClubs'

const supabase = createClient()

const COUNTRIES = [
  { code: 'BE', flag: '🇧🇪' }, { code: 'FR', flag: '🇫🇷' }, { code: 'NL', flag: '🇳🇱' },
  { code: 'LU', flag: '🇱🇺' }, { code: 'DE', flag: '🇩🇪' }, { code: 'GB', flag: '🇬🇧' },
  { code: 'ES', flag: '🇪🇸' }, { code: 'PT', flag: '🇵🇹' }, { code: 'IT', flag: '🇮🇹' },
  { code: 'CH', flag: '🇨🇭' }, { code: 'OTHER', flag: '🌍' },
]

const inputClass = "w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:border-blue-300"

export default function AddClubPage() {
  const router = useRouter()
  const t = useTranslations()

  const [name, setName]       = useState('')
  const [country, setCountry] = useState('BE')
  const [region, setRegion]   = useState('')
  const [saving, setSaving]   = useState(false)

  async function handleCreateClub() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const { data, error } = await supabase.from('clubs')
        .insert({ name: name.trim(), country, region: region.trim() || null })
        .select('id').single()
      if (error) throw error
      if (data) router.push(`/admin/clubs/${data.id}`)
    } catch (err) {
      Sentry.captureException(err, { tags: { feature: 'clubs', action: 'create_club' } })
      toast.error(t('errors.generic') ?? 'Une erreur est survenue')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl">
      <button onClick={() => router.push('/admin/clubs')} className="text-[12px] text-gray-400 hover:text-gray-600 mb-3 inline-flex items-center gap-1">
        ← {t('clubs.backToList')}
      </button>

      <div className="mb-6">
        <h1 className="text-[18px] font-medium text-gray-900">{t('clubs.newClubTitle')}</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 items-start">

        {/* ── Plaque Import Excel ── */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
            {t('clubs.import')}
          </p>
          <ImportClubs />
        </div>

        {/* ── Plaque Import manuel ── */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
            {t('clubs.manual')}
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-[12px] font-medium text-gray-500 mb-1.5">{t('clubs.newClub')}</label>
              <input value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateClub()}
                placeholder={t('clubs.newClub')} className={inputClass} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[12px] font-medium text-gray-500 mb-1.5">{t('clubs.country')}</label>
                <select value={country} onChange={e => setCountry(e.target.value)} className={inputClass}>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[12px] font-medium text-gray-500 mb-1.5">{t('clubs.region')}</label>
                <input value={region} onChange={e => setRegion(e.target.value)}
                  placeholder={t('clubs.regionPlaceholder')} className={inputClass} />
              </div>
            </div>
            <button onClick={handleCreateClub} disabled={saving || !name.trim()}
              className="w-full bg-[#185FA5] text-white text-[13px] font-semibold py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-40 transition-colors">
              {saving ? t('clubs.saving') : t('clubs.createAndContinue')}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

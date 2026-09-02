'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

const supabase = createClient()

const COUNTRY_FLAGS: Record<string, string> = {
  BE: '🇧🇪', FR: '🇫🇷', NL: '🇳🇱', LU: '🇱🇺', DE: '🇩🇪',
  GB: '🇬🇧', ES: '🇪🇸', PT: '🇵🇹', IT: '🇮🇹', CH: '🇨🇭', OTHER: '🌍',
}

type Club = { id: string; name: string; country: string; region: string | null }

const selectClass = "border border-gray-200 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:border-blue-300"

export default function ClubsPage() {
  const router = useRouter()
  const t = useTranslations()

  const [search,   setSearch]   = useState('')
  const [country,  setCountry]  = useState('')
  const [region,   setRegion]   = useState('')
  const [results,  setResults]  = useState<Club[]>([])
  const [loading,  setLoading]  = useState(false)

  const [allCountries, setAllCountries] = useState<string[]>([])
  const [allRegions,   setAllRegions]   = useState<string[]>([])

  // Liste des pays/régions déjà présents en base, pour peupler les filtres —
  // pas de liste figée à maintenir à la main.
  useEffect(() => {
    supabase.from('clubs').select('country, region').then(({ data }) => {
      const countries = new Set<string>()
      const regions   = new Set<string>()
      ;(data ?? []).forEach(c => {
        if (c.country) countries.add(c.country)
        if (c.region)  regions.add(c.region)
      })
      setAllCountries([...countries].sort())
      setAllRegions([...regions].sort())
    })
  }, [])

  const searchActive = search.trim().length >= 3 || !!country || !!region

  useEffect(() => {
    if (!searchActive) { setResults([]); return }
    const handle = setTimeout(runSearch, 250) // léger debounce le temps de taper
    return () => clearTimeout(handle)
  }, [search, country, region])

  async function runSearch() {
    setLoading(true)
    let query = supabase.from('clubs').select('id, name, country, region').order('name').limit(100)
    if (search.trim().length >= 3) query = query.ilike('name', `%${search.trim()}%`)
    if (country) query = query.eq('country', country)
    if (region)  query = query.eq('region', region)
    const { data } = await query
    setResults(data ?? [])
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[18px] font-medium text-gray-900">{t('clubs.title')}</h1>
          <p className="text-[13px] text-gray-900 mt-0.5">{t('clubs.subtitle')}</p>
        </div>
        <button onClick={() => router.push('/admin/clubs/add')}
          className="flex items-center gap-2 bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] transition-colors">
          + {t('clubs.newClubTitle')}
        </button>
      </div>

      {/* ── Panneau recherche + filtres ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('clubs.searchPlaceholder')}
            className={selectClass + ' flex-1'}
          />
          <select value={country} onChange={e => setCountry(e.target.value)} className={selectClass}>
            <option value="">{t('clubs.allCountries')}</option>
            {allCountries.map(c => <option key={c} value={c}>{COUNTRY_FLAGS[c] ?? ''} {c}</option>)}
          </select>
          <select value={region} onChange={e => setRegion(e.target.value)} className={selectClass}>
            <option value="">{t('clubs.allRegions')}</option>
            {allRegions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        {!searchActive && (
          <p className="text-[12px] text-gray-400 mt-3">{t('clubs.searchHint')}</p>
        )}
      </div>

      {/* ── Résultats ── */}
      {searchActive && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {loading ? (
            <p className="p-4 text-[13px] text-gray-400">…</p>
          ) : results.length === 0 ? (
            <div className="p-4">
              <p className="text-[13px] text-gray-400">{t('clubs.noResults')}</p>
              <p className="text-[13px] text-gray-500 mt-1">
                {t('clubs.noResultsTryApi')}{' '}
                <button onClick={() => router.push('/admin/clubs/add')} className="text-[#185FA5] font-semibold hover:underline">
                  {t('clubs.noResultsTryApiLink')}
                </button>
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {results.map(c => (
                <button
                  key={c.id}
                  onClick={() => router.push(`/admin/clubs/${c.id}`)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-[13px] font-medium text-gray-800">{c.name}</span>
                  <span className="text-[12px] text-gray-400 flex items-center gap-1.5">
                    {c.region && <span>{c.region}</span>}
                    <span>{COUNTRY_FLAGS[c.country] ?? ''} {c.country}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

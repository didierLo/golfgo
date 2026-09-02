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

// Best-effort : déduit un code pays golfgo à partir de l'adresse texte renvoyée par
// GolfCourseAPI. Le pays reste de toute façon éditable ensuite sur la page du club.
function guessCountry(address: string | undefined): string {
  if (!address) return 'BE'
  const a = address.toLowerCase()
  if (a.includes('belgi') || a.includes('belgique')) return 'BE'
  if (a.includes('france')) return 'FR'
  if (a.includes('nederland') || a.includes('netherlands')) return 'NL'
  if (a.includes('luxembourg')) return 'LU'
  if (a.includes('deutschland') || a.includes('germany')) return 'DE'
  if (a.includes('united kingdom') || a.includes(', uk') || a.endsWith(' uk')) return 'GB'
  if (a.includes('españa') || a.includes('spain')) return 'ES'
  if (a.includes('portugal')) return 'PT'
  if (a.includes('italia') || a.includes('italy')) return 'IT'
  if (a.includes('switzerland') || a.includes('suisse') || a.includes('schweiz')) return 'CH'
  return 'OTHER'
}

type ApiSearchResult = { id: number; club_name: string; course_name: string; location?: { address?: string } }
type ApiHole = { par: number; yardage?: number; handicap: number }
type ApiTee = { tee_name: string; course_rating: number; slope_rating: number; par_total: number; total_yards?: number; number_of_holes?: number; holes?: ApiHole[] }
type ApiCourseDetail = { course: { id: number; club_name: string; course_name: string; location?: { address?: string }; tees?: { male?: ApiTee[]; female?: ApiTee[] } } }

// FlyAway
type FlyTeebox = { teebox_id: string; name: string; gender?: string; slope?: number; rating?: number; distances: number[] }
type FlyGrid = { grid_id: string; par: number[]; handicap: number[]; teeboxes: FlyTeebox[] }
type FlyScorecard = { scorecard_id: string; name: string; holesCount: number; grid: FlyGrid[] }
type FlyProfile = { golf_id: string; name: string; slug: string; country?: string; region?: string; city?: string; address?: string; scorecards?: FlyScorecard[] }

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  belgium: 'BE', france: 'FR', netherlands: 'NL', luxembourg: 'LU', germany: 'DE',
  'united kingdom': 'GB', spain: 'ES', portugal: 'PT', italy: 'IT', switzerland: 'CH',
}

export default function AddClubPage() {
  const router = useRouter()
  const t = useTranslations()

  const [name, setName]       = useState('')
  const [country, setCountry] = useState('BE')
  const [region, setRegion]   = useState('')
  const [saving, setSaving]   = useState(false)

  // ── Panneau GolfCourseAPI ──
  const [apiQuery,     setApiQuery]     = useState('')
  const [apiResults,   setApiResults]   = useState<ApiSearchResult[]>([])
  const [apiSearching, setApiSearching] = useState(false)
  const [apiError,     setApiError]     = useState('')
  const [apiDetail,    setApiDetail]    = useState<ApiCourseDetail['course'] | null>(null)
  const [apiLoadingDetail, setApiLoadingDetail] = useState(false)
  const [apiImporting, setApiImporting] = useState(false)

  async function handleApiSearch() {
    if (apiQuery.trim().length < 2) return
    setApiSearching(true); setApiError(''); setApiResults([]); setApiDetail(null)
    try {
      const res = await fetch(`/api/admin/golfcourseapi/search?q=${encodeURIComponent(apiQuery.trim())}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setApiResults(json.courses ?? [])
      if ((json.courses ?? []).length === 0) setApiError('Aucun résultat.')
    } catch (e: any) {
      setApiError(e.message ?? 'Erreur')
    } finally {
      setApiSearching(false)
    }
  }

  async function handleApiSelect(id: number) {
    setApiLoadingDetail(true); setApiError(''); setApiDetail(null)
    try {
      const res = await fetch(`/api/admin/golfcourseapi/course/${id}`)
      const json: ApiCourseDetail | { error: string } = await res.json()
      if (!res.ok || 'error' in json) throw new Error('error' in json ? json.error : 'Erreur')
      setApiDetail(json.course)
    } catch (e: any) {
      setApiError(e.message ?? 'Erreur')
    } finally {
      setApiLoadingDetail(false)
    }
  }

  async function handleApiImport() {
    if (!apiDetail) return
    setApiImporting(true)
    try {
      const clubName = apiDetail.club_name || apiDetail.course_name
      const courseName = apiDetail.course_name || apiDetail.club_name

      // Club : retrouver ou créer
      let clubId: string
      const { data: existingClub } = await supabase.from('clubs').select('id').ilike('name', clubName).maybeSingle()
      if (existingClub) {
        clubId = existingClub.id
      } else {
        const { data: newClub, error } = await supabase.from('clubs')
          .insert({ name: clubName, country: guessCountry(apiDetail.location?.address) })
          .select('id').single()
        if (error || !newClub) throw new Error(error?.message ?? 'Erreur création club')
        clubId = newClub.id
      }

      // Parcours : retrouver ou créer
      let courseId: string
      const { data: existingCourse } = await supabase.from('courses').select('id')
        .eq('club_id', clubId).ilike('course_name', courseName).maybeSingle()
      if (existingCourse) {
        courseId = existingCourse.id
      } else {
        const { data: newCourse, error } = await supabase.from('courses')
          .insert({ club_id: clubId, course_name: courseName }).select('id').single()
        if (error || !newCourse) throw new Error(error?.message ?? 'Erreur création parcours')
        courseId = newCourse.id
      }

      // Tees (hommes + dames, en évitant les doublons de nom)
      const maleTees   = apiDetail.tees?.male ?? []
      const femaleTees = apiDetail.tees?.female ?? []
      const maleNames  = new Set(maleTees.map(t => t.tee_name))
      const teeRows = [
        ...maleTees.map(t => ({ tee_name: t.tee_name, par_total: t.par_total, course_rating: t.course_rating, slope: t.slope_rating, distance_total: t.total_yards ?? null })),
        ...femaleTees.map(t => ({ tee_name: maleNames.has(t.tee_name) ? `${t.tee_name} (F)` : t.tee_name, par_total: t.par_total, course_rating: t.course_rating, slope: t.slope_rating, distance_total: t.total_yards ?? null })),
      ]
      if (teeRows.length > 0) {
        await supabase.from('course_tees').insert(teeRows.map(t => ({ ...t, course_id: courseId })))
      }

      // Trous : par + stroke index (handicap), à partir du premier jeu de tees qui en a
      const holesSource = maleTees.find(t => t.holes?.length) ?? femaleTees.find(t => t.holes?.length)
      if (holesSource?.holes?.length) {
        const { data: existingHoles } = await supabase.from('course_holes').select('id').eq('course_id', courseId).limit(1)
        if (!existingHoles || existingHoles.length === 0) {
          await supabase.from('course_holes').insert(holesSource.holes.map((h, i) => ({
            course_id: courseId, hole_number: i + 1, par: h.par, stroke_index: h.handicap,
          })))
        }
      }

      toast.success('Importé — vérifie et complète si besoin')
      router.push(`/admin/clubs/${clubId}`)
    } catch (e: any) {
      toast.error(e.message ?? 'Erreur')
    } finally {
      setApiImporting(false)
    }
  }

  // ── Panneau FlyAway ──
  const [flyQuery,     setFlyQuery]     = useState('')
  const [flySearching, setFlySearching] = useState(false)
  const [flyError,     setFlyError]     = useState('')
  const [flyProfile,   setFlyProfile]   = useState<FlyProfile | null>(null)
  const [flyImportingId, setFlyImportingId] = useState<string | null>(null)

  async function handleFlySearch() {
    if (flyQuery.trim().length < 2) return
    setFlySearching(true); setFlyError(''); setFlyProfile(null)
    try {
      const res = await fetch(`/api/admin/flyaway/search?q=${encodeURIComponent(flyQuery.trim())}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      setFlyProfile(json.course)
    } catch (e: any) {
      setFlyError(e.message ?? 'Erreur')
    } finally {
      setFlySearching(false)
    }
  }

  async function handleFlyImport(scorecard: FlyScorecard) {
    if (!flyProfile) return
    const grid = scorecard.grid?.[0]
    if (!grid) return
    setFlyImportingId(scorecard.scorecard_id)
    try {
      const clubName = flyProfile.name
      const countryCode = COUNTRY_NAME_TO_CODE[(flyProfile.country ?? '').toLowerCase()] ?? 'OTHER'

      // Club : retrouver ou créer (complète la région si elle manquait)
      let clubId: string
      const { data: existingClub } = await supabase.from('clubs').select('id, region').ilike('name', clubName).maybeSingle()
      if (existingClub) {
        clubId = existingClub.id
        if (!existingClub.region && flyProfile.region) {
          await supabase.from('clubs').update({ region: flyProfile.region }).eq('id', clubId)
        }
      } else {
        const { data: newClub, error } = await supabase.from('clubs')
          .insert({ name: clubName, country: countryCode, region: flyProfile.region ?? null })
          .select('id').single()
        if (error || !newClub) throw new Error(error?.message ?? 'Erreur création club')
        clubId = newClub.id
      }

      // Parcours : un nom distinct par scorecard s'il y en a plusieurs (ex. plusieurs 18 trous du même club)
      const courseName = (flyProfile.scorecards?.length ?? 0) > 1 ? `${flyProfile.name} — ${scorecard.name}` : flyProfile.name
      let courseId: string
      const { data: existingCourse } = await supabase.from('courses').select('id')
        .eq('club_id', clubId).ilike('course_name', courseName).maybeSingle()
      if (existingCourse) {
        courseId = existingCourse.id
      } else {
        const { data: newCourse, error } = await supabase.from('courses')
          .insert({ club_id: clubId, course_name: courseName }).select('id').single()
        if (error || !newCourse) throw new Error(error?.message ?? 'Erreur création parcours')
        courseId = newCourse.id
      }

      // Tees — un nom peut apparaître deux fois (une fois par genre), on suffixe pour éviter les doublons
      const seenNames = new Set<string>()
      const teeRows = grid.teeboxes.map(tb => {
        let teeName = tb.name
        if (seenNames.has(teeName)) teeName = `${teeName} (${tb.gender === 'F' || tb.gender === 'female' ? 'D' : 'H'})`
        seenNames.add(tb.name)
        const total = tb.distances.reduce((s, d) => s + d, 0)
        return {
          course_id: courseId, tee_name: teeName,
          par_total: grid.par.reduce((s, p) => s + p, 0),
          course_rating: tb.rating ?? null, slope: tb.slope ?? null,
          distance_total: total || null,
        }
      })
      if (teeRows.length > 0) {
        await supabase.from('course_tees').insert(teeRows)
      }

      // Trous : par + stroke index directement depuis la grille
      const { data: existingHoles } = await supabase.from('course_holes').select('id').eq('course_id', courseId).limit(1)
      if (!existingHoles || existingHoles.length === 0) {
        await supabase.from('course_holes').insert(grid.par.map((par, i) => ({
          course_id: courseId, hole_number: i + 1, par, stroke_index: grid.handicap[i],
        })))
      }

      toast.success('Importé — vérifie et complète si besoin')
      router.push(`/admin/clubs/${clubId}`)
    } catch (e: any) {
      toast.error(e.message ?? 'Erreur')
    } finally {
      setFlyImportingId(null)
    }
  }

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

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 items-start">

        {/* ── Plaque FlyAway ── */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Recherche FlyAway
          </p>
          <div className="flex gap-2 mb-3">
            <input value={flyQuery} onChange={e => setFlyQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFlySearch()}
              placeholder="Nom exact du club" className={inputClass} />
            <button onClick={handleFlySearch} disabled={flySearching || flyQuery.trim().length < 2}
              className="bg-[#185FA5] text-white text-[12px] font-medium px-4 rounded-md hover:bg-[#0C447C] disabled:opacity-40 transition-colors whitespace-nowrap">
              {flySearching ? '…' : 'Chercher'}
            </button>
          </div>

          {flyError && <p className="text-[12px] text-red-600 mb-2">{flyError}</p>}

          {flyProfile && (
            <div className="border border-gray-100 rounded-md p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="text-[13px] font-semibold text-gray-900">{flyProfile.name}</div>
                  <div className="text-[12px] text-gray-500">{[flyProfile.city, flyProfile.region, flyProfile.country].filter(Boolean).join(', ')}</div>
                </div>
                <button onClick={() => setFlyProfile(null)} className="text-[12px] text-gray-400 hover:text-gray-600">✕</button>
              </div>

              {(flyProfile.scorecards ?? []).length === 0 && (
                <p className="text-amber-600 text-[12px]">Aucune carte de score trouvée pour ce parcours.</p>
              )}

              {(flyProfile.scorecards ?? []).map(sc => {
                const grid = sc.grid?.[0]
                return (
                  <div key={sc.scorecard_id} className="border-t border-gray-100 pt-2 mt-2 first:border-t-0 first:pt-0 first:mt-0">
                    <div className="text-[12px] font-medium text-gray-700 mb-1">{sc.name} ({sc.holesCount} trous)</div>
                    {grid ? (
                      <>
                        <div className="text-[12px] text-gray-600 space-y-0.5 mb-2">
                          {grid.teeboxes.map((tb, i) => (
                            <div key={i}>{tb.name}{tb.gender ? ` (${tb.gender})` : ''} — slope {tb.slope ?? '—'}, CR {tb.rating ?? '—'}</div>
                          ))}
                        </div>
                        <button onClick={() => handleFlyImport(sc)} disabled={flyImportingId === sc.scorecard_id}
                          className="w-full bg-[#185FA5] text-white text-[12px] font-semibold py-1.5 rounded-md hover:bg-[#0C447C] disabled:opacity-40 transition-colors">
                          {flyImportingId === sc.scorecard_id ? 'Import…' : 'Importer cette carte'}
                        </button>
                      </>
                    ) : (
                      <p className="text-[12px] text-gray-400">Pas de détail disponible.</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Plaque GolfCourseAPI ── */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Recherche GolfCourseAPI
          </p>
          <div className="flex gap-2 mb-3">
            <input value={apiQuery} onChange={e => setApiQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleApiSearch()}
              placeholder="Nom du club" className={inputClass} />
            <button onClick={handleApiSearch} disabled={apiSearching || apiQuery.trim().length < 2}
              className="bg-[#185FA5] text-white text-[12px] font-medium px-4 rounded-md hover:bg-[#0C447C] disabled:opacity-40 transition-colors whitespace-nowrap">
              {apiSearching ? '…' : 'Chercher'}
            </button>
          </div>

          {apiError && <p className="text-[12px] text-red-600 mb-2">{apiError}</p>}

          {!apiDetail && apiResults.length > 0 && (
            <div className="border border-gray-100 rounded-md divide-y divide-gray-100 max-h-64 overflow-y-auto">
              {apiResults.map(r => (
                <button key={r.id} onClick={() => handleApiSelect(r.id)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors">
                  <div className="text-[13px] font-medium text-gray-800">{r.club_name}</div>
                  {r.course_name !== r.club_name && <div className="text-[12px] text-gray-500">{r.course_name}</div>}
                  {r.location?.address && <div className="text-[11px] text-gray-400 truncate">{r.location.address}</div>}
                </button>
              ))}
            </div>
          )}

          {apiLoadingDetail && <p className="text-[12px] text-gray-400">Chargement…</p>}

          {apiDetail && (
            <div className="border border-gray-100 rounded-md p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="text-[13px] font-semibold text-gray-900">{apiDetail.club_name}</div>
                  <div className="text-[12px] text-gray-500">{apiDetail.course_name}</div>
                </div>
                <button onClick={() => setApiDetail(null)} className="text-[12px] text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="text-[12px] text-gray-600 space-y-0.5 mb-3">
                {[...(apiDetail.tees?.male ?? []), ...(apiDetail.tees?.female ?? [])].map((t, i) => (
                  <div key={i}>
                    {t.tee_name} — par {t.par_total}, CR {t.course_rating}, slope {t.slope_rating}
                    {t.holes?.length ? ` (${t.holes.length} trous détaillés)` : ' (pas de détail trou par trou)'}
                  </div>
                ))}
                {!apiDetail.tees?.male?.length && !apiDetail.tees?.female?.length && (
                  <p className="text-amber-600">Aucun tee trouvé pour ce parcours.</p>
                )}
              </div>
              <button onClick={handleApiImport} disabled={apiImporting}
                className="w-full bg-[#185FA5] text-white text-[12px] font-semibold py-2 rounded-md hover:bg-[#0C447C] disabled:opacity-40 transition-colors">
                {apiImporting ? 'Import…' : 'Importer ce parcours'}
              </button>
            </div>
          )}
        </div>

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

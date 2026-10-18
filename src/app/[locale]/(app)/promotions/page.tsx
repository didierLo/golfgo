'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations, useLocale } from 'next-intl'

const supabase = createClient()

type Kind = 'promo' | 'twilight' | 'winter' | 'pack'
type Promo = {
  id: string
  kind: Kind
  title: string
  price_text: string | null
  description: string | null
  conditions: string | null
  valid_from: string | null   // AAAA-MM-JJ
  valid_to: string | null     // AAAA-MM-JJ
  source_url: string | null
  verified_on: string
  club: { name: string; website: string | null } | null
}

const KINDS: Kind[] = ['promo', 'twilight', 'winter', 'pack']
const KIND_COLOR: Record<Kind, string> = {
  promo:    '#D4537E',
  twilight: '#185FA5',
  winter:   '#1D9E75',
  pack:     '#7F77DD',
}

const DAY_MS = 86_400_000

export default function PromotionsPage() {
  const t      = useTranslations()
  const locale = useLocale()

  const [promos,  setPromos]  = useState<Promo[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)
  const [filter,  setFilter]  = useState<'all' | Kind>('all')

  // Date du jour au format AAAA-MM-JJ, dans le fuseau de l'utilisateur
  const today = useMemo(() => new Date().toLocaleDateString('sv-SE'), [])

  function parseDay(d: string) { return new Date(`${d}T00:00:00`) }
  function formatDay(d: string) {
    return parseDay(d).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(false)
    const { data, error: err } = await supabase
      .from('club_promotions')
      .select('id, kind, title, price_text, description, conditions, valid_from, valid_to, source_url, verified_on, clubs(name, website)')
      .eq('active', true)
    if (err) { console.error(err); setError(true); setLoading(false); return }

    const rows: Promo[] = (data || []).map((r: any) => {
      const c = Array.isArray(r.clubs) ? r.clubs[0] : r.clubs
      return {
        id: r.id, kind: r.kind, title: r.title, price_text: r.price_text,
        description: r.description, conditions: r.conditions,
        valid_from: r.valid_from, valid_to: r.valid_to,
        source_url: r.source_url, verified_on: r.verified_on,
        club: c ? { name: String(c.name ?? '').trim(), website: c.website ?? null } : null,
      }
    })
    setPromos(rows)
    setLoading(false)
  }

  // Les offres dont la date de fin est dépassée ne sont plus affichées
  const current = useMemo(
    () => promos.filter(p => !p.valid_to || p.valid_to >= today),
    [promos, today]
  )

  const visible = useMemo(() => {
    const list = current.filter(p => filter === 'all' || p.kind === filter)
    return [...list].sort((a, b) => {
      const ka = KINDS.indexOf(a.kind), kb = KINDS.indexOf(b.kind)
      if (ka !== kb) return ka - kb
      // Promotions : celles qui se terminent le plus tôt d'abord
      if (a.kind === 'promo') {
        const va = a.valid_to ?? '9999-12-31', vb = b.valid_to ?? '9999-12-31'
        if (va !== vb) return va < vb ? -1 : 1
      }
      return (a.club?.name ?? '').localeCompare(b.club?.name ?? '', locale)
    })
  }, [current, filter, locale])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: current.length }
    KINDS.forEach(k => { c[k] = current.filter(p => p.kind === k).length })
    return c
  }, [current])

  function rangeLabel(p: Promo) {
    if (p.valid_from && p.valid_to) return t('promotions.rangeBoth', { from: formatDay(p.valid_from), to: formatDay(p.valid_to) })
    if (p.valid_to)                 return t('promotions.rangeUntil', { date: formatDay(p.valid_to) })
    if (p.valid_from)               return t('promotions.rangeFrom',  { date: formatDay(p.valid_from) })
    return t('promotions.rangeUnknown')
  }

  function endsSoon(p: Promo) {
    if (!p.valid_to) return false
    const days = (parseDay(p.valid_to).getTime() - parseDay(today).getTime()) / DAY_MS
    return days >= 0 && days <= 14
  }
  const comingSoon = (p: Promo) => !!p.valid_from && p.valid_from > today

  return (
    <div className="p-5 sm:p-6 max-w-3xl">

      {/* En-tête */}
      <div className="mb-5">
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight leading-none">{t('promotions.title')}</h1>
        <p className="text-[13px] text-slate-900 mt-1.5">{t('promotions.subtitle')}</p>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['all', ...KINDS] as const).map(k => {
          const active = filter === k
          if (k !== 'all' && counts[k] === 0) return null
          return (
            <button key={k} type="button" onClick={() => setFilter(k)}
              className={`px-4 py-2.5 rounded-full text-[13px] font-semibold border transition-colors ${
                active ? 'bg-[#185FA5] text-white border-[#185FA5] shadow-sm'
                       : 'bg-white/85 text-slate-700 border-white/70 hover:bg-white'}`}>
              {k === 'all' ? t('promotions.all') : t(`promotions.kind.${k}` as any)}
              <span className={`ml-1.5 ${active ? 'text-white/80' : 'text-slate-400'}`}>{counts[k]}</span>
            </button>
          )
        })}
      </div>

      {/* Avertissement */}
      <div className="rounded-xl border border-white/60 px-4 py-3 mb-5 text-[12px] text-slate-700 leading-relaxed"
        style={{ background: 'rgba(255,255,255,0.85)' }}>
        {t('promotions.disclaimer')}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-white/40 rounded-2xl animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="text-center py-12 text-[13px] text-slate-600 border border-dashed border-slate-300 rounded-xl on-bg-card">
          {t('promotions.loadError')}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-12 text-[13px] text-slate-600 border border-dashed border-slate-300 rounded-xl on-bg-card">
          {t('promotions.empty')}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(p => (
            <article key={p.id}
              className="rounded-2xl border border-white/60 shadow-sm p-4 sm:p-5"
              style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-slate-500">{p.club?.name ?? ''}</p>
                  <h2 className="text-[16px] font-black text-slate-900 leading-snug mt-0.5">{p.title}</h2>
                </div>
                <span className="flex-shrink-0 text-[11px] font-bold text-white px-2.5 py-1 rounded-full"
                  style={{ background: KIND_COLOR[p.kind] }}>
                  {t(`promotions.kind.${p.kind}` as any)}
                </span>
              </div>

              {p.price_text && (
                <p className="text-[18px] font-black mt-2" style={{ color: KIND_COLOR[p.kind] }}>{p.price_text}</p>
              )}
              {p.description && <p className="text-[13px] text-slate-800 mt-1.5 leading-relaxed">{p.description}</p>}

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-[12px] font-semibold text-slate-700">📅 {rangeLabel(p)}</span>
                {endsSoon(p) && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{t('promotions.endsSoon')}</span>
                )}
                {comingSoon(p) && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">{t('promotions.comingSoon')}</span>
                )}
              </div>

              {p.conditions && (
                <p className="text-[12px] text-slate-600 mt-2 leading-relaxed">
                  <span className="font-semibold">{t('promotions.conditions')} : </span>{p.conditions}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-4">
                {p.source_url && (
                  <a href={p.source_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center justify-center min-h-[40px] px-4 rounded-xl bg-[#185FA5] text-white text-[13px] font-semibold hover:bg-[#144f8a] transition-colors">
                    {t('promotions.offerLink')}
                  </a>
                )}
                {p.club?.website && (
                  <a href={p.club.website} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center justify-center min-h-[40px] px-4 rounded-xl border border-slate-300 bg-white text-slate-700 text-[13px] font-semibold hover:bg-slate-50 transition-colors">
                    {t('promotions.clubSite')}
                  </a>
                )}
                <span className="text-[11px] text-slate-400 sm:ml-auto">
                  {t('promotions.verifiedOn', { date: formatDay(p.verified_on) })}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

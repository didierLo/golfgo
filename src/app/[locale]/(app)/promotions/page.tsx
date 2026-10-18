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
  verified_on: string         // AAAA-MM-JJ
  origin: 'auto' | 'manual'   // 'manual' = carte saisie par un admin de groupe
  created_by: string | null
  club_id: string
  club: { name: string; website: string | null } | null
}

type ClubOption = { id: string; name: string }
type FormState = {
  club_id: string; kind: Kind; title: string; price_text: string; description: string
  conditions: string; valid_from: string; valid_to: string; source_url: string
}
const EMPTY_FORM: FormState = {
  club_id: '', kind: 'promo', title: '', price_text: '', description: '',
  conditions: '', valid_from: '', valid_to: '', source_url: '',
}

const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2.5 text-[14px] bg-white focus:outline-none focus:border-blue-400'
const labelClass = 'block text-[12px] font-semibold text-slate-700 mb-1'

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

  // Admin de groupe : peut ajouter / modifier / supprimer ses propres cartes
  const [userId,    setUserId]    = useState<string | null>(null)
  const [isOwner,   setIsOwner]   = useState(false)
  const [clubs,     setClubs]     = useState<ClubOption[]>([])
  const [formOpen,  setFormOpen]  = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM)
  const [saving,    setSaving]    = useState(false)
  const [formError, setFormError] = useState('')

  // Date du jour au format AAAA-MM-JJ, dans le fuseau de l'utilisateur
  const today = useMemo(() => new Date().toLocaleDateString('sv-SE'), [])

  function parseDay(d: string) { return new Date(`${d}T00:00:00`) }
  function formatDay(d: string) {
    return parseDay(d).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  }

  useEffect(() => { load(); loadOwner() }, [])

  async function loadOwner() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const { data: gp } = await supabase
      .from('groups_players').select('id').eq('user_id', user.id).eq('role', 'owner').limit(1)
    if (!gp || gp.length === 0) return
    setIsOwner(true)
    const { data: cl } = await supabase.from('clubs').select('id, name').order('name')
    setClubs((cl || [])
      .map((c: any) => ({ id: c.id as string, name: String(c.name ?? '').trim() }))
      .sort((a, b) => a.name.localeCompare(b.name, locale)))
  }

  async function load() {
    setLoading(true)
    setError(false)
    const { data, error: err } = await supabase
      .from('club_promotions')
      .select('id, club_id, kind, title, price_text, description, conditions, valid_from, valid_to, source_url, verified_on, origin, created_by, clubs(name, website)')
      .eq('active', true)
    if (err) { console.error(err); setError(true); setLoading(false); return }

    const rows: Promo[] = (data || []).map((r: any) => {
      const c = Array.isArray(r.clubs) ? r.clubs[0] : r.clubs
      return {
        id: r.id, kind: r.kind, title: r.title, price_text: r.price_text,
        description: r.description, conditions: r.conditions,
        valid_from: r.valid_from, valid_to: r.valid_to,
        source_url: r.source_url, verified_on: r.verified_on,
        origin: r.origin === 'manual' ? 'manual' : 'auto', created_by: r.created_by ?? null, club_id: r.club_id,
        club: c ? { name: String(c.name ?? '').trim(), website: c.website ?? null } : null,
      }
    })
    setPromos(rows)
    setLoading(false)
  }

  // Date de la dernière mise à jour = la vérification la plus récente de toutes les offres
  const lastUpdate = useMemo(
    () => promos.filter(p => p.origin === 'auto')
      .reduce<string | null>((max, p) => (!max || p.verified_on > max ? p.verified_on : max), null),
    [promos]
  )

  // Les offres dont la date de fin est dépassée ne sont plus affichées
  const current = useMemo(
    () => promos.filter(p => !p.valid_to || p.valid_to >= today),
    [promos, today]
  )

  // Regroupées par type ; dans « Promotions », celles qui se terminent le plus tôt d'abord
  const sections = useMemo(() => KINDS.map(kind => {
    const items = current.filter(p => p.kind === kind).sort((a, b) => {
      if (kind === 'promo') {
        const va = a.valid_to ?? '9999-12-31', vb = b.valid_to ?? '9999-12-31'
        if (va !== vb) return va < vb ? -1 : 1
      }
      return (a.club?.name ?? '').localeCompare(b.club?.name ?? '', locale)
    })
    return { kind, items }
  }).filter(s => s.items.length > 0), [current, locale])

  function openAdd() {
    setEditingId(null); setForm(EMPTY_FORM); setFormError(''); setFormOpen(true)
  }
  function openEdit(p: Promo) {
    setEditingId(p.id); setFormError(''); setFormOpen(true)
    setForm({
      club_id: p.club_id, kind: p.kind, title: p.title, price_text: p.price_text ?? '',
      description: p.description ?? '', conditions: p.conditions ?? '',
      valid_from: p.valid_from ?? '', valid_to: p.valid_to ?? '', source_url: p.source_url ?? '',
    })
  }
  function closeForm() { setFormOpen(false); setEditingId(null); setFormError('') }
  const setField = (k: keyof FormState, v: string) => setForm(f => ({ ...f, [k]: v } as FormState))

  async function save() {
    setFormError('')
    if (!userId) return
    if (!form.club_id)      { setFormError(t('promotions.form.errClub'));  return }
    if (!form.title.trim()) { setFormError(t('promotions.form.errTitle')); return }
    if (form.valid_from && form.valid_to && form.valid_from > form.valid_to) {
      setFormError(t('promotions.form.errDates')); return
    }
    let url = form.source_url.trim()
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`
    if (url) {
      try { new URL(url) } catch { setFormError(t('promotions.form.errUrl')); return }
    }
    const nn = (v: string) => (v.trim() ? v.trim() : null)
    const fields = {
      club_id: form.club_id, kind: form.kind, title: form.title.trim(),
      price_text: nn(form.price_text), description: nn(form.description), conditions: nn(form.conditions),
      valid_from: form.valid_from || null, valid_to: form.valid_to || null,
      source_url: url || null, verified_on: today,
    }
    setSaving(true)
    const { error: err } = editingId
      ? await supabase.from('club_promotions').update(fields).eq('id', editingId)
      : await supabase.from('club_promotions').insert({ ...fields, origin: 'manual', created_by: userId, active: true })
    setSaving(false)
    if (err) { console.error(err); setFormError(t('promotions.form.errSave')); return }
    closeForm()
    load()
  }

  async function remove(p: Promo) {
    if (!window.confirm(t('promotions.form.confirmDelete'))) return
    const { error: err } = await supabase.from('club_promotions').delete().eq('id', p.id)
    if (err) { console.error(err); window.alert(t('promotions.form.errSave')); return }
    load()
  }

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
        {lastUpdate && (
          <p className="text-[13px] font-semibold text-slate-900 mt-1.5">
            🔄 {t('promotions.lastUpdate', { date: formatDay(lastUpdate) })}
          </p>
        )}
      </div>

      {isOwner && !formOpen && (
        <button onClick={openAdd}
          className="mb-5 inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl bg-[#D4537E] text-white text-[14px] font-semibold hover:opacity-90 transition-opacity">
          + {t('promotions.form.add')}
        </button>
      )}

      {/* Formulaire d'ajout / modification (admins de groupe) */}
      {isOwner && formOpen && (
        <div className="rounded-2xl border border-white/60 shadow-sm p-4 sm:p-5 mb-5 space-y-3"
          style={{ background: 'rgba(255,255,255,0.95)' }}>
          <h2 className="text-[15px] font-black text-slate-900">
            {editingId ? t('promotions.form.editTitle') : t('promotions.form.addTitle')}
          </h2>

          <div>
            <label className={labelClass}>{t('promotions.form.club')} *</label>
            <select className={inputClass} value={form.club_id} onChange={e => setField('club_id', e.target.value)}>
              <option value="">{t('promotions.form.clubPlaceholder')}</option>
              {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>{t('promotions.form.kind')} *</label>
            <select className={inputClass} value={form.kind} onChange={e => setField('kind', e.target.value)}>
              {KINDS.map(k => <option key={k} value={k}>{t(`promotions.kind.${k}` as any)}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>{t('promotions.form.title')} *</label>
            <input className={inputClass} maxLength={120} value={form.title} onChange={e => setField('title', e.target.value)} />
          </div>

          <div>
            <label className={labelClass}>{t('promotions.form.price')}</label>
            <input className={inputClass} maxLength={60} placeholder={t('promotions.form.pricePlaceholder')}
              value={form.price_text} onChange={e => setField('price_text', e.target.value)} />
          </div>

          <div>
            <label className={labelClass}>{t('promotions.form.description')}</label>
            <textarea className={inputClass} rows={3} maxLength={500} value={form.description}
              onChange={e => setField('description', e.target.value)} />
          </div>

          <div>
            <label className={labelClass}>{t('promotions.form.conditions')}</label>
            <textarea className={inputClass} rows={2} maxLength={300} value={form.conditions}
              onChange={e => setField('conditions', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t('promotions.form.validFrom')}</label>
              <input type="date" className={inputClass} value={form.valid_from} onChange={e => setField('valid_from', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>{t('promotions.form.validTo')}</label>
              <input type="date" className={inputClass} value={form.valid_to} onChange={e => setField('valid_to', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelClass}>{t('promotions.form.url')}</label>
            <input className={inputClass} inputMode="url" placeholder="https://" value={form.source_url}
              onChange={e => setField('source_url', e.target.value)} />
          </div>

          <p className="text-[12px] text-slate-500">{t('promotions.form.note')}</p>
          {formError && <p className="text-[13px] font-semibold text-red-600">{formError}</p>}

          <div className="flex flex-wrap gap-2 pt-1">
            <button onClick={save} disabled={saving}
              className="min-h-[44px] px-5 rounded-xl bg-[#185FA5] text-white text-[14px] font-semibold hover:bg-[#144f8a] disabled:opacity-50 transition-colors">
              {saving ? t('promotions.form.saving') : t('promotions.form.save')}
            </button>
            <button onClick={closeForm} disabled={saving}
              className="min-h-[44px] px-5 rounded-xl border border-slate-300 bg-white text-slate-700 text-[14px] font-semibold hover:bg-slate-50 transition-colors">
              {t('promotions.form.cancel')}
            </button>
          </div>
        </div>
      )}

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
      ) : sections.length === 0 ? (
        <div className="text-center py-12 text-[13px] text-slate-600 border border-dashed border-slate-300 rounded-xl on-bg-card">
          {t('promotions.empty')}
        </div>
      ) : (
        <div className="space-y-7">
          {sections.map(({ kind, items }) => (
            <section key={kind}>
              <h2 className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.12em] text-slate-900 mb-3">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: KIND_COLOR[kind] }} />
                {t(`promotions.kind.${kind}` as any)}
              </h2>

              <div className="space-y-3">
                {items.map(p => (
                  <article key={p.id}
                    className="rounded-2xl border border-white/60 shadow-sm p-4 sm:p-5"
                    style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>

                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[12px] font-bold uppercase tracking-wide text-slate-500">{p.club?.name ?? ''}</p>
                      {p.origin === 'manual' && (
                        <span className="text-[12px] font-medium text-slate-400">
                          ({t('promotions.manualBadge')})
                        </span>
                      )}
                    </div>
                    <h3 className="text-[16px] font-black text-slate-900 leading-snug mt-0.5">{p.title}</h3>

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
                      {/* Affichée seulement si cette offre a été vérifiée à une autre date que la dernière mise à jour */}
                      {p.origin === 'auto' && lastUpdate && p.verified_on !== lastUpdate && (
                        <span className="text-[11px] text-slate-400 sm:ml-auto">
                          {t('promotions.verifiedOn', { date: formatDay(p.verified_on) })}
                        </span>
                      )}
                      {p.origin === 'manual' && p.created_by === userId && (
                        <span className="flex gap-2 sm:ml-auto">
                          <button onClick={() => openEdit(p)}
                            className="min-h-[40px] px-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-[13px] font-semibold hover:bg-slate-50">
                            {t('promotions.form.edit')}
                          </button>
                          <button onClick={() => remove(p)}
                            className="min-h-[40px] px-3 rounded-xl border border-red-200 bg-white text-red-600 text-[13px] font-semibold hover:bg-red-50">
                            {t('promotions.form.delete')}
                          </button>
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

// Formulaire commun de création ET de modification d'un sondage de dates.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

const supabase = createClient()
const inputClass = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] bg-white"
const labelClass = "block text-[12px] font-semibold text-slate-700 mb-1.5"

type ClubHit = { id: string; name: string; country: string }
type ExistingOption = { id: string; starts_at: string }

// Valeur d'un <input type="datetime-local"> à partir d'une date enregistrée (heure belge lue en UTC)
const toInputValue = (iso: string) => iso.slice(0, 16)

export default function PollForm({ groupId, pollId }: { groupId: string; pollId?: string }) {
  const t = useTranslations()
  const editing = !!pollId

  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState(editing ? '' : t('polls.defaultQuestion'))
  const [location,    setLocation]    = useState('')
  const [clubId,      setClubId]      = useState<string | null>(null)
  const [clubQuery,   setClubQuery]   = useState('')
  const [clubHits,    setClubHits]    = useState<ClubHit[]>([])
  const [dates,       setDates]       = useState<string[]>([''])
  const [existing,    setExisting]    = useState<ExistingOption[]>([])
  const [deadline,    setDeadline]    = useState('')
  const [notify,      setNotify]      = useState(!editing)
  const [loading,     setLoading]     = useState(editing)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  useEffect(() => { if (pollId) loadExisting(pollId) }, [pollId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadExisting(id: string) {
    const [{ data: p }, { data: o }] = await Promise.all([
      supabase.from('polls').select('title, description, location, club_id, deadline, clubs(name)').eq('id', id).maybeSingle(),
      supabase.from('poll_options').select('id, starts_at').eq('poll_id', id).order('starts_at'),
    ])
    if (p) {
      const club = Array.isArray((p as any).clubs) ? (p as any).clubs[0] : (p as any).clubs
      setTitle(p.title ?? '')
      setDescription(p.description ?? '')
      setLocation(p.location ?? '')
      setClubId(p.club_id ?? null)
      setClubQuery(club?.name ?? '')
      setDeadline(p.deadline ?? '')
    }
    setExisting((o ?? []) as ExistingOption[])
    setDates((o ?? []).length ? (o ?? []).map(x => toInputValue(x.starts_at)) : [''])
    setLoading(false)
  }

  async function searchClubs(q: string) {
    setClubQuery(q)
    if (q.trim().length < 2) { setClubHits([]); return }
    const { data } = await supabase.from('clubs').select('id, name, country').ilike('name', `%${q.trim()}%`).order('name').limit(8)
    setClubHits((data ?? []) as ClubHit[])
  }

  function pickClub(c: ClubHit) {
    setClubId(c.id); setLocation(c.name); setClubQuery(c.name); setClubHits([])
    if (!title.trim()) setTitle(`${t('polls.titlePrefix')} ${c.name}`)
  }

  const setDate = (i: number, v: string) => setDates(prev => prev.map((d, j) => (j === i ? v : d)))

  async function notifyMembers(id: string) {
    await fetch('/api/polls/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, pollId: id, mode: 'invite' }),
    }).catch(() => {})
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setError('')
    const clean = Array.from(new Set(dates.filter(Boolean))).sort()
    if (!title.trim()) { setError(t('polls.errNeedTitle')); return }
    if (clean.length === 0) { setError(t('polls.errNeedDate')); return }

    const fields = {
      title:       title.trim(),
      description: description.trim() || null,
      club_id:     clubId,
      location:    location.trim() || null,
      deadline:    deadline || null,
    }

    setSaving(true)
    let currentPollId = pollId ?? ''
    try {
      if (editing && pollId) {
        // Dates retirées : leurs réponses sont supprimées avec elles → on demande confirmation
        const keep = new Set(clean)
        const removed = existing.filter(o => !keep.has(toInputValue(o.starts_at)))
        if (removed.length && !confirm(t('polls.removedConfirm', { count: removed.length }))) { setSaving(false); return }

        const { error: upErr } = await supabase.from('polls').update(fields).eq('id', pollId)
        if (upErr) { setError(upErr.message); setSaving(false); return }

        if (removed.length) {
          const { error: delErr } = await supabase.from('poll_options').delete().in('id', removed.map(o => o.id))
          if (delErr) { setError(delErr.message); setSaving(false); return }
        }
        const have = new Set(existing.map(o => toInputValue(o.starts_at)))
        const added = clean.filter(d => !have.has(d))
        if (added.length) {
          const { error: insErr } = await supabase.from('poll_options').insert(
            added.map((d, i) => ({ poll_id: pollId, starts_at: d, position: existing.length + i })),
          )
          if (insErr) { setError(insErr.message); setSaving(false); return }
        }
        currentPollId = pollId
      } else {
        const { data: poll, error: pollErr } = await supabase.from('polls').insert({ group_id: groupId, ...fields }).select('id').single()
        if (pollErr || !poll) { setError(pollErr?.message ?? t('polls.errGeneric')); setSaving(false); return }
        // Les heures sont enregistrées « telles quelles » (heure belge), comme events.starts_at
        const { error: optErr } = await supabase.from('poll_options').insert(
          clean.map((d, i) => ({ poll_id: poll.id, starts_at: d, position: i })),
        )
        if (optErr) { setError(optErr.message); setSaving(false); return }
        currentPollId = poll.id
      }

      if (notify) await notifyMembers(currentPollId)
      window.location.href = `/groups/${groupId}/polls/${currentPollId}`
    } catch (err: any) {
      setError(err.message ?? t('polls.errGeneric'))
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6"><div className="h-40 bg-white/40 rounded-xl animate-pulse" /></div>

  return (
    <div className="p-5 sm:p-6 max-w-lg">
      <h1 className="text-[22px] font-black text-slate-900 tracking-tight mb-5">{editing ? t('polls.editTitle') : t('polls.formTitle')}</h1>

      {/* Carte blanche : les champs restent lisibles quel que soit le fond de l'application */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-5">
        <div className="relative">
          <label className={labelClass}>{t('polls.fieldClub')}</label>
          <input value={clubQuery} onChange={e => { setClubId(null); searchClubs(e.target.value) }}
            placeholder={t('polls.clubSearchPlaceholder')} className={inputClass} />
          {clubHits.length > 0 && (
            <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
              {clubHits.map(c => (
                <button type="button" key={c.id} onClick={() => pickClub(c)}
                  className="w-full text-left px-3 py-2.5 text-[13px] text-slate-800 hover:bg-slate-50 flex justify-between gap-2">
                  <span className="truncate">{c.name}</span><span className="text-slate-400 shrink-0">{c.country}</span>
                </button>
              ))}
            </div>
          )}
          <p className="text-[11px] text-slate-500 mt-1">{t('polls.clubHint')}</p>
        </div>

        <div>
          <label className={labelClass}>{t('polls.fieldTitle')}</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('polls.fieldTitlePlaceholder')} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>{t('polls.fieldLocation')}</label>
          <input value={location} onChange={e => setLocation(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>{t('polls.fieldDescription')}</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>{t('polls.fieldDates')}</label>
          <div className="flex flex-col gap-2">
            {dates.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="datetime-local" value={d} onChange={e => setDate(i, e.target.value)} className={inputClass} />
                {dates.length > 1 && (
                  <button type="button" onClick={() => setDates(prev => prev.filter((_, j) => j !== i))}
                    aria-label={t('polls.removeDate')}
                    className="text-[13px] font-semibold text-red-500 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 shrink-0">✕</button>
                )}
              </div>
            ))}
          </div>
          {dates.length < 12 && (
            <button type="button" onClick={() => setDates(prev => [...prev, ''])}
              className="mt-3 w-full text-[13px] font-semibold text-[#185FA5] border border-[#B5D4F4] bg-[#EBF3FC] rounded-xl py-2.5 hover:bg-[#185FA5] hover:text-white transition-colors">
              + {t('polls.addDate')}
            </button>
          )}
        </div>

        <div>
          <label className={labelClass}>{t('polls.fieldDeadline')}</label>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={inputClass} />
        </div>

        <label className="flex items-start gap-2.5 text-[13px] text-slate-700 cursor-pointer">
          <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} className="mt-0.5 w-4 h-4" />
          <span>{editing ? t('polls.resendNotify') : t('polls.notifyNow')}</span>
        </label>

        {error && <p className="text-[13px] text-[#A32D2D]">{error}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={() => { window.location.href = editing ? `/groups/${groupId}/polls/${pollId}` : `/groups/${groupId}/polls` }}
            className="flex-1 py-3 rounded-xl bg-slate-100 text-[14px] font-semibold text-slate-700 hover:bg-slate-200 transition-colors">
            {t('polls.cancel')}
          </button>
          <button type="submit" disabled={saving}
            className="flex-[2] py-3 rounded-xl bg-[#185FA5] text-white text-[14px] font-semibold hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
            {saving ? t('polls.creating') : editing ? t('polls.saveChanges') : t('polls.create')}
          </button>
        </div>
      </form>
    </div>
  )
}

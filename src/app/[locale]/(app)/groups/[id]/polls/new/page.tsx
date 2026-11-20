'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

const supabase = createClient()
const inputClass = "w-full border border-white/60 rounded-xl px-3 py-2.5 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] bg-white/70 backdrop-blur-sm"

type ClubHit = { id: string; name: string; country: string }

export default function NewPollPage() {
  const params  = useParams()
  const groupId = params.id as string
  const t       = useTranslations()

  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [location,    setLocation]    = useState('')
  const [clubId,      setClubId]      = useState<string | null>(null)
  const [clubQuery,   setClubQuery]   = useState('')
  const [clubHits,    setClubHits]    = useState<ClubHit[]>([])
  const [dates,       setDates]       = useState<string[]>([''])
  const [deadline,    setDeadline]    = useState('')
  const [notifyNow,   setNotifyNow]   = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  async function searchClubs(q: string) {
    setClubQuery(q)
    if (q.trim().length < 2) { setClubHits([]); return }
    const { data } = await supabase.from('clubs').select('id, name, country').ilike('name', `%${q.trim()}%`).order('name').limit(8)
    setClubHits((data ?? []) as ClubHit[])
  }

  function pickClub(c: ClubHit) {
    setClubId(c.id)
    setLocation(c.name)
    setClubQuery(c.name)
    setClubHits([])
    if (!title.trim()) setTitle(`${t('polls.titlePrefix')} ${c.name}`)
  }

  function setDate(i: number, v: string) { setDates(prev => prev.map((d, j) => (j === i ? v : d))) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setError('')
    const clean = Array.from(new Set(dates.filter(Boolean))).sort()
    if (!title.trim()) { setError(t('polls.errNeedTitle')); return }
    if (clean.length === 0) { setError(t('polls.errNeedDate')); return }

    setSaving(true)
    try {
      const { data: poll, error: pollErr } = await supabase.from('polls').insert({
        group_id:    groupId,
        title:       title.trim(),
        description: description.trim() || null,
        club_id:     clubId,
        location:    location.trim() || null,
        deadline:    deadline || null,
      }).select('id').single()
      if (pollErr || !poll) { setError(pollErr?.message ?? t('polls.errGeneric')); setSaving(false); return }

      // Les heures sont enregistrées « telles quelles » (heure belge), comme events.starts_at
      const { error: optErr } = await supabase.from('poll_options').insert(
        clean.map((d, i) => ({ poll_id: poll.id, starts_at: d, position: i })),
      )
      if (optErr) { setError(optErr.message); setSaving(false); return }

      if (notifyNow) {
        await fetch('/api/polls/notify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId, pollId: poll.id, mode: 'invite' }),
        }).catch(() => {})
      }
      window.location.href = `/groups/${groupId}/polls/${poll.id}`
    } catch (err: any) {
      setError(err.message ?? t('polls.errGeneric'))
      setSaving(false)
    }
  }

  return (
    <div className="p-5 sm:p-6 max-w-lg">
      <h1 className="text-[22px] font-black text-slate-900 tracking-tight mb-6">{t('polls.formTitle')}</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Club (facultatif) : préremplit le lieu et le titre, et servira à l'événement créé ensuite */}
        <div className="relative">
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('polls.fieldClub')}</label>
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
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('polls.fieldTitle')}</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('polls.fieldTitlePlaceholder')} className={inputClass} />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('polls.fieldLocation')}</label>
          <input value={location} onChange={e => setLocation(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('polls.fieldDates')}</label>
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
              className="mt-2 text-[13px] font-semibold text-[#185FA5] hover:text-[#0C447C]">+ {t('polls.addDate')}</button>
          )}
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('polls.fieldDescription')}</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className={inputClass} />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('polls.fieldDeadline')}</label>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={inputClass} />
        </div>

        <label className="flex items-start gap-2.5 text-[13px] text-slate-700 cursor-pointer">
          <input type="checkbox" checked={notifyNow} onChange={e => setNotifyNow(e.target.checked)} className="mt-0.5 w-4 h-4" />
          <span>{t('polls.notifyNow')}</span>
        </label>

        {error && <p className="text-[13px] text-[#A32D2D]">{error}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={() => { window.location.href = `/groups/${groupId}/polls` }}
            className="flex-1 py-3 rounded-xl bg-slate-100 text-[14px] font-semibold text-slate-700 hover:bg-slate-200 transition-colors">
            {t('polls.cancel')}
          </button>
          <button type="submit" disabled={saving}
            className="flex-[2] py-3 rounded-xl bg-[#185FA5] text-white text-[14px] font-semibold hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
            {saving ? t('polls.creating') : t('polls.create')}
          </button>
        </div>
      </form>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations, useLocale } from 'next-intl'

const supabase = createClient()
const inputClass = "w-full border border-white/60 rounded-xl px-3 py-2.5 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] bg-white/70 backdrop-blur-sm"

export default function AddEventPage() {
  const params  = useParams()
  const groupId = params.id as string
  const t       = useTranslations()

  const [title, setTitle]               = useState('')
  const [location, setLocation]         = useState('')
  const [start, setStart]               = useState('')
  const [end, setEnd]                   = useState('')
  const [isGolf, setIsGolf]             = useState(true)
  const [fee, setFee]                   = useState('')
  const [emailMessage, setEmailMessage] = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')

  const [clubs, setClubs]                             = useState<{ id: string; name: string }[]>([])
  const [courses, setCourses]                         = useState<{ id: string; course_name: string }[]>([])
  const [formats, setFormats]                         = useState<{ id: string; name: string }[]>([])
  const [selectedClubId, setSelectedClubId]           = useState('')
  const [courseId, setCourseId]                       = useState('')
  const [competitionFormatId, setCompetitionFormatId] = useState('')
  const [maxParticipants, setMaxParticipants]         = useState('')

  useEffect(() => { loadRefs() }, [])
  useEffect(() => {
    if (selectedClubId) loadCourses(selectedClubId)
    else { setCourses([]); setCourseId('') }
  }, [selectedClubId])

  async function loadRefs() {
    const [{ data: clubsData }, { data: formatsData }] = await Promise.all([
      supabase.from('clubs').select('id, name').order('name'),
      supabase.from('competition_formats').select('id, name').order('name'),
    ])
    setClubs(clubsData || [])
    setFormats(formatsData || [])
  }

  async function loadCourses(clubId: string) {
    const { data } = await supabase.from('courses').select('id, course_name').eq('club_id', clubId).order('course_name')
    setCourses(data || [])
    if (data?.length === 1) setCourseId(data[0].id)
    else setCourseId('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setError(''); setSaving(true)
    try {
      const { error: insertError } = await supabase.from('events').insert({
        group_id:              groupId,
        title:                 title.trim(),
        location:              location.trim() || null,
        starts_at:             start,
        ends_at:               end || null,
        is_golf:               isGolf,
        course_id:             courseId || null,
        competition_format_id: competitionFormatId || null,
        fee_per_person:        fee ? parseFloat(fee.replace(',', '.')) : null,
        email_message:         emailMessage || null,
        max_participants:      maxParticipants ? parseInt(maxParticipants) : null,
      })
      if (insertError) { setError(insertError.message); setSaving(false); return }
      window.location.href = `/groups/${groupId}/events`
    } catch (e: any) {
      setError(e.message ?? t('addEvent.errorUnexpected'))
      setSaving(false)
    }
  }

  return (
    <div className="p-5 sm:p-6 max-w-lg">
      <div className="mb-6">
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">{t('addEvent.title')}</h1>
        <p className="text-[13px] text-slate-900 mt-0.5">{t('addEvent.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('addEvent.titleLabel')}</label>
          <input value={title} onChange={e => setTitle(e.target.value)} required
            placeholder={t('addEvent.titlePlaceholder')} className={inputClass} />
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('addEvent.location')}</label>
          <input value={location} onChange={e => setLocation(e.target.value)}
            placeholder={t('addEvent.locationPlaceholder')} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('addEvent.start')}</label>
            <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('addEvent.end')}</label>
            <input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="h-px bg-white/40" />

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-2">{t('addEvent.eventType')}</label>
          <div className="flex gap-1 p-1 bg-white/40 rounded-xl w-fit">
            <button type="button" onClick={() => setIsGolf(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                isGolf ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {t('addEvent.golf')}
            </button>
            <button type="button" onClick={() => setIsGolf(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                !isGolf ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {t('addEvent.other')}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            {isGolf ? t('addEvent.golfHint') : t('addEvent.otherHint')}
          </p>
        </div>

        {isGolf && (
          <>
            <div className="h-px bg-white/40" />

            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('addEvent.club')}</label>
              <select value={selectedClubId} onChange={e => setSelectedClubId(e.target.value)} className={inputClass}>
                <option value="">{t('addEvent.chooseClub')}</option>
                {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {selectedClubId && (
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('addEvent.course')}</label>
                <select value={courseId} onChange={e => setCourseId(e.target.value)} className={inputClass}>
                  <option value="">{t('addEvent.chooseCourse')}</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.course_name}</option>)}
                </select>
                {courses.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1.5">
                    {t('addEvent.noCourse')}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('addEvent.format')}</label>
              <select value={competitionFormatId} onChange={e => setCompetitionFormatId(e.target.value)} className={inputClass}>
                <option value="">{t('addEvent.chooseFormat')}</option>
                {formats.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
              {t('addEvent.fee')} <span className="text-slate-400 font-normal">— {t('addEvent.feeOptional')}</span>
            </label>
            <input value={fee} onChange={e => setFee(e.target.value)} placeholder="Ex: 35" className={inputClass} />
            {fee && <p className="text-[11px] text-slate-500 mt-1">{t('addEvent.feeHint')}</p>}
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
              {t('addEvent.maxParticipants')} <span className="text-slate-400 font-normal">— {t('addEvent.maxOptional')}</span>
            </label>
            <input value={maxParticipants} onChange={e => setMaxParticipants(e.target.value)}
              placeholder="Ex: 24" type="number" min="1" className={inputClass} />
            {maxParticipants && <p className="text-[11px] text-slate-500 mt-1">{t('addEvent.maxHint')}</p>}
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
            {t('addEvent.emailMessage')} <span className="text-slate-400 font-normal">— {t('addEvent.emailOptional')}</span>
          </label>
          <textarea value={emailMessage} onChange={e => setEmailMessage(e.target.value)}
            placeholder={t('addEvent.emailPlaceholder')} rows={3}
            className={`${inputClass} resize-none`} />
          <p className="text-[11px] text-slate-500 mt-1">{t('addEvent.emailHint')}</p>
        </div>

        {error && <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>}

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving}
            className="bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
            {saving ? t('addEvent.saving') : t('addEvent.save')}
          </button>
          <button type="button" onClick={() => { window.location.href = `/groups/${groupId}/events` }}
            className="text-[13px] font-semibold px-5 py-2.5 rounded-xl border border-white/50 text-slate-600 hover:bg-white/30 transition-colors">
            {t('addEvent.cancel')}
          </button>
        </div>

      </form>
    </div>
  )
}

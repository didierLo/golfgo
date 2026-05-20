'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

const supabase = createClient()
const inputClass = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] bg-white"

export default function EditEventPage() {
  const params  = useParams()
  const groupId = params.id as string
  const eventId = params.eventId as string
  const t = useTranslations()

  const [title, setTitle]                               = useState('')
  const [location, setLocation]                         = useState('')
  const [start, setStart]                               = useState('')
  const [end, setEnd]                                   = useState('')
  const [courseId, setCourseId]                         = useState('')
  const [competitionFormatId, setCompetitionFormatId]   = useState('')
  const [selectedClubId, setSelectedClubId]             = useState('')
  const [isGolf, setIsGolf]                             = useState(true)
  const [fee, setFee]                                   = useState('')
  const [emailMessage, setEmailMessage]                 = useState('')
  const [maxParticipants, setMaxParticipants]           = useState('')
  const [whatsappLink, setWhatsappLink]                 = useState('')

  const [clubs, setClubs]     = useState<{ id: string; name: string }[]>([])
  const [courses, setCourses] = useState<{ id: string; course_name: string }[]>([])
  const [formats, setFormats] = useState<{ id: string; name: string }[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => { if (eventId) loadAll() }, [eventId])
  useEffect(() => {
    if (selectedClubId) loadCourses(selectedClubId)
    else setCourses([])
  }, [selectedClubId])

  async function loadAll() {
    setLoading(true)
    const { data: event, error: evErr } = await supabase
      .from('events')
      .select('title, location, starts_at, ends_at, course_id, competition_format_id, is_golf, fee_per_person, email_message, max_participants, whatsapp_link')
      .eq('id', eventId).single()
    if (evErr || !event) { alert(t('editEvent.notFound')); window.location.href = `/groups/${groupId}/events`; return }

    setTitle(event.title || '')
    setLocation(event.location || '')
    setStart(event.starts_at ? event.starts_at.slice(0, 16) : '')
    setEnd(event.ends_at ? event.ends_at.slice(0, 16) : '')
    setCourseId(event.course_id || '')
    setCompetitionFormatId(event.competition_format_id || '')
    setIsGolf(event.is_golf ?? true)
    setFee(event.fee_per_person ? String(event.fee_per_person) : '')
    setEmailMessage(event.email_message || '')
    setMaxParticipants(event.max_participants ? String(event.max_participants) : '')
    setWhatsappLink(event.whatsapp_link || '')

    const { data: clubsData } = await supabase.from('clubs').select('id, name').order('name')
    setClubs(clubsData || [])

    if (event.course_id) {
      const { data: courseData } = await supabase
        .from('courses').select('id, course_name, club_id').eq('id', event.course_id).single()
      if (courseData) {
        setSelectedClubId(courseData.club_id)
        const { data: coursesData } = await supabase
          .from('courses').select('id, course_name').eq('club_id', courseData.club_id).order('course_name')
        setCourses(coursesData || [])
      }
    }

    const { data: formatsData } = await supabase.from('competition_formats').select('id, name').order('name')
    setFormats(formatsData || [])
    setLoading(false)
  }

  async function loadCourses(clubId: string) {
    const { data } = await supabase.from('courses').select('id, course_name').eq('club_id', clubId).order('course_name')
    setCourses(data || [])
    if (!data?.find(c => c.id === courseId)) setCourseId('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setError('')
    setSaving(true)
    const { error: updateError } = await supabase.from('events').update({
      title:                 title.trim(),
      location:              location.trim() || null,
      starts_at:             start,
      ends_at:               end || null,
      course_id:             courseId || null,
      competition_format_id: competitionFormatId || null,
      is_golf:               isGolf,
      fee_per_person:        fee ? parseFloat(fee.replace(',', '.')) : null,
      email_message:         emailMessage || null,
      max_participants:      maxParticipants ? parseInt(maxParticipants) : null,
      whatsapp_link:         whatsappLink.trim() || null,
      updated_at:            new Date().toISOString(),
    }).eq('id', eventId)
    if (updateError) { setError(updateError.message); setSaving(false); return }
    window.location.href = `/groups/${groupId}/events`
  }

  if (loading) return (
    <div className="p-6 space-y-3 max-w-lg">
      {[1,2,3,4].map(i => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-lg">
      <div className="mb-6">
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">{t('editEvent.title')}</h1>
        <p className="text-[13px] text-slate-900 mt-0.5">{title}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('editEvent.titleLabel')}</label>
          <input value={title} onChange={e => setTitle(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('editEvent.location')}</label>
          <input value={location} onChange={e => setLocation(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('editEvent.start')}</label>
            <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('editEvent.end')}</label>
            <input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-2">{t('editEvent.eventType')}</label>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
            <button type="button" onClick={() => setIsGolf(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                isGolf ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              {t('editEvent.golf')}
            </button>
            <button type="button" onClick={() => setIsGolf(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                !isGolf ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              {t('editEvent.other')}
            </button>
          </div>
        </div>

        {isGolf && (
          <>
            <div className="h-px bg-slate-100" />
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('editEvent.club')}</label>
              <select value={selectedClubId} onChange={e => setSelectedClubId(e.target.value)} className={inputClass}>
                <option value="">{t('editEvent.chooseClub')}</option>
                {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {selectedClubId && (
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('editEvent.course')}</label>
                <select value={courseId} onChange={e => setCourseId(e.target.value)} className={inputClass}>
                  <option value="">{t('editEvent.chooseCourse')}</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.course_name}</option>)}
                </select>
                {courses.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1.5">
                    {t('editEvent.noCourse')} — <a href="/admin/clubs" className="underline">{t('clubs.manual')}</a>
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">{t('editEvent.format')}</label>
              <select value={competitionFormatId} onChange={e => setCompetitionFormatId(e.target.value)} className={inputClass}>
                <option value="">{t('editEvent.chooseFormat')}</option>
                {formats.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </>
        )}

        <div className="h-px bg-slate-100" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
              {t('editEvent.fee')} <span className="text-slate-400 font-normal">— {t('editEvent.feeOptional')}</span>
            </label>
            <input value={fee} onChange={e => setFee(e.target.value)} placeholder="Ex: 35" className={inputClass} />
            {fee && <p className="text-[11px] text-slate-500 mt-1">{t('editEvent.feeHint')}</p>}
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
              {t('editEvent.maxParticipants')} <span className="text-slate-400 font-normal">— {t('editEvent.maxOptional')}</span>
            </label>
            <input value={maxParticipants} onChange={e => setMaxParticipants(e.target.value)}
              placeholder="Ex: 24" type="number" min="1" className={inputClass} />
            {maxParticipants && <p className="text-[11px] text-slate-500 mt-1">{t('editEvent.maxHint')}</p>}
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
            {t('editEvent.emailMessage')} <span className="text-slate-400 font-normal">— {t('editEvent.emailOptional')}</span>
          </label>
          <textarea value={emailMessage} onChange={e => setEmailMessage(e.target.value)}
            placeholder={t('editEvent.emailPlaceholder')}
            rows={3} className={`${inputClass} resize-none placeholder-slate-300`} />
          <p className="text-[11px] text-slate-500 mt-1">{t('editEvent.emailHint')}</p>
        </div>

        {/* ── Lien WhatsApp de l'event ── */}
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
            {t('editEvent.whatsappLink')}
            <span className="text-slate-400 font-normal ml-1">— {t('editEvent.whatsappLinkOptional')}</span>
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <input
              value={whatsappLink}
              onChange={e => setWhatsappLink(e.target.value)}
              placeholder="https://chat.whatsapp.com/XXXXXXXX"
              className={`${inputClass} pl-8`}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1.5">{t('editEvent.whatsappLinkHint')}</p>
          {whatsappLink && (
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-[#25D366] hover:underline">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {t('editGroup.whatsappLinkTest')}
            </a>
          )}
        </div>

        {error && (
          <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>
        )}

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving}
            className="bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
            {saving ? t('editEvent.saving') : t('editEvent.save')}
          </button>
          <button type="button" onClick={() => { window.location.href = `/groups/${groupId}/events` }}
            className="text-[13px] font-semibold px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            {t('editEvent.cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}

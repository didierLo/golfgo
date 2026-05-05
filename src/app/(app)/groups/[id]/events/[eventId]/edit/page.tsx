'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
const inputClass = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] bg-white"

export default function EditEventPage() {
  const params  = useParams()
  const groupId = params.id as string
  const eventId = params.eventId as string

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
      .select('title, location, starts_at, ends_at, course_id, competition_format_id, is_golf, fee_per_person, email_message, max_participants')
      .eq('id', eventId).single()
    if (evErr || !event) { alert('Event not found'); window.location.href = `/groups/${groupId}/events`; return }

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
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Modifier l'événement</h1>
        <p className="text-[13px] text-slate-900 mt-0.5">{title}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Titre *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} required className={inputClass} />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Lieu</label>
          <input value={location} onChange={e => setLocation(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Début *</label>
            <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Fin</label>
            <input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-2">Type d'événement</label>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
            <button type="button" onClick={() => setIsGolf(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                isGolf ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              ⛳ Partie de golf
            </button>
            <button type="button" onClick={() => setIsGolf(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                !isGolf ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              🎉 Autre événement
            </button>
          </div>
        </div>

        {isGolf && (
          <>
            <div className="h-px bg-slate-100" />
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Club</label>
              <select value={selectedClubId} onChange={e => setSelectedClubId(e.target.value)} className={inputClass}>
                <option value="">Choisir un club…</option>
                {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {selectedClubId && (
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Parcours</label>
                <select value={courseId} onChange={e => setCourseId(e.target.value)} className={inputClass}>
                  <option value="">Choisir un parcours…</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.course_name}</option>)}
                </select>
                {courses.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1.5">
                    Aucun parcours — <a href="/admin/clubs" className="underline">ajouter dans Clubs</a>
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Format de compétition</label>
              <select value={competitionFormatId} onChange={e => setCompetitionFormatId(e.target.value)} className={inputClass}>
                <option value="">Choisir un format…</option>
                {formats.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </>
        )}

        <div className="h-px bg-slate-100" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
              Frais par personne (€) <span className="text-slate-400 font-normal">— optionnel</span>
            </label>
            <input value={fee} onChange={e => setFee(e.target.value)} placeholder="Ex: 35" className={inputClass} />
            {fee && <p className="text-[11px] text-slate-500 mt-1">Un onglet "Paiements" sera disponible</p>}
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
              Nb. de places <span className="text-slate-400 font-normal">— optionnel</span>
            </label>
            <input
              value={maxParticipants}
              onChange={e => setMaxParticipants(e.target.value)}
              placeholder="Ex: 24"
              type="number"
              min="1"
              className={inputClass}
            />
            {maxParticipants && <p className="text-[11px] text-slate-500 mt-1">Places restantes visibles</p>}
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
            Message d'invitation <span className="text-slate-400 font-normal">— optionnel</span>
          </label>
          <textarea value={emailMessage} onChange={e => setEmailMessage(e.target.value)}
            placeholder="Ex: Rendez-vous au départ n°1 à 9h00..."
            rows={3} className={`${inputClass} resize-none placeholder-slate-300`} />
          <p className="text-[11px] text-slate-500 mt-1">Inclus dans l'email d'invitation</p>
        </div>

        {error && (
          <div className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>
        )}

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving}
            className="bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Sauvegarder'}
          </button>
          <button type="button" onClick={() => { window.location.href = `/groups/${groupId}/events` }}
            className="text-[13px] font-semibold px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            Annuler
          </button>
        </div>
      </form>
    </div>
  )
}
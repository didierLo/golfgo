'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import * as Sentry from '@sentry/nextjs'
import toast from 'react-hot-toast'

const supabase = createClient()

type Course = { id: string; course_name: string; club_id: string }
type Tee    = { id: string; course_id: string; tee_name: string; par_total: number; distance_total: number; course_rating: number; slope: number }
type Hole   = { id?: string; course_id: string; hole_number: number; par: number; stroke_index: number; hole_distance: number }

const glassInputClass = "w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] text-slate-800 bg-white/80 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] transition-colors"

/** Vérifie qu'un jeu de trous a un stroke index complet et sans doublon —
 *  accepte aussi bien un parcours 9 trous (1–9) qu'un 18 trous (1–18) :
 *  un vrai 9 trous ne doit jamais être signalé comme "incomplet" juste parce
 *  qu'il lui manquerait les trous 10 à 18. */
function holesIncomplete(holes: { stroke_index: number }[]): boolean {
  const n = holes.length
  if (n !== 9 && n !== 18) return true
  const seen = new Set(holes.map(h => h.stroke_index))
  if (seen.size !== n) return true
  for (let i = 1; i <= n; i++) if (!seen.has(i)) return true
  return false
}

/** Vérifie qu'un tee a toutes ses infos de base renseignées (pas juste des valeurs par défaut à 0). */
function teeIncomplete(tee: Tee): boolean {
  return !tee.par_total || !tee.course_rating || !tee.slope
}

export default function ClubEditor({ clubId }: { clubId: string }) {
  const t = useTranslations()
  const router = useRouter()

  const [courses, setCourses] = useState<Course[]>([])
  const [tees, setTees]       = useState<Tee[]>([])
  const [holes, setHoles]     = useState<Hole[]>([])

  const [courseId, setCourseId] = useState<string | null>(null)
  const [courseNameDraft, setCourseNameDraft] = useState('')
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null)
  const [sendingDeleteRequest, setSendingDeleteRequest] = useState(false)

  const [newCourse, setNewCourse] = useState('')
  const [newTee, setNewTee]     = useState('')
  const [newTeeData, setNewTeeData] = useState({ par_total: 72, distance_total: 0, course_rating: 72.0, slope: 120 })

  const [saving, setSaving]   = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // Complétude de CHAQUE parcours du club (pas juste celui affiché), pour le bandeau d'avertissement.
  const [incompleteCourses, setIncompleteCourses] = useState<{ id: string; course_name: string; reasons: string[] }[]>([])

  useEffect(() => { loadCourses(clubId) }, [clubId])

  useEffect(() => {
    if (courseId) {
      Promise.all([loadTees(courseId), loadHoles(courseId)])
      setCourseNameDraft(courses.find(c => c.id === courseId)?.course_name ?? '')
    } else {
      setTees([])
      setHoles([])
      setCourseNameDraft('')
    }
    setDeletingCourseId(null)
  }, [courseId])

  async function loadCourses(cid: string) {
    const { data } = await supabase
      .from('courses').select('*').eq('club_id', cid).order('course_name')
    const list = data || []
    setCourses(list)
    if (list.length === 1) setCourseId(list[0].id)
    await checkCompleteness(list)
  }

  async function checkCompleteness(courseList: Course[]) {
    const results: { id: string; course_name: string; reasons: string[] }[] = []
    for (const c of courseList) {
      const [{ data: courseTees }, { data: courseHoles }] = await Promise.all([
        supabase.from('course_tees').select('*').eq('course_id', c.id),
        supabase.from('course_holes').select('stroke_index').eq('course_id', c.id),
      ])
      const reasons: string[] = []
      if (!courseTees || courseTees.length === 0) {
        reasons.push(t('clubs.incompleteNoTees'))
      } else if (courseTees.some(teeIncomplete)) {
        reasons.push(t('clubs.incompleteTeeData'))
      }
      if (holesIncomplete(courseHoles || [])) {
        reasons.push(t('clubs.incompleteHoles'))
      }
      if (reasons.length > 0) results.push({ id: c.id, course_name: c.course_name, reasons })
    }
    setIncompleteCourses(results)
  }

  async function loadTees(cid: string) {
    const { data } = await supabase
      .from('course_tees').select('*').eq('course_id', cid).order('tee_name')
    setTees(data || [])
  }

  async function loadHoles(cid: string) {
    const { data } = await supabase
      .from('course_holes').select('*').eq('course_id', cid).order('hole_number')
    if (data && data.length > 0) {
      setHoles(data)
    } else {
      setHoles(Array.from({ length: 18 }, (_, i) => ({
        course_id: cid, hole_number: i + 1, par: 4, stroke_index: i + 1, hole_distance: 0,
      })))
    }
  }

  async function handleCreateCourse() {
    if (!newCourse.trim()) return
    const { data } = await supabase
      .from('courses').insert({ club_id: clubId, course_name: newCourse.trim() }).select().single()
    setNewCourse('')
    if (data) { setCourseId(data.id); await loadCourses(clubId) }
  }

  async function handleRenameCourse() {
    if (!courseId) return
    const trimmed = courseNameDraft.trim()
    const current = courses.find(c => c.id === courseId)
    if (!current) return
    if (!trimmed) { setCourseNameDraft(current.course_name); return } // pas de nom vide
    if (trimmed === current.course_name) return

    const { error } = await supabase.from('courses').update({ course_name: trimmed }).eq('id', courseId)
    if (error) { toast.error(t('errors.generic') ?? 'Une erreur est survenue'); setCourseNameDraft(current.course_name); return }
    setCourses(prev => prev.map(c => c.id === courseId ? { ...c, course_name: trimmed } : c))
  }

  async function handleDeleteCourse() {
    if (!courseId) return
    const course = courses.find(c => c.id === courseId)
    if (!course) return

    // On informe l'admin si ce parcours est déjà utilisé dans un événement,
    // mais ça ne bloque plus la demande — c'est une demande, pas une suppression
    // immédiate, donc c'est à l'admin de décider en connaissance de cause.
    const { data: teeRows } = await supabase.from('course_tees').select('id').eq('course_id', courseId)
    const teeIds = (teeRows ?? []).map(t => t.id)
    let usageNote: string | undefined
    if (teeIds.length > 0) {
      const { count } = await supabase.from('event_participants')
        .select('*', { count: 'exact', head: true }).in('tee_id', teeIds)
      if (count && count > 0) usageNote = t('clubs.deleteBlockedCourse', { count })
    }

    setSendingDeleteRequest(true)
    try {
      const res = await fetch('/api/admin/clubs/request-deletion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'course', id: courseId, name: course.course_name, usageNote }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? t('errors.generic') ?? 'Une erreur est survenue')
      toast.success(t('clubs.deleteRequestSent'))
    } catch (e: any) {
      toast.error(e.message ?? t('errors.generic') ?? 'Une erreur est survenue')
    } finally {
      setSendingDeleteRequest(false)
      setDeletingCourseId(null)
    }
  }

  async function handleCreateTee() {
    if (!courseId || !newTee.trim()) return
    const { data } = await supabase.from('course_tees').insert({
      course_id: courseId, tee_name: newTee.trim(),
      par_total: newTeeData.par_total, course_rating: newTeeData.course_rating, slope: newTeeData.slope,
    }).select().single()
    setNewTee('')
    setNewTeeData({ par_total: 72, distance_total: 0, course_rating: 72.0, slope: 120 })
    if (data) setTees(prev => [...prev, data])
  }

  function updateTee(id: string, field: keyof Tee, value: string | number) {
    setTees(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  // Trous dont le stroke index est en double avec un autre trou (mise en évidence en direct,
  // avant même la sauvegarde — la validation bloquante reste dans handleSave/validateStrokeIndexes).
  const duplicatedHoleNumbers = new Set<number>()
  if (holes.length === 18) {
    const bySi = new Map<number, number[]>()
    holes.forEach(h => bySi.set(h.stroke_index, [...(bySi.get(h.stroke_index) ?? []), h.hole_number]))
    bySi.forEach(holeNumbers => { if (holeNumbers.length > 1) holeNumbers.forEach(n => duplicatedHoleNumbers.add(n)) })
  }

  function updateHole(index: number, field: keyof Hole, value: number) {
    setHoles(prev => prev.map((h, i) => i === index ? { ...h, [field]: value } : h))
  }

  function validateStrokeIndexes(): string | null {
    if (holes.length !== 18) return null // 9 trous ou config incomplète : pas de contrainte 1–18
    const seen = new Map<number, number[]>() // stroke_index → numéros de trou concernés
    for (const h of holes) {
      const list = seen.get(h.stroke_index) ?? []
      list.push(h.hole_number)
      seen.set(h.stroke_index, list)
    }
    const duplicates = [...seen.entries()].filter(([, holeNumbers]) => holeNumbers.length > 1)
    const missing = Array.from({ length: 18 }, (_, i) => i + 1).filter(si => !seen.has(si))

    if (duplicates.length > 0) {
      const detail = duplicates.map(([si, holeNumbers]) => `SI ${si} (trous ${holeNumbers.join(', ')})`).join(' · ')
      return `Index en double : ${detail}`
    }
    if (missing.length > 0) {
      return `Index manquant(s) : ${missing.join(', ')}`
    }
    return null
  }

  async function handleSave() {
    if (!courseId) return

    const validationError = validateStrokeIndexes()
    if (validationError) {
      setSaveMsg('⚠️ ' + validationError)
      toast.error(validationError)
      return
    }

    setSaving(true)
    setSaveMsg('')
    try {
      await Promise.all(tees.map(tee =>
        supabase.from('course_tees').update({
          tee_name: tee.tee_name, par_total: tee.par_total,
          distance_total: tee.distance_total, course_rating: tee.course_rating, slope: tee.slope,
        }).eq('id', tee.id)
      ))
      const { error: holesError } = await supabase.from('course_holes').upsert(
        holes.map(h => ({
          ...(h.id ? { id: h.id } : {}),
          course_id: courseId, hole_number: h.hole_number,
          par: h.par, stroke_index: h.stroke_index, hole_distance: h.hole_distance,
        })),
        { onConflict: 'course_id,hole_number' }
      )
      if (holesError) {
        console.error('[handleSave] course_holes upsert error:', holesError)
        setSaveMsg('Erreur trous: ' + holesError.message)
      } else {
        setSaveMsg('✓ Sauvegardé')
      }
      await loadHoles(courseId)
      await checkCompleteness(courses)
    } catch (e: any) {
      console.error('[handleSave] catch:', e)
      setSaveMsg('Erreur: ' + (e.message ?? 'inconnue'))
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }

  const parOut   = holes.slice(0, 9).reduce((s, h) => s + h.par, 0)
  const parIn    = holes.slice(9, 18).reduce((s, h) => s + h.par, 0)
  const parTotal = parOut + parIn

  const selectClass = "w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] text-gray-900 bg-white focus:outline-none focus:border-blue-300"

  return (
    <div className="space-y-5 max-w-4xl">

      {/* ── Bandeau de complétude ────────────────────────────────────────── */}
      {incompleteCourses.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <p className="text-[13px] font-semibold text-amber-800">
              {t('clubs.incompleteBanner')}
            </p>
            <button
              onClick={() => router.push('/admin/clubs/add')}
              className="shrink-0 text-[12px] font-semibold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
            >
              {t('clubs.searchInfo')}
            </button>
          </div>
          <ul className="space-y-1">
            {incompleteCourses.map(c => (
              <li key={c.id} className="text-[12px] text-amber-700">
                <button
                  onClick={() => setCourseId(c.id)}
                  className="font-semibold underline underline-offset-2 hover:text-amber-900"
                >
                  {c.course_name}
                </button>
                {' '}— {c.reasons.join(' · ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Parcours ─────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-[12px] font-semibold text-gray-900 mb-1.5">
          {t('clubs.courseLabel')}
        </label>

        {/* Pastilles pour choisir QUEL parcours, s'il y en a plusieurs — le nom
            reste lisible en toutes circonstances (tablette/mobile compris) */}
        {courses.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {courses.map(c => (
              <button
                key={c.id}
                onClick={() => setCourseId(c.id)}
                className={`px-3 py-1.5 rounded-full text-[13px] font-semibold border transition-colors ${
                  c.id === courseId
                    ? 'bg-[#185FA5] border-[#185FA5] text-white'
                    : 'bg-white border-gray-300 text-gray-900 hover:border-[#185FA5]'
                }`}
              >
                {c.course_name}
              </button>
            ))}
          </div>
        )}

        {/* Renommer le parcours sélectionné + suppression avec confirmation */}
        {courseId && (
          <div className="flex items-center gap-2">
            <span className="text-[12px] text-gray-900 shrink-0">{t('clubs.renameCourse')}</span>
            <input
              value={courseNameDraft}
              onChange={e => setCourseNameDraft(e.target.value)}
              onBlur={handleRenameCourse}
              onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              className={selectClass + ' flex-1'}
            />
            {deletingCourseId === courseId ? (
              <>
                <button onClick={handleDeleteCourse} disabled={sendingDeleteRequest}
                  className="text-[12px] font-semibold text-red-600 hover:text-red-700 px-2 whitespace-nowrap disabled:opacity-50">
                  {sendingDeleteRequest ? t('clubs.sendingRequest') : t('clubs.confirmDeleteRequest')}
                </button>
                <button onClick={() => setDeletingCourseId(null)} disabled={sendingDeleteRequest}
                  className="text-[13px] text-gray-500 hover:text-gray-700 px-1">
                  ✕
                </button>
              </>
            ) : (
              <button onClick={() => setDeletingCourseId(courseId)} title={t('clubs.deleteCourse')}
                className="text-red-500 hover:text-red-600 px-2 text-[15px] shrink-0">
                🗑
              </button>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <input value={newCourse} onChange={e => setNewCourse(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateCourse()}
            placeholder={t('clubs.newCourse')} className={selectClass} />
          <button onClick={handleCreateCourse}
            className="bg-[#185FA5] text-white text-[12px] font-medium px-4 py-2 rounded-md hover:bg-[#0C447C] transition-colors">
            +
          </button>
        </div>
      </div>

      {/* ── Éditeur tees + trous ─────────────────────────────────────────── */}
      {courseId && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="text-[14px] font-medium text-gray-900">
              {courses.find(c => c.id === courseId)?.course_name}
            </h2>
            <div className="flex items-center gap-3">
              {saveMsg && <span className="text-[12px] text-green-600">{saveMsg}</span>}
              <button onClick={handleSave} disabled={saving}
                className="bg-[#185FA5] text-white text-[12px] font-medium px-4 py-1.5 rounded-md hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
                {saving ? t('clubs.saving') : t('clubs.save')}
              </button>
            </div>
          </div>

          <div className="p-4 space-y-6">

            {/* ── Tees ── */}
            <div className="rounded-2xl border border-white/60 bg-white/60 backdrop-blur-md shadow-sm p-4">
              <p className="text-[12px] font-bold text-slate-700 uppercase tracking-wide mb-3">{t('clubs.tees')}</p>
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/70">
                    {[t('clubs.colTee'), t('clubs.colPar'), t('clubs.colDistance'), t('clubs.colCR'), t('clubs.colSlope')].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold text-slate-700 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tees.map(tee => (
                    <tr key={tee.id} className="border-b border-slate-100/70 hover:bg-white/50 transition-colors">
                      <td className="px-2 py-2"><input value={tee.tee_name ?? ''} onChange={e => updateTee(tee.id, 'tee_name', e.target.value)} className={glassInputClass} /></td>
                      <td className="px-2 py-2"><input type="number" value={tee.par_total ?? ''} onChange={e => updateTee(tee.id, 'par_total', Number(e.target.value))} className={glassInputClass + ' text-center'} /></td>
                      <td className="px-2 py-2"><input type="number" value={tee.distance_total ?? ''} onChange={e => updateTee(tee.id, 'distance_total', Number(e.target.value))} className={glassInputClass + ' text-center'} /></td>
                      <td className="px-2 py-2"><input type="number" step="0.1" value={tee.course_rating ?? ''} onChange={e => updateTee(tee.id, 'course_rating', Number(e.target.value))} className={glassInputClass + ' text-center'} /></td>
                      <td className="px-2 py-2"><input type="number" value={tee.slope ?? ''} onChange={e => updateTee(tee.id, 'slope', Number(e.target.value))} className={glassInputClass + ' text-center'} /></td>
                    </tr>
                  ))}
                  {/* Nouvelle ligne tee */}
                  <tr className="bg-[#185FA5]/5">
                    <td className="px-2 py-2">
                      <input value={newTee} onChange={e => setNewTee(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreateTee()}
                        placeholder={t('clubs.teeName')} className={glassInputClass} />
                    </td>
                    <td className="px-2 py-2"><input type="number" value={newTeeData.par_total} onChange={e => setNewTeeData(p => ({ ...p, par_total: Number(e.target.value) }))} className={glassInputClass + ' text-center'} /></td>
                    <td className="px-2 py-2"><input type="number" value={newTeeData.distance_total || ''} onChange={e => setNewTeeData(p => ({ ...p, distance_total: Number(e.target.value) }))} placeholder="-" className={glassInputClass + ' text-center'} /></td>
                    <td className="px-2 py-2"><input type="number" step="0.1" value={newTeeData.course_rating} onChange={e => setNewTeeData(p => ({ ...p, course_rating: Number(e.target.value) }))} className={glassInputClass + ' text-center'} /></td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1.5">
                        <input type="number" value={newTeeData.slope} onChange={e => setNewTeeData(p => ({ ...p, slope: Number(e.target.value) }))} className={glassInputClass + ' text-center'} />
                        <button onClick={handleCreateTee}
                          className="bg-[#185FA5] text-white text-[13px] font-semibold px-3.5 rounded-lg hover:bg-[#0C447C] transition-colors whitespace-nowrap shrink-0">
                          +
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── Trous ── */}
            <div className="rounded-2xl border border-white/60 bg-white/60 backdrop-blur-md shadow-sm p-4">
              <p className="text-[12px] font-bold text-slate-700 uppercase tracking-wide mb-3">{t('clubs.holes')}</p>
              <div className="grid grid-cols-2 gap-4">
                {[0, 1].map(half => {
                  const start    = half * 9
                  const label    = half === 0 ? 'OUT' : 'IN'
                  const subtotal = holes.slice(start, start + 9).reduce((s, h) => s + h.par, 0)
                  return (
                    <table key={half} className="w-full text-[13px] border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200/70">
                          {[t('clubs.colHole'), t('clubs.colPar'), t('clubs.colSI')].map(h => (
                            <th key={h} className="px-2 py-2 text-center text-[11px] font-semibold text-slate-700 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {holes.slice(start, start + 9).map((h, i) => (
                          <tr key={h.hole_number} className="border-b border-slate-100/70 hover:bg-white/50 transition-colors">
                            <td className="px-2 py-1.5 text-center text-[13px] font-semibold text-slate-800">{h.hole_number}</td>
                            <td className="px-1 py-1.5"><input type="number" value={h.par} min={3} max={5} onChange={e => updateHole(start + i, 'par', Number(e.target.value))} className={glassInputClass + ' text-center'} /></td>
                            <td className="px-1 py-1.5"><input type="number" value={h.stroke_index} min={1} max={18} onChange={e => updateHole(start + i, 'stroke_index', Number(e.target.value))} className={glassInputClass + ' text-center' + (duplicatedHoleNumbers.has(h.hole_number) ? ' border-red-400 bg-red-50 text-red-700' : '')} /></td>
                          </tr>
                        ))}
                        <tr className="bg-[#185FA5]/5 font-semibold">
                          <td className="px-2 py-2 text-center text-[13px] text-slate-800">{label}</td>
                          <td className="px-2 py-2 text-center text-[13px] text-slate-900">{subtotal}</td>
                          <td colSpan={1} />
                        </tr>
                      </tbody>
                    </table>
                  )
                })}
              </div>
              <div className="mt-3 text-right text-[13px] font-semibold text-slate-800">
                {t('clubs.total')} : {parTotal}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

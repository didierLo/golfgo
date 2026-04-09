'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Club   = { id: string; name: string }
type Course = { id: string; course_name: string; club_id: string }
type Tee    = { id: string; course_id: string; tee_name: string; par_total: number; distance_total: number; course_rating: number; slope: number }
type Hole   = { id?: string; course_id: string; hole_number: number; par: number; stroke_index: number; hole_distance: number }

const inputClass = "w-full border border-gray-200 rounded px-2 py-1.5 text-[12px] focus:outline-none focus:border-blue-300"

export default function ClubCourseManager() {

  const [clubs, setClubs]     = useState<Club[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [tees, setTees]       = useState<Tee[]>([])
  const [holes, setHoles]     = useState<Hole[]>([])

  const [clubId, setClubId]     = useState<string | null>(null)
  const [courseId, setCourseId] = useState<string | null>(null)

  const [newClub, setNewClub]   = useState('')
  const [newCourse, setNewCourse] = useState('')
  const [newTee, setNewTee]     = useState('')
  const [newTeeData, setNewTeeData] = useState({ par_total: 72, distance_total: 0, course_rating: 72.0, slope: 120 })

  const [saving, setSaving]   = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    loadClubs()
    const savedClub   = localStorage.getItem('clubId')
    const savedCourse = localStorage.getItem('courseId')
    if (savedClub)   setClubId(savedClub)
    if (savedCourse) setCourseId(savedCourse)
  }, [])

  useEffect(() => {
    if (clubId) {
      loadCourses(clubId)
      localStorage.setItem('clubId', clubId)
    }
  }, [clubId])

  useEffect(() => {
    if (courseId) {
      loadTees(courseId)
      loadHoles(courseId)
      localStorage.setItem('courseId', courseId)
    } else {
      setTees([])
      setHoles([])
    }
  }, [courseId])

  async function loadClubs() {
    const { data } = await supabase.from('clubs').select('*').order('name')
    setClubs(data || [])
  }

  async function loadCourses(cid: string) {
    const { data } = await supabase
      .from('courses').select('*').eq('club_id', cid).order('course_name')
    const list = data || []
    setCourses(list)
    // ── Auto-sélection si un seul parcours ──
    if (list.length === 1) setCourseId(list[0].id)
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

  async function handleCreateClub() {
    if (!newClub.trim()) return
    const { data } = await supabase.from('clubs').insert({ name: newClub.trim() }).select().single()
    setNewClub('')
    if (data) setClubId(data.id)
    await loadClubs()
  }

  async function handleCreateCourse() {
    if (!clubId || !newCourse.trim()) return
    const { data } = await supabase
      .from('courses').insert({ club_id: clubId, course_name: newCourse.trim() }).select().single()
    setNewCourse('')
    if (data) { setCourseId(data.id); await loadCourses(clubId) }
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

  function updateHole(index: number, field: keyof Hole, value: number) {
    setHoles(prev => prev.map((h, i) => i === index ? { ...h, [field]: value } : h))
  }

  async function handleSave() {
    if (!courseId) return
    setSaving(true)
    setSaveMsg('')
    try {
      for (const tee of tees) {
        await supabase.from('course_tees').update({
          tee_name: tee.tee_name, par_total: tee.par_total,
          distance_total: tee.distance_total, course_rating: tee.course_rating, slope: tee.slope,
        }).eq('id', tee.id)
      }
      await supabase.from('course_holes').upsert(
        holes.map(h => ({
          ...(h.id ? { id: h.id } : {}),
          course_id: courseId, hole_number: h.hole_number,
          par: h.par, stroke_index: h.stroke_index, hole_distance: h.hole_distance,
        })),
        { onConflict: 'course_id,hole_number' }
      )
      setSaveMsg('✓ Sauvegardé')
      await loadHoles(courseId)
    } catch {
      setSaveMsg('Erreur')
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }

  const parOut   = holes.slice(0, 9).reduce((s, h) => s + h.par, 0)
  const parIn    = holes.slice(9, 18).reduce((s, h) => s + h.par, 0)
  const parTotal = parOut + parIn

  const selectClass = "w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] bg-white focus:outline-none focus:border-blue-300"

  return (
    <div className="space-y-5 max-w-4xl">

      {/* ── Club ────────────────────────────────────────────────────────── */}
      <div>
        <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Club</label>
        <select value={clubId || ''} onChange={e => { setClubId(e.target.value || null); setCourseId(null) }}
          className={selectClass}>
          <option value="">Choisir un club…</option>
          {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex gap-2 mt-2">
          <input value={newClub} onChange={e => setNewClub(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateClub()}
            placeholder="Nouveau club" className={selectClass} />
          <button onClick={handleCreateClub}
            className="bg-[#185FA5] text-white text-[12px] font-medium px-4 py-2 rounded-md hover:bg-[#0C447C] transition-colors">
            +
          </button>
        </div>
      </div>

      {/* ── Parcours ─────────────────────────────────────────────────────── */}
      {clubId && (
        <div>
          <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Parcours</label>

          {/* Si un seul parcours → afficher directement sans dropdown */}
          {courses.length === 1 ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
              <span className="text-[13px] text-gray-700 flex-1">{courses[0].course_name}</span>
              <button
                onClick={() => setCourseId(null)}
                className="text-[11px] text-gray-400 hover:text-gray-600"
              >
                Changer
              </button>
            </div>
          ) : (
            <select value={courseId || ''} onChange={e => setCourseId(e.target.value || null)}
              className={selectClass}>
              <option value="">Choisir un parcours…</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.course_name}</option>)}
            </select>
          )}

          <div className="flex gap-2 mt-2">
            <input value={newCourse} onChange={e => setNewCourse(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateCourse()}
              placeholder="Nouveau parcours" className={selectClass} />
            <button onClick={handleCreateCourse}
              className="bg-[#185FA5] text-white text-[12px] font-medium px-4 py-2 rounded-md hover:bg-[#0C447C] transition-colors">
              +
            </button>
          </div>
        </div>
      )}

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
                {saving ? 'Saving…' : 'Sauvegarder'}
              </button>
            </div>
          </div>

          <div className="p-4 space-y-6">

            {/* ── Tees ── */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Tees</p>
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Tee', 'Par', 'Distance (m)', 'CR', 'Slope'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[11px] font-medium text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tees.map(t => (
                    <tr key={t.id} className="border-b border-gray-100">
                      <td className="px-2 py-1.5"><input value={t.tee_name ?? ''} onChange={e => updateTee(t.id, 'tee_name', e.target.value)} className={inputClass} /></td>
                      <td className="px-2 py-1.5"><input type="number" value={t.par_total ?? ''} onChange={e => updateTee(t.id, 'par_total', Number(e.target.value))} className={inputClass + ' text-center'} /></td>
                      <td className="px-2 py-1.5"><input type="number" value={t.distance_total ?? ''} onChange={e => updateTee(t.id, 'distance_total', Number(e.target.value))} className={inputClass + ' text-center'} /></td>
                      <td className="px-2 py-1.5"><input type="number" step="0.1" value={t.course_rating ?? ''} onChange={e => updateTee(t.id, 'course_rating', Number(e.target.value))} className={inputClass + ' text-center'} /></td>
                      <td className="px-2 py-1.5"><input type="number" value={t.slope ?? ''} onChange={e => updateTee(t.id, 'slope', Number(e.target.value))} className={inputClass + ' text-center'} /></td>
                    </tr>
                  ))}
                  {/* Nouvelle ligne tee */}
                  <tr className="bg-gray-50/50">
                    <td className="px-2 py-1.5">
                      <input value={newTee} onChange={e => setNewTee(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreateTee()}
                        placeholder="Ex: Yellow Men" className={inputClass} />
                    </td>
                    <td className="px-2 py-1.5"><input type="number" value={newTeeData.par_total} onChange={e => setNewTeeData(p => ({ ...p, par_total: Number(e.target.value) }))} className={inputClass + ' text-center'} /></td>
                    <td className="px-2 py-1.5"><input type="number" value={newTeeData.distance_total || ''} onChange={e => setNewTeeData(p => ({ ...p, distance_total: Number(e.target.value) }))} placeholder="-" className={inputClass + ' text-center'} /></td>
                    <td className="px-2 py-1.5"><input type="number" step="0.1" value={newTeeData.course_rating} onChange={e => setNewTeeData(p => ({ ...p, course_rating: Number(e.target.value) }))} className={inputClass + ' text-center'} /></td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <input type="number" value={newTeeData.slope} onChange={e => setNewTeeData(p => ({ ...p, slope: Number(e.target.value) }))} className={inputClass + ' text-center'} />
                        <button onClick={handleCreateTee}
                          className="bg-[#185FA5] text-white text-[12px] font-medium px-3 rounded-md hover:bg-[#0C447C] transition-colors whitespace-nowrap">
                          +
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── Trous ── */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Trous</p>
              <div className="grid grid-cols-2 gap-4">
                {[0, 1].map(half => {
                  const start    = half * 9
                  const label    = half === 0 ? 'OUT' : 'IN'
                  const subtotal = holes.slice(start, start + 9).reduce((s, h) => s + h.par, 0)
                  return (
                    <table key={half} className="w-full text-[12px] border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          {['Trou', 'Par', 'SI', 'm'].map(h => (
                            <th key={h} className="px-2 py-1.5 text-center text-[11px] font-medium text-gray-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {holes.slice(start, start + 9).map((h, i) => (
                          <tr key={h.hole_number} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-2 py-1 text-center text-[12px] font-medium text-gray-700">{h.hole_number}</td>
                            <td className="px-1 py-1"><input type="number" value={h.par} min={3} max={5} onChange={e => updateHole(start + i, 'par', Number(e.target.value))} className={inputClass + ' text-center'} /></td>
                            <td className="px-1 py-1"><input type="number" value={h.stroke_index} min={1} max={18} onChange={e => updateHole(start + i, 'stroke_index', Number(e.target.value))} className={inputClass + ' text-center'} /></td>
                            <td className="px-1 py-1"><input type="number" value={h.hole_distance === 0 ? '' : h.hole_distance} min={0} placeholder="-" onChange={e => updateHole(start + i, 'hole_distance', Number(e.target.value))} className={inputClass + ' text-center'} /></td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 font-medium">
                          <td className="px-2 py-1.5 text-center text-[12px] text-gray-600">{label}</td>
                          <td className="px-2 py-1.5 text-center text-[12px] text-gray-700">{subtotal}</td>
                          <td colSpan={2} />
                        </tr>
                      </tbody>
                    </table>
                  )
                })}
              </div>
              <div className="mt-2 text-right text-[12px] font-medium text-gray-600">
                TOT : {parTotal}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

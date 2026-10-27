'use client'

// Carte de score hors événement : un joueur encode une partie jouée sur un parcours de la base GolfGo,
// en dehors de tout événement. Visible uniquement par lui (tables personal_rounds / personal_round_scores,
// protégées par RLS : player_id = auth_player_id()).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/supabase/client'
import ScorecardTable, { type ScoreEntrant } from '@/components/scorecards/ScorecardTable'
import { computePhcp, findDefaultTee, type Hole, type ScoreMap, type TeeInfo } from '@/components/scorecards/scorecard-types'
import { getStablefordPoints, strokesReceived } from '@/lib/golf/scoring/stableford'

const supabase = createClient()

type Me = { id: string; whs: number | null; default_tee_color: string | null; gender: string | null }
type Club = { id: string; name: string; country: string | null }
type Course = { id: string; course_name: string | null }
type SavedRound = {
  id: string
  played_on: string
  playing_handicap: number | null
  tee_id: string | null
  course_id: string
  courses: { id: string; course_name: string | null; club_id: string; clubs: { name: string } | null } | null
  course_tees: { tee_name: string } | null
  personal_round_scores: { hole: number; strokes: number }[]
}

const selectClass = 'w-full border border-slate-200 rounded-xl px-3 py-3 text-[15px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] bg-white'
const cardStyle = { background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } as const
const labelClass = 'block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2'

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const todayIso = () => new Date().toLocaleDateString('en-CA') // AAAA-MM-JJ, dans le fuseau du joueur

export default function FreeRoundPage() {
  const t = useTranslations('freeRound')
  const tc = useTranslations()
  const locale = useLocale()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [clubs, setClubs] = useState<Club[]>([])
  const [rounds, setRounds] = useState<SavedRound[]>([])
  const [roundHoles, setRoundHoles] = useState<Record<string, Hole[]>>({}) // trous des parcours des cartes enregistrées

  // Formulaire
  const [editingId, setEditingId] = useState<string | null>(null)
  const [clubQuery, setClubQuery] = useState('')
  const [club, setClub] = useState<Club | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [playableCourseIds, setPlayableCourseIds] = useState<Set<string>>(new Set()) // parcours dont les trous sont encodés
  const [courseId, setCourseId] = useState<string>('')
  const [tees, setTees] = useState<TeeInfo[]>([])
  const [teeId, setTeeId] = useState<string>('')
  const [holes, setHoles] = useState<Hole[]>([])
  const [playedOn, setPlayedOn] = useState(todayIso())
  const [phcp, setPhcp] = useState<number>(0)
  const [phcpTouched, setPhcpTouched] = useState(false)
  const [scores, setScores] = useState<ScoreMap>({})
  const [courseLoading, setCourseLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const dateFmt = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }), [locale])
  const formatDate = (iso: string) => dateFmt.format(new Date(`${iso}T12:00:00`))

  // ── Chargement initial : joueur, clubs, cartes enregistrées ──
  const loadRounds = useCallback(async (playerId: string) => {
    const { data } = await supabase
      .from('personal_rounds')
      .select('id, played_on, playing_handicap, tee_id, course_id, courses(id, course_name, club_id, clubs(name)), course_tees(tee_name), personal_round_scores(hole, strokes)')
      .eq('player_id', playerId)
      .order('played_on', { ascending: false })
      .order('created_at', { ascending: false })
    const list = (data ?? []) as unknown as SavedRound[]
    setRounds(list)
    const courseIds = [...new Set(list.map(r => r.course_id))]
    if (courseIds.length > 0) {
      const { data: hs } = await supabase.from('course_holes').select('course_id, hole_number, par, stroke_index').in('course_id', courseIds)
      const byCourse: Record<string, Hole[]> = {}
      for (const h of (hs ?? []) as any[]) (byCourse[h.course_id] ??= []).push({ hole_number: h.hole_number, par: h.par, stroke_index: h.stroke_index })
      setRoundHoles(byCourse)
    } else {
      setRoundHoles({})
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setError(tc('scorecard.notConnected')); setLoading(false); return }
      const { data: p } = await supabase.from('players')
        .select('id, whs, default_tee_color, gender').eq('user_id', session.user.id).single()
      if (!p) { setError(tc('scorecard.noProfile')); setLoading(false); return }
      setMe(p as Me)
      const [{ data: clubData }] = await Promise.all([
        supabase.from('clubs').select('id, name, country').order('name'),
        loadRounds(p.id),
      ])
      // Un parcours n'est jouable ici que si ses trous sont encodés dans GolfGo (9 au moins) : sinon pas de carte possible.
      const { data: courseRows } = await supabase.from('courses').select('id, club_id, course_holes(count)')
      const okCourses = new Set<string>()
      const okClubs = new Set<string>()
      for (const c of (courseRows ?? []) as any[]) {
        if ((c.course_holes?.[0]?.count ?? 0) >= 9) { okCourses.add(c.id); okClubs.add(c.club_id) }
      }
      setPlayableCourseIds(okCourses)
      const list = ((clubData ?? []) as Club[]).filter(c => okClubs.has(c.id))
      // Les clubs belges d'abord : c'est là que jouent les groupes de GolfGo.
      list.sort((a, b) => Number(b.country === 'BE') - Number(a.country === 'BE') || a.name.localeCompare(b.name, locale))
      setClubs(list)
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Parcours, départs et trous d'un club / parcours ──
  async function pickClub(c: Club | null) {
    setClub(c)
    setClubQuery('')
    setCourseId(''); setCourses([]); setTees([]); setTeeId(''); setHoles([]); setScores({})
    setPhcpTouched(false)
    if (!c) return
    const { data } = await supabase.from('courses').select('id, course_name').eq('club_id', c.id).order('course_name')
    const list = ((data ?? []) as Course[]).filter(c => playableCourseIds.has(c.id))
    setCourses(list)
    if (list.length === 1) await pickCourse(list[0].id)
  }

  async function pickCourse(id: string, preset?: { teeId: string | null }) {
    setCourseId(id)
    setTees([]); setTeeId(''); setHoles([])
    if (!preset) { setScores({}); setPhcpTouched(false) }   // autre parcours : on repart d'une carte vide
    if (!id) return
    setCourseLoading(true)
    const [{ data: teeData }, { data: holeData }] = await Promise.all([
      supabase.from('course_tees').select('id, tee_name, par_total, course_rating, slope').eq('course_id', id).order('tee_name'),
      supabase.from('course_holes').select('hole_number, par, stroke_index').eq('course_id', id).order('hole_number'),
    ])
    const teeList = (teeData ?? []) as TeeInfo[]
    setTees(teeList)
    setHoles((holeData ?? []) as Hole[])
    const preferred = preset?.teeId
      ? teeList.find(x => x.id === preset.teeId)
      : (me?.default_tee_color ? findDefaultTee(teeList, me.default_tee_color, me.gender ?? undefined) : undefined)
    setTeeId((preferred ?? teeList[0])?.id ?? '')
    setCourseLoading(false)
  }

  const tee = tees.find(x => x.id === teeId)

  // Le handicap de jeu se recalcule tant que le joueur ne l'a pas corrigé lui-même.
  useEffect(() => {
    if (phcpTouched || !me) return
    setPhcp(me.whs != null ? computePhcp(me.whs, tee) : 0)
  }, [me, tee, phcpTouched])

  const entrants: ScoreEntrant[] = me ? [{ id: me.id, phcp }] : []
  const myScores = me ? scores[me.id] ?? {} : {}
  const filledCount = Object.values(myScores).filter(v => v != null && v > 0).length

  // ── Enregistrement ──
  async function save() {
    if (!me || !courseId) return
    const rows = Object.entries(myScores)
      .filter(([, v]) => v != null && (v as number) > 0)
      .map(([h, v]) => ({ hole: Number(h), strokes: v as number }))
    if (rows.length === 0) { toast.error(t('nothingToSave')); return }
    if (rows.some(r => r.strokes > 20 || r.hole < 1 || r.hole > 18)) { toast.error(t('saveError')); return }
    setSaving(true)
    try {
      const base = { course_id: courseId, tee_id: teeId || null, played_on: playedOn, playing_handicap: phcp }
      let roundId = editingId
      if (roundId) {
        const { error: e } = await supabase.from('personal_rounds').update({ ...base, updated_at: new Date().toISOString() }).eq('id', roundId)
        if (e) throw e
      } else {
        const { data, error: e } = await supabase.from('personal_rounds').insert({ ...base, player_id: me.id }).select('id').single()
        if (e || !data) throw e ?? new Error('insert')
        roundId = data.id as string
      }
      const { error: e2 } = await supabase.from('personal_round_scores')
        .upsert(rows.map(r => ({ round_id: roundId, ...r })), { onConflict: 'round_id,hole' })
      if (e2) throw e2
      // Trous effacés depuis le dernier enregistrement
      const keep = `(${rows.map(r => r.hole).join(',')})`
      const { error: e3 } = await supabase.from('personal_round_scores').delete().eq('round_id', roundId).not('hole', 'in', keep)
      if (e3) throw e3
      toast.success(t('saved'))
      resetForm()
      await loadRounds(me.id)
    } catch {
      toast.error(t('saveError'))
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setEditingId(null); setClub(null); setClubQuery(''); setCourses([]); setCourseId(''); setTees([]); setTeeId('')
    setHoles([]); setScores({}); setPlayedOn(todayIso()); setPhcpTouched(false)
  }

  async function startEdit(r: SavedRound) {
    if (!me || !r.courses) return
    setEditingId(r.id)
    setClub({ id: r.courses.club_id, name: r.courses.clubs?.name ?? '', country: null })
    const { data } = await supabase.from('courses').select('id, course_name').eq('club_id', r.courses.club_id).order('course_name')
    setCourses((data ?? []) as Course[])
    setPlayedOn(r.played_on)
    setPhcpTouched(r.playing_handicap != null)
    if (r.playing_handicap != null) setPhcp(r.playing_handicap)
    const map: Record<number, number | null> = {}
    for (const s of r.personal_round_scores) map[s.hole] = s.strokes
    setScores({ [me.id]: map })
    await pickCourse(r.course_id, { teeId: r.tee_id })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function remove(r: SavedRound) {
    if (!me || !window.confirm(t('deleteConfirm'))) return
    const { error: e } = await supabase.from('personal_rounds').delete().eq('id', r.id)
    if (e) { toast.error(t('saveError')); return }
    toast.success(t('deleted'))
    if (editingId === r.id) resetForm()
    await loadRounds(me.id)
  }

  function summary(r: SavedRound) {
    const hs = roundHoles[r.course_id] ?? []
    let gross = 0, pts = 0
    for (const s of r.personal_round_scores) {
      gross += s.strokes
      const h = hs.find(x => x.hole_number === s.hole)
      if (h) pts += getStablefordPoints(s.strokes, h.par, strokesReceived(r.playing_handicap ?? 0, h.stroke_index))
    }
    return { gross, pts, count: r.personal_round_scores.length }
  }

  // ── Rendu ──
  if (loading) return (
    <div className="p-6 space-y-3 max-w-2xl">
      {[1, 2, 3].map(i => <div key={i} className="h-14 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <p className="text-[15px] font-bold text-slate-700 mb-3">{error}</p>
      <a href="/scorecard" className="text-[13px] font-semibold text-[#185FA5]">{t('back')}</a>
    </div>
  )

  const matches = clubQuery.trim().length > 0 ? clubs.filter(c => norm(c.name).includes(norm(clubQuery.trim()))).slice(0, 30) : []

  return (
    <div className="p-5 sm:p-6 max-w-2xl pb-28 sm:pb-8">
      <a href="/scorecard" className="text-[13px] font-semibold text-[#185FA5] on-bg">← {t('back')}</a>
      <h1 className="text-[22px] font-black text-slate-900 tracking-tight mt-2 mb-1">{t('title')}</h1>
      <p className="text-[13px] text-slate-700 on-bg mb-5">{t('intro')}</p>

      {/* ── Formulaire ── */}
      <div className="rounded-xl border border-white/60 shadow-sm p-4 mb-5 space-y-4" style={cardStyle}>
        <p className="text-[15px] font-extrabold text-slate-800">{editingId ? t('editRound') : t('newRound')}</p>

        {/* Club */}
        <div>
          <label className={labelClass}>{t('club')}</label>
          {club ? (
            <div className="flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-3 py-3">
              <span className="text-[15px] font-semibold text-slate-900">{club.name}</span>
              {!editingId && (
                <button type="button" onClick={() => pickClub(null)} className="text-[13px] font-semibold text-[#185FA5] shrink-0">{t('change')}</button>
              )}
            </div>
          ) : (
            <>
              <input type="search" value={clubQuery} onChange={e => setClubQuery(e.target.value)}
                placeholder={t('clubSearch')} className={selectClass} autoComplete="off" />
              {clubQuery.trim().length > 0 && (
                <div className="mt-2 bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {matches.length === 0
                    ? <p className="px-3 py-3 text-[14px] text-slate-500">{t('noClubs')}</p>
                    : matches.map(c => (
                      <button key={c.id} type="button" onClick={() => pickClub(c)}
                        className="w-full text-left px-3 py-3 text-[15px] text-slate-900 hover:bg-slate-50 active:bg-slate-100">
                        {c.name}
                        {c.country && c.country !== 'BE' && <span className="ml-2 text-[11px] font-bold text-slate-400">{c.country}</span>}
                      </button>
                    ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Parcours */}
        {club && courses.length > 1 && (
          <div>
            <label className={labelClass}>{t('course')}</label>
            <select value={courseId} onChange={e => pickCourse(e.target.value)} className={selectClass} disabled={!!editingId}>
              <option value="">—</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.course_name}</option>)}
            </select>
          </div>
        )}

        {courseId && (
          courseLoading ? <div className="h-12 bg-white/50 rounded-xl animate-pulse" /> : (
            <>
              {holes.length === 0 ? (
                <p className="text-[14px] font-semibold text-amber-700">{t('noHoles')}</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>{t('tee')}</label>
                      {tees.length === 0
                        ? <p className="text-[13px] text-slate-600">{t('noTees')}</p>
                        : <select value={teeId} onChange={e => { setTeeId(e.target.value); setPhcpTouched(false) }} className={selectClass}>
                            {tees.map(x => <option key={x.id} value={x.id}>{x.tee_name}</option>)}
                          </select>}
                    </div>
                    <div>
                      <label className={labelClass}>{t('date')}</label>
                      <input type="date" value={playedOn} max={todayIso()} onChange={e => e.target.value && setPlayedOn(e.target.value)} className={selectClass} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>{t('handicap')}</label>
                    <input type="number" inputMode="numeric" value={phcp} min={-10} max={60}
                      onChange={e => { setPhcpTouched(true); setPhcp(Math.round(Number(e.target.value) || 0)) }}
                      className={`${selectClass} max-w-[140px]`} />
                    <p className="text-[12px] text-slate-600 mt-1">{t('handicapHint')}</p>
                  </div>
                </>
              )}
            </>
          )
        )}
      </div>

      {/* ── Saisie des scores ── */}
      {courseId && holes.length > 0 && me && !courseLoading && (
        <div className="mb-5">
          <div className="rounded-xl border border-white/60 shadow-sm overflow-hidden" style={cardStyle}>
            <ScorecardTable holes={holes} players={entrants} scores={scores} setScores={setScores} eventFormat="stableford" />
          </div>
          <div className="grid grid-cols-1 gap-3 mt-4">
            <button type="button" onClick={save} disabled={saving || filledCount === 0}
              className="h-14 rounded-xl bg-[#185FA5] text-white text-[16px] font-bold disabled:opacity-40">
              {saving ? '…' : editingId ? t('saveChanges') : t('save')}
            </button>
            {(editingId || club) && (
              <button type="button" onClick={resetForm}
                className="h-11 rounded-xl bg-white/80 border border-slate-200 text-[14px] font-semibold text-slate-700">
                {editingId ? t('cancelEdit') : t('cancel')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Mes cartes ── */}
      <h2 className="text-[16px] font-extrabold text-slate-900 on-bg mb-2 mt-8">{t('myRounds')}</h2>
      {rounds.length === 0 ? (
        <p className="text-[14px] text-slate-700 on-bg">{t('noRounds')}</p>
      ) : (
        <div className="space-y-2">
          {rounds.map(r => {
            const s = summary(r)
            return (
              <div key={r.id} className={`rounded-xl border shadow-sm p-3 ${editingId === r.id ? 'border-[#185FA5]' : 'border-white/60'}`} style={cardStyle}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">{formatDate(r.played_on)}</p>
                    <p className="text-[15px] font-bold text-slate-900 truncate">{r.courses?.clubs?.name ?? '—'}</p>
                    <p className="text-[12.5px] text-slate-600 truncate">
                      {[r.courses?.course_name, r.course_tees?.tee_name].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[20px] font-black text-[#185FA5] leading-none">{s.pts} <span className="text-[11px] font-bold text-slate-500">{t('points')}</span></p>
                    <p className="text-[12px] text-slate-600 mt-1">{t('gross')} {s.gross} · {t('holesCount', { count: s.count })}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button type="button" onClick={() => startEdit(r)}
                    className="flex-1 h-10 rounded-lg bg-white/80 border border-slate-200 text-[13px] font-semibold text-slate-800">{t('edit')}</button>
                  <button type="button" onClick={() => remove(r)}
                    className="h-10 px-4 rounded-lg bg-white/80 border border-slate-200 text-[13px] font-semibold text-red-600">{t('delete')}</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

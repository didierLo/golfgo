'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ScorecardTable from '@/components/scorecards/ScorecardTable'
import { useGroupRole } from '@/lib/hooks/useGroupRole'

const supabase = createClient()

export type Hole    = { hole_number: number; par: number; stroke_index: number }
export type TeeInfo = { id: string; tee_name: string; par_total: number; course_rating: number; slope: number }
export type Player  = { id: string; first_name: string; surname: string; whs: number; tee_id: string | null; tee?: TeeInfo; phcp: number }
export type ScoreMap = Record<string, Record<number, number | null>>

export function computePhcp(whs: number, tee?: TeeInfo): number {
  if (!tee) return Math.round(whs)
  return Math.round(whs * (tee.slope / 113) + tee.course_rating - tee.par_total)
}

function fallbackHoles(): Hole[] {
  return Array.from({ length: 18 }, (_, i) => ({
    hole_number: i + 1, par: [4, 4, 3, 5, 4, 4, 3, 4, 5][i % 9], stroke_index: i + 1,
  }))
}

function getTeeColor(teeName: string): { bg: string; text: string } {
  const n = teeName.toLowerCase()
  if (n.includes('yellow')) return { bg: '#FEF3C7', text: '#92400E' }
  if (n.includes('red'))    return { bg: '#FEE2E2', text: '#991B1B' }
  if (n.includes('white'))  return { bg: '#F3F4F6', text: '#374151' }
  if (n.includes('blue'))   return { bg: '#DBEAFE', text: '#1E40AF' }
  if (n.includes('black'))  return { bg: '#1F2937', text: '#F9FAFB' }
  if (n.includes('gold'))   return { bg: '#FDE68A', text: '#78350F' }
  return { bg: '#F3F4F6', text: '#374151' }
}

function findDefaultTee(teesData: TeeInfo[], color: string, gender?: string): TeeInfo | undefined {
  const c = color.toLowerCase()
  const genderWord = gender === 'F' ? 'lad' : 'men'
  return (
    teesData.find(t => t.tee_name.toLowerCase().includes(c) && t.tee_name.toLowerCase().includes(genderWord)) ??
    teesData.find(t => t.tee_name.toLowerCase() === c) ??
    teesData.find(t => t.tee_name.toLowerCase().startsWith(c)) ??
    teesData.find(t => t.tee_name.toLowerCase().includes(c))
  )
}

const inputClass = "w-full border border-gray-200 rounded-md px-3 py-2 text-[13px] focus:outline-none focus:border-blue-300 bg-white"

export default function ScorecardsPage() {
  const params  = useParams()
  const groupId = params.id as string
  const eventId = params.eventId as string

  const { role, loading: roleLoading } = useGroupRole(groupId)
  const isOwner = role === 'owner'

  const [clubs, setClubs]                   = useState<{ id: string; name: string }[]>([])
  const [selectedClubId, setSelectedClubId] = useState('')
  const [courses, setCourses]               = useState<{ id: string; course_name: string }[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [newClubName, setNewClubName]       = useState('')
  const [showNewClub, setShowNewClub]       = useState(false)
  const [newCourseName, setNewCourseName]   = useState('')
  const [showNewCourse, setShowNewCourse]   = useState(false)
  const [creating, setCreating]             = useState(false)

  const [loading, setLoading]               = useState(true)
  const [scorecardLoading, setScorecardLoading] = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [saving, setSaving]                 = useState(false)
  const [saveMsg, setSaveMsg]               = useState('')

  const [holes, setHoles]                   = useState<Hole[]>([])
  const [tees, setTees]                     = useState<TeeInfo[]>([])
  const [players, setPlayers]               = useState<Player[]>([])
  const [scores, setScores]                 = useState<ScoreMap>({})
  const [scorecardId, setScorecardId]       = useState<string | null>(null)
  const [eventFormat, setEventFormat]       = useState<'stroke' | 'stableford'>('stableford')
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null)

  useEffect(() => { loadInit() }, [eventId])
  useEffect(() => {
    if (selectedClubId) loadCourses(selectedClubId)
    else { setCourses([]); setSelectedCourseId('') }
  }, [selectedClubId])
  useEffect(() => { if (selectedCourseId) loadScorecard(selectedCourseId) }, [selectedCourseId])

  async function loadInit() {
    setLoading(true)
    const { data: clubsData } = await supabase.from('clubs').select('id, name').order('name')
    setClubs(clubsData || [])
    const { data: event } = await supabase
      .from('events').select('course_id, competition_format:competition_format_id(scoring_type)').eq('id', eventId).single()
    if (event) {
      setEventFormat((event.competition_format as any)?.scoring_type ?? 'stableford')
      if (event.course_id) {
        const { data: course } = await supabase
          .from('courses').select('id, course_name, club_id').eq('id', event.course_id).single()
        if (course) {
          setSelectedClubId(course.club_id)
          setSelectedCourseId(event.course_id)
          const { data: coursesData } = await supabase
            .from('courses').select('id, course_name').eq('club_id', course.club_id).order('course_name')
          setCourses(coursesData || [])
        }
      }
    }
    setLoading(false)
  }

  async function loadCourses(clubId: string) {
    const { data } = await supabase.from('courses').select('id, course_name').eq('club_id', clubId).order('course_name')
    setCourses(data || [])
  }

  async function loadScorecard(courseId: string) {
    setScorecardLoading(true)
    setError(null)
    try {
      if (isOwner) await supabase.from('events').update({ course_id: courseId }).eq('id', eventId)
      const { data: holesData } = await supabase.from('course_holes').select('hole_number, par, stroke_index').eq('course_id', courseId).order('hole_number')
      setHoles(holesData?.length ? holesData : fallbackHoles())
      const { data: teesData } = await supabase.from('course_tees').select('id, tee_name, par_total, course_rating, slope').eq('course_id', courseId).order('tee_name')
      setTees(teesData || [])

      let scId: string | null = null
      const { data: existing } = await supabase.from('scorecards').select('id').eq('event_id', eventId).maybeSingle()
      if (existing) { scId = existing.id }
      else if (isOwner) {
        const { data: created } = await supabase.from('scorecards').insert({ event_id: eventId }).select('id').single()
        scId = created?.id ?? null
      }
      setScorecardId(scId)

      // Charger participants avec genre
      const { data: participants } = await supabase
        .from('event_participants')
        .select('player_id, tee_id, players(id, first_name, surname, whs, default_tee_color, gender)')
        .eq('event_id', eventId).order('created_at')

        console.log('participants raw:', (participants || []).map((ep: any) => ({
       name: ep.players?.first_name,
       gender: ep.players?.gender,
        color: ep.players?.default_tee_color,
        }))) 
        console.log('p0:', JSON.stringify((participants || [])[0]))
        console.log('p_male:', JSON.stringify((participants || []).find((ep: any) => ep.players?.gender === 'M')))
        

      const teeUpdates: { player_id: string; tee_id: string }[] = []
      const built: Player[] = (participants || []).map((ep: any) => {
        const p = ep.players
        let teeId = ep.tee_id ?? null
        let tee: TeeInfo | undefined = (teesData || []).find(t => t.id === teeId)
        if (!teeId && p.default_tee_color) {
          const defaultTee = findDefaultTee(teesData || [], p.default_tee_color, p.gender)
          if (defaultTee) { teeId = defaultTee.id; tee = defaultTee; teeUpdates.push({ player_id: p.id, tee_id: defaultTee.id }) }
        }
        return { id: p.id, first_name: p.first_name, surname: p.surname, whs: p.whs ?? 0, tee_id: teeId, tee, phcp: computePhcp(p.whs ?? 0, tee) }
      })
      setPlayers(built)
      if (built.length > 0) setActivePlayerId(built[0].id)

      if (isOwner) {
        for (const u of teeUpdates) {
          await supabase.from('event_participants').update({ tee_id: u.tee_id }).eq('event_id', eventId).eq('player_id', u.player_id)
        }
      }

      if (scId && built.length > 0) {
        if (isOwner) {
          const { count } = await supabase.from('scorecard_players').select('*', { count: 'exact', head: true }).eq('scorecard_id', scId)
          if (count === 0) await supabase.from('scorecard_players').insert(built.map((p, i) => ({ scorecard_id: scId, player_id: p.id, position: i + 1 })))
        }
        const { data: scoresData } = await supabase.from('scores').select('player_id, hole, strokes').eq('scorecard_id', scId).eq('event_id', eventId).in('player_id', built.map(p => p.id))
        const map: ScoreMap = {}
        built.forEach(p => { map[p.id] = {} })
        scoresData?.forEach(s => { map[s.player_id][s.hole] = s.strokes })
        setScores(map)
      }
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors du chargement')
    } finally {
      setScorecardLoading(false)
    }
  }

  async function handleTeeChange(playerId: string, teeId: string) {
    if (!isOwner) return
    await supabase.from('event_participants').update({ tee_id: teeId }).eq('event_id', eventId).eq('player_id', playerId)
    const tee = tees.find(t => t.id === teeId)
    const player = players.find(p => p.id === playerId)
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, tee_id: teeId, tee, phcp: computePhcp(player?.whs ?? 0, tee) } : p))
  }

  async function handleRemovePlayer(playerId: string) {
    if (!isOwner || !scorecardId) return
    await supabase.from('scorecard_players').delete().eq('scorecard_id', scorecardId).eq('player_id', playerId)
    const remaining = players.filter(p => p.id !== playerId)
    setPlayers(remaining)
    if (activePlayerId === playerId) setActivePlayerId(remaining[0]?.id ?? null)
  }

  async function handleSave() {
    if (!isOwner || !scorecardId) return
    setSaving(true)
    try {
      const rows = players.flatMap(player =>
        Object.entries(scores[player.id] ?? {}).filter(([, s]) => s != null).map(([hole, strokes]) => ({
          scorecard_id: scorecardId, event_id: eventId, player_id: player.id, hole: Number(hole), strokes: strokes as number,
        }))
      )
      if (rows.length > 0) await supabase.from('scores').upsert(rows, { onConflict: 'scorecard_id,player_id,hole' })
      setSaveMsg('Sauvegardé')
    } catch { setSaveMsg('Erreur') }
    finally { setSaving(false); setTimeout(() => setSaveMsg(''), 3000) }
  }

  async function handleCreateClub() {
    if (!newClubName.trim() || !isOwner) return
    setCreating(true)
    const { data, error } = await supabase.from('clubs').insert({ name: newClubName.trim() }).select('id, name').single()
    if (error) { alert(error.message); setCreating(false); return }
    setClubs(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setSelectedClubId(data.id)
    setNewClubName(''); setShowNewClub(false); setCreating(false)
  }

  async function handleCreateCourse() {
    if (!newCourseName.trim() || !selectedClubId || !isOwner) return
    setCreating(true)
    const { data, error } = await supabase.from('courses').insert({ club_id: selectedClubId, course_name: newCourseName.trim() }).select('id, course_name').single()
    if (error) { alert(error.message); setCreating(false); return }
    setCourses(prev => [...prev, data].sort((a, b) => a.course_name.localeCompare(b.course_name)))
    setSelectedCourseId(data.id)
    setNewCourseName(''); setShowNewCourse(false); setCreating(false)
  }

  if (loading || roleLoading) return (
    <div className="p-6 space-y-3 max-w-2xl">
      {[1, 2].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
    </div>
  )

  const activePlayer = players.find(p => p.id === activePlayerId) ?? null

  return (
    <div className="p-6 max-w-2xl">

      {!isOwner && (
        <div className="mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-[12px] text-blue-700">
          Vue en lecture seule — seul l'organisateur peut modifier les scorecards
        </div>
      )}

      {/* Club / Parcours */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Club & Parcours</p>

        <div className="mb-3">
          <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Club</label>
          <div className="flex gap-2">
            <select value={selectedClubId} onChange={e => { setSelectedClubId(e.target.value); setSelectedCourseId('') }}
              className={inputClass} disabled={!isOwner}>
              <option value="">Choisir un club…</option>
              {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {isOwner && (
              <button type="button" onClick={() => setShowNewClub(v => !v)}
                className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-white whitespace-nowrap transition-colors">
                {showNewClub ? 'Annuler' : '+ Nouveau'}
              </button>
            )}
          </div>
          {isOwner && showNewClub && (
            <div className="flex gap-2 mt-2">
              <input value={newClubName} onChange={e => setNewClubName(e.target.value)} placeholder="Nom du club" className={inputClass}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateClub())} />
              <button type="button" onClick={handleCreateClub} disabled={creating || !newClubName.trim()}
                className="bg-[#185FA5] text-white text-[12px] font-medium px-4 py-1.5 rounded-md disabled:opacity-50 whitespace-nowrap hover:bg-[#0C447C] transition-colors">
                {creating ? '…' : 'Créer'}
              </button>
            </div>
          )}
        </div>

        {selectedClubId && (
          <div>
            <label className="block text-[12px] font-medium text-gray-500 mb-1.5">Parcours</label>
            <div className="flex gap-2">
              <select value={selectedCourseId} onChange={e => setSelectedCourseId(e.target.value)}
                className={inputClass} disabled={!isOwner}>
                <option value="">Choisir un parcours…</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.course_name}</option>)}
              </select>
              {isOwner && (
                <button type="button" onClick={() => setShowNewCourse(v => !v)}
                  className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-white whitespace-nowrap transition-colors">
                  {showNewCourse ? 'Annuler' : '+ Nouveau'}
                </button>
              )}
            </div>
            {isOwner && showNewCourse && (
              <div className="flex gap-2 mt-2">
                <input value={newCourseName} onChange={e => setNewCourseName(e.target.value)} placeholder="Nom du parcours" className={inputClass}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleCreateCourse())} />
                <button type="button" onClick={handleCreateCourse} disabled={creating || !newCourseName.trim()}
                  className="bg-[#185FA5] text-white text-[12px] font-medium px-4 py-1.5 rounded-md disabled:opacity-50 whitespace-nowrap hover:bg-[#0C447C] transition-colors">
                  {creating ? '…' : 'Créer'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-[13px] text-red-600">{error}</div>}
      {scorecardLoading && <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}</div>}

      {!scorecardLoading && selectedCourseId && (
        <>
          {/* Sélecteur joueur */}
          <div className="flex gap-2 items-center mb-5 flex-wrap">
            {players.map(p => {
              const initials = `${p.first_name?.[0] ?? ''}${p.surname?.[0] ?? ''}`.toUpperCase()
              const isActive = p.id === activePlayerId
              return (
                <button key={p.id} onClick={() => setActivePlayerId(p.id)} title={`${p.first_name} ${p.surname}`}
                  className={`w-11 h-11 rounded-full text-[12px] font-medium border-2 transition-all flex-shrink-0
                    ${isActive ? 'bg-[#185FA5] text-white border-[#185FA5]' : 'bg-white text-gray-600 border-gray-300 hover:border-[#185FA5]'}`}>
                  {initials}
                </button>
              )
            })}
          </div>

          {/* Bandeau joueur */}
          {activePlayer && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-5">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-gray-900 truncate">{activePlayer.first_name} {activePlayer.surname}</p>
                  <div className="flex gap-3 mt-0.5">
                    <span className="text-[12px] text-gray-400">Hcp <span className="font-medium text-gray-700 bg-white border border-gray-200 px-1.5 py-0.5 rounded text-[11px] ml-0.5">{activePlayer.whs}</span></span>
                    <span className="text-[12px] text-gray-400">Phcp <span className="font-medium text-gray-700 ml-0.5">{activePlayer.phcp}</span></span>
                    {activePlayer.tee && <span className="text-[12px] text-gray-400">Tee <span className="font-medium text-gray-700 ml-0.5">{activePlayer.tee.tee_name}</span></span>}
                  </div>
                </div>
                {isOwner && (
                  <button onClick={() => handleRemovePlayer(activePlayer.id)}
                    className="w-8 h-8 border border-gray-200 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors text-lg">−</button>
                )}
              </div>

              {/* Tee selector — boutons colorés */}
              {isOwner && tees.length > 0 && (
                <div className="flex gap-1.5 flex-wrap pt-2 border-t border-gray-200">
                  {tees.map(t => {
                    const teeColor = getTeeColor(t.tee_name)
                    const isSelected = activePlayer.tee_id === t.id
                    return (
                      <button key={t.id} onClick={() => handleTeeChange(activePlayer.id, t.id)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium border-2 transition-all ${
                          isSelected ? 'border-gray-500 shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                        style={{ background: teeColor.bg, color: teeColor.text }}>
                        {t.tee_name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Scorecard */}
          {activePlayer ? (
            <ScorecardTable
              holes={holes}
              player={activePlayer}
              scores={scores}
              setScores={isOwner ? setScores : () => {}}
              eventFormat={eventFormat}
              readOnly={!isOwner}
            />
          ) : (
            <div className="text-center py-12 text-[13px] text-gray-400 border border-dashed border-gray-200 rounded-lg">
              Aucun joueur confirmé pour cet événement
            </div>
          )}

          {/* Save */}
          {isOwner && (
            <div className="flex items-center justify-end gap-3 mt-6 print:hidden">
              {saveMsg && <span className={`text-[12px] font-medium ${saveMsg === 'Sauvegardé' ? 'text-green-600' : 'text-red-500'}`}>{saveMsg}</span>}
              <button onClick={handleSave} disabled={saving}
                className="bg-[#185FA5] text-white text-[13px] font-medium px-5 py-2 rounded-md hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Sauvegarder'}
              </button>
            </div>
          )}
        </>
      )}

      {!scorecardLoading && !selectedCourseId && (
        <div className="text-center py-12 text-[13px] text-gray-400 border border-dashed border-gray-200 rounded-lg">
          {isOwner ? 'Sélectionne un club et un parcours pour accéder aux scorecards' : 'Aucun parcours configuré pour cet événement'}
        </div>
      )}
    </div>
  )
}

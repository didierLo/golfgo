'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

const supabase = createClient()

type Player = { id: string; first_name: string; surname: string }
type ConstraintType = 'forbidden' | 'preferred'
type Pair = {
  id: string
  player_a: string
  player_b: string
  constraint_type: ConstraintType
  // PostgREST renvoie un objet (relation « plusieurs-à-un »), parfois un tableau selon la version : on gère les deux.
  players_a: any
  players_b: any
}

function embedded(v: any): { first_name?: string; surname?: string } | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export default function ConstraintsPage() {
  const params  = useParams()
  const groupId = params.id as string
  const t = useTranslations()
  const router = useRouter()

  const [players, setPlayers] = useState<Player[]>([])
  const [pairs,   setPairs]   = useState<Pair[]>([])
  const [playerA, setPlayerA] = useState('')
  const [playerB, setPlayerB] = useState('')
  const [type,    setType]    = useState<ConstraintType>('forbidden')
  const [adding,  setAdding]  = useState(false)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => { load() }, [])

async function load() {
  // 1) Qui suis-je dans ce groupe ? Seuls les admins reçoivent des données.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { setLoading(false); return }

  const { data: me } = await supabase.from('players')
    .select('id').eq('user_id', user.id).maybeSingle()

  let admin = false
  if (me) {
    const { data: row } = await supabase.from('groups_players')
      .select('role').eq('group_id', groupId).eq('player_id', me.id).maybeSingle()
    admin = row?.role === 'owner'
  }
  if (!admin) {
    const { data: grp } = await supabase.from('groups')
      .select('owner_id').eq('id', groupId).maybeSingle()
    admin = grp?.owner_id === user.id
  }

  if (!admin) { setIsAdmin(false); setLoading(false); return }
  setIsAdmin(true)

  // 2) Admin : membres du groupe + contraintes
  const [{ data: members }, { data: constraints }] = await Promise.all([
    supabase.from('groups_players')
      .select(`player:players(id, first_name, surname)`)
      .eq('group_id', groupId),
    supabase.from('player_pair_constraints')
      .select(`
        id, player_a, player_b, constraint_type,
        players_a:players!player_pair_constraints_player_a_fkey(first_name, surname),
        players_b:players!player_pair_constraints_player_b_fkey(first_name, surname)
      `)
      .eq('group_id', groupId)
  ])

  setPlayers((members || []).map((m: any) => m.player).filter(Boolean))
  setPairs((constraints || []) as any)
  setLoading(false)
}

  // Nom affiché : d'abord la liste des membres du groupe, sinon la jointure.
  function nameOf(id: string, joined: any) {
    const p = players.find(x => x.id === id) ?? embedded(joined)
    return p ? `${p.first_name ?? ''} ${p.surname ?? ''}`.trim() : '—'
  }

  async function addConstraint() {
    if (!playerA || !playerB) return
    if (playerA === playerB) { alert(t('constraints.add.samePlayer')); return }
    const exists = pairs.find(p =>
      (p.player_a === playerA && p.player_b === playerB) ||
      (p.player_a === playerB && p.player_b === playerA)
    )
    if (exists) { alert(t('constraints.add.alreadyExists')); return }
    setAdding(true)
    await supabase.from('player_pair_constraints').insert({
      group_id: groupId, player_a: playerA, player_b: playerB, constraint_type: type,
    })
    setPlayerA(''); setPlayerB('')
    setAdding(false)
    load()
  }

  async function removeConstraint(id: string) {
    await supabase.from('player_pair_constraints').delete().eq('id', id)
    load()
  }

  const forbidden = pairs.filter(p => p.constraint_type === 'forbidden')
  const preferred = pairs.filter(p => p.constraint_type === 'preferred')

  if (loading) return (
    <div className="p-6 space-y-2 max-w-2xl">
      {[1,2,3].map(i => <div key={i} className="h-11 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )

  // Non-admin : aucune donnée affichée (ni paires, ni compteurs).
  if (!isAdmin) return (
    <div className="p-5 sm:p-6 max-w-2xl">
      <button onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-600 transition-colors mb-4 on-bg">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {t('common.back')}
      </button>
      <div className="text-center py-16 text-[13px] text-slate-500 border border-dashed border-slate-200 rounded-xl on-bg-card">
        {t('members.adminOnly')}
      </div>
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-2xl">
      <div className="mb-6">
        
      
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">{t('constraints.title')}</h1>
        <p className="text-[13px] text-slate-900 mt-0.5">{t('constraints.subtitle')}</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
          {t('constraints.add.title')}
        </p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-slate-600">{t('constraints.add.player1')}</label>
            <select value={playerA} onChange={e => setPlayerA(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-[13px] bg-white text-slate-900 min-w-[160px] focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5]">
              <option value="">{t('constraints.add.choose')}</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.surname}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-slate-600">{t('constraints.add.player2')}</label>
            <select value={playerB} onChange={e => setPlayerB(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-[13px] bg-white text-slate-900 min-w-[160px] focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5]">
              <option value="">{t('constraints.add.choose')}</option>
              {players.map(p => <option key={p.id} value={p.id} disabled={p.id === playerA}>{p.first_name} {p.surname}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-semibold text-slate-600">{t('constraints.add.type')}</label>
            <select value={type} onChange={e => setType(e.target.value as ConstraintType)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-[13px] bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5]">
              <option value="forbidden">{t('constraints.forbidden.title')}</option>
              <option value="preferred">{t('constraints.preferred.title')}</option>
            </select>
          </div>

          <button onClick={addConstraint} disabled={adding || !playerA || !playerB}
            className="bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2 rounded-lg hover:bg-[#0C447C] disabled:opacity-40 transition-colors">
            {adding ? t('constraints.add.adding') : t('constraints.add.add')}
          </button>
        </div>
      </div>

      <ConstraintSection
        title={t('constraints.forbidden.title')}
        description={t('constraints.forbidden.desc')}
        pairs={forbidden}
        nameOf={nameOf}
        color={{ bg: '#FCEBEB', text: '#A32D2D', border: '#F7C1C1' }}
        emptyLabel={t('constraints.forbidden.empty')}
        removeLabel={t('constraints.remove')}
        onRemove={removeConstraint}
      />

      <ConstraintSection
        title={t('constraints.preferred.title')}
        description={t('constraints.preferred.desc')}
        pairs={preferred}
        nameOf={nameOf}
        color={{ bg: '#EAF3DE', text: '#3B6D11', border: '#C0DD97' }}
        emptyLabel={t('constraints.preferred.empty')}
        removeLabel={t('constraints.remove')}
        onRemove={removeConstraint}
      />
    </div>
  )
}

function ConstraintSection({ title, description, pairs, nameOf, color, emptyLabel, removeLabel, onRemove }: {
  title: string
  description: string
  pairs: Pair[]
  nameOf: (id: string, joined: any) => string
  color: { bg: string; text: string; border: string }
  emptyLabel: string
  removeLabel: string
  onRemove: (id: string) => void
}) {
  return (
    <div className="mb-6 rounded-xl border overflow-hidden" style={{ borderColor: color.border }}>
      <div className="flex items-center justify-between px-5 py-3"
        style={{ background: color.bg, borderBottom: `1px solid ${color.border}` }}>
        <div>
          <p className="text-[14px] font-bold" style={{ color: color.text }}>{title}</p>
          <p className="text-[12px] mt-0.5" style={{ color: color.text, opacity: 0.75 }}>{description}</p>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0"
          style={{ background: 'white', color: color.text, border: `1px solid ${color.border}` }}>
          {pairs.length}
        </span>
      </div>
      <div className="bg-white p-3 flex flex-col gap-2">
        {pairs.length === 0 ? (
          <div className="text-[12px] text-slate-500 border border-dashed border-slate-200 rounded-lg px-4 py-3 text-center">
            {emptyLabel}
          </div>
        ) : (
          pairs.map(p => (
            <div key={p.id} className="flex items-center gap-3 border border-slate-100 rounded-lg px-4 py-2.5">
              <span className="text-[13px] font-medium text-slate-800 flex-1">
                {nameOf(p.player_a, p.players_a)}
                <span className="text-slate-400 mx-2">×</span>
                {nameOf(p.player_b, p.players_b)}
              </span>
              <button onClick={() => onRemove(p.id)}
                className="text-[11px] font-semibold text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors shrink-0">
                {removeLabel}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

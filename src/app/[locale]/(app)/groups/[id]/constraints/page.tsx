'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

const supabase = createClient()

type Player = { id: string; first_name: string; surname: string }
type ConstraintType = 'forbidden' | 'preferred'
type Pair = {
  id: string
  player_a: string
  player_b: string
  constraint_type: ConstraintType
  players_a: { first_name: string; surname: string }[]
  players_b: { first_name: string; surname: string }[]
}

export default function ConstraintsPage() {
  const params  = useParams()
  const groupId = params.id as string
  const t = useTranslations()

  const [players, setPlayers] = useState<Player[]>([])
  const [pairs,   setPairs]   = useState<Pair[]>([])
  const [playerA, setPlayerA] = useState('')
  const [playerB, setPlayerB] = useState('')
  const [type,    setType]    = useState<ConstraintType>('forbidden')
  const [adding,  setAdding]  = useState(false)

  useEffect(() => { load() }, [])

async function load() {
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

  setPlayers((members || []).map((m: any) => m.player))
  setPairs((constraints || []) as any)
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
        color={{ bg: '#FCEBEB', text: '#A32D2D', border: '#F7C1C1' }}
        emptyLabel={t('constraints.forbidden.empty')}
        removeLabel={t('constraints.remove')}
        onRemove={removeConstraint}
      />

      <ConstraintSection
        title={t('constraints.preferred.title')}
        description={t('constraints.preferred.desc')}
        pairs={preferred}
        color={{ bg: '#EAF3DE', text: '#3B6D11', border: '#C0DD97' }}
        emptyLabel={t('constraints.preferred.empty')}
        removeLabel={t('constraints.remove')}
        onRemove={removeConstraint}
      />
    </div>
  )
}

function ConstraintSection({ title, description, pairs, color, emptyLabel, removeLabel, onRemove }: {
  title: string
  description: string
  pairs: Pair[]
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
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
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
                {p.players_a?.[0]?.first_name} {p.players_a?.[0]?.surname}
                <span className="text-slate-400 mx-2">×</span>
                {p.players_b?.[0]?.first_name} {p.players_b?.[0]?.surname}
              </span>
              <button onClick={() => onRemove(p.id)}
                className="text-[11px] font-semibold text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
                {removeLabel}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

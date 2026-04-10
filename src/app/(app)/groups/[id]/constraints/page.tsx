'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

// ─── Types ────────────────────────────────────────────────────────────────────

type Player = { id: string; first_name: string; surname: string }
type ConstraintType = 'forbidden' | 'preferred'
type Pair = {
  id: string
  player_a: string
  player_b: string
  constraint_type: ConstraintType
  players_a: { first_name: string; surname: string }[]  // ← tableau
  players_b: { first_name: string; surname: string }[]  // ← tableau
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function ConstraintsPage() {
  const params = useParams()
  const groupId = params.id as string

  const [players, setPlayers] = useState<Player[]>([])
  const [pairs, setPairs] = useState<Pair[]>([])
  const [playerA, setPlayerA] = useState('')
  const [playerB, setPlayerB] = useState('')
  const [type, setType] = useState<ConstraintType>('forbidden')
  const [adding, setAdding] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: members } = await supabase
      .from('groups_players')
      .select(`player:players(id, first_name, surname)`)
      .eq('group_id', groupId)
    setPlayers((members || []).map((m: any) => m.player))

    const { data: constraints } = await supabase
      .from('player_pair_constraints')
      .select(`
        id, player_a, player_b, constraint_type,
        players_a:players!player_pair_constraints_player_a_fkey(first_name, surname),
        players_b:players!player_pair_constraints_player_b_fkey(first_name, surname)
      `)
      .eq('group_id', groupId)
    setPairs((constraints || []) as any)
  }

  async function addConstraint() {
    if (!playerA || !playerB) return
    if (playerA === playerB) { alert('Même joueur'); return }

    const exists = pairs.find(p =>
      (p.player_a === playerA && p.player_b === playerB) ||
      (p.player_a === playerB && p.player_b === playerA)
    )
    if (exists) { alert('Contrainte déjà existante'); return }

    setAdding(true)
    await supabase.from('player_pair_constraints').insert({
      group_id: groupId,
      player_a: playerA,
      player_b: playerB,
      constraint_type: type,
    })
    setPlayerA('')
    setPlayerB('')
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
    <div className="p-6 max-w-2xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-[18px] font-medium text-gray-900">Flight constraints</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">
          Définir les paires à éviter ou à favoriser lors de la génération des flights
        </p>
      </div>

      {/* ── Formulaire ajout ───────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Ajouter une contrainte
        </p>
        <div className="flex flex-wrap gap-3 items-end">

          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-gray-500">Joueur 1</label>
            <select
              value={playerA}
              onChange={e => setPlayerA(e.target.value)}
              className="border border-gray-200 rounded-md px-2.5 py-1.5 text-[13px] bg-white min-w-[160px]"
            >
              <option value="">Choisir…</option>
              {players.map(p => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.surname}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-gray-500">Joueur 2</label>
            <select
              value={playerB}
              onChange={e => setPlayerB(e.target.value)}
              className="border border-gray-200 rounded-md px-2.5 py-1.5 text-[13px] bg-white min-w-[160px]"
            >
              <option value="">Choisir…</option>
              {players.map(p => (
                <option key={p.id} value={p.id} disabled={p.id === playerA}>
                  {p.first_name} {p.surname}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-gray-500">Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as ConstraintType)}
              className="border border-gray-200 rounded-md px-2.5 py-1.5 text-[13px] bg-white"
            >
              <option value="forbidden">Forbidden</option>
              <option value="preferred">Preferred</option>
            </select>
          </div>

          <button
            onClick={addConstraint}
            disabled={adding || !playerA || !playerB}
            className="bg-[#185FA5] text-white text-[13px] font-medium px-4 py-1.5 rounded-md hover:bg-[#0C447C] disabled:opacity-40 transition-colors"
          >
            {adding ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>
      </div>

      {/* ── Forbidden ──────────────────────────────────────────────────────── */}
      <ConstraintSection
        title="Forbidden"
        description="Ces joueurs ne seront jamais dans le même flight"
        pairs={forbidden}
        color={{ bg: '#FCEBEB', text: '#A32D2D', border: '#F7C1C1' }}
        label="forbidden"
        onRemove={removeConstraint}
      />

      {/* ── Preferred ──────────────────────────────────────────────────────── */}
      <ConstraintSection
        title="Preferred"
        description="Ces joueurs seront placés ensemble si possible"
        pairs={preferred}
        color={{ bg: '#EAF3DE', text: '#3B6D11', border: '#C0DD97' }}
        label="preferred"
        onRemove={removeConstraint}
      />

    </div>
  )
}

// ─── Section contraintes ──────────────────────────────────────────────────────

function ConstraintSection({
  title,
  description,
  pairs,
  color,
  label,
  onRemove,
}: {
  title: string
  description: string
  pairs: Pair[]
  color: { bg: string; text: string; border: string }
  label: string
  onRemove: (id: string) => void
}) {
  return (
    <div className="mb-6">
      <div className="flex items-baseline gap-2 mb-1">
        <p className="text-[13px] font-medium text-gray-700">{title}</p>
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: color.bg, color: color.text }}
        >
          {pairs.length}
        </span>
      </div>
      <p className="text-[12px] text-gray-400 mb-3">{description}</p>

      {pairs.length === 0 ? (
        <div className="text-[12px] text-gray-400 border border-dashed border-gray-200 rounded-lg px-4 py-3">
          Aucune contrainte {label}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pairs.map(p => (
            <div
              key={p.id}
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-2.5"
            >
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: color.bg, color: color.text, border: `1px solid ${color.border}` }}
              >
                {label}
              </span>
              <span className="text-[13px] text-gray-800 flex-1">
                {p.players_a?.[0]?.first_name} {p.players_a?.[0]?.surname}
                <span className="text-gray-400 mx-2">×</span>
                {p.players_b?.[0]?.first_name} {p.players_b?.[0]?.surname}
              </span>
              <button
                onClick={() => onRemove(p.id)}
                className="text-[11px] text-red-400 border border-red-100 px-2.5 py-1 rounded-md hover:bg-red-50 transition-colors flex-shrink-0"
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

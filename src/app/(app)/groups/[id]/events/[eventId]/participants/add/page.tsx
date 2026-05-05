'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Player = { id: string; first_name: string; surname: string }

export default function AddParticipantsPage() {
  const supabase = createClient()
  const router   = useRouter()
  const params   = useParams()

  const groupId = params.id as string
  const eventId = params.eventId as string

  const [players, setPlayers]   = useState<Player[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)

  useEffect(() => { loadPlayers() }, [])

  async function loadPlayers() {
    const { data, error } = await supabase
      .from('groups_players')
      .select(`player_id, players(id, first_name, surname)`)
      .eq('group_id', groupId)
    if (error) { console.error(error); return }
    const list = (data?.map((p: any) => p.players).flat() || []) as Player[]
    setPlayers(list.sort((a, b) => a.surname.localeCompare(b.surname)))
    setLoading(false)
  }

  function togglePlayer(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  function selectAll() {
    setSelected(selected.length === players.length ? [] : players.map(p => p.id))
  }

  async function handleAddParticipants() {
    if (sending) return
    setSending(true)
    const rows = selected.map(playerId => ({ event_id: eventId, player_id: playerId, status: 'INVITED' }))
    const { error } = await supabase.from('event_participants').upsert(rows, { onConflict: 'event_id,player_id' })
    setSending(false)
    if (error) { alert(error.message); return }
    router.back()
  }

  if (loading) return (
    <div className="p-6 space-y-3 max-w-lg">
      {[1,2,3,4].map(i => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-lg">

      <div className="mb-6">
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Ajouter des participants</h1>
        <p className="text-[13px] text-slate-900 mt-0.5">{players.length} membres disponibles</p>
      </div>

      {/* Select all */}
      <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-white border border-slate-200 rounded-xl">
        <input
          type="checkbox"
          id="select-all"
          checked={selected.length === players.length && players.length > 0}
          onChange={selectAll}
          className="w-4 h-4 rounded accent-[#185FA5]"
        />
        <label htmlFor="select-all" className="text-[13px] font-semibold text-slate-700 cursor-pointer flex-1">
          Tout sélectionner
        </label>
        <span className="text-[12px] text-slate-400 font-medium">
          {selected.length}/{players.length}
        </span>
      </div>

      {/* Liste joueurs */}
      <div className="flex flex-col gap-1.5 mb-6">
        {players.map(player => (
          <label
            key={player.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
              selected.includes(player.id)
                ? 'bg-[#EBF3FC] border-[#B5D4F4]'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <input
              type="checkbox"
              checked={selected.includes(player.id)}
              onChange={() => togglePlayer(player.id)}
              className="w-4 h-4 rounded accent-[#185FA5]"
            />
            <span className={`text-[13px] font-semibold ${
              selected.includes(player.id) ? 'text-[#0C447C]' : 'text-slate-800'
            }`}>
              {player.first_name} {player.surname}
            </span>
          </label>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleAddParticipants}
          disabled={sending || selected.length === 0}
          className="bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-40 transition-colors"
        >
          {sending ? 'Ajout…' : `Inviter ${selected.length > 0 ? `(${selected.length})` : ''}`}
        </button>
        <button
          onClick={() => router.back()}
          className="text-[13px] font-semibold px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Annuler
        </button>
      </div>

    </div>
  )
}

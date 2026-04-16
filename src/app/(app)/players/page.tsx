'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Player = {
  id: string; first_name: string; surname: string
  whs: number | null; federal_no: string | null
}

export default function PlayersPage() {
  const router = useRouter()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')

  useEffect(() => { loadPlayers() }, [])

  async function loadPlayers() {
    const { data, error } = await supabase.from('players')
      .select('id, first_name, surname, whs, federal_no').order('surname')
    if (error) { console.error(error); return }
    setPlayers(data || [])
    setLoading(false)
  }

  async function deletePlayer(id: string) {
    if (!confirm('Supprimer ce joueur ?')) return
    const { error } = await supabase.from('players').delete().eq('id', id)
    if (error) { alert(error.message); return }
    loadPlayers()
  }

  const filtered = players.filter(p => {
    const q = search.toLowerCase()
    return p.first_name.toLowerCase().includes(q) ||
      p.surname.toLowerCase().includes(q) ||
      (p.federal_no ?? '').toLowerCase().includes(q)
  })

  if (loading) return (
    <div className="p-6 space-y-2">
      {[1,2,3,4,5].map(i => <div key={i} className="h-11 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Players</h1>
          <p className="text-[13px] text-slate-600 mt-0.5">{players.length} joueurs</p>
        </div>
        <button onClick={() => router.push('/players/add')}
          className="flex items-center gap-1.5 bg-[#185FA5] text-white text-[13px] font-semibold px-4 py-2 rounded-xl hover:bg-[#0C447C] transition-colors">
          + Add player
        </button>
      </div>

      <div className="mb-4">
        <input type="text" placeholder="Rechercher un joueur…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5]" />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_120px_100px] gap-4 px-4 py-3 bg-slate-50 border-b border-slate-100">
          <span className="text-[12px] font-semibold text-slate-500">Joueur</span>
          <span className="text-[12px] font-semibold text-slate-500 text-center">WHS</span>
          <span className="text-[12px] font-semibold text-slate-500 text-center">N° fédéral</span>
          <span className="text-[12px] font-semibold text-slate-500 text-right">Actions</span>
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-slate-500">
            {search ? 'Aucun résultat' : "Aucun joueur pour l'instant"}
          </div>
        ) : (
          filtered.map((player, i) => (
            <div key={player.id}
              className={`grid grid-cols-[1fr_80px_120px_100px] gap-4 px-4 py-3 items-center hover:bg-slate-50 transition-colors ${i < filtered.length - 1 ? 'border-b border-slate-100' : ''}`}>
              <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push(`/players/${player.id}`)}>
                <div className="w-7 h-7 rounded-full bg-[#EBF3FC] flex items-center justify-center text-[11px] font-bold text-[#0C447C] flex-shrink-0">
                  {player.first_name[0]}{player.surname[0]}
                </div>
                <span className="text-[13px] font-semibold text-slate-900">{player.first_name} {player.surname}</span>
              </div>
              <div className="text-[13px] font-medium text-slate-600 text-center">{player.whs ?? '—'}</div>
              <div className="text-[13px] text-slate-500 text-center font-mono">{player.federal_no || '—'}</div>
              <div className="flex justify-end gap-1">
                <button onClick={() => router.push(`/players/${player.id}/edit`)}
                  className="text-[11px] font-semibold text-slate-600 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                  Edit
                </button>
                <button onClick={() => deletePlayer(player.id)}
                  className="text-[11px] font-semibold text-red-500 border border-red-200 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

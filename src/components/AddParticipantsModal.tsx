'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Player = { id: string; first_name: string; surname: string; email: string | null; whs: number | null }
type Event  = { title: string; location: string | null; starts_at: string }
type Props  = { groupId: string; eventId: string; event: Event; onClose: () => void }

export default function AddParticipantsModal({ groupId, eventId, event, onClose }: Props) {
  const [players, setPlayers]               = useState<Player[]>([])
  const [filteredPlayers, setFilteredPlayers] = useState<Player[]>([])
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [search, setSearch]                 = useState('')
  const [loading, setLoading]               = useState(true)
  const [sending, setSending]               = useState(false)
  const [sendEmail, setSendEmail]           = useState(true)

  useEffect(() => { loadPlayers() }, [])
  useEffect(() => {
    if (!search) { setFilteredPlayers(players); return }
    const s = search.toLowerCase()
    setFilteredPlayers(players.filter(p => `${p.first_name} ${p.surname}`.toLowerCase().includes(s)))
  }, [search, players])

  async function loadPlayers() {
    setLoading(true)
    const { data: groupPlayers } = await supabase.from('groups_players')
      .select(`player_id, players(id, first_name, surname, email, whs)`).eq('group_id', groupId)
    const { data: participants } = await supabase.from('event_participants').select('player_id').eq('event_id', eventId)
    const participantIds = participants?.map(p => p.player_id) ?? []
    const available = groupPlayers?.map((g: any) => g.players).filter((p: Player) => !participantIds.includes(p.id)) ?? []
    setPlayers(available); setFilteredPlayers(available); setLoading(false)
  }

  function togglePlayer(id: string) {
    setSelectedPlayers(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  async function addParticipants() {
    if (selectedPlayers.length === 0) return
    setSending(true)
    const rows = selectedPlayers.map(playerId => ({
      event_id: eventId, player_id: playerId, status: 'INVITED', registration_source: 'manual', invite_token: crypto.randomUUID()
    }))
    const { error } = await supabase.from('event_participants').upsert(rows, { onConflict: 'event_id,player_id' })
    if (error) { alert('Erreur ajout participants'); setSending(false); return }

    if (sendEmail) {
      await fetch('/api/send-invitations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitations: selectedPlayers.map(playerId => ({ email: players.find(p => p.id === playerId)?.email, invite_token: rows.find(r => r.player_id === playerId)?.invite_token })), event: { title: event.title, location: event.location, starts_at: event.starts_at, group_id: groupId, event_id: eventId } })
      })
    }
    setSending(false); onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-[16px] font-black text-slate-900">Ajouter des participants</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">{event.title}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Search */}
          <input type="text" placeholder="Rechercher un joueur…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5]" />

          {/* Select all / clear */}
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-slate-500">{selectedPlayers.length} sélectionné(s)</span>
            <div className="flex gap-2">
              <button onClick={() => setSelectedPlayers(filteredPlayers.map(p => p.id))}
                className="text-[11px] font-semibold text-[#185FA5] hover:underline">Tout sélectionner</button>
              <span className="text-slate-300">·</span>
              <button onClick={() => setSelectedPlayers([])}
                className="text-[11px] font-semibold text-slate-400 hover:text-slate-600">Effacer</button>
            </div>
          </div>

          {/* Players list */}
          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />)}
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="text-center py-6 text-[13px] text-slate-500 border border-dashed border-slate-200 rounded-xl">
              Tous les joueurs sont déjà invités
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
              {filteredPlayers.map((player, i) => (
                <label key={player.id}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors ${i < filteredPlayers.length - 1 ? 'border-b border-slate-100' : ''}`}>
                  <input type="checkbox" checked={selectedPlayers.includes(player.id)} onChange={() => togglePlayer(player.id)} className="rounded accent-[#185FA5]" />
                  <div className="w-7 h-7 rounded-full bg-[#EBF3FC] flex items-center justify-center text-[11px] font-bold text-[#0C447C] flex-shrink-0">
                    {player.first_name[0]}{player.surname[0]}
                  </div>
                  <span className="text-[13px] font-medium text-slate-800 flex-1">{player.first_name} {player.surname}</span>
                  <span className="text-[11px] text-slate-400">{player.whs ?? '—'}</span>
                </label>
              ))}
            </div>
          )}

          {/* Toggle email */}
          <div className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <button type="button" onClick={() => setSendEmail(v => !v)}
              style={{ backgroundColor: sendEmail ? '#185FA5' : '#CBD5E1', transition: 'background-color 0.2s' }}
              className="mt-0.5 w-9 h-5 rounded-full flex items-center px-0.5 flex-shrink-0 cursor-pointer">
              <div style={{ transform: sendEmail ? 'translateX(16px)' : 'translateX(0)', transition: 'transform 0.2s' }}
                className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </button>
            <div>
              <p className="text-[13px] font-semibold text-slate-800">Envoyer un email d'invitation</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {sendEmail ? 'Email envoyé avec lien de réponse' : 'Enregistrement sans notification'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 text-[13px] font-semibold py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            Annuler
          </button>
          <button onClick={addParticipants} disabled={sending || selectedPlayers.length === 0}
            className="flex-1 text-[13px] font-semibold py-2.5 rounded-xl bg-[#185FA5] text-white hover:bg-[#0C447C] disabled:opacity-40 transition-colors">
            {sending ? 'Envoi…' : `Inviter (${selectedPlayers.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}

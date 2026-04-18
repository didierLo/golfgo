'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import PlayerForm from '@/components/forms/PlayerForm'
import BulkAddPlayersModal from '@/components/players/BulkAddPlayersModal'
import ImportPlayers from '@/components/players/ImportPlayers'

const supabase = createClient()

export default function AddPlayerPage() {
  const router = useRouter()
  const [isListModalOpen, setIsListModalOpen] = useState(false)
  const [showImport, setShowImport]           = useState(false)

  return (
    <div className="p-5 sm:p-6 max-w-lg">

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Ajouter un joueur</h1>
          <p className="text-[13px] text-slate-600 mt-0.5">Créer un nouveau profil joueur</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsListModalOpen(true)}
            className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-white/50 text-slate-600 hover:bg-white/30 transition-colors">
            Depuis une liste
          </button>
          <button onClick={() => setShowImport(true)}
            className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-white/50 text-slate-600 hover:bg-white/30 transition-colors">
            Importer XLS
          </button>
        </div>
      </div>

      <PlayerForm
        onSubmit={async (data) => {
          const federal = data.federal_no.trim().toUpperCase()
          const { data: existing } = await supabase.from('players').select('id').eq('federal_no', federal).maybeSingle()
          if (existing) { alert('Ce joueur existe déjà'); router.push(`/players/${existing.id}`); return }

          const { groups, ...playerData } = data
          const { data: player, error } = await supabase.from('players')
            .insert([{ ...playerData, federal_no: federal }]).select().single()
          if (error) { alert(error.message || error.details || 'Erreur base de données'); return }

          if (groups && groups.length > 0) {
            const { error: groupError } = await supabase.from('groups_players')
              .insert(groups.map((groupId: string) => ({ group_id: groupId, player_id: player.id })))
            if (groupError) console.error('Group relation error:', groupError)
          }
          router.push('/players')
        }}
      />

      <BulkAddPlayersModal isOpen={isListModalOpen} onClose={() => setIsListModalOpen(false)} />

      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[500px] space-y-4 border border-white/50">
            <div className="flex justify-between items-center">
              <h2 className="text-[15px] font-black text-slate-900">Importer des joueurs</h2>
              <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-600">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <ImportPlayers />
          </div>
        </div>
      )}
    </div>
  )
}

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
  const [showImport, setShowImport] = useState(false)

  return (
    <div className="p-6 max-w-2xl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[18px] font-medium text-gray-900">Ajouter un joueur</h1>
          <p className="text-[13px] text-gray-400 mt-0.5">Créer un nouveau profil joueur</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsListModalOpen(true)}
            className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Ajouter depuis une liste
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Importer un fichier
          </button>
        </div>
      </div>

      {/* ── Formulaire ───────────────────────────────────────────────────────── */}
      <PlayerForm
        onSubmit={async (data) => {
          const federal = data.federal_no.trim().toUpperCase()

          const { data: existing } = await supabase
            .from('players')
            .select('id')
            .eq('federal_no', federal)
            .maybeSingle()

          if (existing) {
            alert('Ce joueur existe déjà')
            router.push(`/players/${existing.id}`)
            return
          }

          const { groups, ...playerData } = data

          const { data: player, error } = await supabase
            .from('players')
            .insert([{ ...playerData, federal_no: federal }])
            .select()
            .single()

          if (error) {
            alert(error.message || error.details || 'Erreur base de données')
            return
          }

          if (groups && groups.length > 0) {
            const relations = groups.map((groupId: string) => ({
              group_id: groupId,
              player_id: player.id,
            }))
            const { error: groupError } = await supabase
              .from('groups_players')
              .insert(relations)
            if (groupError) console.error('Group relation error:', groupError)
          }

          router.push('/players')
        }}
      />

      {/* ── Modal liste ──────────────────────────────────────────────────────── */}
      <BulkAddPlayersModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
      />

      {/* ── Modal import ─────────────────────────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[500px] space-y-4 border border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-[15px] font-medium text-gray-900">Importer des joueurs</h2>
              <button
                onClick={() => setShowImport(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PlayerForm, { PlayerFormData } from '@/components/forms/PlayerForm'

const supabase = createClient()

export default function EditPlayerPage() {
  const router   = useRouter()
  const params   = useParams()
  const playerId = params.id as string

  const [player, setPlayer]         = useState<Partial<PlayerFormData> | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    async function loadPlayer() {
      const { data, error } = await supabase.from('players').select('*').eq('id', playerId).single()
      if (error || !data) { alert('Joueur introuvable'); router.push('/my-events'); return }
      setPlayerName(`${data.first_name} ${data.surname}`)
      setPlayer({
        surname:           data.surname    ?? '',
        first_name:        data.first_name ?? '',
        federal_no:        data.federal_no ?? '',
        whs:               data.whs ? String(data.whs) : '',
        email:             data.email      ?? '',
        phone:             data.phone      ?? '',
        home_club:         data.home_club  ?? '',
        gender:            (data.gender as 'M' | 'F') ?? 'M',
        default_tee_color: (data.default_tee_color as any) ?? 'yellow',
      })
      setLoading(false)
    }
    loadPlayer()
  }, [playerId, router])

  if (loading) return (
    <div className="p-6 space-y-3 max-w-lg">
      {[1,2,3,4].map(i => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-lg">
      <div className="mb-6">
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Modifier le joueur</h1>
        <p className="text-[13px] text-slate-600 mt-0.5">{playerName}</p>
      </div>

      {player && (
        <PlayerForm
          initialData={player}
          playerId={playerId}
          submitLabel="Sauvegarder"
          onSubmit={async (data: any) => {
            const { groups, ...playerData } = data
            const { error } = await supabase.from('players').update(playerData).eq('id', playerId)
            if (error) { alert(error.message); return }

            if (groups) {
              const { data: existingRoles } = await supabase.from('groups_players')
                .select('group_id, role').eq('player_id', playerId)
              const roleMap: Record<string, string> = {}
              existingRoles?.forEach(r => { roleMap[r.group_id] = r.role })

              const { data: currentGroups } = await supabase.from('groups_players')
                .select('group_id').eq('player_id', playerId)
              const currentGroupIds = currentGroups?.map(g => g.group_id) ?? []
              const removedGroups = currentGroupIds.filter(id => !groups.includes(id))

              if (removedGroups.length > 0) {
                await supabase.from('groups_players').delete()
                  .eq('player_id', playerId).in('group_id', removedGroups)
              }
              if (groups.length > 0) {
                await supabase.from('groups_players').upsert(
                  groups.map((groupId: string) => ({
                    group_id: groupId, player_id: playerId, role: roleMap[groupId] ?? 'member',
                  })),
                  { onConflict: 'group_id,player_id' }
                )
              }
            }
            window.history.back()
          }}
        />
      )}
    </div>
  )
}

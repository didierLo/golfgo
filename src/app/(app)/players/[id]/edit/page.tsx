'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PlayerForm, { PlayerFormData } from '@/components/forms/PlayerForm'

const supabase = createClient()

export default function EditPlayerPage() {
  const router       = useRouter()
  const params       = useParams()
  const searchParams = useSearchParams()
  const playerId     = params.id as string
  const groupId      = searchParams.get('groupId') // passé depuis MembersPage

  const [player,     setPlayer]     = useState<Partial<PlayerFormData> | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [currentRole, setCurrentRole] = useState<'member' | 'guest'>('member')
  const [loading,    setLoading]    = useState(true)
  const [savingRole, setSavingRole] = useState(false)

  useEffect(() => {
    async function loadPlayer() {
      const { data, error } = await supabase.from('players').select('*').eq('id', playerId).single()
      if (error || !data) { alert('Joueur introuvable'); router.push('/my-events'); return }
      setPlayerName(`${data.first_name} ${data.surname}`)
      setPlayer({
        surname:           data.surname           ?? '',
        first_name:        data.first_name        ?? '',
        federal_no:        data.federal_no        ?? '',
        whs:               data.whs ? String(data.whs) : '',
        email:             data.email             ?? '',
        phone:             data.phone             ?? '',
        home_club:         data.home_club         ?? '',
        gender:            (data.gender as 'M' | 'F') ?? 'M',
        default_tee_color: (data.default_tee_color as any) ?? 'yellow',
      })

      // Charger le rôle dans ce groupe si groupId fourni
      if (groupId) {
        const { data: gp } = await supabase.from('groups_players')
          .select('role').eq('player_id', playerId).eq('group_id', groupId).maybeSingle()
        if (gp?.role === 'guest') setCurrentRole('guest')
        else setCurrentRole('member')
      }

      setLoading(false)
    }
    loadPlayer()
  }, [playerId, groupId, router])

  async function updateRole(role: 'member' | 'guest') {
    if (!groupId) return
    setSavingRole(true)
    await supabase.from('groups_players')
      .update({ role })
      .eq('player_id', playerId)
      .eq('group_id', groupId)
    setCurrentRole(role)
    setSavingRole(false)
  }

  if (loading) return (
    <div className="p-6 space-y-3 max-w-lg">
      {[1,2,3,4].map(i => <div key={i} className="h-12 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-lg">
      <div className="mb-6">
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Modifier le joueur</h1>
        <p className="text-[13px] text-slate-600 mt-0.5">{playerName}</p>
      </div>

      {/* Rôle dans le groupe — uniquement si on vient d'un groupe */}
      {groupId && (
        <div className="rounded-xl border border-white/60 shadow-sm p-4 mb-5"
          style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Statut dans le groupe</p>
          <div className="flex gap-2">
            {([
              { value: 'member', label: 'Membre',   desc: 'Joueur régulier du groupe' },
              { value: 'guest',  label: 'Visiteur', desc: 'Invité occasionnel' },
            ] as const).map(opt => (
              <button key={opt.value} onClick={() => updateRole(opt.value)} disabled={savingRole}
                className={`flex-1 text-left px-3.5 py-3 rounded-xl border-2 transition-all ${
                  currentRole === opt.value
                    ? opt.value === 'guest'
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-[#185FA5] bg-[#EBF3FC]'
                    : 'border-slate-200 hover:border-slate-300'
                }`}>
                <p className={`text-[13px] font-bold ${
                  currentRole === opt.value
                    ? opt.value === 'guest' ? 'text-amber-700' : 'text-[#185FA5]'
                    : 'text-slate-600'
                }`}>
                  {currentRole === opt.value && '✓ '}{opt.label}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

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
              const removedGroups   = currentGroupIds.filter(id => !groups.includes(id))

              if (removedGroups.length > 0) {
                await supabase.from('groups_players').delete()
                  .eq('player_id', playerId).in('group_id', removedGroups)
              }
              if (groups.length > 0) {
                await supabase.from('groups_players').upsert(
                  groups.map((gid: string) => ({
                    group_id: gid, player_id: playerId, role: roleMap[gid] ?? 'member',
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

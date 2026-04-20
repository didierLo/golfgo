'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Member = {
  id: string; surname: string; first_name: string; whs: number | null; role: string
}

type SortKey = 'first_name' | 'surname'

export default function MembersPage() {
  const router  = useRouter()
  const params  = useParams()
  const groupId = params.id as string

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('surname')

  useEffect(() => { if (!groupId) return; loadMembers() }, [groupId])

  async function loadMembers() {
    const { data, error } = await supabase
      .from('groups_players')
      .select(`role, player:players(id, surname, first_name, whs)`)
      .eq('group_id', groupId)
    if (error) { console.error(error); return }
    setMembers((data || []).map((row: any) => ({ ...row.player, role: row.role })))
    setLoading(false)
  }

  const sortedMembers = [...members].sort((a, b) =>
    a[sortKey].localeCompare(b[sortKey], 'fr', { sensitivity: 'base' })
  )

  async function removeMember(playerId: string) {
    if (!confirm('Retirer ce joueur du groupe ?')) return
    const { error } = await supabase.from('groups_players').delete()
      .eq('group_id', groupId).eq('player_id', playerId)
    if (error) { alert(error.message); return }
    loadMembers()
  }

  if (loading) return (
    <div className="p-6 space-y-2">
      {[1,2,3,4].map(i => <div key={i} className="h-11 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Members</h1>
          <p className="text-[13px] text-slate-600 mt-0.5">{members.length} membre{members.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <a href={`/groups/${groupId}/constraints`}
            className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-white/50 text-slate-600 hover:bg-white/30 transition-colors">
            Constraints
          </a>
          <button onClick={() => router.push(`/groups/${groupId}/members/add`)}
            className="flex items-center gap-1.5 bg-[#185FA5] text-white text-[13px] font-semibold px-4 py-2 rounded-xl hover:bg-[#0C447C] transition-colors">
            + Add member
          </button>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="text-center py-16 text-[13px] text-slate-500 border border-dashed border-slate-200 rounded-xl">
          Aucun membre dans ce groupe
        </div>
      ) : (
        <div className="rounded-xl border border-white/60 shadow-sm overflow-hidden"
          style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>

          {/* Header with sort controls */}
          <div className="grid grid-cols-[1fr_60px_80px_100px] gap-3 px-4 py-3 bg-white/30 border-b border-white/40">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-slate-500">Membre</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setSortKey('first_name')}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
                    sortKey === 'first_name'
                      ? 'bg-[#185FA5] text-white'
                      : 'bg-white/60 text-slate-500 hover:bg-white/80'
                  }`}>
                  Prénom
                </button>
                <button
                  onClick={() => setSortKey('surname')}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
                    sortKey === 'surname'
                      ? 'bg-[#185FA5] text-white'
                      : 'bg-white/60 text-slate-500 hover:bg-white/80'
                  }`}>
                  Nom
                </button>
              </div>
            </div>
            <span className="text-[12px] font-semibold text-slate-500 text-center">WHS</span>
            <span className="text-[12px] font-semibold text-slate-500">Statut</span>
            <span className="text-[12px] font-semibold text-slate-500 text-right">Actions</span>
          </div>

          {sortedMembers.map((member, i) => (
            <div key={member.id}
              className={`grid grid-cols-[1fr_60px_80px_100px] gap-3 px-4 py-3 items-center hover:bg-white/30 transition-colors ${i < sortedMembers.length - 1 ? 'border-b border-white/30' : ''}`}>

              <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push(`/players/${member.id}`)}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                  style={{
                    background: member.role === 'guest' ? '#FEF3C7' : '#EBF3FC',
                    color:      member.role === 'guest' ? '#92400E' : '#0C447C',
                  }}>
                  {member.first_name[0]}{member.surname[0]}
                </div>
                <span className="text-[13px] font-semibold text-slate-900">
                  {sortKey === 'first_name'
                    ? <>{member.first_name} <span className="font-medium text-slate-600">{member.surname}</span></>
                    : <><span className="font-medium text-slate-600">{member.first_name}</span> {member.surname}</>
                  }
                </span>
              </div>

              <div className="text-[13px] font-medium text-slate-600 text-center">{member.whs ?? '—'}</div>

              <div>
                {member.role === 'guest' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                    style={{ background: '#FEF3C7', color: '#92400E' }}>
                    Visiteur
                  </span>
                )}
                {member.role === 'owner' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: '#EBF3FC', color: '#185FA5' }}>
                    Admin
                  </span>
                )}
              </div>

              <div className="flex justify-end gap-1">
                <button onClick={() => router.push(`/players/${member.id}/edit`)}
                  className="text-[11px] font-semibold text-slate-600 border border-white/50 px-2.5 py-1.5 rounded-lg hover:bg-white/30 transition-colors">
                  Edit
                </button>
                <button onClick={() => removeMember(member.id)}
                  className="text-[11px] font-semibold text-red-500 border border-red-200 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

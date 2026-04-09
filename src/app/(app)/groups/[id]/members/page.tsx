'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

// ─── Types ────────────────────────────────────────────────────────────────────

type Member = {
  id: string
  surname: string
  first_name: string
  whs: number | null
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const router = useRouter()
  const params = useParams()
  const groupId = params.id as string

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!groupId) return
    loadMembers()
  }, [groupId])

  async function loadMembers() {
    const { data, error } = await supabase
      .from('groups_players')
      .select(`player:players(id, surname, first_name, whs)`)
      .eq('group_id', groupId)
      .order('surname', { foreignTable: 'players', ascending: true })

    if (error) { console.error(error); return }

   setMembers((data || []).map((row: any) => row.player))
    console.log('members list:', (data || []).map((m: any) => `${m.player?.first_name} ${m.player?.surname}`))
    setLoading(false)
  }

  async function removeMember(playerId: string) {
    if (!confirm('Retirer ce joueur du groupe ?')) return
    const { error } = await supabase
      .from('groups_players')
      .delete()
      .eq('group_id', groupId)
      .eq('player_id', playerId)
    if (error) { alert(error.message); return }
    loadMembers()
  }

  if (loading) {
    return (
      <div className="p-6 space-y-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-11 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
  <div>
    <h1 className="text-[18px] font-medium text-gray-900">Members</h1>
    <p className="text-[13px] text-gray-400 mt-0.5">{members.length} membre{members.length !== 1 ? 's' : ''}</p>
  </div>
  <div className="flex gap-2">
    <a
      href={`/groups/${groupId}/constraints`}
      className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
    >
      Constraints
    </a>
    <button
      onClick={() => router.push(`/groups/${groupId}/members/add`)}
      className="flex items-center gap-1.5 bg-[#185FA5] text-white text-[13px] font-medium px-4 py-2 rounded-md hover:bg-[#0C447C] transition-colors"
    >
      + Add member
    </button>
  </div>
</div>

      {/* ── Liste ────────────────────────────────────────────────────────────── */}
      {members.length === 0 ? (
        <div className="text-center py-16 text-[13px] text-gray-400 border border-dashed border-gray-200 rounded-lg">
          Aucun membre dans ce groupe
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">

          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_100px] gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <span className="text-[12px] font-medium text-gray-400">Membre</span>
            <span className="text-[12px] font-medium text-gray-400 text-center">WHS</span>
            <span className="text-[12px] font-medium text-gray-400 text-right">Actions</span>
          </div>

          {members.map((member, i) => (
            <div
              key={member.id}
              className={`grid grid-cols-[1fr_80px_100px] gap-4 px-4 py-3 items-center hover:bg-gray-50 transition-colors ${
                i < members.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              {/* Nom */}
              <div
                className="flex items-center gap-2.5 cursor-pointer"
                onClick={() => router.push(`/players/${member.id}`)}
              >
                <div className="w-7 h-7 rounded-full bg-[#E6F1FB] flex items-center justify-center text-[11px] font-medium text-[#0C447C] flex-shrink-0">
                  {member.first_name[0]}{member.surname[0]}
                </div>
                <span className="text-[13px] font-medium text-gray-900">
                  {member.first_name} {member.surname}
                </span>
              </div>

              {/* WHS */}
              <div className="text-[13px] text-gray-500 text-center">
                {member.whs ?? '—'}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-1">
                <button
                  onClick={() => router.push(`/players/${member.id}/edit`)}
                  className="text-[11px] text-gray-500 border border-gray-200 px-2.5 py-1 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => removeMember(member.id)}
                  className="text-[11px] text-red-400 border border-red-100 px-2.5 py-1 rounded-md hover:bg-red-50 transition-colors"
                >
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

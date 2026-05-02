'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Group = {
  id: string; name: string; color: string | null
  members_count: number; events_count: number; next_event: string | null
  role: string | null
}

const FALLBACK_COLORS = ['#378ADD', '#EF9F27', '#7F77DD', '#1D9E75', '#D85A30', '#D4537E']

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function GroupsPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => { loadGroups() }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

async function loadGroups() {
  setLoading(true)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { setLoading(false); return }

  const { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('user_id', user.id)
    .single()
  console.log('user.id:', user.id)
  console.log('player:', player)
  if (!player) { setLoading(false); return }

 const { data, error } = await supabase
    .from('groups_players')
    .select(`
      role,
      groups (
        id, name, color,
        members_count:groups_players(count),
        events_count:events!events_group_id_fkey(count),
        next_event:events!events_group_id_fkey(starts_at)
      )
    `)
    .eq('player_id', player.id)
    .order('name', { foreignTable: 'groups' })

  if (error) { console.error(error); setLoading(false); return }
  console.log('data brut:', JSON.stringify(data))
  setGroups((data ?? []).map((row: any) => ({
    ...row.groups,
    role: row.role,
    members_count: row.groups.members_count?.[0]?.count ?? 0,
    events_count: row.groups.events_count?.[0]?.count ?? 0,
    next_event: row.groups.next_event
      ?.filter((e: any) => e.starts_at >= new Date().toISOString())
      ?.sort((a: any, b: any) => a.starts_at.localeCompare(b.starts_at))?.[0]
      ?.starts_at ?? null,
  })))
  setLoading(false)
}

  async function deleteGroup(id: string, role: string | null) {
    if (role !== 'owner') {
      showToast('Tu dois être Admin pour utiliser cette fonction')
      return
    }
    if (!confirm('Supprimer ce groupe ?')) return
    const { error } = await supabase.from('groups').delete().eq('id', id)
    if (error) { alert(error.message); return }
    loadGroups()
  }

  function editGroup(id: string, role: string | null) {
    if (role !== 'owner') {
      showToast('Tu dois être Admin pour utiliser cette fonction')
      return
    }
    router.push(`/groups/${id}/edit`)
  }

  if (loading) return (
    <div className="p-6 space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-20 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )

  if (groups.length === 0) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-[#EBF3FC] flex items-center justify-center mb-5">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="10" cy="9" r="4" stroke="#185FA5" strokeWidth="1.5"/>
          <path d="M2 23c0-4.42 3.58-8 8-8a8 8 0 018 8" stroke="#185FA5" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="20" cy="9" r="3" stroke="#185FA5" strokeWidth="1.5"/>
          <path d="M20 16c1.5.5 3 1.5 4 3" stroke="#185FA5" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <h2 className="text-[18px] font-black text-slate-900 mb-2">Bienvenue sur GolfGo</h2>
      <p className="text-[14px] text-slate-600 max-w-xs mb-6">
        Crée ton premier groupe pour commencer à organiser tes événements.
      </p>
      <button onClick={() => router.push('/groups/add')}
        className="flex items-center gap-2 bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] transition-colors">
        + Créer mon premier groupe
      </button>
    </div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-2xl">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-[13px] font-medium px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#EF9F27" strokeWidth="1.5"/>
            <path d="M8 5v3.5M8 11h.01" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">Mes groupes</h1>
          <p className="text-[13px] text-slate-600 mt-0.5">{groups.length} groupe{groups.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => router.push('/groups/add')}
          className="flex items-center gap-1.5 bg-[#185FA5] text-white text-[13px] font-semibold px-4 py-2 rounded-xl hover:bg-[#0C447C] transition-colors">
          + New group
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {groups.map((group, index) => {
          const color = group.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]
          const isOwner = group.role === 'owner'
          return (
            <div key={group.id} className="rounded-xl border border-white/60 shadow-sm hover:border-slate-300 transition-colors" style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
              <div className="px-4 py-3 flex items-center gap-3 cursor-pointer"
                onClick={() => router.push(`/groups/${group.id}/events`)}>
                <div className="w-[3px] h-10 rounded-full flex-shrink-0" style={{ background: color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-semibold text-slate-900">{group.name}</div>
                  <div className="text-[12px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                    <span>{group.members_count} membres</span>
                    <span>·</span>
                    <span>{group.events_count} events</span>
                    {group.next_event && (
                      <><span>·</span><span>prochain {formatDate(group.next_event)}</span></>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => editGroup(group.id, group.role)}
                    className={`text-[11px] font-semibold border px-2.5 py-1.5 rounded-lg transition-colors ${
                      isOwner
                        ? 'text-slate-600 border-white/50 hover:bg-white/30'
                        : 'text-slate-300 border-slate-100 cursor-not-allowed'
                    }`}>
                    Edit
                  </button>
                  <button
                    onClick={() => deleteGroup(group.id, group.role)}
                    className={`text-[11px] font-semibold border px-2.5 py-1.5 rounded-lg transition-colors ${
                      isOwner
                        ? 'text-red-500 border-red-200 hover:bg-red-50'
                        : 'text-red-200 border-red-100 cursor-not-allowed'
                    }`}>
                    ✕
                  </button>
                </div>
              </div>
              <div className="px-4 pb-3 flex gap-1.5" onClick={e => e.stopPropagation()}>
                {[
                  { label: 'Members',     href: `/groups/${group.id}/members` },
                  { label: 'Constraints', href: `/groups/${group.id}/constraints` },
                ].map(({ label, href }) => (
                  <a key={label} href={href}
                    className="text-[11px] font-semibold text-slate-500 hover:text-[#185FA5] border border-slate-100 hover:border-blue-200 bg-white/30 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition-colors">
                    {label}
                  </a>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
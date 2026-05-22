'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations, useLocale } from 'next-intl'

const supabase = createClient()

type Member = { id: string; surname: string; first_name: string; whs: number | null; role: string }
type SortKey = 'first_name' | 'surname'

export default function MembersPage() {
  const router  = useRouter()
  const params  = useParams()
  const groupId = params.id as string
  const t       = useTranslations()
  const locale  = useLocale()

  const [members,  setMembers]  = useState<Member[]>([])
  const [loading,  setLoading]  = useState(true)
  const [sortKey,  setSortKey]  = useState<SortKey>('surname')
  const [copied,   setCopied]   = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [toast,    setToast]    = useState<string | null>(null)

  useEffect(() => { if (!groupId) return; loadMembers() }, [groupId])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  async function loadMembers() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: player } = await supabase.from('players').select('id').eq('user_id', user!.id).single()
    const { data, error } = await supabase
      .from('groups_players').select(`role, player:players(id, surname, first_name, whs)`).eq('group_id', groupId)
    if (error) { console.error(error); return }
    const myRow = (data || []).find((row: any) => row.player?.id === player?.id)
    setUserRole(myRow?.role ?? null)
    setMembers((data || []).map((row: any) => ({ ...row.player, role: row.role })))
    setLoading(false)
  }

  const sortedMembers = [...members].sort((a, b) =>
    a[sortKey].localeCompare(b[sortKey], locale, { sensitivity: 'base' })
  )

  async function removeMember(playerId: string) {
    if (!confirm(t('members.removeConfirm'))) return
    const now = new Date().toISOString()
    const { data: futureEvents } = await supabase.from('events').select('id').eq('group_id', groupId).gte('starts_at', now)
    const futureEventIds = (futureEvents ?? []).map(e => e.id)
    if (futureEventIds.length > 0) {
      await supabase.from('event_participants').delete().eq('player_id', playerId).in('event_id', futureEventIds)
      const { data: flights } = await supabase.from('flights').select('id').in('event_id', futureEventIds)
      const flightIds = (flights ?? []).map(f => f.id)
      if (flightIds.length > 0) {
        await supabase.from('flight_players').delete().eq('player_id', playerId).in('flight_id', flightIds)
      }
    }
    const { error } = await supabase.from('groups_players').delete().eq('group_id', groupId).eq('player_id', playerId)
    if (error) { alert(error.message); return }
    loadMembers()
  }

  function formatMemberLine(member: Member) {
    const name = sortKey === 'first_name' ? `${member.first_name} ${member.surname}` : `${member.surname} ${member.first_name}`
    const whs  = member.whs != null ? `WHS: ${member.whs}` : 'WHS: —'
    const role = member.role === 'guest' ? t('members.visitor') : member.role === 'owner' ? t('members.admin') : t('nav.member')
    return `${name.padEnd(30)} ${whs.padEnd(12)} ${role}`
  }

  async function copyList() {
    const header = `${t('members.title').toUpperCase()} (${members.length})\n${'─'.repeat(55)}\n`
    const lines  = sortedMembers.map(formatMemberLine).join('\n')
    try {
      await navigator.clipboard.writeText(header + lines)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch {
      const el = document.createElement('textarea')
      el.value = header + lines
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
  }

  function printList() {
    const rows = sortedMembers.map(member => {
      const name = sortKey === 'first_name'
        ? `${member.first_name} <strong>${member.surname}</strong>`
        : `<strong>${member.first_name}</strong> ${member.surname}`
      const whs  = member.whs != null ? member.whs : '—'
      const role = member.role === 'guest'
        ? `<span style="background:#FEF3C7;color:#92400E;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;">${t('members.visitor')}</span>`
        : member.role === 'owner'
        ? `<span style="background:#EBF3FC;color:#185FA5;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;">${t('members.admin')}</span>`
        : ''
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:13px;">${name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:13px;text-align:center;color:#475569;">${whs}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;">${role}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${t('members.title')}</title>
      <style>body{font-family:sans-serif;color:#0F172A;margin:0;padding:32px;}h1{font-size:22px;font-weight:900;margin:0 0 4px;}p{font-size:13px;color:#64748B;margin:0 0 24px;}table{width:100%;border-collapse:collapse;}thead tr{background:#F8FAFC;}thead th{padding:10px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748B;border-bottom:2px solid #E2E8F0;}thead th:nth-child(2){text-align:center;}</style>
      </head><body>
      <h1>${t('members.title')}</h1><p>${members.length} ${t('members.subtitle', { count: '' }).trim()}</p>
      <table><thead><tr><th>${t('members.member')}</th><th>${t('members.whs')}</th><th>${t('members.status')}</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`

    const win = window.open('', '_blank', 'width=800,height=600')
    if (!win) return
    win.document.write(html); win.document.close(); win.focus(); win.print()
  }

  if (loading) return (
    <div className="p-6 space-y-2">
      {[1,2,3,4].map(i => <div key={i} className="h-11 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-[13px] font-medium px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#EF9F27" strokeWidth="1.5"/>
            <path d="M8 5v3.5M8 11h.01" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">{t('members.title')}</h1>
          <p className="text-[13px] text-slate-900 mt-0.5">{t('members.subtitle', { count: members.length })}</p>
        </div>

        <div className="mb-5">
          <button onClick={() => {
              if (userRole !== 'owner') { showToast(t('members.adminOnly')); return }
              router.push(`/groups/${groupId}/members/add`)
            }}
            className={`flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-xl transition-colors ${
              userRole === 'owner' ? 'bg-[#185FA5] text-white hover:bg-[#0C447C]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}>
            + {t('members.addMember')}
          </button>
        </div>
              
        <div className="flex items-center gap-1.5">
          {/* 🖨 Imprimer */}
          <button type="button" onClick={() => window.print()}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-[16px] text-slate-600 hover:bg-slate-50 transition-colors">🖨</button>
          {/* 👁 Aperçu */}
          <button type="button" onClick={printList}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-[16px] text-slate-600 hover:bg-slate-50 transition-colors">👁</button>
          {/* 📤 Email — copie liste */}
          <button type="button" onClick={copyList}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-[16px] text-slate-600 hover:bg-slate-50 transition-colors">📤</button>
          {/* 💬 WhatsApp */}
          <button type="button" onClick={() => {
              const lines = sortedMembers.map(m => `• ${m.first_name} ${m.surname}${m.whs != null ? ` (${m.whs})` : ''}`)
              window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
            }}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-[16px] text-slate-600 hover:bg-slate-50 transition-colors">💬</button>
        </div>

      {members.length === 0 ? (
        <div className="text-center py-16 text-[13px] text-slate-500 border border-dashed border-slate-200 rounded-xl">
          {t('members.noMembers')}
        </div>
      ) : (
        <div className="rounded-xl border border-white/60 shadow-sm overflow-hidden max-w-2xl ml-auto"
          style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>

          <div className="grid grid-cols-[minmax(0,1fr)_60px_80px_100px] gap-3 px-4 py-3 bg-white/30 border-b border-white/40">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-slate-500">{t('members.member')}</span>
              <div className="flex gap-1">
                {(['first_name', 'surname'] as SortKey[]).map(k => (
                  <button key={k} onClick={() => setSortKey(k)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
                      sortKey === k ? 'bg-[#185FA5] text-white' : 'bg-white/60 text-slate-500 hover:bg-white/80'}`}>
                    {k === 'first_name' ? t('members.firstName') : t('members.lastName')}
                  </button>
                ))}
              </div>
            </div>
            <span className="text-[12px] font-semibold text-slate-500 text-center">{t('members.whs')}</span>
  
            <span className="text-[12px] font-semibold text-slate-500 text-right">Edit</span>
          </div>

          {sortedMembers.map((member, i) => (
            <div key={member.id}
              className={`grid grid-cols-[minmax(0,1fr)_60px_80px_100px] gap-3 px-4 py-3 items-center hover:bg-white/30 transition-colors ${i < sortedMembers.length - 1 ? 'border-b border-white/30' : ''}`}>
              <div className="flex items-center gap-2.5 cursor-pointer min-w-0" onClick={() => router.push(`/players/${member.id}/edit?groupId=${groupId}`)}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                  style={{ background: member.role === 'owner' ? '#185FA5' : member.role === 'guest' ? '#FEF3C7' : '#EBF3FC', color:  member.role === 'owner' ? '#ffffff'  : member.role === 'guest' ? '#92400E' : '#0C447C' }}>
                  {member.first_name[0]}{member.surname[0]}
                </div>
                <span className="text-[13px] font-semibold text-slate-900 truncate">
                  {sortKey === 'first_name'
                    ? <>{member.first_name} <span className="font-medium text-slate-600">{member.surname}</span></>
                    : <><span className="font-medium text-slate-600">{member.first_name}</span> {member.surname}</>}
                </span>
              </div>
              <div className="text-[13px] font-medium text-slate-600 text-center">{member.whs ?? '—'}</div>
              <div>
                {member.role === 'guest' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: '#FEF3C7', color: '#92400E' }}>{t('members.visitor')}</span>
                )}
                {member.role === 'owner' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#EBF3FC', color: '#185FA5' }}>{t('members.admin')}</span>
                )}
              </div>
              <div className="flex justify-end gap-1">
                <button onClick={() => {
                    if (userRole !== 'owner') { showToast(t('members.adminOnly')); return }
                    router.push(`/players/${member.id}/edit?groupId=${groupId}`)
                  }}
                  className={`text-[11px] font-semibold border px-2.5 py-1.5 rounded-lg transition-colors ${
                    userRole === 'owner' ? 'text-slate-600 border-white/50 hover:bg-white/30' : 'text-slate-300 border-slate-100 cursor-not-allowed'
                  }`}>
                  Edit
                </button>
                <button onClick={() => {
                    if (userRole !== 'owner') { showToast(t('members.adminOnly')); return }
                    removeMember(member.id)
                  }}
                  className={`text-[11px] font-semibold border px-2.5 py-1.5 rounded-lg transition-colors ${
                    userRole === 'owner' ? 'text-red-500 border-red-200 hover:bg-red-50' : 'text-red-200 border-red-100 cursor-not-allowed'
                  }`}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </div>
  )
}

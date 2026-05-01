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
  const [copied,  setCopied]  = useState(false)

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
    if (!confirm('Retirer ce joueur du groupe ? Ses participations aux événements futurs seront également supprimées.')) return

    // 1. Events futurs du groupe
    const now = new Date().toISOString()
    const { data: futureEvents } = await supabase
      .from('events')
      .select('id')
      .eq('group_id', groupId)
      .gte('starts_at', now)

    const futureEventIds = (futureEvents ?? []).map(e => e.id)

    if (futureEventIds.length > 0) {
      // 2. Supprimer de event_participants
      await supabase.from('event_participants')
        .delete()
        .eq('player_id', playerId)
        .in('event_id', futureEventIds)

      // 3. Trouver les flights de ces events
      const { data: flights } = await supabase
        .from('flights')
        .select('id')
        .in('event_id', futureEventIds)

      const flightIds = (flights ?? []).map(f => f.id)

      // 4. Supprimer de flight_players
      if (flightIds.length > 0) {
        await supabase.from('flight_players')
          .delete()
          .eq('player_id', playerId)
          .in('flight_id', flightIds)
      }
    }

    // 5. Retirer du groupe
    const { error } = await supabase.from('groups_players')
      .delete()
      .eq('group_id', groupId)
      .eq('player_id', playerId)

    if (error) { alert(error.message); return }
    loadMembers()
  }

  function formatMemberLine(member: Member) {
    const name = sortKey === 'first_name'
      ? `${member.first_name} ${member.surname}`
      : `${member.surname} ${member.first_name}`
    const whs  = member.whs != null ? `WHS: ${member.whs}` : 'WHS: —'
    const role = member.role === 'guest' ? 'Visiteur' : member.role === 'owner' ? 'Admin' : 'Membre'
    return `${name.padEnd(30)} ${whs.padEnd(12)} ${role}`
  }

  async function copyList() {
    const header = `LISTE DES MEMBRES (${members.length})\n${'─'.repeat(55)}\n`
    const lines  = sortedMembers.map(formatMemberLine).join('\n')
    const text   = header + lines
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function printList() {
    const rows = sortedMembers.map(member => {
      const name = sortKey === 'first_name'
        ? `${member.first_name} <strong>${member.surname}</strong>`
        : `<strong>${member.first_name}</strong> ${member.surname}`
      const whs  = member.whs != null ? member.whs : '—'
      const role = member.role === 'guest'
        ? '<span style="background:#FEF3C7;color:#92400E;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;">Visiteur</span>'
        : member.role === 'owner'
        ? '<span style="background:#EBF3FC;color:#185FA5;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;">Admin</span>'
        : ''
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:13px;">${name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;font-size:13px;text-align:center;color:#475569;">${whs}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #F1F5F9;">${role}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Liste des membres</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; color: #0F172A; margin: 0; padding: 32px; }
        h1 { font-size: 22px; font-weight: 900; margin: 0 0 4px; }
        p  { font-size: 13px; color: #64748B; margin: 0 0 24px; }
        table { width: 100%; border-collapse: collapse; }
        thead tr { background: #F8FAFC; }
        thead th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 700;
                   text-transform: uppercase; letter-spacing: 0.05em; color: #64748B;
                   border-bottom: 2px solid #E2E8F0; }
        thead th:nth-child(2) { text-align: center; }
        @media print { body { padding: 16px; } }
      </style></head><body>
      <h1>Liste des membres</h1>
      <p>${members.length} membre${members.length !== 1 ? 's' : ''}</p>
      <table><thead><tr><th>Membre</th><th>WHS</th><th>Statut</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`

    const win = window.open('', '_blank', 'width=800,height=600')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    win.print()
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
        <div className="flex gap-2 flex-wrap justify-end">
          <a href={`/groups/${groupId}/constraints`}
            className="text-[12px] font-semibold px-3 py-2 rounded-xl border border-white/50 text-slate-600 hover:bg-white/30 transition-colors">
            Constraints
          </a>
          <button onClick={copyList} disabled={members.length === 0}
            className={`flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-xl border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              copied ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'border-white/50 text-slate-600 hover:bg-white/30'}`}>
            {copied ? (
              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Copié !</>
            ) : (
              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copier</>
            )}
          </button>
          <button onClick={printList} disabled={members.length === 0}
            className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-xl border border-white/50 text-slate-600 hover:bg-white/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Imprimer
          </button>
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
          style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>

          <div className="grid grid-cols-[1fr_60px_80px_100px] gap-3 px-4 py-3 bg-white/30 border-b border-white/40">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-slate-500">Membre</span>
              <div className="flex gap-1">
                {(['first_name', 'surname'] as SortKey[]).map(k => (
                  <button key={k} onClick={() => setSortKey(k)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-colors ${
                      sortKey === k ? 'bg-[#185FA5] text-white' : 'bg-white/60 text-slate-500 hover:bg-white/80'}`}>
                    {k === 'first_name' ? 'Prénom' : 'Nom'}
                  </button>
                ))}
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
                  style={{ background: member.role === 'guest' ? '#FEF3C7' : '#EBF3FC', color: member.role === 'guest' ? '#92400E' : '#0C447C' }}>
                  {member.first_name[0]}{member.surname[0]}
                </div>
                <span className="text-[13px] font-semibold text-slate-900">
                  {sortKey === 'first_name'
                    ? <>{member.first_name} <span className="font-medium text-slate-600">{member.surname}</span></>
                    : <><span className="font-medium text-slate-600">{member.first_name}</span> {member.surname}</>}
                </span>
              </div>

              <div className="text-[13px] font-medium text-slate-600 text-center">{member.whs ?? '—'}</div>

              <div>
                {member.role === 'guest' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: '#FEF3C7', color: '#92400E' }}>Visiteur</span>
                )}
                {member.role === 'owner' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#EBF3FC', color: '#185FA5' }}>Admin</span>
                )}
              </div>

              <div className="flex justify-end gap-1">
                <button onClick={() => router.push(`/players/${member.id}/edit?groupId=${groupId}`)}
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

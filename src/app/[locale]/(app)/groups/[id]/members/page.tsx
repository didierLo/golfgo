'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations, useLocale } from 'next-intl'


const supabase = createClient()


type Member  = { id: string; surname: string; first_name: string; whs: number | null; role: string }
type SortKey = 'first_name' | 'surname'
type InviteLink = { id: string; token: string; expires_at: string } | null
type JoinRequest = { id: string; status: string; created_at: string; player: { id: string; first_name: string; surname: string; email: string | null } }



// ─── QR Code (via api.qrserver.com — pas de lib) ──────────────────────────
function QRCode({ url }: { url: string }) {
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}`
  return <img src={src} alt="QR Code" width={160} height={160} className="rounded-xl border border-slate-100" />
}

// ─── Modal lien d'invitation ──────────────────────────────────────────────
function InviteModal({
  groupId,
  onClose,
}: {
  groupId: string
  onClose: () => void
}) {
  const [link,      setLink]      = useState<InviteLink>(null)
  const [loading,   setLoading]   = useState(true)
  const [copying,   setCopying]   = useState(false)
  const [regen,     setRegen]     = useState(false)
  
  const t = useTranslations() 

  const inviteUrl = link ? `${window.location.origin}/join/${link.token}` : ''

  useEffect(() => { loadLink() }, [])

  async function loadLink() {
    setLoading(true)
    const { data } = await supabase
      .from('group_invite_links')
      .select('id, token, expires_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setLink(data)
    setLoading(false)
  }

  async function generateLink() {
    setRegen(true)
    // Supprimer l'ancien lien s'il existe
    if (link) {
      await supabase.from('group_invite_links').delete().eq('id', link.id)
    }
    const { data } = await supabase
      .from('group_invite_links')
      .insert({ group_id: groupId })
      .select('id, token, expires_at')
      .single()
    setLink(data)
    setRegen(false)
  }

  async function copyLink() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopying(true)
    setTimeout(() => setCopying(false), 2000)
  }

  const expiresLabel = link
    ? new Date(link.expires_at).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  const isExpired = link ? new Date(link.expires_at) < new Date() : false

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">
        <button onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-[18px] leading-none">✕</button>

        <h2 className="text-[16px] font-bold text-slate-900 mb-1">{t('members.inviteTitle')}</h2>
        <p className="text-[12px] text-slate-500 mb-5">{t('members.inviteDesc')}</p>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-[#185FA5] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : link && !isExpired ? (
          <>
            {/* QR Code */}
            <div className="flex justify-center mb-4">
              <QRCode url={inviteUrl} />
            </div>

            {/* Lien */}
            <div className="bg-slate-50 rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2">
              <span className="text-[11px] text-slate-600 truncate flex-1">{inviteUrl}</span>
              <button onClick={copyLink}
                className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#185FA5] text-white hover:bg-[#0C447C] transition-colors">
               {copying ? t('members.inviteCopied') : t('members.inviteCopy')}
              </button>
            </div>

            <p className="text-[11px] text-slate-400 text-center mb-4">
              {isExpired ? t('members.inviteExpired') : t('members.inviteExpires', { date: expiresLabel })}
            </p>

            <button onClick={generateLink} disabled={regen}
              className="w-full text-[12px] font-semibold py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-40">
              {regen ? t('members.inviteRegenLoading') : t('members.inviteRegen')}
            </button>
          </>
        ) : (
          <>
            <div className="text-center py-6 text-slate-400 text-[13px] mb-4">
              {isExpired ? t('members.inviteExpired') : t('members.inviteNoLink')}
            </div>
            <button onClick={generateLink} disabled={regen}
              className="w-full bg-[#185FA5] text-white text-[13px] font-semibold py-2.5 rounded-xl hover:bg-[#0C447C] transition-colors disabled:opacity-40">
              {regen ? t('members.inviteRegenLoading') : t('members.inviteGenerate')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────
export default function MembersPage() {
  const router  = useRouter()
  const params  = useParams()
  const groupId = params.id as string
  const t       = useTranslations()
  const locale  = useLocale()
  

  const [members,      setMembers]      = useState<Member[]>([])
  const [loading,      setLoading]      = useState(true)
  const [sortKey,      setSortKey]      = useState<SortKey>('surname')
  const [userRole,     setUserRole]     = useState<string | null>(null)
  const [toast,        setToast]        = useState<string | null>(null)
  const [showInvite,   setShowInvite]   = useState(false)
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])
  const [approvingId,  setApprovingId]  = useState<string | null>(null)

  useEffect(() => { if (!groupId) return; loadMembers() }, [groupId])
  useEffect(() => { if (userRole === 'owner') loadJoinRequests() }, [userRole])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  async function loadMembers() {
    const [{ data: { user } }, { data, error }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('groups_players')
        .select(`role, player:players(id, surname, first_name, whs)`)
        .eq('group_id', groupId)
    ])

    if (error) { console.error(error); return }

    const { data: player } = await supabase.from('players')
      .select('id').eq('user_id', user!.id).single()

    const myRow = (data || []).find((row: any) => row.player?.id === player?.id)
    setUserRole(myRow?.role ?? null)
    setMembers((data || []).map((row: any) => ({ ...row.player, role: row.role })))
    setLoading(false)
  }

  async function loadJoinRequests() {
    const { data } = await supabase
      .from('group_join_requests')
      .select(`id, status, created_at, player:players(id, first_name, surname, email)`)
      .eq('group_id', groupId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    setJoinRequests((data || []) as any)
  }

  async function approveRequest(requestId: string, playerId: string) {
    setApprovingId(requestId)
    // Ajouter dans groups_players
    await supabase.from('groups_players').insert({
      group_id: groupId,
      player_id: playerId,
      role: 'member',
    })
    // Mettre à jour le statut
    await supabase.from('group_join_requests')
      .update({ status: 'approved' })
      .eq('id', requestId)
    setApprovingId(null)
    loadMembers()
    loadJoinRequests()
    showToast('Membre ajouté au groupe')
  }

  async function rejectRequest(requestId: string) {
    setApprovingId(requestId)
    await supabase.from('group_join_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId)
    setApprovingId(null)
    loadJoinRequests()
    showToast('Demande refusée')
  }

  const sortedMembers = useMemo(() =>
    [...members].sort((a, b) =>
      a[sortKey].localeCompare(b[sortKey], locale, { sensitivity: 'base' })
    )
  , [members, sortKey, locale])

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

  function buildWhatsApp() {
    const lines = sortedMembers.map(m => `• ${m.first_name} ${m.surname}${m.whs != null ? ` (${m.whs})` : ''}`)
    return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`
  }

  if (loading) return (
    <div className="p-6 space-y-2">
      {[1,2,3,4].map(i => <div key={i} className="h-11 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6">

      {/* Modal invite */}
      {showInvite && (
        <InviteModal groupId={groupId} onClose={() => setShowInvite(false)} />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-[13px] font-medium px-5 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#EF9F27" strokeWidth="1.5"/>
            <path d="M8 5v3.5M8 11h.01" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {toast}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-[22px] font-black text-slate-900 tracking-tight">{t('members.title')}</h1>
          <p className="text-[13px] text-slate-900 mt-0.5">{t('members.subtitle', { count: members.length })}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={printList}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-[16px] text-slate-600 hover:bg-slate-50 transition-colors">🖨</button>
          <button type="button" onClick={printList}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-[16px] text-slate-600 hover:bg-slate-50 transition-colors">👁</button>
          <button type="button"
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-[16px] text-slate-600 hover:bg-slate-50 transition-colors">📤</button>
          <button type="button" onClick={() => window.open(buildWhatsApp(), '_blank')}
            className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-[16px] text-slate-600 hover:bg-slate-50 transition-colors">💬</button>
        </div>
      </div>

      {/* ── Boutons actions ── */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button onClick={() => {
            if (userRole !== 'owner') { showToast(t('members.adminOnly')); return }
            router.push(`/groups/${groupId}/members/add`)
          }}
          className={`flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-xl transition-colors ${
            userRole === 'owner' ? 'bg-[#185FA5] text-white hover:bg-[#0C447C]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}>
          + {t('members.addMember')}
        </button>

        {userRole === 'owner' && (
          <button onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-xl border border-[#185FA5] text-[#185FA5] hover:bg-[#EBF3FC] transition-colors">
            🔗 Lien d'invitation
          </button>
        )}
      </div>

      {/* ── Demandes en attente ── */}
      {userRole === 'owner' && joinRequests.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-200 overflow-hidden"
          style={{ background: 'rgba(254,243,199,0.6)', backdropFilter: 'blur(8px)' }}>
          <div className="px-4 py-3 border-b border-amber-200">
            <span className="text-[12px] font-bold text-amber-800 uppercase tracking-widest">
              {joinRequests.length} demande{joinRequests.length > 1 ? 's' : ''} en attente
            </span>
          </div>
          {joinRequests.map((req, i) => (
            <div key={req.id}
              className={`flex items-center justify-between gap-3 px-4 py-3 ${i < joinRequests.length - 1 ? 'border-b border-amber-100' : ''}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 bg-amber-100 text-amber-800">
                  {req.player.first_name[0]}{req.player.surname[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900 truncate">
                    {req.player.first_name} {req.player.surname}
                  </p>
                  {req.player.email && (
                    <p className="text-[11px] text-slate-500 truncate">{req.player.email}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => approveRequest(req.id, req.player.id)}
                  disabled={approvingId === req.id}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-[#3B6D11] text-white hover:bg-[#27500A] transition-colors disabled:opacity-40">
                  ✓ Accepter
                </button>
                <button
                  onClick={() => rejectRequest(req.id)}
                  disabled={approvingId === req.id}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Liste membres ── */}
      {members.length === 0 ? (
        <div className="text-center py-16 text-[13px] text-slate-500 border border-dashed border-slate-200 rounded-xl">
          {t('members.noMembers')}
        </div>
      ) : (
        <div className="rounded-xl border border-white/60 shadow-sm overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>

          <div className="grid grid-cols-[minmax(0,1fr)_60px_90px] gap-3 px-4 py-3 bg-white/30 border-b border-white/40">
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
              className={`grid grid-cols-[minmax(0,1fr)_60px_90px] gap-3 px-4 py-3 items-center hover:bg-white/30 transition-colors ${
                i < sortedMembers.length - 1 ? 'border-b border-white/30' : ''}`}>

              <div className="flex items-center gap-2.5 cursor-pointer min-w-0"
                onClick={() => router.push(`/players/${member.id}/edit?groupId=${groupId}`)}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                  style={{
                    background: member.role === 'owner' ? '#185FA5' : member.role === 'guest' ? '#FEF3C7' : '#EBF3FC',
                    color:      member.role === 'owner' ? '#ffffff'  : member.role === 'guest' ? '#92400E' : '#0C447C',
                  }}>
                  {member.first_name[0]}{member.surname[0]}
                </div>
                <span className="text-[13px] font-semibold text-slate-900 truncate">
                  {sortKey === 'first_name'
                    ? <>{member.first_name} <span className="font-medium text-slate-600">{member.surname}</span></>
                    : <><span className="font-medium text-slate-600">{member.first_name}</span> {member.surname}</>}
                </span>
              </div>

              <div className="text-[13px] font-medium text-slate-600 text-center">{member.whs ?? '—'}</div>

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
  )
}

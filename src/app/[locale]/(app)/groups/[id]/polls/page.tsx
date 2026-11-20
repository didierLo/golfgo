'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

const supabase = createClient()

type PollRow = { id: string; title: string; status: 'open' | 'closed' | 'converted'; deadline: string | null; event_id: string | null; created_at: string }

const STATUS_STYLE: Record<string, string> = {
  open:      'bg-[#EBF3FC] text-[#0C447C]',
  closed:    'bg-slate-100 text-slate-600',
  converted: 'bg-[#EAF3DE] text-[#3B6D11]',
}

export default function PollsPage() {
  const params  = useParams()
  const groupId = params.id as string
  const t       = useTranslations()

  const [polls,    setPolls]    = useState<PollRow[]>([])
  const [answered, setAnswered] = useState<Record<string, number>>({})
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [isOwner,  setIsOwner]  = useState(false)

  useEffect(() => { if (groupId) load() }, [groupId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: player } = await supabase.from('players').select('id').eq('user_id', user.id).single()
      if (player) {
        const { data: gp } = await supabase.from('groups_players').select('role').eq('group_id', groupId).eq('player_id', player.id).single()
        setIsOwner(gp?.role === 'owner')
      }
    }
    const [{ data: rows }, { data: votes }, { count }] = await Promise.all([
      supabase.from('polls').select('id, title, status, deadline, event_id, created_at').eq('group_id', groupId).order('created_at', { ascending: false }),
      supabase.from('poll_votes').select('poll_id, player_id'),
      supabase.from('groups_players').select('*', { count: 'exact', head: true }).eq('group_id', groupId).neq('role', 'guest'),
    ])
    setPolls((rows ?? []) as PollRow[])
    const byPoll: Record<string, Set<string>> = {}
    for (const v of votes ?? []) (byPoll[v.poll_id] ??= new Set()).add(v.player_id)
    setAnswered(Object.fromEntries(Object.entries(byPoll).map(([k, s]) => [k, s.size])))
    setTotal(count ?? 0)
    setLoading(false)
  }

  async function removePoll(id: string) {
    if (!confirm(t('polls.deleteConfirm'))) return
    const { error } = await supabase.from('polls').delete().eq('id', id)
    if (error) { alert(error.message); return }
    load()
  }

  if (loading) return <div className="p-6 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/40 rounded-xl animate-pulse" />)}</div>

  if (!isOwner) return (
    <div className="p-6 max-w-lg"><p className="text-[14px] text-slate-700">{t('polls.adminOnly')}</p></div>
  )

  return (
    <div className="p-5 sm:p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">{t('polls.title')}</h1>
        <a href={`/groups/${groupId}/polls/new`}
          className="text-[13px] font-semibold px-4 py-2 rounded-xl bg-[#185FA5] text-white hover:bg-[#0C447C] transition-colors">
          {t('polls.newPoll')}
        </a>
      </div>

      {polls.length === 0 ? (
        <div className="text-center py-16 text-slate-500 on-bg-card">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-[15px] font-semibold">{t('polls.empty')}</p>
          <p className="text-[13px] mt-1">{t('polls.emptyHint')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {polls.map(p => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl border border-white/50 hover:border-slate-300 transition-colors bg-white px-4 py-3">
              <a href={`/groups/${groupId}/polls/${p.id}`} className="flex-1 min-w-0 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-slate-900 truncate">{p.title}</p>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    {t('polls.answersCount', { answered: answered[p.id] ?? 0, total })}
                  </p>
                </div>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${STATUS_STYLE[p.status]}`}>
                  {t(`polls.status_${p.status}`)}
                </span>
              </a>
              <div className="flex items-center gap-1 shrink-0">
                {p.status !== 'converted' && (
                  <a href={`/groups/${groupId}/polls/${p.id}/edit`}
                    className="text-[11px] font-semibold border px-2.5 py-1.5 rounded-lg text-slate-600 border-slate-200 hover:bg-slate-50 transition-colors">
                    {t('polls.edit')}
                  </a>
                )}
                <button onClick={() => removePoll(p.id)} aria-label={t('polls.delete')}
                  className="text-[11px] font-semibold border px-2.5 py-1.5 rounded-lg text-red-500 border-red-200 hover:bg-red-50 transition-colors">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

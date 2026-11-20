'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations, useLocale } from 'next-intl'
import ClubLinks from '@/components/polls/ClubLinks'

const supabase = createClient()

type Answer = 'yes' | 'maybe' | 'no'
type Poll    = { id: string; title: string; description: string | null; location: string | null; deadline: string | null; status: 'open' | 'closed' | 'converted'; event_id: string | null; clubs: { name: string; website: string | null; region: string | null; country: string | null; courses: { course_name: string | null }[] | null } | null }
type Option  = { id: string; starts_at: string }
type Member  = { player_id: string; first_name: string; surname: string }
type Vote    = { option_id: string; player_id: string; answer: Answer }

const ICON: Record<Answer, string> = { yes: '✅', maybe: '❓', no: '❌' }

export default function PollDetailPage() {
  const params  = useParams()
  const groupId = params.id as string
  const pollId  = params.pollId as string
  const t       = useTranslations()
  const locale  = useLocale()

  const [poll,    setPoll]    = useState<Poll | null>(null)
  const [options, setOptions] = useState<Option[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [votes,   setVotes]   = useState<Vote[]>([])
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)
  const [busy,    setBusy]    = useState(false)
  const [notice,  setNotice]  = useState<string | null>(null)

  useEffect(() => { load() }, [pollId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    const [{ data: p }, { data: o }, { data: m }, { data: v }] = await Promise.all([
      supabase.from('polls').select('id, title, description, location, deadline, status, event_id, clubs(name, website, region, country, courses(course_name))').eq('id', pollId).maybeSingle(),
      supabase.from('poll_options').select('id, starts_at').eq('poll_id', pollId).order('starts_at'),
      supabase.from('groups_players').select('player_id, players(first_name, surname)').eq('group_id', groupId).neq('role', 'guest'),
      supabase.from('poll_votes').select('option_id, player_id, answer').eq('poll_id', pollId),
    ])
    setPoll(p ? ({ ...p, clubs: Array.isArray((p as any).clubs) ? (p as any).clubs[0] ?? null : (p as any).clubs ?? null } as Poll) : null)
    setOptions((o ?? []) as Option[])
    setMembers((m ?? []).map((r: any) => {
      const pl = Array.isArray(r.players) ? r.players[0] : r.players
      return { player_id: r.player_id, first_name: pl?.first_name ?? '', surname: pl?.surname ?? '' }
    }).sort((a: Member, b: Member) => `${a.surname} ${a.first_name}`.localeCompare(`${b.surname} ${b.first_name}`)))
    setVotes((v ?? []) as Vote[])
    setLoading(false)
  }

  const voteOf = useMemo(() => {
    const map = new Map<string, Answer>()
    for (const v of votes) map.set(`${v.option_id}|${v.player_id}`, v.answer)
    return map
  }, [votes])

  const totals = useMemo(() => {
    const res: Record<string, { yes: number; maybe: number; no: number }> = {}
    for (const o of options) res[o.id] = { yes: 0, maybe: 0, no: 0 }
    for (const v of votes) if (res[v.option_id]) res[v.option_id][v.answer]++
    return res
  }, [options, votes])

  const bestId = useMemo(() => {
    const sorted = [...options].sort((a, b) => totals[b.id].yes - totals[a.id].yes || totals[b.id].maybe - totals[a.id].maybe)
    return sorted[0] && totals[sorted[0].id].yes > 0 ? sorted[0].id : null
  }, [options, totals])

  const answeredIds = useMemo(() => new Set(votes.map(v => v.player_id)), [votes])
  const pending = members.filter(m => !answeredIds.has(m.player_id)).length

  const dayLabel  = (s: string) => new Date(s).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
  const timeLabel = (s: string) => new Date(s).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })

  async function remind() {
    if (busy || pending === 0) return
    setBusy(true); setNotice(null)
    const res = await fetch('/api/polls/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, pollId, mode: 'remind' }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    setNotice(json.success ? t('polls.reminderSent', { count: (json.sent ?? 0) + (json.queued ?? 0) }) : t('polls.errGeneric'))
  }

  async function setStatus(status: 'open' | 'closed') {
    setBusy(true)
    await supabase.from('polls').update({ status }).eq('id', pollId)
    setBusy(false)
    load()
  }

  async function convert(o: Option) {
    const c = totals[o.id]
    const label = `${dayLabel(o.starts_at)} ${timeLabel(o.starts_at)}`
    if (!confirm(t('polls.convertConfirm', { date: label, yes: c.yes, maybe: c.maybe }))) return
    setBusy(true)
    const { data, error } = await supabase.rpc('poll_convert', { p_poll_id: pollId, p_option_id: o.id })
    setBusy(false)
    if (error || !data) { setNotice(error?.message ?? t('polls.errGeneric')); return }
    // On ouvre la page de modification pour compléter l'événement (parcours, formule de jeu, nombre de places…)
    window.location.href = `/groups/${groupId}/events/${data}/edit`
  }

  async function remove() {
    if (!confirm(t('polls.deleteConfirm'))) return
    setBusy(true)
    const { error } = await supabase.from('polls').delete().eq('id', pollId)
    if (error) { setBusy(false); setNotice(error.message); return }
    window.location.href = `/groups/${groupId}/polls`
  }

  if (loading) return <div className="p-6 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-white/40 rounded-xl animate-pulse" />)}</div>
  if (!poll || !isOwner) return <div className="p-6 max-w-lg"><p className="text-[14px] text-slate-700">{t('polls.adminOnly')}</p></div>

  return (
    <div className="p-5 sm:p-6 max-w-3xl">
      <div className="mb-4">
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">{poll.title}</h1>
        <p className="text-[13px] text-slate-700 mt-0.5">
          {poll.location && <>📍 {poll.location} · </>}
          {t('polls.answersCount', { answered: answeredIds.size, total: members.length })}
          {poll.deadline && ` · ${t('polls.deadline', { date: new Date(poll.deadline + 'T00:00:00Z').toLocaleDateString(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }) })}`}
        </p>
      </div>

      {poll.description && <p className="text-[13px] text-slate-800 mb-3 whitespace-pre-line">{poll.description}</p>}
      <ClubLinks name={poll.clubs?.name ?? poll.location} courseName={poll.clubs?.courses?.[0]?.course_name ?? null} region={poll.clubs?.region ?? null} country={poll.clubs?.country ?? null} website={poll.clubs?.website ?? null} />

      {poll.status === 'converted' && poll.event_id && (
        <div className="bg-[#EAF3DE] text-[#3B6D11] rounded-xl px-4 py-3 text-[13px] font-semibold mb-4 flex items-center justify-between gap-3">
          <span>{t('polls.convertedBanner')}</span>
          <a href={`/groups/${groupId}/events/${poll.event_id}/edit`} className="underline underline-offset-2 shrink-0">{t('polls.viewEvent')}</a>
        </div>
      )}
      {poll.status === 'closed' && (
        <div className="bg-slate-100 text-slate-600 rounded-xl px-4 py-3 text-[13px] font-semibold mb-4">{t('polls.closedMsg')}</div>
      )}
      {notice && <div className="bg-white border border-slate-200 text-slate-700 rounded-xl px-4 py-3 text-[13px] mb-4">{notice}</div>}

      {/* Tableau joueurs × dates (défile horizontalement sur téléphone) */}
      <div className="bg-white rounded-xl border border-white/50 overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="sticky left-0 bg-white text-left px-3 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[140px]">&nbsp;</th>
              {options.map(o => (
                <th key={o.id} className={`px-3 py-2.5 text-center min-w-[92px] ${bestId === o.id ? 'bg-[#EAF3DE]' : ''}`}>
                  <div className="text-[12px] font-bold text-slate-900 capitalize">{dayLabel(o.starts_at)}</div>
                  <div className="text-[12px] font-semibold text-[#185FA5]">{timeLabel(o.starts_at)}</div>
                  {bestId === o.id && <div className="text-[10px] font-semibold text-[#3B6D11]">★ {t('polls.bestDate')}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.player_id} className="border-b border-slate-50">
                <td className="sticky left-0 bg-white px-3 py-2 text-slate-800 whitespace-nowrap">
                  {m.first_name} {m.surname}
                  {!answeredIds.has(m.player_id) && <span className="ml-1.5 text-[10px] text-slate-400">·&nbsp;{t('polls.noAnswerYet')}</span>}
                </td>
                {options.map(o => {
                  const a = voteOf.get(`${o.id}|${m.player_id}`)
                  return <td key={o.id} className={`px-3 py-2 text-center text-[16px] ${bestId === o.id ? 'bg-[#F6FAF0]' : ''}`}>{a ? ICON[a] : <span className="text-slate-300">–</span>}</td>
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200">
              <td className="sticky left-0 bg-white px-3 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('polls.totals')}</td>
              {options.map(o => (
                <td key={o.id} className={`px-3 py-2.5 text-center text-[12px] font-semibold text-slate-700 ${bestId === o.id ? 'bg-[#EAF3DE]' : ''}`}>
                  ✅ {totals[o.id].yes} · ❓ {totals[o.id].maybe}
                </td>
              ))}
            </tr>
            {poll.status !== 'converted' && (
              <tr>
                <td className="sticky left-0 bg-white" />
                {options.map(o => (
                  <td key={o.id} className="px-2 py-2.5 text-center">
                    <button onClick={() => convert(o)} disabled={busy}
                      className="text-[11px] font-semibold px-2.5 py-2 rounded-lg bg-[#185FA5] text-white hover:bg-[#0C447C] disabled:opacity-50 transition-colors leading-tight">
                      {t('polls.chooseDate')}
                    </button>
                  </td>
                ))}
              </tr>
            )}
          </tfoot>
        </table>
      </div>
      <p className="text-[11px] text-slate-500 mt-2">{t('polls.convertHint')}</p>

      <div className="flex flex-wrap gap-2 mt-5">
        {poll.status === 'open' && (
          <button onClick={remind} disabled={busy || pending === 0}
            className="text-[13px] font-semibold px-4 py-2.5 rounded-xl bg-[#185FA5] text-white hover:bg-[#0C447C] disabled:opacity-40 transition-colors">
            {busy ? t('polls.reminding') : t('polls.remind', { count: pending })}
          </button>
        )}
        {poll.status === 'open' && (
          <button onClick={() => setStatus('closed')} disabled={busy}
            className="text-[13px] font-semibold px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">{t('polls.close')}</button>
        )}
        {poll.status === 'closed' && (
          <button onClick={() => setStatus('open')} disabled={busy}
            className="text-[13px] font-semibold px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">{t('polls.reopen')}</button>
        )}
        {poll.status !== 'converted' && (
          <a href={`/groups/${groupId}/polls/${pollId}/edit`}
            className="text-[13px] font-semibold px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 transition-colors">{t('polls.edit')}</a>
        )}
        <button onClick={remove} disabled={busy}
          className="text-[13px] font-semibold px-4 py-2.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors">{t('polls.delete')}</button>
      </div>
    </div>
  )
}

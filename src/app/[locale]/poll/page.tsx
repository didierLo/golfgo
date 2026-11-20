'use client'

// Page de vote d'un sondage de dates. Accessible SANS connexion grâce au jeton personnel du lien
// (même principe que /invite/yes). Lecture et écriture passent par des fonctions SECURITY DEFINER
// (poll_get / poll_vote) : aucune table n'est ouverte en lecture publique.
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import ClubLinks from '@/components/polls/ClubLinks'

type Answer = 'yes' | 'maybe' | 'no'
type Option = { id: string; starts_at: string; yes: number; maybe: number; no: number; mine: Answer | null }
type PollData = {
  poll_id: string; title: string; description: string | null; location: string | null
  status: 'open' | 'closed' | 'converted'; deadline: string | null; event_id: string | null; group_id: string
  group_name: string; player_name: string; can_vote: boolean
  club: { name: string; website: string | null; region: string | null; country: string | null } | null
  voters_total: number; voters_answered: number; options: Option[]
}

const CHOICES: { key: Answer; icon: string; on: string; off: string }[] = [
  { key: 'yes',   icon: '✅', on: 'border-[#3B6D11] bg-[#EAF3DE] text-[#3B6D11]', off: 'border-slate-200 bg-white text-slate-500' },
  { key: 'maybe', icon: '❓', on: 'border-amber-500 bg-amber-50 text-amber-700',  off: 'border-slate-200 bg-white text-slate-500' },
  { key: 'no',    icon: '❌', on: 'border-red-400 bg-red-50 text-red-700',        off: 'border-slate-200 bg-white text-slate-500' },
]

function PollContent() {
  const supabase = createClient()
  const params   = useSearchParams()
  const token    = params.get('token')
  const t        = useTranslations()
  const locale   = useLocale()

  const [poll,    setPoll]    = useState<PollData | null>(null)
  const [answers, setAnswers] = useState<Record<string, Answer | null>>({})
  const [state,   setState]   = useState<'loading' | 'ready' | 'invalid'>('loading')
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState(false)

  async function load() {
    if (!token) { setState('invalid'); return }
    const { data, error } = await supabase.rpc('poll_get', { p_token: token })
    if (error || !data) { setState('invalid'); return }
    const d = data as PollData
    setPoll(d)
    setAnswers(Object.fromEntries(d.options.map(o => [o.id, o.mine])))
    setState('ready')
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function pick(optionId: string, a: Answer) {
    setSaved(false)
    setAnswers(prev => ({ ...prev, [optionId]: prev[optionId] === a ? null : a }))
  }

  async function submit() {
    if (!token || !poll) return
    setSaving(true); setError(false)
    const payload = poll.options.map(o => ({ option_id: o.id, answer: answers[o.id] ?? null }))
    const { error } = await supabase.rpc('poll_vote', { p_token: token, p_answers: payload })
    setSaving(false)
    if (error) { setError(true); return }
    setSaved(true)
    await load()
  }

  const dayLabel  = (s: string) => new Date(s).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  const timeLabel = (s: string) => new Date(s).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })

  const best = poll
    ? [...poll.options].sort((a, b) => b.yes - a.yes || b.maybe - a.maybe)[0]
    : null

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center px-4 py-8">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-center mb-5">
          <span className="text-[22px] font-black text-[#185FA5] tracking-tight">Golf</span>
          <span className="text-[22px] font-black tracking-tight" style={{ color: '#4CAF1A' }}>Go</span>
        </div>

        {state === 'loading' && <div className="w-10 h-10 border-2 border-slate-200 border-t-[#185FA5] rounded-full animate-spin mx-auto my-8" />}

        {state === 'invalid' && (
          <div className="text-center py-4">
            <p className="text-[18px] font-black text-slate-900 mb-2">{t('polls.invalidTitle')}</p>
            <p className="text-[13px] text-slate-600">{t('polls.invalidDesc')}</p>
          </div>
        )}

        {state === 'ready' && poll && (
          <>
            <p className="text-[12px] text-slate-400 mb-1">{poll.group_name} · {t('polls.hello', { name: poll.player_name })}</p>
            <h1 className="text-[20px] font-black text-slate-900 leading-tight mb-1">{poll.title}</h1>
            {poll.location && <p className="text-[13px] text-slate-600 mb-1">📍 {poll.location}</p>}
            {poll.description && <p className="text-[14px] font-medium text-slate-800 mt-2 mb-1 whitespace-pre-line">{poll.description}</p>}
            <ClubLinks name={poll.club?.name ?? poll.location} region={poll.club?.region ?? null} country={poll.club?.country ?? null} website={poll.club?.website ?? null} />
            {poll.deadline && poll.can_vote && (
              <p className="text-[12px] font-semibold text-amber-700 mb-1">
                {t('polls.deadline', { date: new Date(poll.deadline + 'T00:00:00Z').toLocaleDateString(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }) })}
              </p>
            )}

            {poll.status === 'converted' && (
              <div className="bg-[#EAF3DE] text-[#3B6D11] rounded-xl px-4 py-3 text-[13px] font-semibold my-4">{t('polls.convertedMsg')}</div>
            )}
            {poll.status === 'closed' && (
              <div className="bg-slate-100 text-slate-600 rounded-xl px-4 py-3 text-[13px] font-semibold my-4">{t('polls.closedMsg')}</div>
            )}
            {poll.status === 'open' && !poll.can_vote && (
              <div className="bg-slate-100 text-slate-600 rounded-xl px-4 py-3 text-[13px] font-semibold my-4">{t('polls.expiredMsg')}</div>
            )}
            {poll.can_vote && <p className="text-[13px] text-slate-500 mt-2 mb-2">{t('polls.intro')}</p>}

            <div className="flex flex-col gap-3 mt-3">
              {poll.options.map(o => (
                <div key={o.id} className="border border-slate-200 rounded-xl p-3">
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <p className="text-[15px] font-bold text-slate-900 capitalize">{dayLabel(o.starts_at)}</p>
                    <p className="text-[15px] font-bold text-[#185FA5] shrink-0">{timeLabel(o.starts_at)}</p>
                  </div>
                  {poll.can_vote ? (
                    <div className="grid grid-cols-3 gap-2">
                      {CHOICES.map(c => (
                        <button key={c.key} type="button" onClick={() => pick(o.id, c.key)}
                          className={`flex flex-col items-center justify-center gap-0.5 min-h-[56px] rounded-xl border-2 text-[12px] font-semibold transition-colors ${answers[o.id] === c.key ? c.on : c.off}`}>
                          <span className="text-[18px] leading-none">{c.icon}</span>
                          <span>{t(`polls.${c.key}`)}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    o.mine && <p className="text-[12px] text-slate-500">{t('polls.yourAnswer')} : {CHOICES.find(c => c.key === o.mine)?.icon} {t(`polls.${o.mine}`)}</p>
                  )}
                  <p className="text-[12px] text-slate-500 mt-2">
                    ✅ {o.yes} · ❓ {o.maybe}
                    {best && best.id === o.id && o.yes > 0 && <span className="ml-2 font-semibold text-[#3B6D11]">★ {t('polls.bestDate')}</span>}
                  </p>
                </div>
              ))}
            </div>

            {poll.can_vote && (
              <div className="mt-5">
                <button onClick={submit} disabled={saving}
                  className="w-full bg-[#185FA5] text-white font-semibold text-[15px] py-3.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
                  {saving ? t('polls.saving') : t('polls.submit')}
                </button>
                {saved && (
                  <div className="mt-3 bg-[#EAF3DE] text-[#3B6D11] rounded-xl px-4 py-3 text-[13px] font-semibold text-center">
                    ✓ {t('polls.thanks')}
                    <p className="font-normal text-[12px] mt-0.5">{t('polls.changeHint')}</p>
                  </div>
                )}
                {error && <p className="mt-3 text-[13px] text-[#A32D2D] text-center">{t('polls.saveError')}</p>}
              </div>
            )}

            <p className="text-[11px] text-slate-400 text-center mt-5">
              {t('polls.answersCount', { answered: poll.voters_answered, total: poll.voters_total })}
            </p>
            <div className="text-center mt-3">
              <a href={`/${locale}/login`} className="text-[12px] font-semibold text-[#185FA5] underline underline-offset-2">{t('polls.openApp')}</a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function PollPage() {
  return <Suspense fallback={null}><PollContent /></Suspense>
}

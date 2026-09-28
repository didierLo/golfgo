'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import toast from 'react-hot-toast'

// Emails de CE groupe qui n'ont pas pu être envoyés (le plus souvent : adresse refusée).
// Réservé aux organisateurs du groupe : l'API répond 401/403 aux autres et le panneau reste invisible.

type Failure = {
  id: string; category: string; createdAt: string; failedAddress: string; subject: string; error: string | null
  player: { id: string; name: string; currentEmail: string | null } | null
  event:  { id: string; title: string; startsAt: string } | null
  canResend: boolean
}

const KNOWN_CATEGORIES = ['invitation', 'reminder', 'teesheet', 'communication', 'scorecard', 'group_invite', 'other']

async function fetchFailures(groupId: string): Promise<Failure[]> {
  const res = await fetch(`/api/groups/${groupId}/email-failures`)
  if (!res.ok) return []
  const json = await res.json()
  return json.failures ?? []
}

export default function EmailFailuresPanel({ groupId }: { groupId: string }) {
  const t = useTranslations()
  const locale = useLocale()
  const [failures, setFailures] = useState<Failure[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchFailures(groupId).then(list => { if (!cancelled) setFailures(list) })
    return () => { cancelled = true }
  }, [groupId])

  async function markResolved(id: string): Promise<boolean> {
    const res = await fetch(`/api/groups/${groupId}/email-failures`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    })
    return res.ok
  }

  async function dismiss(f: Failure) {
    setBusyId(f.id)
    if (await markResolved(f.id)) setFailures(list => list.filter(x => x.id !== f.id))
    else toast.error(t('common.error'))
    setBusyId(null)
  }

  // Renvoi = le même circuit que la page Invitations (l'adresse du joueur a été corrigée sur sa fiche).
  async function resend(f: Failure) {
    if (!f.player || !f.event) return
    setBusyId(f.id)
    try {
      const res = await fetch('/api/send-invitations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: f.event.id, playerIds: [f.player.id] }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.success === false) throw new Error(json.error ?? t('common.error'))
      if (json.errors?.length) throw new Error(String(json.errors[0]))
      if ((json.sent ?? 0) + (json.queued ?? 0) < 1) throw new Error(t('common.error'))
      await markResolved(f.id)
      toast.success(t('communications.emailFailures.resent'))
      setFailures(list => list.filter(x => x.id !== f.id))
    } catch (e: any) {
      toast.error(t('communications.emailFailures.resendFailed', { error: e.message ?? '' }))
    } finally {
      setBusyId(null)
    }
  }

  if (failures.length === 0) return null

  const btn = 'text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="mb-6 rounded-xl border border-amber-300 bg-white/85 backdrop-blur-sm px-4 py-3">
      <div className="text-[13px] font-bold text-slate-900">
        {t('communications.emailFailures.title', { count: failures.length })}
      </div>
      <p className="text-[12px] text-slate-600 mt-0.5 mb-3">{t('communications.emailFailures.intro')}</p>

      <div className="flex flex-col divide-y divide-slate-100">
        {failures.map(f => {
          const cat = KNOWN_CATEGORIES.includes(f.category) ? t(`communications.emailFailures.categories.${f.category}`) : f.category
          return (
            <div key={f.id} className="py-2.5 flex flex-col gap-1.5">
              <div className="flex items-baseline flex-wrap gap-x-2">
                <span className="text-[13px] font-semibold text-slate-900">{f.player?.name ?? t('communications.emailFailures.unknownPlayer')}</span>
                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">{cat}</span>
                {f.event && (
                  <span className="text-[11px] text-slate-500">
                    {f.event.title} · {new Date(f.event.startsAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                  </span>
                )}
              </div>
              <div className="text-[12px] text-slate-700">{t('communications.emailFailures.failedAddress', { address: f.failedAddress })}</div>
              {f.error && <div className="text-[11px] text-red-500 truncate">{t('communications.emailFailures.reason', { error: f.error })}</div>}
              <div className="flex flex-wrap gap-2 mt-0.5">
                {f.player && (
                  <a href={`/players/${f.player.id}/edit?groupId=${groupId}`}
                     className={`${btn} border-[#185FA5] text-[#185FA5] hover:bg-[#EBF3FC]`}>
                    {t('communications.emailFailures.fixAddress')}
                  </a>
                )}
                {f.category === 'invitation' && (
                  <button type="button" onClick={() => resend(f)} disabled={!f.canResend || busyId === f.id}
                          title={f.canResend ? undefined : t('communications.emailFailures.resendHint')}
                          className={`${btn} border-[#185FA5] bg-[#185FA5] text-white hover:bg-[#0C447C]`}>
                    {t('communications.emailFailures.resend')}
                  </button>
                )}
                <button type="button" onClick={() => dismiss(f)} disabled={busyId === f.id}
                        className={`${btn} border-slate-300 text-slate-500 hover:bg-slate-50`}>
                  {t('communications.emailFailures.dismiss')}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

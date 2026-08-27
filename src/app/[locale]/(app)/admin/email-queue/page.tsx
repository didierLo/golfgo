'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'

type QueueItem = {
  id: string
  created_at: string
  sent_at: string | null
  status: 'pending' | 'sent' | 'failed'
  attempts: number
  last_error: string | null
  category: string
  to_email: string
  subject: string
}

const CATEGORY_LABELS: Record<string, string> = {
  reminder:      'Rappel J-3',
  invitation:    'Invitation',
  teesheet:      'Liste des départs',
  communication: 'Communication',
  group_invite:  'Invitation groupe',
  scorecard:     'Carte de score',
  other:         'Autre',
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('fr-BE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function EmailQueuePage() {
  const [loading,    setLoading]    = useState(true)
  const [authorized, setAuthorized] = useState(true)
  const [pending,    setPending]    = useState<QueueItem[]>([])
  const [failed,     setFailed]     = useState<QueueItem[]>([])
  const [recentSent, setRecentSent] = useState<QueueItem[]>([])
  const [counts,     setCounts]     = useState({ pending: 0, failed: 0 })
  const [draining,   setDraining]   = useState(false)
  const [retryingId, setRetryingId] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/email-queue')
    if (res.status === 403) { setAuthorized(false); setLoading(false); return }
    const json = await res.json()
    setPending(json.pending ?? [])
    setFailed(json.failed ?? [])
    setRecentSent(json.recentSent ?? [])
    setCounts(json.counts ?? { pending: 0, failed: 0 })
    setLoading(false)
  }

  async function handleDrain() {
    setDraining(true)
    try {
      const res = await fetch('/api/admin/email-queue/drain', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      toast.success(`${json.sent} email(s) envoyé(s) — ${json.stillPending} encore en attente`)
      load()
    } catch (e: any) {
      toast.error(e.message ?? 'Erreur')
    } finally {
      setDraining(false)
    }
  }

  async function handleRetry(id: string) {
    setRetryingId(id)
    try {
      const res = await fetch('/api/admin/email-queue/retry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur')
      toast.success('Remis en file — sera renvoyé au prochain passage')
      load()
    } catch (e: any) {
      toast.error(e.message ?? 'Erreur')
    } finally {
      setRetryingId(null)
    }
  }

  if (loading) {
    return <div className="p-6 text-[13px] text-slate-400">Chargement...</div>
  }

  if (!authorized) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <p className="text-[14px] text-slate-500">Cette page n'est pas accessible avec ce compte.</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <h1 className="text-[18px] font-black text-slate-900 mb-1">File d'attente email</h1>
      <p className="text-[13px] text-slate-500 mb-6">
        Emails non envoyés à cause du plafond Resend (100/jour), en attente d'un prochain envoi automatique
        (au passage du cron quotidien) — ou à renvoyer manuellement ci-dessous.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
          <div className="text-[24px] font-black text-amber-700">{counts.pending}</div>
          <div className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide">En attente</div>
        </div>
        <div className="border border-red-200 bg-red-50 rounded-xl p-4">
          <div className="text-[24px] font-black text-red-700">{counts.failed}</div>
          <div className="text-[11px] font-semibold text-red-600 uppercase tracking-wide">Échecs définitifs</div>
        </div>
      </div>

      <button
        onClick={handleDrain}
        disabled={draining || counts.pending === 0}
        className="mb-6 w-full sm:w-auto bg-[#185FA5] text-white font-semibold text-[13px] px-5 py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-40 transition-colors"
      >
        {draining ? 'Envoi en cours…' : 'Vider la file maintenant'}
      </button>

      {/* ── En attente ── */}
      <h2 className="text-[13px] font-bold text-slate-700 mb-2">En attente ({pending.length})</h2>
      {pending.length === 0 ? (
        <p className="text-[12px] text-slate-400 mb-6">Rien en attente.</p>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden mb-6 divide-y divide-slate-100">
          {pending.map(item => (
            <div key={item.id} className="px-4 py-2.5 text-[12px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-800">{item.to_email}</span>
                <span className="text-slate-400">{formatDate(item.created_at)}</span>
              </div>
              <div className="text-slate-500">
                {CATEGORY_LABELS[item.category] ?? item.category} — {item.subject}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Échecs définitifs ── */}
      <h2 className="text-[13px] font-bold text-slate-700 mb-2">Échecs définitifs ({failed.length})</h2>
      {failed.length === 0 ? (
        <p className="text-[12px] text-slate-400 mb-6">Aucun échec.</p>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden mb-6 divide-y divide-slate-100">
          {failed.map(item => (
            <div key={item.id} className="px-4 py-2.5 text-[12px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-800">{item.to_email}</span>
                <button
                  onClick={() => handleRetry(item.id)}
                  disabled={retryingId === item.id}
                  className="text-[11px] font-semibold text-[#185FA5] hover:text-[#0C447C] underline underline-offset-2 disabled:opacity-40"
                >
                  {retryingId === item.id ? 'Remise en file…' : 'Réessayer'}
                </button>
              </div>
              <div className="text-slate-500">
                {CATEGORY_LABELS[item.category] ?? item.category} — {item.subject}
              </div>
              <div className="text-red-600 mt-0.5">{item.last_error}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Récemment envoyés (via la file) ── */}
      {recentSent.length > 0 && (
        <>
          <h2 className="text-[13px] font-bold text-slate-700 mb-2">Récemment envoyés depuis la file ({recentSent.length})</h2>
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            {recentSent.map(item => (
              <div key={item.id} className="px-4 py-2.5 text-[12px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">{item.to_email}</span>
                  <span className="text-slate-400">{item.sent_at ? formatDate(item.sent_at) : ''}</span>
                </div>
                <div className="text-slate-500">
                  {CATEGORY_LABELS[item.category] ?? item.category} — {item.subject}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const supabase = createClient()

type EmailRow = { id: string; to_email: string; subject: string; last_error: string | null; created_at: string }
type SentryIssue = { title: string; level: string; count: number; lastSeen: string; url: string }
type HealthData = {
  emailQueue: { pending: EmailRow[]; failed: EmailRow[]; counts: { pending: number; failed: number } }
  dmarc: { run_at: string; summary: any } | null
  sentry: { available: boolean; reason?: string; unresolvedCount?: number; issues?: SentryIssue[] }
}

const cardClass = "bg-white border border-slate-200 rounded-2xl p-5"

export default function HealthDashboardPage() {
  const [data, setData]       = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]       = useState(false)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/health')
    if (res.ok) setData(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleRetry(id: string) {
    setBusy(true)
    const res = await fetch('/api/admin/email-queue/retry', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) { toast.success('Remis en file'); await load() }
    else toast.error('Échec de la relance')
    setBusy(false)
  }

  async function handleDrainNow() {
    setBusy(true)
    const res = await fetch('/api/admin/email-queue/drain', { method: 'POST' })
    if (res.ok) { toast.success('File relancée'); await load() }
    else toast.error('Échec')
    setBusy(false)
  }

  if (loading) return <div className="p-6 text-slate-400 text-[13px]">Chargement…</div>
  if (!data)   return <div className="p-6 text-red-500 text-[13px]">Accès refusé ou erreur de chargement.</div>

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <h1 className="text-[18px] font-semibold text-slate-900">Santé du système</h1>

      {/* ── File d'emails ── */}
      <div className={cardClass}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-semibold text-slate-800">📧 File d'emails</h2>
          <button onClick={handleDrainNow} disabled={busy}
            className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40">
            Vider la file maintenant
          </button>
        </div>
        <div className="flex gap-6 mb-4">
          <div>
            <div className="text-[22px] font-bold text-slate-900">{data.emailQueue.counts.pending}</div>
            <div className="text-[11px] text-slate-400">en attente</div>
          </div>
          <div>
            <div className={`text-[22px] font-bold ${data.emailQueue.counts.failed > 0 ? 'text-red-500' : 'text-slate-900'}`}>
              {data.emailQueue.counts.failed}
            </div>
            <div className="text-[11px] text-slate-400">en échec</div>
          </div>
        </div>
        {data.emailQueue.failed.length > 0 && (
          <div className="space-y-2">
            {data.emailQueue.failed.map(row => (
              <div key={row.id} className="flex items-center justify-between gap-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-slate-800 truncate">{row.to_email} — {row.subject}</div>
                  <div className="text-[11px] text-red-500 truncate">{row.last_error}</div>
                </div>
                <button onClick={() => handleRetry(row.id)} disabled={busy}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-100 disabled:opacity-40 flex-shrink-0">
                  Relancer
                </button>
              </div>
            ))}
          </div>
        )}
        {data.emailQueue.counts.pending === 0 && data.emailQueue.counts.failed === 0 && (
          <p className="text-[12px] text-slate-400">Rien en attente, rien en échec. ✓</p>
        )}
      </div>

      {/* ── Sentry, en clair ── */}
      <div className={cardClass}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-semibold text-slate-800">🐛 Erreurs de l'application</h2>
          <a href="https://golfgo.sentry.io" target="_blank" rel="noopener noreferrer"
            className="text-[12px] font-medium text-[#185FA5] hover:underline">Voir sur Sentry →</a>
        </div>
        {!data.sentry.available ? (
          <p className="text-[12px] text-amber-600">Non disponible : {data.sentry.reason}</p>
        ) : data.sentry.unresolvedCount === 0 ? (
          <p className="text-[12px] text-slate-400">Aucune erreur active cette semaine. ✓</p>
        ) : (
          <div className="space-y-2">
            <p className="text-[12px] text-slate-500 mb-2">{data.sentry.unresolvedCount} type(s) d'erreur active(s) cette semaine :</p>
            {data.sentry.issues?.map((issue, i) => (
              <a key={i} href={issue.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 bg-slate-50 hover:bg-slate-100 rounded-lg px-3 py-2 transition-colors">
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-slate-800 truncate">{issue.title}</div>
                  <div className="text-[11px] text-slate-400">{issue.level} · vue {issue.count} fois</div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ── DMARC ── */}
      <div className={cardClass}>
        <h2 className="text-[14px] font-semibold text-slate-800 mb-4">📨 Authentification email (DMARC)</h2>
        {!data.dmarc ? (
          <p className="text-[12px] text-slate-400">Pas encore de rapport enregistré — le prochain arrivera le 1er du mois.</p>
        ) : (
          <div className="text-[13px] text-slate-700 space-y-1">
            <p className="text-[11px] text-slate-400 mb-2">
              Dernier rapport : {new Date(data.dmarc.run_at).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p>{data.dmarc.summary.messagesProcessed} rapport(s) traité(s), {data.dmarc.summary.totalVolume} email(s) au total</p>
            <p>DKIM aligné : <strong>{data.dmarc.summary.dkimPassPercent ?? '—'}%</strong> · SPF aligné : <strong>{data.dmarc.summary.spfPassPercent ?? '—'}%</strong></p>
            {data.dmarc.summary.fullFailuresCount > 0 ? (
              <p className="text-amber-600 font-medium">⚠️ {data.dmarc.summary.fullFailuresCount} échec(s) complet(s) à surveiller</p>
            ) : (
              <p className="text-[#3B6D11]">✓ Aucun échec complet détecté</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
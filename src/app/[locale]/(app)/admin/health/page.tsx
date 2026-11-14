'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const supabase = createClient()

type EmailRow = {
  id: string; status: string; to_email: string; subject: string; last_error: string | null; created_at: string
  player: { name: string; currentEmail: string | null } | null
  group_name: string | null
  event: { title: string; starts_at: string } | null
}
type SentryIssue = { title: string; level: string; count: number; lastSeen: string; url: string }
type BackupLogRow = { run_at: string; summary: { ok: boolean; bytes?: number; tables?: number; rows?: number; trigger?: string; error?: string } }
type HealthData = {
  emailQueue: { pending: EmailRow[]; failed: EmailRow[]; counts: { pending: number; failed: number } }
  dmarc: { run_at: string; summary: any } | null
  backup: { lastOk: BackupLogRow | null; lastAttempt: BackupLogRow | null }
  sentry: { available: boolean; reason?: string; unresolvedCount?: number; issues?: SentryIssue[] }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const cleanAddr = (a: string) => a.replace(/[\s\u00a0\u200b]+/g, '')

// Une ligne de la file d'emails : on peut CORRIGER l'adresse (et renvoyer tout de suite) ou SUPPRIMER l'email.
function EmailQueueRow({ row, busy, onFix, onDelete }: {
  row: EmailRow
  busy: boolean
  onFix: (id: string, address: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const failed   = row.status === 'failed'
  const cleaned  = cleanAddr(row.to_email)
  const current  = row.player?.currentEmail ? cleanAddr(row.player.currentEmail) : null
  // Suggestion : l'adresse actuelle du joueur si elle a déjà été corrigée dans sa fiche, sinon l'adresse sans espaces
  const currentIsFix = !!current && EMAIL_RE.test(current) && current.toLowerCase() !== row.to_email.toLowerCase()
  const suggestion   = currentIsFix ? current! : cleaned
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(suggestion)
  const eventPast = !!row.event && new Date(row.event.starts_at) < new Date()
  const addressOk = EMAIL_RE.test(row.to_email)

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${failed ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-slate-800 break-all">
            {row.player ? `${row.player.name} — ` : ''}<span className={addressOk ? '' : 'text-red-600'}>« {row.to_email} »</span>
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            {row.group_name ? `${row.group_name} · ` : ''}{row.subject}
            {row.event ? ` · ${new Date(row.event.starts_at).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', timeZone: 'UTC' })}` : ''}
            {eventPast && <span className="ml-1 font-semibold text-amber-600">(événement passé)</span>}
          </div>
          {failed && row.last_error && <div className="text-[11px] text-red-500">{row.last_error}</div>}
          {failed && currentIsFix && !editing && (
            <div className="text-[11px] text-[#3B6D11] mt-0.5">✓ La fiche du joueur a déjà une adresse corrigée : {current}</div>
          )}
        </div>
        {!editing && (
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => { setDraft(suggestion); setEditing(true) }} disabled={busy}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40">
              Corriger
            </button>
            <button onClick={() => { if (confirm('Supprimer cet email de la file ? Il ne sera jamais envoyé.')) onDelete(row.id) }} disabled={busy}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-100 disabled:opacity-40">
              Supprimer
            </button>
          </div>
        )}
      </div>
      {editing && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input type="email" value={draft} onChange={e => setDraft(e.target.value)} autoFocus
            className="flex-1 min-w-[220px] text-[12px] px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white" />
          <button onClick={async () => { await onFix(row.id, draft); setEditing(false) }}
            disabled={busy || !EMAIL_RE.test(cleanAddr(draft))}
            className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40">
            Corriger et renvoyer
          </button>
          <button onClick={() => setEditing(false)} disabled={busy}
            className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-600 hover:bg-slate-100">
            Annuler
          </button>
        </div>
      )}
    </div>
  )
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

  // Corrige l'adresse d'un email de la file puis le renvoie tout de suite ; l'écran dit si c'est parti ou refusé.
  async function handleFix(id: string, address: string) {
    setBusy(true)
    const res = await fetch('/api/admin/email-queue/retry', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, to_email: address }),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) toast.error(body?.error ?? 'Échec de la correction')
    else if (body?.sent) toast.success('Adresse corrigée — email envoyé ✓')
    else toast.error(`Adresse corrigée, mais l'envoi a échoué : ${body?.error ?? 'raison inconnue'}`)
    await load()
    setBusy(false)
  }

  async function handleDelete(id: string) {
    setBusy(true)
    const res = await fetch('/api/admin/email-queue/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) toast.success('Email supprimé')
    else toast.error('Échec de la suppression')
    await load()
    setBusy(false)
  }

  async function handleDeleteAll(scope: 'failed' | 'pending') {
    const label = scope === 'failed' ? 'en échec' : 'en attente'
    if (!confirm(`Supprimer tous les emails ${label} ? Ils ne seront jamais envoyés.`)) return
    setBusy(true)
    const res = await fetch('/api/admin/email-queue/delete', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope }),
    })
    const body = await res.json().catch(() => null)
    if (res.ok) toast.success(`${body?.deleted ?? 0} email(s) supprimé(s)`)
    else toast.error('Échec de la suppression')
    await load()
    setBusy(false)
  }

  async function handleBackupNow() {
    setBusy(true)
    const res = await fetch('/api/admin/backup', { method: 'POST' })
    const body = await res.json().catch(() => null)
    if (res.ok) toast.success('Sauvegarde envoyée par email')
    else toast.error(`Échec de la sauvegarde${body?.error ? ` : ${body.error}` : ''}`)
    await load()
    setBusy(false)
  }

  async function handleDrainNow() {
    setBusy(true)
    const res = await fetch('/api/admin/email-queue/drain', { method: 'POST' })
    if (res.ok) {
      const body = await res.json().catch(() => null)
      toast.success(`${body?.sent ?? 0} email(s) envoyé(s), ${body?.stillPending ?? 0} encore en attente`)
      await load()
    }
    else toast.error('Échec')
    setBusy(false)
  }

  if (loading) return <div className="p-6 text-slate-400 text-[13px]">Chargement…</div>
  if (!data)   return <div className="p-6 text-red-500 text-[13px]">Accès refusé ou erreur de chargement.</div>

  // ── Sauvegarde : état affiché ──
  const { lastOk, lastAttempt } = data.backup
  const backupAgeDays = lastOk ? Math.floor((Date.now() - new Date(lastOk.run_at).getTime()) / 86_400_000) : null
  const lastAttemptFailed = !!lastAttempt && !lastAttempt.summary.ok
  const backupLate = backupAgeDays === null || backupAgeDays > 10
  const formatSize = (b?: number) => !b ? '—' : b < 1024 * 1024 ? `${Math.round(b / 1024)} Ko` : `${(b / 1024 / 1024).toFixed(1)} Mo`

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <h1 className="text-[18px] font-semibold text-slate-900">Santé du système</h1>

      {/* ── File d'emails ── */}
      <div className={cardClass}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-[14px] font-semibold text-slate-800">📧 File d'emails</h2>
          <button onClick={handleDrainNow} disabled={busy || data.emailQueue.counts.pending === 0}
            title="Réessaie les emails mis de côté (quota d'envoi dépassé). Ne corrige aucune adresse."
            className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40">
            Renvoyer les emails en attente
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
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[12px] font-semibold text-slate-600">En échec — adresse refusée</h3>
              <button onClick={() => handleDeleteAll('failed')} disabled={busy}
                className="text-[11px] font-semibold text-red-600 hover:underline disabled:opacity-40">
                Tout supprimer
              </button>
            </div>
            <div className="space-y-2">
              {data.emailQueue.failed.map(row => (
                <EmailQueueRow key={row.id} row={row} busy={busy} onFix={handleFix} onDelete={handleDelete} />
              ))}
            </div>
          </div>
        )}
        {data.emailQueue.pending.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[12px] font-semibold text-slate-600">En attente d'envoi</h3>
              <button onClick={() => handleDeleteAll('pending')} disabled={busy}
                className="text-[11px] font-semibold text-red-600 hover:underline disabled:opacity-40">
                Tout supprimer
              </button>
            </div>
            <div className="space-y-2">
              {data.emailQueue.pending.map(row => (
                <EmailQueueRow key={row.id} row={row} busy={busy} onFix={handleFix} onDelete={handleDelete} />
              ))}
            </div>
          </div>
        )}
        {data.emailQueue.counts.pending === 0 && data.emailQueue.counts.failed === 0 && (
          <p className="text-[12px] text-slate-400">Rien en attente, rien en échec. ✓</p>
        )}
      </div>

      {/* ── Sauvegarde de la base ── */}
      <div className={cardClass}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-semibold text-slate-800">💾 Sauvegarde de la base</h2>
          <button onClick={handleBackupNow} disabled={busy}
            className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40">
            Sauvegarder maintenant
          </button>
        </div>
        {!lastOk ? (
          <p className="text-[12px] text-red-500 font-medium">⚠️ Aucune sauvegarde enregistrée pour l'instant.</p>
        ) : (
          <div className="text-[13px] text-slate-700 space-y-1">
            <p className={backupLate ? 'text-red-500 font-medium' : 'text-[#3B6D11] font-medium'}>
              {backupLate
                ? `⚠️ Dernière sauvegarde réussie il y a ${backupAgeDays} jours — trop ancienne`
                : `✓ Dernière sauvegarde réussie : ${new Date(lastOk.run_at).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })}${backupAgeDays === 0 ? ' (aujourd\'hui)' : ` (il y a ${backupAgeDays} jour${backupAgeDays > 1 ? 's' : ''})`}`}
            </p>
            <p className="text-[12px] text-slate-500">
              {lastOk.summary.tables} tables · {lastOk.summary.rows} lignes · pièce jointe de {formatSize(lastOk.summary.bytes)}
            </p>
          </div>
        )}
        {lastAttemptFailed && (
          <p className="text-[12px] text-red-500 mt-2">
            ⚠️ La dernière tentative ({new Date(lastAttempt!.run_at).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long' })}) a échoué : {lastAttempt!.summary.error ?? 'erreur inconnue'}. Nouvel essai automatique demain.
          </p>
        )}
        <p className="text-[11px] text-slate-400 mt-3">
          Automatique chaque semaine, envoyée par email en pièce jointe. Ne contient pas les mots de passe ni les règles de sécurité de la base.
        </p>
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
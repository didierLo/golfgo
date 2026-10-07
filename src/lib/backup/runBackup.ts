import { gzipSync } from 'zlib'
import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'

// ─────────────────────────────────────────────────────────────────────────────
// Sauvegarde hebdomadaire de la base : export JSON compressé de toutes les
// tables du schéma public, envoyé par email en pièce jointe, tracé dans
// system_health_log (job = 'backup') pour la page « Santé du système ».
//
// Ne contient PAS : auth.users (mots de passe), policies RLS, fonctions, triggers.
// Les tables sont découvertes automatiquement (RPC backup_list_tables) : une
// future table est sauvegardée sans toucher au code.
// ─────────────────────────────────────────────────────────────────────────────

export const BACKUP_JOB = 'backup'
export const BACKUP_MIN_INTERVAL_DAYS = 6          // pas de nouvelle sauvegarde auto avant 6 jours
const MAX_ATTACHMENT_BYTES = 30 * 1024 * 1024      // Resend accepte 40 Mo au total, on garde de la marge

// Tables volatiles ou sensibles sans intérêt en cas de restauration :
// - push_subscriptions : clés d'abonnement push, se recréent à la prochaine connexion
// - email_queue        : file transitoire
// - system_health_log  : journaux techniques (dont cette sauvegarde elle-même)
const EXCLUDED_TABLES = new Set(['push_subscriptions', 'email_queue', 'system_health_log'])

export type BackupResult =
  | { ok: true; skipped: true; reason: string }
  | { ok: true; skipped: false; bytes: number; tables: number; rows: number; fileName: string }
  | { ok: false; error: string }

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

async function logBackup(supabase: SupabaseClient, summary: Record<string, unknown>) {
  const { error } = await supabase.from('system_health_log').insert({ job: BACKUP_JOB, summary })
  if (error) console.error('[BACKUP] impossible d\'écrire dans system_health_log:', error.message)
}

export async function runBackup(
  supabase: SupabaseClient,
  opts: { force?: boolean; trigger: 'cron' | 'manual' },
): Promise<BackupResult> {
  try {
    // ── 1. Faut-il sauvegarder maintenant ? ───────────────────────────────────
    // Dernière sauvegarde RÉUSSIE : un échec n'empêche pas de réessayer le lendemain.
    if (!opts.force) {
      const { data: recent } = await supabase
        .from('system_health_log')
        .select('run_at, summary')
        .eq('job', BACKUP_JOB)
        .order('run_at', { ascending: false })
        .limit(10)

      const lastOk = (recent ?? []).find(r => r.summary?.ok === true)
      if (lastOk) {
        const ageDays = (Date.now() - new Date(lastOk.run_at).getTime()) / 86_400_000
        if (ageDays < BACKUP_MIN_INTERVAL_DAYS) {
          return { ok: true, skipped: true, reason: `dernière sauvegarde il y a ${ageDays.toFixed(1)} jour(s)` }
        }
      }
    }

    // ── 2. Exporter chaque table (un seul document JSON par table, via RPC) ──
    const { data: tableNames, error: listError } = await supabase.rpc('backup_list_tables')
    if (listError) throw new Error(`Liste des tables : ${listError.message}`)

    const tables: Record<string, unknown[]> = {}
    const counts: Record<string, number> = {}
    for (const name of (tableNames as string[]) ?? []) {
      if (EXCLUDED_TABLES.has(name)) continue
      const { data, error } = await supabase.rpc('backup_export_table', { p_table: name })
      if (error) throw new Error(`Export de la table ${name} : ${error.message}`)
      const rows = (data as unknown[]) ?? []
      tables[name] = rows
      counts[name] = rows.length
    }

    const tableCount = Object.keys(tables).length
    const rowCount = Object.values(counts).reduce((sum, n) => sum + n, 0)
    if (tableCount === 0) throw new Error('Aucune table exportée')

    // ── 3. Compresser ────────────────────────────────────────────────────────
    const generatedAt = new Date()
    const json = JSON.stringify({ project: 'golfgo', generated_at: generatedAt.toISOString(), counts, tables })
    const gz = gzipSync(Buffer.from(json, 'utf-8'))
    if (gz.length > MAX_ATTACHMENT_BYTES) {
      throw new Error(`Sauvegarde trop volumineuse pour un email (${formatBytes(gz.length)}) — prévoir un autre stockage`)
    }

    const fileName = `golfgo-backup-${generatedAt.toISOString().slice(0, 10)}.json.gz`
    const dateLabel = generatedAt.toLocaleDateString('fr-BE', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Brussels',
    })

    // ── 4. Envoyer par email (le SDK Resend ne lève pas d'exception : on lit `error`) ──
    const to = process.env.BACKUP_EMAIL_TO ?? 'didier.lozet@gmail.com'
    const resend = new Resend(process.env.RESEND_API_KEY)
    const tableRows = Object.entries(counts)
      .map(([name, n]) => `<tr><td>${name}</td><td style="text-align:right">${n}</td></tr>`)
      .join('')

    const { data: sent, error: sendError } = await resend.emails.send({
      from: 'GolfGo <noreply@golfgo.be>',
      to,
      subject: `Sauvegarde GolfGo — ${dateLabel}`,
      html: `
        <h2>Sauvegarde de la base GolfGo — ${dateLabel}</h2>
        <p><strong>${tableCount}</strong> tables, <strong>${rowCount}</strong> lignes, pièce jointe de <strong>${formatBytes(gz.length)}</strong>
        (<code>${fileName}</code>, JSON compressé en gzip).</p>
        <p><strong>⚠️ Ce fichier contient les données personnelles des joueurs</strong> (emails, téléphones). Garde-le dans ta boîte ou sur ton disque, ne le transfère pas et ne le publie nulle part.</p>
        <p>Cette sauvegarde ne contient pas les comptes de connexion (mots de passe), ni les règles de sécurité, fonctions et triggers de la base : ceux-ci se reconstruisent à partir des migrations SQL.</p>
        <table border="1" cellpadding="6" style="border-collapse:collapse">
          <tr><th>Table</th><th>Lignes</th></tr>
          ${tableRows}
        </table>`,
      attachments: [{ filename: fileName, content: gz }],
    })
    if (sendError) throw new Error(`Envoi de l'email : ${sendError.message}`)

    // ── 5. Tracer le succès pour la page « Santé du système » ────────────────
    await logBackup(supabase, {
      ok: true,
      trigger: opts.trigger,
      bytes: gz.length,
      tables: tableCount,
      rows: rowCount,
      fileName,
      emailId: sent?.id ?? null,
    })

    return { ok: true, skipped: false, bytes: gz.length, tables: tableCount, rows: rowCount, fileName }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[BACKUP] échec:', message)
    Sentry.captureException(err)
    await logBackup(supabase, { ok: false, trigger: opts.trigger, error: message.slice(0, 500) })
    return { ok: false, error: message }
  }
}

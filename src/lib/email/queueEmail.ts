import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export type EmailCategory = 'reminder' | 'invitation' | 'teesheet' | 'communication' | 'group_invite' | 'scorecard' | 'other'

export type EmailPayload = {
  category:    EmailCategory
  groupId?:    string | null
  eventId?:    string | null
  from:        string
  replyTo?:    string
  to:          string
  subject:     string
  html:        string
  headers?:    Record<string, string>
  attachments?: { filename: string; content: string; contentType?: string }[]
}

/**
 * Détecte si une erreur Resend correspond à un dépassement de quota (journalier
 * ou de débit) plutôt qu'à une erreur définitive (email invalide, domaine non
 * vérifié, etc.). On matche large (statusCode, name, message) car Resend ne
 * documente pas un unique code stable pour ce cas — mieux vaut sur-détecter
 * et mettre en file un email qui aurait pu passer, que sous-détecter et
 * perdre silencieusement un email qui aurait dû être mis en file.
 */
function isQuotaError(error: any): boolean {
  const status = error?.statusCode ?? error?.status
  const name   = String(error?.name ?? '').toLowerCase()
  const msg    = String(error?.message ?? '').toLowerCase()
  return status === 429
    || name.includes('rate_limit')
    || name.includes('quota')
    || msg.includes('rate limit')
    || msg.includes('quota')
    || msg.includes('daily')
}

/**
 * Envoie un email immédiatement. En cas de dépassement de quota Resend,
 * l'email est mis en file (table email_queue) au lieu d'être perdu — il
 * sera renvoyé automatiquement au prochain passage du cron quotidien
 * (voir drainEmailQueue). Toute autre erreur (email invalide, etc.) est
 * aussi journalisée en base avec le statut 'failed', pour garder une trace.
 *
 * Retourne { sent: true } si l'email est bien parti à l'instant,
 * { sent: false, queued: true } s'il a été mis en attente,
 * { sent: false, queued: false, error } pour une erreur définitive.
 */
export async function sendOrQueueEmail(payload: EmailPayload): Promise<
  { sent: true } | { sent: false; queued: boolean; error: string }
> {
  const { error } = await resend.emails.send({
    from:        payload.from,
    ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
    to:          payload.to,
    subject:     payload.subject,
    html:        payload.html,
    ...(payload.headers ? { headers: payload.headers } : {}),
    ...(payload.attachments ? { attachments: payload.attachments } : {}),
  })

  if (!error) return { sent: true }

  const queued = isQuotaError(error)
  await supabaseAdmin.from('email_queue').insert({
    status:      queued ? 'pending' : 'failed',
    attempts:    1,
    last_error:  error.message,
    category:    payload.category,
    group_id:    payload.groupId ?? null,
    event_id:    payload.eventId ?? null,
    from_email:  payload.from,
    reply_to:    payload.replyTo ?? null,
    to_email:    payload.to,
    subject:     payload.subject,
    html:        payload.html,
    headers:     payload.headers ?? null,
    attachments: payload.attachments ?? null,
  })

  return { sent: false, queued, error: error.message }
}

/**
 * À appeler en tout début du cron quotidien, avant tout nouvel envoi :
 * retente les emails en attente (les plus anciens d'abord), jusqu'à
 * `maxToSend` ou jusqu'au premier nouveau dépassement de quota (auquel cas
 * on s'arrête — pas la peine d'essayer les suivants, ils échoueront pareil).
 * Chaque tentative respecte un petit délai pour rester sous la limite de
 * débit Resend (indépendante du plafond journalier).
 */
export async function drainEmailQueue(maxToSend: number = 80): Promise<{ sent: number; stillPending: number }> {
  const { data: pending } = await supabaseAdmin
    .from('email_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(maxToSend)

  let sent = 0
  for (const item of pending ?? []) {
    const { error } = await resend.emails.send({
      from:        item.from_email,
      ...(item.reply_to ? { replyTo: item.reply_to } : {}),
      to:          item.to_email,
      subject:     item.subject,
      html:        item.html,
      ...(item.headers ? { headers: item.headers } : {}),
      ...(item.attachments ? { attachments: item.attachments } : {}),
    })

    if (!error) {
      await supabaseAdmin.from('email_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', item.id)
      sent++
    } else if (isQuotaError(error)) {
      // Quota de nouveau atteint — inutile d'essayer les suivants aujourd'hui
      await supabaseAdmin.from('email_queue')
        .update({ attempts: item.attempts + 1, last_error: error.message })
        .eq('id', item.id)
      break
    } else {
      // Erreur définitive (ex. adresse invalide) — après 5 tentatives, abandon
      const attempts = item.attempts + 1
      await supabaseAdmin.from('email_queue')
        .update({
          attempts,
          last_error: error.message,
          status: attempts >= 5 ? 'failed' : 'pending',
        })
        .eq('id', item.id)
    }

    await new Promise(r => setTimeout(r, 250))
  }

  const { count: stillPending } = await supabaseAdmin
    .from('email_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  return { sent, stillPending: stillPending ?? 0 }
}

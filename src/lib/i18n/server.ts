// Traduction côté serveur (routes d'emails, cron…) : la langue est celle du GROUPE,
// pas celle d'un navigateur (il n'y en a pas au moment de l'envoi).

import { createTranslator } from 'next-intl'
import en from '@/messages/en.json'
import fr from '@/messages/fr.json'
import nl from '@/messages/nl.json'
import de from '@/messages/de.json'
import es from '@/messages/es.json'
import { DEFAULT_LOCALE, normalizeLocale, type EmailT, type Locale } from './types'

export * from './types'

const MESSAGES = { en, fr, nl, de, es } as const

export type ServerT = EmailT

export function serverT(locale: Locale): ServerT {
  return createTranslator({ locale, messages: MESSAGES[locale] as any }) as unknown as ServerT
}

// Langue enregistrée pour un groupe. Ne lève jamais d'erreur : si la colonne `locale`
// n'existe pas encore en base (migration pas encore passée) ou si la lecture échoue,
// on retombe sur la langue historique plutôt que de bloquer l'envoi d'un email.
export async function getGroupLocale(supabase: any, groupId: string | null | undefined): Promise<Locale> {
  if (!groupId) return DEFAULT_LOCALE
  try {
    const { data, error } = await supabase.from('groups').select('locale').eq('id', groupId).maybeSingle()
    if (error) return DEFAULT_LOCALE
    return normalizeLocale(data?.locale)
  } catch {
    return DEFAULT_LOCALE
  }
}

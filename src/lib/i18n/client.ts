'use client'

// Traduction côté navigateur pour les DOCUMENTS destinés aux joueurs d'un groupe
// (cartes de score imprimées, tee sheet imprimé…) : ils suivent la langue du GROUPE,
// pas celle de l'interface de la personne qui clique sur « Imprimer ».
//
// Les 5 fichiers de traduction ne sont pas embarqués ensemble : seul celui de la langue
// du groupe est téléchargé (import dynamique), et seulement quand il est nécessaire.

import { useEffect, useState } from 'react'
import { createTranslator, useLocale, useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { DATE_LOCALE, normalizeLocale, type EmailT, type GroupI18n, type Locale } from './types'

const supabase = createClient()

const MESSAGE_LOADERS: Record<Locale, () => Promise<{ default: unknown }>> = {
  fr: () => import('@/messages/fr.json'),
  en: () => import('@/messages/en.json'),
  nl: () => import('@/messages/nl.json'),
  de: () => import('@/messages/de.json'),
  es: () => import('@/messages/es.json'),
}

export function fallbackGroupI18n(t: unknown, uiLocale: string): GroupI18n {
  const lang = normalizeLocale(uiLocale)
  return { t: t as EmailT, lang, dateLocale: DATE_LOCALE[lang] }
}

// Charge la langue du groupe. En cas d'échec de lecture (colonne absente, droits…),
// on garde la langue de l'interface plutôt que de bloquer l'impression.
export async function loadGroupI18n(groupId: string | null | undefined, fallback: GroupI18n): Promise<GroupI18n> {
  if (!groupId) return fallback
  try {
    const { data, error } = await supabase.from('groups').select('locale').eq('id', groupId).maybeSingle()
    if (error) return fallback
    const lang = normalizeLocale(data?.locale)
    const messages = (await MESSAGE_LOADERS[lang]()).default as any
    const t = createTranslator({ locale: lang, messages }) as unknown as EmailT
    return { t, lang, dateLocale: DATE_LOCALE[lang] }
  } catch {
    return fallback
  }
}

// Hook : renvoie tout de suite la langue de l'interface, puis bascule sur celle du groupe
// dès qu'elle est chargée (la bascule prend une fraction de seconde).
export function useGroupDocI18n(groupId: string | null | undefined): GroupI18n {
  const uiT = useTranslations()
  const uiLocale = useLocale()
  const [loaded, setLoaded] = useState<{ groupId: string; i18n: GroupI18n } | null>(null)

  useEffect(() => {
    if (!groupId) return
    let cancelled = false
    loadGroupI18n(groupId, fallbackGroupI18n(uiT, uiLocale)).then(i18n => {
      if (!cancelled) setLoaded({ groupId, i18n })
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId])

  return loaded && loaded.groupId === groupId ? loaded.i18n : fallbackGroupI18n(uiT, uiLocale)
}

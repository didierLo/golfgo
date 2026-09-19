// Types et constantes de langue SANS dépendance aux fichiers de traduction :
// importable côté navigateur sans embarquer les 5 langues dans le bundle.

export const LOCALES = ['fr', 'en', 'nl', 'de', 'es'] as const
export type Locale = (typeof LOCALES)[number]

// Langue utilisée quand un groupe n'a pas (encore) de langue enregistrée.
// = comportement historique de GolfGo (groupes francophones belges).
export const DEFAULT_LOCALE: Locale = 'fr'

// Locale BCP 47 utilisée pour formater dates et heures dans les documents envoyés.
export const DATE_LOCALE: Record<Locale, string> = {
  fr: 'fr-BE',
  nl: 'nl-BE',
  en: 'en-GB',
  de: 'de-DE',
  es: 'es-ES',
}

// Noms de langues affichés tels quels (endonymes), quelle que soit la langue de l'interface.
export const LOCALE_NAMES: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  nl: 'Nederlands',
  de: 'Deutsch',
  es: 'Español',
}

export function normalizeLocale(value: unknown): Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
    ? (value as Locale)
    : DEFAULT_LOCALE
}

// Fonction de traduction minimale, compatible avec celle de next-intl (navigateur)
// et avec celle de createTranslator (serveur).
// `raw` renvoie le texte brut, sans mise en forme ICU : indispensable pour les modèles d'emails
// qui contiennent des variables du type {{first_name}}.
export type EmailT = ((key: string, values?: Record<string, string | number>) => string) & {
  raw: (key: string) => string
}

// Traducteur + formats de date d'UN groupe (pour les documents qui lui sont destinés).
export type GroupI18n = { t: EmailT; lang: Locale; dateLocale: string }

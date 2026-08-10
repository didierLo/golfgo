import { getRequestConfig } from 'next-intl/server'
import { IntlErrorCode } from 'next-intl'
import * as Sentry from '@sentry/nextjs'
import en from '../messages/en.json'
import fr from '../messages/fr.json'
import es from '../messages/es.json'
import de from '../messages/de.json'
import nl from '../messages/nl.json'

const messageMap: Record<string, any> = { en, fr, es, de, nl }

function getFromPath(obj: any, path: string): unknown {
  return path.split('.').reduce((acc: any, k) => (acc && typeof acc === 'object' ? acc[k] : undefined), obj)
}

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) ?? 'en'

  return {
    locale,
    messages: messageMap[locale] ?? en,

    // Se déclenche côté serveur dès qu'une clé de traduction manque —
    // avant même que ça n'atteigne l'écran de l'utilisateur.
    onError(error) {
      if (error.code === IntlErrorCode.MISSING_MESSAGE) {
        // Remonté dans Sentry pour être vu tout de suite (déjà en place dans le projet),
        // au lieu de traîner silencieusement dans la console d'un utilisateur.
        Sentry.captureMessage(`i18n: ${error.message}`, 'warning')
      } else {
        console.error(error)
      }
    },

    // Ce qui s'affiche réellement à l'écran quand une clé manque pour la langue active.
    getMessageFallback({ namespace, key, error }) {
      const path = [namespace, key].filter(Boolean).join('.')
      if (error.code === IntlErrorCode.MISSING_MESSAGE) {
        // 1) on retente en anglais, qui sert de langue de référence la plus complète
        const fallback = getFromPath(en, path)
        if (typeof fallback === 'string') return fallback
        // 2) sinon, un texte vide reste moins gênant qu'un "MISSING_MESSAGE: ..." visible
        return ''
      }
      return path
    },
  }
})
import { getRequestConfig } from 'next-intl/server'
import en from '../messages/en.json'
import fr from '../messages/fr.json'
import es from '../messages/es.json'
import de from '../messages/de.json'
import nl from '../messages/nl.json'

const messageMap: Record<string, any> = { en, fr, es, de, nl }

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) ?? 'en'
  return {
    locale,
    messages: messageMap[locale] ?? en,
  }
})
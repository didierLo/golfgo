import Link from 'next/link'
import { cookies, headers } from 'next/headers'
import { createTranslator } from 'next-intl'
import en from '@/messages/en.json'
import fr from '@/messages/fr.json'
import nl from '@/messages/nl.json'
import de from '@/messages/de.json'
import es from '@/messages/es.json'

const MESSAGES = { en, fr, nl, de, es }
type Locale = keyof typeof MESSAGES

// Cette page est rendue hors du segment [locale] : il n'y a donc pas de langue dans l'URL.
// On reprend la même logique que le reste de l'app : cookie NEXT_LOCALE (choix de l'utilisateur),
// sinon langue du navigateur, sinon anglais (langue par défaut de l'app).
async function detectLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get('NEXT_LOCALE')?.value
  if (fromCookie && fromCookie in MESSAGES) return fromCookie as Locale
  const accept = (await headers()).get('accept-language') ?? ''
  for (const part of accept.split(',')) {
    const code = part.trim().split(';')[0].slice(0, 2).toLowerCase()
    if (code in MESSAGES) return code as Locale
  }
  return 'en'
}

export default async function NotFound() {
  const locale = await detectLocale()
  const t = createTranslator({ locale, messages: MESSAGES[locale] })
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src="/golf-bg.jpg" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.35)' }} />
      </div>

      <div className="absolute top-6 left-6 z-10">
        <img src="/logo/GG_Logo_transparent.png" alt="GolfGo" className="h-16" />
      </div>

      <div className="relative z-10 w-full max-w-sm" style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.6)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        borderRadius: '20px',
        padding: '40px 32px',
        textAlign: 'center',
      }}>
        <div className="text-[64px] font-black text-[#185FA5] leading-none mb-2">404</div>
        <div className="text-4xl mb-4">⛳</div>
        <h1 className="text-[20px] font-bold text-slate-900 mb-2">{t('notFound.title')}</h1>
        <p className="text-[13px] text-slate-500 mb-6 leading-relaxed">
          {t('notFound.desc')}
        </p>
        <div className="flex flex-col gap-2">
          <Link href={`/${locale}/my-events`}
            className="w-full bg-[#185FA5] text-white text-[13px] font-semibold py-2.5 rounded-xl hover:bg-[#0C447C] transition-colors text-center block">
            {t('nav.myEvents')}
          </Link>
          <Link href="/"
            className="w-full border border-slate-200 text-slate-700 text-[13px] font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-center block">
            ← {t('common.home')}
          </Link>
        </div>
      </div>
    </div>
  )
}
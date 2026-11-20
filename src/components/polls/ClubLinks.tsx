'use client'

// Boutons « Site du club » et « Itinéraire » d'un sondage (mêmes libellés et même lien Google Maps que dans Mes événements).
import { useTranslations } from 'next-intl'

export default function ClubLinks({ name, region, country, website }: {
  name: string | null; region: string | null; country: string | null; website: string | null
}) {
  const t = useTranslations()
  // Garde-fou : on n'affiche le lien que pour une adresse http(s)
  const safeWebsite = website && /^https?:\/\//i.test(website) ? website : null
  const query = [name, region, country].filter(Boolean).join(' ')
  if (!safeWebsite && !query) return null

  const cls = 'flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-xl border border-[#B5D4F4] bg-[#EBF3FC] text-[#185FA5] hover:bg-[#185FA5] hover:text-white hover:border-[#185FA5] transition-colors'
  return (
    <div className="flex flex-wrap gap-2 my-3">
      {safeWebsite && (
        <a href={safeWebsite} target="_blank" rel="noopener noreferrer" className={cls}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M1.5 8h13M8 1.5c1.8 1.9 2.7 4.1 2.7 6.5S9.8 12.6 8 14.5C6.2 12.6 5.3 10.4 5.3 8S6.2 3.4 8 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
          {t('clubs.openWebsite')}
        </a>
      )}
      {query && (
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer" className={cls}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L1 5.5v7L8 15l7-2.5v-7L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            <circle cx="8" cy="8" r="1.8" fill="currentColor"/>
          </svg>
          {t('myEvents.directions')}
        </a>
      )}
    </div>
  )
}

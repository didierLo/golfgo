'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function NoEventPage() {
  const params = useParams()
  const gid = params?.id as string
  const t = useTranslations()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-5">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect x="2" y="8" width="28" height="20" rx="4" stroke="#185FA5" strokeWidth="2"/>
          <path d="M10 8V6a2 2 0 014 0v2M18 8V6a2 2 0 014 0v2" stroke="#185FA5" strokeWidth="2" strokeLinecap="round"/>
          <path d="M2 13h28" stroke="#185FA5" strokeWidth="2"/>
          <path d="M10 20h12M10 24h7" stroke="#185FA5" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
      <h2 className="text-[17px] font-bold text-slate-800 mb-2">
        Aucun événement pour l'instant
      </h2>
      <p className="text-[13px] text-slate-500 mb-6 max-w-xs leading-relaxed">
        Cette section sera disponible dès qu'un événement sera créé pour ce groupe.
      </p>

    </div>
  )
}

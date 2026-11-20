'use client'

// Bloc « Sondages en cours » affiché en haut de Mes événements. Invisible s'il n'y a aucun sondage ouvert :
// aucun onglet de menu supplémentaire n'est nécessaire.
import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type OpenPoll = { token: string; title: string; group_name: string; deadline: string | null; answered: boolean }

export default function OpenPollsBlock() {
  const t = useTranslations()
  const locale = useLocale()
  const [polls, setPolls] = useState<OpenPoll[]>([])

  useEffect(() => {
    supabase.rpc('my_open_polls').then(({ data, error }) => {
      if (!error && Array.isArray(data)) setPolls(data as OpenPoll[])
    })
  }, [])

  if (polls.length === 0) return null

  return (
    <div className="mb-6">
      <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-3">{t('polls.blockTitle')}</p>
      <div className="flex flex-col gap-2">
        {polls.map(p => (
          <a key={p.token} href={`/${locale}/poll?token=${p.token}`}
            className="flex items-center gap-3 rounded-xl border border-white/60 shadow-sm px-4 py-3 transition-colors hover:border-[#185FA5]"
            style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
            <span className="text-[22px] shrink-0">📅</span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-slate-900 truncate">{p.title}</p>
              <p className="text-[12px] text-slate-500 truncate">
                {p.group_name}
                {p.deadline && ` · ${t('polls.deadlineShort', { date: new Date(p.deadline + 'T00:00:00Z').toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }) })}`}
              </p>
            </div>
            <span className={`text-[12px] font-semibold px-3 py-1.5 rounded-full shrink-0 ${p.answered ? 'bg-[#EAF3DE] text-[#3B6D11]' : 'bg-[#185FA5] text-white'}`}>
              {p.answered ? t('polls.answeredEdit') : t('polls.answerNow')}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}

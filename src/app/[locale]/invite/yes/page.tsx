'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'

function InviteYesContent() {
  const supabase     = createClient()
  const searchParams = useSearchParams()
  const t            = useTranslations()

  type Step = 'choosing' | 'saving' | 'success' | 'error'
  const [step,        setStep]        = useState<Step>('choosing')
  const [holesPlayed, setHolesPlayed] = useState<9 | 18>(18)
  const [holesSection, setHolesSection] = useState<'out' | 'in' | null>(null)
  const [appLink,     setAppLink]     = useState<string | null>(null)

  const token       = searchParams.get('token')
  const holesParam  = searchParams.get('holes')
  const sectionParam = searchParams.get('section')

  useEffect(() => {
    if (!token) { setStep('error'); return }
    // Si les paramètres sont dans l'URL (clic depuis email), confirme directement
    if (holesParam === '18') {
      setHolesPlayed(18); setHolesSection(null)
      confirmParticipation(token, 18, null)
    } else if (holesParam === '9' && sectionParam === 'out') {
      setHolesPlayed(9); setHolesSection('out')
      confirmParticipation(token, 9, 'out')
    } else if (holesParam === '9' && sectionParam === 'in') {
      setHolesPlayed(9); setHolesSection('in')
      confirmParticipation(token, 9, 'in')
    }
    // Sinon on affiche le choix
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmParticipation(tok: string, holes: 9 | 18, section: 'out' | 'in' | null) {
    setStep('saving')

    const { data: participant } = await supabase
      .from('event_participants')
      .select('event_id, events(group_id)')
      .eq('invite_token', tok)
      .maybeSingle()

    const { error } = await supabase
      .from('event_participants')
      .update({
        status:        'GOING',
        holes_played:  holes,
        holes_section: section,
        responded_at:  new Date().toISOString(),
      })
      .eq('invite_token', tok)

    if (error) { setStep('error'); return }

    if (participant?.event_id && (participant?.events as any)?.group_id) {
      const gid = (participant.events as any).group_id
      const eid = participant.event_id
      setAppLink(`/groups/${gid}/events/${eid}`)
    }

    setHolesPlayed(holes)
    setHolesSection(section)
    setStep('success')
  }

  async function handleConfirm() {
    if (!token) { setStep('error'); return }
    await confirmParticipation(token, holesPlayed, holesSection)
  }

  function holesDisplayLabel() {
    if (holesPlayed === 9 && holesSection === 'out') return t('holes.9out')
    if (holesPlayed === 9 && holesSection === 'in')  return t('holes.9in')
    return t('holes.18')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 text-center">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-sm w-full">

        <div className="flex items-center justify-center gap-0 mb-6">
          <span className="text-[22px] font-black text-[#185FA5] tracking-tight">Golf</span>
          <span className="text-[22px] font-black tracking-tight" style={{ color: '#4CAF1A' }}>Go</span>
        </div>

        {/* Choix manuel (pas de paramètres dans l'URL) */}
        {step === 'choosing' && (
          <>
            <div className="w-14 h-14 rounded-full bg-[#EBF3FC] flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⛳</span>
            </div>
            <h1 className="text-[18px] font-black text-slate-900 mb-1">{t('inviteYes.title')}</h1>
            <p className="text-[13px] text-slate-500 mb-6">{t('inviteYes.subtitle')}</p>

            <div className="flex flex-col gap-2 mb-6">
              {/* 18 trous */}
              <button onClick={() => { setHolesPlayed(18); setHolesSection(null) }}
                className={`py-3 rounded-xl border-2 font-semibold text-[14px] transition-all ${
                  holesPlayed === 18 ? 'border-[#185FA5] bg-[#EBF3FC] text-[#185FA5]' : 'border-slate-200 text-slate-400 hover:border-slate-300'
                }`}>
                {t('holes.18')}
              </button>
              {/* 9H Front */}
              <button onClick={() => { setHolesPlayed(9); setHolesSection('out') }}
                className={`py-3 rounded-xl border-2 font-semibold text-[14px] transition-all ${
                  holesPlayed === 9 && holesSection === 'out' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-400 hover:border-slate-300'
                }`}>
                {t('holes.9out')}
              </button>
              {/* 9H Back */}
              <button onClick={() => { setHolesPlayed(9); setHolesSection('in') }}
                className={`py-3 rounded-xl border-2 font-semibold text-[14px] transition-all ${
                  holesPlayed === 9 && holesSection === 'in' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-400 hover:border-slate-300'
                }`}>
                {t('holes.9in')}
              </button>
            </div>

            <button onClick={handleConfirm}
              className="w-full bg-[#185FA5] text-white font-semibold text-[14px] py-3 rounded-xl hover:bg-[#0C447C] transition-colors">
              {t('inviteYes.confirm')}
            </button>
          </>
        )}

        {step === 'saving' && (
          <>
            <div className="w-10 h-10 border-2 border-slate-200 border-t-[#185FA5] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[14px] text-slate-500">{t('inviteYes.saving')}</p>
          </>
        )}

        {step === 'success' && (
          <>
            <div className="w-14 h-14 rounded-full bg-[#EAF3DE] flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#3B6D11" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="text-[18px] font-black text-slate-900 mb-2">{t('inviteYes.successTitle')}</h1>
            <p className="text-[13px] text-slate-600 mb-6">
              {t('inviteYes.successDesc', { holes: holesDisplayLabel() })}
            </p>
            {appLink && (
              <a href={appLink}
                className="inline-flex items-center gap-2 bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] transition-colors">
                {t('inviteYes.viewEvent')}
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            )}
          </>
        )}

        {step === 'error' && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="#A32D2D" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <h1 className="text-[18px] font-black text-slate-900 mb-2">{t('inviteYes.errorTitle')}</h1>
            <p className="text-[13px] text-slate-600">{t('inviteYes.errorDesc')}</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function InviteYesPage() {
  return (
    <Suspense fallback={null}>
      <InviteYesContent />
    </Suspense>
  )
}

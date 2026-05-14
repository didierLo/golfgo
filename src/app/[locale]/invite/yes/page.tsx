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
  const [step,         setStep]         = useState<Step>('choosing')
  const [holesPlayed,  setHolesPlayed]  = useState<9 | 18>(18)
  const [holesSection, setHolesSection] = useState<'out' | 'in' | null>(null)
  const [appLink,      setAppLink]      = useState<string | null>(null)

  // Message optionnel
  const [message,     setMessage]     = useState('')
  const [msgSaving,   setMsgSaving]   = useState(false)
  const [msgSaved,    setMsgSaved]    = useState(false)

  const token        = searchParams.get('token')
  const holesParam   = searchParams.get('holes')
  const sectionParam = searchParams.get('section')

  useEffect(() => {
    if (!token) { setStep('error'); return }
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
      setAppLink(`/groups/${(participant.events as any).group_id}/events/${participant.event_id}`)
    }

    setHolesPlayed(holes)
    setHolesSection(section)
    setStep('success')
  }

  async function handleConfirm() {
    if (!token) { setStep('error'); return }
    await confirmParticipation(token, holesPlayed, holesSection)
  }

  async function handleSendMessage() {
    if (!token || !message.trim()) return
    setMsgSaving(true)
    await fetch('/api/invite/message', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token, message: message.slice(0, 300) }),
    })
    setMsgSaved(true)
    setMsgSaving(false)
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

        {/* Choix manuel */}
        {step === 'choosing' && (
          <>
            <div className="w-14 h-14 rounded-full bg-[#EBF3FC] flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⛳</span>
            </div>
            <h1 className="text-[18px] font-black text-slate-900 mb-1">{t('inviteYes.title')}</h1>
            <p className="text-[13px] text-slate-500 mb-6">{t('inviteYes.subtitle')}</p>

            <div className="flex flex-col gap-2 mb-6">
              <button onClick={() => { setHolesPlayed(18); setHolesSection(null) }}
                className={`py-3 rounded-xl border-2 font-semibold text-[14px] transition-all ${
                  holesPlayed === 18 ? 'border-[#185FA5] bg-[#EBF3FC] text-[#185FA5]' : 'border-slate-200 text-slate-400 hover:border-slate-300'
                }`}>
                {t('holes.18')}
              </button>
              <button onClick={() => { setHolesPlayed(9); setHolesSection('out') }}
                className={`py-3 rounded-xl border-2 font-semibold text-[14px] transition-all ${
                  holesPlayed === 9 && holesSection === 'out' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-400 hover:border-slate-300'
                }`}>
                {t('holes.9out')}
              </button>
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

            {/* ── Bloc message ── */}
            <div className="border-t border-slate-100 pt-5 mb-5 text-left">
              <p className="text-[13px] font-semibold text-slate-700 mb-0.5">
                Un message pour l'organisateur ?
                <span className="font-normal text-slate-400 ml-1">(optionnel)</span>
              </p>
              <p className="text-[11px] text-slate-400 mb-3">Max 3 lignes · visible uniquement par l'admin</p>

              {msgSaved ? (
                <div className="flex items-center gap-2 justify-center py-3 bg-[#EAF3DE] rounded-xl">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="#3B6D11" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-[13px] font-semibold text-[#3B6D11]">Message transmis ✓</span>
                </div>
              ) : (
                <>
                  <textarea
                    value={message}
                    onChange={e => {
                      const lines = e.target.value.split('\n')
                      if (lines.length <= 3) setMessage(e.target.value)
                    }}
                    maxLength={300}
                    rows={3}
                    placeholder="Ex : Je serai là vers 9h, prévenez-moi si changement…"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 resize-none mb-2"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">{message.length}/300</span>
                    <button
                      onClick={handleSendMessage}
                      disabled={!message.trim() || msgSaving}
                      className="text-[12px] font-semibold px-4 py-2 rounded-xl bg-[#185FA5] text-white hover:bg-[#0C447C] disabled:opacity-40 transition-colors"
                    >
                      {msgSaving ? 'Envoi…' : 'Envoyer'}
                    </button>
                  </div>
                </>
              )}
            </div>

         <div className="border-t border-slate-100 pt-4 flex flex-col items-center gap-3">
              <p className="text-[12px] text-slate-400 text-center">
                Tu peux fermer cette page ou te connecter pour voir l'événement.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.location.href = '/login'}
                  className="text-[13px] font-semibold px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                  Fermer
                </button>
                <a href="/login"
                  className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#185FA5] hover:text-[#0C447C] transition-colors">
                  {t('inviteYes.viewEvent')}
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              </div>
            </div>
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

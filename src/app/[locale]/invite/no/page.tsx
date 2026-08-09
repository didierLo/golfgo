'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'


 const supabase     = createClient()
function InviteNoContent() {
  const supabase     = createClient()
  const searchParams = useSearchParams()
  const t            = useTranslations()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  // Activité annexe optionnelle
  const [extraActivityLabel, setExtraActivityLabel]       = useState<string | null>(null)
  const [extraActivityResponse, setExtraActivityResponse] = useState<boolean | null>(null)
  const [extraSaving, setExtraSaving] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => { handleDecline() }, [])

  async function handleDecline() {
    const tok = searchParams.get('token')
    if (!tok) { setStatus('error'); return }
    setToken(tok)

    const [{ data: participant }, { error }] = await Promise.all([
      supabase.from('event_participants')
        .select('extra_activity_response, events(extra_activity_label)')
        .eq('invite_token', tok).maybeSingle(),
      supabase.from('event_participants')
        .update({ status: 'DECLINED', responded_at: new Date().toISOString() })
        .eq('invite_token', tok),
    ])

    setExtraActivityLabel((participant?.events as any)?.extra_activity_label ?? null)
    setExtraActivityResponse(participant?.extra_activity_response ?? null)

    setStatus(error ? 'error' : 'success')
  }

  async function handleExtraActivity(response: boolean) {
    if (!token) return
    setExtraSaving(true)
    await supabase.from('event_participants')
      .update({ extra_activity_response: response })
      .eq('invite_token', token)
    setExtraActivityResponse(response)
    setExtraSaving(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 text-center">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-sm w-full">

        <div className="flex items-center justify-center gap-0 mb-6">
          <span className="text-[22px] font-black text-[#185FA5] tracking-tight">Golf</span>
          <span className="text-[22px] font-black tracking-tight" style={{ color: '#4CAF1A' }}>Go</span>
        </div>

        {status === 'loading' && (
          <>
            <div className="w-10 h-10 border-2 border-slate-200 border-t-[#185FA5] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[14px] text-slate-500">{t('inviteNo.loading')}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-full bg-[#FCEBEB] flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="#A32D2D" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <h1 className="text-[18px] font-black text-slate-900 mb-2">{t('inviteNo.successTitle')}</h1>
            <p className="text-[13px] text-slate-600">{t('inviteNo.successDesc')}</p>

            {/* ── Bloc activité annexe — même en cas de forfait golf ── */}
            {extraActivityLabel && (
              <div className="border-t border-slate-100 pt-5 mt-5 text-left">
                <p className="text-[13px] font-semibold text-slate-700 mb-3">
                  🍽️ Participes-tu quand même à : {extraActivityLabel} ?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExtraActivity(true)}
                    disabled={extraSaving}
                    className={`flex-1 py-2.5 rounded-xl border-2 font-semibold text-[13px] transition-all disabled:opacity-50 ${
                      extraActivityResponse === true ? 'border-[#3B6D11] bg-[#EAF3DE] text-[#3B6D11]' : 'border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}>
                    Oui
                  </button>
                  <button
                    onClick={() => handleExtraActivity(false)}
                    disabled={extraSaving}
                    className={`flex-1 py-2.5 rounded-xl border-2 font-semibold text-[13px] transition-all disabled:opacity-50 ${
                      extraActivityResponse === false ? 'border-[#A32D2D] bg-[#FCEBEB] text-[#A32D2D]' : 'border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}>
                    Non
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#94A3B8" strokeWidth="2"/>
                <path d="M12 8v4M12 16v.5" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h1 className="text-[18px] font-black text-slate-900 mb-2">{t('inviteNo.errorTitle')}</h1>
            <p className="text-[13px] text-slate-600">{t('inviteNo.errorDesc')}</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function InviteNoPage() {
  return (
    <Suspense fallback={null}>
      <InviteNoContent />
    </Suspense>
  )
}
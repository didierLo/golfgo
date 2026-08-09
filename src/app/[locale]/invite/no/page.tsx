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

  // Message optionnel
  const [message,   setMessage]   = useState('')
  const [msgSaving, setMsgSaving] = useState(false)
  const [msgSaved,  setMsgSaved]  = useState(false)

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
            <p className="text-[13px] text-slate-600 mb-2">{t('inviteNo.successDesc')}</p>

            {/* ── Bloc activité annexe — même en cas de forfait golf ── */}
            {extraActivityLabel && (
              <div className="border-t border-slate-100 pt-5 mt-4 mb-5 text-left">
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

            {/* ── Bloc message ── */}
            <div className="border-t border-slate-100 pt-5 text-left">
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
                    placeholder="Ex : Je viendrai peut-être au repas malgré tout…"
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
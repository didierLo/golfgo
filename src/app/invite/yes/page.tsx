'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function InviteYesContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => { handleAccept() }, [])

  async function handleAccept() {
    const token = searchParams.get('token')
    if (!token) { setStatus('error'); return }

    const { error } = await supabase
      .from('event_participants')
      .update({ status: 'GOING', responded_at: new Date().toISOString() })
      .eq('invite_token', token)

    setStatus(error ? 'error' : 'success')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 text-center">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-sm w-full">
        {/* Logo */}
        <div className="flex items-center justify-center gap-0 mb-6">
          <span className="text-[22px] font-black text-[#185FA5] tracking-tight">Golf</span>
          <span className="text-[22px] font-black tracking-tight" style={{ color: '#4CAF1A' }}>Go</span>
        </div>

        {status === 'loading' && (
          <>
            <div className="w-10 h-10 border-2 border-slate-200 border-t-[#185FA5] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[14px] text-slate-500">Confirmation en cours…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-14 h-14 rounded-full bg-[#EAF3DE] flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#3B6D11" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="text-[18px] font-black text-slate-900 mb-2">Participation confirmée !</h1>
            <p className="text-[13px] text-slate-600">Tu es inscrit(e) à l'événement. À bientôt sur le parcours ⛳</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="#A32D2D" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <h1 className="text-[18px] font-black text-slate-900 mb-2">Lien invalide</h1>
            <p className="text-[13px] text-slate-600">Ce lien est expiré ou invalide. Contacte l'organisateur.</p>
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

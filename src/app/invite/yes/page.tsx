'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function InviteYesContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()

  type Step = 'choosing' | 'saving' | 'success' | 'error'
  const [step,        setStep]        = useState<Step>('choosing')
  const [holesPlayed, setHolesPlayed] = useState<9 | 18>(18)

  const token = searchParams.get('token')
  // Si ?holes=9 dans l'URL (venu de l'email), on pré-sélectionne et on confirme directement
  const holesParam = searchParams.get('holes')

  useEffect(() => {
    if (!token) { setStep('error'); return }
    if (holesParam === '9' || holesParam === '18') {
      const h = holesParam === '9' ? 9 : 18
      setHolesPlayed(h)
      // Confirme directement sans afficher l'écran de choix
      handleConfirmWith(h)
    }
  }, [token, holesParam])

  async function handleConfirmWith(holes: 9 | 18) {
    if (!token) { setStep('error'); return }
    setStep('saving')
    const { error } = await supabase
      .from('event_participants')
      .update({
        status:       'GOING',
        holes_played: holes,
        responded_at: new Date().toISOString(),
      })
      .eq('invite_token', token)
    setStep(error ? 'error' : 'success')
  }

  async function handleConfirm() {
    handleConfirmWith(holesPlayed)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 text-center">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-sm w-full">

        {/* Logo */}
        <div className="flex items-center justify-center gap-0 mb-6">
          <span className="text-[22px] font-black text-[#185FA5] tracking-tight">Golf</span>
          <span className="text-[22px] font-black tracking-tight" style={{ color: '#4CAF1A' }}>Go</span>
        </div>

        {/* ── Choix trous (pas de param holes dans l'URL) ── */}
        {step === 'choosing' && (
          <>
            <div className="w-14 h-14 rounded-full bg-[#EBF3FC] flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⛳</span>
            </div>
            <h1 className="text-[18px] font-black text-slate-900 mb-1">Tu participes !</h1>
            <p className="text-[13px] text-slate-500 mb-6">Combien de trous vas-tu jouer ?</p>

            <div className="flex gap-3 mb-6">
              {([18, 9] as const).map(n => (
                <button key={n} onClick={() => setHolesPlayed(n)}
                  className={`flex-1 py-4 rounded-xl border-2 font-black text-[22px] transition-all ${
                    holesPlayed === n
                      ? 'border-[#185FA5] bg-[#EBF3FC] text-[#185FA5]'
                      : 'border-slate-200 text-slate-400 hover:border-slate-300'
                  }`}>
                  {n}
                  <span className="block text-[11px] font-semibold mt-0.5">trous</span>
                </button>
              ))}
            </div>

            <button onClick={handleConfirm}
              className="w-full bg-[#185FA5] text-white font-semibold text-[14px] py-3 rounded-xl hover:bg-[#0C447C] transition-colors">
              Confirmer ma participation
            </button>
          </>
        )}

        {/* ── Sauvegarde ── */}
        {step === 'saving' && (
          <>
            <div className="w-10 h-10 border-2 border-slate-200 border-t-[#185FA5] rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[14px] text-slate-500">Confirmation en cours…</p>
          </>
        )}

        {/* ── Succès ── */}
        {step === 'success' && (
          <>
            <div className="w-14 h-14 rounded-full bg-[#EAF3DE] flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#3B6D11" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="text-[18px] font-black text-slate-900 mb-2">Participation confirmée !</h1>
            <p className="text-[13px] text-slate-600">
              Tu joues <strong>{holesPlayed} trous</strong>. À bientôt sur le parcours ⛳
            </p>
          </>
        )}

        {/* ── Erreur ── */}
        {step === 'error' && (
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

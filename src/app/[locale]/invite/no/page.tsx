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

  // 'confirming' = écran d'attente du clic explicite avant d'écrire DECLINED
  const [status, setStatus] = useState<'confirming' | 'loading' | 'success' | 'error'>('confirming')

  // Activité annexe optionnelle
  const [extraActivityLabel, setExtraActivityLabel] = useState<string | null>(null)
  const [extraActivityCount, setExtraActivityCount] = useState<number | null>(null)
  const [extraDraft,  setExtraDraft]  = useState(0)
  const [extraEditing, setExtraEditing] = useState(true)
  const [extraSaving, setExtraSaving] = useState(false)
  const [extraError,  setExtraError]  = useState(false)
  const [token, setToken] = useState<string | null>(null)

  // Message optionnel
  const [message,   setMessage]   = useState('')
  const [msgSaving, setMsgSaving] = useState(false)
  const [msgSaved,  setMsgSaved]  = useState(false)

  // IMPORTANT : ce useEffect ne fait plus AUCUNE écriture en base — il se
  // contente de récupérer le token depuis l'URL. L'écriture (handleDecline)
  // n'est déclenchée que par un clic explicite sur le bouton "Confirmer mon
  // forfait", pour ne pas être exécutée automatiquement par un scanner de
  // liens (Safe Links, antivirus d'entreprise, aperçu de lien, etc.) qui
  // ouvrirait la page sans intervention réelle du joueur.
  useEffect(() => {
    const tok = searchParams.get('token')
    if (!tok) { setStatus('error'); return }
    setToken(tok)
    setStatus('confirming')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDecline() {
    if (!token) { setStatus('error'); return }
    setStatus('loading')

    const [{ data: participant }, { error }] = await Promise.all([
      supabase.from('event_participants')
        .select('extra_activity_count, events(extra_activity_label)')
        .eq('invite_token', token).maybeSingle(),
      supabase.from('event_participants')
        .update({ status: 'DECLINED', responded_at: new Date().toISOString() })
        .eq('invite_token', token),
    ])

    setExtraActivityLabel((participant?.events as any)?.extra_activity_label ?? null)
    setExtraActivityCount(participant?.extra_activity_count ?? null)
    setExtraDraft(participant?.extra_activity_count ?? 1)
    setExtraEditing(participant?.extra_activity_count == null)

    setStatus(error ? 'error' : 'success')
  }

  async function saveExtraActivity(count: number) {
    if (!token) return
    setExtraSaving(true)
    setExtraError(false)
    const { error } = await supabase.from('event_participants')
      .update({ extra_activity_count: count })
      .eq('invite_token', token)
    if (error) {
      setExtraError(true)
      setExtraSaving(false)
      return
    }
    setExtraActivityCount(count)
    setExtraEditing(false)
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

        {status === 'confirming' && (
          <>
            <div className="w-14 h-14 rounded-full bg-[#FCEBEB] flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🙁</span>
            </div>
            <h1 className="text-[18px] font-black text-slate-900 mb-1">{t('inviteNo.confirmingTitle')}</h1>
            <p className="text-[13px] text-slate-500 mb-6">
              {t('inviteNo.confirmingSubtitle')}
            </p>

            <button onClick={handleDecline}
              className="w-full bg-[#A32D2D] text-white font-semibold text-[14px] py-3 rounded-xl hover:bg-[#8A2424] transition-colors">
              {t('inviteNo.confirmButton')}
            </button>
          </>
        )}

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
                  🍽️ Combien serez-vous (toi compris) pour : {extraActivityLabel} ?
                </p>

                {extraEditing ? (
                  <>
                    <div className="flex items-center justify-center gap-4 mb-3">
                      <button
                        type="button"
                        onClick={() => setExtraDraft(d => Math.max(0, d - 1))}
                        disabled={extraSaving}
                        className="w-10 h-10 rounded-xl border-2 border-slate-200 text-slate-500 text-[18px] font-bold hover:border-slate-300 disabled:opacity-50 transition-colors">
                        −
                      </button>
                      <span className="text-[22px] font-black text-slate-900 w-10 text-center">{extraDraft}</span>
                      <button
                        type="button"
                        onClick={() => setExtraDraft(d => Math.min(20, d + 1))}
                        disabled={extraSaving}
                        className="w-10 h-10 rounded-xl border-2 border-slate-200 text-slate-500 text-[18px] font-bold hover:border-slate-300 disabled:opacity-50 transition-colors">
                        +
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 text-center mb-3">
                      0 = personne, sinon indique le nombre total
                    </p>
                    <button
                      type="button"
                      onClick={() => saveExtraActivity(extraDraft)}
                      disabled={extraSaving}
                      className="w-full bg-[#185FA5] text-white font-semibold text-[13px] py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
                      {extraSaving ? 'Enregistrement…' : 'Confirmer'}
                    </button>
                  </>
                ) : (
                  <div className="flex items-center justify-between bg-[#EAF3DE] rounded-xl px-4 py-3">
                    <span className="text-[13px] font-semibold text-[#3B6D11]">
                      ✓ {extraActivityCount} personne{(extraActivityCount ?? 0) > 1 ? 's' : ''} inscrite{(extraActivityCount ?? 0) > 1 ? 's' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setExtraDraft(extraActivityCount ?? 1); setExtraEditing(true) }}
                      className="text-[12px] font-semibold text-[#3B6D11] underline underline-offset-2">
                      Modifier
                    </button>
                  </div>
                )}

                {!extraEditing && extraError && (
                  <p className="text-[12px] text-[#A32D2D] mt-2">⚠ Non enregistré, réessaie</p>
                )}
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

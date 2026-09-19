'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

type Props = {
  onClose: () => void
  onConfirm: () => void
  confirmLabel?: string
  loading?: boolean
  fetchPreview: () => Promise<{ html: string; subject: string }>
}

export default function EmailPreviewModal({ onClose, onConfirm, confirmLabel, loading = false, fetchPreview }: Props) {
  const t = useTranslations()
  const [html,    setHtml]    = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [error,   setError]   = useState('')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    fetchPreview()
      .then(({ html, subject }) => { setHtml(html); setSubject(subject) })
      .catch(e => setError(e.message ?? t('communications.emailPreview.error')))
  }, [])

  useEffect(() => {
    if (html && iframeRef.current) {
      const doc = iframeRef.current.contentDocument
      if (doc) { doc.open(); doc.write(html); doc.close() }
    }
  }, [html])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-2xl max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <p className="text-[15px] font-black text-slate-900">{t('communications.emailPreview.title')}</p>
            {subject && <p className="text-[12px] text-slate-500 mt-0.5">{t('communications.emailPreview.subject')} <span className="font-semibold text-slate-700">{subject}</span></p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-hidden bg-slate-50 relative min-h-0">
          {!html && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-[#185FA5] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {error && (
            <div className="p-6 text-[13px] text-red-600 bg-red-50">{error}</div>
          )}
          {html && (
            <iframe
              ref={iframeRef}
              className="w-full h-full border-0"
              style={{ minHeight: '500px' }}
              sandbox="allow-same-origin"
              title={t('communications.emailPreview.title')}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-white rounded-b-2xl">
          <p className="text-[11px] text-slate-400">{t('communications.emailPreview.disclaimer')}</p>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="text-[13px] font-semibold px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
              {t('nav.cancel')}
            </button>
            <button onClick={onConfirm} disabled={loading}
              className="text-[13px] font-semibold px-5 py-2 rounded-xl bg-[#185FA5] text-white hover:bg-[#0C447C] disabled:opacity-50 transition-colors flex items-center gap-2">
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {loading ? t('communications.message.sending') : (confirmLabel ?? t('communications.message.send'))}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

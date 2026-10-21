'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'

export type Template = {
  template_logo_url:           string | null
  template_invitation_subject: string | null
  template_invitation_body:    string | null
  template_teesheet_subject:   string | null
  template_teesheet_body:      string | null
  template_reminder_subject:   string | null
  template_reminder_body:      string | null
  template_newmember_subject:  string | null
  template_newmember_body:     string | null
}

type Props = {
  groupId: string
  saving: boolean
  onSaveTemplate: () => void
  onReset: () => void
}

export default function CommSettingsPanel({ groupId, saving, onSaveTemplate, onReset }: Props) {
  const t      = useTranslations()
  const locale = useLocale()

  return (
    <div className="rounded-xl border border-white/60 shadow-sm p-5 mb-6" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">{t('communications.settings.title')}</p>

      {/* Le logo se gère désormais avec l'image de fond, dans les paramètres du groupe */}
      <div className="mb-5">
        <p className="text-[12px] text-slate-600">{t('communications.settings.logoMoved')}</p>
        <Link href={`/${locale}/groups/${groupId}/edit`} className="inline-block mt-1.5 text-[12px] font-semibold text-[#185FA5] hover:underline">
          {t('communications.settings.logoMovedLink')}
        </Link>
      </div>

      <div className="flex items-center justify-between mt-5 gap-3">
        <button onClick={onReset} className="text-[12px] font-semibold px-4 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
          {t('communications.templates.reset')}
        </button>
        <button onClick={onSaveTemplate} disabled={saving}
          className="bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] disabled:opacity-50 transition-colors">
          {saving ? t('communications.templates.saving') : t('communications.templates.save')}
        </button>
      </div>
    </div>
  )
}

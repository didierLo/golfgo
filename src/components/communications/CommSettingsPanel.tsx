'use client'

import { useRef } from 'react'
import { useTranslations } from 'next-intl'

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
  groupTemplate: Template
  setGroupTemplate: React.Dispatch<React.SetStateAction<Template>>
  saving: boolean
  uploading: boolean
  onSaveTemplate: () => void
  onReset: () => void
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function CommSettingsPanel({
  groupTemplate, setGroupTemplate, saving, uploading,
  onSaveTemplate, onReset, onLogoUpload,
}: Props) {
  const t = useTranslations()
  const fileInputRef   = useRef<HTMLInputElement>(null)

  return (
    <div className="rounded-xl border border-white/60 shadow-sm p-5 mb-6" style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">{t('communications.settings.visualIdentity')}</p>
      <p className="text-[11px] text-slate-400 mb-4">{t('communications.settings.visualDesc')}</p>

      <div className="mb-5">
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-2">{t('communications.templates.headerLogo')}</label>
          {groupTemplate.template_logo_url ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={groupTemplate.template_logo_url} alt="Logo" className="h-12 object-contain border border-white/50 rounded-xl p-1 bg-white/30" />
              <div className="flex flex-col gap-1">
                <button onClick={() => fileInputRef.current?.click()} className="text-[11px] font-semibold text-[#185FA5] hover:underline">{t('communications.templates.changeLogo')}</button>
                <button onClick={() => setGroupTemplate(prev => ({ ...prev, template_logo_url: null }))} className="text-[11px] font-semibold text-red-500 hover:underline">{t('communications.templates.deleteLogo')}</button>
              </div>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="w-full border border-dashed border-slate-300 rounded-xl py-4 text-[12px] font-medium text-slate-400 hover:border-[#185FA5] hover:text-[#185FA5] transition-colors">
              {uploading ? t('communications.templates.uploading') : t('communications.templates.addLogo')}
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onLogoUpload} />
        </div>
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
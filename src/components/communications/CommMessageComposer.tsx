'use client'

import { useTranslations, useLocale } from 'next-intl'

type Member = { id: string; first_name: string; surname: string; email: string | null; role: string }
type EventRow = { id: string; title: string; starts_at: string }
type MessageType = 'invitation' | 'reminder' | 'teesheet' | 'newmember' | 'scorecards' | 'free'

const inputClass    = "w-full border border-white/60 rounded-xl px-3 py-2.5 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 focus:border-[#185FA5] bg-white/70 backdrop-blur-sm"
const textareaClass = `${inputClass} resize-none`
const selectClass   = "border border-slate-200 rounded-xl px-3 py-2 text-[12px] bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30"

const COMM_VARS = [
  { key: '{{first_name}}', label: 'Prénom' },
  { key: '{{surname}}', label: 'Nom' },
  { key: '{{player_name}}', label: 'Prénom + Nom' },
  { key: '{{group_name}}', label: 'Groupe' },
  { key: '{{owner_name}}', label: 'Signature' },
  { key: '{{event_title}}', label: 'Titre event' },
  { key: '{{event_date}}', label: 'Date event' },
  { key: '{{event_time}}', label: 'Heure event' },
  { key: '{{yes_button}}', label: '✓/✗ Boutons réponse' },
  { key: '{{places_restantes}}', label: 'Places restantes' },
  { key: '{{app_url}}',          label: 'URL app' },
  { key: '{{qr_code}}',          label: 'QR Code' },
  { key: '{{install_iphone}}',   label: 'Instructions iPhone' },
  { key: '{{install_android}}',  label: 'Instructions Android' },
]

function formatDate(d: string, locale: string) {
  return new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

type Props = {
  messageTypes: { id: MessageType; label: string }[]
  messageType: MessageType
  setMessageType: (type: MessageType) => void
  events: EventRow[]
  selectedEventId: string
  onSelectedEventChange: (eventId: string) => void
  commSubject: string
  setCommSubject: (v: string) => void
  commBody: string
  setCommBody: (v: string) => void
  isOwner: boolean
  selectedMembers: Member[]
  preview: boolean
  setPreview: (v: boolean) => void
  applyPreviewVars: (text: string) => string
}

export default function CommMessageComposer({
  messageTypes, messageType, setMessageType,
  events, selectedEventId, onSelectedEventChange,
  commSubject, setCommSubject, commBody, setCommBody,
  isOwner, selectedMembers, preview, setPreview, applyPreviewVars,
}: Props) {
  const t      = useTranslations()
  const locale = useLocale()

  const hasMsg = !!commSubject && !!commBody

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-[13px] font-bold text-slate-800 mb-3">{t('communications.message.title')}</p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {messageTypes.map(type => (
            <button key={type.id} onClick={() => setMessageType(type.id)}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-xl border transition-colors ${messageType === type.id ? 'bg-[#185FA5] border-[#185FA5] text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {type.label}
            </button>
          ))}
        </div>

        <div className="mb-3">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{t('communications.message.event')}</label>
          <select value={selectedEventId} onChange={e => onSelectedEventChange(e.target.value)} className={`${selectClass} w-full`}>
            {events.map(e => <option key={e.id} value={e.id}>{e.title} — {formatDate(e.starts_at, locale)}</option>)}
          </select>
        </div>

        <div className="mb-3">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{t('communications.message.subject')}</label>
          <input type="text" value={commSubject} onChange={e => setCommSubject(e.target.value)}
            readOnly={!isOwner} placeholder={t('communications.message.subjectPlaceholder')} className={inputClass} />
        </div>

        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-400">{t('communications.message.insert')}</span>
          {COMM_VARS.map(v => (
            <button key={v.key} onClick={() => setCommBody(commBody + v.key)}
              className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">{v.key}</button>
          ))}
        </div>

        <div className="mb-3">
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">{t('communications.message.body')}</label>
          <textarea value={commBody} onChange={e => setCommBody(e.target.value)} rows={10}
            readOnly={!isOwner} placeholder={t('communications.message.bodyPlaceholder')}
            className={`${textareaClass} font-mono leading-relaxed`} />
        </div>

        {messageType !== 'free' && (
          <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-[11px] text-amber-700">
              {t('communications.msgTypes.templateWarning')}
            </p>
          </div>
        )}

        {selectedMembers.length > 0 && (commSubject || commBody) && (
          <div>
            <button onClick={() => setPreview(!preview)} className="text-[12px] font-semibold text-[#185FA5] hover:underline mb-2">
              {preview
                ? t('communications.message.hidePreview')
                : t('communications.message.showPreview', { name: selectedMembers[0].first_name })}
            </button>
            {preview && (
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 text-[13px] text-slate-700 leading-relaxed">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                  {t('communications.message.subject')} : {applyPreviewVars(commSubject)}
                </p>
                <div className="whitespace-pre-wrap">{applyPreviewVars(commBody)}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
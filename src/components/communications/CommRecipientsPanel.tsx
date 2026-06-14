'use client'

import { useTranslations } from 'next-intl'

type Member = { id: string; first_name: string; surname: string; email: string | null; role: string }
type EventRow = { id: string; title: string; starts_at: string }
type ParticipantStatus = 'GOING' | 'INVITED' | 'DECLINED' | 'WAITLIST'

const selectClass = "border border-slate-200 rounded-xl px-3 py-2 text-[12px] bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30"

type Props = {
  membersWithEmail: Member[]
  selectedIds: Set<string>
  toggleMember: (id: string) => void
  selectAll: () => void
  selectNone: () => void
  filterMode: 'all' | 'event' | 'role'
  setFilterMode: (mode: 'all' | 'event' | 'role') => void
  filterEventId: string
  onFilterEventChange: (eventId: string) => void
  filterStatus: ParticipantStatus
  setFilterStatus: (status: ParticipantStatus) => void
  events: EventRow[]
  applyEventFilter: () => void
  setSelectedIds: (ids: Set<string>) => void
}

export default function CommRecipientsPanel({
  membersWithEmail, selectedIds, toggleMember, selectAll, selectNone,
  filterMode, setFilterMode, filterEventId, onFilterEventChange,
  filterStatus, setFilterStatus, events, applyEventFilter, setSelectedIds,
}: Props) {
  const t = useTranslations()

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <p className="text-[13px] font-bold text-slate-800">
          {t('communications.recipients.title')}
          {selectedIds.size > 0 && (
            <span className="ml-2 text-[11px] font-semibold text-white bg-[#185FA5] px-2 py-0.5 rounded-full">
              {t('communications.recipients.selected', { count: selectedIds.size })}
            </span>
          )}
        </p>
        <div className="flex gap-1">
          <button onClick={selectAll}  className="text-[11px] font-semibold text-[#185FA5] hover:underline px-2 py-1">{t('communications.recipients.all')}</button>
          <button onClick={selectNone} className="text-[11px] font-semibold text-slate-400 hover:underline px-2 py-1">{t('communications.recipients.none')}</button>
        </div>
      </div>
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-2 items-end">
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          {(['all', 'event', 'role'] as const).map(mode => (
            <button key={mode} onClick={() => setFilterMode(mode)}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${filterMode === mode ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {mode === 'all' ? t('communications.recipients.filter.all') : mode === 'event' ? t('communications.recipients.filter.byEvent') : t('communications.recipients.filter.byRole')}
            </button>
          ))}
        </div>
        {filterMode === 'event' && (<>
          <select value={filterEventId} onChange={e => onFilterEventChange(e.target.value)} className={selectClass}>
            <option value="">{t('communications.recipients.chooseEvent')}</option>
            {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as ParticipantStatus)} className={selectClass}>
            <option value="GOING">{t('communications.status.GOING')}</option>
            <option value="INVITED">{t('communications.status.INVITED')}</option>
            <option value="DECLINED">{t('communications.status.DECLINED')}</option>
            <option value="WAITLIST">{t('communications.status.WAITLIST')}</option>
          </select>
          <button onClick={applyEventFilter} disabled={!filterEventId}
            className="text-[12px] font-semibold px-3 py-2 rounded-xl bg-[#185FA5] text-white hover:bg-[#0C447C] disabled:opacity-40 transition-colors">
            {t('communications.recipients.apply')}
          </button>
        </>)}
        {filterMode === 'role' && (
          <div className="flex gap-2">
            <button onClick={() => setSelectedIds(new Set(membersWithEmail.filter(m => m.role === 'owner').map(m => m.id)))} className="text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-[#B5D4F4] bg-[#EBF3FC] text-[#185FA5] hover:bg-blue-100 transition-colors">{t('communications.recipients.roles.admins')}</button>
            <button onClick={() => setSelectedIds(new Set(membersWithEmail.filter(m => m.role !== 'owner' && m.role !== 'guest').map(m => m.id)))} className="text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">{t('communications.recipients.roles.members')}</button>
            <button onClick={() => setSelectedIds(new Set(membersWithEmail.filter(m => m.role === 'guest').map(m => m.id)))} className="text-[11px] font-semibold px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">{t('communications.recipients.roles.visitors')}</button>
          </div>
        )}
      </div>
      <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
        {membersWithEmail.map(member => {
          const hasEmail = !!member.email; const isSelected = selectedIds.has(member.id)
          return (
            <label key={member.id} className={`flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors ${!hasEmail ? 'opacity-40 cursor-not-allowed' : isSelected ? 'bg-[#EBF3FC]/50' : 'hover:bg-slate-50'}`}>
              <input type="checkbox" checked={isSelected} disabled={!hasEmail} onChange={() => hasEmail && toggleMember(member.id)} className="rounded border-slate-300 text-[#185FA5] focus:ring-[#185FA5]/30" />
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                style={{ background: member.role === 'guest' ? '#FEF3C7' : '#EBF3FC', color: member.role === 'guest' ? '#92400E' : '#0C447C' }}>
                {member.first_name[0]}{member.surname[0]}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[13px] font-semibold text-slate-800">{member.first_name} {member.surname}</span>
                {member.email
                  ? <span className="text-[11px] text-slate-400 ml-2">{member.email}</span>
                  : <span className="text-[11px] text-red-400 ml-2">{t('communications.recipients.noEmail')}</span>}
              </div>
              {member.role === 'owner' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EBF3FC] text-[#185FA5]">{t('nav.admin')}</span>}
              {member.role === 'guest' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E]">{t('communications.recipients.roles.visitors')}</span>}
            </label>
          )
        })}
      </div>
    </div>
  )
}

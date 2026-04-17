'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import { useState } from 'react'

type Props = { events: any[] }

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  GOING:    { label: 'Confirmé', bg: '#EAF3DE', text: '#3B6D11', dot: '#5A9E1F' },
  INVITED:  { label: 'Invité',   bg: '#EBF3FC', text: '#0C447C', dot: '#185FA5' },
  DECLINED: { label: 'Décliné',  bg: '#FCEBEB', text: '#A32D2D', dot: '#D85A5A' },
  WAITLIST: { label: 'Attente',  bg: '#FAEEDA', text: '#854F0B', dot: '#EF9F27' },
}

export default function CalendarView({ events }: Props) {
  const [filter, setFilter] = useState<'ALL' | 'MY'>('ALL')
  const visibleEvents = filter === 'MY' ? events.filter(e => e.extendedProps.player_status) : events

  return (
    <div className="p-5 sm:p-6">

      {/* Filtres */}
      <div className="flex gap-2 mb-5">
        {(['ALL', 'MY'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl border text-[13px] font-semibold transition-colors ${
              filter === f
                ? 'bg-[#185FA5] text-white border-[#185FA5]'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            }`}>
            {f === 'ALL' ? 'Tous les événements' : 'Mes événements'}
          </button>
        ))}
      </div>

      {/* Overrides CSS FullCalendar */}
      <style>{`
        .fc { font-family: inherit; }
        .fc-toolbar-title { font-size: 15px !important; font-weight: 800 !important; color: #0F172A !important; letter-spacing: -0.03em !important; }
        .fc-button-primary {
          background: white !important;
          border: 1px solid #E2E8F0 !important;
          color: #475569 !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          padding: 5px 12px !important;
          border-radius: 10px !important;
          box-shadow: none !important;
          text-transform: capitalize !important;
        }
        .fc-button-primary:hover { background: #F8FAFC !important; border-color: #CBD5E1 !important; }
        .fc-button-primary:disabled { opacity: 0.4 !important; }
        .fc-col-header-cell-cushion {
          font-size: 11px !important;
          font-weight: 700 !important;
          color: #64748B !important;
          text-transform: uppercase !important;
          letter-spacing: 0.08em !important;
          text-decoration: none !important;
        }
        .fc-daygrid-day-number {
          font-size: 12px !important;
          font-weight: 600 !important;
          color: #475569 !important;
          text-decoration: none !important;
          padding: 4px 6px !important;
        }
        .fc-day-today { background: #EBF3FC !important; }
        .fc-day-today .fc-daygrid-day-number { color: #185FA5 !important; font-weight: 800 !important; }
        .fc-daygrid-event { border-radius: 6px !important; border: none !important; margin: 1px 2px !important; }
        .fc-event-main { padding: 0 !important; }
        .fc-more-link { font-size: 11px !important; color: #185FA5 !important; font-weight: 700 !important; }
        .fc-popover { border-radius: 14px !important; border: 1px solid #E2E8F0 !important; box-shadow: 0 8px 24px rgba(0,0,0,0.10) !important; }
        .fc-popover-header { background: #F8FAFC !important; border-radius: 14px 14px 0 0 !important; font-size: 12px !important; font-weight: 700 !important; }
        .fc-scrollgrid { border-color: #E2E8F0 !important; border-radius: 14px !important; overflow: hidden; }
        .fc-scrollgrid td, .fc-scrollgrid th { border-color: #F1F5F9 !important; }
        .fc-theme-standard .fc-scrollgrid { border: 1px solid #E2E8F0 !important; }
      `}</style>

      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        events={visibleEvents}
        timeZone="UTC"
        height="auto"
        eventDisplay="block"
        dayMaxEventRows={3}
        moreLinkClick="popover"
        locale="fr"
        buttonText={{ today: "Aujourd'hui", month: 'Mois', week: 'Semaine', day: 'Jour' }}
        eventClick={(info) => {
          const e = info.event.extendedProps
          window.location.href = `/groups/${e.group_id}/events/${e.event_id}/view`
        }}
        eventContent={(info) => {
          const e = info.event.extendedProps
          const cfg = STATUS_CONFIG[e.player_status]
          const bg  = cfg ? cfg.bg  : '#F1F5F9'
          const txt = cfg ? cfg.text : '#475569'
          const dot = cfg ? cfg.dot  : '#94A3B8'
          return (
            <div style={{ backgroundColor: bg, borderLeft: `3px solid ${dot}`, padding: '3px 6px', borderRadius: '5px', cursor: 'pointer' }}
              className="w-full overflow-hidden">
              <div style={{ color: txt, fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {info.event.title}
              </div>
              {e.location && (
                <div style={{ color: txt, fontSize: '10px', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {e.location}
                </div>
              )}
            </div>
          )
        }}
      />
    </div>
  )
}

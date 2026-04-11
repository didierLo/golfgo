'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import { useState } from 'react'

type Props = { events: any[] }

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  GOING:    { label: 'Confirmé',   bg: '#EAF3DE', text: '#3B6D11', dot: '#5A9E1F' },
  INVITED:  { label: 'Invité',     bg: '#EEEDFE', text: '#3C3489', dot: '#7F77DD' },
  DECLINED: { label: 'Décliné',    bg: '#FCEBEB', text: '#A32D2D', dot: '#D85A5A' },
  WAITLIST: { label: 'Attente',    bg: '#FAEEDA', text: '#854F0B', dot: '#EF9F27' },
}

export default function CalendarView({ events }: Props) {
  const [filter, setFilter] = useState<'ALL' | 'MY'>('ALL')

  const visibleEvents =
    filter === 'MY' ? events.filter(e => e.extendedProps.player_status) : events

  return (
    <div className="p-6">

      {/* Filtres */}
      <div className="flex gap-2 mb-5">
        {(['ALL', 'MY'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={filter === f ? { backgroundColor: '#185FA5', color: 'white', borderColor: '#185FA5' } : {}}
            className="px-3 py-1.5 rounded-md border border-gray-200 text-[13px] font-medium text-gray-600 hover:border-gray-300 transition-colors"
          >
            {f === 'ALL' ? 'Tous les événements' : 'Mes événements'}
          </button>
        ))}
      </div>

      {/* Overrides CSS FullCalendar */}
      <style>{`
        .fc { font-family: inherit; }
        .fc-toolbar-title { font-size: 15px !important; font-weight: 600 !important; color: #111827 !important; }
        .fc-button-primary {
          background: white !important;
          border: 1px solid #E5E7EB !important;
          color: #374151 !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          padding: 5px 10px !important;
          border-radius: 6px !important;
          box-shadow: none !important;
          text-transform: capitalize !important;
        }
        .fc-button-primary:hover { background: #F9FAFB !important; }
        .fc-button-primary:disabled { opacity: 0.4 !important; }
        .fc-col-header-cell-cushion {
          font-size: 11px !important;
          font-weight: 600 !important;
          color: #6B7280 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          text-decoration: none !important;
        }
        .fc-daygrid-day-number {
          font-size: 12px !important;
          color: #374151 !important;
          text-decoration: none !important;
          padding: 4px 6px !important;
        }
        .fc-day-today { background: #F0F7FF !important; }
        .fc-day-today .fc-daygrid-day-number { color: #185FA5 !important; font-weight: 700 !important; }
        .fc-daygrid-event { border-radius: 5px !important; border: none !important; margin: 1px 2px !important; }
        .fc-event-main { padding: 0 !important; }
        .fc-more-link { font-size: 11px !important; color: #185FA5 !important; font-weight: 500 !important; }
        .fc-popover { border-radius: 10px !important; border: 1px solid #E5E7EB !important; box-shadow: 0 4px 16px rgba(0,0,0,0.10) !important; }
        .fc-popover-header { background: #F9FAFB !important; border-radius: 10px 10px 0 0 !important; font-size: 12px !important; }
        .fc-scrollgrid { border-color: #E5E7EB !important; border-radius: 10px !important; overflow: hidden; }
        .fc-scrollgrid td, .fc-scrollgrid th { border-color: #F3F4F6 !important; }
        .fc-theme-standard .fc-scrollgrid { border: 1px solid #E5E7EB !important; }
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
          const bg  = cfg ? cfg.bg   : '#F3F4F6'
          const txt = cfg ? cfg.text : '#374151'
          const dot = cfg ? cfg.dot  : '#9CA3AF'

          return (
            <div
              style={{ backgroundColor: bg, borderLeft: `3px solid ${dot}`, padding: '3px 6px', borderRadius: '4px', cursor: 'pointer' }}
              className="w-full overflow-hidden"
            >
              <div style={{ color: txt, fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

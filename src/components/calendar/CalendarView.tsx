'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import { useState } from 'react'

type Props = {
  events: any[]
}

export default function CalendarView({ events }: Props) {

  const [filter, setFilter] = useState<'ALL' | 'MY'>('ALL')

  // filtrage events
  const visibleEvents =
    filter === 'MY'
      ? events.filter(e => e.extendedProps.player_status)
      : events

  return (

    <div>

      {/* FILTER BUTTONS */}

      <div className="flex gap-2 mb-4">

        <button
          className={`px-3 py-1 rounded border ${
            filter === 'ALL' ? 'bg-blue-600 text-white' : ''
          }`}
          onClick={() => setFilter('ALL')}
        >
          All Events
        </button>

        <button
          className={`px-3 py-1 rounded border ${
            filter === 'MY' ? 'bg-blue-600 text-white' : ''
          }`}
          onClick={() => setFilter('MY')}
        >
          My Events
        </button>

      </div>

      {/* CALENDAR */}

      <FullCalendar
        plugins={[dayGridPlugin]}
        initialView="dayGridMonth"
        events={visibleEvents}
        timeZone="UTC"
        height="auto"
        eventDisplay="block"

        dayMaxEventRows={3}
        moreLinkClick="popover"

        eventClick={(info) => {

          const e = info.event.extendedProps

          window.location.href =
            `/groups/${e.group_id}/events/${e.event_id}/view`
        }}

        eventContent={(info) => {

          const e = info.event.extendedProps

          const statusColors:any = {
            GOING: "bg-green-600",
            INVITED: "bg-yellow-500",
            DECLINED: "bg-red-600",
            WAITLIST: "bg-purple-600"
          }

          const badgeColor =
            statusColors[e.player_status] || "bg-gray-400"

          return (

            <div className="text-xs leading-tight space-y-1 p-1">

              <div className="font-semibold">
                {info.event.title}
              </div>

              {e.location && (
                <div className="text-gray-400">
                  {e.location}
                </div>
              )}

              <span
                className={`text-white px-1 rounded text-[10px] ${badgeColor}`}
              >
                {e.player_status ?? "OPEN"}
              </span>

            </div>

          )
        }}
      />

    </div>
  )
}
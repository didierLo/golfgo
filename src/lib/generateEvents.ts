// src/lib/generateEvents.ts

export type EventInput = {
  startDate: string          // yyyy-mm-dd
  startTime?: string         // hh:mm
  endTime?: string           // hh:mm
  allDay?: boolean

  recurrence: 'none' | 'weekly' | 'monthly'
  repeatUntil?: string       // yyyy-mm-dd
}

export type Event = {
  start: Date
  end: Date | null
}

function buildDate(
  date: string,
  time?: string
): Date {
  if (!time) {
    return new Date(`${date}T00:00:00`)
  }
  return new Date(`${date}T${time}:00`)
}

export function generateEvents(
  input: EventInput
): Event[] {
  const {
    startDate,
    startTime,
    endTime,
    allDay = false,
    recurrence,
    repeatUntil,
  } = input

  if (!startDate) {
    throw new Error('startDate is required')
  }

  if (!allDay && !startTime) {
    throw new Error('startTime is required')
  }

  if (!allDay && endTime && endTime <= startTime!) {
    throw new Error('endTime must be after startTime')
  }

  const events: Event[] = []

  const startBase = allDay
    ? buildDate(startDate)
    : buildDate(startDate, startTime)

  const endBase =
    allDay
      ? new Date(
          startBase.getFullYear(),
          startBase.getMonth(),
          startBase.getDate(),
          23,
          59,
          0
        )
      : endTime
      ? buildDate(startDate, endTime)
      : null

  // ─── SINGLE ─────────────────────────────
  if (recurrence === 'none') {
    events.push({
      start: startBase,
      end: endBase,
    })
    return events
  }

  // ─── RECURRING ──────────────────────────
  if (!repeatUntil) {
    throw new Error('repeatUntil is required for recurrence')
  }

  const until = new Date(`${repeatUntil}T23:59:59`)
  let current = new Date(startBase)

  while (current <= until) {
    const start = new Date(current)

    let end: Date | null = null
    if (endBase) {
      end = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate(),
        endBase.getHours(),
        endBase.getMinutes(),
        0
      )
    }

    events.push({ start, end })

    if (recurrence === 'weekly') {
      current.setDate(current.getDate() + 7)
    } else if (recurrence === 'monthly') {
      current.setMonth(current.getMonth() + 1)
    }
  }

  return events
}
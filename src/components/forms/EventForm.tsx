'use client'

import { useState } from 'react'

type EventRuleFormData = {
  title: string
  description?: string
  location?: string

  all_day: boolean
  start_time: string | null
  end_time: string | null

  start_date: string
  recurrence: 'none' | 'weekly' | 'monthly'
  recurrence_until: string | null

  specific_dates: {
    date: string
    start_time?: string
    end_time?: string
  }[]
}

type Props = {
  onSubmit: (data: EventRuleFormData) => Promise<void> | void
  submitLabel?: string
}

export default function EventForm({
  onSubmit,
  submitLabel = 'Create event',
}: Props) {
  const [form, setForm] = useState<EventRuleFormData>({
    title: '',
    description: '',
    location: '',

    all_day: false,
    start_time: '08:00',
    end_time: '12:00',

    start_date: '',
    recurrence: 'none',
    recurrence_until: null,

    specific_dates: [],
  })

  function update<K extends keyof EventRuleFormData>(
    key: K,
    value: EventRuleFormData[K]
  ) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Title *
        </label>
        <input
          required
          className="border p-3 w-full rounded"
          value={form.title}
          onChange={e => update('title', e.target.value)}
        />
      </div>

      {/* All day */}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.all_day}
          onChange={e => update('all_day', e.target.checked)}
        />
        All day
      </label>

      {/* Time */}
      {!form.all_day && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">Start time</label>
            <input
              type="time"
              className="border p-2 w-full rounded"
              value={form.start_time ?? ''}
              onChange={e => update('start_time', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm mb-1">End time</label>
            <input
              type="time"
              className="border p-2 w-full rounded"
              value={form.end_time ?? ''}
              onChange={e => update('end_time', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Start date */}
      <div>
        <label className="block text-sm mb-1">Start date *</label>
        <input
          type="date"
          required
          className="border p-2 w-full rounded"
          value={form.start_date}
          onChange={e => update('start_date', e.target.value)}
        />
      </div>

      {/* Recurrence */}
      <div>
        <label className="block text-sm mb-1">Recurrence</label>
        <select
          className="border p-2 w-full rounded"
          value={form.recurrence}
          onChange={e =>
            update('recurrence', e.target.value as any)
          }
        >
          <option value="none">None</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {form.recurrence !== 'none' && (
        <div>
          <label className="block text-sm mb-1">
            Repeat until
          </label>
          <input
            type="date"
            className="border p-2 w-full rounded"
            value={form.recurrence_until ?? ''}
            onChange={e =>
              update('recurrence_until', e.target.value)
            }
          />
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        className="bg-blue-600 text-white px-6 py-3 rounded"
      >
        {submitLabel}
      </button>
    </form>
  )
}
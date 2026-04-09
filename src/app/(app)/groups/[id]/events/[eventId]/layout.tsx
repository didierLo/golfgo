'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { use, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

interface EventLayoutProps {
  children: React.ReactNode
  params: Promise<{ id: string; eventId: string }>
}

export default function EventLayout({ children, params }: EventLayoutProps) {
  const pathname = usePathname()
  const { id, eventId } = use(params)

  const [isGolf, setIsGolf] = useState(true)
  const [hasFee, setHasFee] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function loadEvent() {
      const { data } = await supabase
        .from('events')
        .select('is_golf, fee_per_person')
        .eq('id', eventId)
        .single()
      if (data) {
        setIsGolf(data.is_golf ?? true)
        setHasFee(!!data.fee_per_person)
      }
      setLoaded(true)
    }
    loadEvent()
  }, [eventId])

  const base = `/groups/${id}/events/${eventId}`

  const tabs = [
    { label: 'Overview',     href: base,                   always: true },
    { label: 'Participants', href: `${base}/participants`, always: true },
    { label: 'Flights',      href: `${base}/flights`,      always: false, golfOnly: true },
    { label: 'Tee Sheet',    href: `${base}/teesheet`,     always: false, golfOnly: true },
    { label: 'Scorecards',   href: `${base}/scorecards`,   always: false, golfOnly: true },
    { label: 'Leaderboard',  href: `${base}/leaderboard`,  always: false, golfOnly: true },
    { label: 'Paiements',    href: `${base}/payments`,     always: false, feeOnly: true },
  ].filter(tab => {
    if (tab.always) return true
    if (tab.golfOnly && isGolf) return true
    if (tab.feeOnly && hasFee) return true
    return false
  })

  const isActive = (href: string, index: number) => {
    if (index === 0) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className="flex flex-col h-full">

      {/* Onglets */}
      <div className="border-b border-gray-200 bg-white px-6 flex-shrink-0">
        <nav className="flex gap-0">
          {loaded ? tabs.map((tab, index) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`
                relative px-4 py-3.5 text-[13px] font-medium transition-colors whitespace-nowrap
                ${isActive(tab.href, index)
                  ? 'text-blue-700'
                  : 'text-gray-500 hover:text-gray-800'
                }
              `}
            >
              {tab.label}
              {isActive(tab.href, index) && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-600 rounded-t-full" />
              )}
            </Link>
          )) : (
            ['Overview', 'Participants'].map(label => (
              <div key={label} className="px-4 py-3.5 text-[13px] text-gray-300">{label}</div>
            ))
          )}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto">
        {children}
      </div>

    </div>
  )
}

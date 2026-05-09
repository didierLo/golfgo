'use client'

import { use } from 'react'

interface EventLayoutProps {
  children: React.ReactNode
  params: Promise<{ id: string; eventId: string }>
}

export default function EventLayout({ children, params }: EventLayoutProps) {
  use(params) // keep for Next.js param resolution

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

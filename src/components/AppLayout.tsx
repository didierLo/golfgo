'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// 🎨 NEW COLORS (GolfGo identity)
const COLORS = {
  primary: '#1e3a8a',
  secondary: '#2563eb',
  accent: '#9BE15D',
}

interface Group { id: string; name: string; color: string; role: 'owner' | 'member' }
interface CurrentUser { initials: string; name: string }

const FALLBACK_COLORS = ['#378ADD', '#EF9F27', '#7F77DD', '#1D9E75', '#D85A30', '#D4537E']

function NavItem({ href, label, active }: any) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-[8px] rounded-lg text-[13px] transition-all relative ${
        active
          ? 'text-black font-semibold bg-[#9BE15D]'
          : 'text-gray-600 hover:bg-blue-50 hover:text-gray-900'
      }`}
    >
      {label}
    </Link>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const supabase = createClient()

  const [groups, setGroups] = useState<Group[]>([])
  const [activeGroup, setActiveGroup] = useState<Group | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  useEffect(() => {
    async function loadData() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return

      const { data: playerData } = await supabase
        .from('players')
        .select('id, first_name, surname')
        .eq('user_id', user.id)
        .single()

      if (!playerData) return

      const initials = ((playerData.first_name?.[0] ?? '') + (playerData.surname?.[0] ?? '')).toUpperCase()
      setCurrentUser({ initials, name: `${playerData.first_name} ${playerData.surname}` })
    }
    loadData()
  }, [])

  const isActive = (href: string) => pathname === href || pathname.startsWith(href)

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-white to-blue-50"> {/* ✅ MODIF: background dynamique léger */}

      {/* 🔝 TOPBAR */}
      <header className="h-[56px] bg-gradient-to-r from-[#1e3a8a] to-[#2563eb] flex items-center px-6 shadow-sm"> {/* ✅ MODIF: gradient + shadow */}
        <div className="flex items-center gap-3">
          <Link href="/groups" className="flex items-baseline">
            <span className="text-white font-semibold">Golf</span>
            <span className="text-[#9BE15D] font-semibold">Go</span>
          </Link>
        </div>

        <div className="ml-auto">
          {currentUser && (
            <div className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center text-xs font-medium">
              {currentUser.initials}
            </div>
          )}
        </div>
      </header>

      {/* BODY */}
      <div className="flex flex-1">

        {/* 📚 SIDEBAR */}
        <aside className="hidden sm:flex w-[210px] bg-white border-r border-gray-100 flex-col p-3 gap-2"> {/* ✅ MODIF: plus clean */}

          <NavItem href="/my-events" label="🏌️ My Events" active={isActive('/my-events')} />
          <NavItem href="/calendar" label="📅 Calendar" active={isActive('/calendar')} />
          <NavItem href="/scorecard" label="📊 Scores" active={isActive('/scorecard')} />

          <div className="h-px bg-gray-100 my-2" />

          <NavItem href="/groups" label="👥 Groups" active={isActive('/groups')} />
          <NavItem href="/events" label="🏆 Events" active={isActive('/events')} />

          <div className="mt-auto">
            <NavItem href="/settings" label="⚙️ Settings" active={isActive('/settings')} />
          </div>

        </aside>

        {/* 🧱 MAIN */}
        <main className="flex-1 p-5">

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"> {/* ✅ MODIF: card wrapper */}
            {children}
          </div>

        </main>
      </div>

      {/* 📱 MOBILE NAV */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2">
        <Link href="/my-events" className={isActive('/my-events') ? 'text-[#9BE15D]' : 'text-gray-400'}>🏌️</Link>
        <Link href="/calendar" className={isActive('/calendar') ? 'text-[#9BE15D]' : 'text-gray-400'}>📅</Link>
        <Link href="/groups" className={isActive('/groups') ? 'text-[#9BE15D]' : 'text-gray-400'}>👥</Link>
        <Link href="/scorecard" className={isActive('/scorecard') ? 'text-[#9BE15D]' : 'text-gray-400'}>📊</Link>
      </nav>

    </div>
  )
}

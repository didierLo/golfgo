'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Group { id: string; name: string; color: string; role: 'owner' | 'member' }
interface CurrentUser { initials: string; name: string }

const FALLBACK_COLORS = ['#378ADD', '#EF9F27', '#7F77DD', '#1D9E75', '#D85A30', '#D4537E']

const Icons = {
  myEvents: (<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" /><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>),
  calendar: (<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" /><path d="M1 7h14M5 1v4M11 1v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>),
  scorecard: (<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.2" /><path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>),
  groups: (<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" /><path d="M1 13c0-2.76 2.24-5 5-5a5 5 0 015 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.2" /></svg>),
  events: (<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" /><path d="M5 4V3a1 1 0 012 0v1M9 4V3a1 1 0 012 0v1" stroke="currentColor" strokeWidth="1.2" /></svg>),
  clubs: (<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 14V2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M3 2l9 3-9 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  templates: (<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" /><path d="M1 13h6M1 15h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /><path d="M5 4h6M5 7h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>),
  settings: (<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>),
  chevronDown: (<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  check: (<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  plus: (<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>),
}

function NavItem({ href, icon, label, active, muted }: { href: string; icon: React.ReactNode; label: string; active: boolean; muted?: boolean }) {
  return (
    <Link href={href} className={`flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] transition-colors relative ${
      active  ? 'text-[#185FA5] font-medium' :
      muted   ? 'text-gray-400 font-normal hover:text-gray-500' :
                'text-gray-700 font-normal hover:text-gray-900'
    }`}>
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-[#185FA5] rounded-full" />}
      <span className={`w-[15px] h-[15px] flex-shrink-0 ${active ? 'text-[#185FA5]' : muted ? 'text-gray-400' : 'text-gray-500'}`}>{icon}</span>
      {label}
      {muted && <span className="ml-auto text-[10px] text-gray-400">bientôt</span>}
    </Link>
  )
}

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest px-3 mb-0.5">{label}</p>
      {children}
    </div>
  )
}

// Bottom nav item pour mobile
function BottomNavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-0.5 flex-1 py-2 transition-colors"
      style={{ color: active ? '#185FA5' : '#6B7280' }}>
      <span style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* on rend l'icône un peu plus grande pour la bottom nav */}
        <svg viewBox="0 0 16 16" fill="none" width="20" height="20" style={{ display: 'contents' }}>
          {icon}
        </svg>
        {icon}
      </span>
      <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, lineHeight: 1 }}>{label}</span>
    </Link>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const supabase = createClient()

  const [groups, setGroups]           = useState<Group[]>([])
  const [activeGroup, setActiveGroup] = useState<Group | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [groupSwitcherOpen, setGroupSwitcherOpen] = useState(false)
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user
        if (!user) { setLoading(false); return }

        const { data: playerData, error: playerError } = await supabase
          .from('players').select('id, first_name, surname').eq('user_id', user.id).single()
        if (playerError || !playerData) { setLoading(false); return }

        const initials = ((playerData.first_name?.[0] ?? '') + (playerData.surname?.[0] ?? '')).toUpperCase()
        setCurrentUser({ initials, name: `${playerData.first_name} ${playerData.surname}` })

        const { data, error } = await supabase
          .from('groups_players').select(`role, groups(id, name, color)`).eq('player_id', playerData.id)
        if (error) { setLoading(false); return }

        const fetchedGroups: Group[] = (data ?? [])
          .filter((row: any) => row.groups)
          .map((row: any, index: number) => ({
            id: row.groups.id, name: row.groups.name,
            color: row.groups.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
            role: row.role as 'owner' | 'member',
          }))

          console.log('fetchedGroups:', fetchedGroups)  
          console.log('data brut:', data)               

        setGroups(fetchedGroups)
        const urlGroupId = pathname.match(/\/groups\/([^/]+)/)?.[1]
        const groupFromUrl = fetchedGroups.find(g => g.id === urlGroupId)
        setActiveGroup(groupFromUrl ?? fetchedGroups[0] ?? null)
      } catch (e) {
        console.error('AppLayout error:', e)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (groups.length === 0) return
    const urlGroupId = pathname.match(/\/groups\/([^/]+)/)?.[1]
    if (urlGroupId) {
      const match = groups.find(g => g.id === urlGroupId)
      if (match) setActiveGroup(match)
    }
  }, [pathname, groups])

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const gid = activeGroup?.id
  const isAnyOwner = groups.some(g => g.role === 'owner')

  // Items bottom nav mobile — les 5 plus importants
  const bottomNavItems = [
    { href: '/my-events',                                          icon: Icons.myEvents,  label: 'My Events' },
    { href: '/calendar',                                           icon: Icons.calendar,  label: 'Calendar'  },
    { href: isAnyOwner ? '/groups' : '/not-owner',                 icon: Icons.groups,    label: 'Groups'    },
    { href: isAnyOwner ? (gid ? `/groups/${gid}/events` : '/groups') : '/not-owner',
                                                                   icon: Icons.events,    label: 'Events'    },
    { href: '/scorecard',                                          icon: Icons.scorecard, label: 'Scores'    },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-white">

      {/* Topbar */}
      <header className="h-[52px] bg-[#185FA5] flex items-center px-6 flex-shrink-0 z-30">
        <div className="max-w-[1200px] w-full mx-auto flex items-center gap-3">
          <Link href="/groups" className="flex items-baseline select-none">
            <span className="text-[17px] font-medium text-white tracking-tight">Golf</span>
            <span className="text-[17px] font-medium text-[#97C459] tracking-tight">Go</span>
          </Link>
          <div className="w-px h-5 bg-white/25" />

          {loading ? (
            <div className="h-7 w-44 rounded-full bg-white/15 animate-pulse" />
          ) : activeGroup ? (
            <div className="relative">
              <button onClick={() => setGroupSwitcherOpen(v => !v)}
                className="flex items-center gap-2 bg-white/15 border border-white/25 rounded-full px-3 py-[5px] hover:bg-white/20 transition-colors">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: activeGroup.color }} />
                <span className="text-[13px] font-medium text-white leading-none">{activeGroup.name}</span>
                <span className="text-white/70 ml-0.5">{Icons.chevronDown}</span>
              </button>
              {groupSwitcherOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg py-2 z-50">
                  <div className="px-3 pb-2 pt-1">
                    <span className="text-[10px] font-medium text-gray-500 uppercase tracking-widest">Mes groupes</span>
                  </div>
                  {groups.map(group => (
                    <button key={group.id} onClick={() => { setActiveGroup(group); setGroupSwitcherOpen(false) }}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors text-left">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: group.color }} />
                      <span className="text-[13px] text-gray-800 flex-1">{group.name}</span>
                      <span className="text-[10px] text-gray-500">{group.role}</span>
                      {activeGroup.id === group.id && <span className="text-blue-600">{Icons.check}</span>}
                    </button>
                  ))}
                  {isAnyOwner && (
                    <div className="border-t border-gray-100 mt-2 pt-2 px-3">
                      <Link href="/groups/add" onClick={() => setGroupSwitcherOpen(false)}
                        className="flex items-center gap-1.5 text-[12px] text-blue-600 hover:text-blue-800 transition-colors">
                        <span>{Icons.plus}</span>
                        Nouveau groupe
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Link href="/groups/add"
              className="flex items-center gap-2 bg-white/10 border border-white/20 border-dashed rounded-full px-3 py-[5px] hover:bg-white/15 transition-colors">
              <span className="text-white/50">{Icons.plus}</span>
              <span className="text-[13px] text-white/60 leading-none">Créer un groupe</span>
            </Link>
          )}

          {/* Avatar */}
          <div className="ml-auto">
            {currentUser ? (
              <div className="w-[30px] h-[30px] rounded-full bg-[#0C447C] border-[1.5px] border-white/30 flex items-center justify-center text-[11px] font-medium text-blue-200 select-none">
                {currentUser.initials}
              </div>
            ) : (
              <Link href="/login"
                className="w-[30px] h-[30px] rounded-full bg-[#0C447C] border-[1.5px] border-white/30 flex items-center justify-center hover:bg-[#0a3a6a] transition-colors"
                title="Se connecter">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="5.5" r="2.5" stroke="white" strokeWidth="1.3" />
                  <path d="M2.5 14c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 max-w-[1200px] w-full mx-auto">

        {/* Sidebar — cachée sur mobile */}
        <aside className="hidden sm:flex w-[200px] flex-shrink-0 bg-gray-50 border-r border-gray-200 flex-col py-5 px-2 gap-5">
          <SidebarSection label="Play">
            <NavItem href="/my-events" icon={Icons.myEvents}  label="My Events"  active={isActive('/my-events')} />
            <NavItem href="/calendar"  icon={Icons.calendar}  label="My Calendar"   active={isActive('/calendar')} />
            <NavItem href="/scorecard" icon={Icons.scorecard} label="My Scorecard" active={isActive('/scorecard')} />
          </SidebarSection>

          <div className="mx-3 h-px bg-gray-200" />

          <SidebarSection label="Organiser">
            <NavItem href={isAnyOwner ? '/groups' : '/not-owner'} icon={Icons.groups} label="Groups" active={isActive('/groups')} />
            <NavItem
              href={isAnyOwner ? (gid ? `/groups/${gid}/events` : '/groups') : '/not-owner'}
              icon={Icons.events} label="Events"
              active={!isAnyOwner ? false : !!gid && isActive(`/groups/${gid}/events`)} />
            <NavItem href={isAnyOwner ? '/admin/clubs' : '/not-owner'} icon={Icons.clubs} label="Clubs" active={isAnyOwner && isActive('/admin/clubs')} />
            <NavItem
              href={isAnyOwner ? (gid ? `/groups/${gid}/templates` : '/groups') : '/not-owner'}
              icon={Icons.templates} label="Templates"
              active={!!gid && isActive(`/groups/${gid}/templates`)} />
          </SidebarSection>

          <div className="mt-auto">
            <div className="mx-3 h-px bg-gray-200 mb-3" />
            <NavItem href="/settings" icon={Icons.settings} label="Settings" active={isActive('/settings')} muted />
          </div>
        </aside>

        {/* Main — padding bottom sur mobile pour la bottom nav */}
        <main className="flex-1 bg-white overflow-y-auto pb-16 sm:pb-0">
          {children}
        </main>
      </div>

      {/* Bottom nav — visible uniquement sur mobile */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex items-stretch"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {bottomNavItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors"
            style={{ color: isActive(item.href) ? '#185FA5' : '#6B7280' }}
          >
            <span style={{
              width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: isActive(item.href) ? '#185FA5' : '#6B7280',
            }}>
              {item.icon}
            </span>
            <span style={{ fontSize: 10, fontWeight: isActive(item.href) ? 600 : 400, lineHeight: 1 }}>
              {item.label}
            </span>
          </Link>
        ))}
      </nav>

      {groupSwitcherOpen && (
        <div className="fixed inset-0 z-20" onClick={() => setGroupSwitcherOpen(false)} />
      )}
    </div>
  )
}

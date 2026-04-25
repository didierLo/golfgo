'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Group       { id: string; name: string; color: string; role: 'owner' | 'member' }
interface CurrentUser { initials: string; name: string }

const FALLBACK_COLORS = ['#378ADD', '#EF9F27', '#7F77DD', '#1D9E75', '#D85A30', '#D4537E']

const Icons = {
  myEvents: (<svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" /><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>),
  calendar: (<svg width="18" height="18" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M1 7h14M5 1v4M11 1v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>),
  scorecard: (<svg width="18" height="18" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>),
  groups: (<svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4" /><path d="M1 13c0-2.76 2.24-5 5-5a5 5 0 015 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.4" /></svg>),
  events: (<svg width="18" height="18" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M5 4V3a1 1 0 012 0v1M9 4V3a1 1 0 012 0v1" stroke="currentColor" strokeWidth="1.4" /></svg>),
  clubs: (<svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M3 14V2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M3 2l9 3-9 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  communications: (<svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M14 2H2a1 1 0 00-1 1v8a1 1 0 001 1h3l3 3 3-3h3a1 1 0 001-1V3a1 1 0 00-1-1z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 6h8M4 9h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>),
  settings: (<svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>),
  chevronDown: (<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  check: (<svg width="13" height="13" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>),
  plus: (<svg width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>),
  user: (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5.5" r="2.5" stroke="white" strokeWidth="1.4" /><path d="M2.5 14c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" /></svg>),
}

function NavItem({ href, icon, label, active, muted, iconColor }: { href: string; icon: React.ReactNode; label: string; active: boolean; muted?: boolean; iconColor?: string }) {
  return (
    <Link href={href} className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-semibold transition-all duration-150 ${active ? 'bg-[#185FA5] text-white shadow-sm shadow-blue-900/20' : muted ? 'text-slate-400 hover:text-slate-500 hover:bg-slate-100/60' : 'text-slate-900 hover:text-black hover:bg-slate-100/80'}`}>
      <span className="flex-shrink-0 transition-transform duration-150 group-hover:scale-110" style={{ color: active ? 'white' : muted ? '#CBD5E1' : (iconColor ?? '#185FA5') }}>{icon}</span>
      <span className="flex-1 leading-none">{label}</span>
      {muted && <span className="text-[9px] text-slate-400 font-normal tracking-wide uppercase">bientôt</span>}
    </Link>
  )
}

function NavIconItem({ href, icon, label, active, muted, iconColor }: { href: string; icon: React.ReactNode; label: string; active: boolean; muted?: boolean; iconColor?: string }) {
  return (
    <Link href={href} title={label} className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-150 ${active ? 'bg-[#185FA5] text-white shadow-sm shadow-blue-900/20' : muted ? 'text-slate-300 hover:text-slate-400 hover:bg-slate-100/60' : 'hover:bg-blue-50'}`}>
      <span className="transition-transform duration-150 group-hover:scale-110" style={{ color: active ? 'white' : muted ? '#CBD5E1' : (iconColor ?? '#185FA5') }}>{icon}</span>
      <span className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-lg bg-slate-900 text-white text-[11px] font-semibold px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg">
        {label}{muted && <span className="ml-1 text-slate-400">(bientôt)</span>}
      </span>
    </Link>
  )
}

function SidebarSection({ label, emoji, children }: { label: string; emoji?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.12em] px-3 mb-1.5 mt-1">
        {emoji && <span className="text-[11px]">{emoji}</span>}{label}
      </p>
      {children}
    </div>
  )
}

function GroupDot({ color, size = 8 }: { color: string; size?: number }) {
  return <span className="rounded-full flex-shrink-0 ring-2 ring-white" style={{ width: size, height: size, background: color, display: 'inline-block' }} />
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const supabase = createClient()

  const [groups,            setGroups]            = useState<Group[]>([])
  const [activeGroup,       setActiveGroup]       = useState<Group | null>(null)
  const [currentUser,       setCurrentUser]       = useState<CurrentUser | null>(null)
  const [groupSwitcherOpen, setGroupSwitcherOpen] = useState(false)
  const [loading,           setLoading]           = useState(true)
  const [drawerOpen, setDrawerOpen]               = useState(false) 
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const avatarRef = useRef<HTMLDivElement>(null)

  const switcherRef = useRef<HTMLDivElement>(null)
 

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) setGroupSwitcherOpen(false)
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarMenuOpen(false)
      }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user
        if (!user) { setLoading(false); return }
        const { data: playerData, error: playerError } = await supabase.from('players').select('id, first_name, surname').eq('user_id', user.id).single()
        if (playerError || !playerData) { setLoading(false); return }
        const initials = ((playerData.first_name?.[0] ?? '') + (playerData.surname?.[0] ?? '')).toUpperCase()
        setCurrentUser({ initials, name: `${playerData.first_name} ${playerData.surname}` })
        const { data, error } = await supabase.from('groups_players').select(`role, groups(id, name, color)`).eq('player_id', playerData.id)
        if (error) { setLoading(false); return }
        const fetchedGroups: Group[] = (data ?? []).filter((row: any) => row.groups).map((row: any, index: number) => ({
          id: row.groups.id, name: row.groups.name,
          color: row.groups.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
          role: row.role as 'owner' | 'member',
        }))
        setGroups(fetchedGroups)
        const urlGroupId = pathname.match(/\/groups\/([^/]+)/)?.[1]
        setActiveGroup(fetchedGroups.find(g => g.id === urlGroupId) ?? fetchedGroups[0] ?? null)
      } catch (e) { console.error('AppLayout error:', e) }
      finally { setLoading(false) }
    }
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (groups.length === 0) return
    const urlGroupId = pathname.match(/\/groups\/([^/]+)/)?.[1]
    if (urlGroupId) { const match = groups.find(g => g.id === urlGroupId); if (match) setActiveGroup(match) }
  }, [pathname, groups])

  const isActive       = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const isGroupsActive = pathname === '/groups' || pathname === '/groups/add'
  const gid            = activeGroup?.id
  const isAnyOwner     = groups.some(g => g.role === 'owner')

  const eventsHref         = isAnyOwner ? (gid ? `/groups/${gid}/events`         : '/groups') : '/not-owner'
  const communicationsHref = isAnyOwner ? (gid ? `/groups/${gid}/communications` : '/groups') : '/not-owner'
  const groupsHref         = isAnyOwner ? '/groups' : '/not-owner'
  const clubsHref          = isAnyOwner ? '/admin/clubs' : '/not-owner'


const bottomNavItems = [
  { href: '/my-events',          icon: Icons.myEvents,        label: 'My Events',       iconColor: '#185FA5' },
  { href: '/calendar',           icon: Icons.calendar,        label: 'My Calendar',     iconColor: '#1D9E75' },
  { href: '/scorecard',          icon: Icons.scorecard,       label: 'My Scorecard',    iconColor: '#D85A30' },
  { href: groupsHref,            icon: Icons.groups,          label: 'Groups',          iconColor: '#7F77DD' },
  { href: eventsHref,            icon: Icons.events,          label: 'Events',          iconColor: '#185FA5' },
  { href: clubsHref,             icon: Icons.clubs,           label: 'Clubs',           iconColor: '#EF9F27' },
  { href: communicationsHref,    icon: Icons.communications,  label: 'Communications',  iconColor: '#D4537E' },
  { href: '/settings',           icon: Icons.settings,        label: 'Settings',        iconColor: '#888780' },
]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'transparent' }}>
      <div className="fixed inset-0 -z-10" style={{ backgroundImage: 'url(/golf-bg.jpg)', backgroundSize: 'cover', backgroundPosition: '50% center', backgroundAttachment: 'fixed' }} />
      <div className="fixed inset-0 -z-10 bg-white/0" />

      {/* TOPBAR */}
      <header className="h-[56px] flex items-center flex-shrink-0 z-30 shadow-md shadow-blue-900/20"
        style={{ background: 'rgba(24, 95, 165, 0.85)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
       <div className="max-w-[1280px] w-full mx-auto flex items-center overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex items-center flex-shrink-0 w-[60px] sm:w-[60px] lg:w-[220px]">
            <Link href="/groups" className="flex items-center gap-2.5 select-none px-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo/GG_Favicon.png" alt="" className="h-[30px] w-[30px] object-contain rounded-lg flex-shrink-0" />
              <span className="hidden lg:flex items-baseline leading-none">
                <span className="text-[18px] font-black text-white tracking-tight">Golf</span>
                <span className="text-[18px] font-black tracking-tight" style={{ color: '#4CAF1A' }}>Go</span>
              </span>
            </Link>
          </div>
          <div className="w-px h-full bg-white/30 flex-shrink-0 self-stretch" />
          <div className="flex items-center gap-4 flex-1 px-4">
            {loading ? (
              <div className="h-8 w-48 rounded-full bg-white/15 animate-pulse" />
            ) : activeGroup ? (
              <div className="relative" ref={switcherRef}>
                <button onClick={() => setGroupSwitcherOpen(v => !v)}
                  className="flex items-center gap-2.5 bg-white/15 hover:bg-white/22 border border-white/20 rounded-full pl-2.5 pr-3 py-1.5 transition-all duration-150 cursor-pointer">
                  <GroupDot color={activeGroup.color} size={9} />
                  <span className="text-[13px] font-semibold text-white leading-none max-w-[140px] sm:max-w-[200px] truncate">{activeGroup.name}</span>
                  <span className={`text-white/60 transition-transform duration-200 ${groupSwitcherOpen ? 'rotate-180' : ''}`}>{Icons.chevronDown}</span>
                </button>
                {groupSwitcherOpen && (
                  <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-900/10 py-2 z-50 overflow-hidden">
                    <div className="px-4 pt-2 pb-3 border-b border-slate-100">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Mes groupes</span>
                    </div>
                    <div className="py-1 max-h-64 overflow-y-auto">
                      {groups.map(group => (
                        <button key={group.id} onClick={() => { setActiveGroup(group); setGroupSwitcherOpen(false) }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left ${activeGroup.id === group.id ? 'bg-blue-50/60' : ''}`}>
                          <GroupDot color={group.color} size={10} />
                          <span className="text-[13.5px] text-slate-800 font-medium flex-1 truncate">{group.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${group.role === 'owner' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                            {group.role === 'owner' ? 'Admin' : 'Membre'}
                          </span>
                          {activeGroup.id === group.id && <span className="text-[#185FA5] flex-shrink-0">{Icons.check}</span>}
                        </button>
                      ))}
                    </div>
                    {isAnyOwner && (
                      <div className="border-t border-slate-100 mt-1 pt-2 px-4 pb-1">
                        <Link href="/groups/add" onClick={() => setGroupSwitcherOpen(false)}
                          className="flex items-center gap-2 text-[13px] text-[#185FA5] font-semibold hover:text-[#0C447C] transition-colors py-1">
                          <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-[#185FA5]">{Icons.plus}</span>
                          Nouveau groupe
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <Link href="/groups/add" className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 border-dashed rounded-full px-3 py-1.5 transition-colors">
                <span className="text-white/50">{Icons.plus}</span>
                <span className="text-[13px] text-white/60 font-medium leading-none">Créer un groupe</span>
              </Link>
            )}
            <div className="flex-1" />
            {currentUser ? (
          <div className="relative flex-shrink-0" ref={avatarRef}>
          <button
            onClick={() => { console.log('avatar click'); setAvatarMenuOpen(v => !v) }}
            title={currentUser.name}
            className="w-[34px] h-[34px] rounded-full bg-[#4CAF1A] flex items-center justify-center text-[12px] font-black text-white select-none ring-2 ring-white/30 hover:ring-white/60 transition-all cursor-pointer"
          >
            {currentUser.initials}
          </button>
           
            {avatarMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-52 bg-white border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-900/10 py-2 z-50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100">
                  <p className="text-[12px] font-bold text-slate-800 truncate">{currentUser.name}</p>
                </div>
                <Link href="/settings" onClick={() => setAvatarMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                  <span className="text-slate-400">{Icons.settings}</span>
                  <span className="text-[13px] text-slate-700 font-medium">Settings</span>
                </Link>
                <div className="mx-3 my-1 h-px bg-slate-100" />
                <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 transition-colors">
                  <span className="text-red-400">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                  <span className="text-[13px] text-red-500 font-semibold">Se déconnecter</span>
                </button>
              </div>
            )}
          </div>
        ) : (
                      <Link href="/login" className="w-[34px] h-[34px] rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors flex-shrink-0" title="Se connecter">
                {Icons.user}
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* BODY */}
      <div className="flex flex-1 max-w-[1280px] w-full mx-auto">

        {/* Sidebar desktop (≥ 1024px) */}
        <aside className="hidden lg:flex w-[220px] flex-shrink-0 flex-col py-6 px-3 gap-1 border-r border-white/50"
          style={{ background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
          <SidebarSection label="PLAY" emoji="⛳">
            <NavItem href="/my-events" icon={Icons.myEvents}  iconColor="#185FA5" label="My Events"    active={isActive('/my-events')} />
            <NavItem href="/calendar"  icon={Icons.calendar}  iconColor="#1D9E75" label="My Calendar"  active={isActive('/calendar')} />
            <NavItem href="/scorecard" icon={Icons.scorecard} iconColor="#D85A30" label="My Scorecard" active={isActive('/scorecard')} />
          </SidebarSection>
          <div className="mx-2 my-3 h-px bg-slate-100" />
          <SidebarSection label="ORGANISER" emoji="🏆">
            <NavItem href={groupsHref} icon={Icons.groups} iconColor="#7F77DD" label="Groups" active={isGroupsActive} />
            <NavItem href={eventsHref} icon={Icons.events} iconColor="#185FA5" label="Events"
              active={!isAnyOwner ? false : !!gid && isActive(`/groups/${gid}/events`)} />
            <NavItem href={clubsHref} icon={Icons.clubs} iconColor="#EF9F27" label="Clubs" active={isAnyOwner && isActive('/admin/clubs')} />
            <NavItem href={communicationsHref} icon={Icons.communications} iconColor="#D4537E" label="Communications"
              active={!!gid && isActive(`/groups/${gid}/communications`)} />
          </SidebarSection>
          <div className="mt-auto">
            <div className="mx-2 mb-3 h-px bg-slate-100" />
            <NavItem href="/settings" icon={Icons.settings} iconColor="#888780" label="Settings" active={isActive('/settings')} muted />
          </div>
        </aside>

        {/* Sidebar tablette (640–1023px) */}
        <aside className="hidden sm:flex lg:hidden w-[60px] flex-shrink-0 flex-col items-center py-5 gap-1 border-r border-white/50"
          style={{ background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
          <div className="flex flex-col items-center gap-1 w-full px-2.5">
            <NavIconItem href="/my-events" icon={Icons.myEvents}  iconColor="#185FA5" label="My Events"    active={isActive('/my-events')} />
            <NavIconItem href="/calendar"  icon={Icons.calendar}  iconColor="#1D9E75" label="My Calendar"  active={isActive('/calendar')} />
            <NavIconItem href="/scorecard" icon={Icons.scorecard} iconColor="#D85A30" label="My Scorecard" active={isActive('/scorecard')} />
          </div>
          <div className="w-8 h-px bg-slate-100 my-2" />
          <div className="flex flex-col items-center gap-1 w-full px-2.5">
            <NavIconItem href={groupsHref} icon={Icons.groups} iconColor="#7F77DD" label="Groups" active={isGroupsActive} />
            <NavIconItem href={eventsHref} icon={Icons.events} iconColor="#185FA5" label="Events"
              active={!isAnyOwner ? false : !!gid && isActive(`/groups/${gid}/events`)} />
            <NavIconItem href={clubsHref} icon={Icons.clubs} iconColor="#EF9F27" label="Clubs" active={isAnyOwner && isActive('/admin/clubs')} />
            <NavIconItem href={communicationsHref} icon={Icons.communications} iconColor="#D4537E" label="Communications"
              active={!!gid && isActive(`/groups/${gid}/communications`)} />
          </div>
          <div className="mt-auto flex flex-col items-center gap-1 w-full px-2.5">
            <div className="w-8 h-px bg-slate-100 mb-2" />
            <NavIconItem href="/settings" icon={Icons.settings} iconColor="#888780" label="Settings (bientôt)" active={isActive('/settings')} muted />
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto pb-20 sm:pb-0 min-h-0" style={{ background: 'transparent' }}>
          {children}
        </main>
      </div>

 {/* Overlay drawer */}
      {drawerOpen && (
        <div className="sm:hidden fixed inset-0 z-30" onClick={() => setDrawerOpen(false)} />
      )}

      {/* Drawer ORGANISER */}
      <div className={`sm:hidden fixed bottom-[57px] left-0 right-0 z-40 transition-transform duration-300 ease-out ${drawerOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none'}`}
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderRadius: '20px 20px 0 0', borderTop: '0.5px solid rgba(0,0,0,0.1)', boxShadow: '0 -8px 32px rgba(0,0,0,0.12)' }}>
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        <div className="px-5 py-2 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Organiser 🏆</p>
        </div>
        {[
          { href: groupsHref,         icon: Icons.groups,         label: 'Groups',         color: '#7F77DD', active: isGroupsActive },
          { href: eventsHref,         icon: Icons.events,         label: 'Events',  sublabel: activeGroup?.name ?? null,   color: '#185FA5',  active: !isAnyOwner ? false : !!gid && isActive(`/groups/${gid}/events`) },
          { href: clubsHref,          icon: Icons.clubs,          label: 'Clubs',          color: '#EF9F27', active: isAnyOwner && isActive('/admin/clubs') },
          { href: communicationsHref, icon: Icons.communications, label: 'Communications', color: '#D4537E', active: !!gid && isActive(`/groups/${gid}/communications`) },
          { href: '/settings',        icon: Icons.settings,       label: 'Settings',       color: '#888780', active: isActive('/settings') },
          ].map(item => (
        <Link key={item.label} href={item.href} onClick={() => setDrawerOpen(false)}
          className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors">
          <span style={{ color: item.active ? '#185FA5' : item.color, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {item.icon}
          </span>
          <div className="flex flex-col">
            <span style={{ fontSize: 15, fontWeight: item.active ? 700 : 600, color: item.active ? '#185FA5' : '#1e293b' }}>
              {item.label}
            </span>
            {item.sublabel && (
              <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                {item.sublabel}
              </span>
            )}
    </div>
    {item.active && <span className="ml-auto w-2 h-2 rounded-full bg-[#185FA5]" />}
  </Link>
))}
        <div style={{ paddingBottom: 'env(safe-area-inset-bottom)', height: 8 }} />
      </div>

      {/* BOTTOM NAV mobile */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/40 flex items-stretch"
        style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[
          { href: '/my-events', icon: Icons.myEvents,  label: 'My Events', color: '#185FA5' },
          { href: '/calendar',  icon: Icons.calendar,  label: 'Calendar',  color: '#1D9E75' },
          { href: '/scorecard', icon: Icons.scorecard, label: 'Scorecard', color: '#D85A30' },
        ].map(item => {
          const active = isActive(item.href)
          return (
            <Link key={item.label} href={item.href} onClick={() => setDrawerOpen(false)}
              className="flex flex-col items-center justify-center gap-1 flex-1 py-2.5 transition-colors relative">
              {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-[#185FA5] rounded-b-full" />}
              <span style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? '#185FA5' : item.color, transform: active ? 'scale(1.1)' : 'scale(1)', transition: 'transform .15s, color .15s' }}>
                {item.icon}
              </span>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, color: active ? '#185FA5' : '#334155', lineHeight: 1 }}>
                {item.label}
              </span>
            </Link>
          )
        })}
        <div className="w-px bg-slate-200 self-stretch my-2" />
        <button onClick={() => setDrawerOpen(v => !v)}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-2.5 transition-colors relative">
          {drawerOpen && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-[#185FA5] rounded-b-full" />}
          <span style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', color: drawerOpen ? '#185FA5' : '#334155', transition: 'color .15s' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <circle cx="4" cy="10" r="2"/><circle cx="10" cy="10" r="2"/><circle cx="16" cy="10" r="2"/>
            </svg>
          </span>
          <span style={{ fontSize: 10, fontWeight: drawerOpen ? 700 : 500, color: drawerOpen ? '#185FA5' : '#334155', lineHeight: 1 }}>
            Organiser
          </span>
        </button>
      </nav>
    </div>
  )
}

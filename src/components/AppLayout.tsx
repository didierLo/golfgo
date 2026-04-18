'use client'

import { useState, useEffect, useRef } from 'react'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Group       { id: string; name: string; color: string; role: 'owner' | 'member' }
interface CurrentUser { initials: string; name: string }

const FALLBACK_COLORS = ['#378ADD', '#EF9F27', '#7F77DD', '#1D9E75', '#D85A30', '#D4537E']

// ─────────────────────────────────────────────────────────────────────────────
// Icons  (18 × 18, stroke 1.4)
// ─────────────────────────────────────────────────────────────────────────────
const Icons = {
  myEvents: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  calendar: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1 7h14M5 1v4M11 1v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  scorecard: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="1" width="12" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  groups: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1 13c0-2.76 2.24-5 5-5a5 5 0 015 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="12" cy="5" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  events: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 4V3a1 1 0 012 0v1M9 4V3a1 1 0 012 0v1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  clubs: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <path d="M3 14V2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M3 2l9 3-9 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  templates: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M1 13h6M1 15h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M5 4h6M5 7h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  chevronDown: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  check: (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  plus: (
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
      <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  user: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.5" r="2.5" stroke="white" strokeWidth="1.4" />
      <path d="M2.5 14c0-3.04 2.46-5.5 5.5-5.5s5.5 2.46 5.5 5.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
}

// ─────────────────────────────────────────────────────────────────────────────
// NavItem — sidebar desktop (labels visibles)
// ─────────────────────────────────────────────────────────────────────────────
function NavItem({
  href, icon, label, active, muted, iconColor,
}: {
  href: string; icon: React.ReactNode; label: string; active: boolean; muted?: boolean; iconColor?: string
}) {
  return (
    <Link
      href={href}
      className={`
        group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-semibold
        transition-all duration-150
        ${active
          ? 'bg-[#185FA5] text-white shadow-sm shadow-blue-900/20'
          : muted
          ? 'text-slate-400 hover:text-slate-500 hover:bg-slate-100/60'
          : 'text-slate-900 hover:text-black hover:bg-slate-100/80'
        }
      `}
    >
      <span
        className="flex-shrink-0 transition-transform duration-150 group-hover:scale-110"
        style={{ color: active ? 'white' : muted ? '#CBD5E1' : (iconColor ?? '#185FA5') }}
      >
        {icon}
      </span>
      <span className="flex-1 leading-none">{label}</span>
      {muted && (
        <span className="text-[9px] text-slate-400 font-normal tracking-wide uppercase">bientôt</span>
      )}
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// NavIconItem — sidebar tablette (icône seule + tooltip)
// ─────────────────────────────────────────────────────────────────────────────
function NavIconItem({
  href, icon, label, active, muted, iconColor,
}: {
  href: string; icon: React.ReactNode; label: string; active: boolean; muted?: boolean; iconColor?: string
}) {
  return (
    <Link
      href={href}
      title={label}
      className={`
        group relative flex items-center justify-center w-10 h-10 rounded-xl
        transition-all duration-150
        ${active
          ? 'bg-[#185FA5] text-white shadow-sm shadow-blue-900/20'
          : muted
          ? 'text-slate-300 hover:text-slate-400 hover:bg-slate-100/60'
          : `hover:bg-blue-50`
        }
      `}
    >
      <span
        className="transition-transform duration-150 group-hover:scale-110"
        style={{ color: active ? 'white' : muted ? '#CBD5E1' : (iconColor ?? '#185FA5') }}
      >
        {icon}
      </span>
      {/* Tooltip au survol */}
      <span className="
        pointer-events-none absolute left-full ml-2 z-50
        whitespace-nowrap rounded-lg bg-slate-900 text-white text-[11px] font-semibold
        px-2.5 py-1.5 opacity-0 group-hover:opacity-100
        transition-opacity duration-150 shadow-lg
      ">
        {label}
        {muted && <span className="ml-1 text-slate-400">(bientôt)</span>}
      </span>
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SidebarSection — desktop uniquement (avec label texte)
// ─────────────────────────────────────────────────────────────────────────────
function SidebarSection({ label, emoji, children }: { label: string; emoji?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-[0.12em] px-3 mb-1.5 mt-1">
        {emoji && <span className="text-[11px]">{emoji}</span>}
        {label}
      </p>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GroupDot
// ─────────────────────────────────────────────────────────────────────────────
function GroupDot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      className="rounded-full flex-shrink-0 ring-2 ring-white"
      style={{ width: size, height: size, background: color, display: 'inline-block' }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AppLayout
// ─────────────────────────────────────────────────────────────────────────────
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const supabase = createClient()

  const [groups, setGroups]                     = useState<Group[]>([])
  const [activeGroup, setActiveGroup]           = useState<Group | null>(null)
  const [currentUser, setCurrentUser]           = useState<CurrentUser | null>(null)
  const [groupSwitcherOpen, setGroupSwitcherOpen] = useState(false)
  const [loading, setLoading]                   = useState(true)
  const switcherRef                             = useRef<HTMLDivElement>(null)

  // ── Fermer le switcher au clic extérieur ───────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setGroupSwitcherOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Charger session + groupes ──────────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user
        if (!user) { setLoading(false); return }

        const { data: playerData, error: playerError } = await supabase
          .from('players').select('id, first_name, surname').eq('user_id', user.id).single()
        if (playerError || !playerData) { setLoading(false); return }

        const initials = (
          (playerData.first_name?.[0] ?? '') + (playerData.surname?.[0] ?? '')
        ).toUpperCase()
        setCurrentUser({ initials, name: `${playerData.first_name} ${playerData.surname}` })

        const { data, error } = await supabase
          .from('groups_players')
          .select(`role, groups(id, name, color)`)
          .eq('player_id', playerData.id)
        if (error) { setLoading(false); return }

        const fetchedGroups: Group[] = (data ?? [])
          .filter((row: any) => row.groups)
          .map((row: any, index: number) => ({
            id:    row.groups.id,
            name:  row.groups.name,
            color: row.groups.color ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length],
            role:  row.role as 'owner' | 'member',
          }))

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

  // ── Sync activeGroup à l'URL ───────────────────────────────────────────────
  useEffect(() => {
    if (groups.length === 0) return
    const urlGroupId = pathname.match(/\/groups\/([^/]+)/)?.[1]
    if (urlGroupId) {
      const match = groups.find(g => g.id === urlGroupId)
      if (match) setActiveGroup(match)
    }
  }, [pathname, groups])

  // ── Helpers ────────────────────────────────────────────────────────────────
  const isActive    = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // isExactActive — pour les items qui ne doivent pas matcher les sous-routes d'un autre item
  const isGroupsActive = pathname === '/groups' || pathname === '/groups/add'
  const gid         = activeGroup?.id
  const isAnyOwner  = groups.some(g => g.role === 'owner')

  const eventsHref    = isAnyOwner ? (gid ? `/groups/${gid}/events`    : '/groups') : '/not-owner'
  const templatesHref = isAnyOwner ? (gid ? `/groups/${gid}/templates` : '/groups') : '/not-owner'
  const groupsHref    = isAnyOwner ? '/groups' : '/not-owner'
  const clubsHref     = isAnyOwner ? '/admin/clubs' : '/not-owner'

  // ── Bottom nav mobile (5 items) ────────────────────────────────────────────
  const bottomNavItems = [
    { href: '/my-events', icon: Icons.myEvents,  label: 'Events'   },
    { href: '/calendar',  icon: Icons.calendar,  label: 'Calendar' },
    { href: eventsHref,   icon: Icons.events,    label: 'Agenda'   },
    { href: '/scorecard', icon: Icons.scorecard, label: 'Scores'   },
    { href: groupsHref,   icon: Icons.groups,    label: 'Groups'   },
  ]

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">

      {/* ════════════════════════════════════════════════════════════════════
          TOPBAR
      ════════════════════════════════════════════════════════════════════ */}
      <header className="h-[56px] bg-[#185FA5] flex items-center flex-shrink-0 z-30 shadow-md shadow-blue-900/20">
        <div className="max-w-[1280px] w-full mx-auto flex items-center">

          {/* Zone logo — largeur = sidebar pour alignement parfait */}
          <div className="flex items-center flex-shrink-0 w-[60px] sm:w-[60px] lg:w-[220px]">
            <Link href="/groups" className="flex items-center gap-2.5 select-none px-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo/GG_Favicon.png"
                alt=""
                className="h-[30px] w-[30px] object-contain rounded-lg flex-shrink-0"
              />
              <span className="hidden lg:flex items-baseline leading-none">
                <span className="text-[18px] font-black text-white tracking-tight">Golf</span>
                <span className="text-[18px] font-black tracking-tight" style={{ color: '#4CAF1A' }}>Go</span>
              </span>
            </Link>
          </div>

          {/* Séparateur vertical aligné bord droit sidebar */}
          <div className="w-px h-full bg-white/20 flex-shrink-0 self-stretch" />

          {/* Zone contenu topbar */}
          <div className="flex items-center gap-4 flex-1 px-4">

          {/* Group Switcher */}
          {loading ? (
            <div className="h-8 w-48 rounded-full bg-white/15 animate-pulse" />
          ) : activeGroup ? (
            <div className="relative" ref={switcherRef}>
              <button
                onClick={() => setGroupSwitcherOpen(v => !v)}
                className="flex items-center gap-2.5 bg-white/15 hover:bg-white/22 border border-white/20 rounded-full pl-2.5 pr-3 py-1.5 transition-all duration-150 cursor-pointer"
              >
                <GroupDot color={activeGroup.color} size={9} />
                <span className="text-[13px] font-semibold text-white leading-none max-w-[140px] sm:max-w-[200px] truncate">
                  {activeGroup.name}
                </span>
                <span className={`text-white/60 transition-transform duration-200 ${groupSwitcherOpen ? 'rotate-180' : ''}`}>
                  {Icons.chevronDown}
                </span>
              </button>

              {/* Dropdown */}
              {groupSwitcherOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-900/10 py-2 z-50 overflow-hidden">
                  <div className="px-4 pt-2 pb-3 border-b border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      Mes groupes
                    </span>
                  </div>
                  <div className="py-1 max-h-64 overflow-y-auto">
                    {groups.map(group => (
                      <button
                        key={group.id}
                        onClick={() => { setActiveGroup(group); setGroupSwitcherOpen(false) }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left ${
                          activeGroup.id === group.id ? 'bg-blue-50/60' : ''
                        }`}
                      >
                        <GroupDot color={group.color} size={10} />
                        <span className="text-[13.5px] text-slate-800 font-medium flex-1 truncate">
                          {group.name}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                          group.role === 'owner'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {group.role === 'owner' ? 'Admin' : 'Membre'}
                        </span>
                        {activeGroup.id === group.id && (
                          <span className="text-[#185FA5] flex-shrink-0">{Icons.check}</span>
                        )}
                      </button>
                    ))}
                  </div>
                  {isAnyOwner && (
                    <div className="border-t border-slate-100 mt-1 pt-2 px-4 pb-1">
                      <Link
                        href="/groups/add"
                        onClick={() => setGroupSwitcherOpen(false)}
                        className="flex items-center gap-2 text-[13px] text-[#185FA5] font-semibold hover:text-[#0C447C] transition-colors py-1"
                      >
                        <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-[#185FA5]">
                          {Icons.plus}
                        </span>
                        Nouveau groupe
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/groups/add"
              className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 border-dashed rounded-full px-3 py-1.5 transition-colors"
            >
              <span className="text-white/50">{Icons.plus}</span>
              <span className="text-[13px] text-white/60 font-medium leading-none">Créer un groupe</span>
            </Link>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Avatar / Login */}
          {currentUser ? (
            <Link href="/settings" title={currentUser.name} className="flex-shrink-0">
              <div className="w-[34px] h-[34px] rounded-full bg-[#4CAF1A] flex items-center justify-center text-[12px] font-black text-white select-none ring-2 ring-white/30 hover:ring-white/60 transition-all cursor-pointer">
                {currentUser.initials}
              </div>
            </Link>
          ) : (
            <Link
              href="/login"
              className="w-[34px] h-[34px] rounded-full bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors flex-shrink-0"
              title="Se connecter"
            >
              {Icons.user}
            </Link>
          )}
          </div>{/* fin zone contenu topbar */}
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════════════
          BODY
      ════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 max-w-[1280px] w-full mx-auto">

        {/* ── Sidebar desktop (≥ 1024px) — labels complets ─────────────────── */}
        <aside className="hidden lg:flex w-[220px] flex-shrink-0 flex-col py-6 px-3 gap-1 bg-white border-r border-slate-200/80">
          <SidebarSection label="PLAY" emoji="⛳">
            <NavItem href="/my-events" icon={Icons.myEvents} iconColor="#185FA5"  label="My Events"    active={isActive('/my-events')} />
            <NavItem href="/calendar"  icon={Icons.calendar} iconColor="#1D9E75"  label="My Calendar"  active={isActive('/calendar')} />
            <NavItem href="/scorecard" icon={Icons.scorecard} iconColor="#D85A30" label="My Scorecard" active={isActive('/scorecard')} />
          </SidebarSection>

          <div className="mx-2 my-3 h-px bg-slate-100" />

          <SidebarSection label="ORGANISER" emoji="🏆">
            <NavItem href={groupsHref}    icon={Icons.groups} iconColor="#7F77DD"    label="Groups"    active={isGroupsActive} />
            <NavItem
              href={eventsHref}
              icon={Icons.events}
              iconColor="#185FA5"
              label="Events"
              active={!isAnyOwner ? false : !!gid && isActive(`/groups/${gid}/events`)}
            />
            <NavItem href={clubsHref}     icon={Icons.clubs} iconColor="#EF9F27"     label="Clubs"     active={isAnyOwner && isActive('/admin/clubs')} />
            <NavItem
              href={templatesHref}
              icon={Icons.templates}
              iconColor="#D4537E"
              label="Templates"
              active={!!gid && isActive(`/groups/${gid}/templates`)}
            />
          </SidebarSection>

          <div className="mt-auto">
            <div className="mx-2 mb-3 h-px bg-slate-100" />
            <NavItem href="/settings" icon={Icons.settings} iconColor="#888780" label="Settings" active={isActive('/settings')} muted />
          </div>
        </aside>

        {/* ── Sidebar tablette (640–1023px) — icônes seules + tooltips ──────── */}
        <aside className="hidden sm:flex lg:hidden w-[60px] flex-shrink-0 flex-col items-center py-5 gap-1 bg-white border-r border-slate-200/80">
          {/* Section Play */}
          <div className="flex flex-col items-center gap-1 w-full px-2.5">
            <NavIconItem href="/my-events" icon={Icons.myEvents} iconColor="#185FA5"  label="My Events"    active={isActive('/my-events')} />
            <NavIconItem href="/calendar"  icon={Icons.calendar} iconColor="#1D9E75"  label="My Calendar"  active={isActive('/calendar')} />
            <NavIconItem href="/scorecard" icon={Icons.scorecard} iconColor="#D85A30" label="My Scorecard" active={isActive('/scorecard')} />
          </div>

          <div className="w-8 h-px bg-slate-100 my-2" />

          {/* Section Organiser */}
          <div className="flex flex-col items-center gap-1 w-full px-2.5">
            <NavIconItem href={groupsHref}    icon={Icons.groups} iconColor="#7F77DD"    label="Groups"    active={isGroupsActive} />
            <NavIconItem
              href={eventsHref}
              icon={Icons.events}
              iconColor="#185FA5"
              label="Events"
              active={!isAnyOwner ? false : !!gid && isActive(`/groups/${gid}/events`)}
            />
            <NavIconItem href={clubsHref}     icon={Icons.clubs} iconColor="#EF9F27"     label="Clubs"     active={isAnyOwner && isActive('/admin/clubs')} />
            <NavIconItem
              href={templatesHref}
              icon={Icons.templates}
              iconColor="#D4537E"
              label="Templates"
              active={!!gid && isActive(`/groups/${gid}/templates`)}
            />
          </div>

          {/* Settings en bas */}
          <div className="mt-auto flex flex-col items-center gap-1 w-full px-2.5">
            <div className="w-8 h-px bg-slate-100 mb-2" />
            <NavIconItem href="/settings" icon={Icons.settings} iconColor="#888780" label="Settings (bientôt)" active={isActive('/settings')} muted />
          </div>
        </aside>

        {/* ── Main content ──────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto pb-20 sm:pb-0 min-h-0 bg-slate-50">
          {children}
        </main>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          BOTTOM NAV — mobile uniquement (< 640px)
      ════════════════════════════════════════════════════════════════════ */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 flex items-stretch"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {bottomNavItems.map(item => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex flex-col items-center justify-center gap-1 flex-1 py-2.5 transition-colors relative"
            >
              {/* Indicateur actif en haut du tab */}
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-[#185FA5] rounded-b-full" />
              )}
              <span
                style={{
                  width: 22, height: 22,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: active ? '#185FA5' : '#94A3B8',
                  transform: active ? 'scale(1.1)' : 'scale(1)',
                  transition: 'transform 0.15s, color 0.15s',
                }}
              >
                {item.icon}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: active ? 700 : 500,
                  color: active ? '#185FA5' : '#94A3B8',
                  lineHeight: 1,
                  transition: 'color 0.15s',
                }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

    </div>
  )
}

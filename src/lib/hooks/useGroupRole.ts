'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Role = 'owner' | 'member' | null

export function useGroupRole(groupId: string | undefined): { role: Role; loading: boolean } {
  const [role, setRole] = useState<Role>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!groupId) { setLoading(false); return }
    loadRole()
  }, [groupId])

  async function loadRole() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { setLoading(false); return }

      // Trouver le player via user_id
      const { data: player } = await supabase
        .from('players')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!player) { setLoading(false); return }

      // Rôle dans ce groupe
      const { data: gp } = await supabase
        .from('groups_players')
        .select('role')
        .eq('group_id', groupId)
        .eq('player_id', player.id)
        .single()

      setRole((gp?.role as Role) ?? 'member')
    } catch {
      setRole('member')
    } finally {
      setLoading(false)
    }
  }

  return { role, loading }
}

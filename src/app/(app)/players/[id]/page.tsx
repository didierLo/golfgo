'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Player = {
  id: string
  first_name: string
  surname: string
  whs: number | null
  federal_no: string | null
  email: string | null
  phone: string | null
  home_club: string | null
}

export default function PlayerPage() {
  const router   = useRouter()
  const params   = useParams()
  const playerId = params.id as string

  const [player, setPlayer]   = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadPlayer() {
      const { data, error } = await supabase
        .from('players').select('*').eq('id', playerId).single()
      if (error) { router.push('/my-events'); return }
      setPlayer(data)
      setLoading(false)
    }
    loadPlayer()
  }, [playerId])

  if (loading) return (
    <div className="p-6 space-y-3 max-w-lg">
      {[1,2,3].map(i => <div key={i} className="h-12 bg-white/40 rounded-xl animate-pulse" />)}
    </div>
  )

  if (!player) return null

  return (
    <div className="p-5 sm:p-6 max-w-lg">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-black text-slate-900 tracking-tight">
          {player.first_name} {player.surname}
        </h1>
        {player.federal_no && (
          <p className="text-[13px] text-slate-500 mt-0.5">N° fédéral {player.federal_no}</p>
        )}
      </div>

      {/* Infos */}
      <div className="rounded-xl border border-white/60 shadow-sm overflow-hidden mb-5" style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
        {[
          { label: 'WHS',        value: player.whs ?? '—'        },
          { label: 'Email',      value: player.email || '—'      },
          { label: 'Téléphone',  value: player.phone || '—'      },
          { label: 'Club home',  value: player.home_club || '—'  },
        ].map((row, i, arr) => (
          <div key={row.label} className={`flex items-center gap-4 px-4 py-3 ${i < arr.length - 1 ? 'border-b border-white/30' : ''}`}>
            <span className="text-[12px] font-semibold text-slate-500 w-24 flex-shrink-0">{row.label}</span>
            <span className="text-[13px] text-slate-900">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <button
        onClick={() => router.push(`/players/${player.id}/edit`)}
        className="bg-[#185FA5] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0C447C] transition-colors"
      >
        Modifier
      </button>

    </div>
  )
}

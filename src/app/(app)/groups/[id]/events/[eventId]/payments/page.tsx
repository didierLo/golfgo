'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useGroupRole } from '@/lib/hooks/useGroupRole'

const supabase = createClient()

type PaymentStatus = 'PENDING' | 'PAID' | 'EXEMPT'

type Participant = {
  player_id: string
  payment_status: PaymentStatus
  players: { first_name: string; surname: string }
}

const STATUS_STYLE: Record<PaymentStatus, { label: string; bg: string; text: string }> = {
  PAID:    { label: 'Payé',    bg: '#EAF3DE', text: '#3B6D11' },
  PENDING: { label: 'En attente', bg: '#FAEEDA', text: '#854F0B' },
  EXEMPT:  { label: 'Exempté', bg: '#F1EFE8', text: '#5F5E5A' },
}

export default function PaymentsPage() {
  const params = useParams()
  const groupId  = params.id as string
  const eventId  = params.eventId as string

  const { role, loading: roleLoading } = useGroupRole(groupId)
  const isOwner = role === 'owner'

  const [participants, setParticipants] = useState<Participant[]>([])
  const [fee, setFee]                   = useState<number | null>(null)
  const [loading, setLoading]           = useState(true)
  const [updating, setUpdating]         = useState<string | null>(null)

  useEffect(() => { loadData() }, [eventId])

  async function loadData() {
    setLoading(true)

    const { data: event } = await supabase
      .from('events').select('fee_per_person').eq('id', eventId).single()
    setFee(event?.fee_per_person ?? null)

    const { data } = await supabase
      .from('event_participants')
      .select(`player_id, payment_status, players(first_name, surname)`)
      .eq('event_id', eventId)
      .eq('status', 'GOING')
      .order('surname', { foreignTable: 'players', ascending: true })

    setParticipants(data || [])
    setLoading(false)
  }

  async function updatePayment(playerId: string, status: PaymentStatus) {
    if (!isOwner) return
    setUpdating(playerId)
    await supabase
      .from('event_participants')
      .update({ payment_status: status })
      .eq('event_id', eventId)
      .eq('player_id', playerId)
    setParticipants(prev => prev.map(p =>
      p.player_id === playerId ? { ...p, payment_status: status } : p
    ))
    setUpdating(null)
  }

  const paidCount    = participants.filter(p => p.payment_status === 'PAID').length
  const pendingCount = participants.filter(p => p.payment_status === 'PENDING').length
  const exemptCount  = participants.filter(p => p.payment_status === 'EXEMPT').length
  const totalDue     = fee ? fee * pendingCount : null
  const totalCollected = fee ? fee * paidCount : null

  if (loading || roleLoading) return (
    <div className="p-6 space-y-2">
      {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-6">

      {!isOwner && (
        <div className="mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md text-[12px] text-blue-700">
          Vue en lecture seule — seul l'organisateur peut modifier les paiements
        </div>
      )}

      {/* Résumé financier */}
      {fee && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-5">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Résumé financier
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-gray-200 rounded-md p-3 text-center">
              <div className="text-[11px] text-gray-400 mb-1">Frais / personne</div>
              <div className="text-[18px] font-medium text-gray-900">{fee} €</div>
            </div>
            <div className="bg-white border border-green-100 rounded-md p-3 text-center">
              <div className="text-[11px] text-gray-400 mb-1">Collecté</div>
              <div className="text-[18px] font-medium text-green-700">{totalCollected} €</div>
              <div className="text-[10px] text-gray-400">{paidCount} payé{paidCount !== 1 ? 's' : ''}</div>
            </div>
            <div className="bg-white border border-amber-100 rounded-md p-3 text-center">
              <div className="text-[11px] text-gray-400 mb-1">En attente</div>
              <div className="text-[18px] font-medium text-amber-600">{totalDue} €</div>
              <div className="text-[10px] text-gray-400">{pendingCount} en attente</div>
            </div>
          </div>
        </div>
      )}

      {/* Compteurs */}
      <div className="flex gap-3 mb-5">
        {[
          { n: paidCount,    color: '#3B6D11', label: 'payés' },
          { n: pendingCount, color: '#854F0B', label: 'en attente' },
          { n: exemptCount,  color: '#5F5E5A', label: 'exemptés' },
          { n: participants.length, color: '#185FA5', label: 'total' },
        ].map(({ n, color, label }) => (
          <div key={label} className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 flex flex-col items-center min-w-[72px]">
            <span className="text-[20px] font-medium" style={{ color }}>{n}</span>
            <span className="text-[11px] text-gray-400">{label}</span>
          </div>
        ))}
      </div>

      {/* Liste */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className={`grid gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-200 ${
          isOwner ? 'grid-cols-[1fr_120px_200px]' : 'grid-cols-[1fr_120px]'
        }`}>
          <span className="text-[12px] font-medium text-gray-400">Joueur</span>
          <span className="text-[12px] font-medium text-gray-400">Statut</span>
          {isOwner && <span className="text-[12px] font-medium text-gray-400 text-right">Actions</span>}
        </div>

        {participants.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-gray-400">
            Aucun participant confirmé (GOING)
          </div>
        ) : (
          participants.map((p, i) => {
            const s = STATUS_STYLE[p.payment_status ?? 'PENDING']
            const isUpdating = updating === p.player_id
            return (
              <div key={p.player_id}
                className={`grid gap-4 px-4 py-3 items-center ${
                  isOwner ? 'grid-cols-[1fr_120px_200px]' : 'grid-cols-[1fr_120px]'
                } ${i < participants.length - 1 ? 'border-b border-gray-100' : ''}`}>

                <div className="text-[13px] font-medium text-gray-900">
                  {p.players.first_name} {p.players.surname}
                  {fee && (
                    <span className="text-[11px] text-gray-400 font-normal ml-2">{fee} €</span>
                  )}
                </div>

                <div>
                  <span className="text-[11px] font-medium px-2.5 py-1 rounded-full"
                    style={{ background: s.bg, color: s.text }}>
                    {s.label}
                  </span>
                </div>

                {isOwner && (
                  <div className="flex justify-end gap-1">
                    {(['PAID', 'PENDING', 'EXEMPT'] as PaymentStatus[]).map(status => (
                      <button key={status} type="button"
                        disabled={isUpdating || p.payment_status === status}
                        onClick={() => updatePayment(p.player_id, status)}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors disabled:opacity-40 ${
                          p.payment_status === status
                            ? status === 'PAID'    ? 'bg-[#EAF3DE] border-[#C0DD97] text-[#3B6D11]'
                            : status === 'PENDING' ? 'bg-[#FAEEDA] border-[#F5D5A0] text-[#854F0B]'
                            :                       'bg-[#F1EFE8] border-[#D8D5CC] text-[#5F5E5A]'
                            : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                        }`}>
                        {status === 'PAID' ? 'Payé' : status === 'PENDING' ? 'En attente' : 'Exempter'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useGroupRole } from '@/lib/hooks/useGroupRole'
import { useTranslations } from 'next-intl'

const supabase = createClient()

type PaymentStatus = 'PENDING' | 'PAID' | 'EXEMPT'
type Participant = {
  player_id: string
  payment_status: PaymentStatus
  players: { first_name: string; surname: string }
}

const STATUS_STYLE: Record<PaymentStatus, { bg: string; text: string }> = {
  PAID:    { bg: '#EAF3DE', text: '#3B6D11' },
  PENDING: { bg: '#FAEEDA', text: '#854F0B' },
  EXEMPT:  { bg: '#F1F5F9', text: '#475569' },
}

export default function PaymentsPage() {
  const params  = useParams()
  const groupId = params.id as string
  const eventId = params.eventId as string
  const t       = useTranslations()

  const { role, loading: roleLoading } = useGroupRole(groupId)
  const isOwner = role === 'owner'

  const [participants, setParticipants] = useState<Participant[]>([])
  const [fee, setFee]                   = useState<number | null>(null)
  const [loading, setLoading]           = useState(true)
  const [updating, setUpdating]         = useState<string | null>(null)
   
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
   useEffect(() => { loadData() }, [eventId])

   useEffect(() => {
      supabase.auth.getUser().then(({ data }) => {
        setCurrentUserId(data.user?.id ?? null)
      })
    }, [])


  async function loadData() {
    setLoading(true)
    const { data: event } = await supabase.from('events').select('fee_per_person').eq('id', eventId).single()
    setFee(event?.fee_per_person ?? null)
    const { data } = await supabase
      .from('event_participants')
      .select(`player_id, payment_status, players(first_name, surname)`)
      .eq('event_id', eventId).eq('status', 'GOING')
      .order('surname', { foreignTable: 'players', ascending: true })
    setParticipants((data || []) as any)
    setLoading(false)
  }

  async function updatePayment(playerId: string, status: PaymentStatus) {
    if (!isOwner) return
    setUpdating(playerId)
    await supabase.from('event_participants').update({ payment_status: status })
      .eq('event_id', eventId).eq('player_id', playerId)
    setParticipants(prev => prev.map(p =>
      p.player_id === playerId ? { ...p, payment_status: status } : p
    ))
    setUpdating(null)
  }

  async function handlePay(playerId: string, amount: number) {
    const res = await fetch('/api/payments/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        groupId,
        playerId,
        amount,
        description: `Inscription événement`,
        locale: params.locale as string,
      }),
    })
    const { url } = await res.json()
    window.location.href = url
  }

  const paidCount    = participants.filter(p => p.payment_status === 'PAID').length
  const pendingCount = participants.filter(p => p.payment_status === 'PENDING').length
  const exemptCount  = participants.filter(p => p.payment_status === 'EXEMPT').length

  if (loading || roleLoading) return (
    <div className="p-6 space-y-2">
      {[1,2,3].map(i => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="p-5 sm:p-6">

      {!isOwner && (
        <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-[12px] text-blue-700 font-medium">
          {t('payments.readOnly')}
        </div>
      )}

      {fee && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">{t('payments.summary')}</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{t('payments.feePerPerson')}</div>
              <div className="text-[20px] font-black text-slate-900">{fee} €</div>
            </div>
            <div className="bg-[#EAF3DE] border border-[#C0DD97] rounded-xl p-3 text-center">
              <div className="text-[10px] font-semibold text-[#3B6D11] uppercase tracking-wide mb-1">{t('payments.collected')}</div>
              <div className="text-[20px] font-black text-[#3B6D11]">{fee * paidCount} €</div>
              <div className="text-[10px] text-[#3B6D11] opacity-70">{paidCount} {t('payments.paid')}</div>
            </div>
            <div className="bg-[#FAEEDA] border border-[#F5D5A0] rounded-xl p-3 text-center">
              <div className="text-[10px] font-semibold text-[#854F0B] uppercase tracking-wide mb-1">{t('payments.pending')}</div>
              <div className="text-[20px] font-black text-[#854F0B]">{fee * pendingCount} €</div>
              <div className="text-[10px] text-[#854F0B] opacity-70">{pendingCount} {t('payments.awaitingPayment')}</div>
            </div>
          </div>
        </div>
      )}


      <div className="flex gap-3 mb-5">
        {[
          { n: paidCount,           color: '#3B6D11', bg: '#EAF3DE', label: t('payments.paid')           },
          { n: pendingCount,        color: '#854F0B', bg: '#FAEEDA', label: t('payments.awaitingPayment') },
          { n: exemptCount,         color: '#475569', bg: '#F1F5F9', label: t('payments.exempt')          },
          { n: participants.length, color: '#185FA5', bg: '#EBF3FC', label: t('payments.total')           },
        ].map(({ n, color, bg, label }) => (
          <div key={label} className="border border-slate-200 rounded-xl px-4 py-2.5 flex flex-col items-center min-w-[72px]"
            style={{ background: bg }}>
            <span className="text-[20px] font-black" style={{ color }}>{n}</span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className={`grid gap-4 px-4 py-3 bg-slate-50 border-b border-slate-100 ${
          isOwner ? 'grid-cols-[1fr_120px_200px]' : 'grid-cols-[1fr_120px]'
        }`}>
          <span className="text-[12px] font-semibold text-slate-500">{t('payments.player')}</span>
          <span className="text-[12px] font-semibold text-slate-500">{t('payments.status')}</span>
          {isOwner && <span className="text-[12px] font-semibold text-slate-500 text-right">{t('payments.actions')}</span>}
        </div>

        {participants.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-slate-500">
            {t('payments.noParticipants')}
          </div>
        ) : (
          participants.map((p, i) => {
            const s = STATUS_STYLE[p.payment_status ?? 'PENDING']
            const isUpdating = updating === p.player_id
            return (
              <div key={p.player_id}
                className={`grid gap-4 px-4 py-3 items-center ${
                  isOwner ? 'grid-cols-[1fr_120px_200px]' : 'grid-cols-[1fr_120px]'
                } ${i < participants.length - 1 ? 'border-b border-slate-100' : ''}`}>
                <div className="text-[13px] font-semibold text-slate-900">
                  {p.players.first_name} {p.players.surname}
                  {fee && <span className="text-[11px] text-slate-400 font-normal ml-2">{fee} €</span>}
                </div>
                <div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: s.bg, color: s.text }}>
                    {t(`payments.statuses.${p.payment_status ?? 'PENDING'}` as any)}
                  </span>
                </div>

                {p.player_id === currentUserId && p.payment_status === 'PENDING' && (
                  <button onClick={() => handlePay(p.player_id, fee!)}
                    className="text-[11px] font-semibold px-3 py-1 rounded-lg bg-[#185FA5] text-white">
                    Payer {fee} €
                  </button>
                )}

                {isOwner && (
                  <div className="flex justify-end gap-1">
                    {(['PAID', 'PENDING', 'EXEMPT'] as PaymentStatus[]).map(status => (
                      <button key={status} type="button"
                        disabled={isUpdating || p.payment_status === status}
                        onClick={() => updatePayment(p.player_id, status)}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-40 ${
                          p.payment_status === status
                            ? status === 'PAID'    ? 'bg-[#EAF3DE] border-[#C0DD97] text-[#3B6D11]'
                            : status === 'PENDING' ? 'bg-[#FAEEDA] border-[#F5D5A0] text-[#854F0B]'
                            :                       'bg-[#F1F5F9] border-[#CBD5E1] text-[#475569]'
                            : 'border-slate-200 text-slate-400 hover:bg-slate-50'
                        }`}>
                        {t(`payments.buttons.${status}` as any)}
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

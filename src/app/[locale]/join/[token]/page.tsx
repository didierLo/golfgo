'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLocale } from 'next-intl'

const supabase = createClient()

type GroupInfo = { id: string; name: string; color: string | null }
type LinkInfo  = { id: string; group_id: string; expires_at: string; groups: GroupInfo }

type State = 'loading' | 'invalid' | 'expired' | 'already_member' | 'pending' | 'ready' | 'success' | 'need_auth'

export default function JoinPage() {
  const params = useParams()
  const token  = params.token as string
  const router = useRouter()
  const locale = useLocale()

  const [state,     setState]     = useState<State>('loading')
  const [linkInfo,  setLinkInfo]  = useState<LinkInfo | null>(null)
  const [playerId,  setPlayerId]  = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { load() }, [token])

  async function load() {
    // 1. Vérifier le lien
    const { data: link, error } = await supabase
      .from('group_invite_links')
      .select('id, group_id, expires_at, groups(id, name, color)')
      .eq('token', token)
      .maybeSingle()

    if (error || !link) { setState('invalid'); return }

    if (new Date(link.expires_at) < new Date()) { setState('expired'); setLinkInfo(link as any); return }

    setLinkInfo(link as any)

    // 2. Vérifier si l'utilisateur est connecté
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setState('need_auth'); return }

    // 3. Vérifier si l'utilisateur a une fiche player
    const { data: player } = await supabase
      .from('players').select('id').eq('user_id', user.id).maybeSingle()

    if (!player) { setState('need_auth'); return }

    setPlayerId(player.id)

    // 4. Vérifier si déjà membre
    const { data: existing } = await supabase
      .from('groups_players')
      .select('id')
      .eq('group_id', link.group_id)
      .eq('player_id', player.id)
      .maybeSingle()

    if (existing) { setState('already_member'); return }

    // 5. Vérifier si demande déjà en attente
    const { data: pending } = await supabase
      .from('group_join_requests')
      .select('id')
      .eq('group_id', link.group_id)
      .eq('player_id', player.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (pending) { setState('pending'); return }

    setState('ready')
  }

  async function requestJoin() {
    if (!linkInfo || !playerId) return
    setSubmitting(true)
    const { error } = await supabase.from('group_join_requests').insert({
      group_id:  linkInfo.group_id,
      player_id: playerId,
      token,
    })
    if (error) { console.error(error); setSubmitting(false); return }
    setState('success')
    setSubmitting(false)
  }

  const group = linkInfo?.groups
  const groupColor = group?.color ?? '#185FA5'

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(135deg, #1a3a5c 0%, #0f6e56 100%)' }}>
      <div style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.6)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        borderRadius: '20px',
        padding: '40px 32px',
        maxWidth: '420px',
        width: '100%',
        textAlign: 'center',
      }}>

        {state === 'loading' && (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-[#185FA5] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {state === 'invalid' && (
          <>
            <div className="text-4xl mb-4">❌</div>
            <h1 className="text-[18px] font-bold text-slate-900 mb-2">Lien invalide</h1>
            <p className="text-[13px] text-slate-500">Ce lien d'invitation n'existe pas ou a été révoqué.</p>
          </>
        )}

        {state === 'expired' && (
          <>
            <div className="text-4xl mb-4">⏰</div>
            <h1 className="text-[18px] font-bold text-slate-900 mb-2">Lien expiré</h1>
            <p className="text-[13px] text-slate-500">
              Ce lien d'invitation a expiré. Demandez un nouveau lien à l'organisateur du groupe
              {group ? <strong> {group.name}</strong> : ''}.
            </p>
          </>
        )}

        {state === 'need_auth' && (
          <>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4"
              style={{ background: `${groupColor}22` }}>
              ⛳
            </div>
            {group && (
              <p className="text-[12px] font-bold uppercase tracking-widest mb-1"
                style={{ color: groupColor }}>Invitation</p>
            )}
            <h1 className="text-[20px] font-bold text-slate-900 mb-2">
              {group ? `Rejoindre ${group.name}` : 'Rejoindre le groupe'}
            </h1>
            <p className="text-[13px] text-slate-500 mb-6">
              Créez un compte ou connectez-vous pour envoyer votre demande.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => router.push(`/${locale}/signup?next=/join/${token}`)}
                className="w-full bg-[#185FA5] text-white text-[13px] font-semibold py-2.5 rounded-xl hover:bg-[#0C447C] transition-colors">
                Créer un compte
              </button>
              <button
                onClick={() => router.push(`/${locale}/login?next=/join/${token}`)}
                className="w-full border border-slate-200 text-slate-700 text-[13px] font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                Se connecter
              </button>
            </div>
          </>
        )}

        {(state === 'ready') && group && (
          <>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4"
              style={{ background: `${groupColor}22` }}>
              ⛳
            </div>
            <p className="text-[12px] font-bold uppercase tracking-widest mb-1"
              style={{ color: groupColor }}>Invitation</p>
            <h1 className="text-[20px] font-bold text-slate-900 mb-2">
              Rejoindre {group.name}
            </h1>
            <p className="text-[13px] text-slate-500 mb-6">
              Votre demande sera envoyée à l'organisateur pour approbation.
            </p>
            <button onClick={requestJoin} disabled={submitting}
              className="w-full bg-[#185FA5] text-white text-[13px] font-semibold py-2.5 rounded-xl hover:bg-[#0C447C] transition-colors disabled:opacity-40">
              {submitting ? 'Envoi…' : 'Demander à rejoindre'}
            </button>
          </>
        )}

        {state === 'pending' && group && (
          <>
            <div className="text-4xl mb-4">⏳</div>
            <h1 className="text-[18px] font-bold text-slate-900 mb-2">Demande en attente</h1>
            <p className="text-[13px] text-slate-500">
              Vous avez déjà envoyé une demande pour rejoindre <strong>{group.name}</strong>.
              L'organisateur va l'examiner prochainement.
            </p>
          </>
        )}

        {state === 'already_member' && group && (
          <>
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-[18px] font-bold text-slate-900 mb-2">Déjà membre</h1>
            <p className="text-[13px] text-slate-500 mb-5">
              Vous êtes déjà membre du groupe <strong>{group.name}</strong>.
            </p>
            <button onClick={() => router.push(`/${locale}/my-events`)}
              className="w-full bg-[#185FA5] text-white text-[13px] font-semibold py-2.5 rounded-xl hover:bg-[#0C447C] transition-colors">
              Voir mes événements
            </button>
          </>
        )}

        {state === 'success' && group && (
          <>
            <div className="text-4xl mb-4">🎉</div>
            <h1 className="text-[18px] font-bold text-slate-900 mb-2">Demande envoyée !</h1>
            <p className="text-[13px] text-slate-500 mb-5">
              Votre demande pour rejoindre <strong>{group.name}</strong> a été envoyée.
              Vous recevrez une notification dès que l'organisateur l'aura approuvée.
            </p>
            <button onClick={() => router.push(`/${locale}/my-events`)}
              className="w-full bg-[#185FA5] text-white text-[13px] font-semibold py-2.5 rounded-xl hover:bg-[#0C447C] transition-colors">
              Voir mes événements
            </button>
          </>
        )}

      </div>
    </div>
  )
}

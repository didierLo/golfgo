'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { useTranslations } from 'next-intl'

const supabase = createClient()

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

// Enregistre l'abonnement du navigateur en base (upsert sur endpoint → sans doublon)
async function saveSubscription(sub: PushSubscription): Promise<boolean> {
  const json = sub.toJSON() as any
  if (!json?.endpoint || !json?.keys?.p256dh || !json?.keys?.auth) return false
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    }),
  })
  return res.ok
}

// Crée (ou récupère) l'abonnement push du navigateur
async function getOrCreateSubscription(reg: ServiceWorkerRegistration): Promise<PushSubscription> {
  const existing = await reg.pushManager.getSubscription()
  if (existing) return existing
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as BufferSource,
  })
}

export default function PushSubscribeButton() {
  const t = useTranslations()
  const [supported, setSupported]   = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading]       = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return
    setSupported(true)

    let cancelled = false

    ;(async () => {
      try {
        // Pas encore de permission accordée → on laisse le bouton « Activer »
        if (Notification.permission !== 'granted') return

        const reg = await navigator.serviceWorker.ready

        // Permission déjà accordée : on récupère l'abonnement existant,
        // ou on le recrée silencieusement s'il a disparu côté navigateur
        // (aucune nouvelle fenêtre de permission n'est affichée).
        const sub = await getOrCreateSubscription(reg)

        // On s'assure que la base connaît bien cet abonnement
        // (au cas où il aurait été purgé après une erreur 404/410)
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) await saveSubscription(sub)

        if (!cancelled) setSubscribed(true)
      } catch {
        // En cas d'échec silencieux, le bouton « Activer » reste simplement disponible
      }
    })()

    return () => { cancelled = true }
  }, [])

  async function handleSubscribe() {
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        toast.error(t('push.denied'))
        return
      }

      const reg = await navigator.serviceWorker.ready
      const sub = await getOrCreateSubscription(reg)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { toast.error(t('scorecard.notConnected')); return }

      const ok = await saveSubscription(sub)
      if (!ok) { toast.error(t('push.activationError')); return }

      setSubscribed(true)
      toast.success(t('push.activated'))
    } catch (e: any) {
      toast.error(e.message ?? t('errors.unexpected'))
    } finally {
      setLoading(false)
    }
  }

  if (!supported) return null

  return (
    <button
      onClick={handleSubscribe}
      disabled={loading || subscribed}
      className="text-[12px] font-semibold px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
    >
      {subscribed ? `🔔 ${t('push.enabled')}` : loading ? `⏳ ${t('push.enabling')}` : `🔔 ${t('push.enable')}`}
    </button>
  )
}

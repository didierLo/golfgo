'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const supabase = createClient()

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export default function PushSubscribeButton() {
  const [supported, setSupported]   = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading]       = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setSupported(true)
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription()
        setSubscribed(!!sub)
      })
    }
  }, [])

  async function handleSubscribe() {
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        toast.error('Permission refusée — active les notifications dans les réglages du navigateur')
        return
      }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as BufferSource,
      })

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { toast.error('Non connecté'); return }

      const json = sub.toJSON() as any
      const res = await fetch('/api/push/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        }),
      })

      if (!res.ok) { toast.error('Erreur lors de l\'activation'); return }

      setSubscribed(true)
      toast.success('Notifications activées sur cet appareil')
    } catch (e: any) {
      toast.error(e.message ?? 'Erreur inattendue')
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
      {subscribed ? '🔔 Notifications activées' : loading ? '⏳ Activation…' : '🔔 Activer les notifications de désistement'}
    </button>
  )
}

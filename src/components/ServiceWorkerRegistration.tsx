'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.log('[SW] Registered', reg.scope)
        })
        .catch((err) => {
          console.error('[SW] Registration failed', err)
        })
    }
  }, [])

  return null
}

export async function GET() {
  const sw = `
const CACHE_NAME = 'golfgo-v1'
const STATIC_ASSETS = ['/', '/offline.html', '/golf-bg.jpg', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET') return
  if (url.pathname.startsWith('/api/')) return
  if (url.hostname.includes('supabase')) return

  if (url.pathname.match(/\\.(png|jpg|jpeg|svg|webp|ico|css|js|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(res => {
        if (res.ok) {
        const clone = res.clone()
        caches.open(CACHE_NAME).then(c => c.put(request, clone))
        }
        return res
      }))
    )
    return
  }

  event.respondWith(
    fetch(request).catch(() => caches.match('/offline.html') || new Response('Offline', { status: 503 }))
  )
})
`
  return new Response(sw, {
    headers: {
      'Content-Type': 'application/javascript',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-cache',
    },
  })
}
const CACHE = 'takaya-v2'
const OFFLINE_URLS = ['/', '/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']

// インストール時に静的アセットをキャッシュ
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(OFFLINE_URLS).catch(() => {}))
  )
})

// 古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// ネットワーク優先・失敗時はキャッシュを返す
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  // http/https 以外（chrome-extension等）は無視
  if (!url.protocol.startsWith('http')) return
  // API・Supabase は常にネットワーク
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) return

  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res.ok && url.protocol.startsWith('http')) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(event.request, clone).catch(() => {}))
        }
        return res
      })
      .catch(() => caches.match(event.request))
  )
})

// プッシュ通知
self.addEventListener('push', event => {
  if (!event.data) return
  const { title, body, url } = event.data.json()
  event.waitUntil(
    self.registration.showNotification(title ?? '順番待ち通知', {
      body,
      icon:     '/icon-192.png',
      badge:    '/icon-192.png',
      tag:      'queue-admin',
      renotify: true,
      data:     { url },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(url) && 'focus' in client) return client.focus()
      }
      return clients.openWindow(url)
    })
  )
})

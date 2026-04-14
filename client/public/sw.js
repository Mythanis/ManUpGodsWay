const CACHE_NAME = 'man-up-gods-way-v10';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.log('Cache addAll partial failure (non-critical):', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => clients.claim()).then(() => {
      // After clearing old caches, tell all open pages to reload so they
      // pick up the new CSS instead of running with stale cached assets.
      return clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED' });
        });
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return new Response(JSON.stringify({ error: 'offline', message: 'You are currently offline' }), {
              headers: { 'Content-Type': 'application/json' },
              status: 503
            });
          });
        })
    );
    return;
  }

  // Images and fonts: stale-while-revalidate (they don't change often)
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|woff2?|webp|gif)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // JS and CSS: network-first — always fetch fresh so code updates apply immediately.
  // Only fall back to cache when completely offline.
  if (url.pathname.match(/\.(js|css)$/) || url.pathname.startsWith('/src/') || url.pathname.startsWith('/assets/') || url.pathname.startsWith('/@')) {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return response;
      }).catch(() => {
        return caches.match(request);
      })
    );
    return;
  }

  // Navigation requests (HTML pages): stale-while-revalidate so the app shell
  // appears instantly from cache while the fresh copy downloads in the background.
  // This eliminates the white flash caused by waiting on the network.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match('/').then((cached) => {
          const fetchPromise = fetch(request).then((response) => {
            if (response.ok && response.type === 'basic') {
              cache.put('/', response.clone());
            }
            return response;
          }).catch(() => cached || new Response('', { status: 408 }));
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          return new Response('', { status: 408 });
        });
      })
  );
});

self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  let data = {
    title: 'Man Up God\'s Way',
    body: 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'default',
    url: '/'
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    tag: data.tag || 'default',
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    },
    requireInteraction: data.requireInteraction || false
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, options),
      // Notify all open app windows so they can refresh data immediately
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({
            type: 'PUSH_RECEIVED',
            notificationType: data.tag || 'default',
            url: data.url || '/'
          });
        });
      })
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  // Always resolve to an absolute URL — clients.openWindow() and client.navigate()
  // require absolute URLs per spec; passing a relative path causes browsers to
  // silently open just the origin, which the SPA then routes to the join page.
  const rawUrl = event.notification.data?.url || '/';
  const urlToOpen = rawUrl.startsWith('http')
    ? rawUrl
    : new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Prefer reusing an existing app window rather than opening a new one
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => client.navigate(urlToOpen));
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
});

// Service Worker para forzar actualizaciones y mantener el sistema siempre fresco
// Estrategia: network-first con cache mínimo para modo offline

const SW_VERSION = 'v2025-08-11-01';
const CACHE_NAME = `gc-core-${SW_VERSION}`;
const CORE_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/main.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Eliminar caches viejos
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
      await self.clients.claim();
      // Opcional: recargar todas las ventanas controladas para aplicar de inmediato
      const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
      for (const client of allClients) {
        // Enviar mensaje para que la página decida si recarga
        client.postMessage({ type: 'SW_ACTIVATED', version: SW_VERSION });
      }
    })()
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Si se solicita una ruta que parece HTML y falla, devolver login/index según carpeta
  const isDocument = request.headers.get('accept')?.includes('text/html');
  // Siempre intentar red desde la red con cache: 'reload' para saltar caches del navegador
  event.respondWith(
    (async () => {
      try {
        const freshResponse = await fetch(new Request(request, { cache: 'reload' }));
        return freshResponse;
      } catch (err) {
        // Si falla (offline), intentar desde cache
        const cached = await caches.match(request, { ignoreSearch: true });
        if (cached) return cached;
        // fallback a la home si no existe
        if (isDocument) {
          // Resolver ruta correcta según profundidad
          const url = new URL(request.url);
          const inPages = url.pathname.includes('/pages/');
          const loginPath = inPages ? '../login.html' : './login.html';
          const indexPath = inPages ? '../index.html' : './index.html';
          const loginResp = await caches.match(loginPath);
          const indexResp = await caches.match(indexPath);
          return loginResp || indexResp || new Response('Offline', { status: 503, statusText: 'Offline' });
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })()
  );
});



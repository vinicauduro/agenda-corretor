const CACHE = 'agenda-corretor-v5';
const FILES = ['./', './index.html', './manifest.json', './crm/supabase.js', './crm/config.js', './crm/nuvem.js', './crm/leads.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Arquivos do app: busca a versão nova na rede e usa o cache só sem internet.
// 'no-cache' faz o navegador sempre conferir no servidor, senão o GitHub Pages
// deixa uma versão velha (por exemplo, do config.js) valendo por até 10 minutos.
// A nuvem (Supabase) e outros sites passam direto, sem cache.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then(r => {
        if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

// Aviso que chega da nuvem (lembrete ou compromisso), mesmo com o app fechado.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { corpo: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Agenda Corretor', {
    body: d.corpo || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag,
    data: { url: './' }
  }));
});

// Tocar no aviso abre o app (ou traz para a frente se já estiver aberto).
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(janelas => {
    for (const j of janelas) if ('focus' in j) return j.focus();
    return self.clients.openWindow((e.notification.data && e.notification.data.url) || './');
  }));
});

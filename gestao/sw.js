const CACHE = 'gestao-loteamento-v20';
const FILES = ['./', './index.html', './style.css', './config.js', './vendor/supabase.js', './core.js', './permissoes.js', './planta.js', './planta-pdf.js', './planta-dxf.js', './admin-pdf.js', './corretor.js', './admin.js', './indices.js', './antecipacao.js', './cobranca.js', './financeiro.js', './banco.js', './cnab.js', './relatorios.js', './docs.js', './auth.js', './vitrine.html', './vitrine.js', './manifest.json'];

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

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Rede primeiro (para pegar atualizações), cache como reserva offline.
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request))
  );
});

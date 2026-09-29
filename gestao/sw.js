/* O sistema de gestão mudou para https://vinicauduro.github.io/lotifly/. Esta versão do
   service worker só existe para desligar a antiga: apaga a memória offline dela, sai de cena
   e recarrega as abas abertas, que então caem na página de redirecionamento. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('gestao-loteamento-')).map(k => caches.delete(k)));
    await self.registration.unregister();
    const abas = await self.clients.matchAll({ type: 'window' });
    abas.forEach(c => c.navigate(c.url));
  })());
});

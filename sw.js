/* Minha Pregação: guarda o app no celular para abrir sem internet. */
const VERSAO = 'minha-pregacao-v4';
const FONTES = 'minha-pregacao-fontes';
const RECEBIDOS = 'minha-pregacao-recebidos';
const ARQUIVOS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSAO).then(cache => cache.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSAO && k !== FONTES && k !== RECEBIDOS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Arquivo compartilhado com o app pelo celular (Android: Compartilhar > Pregação).
  if (req.method === 'POST' && url.pathname.endsWith('/receber-territorios')) {
    event.respondWith((async () => {
      try {
        const form = await req.formData();
        const file = form.get('arquivo');
        if (file && typeof file.text === 'function') {
          const cache = await caches.open(RECEBIDOS);
          await cache.put('./recebido.txt', new Response(await file.text(), { headers: { 'content-type': 'text/plain; charset=utf-8' } }));
        }
      } catch (e) { /* ignora */ }
      return Response.redirect(new URL('./#inicio', self.registration.scope).href, 303);
    })());
    return;
  }
  if (req.method !== 'GET') return;

  // Chave do mapa: sempre busca na internet, para valer logo depois que for trocada no site.
  if (url.origin === self.location.origin && url.pathname.endsWith('/chave-mapa.txt')) return;

  // Páginas: tenta a internet primeiro (sem cache velho, para receber atualizações na hora); sem internet, usa a cópia guardada.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-cache' })
        .catch(() => fetch(req))
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSAO).then(c => c.put('./index.html', copy)); }
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // Arquivos do próprio app: usa a cópia guardada.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSAO).then(c => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // Letra do Google Fonts: guarda para funcionar sem internet.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(FONTES).then(cache => cache.match(req).then(hit => {
        const net = fetch(req).then(res => {
          if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
          return res;
        }).catch(() => hit);
        return hit || net;
      }))
    );
  }
});

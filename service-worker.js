const CACHE_NAME = 'meu-site-cache-v1';
const MUSIC_CACHE = 'musicas-cache';
const STATIC_FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/icons/musica.png',
  '/manifest.json'
];

// Instalação: cache dos arquivos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_FILES))
  );
});

// Fetch: intercepta todas as requisições
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Músicas
  if (url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/songs/')) {
    event.respondWith(
      caches.open(MUSIC_CACHE).then((cache) =>
        cache.match(event.request).then((res) => {
          if (res) return res;
          return fetch(event.request).then((response) => {
            cache.put(event.request, response.clone());
            return response;
          }).catch(() => new Response(null, { status: 404 }));
        })
      )
    );
  } else {
    // Arquivos estáticos e página principal
    event.respondWith(
      caches.match(event.request).then((res) => {
        if (res) return res;
        return fetch(event.request).catch(() => {
          if (event.request.destination === 'document' || event.request.url.endsWith('.html')) {
            return caches.match('/index.html');
          }
          return new Response(null, { status: 503, statusText: 'Offline' });
        });
      })
    );
  }
});

// Ativação: limpa caches antigos
self.addEventListener('activate', (event) => {
  const whitelist = [CACHE_NAME, MUSIC_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (whitelist.includes(k) ? null : caches.delete(k))))
    )
  );
});

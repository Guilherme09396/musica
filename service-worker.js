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

// Instalação e cache de arquivos estáticos
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_FILES))
  );
});

// Atender requisições
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Se for música (ou seja, URL de uploads ou /songs/)
  if (url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/songs/')) {
    event.respondWith(
      caches.open(MUSIC_CACHE).then((cache) =>
        cache.match(event.request).then((res) => {
          if (res) return res; // retorna do cache
          return fetch(event.request).then((response) => {
            cache.put(event.request, response.clone()); // salva no cache
            return response;
          }).catch(() => new Response('', { status: 404 }));
        })
      )
    );
  } else {
    // Arquivos estáticos
    event.respondWith(
      caches.match(event.request).then((res) => res || fetch(event.request))
    );
  }
});

// Ativação: limpa caches antigos
self.addEventListener('activate', (event) => {
  const whitelist = [CACHE_NAME, MUSIC_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => (whitelist.includes(k) ? null : caches.delete(k)))
      )
    )
  );
});

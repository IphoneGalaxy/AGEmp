/**
 * Service Worker — Finanças Pro PWA
 *
 * Estratégia:
 * - PRE-CACHE: Shell do app (HTML, ícones, manifest) no install
 * - RUNTIME CACHE: Assets do build (JS/CSS com hash) → Cache First
 * - NAVIGATION: Network First com fallback para cache
 * - DADOS: Nunca intercepta localStorage nem dados dinâmicos
 *
 * ⚠️  IMPORTANTE: Este SW cacheia apenas o shell da aplicação.
 *     Os dados do usuário ficam no localStorage e NÃO são afetados.
 */

const CACHE_VERSION = 'v2';
const CACHE_NAME = `financas-pro-${CACHE_VERSION}`;

/**
 * Assets essenciais pré-cacheados no install.
 * São os arquivos mínimos para abrir a interface offline.
 */
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ==================== INSTALL ====================
// Pré-cacheia o shell mínimo do app

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()) // Ativa imediatamente
  );
});

// ==================== ACTIVATE ====================
// Limpa caches de versões anteriores

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('financas-pro-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim()) // Controla todas as abas abertas
  );
});

// ==================== FETCH ====================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requests que não são GET
  if (request.method !== 'GET') return;

  // Ignorar extensions, devtools, etc.
  if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') return;

  // --- NAVIGATION REQUESTS (HTML) ---
  // Network First: tenta rede, fallback para cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Salva cópia atualizada no cache
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/') || caches.match(request))
    );
    return;
  }

  // --- ASSETS ESTÁTICOS (JS, CSS, imagens com hash no nome) ---
  // Cache First: arquivos com hash são imutáveis
  if (url.pathname.startsWith('/assets/') || url.pathname.match(/\.(js|css|svg|png|ico|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          // Só cachear respostas válidas
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // --- TUDO O RESTO ---
  // Network First (sem cache agressivo)
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

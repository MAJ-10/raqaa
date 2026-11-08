// Raqaa service worker: makes the website work offline after the first visit.
// The build fills in VERSION and FILES (see tools/pwa.ts) and saves this file as sw.js.
//
// It never calls skipWaiting(). A new version installs in the background and waits until every
// window of the app is closed, so an update never changes a competition that is running.

const VERSION = '__RAQAA_VERSION__';
const FILES = __RAQAA_FILES__;
const CACHE = 'raqaa-' + VERSION;
const SCOPE = new URL(self.registration.scope);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES.map((file) => new Request(new URL(file, SCOPE), { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n.startsWith('raqaa-') && n !== CACHE).map((n) => caches.delete(n)))),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;

  // Opening the app's home page (with or without index.html) gets the cached page.
  const path = url.pathname.slice(SCOPE.pathname.length);
  const home = request.mode === 'navigate' && (path === '' || path === 'index.html');
  const key = home ? new URL('index.html', SCOPE).href : request;

  // ignoreVary: a server may answer with "Vary: Origin", and the page asks for its script and styles
  // with an Origin header that the cached copies were not fetched with.
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(key, { ignoreSearch: true, ignoreVary: true }))
      .then((hit) => hit || fetch(request)),
  );
});

/* C-Slayer service worker: cache-first for the app shell, so it works offline. Same-origin GETs only. */
const CACHE = 'c-slayer-v3';
const ASSETS = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/samples.js', 'js/worker.js',
  'js/cc/lexer.js', 'js/cc/preproc.js', 'js/cc/types.js', 'js/cc/parser.js', 'js/cc/isa.js', 'js/cc/vm.js', 'js/cc/headers.js', 'js/cc/libc.js',
  'js/cc/cdecl.js', 'js/cc/cexpr.js', 'js/cc/cstmt.js', 'js/cc/cfmt.js', 'js/cc/compile.js', 'js/cc/score.js',
  'vendor/codemirror.js', 'vendor/codemirror.css', 'vendor/clike.js', 'vendor/show-hint.js', 'vendor/show-hint.css', 'vendor/closebrackets.js', 'vendor/matchbrackets.js', 'js/complete.js',
  'fonts/jetbrains-mono-latin-400-normal.woff2', 'fonts/jetbrains-mono-latin-700-normal.woff2', 'fonts/bricolage-grotesque-latin-600-normal.woff2', 'fonts/bricolage-grotesque-latin-800-normal.woff2',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'manifest.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.match(r, { ignoreSearch: true }).then(hit => hit || fetch(r).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
    return res;
  }).catch(() => caches.match('index.html'))));
});

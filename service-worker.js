/* C-Slayer service worker: cache-first for the app shell, so it works offline. Same-origin GETs only. */
const CACHE = 'c-slayer-v23';
const ASSETS = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/samples.js', 'js/problems.js', 'js/explain.js', 'js/explain_hi.js', 'js/format.js', 'js/worker.js',
  'js/cc/lexer.js', 'js/cc/preproc.js', 'js/cc/types.js', 'js/cc/parser.js', 'js/cc/isa.js', 'js/cc/vm.js', 'js/cc/turbo.js', 'js/cc/inspect.js', 'js/cc/headers.js', 'js/cc/libc.js',
  'js/cc/cdecl.js', 'js/cc/cexpr.js', 'js/cc/cstmt.js', 'js/cc/cfmt.js', 'js/cc/compile.js', 'js/cc/score.js',
  'vendor/codemirror.js', 'vendor/codemirror.css', 'vendor/clike.js', 'vendor/show-hint.js', 'vendor/show-hint.css', 'vendor/closebrackets.js', 'vendor/matchbrackets.js', 'js/complete.js',
  'fonts/commit-mono-latin-400-normal.woff2', 'fonts/commit-mono-latin-700-normal.woff2', 'fonts/reenie-beanie-latin-400-normal.woff2', 'fonts/bricolage-grotesque-latin-600-normal.woff2', 'fonts/bricolage-grotesque-latin-800-normal.woff2',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'manifest.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => fetch(a, { cache: 'reload' }).then(r => { if (!r.ok) throw new Error(a); return c.put(a, r); })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Network-first: every load asks the server (revalidating past GitHub Pages' 10-minute HTTP cache), so a push to the repo shows up on the next
// open with no version bump and no clearing of data. The cache is only the offline fallback (and a 4 s safety net for a slow connection).
const same = (a, b) => { const x = a.headers.get('etag') || a.headers.get('last-modified'), y = b.headers.get('etag') || b.headers.get('last-modified'); return !!x && x === y; };
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  const net = fetch(r, { cache: 'no-cache' }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
    return res;
  });
  const cached = () => caches.match(r, { ignoreSearch: true }).then(h => h || caches.match('index.html'));
  e.respondWith(Promise.race([net, new Promise((_, rej) => setTimeout(rej, 4000))]).catch(() => cached().then(h => h || net)));
});
// The page asks "is anything newer?" when it comes to the front: re-check every app file, refresh the cache, and tell the pages if any changed.
self.addEventListener('message', (e) => {
  if (!e.data || e.data.type !== 'check') return;
  e.waitUntil((async () => {
    const c = await caches.open(CACHE); let changed = false;
    await Promise.all(ASSETS.map(async (a) => {
      try {
        const res = await fetch(a, { cache: 'no-cache' }); if (!res.ok) return;
        const old = await c.match(a);
        if (old && same(old, res)) return;
        if (old) { const [x, y] = await Promise.all([old.clone().text(), res.clone().text()]); if (x === y) { await c.put(a, res); return; } changed = true; }
        await c.put(a, res);
      } catch (err) { /* offline */ }
    }));
    if (changed) for (const cl of await self.clients.matchAll()) cl.postMessage({ type: 'updated' });
  })());
});

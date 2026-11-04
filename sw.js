// Nöbet Takvimi – çevrimdışı çalışma için service worker
const CACHE = "nobet-takvimi-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest",
               "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;                       // Claude API (POST) dokunulmaz
  const url = new URL(req.url);

  // Sayfanın kendisi: önce internetten (güncelleme gelsin), yoksa önbellekten
  if (req.mode === "navigate") {
    e.respondWith(fetch(req)
      .then(res => { caches.open(CACHE).then(c => c.put("./index.html", res.clone())); return res; })
      .catch(() => caches.match("./index.html")));
    return;
  }

  // Uygulama dosyaları ve CDN kütüphaneleri: önce önbellek, arkada güncelle
  if (url.origin === location.origin || url.hostname === "cdn.jsdelivr.net") {
    e.respondWith(caches.match(req).then(cached => {
      const net = fetch(req).then(res => {
        if (res.ok || res.type === "opaque") caches.open(CACHE).then(c => c.put(req, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || net;
    }));
  }
});

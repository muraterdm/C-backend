// Nöbet Takvimi – çevrimdışı çalışma için service worker
const CACHE = "nobet-takvimi-v8";
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

  // Takvim dosyası: içerik adresin içinde gelir, gerçek bir .ics yanıtı olarak sunulur.
  // iPhone bu yanıtı görünce "Tümünü Ekle" takvim ekranını açar.
  if (url.origin === location.origin && url.pathname.endsWith("/takvim.ics") && url.searchParams.has("d")) {
    e.respondWith((async () => {
      try {
        const b64 = url.searchParams.get("d").replace(/-/g, "+").replace(/_/g, "/");
        const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
        const text = new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
        const name = (url.searchParams.get("n") || "nobetler").replace(/[^a-z0-9-]/gi, "") || "nobetler";
        return new Response(text, { headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": `inline; filename="${name}.ics"`
        } });
      } catch (err) {
        return new Response("Takvim dosyası okunamadı.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
    return;
  }

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

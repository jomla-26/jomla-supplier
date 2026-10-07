// خدمة إشعارات الهاتف لتطبيقات جملة: تصحى عند وصول نبضة، تسأل السيرفر عن نص الإشعار وتعرضه.
const API = new URL(self.location.href).searchParams.get("api") || "/api";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let items = [];
    try {
      const sub = await self.registration.pushManager.getSubscription();
      if (sub) {
        const r = await fetch(`${API}/push/peek`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        if (r.ok) items = (await r.json()).items || [];
      }
    } catch { /* نعرض إشعارًا عامًا */ }
    if (!items.length) items = [{ id: "g", title: "جملة", body: "عندك إشعار جديد" }];
    for (const n of items) {
      await self.registration.showNotification(n.title || "جملة", {
        body: n.body || "", tag: String(n.id), dir: "rtl", lang: "ar",
        icon: "/icon-192.png", badge: "/icon-192.png",
      });
    }
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (all.length) return all[0].focus();
    return self.clients.openWindow("/");
  })());
});

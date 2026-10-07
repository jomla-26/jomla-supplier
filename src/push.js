// تفعيل إشعارات الهاتف (Web Push) لهذا الجهاز
const BASE_URL = import.meta.env?.VITE_API_URL || "/api";
const tok = () => { try { return localStorage.getItem("jomla_token"); } catch { return null; } };

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const toKey = (b64) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

async function registration() {
  return navigator.serviceWorker.register(`/sw.js?api=${encodeURIComponent(BASE_URL)}`);
}

export async function pushState() {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub ? "on" : "off";
  } catch { return "off"; }
}

export async function enablePush() {
  if (!pushSupported()) throw new Error("جهازك أو متصفحك ما يدعمش إشعارات الهاتف");
  const k = await fetch(`${BASE_URL}/push/key`);
  if (!k.ok) throw new Error("إشعارات الهاتف غير مفعّلة من الإدارة بعد");
  const { key } = await k.json();
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("لازم تسمح بالإشعارات من إعدادات المتصفح");
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key) }));
  const j = sub.toJSON();
  const r = await fetch(`${BASE_URL}/push/subscribe`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${tok()}` },
    body: JSON.stringify({ endpoint: j.endpoint, keys: j.keys }),
  });
  if (!r.ok) throw new Error("تعذّر تفعيل الإشعارات، حاول مرة ثانية");
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch(`${BASE_URL}/push/unsubscribe`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${tok()}` },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe();
}

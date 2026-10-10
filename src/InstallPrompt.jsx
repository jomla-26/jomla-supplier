import React, { useEffect, useState } from "react";

// شريط "ثبّت التطبيق": أندرويد/كروم = زر تثبيت مباشر، آيفون/سفاري = شرح خطوات الإضافة للشاشة الرئيسية.
// يختفي لو التطبيق مثبّت أصلًا، أو لو العميل أغلقه (يتذكر الإغلاق 14 يوم).
const KEY = "jomla-supplier-install-dismissed";

function recentlyDismissed() {
  try {
    const t = Number(localStorage.getItem(KEY));
    return t && Date.now() - t < 14 * 24 * 3600 * 1000;
  } catch { return false; }
}

export default function InstallPrompt() {
  const [evt, setEvt] = useState(null);
  const [hidden, setHidden] = useState(() => recentlyDismissed());
  const [showSteps, setShowSteps] = useState(false);

  const standalone = typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  // على الآيفون الإضافة تشتغل من سفاري فقط (مو من داخل تطبيقات مثل فيسبوك/واتساب/كروم)
  const iosSafari = isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|FBAN|FBAV|Instagram|Line/i.test(ua);

  useEffect(() => {
    const h = (e) => { e.preventDefault(); setEvt(e); };
    window.addEventListener("beforeinstallprompt", h);
    const done = () => setHidden(true);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", h); window.removeEventListener("appinstalled", done); };
  }, []);

  if (standalone || hidden) return null;
  if (!evt && !isIOS) return null;

  const dismiss = () => {
    try { localStorage.setItem(KEY, String(Date.now())); } catch { /* التخزين غير متاح */ }
    setHidden(true);
  };
  const install = async () => {
    if (!evt) return;
    evt.prompt();
    try { await evt.userChoice; } catch { /* تجاهل */ }
    setEvt(null);
    dismiss();
  };

  const box = {
    position: "fixed", insetInline: 12, bottom: 78, zIndex: 60, background: "#181d2a", color: "#fff",
    borderRadius: 16, padding: "12px 14px", boxShadow: "0 8px 24px rgba(0,0,0,.25)", fontSize: 14,
  };
  const btn = { background: "#ff6a1a", color: "#fff", border: "none", borderRadius: 999, padding: "8px 16px", fontWeight: 700, cursor: "pointer" };
  const x = { background: "none", border: "none", color: "rgba(255,255,255,.7)", fontSize: 20, cursor: "pointer", padding: "0 6px" };

  return (
    <div style={box} role="dialog" aria-label="تثبيت التطبيق">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img src="/icon-192.png" alt="" style={{ width: 40, height: 40, borderRadius: 10 }} />
        <div style={{ flex: 1 }}>
          <b>ثبّت تطبيق جملة للمورد</b>
          <div style={{ fontSize: 12, opacity: 0.8 }}>يفتح من شاشة تلفونك مثل أي تطبيق</div>
        </div>
        {evt
          ? <button style={btn} onClick={install}>تثبيت</button>
          : <button style={btn} onClick={() => setShowSteps((s) => !s)}>{showSteps ? "إخفاء" : "كيف؟"}</button>}
        <button style={x} onClick={dismiss} aria-label="إغلاق">×</button>
      </div>
      {!evt && showSteps && (
        <ol style={{ margin: "10px 18px 0", padding: 0, lineHeight: 1.9, fontSize: 13 }}>
          {iosSafari ? (
            <>
              <li>اضغط زر المشاركة (المربع اللي فيه سهم لفوق) تحت في سفاري.</li>
              <li>انزل واختار «إضافة إلى الشاشة الرئيسية».</li>
              <li>اضغط «إضافة» فوق يمين.</li>
            </>
          ) : (
            <>
              <li>افتح الرابط في متصفح سفاري (مو من داخل واتساب أو فيسبوك).</li>
              <li>اضغط زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية».</li>
            </>
          )}
        </ol>
      )}
    </div>
  );
}

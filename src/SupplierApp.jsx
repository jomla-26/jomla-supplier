import React, { useState, useEffect, useRef } from "react";
import {
  ArrowRight, Package, Store, Truck, Plus, Check, X,
  AlertTriangle, Search, Loader2, Send, Wallet, BarChart3, Upload,
} from "lucide-react";
import { api } from "./api.js";
import { useSession, useFetch, useAction } from "./hooks.js";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const LOGO_MARK = "PLACEHOLDER_KEEP_YOUR_EXISTING_BASE64";
const LOGO_FULL = "PLACEHOLDER_KEEP_YOUR_EXISTING_BASE64";

const money = (n) => `${Number(n || 0).toFixed(2)} د.ل`;

const PART_STATUS = {
  pending: "بانتظار الإرسال", sent: "جديدة", preparing: "قيد التجهيز",
  shortage: "يوجد نقص", ready: "جاهزة", handed_over: "سُلّمت للتوصيل",
  picked_up: "تم الاستلام", closed: "مقفولة", cancelled: "ملغاة",
};
const partLabel = (s) => PART_STATUS[s] || s;

const AVAIL_LABELS = { full: "متوفر بالكامل", partial: "متوفر جزئيًا", out: "غير متوفر" };

/* =================================================================== */

export default function JomlaSupplierApp() {
  const { actor, loading, requestOtp, verifyOtp, logout } = useSession("supplier");
  const [view, setView] = useState("orders");
  const [selectedPartId, setSelectedPartId] = useState(null);

  if (loading) return <Shell><Centered><Loader2 className="spin" size={26} /><p>جارٍ التحميل…</p></Centered></Shell>;
  if (!actor) return <Shell><AuthGate onRequestOtp={requestOtp} onVerify={verifyOtp} /></Shell>;

  return (
    <Shell>
      <TopBar
        view={view}
        actorName={actor.name}
        onNav={setView}
        onBack={() => setView("orders")}
        onLogout={logout}
      />
      <main className="jomla-main">
        {view === "orders" && (
          <OrdersView onOpen={(id) => { setSelectedPartId(id); setView("orderDetail"); }} />
        )}
        {view === "orderDetail" && (
          <PartDetailView partId={selectedPartId} onDone={() => setView("orders")} />
        )}
        {view === "products" && <ProductsView />}
        {view === "ledger" && <LedgerView supplierId={actor.id} />}
        {view === "reports" && <ReportsView />}
      </main>
    </Shell>
  );
}

/* ------------------------- عناصر مشتركة ------------------------- */

const Shell = ({ children }) => (
  <div dir="rtl" lang="ar" className="jomla-root"><Style />{children}</div>
);
const Centered = ({ children }) => <div className="center-state">{children}</div>;
const Spinner = ({ label = "جارٍ التحميل…" }) => (
  <Centered><Loader2 className="spin" size={22} /><p>{label}</p></Centered>
);
const ErrorState = ({ message, onRetry }) => (
  <Centered>
    <AlertTriangle size={22} /><p>{message}</p>
    {onRetry && <button className="btn-ghost" onClick={onRetry}>إعادة المحاولة</button>}
  </Centered>
);

function BrandMark({ size = 22 }) {
  return <img src={LOGO_MARK} alt="جملة" style={{ height: size, width: "auto", display: "block" }} />;
}

/* --------------------------- الدخول --------------------------- */

function AuthGate({ onRequestOtp, onVerify }) {
  const [mode, setMode] = useState("login"); // login | register | pending

  if (mode === "register") {
    return <RegisterView onDone={() => setMode("pending")} onCancel={() => setMode("login")} />;
  }
  if (mode === "pending") {
    return <PendingApprovalView onBack={() => setMode("login")} />;
  }
  return <LoginView onRequestOtp={onRequestOtp} onVerify={onVerify} onNewAccount={() => setMode("register")} />;
}

function PendingApprovalView({ onBack }) {
  return (
    <div className="screen login-screen">
      <div className="brand-row"><BrandMark size={56} /></div>
      <p className="login-sub">بوابة الموردين — منصة جملة</p>
      <div className="login-card" style={{ textAlign: "center" }}>
        <p style={{ fontWeight: 700, marginBottom: 8 }}>طلبك قيد المراجعة</p>
        <p className="hint" style={{ marginBottom: 20 }}>
          تم استلام طلب تسجيل حسابك بنجاح. سيتم التواصل معك بعد اعتماد الحساب من إدارة جملة.
        </p>
        <button className="btn-ghost" onClick={onBack}>رجوع لتسجيل الدخول</button>
      </div>
    </div>
  );
}

function RegisterView({ onDone, onCancel }) {
  const [form, setForm] = useState({ name: "", phone: "", address: "", commissionRate: "" });
  const [location, setLocation] = useState(null);
  const [businessTypes, setBusinessTypes] = useState([""]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = useAction(() => api.registerAccount("supplier", {
    businessName: form.name.trim(),
    phone: form.phone.trim(),
    address: form.address.trim() || undefined,
    latitude: location?.lat,
    longitude: location?.lng,
    businessTypes: businessTypes.map((t) => t.trim()).filter(Boolean),
    commissionRate: Number(form.commissionRate),
  }));

  const valid = form.name.trim() && form.phone.replace(/\D/g, "").length >= 9
    && form.commissionRate !== "" && Number(form.commissionRate) >= 0 && Number(form.commissionRate) <= 100;

  return (
    <div className="screen login-screen">
      <div className="brand-row"><BrandMark size={56} /></div>
      <p className="login-sub">إنشاء حساب مورد جديد</p>
      <div className="login-card">
        <label className="field-label">اسم النشاط أو المتجر</label>
        <input className="field-input" value={form.name} onChange={set("name")} />

        <label className="field-label">رقم الهاتف</label>
        <input className="field-input" value={form.phone} onChange={set("phone")}
          dir="ltr" style={{ textAlign: "right" }} inputMode="numeric" placeholder="09XXXXXXXX" />

        <label className="field-label">العنوان</label>
        <input className="field-input" value={form.address} onChange={set("address")} />

        <label className="field-label">نسبة العمولة المتفق عليها مع جملة (%)</label>
        <input className="field-input" type="number" min="0" max="100" step="0.5"
          placeholder="مثال: 5" value={form.commissionRate} onChange={set("commissionRate")} />

        <label className="field-label">نوع النشاط</label>
        {businessTypes.map((t, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input className="field-input" style={{ marginBottom: 0, flex: 1 }} value={t}
              placeholder="مثال: مواد بناء"
              onChange={(e) => setBusinessTypes((arr) => arr.map((v, idx) => idx === i ? e.target.value : v))} />
            {businessTypes.length > 1 && (
              <button type="button" className="btn-ghost" style={{ width: "auto", padding: "0 14px", marginBottom: 0 }}
                onClick={() => setBusinessTypes((arr) => arr.filter((_, idx) => idx !== i))}>−</button>
            )}
            {i === businessTypes.length - 1 && (
              <button type="button" className="btn-ghost" style={{ width: "auto", padding: "0 14px", marginBottom: 0 }}
                onClick={() => setBusinessTypes((arr) => [...arr, ""])}>+</button>
            )}
          </div>
        ))}

        <label className="field-label">تحديد الموقع على الخريطة</label>
        <RegisterLocationPicker value={location} onChange={setLocation} />

        {submit.error && <p className="field-error">{submit.error}</p>}

        <button className="btn-primary" disabled={!valid || submit.pending}
          onClick={() => submit.run().then(onDone).catch(() => {})}>
          {submit.pending ? "جارٍ الإرسال…" : "إرسال طلب التسجيل"}
        </button>
        <button className="btn-ghost" onClick={onCancel}>إلغاء</button>
      </div>
    </div>
  );
}

function RegisterLocationPicker({ value, onChange }) {
  const TRIPOLI_CENTER = [32.8872, 13.1913];
  function ClickHandler() {
    useMapEvents({
      click(e) {
        onChange({ lat: Number(e.latlng.lat.toFixed(5)), lng: Number(e.latlng.lng.toFixed(5)) });
      },
    });
    return null;
  }
  return (
    <div className="map-picker-wrap">
      <div className="map-picker">
        <MapContainer
          center={value ? [value.lat, value.lng] : TRIPOLI_CENTER}
          zoom={value ? 15 : 12}
          style={{ height: "220px", width: "100%" }}
        >
          <TileLayer attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ClickHandler />
          {value && <Marker position={[value.lat, value.lng]} icon={markerIcon} />}
        </MapContainer>
        {!value && <div className="map-hint">اضغط على الخريطة لتحديد الموقع</div>}
      </div>
      {value && (
        <div className="map-coords">
          <span>الإحداثيات: {value.lat}, {value.lng}</span>
          <button className="link-btn" onClick={() => onChange(null)}>مسح الموقع</button>
        </div>
      )}
    </div>
  );
}


function LoginView({ onRequestOtp, onVerify, onNewAccount }) {
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [seconds, setSeconds] = useState(0);
  const inputsRef = useRef([]);
  const send = useAction(onRequestOtp);
  const verify = useAction(onVerify);

  useEffect(() => {
    if (step !== "otp" || seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [step, seconds]);
  useEffect(() => { if (step === "otp") inputsRef.current[0]?.focus(); }, [step]);

  async function handleSend() {
    if (phone.replace(/\D/g, "").length < 9) return;
    await send.run(phone).catch(() => {});
    setSeconds(30); setStep("otp");
  }
  function updateDigit(i, val) {
    const v = val.replace(/\D/g, "").slice(-1);
    const next = [...digits]; next[i] = v; setDigits(next);
    if (v && i < 3) inputsRef.current[i + 1]?.focus();
  }

  return (
    <div className="screen login-screen">
      <div className="brand-row"><img src={LOGO_FULL} alt="جملة" className="brand-logo-full" /></div>
      <p className="login-sub">بوابة الموردين — منصة جملة</p>

      {step === "phone" ? (
        <div className="login-card">
          <label className="field-label">رقم حساب المورد المعتمد</label>
          <input className="field-input" placeholder="09XXXXXXXX" value={phone} dir="ltr"
            style={{ textAlign: "right" }} inputMode="numeric"
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()} />
          {send.error && <p className="field-error">{send.error}</p>}
          <button className="btn-primary" onClick={handleSend} disabled={send.pending}>
            {send.pending ? "جارٍ الإرسال…" : "إرسال رمز التحقق"}
          </button>
         <button className="link-btn" onClick={onNewAccount}>مورد جديد؟ أنشئ حسابك من هنا</button>
        </div>
      ) : (
        <div className="login-card">
          <label className="field-label">رمز التحقق المُرسل إلى {phone}</label>
          <div className="otp-row" dir="ltr">
            {digits.map((d, i) => (
              <input key={i} ref={(el) => (inputsRef.current[i] = el)} className="otp-box"
                value={d} type="tel" inputMode="numeric" maxLength={1}
                autoComplete={i === 0 ? "one-time-code" : "off"}
                onChange={(e) => updateDigit(i, e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => e.key === "Backspace" && !digits[i] && i > 0 && inputsRef.current[i - 1]?.focus()} />
            ))}
          </div>
          {verify.error && <p className="field-error">{verify.error}</p>}
          <button className="btn-primary" disabled={verify.pending || digits.join("").length < 4}
            onClick={() => verify.run(phone, digits.join("")).catch(() => {})}>
            {verify.pending ? "جارٍ التحقق…" : "تأكيد الدخول"}
          </button>
          <div className="otp-footer">
            <button className="link-btn" onClick={() => setStep("phone")}>تعديل الرقم</button>
            <button className="link-btn" disabled={seconds > 0} onClick={handleSend}>
              {seconds > 0 ? `إعادة الإرسال بعد ${seconds} ث` : "إعادة إرسال الرمز"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------- الشريط العلوي ------------------------- */

function TopBar({ view, actorName, onNav, onBack, onLogout }) {
  const inDetail = view === "orderDetail";
  return (
    <header className="topbar">
      <div className="topbar-row">
        {inDetail ? (
          <button className="icon-btn" onClick={onBack} aria-label="رجوع"><ArrowRight size={20} /></button>
        ) : (
          <div className="brand-chip"><BrandMark /><span>{actorName}</span></div>
        )}
        {inDetail && <span className="topbar-title">تفاصيل الطلبية</span>}
        <div className="topbar-actions">
          <button className={"icon-btn" + (view !== "products" && view !== "ledger" && view !== "reports" ? " icon-btn-active" : "")}
            onClick={() => onNav("orders")} aria-label="الطلبات"><Package size={19} /></button>
          <button className={"icon-btn" + (view === "products" ? " icon-btn-active" : "")}
            onClick={() => onNav("products")} aria-label="المنتجات"><Store size={19} /></button>
          <button className={"icon-btn" + (view === "ledger" ? " icon-btn-active" : "")}
            onClick={() => onNav("ledger")} aria-label="كشف الحساب"><Wallet size={19} /></button>
          <button className={"icon-btn" + (view === "reports" ? " icon-btn-active" : "")}
            onClick={() => onNav("reports")} aria-label="التقارير"><BarChart3 size={19} /></button>
          <button className="icon-btn" onClick={onLogout} aria-label="خروج"><X size={18} /></button>
        </div>
      </div>
    </header>
  );
}

/* -------------------------- الطلبيات -------------------------- */

function OrdersView({ onOpen }) {
  const [status, setStatus] = useState("all");
  const filters = [
    { id: "all", label: "الكل" },
    { id: "sent", label: "جديدة" },
    { id: "preparing", label: "قيد التجهيز" },
    { id: "shortage", label: "بها نقص" },
    { id: "picked_up", label: "تم الاستلام" },
  ];

  const { data, loading, error, reload } = useFetch(
    (signal) => api.orders(status === "all" ? undefined : { status }, signal),
    [status]
  );

  const newCount = (data ?? []).filter((p) => p.status === "sent").length;

  return (
    <div className="screen">
      <h2 className="section-heading">طلبياتك الواردة</h2>

      {status === "all" && newCount > 0 && (
        <div className="alert-banner">
          <AlertTriangle size={16} />
          <span>لديك {newCount} {newCount === 1 ? "طلبية جديدة" : "طلبيات جديدة"} بانتظار تأكيد التوفر</span>
        </div>
      )}

      <div className="chip-row">
        {filters.map((f) => (
          <button key={f.id} className={"chip" + (status === f.id ? " chip-active" : "")}
            onClick={() => setStatus(f.id)}>{f.label}</button>
        ))}
      </div>

      {loading ? <Spinner />
       : error ? <ErrorState message={error} onRetry={reload} />
       : !data?.length ? <Centered><Package size={24} /><p>لا توجد طلبيات في هذه الحالة</p></Centered>
       : (
        <div className="ledger-list">
          {data.map((p) => (
            <button className="order-row" key={p.order_supplier_id}
              onClick={() => onOpen(p.order_supplier_id)}>
              <div className="order-row-top">
                <span className="order-row-id">{p.order_number}</span>
                <span className="status-pill">{partLabel(p.status)}</span>
              </div>
              <span className="order-row-meta">
                {p.customer_name} · {String(p.created_at).slice(0, 10)} ·{" "}
                {p.fulfillment === "pickup" ? "استلام شخصي" : "توصيل"}
              </span>
              <div className="order-row-bottom">
                <span className="order-row-total">{money(p.subtotal)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------- تفاصيل الجزء والتوفر --------------------- */

function PartDetailView({ partId, onDone }) {
  // نجلب كل الطلبيات ثم نلتقط الجزء المطلوب — الخادم يقصر النتيجة على هذا المورد
  const list = useFetch((signal) => api.orders(undefined, signal), []);
  const part = (list.data ?? []).find((p) => p.order_supplier_id === partId);

  const detail = useFetch(
    (signal) => api.order(part.order_id, signal),
    [part?.order_id],
    { skip: !part }
  );

  const [draft, setDraft] = useState({});   // { itemId: { availability, qty } }

  const confirm = useAction((items) => api.setAvailability(partId, { items }));
  const pickup = useAction((paid) => api.confirmPickup(partId, paid));

  if (list.loading) return <Spinner />;
  if (list.error) return <ErrorState message={list.error} onRetry={list.reload} />;
  if (!part) return <Centered><Package size={24} /><p>تعذّر العثور على الطلبية</p></Centered>;

  const myPart = detail.data?.suppliers?.find((s) => s.id === partId);
  const items = myPart?.items ?? [];
  const locked = part.status !== "sent";

  function setItem(itemId, availability, qty) {
    setDraft((d) => ({ ...d, [itemId]: { availability, qty } }));
  }

  function currentFor(item) {
    return draft[item.id] ?? {
      availability: item.availability === "pending" ? "full" : item.availability,
      qty: item.qty_confirmed ?? item.qty_requested,
    };
  }

  const confirmedTotal = items.reduce((s, i) => {
    const c = currentFor(i);
    const qty = c.availability === "full" ? i.qty_requested : c.availability === "out" ? 0 : c.qty;
    return s + i.unit_price * qty;
  }, 0);

  async function submitAvailability() {
    const payload = items.map((i) => {
      const c = currentFor(i);
      return {
        orderItemId: i.id,
        availability: c.availability,
        qtyConfirmed: c.availability === "full" ? i.qty_requested
                    : c.availability === "out" ? 0 : Number(c.qty),
      };
    });
    await confirm.run(payload).then(onDone).catch(() => {});
  }

  return (
    <div className="screen">
      <div className="order-detail-head">
        <span className="order-row-id">{part.order_number}</span>
        <span className="status-pill">{partLabel(part.status)}</span>
      </div>
      <p className="order-row-meta">{part.customer_name} · {String(part.created_at).slice(0, 10)}</p>
      <p className="order-row-meta" style={{ marginBottom: 14 }}>
        {part.fulfillment === "pickup" ? <Store size={13} /> : <Truck size={13} />}{" "}
        {part.fulfillment === "pickup" ? "استلام شخصي من العميل" : "توصيل عبر جملة"}
      </p>

      {part.supplier_note && (
        <div className="note-block">
          <span className="note-label">ملاحظة العميل</span>
          <p>{part.supplier_note}</p>
        </div>
      )}

      {detail.loading ? <Spinner label="جارٍ تحميل الأصناف…" />
       : detail.error ? <ErrorState message={detail.error} onRetry={detail.reload} />
       : (
        <>
          <div className="invoice-block">
            <div className="invoice-head">
              <span>الأصناف المطلوبة</span>
              <span className="invoice-head-count">{items.length} صنف</span>
            </div>
            {items.map((item) => {
              const c = currentFor(item);
              return (
                <div className="supplier-item-row" key={item.id}>
                  <div className="supplier-item-top">
                    <span className="invoice-line-name">{item.product_name} <i>({item.unit})</i></span>
                    <span className="invoice-line-price">{money(item.unit_price)}</span>
                  </div>
                  <span className="supplier-item-qty">الكمية المطلوبة: {item.qty_requested}</span>

                  <div className="avail-row">
                    {["full", "partial", "out"].map((k) => (
                      <button key={k} disabled={locked}
                        className={"avail-btn avail-btn-" + k + (c.availability === k ? " avail-btn-active" : "")}
                        onClick={() => setItem(item.id, k, k === "full" ? item.qty_requested : k === "out" ? 0 : c.qty)}>
                        {AVAIL_LABELS[k]}
                      </button>
                    ))}
                  </div>

                  {c.availability === "partial" && (
                    <div className="confirmed-qty-row">
                      <span>الكمية المتوفرة الآن:</span>
                      <input type="number" min="0" max={item.qty_requested} className="qty-input"
                        disabled={locked} value={c.qty}
                        onChange={(e) => setItem(item.id, "partial",
                          Math.max(0, Math.min(item.qty_requested, Number(e.target.value) || 0)))} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="summary-block">
            <div className="summary-row summary-total">
              <span>قيمة الأصناف المؤكدة</span><b>{money(confirmedTotal)}</b>
            </div>
          </div>

          {confirm.error && <p className="field-error">{confirm.error}</p>}
          {pickup.error && <p className="field-error">{pickup.error}</p>}

          {!locked && (
            <button className="btn-primary" disabled={confirm.pending} onClick={submitAvailability}>
              {confirm.pending ? "جارٍ الإرسال…" : "تأكيد التوفر وبدء التجهيز"}
            </button>
          )}

          {part.fulfillment === "pickup" && part.status === "preparing" && (
            <>
              <button className="btn-primary" disabled={pickup.pending}
                onClick={() => pickup.run(true).then(onDone).catch(() => {})}>
                <Check size={16} style={{ verticalAlign: "-3px", marginLeft: 6 }} />
                تأكيد حضور العميل واستلام قيمة الفاتورة
              </button>
              <p className="hint hint-center">
                لا يُعتبر الجزء مستلمًا دون تأكيد الدفع أو اعتماد الحوالة.
              </p>
            </>
          )}

          {locked && part.status === "pending" && (
            <div className="stamp stamp-waiting">
              <span>هذه الطلبية بانتظار اعتماد الإدارة — ستتمكن من تأكيد التوفر بمجرد إرسالها إليك رسميًا</span>
            </div>
          )}
          {locked && part.status !== "preparing" && part.status !== "pending" && (
            <div className="stamp stamp-done"><span>تمت معالجة هذا الجزء</span></div>
          )}
        </>
      )}

      <h2 className="subsection-heading" style={{ marginTop: 20 }}>الدردشة مع إدارة جملة</h2>
      <SupplierChatPanel orderId={part.order_id} orderSupplierId={partId} />
    </div>
  );
}

function SupplierChatPanel({ orderId, orderSupplierId }) {
  const { data, loading, error, reload } = useFetch(
    () => api.orderMessages(orderId, orderSupplierId), [orderId, orderSupplierId]
  );
  const [draft, setDraft] = useState("");
  const send = useAction(() => api.sendOrderMessage(orderId, { body: draft.trim(), orderSupplierId }));

  function submit() {
    if (!draft.trim()) return;
    send.run().then(() => { setDraft(""); reload(); }).catch(() => {});
  }

  return (
    <div className="chat-panel">
      <div className="chat-thread">
        {loading ? <Spinner label="جارٍ التحميل…" />
         : error ? <ErrorState message={error} onRetry={reload} />
         : !data?.length ? <p className="chat-empty">راسل إدارة جملة هنا لو عندك أي استفسار بخصوص هذه الطلبية.</p>
         : data.map((m, i) => (
            <div className={"chat-bubble " + (m.sender_type === "supplier" ? "chat-bubble-user" : "chat-bubble-support")} key={i}>
              <span>{m.body}</span>
              <span className="chat-time">{new Date(m.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          ))}
      </div>
      <div className="chat-input-row">
        <input className="chat-input" placeholder="اكتب رسالتك..." value={draft}
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        <button className="chat-send" onClick={submit} disabled={send.pending} aria-label="إرسال"><Send size={17} /></button>
      </div>
      {send.error && <p className="field-error">{send.error}</p>}
    </div>
  );
}

/* -------------------------- المنتجات -------------------------- */

function stockTag(qty) {
  if (qty <= 0) return { text: "غير متوفر", tone: "muted" };
  if (qty < 10) return { text: "كمية محدودة", tone: "amber" };
  return { text: "متوفر", tone: "success" };
}

function ProductsView() {
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const { data, loading, error, reload, setData } = useFetch((signal) => api.products(undefined, signal), []);
  const { data: meData } = useFetch(() => api.me(), []);
  const sections = meData?.sections ?? [];

  const q = query.trim();
  const visible = (data ?? []).filter((p) => !q || p.name.includes(q) || p.unit.includes(q));

  return (
    <div className="screen">
      <h2 className="section-heading">منتجاتك</h2>
      <p className="eyebrow-plain">عدّل السعر أو الكمية — تتحدث حالة التوفر تلقائيًا في الخادم.</p>

      <div className="search-bar">
        <Search size={16} />
        <input placeholder="ابحث في منتجاتك..." value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && <button className="search-clear" onClick={() => setQuery("")}><X size={15} /></button>}
      </div>

      {loading ? <Spinner />
       : error ? <ErrorState message={error} onRetry={reload} />
       : (
        <>
          <div className="product-list">
            {visible.map((p) => (
              <ProductRow key={p.id} product={p}
                onSaved={(updated) => setData((list) => list.map((x) => x.id === updated.id ? updated : x))} />
            ))}
            {!visible.length && <Centered><p>لا توجد منتجات مطابقة</p></Centered>}
          </div>

          {showAdd && (
            <AddProductForm sections={sections ?? []} onClose={() => setShowAdd(false)}
              onCreated={(p) => { setData((list) => [...(list ?? []), p]); setShowAdd(false); }} />
          )}

          {showImport && (
            <ImportProductsView sections={sections ?? []} onClose={() => setShowImport(false)}
              onImported={() => { setShowImport(false); reload(); }} />
          )}

          {!showAdd && !showImport && (
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="btn-primary" style={{ marginBottom: 0 }} onClick={() => setShowAdd(true)}>
                <Plus size={16} style={{ verticalAlign: "-3px", marginLeft: 6 }} /> إضافة صنف جديد
              </button>
              <button className="btn-ghost" style={{ marginBottom: 0 }} onClick={() => setShowImport(true)}>
                <Upload size={16} style={{ verticalAlign: "-3px", marginLeft: 6 }} /> استيراد من إكسل
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProductRow({ product, onSaved }) {
  const [price, setPrice] = useState(product.base_price);
  const [sku, setSku] = useState(product.supplier_sku || "");
  const [showMovement, setShowMovement] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const save = useAction(() => api.updateProduct(product.id, {
    basePrice: Number(price), supplierSku: sku.trim() || undefined,
  }));
  const dirty = Number(price) !== Number(product.base_price)
    || sku.trim() !== (product.supplier_sku || "");
  const st = stockTag(Number(product.stock_qty));

  return (
    <div className="supplier-product-row">
      <div className="supplier-product-top">
        <span className="product-name">{product.name}</span>
        <span className={"stock-tag stock-tag-" + st.tone}>{st.text}</span>
      </div>
      <span className="product-meta">
        {product.unit} · {product.section_name}
        {product.supplier_sku && <> · #{product.supplier_sku}</>}
      </span>

      <div className="supplier-product-fields">
        <label className="mini-field">
          <span>السعر (د.ل)</span>
          <input type="number" min="0" step="0.05" className="qty-input"
            value={price} onChange={(e) => setPrice(e.target.value)} />
        </label>
        <label className="mini-field">
          <span>رقم الصنف عندك</span>
          <input type="text" className="qty-input" style={{ width: 90 }}
            placeholder="اختياري" value={sku} onChange={(e) => setSku(e.target.value)} />
        </label>
        {dirty && (
          <button className="save-inline" disabled={save.pending}
            onClick={() => save.run().then(onSaved).catch(() => {})}>
            {save.pending ? "…" : <Check size={15} />}
          </button>
        )}
      </div>
      {save.error && <p className="field-error">{save.error}</p>}

      <div className="stock-row">
        <span className="stock-current">الكمية الحالية: <b>{product.stock_qty}</b></span>
        <div className="stock-actions">
          <button className="chip" onClick={() => setShowMovement("in")}>+ إضافة مخزون</button>
          <button className="chip" onClick={() => setShowMovement("out")}>− سحب من المخزون</button>
          <button className="link-btn" onClick={() => setShowHistory(true)}>السجل</button>
        </div>
      </div>

      {showMovement && (
        <StockMovementForm product={product} direction={showMovement}
          onClose={() => setShowMovement(false)}
          onSaved={(p) => { setShowMovement(false); onSaved(p); }} />
      )}
      {showHistory && (
        <StockHistoryModal product={product} onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}

function StockMovementForm({ product, direction, onClose, onSaved }) {
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const isIn = direction === "in";

  const submit = useAction(() => api.addStockMovement(product.id, {
    changeQty: isIn ? Number(qty) : -Number(qty),
    reason: reason.trim(),
  }));

  const valid = Number(qty) > 0 && reason.trim().length >= 2;

  return (
    <div className="login-card" style={{ marginTop: 10 }}>
      <label className="field-label">{isIn ? "الكمية المضافة" : "الكمية المسحوبة"}</label>
      <input className="field-input" type="number" min="1" value={qty}
        onChange={(e) => setQty(e.target.value)} />

      <label className="field-label">السبب</label>
      <input className="field-input" placeholder={isIn ? "مثال: توريد جديد" : "مثال: تالف / جرد"}
        value={reason} onChange={(e) => setReason(e.target.value)} />

      {submit.error && <p className="field-error">{submit.error}</p>}

      <button className="btn-primary" disabled={!valid || submit.pending}
        onClick={() => submit.run().then((r) => onSaved(r.product)).catch(() => {})}>
        {submit.pending ? "جارٍ الحفظ…" : isIn ? "تأكيد الإضافة" : "تأكيد السحب"}
      </button>
      <button className="btn-ghost" onClick={onClose}>إلغاء</button>
    </div>
  );
}

function StockHistoryModal({ product, onClose }) {
  const { data, loading, error } = useFetch(() => api.stockHistory(product.id), [product.id]);

  return (
    <div className="login-card" style={{ marginTop: 10 }}>
      <div className="invoice-head" style={{ padding: "0 0 10px" }}>
        <span>سجل حركة: {product.name}</span>
        <button className="link-btn" onClick={onClose}>إغلاق</button>
      </div>
      {loading ? <Spinner /> : error ? <p className="field-error">{error}</p> : (
        !data?.length ? <p className="hint">لا توجد حركات مسجّلة بعد</p> : (
          <div className="ledger-list">
            {data.map((m) => (
              <div className="order-row" key={m.id} style={{ cursor: "default" }}>
                <div className="order-row-top">
                  <span className="order-row-id">{m.reason}</span>
                  <span className={"status-pill" + (Number(m.change_qty) < 0 ? " status-pill-debit" : "")}>
                    {Number(m.change_qty) > 0 ? "+" : ""}{m.change_qty}
                  </span>
                </div>
                <span className="order-row-meta">{String(m.created_at).slice(0, 10)}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function AddProductForm({ sections, onClose, onCreated }) {
  const [form, setForm] = useState({ sectionId: "", name: "", unit: "", basePrice: "", stockQty: "", supplierSku: "" });
  const create = useAction(() => api.createProduct({
    sectionId: form.sectionId, name: form.name.trim(), unit: form.unit.trim(),
    basePrice: Number(form.basePrice), stockQty: Number(form.stockQty),
    supplierSku: form.supplierSku.trim() || undefined,
  }));

  const valid = form.sectionId && form.name.trim() && form.unit.trim() && form.basePrice;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="login-card" style={{ marginTop: 16 }}>
      <label className="field-label">القسم</label>
      <select className="field-input" value={form.sectionId} onChange={set("sectionId")}>
        <option value="">اختر القسم</option>
        {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <label className="field-label">اسم الصنف</label>
      <input className="field-input" value={form.name} onChange={set("name")} />

      <label className="field-label">وحدة البيع</label>
      <input className="field-input" placeholder="مثال: كيس 50كغ" value={form.unit} onChange={set("unit")} />

      <label className="field-label">السعر (د.ل)</label>
      <input className="field-input" type="number" min="0" value={form.basePrice} onChange={set("basePrice")} />

      <label className="field-label">الكمية المتوفرة</label>
      <input className="field-input" type="number" min="0" value={form.stockQty} onChange={set("stockQty")} />

      <label className="field-label">رقم الصنف عندك (اختياري)</label>
      <input className="field-input" placeholder="مثال: SKU-1042" value={form.supplierSku} onChange={set("supplierSku")} />

      {create.error && <p className="field-error">{create.error}</p>}

      <button className="btn-primary" disabled={!valid || create.pending}
        onClick={() => create.run().then(onCreated).catch(() => {})}>
        {create.pending ? "جارٍ الحفظ…" : "إضافة الصنف"}
      </button>
      <button className="btn-ghost" onClick={onClose}>إلغاء</button>
    </div>
  );
}

/* -------------------------- كشف الحساب -------------------------- */

function buildVoucherHTML(v) {
  const typeLabel = v.voucher_type === "receipt" ? "سند قبض" : "سند صرف";
  const methodLabel = v.method === "cash" ? "نقدًا" : v.method === "transfer" ? "حوالة مصرفية" : "بطاقة";
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@700;800&family=Tajawal:wght@400;500;700&display=swap');
  body{font-family:'Tajawal',sans-serif;padding:0;margin:0;background:#efece3;color:#17140f}
  .pdf-toolbar{position:sticky;top:0;z-index:10;display:flex;gap:10px;justify-content:center;
    background:#17140f;padding:12px}
  .pdf-toolbar button{background:#ee4b15;color:#fff;border:none;padding:10px 18px;
    font-family:'Cairo',sans-serif;font-weight:700;font-size:13px;cursor:pointer;border-radius:4px}
  .pdf-toolbar button:last-child{background:rgba(255,255,255,.15)}
  .sheet{max-width:480px;margin:24px auto;background:#fff;border:1px solid #d6d0c0;padding:26px}
  h1{font-family:'Cairo',sans-serif;font-size:19px;text-align:center;margin:0 0 4px}
  .sub{text-align:center;color:#5a5544;font-size:12px;margin:0 0 20px}
  .row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px dashed #d6d0c0;font-size:14px}
  .total{font-family:'Cairo',sans-serif;font-weight:800;font-size:17px;
    border-top:2px solid #17140f;margin-top:10px;padding-top:12px}
  @media print{.pdf-toolbar{display:none}body{background:#fff}.sheet{margin:0;border:none}}
</style></head><body>
<div class="pdf-toolbar">
  <button onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
  <button onclick="window.close()">✕ إغلاق</button>
</div>
<div class="sheet">
  <h1>${typeLabel} — جملة</h1>
  <p class="sub">رقم السند: ${v.voucher_number}</p>
  <div class="row"><span>التاريخ</span><span>${String(v.created_at || v.approved_at).slice(0, 10)}</span></div>
  <div class="row"><span>الطرف</span><span>${v.party_name}</span></div>
  <div class="row"><span>طريقة الدفع</span><span>${methodLabel}</span></div>
  ${v.note ? `<div class="row"><span>ملاحظة</span><span>${v.note}</span></div>` : ""}
  <div class="row total"><span>المبلغ</span><span>${Number(v.amount).toFixed(2)} د.ل</span></div>
</div>
</body></html>`;
}

function openVoucherPdf(id) {
  api.voucherData(id).then((v) => {
    const w = window.open("", "_blank");
    w.document.write(buildVoucherHTML(v));
    w.document.close();
  }).catch(() => {});
}

function LedgerView({ supplierId }) {
  const { data, loading, error, reload } = useFetch(() => api.ledger(supplierId), [supplierId]);
  const balance = data?.length ? data[data.length - 1].balance : 0;

  return (
    <div className="screen">
      <h2 className="section-heading">كشف حسابك مع جملة</h2>

      {loading ? <Spinner /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <div className="balance-hero">
            <span>رصيدك الحالي</span>
            <b className={Number(balance) < 0 ? "balance-negative" : "balance-positive"}>
              {money(Math.abs(balance))} {Number(balance) < 0 ? "(مستحق لك)" : "(مستحق عليك)"}
            </b>
          </div>

          <div className="ledger-list">
            {!data?.length ? (
              <Centered><p>لا توجد حركات مالية بعد</p></Centered>
            ) : data.map((e, i) => (
              <div className="order-row" key={i} style={{ cursor: e.voucher_id ? "pointer" : "default" }}
                onClick={() => e.voucher_id && openVoucherPdf(e.voucher_id)}>
                <div className="order-row-top">
                  <span className="order-row-id">{e.description || e.note || "حركة مالية"}</span>
                  <span className={"status-pill" + (Number(e.credit) > 0 ? "" : " status-pill-debit")}>
                    {Number(e.credit) > 0 ? "+ " : "− "}{money(Number(e.credit) || Number(e.debit))}
                  </span>
                </div>
                <span className="order-row-meta">
                  {String(e.entry_date).slice(0, 10)}
                  {e.voucher_id && " · اضغط لتحميل السند PDF"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------- التقارير -------------------------- */

function ReportsView() {
  const [period, setPeriod] = useState("week");
  const { data, loading, error, reload } = useFetch(() => api.salesReport(period), [period]);
  const periods = [
    { id: "today", label: "اليوم" }, { id: "week", label: "هذا الأسبوع" }, { id: "month", label: "هذا الشهر" },
  ];

  return (
    <div className="screen">
      <h2 className="section-heading">تقاريرك</h2>
      <div className="chip-row">
        {periods.map((p) => (
          <button key={p.id} className={"chip" + (period === p.id ? " chip-active" : "")}
            onClick={() => setPeriod(p.id)}>{p.label}</button>
        ))}
      </div>

      {loading ? <Spinner /> : error ? <ErrorState message={error} onRetry={reload} /> : (
        <>
          <div className="stat-grid">
            <div className="stat-tile">
              <span>إجمالي المبيعات</span><b>{money(data.totalSales)}</b>
            </div>
            <div className="stat-tile">
              <span>عدد الطلبيات</span><b>{data.ordersCount}</b>
            </div>
          </div>

          <h3 className="subsection-heading">الأصناف الأكثر مبيعًا</h3>
          <div className="ledger-list">
            {(data.topProducts ?? []).map((p) => (
              <div className="order-row" key={p.product_id} style={{ cursor: "default" }}>
                <div className="order-row-top">
                  <span className="order-row-id">{p.name}</span>
                  <span className="order-row-total">{money(p.total)}</span>
                </div>
                <span className="order-row-meta">الكمية المباعة: {p.qty}</span>
              </div>
            ))}
            {!data.topProducts?.length && <Centered><p>لا توجد مبيعات في هذه الفترة</p></Centered>}
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------- استيراد إكسل -------------------------- */

function ImportProductsView({ sections, onClose, onImported }) {
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState(null); // نتيجة أول استيراد (تحديثات + أصناف تحتاج تأكيد)
  const [confirmDrafts, setConfirmDrafts] = useState([]); // نسخة قابلة للتعديل من needsConfirmation

  const parse = useAction((file) => new Promise((resolve, reject) => {
    import("xlsx").then((XLSX) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: "array" });
          const sheet = wb.Sheets["الأصناف"] || wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
          const cleaned = json
            .filter((r) => String(r["اسم الصنف"] || "").trim())
            .map((r) => ({
              sectionName: String(r["القسم"] || "").trim(),
              name: String(r["اسم الصنف"] || "").trim(),
              unit: String(r["وحدة البيع"] || "").trim(),
              basePrice: Number(r["السعر (د.ل)"] || 0),
              stockQty: Number(r["الكمية المتوفرة"] || 0),
              supplierSku: String(r["رقم الصنف عندك (اختياري)"] || "").trim(),
            }));
          resolve(cleaned);
        } catch (err) { reject("تعذّر قراءة الملف — تأكد من استخدام النموذج الصحيح"); }
      };
      reader.readAsArrayBuffer(file);
    });
  }));

  const noSkuRows = rows?.filter((r) => !r.supplierSku) ?? [];
  const withSkuRows = rows?.filter((r) => r.supplierSku) ?? [];

  const submit = useAction(() => api.importProducts(
    withSkuRows.map((r) => ({ ...r, sectionId: sections.find((s) => s.name === r.sectionName)?.id }))
  ));

  const confirmNew = useAction(() => api.confirmNewImports(
    confirmDrafts.filter((r) => r.sectionId)
  ));

  // بعد أول استيراد: جهّز نسخة قابلة للتعديل من الأصناف اللي محتاجة تأكيد (قد تكون ناقصة القسم)
  function handleFirstResult(res) {
    setResult(res);
    setConfirmDrafts(res.needsConfirmation.map((r) => ({
      ...r, sectionId: sections.find((s) => s.name === r.sectionName)?.id || "",
    })));
  }

  // شاشة تأكيد الأصناف الجديدة (بعد أول رفع)
  if (result) {
    return (
      <div className="login-card" style={{ marginTop: 16 }}>
        <p className="hint" style={{ marginBottom: 12 }}>
          تم تحديث مخزون {result.updatedCount} صنف موجود بالفعل تلقائيًا.
          {result.skippedCount > 0 && ` تم تجاهل ${result.skippedCount} صف (بدون رقم صنف).`}
        </p>

        {result.needsConfirmation.length === 0 ? (
          <>
            <p className="hint">لا توجد أصناف جديدة تحتاج تأكيد — الاستيراد اكتمل.</p>
            <button className="btn-primary" onClick={onImported}>تم</button>
          </>
        ) : (
          <>
            <div className="note-block" style={{ marginBottom: 14 }}>
              <span className="note-label">أصناف جديدة تحتاج مراجعتك</span>
              <p>
                رقم الصنف لكل صف من دول غير موجود عندك حاليًا. راجعها: لو فعلاً صنف جديد
                اختار له قسم وأكّد، ولو غلطة كتابة في الرقم لصنف قديم، عدّل الرقم من الإكسل وأعد الرفع بدلاً من التأكيد.
              </p>
            </div>

            {confirmDrafts.map((row, i) => (
              <div key={i} className="supplier-item-row" style={{ padding: "10px 2px" }}>
                <div className="supplier-item-top">
                  <span className="invoice-line-name">{row.name} <i>#{row.supplierSku}</i></span>
                  <span className="invoice-line-price">{money(row.basePrice)}</span>
                </div>
                <span className="supplier-item-qty">الكمية: {row.stockQty} — {row.unit}</span>
                <select className="field-input" style={{ marginTop: 8 }} value={row.sectionId}
                  onChange={(e) => setConfirmDrafts((d) => d.map((x, idx) =>
                    idx === i ? { ...x, sectionId: e.target.value } : x))}>
                  <option value="">اختر القسم لهذا الصنف الجديد</option>
                  {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            ))}

            {confirmNew.error && <p className="field-error">{confirmNew.error}</p>}
            <button className="btn-primary" style={{ marginTop: 14 }}
              disabled={confirmNew.pending || !confirmDrafts.some((r) => r.sectionId)}
              onClick={() => confirmNew.run().then(onImported).catch(() => {})}>
              {confirmNew.pending ? "جارٍ الحفظ…" : `تأكيد إضافة ${confirmDrafts.filter((r) => r.sectionId).length} صنف جديد`}
            </button>
          </>
        )}
        <button className="btn-ghost" onClick={onClose}>إغلاق</button>
      </div>
    );
  }

  // الشاشة الأولى: اختيار الملف
  return (
    <div className="login-card" style={{ marginTop: 16 }}>
      <label className="field-label">اختر ملف الإكسل (بنفس صيغة النموذج المُعتمد)</label>
      <input type="file" accept=".xlsx" className="field-input"
        onChange={(e) => {
          const f = e.target.files[0]; if (!f) return;
          setFileName(f.name);
          parse.run(f).then(setRows).catch(() => {});
        }} />

      {parse.error && <p className="field-error">{parse.error}</p>}

      {rows && (
        <>
          <p className="hint">تم العثور على {rows.length} صنف في «{fileName}»</p>
          <div className="note-block" style={{ marginTop: 8 }}>
            <span className="note-label">تذكير</span>
            <p>رقم الصنف عندك إجباري لكل الصفوف في الاستيراد — يُستخدم للمطابقة مع أصنافك الحالية.</p>
          </div>
          {noSkuRows.length > 0 && (
            <div className="note-block" style={{ marginTop: 8 }}>
              <span className="note-label">تنبيه</span>
              <p>{noSkuRows.length} صف بدون رقم صنف وسيُتجاهل تمامًا: {noSkuRows.map((r) => r.name).join("، ")}</p>
            </div>
          )}
          {submit.error && <p className="field-error">{submit.error}</p>}
          <button className="btn-primary" disabled={submit.pending || !withSkuRows.length}
            onClick={() => submit.run().then(handleFirstResult).catch(() => {})}>
            {submit.pending ? "جارٍ المعالجة…" : `متابعة الاستيراد (${withSkuRows.length} صف)`}
          </button>
        </>
      )}
      <button className="btn-ghost" onClick={onClose}>إلغاء</button>
    </div>
  );
}

/* --------------------------- الأنماط --------------------------- */

function Style() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&family=Tajawal:wght@400;500;700&display=swap');
      .jomla-root{--ink:#17140f;--ink-soft:#5a5544;--paper:#efece3;--paper-raised:#fff;
        --orange:#ee4b15;--orange-deep:#b93b12;--rule:#d6d0c0;--success:#3f7d4c;--amber:#a9761e;
        --font-display:'Cairo',sans-serif;--font-body:'Tajawal',sans-serif;
        font-family:var(--font-body);background:var(--paper);color:var(--ink);min-height:100vh;
        max-width:460px;margin:0 auto;display:flex;flex-direction:column;position:relative}
      .jomla-root *{box-sizing:border-box}
      .jomla-main{flex:1;padding-bottom:40px}
      .screen{padding:18px 16px 8px}
      .center-state{display:flex;flex-direction:column;align-items:center;gap:12px;padding:46px 20px;
        color:var(--ink-soft);font-size:13px;text-align:center}
      .spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}

      .login-screen{padding-top:56px;display:flex;flex-direction:column;align-items:center;text-align:center}
      .brand-row{margin-bottom:6px}.brand-logo-full{width:200px;height:auto}
      .login-sub{color:var(--ink-soft);font-size:13px;margin:10px 0 32px}
      .login-card{width:100%;background:var(--paper-raised);border:1px solid var(--rule);padding:20px;text-align:right}
      .field-label{display:block;font-size:12.5px;color:var(--ink-soft);margin-bottom:6px}
      .field-input{width:100%;border:1px solid var(--rule);background:transparent;padding:11px 12px;
        font-family:var(--font-display);font-size:15px;color:var(--ink);margin-bottom:12px}
      .field-input:focus{outline:2px solid var(--orange);outline-offset:1px}
      .field-error{color:var(--orange-deep);font-size:12px;margin:-4px 0 12px}
      .otp-row{display:flex;gap:10px;justify-content:center;margin-bottom:12px}
      .otp-box{width:48px;height:54px;text-align:center;border:1px solid var(--rule);background:transparent;
        font-family:var(--font-display);font-weight:700;font-size:20px;color:var(--ink)}
      .otp-box:focus{outline:2px solid var(--orange);outline-offset:1px}
      .otp-footer{display:flex;justify-content:space-between;margin-top:4px}
      .link-btn{background:none;border:none;color:var(--orange-deep);font-size:12.5px;cursor:pointer;padding:4px}
      .link-btn:disabled{color:var(--ink-soft);cursor:default}

      .topbar{position:sticky;top:0;z-index:20;background:var(--ink);color:#fff}
      .topbar-row{display:flex;align-items:center;gap:10px;padding:12px 10px}
      .topbar-title{font-family:var(--font-display);font-weight:700;font-size:15px}
      .topbar-actions{margin-inline-start:auto;display:flex;gap:2px}
      .icon-btn{background:none;border:none;color:rgba(255,255,255,.6);padding:8px;display:flex;cursor:pointer}
      .icon-btn-active{color:var(--orange)}
      .brand-chip{display:flex;align-items:center;gap:8px;color:#fff;font-family:var(--font-display);
        font-weight:800;font-size:14px}

      .eyebrow-plain{color:var(--ink-soft);font-size:12.5px;margin:0 0 14px;line-height:1.6}
      .section-heading{font-family:var(--font-display);font-weight:800;font-size:20px;margin:0 0 12px}
      .alert-banner{display:flex;align-items:center;gap:8px;background:#fff7ec;border:1px solid var(--amber);
        color:#6b4a10;padding:10px 12px;font-size:12.5px;margin-bottom:14px}
      .chip-row{display:flex;gap:8px;overflow-x:auto;padding-bottom:12px;margin-bottom:6px}
      .chip{flex:none;border:1px solid var(--rule);background:var(--paper-raised);padding:8px 14px;
        font-size:13px;color:var(--ink);cursor:pointer;white-space:nowrap;font-family:var(--font-body)}
      .chip-active{background:var(--ink);border-color:var(--ink);color:#fff}
      .search-bar{display:flex;align-items:center;gap:8px;border:1px solid var(--rule);
        background:var(--paper-raised);padding:11px 12px;margin-bottom:16px;color:var(--ink-soft)}
      .search-bar input{flex:1;border:none;background:none;outline:none;font-family:var(--font-body);
        font-size:13.5px;color:var(--ink)}
      .search-clear{background:none;border:none;color:var(--ink-soft);cursor:pointer;display:flex}

      .ledger-list{display:flex;flex-direction:column;border-top:1px solid var(--rule)}
      .order-row{display:flex;flex-direction:column;gap:4px;width:100%;padding:14px 4px;border:none;
        border-bottom:1px solid var(--rule);background:none;text-align:right;font-family:var(--font-body);
        color:var(--ink);cursor:pointer}
      .order-row-top{display:flex;justify-content:space-between;align-items:center}
      .order-row-id{font-family:var(--font-display);font-weight:700;font-size:14px}
      .order-row-meta{font-size:12px;color:var(--ink-soft);display:flex;align-items:center;gap:4px}
      .order-row-bottom{display:flex;justify-content:flex-end;margin-top:4px}
      .order-row-total{font-family:var(--font-display);font-weight:700;font-size:13.5px}
      .status-pill{font-size:10.5px;background:rgba(238,75,21,.1);color:var(--orange-deep);padding:3px 8px}

      .order-detail-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:2px}
      .note-block{background:#fff7ec;border:1px solid var(--amber);padding:11px 13px;margin-bottom:16px}
      .note-label{font-family:var(--font-display);font-weight:700;font-size:11.5px;color:#6b4a10;
        display:block;margin-bottom:3px}
      .note-block p{font-size:12.5px;color:#6b4a10;margin:0;line-height:1.6}

      .invoice-block{border:1px solid var(--rule);background:var(--paper-raised);margin-bottom:14px}
      .invoice-head{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;
        border-bottom:1px dashed var(--rule);font-family:var(--font-display);font-weight:700;font-size:14px}
      .invoice-head-count{font-family:var(--font-body);font-weight:400;font-size:11.5px;color:var(--ink-soft)}
      .invoice-line-name{flex:1;font-size:13.5px}
      .invoice-line-name i{font-style:normal;color:var(--ink-soft)}
      .invoice-line-price{font-family:var(--font-display);font-weight:600;font-size:13px}
      .supplier-item-row{padding:12px;border-bottom:1px solid var(--rule)}
      .supplier-item-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
      .supplier-item-qty{font-size:11.5px;color:var(--ink-soft)}
      .avail-row{display:flex;gap:6px;margin-top:10px}
      .avail-btn{flex:1;border:1px solid var(--rule);background:var(--paper-raised);padding:7px 4px;
        font-size:10.5px;text-align:center;cursor:pointer;color:var(--ink-soft);font-family:var(--font-body)}
      .avail-btn:disabled{cursor:default;opacity:.55}
      .avail-btn-full.avail-btn-active{border-color:var(--success);color:var(--success);background:rgba(63,125,76,.08)}
      .avail-btn-partial.avail-btn-active{border-color:var(--amber);color:var(--amber);background:rgba(169,118,30,.08)}
      .avail-btn-out.avail-btn-active{border-color:var(--orange-deep);color:var(--orange-deep);background:rgba(238,75,21,.08)}
      .confirmed-qty-row{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:12px;color:var(--ink-soft)}
      .qty-input{width:78px;border:1px solid var(--rule);background:var(--paper);padding:6px 8px;
        font-family:var(--font-display);font-size:13px;color:var(--ink)}
      .qty-input:focus{outline:2px solid var(--orange);outline-offset:1px}
      .qty-input:disabled{opacity:.55}

      .summary-block{border-top:1px solid var(--rule);padding-top:10px;margin-bottom:16px}
      .summary-row{display:flex;justify-content:space-between;padding:6px 2px;font-size:13px;color:var(--ink-soft)}
      .summary-total{color:var(--ink);font-family:var(--font-display);font-weight:700;font-size:15px;
        border-top:1px solid var(--ink);margin-top:4px;padding-top:10px}
      .stamp{border:2px solid var(--orange);color:var(--orange-deep);padding:10px 18px;
        font-family:var(--font-display);font-weight:800;font-size:13px;text-align:center;margin-bottom:12px}
      .stamp-waiting{border-color:var(--amber);color:var(--amber);font-weight:600;line-height:1.6}
      .status-pill-debit{background:rgba(185,59,18,.1);color:var(--orange-deep)}
      .balance-hero{background:var(--ink);color:#fff;padding:18px;text-align:center;margin-bottom:18px}
      .balance-hero span{display:block;font-size:12px;opacity:.7;margin-bottom:6px}
      .balance-hero b{font-family:var(--font-display);font-size:22px}
      .balance-positive{color:#8fd39e}.balance-negative{color:#f2a08a}
      .stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px}
      .stat-tile{background:var(--paper-raised);border:1px solid var(--rule);padding:14px;text-align:center}
      .stat-tile span{display:block;font-size:11.5px;color:var(--ink-soft);margin-bottom:6px}
      .stat-tile b{font-family:var(--font-display);font-weight:800;font-size:17px}
      .subsection-heading{font-family:var(--font-display);font-weight:700;font-size:15px;margin:8px 0 10px}

      .chat-panel{border:1px solid var(--rule);background:var(--paper-raised);margin-bottom:20px}
      .chat-thread{max-height:280px;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
      .chat-empty{font-size:12.5px;color:var(--ink-soft);text-align:center;padding:16px 0;margin:0}
      .chat-bubble{max-width:80%;padding:8px 11px;font-size:12.5px;display:flex;flex-direction:column;gap:3px}
      .chat-bubble-user{align-self:flex-end;background:var(--ink);color:#fff}
      .chat-bubble-support{align-self:flex-start;background:var(--paper);color:var(--ink)}
      .chat-time{font-size:10px;opacity:.6}
      .chat-input-row{display:flex;gap:8px;padding:10px;border-top:1px solid var(--rule)}
      .chat-input{flex:1;border:1px solid var(--rule);background:var(--paper);padding:9px 11px;
        font-family:var(--font-body);font-size:12.5px;color:var(--ink)}
      .chat-input:focus{outline:2px solid var(--orange);outline-offset:1px}
      .chat-send{background:var(--orange);color:#fff;border:none;padding:0 14px;cursor:pointer;display:flex;align-items:center}
      .chat-send:disabled{opacity:.6}
      .hint{font-size:12px;color:var(--ink-soft);margin:6px 2px 0;line-height:1.6}
      .hint-center{text-align:center}

      .product-list{display:flex;flex-direction:column;border-top:1px solid var(--rule)}
      .supplier-product-row{padding:13px 2px;border-bottom:1px solid var(--rule)}
      .supplier-product-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:2px}
      .product-name{font-size:14.5px;font-weight:500}
      .product-meta{font-size:11.5px;color:var(--ink-soft)}
      .stock-tag{font-size:10.5px;padding:2px 7px;flex:none}
      .stock-tag-success{background:rgba(63,125,76,.12);color:var(--success)}
      .stock-tag-amber{background:rgba(169,118,30,.12);color:var(--amber)}
      .stock-tag-muted{background:rgba(0,0,0,.06);color:var(--ink-soft)}
      .supplier-product-fields{display:flex;gap:14px;align-items:flex-end;margin-top:8px;flex-wrap:wrap}
      .mini-field{display:flex;flex-direction:column;gap:4px;font-size:11px;color:var(--ink-soft)}
      .save-inline{background:var(--orange);color:#fff;border:none;padding:8px 12px;cursor:pointer;
        display:flex;align-items:center;font-size:12px}
      .stock-row{display:flex;justify-content:space-between;align-items:center;margin-top:10px;
        padding-top:10px;border-top:1px dashed var(--rule)}
      .stock-current{font-size:12.5px;color:var(--ink-soft)}
      .stock-actions{display:flex;align-items:center;gap:8px}

      .btn-primary{width:100%;background:var(--orange);color:#fff;border:none;padding:14px;
        font-family:var(--font-display);font-weight:700;font-size:14.5px;cursor:pointer;margin-bottom:10px}
      .btn-primary:disabled{opacity:.6;cursor:default}
      .btn-ghost{width:100%;background:none;border:1px solid var(--rule);color:var(--ink);padding:13px;
        font-family:var(--font-display);font-weight:600;font-size:14px;cursor:pointer;margin-bottom:10px}
    `}</style>
  );
}

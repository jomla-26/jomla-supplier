// شاشات الدخول بكلمة المرور (مشتركة بين تطبيقات جملة الأربعة — نفس الملف حرفيًا في كل تطبيق).
import React, { useEffect, useState } from "react";
import { api } from "./api.js";
import { useAction } from "./hooks.js";

const toEnDigits = (s) => String(s || "").replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c));
const digits6 = (s) => toEnDigits(s).replace(/\D/g, "").slice(0, 6);


// ---------- بصمة الوجه / البصمة (WebAuthn) — تعمل فقط على نطاقات jomla-ly.com ----------
const passkeySupported = () =>
  typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials &&
  /(^|\.)jomla-ly\.com$|^localhost$/.test(window.location.hostname);
const b64uToBuf = (s) => {
  const t = String(s).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(t + "=".repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0)).buffer;
};
const bufToB64u = (b) => {
  let str = ""; new Uint8Array(b).forEach((x) => { str += String.fromCharCode(x); });
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const passkeyErr = (e) => {
  if (e?.name === "NotAllowedError" || e?.name === "AbortError") return new Error("تم الإلغاء أو ما تم التحقق من الوجه، حاول مرة ثانية");
  if (e?.name === "InvalidStateError") return new Error("بصمة الوجه مفعّلة من قبل على هذا الجهاز");
  return e instanceof Error ? e : new Error("تعذّر استخدام بصمة الوجه على هذا الجهاز");
};
async function enablePasskey() {
  try {
    const o = await api.passkeyRegisterOptions();
    const cred = await navigator.credentials.create({ publicKey: {
      ...o, challenge: b64uToBuf(o.challenge), user: { ...o.user, id: b64uToBuf(o.user.id) },
      excludeCredentials: (o.excludeCredentials || []).map((c) => ({ ...c, id: b64uToBuf(c.id) })),
    } });
    await api.passkeyRegisterVerify({ id: cred.id, response: {
      clientDataJSON: bufToB64u(cred.response.clientDataJSON), attestationObject: bufToB64u(cred.response.attestationObject),
    } });
  } catch (e) { throw passkeyErr(e); }
}
async function loginWithPasskey() {
  let cred;
  try {
    const o = await api.passkeyLoginOptions();
    cred = await navigator.credentials.get({ publicKey: {
      challenge: b64uToBuf(o.challenge), rpId: o.rpId, userVerification: "required", timeout: o.timeout,
    } });
    await api.passkeyLoginVerify({ id: cred.id, response: {
      clientDataJSON: bufToB64u(cred.response.clientDataJSON), authenticatorData: bufToB64u(cred.response.authenticatorData),
      signature: bufToB64u(cred.response.signature),
    } });
  } catch (e) { throw passkeyErr(e); }
}

const SEC_CSS = `
.sec-box{border:1px solid rgba(128,128,128,.3);border-radius:14px;padding:14px;margin:12px 0;text-align:right}
.sec-box h4{margin:0 0 10px;font-size:15px}
.sec-row{display:flex;flex-direction:column;gap:8px}
.sec-code{font:700 22px/1.4 monospace;letter-spacing:2px;direction:ltr;text-align:center;padding:12px;border-radius:12px;
  background:rgba(128,128,128,.12);user-select:all;word-break:break-all}
.sec-ok{color:#1f8a4c;font-weight:600;margin:6px 0}
.sec-warn{color:#b45309;font-size:13px;line-height:1.7;margin:8px 0}
.pw-links{display:flex;flex-direction:column;align-items:center;gap:12px;margin-top:16px}
.pw-links .link-btn{margin:0;padding:4px 8px}
.pw-sep{display:flex;align-items:center;gap:10px;width:100%;color:rgba(128,128,128,.9);font-size:13px}
.pw-sep::before,.pw-sep::after{content:"";flex:1;height:1px;background:rgba(128,128,128,.3)}
.pw-alt{width:100%}
`;

function PwInput({ value, onChange, placeholder, onEnter, autoComplete = "current-password" }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input className="field-input" type={show ? "text" : "password"} dir="ltr" value={value} placeholder={placeholder}
        autoComplete={autoComplete} style={{ textAlign: "right", paddingLeft: 64 }}
        onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onEnter?.()} />
      <button type="button" className="link-btn" tabIndex={-1}
        style={{ position: "absolute", left: 10, top: 21, transform: "translateY(-50%)", margin: 0, padding: "4px 6px" }}
        onClick={() => setShow((s) => !s)}>{show ? "إخفاء" : "إظهار"}</button>
    </div>
  );
}

/** عرض رمز الاسترجاع مرة واحدة — لازم المستخدم يؤكد إنه حفظه */
export function RecoveryCodeBox({ code, onDone, doneLabel = "تم، سجلت الرمز" }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="sec-box">
      <style>{SEC_CSS}</style>
      <h4>رمز الاسترجاع الخاص بك</h4>
      <div className="sec-code">{code}</div>
      <p className="sec-warn">
        سجّل هذا الرمز في ورقة أو مكان آمن عندك. <b>يظهر مرة واحدة فقط</b> ولن نقدر نعرضه لك مرة ثانية.
        لو نسيت كلمة المرور تدخل بيه وتحط كلمة جديدة. لا تعطيه لأي حد.
      </p>
      <button className="link-btn" onClick={() => { try { navigator.clipboard?.writeText(code); setCopied(true); } catch { /* تجاهل */ } }}>
        {copied ? "تم النسخ" : "نسخ الرمز"}
      </button>
      <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "10px 0" }}>
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <span>كتبت الرمز وحفظته</span>
      </label>
      <button className="btn-primary" disabled={!saved} onClick={onDone}>{doneLabel}</button>
    </div>
  );
}

/** خطوات الدخول بكلمة المرور داخل LoginView: password | forgot | code | recover */
export function PasswordSteps({
  accountType, step, setStep, phone, setPhone, phoneError, normalizePhone,
  onPasswordLogin, onCodeLogin, onRecover, onAdopt, onNewAccount, phoneLabel = "رقم الهاتف", allowRecovery = false,
}) {
  const [pw, setPw] = useState("");
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [rc, setRc] = useState("");
  const [phoneErr, setPhoneErr] = useState("");
  const [sent, setSent] = useState("");
  const [newRecovery, setNewRecovery] = useState("");

  const checkPhone = () => { const e = phoneError(phone); setPhoneErr(e || ""); return !e; };
  const login = useAction(async () => { await onPasswordLogin(normalizePhone(phone), pw); });
  const codeLogin = useAction(async () => { await onCodeLogin(normalizePhone(phone), code); });
  const face = useAction(async () => { await loginWithPasskey(); await onAdopt(); });
  const forgot = useAction(async () => {
    const r = await api.forgotPassword(accountType, normalizePhone(phone), reason.trim());
    setSent(r?.message || "تم إرسال طلبك للإدارة");
  });
  const recover = useAction(async () => {
    const r = await onRecover(normalizePhone(phone), rc, pw);
    setNewRecovery(r.recoveryCode);
  });

  const phoneField = (
    <>
      <label className="field-label">{phoneLabel}</label>
      <input className="field-input" placeholder="09XXXXXXXX" value={phone} dir="ltr"
        style={{ textAlign: "right" }} inputMode="numeric" autoComplete="username"
        onChange={(e) => { setPhone(e.target.value); setPhoneErr(""); }} />
      {phoneErr && <p className="field-error">{phoneErr}</p>}
    </>
  );

  if (step === "recover") {
    if (newRecovery) {
      return (
        <div className="login-card">
          <p className="sec-ok">تم تغيير كلمة المرور</p>
          <RecoveryCodeBox code={newRecovery} onDone={onAdopt} doneLabel="تم، ادخل" />
        </div>
      );
    }
    return (
      <div className="login-card">
        <style>{SEC_CSS}</style>
        {phoneField}
        <label className="field-label">رمز الاسترجاع (12 خانة)</label>
        <input className="field-input" dir="ltr" style={{ textAlign: "right" }} placeholder="XXXX-XXXX-XXXX" value={rc}
          onChange={(e) => setRc(e.target.value)} autoCapitalize="characters" />
        <label className="field-label">كلمة المرور الجديدة</label>
        <PwInput value={pw} onChange={setPw} placeholder="6 أحرف على الأقل" autoComplete="new-password" />
        {recover.error && <p className="field-error">{recover.error}</p>}
        <button className="btn-primary" disabled={recover.pending || !rc || pw.length < 6}
          onClick={() => checkPhone() && recover.run().catch(() => {})}>
          {recover.pending ? "جارٍ التحقق…" : "تغيير كلمة المرور"}
        </button>
        <div className="pw-links"><button className="link-btn" onClick={() => setStep("password")}>رجوع</button></div>
      </div>
    );
  }

  if (step === "forgot") {
    return (
      <div className="login-card">
        <style>{SEC_CSS}</style>
        {phoneField}
        {sent ? (
          <>
            <p className="sec-ok">{sent}</p>
            <p className="hint">الإدارة راح تراجع طلبك وتتواصل معاك برمز دخول مؤقت.</p>
          </>
        ) : (
          <>
            <label className="field-label">سبب الطلب</label>
            <textarea className="field-input" rows={3} value={reason} placeholder="مثال: نسيت كلمة المرور / غيرت تلفوني"
              onChange={(e) => setReason(e.target.value)} />
            {forgot.error && <p className="field-error">{forgot.error}</p>}
            <button className="btn-primary" disabled={forgot.pending || reason.trim().length < 3}
              onClick={() => checkPhone() && forgot.run().catch(() => {})}>
              {forgot.pending ? "جارٍ الإرسال…" : "إرسال الطلب للإدارة"}
            </button>
          </>
        )}
        <div className="pw-links">
          {allowRecovery && <button className="link-btn" onClick={() => setStep("recover")}>عندي رمز استرجاع</button>}
          <button className="link-btn" onClick={() => { setSent(""); setStep("password"); }}>رجوع</button>
        </div>
      </div>
    );
  }

  if (step === "code") {
    return (
      <div className="login-card">
        <style>{SEC_CSS}</style>
        {phoneField}
        <label className="field-label">رمز الدخول من الإدارة (6 أرقام)</label>
        <input className="field-input" dir="ltr" style={{ textAlign: "center", letterSpacing: 6 }} inputMode="numeric" maxLength={6}
          placeholder="••••••" value={code} onChange={(e) => setCode(digits6(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && code.length === 6 && checkPhone() && codeLogin.run().catch(() => {})} />
        {codeLogin.error && <p className="field-error">{codeLogin.error}</p>}
        <button className="btn-primary" disabled={codeLogin.pending || code.length < 6}
          onClick={() => checkPhone() && codeLogin.run().catch(() => {})}>
          {codeLogin.pending ? "جارٍ الدخول…" : "دخول"}
        </button>
        <p className="hint">بعد الدخول بالرمز راح تطلب منك كلمة مرور جديدة.</p>
        <div className="pw-links">
          <button className="link-btn" onClick={() => setStep("password")}>رجوع</button>
          <button className="link-btn" onClick={() => setStep("phone")}>الدخول برمز SMS</button>
        </div>
      </div>
    );
  }

  // password
  return (
    <div className="login-card">
      <style>{SEC_CSS}</style>
      {phoneField}
      <label className="field-label">كلمة المرور</label>
      <PwInput value={pw} onChange={setPw} placeholder="كلمة المرور"
        onEnter={() => checkPhone() && pw && login.run().catch(() => {})} />
      {login.error && <p className="field-error">{login.error}</p>}
      <button className="btn-primary" disabled={login.pending || !pw}
        onClick={() => checkPhone() && login.run().catch(() => {})}>
        {login.pending ? "جارٍ الدخول…" : "دخول"}
      </button>
      {passkeySupported() && (
        <>
          {face.error && <p className="field-error">{face.error}</p>}
          <button className="btn-ghost pw-alt" disabled={face.pending} onClick={() => face.run().catch(() => {})}>
            {face.pending ? "جارٍ التحقق…" : "🔐 الدخول ببصمة الوجه"}
          </button>
        </>
      )}
      <div className="pw-links">
        <button className="link-btn" onClick={() => setStep("forgot")}>نسيت كلمة المرور؟</button>
        <div className="pw-sep"><span>أو</span></div>
        <button className="btn-ghost pw-alt" onClick={() => setStep("code")}>أول مرة؟ ادخل برمز من الإدارة</button>
        {onNewAccount && <button className="link-btn" onClick={onNewAccount}>مستخدم جديد؟ أنشئ حسابك من هنا</button>}
      </div>
    </div>
  );
}

/** شاشة إجبارية: وضع كلمة مرور (أول دخول أو بعد رمز من الإدارة) */
export function SetPasswordView({ onSaved, onLogout }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [recovery, setRecovery] = useState("");
  const save = useAction(async () => {
    const r = await api.setPassword({ newPassword: pw });
    if (r?.recoveryCode) setRecovery(r.recoveryCode); else await onSaved();
  });
  const mismatch = pw2 && pw !== pw2;
  return (
    <div className="login-screen">
      <style>{SEC_CSS}</style>
      <p className="login-sub" style={{ fontWeight: 700, fontSize: 18 }}>حط كلمة مرور لحسابك</p>
      {recovery ? (
        <div className="login-card"><RecoveryCodeBox code={recovery} onDone={() => onSaved()} doneLabel="تم، كمّل" /></div>
      ) : (
        <div className="login-card">
          <label className="field-label">كلمة المرور الجديدة</label>
          <PwInput value={pw} onChange={setPw} placeholder="6 أحرف على الأقل" autoComplete="new-password" />
          <label className="field-label">أعد كتابتها</label>
          <PwInput value={pw2} onChange={setPw2} placeholder="أعد الكتابة" autoComplete="new-password"
            onEnter={() => pw.length >= 6 && pw === pw2 && save.run().catch(() => {})} />
          {mismatch && <p className="field-error">كلمتا المرور غير متطابقتين</p>}
          {save.error && <p className="field-error">{save.error}</p>}
          <button className="btn-primary" disabled={save.pending || pw.length < 6 || pw !== pw2}
            onClick={() => save.run().catch(() => {})}>
            {save.pending ? "جارٍ الحفظ…" : "حفظ كلمة المرور"}
          </button>
          <button className="link-btn" onClick={onLogout}>تسجيل الخروج</button>
        </div>
      )}
    </div>
  );
}

/** تغيير كلمة المرور + الخروج من كل الأجهزة (+ رمز استرجاع جديد للمدير العام) */
function PasskeyBox() {
  const [list, setList] = useState(null);
  const [msg, setMsg] = useState("");
  const supported = passkeySupported();
  const load = () => api.passkeys().then(setList).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  const add = useAction(async () => { await enablePasskey(); setMsg("تم تفعيل بصمة الوجه على هذا الجهاز"); await load(); });
  const del = useAction(async (id) => { await api.deletePasskey(id); await load(); });
  return (
    <div className="sec-box">
      <h4>بصمة الوجه</h4>
      {supported ? (
        <>
          <p className="hint">بعد التفعيل تدخل بوجهك أو بصمتك بدون كتابة كلمة المرور. تفعّلها مرة على كل جهاز.</p>
          {add.error && <p className="field-error">{add.error}</p>}
          {msg && <p className="sec-ok">{msg}</p>}
          <button className="btn-primary" disabled={add.pending} onClick={() => { setMsg(""); add.run().catch(() => {}); }}>
            {add.pending ? "جارٍ التفعيل…" : "تفعيل بصمة الوجه على هذا الجهاز"}
          </button>
        </>
      ) : (
        <p className="hint">بصمة الوجه تعمل فقط لما تفتح التطبيق من رابط جملة الرسمي (jomla-ly.com).</p>
      )}
      {(list || []).map((k) => (
        <div key={k.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 0", borderTop: "1px solid rgba(128,128,128,.2)" }}>
          <div>
            <div style={{ fontWeight: 600 }}>{k.device_label || "جهاز"}</div>
            <div className="hint" style={{ margin: 0 }}>{k.rp_id} · {k.last_used_at ? "آخر استخدام: " + fmtWhen(k.last_used_at) : "تفعّلت " + fmtWhen(k.created_at)}</div>
          </div>
          <button className="btn-ghost" disabled={del.pending} onClick={() => del.run(k.id).catch(() => {})}>حذف</button>
        </div>
      ))}
      {del.error && <p className="field-error">{del.error}</p>}
    </div>
  );
}

function fmtWhen(d) {
  try { return new Date(d).toLocaleString("ar-LY", { dateStyle: "medium", timeStyle: "short" }); } catch { return ""; }
}

// قائمة الأجهزة اللي دخلت بالحساب، مع إخراج أي جهاز
function DevicesBox({ onLoggedOut }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const load = () => api.sessions().then(setList).catch((e) => setErr(e.message || "تعذر تحميل الأجهزة"));
  useEffect(() => { load(); }, []);
  const kick = useAction(async (s) => {
    await api.revokeSession(s.id);
    if (s.current) onLoggedOut?.(); else await load();
  });
  return (
    <div className="sec-box">
      <h4>أجهزتي</h4>
      {err && <p className="field-error">{err}</p>}
      {list && !list.length && <p className="hint">ما فيه أجهزة مسجّلة بعد. تظهر هنا بعد دخولك القادم.</p>}
      {(list || []).map((s) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 0", borderTop: "1px solid rgba(128,128,128,.2)" }}>
          <div>
            <div style={{ fontWeight: 600 }}>{s.device_label || "جهاز"}{s.current ? " (هذا الجهاز)" : ""}</div>
            <div className="hint" style={{ margin: 0 }}>آخر استخدام: {fmtWhen(s.last_seen_at)}</div>
          </div>
          <button className="btn-ghost" disabled={kick.pending} onClick={() => kick.run(s).catch(() => {})}>{s.current ? "خروج" : "إخراج"}</button>
        </div>
      ))}
      {kick.error && <p className="field-error">{kick.error}</p>}
    </div>
  );
}

export function SecurityPanel({ showRecovery = false, onLoggedOut }) {
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [done, setDone] = useState("");
  const [confirmAll, setConfirmAll] = useState(false);
  const [newCode, setNewCode] = useState("");
  const change = useAction(async () => {
    await api.setPassword({ currentPassword: cur, newPassword: pw });
    setCur(""); setPw(""); setDone("تم تغيير كلمة المرور");
  });
  const outAll = useAction(async () => { await api.logoutAll(); onLoggedOut?.(); });
  const rec = useAction(async () => { const r = await api.newRecoveryCode(cur); setNewCode(r.recoveryCode); setCur(""); });
  return (
    <div style={{ maxWidth: 460 }}>
      <style>{SEC_CSS}</style>
      <div className="sec-box">
        <h4>تغيير كلمة المرور</h4>
        <div className="sec-row">
          <PwInput value={cur} onChange={(v) => { setCur(v); setDone(""); }} placeholder="كلمة المرور الحالية" />
          <PwInput value={pw} onChange={(v) => { setPw(v); setDone(""); }} placeholder="الجديدة (6 أحرف على الأقل)" autoComplete="new-password" />
          {change.error && <p className="field-error">{change.error}</p>}
          {done && <p className="sec-ok">{done}</p>}
          <button className="btn-primary" disabled={change.pending || !cur || pw.length < 6}
            onClick={() => change.run().catch(() => {})}>
            {change.pending ? "جارٍ الحفظ…" : "حفظ"}
          </button>
        </div>
      </div>

      {showRecovery && (
        <div className="sec-box">
          <h4>رمز الاسترجاع</h4>
          {newCode ? (
            <RecoveryCodeBox code={newCode} onDone={() => setNewCode("")} />
          ) : (
            <>
              <p className="hint">إنشاء رمز جديد يلغي القديم. اكتب كلمة المرور الحالية فوق ثم اضغط.</p>
              {rec.error && <p className="field-error">{rec.error}</p>}
              <button className="btn-ghost" disabled={rec.pending || !cur} onClick={() => rec.run().catch(() => {})}>
                {rec.pending ? "جارٍ الإنشاء…" : "إنشاء رمز استرجاع جديد"}
              </button>
            </>
          )}
        </div>
      )}

      <PasskeyBox />

      <DevicesBox onLoggedOut={onLoggedOut} />

      <div className="sec-box">
        <h4>الخروج من كل الأجهزة</h4>
        <p className="hint">لو ضاع تلفونك أو دخلت من جهاز مش جهازك، اخرج من كل الأجهزة (تحتاج تدخل من جديد).</p>
        {outAll.error && <p className="field-error">{outAll.error}</p>}
        {confirmAll ? (
          <div className="sec-row">
            <button className="btn-primary" disabled={outAll.pending} onClick={() => outAll.run().catch(() => {})}>
              {outAll.pending ? "جارٍ الخروج…" : "نعم، اخرج من كل الأجهزة"}
            </button>
            <button className="link-btn" onClick={() => setConfirmAll(false)}>تراجع</button>
          </div>
        ) : (
          <button className="btn-ghost" onClick={() => setConfirmAll(true)}>تسجيل الخروج من كل الأجهزة</button>
        )}
      </div>
    </div>
  );
}

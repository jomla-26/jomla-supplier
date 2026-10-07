// شاشات الدخول بكلمة المرور (مشتركة بين تطبيقات جملة الأربعة — نفس الملف حرفيًا في كل تطبيق).
import React, { useState } from "react";
import { api } from "./api.js";
import { useAction } from "./hooks.js";

const toEnDigits = (s) => String(s || "").replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c));
const digits6 = (s) => toEnDigits(s).replace(/\D/g, "").slice(0, 6);

const SEC_CSS = `
.sec-box{border:1px solid rgba(128,128,128,.3);border-radius:14px;padding:14px;margin:12px 0;text-align:right}
.sec-box h4{margin:0 0 10px;font-size:15px}
.sec-row{display:flex;flex-direction:column;gap:8px}
.sec-code{font:700 22px/1.4 monospace;letter-spacing:2px;direction:ltr;text-align:center;padding:12px;border-radius:12px;
  background:rgba(128,128,128,.12);user-select:all;word-break:break-all}
.sec-ok{color:#1f8a4c;font-weight:600;margin:6px 0}
.sec-warn{color:#b45309;font-size:13px;line-height:1.7;margin:8px 0}
`;

function PwInput({ value, onChange, placeholder, onEnter, autoComplete = "current-password" }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input className="field-input" type={show ? "text" : "password"} dir="ltr" value={value} placeholder={placeholder}
        autoComplete={autoComplete} style={{ textAlign: "right", paddingLeft: 64 }}
        onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onEnter?.()} />
      <button type="button" className="link-btn" tabIndex={-1}
        style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", margin: 0 }}
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
        <button className="link-btn" onClick={() => setStep("password")}>رجوع</button>
      </div>
    );
  }

  if (step === "forgot") {
    return (
      <div className="login-card">
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
        {allowRecovery && <button className="link-btn" onClick={() => setStep("recover")}>عندي رمز استرجاع</button>}
        <button className="link-btn" onClick={() => { setSent(""); setStep("password"); }}>رجوع</button>
      </div>
    );
  }

  if (step === "code") {
    return (
      <div className="login-card">
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
        <button className="link-btn" onClick={() => setStep("password")}>رجوع</button>
      </div>
    );
  }

  // password
  return (
    <div className="login-card">
      {phoneField}
      <label className="field-label">كلمة المرور</label>
      <PwInput value={pw} onChange={setPw} placeholder="كلمة المرور"
        onEnter={() => checkPhone() && pw && login.run().catch(() => {})} />
      {login.error && <p className="field-error">{login.error}</p>}
      <button className="btn-primary" disabled={login.pending || !pw}
        onClick={() => checkPhone() && login.run().catch(() => {})}>
        {login.pending ? "جارٍ الدخول…" : "دخول"}
      </button>
      <div className="otp-footer">
        <button className="link-btn" onClick={() => setStep("forgot")}>نسيت كلمة المرور؟</button>
        <button className="link-btn" onClick={() => setStep("code")}>أول مرة؟ عندي رمز من الإدارة</button>
      </div>
      <button className="link-btn" onClick={() => setStep("phone")}>الدخول برمز SMS</button>
      {allowRecovery && <button className="link-btn" onClick={() => setStep("recover")}>عندي رمز استرجاع</button>}
      {onNewAccount && <button className="link-btn" onClick={onNewAccount}>مستخدم جديد؟ أنشئ حسابك من هنا</button>}
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

      <div className="sec-box">
        <h4>الأجهزة</h4>
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

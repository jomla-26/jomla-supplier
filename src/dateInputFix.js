// يخفي نص حقل التاريخ الفارغ المشوَّه (قنس/رهش/موي) ويعرض "اختر التاريخ" بدله.
// المتصفح بالعربي يرسم الحقل الفارغ بحروف معكوسة، فنعلّم الحقل الفارغ ونغطّي النص بالـCSS.
function mark() {
  document.querySelectorAll('input[type="date"]').forEach((el) => {
    const empty = el.value ? "false" : "true";
    if (el.getAttribute("data-empty") !== empty) el.setAttribute("data-empty", empty);
  });
}
if (typeof window !== "undefined" && !window.__dateFixOn) {
  window.__dateFixOn = true;
  setInterval(mark, 250);
  document.addEventListener("input", mark, true);
  document.addEventListener("change", mark, true);
}

// الضغط على الحقل يفتح لوحة اختيار التاريخ مباشرة (بدل الكتابة بالأجزاء المشوّهة)
if (typeof document !== "undefined" && !window.__dateFixClick) {
  window.__dateFixClick = true;
  document.addEventListener("click", (e) => {
    const el = e.target;
    if (el && el.tagName === "INPUT" && el.type === "date" && typeof el.showPicker === "function") {
      try { el.showPicker(); } catch (_) { /* ignore */ }
    }
  }, true);
}

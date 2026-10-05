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

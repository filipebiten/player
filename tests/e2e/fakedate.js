(() => {
  const full = localStorage.getItem("__fakeDate"); // "YYYY-MM-DD"
  const day = localStorage.getItem("__fakeDay");    // legado: dia do mês, mês fixo (set/2026)
  if (!full && !day) return;
  const R = Date;
  let T;
  if (full) {
    const [y, m, d] = full.split("-").map(Number);
    T = new R(y, m - 1, d, 12).getTime();
  } else {
    T = new R(2026, 8, +day, 12).getTime();
  }
  class F extends R { constructor(...a) { a.length ? super(...a) : super(T); } static now() { return T; } }
  window.Date = F;
})();

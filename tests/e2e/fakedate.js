(() => { const d = localStorage.getItem("__fakeDay"); if (!d) return; const R = Date, T = new R(2026, 8, +d, 12).getTime();
  class F extends R { constructor(...a) { a.length ? super(...a) : super(T); } static now() { return T; } }
  window.Date = F; })();

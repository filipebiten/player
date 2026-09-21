A="agent-browser --session a11y"; U=http://localhost:8765/index.html
agent-browser close --all >/dev/null 2>&1
$A open $U --init-script fakedate.js >/dev/null
echo "== semana pelo dia (critério de aceite)"
for d in 1 7 8 14 15 21 22 30; do
  $A eval "localStorage.setItem('__fakeDay','$d')" >/dev/null; $A eval "$(cat seed.js | sed "s/gistToken:'TESTTOKEN'/x:1/")" >/dev/null; $A reload >/dev/null; $A wait 400 >/dev/null
  echo "dia $d -> $($A eval 'document.querySelector(".weekbar__title").textContent') | atual: $($A eval 'document.querySelector(".seg__btn.is-today").textContent')"
done
$A eval "localStorage.setItem('__fakeDay','21')" >/dev/null; $A reload >/dev/null; $A wait 400 >/dev/null
for vp in "390 844" "1440 900"; do
  $A set viewport $vp >/dev/null; $A reload >/dev/null; $A wait 600 >/dev/null
  echo "== axe @ ${vp% *}px — lista"; $A a11y 2>&1 | grep -v "^✓" | head -25
done
echo "== axe @1440 — cursos"; $A press 2 >/dev/null; $A wait 300 >/dev/null; $A a11y 2>&1 | grep -v "^✓" | head -15
echo "== axe @1440 — ajustes aberto"; $A press 1 >/dev/null; $A click '[data-action=settings]' >/dev/null; $A wait 300 >/dev/null; $A a11y 2>&1 | grep -v "^✓" | head -15

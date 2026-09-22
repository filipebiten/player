A="agent-browser --session a11y"; U=http://localhost:8765/index.html
agent-browser close --all >/dev/null 2>&1
$A open $U --init-script fakedate.js >/dev/null
echo "== semana real pela data (critério de aceite)"
# 4 segundas seguidas devem dar 4 data-group diferentes (0,1,2,3 em alguma ordem cíclica);
# a 5a segunda (28/set) tem que repetir a mesma data-group da 1a (7/set): rotação contínua.
prev=""
for d in 2026-09-07 2026-09-14 2026-09-21 2026-09-28 2026-12-28 2027-01-04; do
  $A eval "localStorage.setItem('__fakeDate','$d')" >/dev/null; $A eval "$(cat seed.js | sed "s/gistToken:'TESTTOKEN'/x:1/")" >/dev/null; $A reload >/dev/null; $A wait 400 >/dev/null
  g=$($A eval 'document.querySelector(".pane-list").dataset.group')
  title=$($A eval 'document.querySelector(".weekbar__title").textContent')
  echo "$d -> grupo $g | título: $title"
done
$A eval "localStorage.setItem('__fakeDate','2026-09-21')" >/dev/null; $A reload >/dev/null; $A wait 400 >/dev/null
for vp in "390 844" "1440 900"; do
  $A set viewport $vp >/dev/null; $A reload >/dev/null; $A wait 600 >/dev/null
  echo "== axe @ ${vp% *}px — lista"; $A a11y 2>&1 | grep -v "^✓" | head -25
done
echo "== axe @1440 — cursos"; $A press 2 >/dev/null; $A wait 300 >/dev/null; $A a11y 2>&1 | grep -v "^✓" | head -15
echo "== axe @1440 — ajustes aberto"; $A press 1 >/dev/null; $A click '[data-action=settings]' >/dev/null; $A wait 300 >/dev/null; $A a11y 2>&1 | grep -v "^✓" | head -15

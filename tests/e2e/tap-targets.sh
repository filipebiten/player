A="agent-browser --session a11y"
$A eval "localStorage.removeItem('__fakeDate')" >/dev/null; $A eval "localStorage.setItem('__fakeDay','30')" >/dev/null; $A set viewport 390 844 >/dev/null; $A reload >/dev/null; $A wait 500 >/dev/null
echo "dia 30 -> $($A eval 'document.querySelector(".weekbar__title").textContent')"
JS='[...document.querySelectorAll("button,a[href],input")].filter(e=>e.offsetParent!==null||e.closest("dialog[open]")).map(e=>{const r=e.getBoundingClientRect();return {t:(e.dataset.action||e.tagName)+":"+(e.className||""),w:Math.round(r.width),h:Math.round(r.height)}}).filter(x=>x.w<44||x.h<44)'
for view in lista canal cursos; do
  case $view in
    canal) $A click '.ch:nth-child(1) .ch__main' >/dev/null; $A wait 300 >/dev/null;;
    cursos) $A eval 'history.back()' >/dev/null; $A wait 200 >/dev/null; $A click '[data-action=tab][data-tab=courses]' >/dev/null; $A wait 300 >/dev/null;;
  esac
  echo "== alvos <44px em $view: $($A eval "JSON.stringify($JS)")"
done
echo "== ajustes"; $A click '[data-action=tab][data-tab=videos]' >/dev/null; $A click '[data-action=settings]' >/dev/null; $A wait 300 >/dev/null; echo "$($A eval "JSON.stringify($JS)")"
echo "foco inicial no diálogo: $($A eval 'document.activeElement.getAttribute("aria-label")||document.activeElement.tagName')"
$A press Escape >/dev/null; $A wait 200 >/dev/null; echo "Esc fecha: $($A eval '!document.querySelector("dialog[open]")')"

A="agent-browser --session channels"; U=http://localhost:8767/index.html
agent-browser close --all >/dev/null 2>&1
# agent-browser (0.37.1) só aplica o PRIMEIRO --init-script quando passado mais de uma vez
# (documentado como "repeatable", mas não é nesta versão). Concatenar não dá porque os dois
# arquivos declaram `const _f` no top-level (colisão de identificador). Solução: gerar um
# arquivo combinado com cada script isolado num IIFE, e passar só ele.
# fakedate.js entra também: sem data fixa, o canal marcado só cai na lista principal se
# "hoje" (data real) calhar de ser o Grupo A — em 3 de cada 4 semanas o teste falharia à toa.
{ printf '(function(){\n'; cat redirect.js; printf '\n})();\n(function(){\n'; cat mock-google-oauth.js; printf '\n})();\n(function(){\n'; cat fakedate.js; printf '\n})();\n'; } > .channels-init.js
$A open $U --init-script .channels-init.js >/dev/null
$A set viewport 1440 900 >/dev/null
$A eval "$(cat seed.js | sed "s/gistToken:'TESTTOKEN'/x:1/")" >/dev/null
$A eval "localStorage.setItem('__fakeDate','2026-09-28')" >/dev/null
$A reload >/dev/null; $A wait 400 >/dev/null

echo "== conectar e listar canais mockados"
$A click '[data-action=settings]' >/dev/null; $A wait 200 >/dev/null
$A click '[data-action=oauth-connect]' >/dev/null; $A wait 300 >/dev/null
echo "canais listados: $($A eval 'document.querySelectorAll(".ch-pick").length')"

echo "== marcar Canal Mock 1"
$A click '[data-action="toggle-channel"][data-id="UCfake1"]' >/dev/null; $A wait 200 >/dev/null
echo "grupo mostrado: $($A eval 'document.querySelector("[data-id=UCfake1]").closest(".ch-pick").querySelector(".ch-pick__group").textContent')"

echo "== persiste depois de fechar e reabrir os Ajustes"
$A click '[data-action=close-settings]' >/dev/null; $A wait 100 >/dev/null
$A click '[data-action=settings]' >/dev/null; $A wait 200 >/dev/null
$A click '[data-action=oauth-connect]' >/dev/null; $A wait 300 >/dev/null
echo "marcado ainda aparece: $($A eval 'document.querySelector("[data-id=UCfake1]").getAttribute("aria-pressed")')"

echo "== persiste depois de reload completo (localStorage)"
$A reload >/dev/null; $A wait 400 >/dev/null
echo "canal Mock 1 aparece na lista principal: $($A eval 'Array.from(document.querySelectorAll(".ch__name")).some(e => e.textContent === "Canal Mock 1")')"

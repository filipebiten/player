# v2.1: validação do token, indicador de sync desligado, mostrar mais, próximo não assistido, service worker
U=http://localhost:8767/index.html; A="agent-browser --session feat"
agent-browser close --all >/dev/null 2>&1
python3 -c "import urllib.request as u;u.urlopen(u.Request('http://localhost:8766/__reset',headers={'Authorization':'Bearer TESTTOKEN'}));u.urlopen('http://localhost:8766/__quota?off')"; : > mock_gist.log
$A open $U --init-script redirect.js >/dev/null; $A set viewport 1440 900 >/dev/null
$A eval "localStorage.clear(); localStorage.setItem('fp-config', JSON.stringify({apiKey:'FAKEKEY'}))" >/dev/null; $A reload >/dev/null; $A wait 1500 >/dev/null
echo "== sync desligado visível: $($A eval 'document.querySelector(".sync")?.dataset.state') | aria: $($A eval 'document.querySelector(".sync")?.getAttribute("aria-label")')"
echo "== mostrar mais"
echo "vídeos iniciais: $($A eval 'document.querySelectorAll(".video").length') | botão: $($A eval '!!document.querySelector("[data-action=more]")')"
$A click '[data-action=more]' >/dev/null; $A wait 1200 >/dev/null
echo "após clicar: $($A eval 'document.querySelectorAll(".video").length') vídeos | botão some no fim: $($A eval '!document.querySelector("[data-action=more]")') | chamadas: $(grep '^YT' mock_gist.log | grep -c pageToken) com pageToken"
echo "cache guarda next/uploads: $($A eval 'const c=JSON.parse(localStorage.getItem("fp-vidcache")).CanalEleve;JSON.stringify({n:c.vids.length,next:c.next,uploads:c.uploads})')"
$A reload >/dev/null; $A wait 800 >/dev/null
echo "recarregou a página: $($A eval 'document.querySelectorAll(".video").length') vídeos (lista estendida persiste no cache)"
echo "== próximo não assistido"
echo "link: $($A eval 'document.querySelector(".detail__actions a.btn").href') (esperado vid1, o mais novo)"
$A click '.video:nth-child(1) .check' >/dev/null; $A wait 200 >/dev/null
echo "após marcar vid1: $($A eval 'document.querySelector(".detail__actions a.btn").href') (esperado vid2)"
echo "== token: mensagens"
tok(){ $A eval 'document.querySelector("dialog[open]")?.close()' >/dev/null; $A click '[data-action=settings]' >/dev/null; $A wait 200 >/dev/null; $A fill 'dialog #gistToken' "$1" >/dev/null; $A click 'dialog button[type=submit]' >/dev/null; $A wait 1200 >/dev/null; echo "$2 -> $($A eval 'document.querySelector("dialog .form-error")?.hidden===false ? "ERRO: "+document.querySelector("dialog .form-error").textContent : (document.querySelector("dialog[open]") ? "aberto sem erro" : "salvou e fechou")')"; }
tok github_pat_abc "fine-grained   "
tok BAD "inválido       "
tok NOGIST "sem escopo gist "
$A eval 'document.querySelector("dialog").close()' >/dev/null
tok TESTTOKEN "válido         "
echo "gist criado no servidor: $(grep -c 'POST /gists' mock_gist.log) | diagnóstico: $($A click '[data-action=settings]' >/dev/null; $A wait 300 >/dev/null; $A eval 'document.querySelector("dialog .hint:last-of-type, dialog .hint + .hint")?.textContent||[...document.querySelectorAll("dialog .hint")].map(e=>e.textContent).join(" | ")')"
echo "== service worker"
$A eval 'document.querySelector("dialog")?.close()' >/dev/null
$A reload >/dev/null; $A wait 1500 >/dev/null
echo "registrado: $($A eval 'navigator.serviceWorker.getRegistration().then(r=>!!r&&!!r.active)')"
$A reload >/dev/null; $A wait 1000 >/dev/null
echo "controlando a página: $($A eval '!!navigator.serviceWorker.controller')"
$A set offline on >/dev/null; $A reload >/dev/null; $A wait 2500 >/dev/null
echo "OFFLINE — app abriu: $($A eval '!!document.querySelector(".app")') | semana: $($A eval 'document.querySelector(".weekbar__title")?.textContent') | vídeos do cache: $($A eval 'document.querySelectorAll(".video").length')"
$A set offline off >/dev/null
echo "erros de página: $($A errors | head -3)"

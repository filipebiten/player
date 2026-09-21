P="agent-browser --session phone"
setcfg(){ $P eval "localStorage.setItem('fp-config', JSON.stringify($1))" >/dev/null; $P reload >/dev/null; $P wait 1500 >/dev/null; }
reset(){ python3 -c "import urllib.request as u;u.urlopen(u.Request('http://localhost:8766/__reset',headers={'Authorization':'Bearer TESTTOKEN'}))"; }
$P open http://localhost:8767/index.html --init-script redirect.js >/dev/null; $P set viewport 390 844 >/dev/null; $P eval "$(cat seed.js)" >/dev/null; $P reload >/dev/null; $P wait 1000 >/dev/null
$P errors --clear >/dev/null 2>&1
echo "== A. sem token (config só com apiKey)"; : > mock_gist.log; setcfg "{apiKey:'TEST'}"
echo "requests gist: $(grep -c gists mock_gist.log) | indicador: $($P eval 'document.querySelector(".sync")?.dataset.state') (esperado off)"
echo "== B. token inválido"; setcfg "{apiKey:'TEST',gistToken:'BAD'}"
echo "indicador: $($P eval 'document.querySelector(".sync")?.dataset.state') | aria: $($P eval 'document.querySelector(".sync")?.getAttribute("aria-label")')"
echo "== C. gist apagado no servidor (gistId velho)"; reset; : > mock_gist.log; setcfg "{apiKey:'TEST',gistToken:'TESTTOKEN',gistId:'g1'}"
cat mock_gist.log; echo "gistId novo: $($P eval 'JSON.parse(localStorage.getItem("fp-config")).gistId')  estado: $($P eval 'document.querySelector(".sync")?.dataset.state')"
echo "== D. offline"; $P set offline on >/dev/null; $P click '.ch:nth-child(2) .check' >/dev/null; $P wait 3500 >/dev/null
echo "estado offline: $($P eval 'document.querySelector(".sync")?.dataset.state') | marcou local: $($P eval 'document.querySelector(".ch:nth-child(2)").classList.contains("is-done")')"
$P set offline off >/dev/null; $P eval 'window.dispatchEvent(new Event("online"))' >/dev/null; $P wait 1500 >/dev/null
echo "voltou online: $($P eval 'document.querySelector(".sync")?.dataset.state')"; tail -2 mock_gist.log
echo "== erros de página:"; $P errors | head -5

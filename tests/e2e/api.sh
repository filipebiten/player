A="agent-browser --session api"; U=http://localhost:8767/index.html
q(){ python3 -c "import urllib.request as u;u.urlopen('http://localhost:8766/__quota?$1')"; }
yt(){ grep -c '^YT' mock_gist.log; }
agent-browser close --all >/dev/null 2>&1; : > mock_gist.log; q off
$A open $U --init-script redirect.js >/dev/null
$A set viewport 1440 900 >/dev/null
$A eval "localStorage.clear(); localStorage.setItem('fp-config', JSON.stringify({apiKey:'FAKEKEY'}))" >/dev/null
$A reload >/dev/null; $A wait 1500 >/dev/null
echo "1) primeira carga — vídeos: $($A eval 'document.querySelectorAll(".video").length') (esperado 2: 'Private video' filtrado)"
echo "   título escapado: $($A eval 'document.querySelector(".video__title").innerHTML')"
echo "   href: $($A eval 'document.querySelector(".video__link").href') | target=$($A eval 'document.querySelector(".video__link").target') rel=$($A eval 'document.querySelector(".video__link").rel')"
echo "   chamadas à API: $(yt) (esperado 3: forHandle + channels por id + playlistItems)"; grep '^YT' mock_gist.log
: > mock_gist.log; $A reload >/dev/null; $A wait 1200 >/dev/null
echo "2) recarregar página <6h — chamadas: $(yt) (esperado 0)"
$A press r >/dev/null; $A wait 1200 >/dev/null
echo "3) tecla R (forçar) — chamadas: $(yt) (esperado 2: channels por id + playlistItems; o handle já está em cache) $(grep '^YT' mock_gist.log | tr '\n' ' ')"
echo "   fp-chid: $($A eval 'localStorage.getItem("fp-chid")')"
$A eval "const c=JSON.parse(localStorage.getItem('fp-vidcache')); for(const k in c) c[k].t-=7*3600000; localStorage.setItem('fp-vidcache',JSON.stringify(c))" >/dev/null
: > mock_gist.log; $A reload >/dev/null; $A wait 1200 >/dev/null
echo "4) cache expirado (7h) reabre — chamadas: $(yt) (esperado 2)"
q on; : > mock_gist.log; $A press r >/dev/null; $A wait 1200 >/dev/null
echo "5) cota estourada: '$($A eval 'document.querySelector(".notice--error")?.textContent')' | vídeos ainda visíveis: $($A eval 'document.querySelectorAll(".video").length')"
q off
echo "6) canal tipo busca (Andrea Vargas, semana 1)"; $A press '[' >/dev/null; $A press '[' >/dev/null; $A wait 300 >/dev/null
$A eval 'document.querySelectorAll(".ch__main")[3].click()' >/dev/null; $A wait 1200 >/dev/null
echo "   $(grep '^YT' mock_gist.log | tail -1) | meta: $($A eval 'document.querySelector(".video__meta")?.textContent')"
echo "erros de página: $($A errors | head -3)"

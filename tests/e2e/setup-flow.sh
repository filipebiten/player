# Tela inicial: API Key + token opcional, primeira execução (usa o mock em :8767)
A="agent-browser --session setup"; U=http://localhost:8767/index.html
q(){ python3 -c "import urllib.request as u;u.urlopen(u.Request('http://localhost:8766/__reset',headers={'Authorization':'Bearer TESTTOKEN'}))"; }
agent-browser close --all >/dev/null 2>&1; q; : > mock_gist.log
$A open $U --init-script redirect.js >/dev/null; $A set viewport 390 844 >/dev/null
$A eval "localStorage.clear()" >/dev/null; $A reload >/dev/null; $A wait 500 >/dev/null
echo "0) largura real: $($A eval "innerWidth")"
echo "1) tela inicial aparece sem config: $($A eval '!!document.querySelector("[data-form=setup]")')"
$A screenshot setup-390.png >/dev/null
echo "2) campos: apiKey type=$($A eval 'document.querySelector("#apiKey").type') | token type=$($A eval 'document.querySelector("#gistToken").type') | required apiKey=$($A eval 'document.querySelector("#apiKey").required') | required token=$($A eval 'document.querySelector("#gistToken").required')"
echo "3) enviar vazio não avança: $($A eval 'document.querySelector("[data-form=setup]").checkValidity()')"
$A fill '#apiKey' 'FAKEKEY123' >/dev/null; $A fill '#gistToken' 'TESTTOKEN' >/dev/null; $A press Enter >/dev/null; $A wait 2500 >/dev/null
echo "4) entrou no app: $($A eval '!!document.querySelector(".app")') | semana: $($A eval 'document.querySelector(".weekbar__title")?.textContent')"
echo "5) config salvo: $($A eval 'const c=JSON.parse(localStorage.getItem("fp-config"));JSON.stringify({apiKey:c.apiKey,tokenSalvo:!!c.gistToken,gistId:c.gistId})')"
echo "6) gist criado: $(grep -c 'POST /gists' mock_gist.log) | vídeos carregados do mock: $($A eval 'document.querySelectorAll(".video").length')"
echo "7) só API Key (sem token) também entra:"; $A eval "localStorage.clear()" >/dev/null; $A reload >/dev/null; $A wait 400 >/dev/null; : > mock_gist.log
$A fill '#apiKey' 'FAKEKEY123' >/dev/null; $A press Enter >/dev/null; $A wait 1500 >/dev/null
echo "   app: $($A eval '!!document.querySelector(".app")') | chamadas gist: $(grep -c gists mock_gist.log) | indicador de sync: $($A eval '!!document.querySelector(".sync")')"
echo "8) ajustes mobile (bottom sheet)"; $A click '[data-action=settings]' >/dev/null; $A wait 300 >/dev/null; $A screenshot settings-390.png >/dev/null
echo "   token mascarado: $($A eval 'document.querySelector("dialog #gistToken").type')"
echo "erros de página: $($A errors | head -3)"

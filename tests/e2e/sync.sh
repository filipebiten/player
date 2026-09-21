U=http://localhost:8767/index.html
P="agent-browser --session phone"; D="agent-browser --session desk"
agent-browser close --all >/dev/null 2>&1
: > mock_gist.log
python3 -c "import urllib.request as u;u.urlopen(u.Request('http://localhost:8766/__reset',headers={'Authorization':'Bearer TESTTOKEN'}))"
boot(){ s="$1"; w="$2"; h="$3"; agent-browser --session $s open $U --init-script redirect.js >/dev/null; agent-browser --session $s set viewport $w $h >/dev/null; agent-browser --session $s eval "$(cat seed.js)" >/dev/null; agent-browser --session $s reload >/dev/null; agent-browser --session $s wait 1500 >/dev/null; }
row1(){ agent-browser --session $1 eval 'document.querySelector(".ch:nth-child(1)").classList.contains("is-done")'; }
count(){ agent-browser --session $1 eval 'document.querySelector(".weekbar__count").textContent'; }
echo "== 1. celular abre com token: cria gist"; boot phone 390 844; cat mock_gist.log
echo "== 2. celular marca canal 1 concluído"; $P click '.ch:nth-child(1) .check' >/dev/null; $P wait 3500 >/dev/null; echo "celular done=$(row1 phone) $(count phone)"; grep -c PATCH mock_gist.log
echo "== 3. computador abre (progresso vazio local) e deve ver concluído"; boot desk 1440 900; echo "desk done=$(row1 desk) $(count desk)"
echo "== 4. computador desmarca + marca vídeo; celular recarrega"; $D click '.ch:nth-child(1) .check' >/dev/null; $D click '.video:nth-child(2) .check' >/dev/null; $D wait 3500 >/dev/null
$P reload >/dev/null; $P wait 1500 >/dev/null; echo "celular done=$(row1 phone) $(count phone)"
$P click '.ch:nth-child(1) .ch__main' >/dev/null; $P wait 300 >/dev/null
echo "celular vídeo2 assistido=$($P eval 'document.querySelector(".video:nth-child(2)").classList.contains("is-watched")')"
echo "== 5. status no ajustes"; $P click '[data-action=settings]' >/dev/null; $P wait 300 >/dev/null; $P eval 'document.getElementById("sync-status").textContent'
echo "== log do servidor"; cat mock_gist.log
echo "== gist criado: público? / arquivos"; python3 -c "
import urllib.request as u,json
d=json.load(u.urlopen(u.Request('http://localhost:8766/__dump',headers={'Authorization':'Bearer TESTTOKEN'})))
for k,v in d.items(): print(k,'public=',v.get('public'),list(v['files']), len(v['files']['flowplayer-progress.json']['content']),'bytes')
"

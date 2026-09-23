#!/usr/bin/env bash
# Sobe o ambiente de teste:
#   :8765  site real (CSP de produção)      → testes sem rede (visual, a11y, semana)
#   :8767  cópia com o CSP liberando o mock → testes de sync e API do YouTube
#   :8766  mock de Gist + YouTube (CORS)    → mock_gist.py
# Parar: ./setup.sh stop
cd "$(dirname "$0")"
if [ "$1" = "stop" ]; then pkill -f "http.server 876[57]"; pkill -f mock_gist.py; exit 0; fi
ROOT=../..
rm -rf .site && mkdir .site
cp $ROOT/index.html $ROOT/styles.css $ROOT/app.js $ROOT/lib.js $ROOT/data.js $ROOT/oauth.js $ROOT/sw.js $ROOT/manifest.json $ROOT/icon-192.png $ROOT/icon-512.png .site/
sed -i.bak "s#connect-src https://www.googleapis.com#connect-src http://localhost:8766 https://www.googleapis.com#" .site/index.html && rm .site/index.html.bak
# Bloqueia o script real do Google Identity Services na cópia de teste: com rede de verdade
# disponível, ele carregaria e sobrescreveria o mock de window.google (channels.sh), abrindo
# um OAuth real e quebrando o teste. channels.sh não precisa dele — só do mock.
sed -i.bak "s#script-src 'self' https://accounts.google.com/gsi/client#script-src 'self'#" .site/index.html && rm .site/index.html.bak
: > mock_gist.log
(python3 -m http.server 8765 -d $ROOT >/dev/null 2>&1 &)
(python3 -m http.server 8767 -d .site >/dev/null 2>&1 &)
(python3 mock_gist.py >/dev/null 2>&1 &)
sleep 1; echo "site :8765  teste :8767  mock :8766"

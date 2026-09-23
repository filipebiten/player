// Stub de window.google.accounts.oauth2 pros testes de navegador: nunca abre popup real,
// devolve um token falso na hora. Injetado via --init-script (roda antes de qualquer <script>
// da página, então cobre o window.google que o app.js/oauth.js esperam encontrar).
window.google = {
  accounts: {
    oauth2: {
      initTokenClient(cfg) {
        // oauth.js reatribui client.callback a cada chamada (client = objeto retornado
        // aqui, não o `cfg` original) — por isso requestAccessToken tem que ler
        // client.callback (this.callback), não cfg.callback, senão nunca vê a troca.
        const client = {
          callback: cfg.callback,
          requestAccessToken() {
            setTimeout(() => client.callback({ access_token: "fake-token", expires_in: 3600 }), 10);
          },
        };
        return client;
      },
      revoke(_token, cb) { cb && cb(); },
    },
  },
};

// Stub de fetch pra subscriptions.list: intercepta só essa URL, deixa o resto (redirect.js)
// cuidar do YouTube/GitHub normal.
const _f = window.fetch.bind(window);
window.fetch = (u, o) => {
  if (String(u).includes("/youtube/v3/subscriptions")) {
    return Promise.resolve(new Response(JSON.stringify({
      items: [
        { snippet: { resourceId: { channelId: "UCfake1" }, title: "Canal Mock 1" } },
        { snippet: { resourceId: { channelId: "UCfake2" }, title: "Canal Mock 2" } },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
  }
  return _f(u, o);
};

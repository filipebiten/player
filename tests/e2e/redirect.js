const _f = window.fetch.bind(window);
window.fetch = (u, o) => _f(String(u).replace("https://api.github.com", "http://localhost:8766").replace("https://www.googleapis.com", "http://localhost:8766"), o);

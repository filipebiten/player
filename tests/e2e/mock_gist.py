import json, sys, time
from http.server import BaseHTTPRequestHandler, HTTPServer
DB = {}
MODE = {"quota": False}   # id -> {"created_at":..., "files": {name: {"content": str}}}
LOG = open("mock_gist.log", "a", buffering=1)
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _send(self, code, obj=None):
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        if obj is not None: self.wfile.write(json.dumps(obj).encode())
    def _auth(self):
        ok = self.headers.get("Authorization") == "Bearer TESTTOKEN"
        if not ok: self._send(401, {"message": "Bad credentials"})
        return ok
    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")
    def do_OPTIONS(self): self._send(204)
    def _yt(self):
        LOG.write(f"YT {self.path.split('&key')[0]}\n")
        if MODE["quota"]: return self._send(403, {"error": {"code": 403, "message": "quota", "errors": [{"reason": "quotaExceeded"}]}})
        thumb = "data:image/gif;base64,R0lGODlhAQABAAAAACw="
        if self.path.startswith("/youtube/v3/channels"):
            return self._send(200, {"items": [{"id": "UCmock", "contentDetails": {"relatedPlaylists": {"uploads": "UUmock"}}}]})
        if self.path.startswith("/youtube/v3/playlistItems"):
            it = lambda t, v, d: {"snippet": {"title": t, "resourceId": {"videoId": v}, "publishedAt": d, "channelTitle": "Mock", "thumbnails": {"medium": {"url": thumb}}}}
            return self._send(200, {"items": [it("Video real 1 <b>x</b>", "vid1", "2026-09-20T10:00:00Z"), it("Private video", "vidP", "2026-09-19T10:00:00Z"), it("Video real 2", "vid2", "2026-09-10T10:00:00Z")]})
        if self.path.startswith("/youtube/v3/search"):
            return self._send(200, {"items": [{"id": {"videoId": "vs1"}, "snippet": {"title": "Resultado de busca", "publishedAt": "2026-09-20T10:00:00Z", "channelTitle": "Outro canal", "thumbnails": {"medium": {"url": thumb}}}}]})
        self._send(404, {})
    def do_GET(self):
        if self.path.startswith("/youtube/"): return self._yt()
        if self.path.startswith("/__quota"): MODE["quota"] = "on" in self.path; return self._send(200, {})
        LOG.write(f"GET {self.path} cache={self.headers.get('Cache-Control')}\n")
        if not self._auth(): return
        if self.path.startswith("/__reset"): DB.clear(); return self._send(200, {})
        if self.path.startswith("/__dump"): return self._send(200, DB)
        if self.path.startswith("/gists?"): return self._send(200, [{"id": k, "created_at": v["created_at"], "files": {n: {} for n in v["files"]}} for k, v in DB.items()])
        gid = self.path.split("/gists/")[-1]
        if gid not in DB: return self._send(404, {"message": "Not Found"})
        self._send(200, {"id": gid, "files": {n: {"content": f["content"], "truncated": False} for n, f in DB[gid]["files"].items()}})
    def do_POST(self):
        if not self._auth(): return
        b = self._body(); gid = f"g{len(DB)+1}"
        DB[gid] = {"created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"), "files": b["files"], "public": b.get("public")}
        LOG.write(f"POST /gists -> {gid} public={b.get('public')}\n"); self._send(201, {"id": gid})
    def do_PATCH(self):
        if not self._auth(): return
        gid = self.path.split("/gists/")[-1]; b = self._body()
        LOG.write(f"PATCH {gid}\n")
        if gid not in DB: return self._send(404, {"message": "Not Found"})
        DB[gid]["files"].update(b["files"]); self._send(200, {"id": gid})
HTTPServer(("127.0.0.1", 8766), H).serve_forever()

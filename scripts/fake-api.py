import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

ADMIN_TOKEN = "test-admin-token"
accounts = set()
hubs = []
invited = []
services = []


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def body(self):
        length = int(self.headers.get("content-length", 0))
        return json.loads(self.rfile.read(length) or b"{}")

    def reply(self, status, payload=None):
        data = json.dumps(payload if payload is not None else {}).encode()
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def signed_in(self):
        return "session=ok" in self.headers.get("cookie", "")

    def do_GET(self):
        if self.path == "/instances" and self.signed_in():
            return self.reply(200, hubs)
        if self.path == "/services" and self.signed_in():
            return self.reply(200, [{"service": name} for name in services])
        self.reply(401)

    def do_POST(self):
        payload = self.body()
        if self.path == "/auth/credentials":
            if self.headers.get("X-Admin-Token") != ADMIN_TOKEN:
                return self.reply(404)
            if payload["email"] in accounts:
                return self.reply(409)
            accounts.add(payload["email"])
            return self.reply(201)
        if self.path == "/auth/service-keys":
            if self.headers.get("X-Admin-Token") != ADMIN_TOKEN:
                return self.reply(404)
            services.append(payload["service"])
            return self.reply(201, {"token": "never-printed"})
        if self.path == "/auth/signin":
            if payload.get("email") not in accounts:
                return self.reply(401)
            data = b"{}"
            self.send_response(201)
            self.send_header("set-cookie", "session=ok; Path=/")
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        if not self.signed_in():
            return self.reply(401)
        if self.path == "/instances/import":
            name = payload.get("name") or payload["agency"]["name"]
            hubs.append({"id": "hub-%d" % len(hubs), "name": name})
            return self.reply(201, hubs[-1])
        if self.path.endswith("/invitations"):
            invited.append(payload["email"])
            return self.reply(202)
        self.reply(404)


HTTPServer(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()

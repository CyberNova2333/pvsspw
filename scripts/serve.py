"""Serve only locked player assets and the measuring probes, using one origin per core."""
import argparse
from functools import partial
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
import os
import re
import shutil
import subprocess
import sys
from urllib.parse import parse_qs, unquote, urlsplit

from prepare import CACHE, ROOT, sha
from edge_backends import BACKENDS, find_browser, parse_open_edge_payload, validate_backend_ready

PORTS = {"vitaslop": 18741, "vita3k": 18742}


class Player(BaseHTTPRequestHandler):
    def __init__(self, *args, engine, lock, directory, inputs, edge_launcher=False, **kwargs):
        self.engine, self.lock, self.directory, self.inputs = engine, lock, directory, inputs
        self.edge_launcher = edge_launcher
        super().__init__(*args, **kwargs)

    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/__local/open-edge" or not self.edge_launcher:
            return self.send_error(404)
        host = self.headers.get("Host")
        if (host not in {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}
                or self.headers.get("Origin") != f"http://{host}"
                or self.headers.get("Sec-Fetch-Site") != "same-origin"
                or self.headers.get("X-PVSSPW-Action") != "open-edge"):
            return self.send_error(403)
        try:
            length = int(self.headers.get("Content-Length") or "0")
        except ValueError:
            return self.send_error(400)
        if length < 0 or length > 256:
            return self.send_error(400)
        raw = self.rfile.read(length) if length else b""
        try:
            backend, title = parse_open_edge_payload(raw)
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
            return self._send_json(400, {"ok": False, "error": str(exc)})
        err = validate_backend_ready(backend)
        if err:
            return self._send_json(400, {"ok": False, "error": err})
        command = [sys.executable, str(ROOT / "scripts/open-edge.py"), "--backend", backend]
        if title:
            command.append(title)
        subprocess.Popen(command, cwd=ROOT, stdin=subprocess.DEVNULL, start_new_session=True)
        return self._send_json(202, {"ok": True, "backend": backend, "label": BACKENDS[backend]["label"]})

    def do_GET(self):
        name = unquote(urlsplit(self.path).path).removeprefix("/") or "index.html"
        data = None
        product = "overlaySha256" in self.lock
        if product and name == "ui/index.html":
            self.send_response(302)
            self.send_header("Location", "/")
            self.end_headers()
            return
        if product and (name == "index.html" or name.startswith("ui/")):
            folder = ROOT / "web"
            path = (folder / name.removeprefix("ui/")).resolve()
            if not path.is_relative_to(folder) or not path.is_file():
                return self.send_error(404)
            if self.edge_launcher and name == "index.html":
                data = path.read_bytes().replace(b'<html ', b'<html data-local-edge ', 1)
        elif product and name == "engine.html":
            path = ROOT / "web/engine.html"
        elif product and name in {"workbench-player.js", "workbench-audio.js"}:
            # Keep the baseline modules intact. A new app window has no user
            # activation and Edge may leave AudioContext.resume() pending until a click.
            path = self.directory / name.removeprefix("workbench-")
            if name == "workbench-player.js":
                data = path.read_bytes().replace(b'from "./audio.js"', b'from "./workbench-audio.js"', 1)
                if self.lock.get("directionSteps"):
                    data = data.replace(b'from "./touchpad.js"', b'from "/ui/touch-directions.js"', 1)
            else:
                data = path.read_bytes().replace(b"await context.resume().catch", b"void context.resume().catch", 1)
        elif product and name == "core.html":
            path = self.directory / "index.html"
            data = path.read_bytes().replace(b"<head>", b'<head><script src="/__bench/probe.js"></script>', 1)
        elif name in self.lock["files"]:
            path = self.directory / name
            if name == "index.html":
                data = path.read_bytes().replace(b"<head>", b'<head><script src="/__bench/probe.js"></script>', 1)
            elif name == "worker.js" and self.engine == "vitaslop":
                data = (ROOT / "bench/worker-probe.js").read_bytes() + b"\n" + path.read_bytes()
                query = parse_qs(urlsplit(self.path).query)
                if product:
                    data = b'import "/ui/frameflow-worker.js";\n' + data
                if product and query.get("uiMode") in (["core"], ["compatibility"], ["fallback"]):
                    data = b'import "/ui/gpu-preference.js";\n' + data
                if "captureGame" in query or (product and query.get("uiPresent") == ["software"]):
                    data = (ROOT / "bench/capture-game.js").read_bytes() + b"\n" + data
        elif name == "__bench/probe.js":
            path = ROOT / "bench/probe.js"
            config = {"engine": self.engine, "revision": self.lock["deploymentCommit"],
                      "sample": json.loads((ROOT / "bench/sample.lock.json").read_text())}
            data = b"globalThis.PV_CONFIG=" + json.dumps(config).encode() + b";\n" + path.read_bytes()
        elif self.inputs and name in {"__input/PCSG00214.zip", "__input/firmware.zip"}:
            allowed = {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}
            if self.headers.get("Host") not in allowed or self.headers.get("Sec-Fetch-Site") != "same-origin":
                return self.send_error(403)
            # Only the loopback browser automation needs these two local files.
            path = CACHE / "inputs" / name.split("/")[1]
        else:
            return self.send_error(404)
        if not path.is_file():
            return self.send_error(404)
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(path.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(data) if data is not None else path.stat().st_size))
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        if self.edge_launcher and name == "index.html":
            self.send_header("Content-Security-Policy", "frame-ancestors 'self'")
        self.send_header("Cache-Control", "no-store" if data is not None or name.startswith("__input/") else "no-cache")
        self.end_headers()
        try:
            if data is not None:
                self.wfile.write(data)
            else:
                with path.open("rb") as f:
                    shutil.copyfileobj(f, self.wfile, 1 << 20)
        except (BrokenPipeError, ConnectionResetError):
            pass


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("engine", choices=PORTS)
    parser.add_argument("--fixed", action="store_true", help="serve the local Vitaslop firmware build on port 18747")
    parser.add_argument("--edge-launcher", action="store_true", help="let this loopback workbench open a local Linux Edge game window")
    parser.add_argument("--local-inputs", action="store_true", help="enable local-only sample streaming for the Android runner")
    parser.add_argument("--port", type=int, help="override the default loopback port")
    parser.add_argument("--battle", action="store_true", help="serve the isolated battle trial build")
    a = parser.parse_args()
    if a.battle and not a.fixed:
        parser.error("--battle requires --fixed")
    lock = json.loads((ROOT / "bench/players.lock.json").read_text())[a.engine]
    directory = CACHE / "players" / a.engine
    port = PORTS[a.engine]
    if a.fixed:
        if a.engine != "vitaslop" or a.local_inputs:
            parser.error("--fixed requires desktop Vitaslop")
        directory = CACHE / "builds" / ("vitaslop-battle" if a.battle else "vitaslop")
        lock = json.loads((directory / "manifest.json").read_text())
        port = 18751 if a.battle else 18747
    port = a.port or port
    if a.edge_launcher and not (a.fixed and port == 18747 and sys.platform == "linux"
            and (os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY"))
            and find_browser()):
        parser.error("--edge-launcher requires the local Linux desktop, Chromium/Edge and --fixed on port 18747")
    for file, digest in lock["files"].items():
        path = directory / file
        if not path.is_file() or sha(path) != digest:
            parser.error(f"Missing/mismatched player file: {file}; run prepare.py players")
    if a.local_inputs:
        manifest = json.loads((ROOT / "bench/sample.lock.json").read_text())
        for file in ("PCSG00214.zip", "firmware.zip"):
            if sha(CACHE / "inputs" / file) != manifest[file]["sha256"]:
                parser.error("Sample mismatch: " + file)
    handler = partial(Player, engine=a.engine, lock=lock, directory=directory, inputs=a.local_inputs,
                      edge_launcher=a.edge_launcher)
    with ThreadingHTTPServer(("127.0.0.1", port), handler) as server:
        print(f"{a.engine}: http://127.0.0.1:{port}/", flush=True)
        server.serve_forever()

#!/usr/bin/env python3
"""
clock_ui development server.

Serves the static site and exposes one extra same-origin endpoint that proxies
Taiwan's national standard time service:

    GET /api/stdtime  ->  {"serverTime": "2026-09-16T22:00:38.99534+08:00", "source": "stdtime.gov.tw"}

Why a proxy is required
-----------------------
stdtime.gov.tw (國家時間與頻率標準實驗室, NML) is an IIS site that does NOT send
an `Access-Control-Allow-Origin` header and does not support JSONP. A browser
page served from any other origin therefore cannot read `GetServerTime`
directly - the fetch fails with a CORS error, and `mode: 'no-cors'` returns an
opaque response whose body is unreadable. Proxying the call server-side
sidesteps CORS completely, so the browser only ever talks to its own origin.

Why the connection is kept alive
--------------------------------
This proxy holds ONE persistent HTTPS connection to stdtime.gov.tw and reuses
it. Opening a fresh TLS connection per request costs 200-400ms of handshake,
which lands inside the round-trip the browser measures - and the client can
only correct for RTT/2, so that handshake would show up as several hundred
milliseconds of clock error on the first calibration after a page load.
Reusing the socket keeps every sample at the bare server cost (~60ms).

Usage
-----
    python3 tools/serve.py [port]        # default 8091, binds 0.0.0.0

On any purely static host (e.g. GitHub Pages) /api/stdtime 404s and the app
falls back to its CORS-enabled public source; the UI reports which one answered.
"""
import http.client
import json
import os
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

STDTIME_HOST = 'www.stdtime.gov.tw'
STDTIME_PATH = '/Home/GetServerTime'
STDTIME_TIMEOUT = 8
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

_conn = None
_conn_lock = threading.Lock()


def fetch_stdtime():
    """Return stdtime's own timestamp string, e.g. '2026-09-16T22:00:38.99534+08:00'."""
    global _conn
    with _conn_lock:
        for attempt in (1, 2):
            try:
                if _conn is None:
                    _conn = http.client.HTTPSConnection(STDTIME_HOST, timeout=STDTIME_TIMEOUT)
                _conn.request('GET', STDTIME_PATH, headers={'User-Agent': 'clock_ui/1.0'})
                resp = _conn.getresponse()
                body = resp.read().decode('utf-8').strip()
                if resp.status != 200:
                    raise OSError(f'HTTP {resp.status}')
                return json.loads(body)
            except Exception:
                # Stale keep-alive socket or a transient failure: drop it and
                # reconnect once before giving up.
                if _conn is not None:
                    try:
                        _conn.close()
                    except Exception:
                        pass
                    _conn = None
                if attempt == 2:
                    raise


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        if self.path.split('?')[0] == '/api/stdtime':
            self._serve_stdtime()
        else:
            super().do_GET()

    def _serve_stdtime(self):
        try:
            server_time = fetch_stdtime()
            self._send(200, json.dumps({'serverTime': server_time,
                                        'source': 'stdtime.gov.tw'}).encode('utf-8'))
        except Exception as err:
            self._send(502, json.dumps({'error': f'stdtime unavailable: {err}'}).encode('utf-8'))

    def _send(self, code, payload):
        try:
            self.send_response(code)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError):
            pass  # the client navigated away mid-request


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8091
    server = ThreadingHTTPServer(('0.0.0.0', port), Handler)
    print(f'clock_ui serving {ROOT}')
    print(f'  site    : http://127.0.0.1:{port}/')
    print(f'  stdtime : http://127.0.0.1:{port}/api/stdtime')
    print('Ctrl+C to stop.')
    try:
        # Warm the upstream connection so the first calibration is not slowed
        # down by a TLS handshake.
        fetch_stdtime()
    except Exception as err:
        print(f'  (warning: stdtime warm-up failed: {err})')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()

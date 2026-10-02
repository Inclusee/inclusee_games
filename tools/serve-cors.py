#!/usr/bin/env python
"""Serve the project folder with CORS allowed, for testing.

    python tools/serve-cors.py 8779

The games can only read puzzle files that live on a different web address if
that server sends "Access-Control-Allow-Origin". SharePoint does not, which is
why this exists: it lets us prove the games work when the header is present, and
see the exact failure when it is not. Never use this on a public server.
"""
import functools
import http.server
import sys


class CorsHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8779
    handler = functools.partial(CorsHandler, directory=".")
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print("serving with CORS on http://127.0.0.1:%d/" % port)
        httpd.serve_forever()

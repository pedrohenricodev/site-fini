from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
import webbrowser

os.chdir(Path(__file__).resolve().parent)
for port in range(4173, 4194):
    try:
        server = ThreadingHTTPServer(('127.0.0.1', port), SimpleHTTPRequestHandler)
        break
    except OSError:
        continue
else:
    raise SystemExit('Não foi possível encontrar uma porta livre.')
url = f'http://localhost:{port}'
print(f'Site Fini: {url}\nMantenha esta janela aberta. Ctrl+C para encerrar.')
webbrowser.open(url)
try:
    server.serve_forever()
except KeyboardInterrupt:
    server.server_close()

# Un puits a captures : le navigateur POSTe ici le PNG du canevas WebGL, on
# l'ecrit sur le disque, rien d'autre. Sert a ranger les preuves par l'image
# dans docs/nuit-recalage/. `python docs/nuit-recalage/collecteur.py`, puis
# depuis la console de la page :
#   fetch('http://127.0.0.1:5506/', {method:'POST', body:'nom|'+canvas.toDataURL()})
import base64, os
from http.server import BaseHTTPRequestHandler, HTTPServer

DOSSIER = os.path.dirname(os.path.abspath(__file__))


class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0))
        corps = self.rfile.read(n).decode("utf-8")
        nom, _, donnee = corps.partition("|")
        nom = "".join(c for c in nom if c.isalnum() or c in "-_.") or "capture"
        if donnee.startswith("data:"):
            donnee = donnee.split(",", 1)[1]
        chemin = os.path.join(DOSSIER, nom + ".png")
        with open(chemin, "wb") as f:
            f.write(base64.b64decode(donnee))
        self.send_response(200); self._cors(); self.end_headers()
        self.wfile.write(chemin.encode())

    def log_message(self, *a):
        pass


HTTPServer(("127.0.0.1", 5506), H).serve_forever()

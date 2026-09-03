# LA COUTURE ENFANT / PARENT, EN NIVEAUX SUR 255 — R37.
#
# Pour chaque capture d'écran d'un relevé de `sonde-r37.mjs` qui contient des
# parents dessinés PARTIELLEMENT, la sonde a projeté les arêtes internes entre
# un quadrant enfant dessiné et un quadrant porté par le parent (8 segments par
# arête, coordonnées écran). Ici, pour chaque segment : la différence de
# luminance entre les deux côtés de l'arête (à ±3 px, perpendiculairement), et
# la même différence 12 px plus loin DANS l'enfant (le « témoin » : la texture
# elle-même varie d'un pixel à l'autre). La couture est ce que l'arête ajoute
# au témoin.
#
#   python scripts/couture-r37.py .banc/R37/complet2.json [autre.json …]

import json, sys, math
from PIL import Image
import numpy as np

def lum(im):
    a = np.asarray(im.convert('RGB')).astype(float)
    L = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    # ⚠️ les barres ORANGE (r − b > 40) sont un artefact du socle en
    # rechargement (« REFINING »), présent AVANT R37 dans les mêmes captures :
    # elles sont écartées de la mesure, sinon elles se lisent comme des coutures
    orange = (a[..., 0] - a[..., 2]) > 40
    L[orange] = np.nan
    return L

def profil(L, pts, decal):
    """différence |L(p + n·decal) − L(p − n·decal)| le long d'une polyligne"""
    h, w = L.shape
    diffs = []
    for i in range(len(pts) - 1):
        (x0, y0, _), (x1, y1, _) = pts[i], pts[i + 1]
        dx, dy = x1 - x0, y1 - y0
        n = math.hypot(dx, dy)
        if n < 1: continue
        nx, ny = -dy / n, dx / n
        steps = max(2, int(n))
        for s in range(steps):
            f = s / steps
            x, y = x0 + dx * f, y0 + dy * f
            xa, ya = x + nx * decal, y + ny * decal
            xb, yb = x - nx * decal, y - ny * decal
            if not (0 <= xa < w and 0 <= xb < w and 0 <= ya < h and 0 <= yb < h): continue
            # on ignore les bandeaux d'interface (haut 90 px, bas 70 px)
            if y < 90 or y > h - 70: continue
            d = abs(L[int(ya), int(xa)] - L[int(yb), int(xb)])
            if not np.isnan(d): diffs.append(d)
    return diffs

def temoin(L, pts, decal, vers):
    """la même mesure, décalée de 12 px vers le côté `vers` (dans l'enfant)"""
    h, w = L.shape
    diffs = []
    for i in range(len(pts) - 1):
        (x0, y0, _), (x1, y1, _) = pts[i], pts[i + 1]
        dx, dy = x1 - x0, y1 - y0
        n = math.hypot(dx, dy)
        if n < 1: continue
        nx, ny = -dy / n, dx / n
        steps = max(2, int(n))
        for s in range(steps):
            f = s / steps
            x, y = x0 + dx * f + nx * 12 * vers, y0 + dy * f + ny * 12 * vers
            xa, ya = x + nx * decal, y + ny * decal
            xb, yb = x - nx * decal, y - ny * decal
            if not (0 <= xa < w and 0 <= xb < w and 0 <= ya < h and 0 <= yb < h): continue
            if y < 90 or y > h - 70: continue
            d = abs(L[int(ya), int(xa)] - L[int(yb), int(xb)])
            if not np.isnan(d): diffs.append(d)
    return diffs

for fichier in sys.argv[1:]:
    J = json.load(open(fichier, encoding='utf-8'))
    tous_arete, tous_temoin, n_captures, n_aretes = [], [], 0, 0
    for c in J['captures']:
        if not c['coutures']: continue
        try:
            L = lum(Image.open(c['f']))
        except Exception as e:
            print('  capture illisible', c['f'], e); continue
        n_captures += 1
        for seg in c['coutures']:
            pts = [p for p in seg['pts'] if p[2] < 1]  # devant la caméra
            if len(pts) < 3: continue
            a = profil(L, pts, 3)
            # l'enfant dessiné est du côté « a » (quadrant a) : sens = +1 pour le côté gauche/haut
            t1 = temoin(L, pts, 3, +1)
            t2 = temoin(L, pts, 3, -1)
            if not a or not (t1 or t2): continue
            n_aretes += 1
            tous_arete.append(np.mean(a))
            tous_temoin.append(np.mean(t1 + t2))
    if not tous_arete:
        print(f'{fichier} : aucune couture mesurable'); continue
    A, T = np.array(tous_arete), np.array(tous_temoin)
    print(f'{fichier} : {n_captures} captures, {n_aretes} arêtes enfant/parent')
    print(f'  |ΔL| sur l’arête   : p50 {np.median(A):.1f} · p90 {np.percentile(A, 90):.1f} · max {A.max():.1f}  (niveaux /255)')
    print(f'  |ΔL| témoin (12 px dans l’enfant) : p50 {np.median(T):.1f} · p90 {np.percentile(T, 90):.1f}')
    print(f'  couture = arête − témoin : p50 {np.median(A - T):+.1f} · p90 {np.percentile(A - T, 90):+.1f} · max {np.max(A - T):+.1f}')

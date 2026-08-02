# Mesure du recalage de la SOURCE (NASA GIBS VIIRS Black Marble).
#
# Protocole : pour une ville isolee dont on connait la position exacte, on
# telecharge la mosaique 3x3 de tuiles GIBS autour d'elle, on cherche le pixel
# le plus lumineux dans une fenetre centree sur sa position THEORIQUE, et on
# rend l'ecart en degres et en kilometres.
#
# Ce script ne teste PAS le code de ShibuMap : il teste si les tuiles servies
# par GIBS sont a l'endroit que la formule slippy standard leur assigne. C'est
# le temoin qui permet de dire "la source est juste, donc le defaut est chez
# nous" (ou l'inverse).

import io, math, sys, urllib.request
from PIL import Image

Z = 8
TILE = 256
COUCHE = "VIIRS_Black_Marble"
GABARIT = ("https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/"
           f"{COUCHE}/default/GoogleMapsCompatible_Level8/{{z}}/{{y}}/{{x}}.png")

VILLES = [
    ("Reykjavik",  64.1466,  -21.9426),
    ("Anchorage",  61.2181, -149.9003),
    ("Las Vegas",  36.1699, -115.1398),
    ("Honolulu",   21.3069, -157.8583),
    ("Dakar",      14.7167,  -17.4677),
    ("Noumea",    -22.2758,  166.4580),
    ("Perth",     -31.9523,  115.8613),
    ("Ushuaia",   -54.8019,  -68.3030),
]

def lonlat_vers_tuile(lon, lat, z):
    n = 2 ** z
    r = math.radians(lat)
    x = (lon + 180.0) / 360.0 * n
    y = (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n
    return x, y

def tuile_vers_lonlat(x, y, z):
    n = 2 ** z
    lon = x / n * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lon, lat

cache = {}
def tuile(z, x, y):
    cle = (z, x, y)
    if cle not in cache:
        url = GABARIT.format(z=z, x=x, y=y)
        with urllib.request.urlopen(url, timeout=60) as r:
            cache[cle] = Image.open(io.BytesIO(r.read())).convert("RGB")
    return cache[cle]

print(f"{'ville':<12} {'d lon':>9} {'d lat':>9} {'est':>8} {'nord':>8}  {'ecart km':>8}")
print("-" * 62)

ecarts = []
for nom, lat, lon in VILLES:
    fx, fy = lonlat_vers_tuile(lon, lat, Z)
    tx, ty = int(fx), int(fy)
    # mosaique 3x3 centree sur la tuile de la ville
    mos = Image.new("RGB", (3 * TILE, 3 * TILE))
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            mos.paste(tuile(Z, tx + dx, ty + dy), ((dx + 1) * TILE, (dy + 1) * TILE))
    px = mos.load()
    # position theorique de la ville DANS la mosaique, en pixels
    cx = (fx - tx + 1) * TILE
    cy = (fy - ty + 1) * TILE
    # on cherche le maximum de lueur dans une fenetre de +/- 24 px, soit
    # environ +/- 0.13 degre de longitude a z8 : assez large pour attraper un
    # decalage reel, assez etroit pour ne pas sauter sur une autre ville.
    R = 24
    best, bx, by = -1, cx, cy
    for yy in range(int(cy) - R, int(cy) + R + 1):
        for xx in range(int(cx) - R, int(cx) + R + 1):
            r, g, b = px[xx, yy]
            v = r + g + b
            if v > best:
                best, bx, by = v, xx, yy
    # centre du pixel trouve, ramene en coordonnees de tuile fractionnaires
    gx = tx - 1 + (bx + 0.5) / TILE
    gy = ty - 1 + (by + 0.5) / TILE
    glon, glat = tuile_vers_lonlat(gx, gy, Z)
    dlon, dlat = glon - lon, glat - lat
    kx = dlon * 111.32 * math.cos(math.radians(lat))
    ky = dlat * 110.57
    ecarts.append((nom, dlon, dlat, kx, ky))
    print(f"{nom:<12} {dlon:>+9.4f} {dlat:>+9.4f} {kx:>+8.2f} {ky:>+8.2f}  {math.hypot(kx,ky):>8.2f}")

print("-" * 62)
mx = sum(e[3] for e in ecarts) / len(ecarts)
my = sum(e[4] for e in ecarts) / len(ecarts)
print(f"moyenne est {mx:+.2f} km, nord {my:+.2f} km")
print(f"(1 pixel de source a z8 vaut environ {40075/(256*2**Z):.2f} km a l'equateur)")

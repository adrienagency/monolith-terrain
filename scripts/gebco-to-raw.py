#!/usr/bin/env python3
"""Pont GeoTIFF -> format pivot brut, pour le tuileur bathymetrique.

POURQUOI CE SCRIPT EXISTE
Ni GDAL ni rasterio ne sont installes sur la machine de developpement, et les
installer pour lire UN raster une seule fois est disproportionne. PIL sait lire
un TIFF non compresse ou en Deflate, et numpy sait le ramener a un tableau.
On sort donc un format pivot trivial (un .bin brut + un .json), que
scripts/build-bathy-tiles.mjs sait lire par lignes sans jamais tout charger.

L'autre avantage : N'IMPORTE QUELLE source (GEBCO, EMODnet, BlueTopo) se ramene
au meme pivot. Le tuileur n'a donc qu'un seul format d'entree a connaitre.

USAGE
    python scripts/gebco-to-raw.py <entree.tif> <dossier-sortie> [--west W --east E --south S --north N]

Le georeferencement est lu dans les tags GeoTIFF quand ils existent ; sinon il
faut le passer a la main (les grilles GEBCO couvrent le monde entier, donc
-180/180/-90/90 est le defaut raisonnable).
"""
import json
import os
import sys

try:
    import numpy as np
    from PIL import Image
except ImportError as e:
    sys.exit(f"Il manque numpy ou Pillow : {e}\n  pip install numpy pillow")

# une grille GEBCO fait 43200 x 21600 : bien au-dela du garde-fou par defaut de
# Pillow contre les images-bombes. On le desarme en connaissance de cause.
Image.MAX_IMAGE_PIXELS = None

# tags GeoTIFF : 33922 = ModelTiepoint, 33550 = ModelPixelScale
TAG_TIEPOINT = 33922
TAG_PIXELSCALE = 33550


def georef(img, argv):
    """Georeferencement : d'abord les tags, sinon les arguments, sinon le monde."""
    def opt(name, dflt):
        return float(argv[argv.index(f"--{name}") + 1]) if f"--{name}" in argv else dflt

    tags = getattr(img, "tag_v2", {}) or {}
    if TAG_TIEPOINT in tags and TAG_PIXELSCALE in tags:
        tie = list(tags[TAG_TIEPOINT])
        scale = list(tags[TAG_PIXELSCALE])
        west, north = tie[3], tie[4]
        sx, sy = scale[0], scale[1]
        east = west + sx * img.width
        south = north - sy * img.height
        print(f"  georeferencement lu dans les tags GeoTIFF")
        return west, east, south, north
    print("  pas de tags GeoTIFF exploitables -> arguments / defaut mondial")
    return opt("west", -180.0), opt("east", 180.0), opt("south", -90.0), opt("north", 90.0)


def main():
    argv = sys.argv[1:]
    pos = [a for a in argv if not a.startswith("--") and not _is_value(argv, a)]
    if len(pos) < 2:
        sys.exit(__doc__)
    src, out_dir = pos[0], pos[1]
    if not os.path.exists(src):
        sys.exit(f"Introuvable : {src}")
    os.makedirs(out_dir, exist_ok=True)

    print(f"\nLecture de {src} …")
    img = Image.open(src)
    print(f"  {img.width} x {img.height}, mode {img.mode}")
    west, east, south, north = georef(img, argv)
    print(f"  emprise  W {west}  E {east}  S {south}  N {north}")

    bin_path = os.path.join(out_dir, "grid.bin")
    # ecriture PAR BANDES : une grille GEBCO pese 7 Go decompressee, la charger
    # d'un bloc n'est pas envisageable sur une machine de bureau.
    band = 512
    written = 0
    with open(bin_path, "wb") as f:
        for y0 in range(0, img.height, band):
            y1 = min(img.height, y0 + band)
            arr = np.asarray(img.crop((0, y0, img.width, y1)))
            if arr.ndim == 3:  # au cas ou le TIFF serait multi-bandes
                arr = arr[:, :, 0]
            np.asarray(arr, dtype=np.int16).tofile(f)
            written += y1 - y0
            if (y0 // band) % 8 == 0:
                pct = 100.0 * written / img.height
                print(f"  {written:>6}/{img.height} lignes ({pct:5.1f} %)")

    meta = {
        "width": img.width,
        "height": img.height,
        "west": west,
        "east": east,
        "south": south,
        "north": north,
        "dtype": "int16",
        # GEBCO n'a pas de nodata sur la grille mondiale : elle est pleine.
        # -32768 reste la sentinelle conventionnelle pour les sources qui en ont.
        "noData": -32768,
        "source": os.path.basename(src),
    }
    with open(os.path.join(out_dir, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    mo = os.path.getsize(bin_path) / 1024 / 1024
    print(f"\n  -> {bin_path}  ({mo:,.0f} Mo)")
    print(f"  -> {os.path.join(out_dir, 'meta.json')}")
    print("\nEnsuite :  node scripts/build-bathy-tiles.mjs --src " + out_dir + " --dry\n")


def _is_value(argv, a):
    """Vrai si `a` est la valeur d'une option --xxx qui la precede."""
    i = argv.index(a)
    return i > 0 and argv[i - 1].startswith("--")


if __name__ == "__main__":
    main()

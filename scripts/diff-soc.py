# DIFF SOC — compte les pixels qui changent entre deux captures, par différence
# avec un témoin (piège commun : « compte par DIFFÉRENCE avec un témoin à 0 »).
#
#   python scripts/diff-soc.py A.png B.png [--seuil 24] [--sortie masque.png]
#
# Rend : pixels différents (|ΔRGB| max > seuil), boîte englobante, et, si
# demandé, une image du masque (les pixels différents en vert sur A grisée).
import sys
from PIL import Image
import numpy as np

def lire(p):
    return np.asarray(Image.open(p).convert('RGB')).astype(np.int16)

def main():
    a = sys.argv[1]
    b = sys.argv[2]
    seuil = 24
    sortie = None
    if '--seuil' in sys.argv:
        seuil = int(sys.argv[sys.argv.index('--seuil') + 1])
    if '--sortie' in sys.argv:
        sortie = sys.argv[sys.argv.index('--sortie') + 1]
    A = lire(a)
    B = lire(b)
    d = np.abs(A - B).max(axis=2)
    m = d > seuil
    n = int(m.sum())
    ys, xs = np.nonzero(m)
    boite = None if n == 0 else [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
    # colonnes marquées : combien de colonnes d'écran portent plus de 8 px différents
    cols = int(((m.sum(axis=0)) > 8).sum())
    print(f'{n} px différents (seuil {seuil}) · boîte {boite} · colonnes marquées {cols}')
    if sortie:
        g = (A.mean(axis=2) * 0.5 + 64).astype(np.uint8)
        out = np.stack([g, g, g], axis=2)
        out[m] = [0, 255, 0]
        Image.fromarray(out).save(sortie)

main()

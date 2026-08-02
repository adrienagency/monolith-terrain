// Worker du volume de nuages — une boîte aux lettres, comme terrain-worker.js.
//
// Il n'a AUCUN calcul propre : tout vit dans cloud-volume-noyau.js, que le fil
// principal appelle aussi en repli. C'est ce qui rend l'identité au bit près
// structurelle plutôt que surveillée — il n'y a qu'une implémentation.
//
// Il n'importe pas three : `ImprovedNoise` est un fichier autonome des exemples
// (zéro `import`), donc ce Worker pèse quelques kilo-octets.
import { cuireDonneesVolume } from './cloud-volume-noyau.js'

// Un seul message, sans requête : on cuit dès le démarrage du Worker. Le tampon
// est TRANSFÉRÉ (524 288 octets) — le Worker n'en a plus l'usage, et le retour
// devient gratuit au lieu d'être une copie.
const data = cuireDonneesVolume()
self.postMessage({ data }, [data.buffer])

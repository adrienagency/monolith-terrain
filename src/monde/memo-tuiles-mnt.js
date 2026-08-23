// LA MÉMOIRE DES TUILES DE MNT — UNE SEULE, POUR LES DEUX CHEMINS.
// Tâche R3, correction I3.
//
// ---------------------------------------------------------------------------
// POURQUOI CE MODULE EXISTE
// ---------------------------------------------------------------------------
// ⛔ **LES MÊMES NEUF TUILES ÉTAIENT TÉLÉCHARGÉES DEUX FOIS, À CHAQUE
// CHARGEMENT.** Sous `?terre=unique`, le bloc du socle est chargé par
// `dem.js` (`loadDem` → `fetchTerrainTile`) **et** par la file du globe
// (`globe.js` → `tileBitmap`), sur la **même URL**, à environ 1,7 s d'écart :
//
//     mapterhorn 12/2681/2294  376 179 o  t = 2,02 s  loadDem@dem.js
//     mapterhorn 12/2681/2294  376 174 o  t = 3,68 s  _pump@globe.js
//
// **2,705 Mo par chargement** — 14,5 % des 18,712 Mo que la tâche laisse, et
// plus de la moitié de ce qu'elle venait d'économiser. Relevé sur 9 tirages,
// identique avant et après le correctif de la tâche.
//
// La cause était structurelle, pas un oubli : **deux mémoires indépendantes**.
// Celle de `dem.js` (`tilesEnVol`) ne dédoublonnait que le VOL — elle se purgeait
// à l'atterrissage, donc une demande arrivée 1,7 s plus tard n'y trouvait rien.
// Celle de `globe.js` (`_tileMemo`) survivait, elle, mais l'autre chemin ne la
// voyait pas.
//
// ⚠️ **ON N'AJOUTE DONC PAS UN TROISIÈME CACHE : ON DÉMÉNAGE CELUI DU GLOBE
// ICI, AU BIT PRÈS.** Même borne (32 Mo, `MEMO_OCTETS_MAX`), même LRU, même
// règle « un échec ne se mémorise pas ». `globe.js` continue d'exporter
// `_tileMemo` — c'est cette Map-ci — et `test/globe-reseau.test.js` la lit sans
// rien savoir du déménagement.
//
// ⚠️ **ET IL RESTE PUR.** Ni `three`, ni DOM, ni `fetch` : le chargement est
// passé en paramètre. C'est ce qui permet à `dem.js` — chargé sous node par une
// dizaine de tests — de l'importer sans tirer le globe derrière lui.
//
// ---------------------------------------------------------------------------
// CE QUI N'EST PAS MÉMORISÉ, ET POURQUOI C'EST LA CONDITION DU PARTAGE
// ---------------------------------------------------------------------------
// ⛔ **UN RÉSULTAT VIDE (`null`) EST RETIRÉ DE LA MÉMOIRE, COMME UN REJET.**
// Les deux appelants ne traduisent PAS un 404 de la même façon : `dem.js` rend
// `null` (« cette source ne couvre pas ici »), `globe.js` LÈVE une erreur portant
// `status = 404`, que `fetchTile` rattrape pour se replier sur AWS. Mémoriser le
// `null` de l'un servirait un `null` à l'autre, qui n'attend pas ça et ne se
// replierait plus. Un 404 ne coûte que ses en-têtes : le repayer est sans
// conséquence, se tromper de repli en aurait une.
//
// ⚠️ **CE QUI EST PARTAGÉ EST L'`ImageBitmap`, PAS SEULEMENT LA REQUÊTE.** Aucun
// des deux chemins n'appelle `.close()` (vérifié sur les deux fichiers), et
// `globe.js` partageait déjà ses bitmaps entre tuiles et entre globes : le
// contrat ne change pas, il s'étend d'un appelant.
//
// ⚠️ **CE QUE ÇA COÛTE, DIT FRANCHEMENT** : les tuiles de `dem.js` occupent
// désormais le budget du globe, alors qu'elles étaient relâchées aussitôt. Sur
// les deux scènes mesurées, la concurrence n'existe pas — **118 URL distinctes
// sous `?terre=unique`, 31 en production**, pour une borne de 128 entrées AWS.
// Sur une session qui balaierait beaucoup plus de MNT, elles se disputeraient la
// place ; le budget, lui, ne bouge pas d'un octet.
//
// ⚠️ **ET LE JOURNAL RÉSEAU PERD NEUF ÉCHANTILLONS PAR CHARGEMENT.**
// `noterReponse` (le débit observé, `globe.js`) n'est appelé que par le chargeur
// du globe ; quand la tuile vient de `dem.js`, il ne l'est pas. C'est neuf
// mesures sur ~118 — et c'étaient jusqu'ici neuf mesures d'un **doublon**. Le
// dire vaut mieux que le corriger en faisant importer `globe.js` à `dem.js`.

/**
 * 32 Mo d'`ImageBitmap` décodé — **la borne du globe, déplacée sans être
 * touchée**. Sur un globe entièrement AWS (256 px) cela fait exactement 128
 * entrées ; en zone Mapterhorn (512 px) une entrée pèse quatre fois plus, et
 * c'est pour ça que la borne est en OCTETS et non en entrées.
 */
export const MEMO_OCTETS_MAX = 128 * 256 * 256 * 4

/** url → `Promise<ImageBitmap|null>`, LRU bornée. Exportée pour les tests. */
export const memoTuiles = new Map()

// coût de chaque entrée, en octets — même clé, même ordre que `memoTuiles`
const cout = new Map()
let octetsRetenus = 0

/** Retire une entrée et rend son budget. Sans effet si la clé est absente. */
export function oublierTuile(url) {
  if (!memoTuiles.has(url)) return
  octetsRetenus -= cout.get(url) ?? 0
  cout.delete(url)
  memoTuiles.delete(url)
}

/**
 * Une SEULE entrée par URL, promesse comprise : deux demandes qui se chevauchent
 * partagent la requête au lieu d'en lancer deux — **quel que soit le chemin qui
 * la demande**.
 *
 * @param {string} url
 * @param {() => Promise<any>} charger appelé UNIQUEMENT en cas de manque
 * @param {number} octets ce que l'entrée pèsera, pour le budget
 */
export function tuileMemorisee(url, charger, octets = 256 * 256 * 4) {
  const memo = memoTuiles.get(url)
  if (memo) {
    memoTuiles.delete(url)
    memoTuiles.set(url, memo) // ré-insertion = most-recently-used
    return memo
  }
  const p = charger()
  memoTuiles.set(url, p)
  cout.set(url, octets)
  octetsRetenus += octets
  // ⚠️ `p.then(ok, ko)` et pas `p.catch(…)` en tête de chaîne : cette branche de
  // surveillance ABSORBE le rejet, sinon chaque tuile en panne lèverait un
  // `unhandledrejection` à côté de l'appelant qui, lui, l'a bien traité.
  const rendre = () => { if (memoTuiles.get(url) === p) oublierTuile(url) }
  p.then((v) => { if (!v) rendre() }, rendre)
  // les entrées EN VOL viennent d'être insérées, elles sont donc en tête de
  // fraîcheur : la purge par la queue ne peut pas casser la déduplication
  while (octetsRetenus > MEMO_OCTETS_MAX && memoTuiles.size > 1) {
    oublierTuile(memoTuiles.keys().next().value)
  }
  return p
}

/** Remise à zéro — tests uniquement. */
export function viderMemoTuiles() {
  memoTuiles.clear()
  cout.clear()
  octetsRetenus = 0
}

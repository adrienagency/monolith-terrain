// ═══════════════════ L'IMAGERIE SUR LA SURFACE DU GLOBE — Tâche R16 ═════════
//
// LE CONSTAT QUI FONDE CE FICHIER (rapport R12, §2, mesuré) : sur le globe la
// photo n'existait QUE dans le crop (`dedansCrop > 0.0` dans le fragment), or le
// crop naît sous 32,3 km et meurt au-dessus de 40,3 km. À 40,3 km son emprise
// occupe déjà 1,4 × la hauteur de l'écran à z13 et 1 475 × à z3. **Le crop ne
// peut JAMAIS montrer un continent — c'est de l'arithmétique.** L'imagerie doit
// donc aller sur la SURFACE, tuile de quadtree par tuile de quadtree.
//
// ⛔ ET ON N'ÉCRIT PAS UN SECOND SYSTÈME DE TUILES. `_traverse` (globe.js) fait
// déjà le tri par tronc de vue, le raffinement par distance, la règle sans-trou,
// la purge de file et le plafond. Ce module ne décide RIEN de spatial : il reçoit
// les tuiles que `_traverse` a retenues **et dessinées**, et leur trouve une
// photo. Le tri spatial est celui du quadtree, au sens strict.
//
// ══════ CE QUE FONT LES GRANDS, ET CE QU'ON REPREND ═════════════════════════
//
//  1. Le tronc de vue commande      → `_traverse`, déjà là (horizon + frustum)
//  2. Le détail vient de la distance→ `_traverse`, déjà là (chord / dist)
//  3. Le grossier d'abord           → `pourTuile` remonte aux ANCÊTRES : dès
//     qu'un aïeul est prêt, la tuile est couverte, en basse résolution, sans
//     attendre son propre niveau. C'est le « imagery LOD lags terrain LOD » de
//     Cesium / Google Earth, et c'est GRATUIT parce que le quadtree est un arbre.
//  4. Rien n'est jeté brutalement   → LRU différée, plafond en ENTRÉES.
//
// ══════ POURQUOI UNE SEULE SOURCE MONDIALE À CE JALON ════════════════════════
//
// NASA GIBS Blue Marble (CC0, terre + OCÉAN, sans nuages) couvre **tout le
// globe** jusqu'à z8. C'est ce qui referme, sur la surface, le troisième refus
// du rapport R12 : hors des 16 pays à fournisseur national — Afrique entière,
// Amérique du Sud, majeure partie de l'Asie — il n'y avait AUCUNE photo à aucune
// échelle. Ici il y en a une partout.
//
// ⚠️ ET C'EST AUSSI CE QUI ÉVITE LE PIÈGE MESURÉ PAR R12 : « aucun fournisseur
// national ne renvoie 404 aux zooms bas — swisstopo à z3 rend une TUILE BLANCHE
// de 1 632 octets ». Interroger un service national à l'échelle d'un continent
// ne rend pas une erreur, ça rend un continent blanc. Une seule source mondiale
// sur toute la plage des zooms du globe ne peut pas tomber dedans.
//
// ⚠️ **AU-DESSUS DE `Z_MAX_MONDE`, ON NE DEMANDE RIEN DE PLUS.** Une tuile de
// quadtree à z12 lit la photo de son aïeul z8 par une sous-fenêtre d'UV. Le
// texel y vaut ~600 m — c'est flou, c'est assumé, et c'est exactement ce que
// fait Google Earth avec son fond Landsat tant que l'imagerie fine n'est pas
// arrivée. Le crop, lui, garde son orthophoto nationale en gros plan : il est
// inchangé par ce fichier.

// ⚠️ CETTE ENTRÉE EST CELLE DU REGISTRE VÉRIFIÉ de `map/aerial-layer.js` — même
// URL, même plafond, même attribution. Elle est DUPLIQUÉE ICI EXPRÈS : `globe.js`
// n'importe pas `map/aerial-layer.js` (qui tire `geo.js` + `tile-index.js` pour
// des mosaïques dont le globe n'a que faire), et une constante dupliquée diverge
// en silence.
//
// ⚠️ 2026-09-04 — `ATTRIBUTION_MONDE` a été retirée : elle recopiait le libellé
// 'NASA GIBS Blue Marble' de l'entrée `nasa` de PROVIDERS (aerial-layer.js:375)
// et PERSONNE ne la lisait — pas même le « test qui compare les deux chaînes »
// que cette ligne annonçait, et qui n'existe pas. Le crédit affiché passe par
// PROVIDERS. Ce qui reste dupliqué ici (l'URL et `Z_MAX_MONDE`), lui, est lu.
export const Z_MAX_MONDE = 8
export function urlPhotoMonde(z, x, y) {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/${z}/${y}/${x}.jpeg`
}

// ⚠️ **LE PLAFOND EST EN ENTRÉES, ET IL SE DÉRIVE DE LA MÉMOIRE, PAS D'UN
// CHIFFRE ROND.** Une tuile 256² en RGBA sans mipmaps pèse 256 × 256 × 4 =
// 262 144 octets = 256 Kio pile. 192 entrées = **48,0 Mo de mémoire vidéo**,
// borne DURE : le cache ne peut pas la dépasser, quelle que soit la caméra.
// Le pire cas mesuré par la sonde R16 est publié au rapport.
export const OCTETS_PAR_PHOTO = 256 * 256 * 4
export const PLAFOND_PHOTOS = 192

// combien de requêtes d'imagerie en vol — le globe en tient 6 pour son MNT, et
// les deux flux partagent la même connexion.
export const VOL_MAX = 4

// ═══════════ LE FONDU CÔTIER DU MONDE ══════════════════════════════════════
//
// ⛔ **MESURÉ LE 2026-09-01, ET C'EST UN DÉFAUT QUI SE VOIT DE L'ESPACE.** Sans
// fondu, La Réunion à 600 km rend un écran ENTIÈREMENT NOIR : Blue Marble peint
// l'océan quasi noir, et la rampe nautique — turquoise, avec ses isobathes —
// disparaît sur les deux tiers de la planète. Les deux captures sont dans
// `.banc/R16/` (`regional-avant.png` contre `regional-apres.png`).
//
// ⚠️ **ET IL LUI FAUT SA PROPRE VALEUR, PAS CELLE DU CROP.** `uAerialCoastFade`
// (le fondu de R9) vaut **0 au repos** — `HABILLAGE_MONDE` le dit en toutes
// lettres : « ZÉRO, ET C'EST LE "éteint" DU SOCLE » ; il ne prend 0,1 que
// lorsque `poserHabillage` transmet la valeur VIVANTE du bloc. En orbite il n'y
// a pas de bloc, donc pas de valeur, donc pas de fondu : la première version de
// ce correctif s'y est laissé prendre, et l'écran est resté noir.
//
// La fraction, elle, est la même que celle du socle (`params.aerialCoastFade`
// vaut 0,1) : la bande vaut `profondeur de la rampe × cette fraction`, soit
// **600 m** avec `RAMPE_MONDE.profondeur = 6 000`. Un plateau continental fait
// 200 m : la photo tient jusqu'au bord du plateau, puis la rampe reprend.
export const FONDU_MER_MONDE = 0.1

// ⚠️ **LE FANTÔME EST LE PIÈGE ② DU BRIEF, ET IL EST TRAITÉ ICI.** « Une entrée
// EN COURS DE CHARGEMENT dont la requête ne revient jamais occupe une place POUR
// TOUJOURS. » Une image dont ni `onload` ni `onerror` ne se déclenche (DNS mort,
// proxy qui avale) resterait `charge` indéfiniment et mangerait sa place. Passé
// ce délai, l'entrée est déclarée perdue et redevient évinçable.
export const MS_ABANDON = 20000

// ═══════════ LA SOUS-FENÊTRE D'UV D'UN AÏEUL ════════════════════════════════
//
// La tuile (z, x, y) veut lire la photo de l'aïeul (zi, x >> k, y >> k).
// Rend { ox, oy, sx, sy } tel que `uvPhoto = uvTuile * (sx, sy) + (ox, oy)`.
//
// ⚠️⚠️ **LE RETOURNEMENT EN Y N'EST PAS UN DÉTAIL, C'EST LA MOITIÉ DE LA
// FONCTION.** `_buildMesh` pose `uv.y = 1 - v` (« canvas row 0 = north = uv v 1,
// flipY texture ») : l'UV monte vers le NORD, tandis que l'indice `y` de tuile
// monte vers le SUD. Un offset calculé comme celui de x poserait l'image à
// l'envers nord-sud sur toute la moitié des tuiles — et AUCUN test de câblage ne
// le verrait, parce que la texture serait bien liée et bien lue.
//
// Dérivation : la fraction de l'aïeul occupée par la tuile, comptée depuis le
// NORD, vaut (dy + (1 - uv.y)) / n. L'UV de l'aïeul étant lui aussi compté
// depuis le sud, uvY_aieul = 1 - (dy + 1 - uv.y) / n = uv.y/n + (1 - (dy+1)/n).
export function sousFenetre(z, x, y, zi) {
  const k = z - zi
  if (k < 0) throw new Error(`sousFenetre : l'aïeul z${zi} est plus fin que la tuile z${z}`)
  if (k === 0) return { ox: 0, oy: 0, sx: 1, sy: 1 }
  const n = 2 ** k
  const dx = x - Math.floor(x / n) * n
  const dy = y - Math.floor(y / n) * n
  return { ox: dx / n, oy: 1 - (dy + 1) / n, sx: 1 / n, sy: 1 / n }
}

// À quel niveau d'imagerie une tuile de quadtree z est-elle servie ?
export function zoomPhoto(z) {
  return Math.min(z, Z_MAX_MONDE)
}

export function clePhoto(z, x, y) {
  return `${z}/${x}/${y}`
}

// ═══════════════════════════════════════════════════════════════════════════
// LE CACHE
// ═══════════════════════════════════════════════════════════════════════════
//
// Injectable de bout en bout : `charger` rend une promesse de texture, `horloge`
// rend des millisecondes. Les tests n'ont donc besoin ni de réseau, ni de DOM,
// ni de WebGL — et ils peuvent fabriquer le fantôme du piège ② à volonté.
export class PhotoMonde {
  constructor({
    charger,
    horloge = () => Date.now(),
    plafond = PLAFOND_PHOTOS,
    volMax = VOL_MAX,
    msAbandon = MS_ABANDON,
    zMax = Z_MAX_MONDE,
  } = {}) {
    if (typeof charger !== 'function') throw new Error('PhotoMonde : `charger` est obligatoire')
    this.charger = charger
    this.horloge = horloge
    this.plafond = plafond
    this.volMax = volMax
    this.msAbandon = msAbandon
    this.zMax = zMax
    this.actif = false
    /** clé → { z, x, y, etat, tex, vue, depart, echecs } */
    this.entrees = new Map()
    this.file = []
    this.enVol = 0
    // compteurs de session, publiés par `stats()` — c'est l'instrument, pas la
    // décoration : le rapport R16 en tire ses chiffres.
    this.demandes = 0
    this.reussites = 0
    this.echecs = 0
    this.evictions = 0
    this.abandons = 0
    this.refusFile = 0
  }

  setActif(v) {
    const av = this.actif
    this.actif = !!v
    // ⚠️ ON NE VIDE PAS EN S'ÉTEIGNANT, et c'est la règle 4 du brief (« rien
    // n'est jeté brutalement ») : rallumer le bouton doit être instantané. La
    // borne mémoire est portée par le plafond, pas par l'extinction.
    if (av !== this.actif) this.file.length = 0
    return this.actif
  }

  taille() { return this.entrees.size }

  octetsVideo() {
    return this.pretes() * OCTETS_PAR_PHOTO
  }

  // ⚠️ **C'EST CE COMPTE-LÀ QUE LE PLAFOND BORNE, PAS `entrees.size`** — voir
  // `evincer`. Une entrée en attente ne pèse pas un octet de mémoire vidéo.
  pretes() {
    let n = 0
    for (const e of this.entrees.values()) if (e.etat === 'prete') n++
    return n
  }

  stats() {
    let pretes = 0, enCharge = 0, erreurs = 0
    for (const e of this.entrees.values()) {
      if (e.etat === 'prete') pretes++
      else if (e.etat === 'charge') enCharge++
      else if (e.etat === 'erreur') erreurs++
    }
    return {
      actif: this.actif, entrees: this.entrees.size, plafond: this.plafond,
      pretes, enCharge, erreurs, file: this.file.length, enVol: this.enVol,
      demandes: this.demandes, reussites: this.reussites, echecs: this.echecs,
      evictions: this.evictions, abandons: this.abandons, refusFile: this.refusFile,
      octetsVideo: this.octetsVideo(),
    }
  }

  // ═══════════ CE QUE `_traverse` APPELLE, ET LUI SEUL ═══════════════════════
  //
  // Rend la photo à peindre sur cette tuile MAINTENANT — la meilleure prête, du
  // niveau visé jusqu'aux racines — et demande au passage celle du niveau visé.
  // Rend `null` tant que rien n'est prêt : la tuile reste hypsométrique, sans
  // trou et sans clignotement.
  //
  // ⚠️ **APPELÉE POUR LES TUILES DESSINÉES, PAS POUR LES TUILES PARCOURUES**, et
  // c'est le piège ① du brief pris par le bon bout : « réduis d'abord ce qui
  // entre » dans le cache. L'ensemble dessiné EST la couverture de l'écran ; tout
  // ce qui est plus large est du gaspillage qui affamerait le budget.
  pourTuile(t, image) {
    if (!this.actif) return null
    const zi = Math.min(t.z, this.zMax)
    // le niveau VISÉ part sur le réseau…
    this.demander(zi, t.x >> (t.z - zi), t.y >> (t.z - zi), image)
    // …et en attendant, le meilleur aïeul PRÊT peint déjà.
    for (let z = zi; z >= 0; z--) {
      const k = t.z - z
      const x = t.x >> k
      const y = t.y >> k
      const e = this.entrees.get(clePhoto(z, x, y))
      if (e && e.etat === 'prete') {
        e.vue = image
        return { tex: e.tex, ...sousFenetre(t.z, t.x, t.y, z) }
      }
    }
    return null
  }

  demander(z, x, y, image) {
    const cle = clePhoto(z, x, y)
    let e = this.entrees.get(cle)
    if (!e) {
      // ⚠️ **LE CRÉDIT N'EST PAS `plafond − occupé`** — c'est le piège ② du
      // brief, « tout budget de la forme capacité − occupé se gèle à saturation ».
      // On n'interdit pas la naissance : on laisse entrer et on ÉVINCE ensuite,
      // ce que fait `finImage`. Une entrée récupérable existe toujours (la plus
      // ancienne non vue à l'image courante), donc le cache ne peut pas geler.
      e = { z, x, y, etat: 'vide', tex: null, vue: image, depart: 0, echecs: 0, enFile: false }
      this.entrees.set(cle, e)
    }
    e.vue = image
    // ⚠️ **UNE ENTRÉE `vide` QUI N'EST PAS DANS LA FILE NE PARTIRA JAMAIS.** Le
    // refus de file (contre-pression) laisse exactement cet état : sans cette
    // relance, la tuile resterait blanche pour toujours et RIEN ne le signalerait
    // — même classe de défaut que le `loading` fantôme de `globe._request`, qui a
    // coûté une tâche entière à ce dépôt.
    if (e.etat === 'erreur' && e.echecs < 2 && this.horloge() - e.depart > 5000) {
      e.etat = 'vide'
      e.echecs++
    }
    if (e.etat === 'vide' && !e.enFile) {
      if (this.file.length >= this.plafond) { this.refusFile++; return e }
      e.enFile = true
      this.file.push(e)
      this.pomper()
    }
    return e
  }

  pomper() {
    while (this.enVol < this.volMax && this.file.length) {
      const e = this.file.shift()
      e.enFile = false
      if (e.etat !== 'vide' || this.entrees.get(clePhoto(e.z, e.x, e.y)) !== e) continue
      e.etat = 'charge'
      e.depart = this.horloge()
      this.enVol++
      this.demandes++
      this.charger(e.z, e.x, e.y)
        .then((tex) => {
          // la garde de l'orphelin : l'entrée a pu être évincée en vol.
          if (this.entrees.get(clePhoto(e.z, e.x, e.y)) !== e) { tex?.dispose?.(); return }
          e.tex = tex
          e.etat = 'prete'
          this.reussites++
        })
        .catch(() => {
          this.echecs++
          if (this.entrees.get(clePhoto(e.z, e.x, e.y)) === e) e.etat = 'erreur'
        })
        .finally(() => { this.enVol--; this.pomper() })
    }
  }

  // ═══════════ UNE FOIS PAR IMAGE, APRÈS LE PARCOURS ═════════════════════════
  //
  // Deux gestes, dans cet ordre — et l'ordre porte du sens, exactement comme
  // dans `globe.update` : l'abandon rend des places que l'éviction sait
  // reprendre, alors qu'un fantôme `charge` lui échapperait.
  finImage(image) {
    this.abandonnerFantomes()
    this.purgerFile(image)
    this.evincer(image)
  }

  // ═══════════ LA PURGE DE FILE — ET ELLE N'EST PAS FACULTATIVE ══════════════
  //
  // ⛔ **MESURÉ LE 2026-09-01, ALPES À 600 km, APRÈS 14 s DE REPOS** : 45 tuiles
  // dessinées, mais **141 entrées en file, 48 prêtes seulement**, et les tuiles
  // z8 peignaient avec la photo de leur aïeul **z4** (600 m/px devenus 9,6 km/px,
  // un vert quasi noir sur les Alpes — c'est le « pourquoi c'est noir » de
  // `.banc/R16/diag-noir.png`). Le plafond était mangé par des entrées EN
  // ATTENTE, qui évinçaient les textures PRÊTES sans en apporter aucune.
  //
  // Deux causes, une seule parade chacune :
  //   ① une entrée évincée restait DANS LA FILE, et `demander` en recréait une
  //      neuve à l'image suivante — la file gonflait d'objets morts ;
  //   ② ce que l'image courante n'a pas demandé ne sera jamais utile : la caméra
  //      a bougé. C'est mot pour mot `globe._purgerFile`, dont le commentaire
  //      porte déjà la mesure (« 546 tuiles encore `loading` cinq secondes après
  //      l'arrêt du panoramique, zoom effectif retombé de z15 à z3 »).
  //
  // ⚠️ ET RIEN N'EST PERDU : l'entrée reste `vide` et `enFile` retombe à faux,
  // donc `demander` la remettra en file dès que la tuile sera redessinée. C'est
  // de la contre-pression, pas un abandon — même contrat que `globe._request`.
  purgerFile(image) {
    if (!this.file.length) return 0
    const garde = []
    let n = 0
    for (const e of this.file) {
      // orpheline : évincée pendant que son entrée attendait. On ne touche pas
      // à son état — l'objet n'est plus l'entrée de cette clé.
      if (this.entrees.get(clePhoto(e.z, e.x, e.y)) !== e) { n++; continue }
      if (e.vue !== image) { e.enFile = false; n++; continue }
      garde.push(e)
    }
    this.file = garde
    return n
  }

  // Le piège ② en acte : une requête qui ne revient jamais.
  abandonnerFantomes() {
    const t = this.horloge()
    for (const e of this.entrees.values()) {
      if (e.etat === 'charge' && t - e.depart > this.msAbandon) {
        e.etat = 'erreur' // évinçable ; `enVol` se corrigera si la promesse revient
        this.abandons++
      }
    }
  }

  // LRU DIFFÉRÉE : ce qui sort du cadre reste, un panoramique le ramène. On ne
  // touche qu'au-delà du plafond, et jamais à ce que l'image courante a vu.
  //
  // ⚠️⚠️ **LE PLAFOND COMPTE LES TEXTURES, PAS LES ENTRÉES — ET LA DIFFÉRENCE
  // ÉTAIT VISIBLE À L'ÉCRAN.** Compté sur `entrees.size`, il se laissait remplir
  // par des entrées EN ATTENTE (140 sur 192, mesuré) et évinçait alors les
  // textures prêtes pour loger des requêtes qui n'étaient pas encore parties.
  // Résultat : les tuiles peignaient avec un aïeul quatre niveaux trop grossier.
  // Une entrée en attente ne pèse pas un octet de mémoire vidéo ; elle n'a donc
  // rien à faire dans un budget de mémoire vidéo. Ce qui borne les entrées en
  // attente, c'est la purge de file et le plafond de file, pas celui-ci.
  evincer(image) {
    // ① CE QUI NE PORTE NI TEXTURE NI REQUÊTE NE GARDE PAS SA PLACE. Une entrée
    // `vide` hors file ne partira jamais d'elle-même ; une `erreur` a déjà
    // répondu. Les supprimer les rend simplement redemandables.
    for (const [cle, e] of this.entrees) {
      if (e.vue === image) continue
      if (e.etat === 'prete' || e.etat === 'charge') continue
      if (e.etat === 'vide' && e.enFile) continue
      this.entrees.delete(cle)
    }
    // ② puis le budget de mémoire vidéo, sur les seules textures.
    let pretes = this.pretes()
    if (pretes <= this.plafond) return 0
    const cand = []
    for (const [cle, e] of this.entrees) {
      if (e.vue === image) continue // porteuse de la couverture courante
      if (e.etat !== 'prete') continue
      cand.push([cle, e])
    }
    cand.sort((a, b) => a[1].vue - b[1].vue)
    let n = 0
    for (const [cle, e] of cand) {
      if (pretes <= this.plafond) break
      e.tex?.dispose?.()
      this.entrees.delete(cle)
      pretes--
      this.evictions++
      n++
    }
    return n
  }

  vider() {
    for (const e of this.entrees.values()) e.tex?.dispose?.()
    this.entrees.clear()
    this.file.length = 0
  }
}

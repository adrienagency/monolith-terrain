import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PALIERS,
  TABLEAU,
  CLASSES_CARTE,
  PLANCHER_DENSITE,
  classerCarte,
  classerCharge,
  classerReseau,
  estimerPalier,
  reglagesServis,
  palierDeDepart,
  plafondDeRemontee,
  lireSignaux,
  sonderMachine,
} from '../src/palier-machine.js'
import { PLAFOND_MPX } from '../src/viewport.js'

// ---------------------------------------------------------------------------
// LES MACHINES RÉELLES — celles qui ont souffert, nommées, avec leurs chiffres
// ---------------------------------------------------------------------------
// Ce ne sont pas des cas de figure : chacune est un signalement daté. Si l'une
// de ces trois assertions tombe, c'est qu'une machine dont on SAIT qu'elle rame
// vient de repasser en pleine qualité.

// iMac 27" fin 2015, Retina 5K. macOS rapporte un écran CSS de 2560×1440 à
// densité 2 — soit 5120×2880 pixels réels, 14,7 Mpx à pousser à chaque image.
// Le circuit est un Iris Pro intégré de 2015. Symptôme du 28/07/2026 :
// ventilateur à fond, ~3 images par seconde.
const IMAC_2015 = {
  carte: 'Intel(R) Iris(TM) Pro Graphics 6200',
  maxTexture: 16384,
  maxUnites: 16,
  maxUniformsFrag: 1024,
  coeurs: 8,
  memoire: 8,
  densite: 2,
  ecran: [2560, 1440],
  pointeurGrossier: false,
}

// Rendu LOGICIEL : pas de carte du tout, le processeur dessine chaque pixel.
// Chrome y bascule quand le pilote est sur liste noire ou dans une machine
// virtuelle. Aucun réglage ne sauve ce cas — c'est le plancher, tout de suite.
const SWIFTSHADER = {
  carte: 'Google SwiftShader',
  maxTexture: 8192,
  maxUnites: 16,
  maxUniformsFrag: 1024,
  coeurs: 4,
  memoire: 8,
  densite: 1,
  ecran: [1920, 1080],
  pointeurGrossier: false,
}

// La machine de développement, et la majorité du trafic bureau : carte dédiée
// récente, écran 1080p sans mise à l'échelle. RIEN ne doit changer pour elle.
const RTX_1080P = {
  carte: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  maxTexture: 16384,
  maxUnites: 16,
  maxUniformsFrag: 1024,
  coeurs: 16,
  memoire: 8,
  densite: 1,
  ecran: [1920, 1080],
  pointeurGrossier: false,
}

// Vieux portable Windows : « des plombes à se charger », plus lent qu'un
// smartphone. Intel HD 4000 = 2012, 1366×768 sans densité.
const PORTABLE_2012 = {
  carte: 'ANGLE (Intel(R) HD Graphics 4000 Direct3D11 vs_5_0 ps_5_0)',
  maxTexture: 8192,
  maxUnites: 16,
  maxUniformsFrag: 1024,
  coeurs: 4,
  memoire: 4,
  densite: 1,
  ecran: [1366, 768],
  pointeurGrossier: false,
}

// MacBook Pro 14" M1 Pro : écran CSS 1512×982 à densité 2. Retina, mais Apple
// Silicon — c'est la machine puissante à écran dense, le piège symétrique de
// l'iMac. Elle doit garder sa densité 2.
const MBP_M1 = {
  carte: 'Apple M1 Pro',
  maxTexture: 16384,
  maxUnites: 16,
  maxUniformsFrag: 1024,
  coeurs: 10,
  memoire: 8,
  densite: 2,
  ecran: [1512, 982],
  pointeurGrossier: false,
}

// ---------------------------------------------------------------------------

test('classerCarte : le rendu logiciel est reconnu sous tous ses noms', () => {
  // C'est le seul verdict SANS APPEL du module : aucune quantité de réglages
  // ne rend un rasteriseur processeur utilisable. Les quatre noms circulent
  // vraiment — SwiftShader (Chrome), llvmpipe/softpipe (Mesa sous Linux),
  // « Microsoft Basic Render Driver » (Windows sans pilote).
  for (const nom of [
    'Google SwiftShader',
    'Mesa/X.org llvmpipe (LLVM 15.0.6, 256 bits)',
    'Microsoft Basic Render Driver',
    'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device), SwiftShader driver)',
    'softpipe',
  ]) {
    assert.equal(classerCarte(nom), 'logiciel', nom)
  }
})

test('classerCarte : les circuits intégrés anciens tombent en « faible »', () => {
  for (const nom of [
    'Intel(R) Iris(TM) Pro Graphics 6200',
    'ANGLE (Intel(R) HD Graphics 4000 Direct3D11 vs_5_0 ps_5_0)',
    'Intel(R) HD Graphics 520',
    'Mali-T860',
    'Adreno (TM) 505',
    'PowerVR SGX 543',
  ]) {
    assert.equal(classerCarte(nom), 'faible', nom)
  }
})

test('classerCarte : Iris Xe et UHD récents ne sont PAS de la même famille que Iris Pro', () => {
  // Le piège du motif trop large : « Iris » attrape aussi bien l'Iris Pro de
  // 2015 (faible) que l'Iris Xe de 2021 (moyen — il fait tourner des jeux).
  // Les confondre punirait une génération entière de portables corrects.
  assert.equal(classerCarte('Intel(R) Iris(R) Xe Graphics'), 'moyen')
  assert.equal(classerCarte('ANGLE (Intel, Intel(R) UHD Graphics 770, D3D11)'), 'moyen')
  assert.equal(classerCarte('Intel(R) Iris(TM) Pro Graphics 6200'), 'faible')
})

test('classerCarte : l’UHD 6xx est un HD 6xx avec un U devant, pas une carte récente', () => {
  // « Intel(R) UHD Graphics 620 » (portable de 2018) EST le HD 620 rebaptisé.
  // Le motif générique « uhd » vise les UHD 7xx de 2021, qui sont autre chose ;
  // sans distinction, toute une génération de portables faibles passait
  // « moyen » et démarrait un cran trop haut.
  assert.equal(classerCarte('Intel(R) UHD Graphics 620'), 'faible')
  assert.equal(classerCarte('ANGLE (Intel, Intel(R) UHD Graphics 630, D3D11)'), 'faible')
  assert.equal(classerCarte('Intel(R) UHD Graphics 770'), 'moyen', 'la génération suivante garde son rang')
  assert.equal(classerCarte('Intel(R) UHD Graphics 730'), 'moyen')
})

test('classerCarte : cartes dédiées et Apple Silicon en « fort »', () => {
  for (const nom of [
    'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'NVIDIA GeForce GTX 1660',
    'Apple M1 Pro',
    'Apple M3 Max',
    'AMD Radeon RX 6700 XT',
    'Intel(R) Arc(TM) A770 Graphics',
    'Adreno (TM) 750',
  ]) {
    assert.equal(classerCarte(nom), 'fort', nom)
  }
})

test('classerCarte : un nom absent ou masqué donne « inconnu », jamais une erreur', () => {
  // Firefox et Safari peuvent refuser WEBGL_debug_renderer_info. Ne rien savoir
  // est une situation NORMALE, pas une panne : le module doit la traverser.
  for (const nom of ['', null, undefined, 0, {}, 'Apple GPU']) {
    assert.equal(classerCarte(nom), 'inconnu', String(nom))
  }
})

test('le tableau croisé est complet et ne remonte jamais quand la charge monte', () => {
  // Une case oubliée, c'est un `undefined` servi comme palier, donc des
  // réglages `undefined` poussés dans params. La forme se vérifie.
  for (const classe of CLASSES_CARTE) {
    const ligne = TABLEAU[classe]
    assert.ok(Array.isArray(ligne) && ligne.length === 4, `ligne ${classe}`)
    for (let i = 1; i < 4; i++) {
      assert.ok(ligne[i] >= ligne[i - 1], `${classe} : la charge monte, le palier doit descendre (jamais l'inverse)`)
      assert.ok(ligne[i] >= 0 && ligne[i] <= 3, `${classe}[${i}] hors 0..3`)
    }
  }
  // et une carte plus faible ne peut jamais obtenir mieux qu'une plus forte
  for (let i = 0; i < 4; i++) {
    assert.ok(TABLEAU.fort[i] <= TABLEAU.moyen[i])
    assert.ok(TABLEAU.moyen[i] <= TABLEAU.faible[i])
    assert.ok(TABLEAU.faible[i] <= TABLEAU.logiciel[i])
  }
})

test('les paliers ne coûtent jamais plus cher en descendant', () => {
  // La garantie qui rend le tableau lisible : chaque colonne est monotone.
  // Sans elle, un palier « plus bas » pourrait servir des ombres plus fines
  // qu'un palier plus haut, et personne ne s'en apercevrait.
  const ordreOmbres = { dynamic: 2, static: 1, off: 0 }
  for (let n = 1; n < PALIERS.length; n++) {
    const a = PALIERS[n - 1]
    const b = PALIERS[n]
    assert.ok(b.densiteMax <= a.densiteMax, `densité ${n}`)
    assert.ok(b.budgetMpx <= a.budgetMpx, `budget ${n}`)
    assert.ok(ordreOmbres[b.ombres] <= ordreOmbres[a.ombres], `ombres ${n}`)
    assert.ok(b.ombresRes <= a.ombresRes, `résolution d'ombres ${n}`)
    assert.ok(b.verreMer <= a.verreMer, `verre de mer ${n}`)
    assert.ok(b.nuages >= a.nuages, `nuages ${n} (l'indice MONTE quand la qualité baisse)`)
    assert.ok(b.damierMax <= a.damierMax, `damier ${n}`)
    // 'bloom' était de cette liste jusqu'au 2026-08-02 : la passe a été retirée
    // du produit, la colonne avec, et il n'y a plus de levier à surveiller.
    for (const k of ['ssao', 'dof', 'grain']) {
      assert.ok(!(b[k] && !a[k]), `${k} ne peut pas réapparaître au palier ${n}`)
    }
  }
  // l'indice de palier est aussi l'indice de perf.js : 4 paliers, pas 5
  assert.equal(PALIERS.length, 4)
})

test('les paliers reprennent EXACTEMENT les leviers de perf.js', () => {
  // Le tableau et le gouverneur doivent raconter la même histoire, sinon le
  // premier rendu et la première correction se contredisent à l'écran.
  // perf.js : DoF coupé à n >= 2, grain coupé à n >= 3, verre 6/4/2/2.
  //
  // ⚠️ LA COLONNE `bloom` N'EXISTE PLUS, ET C'EST TESTÉ CI-DESSOUS. Elle valait
  // [true, true, true, false] et répondait à `_bloomTierOk = n < 3` dans
  // perf.js. La passe de bloom a été retirée du produit le 2026-08-02 (Adrien :
  // « inutile, on retire ») ; le levier de perf.js est parti avec, et une
  // colonne qui décrirait une passe inexistante ferait mentir ce tableau.
  //
  // ⚠️ `ssao` FAIT EXCEPTION et c'est délibéré (28/07/2026, demande d'Adrien) :
  // perf.js autorise encore l'occlusion ambiante aux paliers 0 et 1
  // (`_aoTierOk = n < 2`), mais elle ne s'ALLUME plus toute seule nulle part.
  // Ce champ dit désormais l'ÉTAT DE DÉPART, pas la permission — l'interrupteur
  // « Ombrage des creux » du panneau Effets reste, lui, entièrement libre.
  assert.deepEqual(PALIERS.map((p) => p.ssao), [false, false, false, false])
  // plus AUCUN palier ne porte de colonne `bloom` — ni true, ni false : absente
  assert.deepEqual(PALIERS.map((p) => Object.hasOwn(p, 'bloom')), [false, false, false, false])
  assert.deepEqual(PALIERS.map((p) => p.dof), [true, true, false, false])
  assert.deepEqual(PALIERS.map((p) => p.grain), [true, true, true, false])
  assert.deepEqual(PALIERS.map((p) => p.verreMer), [6, 4, 2, 2])
  assert.deepEqual(PALIERS.map((p) => p.nuages), [0, 1, 2, 3])
})

test('SSAO éteint par défaut sur TOUTES les machines, la plus forte comprise', () => {
  // La demande d'Adrien du 28/07/2026, prise au mot : « désactiver par défaut
  // le SSAO ». Pas « sur les machines faibles » — partout. C'est une passe de
  // scène ENTIÈRE en plus pour un effet que la carte, vue de haut, ne montre
  // presque pas.
  for (const machine of [RTX_1080P, MBP_M1, IMAC_2015, PORTABLE_2012, SWIFTSHADER]) {
    assert.equal(reglagesServis(machine).ssao, false, `${machine.carte}`)
  }
})

test('les ombres démarrent en 1024², pas en 2048², sur tous les paliers', () => {
  // Adrien, 28/07/2026 : « par défaut, ombres moins précises que ça ».
  // ⚠️ CE QUE CE RÉGLAGE CHANGE, ET CE QU'IL NE CHANGE PAS. La résolution de la
  // carte d'ombres ne retire pas UN SEUL triangle : la passe d'ombre dessine
  // exactement les mêmes objets, seulement dans une texture quatre fois plus
  // petite. Ce qu'elle économise est réel mais ailleurs — le remplissage, les
  // deux passes de flou VSM (blurSamples 16) qui balayent toute la carte à
  // chaque image en mode dynamique, et 16 Mo → 4 Mo de mémoire vidéo allouée
  // AVANT la première image. Les triangles, eux, se comptent ailleurs (voir la
  // note « ombresPortees » ci-dessous).
  assert.deepEqual(PALIERS.map((p) => p.ombresRes), [1024, 1024, 1024, 1024])
})

test('classerCharge : les seuils séparent les écrans qu on voit vraiment', () => {
  assert.equal(classerCharge(2.07), 0, '1920×1080 à densité 1')
  assert.equal(classerCharge(3.69), 1, '2560×1440 à densité 1')
  assert.equal(classerCharge(5.94), 1, 'MacBook Pro 14" à densité 2')
  assert.equal(classerCharge(8.29), 2, '4K à densité 1')
  assert.equal(classerCharge(14.75), 2, 'iMac 5K à densité 2')
  assert.equal(classerCharge(33.18), 3, '4K à densité 2 — 8K de tampon')
  assert.equal(classerCharge(0), 0)
  assert.equal(classerCharge(NaN), 0, 'ne rien savoir ne doit pas dégrader')
})

// ---------------------------------------------------------------------------
// LES TROIS VERDICTS QUI COMPTENT
// ---------------------------------------------------------------------------

test('iMac 27" 2015 (Iris Pro, 5120×2880 réels) → palier BAS, et 4× moins de pixels', () => {
  const e = estimerPalier(IMAC_2015)
  assert.equal(e.carte, 'faible')
  assert.equal(e.palier, 2, 'palier ALLÉGÉ : bas, mais pas le plancher — le gouverneur finira le travail s’il le faut')

  const r = reglagesServis(IMAC_2015)
  // le chiffre qui décide de tout : le nombre de pixels du premier rendu
  assert.ok(r.mpxServis <= 3.5, `tampon servi ${r.mpxServis} Mpx — il en poussait 14,7`)
  assert.ok(r.densite < 1, `densité servie ${r.densite} (elle valait 2)`)
  assert.equal(r.ombres, 'static', 'les ombres restent LÀ — un bloc sans ombre du tout se lit comme une panne')
  assert.equal(r.ssao, false)
  assert.equal(r.dof, false)
  assert.ok(r.raisons.length > 0, 'un verdict sans raison ne se débogue pas')
})

test('SwiftShader (rendu logiciel) → palier MINIMAL, quel que soit le reste', () => {
  // Même avec 32 cœurs, 64 Go et un écran minuscule : c'est le processeur qui
  // dessine, il n'y a pas de version « moyenne » de cette machine.
  const e = estimerPalier({ ...SWIFTSHADER, coeurs: 32, memoire: 64, ecran: [800, 600] })
  assert.equal(e.palier, 3)
  const r = reglagesServis(SWIFTSHADER)
  assert.equal(r.ombres, 'off')
  assert.equal(r.bloom, undefined, 'la colonne bloom a été retirée du tableau des paliers')
  assert.equal(r.grain, false)
})

test('RTX 3070 en 1080p → palier HAUT, et RIEN ne change pour elle', () => {
  // Le test de non-régression : la machine normale garde sa densité d'écran et
  // ses ombres DYNAMIQUES — c'est le mouvement du soleil qui fait la carte.
  // Deux réglages ont bougé le 28/07/2026, et pour tout le monde, y compris
  // ici : la carte d'ombres démarre en 1024² (elle naissait en 2048²) et
  // l'occlusion ambiante est éteinte. Voir les deux tests dédiés plus haut.
  const r = reglagesServis(RTX_1080P)
  assert.equal(r.palier, 0)
  assert.equal(r.densite, 1, 'la densité de l’écran, ni plus ni moins')
  assert.equal(r.ombres, 'dynamic')
  assert.equal(r.ombresRes, 1024)
  assert.equal(r.ssao, false)
  assert.equal(r.bloom, undefined, 'la colonne bloom a été retirée du tableau des paliers')
  assert.equal(r.dof, true)
  assert.equal(r.analyseMax, 0, '0 = analyse à pleine taille du MNT')
})

test('MacBook Pro M1 : reconnu FORT, mais borné par la barre haute de 2K', () => {
  // Le piège symétrique de l'iMac : un écran dense n'est PAS un signal de
  // faiblesse. Punir la densité seule aurait flouté tous les Mac récents — et
  // c'est bien ce que dit le PALIER : 0, pleine qualité, tous les effets.
  const r = reglagesServis(MBP_M1)
  assert.equal(r.palier, 0)
  assert.equal(r.dof, true, 'le palier est intact : ce n’est pas une dégradation')
  assert.equal(r.bloom, undefined, 'la colonne bloom a été retirée du tableau des paliers')
  // Sa densité, elle, tombe sous 2 — non pas parce qu'on le juge faible, mais
  // parce qu'Adrien a posé une barre haute commune le 28/07 : « réso 2K max ».
  // Elle s'applique à TOUT LE MONDE, y compris à la machine la plus forte.
  assert.ok(r.densite < 2, 'la barre haute mord même sur un M1')
  assert.ok(r.mpxServis <= PLAFOND_MPX + 0.01, `${r.mpxServis} Mpx doit tenir sous la barre`)
})

test('la barre haute de 2K vaut pour TOUTES les machines, palier 0 compris', () => {
  // LE TEST CARDINAL du plafond : quelle que soit la carte, quel que soit
  // l'écran, l'image temps réel ne dépasse jamais 2560×1440. Sans lui, le
  // palier 0 promettait 16 Mpx ici pendant qu'applyRenderSize en servait 3,69.
  for (const machine of [RTX_1080P, MBP_M1, IMAC_2015, PORTABLE_2012, SWIFTSHADER]) {
    const r = reglagesServis(machine)
    assert.ok(
      r.mpxServis <= PLAFOND_MPX + 0.01,
      `${r.nom} sert ${r.mpxServis} Mpx, au-dessus de la barre de ${PLAFOND_MPX}`,
    )
  }
})

test('un écran ordinaire ne sent PAS la barre haute passer', () => {
  // Non-régression la plus importante du plafond : il ne doit rien coûter à la
  // majorité du trafic. Un 1080p à densité 1 fait 2,07 Mpx, largement dessous.
  assert.equal(reglagesServis(RTX_1080P).densite, 1, 'densité inchangée')
})

test('vieux portable Windows (HD 4000, 1366×768) → palier ALLÉGÉ malgré un petit écran', () => {
  // Sa charge de pixels est ridicule ; c'est la CARTE qui le condamne. Un
  // système qui ne regarderait que la taille d'écran l'aurait laissé en pleine
  // qualité — et c'est exactement ce qui s'est passé le 28/07/2026.
  const e = estimerPalier(PORTABLE_2012)
  assert.equal(e.charge, 0, 'sa charge de pixels est la plus légère de toutes')
  assert.equal(e.palier, 2)
  assert.notEqual(reglagesServis(PORTABLE_2012).ombres, 'dynamic')
})

// ---------------------------------------------------------------------------
// LES CORRECTIFS — ce que la carte ne dit pas, les limites le disent
// ---------------------------------------------------------------------------

test('une limite de texture basse enfonce le palier même si le nom est flatteur', () => {
  // Les noms mentent (marques recyclées, ANGLE qui renomme, pilotes génériques).
  // MAX_TEXTURE_SIZE, lui, est une limite matérielle : 4096 ou moins date le
  // circuit sans ambiguïté — et c'est la MÊME limite qui fait raboter le tampon
  // de dessin par Chrome (voir viewport.js).
  const menteuse = { ...RTX_1080P, maxTexture: 4096 }
  assert.ok(estimerPalier(menteuse).palier >= 2)
  const tresVieille = { ...RTX_1080P, maxTexture: 2048 }
  assert.equal(estimerPalier(tresVieille).palier, 3)
})

test('deux cœurs ou 2 Go annoncés enfoncent aussi le palier', () => {
  assert.ok(estimerPalier({ ...RTX_1080P, coeurs: 2 }).palier >= 2)
  assert.ok(estimerPalier({ ...RTX_1080P, memoire: 2 }).palier >= 2)
  // …mais des valeurs ABSENTES ne dégradent rien : deviceMemory n'existe que
  // sur Chrome, et Firefox ne doit pas être puni de sa discrétion.
  assert.equal(estimerPalier({ ...RTX_1080P, memoire: undefined, coeurs: undefined }).palier, 0)
})

test('un correctif ne peut qu’AGGRAVER le verdict, jamais l’adoucir', () => {
  // La règle d'Adrien — « il vaut mieux de la fluidité que de la qualité » —
  // écrite en assertion : aucun signal généreux (32 cœurs, 64 Go) ne rattrape
  // une carte classée faible.
  const genereux = { ...IMAC_2015, coeurs: 32, memoire: 64, maxTexture: 16384 }
  assert.ok(estimerPalier(genereux).palier >= estimerPalier(IMAC_2015).palier)
})

test('estimerPalier survit à un objet vide et reste prudent', () => {
  const e = estimerPalier({})
  assert.ok(e.palier >= 0 && e.palier <= 3)
  assert.equal(e.carte, 'inconnu')
  assert.ok(e.palier >= 1, 'ne rien savoir n’autorise pas la pleine qualité')
  assert.doesNotThrow(() => estimerPalier())
})

// ---------------------------------------------------------------------------
// LA DENSITÉ SERVIE — le budget de pixels
// ---------------------------------------------------------------------------

test('la densité servie ne dépasse jamais celle de l’écran ni le plafond de 2', () => {
  for (const s of [IMAC_2015, SWIFTSHADER, RTX_1080P, PORTABLE_2012, MBP_M1]) {
    const r = reglagesServis(s)
    assert.ok(r.densite <= Math.min(2, s.densite) + 1e-9, `densité ${r.densite} > écran ${s.densite}`)
    assert.ok(r.densite >= PLANCHER_DENSITE, `densité ${r.densite} sous le plancher`)
  }
})

test('le budget de pixels borne un écran géant même sur une carte forte', () => {
  // Un 8K à densité 2, c'est 133 Mpx demandés : aucune carte ne tient ça, y
  // compris la meilleure. Le budget est le dernier filet.
  const monstre = { ...RTX_1080P, ecran: [7680, 4320], densite: 2 }
  const r = reglagesServis(monstre)
  assert.ok(r.mpxServis < 9, `${r.mpxServis} Mpx servis au lieu de 132,7 demandés`)
  // L'ARBITRAGE À CONNAÎTRE : sur un écran assez démesuré, c'est le PLANCHER de
  // densité qui gagne contre le budget, pas l'inverse. En dessous de 0,5 les
  // étiquettes de sommet deviennent illisibles — on aurait échangé de la
  // lenteur contre de l'illisibilité, ce qui n'est pas le marché proposé.
  assert.ok(
    r.mpxServis <= PALIERS[r.palier].budgetMpx + 0.01 || r.densite === PLANCHER_DENSITE,
    'le budget tient, ou alors c’est le plancher de lisibilité qui a tranché'
  )
  assert.equal(r.densite, PLANCHER_DENSITE, 'et sur un 8K, c’est bien le plancher')
})

test('un écran ordinaire ne touche JAMAIS le plancher de densité', () => {
  // La contrepartie du test précédent : le plancher est un cas extrême, pas
  // une valeur de service. S'il apparaissait sur un écran courant, on aurait
  // rendu l'application floue pour tout le monde.
  for (const s of [RTX_1080P, MBP_M1, PORTABLE_2012, IMAC_2015]) {
    assert.ok(reglagesServis(s).densite > PLANCHER_DENSITE, s.carte)
  }
})

test('un écran minuscule ne fait pas MONTER la densité au-dessus de l’écran', () => {
  // Le budget est un plafond, jamais un objectif : sur un petit écran il reste
  // large, et c'est la densité réelle qui commande.
  const petit = { ...RTX_1080P, ecran: [800, 600], densite: 1 }
  assert.equal(reglagesServis(petit).densite, 1)
})

test('mise à l’échelle Windows à 250 % : un viewport minuscule n’est pas une machine faible', () => {
  // Sur un 1366×768 à 250 %, l'écran CSS ne fait plus que 546×307. Lire cette
  // taille comme « petite machine » serait déjà faux ; la lire comme
  // « téléphone » le serait deux fois. On raisonne sur les pixels RÉELS.
  const w250 = { ...RTX_1080P, ecran: [546, 307], densite: 2.5 }
  const r = reglagesServis(w250)
  assert.equal(r.palier, 0)
  assert.equal(r.densite, 2, 'la densité est bornée à 2, pas rabaissée')
})

// ---------------------------------------------------------------------------
// L'ACCORD AVEC LE GOUVERNEUR (perf.js)
// ---------------------------------------------------------------------------

test('palierDeDepart : un téléphone reste au plancher quoi que dise la détection', () => {
  // Un téléphone n'atteint l'application que comme VISIONNEUSE d'une shibu
  // partagée. Même avec une carte classée « fort » (Adreno 750, A17), il part
  // au palier minimal — c'était déjà la règle de perf.js, elle ne se perd pas.
  assert.equal(palierDeDepart(0, { phone: true, coarse: true }), 3)
  assert.equal(palierDeDepart(1, { phone: false, coarse: true }), 1, 'tablette : au moins ÉQUILIBRÉ')
  assert.equal(palierDeDepart(2, { phone: false, coarse: true }), 2, 'la détection gagne si elle est plus sévère')
  assert.equal(palierDeDepart(0, { phone: false, coarse: false }), 0)
  assert.equal(palierDeDepart(null, { phone: false, coarse: false }), 0, 'pas de détection = comportement d’avant')
})

test('plafondDeRemontee : la détection peut se tromper d’UN cran, pas de deux', () => {
  // La détection statique ne mesure rien : elle estime. Le gouverneur, lui,
  // mesure. On lui laisse donc regagner exactement un palier si la machine
  // tient — ce qui rattrape le cas « carte masquée » (Firefox, Safari) sans
  // jamais autoriser la pleine qualité sur un iMac 2015.
  assert.equal(plafondDeRemontee(2, { phone: false, coarse: false }), 1)
  assert.equal(plafondDeRemontee(0, { phone: false, coarse: false }), 0)
  assert.equal(plafondDeRemontee(3, { phone: true, coarse: true }), 3, 'un téléphone ne remonte jamais')
  assert.equal(plafondDeRemontee(1, { phone: false, coarse: true }), 1, 'une tablette non plus')
})

// ---------------------------------------------------------------------------
// LA CONNEXION — une AUTRE échelle, qui ne touche pas au rendu
// ---------------------------------------------------------------------------

test('classerReseau : la connexion gouverne les tuiles, pas les pixels', () => {
  assert.equal(classerReseau({ effectiveType: '4g', downlink: 10 }).classe, 'rapide')
  assert.equal(classerReseau({ effectiveType: '3g', downlink: 1.2 }).classe, 'lent')
  assert.equal(classerReseau({ effectiveType: 'slow-2g' }).classe, 'tres-lent')
  assert.equal(classerReseau({ effectiveType: '4g', saveData: true }).classe, 'tres-lent', 'économiseur de données = demande explicite')
  assert.equal(classerReseau(null).classe, 'rapide', 'l’API n’existe pas sur Safari/Firefox : ne rien brider')
  // et surtout : le réseau ne renvoie PAS de palier de rendu
  assert.equal(classerReseau({ effectiveType: '2g' }).palier, undefined)
})

// ---------------------------------------------------------------------------
// LA LECTURE DES SIGNAUX — hostile par défaut
// ---------------------------------------------------------------------------

test('lireSignaux traverse un environnement hostile sans jamais lever', () => {
  // Ce code tourne AVANT tout le reste, dans le navigateur d'un inconnu. Une
  // exception ici, c'est la planète de chargement qui tourne pour toujours —
  // exactement ce que boot-gate.js existe pour empêcher.
  const glQuiExplose = {
    getExtension: () => { throw new Error('non') },
    getParameter: () => { throw new Error('non plus') },
  }
  assert.doesNotThrow(() => lireSignaux({ gl: glQuiExplose, nav: {}, win: {} }))
  assert.doesNotThrow(() => lireSignaux({}))
  assert.doesNotThrow(() => lireSignaux())
  const s = lireSignaux({ gl: null, nav: {}, win: {} })
  assert.equal(typeof s.densite, 'number')
  assert.ok(Array.isArray(s.ecran) && s.ecran.length === 2)
})

test('lireSignaux : un `screen` à 0 retombe sur la fenêtre, pas sur « écran inconnu »', () => {
  // Cas RÉEL, vérifié le 28/07/2026 dans un panneau de prévisualisation
  // embarqué : `screen.width` y vaut 0. Sans repli, la charge de pixels
  // retomberait à zéro — donc « légère », donc le palier le plus généreux, et
  // le budget de pixels ne mordrait plus. La machine qu'on veut protéger
  // repasserait en pleine qualité par un chemin parfaitement silencieux.
  const s = lireSignaux({ nav: {}, win: { screen: { width: 0, height: 0 }, innerWidth: 2560, innerHeight: 1440, devicePixelRatio: 2 } })
  assert.deepEqual(s.ecran, [2560, 1440])
  // et si les deux manquent, on ne devine pas : 0, et la charge la plus légère
  assert.deepEqual(lireSignaux({ nav: {}, win: {} }).ecran, [0, 0])
})

test('lireSignaux : la FENÊTRE prime sur l’écran — c’est elle qu’on dessine (PF4)', () => {
  // Mesuré : panneau de session, `screen` 1920×1080 pour une fenêtre de 563×419 ;
  // Chrome sans tête, `screen` 800×600 pour une fenêtre de 1280×800. Le budget
  // de pixels agit sur la surface dessinée, donc c'est elle qu'il faut lire.
  const s = lireSignaux({ nav: {}, win: { screen: { width: 1920, height: 1080 }, innerWidth: 563, innerHeight: 419, devicePixelRatio: 1 } })
  assert.deepEqual(s.ecran, [563, 419])
  const t = lireSignaux({ nav: {}, win: { screen: { width: 800, height: 600 }, innerWidth: 1280, innerHeight: 800 } })
  assert.deepEqual(t.ecran, [1280, 800])
  // fenêtre à 0 (pas encore mise en page) : l'écran reste le repli
  assert.deepEqual(lireSignaux({ nav: {}, win: { screen: { width: 2560, height: 1440 }, innerWidth: 0, innerHeight: 0 } }).ecran, [2560, 1440])
})

test('lireSignaux préfère le nom DÉMASQUÉ de la carte quand l’extension existe', () => {
  const gl = {
    RENDERER: 7937,
    MAX_TEXTURE_SIZE: 3379,
    MAX_TEXTURE_IMAGE_UNITS: 34930,
    MAX_FRAGMENT_UNIFORM_VECTORS: 36349,
    getExtension: (n) => (n === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 37446 } : null),
    getParameter: (c) => ({ 7937: 'WebKit WebGL', 37446: 'Apple M1 Pro', 3379: 16384, 34930: 16, 36349: 1024 })[c],
  }
  const s = lireSignaux({ gl, nav: {}, win: {} })
  assert.equal(s.carte, 'Apple M1 Pro', '« WebKit WebGL » ne dit rien, le nom démasqué dit tout')
  assert.equal(s.maxTexture, 16384)
})

test('sonderMachine mesure son propre coût et le rend lisible', () => {
  // Adrien : « dans les millisecondes de l'ouverture ». On ne le promet pas,
  // on le CHIFFRE — et le chiffre voyage avec le verdict.
  const r = sonderMachine({ gl: null, nav: {}, win: {}, memo: false })
  assert.equal(typeof r.ms, 'number')
  assert.ok(r.ms >= 0 && r.ms < 250, `sonde en ${r.ms} ms`)
  assert.ok(r.palier >= 0 && r.palier <= 3)
  assert.ok(typeof r.densite === 'number' && r.densite > 0)
  assert.ok(Array.isArray(r.raisons))
})

test('sonderMachine mémorise : la sonde ne tourne qu’une fois par session', () => {
  // boot.js la déclenche au plus tôt, main.js la relit. Deux contextes WebGL
  // créés pour la même réponse, ce serait payer deux fois.
  const a = sonderMachine({ gl: null, nav: {}, win: {} })
  const b = sonderMachine({ gl: null, nav: {}, win: {} })
  assert.equal(a, b, 'même objet, pas une copie')
})

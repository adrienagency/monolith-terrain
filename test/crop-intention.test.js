// D21 — LA SORTIE DU CROP EST UNE INTENTION, ET LE CROP NAÎT DÈS z7.
// Tâche C1 (`.superpowers/sdd/2026-08-22-globe-studio/brief-C1.md`).
//
// > **Adrien, 2026-09-04 :** *« Je voudrais que lorsqu'on passe en mode crop, on
// > ne puisse plus revenir en mode non crop uniquement par l'altitude (exemples :
// > déplacement de hauteur via l'inclinaison de la caméra, changement de l'angle
// > de caméra via les boutons). Les seuls moyens de sortir du mode crop
// > seraient : de cliquer sur la map monde ; de zoomer dézoomer à l'aide du clic
// > droit gardé enfoncé ; de déscroller via le bouton de scroll central. Le mode
// > crop doit s'activer dès Z7. Les rivières par défaut ne sont pas activées. »*
//
// ══════════ CE QUE CE FICHIER GARDE ════════════════════════════════════════
//
//   ① L'INTENTION — le crop survit à toute altitude tant qu'aucun geste de
//      dézoom ne l'a armée, et il meurt au premier cran franc quand elle l'est.
//      C'est la règle, jouée sur l'automate de production (`creerVeilleCrop`),
//      pas sur la seule fonction pure.
//   ② LES TROIS SORTIES, ET AUCUNE AUTRE — molette, clic droit, bouton monde ;
//      ⛔ ni l'inclinaison, ni le cap, ni les boutons de caméra.
//   ③ LA NAISSANCE À z7 — le palier `DIVE_TIERS`, verrouillé contre sa source.
//   ④ LE DÉPARTAGE — `arriveeBloc` (D16 ter) ne suit PAS la naissance du crop.
//   ⑤ LE BRANCHEMENT — `main.js` n'est chargé par aucun test de ce dépôt (§0 du
//      plan) : on en vérifie le TEXTE, patron de `test/seuil-branche.test.js`.
//   ⑥ LE DÉFAUT DES RIVIÈRES — éteint, sans que l'option ni la couche partent.
//
// ⚠️ **CE QUE CE FICHIER NE PEUT PAS TESTER** : que le geste arrive bien au
// bon endroit dans un vrai navigateur. Ça se mesure à l'écran, huit
// chargements, et ça vit dans `rapport-C1.md`.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  SEUIL_NAISSANCE_M,
  SEUIL_MORT_M,
  SEUIL_BLOC_M,
  SEUIL_BLOC_MORT_M,
  ALT_PALIER_Z7_M,
  socleVisible,
  auBloc,
} from '../src/monde/seuil-socle.js'
import { creerVeilleCrop } from '../src/monde/branchement-crop.js'
import { creerVeilleRepos } from '../src/monde/veille-repos.js'
import { creerVeilleSocle } from '../src/monde/veille-socle.js'
import { DIVE_TIERS } from '../src/modes.js'
import { gesteDuBouton, GESTE, REGIME } from '../src/monde/gestes-terre.js'

const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const BARS = readFileSync(new URL('../src/ui/bars.js', import.meta.url), 'utf8')
const BOUTONS = readFileSync(new URL('../src/boutons-camera.js', import.meta.url), 'utf8')
const SHIBUSTART = readFileSync(new URL('../public/templates/defaults/shibustart.json', import.meta.url), 'utf8')

// ── le globe factice de `test/crop-branche.test.js`, RECOPIÉ TEL QUEL.
// ⚠️ **RECOPIÉ PLUTÔT QU'IMPORTÉ, ET C'EST LE PRÉCÉDENT DU DÉPÔT** : les
// fichiers de test de ce chantier ne s'importent pas les uns les autres (aucun
// n'exporte), et un module d'aide partagé serait une septième source de vérité
// sur la forme du globe. Si l'API du globe bouge, les deux fichiers rougissent.
function globeFactice({ refuse = {} } = {}) {
  const j = []
  const g = {
    _crop: null,
    journal: j,
    refuse: { fond: false, parois: false, rampe: false, mer: false, ...refuse },
    poserCrop(a) {
      // ⚠️ **Tâche P6 : L'ARGUMENT ENTIER EST JOURNALISÉ.** Trois champs
      // recopiés ne diraient rien de `half`, `corner` et `expo` — ceux-là mêmes
      // que personne n'a jamais passés pendant dix tâches.
      j.push({ quoi: 'crop', arg: a, centre: a?.centre, zoom: a?.zoom, tuilesParBloc: a?.tuilesParBloc })
      g._crop = { cx: 0.5, cy: 0.35, demi: a.tuilesParBloc / 2 / 2 ** a.zoom, zoom: a.zoom }
      return g._crop
    },
    // LE FOND DU CROP — Tâche J bis. ⚠️ **IL REFUSE SANS CROP, comme le vrai** :
    // `poserFondCrop` sort à sa première ligne quand `_crop` est nul.
    poserFondCrop(a) {
      j.push({ quoi: 'fond', arg: a })
      if (!g._crop) return { refus: 'crop', couverture: 0, bathy: false }
      return g.refuse.fond
        ? { refus: 'champ', couverture: 0.3, bathy: false }
        : { refus: null, couverture: 1, bathy: true, profMaxM: 2116.3, rebati: 50 }
    },
    construireParoisCrop(a) {
      j.push({ quoi: 'parois', arg: a })
      if (!g._crop) return null
      return g.refuse.parois ? { mesh: null, refus: 'couverture' } : { mesh: {}, refus: null, couverture: 1 }
    },
    poserHabillage(a) {
      j.push({ quoi: 'habillage', arg: a, avecCrop: !!g._crop })
      return a
    },
    poserRampe(a) {
      j.push({ quoi: 'rampe', arg: a })
      if (!g._crop) return { refus: 'crop', echelle: null, mesure: null }
      return g.refuse.rampe ? { refus: 'couverture', echelle: null } : { refus: null, echelle: {} }
    },
    async poserMer(a) {
      j.push({ quoi: 'mer', arg: a })
      if (!g._crop) return null
      return g.refuse.mer ? { refus: 'champ', portee: 4 } : { portee: 4, couverture: 1 }
    },
    retirerCrop() {
      j.push({ quoi: 'retirer' })
      g._crop = null
    },
  }
  return g
}

const contexteFactice = (centre = { lat: 45.9, lon: 6.87 }, zoom = 12) => () => ({
  centre, zoom, tuilesParBloc: 3, portee: 4,
})

// une altitude franchement dans le crop, et une franchement au-dessus de la mort
const DANS_LE_CROP = 5_000
const AU_DESSUS_DE_LA_MORT = SEUIL_MORT_M * 1.5

function veilleDansLeCrop() {
  const g = globeFactice()
  const v = creerVeilleCrop({ globe: g, contexte: contexteFactice() })
  v.maj(DANS_LE_CROP)
  assert.equal(v.pose, true, 'le montage du test est faux : le crop n’est pas né')
  return { g, v }
}

// ══════════ ① L'INTENTION ══════════════════════════════════════════════════

test('① D21 — SANS INTENTION, AUCUNE ALTITUDE NE TUE LE CROP', async () => {
  // ⛔ **C'EST LE DÉFAUT QU'ADRIEN NOMME.** Avant D21, franchir `SEUIL_MORT_M`
  // suffisait : incliner la caméra fait monter l'altitude, et le crop mourait.
  const { g, v } = veilleDansLeCrop()
  // on monte jusqu'à l'orbite haute, image après image, sans jamais rien armer
  for (const alt of [SEUIL_BLOC_M, SEUIL_BLOC_MORT_M, SEUIL_NAISSANCE_M, SEUIL_MORT_M,
    AU_DESSUS_DE_LA_MORT, 4_000_000, 60_000_000]) {
    assert.equal(v.maj(alt), true, `le crop meurt à ${alt} m sans qu’on l’ait demandé`)
  }
  assert.equal(v.pose, true)
  assert.ok(g._crop, 'le crop a été retiré du globe')
  assert.equal(g.journal.filter((x) => x.quoi === 'retirer').length, 0)
  assert.equal(v.bascules, 1, 'une seule bascule : la naissance')
  await v.enVol()
})

test('① bis ARMÉE, elle tue au PREMIER cran franc — et pas avant', async () => {
  const { g, v } = veilleDansLeCrop()
  v.armerSortie()
  assert.equal(v.sortieArmee, true)
  // armée mais SOUS le seuil : le crop vit encore. L'intention n'est pas un
  // ordre immédiat, c'est une permission.
  assert.equal(v.maj(SEUIL_MORT_M * 0.99), true, 'armée, elle ne tue pas SOUS le seuil')
  // le premier cran qui passe le seuil : il meurt, dans la même image
  assert.equal(v.maj(AU_DESSUS_DE_LA_MORT), false)
  assert.equal(g.journal.at(-1).quoi, 'retirer')
  assert.equal(g._crop, null)
  await v.enVol()
})

test('① ter L’INTENTION EST CONSOMMÉE À LA MORT, ET REMISE À ZÉRO À LA NAISSANCE', async () => {
  // ⛔ Sans ça, le crop suivant mourrait sur son premier soubresaut d'altitude,
  // sans nouveau geste — une mine amorcée sous le bloc.
  const { v } = veilleDansLeCrop()
  v.armerSortie()
  v.maj(AU_DESSUS_DE_LA_MORT)
  assert.equal(v.pose, false)
  assert.equal(v.sortieArmee, false, 'l’intention n’a pas été consommée à la mort')
  // on redescend : le crop renaît, et rien n'est armé
  assert.equal(v.maj(DANS_LE_CROP), true)
  assert.equal(v.sortieArmee, false)
  // et il resurvit à l'altitude qui vient de le tuer
  assert.equal(v.maj(AU_DESSUS_DE_LA_MORT), true)
  await v.enVol()
})

test('① quater UN ZOOM AVANT DÉSARME — le critère « zoom avant → le crop vit »', async () => {
  const { v } = veilleDansLeCrop()
  v.armerSortie()
  v.desarmerSortie()
  assert.equal(v.sortieArmee, false)
  assert.equal(v.maj(AU_DESSUS_DE_LA_MORT), true, 'un aller-retour molette a laissé une mine amorcée')
  await v.enVol()
})

test('① quinquies L’INTENTION NE FAIT NAÎTRE PERSONNE — D21 : « la naissance garde son seuil »', () => {
  const g = globeFactice()
  const v = creerVeilleCrop({ globe: g, contexte: contexteFactice(), cropAuDepart: false })
  v.armerSortie()
  assert.equal(v.maj(SEUIL_NAISSANCE_M * 1.01), false, 'l’intention a fait naître le crop trop haut')
  assert.deepEqual(g.journal, [])
})

// ══════════ ② LES TROIS SORTIES, ET AUCUNE AUTRE ═══════════════════════════

test('② le BOUTON MONDE sort du crop, et il passe par le MODE, pas par l’altitude', async () => {
  // `.ce-globebtn` → `ctx.enterOrbit()` → `modes.enterOrbit` → `poserMode(false)`.
  assert.match(BARS, /ce-globebtn/, 'le bouton monde a disparu de la barre du haut')
  assert.match(BARS, /iconButton\(I\.globe,\s*'',\s*\(\)\s*=>\s*ctx\.enterOrbit\(\)\)/)
  assert.match(MAIN, /enterOrbit:\s*\(\)\s*=>\s*\{[^}]*modes\.enterOrbit\(/)
  // et l'automate : le mode PRIME, à toute altitude, sans intention
  const { g, v } = veilleDansLeCrop()
  v.poserMode(false)
  assert.equal(v.pose, false)
  assert.equal(g.journal.at(-1).quoi, 'retirer')
  await v.enVol()
})

test('② bis LA MOLETTE EN DÉZOOM ARME, LE ZOOM AVANT DÉSARME — et c’est au DOM', () => {
  // ⚠️ **PAS DANS `modes._zoomGesture`, ET C'EST MESURÉ DANS LE CODE** : cette
  // porte sort tôt sur six gardes (`locked`, `busy`, `_diveTween`, les crochets
  // de suivi et de cadrage). L'intention est un fait du GESTE, pas de ce que le
  // zoom a réussi à faire.
  assert.match(MAIN, /function intentionZoom\s*\(deltaY\)\s*\{/)
  const corps = MAIN.slice(MAIN.indexOf('function intentionZoom'))
  const fin = corps.indexOf('\n}')
  const f = corps.slice(0, fin)
  assert.match(f, /deltaY\s*>\s*0/, 'le sens du dézoom n’est plus lisible')
  assert.match(f, /armerSortie/)
  assert.match(f, /desarmerSortie/)
  assert.match(MAIN, /addEventListener\('wheel',\s*\(e\)\s*=>\s*intentionZoom\(e\.deltaY\)/)
})

test('② ter LE CLIC DROIT MAINTENU ARME, SUR LE PAS DE L’IMAGE', () => {
  // le geste de zoom de D19 : `zoomDuGlisseDroit(dy)` rend un `deltaY`, positif
  // en dézoom. ⚠️ Sur le PAS, pas sur le cumul : `dLogGlisse` est consommé et
  // remis à zéro à chaque image, donc le lire ne dirait rien du sens du geste.
  assert.match(MAIN, /intentionZoom\(zoomDuGlisseDroit\(dy\)\)/)
  assert.ok(
    MAIN.indexOf('intentionZoom(zoomDuGlisseDroit(dy))') > MAIN.indexOf('gestesTerre.dLogGlisse +='),
    'l’intention doit être prise dans la branche GESTE.ZOOM du clic droit'
  )
})

test('② quater ⛔ NI L’INCLINAISON NI LE CAP NE SORTENT DU CROP — D19 intact', () => {
  // ⚠️ **LE POINT DE FRICTION DE D21 ①, ET IL EST TRANCHÉ.** Le bouton du
  // MILIEU (et Ctrl / Maj) porte l'inclinaison et le cap depuis D19/GE2 ; lui
  // donner aussi la sortie du crop serait contradictoire.
  assert.match(BOUTONS, /milieu:\s*ACTION\.INCLINAISON/)
  // la branche d'inclinaison de `main.js` ne touche à AUCUNE intention
  const i = MAIN.indexOf('} else if (gestesTerre.actif === GESTE.INCLINAISON) {')
  assert.ok(i > 0, 'la branche d’inclinaison a bougé — ce test ne garde plus rien')
  const branche = MAIN.slice(i, MAIN.indexOf('\n}', i))
  assert.ok(!/intentionZoom|armerSortie/.test(branche),
    'l’inclinaison arme la sortie du crop — D21 ① et D19 se contredisent')
  // et `appliquerInclinaison` non plus
  const j = MAIN.indexOf('function appliquerInclinaison(')
  const corpsInc = MAIN.slice(j, MAIN.indexOf('\n}', j))
  assert.ok(!/armerSortie/.test(corpsInc))
  // ⚠️ ET L'AUTOMATE LE DIT AUSSI : une inclinaison, c'est une altitude qui
  // monte à distance constante. Le crop vit.
  const { v } = veilleDansLeCrop()
  for (let i = 0; i < 200; i++) v.maj(DANS_LE_CROP + i * 5_000, 1_000)
  assert.equal(v.pose, true, 'incliner tue le crop')
  return v.enVol()
})

test('② quinquies ⛔ LES BOUTONS DE CAMÉRA NE SORTENT PAS DU CROP', () => {
  // `applyIsoView` déplace la caméra ET sa distance : l'altitude bouge beaucoup.
  const j = MAIN.indexOf('function applyIsoView(')
  assert.ok(j > 0, '`applyIsoView` a disparu — les boutons de caméra sont ailleurs')
  const corps = MAIN.slice(j, MAIN.indexOf('\n}', j))
  assert.ok(!/armerSortie|intentionZoom/.test(corps),
    'un bouton de caméra arme la sortie du crop — D21 ② tombe')
})

test('② sexies LE DOUBLE-CLIC ET LE PINCEMENT ARMENT AUSSI — les deux portes dérobées', () => {
  // ⛔ **DEUX CHEMINS DE ZOOM NE PASSENT PAR AUCUN `wheel` DU DOM.**
  //   · le double-clic droit verse son cran dans `dLogGlisse` image par image
  //     (`courseDoubleClic`), pas dans `surPointerMoveGeste` ;
  //   · le pincement FABRIQUE un faux événement de molette et le donne à
  //     `_zoomGesture` directement (`modes.js`) — le DOM ne le voit jamais.
  // Sans ces deux-là, un double-clic droit et un pincement d'écartement ne
  // pourraient plus sortir du crop.
  assert.match(MAIN, /intentionZoom\(pas\)/)
  const MODES = readFileSync(new URL('../src/modes.js', import.meta.url), 'utf8')
  assert.match(MODES, /this\.hooks\.intentionZoom\?\.\(m\.deltaY\)/)
  assert.match(MAIN, /intentionZoom:\s*\(deltaY\)\s*=>\s*intentionZoom\(deltaY\)/)
  // ⚠️ et le crochet est posé AVANT `_zoomGesture`, qui sort tôt sur six gardes
  assert.ok(
    MODES.indexOf('this.hooks.intentionZoom?.(m.deltaY)') < MODES.indexOf('this._zoomGesture({ deltaY: m.deltaY'),
    'le crochet est posé après la porte du zoom — il se perdrait sur ses gardes'
  )
})

test('② septies ⛔ D19 GARDE SON DOMAINE — le régime de la Terre reste au BLOC', () => {
  // ⛔ **LA RÉGRESSION LA PLUS LOURDE QUE D21 ③ POUVAIT CAUSER, ET ELLE EST
  // FERMÉE ICI.** `horsDuCrop` décide du RÉGIME DE GESTES (`regimeGeste` →
  // `regimeTerreActif` → `appliqueBoutonsSouris`, `gesteDuBouton`). Sur `pose`,
  // le vocabulaire Google Earth de D19/GE2/GE3 serait rendu à OrbitControls de
  // 600 km à 32 km — une bande de 568 km — et avec lui la DEUXIÈME SORTIE de
  // D21 ① (le clic droit y redeviendrait un PAN). D21 dit expressément qu'elle
  // n'abroge pas D19.
  assert.match(MAIN, /horsDuCrop:\s*\(\)\s*=>\s*terreUniqueBranchee\s*&&\s*!veilleCrop\?\.auBloc/)
  assert.ok(!/horsDuCrop:\s*\(\)\s*=>\s*terreUniqueBranchee\s*&&\s*!veilleCrop\?\.pose/.test(MAIN))
  // et le prédicat pur confirme que le clic droit N'EST un zoom que hors du crop
  assert.equal(gesteDuBouton({ bouton: 2, regime: REGIME.SURFACE }), GESTE.ZOOM)
  assert.equal(gesteDuBouton({ bouton: 2, regime: REGIME.CROP }), GESTE.INERTE)
  // ⚠️ **DONC, ENTRE 600 km ET 32 km, LE CLIC DROIT ZOOME ET ARME LA SORTIE ;
  // SOUS 32 km IL EST RENDU À OrbitControls (R13/GE2, mesuré).** Là, les sorties
  // restent la molette et le bouton monde — les deux qui ne dépendent pas du
  // régime de gestes. C'est écrit dans le rapport, pas déduit ici.
  assert.equal(auBloc({ altitudeEllipsoideM: 500_000, auBlocAvant: false }), false)
  assert.equal(auBloc({ altitudeEllipsoideM: 20_000, auBlocAvant: false }), true)
})

// ══════════ ③ LA NAISSANCE — D23 : RETOUR À z10, D21 ② ABROGÉ ══════════════

test('③ le crop naît à la paire z10, et PLUS au palier z7 — D21 ② abrogé', () => {
  // ⛔ **D23.** La mesure de C1 a tranché : à 600 km le crop coûtait 495 → 1 700
  // tuiles (1 700 = `CACHE_MAX_CONTINU`, le cache saturé) et 19,9 → 129,9 ms par
  // image à CPU ×4, sans que z8 ni z9 rachètent quoi que ce soit.
  assert.equal(SEUIL_NAISSANCE_M, SEUIL_BLOC_M)
  assert.ok(Math.abs(SEUIL_NAISSANCE_M - 32274.3) < 0.1)
  // le palier z7 reste dans le module, verrouillé contre sa source, mais il ne
  // porte plus aucun seuil
  const z7 = DIVE_TIERS.find((t) => t.zoom === 7)
  assert.ok(z7)
  assert.equal(z7.altM, 600_000)
  assert.equal(ALT_PALIER_Z7_M, z7.altM)
  assert.notEqual(SEUIL_NAISSANCE_M, ALT_PALIER_Z7_M)
  // et le crop naît bien à ce seuil-ci, chaîne complète posée
  const g = globeFactice()
  const v = creerVeilleCrop({ globe: g, contexte: contexteFactice(), cropAuDepart: false })
  assert.equal(v.maj(SEUIL_NAISSANCE_M + 1), false, 'né un mètre trop haut')
  assert.equal(v.maj(SEUIL_NAISSANCE_M), true, 'pas né au seuil z10')
  assert.deepEqual(g.journal.map((e) => e.quoi), ['crop', 'fond', 'parois', 'habillage', 'rampe', 'mer'])
  return v.enVol()
})

// ══════════ ④ LE DÉPARTAGE — D16 ter NE SUIT PAS LA NAISSANCE ══════════════

test('④ D23 — LE DÉPARTAGE MORD ENCORE, et c’est D21 ① qui le prouve maintenant', async () => {
  // ⚡ **CE TEST A CHANGÉ DE PREUVE, PAS DE SENS.** Sous D21 ②, les deux paires
  // étaient à 600 km et 32 km : n'importe quelle altitude entre les deux
  // séparait `pose` de `auBloc`. D23 les ramène à la MÊME valeur — et la
  // tentation est alors de croire que le départage ne sert plus à rien.
  //
  // ⛔ **Il sert toujours, parce que D21 ① reste entière** : sans intention,
  // le crop SURVIT au-dessus de `SEUIL_MORT_M` (l'inclinaison, le cap, les
  // boutons de caméra font monter l'altitude). `auBloc`, lui, n'a pas
  // d'intention et redescend à `false`. **Les deux divergent donc en vol, à la
  // même altitude, exactement comme avant.** Si `arriveeSurLeBloc` relisait
  // `repos`, la vue de trois quarts se rallumerait là — à 60 km, en vue
  // régionale, D16 ter tombe.
  const g = globeFactice()
  const v = creerVeilleCrop({
    globe: g, contexte: contexteFactice(), cropAuDepart: false, repos: creerVeilleRepos(),
  })
  // on se pose au bloc : les deux automates disent oui
  for (let i = 0; i < 200; i++) v.maj(SEUIL_BLOC_M * 0.9, 145.5)
  assert.equal(v.pose, true)
  assert.equal(v.repos, true, 'le montage du test est faux : la vue n’est pas au repos')
  assert.equal(v.auBloc, true)
  assert.equal(v.arriveeBloc, true, 'la vue de trois quarts n’arrive plus au bloc')

  // …puis on INCLINE, sans aucun geste de dézoom : l'altitude monte bien
  // au-dessus des deux seuils de mort, et les deux automates se séparent.
  for (let i = 0; i < 200; i++) v.maj(SEUIL_MORT_M * 1.5, 145.5)
  assert.equal(v.pose, true, 'le crop est mort sans intention — D21 ① tombe')
  assert.equal(v.auBloc, false, '`auBloc` a suivi le crop — les grandeurs sont refusionnées')
  assert.equal(v.arriveeBloc, false,
    'la vue de trois quarts resterait armée hors du bloc — D16 ter tombe')
  await v.enVol()
})

test('④ bis `main.js` donne `arriveeBloc` à `arriveeSurLeBloc`, pas `repos`', () => {
  assert.match(MAIN, /arriveeSurLeBloc:\s*\(\)\s*=>\s*!!veilleCrop\?\.arriveeBloc/)
  assert.ok(!/arriveeSurLeBloc:\s*\(\)\s*=>\s*!!veilleCrop\?\.repos/.test(MAIN))
})

test('④ quater LE MIROIR — le RETOUR AU NADIR part au bloc, pas à 750 km', () => {
  // ⚡ **LA MOITIÉ SYMÉTRIQUE DU DÉPARTAGE.** D16 ter écrit « NADIR, inchangé —
  // aucune bascule pendant la descente » de l'orbite jusqu'au bloc. Si la
  // bascule ARRIVE au bloc mais que son retour ne PART qu'à `SEUIL_MORT_M`
  // (750 km), l'inclinaison héritée reste posée entre 750 km et 32 km : D16 ter
  // tombe par l'autre bout. Les deux prédicats doivent lire le MÊME automate.
  assert.match(MAIN, /surLeBloc:\s*\(\)\s*=>\s*!!veilleCrop\?\.auBloc/)
  assert.ok(!/surLeBloc:\s*\(\)\s*=>\s*!!veilleCrop\?\.pose/.test(MAIN))
  // et le redressement de l'inclinaison HÉRITÉE (GE2 tour 2) lit le même
  const i = MAIN.indexOf('function redresserSiHerite(')
  assert.ok(i > 0)
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
  assert.match(corps, /veilleCrop\?\.auBloc/)
  assert.ok(!/veilleCrop\?\.pose/.test(corps))
})

test('④ ter les seuils du BLOC valent ceux d’AVANT D21, au bit près', () => {
  assert.ok(Math.abs(SEUIL_BLOC_M - 32274.3) < 0.1)
  assert.ok(Math.abs(SEUIL_BLOC_MORT_M - 40342.8) < 0.1)
  // et l'automate du bloc n'a PAS d'intention : c'est un fait géométrique
  assert.equal(auBloc({ altitudeEllipsoideM: SEUIL_BLOC_MORT_M, auBlocAvant: true }), false)
  // là où celui du crop en a une
  assert.equal(socleVisible({ altitudeEllipsoideM: SEUIL_MORT_M, visibleAvant: true, sortieArmee: false }), true)
})

// ══════════ ⑤ LES DEUX AUTOMATES PORTENT LA MÊME LOI ═══════════════════════

test('⑤ `veille-socle` (le chemin `?terre=deux`) porte la MÊME intention', () => {
  // ⚠️ Si l'un exigeait une intention et l'autre non, `?terre=deux` et
  // `?terre=unique` mourraient à deux endroits différents.
  const v = creerVeilleSocle({ appliquer: () => {}, socleAuDepart: true })
  assert.equal(v.maj(60_000_000), true, 'le socle hérité meurt sans intention')
  v.armerSortie()
  assert.equal(v.maj(60_000_000), false)
  assert.equal(v.sortieArmee, false, 'l’intention doit être consommée')
})

// ══════════ ⑥ LES RIVIÈRES SONT ÉTEINTES PAR DÉFAUT ════════════════════════

test('⑥ D21 — les rivières sont ÉTEINTES dans le look d’ouverture', () => {
  const look = JSON.parse(SHIBUSTART).look
  assert.equal(look.waterEnabled, false, 'le look d’ouverture rallume les rivières')
  // ⚠️ **L'OPTION RESTE, ET LA COUCHE RESTE** — D21 le dit expressément.
  assert.ok('waterEnabled' in look, 'la clé a été retirée au lieu d’être éteinte')
  assert.equal(look.waterOpacity, 0.9, 'l’opacité de la couche a bougé — ce n’était pas demandé')
  assert.equal(look.waterFill, true)
})

test('⑥ bis LE DÉFAUT DE `params` N’EST PAS TOUCHÉ — les liens déjà émis tiennent', () => {
  // ⚠️ **MESURÉ, ET C'EST LA RAISON DU CHOIX.** `BASE_TEMPLATE_LOOK` est capturé
  // depuis `params` AVANT que le look d'ouverture s'applique, et `share-link.js`
  // ne transmet que la DIFFÉRENCE. Basculer `params.waterEnabled` à `false`
  // ferait décoder « rivières éteintes » à tous les liens déjà émis qui
  // omettaient la clé parce qu'elle valait `true`. Éteindre le LOOK d'ouverture
  // fait exactement ce qu'Adrien demande, sans réécrire le passé.
  assert.match(MAIN, /waterEnabled:\s*true,\s*\/\/ lakes on by default/)
  assert.match(MAIN, /const BASE_TEMPLATE_LOOK = Object\.freeze\(captureLook\(params\)\)/)
})

test('⑥ ter la COUCHE et son interrupteur sont intacts', () => {
  const water = readFileSync(new URL('../src/map/water-layer.js', import.meta.url), 'utf8')
  assert.match(water, /export const OSM_MIN_ZOOM = 12/)
  assert.match(water, /params\.waterEnabled/)
  const panneau = readFileSync(new URL('../src/ui/map-panel.js', import.meta.url), 'utf8')
  assert.match(panneau, /Rivières & eau/)
  assert.match(panneau, /params\.waterEnabled = v/)
})

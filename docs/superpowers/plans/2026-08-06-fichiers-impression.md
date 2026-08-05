# Fichiers d'impression — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE : `superpowers:subagent-driven-development`. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** produire un fichier d'affiche qu'un imprimeur imprime sans jamais rappeler, et que l'acheteur reçoit conforme à ce qu'il a vu à l'écran.

**Architecture :** le rendu haute résolution se fait dans le navigateur, en **bandes de largeur pleine** plutôt qu'en tuiles carrées ; la sortie par défaut est **RGB étiqueté** dans un PDF aux boîtes explicites ; le CMJN devient une option servie avec le profil de l'imprimeur, jamais un profil deviné.

**Pile technique :** three.js, postprocessing, JavaScript ES modules, tests `node --test`.

---

## Ce que deux campagnes de recherche ont établi, et qui pilote ce plan

Un agent a dépouillé le MediaStandard Print 2018 du bvdm et les spécifications publiées des prestataires d'impression à la demande. Un autre a lu le code de ShibuMap, celui de `postprocessing`, celui de `pdf-lib`, et mesuré les budgets mémoire. **Ne re-cherchez pas ces points, ils sont acquis :**

| Fait établi | Conséquence pour ce plan |
|---|---|
| Les prestataires d'impression à la demande **demandent du RGB** ; leurs presses ont plus de quatre encres | La sortie par défaut est RGB, pas CMJN |
| Convertir en CMJN est **destructif et irréversible** | On ne sépare jamais sans le profil du destinataire |
| **300 dpi est un plafond de trame, pas une règle** ; le grand format se raisonne en distance de lecture | 300 dpi jusqu'à A2, 250 en A1, 180 en A0 |
| **Ghostscript est sous AGPL** | Voie fermée sans licence commerciale. Ne pas l'envisager |
| **Aucun validateur PDF/X libre n'existe** | La conformité PDF/X reste une intention tant qu'un préflight professionnel ne l'a pas confirmée |
| Le fond perdu et les repères **ne se superposent jamais** si le décalage des repères ≥ le fond perdu | Le problème « traits invisibles sur fond sombre » est un artefact de réglage |
| La gestion des couleurs amont de ShibuMap **est propre et vérifiée** | Rien à refaire de ce côté |

---

## Les quatre défauts qui produiraient une affiche cassée

Ils sont le cœur de la phase A. Chacun produit un fichier **techniquement valide** que l'imprimeur imprimerait sans broncher, et dont l'acheteur se plaindrait.

**1. Le vignettage détruit l'image en rendu tuilé.** `VignetteEffect` calcule `distance(uv, centre)` où `uv` court de 0 à 1 **sur la cible de rendu**. Chaque tuile étant une cible, **chacune reçoit son vignettage complet** : l'affiche sort en damier de rectangles assombris. Ce n'est pas une couture, c'est l'image perdue.

**2. Le grain se répète à l'identique.** `NoiseEffect` fait `rand(uv * (1.0 + time))`, avec le même `uv` par tuile et un `time` gelé pendant l'export : le même motif dans chaque tuile, formant une grille.

**3. Le cadrage de l'acheteur est écrasé en silence.** `cadrerAffiche()` (`src/main.js:6912`) utilise **déjà** `camera.setViewOffset(...)` pour porter le décalage composé au pouce par l'utilisateur. `cadrageTuile()` (`src/print-page.js`) rend un jeu d'arguments **complet et concurrent**. Le second appel écrase le premier : affiche correctement tuilée, **recentrée**, composition perdue sans le moindre signal.

**4. La profondeur de champ est verrouillée à 720 px.** `ensureDof()` (`src/main.js:1999`) construit l'effet avec `height: 720`, qui fixe les cibles internes **quelle que soit la sortie**. Sur 8 339 px de haut, le flou est calculé en petit puis agrandi onze fois. Ce n'est pas un défaut de tuilage : c'est un plafond déjà présent.

---

## Le mensonge à corriger

`ligneVerite()` (`src/ui/affiche.js`) **annonce « 300 dpi » à l'acheteur**. C'est vrai du fichier et faux de l'image :

- la mosaïque aérienne couvre tout le bloc en 4 096 texels → **≈ 208 dpi effectifs** sur 500 mm ;
- le maillage du relief plafonne à `res 768` → un quad fait ~7,8 px sur le tirage, arêtes facettées visibles sur les crêtes ;
- les étiquettes sont cuites à **88 px de corps** (`makeLabelTexture`, `src/map/text-label.js`) → noms de villes flous.

**Soit on corrige les trois amonts, soit on cesse de promettre 300 dpi.** Ne pas trancher, c'est programmer un remboursement.

---

## Contraintes globales

1. **Rien de ce plan ne déploie.** Le déploiement est une décision d'Adrien.
2. **Ne touchez pas à la gestion des couleurs amont** (`renderer.outputColorSpace`, classement sRGB/NoColorSpace des textures). Elle est vérifiée correcte.
3. **Ne touchez pas aux fonctions de paiement** (`netlify/functions/paiement*.mjs`) : vérification de signature, idempotence, ordre d'écriture. Un audit les a validées.
4. **N'envisagez jamais Ghostscript** — AGPL, incompatible avec un service en ligne fermé.
5. `package.json` liste les tests **un par un** ; tout fichier ajouté doit y figurer, audit disque-vs-liste à l'appui.
6. **Deux tests d'architecture existent** (réglages de matière du terrain, restitution du cadrage caméra). S'ils rougissent, ils vous ont attrapé — n'ajoutez pas d'exception sans justification.
7. Français dans les commentaires et les nouveaux symboles.
8. Un commit par tâche, message en français.

---

## Structure des fichiers

**Créés**
- `src/export-effets.js` — pur. Quels effets survivent au rendu par bandes, et lesquels doivent être neutralisés ou réappliqués après coup.
- `src/export-cadrage.js` — pur. Composition du décalage de l'acheteur avec celui de la bande.
- `src/pdf-affiche.js` — construction du PDF : boîtes, fond perdu, repères, étiquetage.
- `src/mockup-mur.js` — pur. Calibration d'échelle d'une photo de pièce et pose du cadre.
- les tests correspondants.

**Modifiés**
- `src/export.js` — chemin par bandes au lieu du mono-canevas.
- `src/main.js` — composition des décalages, recuisson des étiquettes.
- `src/ui/affiche.js` — écran de validation, échelle, mockup, vérité sur la résolution.
- `src/print-page.js` — bandes plutôt que tuiles carrées, si la mesure le confirme.

---

# PHASE A — Le rendu qui ne casse pas

Nécessaire que ShibuMap vende un fichier **ou** une impression. À faire en premier.

## Tâche 1 : quels effets survivent au rendu par bandes

**Fichiers :** créer `src/export-effets.js` et `test/export-effets.test.js` ; modifier `package.json`.

**Produit :** `effetsSurs(chaine)` → `{ gardes: [...], neutralises: [...], aReappliquer: [...] }`, et `raisonNeutralisation(nom)` → chaîne explicative.

**Le classement à établir, et il doit être justifié dans le code, effet par effet :**

*Sûrs* (opèrent par pixel, sans voisinage) : exposition, mappage tonal ACES, teinte/saturation, luminosité/contraste.

*À neutraliser pendant l'export* : le vignettage et le grain, pour les raisons ci-dessus. **Le vignettage doit être réappliqué une fois sur l'image entière** — sinon on change l'aspect de l'affiche, ce qui est un autre défaut. Le grain, lui, doit être réappliqué **à une échelle choisie** : un grain par pixel à 300 dpi est invisible et ne fait qu'alourdir le fichier.

*Demandant un recouvrement* : l'anticrénelage SMAA et le bokeh, qui lisent le voisinage. Au bord d'une bande, ce voisinage est le bord de l'image.

*À signaler* : l'occlusion ambiante, éteinte par défaut mais activable à la main, avec un rayon en unités monde qui produit une discontinuité d'ombrage au bord de bande.

- [ ] **Étape 1 :** écrire les tests, y compris un test qui **échoue si un effet nouveau apparaît dans la chaîne sans être classé** — c'est la propriété qui compte, pas la liste d'aujourd'hui.
- [ ] **Étape 2 :** les lancer, vérifier le rouge.
- [ ] **Étape 3 :** écrire le module.
- [ ] **Étape 4 :** vert, puis `npm test` en entier.
- [ ] **Étape 5 :** commit.

## Tâche 2 : composer les deux décalages de cadrage

**Fichiers :** créer `src/export-cadrage.js` et son test ; modifier `src/main.js`.

**Produit :** `composeDecalage(acheteur, bande)` → le jeu d'arguments unique de `setViewOffset`.

⚠️ **C'est le défaut le plus sournois du dossier** : il ne casse rien visiblement, il livre une composition qui n'est pas celle que l'acheteur a validée.

- [ ] **Étape 1 :** écrire d'abord le test qui **démontre le défaut actuel** — deux appels successifs, le second écrase le premier. Il doit échouer avec le code d'aujourd'hui.
- [ ] **Étape 2 :** écrire la composition, et vérifier par mutation qu'un test meurt si l'un des deux décalages est ignoré.
- [ ] **Étape 3 :** brancher dans `main.js`, un seul appel.
- [ ] **Étape 4 :** `npm test`, commit.

## Tâche 3 : le rendu par bandes de largeur pleine

**Fichiers :** modifier `src/export.js`, `src/print-page.js` ; tests.

**Pourquoi des bandes et pas des tuiles carrées.** La largeur maximale du catalogue (7 276 px pour le 61 × 91) passe sous les 8 192 de `MAX_RENDERBUFFER_SIZE` sur la plupart des cartes. Rendre des bandes de largeur pleine **supprime toutes les coutures verticales**, et permet de pousser les lignes dans un encodeur en flux sans jamais allouer un canevas pleine taille — ce qui contourne la limite de Safari (16,8 Mpx, dépassée dès le format 30 × 40).

⚠️ **`planTuiles`, `cadrageTuile` et `poidsRendu` existent, sont testés, et ne sont appelés que par leur propre test.** Le tuilage est spécifié, pas branché. Vérifiez si le passage en bandes demande de les modifier ou seulement de les paramétrer — et **si vous les modifiez, leur propriété non négociable doit tenir** : la somme des bandes retombe exactement sur la taille pleine.

- [ ] **Étape 1 :** mesurer. Combien de bandes, quelle hauteur, quel pic mémoire, sur les huit formats du catalogue. **Committez le script de mesure.**
- [ ] **Étape 2 :** les tests, dont un qui vérifie l'absence de couture sur une scène de contrôle.
- [ ] **Étape 3 :** l'implémentation.
- [ ] **Étape 4 :** vérifier sur les trois formats extrêmes, `npm test`, commit.

## Tâche 4 : le recouvrement pour SMAA et le bokeh

**Fichiers :** `src/export-effets.js`, `src/export.js`, tests.

Chaque bande est rendue avec quelques pixels de marge, puis rognée. La marge doit être **au moins le rayon du plus large des effets à voisinage**.

- [ ] **Étape 1 :** établir le rayon nécessaire par effet, en le lisant dans le code de `postprocessing`, pas en le devinant. Écrire le chiffre et sa source.
- [ ] **Étape 2 :** test qui échoue si la marge devient inférieure au rayon.
- [ ] **Étape 3 :** implémenter, vérifier l'absence de couture.
- [ ] **Étape 4 :** commit.

## Tâche 5 : dire la vérité sur la résolution

**Fichiers :** `src/map/text-label.js`, `src/ui/affiche.js`, tests.

Trois amonts plafonnent sous les 300 dpi annoncés. **Traitez-les dans cet ordre de rentabilité :**

1. **Les étiquettes** — cuites à 88 px de corps. Les recuire à la résolution d'impression est le gain le plus visible pour le moins d'effort. Mesurez le coût mémoire de la recuisson.
2. **`ligneVerite()`** — doit annoncer la résolution **réelle** du format choisi, pas 300 en dur.
3. **La mosaïque aérienne et le maillage** — documentez leur plafond dans le code. Ne les changez pas dans cette tâche : c'est un autre chantier, et le mesurer suffit à cesser de mentir.

- [ ] Étapes : mesure → tests → implémentation → commit.

---

# PHASE B — L'emballage et la livraison

## Tâche 6 : étiqueter la sortie

L'image exportée n'est **pas étiquetée** — ni profil en PNG, ni marqueur en JPEG. Un fichier sRGB non étiqueté sera *supposé* sRGB. Une chaîne d'impression ne repose pas sur une supposition.

- [ ] Incorporer le profil, tester que l'étiquette est présente et correcte.

## Tâche 7 : le PDF et ses boîtes

**Fichiers :** créer `src/pdf-affiche.js` et son test.

**Les trois nombres qui règlent le problème des repères invisibles :** fond perdu **5 mm**, décalage des repères **≥ 5 mm**, marge de la boîte support **≈ 15 mm** au-delà du format fini. Les repères se posent alors sur du papier nu, quel que soit le fond de l'affiche.

**Les boîtes :** `TrimBox` = format fini exact, `BleedBox` = TrimBox + 5 mm, `MediaBox` = TrimBox + 15 mm, centrées. Épaisseur des repères : **0,1 mm maximum**.

⚠️ **Par défaut, pas de repères du tout** pour le flux d'impression à la demande : ces prestataires travaillent à partir des boîtes et des gabarits, les repères y sont au mieux inutiles.

⚠️ **Le piège du JPEG CMJN, si vous y venez un jour :** `pdf-lib` applique **inconditionnellement** un tableau de décodage inversé à tout JPEG à quatre canaux (convention Adobe). Un encodeur qui ne s'y conforme pas produit une affiche **en négatif**, sans qu'aucune interface ne prévienne.

- [ ] Étapes : tests des boîtes → implémentation → vérification qu'un lecteur PDF lit bien les boîtes attendues → commit.

## Tâche 8 : la livraison

⚠️ **Netlify Blobs n'expose aucune URL publique ni signée.** Un PDF de 30 à 50 Mo devrait repasser par une fonction pour atteindre l'acheteur, et buterait sur la limite de charge utile.

- [ ] **Étape 1 :** établir l'option retenue et **pourquoi**, avec ses coûts. Ne pas implémenter avant d'avoir écrit cette décision.
- [ ] **Étape 2 :** implémenter, avec expiration du lien.
- [ ] **Étape 3 :** brancher dans le courriel que le webhook envoie déjà.

---

# PHASE C — Ce que l'acheteur voit avant d'envoyer

## Tâche 9 : l'écran de validation avec échelle

**C'est la meilleure protection contre les retours**, pas un confort. Un imprimeur rappelle aussi quand le client découvre après coup que son titre est coupé ou qu'il s'est trompé de format.

- [ ] Le visuel final, une **règle graduée** à côté, et la **zone de fond perdu visible** — pour que l'acheteur voie ce qui sera coupé.

## Tâche 10 : le mockup mural à l'échelle

**Fichiers :** créer `src/mockup-mur.js` et son test.

Neuf images de salon sont fournies dans le Drive d'Adrien. ⚠️ **Elles sont générées par IA : elles n'ont aucune dimension réelle.** Un canapé dessiné peut faire 180 ou 240 cm, et la perspective peut être incohérente d'un bout à l'autre.

**La règle de calibration, non négociable :** ne pas calibrer sur le canapé, mais sur les repères que la réalité contraint le plus — hauteur sous plafond, hauteur de porte, hauteur d'assise, hauteur de prise. Puis **croiser plusieurs repères dans la même image**. S'ils s'accordent, l'échelle est fiable. **S'ils divergent, l'image est écartée**, quitte à n'en garder que trois sur neuf.

Un mockup qui ment est pire que pas de mockup.

- [ ] **Étape 1 :** module pur de calibration, avec le test qui **rejette** une image dont les repères se contredisent.
- [ ] **Étape 2 :** examiner les neuf images, mesurer, dire lesquelles passent.
- [ ] **Étape 3 :** pose du cadre à l'échelle vraie.

---

## Auto-revue

**Ce que ce plan ne couvre pas, délibérément :** la conversion CMJN et le PDF/X strict, qui dépendent de la réponse des prestataires d'impression ; la correction de la mosaïque aérienne et du maillage, qui sont un autre chantier.

**Le point le plus risqué :** la conformité PDF/X ne sera pas prouvée par ce plan. Aucun validateur libre n'existe. Tant qu'un fichier n'a pas passé un préflight professionnel réel, la conformité reste une intention — **et le plan doit le dire à Adrien plutôt que de le laisser croire acquis**.

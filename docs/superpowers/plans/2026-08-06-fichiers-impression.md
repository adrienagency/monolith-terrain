# Fichiers d'impression — plan d'implémentation

> **Pour les agents :** SOUS-COMPÉTENCE REQUISE : `superpowers:subagent-driven-development`. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** produire un fichier d'affiche qu'un imprimeur imprime sans jamais rappeler, et que l'acheteur reçoit **identique à ce qu'il a validé**.

**Architecture :** pavage à deux dimensions en tuiles de **2048**, toujours ; composition **bande par bande**, jamais d'image pleine en mémoire ; sortie **RGB étiqueté** ; et — c'est la clé — **le dernier écran avant paiement est produit par le compositeur d'export lui-même**, donc l'acheteur valide le fichier et non une maquette.

**Pile technique :** three.js, postprocessing, JavaScript ES modules, tests `node --test`.

---

## Ce qui est acquis — ne le re-cherchez pas

Deux campagnes de recherche, un agent attaquant et un agent correcteur ont établi ceci. **C'est du travail vérifié, pas des hypothèses.**

**Sur l'imprimeur :** les prestataires d'impression à la demande **demandent du RGB** (presses à plus de quatre encres) ; convertir en CMJN est **destructif et irréversible** ; 300 dpi est un **plafond de trame**, pas une règle, et le grand format se raisonne en distance de lecture ; **Ghostscript est AGPL**, voie fermée ; **aucun validateur PDF/X libre n'existe**.

**Sur le code :** la gestion des couleurs amont est **propre et vérifiée** ; la chaîne d'effets est **complète** (rien d'oublié) ; le mappage tonal ACES est **bien inoffensif** en rendu par morceaux ; `planTuiles` / `cadrageTuile` / `poidsRendu` existent, sont testés, et **ne sont appelés que par leur propre test**.

**Le chiffre qui structure tout :** **2048 est le plancher garanti de WebGL2.** Aucune machine ne descend en dessous. En pavant à 2048, la détection matérielle devient inutile.

---

## Les six défauts établis, et ce qu'ils produisent

Chacun livre un fichier **techniquement valide** que l'imprimeur imprimerait sans broncher.

| # | Défaut | Ce que reçoit le client | Preuve |
|---|---|---|---|
| 1 | **Le format par défaut dépasse le plafond matériel** — 50 × 70 paysage demande 8 339 px, la limite courante est 8 192, et le rabotage est **silencieux** | 13 mm de papier nu sur un bord, 1,8 % d'écrasement | `src/ui/affiche.js:81,87` ; `src/export.js:19-29` (aucun plafond) |
| 2 | **Le cartouche et le logo ne sont pas des pixels rendus** — ce sont des éléments d'interface empilés | Une carte nue, sans titre ni logo, payée 19 € | `src/ui/affiche.js:133` |
| 3 | **Le vignettage détruit l'image** en rendu par morceaux : chaque tuile reçoit le sien | Un damier de rectangles assombris | `VignetteEffect`, `uv` relatif à la cible |
| 4 | **Le cadrage de l'acheteur est écrasé** — deux `setViewOffset` concurrents, plus `camera.aspect` réécrit | Une composition qui n'est pas la sienne | `src/main.js:6912` ; `src/export.js:27-28` |
| 5 | **Les traits deviennent des cheveux** sur les segments horizontaux seulement | Fleuves et tracé en peigne | `LineMaterial.js:217-228` ; `src/gpx.js:1168` |
| 6 | **Le grain se répète** à l'identique par tuile | Une grille visible | `NoiseEffect`, `rand(uv * time)` |

Et un mensonge : `ligneVerite()` **promet 300 dpi** là où la mosaïque aérienne plafonne à ~208 effectifs et les étiquettes sont cuites à 88 px de corps.

---

## Les décisions prises, et par qui

**Par Adrien :**
- **Dégrader avant de cacher.** Sur une machine faible, on baisse la résolution du format demandé plutôt que de le retirer. On ne le cache que si même dégradé il ne passe pas. *(Sa formulation : « ok pour abaisser un peu la qualité […] On peut aussi cacher certains formats. »)*
- Rendre **avant** d'encaisser.
- Dire la vérité sur la résolution.

**Par l'agent correcteur, sur mesure :**
- Pavage 2D à 2048 **toujours**, la bande pleine largeur devenant le cas à une colonne.
- Échelle de dpi : **300 jusqu'au A2, 250 sur le 50 × 70, 200 sur le 61 × 91** — ce qui dépasse déjà la source, la mosaïque plafonnant à ~208.
- **Fond perdu : garder 3 mm.** Les 5 mm du plan précédent étaient le décalage des **repères**, pas le débord. Monter `MARGE_SECURITE_MM` de 5 à 8.

---

## Contraintes globales

1. **Rien ne déploie.** Le déploiement est une décision d'Adrien.
2. **Ne touchez pas** à la gestion des couleurs amont, ni aux fonctions de paiement (signature, idempotence, ordre d'écriture — audit favorable).
3. **N'envisagez jamais Ghostscript** (AGPL).
4. ⚠️ **`applySize` est partagé avec l'enregistreur vidéo.** Toute modification doit le laisser strictement inchangé quand l'appelant ne passe rien de nouveau.
5. `package.json` liste les tests **un par un** ; audit disque-vs-liste après tout ajout.
6. **Deux tests d'architecture existent.** S'ils rougissent, ils vous ont attrapé.
7. Français dans les commentaires et les nouveaux symboles. Un commit par tâche.

---

## Structure des fichiers

**Créés :** `src/export-effets.js` (quels effets survivent), `src/export-dpi.js` (l'échelle de résolution et la dégradation), `src/compositeur-affiche.js` (cartouche, logo, attribution en canevas), `src/mockup-mur.js` (calibration et pose du cadre), plus leurs tests.

**Modifiés :** `src/export.js` (pavage, plafond, aspect), `src/main.js` (composition des décalages, épaisseur des lignes), `src/ui/affiche.js` (aperçu par le compositeur, sonde, vérité sur le dpi), `src/print-page.js` (`MARGE_SECURITE_MM`).

---

# PHASE A — Le rendu qui ne casse pas

## Tâche 1 : l'échelle de résolution et la dégradation

**Créer** `src/export-dpi.js` + test. **Produit :** `dpiPour(format, orientation)` et `degradePour(format, orientation, limiteMaterielle)` → `{ dpi, px, tuiles } | null` (null = même dégradé, ça ne passe pas).

**La table de référence**, établie par mesure sur les **sept** formats de `src/print-page.js:53-61` (attention : sept, pas huit) dans les **deux orientations**, fond perdu de 3 mm compris :

| format | dpi | px | tuiles |
|---|---|---|---|
| a4 | 300 | 3579×2552 | 4 |
| 30x40 | 300 | 4796×3615 | 6 |
| a3 | 300 | 5032×3579 | 6 |
| 40x50 | 300 | 5977×4796 | 9 |
| a2 | 300 | 7087×5032 | 12 |
| 50x70 | **250** | 6949×4981 | 12 |
| 61x91 | **200** | 7245×4851 | 12 |

**La règle de dégradation, dans cet ordre :** garder le format et **baisser le dpi** jusqu'à passer ; ne retirer le format de la grille **que** si même le plancher ne passe pas. Fixez ce plancher et **justifiez-le** — en dessous d'une certaine densité, l'affiche n'est plus vendable, et livrer une bouillie est pire que refuser.

- [ ] Tests d'abord, dont un qui **échoue si un format nouveau apparaît sans entrée dans la table**.
- [ ] Rouge vérifié, puis le module, puis vert, puis `npm test`, puis commit.

## Tâche 2 : le plafond et l'aspect dans `export.js`

**Modifier** `src/export.js`. Deux défauts au même endroit.

`applySize` (`:19-29`) appelle `composer.setSize` **sans plafond** — le garde-fou de `src/viewport.js:164,298-300` n'est pas sur ce chemin. Et il écrase `camera.aspect` avec celui de la tuile, alors que `setViewOffset` attend celui de l'**affiche entière** (three construit le frustum complet depuis `aspect`, puis y découpe la fenêtre).

**La signature qui règle les deux :** `applySize(ctx, w, h, aspect = safeAspect(w, h))`. L'enregistreur vidéo ne passe rien → **strictement inchangé**. Le chemin d'export passe l'aspect de l'affiche.

- [ ] Un test qui **prouve que la vidéo est inchangée** (même sortie qu'avant sur le chemin sans argument).
- [ ] Un test qui échoue si le plafond disparaît.

## Tâche 3 : composer les deux décalages de cadrage

**Créer** `src/export-cadrage.js` + test ; **modifier** `src/main.js`.

⚠️ **Ce n'est pas une addition.** `cadrerAffiche()` raisonne sur une largeur virtuelle de 10 000 ; le pavage raisonne en pixels réels. La composition est `offsetX = c.x·Wt/2`, `offsetY = c.y·Ht/2 + yTuile`, `width = Wt`, `height = hTuile` — une addition **après remise à l'échelle**. L'agent correcteur a vérifié que c'est mathématiquement fondé.

- [ ] Écrire d'abord le test qui **démontre le défaut actuel** (le second appel écrase le premier), et le voir échouer.
- [ ] Vérifier par mutation qu'un test meurt si l'un des deux décalages est ignoré.

## Tâche 4 : les effets qui ne survivent pas au pavage

**Créer** `src/export-effets.js` + test.

*Sûrs :* exposition, ACES, teinte/saturation, contraste. *À neutraliser puis **réappliquer une fois sur l'image entière** :* vignettage et grain — les neutraliser sans les réappliquer changerait l'aspect de l'affiche, ce qui est un autre défaut. Le grain doit être réappliqué **à une échelle choisie** : un grain par pixel à 300 dpi est invisible et alourdit le fichier.

⚠️ *Demandant un recouvrement :* SMAA et le bokeh. **Le rayon du bokeh en pixels d'affiche dépend de la hauteur de tuile** (l'effet est verrouillé à 720 px de haut, `src/main.js:2060`) — la marge n'est donc **pas une constante**. Établissez-la en lisant le code de `postprocessing`, pas en la devinant.

- [ ] Un test qui **échoue si un effet nouveau apparaît dans la chaîne sans être classé** — c'est la propriété qui compte, pas la liste d'aujourd'hui.

## Tâche 5 : l'épaisseur des traits

**Modifier** `src/main.js`, `src/gpx.js`, `src/map/water-layer.js`.

`LineMaterial` ajoute son épaisseur en espace **clip**, hors de la matrice de projection : le décalage de tuile ne la corrige pas. Et `resolution` est figée à la taille de la fenêtre, remise à jour uniquement par `onResize` que l'export n'appelle jamais.

**Les deux gestes, tous deux nécessaires :** `resolution = (tuile.w, tuile.h)` — obligatoire pour que `offset.x /= aspect` reste isotrope — **et** `linewidth = épaisseurRelative × hauteur_totale_affiche`, sans quoi un trait de 2 px fait 0,17 mm à 300 dpi.

⚠️ **L'aperçu ment déjà** (résolution = fenêtre). Corrigez-le aussi, sinon l'écran et le fichier divergeront.

- [ ] Restaurer l'état après export. Test de non-régression sur l'affichage normal.

## Tâche 6 : brancher le pavage

**Modifier** `src/export.js`. `planTuiles` et `cadrageTuile` existent et sont testés — **appelez-les, ne les réécrivez pas**. Leur propriété non négociable (la somme des tuiles retombe exactement sur la taille pleine) doit tenir.

**Composition bande par bande, jamais d'image pleine :** le canevas de composition reste sous 11,9 Mpx partout, contre 16,7 admis par iOS — 29 % de marge. Le pic mémoire tombe à 226 Mo au lieu de 1 141.

- [ ] **Mesurer d'abord** : nombre de tuiles, pic mémoire, durée, sur les sept formats × deux orientations. **Committez le script.**
- [ ] Test d'absence de couture sur une scène de contrôle.

---

# PHASE B — Ce que l'acheteur voit et reçoit

## Tâche 7 : le compositeur, et la fidélité par construction

**Créer** `src/compositeur-affiche.js` + test.

Le cartouche, le logo et l'attribution sont dessinés en canevas 2D, **en fractions de largeur de feuille**. Bonne nouvelle vérifiée : le CSS est **déjà entièrement en `cqw`** (`affiche.css:146,157,493`) — le module relit les mêmes fractions. Même police via `document.fonts.ready`, `ctx.letterSpacing`, dégradé du `::before` en `createLinearGradient`.

**⚠️ Le point qui décide de tout, et ce n'est pas une technique :** **le dernier écran avant paiement doit être produit par ce compositeur-là**, réduit à 1 100 px — pas par le DOM. L'acheteur valide alors le fichier, pas une maquette, et l'écart **cesse d'exister par construction**. Le DOM reste pour l'édition interactive.

Ce module absorbe aussi `stampCredit`, dont le canevas pleine taille échoue **en silence** sur iOS (`catch { return blob }`, `src/export.js:74-94`), et c'est le seul endroit où brancher `creditFor` — `src/export.js:64` porte un avertissement en rouge : sans lui, **vendre viole la licence** des sources bathymétriques.

- [ ] Test de fidélité : le compositeur et le DOM produisent la même mise en page aux mêmes fractions.

## Tâche 8 : rendre avant d'encaisser, et la sonde

**Modifier** `src/ui/affiche.js`.

Le clic lance le rendu pavé avec progression, **puis** ouvre Stripe. La classe d'échec « il a payé, ça a raté » disparaît.

Une **sonde** à l'ouverture de l'écran (allouer une cible 2048², un canevas de bande, relire un pixel — une image) détermine ce que la machine peut faire. **Dégrader d'abord, cacher ensuite** (décision d'Adrien).

- [ ] Progression visible. Annulation possible. Test de la sonde sur des limites simulées.

## Tâche 9 : le PDF et ses boîtes

**Créer** `src/pdf-affiche.js` + test.

`TrimBox` = format fini exact, `BleedBox` = TrimBox + **3 mm**, `MediaBox` = TrimBox + marge suffisante pour les repères. **Pas de repères par défaut** (les prestataires travaillent aux boîtes). Si repères : décalage ≥ fond perdu, épaisseur 0,1 mm — ils se posent alors sur du papier nu, ce qui **règle le problème du fond sombre**.

⚠️ **Si un jour vous embarquez un JPEG CMJN** : `pdf-lib` applique **inconditionnellement** un décodage inversé aux images à quatre canaux (convention Adobe). Un encodeur non conforme produit une affiche **en négatif**, sans avertissement.

⚠️ **Dites à Adrien dans le rapport que la conformité PDF/X n'est pas prouvée** — aucun validateur libre n'existe. Tant qu'un préflight professionnel ne l'a pas confirmée, c'est une intention.

## Tâche 10 : la livraison

⚠️ **Netlify Blobs n'expose aucune URL publique ni signée.** Et la composition ne part pas au serveur aujourd'hui : `metadata.retour` ne porte qu'un identifiant de 12 caractères, l'affiche n'existe que dans le stockage de session de l'acheteur.

- [ ] **Écrire la décision et son coût avant d'implémenter.** Lien à expiration, branché dans le courriel que le webhook envoie déjà.

---

# PHASE C — Le mockup

## Tâche 11 : le mur à l'échelle

**Créer** `src/mockup-mur.js` + test. Neuf images de salon dans le Drive d'Adrien.

⚠️ **Elles sont générées par IA : aucune dimension réelle.** Un canapé dessiné peut faire 180 ou 240 cm, et la perspective peut être incohérente d'un bout à l'autre.

**La règle :** calibrer sur les repères que la réalité contraint le plus — hauteur sous plafond, porte, assise, prise — puis **croiser plusieurs repères dans la même image**. S'ils s'accordent, l'échelle tient. **S'ils divergent au-delà d'un seuil que vous devez fixer et justifier, l'image est écartée**, quitte à n'en garder que trois sur neuf.

Un mockup qui ment est pire que pas de mockup.

---

## Ce que ce plan ne couvre pas, délibérément

La conversion CMJN et le PDF/X strict (dépendent de la réponse des prestataires) ; la mosaïque aérienne et le maillage, dont le plafond sera **documenté** et non corrigé.

**Le risque assumé :** la conformité PDF/X ne sera pas prouvée par ce plan.

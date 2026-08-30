# Tâche J — constats ouverts, tour 1

Source : `relecture-J.md`. **Ton code tient et D5 est pleinement respectée** — les trois
fichiers interdits sont intouchés et le défaut `aussi: null` est **bit à bit**, confirmé par
le code ET par un test. **Chaque chiffre de ton rapport concorde exactement avec ton JSON
brut.** Ce qui revient tient en trois points.

## ⛔ CRITIQUE — « la texture que le GPU LIT dit la même chose » est sans fondement

Tu écris que la vérification de bathymétrie a été confirmée **côté GPU**. Le relecteur a
cherché ce chemin et ne l'a pas trouvé :

- `champ.texture` est une `THREE.DataTexture` bâtie **directement sur le même `Uint16Array`**
  que ton calcul JS de couverture. **Aucun clone.**
- **Aucun chemin de relecture GPU indépendant n'existe** dans ce qu'expose `__exp` ; l'unique
  `readRenderTargetPixels` du dépôt sert une sonde matérielle sans rapport.
- « Décodé à la main dans la page » signifie donc presque certainement **relire
  `texture.image.data`** — le même tableau.

⚠️ **Le correctif, lui, n'est pas en cause** : les captures le corroborent. **C'est
l'affirmation de vérification qui ne tient pas.**

**Ce qu'on attend :** soit tu **étayes** (montre le chemin qui lit vraiment côté GPU — un
`readRenderTargetPixels` sur un rendu qui échantillonne la texture, par exemple), soit tu
**retires l'affirmation** et tu dis ce que ta mesure prouve réellement : que le tableau
source est bon, ce qui est déjà beaucoup.

⚠️ **Précédent du chantier :** la Tâche C a retiré **deux** chiffres-titres de sa propre
initiative, et c'est ce qui a rendu son rapport crédible. **Un chiffre retiré vaut mieux
qu'un chiffre faux.**

## ⚠️ IMPORTANT — une mutation du relecteur survit, et c'est un vrai trou

Retirer la **remise de priorité entre tuiles de bloc et tuiles de mer** dans la file
(`src/monde/flux-terrain.js:458`, `9e8` contre `1e9`) **ne casse aucun test**.

C'est un comportement **voulu et commenté**, avec **zéro couverture**, et il n'était pas dans
tes 20 mutations. **Couvre-le.**

## ⚠️ IMPORTANT — ton banc n'est pas auditable depuis le dépôt

Le script de mutation et le protocole de capture vivent dans **un scratchpad personnel
inaccessible**. Le « 20/20 tué » est donc **le seul chiffre de ton rapport qu'on ne peut pas
refaire**, alors que tous les autres remontent à `J-releves-bruts.json`.

**Convention du chantier : les bancs restent dans `.banc/`** (ignoré par git, mais sur le
disque). ⚠️ **Ce n'est pas une formalité : c'est parce que deux bancs étaient restés sur le
disque qu'on a pu trancher le désaccord de la Tâche D — où l'implémenteur avait raison contre
son relecteur.** Déplace-les.

## Les deux mineurs sont différés, ne t'en occupe pas.

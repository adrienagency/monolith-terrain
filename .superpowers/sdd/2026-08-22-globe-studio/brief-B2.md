# B2 — LES SOURCES : océan fin, et la bathymétrie des LACS

Arbre : `C:\Dev\wt-bat2` · branche `bathy-sources`. Serveur : port libre **> 6100**.
**Lis d'abord `socle-bathy.md`** (même dossier), puis **`src/bathy-sources.js`
en entier** — la cascade existe déjà, avec sa doctrine écrite ; ta tâche est de
l'étendre, pas de la réinventer.

## LA DEMANDE

> **Adrien :** *« Fais en sorte que toute la zone sous-marine soit le plus juste
> possible. Si tu peux, ajoute une source de bathymétrie des lacs (fonds des
> lacs) **si ça n'implique pas de refondre totalement le relief des tuiles
> existantes**. »*

Et la règle déjà inscrite dans `bathy-sources.js` : *« à chaque fois qu'on a une
map mieux définie, on l'utilise ; à défaut, on laisse GEBCO en soutien. »*
Traduit : **un seul nombre par endroit du monde, le plafond de zoom bathy**, et
**nulle part il ne descend**.

## ⛔ LA CONTRAINTE QUI DÉCIDE DE TOUT

**Le site est 100 % statique (Netlify).** Personne ne peut répondre « as-tu du
fin ici ? » à l'exécution. Toute source doit donc être :
- soit **pré-cuite en tuiles** dans `public/data/bathy/` avec une entrée dans
  `index.json` (le motif existant, `normalizeIndex` / `tileMaxZoom`) ;
- soit servie par une **URL de tuiles publique, stable et autorisée**.

⚠️ **Et « sans refondre le relief des tuiles existantes »** : `fuseBathymetry`
ne touche au relief que **sous le niveau de la mer** — la terre passe telle
quelle, c'est structurel et documenté. Vérifie que c'est bien vrai avant de t'y
fier, et dis-le avec la ligne.

## ① LES LACS — le cœur de ta tâche

Les grands lacs ne sont **pas** dans GEBCO (qui est marine). Cherche, compare,
et tranche entre au moins :
- **HydroLAKES / GLOBathy** (profondeur modélisée par lac, ~1,4 M de lacs) —
  attention : *modélisée*, pas mesurée ; utile pour une forme plausible, pas
  pour une vérité ;
- **NOAA / NCEI Bathymetric Data Viewer** — les Grands Lacs américains, mesurés,
  haute résolution ;
- **Swisstopo** (Léman, lacs suisses), **IGN / SHOM**, et les instituts
  nationaux équivalents ;
- **ETOPO 2022** — inclut le fond de certains lacs majeurs ;
- toute source régionale que tu trouveras (Baïkal, Tanganyika, Grands Lacs
  africains).

Pour chacune : **résolution native, couverture, licence exacte, attribution
exigée, URL, format, et poids** si elle doit être cuite. ⛔ **La licence n'est
pas un détail** : ce dépôt vend des cartes, et la question ODbL « conserver et
redistribuer » est déjà ouverte. Une source non redistribuable est à écarter,
**en le disant**.

**Rends une recommandation classée**, avec pour la première : le plafond de zoom
à inscrire, l'entrée `index.json` à écrire, le crédit à ajouter à
`creditsForBounds`, et **le coût en octets** de la cuisson.

## ② L'OCÉAN — la cascade est-elle à jour ?

GEBCO_2026, EMODnet, BlueTopo, Copernicus sont déclarés. Vérifie **par le
réseau** que les URL répondent encore, que les versions citées sont les
dernières, et cherche ce qui manque : **Sentinel-2 dérivé (SDB)** pour les
lagons et les hauts-fonds tropicaux, **AusSeabed**, **GEBCO Cook Book /
Seabed 2030** pour les mises à jour régionales.

⚠️ La mémoire du dépôt note *« GEBCO + Sentinel-2 cloudless en tête, rien de
branché, vérifier licences avant usage »*. **Vérifie** : GEBCO **est** branché
(le pied de page le crédite). Ne recopie pas une note périmée.

## ③ CE QUE ÇA COÛTE, ET CE QUE ÇA RAPPORTE

Pour chaque source retenue, **chiffre** : combien de tuiles, quel poids, combien
de zones du monde gagnent combien de mètres de résolution. Une source qui
double le poids du site pour améliorer 0,3 % de la surface se dit et se refuse.

## L'ATTENDU

1. **Le tableau des sources de lacs**, classé, avec résolution / couverture /
   licence / attribution / URL / format / poids.
2. **La recommandation n° 1 pour les lacs**, prête à implémenter : entrée
   `index.json`, plafond de zoom, crédit, procédure de cuisson, coût en octets.
   ⚠️ **Écris aussi ce qui casserait** si on l'ajoutait naïvement.
3. **L'état de la cascade océan** : ce qui répond encore, ce qui a une version
   plus récente, ce qui manque et vaut la peine.
4. **Un prototype de cuisson** si c'est raisonnable (`scripts/`), sur **une**
   zone d'essai (le Léman ou le lac Supérieur), avec la tuile produite et sa
   comparaison à la référence. ⛔ **Ne touche pas à `src/`** : c'est B3 qui
   intègre. Tes livrables sont un rapport, des scripts et des données d'essai.
5. `npm test` reste **4 748 · 0**, `audit:tests` sans écart.
   `rapport-B2.md` (`git add -f`).

⚠️ **B1 audite en parallèle** dans `C:\Dev\wt-bat1` — ne lui parle pas, ne lis
pas sa branche. Ne pose pas de question : cherche, vérifie, tranche, chiffre.

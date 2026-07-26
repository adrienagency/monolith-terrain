# Comptes, paiements et dons — rapport et plan

**Date** : 2026-07-26
**État** : plan validé sur le principe, RIEN n'est implémenté
**Contexte** : ShibuMap est en production, en alpha, sans compte ni paiement.
Développeur solo, France (Annecy), micro-entreprise. Hébergement Netlify,
100 % statique, deux fonctions serverless déjà en service.

---

## 0. La recommandation, en un paragraphe

**Vendre un « Pass » à 19 €, achat unique, par un simple lien de paiement
Stripe, déverrouillé par une clé de licence signée Ed25519 vérifiée dans le
navigateur — sans compte, sans base de données, sans marchand de référence, à
0 €/mois — et demander le paiement à l'instant exact où l'utilisateur voit son
rendu 4K, à côté d'un téléchargement 1920 px gratuit.**

Budget total pour encaisser le premier euro : **~200 €** d'adhésion à un
médiateur de la consommation, **deux jours** de développement, **2,8 %** de
commission Stripe.

Cette recommandation tient sur trois faits, dont aucun n'avait été établi
correctement dans les analyses précédentes :

1. **Il n'y a pas de problème de TVA.** En franchise en base, avec le régime
   transfrontalier PME de 2025, on vend dans toute l'Union sans TVA jusqu'à
   100 000 € de CA européen.
2. **On ne vend pas un fichier, on vend un déverrouillage.** Les exports sont
   intégralement calculés dans le navigateur : rien à livrer, rien à héberger,
   rien à protéger côté serveur.
3. **Aucun compte n'est nécessaire** — ni pour vendre, ni pour livrer, ni pour
   honorer.

---

## 1. Fiscalité — ce qui est vrai, et ce qu'on croyait

### 1.1 Le renversement

La croyance commune : vendre un fichier numérique à un particulier européen
oblige à facturer la TVA de SON pays au-delà de 10 000 €, et à passer par le
guichet unique OSS. C'est exact **dans le régime général**.

Mais depuis le **1ᵉʳ janvier 2025**, la **franchise en base transfrontalière**
(directive 2020/285, CGI art. **293 B bis** et **293 B ter**) permet à une PME
française d'étendre sa franchise française aux autres États membres :

- CA annuel dans l'Union **≤ 100 000 €** (année N et N-1)
- respect du seuil national du pays concerné
- notification préalable à l'administration française
- attribution d'un numéro d'identification suffixé **« EX »**
- **déclaration trimestrielle** du CA par État membre, dans le mois suivant
- signalement sous 15 jours en cas de dépassement

**Résultat : zéro TVA sur toutes les ventes UE, prix unique partout, pas d'OSS.**

> ⚠️ **RÉSERVE À LEVER AVANT D'ENCAISSER.** La page officielle ne dit pas
> explicitement si les *services fournis par voie électronique* entrent dans ce
> régime transfrontalier. L'articulation entre l'art. 259 D (règle de
> destination) et l'art. 293 B bis mérite une confirmation écrite du SIE ou d'un
> expert-comptable. **Toute la recommandation repose là-dessus.** C'est un coup
> de fil, pas un projet. À noter : le régime transfrontalier ne se cumule pas
> avec une inscription à l'OSS non-UE ou à l'IOSS.

### 1.2 Les seuils qui comptent vraiment

| Palier | Ce qui se passe |
|---|---|
| 0 → 10 000 € de ventes B2C hors France | Rien à faire, TVA française, donc nulle en franchise |
| 10 000 → 100 000 € de CA UE | Choix entre OSS (TVA du pays acheteur) et **franchise transfrontalière** (toujours zéro). La seconde est plus simple et préserve un prix unique |
| **37 500 €** de CA services France (tolérance 41 250 €) | **LE VRAI MUR** — sortie de la franchise française. TVA 20 %, TVA de destination dans l'UE, OSS, déclarations. Le prix affiché est à repenser |
| 83 600 € de CA services | Sortie du régime micro lui-même |

Les seuils sont **confirmés** : la réforme à 25 000 € a été définitivement
abrogée (loi n° 2025-1044 du 3 novembre 2025) et le Sénat a rejeté sa
réintroduction dans le PLF 2026. Les plafonds micro ont été revalorisés de
+7,6 % pour 2026-2028.

### 1.3 Le vrai piège fiscal : le hors-UE

- **Royaume-Uni** : seuil d'immatriculation TVA à **ZÉRO** pour un vendeur non
  établi. TVA 20 % **dès la première vente**. Le seuil de 90 000 £ ne concerne
  que les entreprises établies au Royaume-Uni.
- Suisse 100 000 CHF · Australie 75 000 AUD · Canada 30 000 CAD ·
  États-Unis ~100 000 $ ou 200 transactions par État.

Un produit en anglais partagé par lien **vendra au Royaume-Uni**. C'est le seul
argument techniquement solide en faveur d'un marchand de référence.
Parade pauvre : bloquer le RU au checkout tant que le volume ne le justifie pas.
Parade riche : un marchand de référence, le jour où ça pèse.

### 1.4 Statut, facturation, e-invoicing

**Rester en micro-entreprise.** Une société coûte 1 500-2 500 €/an de comptable
pour un CA qui n'existe pas, et il n'y a quasiment aucune charge à déduire.
La bascule se justifie vers 40-50 k€.

**Mentions obligatoires** : « TVA non applicable, art. 293 B du CGI ».
Pour une vente à un professionnel d'un autre État membre : mention
« **Autoliquidation** », **numéro de TVA intracommunautaire** à demander au SIE
(gratuit, quelques semaines, même en franchise) et **DES** à déposer.
→ Directement pertinent pour le **Race Studio vendu à des organisateurs**
étrangers. Piège symétrique : à l'ACHAT d'une prestation UE, on autoliquide sans
pouvoir déduire — coût sec de 20 %.

**Facturation électronique** :
- **1ᵉʳ sept. 2026** : obligation de RÉCEPTION pour toutes les entreprises
- **1ᵉʳ sept. 2027** : obligation d'ÉMISSION et d'e-reporting pour les micro
- Le B2C est hors e-invoicing mais soumis à **e-reporting**, même calendrier
- S'applique **aussi aux assujettis non redevables**, donc en franchise

→ Argument supplémentaire pour un marchand de référence à terme : **s'il est le
vendeur, l'e-reporting B2C est le sien**.

---

## 2. Les obligations B2C que presque tous les sites oublient

### 2.1 Le médiateur de la consommation — 3 000 € d'amende

Obligatoire depuis le 1ᵉʳ janvier 2016 pour **tout** professionnel vendant à des
consommateurs. Coordonnées à publier sur le site et dans les CGV.
Absence : **3 000 €** pour une personne physique (art. L641-1 du Code de la
consommation). Adhésion : **50 à 500 €/an**.

**C'est la seule dépense réelle de tout ce plan.** Et c'est le meilleur argument
concret en faveur d'un marchand de référence : avec lui, le vendeur au
consommateur est le marchand, donc l'obligation lui incombe.

### 2.2 Le droit de rétractation — 14 jours, malgré le téléchargement

L'exception pour le contenu numérique (art. **L221-28, 13°**) ne joue **que si**
l'acheteur a donné son **accord exprès** au démarrage immédiat **et** reconnu
renoncer à son droit. **Une case pré-cochée ne suffit pas.**

Sans cette case, les 14 jours s'appliquent et on rembourse sur simple demande.
Cinq minutes de travail.

### 2.3 Mentions légales et CGV

Identité, SIRET, adresse, email, hébergeur, prix TTC, modalités, garanties,
coordonnées du médiateur. Non négociable dès la première vente.

---

## 3. Les pièges techniques

Vérifiés dans la documentation Stripe :

- **Le webhook est la source de vérité, JAMAIS la redirection.** Stripe le dit
  explicitement : ne pas accorder l'accès sur la base de la `success_url`.
- **Vérifier la signature `Stripe-Signature`** systématiquement.
- **Idempotence obligatoire** : stocker l'`event.id`, ignorer les doublons.
- **L'ordre des événements n'est pas garanti.**
- **Répondre 2xx en moins de ~5 s**, avant tout traitement lourd. Les retries
  durent 3 jours.
- **Ne jamais toucher aux données de carte.** Checkout ou Payment Links hébergés
  → le numéro ne transite jamais par le domaine, on reste en SAQ-A.
- **Ne jamais faire confiance au client pour les droits.** Un
  `localStorage.pro = true` se change en trois secondes. Si le contrôle est côté
  client, il doit être **cryptographiquement vérifiable**.

---

## 4. L'état réel du code — vérifié, pas supposé

### 4.1 `STORE_COMMERCE` ne cache rien

Déclaré une fois dans `src/ui/store.js:11`, **référencé nulle part ailleurs**.
Les 136 palettes portent un `price` que `card()` ne lit jamais. Et chaque
template est **déjà librement téléchargeable** par un simple lien `download`
(`.store-dl`).

→ **Il n'y a pas d'interrupteur à basculer : il y a un produit gratuit qu'il
faudrait reprendre.** À ne pas faire en alpha.

### 4.2 `netlify/functions/race.mjs` est ouvert

Public, non authentifié, **sans limitation de débit ni expiration** — les
commentaires du fichier l'assument. Acceptable tant que le nom ne circule pas ;
c'est du stockage offert à internet le jour où il circule.
→ **Rate limit par IP + TTL sur les blobs orphelins, avant le commerce.**

### 4.3 La ligne de crédits N'EST PAS un filigrane commercial

`EXPORT_CREDIT` dans `src/export.js` est une **obligation d'attribution**
ODbL / Licence Ouverte / GEBCO, et ces licences visent précisément les œuvres
**vendues**.

- ❌ **On ne peut pas la vendre comme option de retrait** — ce serait vendre une
  violation de licence.
- ✅ On peut la rendre **discrète**, ou la déporter en EXIF/XMP + mention aux CGV.
- ⚠️ **La vidéo MP4 n'en porte aucune.** Incohérence à traiter avant de la vendre.

Vérifier source par source ce qu'on a le droit de vendre : FABDEM (CC BY-NC-SA),
Sentinel-2 cloudless d'EOX et SRTM15+ sont déjà écartés. GEBCO, IGN RGE ALTI,
BD ORTHO (Licence Ouverte 2.0) et Mapterhorn passent.

### 4.4 CORRECTION — l'upload de logo n'est PAS une faille XSS

Une analyse intermédiaire annonçait une XSS sur l'upload de logo du Race Studio.
**Vérification faite : ce n'est pas exploitable.**

- Le logo n'est rendu qu'en `<img src="${item.logo}">` (`race-labels.js:63`,
  `studio.js:136`). **Un script dans un SVG chargé par `<img>` ne s'exécute
  pas** — propriété de sécurité standard des navigateurs.
- `readAsDataURL` produit du base64 : aucun guillemet capable de sortir de
  l'attribut HTML.

**Ce qui reste vrai** : deux chemins d'upload incohérents — les icônes de sport
passent par `sanitizeSvgMarkup` (`main.js:3028`), le logo non. C'est de
l'hygiène, et un risque latent si le logo est un jour rendu autrement (inliné,
ou dans un `foreignObject`). À corriger, sans urgence.

### 4.5 Un engagement moral

Un message a été envoyé à **kaolti** (auteur amont, MIT) promettant de le
prévenir avant toute monétisation. MIT n'y oblige pas ; la parole donnée, si.
→ **Envoyer le message avant la première vente.**

---

## 5. Les services — chiffres vérifiés

### 5.1 Paiement

| | Commission | 100 ventes à 29 € |
|---|---|---|
| **Stripe** (carte EEE) | 1,5 % + 0,25 € | **68,50 €** (2,4 %) |
| Stripe cartes UK | 2,5 % + 0,25 € | — |
| Stripe hors EEE | 3,25 % + 0,25 € + 2 % conversion | — |
| **Stripe Managed Payments** (marchand de référence) | +3,5 % → 5 % + 0,25 € | **170 €** (5,9 %) |
| Polar Starter / Paddle | ~5 % + 0,50 $ | **~141 €** + payout |
| Gumroad | ~13 % effectifs | **~377 €** |

- Litige Stripe : **20 €**. Payment Links et Checkout : **inclus**.
- Stripe Billing (abonnements) : +0,7 %.
- **Stripe Tax : inutile en franchise** (0,5 %/transaction ou 80 €/mois, et il
  calcule sans déposer les déclarations).

**Subtilité micro-entreprise** : on déclare le **CA brut payé par le client**,
et les commissions de plateforme **ne sont pas déductibles**. Avec un marchand
de référence, la structure est différente (il achète et revend), donc ses frais
deviennent de facto déductibles. Cela réduit d'environ moitié l'écart net réel.
→ **À faire valider par un comptable avant d'en faire un argument.**

**Ce qu'on perd avec un marchand de référence** : ce ne sont plus ses clients.
Pas d'emails librement exploitables, relation commerciale chez lui, et sortie
coûteuse (refaire signer les moyens de paiement).

**Pièges par prestataire** :
- **Paddle** : rejet à l'inscription documenté pour absence de 3 mois
  d'historique de paiements. Exigence non publiée, sans appel.
- **Lemon Squeezy** : racheté par Stripe, migration poussée vers Managed
  Payments, fonctions créateur non reprises. **Ne rien bâtir dessus.**

### 5.2 Dons

**Fiscalement, un « don » lié à l'activité N'EST PAS un don** : c'est un revenu
imposable en BIC/BNC, soumis à cotisations. Il **consomme le plafond de
franchise** exactement comme une vente. C'est le seul arbitrage à connaître —
aucun risque juridique à mélanger dons et ventes.

En revanche, un don **sans contrepartie** est hors champ de la TVA. Dès qu'il y
a une contrepartie (badge, accès, template exclusif), c'est une vente.

| | Commission | Note |
|---|---|---|
| **Stripe Payment Link, montant libre** | 1,5 % + 0,25 € | **Le moins cher et le plus propre.** Aucune plateforme, aucune marque tierce |
| Ko-fi | **0 %** sur dons, 5 % boutique | **N'est pas marchand de référence**, ne gère pas la TVA. Gold à 12 $/mois |
| Liberapay | 0 % + frais processeur | Récurrent seulement, contreparties interdites |
| GitHub Sponsors | — | Pertinent seulement si le code est ouvert. ShibuMap est privé |

### 5.3 Authentification et base — pour plus tard

**Aucune authentification n'est nécessaire pour vendre.**

| | Gratuit | À 100 clients |
|---|---|---|
| **Clerk** | 50 000 MAU, branding imposé | **0 €** |
| **Netlify Identity** | inclus | **0 €** — maintenu, revirement de février 2026 |
| **Netlify DB (Neon)** | 0,5 Go, sans expiration | **0 €** |
| Supabase Free | ⚠️ **pause après 7 j d'inactivité** | inutilisable en prod |
| Supabase Pro | — | 25 $/mois = **300 $/an** |
| Auth0 | 25 000 MAU | 35-70 $/mois, surdimensionné |
| Firebase | 50 000 MAU | ⚠️ **aucun plafond de dépenses** en Blaze |

⚠️ **Netlify est passé à un modèle de crédits** : Free = 300 crédits/mois,
plafond dur, **tous les sites en pause si dépassement**. ~15 Go de bande
passante et ~20 déploiements par mois. Avec un `dist/` de 951 Mo dont 933 Mo de
tuiles, **la bande passante est la variable critique**, pas le paiement.

---

## 6. L'intégration dans l'interface

### 6.1 Où vit « se connecter »

**Nulle part, pendant longtemps.** Et quand ça viendra : **une ligne « Compte »
dans le menu de la roue crantée**, pas un bouton de topbar. Un bouton
« Se connecter » permanent est un signal de produit fermé ; ShibuMap vend
l'inverse.

« Mes achats » / « Mes cartes » : un `Panel` classique dans le dock droit, avec
l'accordéon existant. Zéro nouveau paradigme.

**Ce que voit un visiteur non connecté : exactement ce qu'il voit aujourd'hui.**

### 6.2 Le moment du paiement — la décision qui fait la conversion

**Après le rendu, jamais avant.**

1. Clic sur **Publier → Exporter une image**, la modale s'ouvre comme aujourd'hui.
2. **1280 et 1920 px restent libres**, avec la ligne de crédits. **2560, 3840 et
   la vidéo** portent une puce discrète — pas un cadenas agressif.
3. Si l'utilisateur choisit 4K : **on rend l'image quand même, en entier**. Le
   rendu est client-side, il ne coûte rien.
4. La modale affiche **l'aperçu du rendu 4K réel** et deux boutons côte à côte :
   `Télécharger en 1920 px` (secondaire, gratuit) et
   `Télécharger en 4K — 19 €` (accent). Dessous : « déverrouille définitivement
   le 4K et la vidéo, sur cet appareil et les suivants ».
5. Le paiement ouvre un **Stripe Payment Link** dans un nouvel onglet.

**Pourquoi ça marche** : le pic de valeur perçue et le moment de la demande
coïncident ; l'aversion à la perte joue ; le choix gratuit reste visible et
digne, ce qui protège la réputation du produit.

**Contre-argument assumé** : montrer un 4K qu'on ne peut pas télécharger peut
frustrer. C'est pourquoi l'alternative gratuite doit être **à côté**, jamais
cachée. **La frustration naît de l'impasse, pas du prix.**

### 6.3 Le don, sans mendier

Trois emplacements, **aucun bandeau** :

1. Un item **« Soutenir ShibuMap »** dans le menu Aide `?`, sous-titre honnête
   (« le projet est gratuit et le restera »). La fabrique `menuItem` existe :
   trois lignes.
2. Une ligne dans `.ce-credits`, discrète et permanente.
3. **Après un export gratuit réussi** : une ligne unique dans la modale, « ça
   vous a plu ? ». **Une fois par session, jamais en surcouche.**

À refuser : bandeau permanent, pop-up temporisé, barre d'objectif de
financement. Ils signalent la précarité — contre-productif quand on veut aussi
vendre à des organisateurs professionnels.

### 6.4 La ligne du gratuit

> **Est gratuit tout ce qui se regarde et se partage.
> Est payant tout ce qui s'imprime et tout ce qui sert professionnellement.**

**Gratuit, définitivement** : toute la visualisation 3D, le globe, les modes
caméra, les effets · **tous les styles et toutes les palettes** (ils le sont
déjà — les reprendre serait la pire décision possible en alpha) · le GPX, le
Race Studio complet, le partage par lien, la page `/r/:id` · l'export image
jusqu'à **1920 px** · la capture vidéo à la résolution de l'écran.

**Payant** : export **2560 et 3840 px** · export vidéo haute définition ·
**licence d'usage commercial** (le vrai produit pour un organisateur qui met la
carte sur son affiche) · à terme, la permanence des cartes publiées.

### 6.5 Le mode invité

**Il survit, indéfiniment, et ce n'est pas négociable.** Le compte est un ajout
facultatif pour retrouver son travail, jamais une condition pour en produire.
Corollaire de la clé de licence : **on peut acheter sans compte.**

### 6.6 Zone à ne pas toucher

La rangée du bas (`src/ui/elembar.js`) est un système liquide à géométrie
calculée et clés stables. **Tout ajout d'élément y recalcule le pont et le seuil
d'alpha du filtre.** C'est la zone la plus fragile de l'application — le point
d'insertion le moins coûteux est la fabrique `menuItem` des menus flottants.

---

## 7. Le plan, en quatre phases

### Phase 0 — Être en règle et écouter
**½ journée · ~200 € · 0 €/mois**

- Mentions légales, CGV, page de médiation
- **Adhésion à un médiateur de la consommation** (la seule dépense du plan)
- La **case de renonciation** au droit de rétractation (non pré-cochée)
- **Rate limit** sur `race.mjs` + TTL sur les blobs orphelins
- `sanitizeSvgMarkup` sur l'upload de logo (hygiène)
- Un item **« Soutenir »** dans le menu Aide → Stripe Payment Link à montant libre
- **Le message à kaolti**
- Demander le **numéro de TVA intracommunautaire** au SIE (gratuit, quelques semaines)
- **Confirmer auprès du SIE** que les services électroniques entrent dans la
  franchise transfrontalière

**Ce qu'on apprend** : combien de personnes donnent spontanément. Le signal le
moins cher qui existe sur l'attachement au produit.

### Phase 1 — La première vente, honteusement simple
**2 jours · 0 €/mois**

Un **« Pass Studio » à 19 €**, achat unique, à vie, déverrouillant les exports
2560/3840 px et la vidéo HD.

- Un **Stripe Payment Link**. Aucun code de checkout, aucune page produit.
- Sur `checkout.session.completed`, une fonction Netlify génère une **clé de
  licence signée Ed25519** (clé privée en variable d'environnement), affichée
  sur la page de retour et envoyée par email via Stripe.
- L'app vérifie la signature avec la **clé publique embarquée dans le bundle**,
  via WebCrypto. Aucun aller-retour réseau, fonctionne hors ligne,
  **infalsifiable** — seulement partageable, ce qui est acceptable en alpha.
- La clé se colle dans un champ des Paramètres, se range dans `localStorage`.

**Pas de base de données. Pas d'authentification. Pas de compte. Pas de
marchand de référence.**

**Ce qu'on apprend** : le **taux de conversion depuis l'écran d'export** — le
seul chiffre qui compte. Et le prix : si 19 € convertit à 3 %, tester 29 €. Le
marché comparable (posters cartographiques en téléchargement) est vers 29 $.
**19 € est délibérément bas : en alpha on achète de l'information, pas de la
marge.**

**Ce qu'on ne construit surtout pas** : le compte, la boutique payante,
l'abonnement, la facturation automatique. On facture à la main les premières
fois — dix factures, c'est une heure.

### Phase 2 — Le vrai produit : les organisateurs
**1 semaine de commercial, ZÉRO développement · 0 €/mois**

Une offre **« Carte de course »** : licence d'usage commercial + exports 4K +
vidéo + permanence du lien `/r/:id`.

**Prix à l'événement, jamais à l'abonnement** — une course est annuelle, un
abonnement mensuel tourne à vide onze mois sur douze.
Départ suggéré : **90 à 150 € par événement**, à ajuster après trois ventes.
*Un organisateur qui dépense 2 000 € en affiches ne discutera pas 120 € pour la
carte qui est dessus.*

Techniquement : **rien**. Facture Stripe à la main, clé de licence émise à la
main avec un drapeau « commercial ». On vend au téléphone et par email.

⚠️ Si l'organisateur est une association ou une société d'un autre pays de l'UE :
numéro de TVA intracommunautaire, mention « Autoliquidation », DES.

**Ce qu'on apprend** : si le B2B organisateur est le vrai business — auquel cas
tout le reste devient secondaire et l'architecture change.

### Phase 3 — Les comptes, quand on les réclame
**3 à 4 semaines · 0 €/mois**

**Déclencheur, écrit noir sur blanc** : quand **un même organisateur publie une
deuxième course**, ou quand **trois personnes différentes** écrivent pour
retrouver une carte perdue. Pas « quand on aura 1 000 utilisateurs » — ce n'est
pas mesurable et ça n'arrivera pas dans cet ordre.

Auth par lien magique : **Clerk gratuit** ou **Netlify Identity**.
Base : **Netlify DB (Neon)** gratuit, ou Netlify Blobs si le modèle reste simple.
Un panneau « Mes cartes » dans le dock droit, une ligne « Compte » dans la roue
crantée.

**Ce qu'on apprend** : la rétention réelle.

### Phase 4 — Le marchand de référence, quand le hors-UE pèse
**½ journée + 3-7 jours d'attente**

**Déclencheur** : approche des **37 500 €** de CA, **ou** ventes hors UE de
plusieurs milliers d'euros par an.

Bascule vers **Stripe Managed Payments** (+3,5 %, soit 5 % + 0,25 € au total) —
le marchand de référence le moins cher accessible depuis la France, et on reste
dans Stripe donc la migration n'est pas une rupture. Il porte alors la TVA de
80+ pays, l'e-reporting B2C, la médiation et les litiges.

À 40 000 € de CA, ~1 000 €/an — largement moins qu'un comptable pour gérer
l'OSS, l'immatriculation UK et l'e-reporting.

---

## 8. Ce qui est formellement déconseillé

| À ne pas faire | Pourquoi |
|---|---|
| **Supabase Pro maintenant** | 300 $/an pour zéro compte. Et le plan Free **met le projet en pause après 7 jours** — pire que rien. La bonne réponse 2026 : Netlify DB + Clerk gratuit, même résultat à 0 € |
| **Monétiser la boutique de templates** | 136 palettes sont **déjà téléchargeables gratuitement**. Vendre 4 € rapporte ~3,50 € et coûte la confiance de tous ceux qui les ont eues gratuites |
| **L'abonnement, maintenant** | Une course est annuelle. Le backlash Komoot de février 2025 montre ce que coûte un abonnement forcé sur un usage ponctuel |
| **Paddle en premier** | Rejet documenté pour absence de 3 mois d'historique de paiements |
| **Lemon Squeezy** | Racheté par Stripe, migration poussée, fonctions créateur non reprises |
| **Stripe Tax** | 0,5 %/transaction pour calculer une TVA qu'on ne doit pas — et il ne dépose pas les déclarations |
| **Auth0, Firebase** | Surdimensionné / **aucun plafond de dépenses** en Blaze |
| **Le back-office avant la première vente** | *Premature scaling* — 74 % des échecs de startups à forte croissance |
| **Retirer la ligne de crédits contre paiement** | Obligation de licence de données, pas un filigrane |

---

## 9. Les conseils qui ne tiennent pas dans un tableau

**Le capital le plus rapide, c'est le client.** Monter un dossier de subvention
coûte des semaines de paperasse pour un résultat incertain. Trois organisateurs
qui paient 500 € apprennent davantage, plus vite, et mettent en position de
force le jour où l'on pousse la porte d'un incubateur — on n'y vient plus
chercher de l'argent pour démarrer, mais pour accélérer ce qui marche.

**Le produit est déjà en ligne et il tourne.** C'est rare et c'est le meilleur
atout : la majorité de ce qui se présente en incubateur est un slide.

**Ne pas confondre « c'est beau » et « ça se vend ».** C'est la question qu'on
posera dans les cinq premières minutes, et la seule réponse qui vaut est un nom
d'organisateur.

**La question à poser à un organisateur**, celle qui vaut de l'or :
*combien te coûte ta carte aujourd'hui, et qui te la fait ?*
En général : un graphiste, plusieurs centaines à quelques milliers d'euros, et
des semaines d'allers-retours. C'est le prix d'ancrage et l'argument.

**Facturer à la main les dix premières fois.** C'est une heure de travail, et ça
évite trois semaines de développement d'un système dont on ne connaît pas encore
les besoins.

**Un produit d'alpha qui verrouille tout meurt.** La ligne du gratuit (§6.4)
n'est pas une concession commerciale, c'est ce qui rend le produit partageable —
et le partage est le seul canal d'acquisition dont on dispose aujourd'hui.

---

## 10. Sources

[impots.gouv.fr — franchise en base européenne](https://www.impots.gouv.fr/je-souhaite-adherer-la-franchise-en-base-tva-europeenne) ·
[BOFiP ACTU-2025-00144](https://bofip.impots.gouv.fr/bofip/14799-PGP.html/ACTU-2025-00144) ·
[BOFiP BOI-TVA-CHAMP-20-50-40-20](https://bofip.impots.gouv.fr/bofip/11964-PGP.html/identifiant=BOI-TVA-CHAMP-20-50-40-20-20210813) ·
[Légifrance L221-18 à L221-28](https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006069565/LEGISCTA000032221365/) ·
[stripe.com/fr/pricing](https://stripe.com/fr/pricing) ·
[Stripe Managed Payments](https://stripe.com/pricing) ·
[docs.stripe.com/webhooks](https://docs.stripe.com/webhooks) ·
[paddle.com/pricing](https://www.paddle.com/pricing) ·
[polar.sh — fees](https://polar.sh/docs/merchant-of-record/fees) ·
[Lemon Squeezy — 2026 update](https://www.lemonsqueezy.com/blog/2026-update) ·
[supabase.com/pricing](https://supabase.com/pricing) ·
[clerk.com/pricing](https://clerk.com/pricing) ·
[netlify.com/pricing](https://www.netlify.com/pricing/) ·
[Netlify Identity maintenu (fév. 2026)](https://answers.netlify.com/t/netlify-identity-is-staying-feb-2026-reversal-what-changed-whos-affected-and-how-to-proceed/162733) ·
[Ko-fi Terms](https://more.ko-fi.com/terms) ·
[Liberapay FAQ](https://en.liberapay.com/about/faq) ·
[LégiFiscal — seuils micro 2026](https://www.legifiscal.fr/actualites-fiscales/4436-nouveaux-seuils-micro-entreprises-annee-2026.html) ·
[CCI Haute-Savoie — facturation électronique](https://www.haute-savoie.cci.fr/blog/facturation-electronique-calendrier-obligations) ·
[Fonoa — TVA numérique UK](https://www.fonoa.com/resources/country-tax-guides/united-kingdom/tax-on-digital-services)

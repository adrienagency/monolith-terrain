# Monétisation ShibuMap — plan v2

**Date** : 2026-07-28
**État** : plan opérationnel. RIEN n'est encore implémenté.
**Remplace** : le plan du 2026-07-26 comme document de référence. La v1 reste
l'**annexe fiscale et juridique** (sections 1, 2 et 10 : franchise
transfrontalière, médiateur, rétractation, licences de données, sources) — ses
conclusions sur ces sujets sont inchangées et ne sont pas recopiées ici.
**Pourquoi une v2** : la v1 a été notée 7/10, 7/10 et 6/10 par trois
évaluateurs spécialisés (pricing, systèmes de paiement, go-to-market indie).
Verdict synthétique : *« un excellent système d'encaissement (9/10) posé au
bout d'un funnel qui n'existe pas encore (3/10) »*. La v2 corrige les cinq
faiblesses convergentes et les erreurs factuelles relevées.
**Validation** : la v2 amendée a été re-notée par les trois mêmes
évaluateurs — **8/10 (pricing), 8,5/10 (paiements), 8,5/10 (go-to-market)**.
Les trois verdicts : « je le déploierais tel quel / pour mon propre argent /
avec ma propre année en jeu ». Leurs derniers restes sont intégrés ci-dessous.

---

## 0. La recommandation, en un paragraphe

**Deux moteurs en parallèle, pas en série.** Côté organisateurs : vendre au
téléphone une « Carte de course » à **250-400 € l'événement**, livrée à la
main, dès maintenant — les affiches se commandent 4 à 6 mois avant les courses,
et Annecy est au cœur du marché. Côté particuliers : un **Pass à 19 € (prix de
lancement alpha, cible 29 €)**, achat unique, par lien de paiement Stripe,
déverrouillé par une clé signée Ed25519 **à cycle de vie complet** (journal,
récupération, révocation) — sans compte, sans base, 0 €/mois. Et avant le
premier euro : **un funnel mesuré** (cinq événements d'analytics) et **une
boucle d'acquisition** (« shibumap.com » discret sur les exports gratuits),
parce qu'un taux de conversion sans dénominateur n'apprend rien.

Budget pour encaisser le premier euro : ~200 €/an de médiateur, trois jours de
développement, 1,5 % + 0,25 € de commission Stripe par vente.

---

## 1. Fiscal et juridique — inchangé, deux réserves à lever

Tout le détail est dans la v1. Ce qui commande le calendrier :

| Fait | Conséquence |
|---|---|
| Franchise en base + régime transfrontalier PME 2025 | **Zéro TVA sur toutes les ventes UE** jusqu'à 100 000 € de CA européen, prix unique partout |
| ⚠️ Réserve n° 1 | **Confirmer au SIE** que les services électroniques entrent dans le régime transfrontalier — toute la mécanique repose dessus. Un coup de fil, pas un projet |
| ⚠️ Réserve n° 2 | **Royaume-Uni : TVA dès la première vente** pour un vendeur non établi. Parade alpha : ne pas y vendre (Stripe le permet par pays). Parade riche : marchand de référence, le jour où ça pèse |
| Le vrai mur : 37 500 € de CA services France | Sortie de franchise, TVA 20 %, OSS — repenser les prix à l'approche |
| Médiateur de la consommation | Obligatoire, ~200 €/an, 3 000 € d'amende sinon. **La seule dépense du plan** |
| Rétractation 14 jours | Case de renonciation expresse, non pré-cochée, au checkout |
| Ligne de crédits ODbL/GEBCO/IGN | **N'est pas un filigrane commercial, ne se vend pas.** La vidéo MP4 n'en porte aucune — à corriger avant de la vendre |
| Engagement kaolti | Message promis avant toute monétisation. À envoyer en Phase 0 |

---

## 2. Mesurer avant de vendre — le correctif n° 1

La v1 déclarait le taux de conversion « seul chiffre qui compte » sans prévoir
aucun moyen de le mesurer. L'app est 100 % client-side, sans analytics : zéro
vente aurait été indistinguable de zéro visiteur.

**À poser en Phase 0, avant toute offre** :

- **Plausible ou Umami** (privacy-first, sans bandeau de consentement en
  configuration sans cookies, ~9 €/mois ou auto-hébergé gratuit) — ou à défaut
  une fonction Netlify qui incrémente des compteurs dans Blobs, l'infra de
  `race.mjs` existe déjà.
- **Cinq événements, pas un de plus** : visite · ouverture de la modale
  d'export · choix d'une taille payante · clic sur le lien de paiement ·
  achat confirmé (webhook). Le funnel entier tient dans ces cinq nombres.
  Chaque événement porte une dimension **`contexte` (studio / course)** — les
  deux publics n'ont pas le même funnel, et les critères d'échec supposent
  qu'on sache d'où viennent les ouvertures de modale.
- **Un rendez-vous hebdomadaire** avec ces chiffres. Pas de tableau de bord à
  construire : les cinq nombres dans un onglet.

**Arithmétique de référence** (benchmarks freemium web) : ~0,5 % de
visiteur→acheteur, 2-5 % depuis l'écran où la fonctionnalité payante est
visible. Il faut donc viser **~2 000 visiteurs qualifiés/mois pour ~10 ventes
de pass**. C'est le chiffre qui dit si le problème est le prix ou le trafic.

**Critères d'échec écrits** (symétriques des déclencheurs de succès) :

| Phase | Signal d'échec | Réaction |
|---|---|---|
| Dons (Phase 0) | 0 don après 2 000 visiteurs | Aucune gravité — le don ne prédit pas la vente, on continue |
| Pass (Phase 1) | < 1 % de conversion sur 200 ouvertures de modale 4K | Tester 29 € vs 14 €, puis revoir le placement de l'offre — pas tout casser |
| Organisateurs | 0 vente après 30 contacts qualifiés | Le problème est l'offre ou le pitch, pas le prix : demander à 3 refus ce qui aurait fait signer |
| Trafic (transverse) | < 500 visiteurs/mois après 8 semaines de campagne vidéo | Le goulot est l'ACQUISITION, pas la conversion — le temps de dev se réaffecte au canal, pas au produit |

**Le cold start, regardé en face** : la boucle virale ne s'amorce qu'avec du
volume d'exports, qui exige du trafic — c'est circulaire. Deux amorces qui ne
dépendent pas de la chance : le **lancement daté** (§3), et l'actif SEO
dormant — **les pages `/r/:id` des courses publiées sont des pages indexables
à requête locale** (« carte 3D [nom de la course] »), les seules du site à
répondre à une recherche que quelqu'un tape vraiment. Chaque carte-démo B2B
(§6) en crée une.

---

## 3. L'acquisition — le funnel commence avant la modale

La v1 décrivait comment encaisser, jamais qui voit l'offre.

- **La boucle virale, gratuite et déjà légitime** : les exports gratuits
  portent un discret **« shibumap.com »** (coin opposé à la ligne de crédits,
  même discrétion). Le Pass le retire. C'est le mécanisme standard des outils
  d'export freemium, il ne touche pas aux licences de données — la ligne de
  crédits ODbL, elle, reste sur TOUS les exports, gratuits et payants. Chaque
  carte partagée devient le seul canal d'acquisition auto-alimenté dont on
  dispose.
- **Une page `/pricing` sobre** : deux colonnes (Pass / Carte de course),
  prix affichés, contact organisateurs. Elle existe pour ceux qui cherchent —
  aujourd'hui, aucune mention de prix n'existe nulle part.
- **La campagne vidéo en cours** se raccorde : l'URL en fin de vidéo pointe
  vers le site ; les vidéos Race Studio pointent vers `/pricing`.
- **Un lancement daté** quand le funnel est instrumenté : r/trailrunning,
  forums trail FR, Product Hunt — un seul gros jour de trafic vaut un mois de
  mesure.
- **Capture d'email optionnelle à l'export gratuit** : « recevoir la carte par
  email » — champ facultatif, jamais bloquant. C'est le seul actif marketing
  constructible sans budget. (RGPD : consentement à la newsletter distinct de
  l'envoi du fichier.)

---

## 4. L'architecture de paiement — corrigée sur trois erreurs

Le cœur de la v1 tient : **Payment Link Stripe + clé signée Ed25519 vérifiée
dans le navigateur, sans compte, sans base de données**. Les évaluateurs l'ont
validé (« je le mettrais en production pour mon argent — avec les correctifs »).
Les correctifs, donc :

### 4.1 Le cycle de vie de la clé (l'oubli le plus cher de la v1)

La v1 émettait une clé à vie sans révocation ni récupération : un remboursement
ou un chargeback laissait une clé valide pour toujours ; un localStorage vidé
la perdait sans recours.

- **La clé est dérivée de façon déterministe du `checkout.session.id`** et
  signée avec la clé privée (variable d'environnement Netlify). Même session →
  même clé : la page de retour devient **rejouable à volonté**.
- **Payload signé** : `{ keyVersion, dateÉmission, session8 }` (8 premiers
  caractères du session id). `keyVersion` permet la rotation de la clé privée
  si elle fuit un jour.
- **Journal des clés émises** dans Netlify Blobs (coût zéro, infra existante) :
  le support « j'ai perdu ma clé » se règle en 2 minutes depuis le dashboard
  Stripe (retrouver la session par email → rejouer la page de retour).
- **`revoked.json` dans le bundle** : la courte liste des `session8` révoqués
  (remboursements, chargebacks), rechargée à chaque déploiement. L'app refuse
  une clé révoquée. Pas de réseau, pas de base — un fichier statique.

### 4.2 La livraison (la v1 était factuellement fausse)

Stripe n'envoie **pas** d'email au contenu personnalisé — le reçu ne peut pas
porter la clé. Un acheteur mobile qui ferme l'onglet avant la page de retour
n'aurait jamais rien reçu.

- `success_url` avec `{CHECKOUT_SESSION_ID}` → page de retour qui appelle une
  fonction Netlify, laquelle vérifie la session auprès de Stripe côté serveur
  — **`payment_status === 'paid'` ET montant attendu**, jamais la simple
  existence de la session : un session id existe dès l'ouverture du checkout,
  avant paiement ; une session abandonnée collée dans l'URL ne doit pas
  produire de clé. Puis affiche la clé. Rejouable.
- **Email transactionnel réel** (Resend, gratuit à ce volume) déclenché par le
  webhook, contenant la clé **et un lien d'activation**
  `shibumap.com/#key=...` — la promesse « sur cet appareil et les suivants »
  devient un clic, pas un copier-coller.
- Webhook : signature vérifiée, idempotence par `event.id`, réponse 2xx < 5 s,
  **`checkout.session.completed` uniquement** — cartes seulement au départ,
  pas de moyens de paiement asynchrones (SEPA/iDEAL exigeraient
  `async_payment_succeeded` ; on verrouille le Payment Link sur cartes).
- **Test de bout en bout en mode test Stripe** (`stripe listen`) avant la mise
  en ligne, y compris le comportement pendant une panne de la fonction (les
  retries Stripe durent 3 jours).

### 4.3 Le lien de don est une cible

Un Payment Link public à montant libre est l'endroit préféré des bots de card
testing, même sur un site à faible trafic (les URL `buy.stripe.com` sont
scannées).

- **Montant minimum 2 €** sur le lien de don.
- **Radar activé** (inclus dans le tarif standard) + surveillance du taux
  d'échec les premières semaines.

### 4.4 Les chiffres à jour (2026)

| | Valeur vérifiée |
|---|---|
| Stripe carte EEE | 1,5 % + 0,25 € — confirmé |
| Litige | **~15 $ non remboursables** à la réception + ~15 $ si contestation perdue (plus les « 20 € » de la v1) |
| Stripe Managed Payments | **Preview à accès limité, examen d'éligibilité**, ~5 %+ tout compris en Europe. La Phase 5 est une intention **sous réserve d'éligibilité**, pas un plan daté |
| Lemon Squeezy | Racheté par Stripe, licence keys non reprises — toujours à éviter |
| Stripe Entitlements | Orienté abonnements + backend requis — ne remplace pas notre clé |

**Doctrine litiges, écrite d'avance** : à 19 €, contester coûte ~15 $ pour en
récupérer 19. Par défaut : **ne pas contester, rembourser vite au moindre
doute** (un remboursement précoce évite le litige et ses frais), et révoquer
la clé. On ne se bat que sur un motif manifestement frauduleux et répété.

**Propagation de la révocation** : l'ajout à `revoked.json` est déclenché par
les webhooks `charge.refunded` / `charge.dispute.created` (à la main au début
— une ligne dans la checklist du webhook), puis un redéploiement. Le délai de
quelques heures entre chargeback et prise d'effet est **assumé** : sans enjeu
à ce prix.

**Rail d'encaissement B2B** : **virement SEPA par défaut** (gratuit, et les
associations savent faire), lien de paiement Stripe en dépannage pour qui
veut payer par carte. Pas de Stripe Invoicing tant que dix factures/mois ne
sont pas dépassées.

### 4.5 L'honnêteté du modèle, écrite noir sur blanc

La signature Ed25519 est infalsifiable, mais le *contrôle* qui plafonne
l'export gratuit est trois lignes de JavaScript qu'un devtools contourne.
**C'est une boîte à honnêteté complète, et c'est le bon compromis à 19 €.**
Conséquence assumée : la valeur de l'offre organisateurs ne repose pas sur la
technique mais sur **la facture, la licence écrite et les livrables** (§5.2).

---

## 5. L'offre — la barrière se voit à l'écran, pas dans les CGV

### 5.1 Le Pass (B2C) — 19 € prix de lancement, cible 29 €

- Débloque : exports **2560 et 3840 px**, **vidéo HD**, **retrait du
  « shibumap.com »** des exports (la ligne de crédits ODbL reste, partout).
- Affiché **« Prix de lancement alpha — 19 € »**, avec engagement écrit : les
  premiers acheteurs gardent leurs acquis. Cible publique **29 €** à la sortie
  d'alpha — vendre l'accès perpétuel au prix plancher sans le nommer
  « lancement » interdirait toute hausse.
- Le moment du paiement ne change pas de la v1, c'est son meilleur passage :
  **après le rendu 4K, en entier**, l'aperçu réel à l'écran,
  `Télécharger en 1920 px` (gratuit, digne) à côté de
  `Télécharger en 4K — 19 €`. La frustration naît de l'impasse, pas du prix.

### 5.2 La Carte de course (B2B) — 250 à 400 € l'événement

La v1 proposait 90-150 € en citant elle-même l'ancrage « un graphiste coûte
plusieurs centaines à quelques milliers d'euros ». À 10-20 fois sous
l'alternative, on signale du gadget. Vérification marché : les services
événementiels facturent par module (tracking simple : ~25 €/carte, forfaits
complets 500 €+) ; les posters souvenir se vendent 30-60 € **à l'unité** au
coureur.

**Prix** : paliers par taille d'événement — **250 €** (< 500 coureurs),
**400 €** (grande course), **devis 700 €+** (affiche + site + vidéo teaser).
150 € reste le **plancher de négociation**, jamais le prix affiché. Ajuster
après trois ventes.

**La barrière matérielle** (ce que le Pass à 19 € ne donne PAS) :

- **PDF 300 DPI aux formats affiche** (A2/A0) — le livrable que l'imprimeur
  demande, que l'export écran ne produit pas
- **Permanence garantie du lien `/r/:id`** de la course
- **Facture en bonne et due forme** (l'association en a besoin)
- **Licence d'usage commercial écrite**
- Support direct — c'est un achat au téléphone, le vendeur est le support

Techniquement : **rien à construire.** Facture et clé émises à la main,
drapeau « commercial » dans le payload signé. ⚠️ Organisateur d'un autre pays
UE : numéro de TVA intracommunautaire, mention « Autoliquidation », DES
(détail en v1).

### 5.3 Ce qui reste gratuit, définitivement

Inchangé de la v1, c'est la ligne qui rend le produit partageable : toute la
visualisation, tous les styles et palettes, le GPX, le Race Studio, le partage
par lien, l'export **1920 px** (avec « shibumap.com »), la vidéo à la
résolution d'écran. **Le mode invité survit, on peut acheter sans compte.**

### 5.4 Les extensions notées, non engagées

- **Posters souvenir aux finishers** (via l'organisateur) : marché prouvé
  (Sportymaps, The Post Race, 30-60 €/unité). Extension naturelle du Race
  Studio — Phase 4, pas avant.
- **Print-on-demand** (Gelato/Printful) : le B2C solvable achète l'objet
  imprimé (Mapiful ne vend QUE ça, dès ~45 $). Une ligne de veille, pas un
  chantier.
- **La vidéo comme produit séparé** : c'est LE différenciateur (« cartes
  vivantes ») fondu dans le Pass. Si la conversion du Pass déçoit, tester la
  vidéo seule avant de toucher au prix.

### 5.5 Cohérence de discours

Le sous-titre du don devient **« l'exploration est gratuite et le restera »**
— la v1 disait « le projet est gratuit et le restera » deux clics avant de
vendre un pass à 19 €.

---

## 6. Les phases — le B2B ne passe plus après le B2C

L'erreur de séquence de la v1 : le B2C exige un volume qu'on n'a pas, le B2B
n'exige qu'un téléphone. Une vente organisateur = 15 pass, et chaque course
affichée est de la preuve sociale. Les deux moteurs démarrent **en parallèle**.

### Phase 0 — En règle, mesuré, raccordé (1 semaine, ~200 €/an)

Légal : mentions, CGV, médiateur, case de rétractation, message à kaolti,
appel au SIE (réserve n° 1), demande du numéro de TVA intracommunautaire.
Technique : analytics + 5 événements (§2) · « shibumap.com » sur les exports
gratuits · page `/pricing` · lien de don (minimum 2 €, Radar) dans le menu
Aide · rate limit sur `race.mjs` + TTL des blobs · `sanitizeSvgMarkup` sur le
logo. **Ce qu'on apprend** : le trafic réel, le funnel réel, les dons.

### Phase B2B — en PARALLÈLE de la Phase 0 (continu, 0 dev)

- **Liste nominative de 30 courses alpines** — Annecy est un avantage
  concurrentiel que la v1 n'exploitait pas : Maxi-Race sur place, écosystème
  UTMB à une heure.
- **Calendrier saisonnier** : les affiches se commandent 4-6 mois avant
  l'événement. Rater la fenêtre = rater un an. Prioriser les courses de
  l'automne/hiver prochain, maintenant.
- **L'arme d'ouverture : la carte déjà faite.** Avant de contacter un
  organisateur, rendre la carte de SA course (20 minutes par course) et
  joindre le lien au premier email : « voici la Maxi-Race en 3D, cliquez ».
  Ça convertit sans pitch, et chaque démo crée une page `/r/:id` indexable.
  **Cinq cartes-démo des courses prioritaires, faites dès la Phase 0.**
- **Une cadence écrite : 5 contacts/semaine** — sans elle, « continu, 0 dev »
  devient « jamais ».
- La question qui vaut de l'or, inchangée : *« combien te coûte ta carte
  aujourd'hui, et qui te la fait ? »*
- Vente au téléphone et à l'email, facture à la main, clé à la main.
- **Le renouvellement, prévu dès la première licence** : une course est
  annuelle — la licence écrite est valable UN an d'événement, plein tarif
  l'année suivante avec mise à jour du parcours incluse. La politique
  d'incitation au re-booking anticipé (-20 % avant une date ?) se décide
  après les trois premières ventes, mais la durée d'un an s'écrit dans la
  licence dès la première. C'est là que vit toute la valeur long terme du B2B.
- **Le PDF 300 DPI se construit au premier intérêt sérieux, pas après
  signature** — c'est la pièce maîtresse de la promesse, on ne peut pas la
  livrer en retard sur la toute première référence. Et l'exemplaire de
  démonstration (une course fictive, validé par un vrai imprimeur) sert
  d'argument de vente à tous les appels suivants.

### Phase 1 — Le Pass (3 jours de dev, 0 €/mois)

Payment Link + cycle de vie complet de la clé (§4). Pas de compte, pas de
base, pas de page produit. **Ce qu'on apprend** : la conversion réelle sur un
funnel mesuré — et grâce au §2, on sait l'interpréter.

### Phase 2 — Les comptes, quand on les réclame (3-4 semaines)

Déclencheurs inchangés de la v1 (un organisateur publie une 2ᵉ course, ou
trois demandes de récupération). Clerk gratuit ou Netlify Identity + Netlify
DB. L'email capturé en Phase 0 (§3) devient l'actif de lancement.

### Phase 3 — Souvenir coureurs et print-on-demand

Déclencheur : un organisateur demande « mes coureurs peuvent l'avoir ? », ou
trois particuliers demandent une impression.

### Phase 4 — Marchand de référence, sous réserve d'éligibilité

Déclencheur inchangé (approche des 37 500 €, ou hors-UE significatif). Stripe
Managed Payments est en preview sur examen — **candidater le jour du
déclencheur, sans en faire une dépendance du plan**.

---

## 7. Ce qui est formellement déconseillé — inchangé, plus trois lignes

Le tableau de la v1 (§8) tient. S'y ajoutent :

| À ne pas faire | Pourquoi |
|---|---|
| Moyens de paiement asynchrones au lancement | SEPA/iDEAL exigent un second événement webhook et un état « en attente » — cartes uniquement tant que le volume ne le force pas |
| Vendre « à vie » sans étiquette de lancement | Interdit toute hausse de prix future sans trahison |
| Compter sur la redirection Stripe pour livrer | La page de retour se ferme, surtout mobile — l'email transactionnel est la livraison, la page de retour est le confort |

---

## 8. Récapitulatif des actions sur le site

Dans l'ordre, avec l'effort :

| # | Action | Effort | Phase |
|---|---|---|---|
| 1 | Analytics + 5 événements de funnel | ½ j | 0 |
| 2 | « shibumap.com » sur exports gratuits (+ vidéo) | ½ j | 0 |
| 3 | Pages légales + CGV + médiateur + case rétractation | ½ j | 0 |
| 4 | Page `/pricing` | ½ j | 0 |
| 5 | Item « Soutenir » (menu Aide) → Payment Link don, min 2 €, Radar | 1 h | 0 |
| 6 | Rate limit `race.mjs` + TTL blobs + sanitize logo | ½ j | 0 |
| 7 | Fonction webhook + émission de clé déterministe + journal Blobs | 1 j | 1 |
| 8 | Page de retour rejouable + email Resend + lien `#key=` | ½ j | 1 |
| 9 | Vérification Ed25519 dans l'app + champ Paramètres + `revoked.json` | ½ j | 1 |
| 10 | Modale d'export : puce sur 2560/3840/vidéo + double bouton | ½ j | 1 |
| 11 | Export PDF 300 DPI formats affiche (livrable B2B) | 2-3 j | B2B, à la 1ʳᵉ vente |

Total avant le premier euro B2C : **~4 jours de développement**. Le B2B peut
encaisser **avant tout développement** (facture manuelle).

---

## 9. Sources ajoutées en v2

Benchmarks conversion freemium (First Page Sage 2026, Lenny's Newsletter) ·
Mapiful / Sportymaps / The Post Race / Run Ink (marché posters) · Racemap
(pricing événementiel) · Stripe docs : Managed Payments eligibility,
Entitlements, dispute fees 2025-2026 (Chargeflow) · Polar Plans (mai 2026) ·
Resend pricing. Les sources fiscales et juridiques sont en v1 §10.

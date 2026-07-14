# ShibuMap — Plan de campagne 1 mois (13 juillet → 9 août 2026)

**Objectif unique : notoriété + utilisation.** Pas de revenu, pas de conversion payante.
**Budget : 100 € max.** Tout le reste est organique.
**Angle : « c'est beau », jamais « c'est précis ».** Gratuit, dans le navigateur, crédit kaolti partout.
**Compte émetteur : adrienagency** (X, Instagram, TikTok, LinkedIn, Reddit, YouTube).

---

## 1. Stratégie en 5 lignes

1. **Le produit EST le contenu.** Chaque plan de 10 s tourné pour la vidéo est un post autonome → série « One place a day » qui remplit le mois sans effort de production.
2. **Deux gros temps forts gratuits à fort levier** : Show HN (Hacker News) et Product Hunt — c'est là que les outils web gratuits explosent, pas sur les réseaux.
3. **Les relais > les followers.** On n'a pas d'audience : on va chercher les gens qui en ont (geo-Twitter, cartographes, newsletters de belles choses du web) avec un outil qui fait exactement leur contenu à leur place.
4. **Le GPX est le cheval de Troie outdoor** : les randonneurs/traileurs cherchent tous une belle façon de montrer leur trace. « Ta rando en maquette de musée » est un usage viral naturel.
5. **Les 100 € servent uniquement à amplifier ce qui a déjà gagné organiquement** (boost du meilleur Reel à J+12), jamais à parier à l'aveugle.

## 2. Assets disponibles (rien à produire en urgence)

- `shibumap-launch-16x9.mp4` (30 s, 20 plans) → YouTube, X, LinkedIn, Product Hunt.
- `shibumap-launch-30s.mp4` (verticale) → Reels, TikTok, Shorts.
- **22 clips de 10 s** (`shots-v3/`) → la série quotidienne. Je peux générer les recadrages 9:16 par lot (ffmpeg) à la demande.
- 9 clips verticaux (`shots-v2/`) → stories / bonus.
- Captures fixes (Isolate Corse/Islande, templates) → posts images, galerie Product Hunt.

## 3. Budget (100 €)

| Poste | Montant | Quand | Détail |
|---|---|---|---|
| Boost Meta (Instagram Reels) du meilleur clip organique | 70 € | J+12 → J+19 | Ciblage intérêts : randonnée, cartographie, design, voyage. Zones : FR + US/UK. On choisit le clip avec le meilleur ratio vues/interactions des 12 premiers jours. |
| Concours « ta plus belle carte » — 2 tirages poster A3 + envoi | 30 € | Semaine 4 | Print-on-demand. Le concours force l'USAGE (il faut créer sa carte pour participer). |
| Tout le reste | 0 € | — | Organique + outreach manuel. |

**Mesure (0 €)** : ajouter GoatCounter (gratuit, sans cookie) sur shibumap.com avant J0 — sinon on pilote à l'aveugle. Objectifs mois 1 : **5 000 visites uniques, 300 exports, 50 retours bugs/idées.**

## 4. Calendrier — 4 semaines

### Semaine 1 (13–19 juil) — LANCEMENT
- **Lun 13** : préparation — GoatCounter posé, recadrages 9:16 des clips, galerie PH prête.
- **Mar 14 (J0 — le 14 Juillet !)** : X thread (matin) + LinkedIn FR (matin) + Reel/TikTok « France isolée sur son socle » (18h) — le clin d'œil 14 Juillet est le hook parfait pour l'audience FR.
- **Mer 15** : **Show HN** (15h FR = matin US). Texte §6.
- **Jeu 16** : Reddit r/InternetIsBeautiful (14h FR).
- **Ven 17** : Reddit r/MapPorn + clip du jour (Matterhorn).
- **Sam 18–Dim 19** : clips du jour (Santorin, Fuji) — le week-end marche bien pour le contenu contemplatif.

### Semaine 2 (20–26 juil) — PRODUCT HUNT + OUTREACH
- **Mar 21** : **Product Hunt** (lancement 00h01 PT = 9h FR). Toute la journée : répondre à chaque commentaire.
- **Mer 22** : X — post « behind the scenes » (fork open source, merci kaolti, stack Three.js) + post r/threejs « how it's built ».
- **Jeu 23** : **vague d'outreach n°1** — 10 DM/emails (geo-Twitter + newsletters, §7).
- **Ven 24** : Reddit r/hiking ou r/trailrunning — angle GPX (§6).
- **Tous les jours** : clip du jour (Corse, avion, Kilimandjaro, templates-morph…).

### Semaine 3 (27 juil – 2 août) — AMPLIFICATION
- **Lun 27** : bilan chiffré → choisir LE clip gagnant → **lancer le boost 70 €**.
- **Mar 28** : X thread « the making of » (les nuages volumétriques, les lacs de verre — geo-Twitter adore les détails techniques).
- **Jeu 30** : **vague d'outreach n°2** — 10 cibles outdoor/influenceurs FR.
- **Tous les jours** : clips du jour + republier les cartes des utilisateurs (RT/repost systématique de tout UGC).

### Semaine 4 (3–9 août) — CONCOURS + BILAN
- **Lun 3** : lancement concours « ta plus belle carte » (§5, post dédié) — 2 posters A3 imprimés à gagner. Durée 7 jours.
- **Mer 5** : post récap des retours + « fixed » nominatifs (montrer qu'on écoute = fidélisation).
- **Ven 7** : relance concours avec les meilleures participations reçues.
- **Dim 9** : clôture + annonce gagnants + thread bilan « 1 month of ShibuMap » (chiffres honnêtes, apprentissages — le build-in-public performe).

---

## 5. Posts prêts à publier

### J0 — Reel/TikTok 14 Juillet (clip Corse/France isolée)
> La France, posée sur son socle. 🇫🇷
> Tapez n'importe quel lieu, isolez-le, changez la lumière, exportez.
> Gratuit, dans le navigateur → shibumap.com
> #14juillet #carte #relief #3d #design #france

*(Les posts J0 X/LinkedIn/IG génériques et Reddit r/MapPorn sont déjà prêts dans `campagne-lancement.md` — inchangés.)*

### Show HN (mer 15 juil)
**Titre :** Show HN: ShibuMap – Turn any place on Earth into a vintage 3D relief map (free, in-browser)
> I built a browser tool that renders any place as a museum-style relief model — volumetric clouds, glass lakes, sunset lighting, country cutouts on a display plate. You can import a GPX track and watch it fly over the terrain, then export images or record video.
>
> Three.js + free DEM tiles. It's a fork of kaolti's open-source monolith-terrain — all credit for the foundation goes to them.
>
> Fair warning: I optimized for *pretty*, not survey-grade accuracy. Desktop/tablet only for now. I'd love bug reports and ideas: https://shibumap.com

### Reddit r/InternetIsBeautiful (jeu 16 juil)
**Titre :** A free site that turns any place on Earth into a quiet, vintage-style 3D relief map
> Search a place, watch it rise, change the light, export it. No account, no install — it runs in your browser. Free. Built on open-source work by kaolti. Desktop/tablet only. I'm actively hunting bugs and ideas, tell me everything.

### Reddit r/hiking / r/trailrunning (ven 24 juil) — angle GPX
**Titre :** I made a free tool that turns your GPX track into a flyover of a vintage relief map
> Drop your GPX on shibumap.com and it draws your route over a museum-style 3D terrain model — then flies the camera along it. You can export a video of your hike. Free, in-browser, desktop/tablet. Would love feedback from people with actual epic tracks (mine are embarrassingly flat).

### r/threejs / Discord poimandres (mer 22 juil)
**Titre :** ShibuMap — vintage relief maps in the browser (Three.js + pmndrs postprocessing + MeshTransmissionMaterial)
> Raymarched volumetric clouds from a baked 3D noise texture, lakes carved into the DEM with a vendored MeshTransmissionMaterial, DoF/grain/vignette via pmndrs postprocessing. Forked from kaolti/monolith-terrain. Happy to answer anything about the pipeline.

### Product Hunt (mar 21 juil)
- **Tagline :** Any place on Earth, as a vintage 3D relief map
- **Description :** Search a place and watch it rise as a museum-style relief model. Shape the clouds, the light, the water. Isolate a whole country on its display plate. Import a GPX and fly over your own track. Export images and videos. Free, in your browser.
- **Premier commentaire (maker) :** Hey PH! I optimized this for *beautiful*, not *accurate* — it's an art piece you can play with, built on kaolti's wonderful open-source monolith-terrain. It's young: I want your bugs and your wildest feature ideas. Everything is free.

### Thread X « making of » (mar 28 juil) — 3 tweets
> **1/** The clouds in ShibuMap are raymarched volumes shaped by a baked 3D noise field — they drift, they cast real shadows on the terrain.
> **2/** The lakes are carved into the elevation model and filled with a transmission material — glass, refraction, waves. Getting Lake Annecy to *not* look like a donut took three attempts.
> **3/** All of it free, in your browser: shibumap.com — forked from @kaolti's open-source monolith-terrain. Bugs and ideas welcome.

### Concours (lun 3 août)
> 🏆 Ta plus belle carte.
> Crée ta carte sur shibumap.com (ton village, ta rando, ton volcan préféré), exporte-la, poste-la avec #shibumap en me taguant.
> Les 2 plus belles gagnent leur carte **imprimée en poster A3**, envoyée chez elles.
> Clôture dimanche 9 août. Jury : moi, ma mauvaise foi, et la lumière de fin de journée.

### Série « One place a day » — banque de légendes (clips 10 s)
Format fixe : 1 ligne + lien + 4 hashtags (#maps #3d #relief #design + 1 local). Ordre de publication conseillé (garder les héros pour les jours creux) :
1. Matterhorn — *Five minutes before the light goes.*
2. Santorini — *A caldera on a sea of glass.*
3. Fuji — *Symmetry, as seen from nowhere.*
4. Corsica isolate — *An island, served on its plate.*
5. Plane over Chamonix — *Window seat, forever.*
6. Templates morph — *Same fjord, four worlds.*
7. Kilimanjaro — *Snow, three degrees south of the equator.*
8. Everest — *The roof, from above the roof.*
9. Lofoten — *Mountains that decided to swim.*
10. Wadi Rum — *Mars, with better sunsets.*
11. Torres del Paine — *Granite, straight out of the oven.*
12. Vatnajökull — *An ice cap doing its quiet thing.*
13. Zhangjiajie — *The mountains that inspired Avatar.*
14. Grand Canyon — *Two billion years, one glance.*
15. Annapurna — *A wall you can rotate.*
16. Geiranger — *A fjord, bottled.*
17. Guilin — *Karst, in stone-washed light.*
18. Aoraki — *The cloud piercer.*
19. UI complète — *Everything you saw: made with this.*
20. Rocket — *We may have added a rocket. For science.*

---

## 6. Influenceurs & relais — qui, pourquoi, comment

**Règle d'or : ne rien demander.** On offre un outil qui fabrique LEUR contenu. Le message donne le lien, un exemple fait POUR EUX (leur région, leur dernière rando), et c'est tout.

### Tier 1 — geo-Twitter / cartographes (le plus réaliste, le plus rentable)
Ces comptes vivent de belles cartes et repartagent facilement les outils :
- **Topi Tjukanov** (@tjukanov) — artiste géospatial, énorme dans la niche, adore les rendus terrain.
- **John Nelson** (ESRI, blog adventuresinmapping) — LE spécialiste du style relief vintage, c'est exactement son esthétique.
- **Andrei Kashcha** (@anvaka, créateur de city-roads) — projet cousin, audience identique, très bienveillant avec les makers.
- **Daniel Huffman** (somethingaboutmaps) — cartographe shaded-relief.
- **Simon Kuestenmacher** (@simongerman600) — poste des cartes tous les jours, gros reach.
- **Terrible Maps / Amazing Maps** — comptes de curation, repostent facilement.

### Tier 2 — newsletters « belles choses du web » (1 mention = des milliers de visiteurs qualifiés)
- **Dense Discovery** (Kai Brach) — outils web beaux et poétiques, fit parfait.
- **Naive Weekly** (Kristoffer Tjalve) — le web poétique, exactement l'esprit shibumi.
- **Kottke.org** (Jason Kottke) — poste régulièrement de l'art cartographique.
- **Web Curios** (Matt Muir) — curation d'outils web étranges et beaux.
- **Recomendo** (Kevin Kelly & co) — courts, grand reach.

### Tier 3 — outdoor / GPX (usage viral)
- Créateurs rando/trail FR sur Instagram (démo : LEUR trace en flyover — demander leur GPX public Strava et faire la vidéo pour eux).
- **Kilian Bron** (MTB cinématique, montagnes) — esthétique très proche.
- Clubs Strava et groupes Facebook rando (poster une démo, pas un lien sec).

### Tier 4 — les long shots gratuits (1 email, on n'y croit pas mais ça coûte 0)
- Johnny Harris, Map Men, GeoWizard, RealLifeLore, Atlas Pro. Un seul email court chacun, jamais de relance.

*(Vérifier chaque handle avant envoi — les comptes bougent.)*

### DM type (EN)
> Hi [Name] — I made a free browser tool that turns any place into a vintage-style 3D relief map (volumetric clouds, glass lakes, country cutouts). Given what you make, I thought it might be fun for you to play with: shibumap.com
> Here's [their region / their last track] rendered with it: [capture/clip fait pour eux]
> No ask — just thought you'd enjoy it. It's free and built on kaolti's open-source work.

### DM type (FR)
> Salut [Prénom] — j'ai fait un outil gratuit qui transforme n'importe quel lieu en carte-relief 3D vintage, dans le navigateur. Vu ce que tu crées, je me suis dit que ça pouvait te plaire : shibumap.com
> Tiens, [ta dernière trace / ta région] rendue avec : [capture/clip]
> Rien à me retourner — juste pour le plaisir. C'est gratuit et construit sur le travail open source de kaolti.

---

## 7. Rythme hebdo récapitulatif (charge : ~30 min/jour)

| Jour | Action quotidienne |
|---|---|
| Chaque jour | 1 clip « one place a day » (Reels+TikTok+Shorts, même fichier) + répondre à TOUS les commentaires |
| Mar | Temps fort (thread X / PH / making-of) |
| Jeu | Outreach (5 DM max, personnalisés) |
| Ven | Reddit (1 sub, jamais deux le même jour) |
| Dim | Repost du meilleur UGC de la semaine |

## 8. Règles de réponse (rappel — détails dans campagne-lancement.md)

- Bug → merci nominatif + revenir dire « fixed ».
- « Pas précis » → « It's a picture of the world, not a survey. Pretty first. »
- Mobile → « Tablet works today; phones need more love. »
- Toujours créditer kaolti.
- **Chaque carte d'utilisateur repostée = un ambassadeur créé.** Ne jamais en laisser passer une.

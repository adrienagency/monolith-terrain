// LES PETITES PHRASES DE CHARGEMENT — le stock, et rien d'autre.
//
// ────────────────────────────────────────────────────────────────────────────
// AJOUTER UNE PHRASE : écris une ligne dans la bonne liste. C'est tout.
// Aucun autre fichier à toucher, aucun compteur à mettre à jour.
//
//   { id: 'un-id-unique', text: 'La phrase.' }
//
// L'`id` ne sert qu'à la mémoire anti-répétition (hints.js) : il doit être
// unique dans tout le fichier, il n'est jamais affiché. Un test le vérifie.
//
// AJOUTER UN FAIT DE LIEU : une entrée dans LIEUX, tout en bas. Coordonnées,
// rayon en kilomètres, et une ou plusieurs lignes.
// ────────────────────────────────────────────────────────────────────────────
//
// TROIS RÈGLES, dans l'ordre où elles comptent.
//
// 1. TUTOIEMENT. ShibuMap tutoie (Adrien). Un test refuse « vous » ici.
//
// 2. LA PHRASE DOIT ÊTRE VRAIE. Pas « bientôt vraie », pas « vraie dans une
//    autre branche » : vraie sur le site en ligne. Une promesse creuse coûte
//    plus cher qu'un chargement muet — le visiteur cherche la chose, ne la
//    trouve pas, et cesse de croire les suivantes. Chaque astuce ci-dessous
//    renvoie à un raccourci de src/shortcuts.js ou à un panneau qui existe.
//
// 3. L'UTILE AVANT LE DRÔLE. Ces phrases s'affichent pendant une ATTENTE, et
//    seront relues des dizaines de fois par un habitué. Une blague vue trois
//    fois agace ; une astuce qu'on avait oubliée, jamais. D'où la répartition
//    des poids dans hints.js : le fait du lieu d'abord, l'astuce ensuite,
//    l'appel au partage en dernier et rarement.
//
// Le ton est celui du reste du site : sobre, court, une seule idée par
// phrase. Pas d'exclamation en série, jamais de publicité.

// ---------------------------------------------------------------------------
// ASTUCE — apprendre une fonction qu'on ignorait. La catégorie la plus utile.
// Chaque ligne est vérifiable : raccourci réel, panneau réel.
// ---------------------------------------------------------------------------
const astuce = [
  { id: 'a-eau', text: 'La touche W allume et éteint l’eau d’un coup : mers, lacs et rivières.' },
  { id: 'a-ui', text: 'H efface toute l’interface. Il ne reste que la carte.' },
  { id: 'a-coord', text: 'La barre de recherche prend aussi des coordonnées. Colle « 45.83, 6.86 » et vois.' },
  { id: 'a-numpad', text: 'Le pavé numérique pilote la caméra : 5 pour la vue du dessus, 7 et 9 pour les isométriques.' },
  { id: 'a-export', text: 'E ouvre l’export — une image en haute définition, ou une vidéo.' },
  { id: 'a-globe', text: 'Recule assez loin et la carte redevient une planète, qui tourne lentement.' },
  { id: 'a-iso', text: 'Un clic sur l’icône isométrique pose le bloc comme une pièce de musée : socle et cartouche compris.' },
  { id: 'a-region', text: 'I découpe la zone administrative et laisse tomber le reste du bloc.' },
  { id: 'a-courbes', text: 'C pose les courbes de niveau, G la grille.' },
  { id: 'a-routes', text: 'R montre ou cache les routes, P les noms de lieux.' },
  { id: 'a-sombre', text: 'D bascule l’interface en sombre. Le relief, lui, ne bouge pas.' },
  { id: 'a-undo', text: 'Ctrl + Z défait le dernier réglage. Un tâtonnement ne coûte donc rien.' },
  { id: 'a-raccourcis', text: 'Shift + ? affiche tous les raccourcis clavier, d’un seul écran.' },
  { id: 'a-recadre', text: 'F recadre la vue quand tu t’es perdu dans le zoom.' },
  { id: 'a-heure', text: 'Le curseur d’heure déplace le soleil de l’aube à la nuit, et peut tourner tout seul.' },
  { id: 'a-boutique', text: 'Dans la boutique, un template s’essaie en direct sur ta carte avant que tu ne gardes quoi que ce soit.' },
  { id: 'a-gpx', text: 'Lâche un fichier GPX n’importe où sur la page : le relief se cadre tout seul autour de la trace.' },
  { id: 'a-plongee', text: 'Plus tu plonges, plus le terrain s’affine — les altitudes se rechargent à chaque palier.' },
  { id: 'a-palette', text: 'La palette teinte l’altitude, du fond de mer aux sommets. Tu peux aussi en tirer une au sort.' },
  { id: 'a-course', text: 'Un GPX de course devient une carte d’organisateur dans le Race Studio : points de passage, transports, partage.' },
  { id: 'a-studio', text: 'Le Studio habille la carte en cinq étapes, et tout s’applique en direct sur l’aperçu.' },
]

// ---------------------------------------------------------------------------
// MONDE — laisser entrevoir qu'il se passe des choses. La catégorie fragile :
// c'est ici qu'on ment le plus facilement. Chaque ligne renvoie à un module
// qui tourne vraiment (fleet.js, daycycle.js, bathy.js, clouds-sim.js).
// ---------------------------------------------------------------------------
const monde = [
  // fleet.js : SEE_CHANCE = 0,1 et MIN_ZOOM = 11. Le chiffre est le vrai.
  { id: 'm-bateau', text: 'Passé un certain zoom, un vapeur traverse parfois la mer du bloc. Une carte sur dix, pas plus.' },
  // boats.js injecte le shader de houle de la mer dans celui du bateau
  { id: 'm-houle', text: 'Le bateau ne flotte pas sur une mer plate : il est porté par la houle que la carte calcule.' },
  // daycycle.js : position solaire vraie pour la latitude du bloc
  { id: 'm-soleil', text: 'À 18 h, la lumière vient d’où le soleil se tient vraiment au-dessus de ce bloc-là, ce soir-là.' },
  { id: 'm-crepuscule', text: 'Entre le jour et la nuit il y a trois crépuscules. La carte les traverse un par un.' },
  // clouds-sim.js + le vent d'effects-panel
  { id: 'm-vent', text: 'Le vent pousse vraiment les nuages. Coupe-le, et ils se figent.' },
  // bathy.js : GEBCO_2026, 464 m de résolution
  { id: 'm-fonds', text: 'Sous la mer aussi le relief est vrai. Les fonds descendent au même titre que les sommets montent.' },
  { id: 'm-mnt', text: 'Rien n’est dessiné à la main : chaque bloc est un morceau de modèle d’élévation réel.' },
  { id: 'm-evenements', text: 'De petites choses arrivent parfois sur ShibuMap. Elles ne préviennent pas.' },
]

// ---------------------------------------------------------------------------
// APPEL — partager, donner son avis. Rare par construction (voir POIDS).
// ---------------------------------------------------------------------------
const appel = [
  { id: 'p-fan', text: 'Toi aussi tu es fan de Shibu ? Partage ta carte.' },
  { id: 'p-avis', text: 'Un avis sur ShibuMap, une idée, un truc qui coince ? Il nous intéresse.' },
  { id: 'p-lien', text: 'Une carte réussie mérite un lien : Publier copie la vue entière dans le presse-papier.' },
]

export const HINTS = { astuce, monde, appel }

// ---------------------------------------------------------------------------
// LIEUX — le fait géographique, celui qui parle de l'endroit qu'on charge.
//
// `rayonKm` est la distance au centre du bloc en deçà de laquelle la zone
// répond. À régler sur la TAILLE DE L'OBJET, pas sur celle du bloc : 20 km
// pour un volcan, 300 km pour une île-continent. Trop large, et la phrase se
// déclenche sur un voisin auquel elle ne s'applique pas.
//
// ⚠️ Les altitudes ci-dessous sont des valeurs publiées, pas des mesures du
// MNT. Elles ne bougeront pas si la source d'altitude change — c'est voulu :
// une phrase qui cite « 4 806 m » parle du Mont Blanc, pas du pixel le plus
// haut de la dalle. Pour ça il y a la phrase mesurée, dans hints.js.
// ---------------------------------------------------------------------------
export const LIEUX = [
  {
    nom: 'La Réunion',
    lat: -21.12,
    lon: 55.52,
    rayonKm: 60,
    lignes: [
      'Le Piton de la Fournaise culmine à 2 632 m, et entre en éruption presque chaque année.',
      'Le Piton des Neiges, 3 070 m, est le point le plus haut de l’océan Indien.',
    ],
  },
  {
    nom: 'Mont Blanc',
    lat: 45.83,
    lon: 6.87,
    rayonKm: 30,
    lignes: [
      'Le Mont Blanc tourne autour de 4 806 m. Le chiffre exact change chaque année : la neige du sommet se déplace.',
      'La Mer de Glace descend juste à côté. Elle recule d’une trentaine de mètres par an.',
    ],
  },
  {
    nom: 'Cervin',
    lat: 45.98,
    lon: 7.66,
    rayonKm: 20,
    lignes: ['Le Cervin monte à 4 478 m. Sa pointe appartient à la plaque africaine, posée là sur l’Europe.'],
  },
  {
    nom: 'Dolomites',
    lat: 46.62,
    lon: 12.3,
    rayonKm: 45,
    lignes: ['Les Dolomites étaient un récif corallien. Ces tours de calcaire ont poussé sous une mer tropicale.'],
  },
  {
    nom: 'Etna',
    lat: 37.75,
    lon: 14.99,
    rayonKm: 30,
    lignes: ['L’Etna approche les 3 350 m, et sa hauteur change à chaque éruption. C’est le plus haut volcan actif d’Europe.'],
  },
  {
    nom: 'Stromboli',
    lat: 38.79,
    lon: 15.21,
    rayonKm: 15,
    lignes: ['Stromboli crache toutes les vingt minutes environ, sans interruption connue depuis l’Antiquité.'],
  },
  {
    nom: 'Vésuve',
    lat: 40.82,
    lon: 14.43,
    rayonKm: 20,
    lignes: ['Le Vésuve fait 1 281 m et surveille trois millions de personnes. C’est le volcan le plus densément entouré au monde.'],
  },
  {
    nom: 'Santorin',
    lat: 36.4,
    lon: 25.4,
    rayonKm: 25,
    lignes: ['Ce demi-cercle est le bord d’un cratère. L’éruption minoenne a fait s’effondrer le centre de l’île dans la mer.'],
  },
  {
    nom: 'Corse',
    lat: 42.15,
    lon: 9.1,
    rayonKm: 90,
    lignes: ['Le Monte Cinto monte à 2 706 m. La Corse est la plus montagneuse des îles de Méditerranée.'],
  },
  {
    nom: 'Islande',
    lat: 64.9,
    lon: -19,
    rayonKm: 300,
    lignes: ['L’Islande est le seul endroit où la dorsale médio-atlantique sort de l’eau. L’île s’écarte d’elle-même de deux centimètres par an.'],
  },
  {
    nom: 'Pyrénées',
    lat: 42.63,
    lon: 0.66,
    rayonKm: 70,
    lignes: ['L’Aneto, 3 404 m, est le toit des Pyrénées. Son glacier a perdu plus de la moitié de sa surface en un siècle.'],
  },
  {
    nom: 'Verdon',
    lat: 43.75,
    lon: 6.4,
    rayonKm: 25,
    lignes: ['Les gorges du Verdon descendent jusqu’à 700 m sous le plateau. La rivière a scié le calcaire pendant des millions d’années.'],
  },
  {
    nom: 'Auvergne',
    lat: 45.53,
    lon: 2.81,
    rayonKm: 45,
    lignes: ['Le puy de Sancy, 1 886 m, est le sommet du Massif central. C’est un volcan, éteint depuis 220 000 ans.'],
  },
  {
    nom: 'Ventoux',
    lat: 44.17,
    lon: 5.28,
    rayonKm: 20,
    lignes: ['Le Ventoux monte à 1 910 m au-dessus d’une plaine plate. Le blanc du sommet n’est pas de la neige, c’est du calcaire nu.'],
  },
  {
    nom: 'Everest',
    lat: 27.99,
    lon: 86.93,
    rayonKm: 60,
    lignes: ['L’Everest est mesuré à 8 849 m. Il gagne quelques millimètres par an : l’Inde pousse toujours sous l’Asie.'],
  },
  {
    nom: 'Fuji',
    lat: 35.36,
    lon: 138.73,
    rayonKm: 30,
    lignes: ['Le Fuji fait 3 776 m et se voit depuis Tokyo, à cent kilomètres. Sa dernière éruption date de 1707.'],
  },
  {
    nom: 'Kilimandjaro',
    lat: -3.07,
    lon: 37.35,
    rayonKm: 45,
    lignes: ['Le Kilimandjaro, 5 895 m, monte seul au-dessus de la savane. Il porte des glaciers à trois degrés de l’équateur.'],
  },
  {
    nom: 'Grand Canyon',
    lat: 36.1,
    lon: -112.1,
    rayonKm: 70,
    lignes: ['Le Grand Canyon descend de plus de 1 600 m. Ses roches du fond ont près de deux milliards d’années.'],
  },
  {
    nom: 'Death Valley',
    lat: 36.5,
    lon: -117,
    rayonKm: 70,
    lignes: ['Badwater est à 86 m sous le niveau de la mer, et le Telescope Peak à 3 366 m juste au-dessus. Le plus grand écart des États-Unis.'],
  },
  {
    nom: 'Denali',
    lat: 63.07,
    lon: -151,
    rayonKm: 60,
    lignes: ['Le Denali monte à 6 190 m. Vu de sa base, c’est le plus grand dénivelé de toutes les montagnes terrestres.'],
  },
  {
    nom: 'Aconcagua',
    lat: -32.65,
    lon: -70.01,
    rayonKm: 50,
    lignes: ['L’Aconcagua, 6 961 m, est le plus haut sommet en dehors de l’Asie.'],
  },
  {
    nom: 'Hawai‘i',
    lat: 19.6,
    lon: -155.5,
    rayonKm: 110,
    lignes: [
      'Le Mauna Kea sort de l’eau à 4 207 m, mais sa base est 6 000 m plus bas. De pied en cap, c’est la plus haute montagne du monde.',
      'Le Kīlauea est l’un des volcans les plus actifs de la planète. Il coule presque en continu depuis 1983.',
    ],
  },
  {
    nom: 'Uluru',
    lat: -25.34,
    lon: 131.03,
    rayonKm: 30,
    lignes: ['Uluru dépasse la plaine de 348 m, et continue sous terre sur plusieurs kilomètres.'],
  },
  {
    nom: 'Mer Morte',
    lat: 31.5,
    lon: 35.4,
    rayonKm: 50,
    lignes: ['La rive de la mer Morte est à 430 m sous le niveau des océans. C’est le point le plus bas de la terre ferme.'],
  },
  {
    nom: 'Le Cap',
    lat: -33.95,
    lon: 18.42,
    rayonKm: 30,
    lignes: ['La Montagne de la Table s’arrête net à 1 086 m. Son plateau est plus vieux que l’Himalaya de plusieurs centaines de millions d’années.'],
  },
  {
    nom: 'Skye',
    lat: 57.3,
    lon: -6.2,
    rayonKm: 45,
    lignes: ['Les Cuillin de Skye ne montent qu’à 992 m, mais ils partent du niveau de la mer. C’est la crête la plus rude de Grande-Bretagne.'],
  },
  {
    nom: 'Fjords de Norvège',
    lat: 62.1,
    lon: 7,
    rayonKm: 120,
    lignes: ['Ces vallées ont été creusées par des glaciers, puis noyées par la mer. Le Sognefjord descend à 1 300 m sous la surface.'],
  },
  {
    nom: 'Tahiti',
    lat: -17.65,
    lon: -149.45,
    rayonKm: 35,
    lignes: ['L’Orohena monte à 2 241 m au milieu du Pacifique. Tahiti est la pointe d’un volcan posé sur un fond à 4 000 m.'],
  },
]

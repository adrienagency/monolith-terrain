// Garde-fous de taille de rendu — pourquoi un canevas de 0 px est un piège.
//
// Un conteneur peut valoir 0×0 le temps d'un souffle : onglet en arrière-plan,
// panneau replié, iframe pas encore posée. L'événement `resize` part quand même,
// et `camera.aspect = 0 / 0` vaut NaN. `updateProjectionMatrix()` recopie alors
// ce NaN dans l'élément [0] de la matrice de projection — sans une exception,
// sans un mot en console.
//
// LE SYMPTÔME EST MUET. Seul l'élément [0] dépend de l'aspect, donc
// `Vector3.project()` continue de rendre des y et z parfaitement justes et
// n'annonce rien ; c'est x qui devient NaN. Tout ce qui est ancré en espace
// écran — repères de sommet, cartouches de course — reçoit un
// `transform: translate(NaNpx, …)` que le navigateur ignore purement et
// simplement : l'élément retombe à l'origine. Aucune erreur, juste des étiquettes
// collées dans le coin.
//
// ET IL EST DÉFINITIF. Constaté le 27/07/2026 dans une preview en panneau
// masqué : quand le canevas retrouve 1280×720, l'aspect vaut TOUJOURS NaN. Rien
// ne le recalcule au fil du rendu ; il faut un nouvel événement de
// redimensionnement valide pour l'écraser. Autrement dit une fenêtre de 0 px
// large d'une frame peut casser les projections pour le reste de la session.
//
// D'où la règle des deux fonctions ci-dessous : quand on PEUT s'abstenir, mieux
// vaut garder le dernier aspect connu (isRenderableSize) ; quand on ne peut pas
// — un export doit produire une image —, on borne à 1 px (safeAspect). Dans les
// deux cas l'aspect reste un nombre fini.

// Vrai seulement si les deux côtés sont des nombres finis strictement positifs.
export const isRenderableSize = (w, h) => Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0

// Aspect toujours fini : les côtés nuls, négatifs ou non numériques sont bornés
// à 1 px. Une image un peu mal cadrée reste récupérable, un NaN non.
export const safeAspect = (w, h) => Math.max(1, w || 0) / Math.max(1, h || 0)

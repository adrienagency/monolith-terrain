# C1 — D21 : le crop est une pièce, pas un seuil d'altitude

Arbre `C:\Dev\wt-cr1`, branche `crop-intention`. Serveur : `npm run dev --
--host 127.0.0.1 --port 7341`, arrêté en partant.

---

## ⚠️ LA RÉSERVE, EN TÊTE — « déscroller via le bouton de scroll central »

**J'ai implémenté la MOLETTE, en dézoom.** C'est la lecture du brief, et elle
tient sur trois appuis :

1. **`déscroller` est du vocabulaire de molette.** Le bouton du milieu ne
   « scrolle » pas, il se presse.
2. **Le bouton du MILIEU vient d'être attribué à l'inclinaison et au cap** par
   D19 (`boutons-camera.js:76`, `milieu: ACTION.INCLINAISON` ; GE2/GE3 notés
   9,75 hier). Lui donner AUSSI la sortie du crop serait contradictoire : le
   même bouton inclinerait la vue **et** ferait disparaître le bloc.
3. **D21 ② l'interdit explicitement** : « l'inclinaison, le cap et les boutons
   de caméra ne tuent plus le crop ». Le milieu EST l'inclinaison et le cap.

➡️ **Adrien, une ligne suffit à trancher.** Si tu voulais dire *le bouton du
milieu enfoncé*, le changement est d'une ligne : appeler `armerSortie()` depuis
la branche `GESTE.INCLINAISON` de `appliquerGestesTerre` au lieu de l'écouteur
`wheel`. ⚠️ **Mais alors D19 et D21 se contredisent sur ce bouton**, et il
faudra dire lequel gagne — c'est pour ça que je ne l'ai pas deviné deux fois.

---

## LE TABLEAU DU CRITÈRE

*(rempli plus bas, section « mesures »)*

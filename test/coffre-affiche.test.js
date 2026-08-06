// LE COFFRE — CE QUI FAIT SURVIVRE LE FICHIER AU PAIEMENT
//
// ⚠️ POURQUOI UNE FAUSSE BASE, ET PAS UN SAUT DE TESTS SOUS NODE. `indexedDB`
// n'existe pas ici, et c'est exactement la raison pour laquelle ce module prend
// sa fabrique en ARGUMENT. Sans cette couture, le seul endroit du projet où une
// erreur perd un fichier PAYÉ ne serait vérifié qu'à la main, dans un navigateur,
// sur un achat réel — c'est-à-dire jamais.
//
// La fausse base ci-dessous ne simule pas IndexedDB « en gros » : elle en
// reproduit les trois comportements dont le module dépend, et rien d'autre —
// les requêtes rendent leur résultat par ÉVÉNEMENT, la transaction se termine
// APRÈS ses requêtes, et un échec d'écriture AVORTE la transaction (c'est ainsi
// qu'un dépassement de quota se manifeste : pas au `put`, à la validation).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ouvrirCoffre, deposer, retirer, jeter, purger, fichePour, perimees,
  NOM_BASE, VERSION_BASE, MAGASIN_FICHES, MAGASIN_CORPS, DUREE_VIE_MS,
} from '../src/coffre-affiche.js'

// ═══════════════════════════════════════════════════════════════════════════
// LA FAUSSE BASE
// ═══════════════════════════════════════════════════════════════════════════

const plusTard = (fn) => setTimeout(fn, 0)

function fausseIdb({ refuseOuverture = false, quotaOctets = Infinity } = {}) {
  const magasins = new Map()
  let creee = false
  let ecrits = 0
  const journal = { ouvertures: 0, fermetures: 0, avortements: 0 }

  const faireDb = () => ({
    objectStoreNames: { contains: (n) => magasins.has(n) },
    createObjectStore(nom) { magasins.set(nom, new Map()); return { nom } },
    close() { journal.fermetures++ },
    transaction(noms, mode = 'readonly') {
      const demandes = [].concat(noms)
      for (const n of demandes) if (!magasins.has(n)) throw new Error(`magasin inconnu : ${n}`)
      const tx = { error: null }
      let chaine = Promise.resolve()
      let avorte = false
      const operation = (fn) => {
        const req = {}
        chaine = chaine.then(() => {
          if (avorte) return
          try {
            req.result = fn()
            req.onsuccess?.()
          } catch (err) {
            avorte = true
            journal.avortements++
            req.error = err
            tx.error = err
            req.onerror?.()
            tx.onabort?.()
          }
        })
        return req
      }
      tx.objectStore = (nom) => {
        const m = magasins.get(nom)
        return {
          put: (v) => operation(() => {
            // Le quota ne se manifeste pas au `put` mais à la validation : on
            // reproduit ce comportement-là, c'est lui qui piège les appelants.
            const poids = v?.blob?.size || 200
            if (ecrits + poids > quotaOctets) throw new Error('QuotaExceededError')
            ecrits += poids
            m.set(v.id, v)
            return v.id
          }),
          get: (id) => operation(() => m.get(id) ?? undefined),
          delete: (id) => operation(() => {
            const v = m.get(id)
            ecrits -= v?.blob?.size || (v ? 200 : 0)
            m.delete(id)
          }),
          getAll: () => operation(() => [...m.values()]),
        }
      }
      // Après toutes les requêtes posées synchroniquement par l'appelant.
      plusTard(() => { chaine.then(() => { if (!avorte) tx.oncomplete?.() }) })
      return tx
    },
  })

  let db = null
  return {
    journal,
    magasins,
    open(nom, version) {
      const req = {}
      plusTard(() => {
        journal.ouvertures++
        if (refuseOuverture) {
          req.error = new Error('ouverture refusée (navigation privée)')
          req.onerror?.()
          return
        }
        req.result = db || (db = faireDb())
        req.version = version
        req.nom = nom
        if (!creee) { creee = true; req.onupgradeneeded?.() }
        req.onsuccess?.()
      })
      return req
    },
  }
}

const faussePdf = (octets = 4096) => new Blob([new Uint8Array(octets)], { type: 'application/pdf' })

// ═══════════════════════════════════════════════════════════════════════════
// ① LA FICHE, ET CE QUI EST PÉRIMÉ — DEUX FONCTIONS PURES
// ═══════════════════════════════════════════════════════════════════════════

test('la fiche est une LISTE EXPLICITE, jamais une copie de l’état', () => {
  // L'état d'affiche porte des URL d'objet et des références à la scène : un
  // `{...entree}` les emporterait dans le stockage — ou les y écrirait en `{}`,
  // ce qui est pire, on croirait avoir sauvegardé.
  const f = fichePour({
    id: 'p-1', nom: 'a.pdf', octets: 12345, format: '50x70', orientation: 'paysage', dpi: 250,
    logo: { url: 'blob:https://x/y' }, scene: {}, date: 42,
  })
  assert.deepEqual(Object.keys(f).sort(), ['date', 'dpi', 'format', 'id', 'nom', 'octets', 'orientation', 'type'])
  assert.equal(f.logo, undefined)
  assert.equal(f.date, 42)
  assert.equal(f.type, 'application/pdf')
})

test('sans identifiant, pas de fiche — et donc pas de dépôt', () => {
  assert.equal(fichePour({}), null)
  assert.equal(fichePour({ id: '' }), null)
})

test('⚠️ UNE DATE ILLISIBLE EST PÉRIMÉE, pas immortelle', () => {
  const t = 1_000_000_000
  const fiches = [
    { id: 'frais', date: t - 1000 },
    { id: 'vieux', date: t - DUREE_VIE_MS - 1 },
    { id: 'sans-date' },
    { id: 'date-cassee', date: 'hier' },
  ]
  assert.deepEqual(perimees(fiches, { maintenant: t }), ['vieux', 'sans-date', 'date-cassee'])
  // et le tout juste expiré ne survit pas d'une milliseconde
  assert.deepEqual(perimees([{ id: 'x', date: t - DUREE_VIE_MS }], { maintenant: t }), [])
  assert.deepEqual(perimees(null), [])
})

// ═══════════════════════════════════════════════════════════════════════════
// ② L'ALLER-RETOUR — CE QUE LE PAIEMENT DOIT TRAVERSER
// ═══════════════════════════════════════════════════════════════════════════

test('⚠️ CE QU’ON DÉPOSE AVANT LA CAISSE SE RETROUVE APRÈS', async () => {
  const idb = fausseIdb()
  const blob = faussePdf(9000)
  assert.equal(await deposer({
    id: 'p-abc', blob, nom: 'shibumap-annecy-50x70-paysage-250dpi.pdf',
    octets: blob.size, format: '50x70', orientation: 'paysage', dpi: 250,
  }, { idb }), true)

  // le document est détruit par la navigation ; la base, elle, appartient à
  // l'ORIGINE — c'est toute la raison de ce module
  const garde = await retirer('p-abc', { idb })
  assert.equal(garde.nom, 'shibumap-annecy-50x70-paysage-250dpi.pdf')
  assert.equal(garde.octets, 9000)
  assert.equal(garde.dpi, 250)
  assert.equal(await garde.blob.size, 9000)
})

test('les deux magasins existent, et la purge ne lit que les fiches', async () => {
  // C'est toute la raison des deux magasins : lire les corps pour décider de
  // les jeter chargerait en mémoire les affiches qu'on veut justement libérer.
  const idb = fausseIdb()
  await deposer({ id: 'p-1', blob: faussePdf(), nom: 'a.pdf' }, { idb })
  const db = await ouvrirCoffre({ idb })
  assert.ok(db.objectStoreNames.contains(MAGASIN_FICHES))
  assert.ok(db.objectStoreNames.contains(MAGASIN_CORPS))
  assert.equal(idb.magasins.get(MAGASIN_FICHES).get('p-1').blob, undefined)
  assert.ok(idb.magasins.get(MAGASIN_CORPS).get('p-1').blob)
  assert.equal(typeof NOM_BASE, 'string')
  assert.equal(VERSION_BASE, 1)
})

test('un identifiant inconnu rend null, il n’invente pas d’affiche', async () => {
  const idb = fausseIdb()
  await deposer({ id: 'p-1', blob: faussePdf(), nom: 'a.pdf' }, { idb })
  assert.equal(await retirer('p-2', { idb }), null)
  assert.equal(await retirer('', { idb }), null)
  assert.equal(await retirer(null, { idb }), null)
})

test('⚠️ RETIRER NE JETTE PAS : on n’efface qu’une fois la remise faite', async () => {
  // Jeter en sortant, ce serait jeter avant de savoir si le téléchargement a
  // abouti. Un second clic doit pouvoir retrouver le fichier.
  const idb = fausseIdb()
  await deposer({ id: 'p-1', blob: faussePdf(), nom: 'a.pdf' }, { idb })
  assert.ok(await retirer('p-1', { idb }))
  assert.ok(await retirer('p-1', { idb }), 'le fichier a disparu à la première lecture')
  assert.equal(await jeter('p-1', { idb }), true)
  assert.equal(await retirer('p-1', { idb }), null)
  // et les deux magasins sont vidés, pas seulement la fiche
  assert.equal(idb.magasins.get(MAGASIN_CORPS).size, 0)
  assert.equal(idb.magasins.get(MAGASIN_FICHES).size, 0)
})

// ═══════════════════════════════════════════════════════════════════════════
// ③ LA PURGE — UNE AFFICHE DIT OÙ QUELQU'UN EST ALLÉ
// ═══════════════════════════════════════════════════════════════════════════

test('la purge jette ce qui a dépassé sa durée de vie, et rien d’autre', async () => {
  const idb = fausseIdb()
  const t = 1_700_000_000_000
  await deposer({ id: 'vieux', blob: faussePdf(), nom: 'v.pdf', date: t - DUREE_VIE_MS - 1 }, { idb })
  await deposer({ id: 'frais', blob: faussePdf(), nom: 'f.pdf', date: t - 60_000 }, { idb })
  assert.equal(await purger({ maintenant: t, idb }), 1)
  assert.equal(await retirer('vieux', { idb }), null)
  assert.ok(await retirer('frais', { idb }))
  // rien à purger : une purge qui ne trouve rien n'ouvre pas de transaction
  // d'écriture pour le plaisir
  assert.equal(await purger({ maintenant: t, idb }), 0)
})

// ═══════════════════════════════════════════════════════════════════════════
// ④ CE QUI COMPTE LE PLUS : NE JAMAIS COÛTER UNE VENTE
// ═══════════════════════════════════════════════════════════════════════════

test('⚠️ UN STOCKAGE REFUSÉ NE LÈVE PAS — il fait perdre le fichier, pas la vente', async () => {
  // Navigation privée, base verrouillée, stockage interdit : le pire cas doit
  // retomber exactement sur le comportement d'avant ce module.
  const idb = fausseIdb({ refuseOuverture: true })
  assert.equal(await deposer({ id: 'p-1', blob: faussePdf(), nom: 'a.pdf' }, { idb }), false)
  assert.equal(await retirer('p-1', { idb }), null)
  assert.equal(await jeter('p-1', { idb }), false)
  assert.equal(await purger({ idb }), 0)
})

test('⚠️ UN QUOTA DÉPASSÉ SE VOIT À LA VALIDATION, ET REND `false`', async () => {
  // C'est le piège de la persistance : `put` rend `onsuccess` bien avant que
  // les octets soient écrits. Attendre la REQUÊTE seule, c'est croire à un
  // dépôt qui n'a pas eu lieu — et repartir chez Stripe en le croyant.
  const idb = fausseIdb({ quotaOctets: 5000 })
  assert.equal(await deposer({ id: 'p-1', blob: faussePdf(9000), nom: 'a.pdf' }, { idb }), false)
  assert.equal(await retirer('p-1', { idb }), null)
  assert.ok(idb.journal.avortements > 0, 'la transaction aurait dû avorter')
})

test('sans indexedDB du tout, le module rend la main proprement', async () => {
  assert.equal(await deposer({ id: 'p-1', blob: faussePdf(), nom: 'a.pdf' }, { idb: null }), false)
  assert.equal(await retirer('p-1', { idb: undefined }), null)
  await assert.rejects(() => ouvrirCoffre({ idb: {} }), /indexedDB indisponible/)
})

test('déposer sans fichier n’ouvre même pas la base', async () => {
  const idb = fausseIdb()
  assert.equal(await deposer({ id: 'p-1' }, { idb }), false)
  assert.equal(await deposer({ blob: faussePdf() }, { idb }), false)
  assert.equal(idb.journal.ouvertures, 0)
})

test('la base est refermée à chaque geste — un onglet ne bloque pas le suivant', async () => {
  // Une base laissée ouverte empêche toute montée de version dans un autre
  // onglet : le blocage est silencieux et se manifeste par un dépôt qui ne
  // rend jamais la main, juste avant de partir payer.
  const idb = fausseIdb()
  await deposer({ id: 'p-1', blob: faussePdf(), nom: 'a.pdf' }, { idb })
  await retirer('p-1', { idb })
  await jeter('p-1', { idb })
  await purger({ idb })
  assert.equal(idb.journal.fermetures, idb.journal.ouvertures)
})

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { History } from '../src/history.js';

function makeStub(initial) {
  let state = { ...initial };
  const getSnapshot = () => ({ ...state });
  const apply = (snapshot) => {
    state = { ...snapshot };
  };
  return {
    getState: () => state,
    setState: (next) => {
      state = { ...next };
    },
    getSnapshot,
    apply,
  };
}

test('record dedups identical snapshots', () => {
  const stub = makeStub({ v: 1 });
  const history = new History(stub.getSnapshot, stub.apply);

  history.record(); // seed
  history.record(); // identical snapshot -> no-op

  stub.setState({ v: 2 });
  history.record(); // distinct -> pushed

  history.undo();
  assert.deepEqual(stub.getState(), { v: 1 });
  // Only one undo should have been available (seed -> v2), so canUndo is now false.
  assert.equal(history.canUndo(), false);
});

test('undo restores the previous state', () => {
  const stub = makeStub({ v: 'A' });
  const history = new History(stub.getSnapshot, stub.apply);

  history.record(); // seed A

  stub.setState({ v: 'B' });
  history.record(); // record B

  const result = history.undo();

  assert.equal(result, true);
  assert.deepEqual(stub.getState(), { v: 'A' });
});

test('redo re-applies the state after undo', () => {
  const stub = makeStub({ v: 'A' });
  const history = new History(stub.getSnapshot, stub.apply);

  history.record(); // seed A

  stub.setState({ v: 'B' });
  history.record(); // record B

  history.undo();
  assert.deepEqual(stub.getState(), { v: 'A' });

  const result = history.redo();

  assert.equal(result, true);
  assert.deepEqual(stub.getState(), { v: 'B' });
});

test('recording after an undo clears the redo stack', () => {
  const stub = makeStub({ v: 'A' });
  const history = new History(stub.getSnapshot, stub.apply);

  history.record(); // seed A

  stub.setState({ v: 'B' });
  history.record(); // record B

  history.undo(); // back to A

  stub.setState({ v: 'C' });
  history.record(); // record C, should clear redo (B)

  assert.equal(history.canRedo(), false);
  assert.equal(history.redo(), false);
  assert.deepEqual(stub.getState(), { v: 'C' });
});

// ---- onChange : de quoi griser deux boutons ------------------------------
// Sans notification, la barre du haut devrait sonder canUndo()/canRedo() à
// chaque image pour savoir s'il faut griser. History prévient donc lui-même,
// et UNIQUEMENT quand la réponse a bougé — un bouton qui se redessine à chaque
// record() clignote pour rien.

test('onChange prévient à la naissance puis à chaque bascule de disponibilité', () => {
  const stub = makeStub({ v: 'A' });
  const seen = [];
  const history = new History(stub.getSnapshot, stub.apply, {
    onChange: (s) => seen.push(`${s.canUndo ? 'U' : '-'}${s.canRedo ? 'R' : '-'}`),
  });

  assert.deepEqual(seen, ['--'], 'un état initial, pour que les boutons naissent grisés');

  history.record(); // amorce : toujours rien à annuler
  assert.deepEqual(seen, ['--']);

  stub.setState({ v: 'B' });
  history.record(); // il y a enfin un pas en arrière
  assert.deepEqual(seen, ['--', 'U-']);

  history.undo();
  assert.deepEqual(seen, ['--', 'U-', '-R']);

  history.redo();
  assert.deepEqual(seen, ['--', 'U-', '-R', 'U-']);
});

test('onChange se tait quand rien ne bascule', () => {
  const stub = makeStub({ v: 0 });
  let calls = 0;
  const history = new History(stub.getSnapshot, stub.apply, { onChange: () => { calls += 1 } });
  calls = 0; // on ignore l'appel de naissance

  history.record(); // amorce
  for (let i = 1; i <= 5; i += 1) {
    stub.setState({ v: i });
    history.record();
  }
  // cinq enregistrements, mais UNE seule bascule : « on peut annuler »
  assert.equal(calls, 1);

  assert.equal(history.undo(), true); // canRedo bascule
  assert.equal(calls, 2);
  assert.equal(history.undo(), true); // toujours annulable, toujours rétablissable
  assert.equal(calls, 2);
});

test('un undo/redo refusé ne notifie personne', () => {
  const stub = makeStub({ v: 'A' });
  let calls = 0;
  const history = new History(stub.getSnapshot, stub.apply, { onChange: () => { calls += 1 } });
  calls = 0;

  assert.equal(history.undo(), false);
  assert.equal(history.redo(), false);
  assert.equal(calls, 0);
});

test('History reste utilisable sans onChange', () => {
  const stub = makeStub({ v: 'A' });
  const history = new History(stub.getSnapshot, stub.apply);
  history.record();
  stub.setState({ v: 'B' });
  history.record();
  assert.equal(history.undo(), true);
});

// ---- reset : poser un plancher --------------------------------------------
// Au démarrage, ShibuMap enregistre deux fois (le gabarit d'ouverture, puis
// l'amorce) et le soleil a bougé de quelques millièmes entre les deux : la pile
// contenait donc un pas AVANT le premier geste de l'utilisateur, « Annuler »
// s'allumait tout seul, et le premier clic reculait le soleil de 0,4° — un
// clic dans le vide, visuellement. reset() dit « l'état ouvert est le sol ».

test('reset fait de l’état courant le plancher : plus rien à annuler ni rétablir', () => {
  const stub = makeStub({ v: 'A' });
  const history = new History(stub.getSnapshot, stub.apply);

  history.record();
  stub.setState({ v: 'B' });
  history.record();
  history.undo(); // il y a maintenant du undo ET du redo en réserve

  stub.setState({ v: 'C' });
  history.reset();

  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), false);
  assert.equal(history.undo(), false);
  assert.deepEqual(stub.getState(), { v: 'C' }, 'reset ne réapplique rien');
});

test('après reset, le premier vrai geste redevient annulable — jusqu’au plancher', () => {
  const stub = makeStub({ v: 'sol' });
  const history = new History(stub.getSnapshot, stub.apply);
  history.reset();

  stub.setState({ v: 'geste' });
  history.record();

  assert.equal(history.canUndo(), true);
  assert.equal(history.undo(), true);
  assert.deepEqual(stub.getState(), { v: 'sol' });
  assert.equal(history.canUndo(), false);
});

test('reset notifie si l’état de disponibilité a bougé', () => {
  const stub = makeStub({ v: 'A' });
  const seen = [];
  const history = new History(stub.getSnapshot, stub.apply, {
    onChange: (s) => seen.push(`${s.canUndo ? 'U' : '-'}${s.canRedo ? 'R' : '-'}`),
  });
  history.record();
  stub.setState({ v: 'B' });
  history.record(); // -> 'U-'
  history.reset();
  assert.deepEqual(seen, ['--', 'U-', '--']);
});

test('limit caps the undo stack, dropping the oldest entries', () => {
  const stub = makeStub({ v: 0 });
  const history = new History(stub.getSnapshot, stub.apply, { limit: 3 });

  for (let i = 0; i <= 4; i += 1) {
    stub.setState({ v: i });
    history.record();
  }
  // States recorded: 0,1,2,3,4 -> with limit 3, only [2,3,4] survive.

  assert.equal(history.undo(), true);
  assert.deepEqual(stub.getState(), { v: 3 });

  assert.equal(history.undo(), true);
  assert.deepEqual(stub.getState(), { v: 2 });

  // Oldest surviving entry reached; states 0 and 1 were dropped by the cap.
  assert.equal(history.canUndo(), false);
  assert.equal(history.undo(), false);
  assert.deepEqual(stub.getState(), { v: 2 });
});

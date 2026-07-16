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

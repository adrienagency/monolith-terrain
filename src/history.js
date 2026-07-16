// Pure undo/redo history module. No THREE/DOM dependencies.
//
// Model: `_undo` is a list of committed snapshots, oldest first, where the
// LAST entry is always the current committed state. `record()` appends a new
// current state (deduped against the current top). `undo()` moves the
// current state onto `_redo` and makes the previous entry current again.
// `redo()` moves the most recently undone state back onto `_undo`.

function cloneSnapshot(snapshot) {
  return JSON.parse(JSON.stringify(snapshot));
}

export class History {
  constructor(getSnapshot, apply, { limit = 50 } = {}) {
    this._getSnapshot = getSnapshot;
    this._apply = apply;
    this._limit = limit;
    this._undo = [];
    this._redo = [];
  }

  record() {
    const snapshot = cloneSnapshot(this._getSnapshot());

    if (this._undo.length > 0) {
      const top = this._undo[this._undo.length - 1];
      if (JSON.stringify(top) === JSON.stringify(snapshot)) {
        return; // dedup: identical to current top, no-op
      }
    }

    this._undo.push(snapshot);
    this._redo = [];

    if (this._undo.length > this._limit) {
      this._undo.splice(0, this._undo.length - this._limit);
    }
  }

  undo() {
    if (!this.canUndo()) return false;

    const current = this._undo.pop();
    this._redo.push(current);

    const previous = this._undo[this._undo.length - 1];
    this._apply(cloneSnapshot(previous));
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;

    const snapshot = this._redo.pop();
    this._undo.push(snapshot);
    this._apply(cloneSnapshot(snapshot));
    return true;
  }

  canUndo() {
    return this._undo.length > 1;
  }

  canRedo() {
    return this._redo.length > 0;
  }
}

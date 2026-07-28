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
  // `onChange({ canUndo, canRedo })` — appelé à la naissance puis à CHAQUE
  // bascule de disponibilité, jamais plus. C'est ce qui permet aux deux boutons
  // de la barre du haut de se griser sans sonder l'historique à chaque image ;
  // le filtre « seulement si ça a bougé » évite de les redessiner à chaque
  // record() — un enregistrement part toutes les 400 ms pendant qu'on tire un
  // curseur, et un bouton réécrit à ce rythme clignote.
  constructor(getSnapshot, apply, { limit = 50, onChange = null } = {}) {
    this._getSnapshot = getSnapshot;
    this._apply = apply;
    this._limit = limit;
    this._undo = [];
    this._redo = [];
    this._onChange = onChange;
    this._lastNotified = null;
    this._notify();
  }

  // Ne prévient que si la PAIRE (annulable, rétablissable) a changé.
  _notify() {
    if (!this._onChange) return;
    const state = { canUndo: this.canUndo(), canRedo: this.canRedo() };
    const key = `${state.canUndo}|${state.canRedo}`;
    if (key === this._lastNotified) return;
    this._lastNotified = key;
    this._onChange(state);
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

    this._notify();
  }

  undo() {
    if (!this.canUndo()) return false;

    const current = this._undo.pop();
    this._redo.push(current);

    const previous = this._undo[this._undo.length - 1];
    this._apply(cloneSnapshot(previous));
    this._notify();
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;

    const snapshot = this._redo.pop();
    this._undo.push(snapshot);
    this._apply(cloneSnapshot(snapshot));
    this._notify();
    return true;
  }

  // L'état courant devient le SOL : plus rien avant lui n'est annulable, et
  // ce qui avait été annulé n'est plus rétablissable. Sert à clore un
  // démarrage — les enregistrements faits pendant le boot ne sont pas des
  // gestes de l'utilisateur, il ne doit pas pouvoir « annuler » l'ouverture.
  // N'applique rien : ce qui est à l'écran reste à l'écran.
  reset() {
    this._undo = [cloneSnapshot(this._getSnapshot())];
    this._redo = [];
    this._notify();
  }

  canUndo() {
    return this._undo.length > 1;
  }

  canRedo() {
    return this._redo.length > 0;
  }
}

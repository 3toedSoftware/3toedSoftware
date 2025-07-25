// undo-manager.js - Undo/Redo functionality for Mapping Slayer

const UndoManager = {
    history: [],
    currentIndex: -1,
    maxHistory: 50,
    isUndoing: false,
    getStateSnapshot: null,
    restoreState: null,
    updateUI: null,

    init(getStateSnapshot, restoreState, updateUI) {
        this.getStateSnapshot = getStateSnapshot;
        this.restoreState = restoreState;
        this.updateUI = updateUI;
        this.history = [];
        this.currentIndex = -1;
        this.isUndoing = false;
    },

    capture(actionName = 'Unknown Action') {
        if (this.isUndoing) return;

        const snapshot = this.getStateSnapshot();
        if (!snapshot) return;

        // Check if the new state is the same as the last state
        if (this.history.length > 0 && this.currentIndex >= 0) {
            const lastSnapshot = this.history[this.currentIndex];
            if (JSON.stringify(lastSnapshot.state) === JSON.stringify(snapshot)) {
                return; // Don't save duplicate states
            }
        }

        // If we're not at the end of the history, remove all future entries
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }

        // Add the new snapshot
        this.history.push({
            state: snapshot,
            actionName: actionName,
            timestamp: Date.now()
        });

        // Limit history size
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.currentIndex++;
        }

        this.updateUI();
    },

    undo() {
        if (!this.canUndo()) return false;

        this.isUndoing = true;
        this.currentIndex--;
        const snapshot = this.history[this.currentIndex];
        this.restoreState(snapshot.state);
        this.isUndoing = false;
        this.updateUI();
        
        return snapshot.actionName;
    },

    redo() {
        if (!this.canRedo()) return false;

        this.isUndoing = true;
        this.currentIndex++;
        const snapshot = this.history[this.currentIndex];
        this.restoreState(snapshot.state);
        this.isUndoing = false;
        this.updateUI();
        
        return snapshot.actionName;
    },

    canUndo() {
        return this.currentIndex > 0;
    },

    canRedo() {
        return this.currentIndex < this.history.length - 1;
    },

    getUndoActionName() {
        if (!this.canUndo()) return null;
        return this.history[this.currentIndex].actionName;
    },

    getRedoActionName() {
        if (!this.canRedo()) return null;
        return this.history[this.currentIndex + 1].actionName;
    },

    clear() {
        this.history = [];
        this.currentIndex = -1;
        this.updateUI();
    }
};

export { UndoManager };

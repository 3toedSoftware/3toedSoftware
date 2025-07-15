// undo-manager.js

const UndoManager = {
    history: [],
    index: -1,
    isUndoing: false,
    maxHistory: 50,

    init(getStateSnapshot, restoreState, updateUI) {
        this.getStateSnapshot = getStateSnapshot;
        this.restoreState = restoreState;
        this.updateUI = updateUI;
        this.clear();
    },

    clear() {
        this.history = [];
        this.index = -1;
        if (this.updateUI) this.updateUI();
    },
    
    capture(description) {
        if (this.isUndoing) return;

        if (this.index < this.history.length - 1) {
            this.history = this.history.slice(0, this.index + 1);
        }

        const snapshot = this.getStateSnapshot(description);
        
        const lastSnapshot = this.history[this.history.length - 1];
        if (lastSnapshot && JSON.stringify(lastSnapshot.data) === JSON.stringify(snapshot.data)) {
            return;
        }

        this.history.push(snapshot);
        this.index++;

        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.index--;
        }
        
        this.updateUI();
    },

    undo() {
        if (this.index <= 0) return;
        
        this.isUndoing = true;
        this.index--;
        const snapshot = this.history[this.index];
        this.restoreState(snapshot.data);
        this.isUndoing = false;
        
        this.updateUI();
        return this.history[this.index + 1].description;
    },

    redo() {
        if (this.index >= this.history.length - 1) return;

        this.isUndoing = true;
        this.index++;
        const snapshot = this.history[this.index];
        this.restoreState(snapshot.data);
        this.isUndoing = false;

        this.updateUI();
        return snapshot.description;
    }
};

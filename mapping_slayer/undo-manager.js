// undo-manager.js

const UndoManager = {
    history: [],
    index: -1,
    isUndoing: false,
    maxHistory: 10,
    operationHandlers: {},

    init(updateUI) {
        this.updateUI = updateUI;
        this.clear();
        this.setupOperationHandlers();
    },

    setupOperationHandlers() {
        // Define how to undo/redo each operation type
        this.operationHandlers = {
            addDot: {
                undo: (data) => {
                    const pageData = appState.dotsByPage.get(data.pageNum);
                    if (pageData && pageData.dots.has(data.dotId)) {
                        pageData.dots.delete(data.dotId);
                    }
                },
                redo: (data) => {
                    const pageData = appState.dotsByPage.get(data.pageNum);
                    if (pageData) {
                        pageData.dots.set(data.dotId, data.dot);
                    }
                }
            },
            deleteDots: {
                undo: (data) => {
                    data.dots.forEach(dotInfo => {
                        const pageData = appState.dotsByPage.get(dotInfo.pageNum);
                        if (pageData) {
                            pageData.dots.set(dotInfo.dot.internalId, dotInfo.dot);
                        }
                    });
                },
                redo: (data) => {
                    data.dots.forEach(dotInfo => {
                        const pageData = appState.dotsByPage.get(dotInfo.pageNum);
                        if (pageData) {
                            pageData.dots.delete(dotInfo.dot.internalId);
                        }
                    });
                }
            },
            editDot: {
                undo: (data) => {
                    const pageData = appState.dotsByPage.get(data.pageNum);
                    if (pageData && pageData.dots.has(data.dotId)) {
                        pageData.dots.set(data.dotId, data.oldState);
                    }
                },
                redo: (data) => {
                    const pageData = appState.dotsByPage.get(data.pageNum);
                    if (pageData && pageData.dots.has(data.dotId)) {
                        pageData.dots.set(data.dotId, data.newState);
                    }
                }
            },
            moveDots: {
                undo: (data) => {
                    data.movements.forEach(move => {
                        const pageData = appState.dotsByPage.get(move.pageNum);
                        if (pageData) {
                            const dot = pageData.dots.get(move.dotId);
                            if (dot) {
                                dot.x = move.oldX;
                                dot.y = move.oldY;
                            }
                        }
                    });
                },
                redo: (data) => {
                    data.movements.forEach(move => {
                        const pageData = appState.dotsByPage.get(move.pageNum);
                        if (pageData) {
                            const dot = pageData.dots.get(move.dotId);
                            if (dot) {
                                dot.x = move.newX;
                                dot.y = move.newY;
                            }
                        }
                    });
                }
            },
            batchOperation: {
                undo: (data) => {
                    // For complex operations, store full page state
                    appState.dotsByPage = deserializeDotsByPage(data.oldState.dotsByPage);
                    if (data.oldState.currentPdfPage !== appState.currentPdfPage) {
                        changePage(data.oldState.currentPdfPage);
                    }
                },
                redo: (data) => {
                    appState.dotsByPage = deserializeDotsByPage(data.newState.dotsByPage);
                    if (data.newState.currentPdfPage !== appState.currentPdfPage) {
                        changePage(data.newState.currentPdfPage);
                    }
                }
            }
        };
    },

    clear() {
        this.history = [];
        this.index = -1;
        if (this.updateUI) this.updateUI();
    },
    
    captureOperation(operationType, description, data) {
        if (this.isUndoing) return;

        if (this.index < this.history.length - 1) {
            this.history = this.history.slice(0, this.index + 1);
        }

        const operation = {
            type: operationType,
            description: description,
            timestamp: Date.now(),
            data: data
        };

        this.history.push(operation);
        this.index++;

        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.index--;
        }
        
        this.updateUI();
    },

    // Legacy capture method for complex operations
    capture(description) {
        // For complex operations, fall back to full state capture
        const fullState = {
            dotsByPage: serializeDotsByPage(appState.dotsByPage),
            currentPdfPage: appState.currentPdfPage
        };
        
        this.captureOperation('batchOperation', description, {
            oldState: fullState,
            newState: fullState // Will be set on next capture
        });
        
        // Update the previous operation's newState if it was also a batch
        if (this.index > 0) {
            const prevOp = this.history[this.index - 1];
            if (prevOp.type === 'batchOperation' && !prevOp.data.newState.dotsByPage) {
                prevOp.data.newState = fullState;
            }
        }
    },

    undo() {
        if (this.index < 0) return;
        
        this.isUndoing = true;
        
        const operation = this.history[this.index];
        const handler = this.operationHandlers[operation.type];
        
        if (handler && handler.undo) {
            handler.undo(operation.data);
        }
        
        this.index--;
        this.isUndoing = false;
        
        // Refresh the current view
        if (appState.pdfDoc) {
            renderDotsForCurrentPage();
            updateAllSectionsForCurrentPage();
        }
        
        this.updateUI();
        return operation.description;
    },

    redo() {
        if (this.index >= this.history.length - 1) return;

        this.isUndoing = true;
        this.index++;
        
        const operation = this.history[this.index];
        const handler = this.operationHandlers[operation.type];
        
        if (handler && handler.redo) {
            handler.redo(operation.data);
        }
        
        this.isUndoing = false;
        
        // Refresh the current view
        if (appState.pdfDoc) {
            renderDotsForCurrentPage();
            updateAllSectionsForCurrentPage();
        }
        
        this.updateUI();
        return operation.description;
    }
};

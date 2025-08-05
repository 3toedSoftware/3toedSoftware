// command-undo.js - Professional Command Pattern Undo System for Mapping Slayer

/**
 * Base Command class - all commands must implement execute() and undo()
 */
class Command {
    constructor(description) {
        this.description = description;
        this.timestamp = Date.now();
    }
    
    execute() {
        throw new Error('Command must implement execute()');
    }
    
    undo() {
        throw new Error('Command must implement undo()');
    }
}

/**
 * Composite Command - groups multiple commands into a single undoable action
 */
class CompositeCommand extends Command {
    constructor(description) {
        super(description);
        this.commands = [];
    }
    
    add(command) {
        this.commands.push(command);
    }
    
    async execute() {
        for (const cmd of this.commands) {
            await cmd.execute();
        }
    }
    
    async undo() {
        // Undo in reverse order
        for (let i = this.commands.length - 1; i >= 0; i--) {
            await this.commands[i].undo();
        }
    }
}

/**
 * Add Dot Command - adds a single dot
 */
class AddDotCommand extends Command {
    constructor(pageNum, dot) {
        super('Add dot');
        this.pageNum = pageNum;
        this.dot = { ...dot }; // Store a copy
    }
    
    async execute() {
        // Import state module dynamically to avoid circular dependencies
        const { appState } = await import('./state.js');
        
        const pageData = appState.dotsByPage.get(this.pageNum);
        if (!pageData) {
            appState.dotsByPage.set(this.pageNum, { dots: new Map(), nextLocationNumber: 1 });
        }
        
        const targetPageData = appState.dotsByPage.get(this.pageNum);
        targetPageData.dots.set(this.dot.internalId, { ...this.dot });
    }
    
    async undo() {
        const { appState } = await import('./state.js');
        
        const pageData = appState.dotsByPage.get(this.pageNum);
        if (pageData) {
            pageData.dots.delete(this.dot.internalId);
        }
    }
}

/**
 * Delete Dot Command - removes a single dot
 */
class DeleteDotCommand extends Command {
    constructor(pageNum, dot) {
        super('Delete dot');
        this.pageNum = pageNum;
        this.dot = { ...dot }; // Store a copy for restoration
        this.lineCommands = []; // Store line deletion commands
    }
    
    async execute() {
        const { appState, getAnnotationLinesForPage } = await import('./state.js');
        
        // First, create commands to delete any annotation lines that start from this dot
        const pageLines = getAnnotationLinesForPage(this.pageNum);
        this.lineCommands = [];
        
        pageLines.forEach((line, lineId) => {
            if (line.startDotId === this.dot.internalId) {
                const lineCommand = new DeleteAnnotationLineCommand(this.pageNum, line);
                this.lineCommands.push(lineCommand);
            }
        });
        
        // Execute line deletion commands
        for (const cmd of this.lineCommands) {
            await cmd.execute();
        }
        
        // Then delete the dot
        const pageData = appState.dotsByPage.get(this.pageNum);
        if (pageData) {
            pageData.dots.delete(this.dot.internalId);
        }
    }
    
    async undo() {
        const { appState } = await import('./state.js');
        
        // First restore the dot
        const pageData = appState.dotsByPage.get(this.pageNum);
        if (!pageData) {
            appState.dotsByPage.set(this.pageNum, { dots: new Map(), nextLocationNumber: 1 });
        }
        
        const targetPageData = appState.dotsByPage.get(this.pageNum);
        targetPageData.dots.set(this.dot.internalId, { ...this.dot });
        
        // Then restore the annotation lines by undoing the line commands in reverse order
        for (let i = this.lineCommands.length - 1; i >= 0; i--) {
            await this.lineCommands[i].undo();
        }
    }
}

/**
 * Edit Dot Command - modifies dot properties
 */
class EditDotCommand extends Command {
    constructor(pageNum, dotId, oldValues, newValues) {
        super('Edit dot');
        this.pageNum = pageNum;
        this.dotId = dotId;
        this.oldValues = { ...oldValues };
        this.newValues = { ...newValues };
    }
    
    async execute() {
        const { appState } = await import('./state.js');
        
        const pageData = appState.dotsByPage.get(this.pageNum);
        if (pageData) {
            const dot = pageData.dots.get(this.dotId);
            if (dot) {
                Object.assign(dot, this.newValues);
            }
        }
    }
    
    async undo() {
        const { appState } = await import('./state.js');
        
        const pageData = appState.dotsByPage.get(this.pageNum);
        if (pageData) {
            const dot = pageData.dots.get(this.dotId);
            if (dot) {
                Object.assign(dot, this.oldValues);
            }
        }
    }
}

/**
 * Move Dot Command - changes dot position
 */
class MoveDotCommand extends Command {
    constructor(pageNum, dotId, oldPos, newPos) {
        super('Move dot');
        this.pageNum = pageNum;
        this.dotId = dotId;
        this.oldPos = { ...oldPos };
        this.newPos = { ...newPos };
    }
    
    async execute() {
        const { appState, getAnnotationLinesForPage } = await import('./state.js');
        
        const pageData = appState.dotsByPage.get(this.pageNum);
        if (pageData) {
            const dot = pageData.dots.get(this.dotId);
            if (dot) {
                dot.x = this.newPos.x;
                dot.y = this.newPos.y;
                
                // Update annotation lines that start from this dot
                const pageLines = getAnnotationLinesForPage(this.pageNum);
                pageLines.forEach(line => {
                    if (line.startDotId === this.dotId) {
                        line.startX = this.newPos.x;
                        line.startY = this.newPos.y;
                    }
                });
            }
        }
    }
    
    async undo() {
        const { appState, getAnnotationLinesForPage } = await import('./state.js');
        
        const pageData = appState.dotsByPage.get(this.pageNum);
        if (pageData) {
            const dot = pageData.dots.get(this.dotId);
            if (dot) {
                dot.x = this.oldPos.x;
                dot.y = this.oldPos.y;
                
                // Update annotation lines that start from this dot
                const pageLines = getAnnotationLinesForPage(this.pageNum);
                pageLines.forEach(line => {
                    if (line.startDotId === this.dotId) {
                        line.startX = this.oldPos.x;
                        line.startY = this.oldPos.y;
                    }
                });
            }
        }
    }
}

/**
 * Add Annotation Line Command - adds a single annotation line
 */
class AddAnnotationLineCommand extends Command {
    constructor(pageNum, line) {
        super('Add annotation line');
        this.pageNum = pageNum;
        this.line = { ...line }; // Store a copy
    }
    
    async execute() {
        const { getAnnotationLinesForPage } = await import('./state.js');
        const pageLines = getAnnotationLinesForPage(this.pageNum);
        pageLines.set(this.line.id, { ...this.line });
    }
    
    async undo() {
        const { getAnnotationLinesForPage } = await import('./state.js');
        const pageLines = getAnnotationLinesForPage(this.pageNum);
        pageLines.delete(this.line.id);
    }
}

/**
 * Delete Annotation Line Command - removes a single annotation line
 */
class DeleteAnnotationLineCommand extends Command {
    constructor(pageNum, line) {
        super('Delete annotation line');
        this.pageNum = pageNum;
        this.line = { ...line }; // Store a copy for restoration
    }
    
    async execute() {
        const { getAnnotationLinesForPage } = await import('./state.js');
        const pageLines = getAnnotationLinesForPage(this.pageNum);
        pageLines.delete(this.line.id);
    }
    
    async undo() {
        const { getAnnotationLinesForPage } = await import('./state.js');
        const pageLines = getAnnotationLinesForPage(this.pageNum);
        pageLines.set(this.line.id, { ...this.line });
    }
}

/**
 * Move Annotation Line Endpoint Command - moves the endpoint of an annotation line
 */
class MoveAnnotationLineEndpointCommand extends Command {
    constructor(pageNum, lineId, oldEndPos, newEndPos) {
        super('Move annotation line');
        this.pageNum = pageNum;
        this.lineId = lineId;
        this.oldEndPos = { ...oldEndPos };
        this.newEndPos = { ...newEndPos };
    }
    
    async execute() {
        const { getAnnotationLinesForPage } = await import('./state.js');
        const pageLines = getAnnotationLinesForPage(this.pageNum);
        const line = pageLines.get(this.lineId);
        if (line) {
            line.endX = this.newEndPos.x;
            line.endY = this.newEndPos.y;
        }
    }
    
    async undo() {
        const { getAnnotationLinesForPage } = await import('./state.js');
        const pageLines = getAnnotationLinesForPage(this.pageNum);
        const line = pageLines.get(this.lineId);
        if (line) {
            line.endX = this.oldEndPos.x;
            line.endY = this.oldEndPos.y;
        }
    }
}

/**
 * Command-based Undo Manager
 */
export const CommandUndoManager = {
    undoStack: [],
    redoStack: [],
    maxHistory: 50,
    isExecuting: false,
    currentTransaction: null,
    
    /**
     * Execute a command and add it to the undo stack
     */
    async execute(command) {
        if (this.isExecuting) return; // Prevent recursion
        
        try {
            this.isExecuting = true;
            
            // If we're in a transaction, add to it instead
            if (this.currentTransaction) {
                this.currentTransaction.add(command);
                await command.execute();
                return;
            }
            
            // Execute the command
            await command.execute();
            
            // Add to undo stack
            this.undoStack.push(command);
            
            // Clear redo stack when new command is executed
            this.redoStack = [];
            
            // Limit history size
            if (this.undoStack.length > this.maxHistory) {
                this.undoStack.shift();
            }
            
            this.updateUI();
            
        } finally {
            this.isExecuting = false;
        }
    },
    
    /**
     * Begin a transaction - all commands until endTransaction() will be grouped
     */
    beginTransaction(description) {
        if (this.currentTransaction) {
            console.warn('Transaction already in progress');
            return;
        }
        this.currentTransaction = new CompositeCommand(description);
    },
    
    /**
     * End the current transaction and execute it as a single command
     */
    endTransaction() {
        if (!this.currentTransaction) {
            console.warn('No transaction to end');
            return;
        }
        
        const transaction = this.currentTransaction;
        this.currentTransaction = null;
        
        // Only add to history if transaction has commands
        if (transaction.commands.length > 0) {
            this.undoStack.push(transaction);
            this.redoStack = [];
            
            if (this.undoStack.length > this.maxHistory) {
                this.undoStack.shift();
            }
            
            this.updateUI();
        }
    },
    
    /**
     * Undo the last command
     */
    async undo() {
        if (this.undoStack.length === 0) return;
        if (this.isExecuting) return; // Prevent concurrent undo operations
        
        try {
            this.isExecuting = true;
            
            const command = this.undoStack.pop();
            await command.undo();
            this.redoStack.push(command);
            
            this.updateUI();
            await this.refreshDisplay();
            
            return command.description;
            
        } finally {
            this.isExecuting = false;
        }
    },
    
    /**
     * Redo the last undone command
     */
    async redo() {
        if (this.redoStack.length === 0) return;
        if (this.isExecuting) return; // Prevent concurrent redo operations
        
        try {
            this.isExecuting = true;
            
            const command = this.redoStack.pop();
            await command.execute();
            this.undoStack.push(command);
            
            this.updateUI();
            await this.refreshDisplay();
            
            return command.description;
            
        } finally {
            this.isExecuting = false;
        }
    },
    
    /**
     * Check if undo is available
     */
    canUndo() {
        return this.undoStack.length > 0;
    },
    
    /**
     * Check if redo is available
     */
    canRedo() {
        return this.redoStack.length > 0;
    },
    
    /**
     * Clear all history
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.currentTransaction = null;
        this.updateUI();
    },
    
    /**
     * Update UI after undo/redo
     */
    async refreshDisplay() {
        try {
            // Dynamically import to avoid circular dependencies
            const { renderDotsForCurrentPage } = await import('./map-controller.js');
            const { updateLocationList, updateMapLegend, renderAnnotationLines } = await import('./ui.js');
            
            renderDotsForCurrentPage();
            updateLocationList();
            updateMapLegend();
            renderAnnotationLines(); // Explicitly render annotation lines
        } catch (e) {
            console.warn('Could not refresh display:', e);
        }
    },
    
    /**
     * Update UI elements (can be extended)
     */
    updateUI() {
        // This can be extended to update undo/redo button states
    },
    
    /**
     * Get history info for debugging
     */
    getHistory() {
        return {
            undoStack: this.undoStack.map(cmd => ({
                description: cmd.description,
                timestamp: cmd.timestamp
            })),
            redoStack: this.redoStack.map(cmd => ({
                description: cmd.description,
                timestamp: cmd.timestamp
            })),
            isExecuting: this.isExecuting
        };
    },
    
    /**
     * Reset the isExecuting flag if it gets stuck
     */
    resetExecutionFlag() {
        this.isExecuting = false;
    }
};

// Export command classes for use in other modules
export {
    Command,
    CompositeCommand,
    AddDotCommand,
    DeleteDotCommand,
    EditDotCommand,
    MoveDotCommand,
    AddAnnotationLineCommand,
    DeleteAnnotationLineCommand,
    MoveAnnotationLineEndpointCommand
};

// Set up global reference for debugging
window.CommandUndoManager = CommandUndoManager;
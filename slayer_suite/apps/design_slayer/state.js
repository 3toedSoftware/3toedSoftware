// state.js - State management for Design Slayer
import { DEFAULT_VIEWPORT_STATE } from './config.js';
import { inchesToMm, roundMm } from './units.js';

// Application state
export const state = {
    elementCounter: 0,
    depthCounter: 0,
    selectedElement: null,
    currentElement: null,
    elementsList: [],
    elementLinks: [],

    // UI state
    snapEnabled: true,
    gridVisible: true, // Grid on by default
    rulersVisible: true, // Rulers on by default
    xrayMode: false,
    shadowMode: false,
    editingElementId: null,
    displayUnit: 'mm', // Display unit preference ('mm' or 'inches')

    // Snap settings (values now stored in mm)
    snapValue: 5, // Default 5mm for better grid alignment
    snapUnit: 'mm', // Display unit for snap ('inches' or 'mm')
    snapFlyoutOpen: false,

    // Viewport states
    faceViewState: { ...DEFAULT_VIEWPORT_STATE },
    sideViewState: { ...DEFAULT_VIEWPORT_STATE },

    // 3D viewer state
    isModalOpen: false,

    // Sign type state
    currentSignType: null,

    // File state
    currentFileName: 'No file loaded',
    isDirty: false,

    // UI state for expanded elements
    expandedElements: new Set(),

    // Element properties modal state
    editingElement: null
};

// State update function
export function updateState(updates) {
    Object.assign(state, updates);

    // Trigger any necessary side effects
    if ('isDirty' in updates && window.appBridge) {
        window.appBridge.broadcast('project:dirty', { isDirty: updates.isDirty });
    }
}

// Element ID generator
export function getNextElementId() {
    return ++state.elementCounter;
}

// Depth number generator
export function getNextDepthNumber() {
    return ++state.depthCounter;
}

// Element operations
export function addElement(element) {
    state.elementsList.unshift(element);
    updateState({ isDirty: true });
}

export function removeElement(elementId) {
    const index = state.elementsList.findIndex(l => l.id === elementId);
    if (index !== -1) {
        state.elementsList.splice(index, 1);

        // Remove associated links
        state.elementLinks = state.elementLinks.filter(
            link => link.from !== index && link.to !== index
        );

        // Clear current element if it was deleted
        if (state.currentElement?.id === elementId) {
            state.currentElement = null;
        }

        updateState({ isDirty: true });
    }
}

export function updateElement(elementId, updates) {
    const element = state.elementsList.find(l => l.id === elementId);
    if (element) {
        Object.assign(element, updates);
        updateState({ isDirty: true });
    }
}

// Migration function to convert elements to mm-based coordinates
export function migrateLegacyLayers() {
    let needsUpdate = false;

    // Handle both legacy layersList and new elementsList
    const elementsToMigrate =
        state.elementsList.length > 0 ? state.elementsList : state.layersList || [];

    elementsToMigrate.forEach(element => {
        // Migrate elementDepth (was layerDepth)
        if (element.elementDepth === undefined || element.elementDepth === null) {
            // Use layerDepth if it exists (migration from old format)
            element.elementDepth = element.layerDepth || getNextDepthNumber();
            needsUpdate = true;
        }

        // Check if this element needs mm conversion
        // If coordinates are small (< 1000), they're likely in inches
        if (!element.mmConverted && (Math.abs(element.x) < 1000 || Math.abs(element.y) < 1000)) {
            // First check if values are in pixels (old system)
            if (element.x > 20 || element.y > 20) {
                console.log(
                    `Migrating element ${element.id} from pixels to mm: (${element.x}, ${element.y})`
                );
                // Convert pixels to inches first, then to mm
                element.x = roundMm(inchesToMm(element.x / 20));
                element.y = roundMm(inchesToMm(element.y / 20));
                element.width = roundMm(inchesToMm(element.width / 20));
                element.height = roundMm(inchesToMm(element.height / 20));
            } else {
                // Values are in inches, convert to mm
                console.log(
                    `Migrating element ${element.id} from inches to mm: (${element.x}, ${element.y})`
                );
                element.x = roundMm(inchesToMm(element.x));
                element.y = roundMm(inchesToMm(element.y));
                element.width = roundMm(inchesToMm(element.width));
                element.height = roundMm(inchesToMm(element.height));
            }

            // Convert thickness if present
            if (element.thickness !== undefined) {
                element.thickness = roundMm(inchesToMm(element.thickness));
            }

            // Mark as converted
            element.mmConverted = true;
            needsUpdate = true;
        }
    });

    // If we migrated from layersList, update to elementsList
    if (state.layersList && state.layersList.length > 0 && state.elementsList.length === 0) {
        state.elementsList = state.layersList;
        state.elementLinks = state.layerLinks || [];
        state.elementCounter = state.layerCounter || 0;
        needsUpdate = true;
    }

    // Also convert snap value if it's still in inches
    if (state.snapValue < 1) {
        state.snapValue = roundMm(inchesToMm(state.snapValue));
        needsUpdate = true;
    }

    if (needsUpdate) {
        updateState({ isDirty: true });
        console.log('Migrated legacy elements to mm-based coordinates');
    }
}

// Element linking operations
export function toggleElementLink(fromIndex, toIndex) {
    const existingLinkIndex = state.elementLinks.findIndex(
        link => link.from === fromIndex && link.to === toIndex
    );

    if (existingLinkIndex !== -1) {
        state.elementLinks.splice(existingLinkIndex, 1);
    } else {
        state.elementLinks.push({ from: fromIndex, to: toIndex });
    }

    updateState({ isDirty: true });
}

export function getLinkedGroup(element) {
    const elementIndex = state.elementsList.indexOf(element);
    if (elementIndex === -1) return [element];

    const linkedIndices = new Set([elementIndex]);
    let changed = true;

    while (changed) {
        changed = false;
        for (const link of state.elementLinks) {
            if (linkedIndices.has(link.from) && !linkedIndices.has(link.to)) {
                linkedIndices.add(link.to);
                changed = true;
            } else if (linkedIndices.has(link.to) && !linkedIndices.has(link.from)) {
                linkedIndices.add(link.from);
                changed = true;
            }
        }
    }

    return Array.from(linkedIndices)
        .map(i => state.elementsList[i])
        .filter(Boolean);
}

// Reset state
export function resetState() {
    state.elementCounter = 0;
    state.depthCounter = 0;
    state.selectedElement = null;
    state.currentElement = null;
    state.elementsList = [];
    state.elementLinks = [];
    state.snapEnabled = false;
    state.gridVisible = false;
    state.xrayMode = false;
    state.shadowMode = false;
    state.snapValue = 3.175; // 1/8 inch in mm
    state.snapUnit = 'inches';
    state.displayUnit = 'inches';
    state.snapFlyoutOpen = false;
    state.faceViewState = { ...DEFAULT_VIEWPORT_STATE };
    state.sideViewState = { ...DEFAULT_VIEWPORT_STATE };
    state.isModalOpen = false;
    state.editingElementId = null;
    state.currentFileName = 'No file loaded';
    state.isDirty = false;
}

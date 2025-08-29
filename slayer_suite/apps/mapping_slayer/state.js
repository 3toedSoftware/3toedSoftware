// state.js - Mapping Slayer state management for unified framework

import { UndoManager } from './undo-manager.js';
import { CommandUndoManager } from './command-undo.js';
import { appBridge } from '../../core/index.js';

// Auto-sync system for marker types
let mappingSyncAdapter = null;
let syncDebounceTimer = null;
let isSyncInProgress = false;
const SYNC_DEBOUNCE_DELAY = 100; // 100ms debounce

export const DEFAULT_MARKER_TYPES = [];

export const appState = {
    isDirty: false,
    dotsByPage: new Map(),
    nextInternalId: 1,
    dotSize: 1,
    markerTypes: {}, // Now a map of { 'I.1': { code, name, color, textColor, designReference, flagConfig } }
    activeMarkerType: null, // This will be the marker type CODE
    // flagConfigurations: {}, // DEPRECATED - Now using single global flag configuration
    globalFlagConfiguration: null, // Single shared flag configuration for all marker types
    customIconLibrary: [], // Array of custom uploaded icons {id, name, data}
    isPanning: false,
    dragTarget: null,
    dragStart: { x: 0, y: 0 },
    dragOriginalPositions: new Map(), // Stores original positions before dragging
    hasMoved: false,
    messagesVisible: false,
    messages2Visible: false,
    locationsVisible: true,
    instFilterMode: 'showInst', // 'instOnly', 'hideInst', 'showInst'
    searchResults: [],
    currentSearchIndex: -1,
    replaceText: '',
    replaceMatches: [],
    editingDot: null,
    pdfRenderTask: null,
    pdfDoc: null,
    sourcePdfBuffer: null,
    sourcePdfName: null,
    currentPdfPage: 1,
    totalPages: 1,
    pdfScale: 4.0,
    mapTransform: { x: 0, y: 0, scale: 1 },
    selectedDots: new Set(),
    isSelecting: false,
    selectionBox: null,
    selectionStart: { x: 0, y: 0 },
    justFinishedSelecting: false,
    justFinishedScraping: false,
    isScraping: false,
    isTrainingScrape: false,
    isOCRScraping: false,
    scrapeBox: null,
    scrapeStart: { x: 0, y: 0 },
    listViewMode: 'flat',
    sortMode: 'location', // 'location' or 'name'
    isAllPagesView: false,
    expandedMarkerTypes: new Set(),
    projectLegendCollapsed: false,
    pageLegendCollapsed: false,
    recentSearches: [],
    automapExactPhrase: true,
    copiedDot: null,
    lastMousePosition: { x: 0, y: 0 },
    scrapeHorizontalTolerance: 10,
    scrapeVerticalTolerance: 25,
    pageLabels: new Map(), // Maps pageNum → label string
    annotationLines: new Map(), // Maps pageNum → Map of line objects
    selectedAnnotationLines: new Set(), // Track selected annotation line IDs
    isDrawingAnnotation: false,
    annotationStartDot: null,
    annotationTempLine: null,
    draggingAnnotationEndpoint: null,
    draggingAnnotationOriginalPos: null,
    showAnnotationEndpoints: true,
    nextAnnotationId: 1
};

export function setDirtyState() {
    appState.isDirty = true;
    console.log('📊 [Mapping] setDirtyState called - broadcasting project:dirty');
    // Broadcast to save manager
    if (appBridge) {
        appBridge.broadcast('project:dirty');
        console.log('📊 [Mapping] project:dirty broadcast sent');
    } else {
        console.log('📊 [Mapping] WARNING: appBridge not available to broadcast dirty state');
    }
}

export function getCurrentPageData() {
    const pageNum = appState.currentPdfPage;
    if (!appState.dotsByPage.has(pageNum)) {
        appState.dotsByPage.set(pageNum, { dots: new Map(), nextLocationNumber: 1 });
    }
    return appState.dotsByPage.get(pageNum);
}

export function getDotsForPage(pageNum) {
    if (!appState.dotsByPage.has(pageNum)) {
        appState.dotsByPage.set(pageNum, { dots: new Map(), nextLocationNumber: 1 });
    }
    return appState.dotsByPage.get(pageNum).dots;
}

export function getCurrentPageDots() {
    return getDotsForPage(appState.currentPdfPage);
}

export function getAnnotationLinesForPage(pageNum) {
    if (!appState.annotationLines.has(pageNum)) {
        appState.annotationLines.set(pageNum, new Map());
    }
    return appState.annotationLines.get(pageNum);
}

export function getCurrentPageAnnotationLines() {
    return getAnnotationLinesForPage(appState.currentPdfPage);
}

export function serializeDotsByPage(dotsByPageMap) {
    const obj = {};
    for (const [pageNum, pageData] of dotsByPageMap.entries()) {
        obj[pageNum] = {
            dots: Array.from(pageData.dots.values()).map(dot => ({ ...dot })),
            nextLocationNumber: pageData.nextLocationNumber
        };
    }
    return obj;
}

export function deserializeDotsByPage(serializedObj) {
    const dotsByPageMap = new Map();
    for (const [pageNum, pageData] of Object.entries(serializedObj)) {
        const dots = new Map();
        pageData.dots.forEach(dot => {
            // Ensure dot has markerType property
            if (dot.signType && !dot.markerType) {
                dot.markerType = dot.signType;
                delete dot.signType;
            }

            // Ensure dot has flags field initialized (for backward compatibility)
            if (!dot.flags) {
                dot.flags = {
                    topLeft: false,
                    topRight: false,
                    bottomLeft: false,
                    bottomRight: false
                };
            }

            // Ensure dot has installed field (for backward compatibility)
            if (dot.installed === undefined) {
                dot.installed = false;
            }

            dots.set(dot.internalId, dot);
        });
        dotsByPageMap.set(parseInt(pageNum), {
            dots: dots,
            nextLocationNumber: pageData.nextLocationNumber
        });
    }
    return dotsByPageMap;
}

// DEPRECATED - Using CommandUndoManager instead
// export function initializeUndoManager() {
//     // This function is no longer used - keeping for reference only
// }

/**
 * Initialize the sync adapter reference
 * @param {Object} syncAdapter - The mapping sync adapter instance
 */
export function initializeSyncAdapter(syncAdapter) {
    mappingSyncAdapter = syncAdapter;
}

/**
 * Debounced sync function to prevent rapid sync calls
 */
function debouncedSync() {
    if (syncDebounceTimer) {
        clearTimeout(syncDebounceTimer);
    }

    syncDebounceTimer = setTimeout(async () => {
        if (!mappingSyncAdapter || isSyncInProgress) {
            return;
        }

        isSyncInProgress = true;
        try {
            console.log('🔄 Auto-syncing marker types...');
            await mappingSyncAdapter.syncMarkerTypes(appBridge);
        } catch (error) {
            console.error('❌ Auto-sync failed:', error);
        } finally {
            isSyncInProgress = false;
        }
    }, SYNC_DEBOUNCE_DELAY);
}

/**
 * Create a proxy for markerTypes that automatically syncs changes
 * @param {Object} markerTypes - The original markerTypes object
 * @returns {Proxy} Proxied markerTypes object
 */
function createAutoSyncMarkerTypes(markerTypes) {
    return new Proxy(markerTypes, {
        set(target, property, value, receiver) {
            // Set the value first
            const result = Reflect.set(target, property, value, receiver);

            // Trigger auto-sync if not already in progress and sync adapter is available
            if (!isSyncInProgress && mappingSyncAdapter) {
                debouncedSync();
            }

            return result;
        },

        deleteProperty(target, property) {
            // Delete the property first
            const result = Reflect.deleteProperty(target, property);

            // Trigger auto-sync if not already in progress and sync adapter is available
            if (!isSyncInProgress && mappingSyncAdapter) {
                debouncedSync();
            }

            return result;
        }
    });
}

/**
 * Replace the markerTypes object with an auto-syncing proxy
 * This should be called after the sync adapter is initialized
 */
export function enableAutoSync() {
    if (!mappingSyncAdapter) {
        console.warn('⚠️ Cannot enable auto-sync: sync adapter not initialized');
        return;
    }

    console.log('✅ Enabling automatic marker type sync');
    appState.markerTypes = createAutoSyncMarkerTypes(appState.markerTypes);
}

/**
 * Temporarily disable auto-sync (for bulk operations)
 * @returns {Function} Function to re-enable auto-sync
 */
export function withoutAutoSync(callback) {
    const wasInProgress = isSyncInProgress;
    isSyncInProgress = true;

    try {
        return callback();
    } finally {
        isSyncInProgress = wasInProgress;
    }
}

/**
 * Manually trigger a sync (useful for bulk operations)
 */
export function triggerManualSync() {
    if (!mappingSyncAdapter || isSyncInProgress) {
        return;
    }
    debouncedSync();
}

// Initialize custom icon library if not present
if (!appState.customIconLibrary) {
    appState.customIconLibrary = [];
}

// Store state reference globally
window.appState = appState;

// Re-export UndoManager for convenience
export { UndoManager, CommandUndoManager };

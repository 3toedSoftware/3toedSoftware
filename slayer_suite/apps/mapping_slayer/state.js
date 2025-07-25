// state.js - Mapping Slayer state management for unified framework

import { UndoManager } from './undo-manager.js';

export const DEFAULT_MARKER_TYPES = [
    { code: 'NEW', name: 'Marker Type Name', color: '#F72020', textColor: '#FFFFFF' },
];

export const appState = {
    isDirty: false,
    dotsByPage: new Map(), 
    nextInternalId: 1,
    dotSize: 1,
    markerTypes: {}, // Now a map of { 'I.1': { code, name, color, textColor, designReference } }
    activeMarkerType: null, // This will be the marker type CODE
    isPanning: false, 
    dragTarget: null,
    dragStart: { x: 0, y: 0 },
    hasMoved: false,
    messagesVisible: false,
    messages2Visible: false,
    locationsVisible: true,
    searchResults: [],
    currentSearchIndex: -1,
    replaceText: '',
    replaceMatches: [],
    editingDot: null,
    pdfRenderTask: null,
    pdfDoc: null,
    sourcePdfBuffer: null, 
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
    scrapeHorizontalTolerance: 1,
    scrapeVerticalTolerance: 25,
    pageLabels: new Map(), // Maps pageNum → label string
};

export function setDirtyState() {
    appState.isDirty = true;
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
            dots.set(dot.internalId, dot);
        });
        dotsByPageMap.set(parseInt(pageNum), {
            dots: dots,
            nextLocationNumber: pageData.nextLocationNumber
        });
    }
    return dotsByPageMap;
}

// Initialize UndoManager with callbacks
export function initializeUndoManager() {
    UndoManager.init(
        // getStateSnapshot
        () => {
            return {
                dotsByPage: serializeDotsByPage(appState.dotsByPage),
                currentPdfPage: appState.currentPdfPage
            };
        },
        // restoreState
        async (snapshot) => {
            appState.dotsByPage = deserializeDotsByPage(snapshot.dotsByPage);
            appState.currentPdfPage = snapshot.currentPdfPage;
            
            // Update UI after restore using dynamic imports to avoid circular dependencies
            try {
                const { renderDotsForCurrentPage } = await import('./map-controller.js');
                const { updateAllSectionsForCurrentPage, updatePageInfo } = await import('./ui.js');
                
                renderDotsForCurrentPage();
                updateAllSectionsForCurrentPage();
                updatePageInfo();
            } catch (e) {
                console.warn('UI update functions not available during restore');
            }
        },
        // updateUI
        () => {
            // This will be called when undo/redo state changes
            // We can add UI updates here if needed (like enabling/disabling buttons)
        }
    );
}

// Re-export UndoManager for convenience
export { UndoManager };
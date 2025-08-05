// state.js - Mapping Slayer state management for unified framework

import { UndoManager } from './undo-manager.js';
import { CommandUndoManager } from './command-undo.js';
import { appBridge } from '../../core/index.js';

export const DEFAULT_MARKER_TYPES = [];

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
    dragOriginalPositions: new Map(), // Stores original positions before dragging
    hasMoved: false,
    messagesVisible: false,
    messages2Visible: false,
    locationsVisible: true,
    codeFilterMode: 'showCode', // 'codeOnly', 'hideCode', 'showCode'
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
    // Broadcast to save manager
    if (appBridge) {
        appBridge.broadcast('project:dirty');
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

// Re-export UndoManager for convenience
export { UndoManager, CommandUndoManager };
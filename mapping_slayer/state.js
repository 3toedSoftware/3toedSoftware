// state.js

const DEFAULT_MARKER_TYPES = [
    { code: 'NEW', name: 'Marker Type Name', color: '#F72020', textColor: '#FFFFFF' },
];

const appState = {
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

function setDirtyState() {
    appState.isDirty = true;
}

function getCurrentPageData() {
    const pageNum = appState.currentPdfPage;
    if (!appState.dotsByPage.has(pageNum)) {
        appState.dotsByPage.set(pageNum, { dots: new Map(), nextLocationNumber: 1 });
    }
    return appState.dotsByPage.get(pageNum);
}

function getDotsForPage(pageNum) {
    if (!appState.dotsByPage.has(pageNum)) {
        appState.dotsByPage.set(pageNum, { dots: new Map(), nextLocationNumber: 1 });
    }
    return appState.dotsByPage.get(pageNum).dots;
}

function getCurrentPageDots() { 
    return getDotsForPage(appState.currentPdfPage); 
}

function serializeDotsByPage(dotsByPageMap) {
    const obj = {};
    for (const [pageNum, pageData] of dotsByPageMap.entries()) {
        obj[pageNum] = {
            dots: Array.from(pageData.dots.values()).map(dot => ({ ...dot })),
            nextLocationNumber: pageData.nextLocationNumber
        };
    }
    return obj;
}

function deserializeDotsByPage(dotsObject) {
    const map = new Map();
    for (const pageNum in dotsObject) {
        if (dotsObject.hasOwnProperty(pageNum)) {
            const pageData = dotsObject[pageNum];
            const dotsMap = new Map(pageData.dots.map(dot => [dot.internalId, dot]));
            map.set(parseInt(pageNum, 10), {
                dots: dotsMap,
                nextLocationNumber: pageData.nextLocationNumber
            });
        }
    }
    return map;
}

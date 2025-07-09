// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// --- Default Sign Types for New Projects ---
const DEFAULT_SIGN_TYPES = [
    { code: 'NEW', name: 'Sign Type Name', color: '#F72020', textColor: '#FFFFFF' },
];

// --- Global Application State ---
var appState = {
    isDirty: false,
    dotsByPage: new Map(), 
    dotSize: 1,
    signTypes: {}, // Now a map of { 'I.1': { code, name, color, textColor, designReference } }
    activeSignType: null, // This will be the sign type CODE
    isPanning: false, 
    dragTarget: null,
    dragStart: { x: 0, y: 0 },
    hasMoved: false,
    messagesVisible: false,
    // Tooltip system removed
    searchResults: [],
    currentSearchIndex: -1,
    editingDot: null,
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
    isScraping: false,
    scrapeBox: null,
    scrapeStart: { x: 0, y: 0 },
    listViewMode: 'flat',
    expandedSignTypes: new Set(),
    projectLegendCollapsed: false,
    pageLegendCollapsed: false,
    // New state for single automap
    recentSearches: [],
    automapExactPhrase: true,
    // Undo/Redo system
    undoHistory: [],
    undoIndex: -1,
    maxUndoHistory: 50,
    isUndoing: false,
};

let previewTimeout = null;

// --- New Automap Helper Functions ---

// A global flag to handle cancellation
let isAutomapCancelled = false;

function showAutomapProgress(mainStatus, progressPercent) {
    const modal = document.getElementById('automap-progress-modal');
    const statusEl = document.getElementById('automap-main-status');
    const fillEl = document.getElementById('automap-progress-fill');

    modal.style.display = 'block';
    statusEl.textContent = mainStatus;
    fillEl.style.width = `${progressPercent}%`;
}

function addActivityFeedItem(message, type = 'info') { // type can be 'info', 'success', 'error'
    const feedEl = document.getElementById('automap-activity-feed');
    const item = document.createElement('div');
    item.className = `activity-feed-item ${type}`;
    item.textContent = message;
    
    feedEl.appendChild(item);

    // Auto-scroll to the bottom
    feedEl.scrollTop = feedEl.scrollHeight;

    // Limit to ~50 items
    if (feedEl.children.length > 50) {
        feedEl.removeChild(feedEl.firstElementChild);
    }
}

function clearActivityFeed() {
    document.getElementById('automap-activity-feed').innerHTML = '';
}

// Utility to pause execution without blocking the main thread
const sleep = ms => new Promise(res => setTimeout(res, ms));


// --- Undo/Redo System ---

function initializeUndoHistory() {
    clearUndoHistory();
    const initialSnapshot = {
        dotsByPage: serializeDotsByPage(appState.dotsByPage),
        currentPdfPage: appState.currentPdfPage,
        description: 'Initial State',
        timestamp: Date.now()
    };
    appState.undoHistory.push(initialSnapshot);
    appState.undoIndex = 0;
    updateUndoUI();
}

function captureUndoState(description = 'Action') {
    if (appState.isUndoing) return;

    if (appState.undoIndex < appState.undoHistory.length - 1) {
        appState.undoHistory = appState.undoHistory.slice(0, appState.undoIndex + 1);
    }
    
    const snapshot = {
        dotsByPage: serializeDotsByPage(appState.dotsByPage),
        currentPdfPage: appState.currentPdfPage,
        description: description,
        timestamp: Date.now()
    };
    
    if (appState.undoHistory.length > 0) {
        const lastSnapshot = appState.undoHistory[appState.undoHistory.length - 1];
        if (JSON.stringify(lastSnapshot.dotsByPage) === JSON.stringify(snapshot.dotsByPage) && 
            lastSnapshot.currentPdfPage === snapshot.currentPdfPage) {
            return;
        }
    }
    
    appState.undoHistory.push(snapshot);
    appState.undoIndex = appState.undoHistory.length - 1;
    
    if (appState.undoHistory.length > appState.maxUndoHistory) {
        appState.undoHistory.shift();
        appState.undoIndex--;
    }
    
    updateUndoUI();
}

function undo() {
    if (appState.undoIndex <= 0) return;
    
    const actionToUndo = appState.undoHistory[appState.undoIndex].description;
    
    appState.isUndoing = true;
    appState.undoIndex--;
    
    const snapshot = appState.undoHistory[appState.undoIndex];
    restoreFromSnapshot(snapshot);
    
    appState.isUndoing = false;
    updateUndoUI();
    showCSVStatus(`↶ Undid: ${actionToUndo}`, true, 3000);
}

function redo() {
    if (appState.undoIndex >= appState.undoHistory.length - 1) return;
    
    const actionToRedo = appState.undoHistory[appState.undoIndex + 1].description;

    appState.isUndoing = true;
    appState.undoIndex++;
    
    const snapshot = appState.undoHistory[appState.undoIndex];
    restoreFromSnapshot(snapshot);
    
    appState.isUndoing = false;
    updateUndoUI();
    showCSVStatus(`↷ Redid: ${actionToRedo}`, true, 3000);
}

function restoreFromSnapshot(snapshot) {
    appState.dotsByPage = deserializeDotsByPage(snapshot.dotsByPage);
    
    if (snapshot.currentPdfPage !== appState.currentPdfPage) {
        changePage(snapshot.currentPdfPage);
    } else {
        renderDotsForCurrentPage();
        updateAllSectionsForCurrentPage();
    }
    
    clearSelection();
    appState.isDirty = true;
}

function updateUndoUI() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    
    if (undoBtn && redoBtn) {
        undoBtn.disabled = appState.undoIndex <= 0;
        redoBtn.disabled = appState.undoIndex >= appState.undoHistory.length - 1;
        
        if (appState.undoIndex > 0) {
            undoBtn.setAttribute('title', `Undo: ${appState.undoHistory[appState.undoIndex].description}`);
        } else {
            undoBtn.setAttribute('title', 'Nothing to undo');
        }
        
        if (appState.undoIndex < appState.undoHistory.length - 1) {
            redoBtn.setAttribute('title', `Redo: ${appState.undoHistory[appState.undoIndex + 1].description}`);
        } else {
            redoBtn.setAttribute('title', 'Nothing to redo');
        }
    }
}

function clearUndoHistory() {
    appState.undoHistory = [];
    appState.undoIndex = -1;
    updateUndoUI();
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    init();
});

function init() {
    let disclaimerAgreed = false;
    try {
        disclaimerAgreed = sessionStorage.getItem('mapping-slayer-disclaimer-agreed') === 'true';
    } catch (e) {
        // sessionStorage not available
    }
    
    if (disclaimerAgreed) {
        document.getElementById('disclaimer-modal').style.display = 'none';
    }
    
    setupEventListeners();
    initializeNewProjectSignTypes();
    updateAllSectionsForCurrentPage();
    updateAutomapControls(); // Add this line to populate the automap dropdown on init
}

function setDirtyState() {
    appState.isDirty = true;
}

// Tooltip management functions removed

// --- Data Serialization/Deserialization Helpers ---
function serializeDotsByPage(dotsByPageMap) {
    const obj = {};
    for (const [pageNum, pageData] of dotsByPageMap.entries()) {
        obj[pageNum] = {
            dots: Array.from(pageData.dots.values()).map(dot => ({ ...dot })),
            nextDotNumber: pageData.nextDotNumber
        };
    }
    return obj;
}

function deserializeDotsByPage(dotsObject) {
    const map = new Map();
    for (const pageNum in dotsObject) {
        if (dotsObject.hasOwnProperty(pageNum)) {
            const pageData = dotsObject[pageNum];
            const dotsMap = new Map(pageData.dots.map(dot => [dot.id, dot]));
            map.set(parseInt(pageNum, 10), {
                dots: dotsMap,
                nextDotNumber: pageData.nextDotNumber
            });
        }
    }
    return map;
}

// --- State Management & Backward Compatibility ---
function migrateOldProjectData(projectData) {
    console.log("Migrating old project format...");
    const newSignTypes = {};

    const isV2Format = !!projectData.signTypeData;
    const oldTypes = isV2Format ? projectData.signTypeData : projectData.signTypes;

    for (const key in oldTypes) {
        let code, name, color, textColor;

        if (isV2Format) { 
            code = key;
            name = projectData.signTypeNames[key] || key;
            color = oldTypes[key].color;
            textColor = oldTypes[key].textColor;
        } else { 
            code = key;
            name = key;
            color = oldTypes[key].color;
            textColor = oldTypes[key].textColor;
        }
        
        let finalCode = code;
        let counter = 1;
        while (newSignTypes[finalCode]) {
            finalCode = `${code} (${counter++})`;
        }

        newSignTypes[finalCode] = { code: finalCode, name, color, textColor, designReference: null };

        for (const pageNum in projectData.dotsByPage) {
            projectData.dotsByPage[pageNum].dots.forEach(dot => {
                if (dot.signType === key) {
                    dot.signType = finalCode;
                }
            });
        }
    }
    
    projectData.signTypes = newSignTypes;

    delete projectData.signTypeData;
    delete projectData.signTypeNames;
    delete projectData.manuallyAddedSignTypes;

    showCSVStatus("✅ Old project file migrated to the new format!", true, 6000);
    return projectData;
}


function restoreStateFromData(projectData) {
    // Migrate very old project structures first
    if (!projectData.version || projectData.version < "4.0.0") {
        projectData = migrateOldProjectData(projectData);
    }

    appState.dotsByPage = deserializeDotsByPage(projectData.dotsByPage);
    appState.signTypes = projectData.signTypes;

    // --- MIGRATION FOR NOTES AND INSTALLED FIELDS ---
    // This ensures that projects saved before these fields were added will still work.
    for (const pageData of appState.dotsByPage.values()) {
        for (const dot of pageData.dots.values()) {
            if (dot.notes === undefined) {
                dot.notes = ''; // Add notes field with a default empty string
            }
            if (dot.installed === undefined) {
                dot.installed = false; // Add installed field, default to false
            }
            // Clean up the now-removed 'produced' field if it exists on old saves
            if (dot.produced !== undefined) {
                delete dot.produced;
            }
        }
    }

    // Ensure designReference property exists
    for (const code in appState.signTypes) {
        if (!appState.signTypes[code].hasOwnProperty('designReference')) {
            appState.signTypes[code].designReference = null;
        }
    }

    appState.dotSize = projectData.dotSize || 1;
    appState.totalPages = projectData.totalPages;
    appState.recentSearches = projectData.recentSearches || [];
    appState.automapExactPhrase = projectData.automapExactPhrase !== undefined ? projectData.automapExactPhrase : true;

    const signTypeKeys = Object.keys(appState.signTypes);
    appState.activeSignType = signTypeKeys.length > 0 ? signTypeKeys[0] : null;

    document.getElementById('project-name').textContent = projectData.projectName;
    document.getElementById('map-file-name').textContent = projectData.sourcePdfName;
    document.getElementById('dot-size-slider').value = appState.dotSize;

    showCSVStatus(`✅ Project "${projectData.projectName}" loaded successfully.`, true);
    
    initializeUndoHistory();
}


// --- PDF Rendering ---
async function renderPDFPage(pageNum) {
    if (!appState.pdfDoc) return;
    
    const page = await appState.pdfDoc.getPage(pageNum);
    const canvas = document.getElementById('pdf-canvas');
    const context = canvas.getContext('2d');
    const viewport = page.getViewport({ scale: appState.pdfScale });
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.display = 'block';

    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };
    await page.render(renderContext).promise;
    
    const mapContent = document.getElementById('map-content');
    mapContent.style.width = `${viewport.width}px`;
    mapContent.style.height = `${viewport.height}px`;
}

// --- Sign Type Cycling ---
function selectNextSignType() {
    const sortedCodes = Object.keys(appState.signTypes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (sortedCodes.length === 0) return;

    let currentIndex = sortedCodes.indexOf(appState.activeSignType);
    currentIndex++;
    if (currentIndex >= sortedCodes.length) {
        currentIndex = 0; // Wrap around
    }
    appState.activeSignType = sortedCodes[currentIndex];
    updateFilterCheckboxes();
    updateAutomapControls();
}

function selectPreviousSignType() {
    const sortedCodes = Object.keys(appState.signTypes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (sortedCodes.length === 0) return;

    let currentIndex = sortedCodes.indexOf(appState.activeSignType);
    currentIndex--;
    if (currentIndex < 0) {
        currentIndex = sortedCodes.length - 1; // Wrap around
    }
    appState.activeSignType = sortedCodes[currentIndex];
    updateFilterCheckboxes();
    updateAutomapControls();
}


// --- Event Listeners and Handlers ---
function setupEventListeners() {
    const mapContainer = document.getElementById('map-container');
    mapContainer.addEventListener('click', handleMapClick);
    mapContainer.addEventListener('contextmenu', handleMapRightClick);
    mapContainer.addEventListener('mousedown', handleMapMouseDown);
    mapContainer.addEventListener('mousemove', handleMapMouseMove);
    mapContainer.addEventListener('mouseup', handleMapMouseUp);
    mapContainer.addEventListener('wheel', handleMapWheel);
    mapContainer.addEventListener('mouseleave', () => { appState.isPanning = false; });

    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); e.currentTarget.classList.add('dragover'); });
    uploadArea.addEventListener('dragleave', (e) => { e.preventDefault(); e.currentTarget.classList.remove('dragover'); });
    uploadArea.addEventListener('drop', handleFileDrop);
    fileInput.addEventListener('change', handleFileSelect);
    
    document.getElementById('save-project-btn').addEventListener('click', handleSaveProject);
    document.getElementById('load-project-btn').addEventListener('click', () => fileInput.click());

    document.getElementById('single-automap-btn').addEventListener('click', automapSingleLocation);
    const automapInput = document.getElementById('automap-text-input');
    automapInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            automapSingleLocation();
        }
    });
    document.getElementById('automap-exact-phrase').addEventListener('change', (e) => {
        appState.automapExactPhrase = e.target.checked;
        setDirtyState();
    });

    const projectLegendHeader = document.querySelector('#project-legend .map-legend-header');
    if (projectLegendHeader) {
        projectLegendHeader.addEventListener('click', () => {
            appState.projectLegendCollapsed = !appState.projectLegendCollapsed;
            document.getElementById('project-legend').classList.toggle('collapsed', appState.projectLegendCollapsed);
        });
    }

    const mapLegendHeader = document.querySelector('#map-legend .map-legend-header');
    if (mapLegendHeader) {
        mapLegendHeader.addEventListener('click', () => {
            appState.pageLegendCollapsed = !appState.pageLegendCollapsed;
            document.getElementById('map-legend').classList.toggle('collapsed', appState.pageLegendCollapsed);
        });
    }

    const controlsHeader = document.querySelector('#controls-dropdown .controls-header');
    if (controlsHeader) {
        controlsHeader.addEventListener('click', () => {
            document.getElementById('controls-dropdown').classList.toggle('open');
        });
    }

    const updateCsvInput = document.getElementById('update-csv-input');
    updateCsvInput.addEventListener('change', handleScheduleUpdate);
    const findInput = document.getElementById('find-input');
    findInput.addEventListener('input', handleFind);
    findInput.addEventListener('keydown', handleFindEnter);
    document.getElementById('dot-size-slider').addEventListener('input', handleDotSizeChange);
    document.getElementById('create-pdf-btn').addEventListener('click', createAnnotatedPDF);
    document.getElementById('create-schedule-btn').addEventListener('click', createMessageSchedule);
    document.getElementById('update-from-schedule-btn').addEventListener('click', () => updateCsvInput.click());
    document.getElementById('add-sign-type-btn').addEventListener('click', addNewSignType);
    document.getElementById('prev-page').addEventListener('click', prevPage);
    document.getElementById('next-page').addEventListener('click', nextPage);
    document.getElementById('renumber-btn').addEventListener('click', renumberLocations);
    document.getElementById('toggle-messages-btn').addEventListener('click', toggleMessages);
    document.getElementById('toggle-view-btn').addEventListener('click', toggleListView);
    document.getElementById('delete-dot-btn').addEventListener('click', deleteDot);
    document.getElementById('cancel-modal-btn').addEventListener('click', closeModal);
    document.getElementById('update-dot-btn').addEventListener('click', updateDot);
    document.getElementById('group-delete-btn').addEventListener('click', groupDeleteDots);
    document.getElementById('group-cancel-btn').addEventListener('click', closeGroupModal);
    document.getElementById('group-update-btn').addEventListener('click', groupUpdateDots);
    document.getElementById('close-automap-btn').addEventListener('click', () => {
        document.getElementById('automap-progress-modal').style.display = 'none';
        document.getElementById('cancel-automap-btn').style.display = 'none';
    });
    document.getElementById('close-ocr-modal-btn').addEventListener('click', () => {
        document.getElementById('ocr-info-modal').style.display = 'none';
    });

    document.getElementById('undo-btn').addEventListener('click', undo);
    document.getElementById('redo-btn').addEventListener('click', redo);

    document.getElementById('disclaimer-agree-btn').addEventListener('click', () => {
        document.getElementById('disclaimer-modal').style.display = 'none';
        try {
            sessionStorage.setItem('mapping-slayer-disclaimer-agreed', 'true');
        } catch (e) {
            // Ignore
        }
    });
    
    document.getElementById('disclaimer-cancel-btn').addEventListener('click', () => {
        window.location.href = 'mapping_slayer_landing.html';
    });

    document.addEventListener('keydown', (e) => { 
        if (isModalOpen()) return;
        const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

        if (e.key === 'Escape') {
            closeModal(); 
            closeGroupModal(); 
            document.getElementById('ocr-info-modal').style.display = 'none';
            clearSelection(); 
            clearSearchHighlights();
            document.getElementById('find-input').value = '';
            document.getElementById('find-count').textContent = '';
        } else if (e.key === 'Delete') {
            if (isTyping) return;
            if (appState.selectedDots.size > 0) {
                e.preventDefault(); 
                deleteSelectedDots();
            }
        } else if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
                e.preventDefault();
                redo();
            }
        } else if (!isTyping) {
            if (e.key === 'PageDown') {
                e.preventDefault();
                nextPage();
            } else if (e.key === 'PageUp') {
                e.preventDefault();
                prevPage();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectNextSignType();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectPreviousSignType();
            }
        }
    });

    window.addEventListener('beforeunload', (e) => {
        if (appState.isDirty) {
            e.preventDefault();
            e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            return 'You have unsaved changes. Are you sure you want to leave?';
        }
    });
}

function handleSaveProject() {
    console.log('=== SAVE DEBUG ===');
    console.log('pdfDoc exists:', !!appState.pdfDoc);
    console.log('sourcePdfBuffer exists:', !!appState.sourcePdfBuffer);
    console.log('sourcePdfBuffer type:', typeof appState.sourcePdfBuffer);
    console.log('sourcePdfBuffer byteLength:', appState.sourcePdfBuffer ? appState.sourcePdfBuffer.byteLength : 'N/A');
    console.log('sourcePdfBuffer value:', appState.sourcePdfBuffer);
    
    if (!appState.pdfDoc || !appState.sourcePdfBuffer) {
        alert('Please load a PDF or .mslay file to save.');
        return;
    }
    const projectDataToSave = {
        version: '5.0.0', // Add this line
        sourcePdfBuffer: appState.sourcePdfBuffer,
        projectName: document.getElementById('project-name').textContent,
        sourcePdfName: document.getElementById('map-file-name').textContent,
        totalPages: appState.totalPages,
        dotsByPage: serializeDotsByPage(appState.dotsByPage),
        signTypes: appState.signTypes,
        dotSize: appState.dotSize,
        recentSearches: appState.recentSearches,
        automapExactPhrase: appState.automapExactPhrase
        };
    ProjectIO.save(projectDataToSave);
    appState.isDirty = false;
}

async function handleFileSelect(e) {
    const file = e.target.files[0];
    const allowedExtensions = ['.pdf', '.mslay'];
    if (!file) return;

    console.log('FILE SELECT DEBUG: file size =', file.size, 'bytes');

    const fileExtension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
        alert('Unsupported file type. Please upload a .pdf or .mslay file.');
        return;
    }
    
    document.getElementById('upload-area').style.display = 'none';
    const loadingMessage = `Loading ${file.name}...`;
    document.getElementById('map-file-name').textContent = loadingMessage;
    showCSVStatus(loadingMessage, true);

    const result = await ProjectIO.load(file);

    if (!result) {
        document.getElementById('upload-area').style.display = 'flex';
        document.getElementById('map-file-name').textContent = 'No file loaded';
        return;
    }

    appState.pdfDoc = result.pdfDoc;
    appState.sourcePdfBuffer = result.pdfBuffer;
    appState.totalPages = result.pdfDoc.numPages;
    
    console.log('=== LOAD DEBUG ===');
    console.log('result.pdfBuffer exists:', !!result.pdfBuffer);
    console.log('result.pdfBuffer type:', typeof result.pdfBuffer);
    console.log('result.pdfBuffer byteLength:', result.pdfBuffer ? result.pdfBuffer.byteLength : 'N/A');
    console.log('appState.sourcePdfBuffer set to:', !!appState.sourcePdfBuffer);
    
    if (result.isProject) {
        restoreStateFromData(result.projectData);
    } else {
        appState.dotsByPage = new Map();
        initializeNewProjectSignTypes();
        document.getElementById('map-file-name').textContent = file.name;
        document.getElementById('project-name').textContent = file.name.replace(/\.pdf$/i, '');
        appState.recentSearches = [];
        appState.automapExactPhrase = true;
        
        initializeUndoHistory();
        
        const firstPage = await appState.pdfDoc.getPage(1);
        const textContent = await firstPage.getTextContent();
        if (textContent.items.length === 0) {
            document.getElementById('ocr-info-modal').style.display = 'block';
        }
    }
    
    document.getElementById('save-project-btn').disabled = false;
    document.getElementById('create-pdf-btn').disabled = false;
    document.getElementById('create-schedule-btn').disabled = false;
    document.getElementById('update-from-schedule-btn').disabled = false;
    document.getElementById('single-automap-btn').disabled = false;
    document.getElementById('automap-text-input').disabled = false;
    document.getElementById('automap-sign-type-select').disabled = false;

    clearSelection();
    appState.mapTransform = { x: 0, y: 0, scale: 1 };
    applyMapTransform();
    await changePage(1);
    e.target.value = '';
    appState.isDirty = false;
}

function handleFileDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
        handleFileSelect({ target: { files: [file] } });
    }
}

function initializeNewProjectSignTypes() {
    appState.signTypes = {};
    DEFAULT_SIGN_TYPES.forEach(st => {
        appState.signTypes[st.code] = { 
            code: st.code,
            name: st.name,
            color: st.color, 
            textColor: st.textColor,
            designReference: null 
        };
    });
    appState.activeSignType = DEFAULT_SIGN_TYPES.length > 0 ? DEFAULT_SIGN_TYPES[0].code : null;
}

function showCSVStatus(message, isSuccess = true, duration = 5000) {
    const statusDiv = document.getElementById('csv-status');
    const contentDiv = document.getElementById('csv-status-content');
    contentDiv.textContent = message;
    statusDiv.className = `csv-status visible ${isSuccess ? 'success' : 'error'}`;
    setTimeout(() => statusDiv.classList.remove('visible'), duration);
}

// --- Automap and Room List functions ---
function updateAutomapStatus(message, isError = false) {
    const statusEl = document.getElementById('automap-status');
    statusEl.textContent = message;
    statusEl.style.color = isError ? '#ff6b6b' : '#aaa';

    if (message) {
        setTimeout(() => {
            if (statusEl.textContent === message) {
                statusEl.textContent = '';
            }
        }, 5000);
    }
}

function updateRecentSearches(searchTerm) {
    appState.recentSearches = appState.recentSearches.filter(s => s !== searchTerm);
    appState.recentSearches.unshift(searchTerm);
    if (appState.recentSearches.length > 10) {
        appState.recentSearches.pop();
    }
    updateAutomapControls();
    setDirtyState();
}

function groupTextIntoLines(textItems) {
    if (!textItems || !textItems.length) return [];
    const sortedItems = [...textItems].sort((a, b) => {
        const y1 = a.transform[5]; const y2 = b.transform[5];
        if (Math.abs(y1 - y2) > 2) {
            return y2 - y1;
        }
        return a.transform[4] - b.transform[4];
    });

    const lines = [];
    let currentLine = [];
    if (sortedItems.length > 0) {
        currentLine.push(sortedItems[0]);
    }

    for (let i = 1; i < sortedItems.length; i++) {
        const prev = sortedItems[i-1];
        const current = sortedItems[i];
        if (Math.abs(current.transform[5] - prev.transform[5]) < prev.height * 0.5) {
            currentLine.push(current);
        } else {
            lines.push(currentLine);
            currentLine = [current];
        }
    }
    if (currentLine.length > 0) {
        lines.push(currentLine);
    }

    lines.forEach(line => line.sort((a,b) => a.transform[4] - b.transform[4]));
    
    return lines;
}


async function automapSingleLocation() {
    if (!appState.pdfDoc) {
        updateAutomapStatus('Please load a PDF file first.', true);
        return;
    }

    const textInput = document.getElementById('automap-text-input');
    const signTypeSelect = document.getElementById('automap-sign-type-select');
    const exactMatchCheckbox = document.getElementById('automap-exact-phrase');
    const searchTerm = textInput.value.trim();
    const signTypeCode = signTypeSelect.value;

    if (!searchTerm) {
        updateAutomapStatus('Please enter a room name to find.', true);
        return;
    }
    if (!signTypeCode) {
        updateAutomapStatus('Please select a sign type.', true);
        return;
    }
    
    isAutomapCancelled = false;
    const automapBtn = document.getElementById('single-automap-btn');
    const cancelBtn = document.getElementById('cancel-automap-btn');
    const closeBtn = document.getElementById('close-automap-btn');
    
    automapBtn.disabled = true;
    cancelBtn.style.display = 'inline-block';
    closeBtn.style.display = 'none';
    document.getElementById('automap-results').style.display = 'none';
    
    cancelBtn.onclick = () => {
        isAutomapCancelled = true;
        addActivityFeedItem('--- Operation Cancelled by User ---', 'error');
    };

    clearActivityFeed();
    showAutomapProgress("Preparing search...", 5);
    await sleep(200); // Give UI time to render

    try {
        if (isAutomapCancelled) throw new Error("Operation cancelled");
        showAutomapProgress("Loading page content...", 10);
        addActivityFeedItem(`Loading text from page ${appState.currentPdfPage}...`);
        
        const page = await appState.pdfDoc.getPage(appState.currentPdfPage);
        const viewport = page.getViewport({ scale: appState.pdfScale });
        const textContent = await page.getTextContent();
        
        await sleep(200);
        if (isAutomapCancelled) throw new Error("Operation cancelled");
        
        if (textContent.items.length === 0) {
            throw new Error("No live text found on this page.");
        }

        addActivityFeedItem(`Found ${textContent.items.length} text items to analyze.`);
        showAutomapProgress("Finding matches...", 20);
        await sleep(100);

        let matchesFound = 0;
        const dotsToAdd = [];
        const searchTermNormalized = searchTerm.replace(/\s+/g, ' ').toLowerCase();

        const textItems = textContent.items;
        const totalItems = textItems.length;
        const updateInterval = Math.max(1, Math.floor(totalItems / 20)); // Update UI roughly 20 times

        if (exactMatchCheckbox.checked) {
            addActivityFeedItem("Mode: Exact Phrase Matching");
            const lines = groupTextIntoLines(textContent.items);
            for (const line of lines) {
                if (isAutomapCancelled) throw new Error("Operation cancelled");
                const lineText = line.map(item => item.str).join('');
                addActivityFeedItem(`Checking line: "${lineText.substring(0, 50)}..."`);
                
                if (lineText.replace(/\s+/g, ' ').toLowerCase().includes(searchTermNormalized)) {
                    const firstItem = line[0];
                    const lastItem = line[line.length - 1];
                    const x0 = firstItem.transform[4];
                    const x1 = lastItem.transform[4] + lastItem.width;
                    const y_baseline = firstItem.transform[5];
                    
                    const [canvasX_start] = viewport.convertToViewportPoint(x0, y_baseline);
                    const [canvasX_end] = viewport.convertToViewportPoint(x1, y_baseline);
                    const [, canvasY] = viewport.convertToViewportPoint(0, y_baseline);
                    
                    const finalX = (canvasX_start + canvasX_end) / 2;
                    const finalY = canvasY - (firstItem.height * viewport.scale * 0.8);

                    if (!isCollision(finalX, finalY)) {
                        dotsToAdd.push({ x: finalX, y: finalY, message: searchTerm });
                        matchesFound++;
                        addActivityFeedItem(`Found match: '${searchTerm}'`, 'success');
                    } else {
                        addActivityFeedItem(`Collision detected for '${searchTerm}', skipping.`, 'error');
                    }
                }
                await sleep(10); // Small delay to keep UI responsive
            }

        } else { // Not exact match
            addActivityFeedItem("Mode: Contains Text Matching");
            for (let i = 0; i < textItems.length; i++) {
                if (isAutomapCancelled) throw new Error("Operation cancelled");
                const item = textItems[i];
                
                if (item.str.toLowerCase().includes(searchTermNormalized)) {
                    const x_center = item.transform[4] + item.width / 2;
                    const y_baseline = item.transform[5];

                    const [canvasX, canvasY] = viewport.convertToViewportPoint(x_center, y_baseline);
                    const finalY = canvasY - (item.height * viewport.scale * 0.8);

                    if (!isCollision(canvasX, finalY)) {
                        dotsToAdd.push({ x: canvasX, y: finalY, message: item.str.trim() });
                        matchesFound++;
                        addActivityFeedItem(`Found match: '${item.str.trim()}'`, 'success');
                    } else {
                        addActivityFeedItem(`Collision detected for '${item.str.trim()}', skipping.`, 'error');
                    }
                }
                
                if (i % updateInterval === 0) {
                    const progress = 20 + Math.round((i / totalItems) * 60); // Progress from 20% to 80%
                    showAutomapProgress("Finding matches...", progress);
                    addActivityFeedItem(`Checking: "${item.str}"`);
                    await sleep(1); // Yield to main thread
                }
            }
        }

        if (isAutomapCancelled) throw new Error("Operation cancelled");
        showAutomapProgress("Placing dots...", 90);
        addActivityFeedItem("Adding matched locations to the map...");
        await sleep(200);

        if (dotsToAdd.length > 0) {
            dotsToAdd.forEach(dotInfo => {
                addDot(dotInfo.x, dotInfo.y, signTypeCode, dotInfo.message);
            });
            captureUndoState(`Automap: ${searchTerm}`);
            updateRecentSearches(searchTerm);
            textInput.value = '';
        }
        
        showAutomapProgress("Finalizing...", 100);
        await sleep(500);

        const resultsEl = document.getElementById('automap-results');
        resultsEl.style.display = 'block';
        if (matchesFound > 0) {
            showAutomapProgress(`Completed: Found ${matchesFound} match(es)!`, 100);
            resultsEl.innerHTML = `Successfully placed <strong>${matchesFound}</strong> dot(s) for "${searchTerm}".`;
        } else {
            showAutomapProgress(`Completed: No matches found.`, 100);
            resultsEl.innerHTML = `Could not find any occurrences of "${searchTerm}" on page ${appState.currentPdfPage}.`;
        }

    } catch (error) {
        showAutomapProgress("Error Occurred", 100);
        document.getElementById('automap-results').style.display = 'block';
        document.getElementById('automap-results').innerHTML = `<span style="color: #ff6b6b;">${error.message}</span>`;
        console.error("Automap failed:", error);
    } finally {
        automapBtn.disabled = false;
        cancelBtn.style.display = 'none';
        closeBtn.style.display = 'inline-block';
    }
}


// --- Map Interaction and Core Drawing Logic ---
function isModalOpen() {
    return document.getElementById('edit-modal').style.display === 'block' || 
           document.getElementById('group-edit-modal').style.display === 'block' || 
           document.getElementById('automap-progress-modal').style.display === 'block' ||
           document.getElementById('save-roomlist-modal').style.display === 'block' ||
           document.getElementById('ocr-info-modal').style.display === 'block' ||
           document.getElementById('disclaimer-modal').style.display === 'block';
}

function deleteSelectedDots() {
    if (appState.selectedDots.size === 0) return;
    
    appState.selectedDots.forEach(dotId => { getCurrentPageDots().delete(dotId); });
    captureUndoState(`Delete ${appState.selectedDots.size} dots`);

    clearSelection(); 
    renderDotsForCurrentPage(); 
    updateAllSectionsForCurrentPage(); 
    updateSelectionUI();
    setDirtyState();
}

function startSelectionBox(e) {
    const rect = document.getElementById('map-container').getBoundingClientRect();
    appState.isSelecting = true; appState.selectionStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const selectionBox = document.createElement('div');
    selectionBox.className = 'selection-box';
    Object.assign(selectionBox.style, { left: `${appState.selectionStart.x}px`, top: `${appState.selectionStart.y}px`, width: '0px', height: '0px' });
    document.getElementById('map-container').appendChild(selectionBox);
    appState.selectionBox = selectionBox;
}

function startScrapeBox(e) {
    const rect = document.getElementById('map-container').getBoundingClientRect();
    appState.isScraping = true; appState.scrapeStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const scrapeBox = document.createElement('div');
    scrapeBox.className = 'scrape-box';
    Object.assign(scrapeBox.style, { left: `${appState.scrapeStart.x}px`, top: `${appState.scrapeStart.y}px`, width: '0px', height: '0px' });
    document.getElementById('map-container').appendChild(scrapeBox);
    appState.scrapeBox = scrapeBox;
}

function updateSelectionBox(e) {
    if (!appState.selectionBox) return;
    const rect = document.getElementById('map-container').getBoundingClientRect();
    const currentX = e.clientX - rect.left; 
    const currentY = e.clientY - rect.top;
    
    if (currentX < 0 || currentX > rect.width || currentY < 0 || currentY > rect.height) {
        appState.selectionBox.remove();
        appState.selectionBox = null;
        appState.isSelecting = false;
        return;
    }
    
    const left = Math.min(appState.selectionStart.x, currentX); 
    const top = Math.min(appState.selectionStart.y, currentY);
    const width = Math.abs(currentX - appState.selectionStart.x); 
    const height = Math.abs(currentY - appState.selectionStart.y);
    Object.assign(appState.selectionBox.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
}

function updateScrapeBox(e) {
    if (!appState.scrapeBox) return;
    const rect = document.getElementById('map-container').getBoundingClientRect();
    const currentX = e.clientX - rect.left; 
    const currentY = e.clientY - rect.top;
    
    if (currentX < 0 || currentX > rect.width || currentY < 0 || currentY > rect.height) {
        appState.scrapeBox.remove();
        appState.scrapeBox = null;
        appState.isScraping = false;
        return;
    }
    
    const left = Math.min(appState.scrapeStart.x, currentX); 
    const top = Math.min(appState.scrapeStart.y, currentY);
    const width = Math.abs(currentX - appState.scrapeStart.x); 
    const height = Math.abs(currentY - appState.scrapeStart.y);
    Object.assign(appState.scrapeBox.style, { 
        left: `${left}px`, 
        top: `${top}px`, 
        width: `${width}px`, 
        height: `${height}px` 
    });
}

function finishSelectionBox() {
    if (!appState.selectionBox) return;
    const boxRect = appState.selectionBox.getBoundingClientRect();
    const mapRect = document.getElementById('map-container').getBoundingClientRect();
    const selectionLeft = boxRect.left - mapRect.left; const selectionTop = boxRect.top - mapRect.top;
    const selectionRight = selectionLeft + boxRect.width; const selectionBottom = selectionTop + boxRect.height;
    document.querySelectorAll('.map-dot').forEach(dotElement => {
        if (dotElement.style.display === 'none') return;
        const dotRect = dotElement.getBoundingClientRect();
        const dotCenterX = dotRect.left + dotRect.width / 2 - mapRect.left;
        const dotCenterY = dotRect.top + dotRect.height / 2 - mapRect.top;
        if (dotCenterX >= selectionLeft && dotCenterX <= selectionRight && dotCenterY >= selectionTop && dotCenterY <= selectionBottom) {
            selectDot(dotElement.dataset.dotId);
        }
    });
    appState.selectionBox.remove(); appState.selectionBox = null;
    appState.isSelecting = false; appState.justFinishedSelecting = true;
    updateSelectionUI();
}

async function finishScrape() {
    if (!appState.scrapeBox) return;
    const boxRect = appState.scrapeBox.getBoundingClientRect();
    const mapRect = document.getElementById('map-container').getBoundingClientRect();
    const { x: mapX, y: mapY, scale } = appState.mapTransform;
    const canvasX1 = (boxRect.left - mapRect.left - mapX) / scale; const canvasY1 = (boxRect.top - mapRect.top - mapY) / scale;
    const canvasX2 = (boxRect.right - mapRect.left - mapX) / scale; const canvasY2 = (boxRect.bottom - mapRect.top - mapY) / scale;
    const boxLeft = Math.min(canvasX1, canvasX2); const boxTop = Math.min(canvasY1, canvasY2);
    const boxRight = Math.max(canvasX1, canvasX2); const boxBottom = Math.max(canvasY1, canvasY2);
    const page = await appState.pdfDoc.getPage(appState.currentPdfPage);
    const viewport = page.getViewport({ scale: appState.pdfScale });
    const textContent = await page.getTextContent(); const capturedTextItems = [];
    for (const item of textContent.items) {
        const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        if (x >= boxLeft && x <= boxRight && y >= boxTop && y <= boxBottom) { capturedTextItems.push(item); }
    }
    if (capturedTextItems.length > 0) {
        capturedTextItems.sort((a, b) => {
            const yDiff = a.transform[5] - b.transform[5];
            if (Math.abs(yDiff) < 2) { return a.transform[4] - b.transform[4]; }
            return yDiff;
        });
        const message = capturedTextItems.map(item => item.str).join(' ');
        const centerX = (boxLeft + boxRight) / 2; const centerY = (boxTop + boxBottom) / 2;
        if (!isCollision(centerX, centerY)) {
            addDot(centerX, centerY, appState.activeSignType, message);
            captureUndoState('Scrape text');
        }
    } else {
        showCSVStatus("Live Text Not Found", false);
    }
    appState.scrapeBox.remove(); appState.scrapeBox = null;
    appState.isScraping = false;
    document.removeEventListener('contextmenu', preventContextMenu);
}

function selectDot(dotId) {
    appState.selectedDots.add(dotId);
    const dotElement = document.querySelector(`.map-dot[data-dot-id="${dotId}"]`);
    if (dotElement) {
        dotElement.classList.add('selected');
        Object.assign(dotElement.style, {
            boxShadow: '0 0 15px #00ff88, 0 0 30px #00ff88',
            border: '2px solid #00ff88',
            zIndex: '200'
        });
    }
}

function deselectDot(dotId) {
    appState.selectedDots.delete(dotId);
    const dotElement = document.querySelector(`.map-dot[data-dot-id="${dotId}"]`);
    if (dotElement) {
        dotElement.classList.remove('selected');
        Object.assign(dotElement.style, { boxShadow: '', border: '', zIndex: '' });
    }
}

function toggleDotSelection(dotId) {
    if (appState.selectedDots.has(dotId)) { deselectDot(dotId); } else { selectDot(dotId); }
}

function clearSelection() {
    appState.selectedDots.forEach(dotId => { deselectDot(dotId); });
    appState.selectedDots.clear();
    document.querySelectorAll('.location-item.selected, .grouped-location-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    updateSelectionUI();
}

function updateSelectionUI() {
    updateListHighlighting();
}

function updateListHighlighting() {
    document.querySelectorAll('.location-item, .grouped-location-item').forEach(item => {
        const dotId = item.dataset.dotId;
        item.classList.toggle('selected', appState.selectedDots.has(dotId));
    });
}

function getCurrentPageData() {
    const pageNum = appState.currentPdfPage;
    if (!appState.dotsByPage.has(pageNum)) {
        appState.dotsByPage.set(pageNum, { dots: new Map(), nextDotNumber: 1 });
    }
    return appState.dotsByPage.get(pageNum);
}

function getDotsForPage(pageNum) {
    if (!appState.dotsByPage.has(pageNum)) {
        appState.dotsByPage.set(pageNum, { dots: new Map(), nextDotNumber: 1 });
    }
    return appState.dotsByPage.get(pageNum).dots;
}

function getCurrentPageDots() { return getDotsForPage(appState.currentPdfPage); }

function addDot(x, y, signTypeCode, message, isCodeRequired = false) {
    const pageData = getCurrentPageData();
    const effectiveSignTypeCode = signTypeCode || appState.activeSignType || Object.keys(appState.signTypes)[0];
    if (!effectiveSignTypeCode) { 
        showCSVStatus("Cannot add dot: No sign types exist. Please add one.", false);
        return; 
    }
    const dotId = String(pageData.nextDotNumber).padStart(4, '0');
    
    // Create the dot object with all required fields, including the new ones
    const dot = { 
        id: dotId, 
        x, 
        y, 
        signType: effectiveSignTypeCode, 
        message: message || 'NEW LOCATION', 
        isCodeRequired: isCodeRequired,
        notes: '',        // New field: default to empty string
        installed: false  // New field: default to false
    };

    pageData.dots.set(dotId, dot);
    pageData.nextDotNumber++;

    createDotElement(dot);
    updateAllSectionsForCurrentPage();
    setDirtyState();
}

function createDotElement(dot) {
    const mapContent = document.getElementById('map-content');
    if (!mapContent) return;
    const dotElement = document.createElement('div');
    dotElement.className = 'map-dot';
    dotElement.dataset.dotId = dot.id;
    Object.assign(dotElement.style, { left: `${dot.x}px`, top: `${dot.y}px` });
    const signTypeInfo = appState.signTypes[dot.signType] || { color: '#ff0000', textColor: '#FFFFFF' };
    Object.assign(dotElement.style, { backgroundColor: signTypeInfo.color, color: signTypeInfo.textColor });

    const effectiveMultiplier = appState.dotSize * 2;
    const size = 20 * effectiveMultiplier;
    Object.assign(dotElement.style, { width: `${size}px`, height: `${size}px`, fontSize: `${8 * effectiveMultiplier}px` });

    if (appState.selectedDots.has(dot.id)) { dotElement.classList.add('selected'); }
    if (dot.isCodeRequired) { dotElement.classList.add('code-required-dot'); }

    const messageFontSize = 10 * effectiveMultiplier;
    const dotNumberDecoration = dot.installed ? 'text-decoration: underline;' : '';
    dotElement.innerHTML = `<span class="dot-number" style="${dotNumberDecoration}">${dot.id}</span><div class="map-dot-message" style="color: ${signTypeInfo.color}; font-size: ${messageFontSize}px;">${dot.message}</div>`;

    if (dot.notes && dot.notes.trim()) {
        dotElement.setAttribute('title', dot.notes);
    }

    if (appState.messagesVisible) { dotElement.querySelector('.map-dot-message').classList.add('visible'); }
    mapContent.appendChild(dotElement);
}


function handleMapClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
        return;
    }

    if (appState.hasMoved || appState.isPanning || appState.isSelecting || appState.isScraping || !appState.pdfDoc) return;
    if (appState.justFinishedSelecting) { appState.justFinishedSelecting = false; return; }
    
    const dotElement = e.target.closest('.map-dot');
    if (dotElement) {
    const dotId = dotElement.dataset.dotId;
    if (e.shiftKey) { 
        toggleDotSelection(dotId); 
    } else { 
        if (appState.selectedDots.has(dotId) && appState.selectedDots.size === 1) {
            clearSelection();
        } else {
            clearSelection(); 
            selectDot(dotId); 
        }
    }
    updateSelectionUI(); return;
}
    if (!e.shiftKey) {
        clearSearchHighlights();
        if (appState.selectedDots.size > 0) { clearSelection(); updateSelectionUI(); } 
        else {
            const { x: mapX, y: mapY, scale } = appState.mapTransform;
            const x = (e.clientX - rect.left - mapX) / scale;
            const y = (e.clientY - rect.top - mapY) / scale;
            if (!isCollision(x, y)) {
                addDot(x, y);
                captureUndoState('Add dot');
            }
        }
    }
}

function handleMapRightClick(e) {
    e.preventDefault(); 
    const dotElement = e.target.closest('.map-dot');
    if (dotElement) {
        const dotId = dotElement.dataset.dotId;
        if (appState.selectedDots.has(dotId) && appState.selectedDots.size > 1) { openGroupEditModal(); } 
        else { clearSelection(); selectDot(dotId); updateSelectionUI(); openEditModal(dotId); }
    }
}

function handleMapMouseDown(e) {
    appState.hasMoved = false;
    appState.dragStart = { x: e.clientX, y: e.clientY };

    if (e.button === 1) {
        appState.isPanning = true;
        e.currentTarget.style.cursor = 'grabbing';
        return;
    }

    if (e.button === 0) {
        const dotElement = e.target.closest('.map-dot');
        if (dotElement) {
            appState.dragTarget = dotElement;
        } else if (e.shiftKey) {
            e.preventDefault();
            startSelectionBox(e);
        }
    } else if (e.button === 2 && e.shiftKey) {
        e.preventDefault();
        startScrapeBox(e);
        document.addEventListener('contextmenu', preventContextMenu, { once: false });
    }
}

function preventContextMenu(e) {
    if (appState.isScraping) {
        e.preventDefault();
        return false;
    }
}

function handleMapMouseMove(e) {
    if (appState.isPanning) {
        appState.mapTransform.x += e.clientX - appState.dragStart.x;
        appState.mapTransform.y += e.clientY - appState.dragStart.y;
        applyMapTransform();
        appState.dragStart = { x: e.clientX, y: e.clientY };
        return;
    }

    if (!appState.hasMoved && (Math.abs(e.clientX - appState.dragStart.x) > 3 || Math.abs(e.clientY - appState.dragStart.y) > 3)) {
        appState.hasMoved = true;
    }

    if (!e.buttons) return;

    if (appState.dragTarget && appState.hasMoved) {
        setDirtyState();
        const moveDeltaX = (e.clientX - appState.dragStart.x) / appState.mapTransform.scale;
        const moveDeltaY = (e.clientY - appState.dragStart.y) / appState.mapTransform.scale;
        const draggedDotId = appState.dragTarget.dataset.dotId;
        const dotsToMove = appState.selectedDots.has(draggedDotId) && appState.selectedDots.size > 1 ? appState.selectedDots : [draggedDotId];

        dotsToMove.forEach(dotId => {
            const dot = getCurrentPageDots().get(dotId);
            const dotElement = document.querySelector(`.map-dot[data-dot-id="${dotId}"]`);
            if (dot && dotElement) {
                dot.x += moveDeltaX;
                dot.y += moveDeltaY;
                Object.assign(dotElement.style, { left: `${dot.x}px`, top: `${dot.y}px` });
                dotElement.classList.add('dragging');
            }
        });
        appState.dragStart = { x: e.clientX, y: e.clientY };
    } else if (appState.isSelecting) {
        updateSelectionBox(e);
    } else if (appState.isScraping) {
        updateScrapeBox(e);
    }
}

function handleMapMouseUp(e) {
    if (appState.isPanning) {
        appState.isPanning = false;
        e.currentTarget.style.cursor = 'grab';
    }
    if (appState.dragTarget) {
        if (appState.hasMoved) {
            captureUndoState('Move dot');
        }
        document.querySelectorAll('.map-dot.dragging').forEach(dot => dot.classList.remove('dragging'));
    }
    if (appState.isSelecting) {
        finishSelectionBox();
        appState.isSelecting = false;
    }
    if (appState.isScraping) {
        finishScrape();
        appState.isScraping = false;
    }
    appState.dragTarget = null;
}

function handleMapWheel(e) {
    e.preventDefault();
    const oldScale = appState.mapTransform.scale;
    const direction = e.deltaY < 0 ? 1 : -1;
    let newScale = oldScale * (1 + 0.1 * direction);
    newScale = Math.max(0.1, Math.min(newScale, 10));
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top;
    appState.mapTransform.x = mouseX - (mouseX - appState.mapTransform.x) * (newScale / oldScale);
    appState.mapTransform.y = mouseY - (mouseY - appState.mapTransform.y) * (newScale / oldScale);
    appState.mapTransform.scale = newScale;
    applyMapTransform();
}

function applyMapTransform() {
    const mapContent = document.getElementById('map-content');
    const { x, y, scale } = appState.mapTransform;
    mapContent.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

function handleDotSizeChange(e) {
    setDirtyState();
    appState.dotSize = parseFloat(e.target.value);
    // Re-render all dots to apply new size and checkmark scaling
    renderDotsForCurrentPage();
}

function handleFind(e) {
    const query = e.target.value.toLowerCase().trim();
    const findCountEl = document.getElementById('find-count');
    clearSearchHighlights();
    if (!query) { findCountEl.textContent = ''; appState.searchResults = []; appState.currentSearchIndex = -1; return; }
    appState.searchResults = Array.from(getCurrentPageDots().values()).filter(dot => dot.id.toLowerCase().includes(query) || dot.message.toLowerCase().includes(query));
    if (appState.searchResults.length > 0) { appState.currentSearchIndex = 0; updateFindUI(); } 
    else { appState.currentSearchIndex = -1; findCountEl.textContent = '0 found'; }
}

function handleFindEnter(e) {
    if (e.key === 'Enter' && appState.searchResults.length > 0) {
        e.preventDefault();
        appState.currentSearchIndex = (appState.currentSearchIndex + 1) % appState.searchResults.length;
        updateFindUI();
    }
}

function updateFindUI() {
    clearSearchHighlights();
    const findCountEl = document.getElementById('find-count');
    if (appState.searchResults.length > 0) {
        const dot = appState.searchResults[appState.currentSearchIndex];
        const dotElement = document.querySelector(`.map-dot[data-dot-id="${dot.id}"]`);
        if (dotElement) { dotElement.classList.add('search-highlight'); centerOnDot(dot.id); }
        findCountEl.textContent = `${appState.currentSearchIndex + 1} of ${appState.searchResults.length} found`;
    } else { findCountEl.textContent = '0 found'; }
}

function isDotVisible(dotId) {
    const dotElement = document.querySelector(`.map-dot[data-dot-id="${dotId}"]`); if (!dotElement) return false;
    const mapRect = document.getElementById('map-container').getBoundingClientRect();
    const dotRect = dotElement.getBoundingClientRect();
    return !(dotRect.right < mapRect.left || dotRect.left > mapRect.right || dotRect.bottom < mapRect.top || dotRect.top > mapRect.bottom);
}

function centerOnDot(dotId, zoomLevel = 1.5) {
    const dot = getCurrentPageDots().get(dotId); if (!dot) return;
    const containerRect = document.getElementById('map-container').getBoundingClientRect();
    appState.mapTransform.scale = zoomLevel;
    appState.mapTransform.x = (containerRect.width / 2) - (dot.x * zoomLevel);
    appState.mapTransform.y = (containerRect.height / 2) - (dot.y * zoomLevel);
    applyMapTransform();
}

function clearSearchHighlights() {
    document.querySelectorAll('.search-highlight').forEach(el => el.classList.remove('search-highlight'));
}

async function changePage(newPageNum) {
    if (newPageNum < 1 || newPageNum > appState.totalPages) return;
    clearSelection();
    appState.currentPdfPage = newPageNum;
    updatePageInfo();
    await renderPDFPage(newPageNum);
    renderDotsForCurrentPage();
    updateAllSectionsForCurrentPage();
}

function prevPage() { 
    if (appState.currentPdfPage > 1) {
        changePage(appState.currentPdfPage - 1); 
        captureUndoState('Previous page');
    }
}
function nextPage() { 
    if (appState.currentPdfPage < appState.totalPages) {
        changePage(appState.currentPdfPage + 1); 
        captureUndoState('Next page');
    }
}

function updateAllSectionsForCurrentPage() {
    updateFilterCheckboxes();
    updateLocationList();
    updateMapLegend();
    updateProjectLegend();
    updateEditModalOptions();
}

function renderDotsForCurrentPage() {
    document.getElementById('map-content').querySelectorAll('.map-dot').forEach(dot => dot.remove());
    getCurrentPageDots().forEach(dot => createDotElement(dot));
}

function updatePageInfo() {
    if (!appState.pdfDoc) return;
    document.getElementById('page-info').textContent = `PAGE ${appState.currentPdfPage} OF ${appState.totalPages}`;
    document.getElementById('prev-page').disabled = appState.currentPdfPage <= 1;
    document.getElementById('next-page').disabled = appState.currentPdfPage >= appState.totalPages;
}

// --- Sign Type Management ---
function updateFilterCheckboxes() {
    const container = document.getElementById('filter-checkboxes');
    container.innerHTML = '';
    const sortedSignTypeCodes = Object.keys(appState.signTypes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (sortedSignTypeCodes.length === 0) {
        container.innerHTML = '<div class="empty-state" style="font-size: 12px; padding: 10px;">No sign types exist. Click + to add one.</div>';
        return;
    }

    sortedSignTypeCodes.forEach(signTypeCode => {
        const typeData = appState.signTypes[signTypeCode];
        const count = Array.from(getCurrentPageDots().values()).filter(d => d.signType === signTypeCode).length;
        
        const item = document.createElement('div');
        item.className = 'filter-checkbox';
        if (signTypeCode === appState.activeSignType) {
            item.classList.add('legend-item-active');
        }
        
        item.innerHTML = `
            <input type="checkbox" data-sign-type-code="${signTypeCode}" checked>
            <span class="checkbox-label">(${count})</span>
            <div class="sign-type-inputs">
                <input type="text" class="sign-type-code-input" placeholder="Enter code..." value="${typeData.code}" data-original-code="${typeData.code}">
                <input type="text" class="sign-type-name-input" placeholder="Enter name..." value="${typeData.name}" data-original-name="${typeData.name}" data-code="${typeData.code}">
            </div>
            <div class="design-reference-container">
                <div class="design-reference-square" data-sign-type="${signTypeCode}">
                    <div class="design-reference-empty" style="display: ${typeData.designReference ? 'none' : 'flex'};">
                        <span class="upload-plus-icon">+</span>
                    </div>
                    <div class="design-reference-filled" style="display: ${typeData.designReference ? 'flex' : 'none'};">
                        <img class="design-reference-thumbnail" src="${typeData.designReference || ''}" alt="Design Reference">
                        <button class="design-reference-delete" type="button">&times;</button>
                    </div>
                </div>
                <input type="file" class="design-reference-input" accept="image/jpeg,image/jpg,image/png" style="display: none;" data-sign-type="${signTypeCode}">
            </div>
            <div class="sign-type-controls">
                <div class="color-picker-wrapper" data-sign-type-code="${signTypeCode}" data-color-type="dot"></div>
                <div class="color-picker-wrapper" data-sign-type-code="${signTypeCode}" data-color-type="text"></div>
                <button class="delete-sign-type-btn" data-sign-type-code="${signTypeCode}">×</button>
            </div>
`;
        container.appendChild(item);
        
        setupDesignReferenceHandlers(item, signTypeCode);
        
        const codeInput = item.querySelector('.sign-type-code-input');
        codeInput.classList.add('dynamic-input');
        codeInput.style.flex = '0 0 auto';
        codeInput.style.minWidth = '5px';

        const nameInput = item.querySelector('.sign-type-name-input');
        nameInput.style.flex = '1 1 30px';
        nameInput.style.minWidth = '30px';

        resizeInput(codeInput);
        codeInput.addEventListener('input', () => resizeInput(codeInput));
        codeInput.addEventListener('focus', () => resizeInput(codeInput));
        codeInput.addEventListener('blur', () => resizeInput(codeInput));
        
        item.addEventListener('click', (e) => {
            if (e.target.closest('input, .pcr-app, .color-picker-wrapper, .delete-sign-type-btn, .design-reference-square')) return;
            e.preventDefault();
            appState.activeSignType = signTypeCode;
            updateFilterCheckboxes();
        });

        item.querySelector('input[type="checkbox"]').addEventListener('change', applyFilters);

        const codeInputEvents = item.querySelector('.sign-type-code-input');
        codeInputEvents.addEventListener('change', (e) => handleSignTypeCodeChange(e.target));
        codeInputEvents.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
        codeInputEvents.addEventListener('input', (e) => {
            e.target.style.color = e.target.value.trim() ? 'white' : '#ccc';
        });

        const nameInputEvents = item.querySelector('.sign-type-name-input');
        nameInputEvents.addEventListener('change', (e) => handleSignTypeNameChange(e.target));
        nameInputEvents.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
        nameInputEvents.addEventListener('input', (e) => {
            e.target.style.color = e.target.value.trim() ? 'white' : '#aaa';
        });

        item.querySelector('.delete-sign-type-btn').addEventListener('click', () => deleteSignType(signTypeCode));
        initializeColorPickers(item, signTypeCode, typeData);
    });
}

function resizeInput(input) {
    const temp = document.createElement('span');
    temp.style.visibility = 'hidden';
    temp.style.position = 'absolute';
    temp.style.font = window.getComputedStyle(input).font;
    temp.style.padding = window.getComputedStyle(input).padding;
    temp.textContent = input.value || input.placeholder || 'A';
    document.body.appendChild(temp);
    
    const width = Math.max(5, temp.offsetWidth);
    input.style.width = width + 'px';
    
    document.body.removeChild(temp);
}

function initializeColorPickers(item, signTypeCode, typeData) {
    item.querySelectorAll('.color-picker-wrapper').forEach(wrapper => {
        const colorType = wrapper.dataset.colorType;
        const initialColor = (colorType === 'dot') ? typeData.color : typeData.textColor;
        wrapper.style.backgroundColor = initialColor;

        const pickr = Pickr.create({
            el: wrapper, theme: 'classic', useAsButton: true, default: initialColor,
            components: { preview: true, opacity: false, hue: true, interaction: { hex: true, rgba: false, input: true, save: true, clear: false } }
        });

        pickr.on('change', (color) => { wrapper.style.backgroundColor = color.toHEXA().toString(); });
        pickr.on('save', (color) => {
            const newColor = color.toHEXA().toString();
            if (colorType === 'dot') { appState.signTypes[signTypeCode].color = newColor; } 
            else { appState.signTypes[signTypeCode].textColor = newColor; }
            wrapper.style.backgroundColor = newColor;
            setDirtyState();
            updateAllSectionsForCurrentPage();
            renderDotsForCurrentPage();
            pickr.hide();
        });
        pickr.on('hide', () => {
            const currentColor = (colorType === 'dot') ? appState.signTypes[signTypeCode].color : appState.signTypes[signTypeCode].textColor;
            wrapper.style.backgroundColor = currentColor;
        });
    });
}

function handleSignTypeCodeChange(inputElement) {
    const originalCode = inputElement.dataset.originalCode;
    const newCode = inputElement.value.trim();

    if (newCode === originalCode) return;

    if (!newCode) {
        showCSVStatus("Sign type code cannot be empty.", false);
        inputElement.value = originalCode;
        return;
    }
    if (appState.signTypes[newCode]) {
        showCSVStatus(`Sign type code "${newCode}" already exists.`, false);
        inputElement.value = originalCode;
        return;
    }

    const typeData = appState.signTypes[originalCode];
    delete appState.signTypes[originalCode];
    typeData.code = newCode;
    appState.signTypes[newCode] = typeData;

    for (const pageData of appState.dotsByPage.values()) {
        for (const dot of pageData.dots.values()) {
            if (dot.signType === originalCode) {
                dot.signType = newCode;
            }
        }
    }
    
    if (appState.activeSignType === originalCode) {
        appState.activeSignType = newCode;
    }

    setDirtyState();
    updateAllSectionsForCurrentPage();
    updateAutomapControls(); // Add this line to update the automap dropdown
    showCSVStatus(`Renamed code "${originalCode}" to "${newCode}".`, true);
}

function handleSignTypeNameChange(inputElement) {
    const code = inputElement.dataset.code;
    const originalName = inputElement.dataset.originalName;
    const newName = inputElement.value.trim();

    if (newName === originalName) return;

    if (appState.signTypes[code]) {
        appState.signTypes[code].name = newName;
        setDirtyState();
        updateAllSectionsForCurrentPage();
        updateAutomapControls(); // Add this line to update the automap dropdown
        showCSVStatus(`Updated name for code "${code}".`, true);
    }
}

function addNewSignType() {
    let newCode = "NEW";
    let counter = 1;
    while (appState.signTypes[newCode]) {
        newCode = `NEW-${counter++}`;
    }

    appState.signTypes[newCode] = { 
        code: newCode, 
        name: 'New Sign Type', 
        color: '#808080', 
        textColor: '#FFFFFF', 
        designReference: null 
    };
    appState.activeSignType = newCode;

    setDirtyState();
    updateAllSectionsForCurrentPage();
    updateAutomapControls(); // Add this line to update the automap dropdown
    
    setTimeout(() => {
        const container = document.getElementById('filter-checkboxes');
        const newInput = container.querySelector(`.sign-type-code-input[value="${newCode}"]`);
        if (newInput) {
            newInput.focus();
            newInput.select();
        }
    }, 100);
}

function deleteSignType(signTypeCode) {
    let dotsUsingType = 0;
    for (const pageData of appState.dotsByPage.values()) {
        for (const dot of pageData.dots.values()) {
            if (dot.signType === signTypeCode) {
                dotsUsingType++;
            }
        }
    }

    if (dotsUsingType > 0) {
        for (const pageData of appState.dotsByPage.values()) {
            const dotsToDelete = [];
            for (const [dotId, dot] of pageData.dots.entries()) {
                if (dot.signType === signTypeCode) {
                    dotsToDelete.push(dotId);
                }
            }
            dotsToDelete.forEach(dotId => pageData.dots.delete(dotId));
        }
    }

    delete appState.signTypes[signTypeCode];

    if (appState.activeSignType === signTypeCode) {
        const remainingTypes = Object.keys(appState.signTypes);
        appState.activeSignType = remainingTypes.length > 0 ? remainingTypes[0] : null;
    }

    captureUndoState(`Delete sign type "${signTypeCode}"`);
    setDirtyState();
    renderDotsForCurrentPage();
    updateAllSectionsForCurrentPage();
    showCSVStatus(`Deleted sign type "${signTypeCode}" and ${dotsUsingType} associated dots.`, true);
}


function setupDesignReferenceHandlers(item, signType) {
    const square = item.querySelector('.design-reference-square');
    const fileInput = item.querySelector('.design-reference-input');
    const deleteBtn = item.querySelector('.design-reference-delete');

    square.addEventListener('click', (e) => {
        if (e.target.classList.contains('design-reference-delete')) return;
        e.stopPropagation();
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleDesignReferenceUpload(file, signType);
        }
        e.target.value = null; // Reset input
    });
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete the design reference for ${signType}?`)) {
                handleDesignReferenceDelete(signType);
            }
        });
    }

    square.addEventListener('mouseenter', e => showDesignReferencePreview(e, signType));
    square.addEventListener('mouseleave', hideDesignReferencePreview);
}

async function handleDesignReferenceUpload(file, signType) {
    try {
        const dataUrl = await resizeImage(file, 200, 200, 0.8);
        appState.signTypes[signType].designReference = dataUrl;
        captureUndoState(`Upload design ref for ${signType}`);
        setDirtyState();
        updateFilterCheckboxes();
    } catch (error) {
        console.error("Image upload failed:", error);
        showCSVStatus("Failed to process image.", false);
    }
}

function handleDesignReferenceDelete(signType) {
    appState.signTypes[signType].designReference = null;
    captureUndoState(`Delete design ref for ${signType}`);
    setDirtyState();
    updateFilterCheckboxes();
}

function resizeImage(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

function showDesignReferencePreview(e, signType) {
    const typeData = appState.signTypes[signType];
    if (!typeData || !typeData.designReference) return;
    
    clearTimeout(previewTimeout);

    hideDesignReferencePreview(); // Hide any existing ones immediately

    previewTimeout = setTimeout(() => {
        const previewDiv = document.createElement('div');
        previewDiv.className = 'design-reference-preview';
        previewDiv.id = 'design-reference-preview-popup';
        previewDiv.innerHTML = `
            <div class="design-reference-preview-label">${typeData.code} - ${typeData.name}</div>
            <img src="${typeData.designReference}" alt="Preview">
        `;
        document.body.appendChild(previewDiv);

        const targetRect = e.currentTarget.getBoundingClientRect();
        previewDiv.style.left = `${targetRect.right + 10}px`;
        previewDiv.style.top = `${targetRect.top}px`;
        
        setTimeout(() => previewDiv.classList.add('visible'), 10);

    }, 500);
}

function hideDesignReferencePreview() {
    clearTimeout(previewTimeout);
    const existingPreview = document.getElementById('design-reference-preview-popup');
    if (existingPreview) {
        existingPreview.classList.remove('visible');
        setTimeout(() => existingPreview.remove(), 200);
    }
}


function updateMapLegend() {
    const legend = document.getElementById('map-legend');
    const content = document.getElementById('map-legend-content');
    const usedSignTypeCodes = new Set(Array.from(getCurrentPageDots().values()).map(d => d.signType));
    
    legend.classList.toggle('collapsed', appState.pageLegendCollapsed);

    if (usedSignTypeCodes.size === 0) {
        legend.classList.remove('visible');
        return;
    }
    legend.classList.add('visible');
    content.innerHTML = '';
    const sortedSignTypeCodes = Array.from(usedSignTypeCodes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    sortedSignTypeCodes.forEach(code => {
        const typeData = appState.signTypes[code];
        const count = Array.from(getCurrentPageDots().values()).filter(d => d.signType === code).length;
        const item = document.createElement('div');
        item.className = 'map-legend-item';
        item.innerHTML = `<div class="map-legend-dot" style="background-color: ${typeData.color};"></div><span class="map-legend-text">${typeData.code} - ${typeData.name}</span><span class="map-legend-count">${count}</span>`;
        content.appendChild(item);
    });
}

function updateProjectLegend() {
    const legend = document.getElementById('project-legend');
    const content = document.getElementById('project-legend-content');
    if (!legend || !content) return;

    const projectCounts = new Map();
    for (const pageData of appState.dotsByPage.values()) {
        for (const dot of pageData.dots.values()) {
            projectCounts.set(dot.signType, (projectCounts.get(dot.signType) || 0) + 1);
        }
    }

    legend.classList.toggle('collapsed', appState.projectLegendCollapsed);

    if (projectCounts.size === 0) {
        legend.classList.remove('visible');
        return;
    }

    legend.classList.add('visible');
    content.innerHTML = '';

    const sortedSignTypeCodes = Array.from(projectCounts.keys()).sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));

    sortedSignTypeCodes.forEach(code => {
        const typeData = appState.signTypes[code];
        const count = projectCounts.get(code);
        const item = document.createElement('div');
        item.className = 'map-legend-item';
        item.innerHTML = `<div class="map-legend-dot" style="background-color: ${typeData ? typeData.color : '#FFFFFF'};"></div><span class="map-legend-text">${typeData.code} - ${typeData.name}</span><span class="map-legend-count">${count}</span>`;
        content.appendChild(item);
    });
}

function getActiveFilters() {
    const container = document.getElementById('filter-checkboxes');
    return container.hasChildNodes() ? Array.from(container.querySelectorAll('input:checked')).map(cb => cb.dataset.signTypeCode) : [];
}

function applyFilters() {
    const activeFilters = getActiveFilters();
    document.querySelectorAll('.map-dot').forEach(dotElement => {
        const dot = getCurrentPageDots().get(dotElement.dataset.dotId);
        dotElement.style.display = dot && activeFilters.includes(dot.signType) ? 'flex' : 'none';
    });
    updateLocationList(); updateMapLegend();
}

function updateLocationList() {
    const container = document.getElementById('location-list'); container.innerHTML = '';
    const listWrapper = document.getElementById('list-with-renumber');
    const emptyState = document.getElementById('empty-state');
    const activeFilters = getActiveFilters();
    const allDots = Array.from(getCurrentPageDots().values()).filter(dot => activeFilters.includes(dot.signType));
    if (allDots.length === 0) {
        listWrapper.style.display = 'none'; emptyState.style.display = 'block';
        emptyState.textContent = getCurrentPageDots().size > 0 ? 'No dots match the current filter.' : 'Click on the map to add your first location dot.';
        return;
    }
    emptyState.style.display = 'none'; listWrapper.style.display = 'block';
    document.getElementById('toggle-view-btn').textContent = appState.listViewMode === 'flat' ? 'SIGN TYPE' : 'FULL LIST';
    if (appState.listViewMode === 'grouped') { renderGroupedLocationList(allDots, container); } else { renderFlatLocationList(allDots, container); }
}

function renderFlatLocationList(allDots, container) {
    allDots.sort((a, b) => {
        const aSelected = appState.selectedDots.has(a.id); const bSelected = appState.selectedDots.has(b.id);
        if (aSelected && !bSelected) return -1; if (!aSelected && bSelected) return 1;
        return a.id.localeCompare(b.id);
    }).forEach(dot => {
        const typeData = appState.signTypes[dot.signType];
        const item = document.createElement('div');
        item.className = 'location-item'; item.dataset.dotId = dot.id;
        if (appState.selectedDots.has(dot.id)) { item.classList.add('selected'); }
        
        const badgeClass = dot.isCodeRequired ? 'sign-type-badge code-required-badge' : 'sign-type-badge';
        const badgeText = `${typeData.code} - ${typeData.name}`;

        item.innerHTML = `<div class="location-header"><span class="location-number">${dot.id}</span><input type="text" class="location-message-input" value="${dot.message}" data-dot-id="${dot.id}"><span class="${badgeClass}" style="background-color:${typeData.color}; color: ${typeData.textColor};" title="${badgeText}">${badgeText}</span></div>`;
        container.appendChild(item);

        item.addEventListener('click', (e) => {
            if (!isDotVisible(dot.id)) centerOnDot(dot.id);
            if (e.shiftKey) { 
                toggleDotSelection(dot.id); 
            } else { 
                if (appState.selectedDots.has(dot.id) && appState.selectedDots.size === 1) {
                    clearSelection();
                } else {
                    clearSelection(); 
                    selectDot(dot.id); 
                }
            }
            updateSelectionUI();
        });

        const messageInput = item.querySelector('.location-message-input');
        let originalMessage = dot.message;

        messageInput.addEventListener('focus', () => {
            originalMessage = dot.message;
        });

        messageInput.addEventListener('input', (e) => {
            dot.message = e.target.value;
            setDirtyState();
            renderDotsForCurrentPage(); 
        });
        
        messageInput.addEventListener('change', (e) => {
            if (dot.message !== originalMessage) {
                 captureUndoState('Edit message');
            }
        });
        
        messageInput.addEventListener('click', (e) => {
            e.stopPropagation(); 
        });

        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
            }
        });
        
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault(); if (!isDotVisible(dot.id)) centerOnDot(dot.id);
            if (appState.selectedDots.has(dot.id) && appState.selectedDots.size > 1) { openGroupEditModal(); } 
            else { clearSelection(); selectDot(dot.id); updateSelectionUI(); openEditModal(dot.id); }
        });
    });
}

function renderGroupedLocationList(allDots, container) {
    const groupedDots = {};
    allDots.forEach(dot => {
        if (!groupedDots[dot.signType]) groupedDots[dot.signType] = [];
        groupedDots[dot.signType].push(dot);
    });
    const sortedSignTypeCodes = Object.keys(groupedDots).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    sortedSignTypeCodes.forEach(signTypeCode => {
        const dots = groupedDots[signTypeCode]; 
        const typeData = appState.signTypes[signTypeCode];
        const isExpanded = appState.expandedSignTypes.has(signTypeCode);
        const category = document.createElement('div');
        category.className = 'sign-type-category'; category.style.borderLeftColor = typeData.color;
        const displayName = `${typeData.code} - ${typeData.name}`;
        category.innerHTML = `
            <div class="sign-type-category-header"><div class="sign-type-category-title"><span class="expand-icon ${isExpanded ? 'expanded' : ''}">▶</span>${displayName}</div><span class="sign-type-category-count">${dots.length}</span></div>
            <div class="sign-type-items ${isExpanded ? 'expanded' : ''}" id="items-${signTypeCode.replace(/[^a-zA-Z0-9]/g, '-')}"></div>
        `;
        container.appendChild(category);
        category.querySelector('.sign-type-category-header').addEventListener('click', () => toggleSignTypeExpansion(signTypeCode));
        const itemsContainer = category.querySelector('.sign-type-items');
        dots.sort((a, b) => a.id.localeCompare(b.id)).forEach(dot => {
            const item = document.createElement('div');
            item.className = 'grouped-location-item'; item.dataset.dotId = dot.id;
            if (appState.selectedDots.has(dot.id)) { item.classList.add('selected'); }
            
            const badgeClass = dot.isCodeRequired ? 'sign-type-badge code-required-badge' : 'sign-type-badge';

            item.innerHTML = `<div class="grouped-location-header"><span class="location-number">${dot.id}</span><span class="location-message">${dot.message}</span></div>`;
            itemsContainer.appendChild(item);

            item.addEventListener('click', (e) => {
                if (!isDotVisible(dot.id)) centerOnDot(dot.id);
                if (e.shiftKey) { 
                    toggleDotSelection(dot.id); 
                } else { 
                    if (appState.selectedDots.has(dot.id) && appState.selectedDots.size === 1) {
                        clearSelection();
                    } else {
                        clearSelection(); 
                        selectDot(dot.id); 
                    }
                }
                updateSelectionUI();
            });
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault(); if (!isDotVisible(dot.id)) centerOnDot(dot.id);
                if (appState.selectedDots.has(dot.id) && appState.selectedDots.size > 1) { openGroupEditModal(); } 
                else { clearSelection(); selectDot(dot.id); updateSelectionUI(); openEditModal(dot.id); }
            });
        });
    });
}

function toggleListView() { appState.listViewMode = appState.listViewMode === 'flat' ? 'grouped' : 'flat'; updateLocationList(); }

function toggleSignTypeExpansion(signTypeCode) {
    if (appState.expandedSignTypes.has(signTypeCode)) { appState.expandedSignTypes.delete(signTypeCode); } 
    else { appState.expandedSignTypes.add(signTypeCode); }
    const itemsContainer = document.getElementById(`items-${signTypeCode.replace(/[^a-zA-Z0-9]/g, '-')}`);
    const expandIcon = itemsContainer.parentElement.querySelector('.expand-icon');
    itemsContainer.classList.toggle('expanded', appState.expandedSignTypes.has(signTypeCode));
    expandIcon.classList.toggle('expanded', appState.expandedSignTypes.has(signTypeCode));
}

function renumberLocations() {
    const pageData = getCurrentPageData();
    const oldDots = Array.from(pageData.dots.values()).sort((a, b) => {
        const yDiff = a.y - b.y;
        if (Math.abs(yDiff) < 30) { return a.x - b.x; }
        return yDiff;
    });
    const newDots = new Map();
    oldDots.forEach((dot, index) => {
        dot.id = String(index + 1).padStart(4, '0');
        newDots.set(dot.id, dot);
    });
    pageData.dots = newDots;
    pageData.nextDotNumber = oldDots.length + 1;
    
    captureUndoState('Renumber locations');
    
    renderDotsForCurrentPage();
    updateAllSectionsForCurrentPage();
    appState.isDirty = true;
}

function toggleMessages() {
    appState.messagesVisible = !appState.messagesVisible;
    const btn = document.getElementById('toggle-messages-btn');
    btn.textContent = appState.messagesVisible ? 'HIDE MSG' : 'SHOW MSG';
    btn.classList.toggle('active', appState.messagesVisible);
    document.querySelectorAll('.map-dot-message').forEach(msg => msg.classList.toggle('visible', appState.messagesVisible));
}

// --- Modal and Editing Logic ---

function openGroupEditModal() {
    const selectedCount = appState.selectedDots.size;
    if (selectedCount < 2) return;

    document.getElementById('group-edit-count').textContent = selectedCount;
    updateEditModalOptions('group-edit-sign-type', true);
    document.getElementById('group-edit-message').value = '';
    document.getElementById('group-edit-notes').value = '';

    const selectedDots = Array.from(appState.selectedDots).map(id => getCurrentPageDots().get(id));

    // Handle 'Code Required' checkbox state
    const codeRequiredCheckbox = document.getElementById('group-edit-code-required');
    const allCodeRequired = selectedDots.every(dot => dot.isCodeRequired);
    const noneCodeRequired = selectedDots.every(dot => !dot.isCodeRequired);

    if (allCodeRequired) {
        codeRequiredCheckbox.checked = true;
        codeRequiredCheckbox.indeterminate = false;
    } else if (noneCodeRequired) {
        codeRequiredCheckbox.checked = false;
        codeRequiredCheckbox.indeterminate = false;
    } else {
        codeRequiredCheckbox.checked = false;
        codeRequiredCheckbox.indeterminate = true;
    }

    // Handle 'Installed' checkbox state
    const installedCheckbox = document.getElementById('group-edit-installed');
    const allInstalled = selectedDots.every(dot => dot.installed);
    const noneInstalled = selectedDots.every(dot => !dot.installed);

    if (allInstalled) {
        installedCheckbox.checked = true;
        installedCheckbox.indeterminate = false;
    } else if (noneInstalled) {
        installedCheckbox.checked = false;
        installedCheckbox.indeterminate = false;
    } else {
        installedCheckbox.checked = false;
        installedCheckbox.indeterminate = true;
    }

    document.getElementById('group-edit-modal').style.display = 'block';
}


function closeGroupModal() { document.getElementById('group-edit-modal').style.display = 'none'; }

function groupUpdateDots() {
    const newSignTypeCode = document.getElementById('group-edit-sign-type').value;
    const newMessage = document.getElementById('group-edit-message').value.trim();
    const newNotes = document.getElementById('group-edit-notes').value; // Keep as is, don't trim yet
    const codeRequiredCheckbox = document.getElementById('group-edit-code-required');
    const installedCheckbox = document.getElementById('group-edit-installed');

    appState.selectedDots.forEach(dotId => {
        const dot = getCurrentPageDots().get(dotId);
        if (dot) {
            if (newSignTypeCode) dot.signType = newSignTypeCode;
            if (newMessage) dot.message = newMessage;
            
            // Always overwrite notes as per user confirmation
            dot.notes = newNotes.trim();

            if (!codeRequiredCheckbox.indeterminate) {
                dot.isCodeRequired = codeRequiredCheckbox.checked;
            }
            if (!installedCheckbox.indeterminate) {
                dot.installed = installedCheckbox.checked;
            }
        }
    });
    captureUndoState(`Edit ${appState.selectedDots.size} dots`);

    closeGroupModal(); 

    renderDotsForCurrentPage(); 
    updateAllSectionsForCurrentPage(); 
    updateSelectionUI();
    setDirtyState();
}

function groupDeleteDots() {
    appState.selectedDots.forEach(dotId => { getCurrentPageDots().delete(dotId); });
    captureUndoState(`Delete ${appState.selectedDots.size} dots`);
    
    closeGroupModal(); 
    
    clearSelection(); 
    renderDotsForCurrentPage(); 
    updateAllSectionsForCurrentPage();
    setDirtyState();
}

function updateEditModalOptions(selectElementId = 'edit-sign-type', isGroupEdit = false) {
    const select = document.getElementById(selectElementId);
    const sortedSignTypeCodes = Object.keys(appState.signTypes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    let optionsHtml = isGroupEdit ? '<option value="">-- Keep Individual Types --</option>' : '';
    optionsHtml += sortedSignTypeCodes.map(code => {
        const typeData = appState.signTypes[code];
        return `<option value="${code}">${typeData.code} - ${typeData.name}</option>`;
    }).join('');
    select.innerHTML = optionsHtml;
}

function updateAutomapControls() {
    const select = document.getElementById('automap-sign-type-select');
    const datalist = document.getElementById('recent-searches-datalist');
    const checkbox = document.getElementById('automap-exact-phrase');

    const sortedSignTypeCodes = Object.keys(appState.signTypes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    let optionsHtml = sortedSignTypeCodes.map(code => {
        const typeData = appState.signTypes[code];
        const isSelected = code === appState.activeSignType ? 'selected' : '';
        return `<option value="${code}" ${isSelected}>${typeData.code} - ${typeData.name}</option>`;
    }).join('');
    select.innerHTML = optionsHtml;

    let datalistHtml = appState.recentSearches.map(term => `<option value="${term}"></option>`).join('');
    datalist.innerHTML = datalistHtml;

    checkbox.checked = appState.automapExactPhrase;
}

function openEditModal(dotId) {
    const dot = getCurrentPageDots().get(dotId); if (!dot) return;
    appState.editingDot = dotId;
    updateEditModalOptions(); 
    document.getElementById('edit-sign-type').value = dot.signType;
    document.getElementById('edit-location-display').textContent = dot.id;
    document.getElementById('edit-message').value = dot.message;
    document.getElementById('edit-code-required').checked = dot.isCodeRequired || false;
    document.getElementById('edit-installed').checked = dot.installed || false;
    document.getElementById('edit-notes').value = dot.notes || '';
    document.getElementById('edit-modal').style.display = 'block';
}

function closeModal() { document.getElementById('edit-modal').style.display = 'none'; appState.editingDot = null; }

function updateDot() {
    if (!appState.editingDot) return;
    const dot = getCurrentPageDots().get(appState.editingDot); if (!dot) return;
    
    dot.signType = document.getElementById('edit-sign-type').value;
    dot.message = document.getElementById('edit-message').value.trim();
    dot.isCodeRequired = document.getElementById('edit-code-required').checked;
    dot.installed = document.getElementById('edit-installed').checked;
    dot.notes = document.getElementById('edit-notes').value.trim();
    
    appState.activeSignType = dot.signType;
    captureUndoState('Edit dot');

    renderDotsForCurrentPage(); 
    updateAllSectionsForCurrentPage(); 
    closeModal();
    setDirtyState();
}

function deleteDot() {
    if (appState.editingDot) {
        getCurrentPageDots().delete(appState.editingDot);
        captureUndoState('Delete dot');

        renderDotsForCurrentPage(); 
        updateAllSectionsForCurrentPage(); 
        closeModal();
        setDirtyState();
    }
}

// --- Export/Import Functions ---

function createMessageSchedule() {
    if (!appState.pdfDoc) { alert('Please load a PDF first.'); return; }
    const activeFilters = getActiveFilters(); let allVisibleDots = [];
    for (let pageNum = 1; pageNum <= appState.totalPages; pageNum++) {
        const dotsOnPage = Array.from(getDotsForPage(pageNum).values());
        const visibleDots = dotsOnPage.filter(dot => activeFilters.includes(dot.signType)).map(dot => ({ ...dot, page: pageNum }));
        allVisibleDots.push(...visibleDots);
    }
    if (allVisibleDots.length === 0) { alert('No annotations match the current filters. CSV not created.'); return; }
    allVisibleDots.sort((a, b) => {
        const signTypeComparison = a.signType.localeCompare(b.signType, undefined, { numeric: true });
        if (signTypeComparison !== 0) return signTypeComparison;
        return a.id.localeCompare(b.id);
    });
    let csvContent = "SIGN TYPE CODE,SIGN TYPE NAME,MESSAGE,LOCATION NUMBER,MAP PAGE,CODE REQUIRED,INSTALLED\n";
    allVisibleDots.forEach(dot => {
        const typeData = appState.signTypes[dot.signType];
        const row = [
            `"${typeData.code.replace(/"/g, '""')}"`, 
            `"${typeData.name.replace(/"/g, '""')}"`, 
            `"${dot.message.replace(/"/g, '""')}"`, 
            `'${dot.id}'`, 
            dot.page,
            dot.isCodeRequired ? 'YES' : 'NO',
            dot.installed ? 'YES' : 'NO'
        ].join(',');
        csvContent += row + "\n";
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const mapFileName = document.getElementById('map-file-name').textContent.replace('.pdf', '');
    link.setAttribute("download", `${mapFileName}_MessageSchedule.csv`);
    link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

async function createAnnotatedPDF() {
    if (!appState.pdfDoc) { alert('Please load a PDF first.'); return; }
    const createPdfBtn = document.getElementById('create-pdf-btn');
    const originalBtnText = createPdfBtn.textContent;
    createPdfBtn.disabled = true; createPdfBtn.textContent = 'Generating...';
    const activeFilters = getActiveFilters(); const messagesVisible = appState.messagesVisible;
    const tempCanvas = document.createElement('canvas'); const tempCtx = tempCanvas.getContext('2d');
    
    try {
        const { jsPDF } = window.jspdf; 
        let outputPdf = null;
        let detailPageNumbers = new Map(); // Track which page each dot's detail page is on
        let currentDetailPageNumber = 0;
        
        // First pass: Create the main annotated pages
        for (let pageNum = 1; pageNum <= appState.totalPages; pageNum++) {
            const dotsToDraw = Array.from(getDotsForPage(pageNum).values()).filter(dot => activeFilters.includes(dot.signType));
            if (dotsToDraw.length === 0) continue;
            createPdfBtn.textContent = `Main Page ${pageNum}/${appState.totalPages}...`;
            
            const page = await appState.pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: appState.pdfScale });
            tempCanvas.width = viewport.width; tempCanvas.height = viewport.height;
            await page.render({ canvasContext: tempCtx, viewport: viewport }).promise;
            const imgData = tempCanvas.toDataURL('image/jpeg', 0.9);
            
            if (!outputPdf) {
                outputPdf = new jsPDF({ orientation: viewport.width > viewport.height ? 'landscape' : 'portrait', unit: 'pt', format: [viewport.width, viewport.height] });
            } else { 
                outputPdf.addPage([viewport.width, viewport.height], viewport.width > viewport.height ? 'landscape' : 'portrait'); 
            }
            
            outputPdf.addImage(imgData, 'JPEG', 0, 0, viewport.width, viewport.height);
            drawLegendWithJsPDF(outputPdf, dotsToDraw);
            
            // Create detail pages for each dot and track their page numbers
            for (const dot of dotsToDraw) {
                currentDetailPageNumber++;
                detailPageNumbers.set(`${pageNum}-${dot.id}`, outputPdf.internal.getNumberOfPages() + currentDetailPageNumber);
            }
            
            // Draw dots with hyperlinks to their detail pages
            drawDotsWithHyperlinks(outputPdf, dotsToDraw, messagesVisible, pageNum, detailPageNumbers);
        }
        
        // Second pass: Create detail pages for all dots
        createPdfBtn.textContent = 'Creating detail pages...';
        for (let pageNum = 1; pageNum <= appState.totalPages; pageNum++) {
            const dotsToDraw = Array.from(getDotsForPage(pageNum).values()).filter(dot => activeFilters.includes(dot.signType));
            for (const dot of dotsToDraw) {
                createDetailPage(outputPdf, dot, pageNum);
            }
        }
        
        if (outputPdf) {
            const mapFileName = document.getElementById('map-file-name').textContent.replace('.pdf', '');
            outputPdf.save(`${mapFileName}_interactive.pdf`);
        } else { 
            alert('No annotations match the current filters. PDF not created.'); 
        }
    } catch (error) {
        console.error('Failed to create PDF:', error);
        alert('An error occurred while creating the PDF. Check the console for details.');
    } finally {
        createPdfBtn.disabled = false; createPdfBtn.textContent = originalBtnText; tempCanvas.remove();
    }
}

function drawLegendWithJsPDF(pdf, dotsOnPage) {
    if (dotsOnPage.length === 0) return;
    const usedSignTypeCodes = new Set(dotsOnPage.map(d => d.signType));
    const sortedSignTypeCodes = Array.from(usedSignTypeCodes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const padding = 40, itemHeight = 32, dotRadius = 10, legendWidth = 440, headerHeight = 50;
    const legendHeight = headerHeight + (sortedSignTypeCodes.length * itemHeight) + padding;
    const x = padding, y = padding;
    pdf.setFillColor(255, 255, 255); pdf.setDrawColor(0, 0, 0); pdf.setLineWidth(1);
    pdf.rect(x, y, legendWidth, legendHeight, 'FD');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(32); pdf.setTextColor(0, 0, 0);
    pdf.text('PAGE LEGEND', x + legendWidth / 2, y + 34, { align: 'center' });
    let currentY = y + headerHeight + 20; pdf.setFont('helvetica', 'normal');
    sortedSignTypeCodes.forEach(code => {
        const typeData = appState.signTypes[code];
        const count = dotsOnPage.filter(d => d.signType === code).length;
        const displayText = `(${count}) ${typeData.code} - ${typeData.name}`;
        pdf.setFillColor(typeData.color); pdf.setDrawColor(0, 0, 0); pdf.setLineWidth(1);
        pdf.circle(x + padding, currentY, dotRadius, 'FD');
        pdf.setFontSize(24); pdf.setTextColor(0, 0, 0);
        pdf.text(displayText, x + padding + 30, currentY, { baseline: 'middle' });
        currentY += itemHeight;
    });
}

function drawDotsWithHyperlinks(pdf, dotsOnPage, messagesVisible, sourcePageNum, detailPageNumbers) {
    const effectiveMultiplier = appState.dotSize * 2; 
    
    dotsOnPage.forEach(dot => {
        const signTypeInfo = appState.signTypes[dot.signType] || { color: '#ff0000', textColor: '#FFFFFF' };
        const radius = (20 * effectiveMultiplier) / 2;
        const fontSize = 8 * effectiveMultiplier;
        const pdfX = dot.x; const pdfY = dot.y;
        
        // Draw the dot
        pdf.setFillColor(signTypeInfo.color);
        pdf.setDrawColor(signTypeInfo.color);
        pdf.circle(pdfX, pdfY, radius, 'F');
        
        // Add code required border if needed
        if (dot.isCodeRequired) {
            pdf.setDrawColor(25, 25, 25);
            pdf.setLineWidth(5);
            pdf.circle(pdfX, pdfY, radius + 2.5, 'S');
            pdf.setDrawColor(242, 255, 0);
            pdf.setLineWidth(3);
            pdf.circle(pdfX, pdfY, radius + 1.5, 'S');
        }

        // Add dot number text
        pdf.setFont('helvetica', 'bold'); 
        pdf.setFontSize(fontSize); 
        pdf.setTextColor(signTypeInfo.textColor);
        pdf.text(String(dot.id), pdfX, pdfY, { align: 'center', baseline: 'middle' });
        
        // Add message if visible
        if (messagesVisible && dot.message) {
            pdf.setFont('helvetica', 'bold'); 
            pdf.setFontSize(fontSize * 1.1); 
            pdf.setTextColor(signTypeInfo.color);
            pdf.text(dot.message, pdfX, pdfY + radius + (fontSize * 0.5), { align: 'center', baseline: 'top' });
        }
        
        // Create invisible clickable area over the dot that links to detail page
        const detailPageNum = detailPageNumbers.get(`${sourcePageNum}-${dot.id}`);
        if (detailPageNum) {
            pdf.link(
                pdfX - radius, 
                pdfY - radius, 
                radius * 2, 
                radius * 2, 
                { pageNumber: detailPageNum }
            );
        }
    });
}

function drawDotsWithJsPDF(pdf, dotsOnPage, messagesVisible) {
    const effectiveMultiplier = appState.dotSize * 2; 
    dotsOnPage.forEach(dot => {
        const signTypeInfo = appState.signTypes[dot.signType] || { color: '#ff0000', textColor: '#FFFFFF' };
        const radius = (20 * effectiveMultiplier) / 2;
        const fontSize = 8 * effectiveMultiplier;
        const pdfX = dot.x; const pdfY = dot.y;
        
        pdf.setFillColor(signTypeInfo.color);
        pdf.setDrawColor(signTypeInfo.color);
        pdf.circle(pdfX, pdfY, radius, 'F');
        
        if (dot.isCodeRequired) {
            pdf.setDrawColor(25, 25, 25);
            pdf.setLineWidth(5);
            pdf.circle(pdfX, pdfY, radius + 2.5, 'S');
            pdf.setDrawColor(242, 255, 0);
            pdf.setLineWidth(3);
            pdf.circle(pdfX, pdfY, radius + 1.5, 'S');
        }

        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(fontSize); pdf.setTextColor(signTypeInfo.textColor);
        pdf.text(String(dot.id), pdfX, pdfY, { align: 'center', baseline: 'middle' });
        
        if (messagesVisible && dot.message) {
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(fontSize * 1.1); pdf.setTextColor(signTypeInfo.color);
            pdf.text(dot.message, pdfX, pdfY + radius + (fontSize * 0.5), { align: 'center', baseline: 'top' });
        }
    });
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && (i === 0 || line[i-1] !== '"')) {
             inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.replace(/^"|"$/g, '').replace(/""/g, '"'));
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.replace(/^"|"$/g, '').replace(/""/g, '"'));
    return result;
}

async function handleScheduleUpdate(e) {
    const file = e.target.files[0]; if (!file) return;
    
    const csvText = await file.text();
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) { showCSVStatus("Update file is empty or missing headers.", false); return; }
    
    const headers = parseCSVLine(lines[0].trim()).map(h => h.toUpperCase());
    
    const codeIndex = headers.indexOf("SIGN TYPE CODE");
    const nameIndex = headers.indexOf("SIGN TYPE NAME");
    const messageIndex = headers.indexOf("MESSAGE");
    const locNumIndex = headers.indexOf("LOCATION NUMBER");
    const pageIndex = headers.indexOf("MAP PAGE");
    const codeRequiredIndex = headers.indexOf("CODE REQUIRED");
    const installedIndex = headers.indexOf("INSTALLED");

    if ([codeIndex, nameIndex, messageIndex, locNumIndex, pageIndex].includes(-1)) { 
        showCSVStatus("Update file is missing required columns (SIGN TYPE CODE, SIGN TYPE NAME, etc.).", false, 8000); 
        return; 
    }

    let updatedCount = 0; const skippedRows = [];
    for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        const signTypeCode = row[codeIndex]; 
        const message = row[messageIndex];
        const locNum = row[locNumIndex].replace(/'/g, '').padStart(4, '0');
        const pageNum = parseInt(row[pageIndex], 10);

        if (isNaN(pageNum)) { skippedRows.push({ line: i + 1, reason: "Invalid Map Page number." }); continue; }
        if (!appState.signTypes[signTypeCode]) { skippedRows.push({ line: i + 1, reason: `Sign Type Code "${signTypeCode}" does not exist in this project.` }); continue; }
        
        const dotToUpdate = getDotsForPage(pageNum).get(locNum);
        if (!dotToUpdate) { 
            skippedRows.push({ line: i + 1, reason: `Location ${locNum} on page ${pageNum} not found.` }); 
            continue; 
        }
        
        dotToUpdate.signType = signTypeCode; 
        dotToUpdate.message = message; 

        if (codeRequiredIndex > -1 && row[codeRequiredIndex] !== undefined) {
            dotToUpdate.isCodeRequired = row[codeRequiredIndex].trim().toUpperCase() === 'YES';
        }

        if (installedIndex > -1 && row[installedIndex] !== undefined) {
            dotToUpdate.installed = row[installedIndex].trim().toUpperCase() === 'YES';
        }
        
        updatedCount++;
    }
    
    if (updatedCount > 0) {
        captureUndoState('Import CSV update');
        setDirtyState();
    }
    
    renderDotsForCurrentPage(); 
    updateAllSectionsForCurrentPage();
    let feedbackMessage = `✅ Updated ${updatedCount} locations.`;
    if (skippedRows.length > 0) { feedbackMessage += ` ${skippedRows.length} skipped. See log for details.`; generateErrorLog(skippedRows); }
    showCSVStatus(feedbackMessage, true, 8000); e.target.value = '';
}

function generateErrorLog(skippedRows) {
    let logContent = "MAPPING SLAYER - UPDATE LOG\n";
    logContent += `Generated on: ${new Date().toLocaleString()}\n\n`;
    logContent += "The following rows from the update file were skipped:\n\n";
    skippedRows.forEach(skipped => { logContent += `- Line ${skipped.line}: ${skipped.reason}\n`; });
    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement("a"); const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const mapFileName = document.getElementById('map-file-name').textContent.replace('.pdf', '');
    link.setAttribute("download", `${mapFileName}_UpdateLog.txt`);
    link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function isCollision(newX, newY) {
    const dots = getCurrentPageDots();
    const minDistance = (20 * appState.dotSize) + 1;
    for (const dot of dots.values()) {
        const distance = Math.sqrt(Math.pow(dot.x - newX, 2) + Math.pow(dot.y - newY, 2));
        if (distance < minDistance) return true;
    }
    return false;
}

function createDetailPage(pdf, dot, sourcePageNum) {
    const signTypeInfo = appState.signTypes[dot.signType] || { color: '#ff0000', textColor: '#FFFFFF', code: 'UNKNOWN', name: 'Unknown Type' };
    
    pdf.addPage([612, 792], 'portrait');
    const pageWidth = 612;
    const pageHeight = 792;
    const margin = 40;
    const contentWidth = pageWidth - (2 * margin);
    let currentY = margin;

    // Back to Map Button
    const buttonWidth = 150;
    const buttonHeight = 30;
    const buttonX = (pageWidth - buttonWidth) / 2;
    pdf.setFillColor(220, 220, 220);
    pdf.setDrawColor(153, 153, 153);
    pdf.setLineWidth(1);
    pdf.roundedRect(buttonX, currentY, buttonWidth, buttonHeight, 5, 5, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.text('BACK TO MAP', pageWidth / 2, currentY + 20, { align: 'center' });
    pdf.link(buttonX, currentY, buttonWidth, buttonHeight, { pageNumber: Math.ceil(sourcePageNum) });
    currentY += 80;

    // Main Content Area (no border)
    const contentInnerMargin = 20;
    let contentY = currentY;
    const contentInnerWidth = contentWidth - (2 * contentInnerMargin);

    // Location ID
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(36);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`LOC# ${dot.id}`, margin + contentInnerMargin, contentY);
    contentY += 20;

    // Sign Type
    pdf.setFillColor(signTypeInfo.color);
    pdf.rect(margin + contentInnerMargin, contentY, 20, 20, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text(`Sign Type: ${signTypeInfo.code} - ${signTypeInfo.name}`, margin + contentInnerMargin + 30, contentY + 14);
    contentY += 40;

    // Message
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('Message:', margin + contentInnerMargin, contentY);
    contentY += 20;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    const messageLines = pdf.splitTextToSize(dot.message, contentInnerWidth);
    pdf.text(messageLines, margin + contentInnerMargin, contentY);
    contentY += (messageLines.length * 15) + 20;

    // Notes Section
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('NOTES:', margin + contentInnerMargin, contentY);
    contentY += 10;
    pdf.setDrawColor(220);
    pdf.roundedRect(margin + contentInnerMargin, contentY, contentInnerWidth, 100, 3, 3, 'S');
    if (dot.notes) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12);
        const notesLines = pdf.splitTextToSize(dot.notes, contentInnerWidth - 10);
        pdf.text(notesLines, margin + contentInnerMargin + 5, contentY + 12);
    }
    contentY += 140;
    
    // Status Checkboxes
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('Status:', margin + contentInnerMargin, contentY);
    contentY += 10;

    const checkboxSize = 12;
    const checkboxLabelOffset = 20;

    // Installed Checkbox (always show)
    pdf.setDrawColor(0);
    pdf.rect(margin + contentInnerMargin, contentY, checkboxSize, checkboxSize, 'S');
    if (dot.installed) {
        pdf.setFont('zapfdingbats');
        pdf.text('✓', margin + contentInnerMargin + 2, contentY + 10);
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.text('Installed', margin + contentInnerMargin + checkboxLabelOffset, contentY + 10);
    
    // Code Required Checkbox (always show)
    let codeRequiredX = margin + contentInnerMargin + 150;
    pdf.setDrawColor(0);
    pdf.rect(codeRequiredX, contentY, checkboxSize, checkboxSize, 'S');
    if (dot.isCodeRequired) {
        pdf.setFont('zapfdingbats');
        pdf.text('✓', codeRequiredX + 2, contentY + 10);
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.text('Code Required', codeRequiredX + checkboxLabelOffset, contentY + 10);
    
    contentY += 60;

    // Reference Image Section
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('REFERENCE IMAGE', margin + contentInnerMargin, contentY);
    contentY += 10;
    
    const placeholderWidth = 240;
    const placeholderHeight = 240;
    
    if (signTypeInfo.designReference) {
        // Draw placeholder border first
        pdf.setDrawColor(200);
        pdf.rect(margin + contentInnerMargin, contentY, placeholderWidth, placeholderHeight, 'S');
        
        // Show the actual reference image, maintaining aspect ratio
        try {
            // Get image properties to calculate aspect ratio
            const imgProps = pdf.getImageProperties(signTypeInfo.designReference);
            const imgRatio = imgProps.width / imgProps.height;
            const placeholderRatio = placeholderWidth / placeholderHeight;
            
            let scaledWidth, scaledHeight, offsetX, offsetY;
            
            if (imgRatio > placeholderRatio) {
                // Image is wider - scale to fit width
                scaledWidth = placeholderWidth;
                scaledHeight = placeholderWidth / imgRatio;
                offsetX = 0;
                offsetY = (placeholderHeight - scaledHeight) / 2;
            } else {
                // Image is taller - scale to fit height
                scaledHeight = placeholderHeight;
                scaledWidth = placeholderHeight * imgRatio;
                offsetX = (placeholderWidth - scaledWidth) / 2;
                offsetY = 0;
            }
            
            pdf.addImage(
                signTypeInfo.designReference, 
                'JPEG', 
                margin + contentInnerMargin + offsetX, 
                contentY + offsetY, 
                scaledWidth, 
                scaledHeight
            );
        } catch (error) {
            // If image fails to load, show placeholder text
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(10);
            pdf.setTextColor(150);
            pdf.text('[Reference image placeholder]', margin + contentInnerMargin + placeholderWidth/2, contentY + placeholderHeight/2, { align: 'center' });
            pdf.setTextColor(0);
        }
    } else {
        // Show placeholder when no image is uploaded
        pdf.setDrawColor(200);
        pdf.setFillColor(224, 224, 224);
        pdf.rect(margin + contentInnerMargin, contentY, placeholderWidth, placeholderHeight, 'FD');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(150);
        pdf.text('[Reference image placeholder]', margin + contentInnerMargin + placeholderWidth/2, contentY + placeholderHeight/2, { align: 'center' });
        pdf.setTextColor(0);
    }
    contentY += placeholderHeight + 20;

    // Footer
    currentY = pageHeight - margin;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(150);
    pdf.text(`Created with Mapping Slayer on ${new Date().toLocaleDateString()}`, pageWidth / 2, currentY, { align: 'center' });
    pdf.text(`Project: ${document.getElementById('project-name').textContent}`, pageWidth / 2, currentY + 12, { align: 'center' })
}
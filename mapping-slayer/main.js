// main.js - The Orchestrator

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

document.addEventListener('DOMContentLoaded', function() {
    init();
});

// Tutorial System
const TutorialSystem = {
    currentStep: 0,
    isActive: false,
    steps: [],
    
    // Define tutorial steps
    basicTutorialSteps: [
        {
            target: '.upload-area',
            title: 'Welcome to Mapping Slayer!',
            content: 'Start by uploading a PDF file here. You can click to browse or drag and drop a file. PDFs with live text work best for auto-mapping features.',
            position: 'bottom',
            interactive: false
        },
        {
            target: '#add-marker-type-btn',
            title: 'Create Marker Types',
            content: 'Before adding dots, create marker types to categorize your locations. Each type has a unique code, name, and color.',
            position: 'right',
            interactive: false
        },
        {
            target: '#map-container',
            title: 'Add Location Dots',
            content: 'Click anywhere on the map to add a location dot. The active marker type (highlighted in orange) will be used.',
            position: 'top',
            interactive: false
        },
        {
            target: '#toggle-messages-btn',
            title: 'Show/Hide Messages',
            content: 'Toggle the visibility of location messages on the map. This helps keep the view clean when needed.',
            position: 'bottom',
            interactive: false
        },
        {
            target: '#automap-text-input',
            title: 'Auto-Mapping Feature',
            content: 'Enter text to automatically find and place dots on matching text in your PDF. Great for quickly mapping repeated elements!',
            position: 'top',
            interactive: false
        },
        {
            target: '#controls-btn',
            title: 'Keyboard Shortcuts',
            content: 'Click here to see all available keyboard shortcuts and controls. These will help you work much faster!',
            position: 'bottom',
            interactive: false
        },
        {
            target: '#save-project-btn',
            title: 'Save Your Work',
            content: 'Always save your project as a .mslay file. This preserves both your annotations and the original PDF in one file.',
            position: 'bottom',
            interactive: false
        }
    ],
    
    start(tutorialSteps = null) {
        this.steps = tutorialSteps || this.basicTutorialSteps;
        this.currentStep = 0;
        this.isActive = true;
        
        // Create overlay elements
        this.createOverlay();
        this.showStep(0);
        
        // Store tutorial state
        try {
            sessionStorage.setItem('mapping-slayer-tutorial-active', 'true');
        } catch (e) {
            // Ignore if sessionStorage not available
        }
    },
    
    createOverlay() {
        // Remove existing overlay if present
        this.cleanup();
        
        // Create main overlay
        const overlay = document.createElement('div');
        overlay.className = 'tutorial-overlay';
        overlay.id = 'tutorial-overlay';
        document.body.appendChild(overlay);
        
        // Create spotlight
        const spotlight = document.createElement('div');
        spotlight.className = 'tutorial-spotlight';
        spotlight.id = 'tutorial-spotlight';
        document.body.appendChild(spotlight);
        
        // Create tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'tutorial-tooltip';
        tooltip.id = 'tutorial-tooltip';
        document.body.appendChild(tooltip);
        
        // Show overlay
        setTimeout(() => overlay.classList.add('active'), 10);
    },
    
    showStep(stepIndex) {
        if (stepIndex < 0 || stepIndex >= this.steps.length) return;
        
        this.currentStep = stepIndex;
        const step = this.steps[stepIndex];
        
        // Find target element
        const targetElement = document.querySelector(step.target);
        if (!targetElement) {
            console.warn(`Tutorial target not found: ${step.target}`);
            this.nextStep();
            return;
        }
        
        // Position spotlight
        this.positionSpotlight(targetElement);
        
        // Create and position tooltip
        this.createTooltip(step, targetElement);
        
        // Handle interactive steps
        if (step.interactive) {
            this.setupInteractiveStep(step, targetElement);
        }
    },
    
    positionSpotlight(element) {
        const spotlight = document.getElementById('tutorial-spotlight');
        const rect = element.getBoundingClientRect();
        
        // Add some padding around the element
        const padding = 8;
        
        spotlight.style.left = `${rect.left - padding}px`;
        spotlight.style.top = `${rect.top - padding}px`;
        spotlight.style.width = `${rect.width + (padding * 2)}px`;
        spotlight.style.height = `${rect.height + (padding * 2)}px`;
        
        // Add pulsing effect
        spotlight.classList.add('pulsing');
    },
    
    createTooltip(step, targetElement) {
        const tooltip = document.getElementById('tutorial-tooltip');
        const rect = targetElement.getBoundingClientRect();
        
        // Build tooltip content
        tooltip.innerHTML = `
            <div class="tutorial-header">
                <span class="tutorial-step-counter">${this.currentStep + 1}/${this.steps.length}</span>
                <span>${step.title}</span>
            </div>
            <div class="tutorial-progress">
                <div class="tutorial-progress-fill" style="width: ${((this.currentStep + 1) / this.steps.length) * 100}%"></div>
            </div>
            <div class="tutorial-content">${step.content}</div>
            ${step.interactive && step.interactiveHint ? `<div class="tutorial-interactive-hint">${step.interactiveHint}</div>` : ''}
            <div class="tutorial-controls">
                <div class="tutorial-controls-left">
                    ${this.currentStep > 0 ? '<button class="tutorial-btn tutorial-btn-secondary" onclick="TutorialSystem.previousStep()">Previous</button>' : ''}
                </div>
                <div class="tutorial-controls-right">
                    <button class="tutorial-btn tutorial-btn-skip" onclick="TutorialSystem.skip()">Skip Tutorial</button>
                    ${this.currentStep < this.steps.length - 1 ? 
                        '<button class="tutorial-btn tutorial-btn-primary" onclick="TutorialSystem.nextStep()">Next</button>' :
                        '<button class="tutorial-btn tutorial-btn-primary" onclick="TutorialSystem.finish()">Finish</button>'
                    }
                </div>
            </div>
        `;
        
        // Position tooltip
        this.positionTooltip(tooltip, rect, step.position);
        
        // Show tooltip with animation
        setTimeout(() => tooltip.classList.add('active'), 100);
    },
    
    positionTooltip(tooltip, targetRect, position) {
        // Reset classes
        tooltip.classList.remove('active');
        
        // Remove existing arrow
        const existingArrow = tooltip.querySelector('.tutorial-tooltip-arrow');
        if (existingArrow) existingArrow.remove();
        
        // Calculate position
        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const spacing = 20;
        
        let left, top, arrowPosition;
        
        switch (position) {
            case 'top':
                left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                top = targetRect.top - tooltipRect.height - spacing;
                arrowPosition = 'bottom';
                break;
            case 'bottom':
                left = targetRect.left - tooltipRect.width - spacing;
                top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                arrowPosition = 'top';
                break;
            case 'left':
                left = targetRect.left - tooltipRect.width - spacing;
                top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                arrowPosition = 'right';
                break;
            case 'right':
                left = targetRect.right + spacing;
                top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                arrowPosition = 'left';
                break;
            default:
                left = targetRect.left - tooltipRect.width - spacing;
                top = targetRect.top;
                arrowPosition = 'left';
        }
        
        // Keep tooltip in viewport
        left = Math.max(10, Math.min(left, viewportWidth - tooltipRect.width - 10));
        top = Math.max(10, Math.min(top, viewportHeight - tooltipRect.height - 10));
        
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    },
    
    setupInteractiveStep(step, targetElement) {
        // For interactive steps, we wait for user action instead of auto-advancing
        if (step.target === '#map-container') {
            // Listen for dot creation
            const originalAddDot = window.addDot;
            window.addDot = function(...args) {
                const result = originalAddDot.apply(this, args);
                if (TutorialSystem.isActive && TutorialSystem.currentStep < TutorialSystem.steps.length) {
                    TutorialSystem.nextStep();
                    // Restore original function
                    window.addDot = originalAddDot;
                }
                return result;
            };
        }
    },
    
    nextStep() {
        if (this.currentStep < this.steps.length - 1) {
            this.showStep(this.currentStep + 1);
        } else {
            this.finish();
        }
    },
    
    previousStep() {
        if (this.currentStep > 0) {
            this.showStep(this.currentStep - 1);
        }
    },
    
    skip() {
        if (confirm('Are you sure you want to skip the tutorial? You can restart it later from the Help menu.')) {
            this.finish();
        }
    },
    
    finish() {
        this.isActive = false;
        
        // Clean up
        this.cleanup();
        
        // Store completion state
        try {
            sessionStorage.setItem('mapping-slayer-tutorial-completed', 'true');
            sessionStorage.removeItem('mapping-slayer-tutorial-active');
        } catch (e) {
            // Ignore if sessionStorage not available
        }
        
        showCSVStatus('🎉 Tutorial completed! You\'re ready to start mapping.', true, 5000);
    },
    
    cleanup() {
        const overlay = document.getElementById('tutorial-overlay');
        const spotlight = document.getElementById('tutorial-spotlight');
        const tooltip = document.getElementById('tutorial-tooltip');
        
        if (overlay) overlay.remove();
        if (spotlight) spotlight.remove();
        if (tooltip) tooltip.remove();
    }
};

// Auto-start tutorial for new users
function checkForFirstTimeUser() {
    try {
        const hasCompletedTutorial = sessionStorage.getItem('mapping-slayer-tutorial-completed');
        const disclaimerAgreed = sessionStorage.getItem('mapping-slayer-disclaimer-agreed');
        
        // Only show tutorial if they've agreed to disclaimer but haven't completed tutorial
        if (disclaimerAgreed === 'true' && !hasCompletedTutorial) {
            // Wait a moment for the UI to fully load
            setTimeout(() => {
                if (confirm('Welcome to Mapping Slayer! Would you like to take a quick tutorial to learn the basics?')) {
                    TutorialSystem.start();
                }
            }, 1000);
        }
    } catch (e) {
        // Ignore if sessionStorage not available
    }
}

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
    
    // Check for first-time user tutorial
    checkForFirstTimeUser();
    
    setupEventListeners();
    initializeNewProjectMarkerTypes();
    updateAllSectionsForCurrentPage();
    updateAutomapControls();
    updateToleranceDisplay();
    
    const getStateSnapshotForUndo = (description) => {
        return {
            description: description,
            timestamp: Date.now(),
            data: {
                dotsByPage: serializeDotsByPage(appState.dotsByPage),
                currentPdfPage: appState.currentPdfPage
            }
        };
    };

    const restoreStateFromUndo = (snapshotData) => {
        appState.dotsByPage = deserializeDotsByPage(snapshotData.dotsByPage);
        if (snapshotData.currentPdfPage !== appState.currentPdfPage) {
            changePage(snapshotData.currentPdfPage);
        } else {
            renderDotsForCurrentPage();
            updateAllSectionsForCurrentPage();
        }
        clearSelection();
        appState.isDirty = true;
    };

    UndoManager.init(getStateSnapshotForUndo, restoreStateFromUndo, updateUndoUI);
}

function setupEventListeners() {
    // Character warning modal event listeners
    document.getElementById('cancel-character-changes-btn').addEventListener('click', () => {
        document.getElementById('character-warning-modal').style.display = 'none';
        if (window.characterWarningResolver) {
            window.characterWarningResolver(false);
        }
    });

    document.getElementById('proceed-character-changes-btn').addEventListener('click', () => {
        document.getElementById('character-warning-modal').style.display = 'none';
        if (window.characterWarningResolver) {
            window.characterWarningResolver(true);
        }
    });
    const mapContainer = document.getElementById('map-container');
    mapContainer.addEventListener('click', handleMapClick);
    mapContainer.addEventListener('contextmenu', handleMapRightClick);
    mapContainer.addEventListener('mousedown', handleMapMouseDown);
    document.addEventListener('mousemove', handleMapMouseMove);
    document.addEventListener('mouseup', handleMapMouseUp);
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

    document.getElementById('tooltips-btn').addEventListener('click', () => {
        TooltipManager.toggle();
    });

    document.getElementById('controls-btn').addEventListener('click', () => {
        document.getElementById('controls-modal').style.display = 'block';
    });

    document.getElementById('close-controls-modal-btn').addEventListener('click', () => {
        document.getElementById('controls-modal').style.display = 'none';
    });

    const updateCsvInput = document.getElementById('update-csv-input');
    updateCsvInput.addEventListener('change', handleScheduleUpdate);
    const findInput = document.getElementById('find-input');
    findInput.addEventListener('input', handleFind);
    findInput.addEventListener('keydown', handleFindEnter);
    document.getElementById('dot-size-slider').addEventListener('input', handleDotSizeChange);
    document.getElementById('create-pdf-btn').addEventListener('click', createAnnotatedPDF);
    document.getElementById('create-schedule-btn').addEventListener('click', createMessageSchedule);
    document.getElementById('update-from-schedule-btn').addEventListener('click', () => updateCsvInput.click());
    document.getElementById('export-fdf-btn').addEventListener('click', exportToBluebeam);
    document.getElementById('add-marker-type-btn').addEventListener('click', addNewMarkerType);
    document.getElementById('prev-page').addEventListener('click', prevPage);
    document.getElementById('next-page').addEventListener('click', nextPage);
    document.getElementById('renumber-btn').addEventListener('click', renumberLocations);
    document.getElementById('toggle-messages-btn').addEventListener('click', toggleMessages);
    document.getElementById('toggle-view-btn').addEventListener('click', toggleListView);
    document.getElementById('all-pages-checkbox').addEventListener('change', (e) => {
        appState.isAllPagesView = e.target.checked;
        updateLocationList();
    });
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

    document.getElementById('disclaimer-agree-btn').addEventListener('click', () => {
        document.getElementById('disclaimer-modal').style.display = 'none';
        try {
            sessionStorage.setItem('mapping-slayer-disclaimer-agreed', 'true');
        } catch (e) {
            // Ignore
        }
        
        // Check if user wants tutorial
        setTimeout(() => {
            if (confirm('Welcome to Mapping Slayer! Would you like to take a quick tutorial to learn the basics?')) {
                TutorialSystem.start();
            }
        }, 500);
    });
    
    document.getElementById('disclaimer-cancel-btn').addEventListener('click', () => {
        window.location.href = 'mapping_slayer_landing.html';
    });

    document.getElementById('cancel-renumber-btn').addEventListener('click', () => {
        document.getElementById('renumber-modal').style.display = 'none';
    });

    document.getElementById('cancel-pdf-export-btn').addEventListener('click', () => {
        document.getElementById('pdf-export-modal').style.display = 'none';
    });

    document.getElementById('page-label-input').addEventListener('input', handlePageLabelChange);

    const trainScrapeBtn = document.getElementById('train-scrape-btn');
    if (trainScrapeBtn) {
        trainScrapeBtn.addEventListener('click', (e) => toggleTrainingMode(e));
    }

    document.addEventListener('keydown', (e) => { 
        if (isModalOpen()) return;
        const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

        if (e.key === 'Escape') {
            closeModal(); 
            closeGroupModal(); 
            document.getElementById('ocr-info-modal').style.display = 'none';
            document.getElementById('controls-modal').style.display = 'none';
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
                const description = UndoManager.undo();
                if(description) showCSVStatus(`↶ Undid: ${description}`, true, 3000);
            } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
                e.preventDefault();
                const description = UndoManager.redo();
                if(description) showCSVStatus(`↷ Redid: ${description}`, true, 3000);
            } else if (e.key === 'c') {
                e.preventDefault();
                copySelectedDot();
            } else if (e.key === 'v') {
                e.preventDefault();
                pasteDotAtCursor();
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
                selectNextMarkerType();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectPreviousMarkerType();
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

function handlePageLabelChange(e) {
    const label = e.target.value.trim();
    appState.pageLabels.set(appState.currentPdfPage, label);
    setDirtyState();
}

function migrateOldProjectData(projectData) {
    console.log("Migrating old project format...");
    const newMarkerTypes = {};

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
        while (newMarkerTypes[finalCode]) {
            finalCode = `${code} (${counter++})`;
        }

        newMarkerTypes[finalCode] = { code: finalCode, name, color, textColor, designReference: null };

        for (const pageNum in projectData.dotsByPage) {
            projectData.dotsByPage[pageNum].dots.forEach(dot => {
                if (dot.signType === key) {
                    dot.markerType = finalCode;
                    delete dot.signType;
                }
            });
        }
    }
    
    projectData.markerTypes = newMarkerTypes;

    delete projectData.signTypes;
    delete projectData.signTypeData;
    delete projectData.signTypeNames;
    delete projectData.manuallyAddedSignTypes;

    showCSVStatus("✅ Old project file migrated to the new format!", true, 6000);
    return projectData;
}

function restoreStateFromData(projectData) {
    if (!projectData.version || projectData.version < "4.0.0" || projectData.signTypes) {
        projectData = migrateOldProjectData(projectData);
    }

    appState.dotsByPage = deserializeDotsByPage(projectData.dotsByPage);
    appState.markerTypes = projectData.markerTypes;
    appState.nextInternalId = projectData.nextInternalId || 1;

    for (const pageData of appState.dotsByPage.values()) {
        for (const dot of pageData.dots.values()) {
            if (dot.signType) {
                dot.markerType = dot.signType;
                delete dot.signType;
            }
            if (dot.notes === undefined) dot.notes = '';
            if (dot.installed === undefined) dot.installed = false;
            if (dot.produced !== undefined) delete dot.produced;
        }
    }

    for (const code in appState.markerTypes) {
        if (!appState.markerTypes[code].hasOwnProperty('designReference')) {
            appState.markerTypes[code].designReference = null;
        }
    }

    appState.dotSize = projectData.dotSize || 1;
    appState.totalPages = projectData.totalPages;
    appState.recentSearches = projectData.recentSearches || [];
    appState.automapExactPhrase = projectData.automapExactPhrase !== undefined ? projectData.automapExactPhrase : true;
    appState.scrapeHorizontalTolerance = projectData.scrapeHorizontalTolerance !== undefined ? projectData.scrapeHorizontalTolerance : 1;
    appState.scrapeVerticalTolerance = projectData.scrapeVerticalTolerance !== undefined ? projectData.scrapeVerticalTolerance : 25;
    appState.pageLabels = projectData.pageLabels ? new Map(Object.entries(projectData.pageLabels).map(([k, v]) => [parseInt(k, 10), v])) : new Map();
    resetTrainingUI();

    const markerTypeKeys = Object.keys(appState.markerTypes);
    appState.activeMarkerType = markerTypeKeys.length > 0 ? markerTypeKeys[0] : null;

    document.getElementById('project-name').textContent = projectData.projectName;
    document.getElementById('map-file-name').textContent = projectData.sourcePdfName;
    document.getElementById('dot-size-slider').value = appState.dotSize;

    showCSVStatus(`✅ Project "${projectData.projectName}" loaded successfully.`, true);
    
    updatePageLabelInput();
    updateAutomapControls();
    UndoManager.capture('Initial State');
}

function selectNextMarkerType() {
    const sortedCodes = Object.keys(appState.markerTypes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (sortedCodes.length === 0) return;

    let currentIndex = sortedCodes.indexOf(appState.activeMarkerType);
    currentIndex++;
    if (currentIndex >= sortedCodes.length) currentIndex = 0;
    appState.activeMarkerType = sortedCodes[currentIndex];
    updateFilterCheckboxes();
    updateAutomapControls();
}

function selectPreviousMarkerType() {
    const sortedCodes = Object.keys(appState.markerTypes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (sortedCodes.length === 0) return;

    let currentIndex = sortedCodes.indexOf(appState.activeMarkerType);
    currentIndex--;
    if (currentIndex < 0) currentIndex = sortedCodes.length - 1;
    appState.activeMarkerType = sortedCodes[currentIndex];
    updateFilterCheckboxes();
    updateAutomapControls();
}

function handleSaveProject() {
    if (!appState.pdfDoc || !appState.sourcePdfBuffer) {
        alert('Please load a PDF or .mslay file to save.');
        return;
    }
    const projectDataToSave = {
        version: '5.0.0',
        sourcePdfBuffer: appState.sourcePdfBuffer,
        projectName: document.getElementById('project-name').textContent,
        sourcePdfName: document.getElementById('map-file-name').textContent,
        totalPages: appState.totalPages,
        dotsByPage: serializeDotsByPage(appState.dotsByPage),
        markerTypes: appState.markerTypes,
        dotSize: appState.dotSize,
        nextInternalId: appState.nextInternalId,
        recentSearches: appState.recentSearches,
        automapExactPhrase: appState.automapExactPhrase,
        scrapeHorizontalTolerance: appState.scrapeHorizontalTolerance,
        scrapeVerticalTolerance: appState.scrapeVerticalTolerance,
        pageLabels: Object.fromEntries(appState.pageLabels)
    };
    ProjectIO.save(projectDataToSave);
    appState.isDirty = false;
}

async function handleFileSelect(e) {
    const file = e.target.files[0];
    const allowedExtensions = ['.pdf', '.mslay'];
    if (!file) return;

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
    
    if (result.isProject) {
        restoreStateFromData(result.projectData);
    } else {
        appState.dotsByPage = new Map();
        initializeNewProjectMarkerTypes();
        document.getElementById('map-file-name').textContent = file.name;
        document.getElementById('project-name').textContent = file.name.replace(/\.pdf$/i, '');
        appState.recentSearches = [];
        appState.automapExactPhrase = true;
        
        UndoManager.capture('Initial State');
        updateAutomapControls();
        
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
    document.getElementById('export-fdf-btn').disabled = false;
    document.getElementById('single-automap-btn').disabled = false;
    document.getElementById('automap-text-input').disabled = false;
    document.getElementById('automap-marker-type-select').disabled = false;

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

function initializeNewProjectMarkerTypes() {
    appState.markerTypes = {};
    DEFAULT_MARKER_TYPES.forEach(st => {
        appState.markerTypes[st.code] = { 
            code: st.code,
            name: st.name,
            color: st.color, 
            textColor: st.textColor,
            designReference: null 
        };
    });
    appState.activeMarkerType = DEFAULT_MARKER_TYPES.length > 0 ? DEFAULT_MARKER_TYPES[0].code : null;
}

function isModalOpen() {
    return document.getElementById('edit-modal').style.display === 'block' || 
           document.getElementById('group-edit-modal').style.display === 'block' || 
           document.getElementById('automap-progress-modal').style.display === 'block' ||
           document.getElementById('save-roomlist-modal').style.display === 'block' ||
           document.getElementById('ocr-info-modal').style.display === 'block' ||
           document.getElementById('controls-modal').style.display === 'block' ||
           document.getElementById('disclaimer-modal').style.display === 'block';
}

function deleteSelectedDots() {
    if (appState.selectedDots.size === 0) return;
    
    appState.selectedDots.forEach(internalId => { getCurrentPageDots().delete(internalId); });
    UndoManager.capture(`Delete ${appState.selectedDots.size} dots`);

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
    scrapeBox.className = appState.isOCRScraping ? 'scrape-box ocr-scrape' : 'scrape-box';
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

async function finishOCRScrape() {
    if (!appState.scrapeBox) return;

    const boxRect = appState.scrapeBox.getBoundingClientRect();
    appState.scrapeBox.remove();
    appState.scrapeBox = null;
    appState.isScraping = false;
    document.removeEventListener('contextmenu', preventContextMenu);

    showCSVStatus("Starting OCR Scan...", true, 20000);

    try {
        const mapRect = document.getElementById('map-container').getBoundingClientRect();
        const { x: mapX, y: mapY, scale } = appState.mapTransform;
        
        const canvasX1 = (boxRect.left - mapRect.left - mapX) / scale;
        const canvasY1 = (boxRect.top - mapRect.top - mapY) / scale;
        const canvasX2 = (boxRect.right - mapRect.left - mapX) / scale;
        const canvasY2 = (boxRect.bottom - mapRect.top - mapY) / scale;
        
        const canvas = document.getElementById('pdf-canvas');
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        const width = Math.abs(canvasX2 - canvasX1);
        const height = Math.abs(canvasY2 - canvasY1);
        tempCanvas.width = width;
        tempCanvas.height = height;
        
        tempCtx.drawImage(canvas, 
            Math.min(canvasX1, canvasX2), Math.min(canvasY1, canvasY2), width, height,
            0, 0, width, height
        );
        
        const { data: { text } } = await Tesseract.recognize(tempCanvas, 'eng', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    const progress = Math.round(m.progress * 100);
                    showCSVStatus(`OCR SCANNING: ${progress}%`, true, 20000);
                }
            }
        });
        
        const cleanText = text.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ');
        
        if (cleanText.length > 0) {
            const centerX = (Math.min(canvasX1, canvasX2) + width / 2);
            const centerY = (Math.min(canvasY1, canvasY2) + height / 2);
            
            if (!isCollision(centerX, centerY)) {
                addDot(centerX, centerY, appState.activeMarkerType, cleanText);
                UndoManager.capture('OCR scrape');
                showCSVStatus(`✅ OCR found: "${cleanText}"`, true, 5000);
            } else {
                showCSVStatus("❌ Collision detected", false, 4000);
            }
        } else {
            showCSVStatus("❌ OCR found no text", false, 4000);
        }
        
        tempCanvas.remove();
        
    } catch (error) {
        console.error('OCR failed:', error);
        showCSVStatus("❌ OCR processing failed", false, 4000);
    }
}

async function finishScrape() {
    if (!appState.scrapeBox) return;

    showCSVStatus("Scraping, please wait...", true, 20000);

    try {
        const boxRect = appState.scrapeBox.getBoundingClientRect();
        const mapRect = document.getElementById('map-container').getBoundingClientRect();
        const { x: mapX, y: mapY, scale } = appState.mapTransform;
        const canvasX1 = (boxRect.left - mapRect.left - mapX) / scale; 
        const canvasY1 = (boxRect.top - mapRect.top - mapY) / scale;
        const canvasX2 = (boxRect.right - mapRect.left - mapX) / scale; 
        const canvasY2 = (boxRect.bottom - mapRect.top - mapY) / scale;
        const boxLeft = Math.min(canvasX1, canvasX2); 
        const boxTop = Math.min(canvasY1, canvasY2);
        const boxRight = Math.max(canvasX1, canvasX2); 
        const boxBottom = Math.max(canvasY1, canvasY2);
        
        // Remove scrape box immediately so user knows we're processing
        appState.scrapeBox.remove();
        appState.scrapeBox = null;
        appState.isScraping = false;
        document.removeEventListener('contextmenu', preventContextMenu);
        
        showCSVStatus("Loading page text...", true, 20000);
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const page = await appState.pdfDoc.getPage(appState.currentPdfPage);
        const viewport = page.getViewport({ scale: appState.pdfScale });
        const textContent = await page.getTextContent();
        
        showCSVStatus("Processing text items...", true, 20000);
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const capturedTextItems = [];
        const BATCH_SIZE = 100; // Process text items in batches
        
        for (let i = 0; i < textContent.items.length; i += BATCH_SIZE) {
            const batch = textContent.items.slice(i, i + BATCH_SIZE);
            
            for (const item of batch) {
                const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
                if (x >= boxLeft && x <= boxRight && y >= boxTop && y <= boxBottom) {
                    const text = item.str.trim();
                    if (text.length > 0 && item.height > 0) {
                        capturedTextItems.push({
                            x: x, y: y, width: item.width * viewport.scale, height: item.height * viewport.scale, text: text
                        });
                    }
                }
            }
            
            // Allow browser to breathe every 100 items
            if (i % BATCH_SIZE === 0) {
                const progress = Math.round((i / textContent.items.length) * 50); // Use 50% of progress bar
                showCSVStatus(`Processing text items: ${i}/${textContent.items.length}`, true, 20000);
                await new Promise(resolve => setTimeout(resolve, 5));
            }
        }
        
        if (capturedTextItems.length > 0) {
            showCSVStatus("Clustering text...", true, 20000);
            await new Promise(resolve => setTimeout(resolve, 10));
            
            const clusters = clusterTextItems(capturedTextItems);
            
            showCSVStatus("Adding dots to data...", true, 20000);
            await new Promise(resolve => setTimeout(resolve, 10));

            if (clusters.length === 1) {
                const cluster = clusters[0];
                const message = cluster.items.map(item => item.text).join(' ').trim();
                if (!isCollision(cluster.centerX, cluster.centerY)) {
                    addDotToData(cluster.centerX, cluster.centerY, appState.activeMarkerType, message);
                    showCSVStatus("Rendering dots...", true, 20000);
                    await renderDotsForCurrentPage(true);
                    UndoManager.capture('Scrape text');
                    showCSVStatus(`✅ Scraped: "${message}"`, true, 3000);
                } else {
                    showCSVStatus("❌ Collision detected", false, 4000);
                }
            } else {
                const dotsToAdd = [];
                clusters.forEach(cluster => {
                    const message = cluster.items.map(item => item.text).join(' ').trim();
                    if (message.length > 0 && !isCollision(cluster.centerX, cluster.centerY)) {
                        dotsToAdd.push({
                            x: cluster.centerX, 
                            y: cluster.centerY, 
                            message: message
                        });
                    }
                });
                
                if (dotsToAdd.length > 0) {
                    // Add all dots to data first
                    dotsToAdd.forEach(dotInfo => {
                        addDotToData(dotInfo.x, dotInfo.y, appState.activeMarkerType, dotInfo.message);
                    });
                    
                    showCSVStatus("Rendering dots...", true, 20000);
                    await renderDotsForCurrentPage(true);
                    updateAllSectionsForCurrentPage();
                    
                    UndoManager.capture('Batch scrape text');
                    showCSVStatus(`✅ Scraped ${dotsToAdd.length} locations`, true, 3000);
                } else if (clusters.length > 0) {
                    showCSVStatus("❌ No valid locations found (all collided)", false, 4000);
                } else {
                    showCSVStatus("❌ No text clusters found in selection", false, 4000);
                }
            }
        } else {
            showCSVStatus("❌ No Live Text Found", false, 4000);
        }
    } catch (error) {
        console.error("Scrape operation failed:", error);
        showCSVStatus("❌ An error occurred during scrape.", false, 4000);
    } finally {
        // Cleanup in case something went wrong
        if (appState.scrapeBox) {
            appState.scrapeBox.remove();
            appState.scrapeBox = null;
        }
        appState.isScraping = false;
        document.removeEventListener('contextmenu', preventContextMenu);
    }
}

function selectDot(internalId) {
    appState.selectedDots.add(internalId);
    const dotElement = document.querySelector(`.map-dot[data-dot-id="${internalId}"]`);
    if (dotElement) {
        dotElement.classList.add('selected');
        Object.assign(dotElement.style, {
            boxShadow: '0 0 15px #00ff88, 0 0 30px #00ff88',
            border: '2px solid #00ff88',
            zIndex: '200'
        });
    } else {
        // Dot is off-screen but selected - it will get selection styling when rendered
        console.log(`Selected off-screen dot: ${internalId}`);
    }
}

function deselectDot(internalId) {
    appState.selectedDots.delete(internalId);
    const dotElement = document.querySelector(`.map-dot[data-dot-id="${internalId}"]`);
    if (dotElement) {
        dotElement.classList.remove('selected');
        Object.assign(dotElement.style, { boxShadow: '', border: '', zIndex: '' });
    }
}

function toggleDotSelection(internalId) {
    if (appState.selectedDots.has(internalId)) { deselectDot(internalId); } else { selectDot(internalId); }
}

function clearSelection() {
    appState.selectedDots.forEach(internalId => { deselectDot(internalId); });
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
        const internalId = item.dataset.dotId;
        item.classList.toggle('selected', appState.selectedDots.has(internalId));
    });
}

function addDotToData(x, y, markerTypeCode, message, isCodeRequired = false) {
    const pageData = getCurrentPageData();
    const effectiveMarkerTypeCode = markerTypeCode || appState.activeMarkerType || Object.keys(appState.markerTypes)[0];
    if (!effectiveMarkerTypeCode) { 
        showCSVStatus("Cannot add dot: No marker types exist. Please add one.", false);
        return null; 
    }
    
    const internalId = String(appState.nextInternalId).padStart(7, '0');
    
    let highestLocationNum = 0;
    for (const dot of pageData.dots.values()) {
        const num = parseInt(dot.locationNumber, 10);
        if (!isNaN(num) && num > highestLocationNum) {
            highestLocationNum = num;
        }
    }
    const locationNumber = String(highestLocationNum + 1).padStart(4, '0');
    
    const dot = { 
        internalId: internalId,
        locationNumber: locationNumber,
        x, 
        y, 
        markerType: effectiveMarkerTypeCode, 
        message: message || 'NEW LOCATION', 
        isCodeRequired: isCodeRequired,
        notes: '',
        installed: false
    };

    pageData.dots.set(internalId, dot);
    pageData.nextLocationNumber = highestLocationNum + 2;
    appState.nextInternalId++;
    setDirtyState();
    
    return dot;
}

function addDot(x, y, markerTypeCode, message, isCodeRequired = false) {
    const pageData = getCurrentPageData();
    const effectiveMarkerTypeCode = markerTypeCode || appState.activeMarkerType || Object.keys(appState.markerTypes)[0];
    if (!effectiveMarkerTypeCode) { 
        showCSVStatus("Cannot add dot: No marker types exist. Please add one.", false);
        return; 
    }
    
    const internalId = String(appState.nextInternalId).padStart(7, '0');
    
    let highestLocationNum = 0;
    for (const dot of pageData.dots.values()) {
        const num = parseInt(dot.locationNumber, 10);
        if (!isNaN(num) && num > highestLocationNum) {
            highestLocationNum = num;
        }
    }
    const locationNumber = String(highestLocationNum + 1).padStart(4, '0');
    
    const dot = { 
        internalId: internalId,
        locationNumber: locationNumber,
        x, 
        y, 
        markerType: effectiveMarkerTypeCode, 
        message: message || 'NEW LOCATION', 
        isCodeRequired: isCodeRequired,
        notes: '',
        installed: false
    };

    pageData.dots.set(internalId, dot);
    pageData.nextLocationNumber = highestLocationNum + 2;
    appState.nextInternalId++;

    createDotElement(dot);
    updateAllSectionsForCurrentPage();
    setDirtyState();
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
        const internalId = dotElement.dataset.dotId;
        if (e.shiftKey) { 
            toggleDotSelection(internalId); 
        } else { 
            if (appState.selectedDots.has(internalId) && appState.selectedDots.size === 1) {
                clearSelection();
            } else {
                clearSelection(); 
                selectDot(internalId); 
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
                UndoManager.capture('Add dot');
            }
        }
    }
}

function handleMapRightClick(e) {
    e.preventDefault(); 
    
    if (appState.justFinishedScraping) {
        return;
    }
    
    const dotElement = e.target.closest('.map-dot');
    if (dotElement) {
        const internalId = dotElement.dataset.dotId;
        if (appState.selectedDots.has(internalId) && appState.selectedDots.size > 1) { openGroupEditModal(); } 
        else { clearSelection(); selectDot(internalId); updateSelectionUI(); openEditModal(internalId); }
    }
}

function handleMapMouseDown(e) {
    appState.hasMoved = false;
    appState.dragStart = { x: e.clientX, y: e.clientY };

    if (e.button === 1) {
        appState.isPanning = true;
        const mapContainer = document.getElementById('map-container');
        if (mapContainer) {
            mapContainer.style.cursor = 'grabbing';
        }
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
        e.stopPropagation();
        if (appState.isTrainingScrape) {
            if (!appState.trainingBigBox) {
                startTrainingBigBox(e);
            } else {
                startTrainingSmallBox(e);
            }
        } else {
            if (e.ctrlKey || e.metaKey) {
                appState.isOCRScraping = true;
            }
            startScrapeBox(e);
        }
        document.addEventListener('contextmenu', preventContextMenu, { capture: true });
    }
}

function preventContextMenu(e) {
    if (appState.isScraping || appState.isTrainingScrape) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
}

function handleMapMouseMove(e) {
    const rect = document.getElementById('map-container').getBoundingClientRect();
    const { x: mapX, y: mapY, scale } = appState.mapTransform;
    appState.lastMousePosition = {
        x: (e.clientX - rect.left - mapX) / scale,
        y: (e.clientY - rect.top - mapY) / scale
    };

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
        const draggedInternalId = appState.dragTarget.dataset.dotId;
        const dotsToMove = appState.selectedDots.has(draggedInternalId) && appState.selectedDots.size > 1 ? appState.selectedDots : [draggedInternalId];

        dotsToMove.forEach(internalId => {
            const dot = getCurrentPageDots().get(internalId);
            const dotElement = document.querySelector(`.map-dot[data-dot-id="${internalId}"]`);
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
        if (appState.isTrainingScrape) {
            if (!appState.trainingBigBox) {
                updateTrainingBigBox(e);
            } else {
                updateTrainingSmallBox(e);
            }
        } else {
            updateScrapeBox(e);
        }
    }
}

function handleMapMouseUp(e) {
    const justFinishedScraping = appState.isScraping;
    
    if (appState.isPanning) {
        appState.isPanning = false;
        const mapContainer = document.getElementById('map-container');
        if (mapContainer) {
            mapContainer.style.cursor = 'grab';
        }
    }
    if (appState.dragTarget) {
        if (appState.hasMoved) {
            UndoManager.capture('Move dot');
        }
        document.querySelectorAll('.map-dot.dragging').forEach(dot => dot.classList.remove('dragging'));
    }
    if (appState.isSelecting) {
        finishSelectionBox();
        appState.isSelecting = false;
    }
    if (appState.isScraping) {
        if (appState.isTrainingScrape) {
            if (!appState.trainingBigBox) {
                finishTrainingBigBox();
            } else {
                finishTrainingSmallBox();
            }
        } else {
            if (appState.isOCRScraping) {
                finishOCRScrape();
                appState.isOCRScraping = false;
            } else {
                finishScrape();
            }
        }
        
        appState.justFinishedScraping = true;
        setTimeout(() => {
            appState.justFinishedScraping = false;
        }, 100);
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

function handleDotSizeChange(e) {
    setDirtyState();
    appState.dotSize = parseFloat(e.target.value);
    renderDotsForCurrentPage();
}

function handleFind(e) {
    const query = e.target.value.toLowerCase().trim();
    const findCountEl = document.getElementById('find-count');
    clearSearchHighlights();
    if (!query) { findCountEl.textContent = ''; appState.searchResults = []; appState.currentSearchIndex = -1; return; }
    appState.searchResults = Array.from(getCurrentPageDots().values()).filter(dot => dot.locationNumber.toLowerCase().includes(query) || dot.message.toLowerCase().includes(query));
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
        
        // Always center on the dot to bring it into viewport
        centerOnDot(dot.internalId);
        
        // Give viewport update time to render the dot, then highlight it
        setTimeout(() => {
            const dotElement = document.querySelector(`.map-dot[data-dot-id="${dot.internalId}"]`);
            if (dotElement) { 
                dotElement.classList.add('search-highlight'); 
            }
        }, 100);
        
        findCountEl.textContent = `${appState.currentSearchIndex + 1} of ${appState.searchResults.length} found`;
    } else { 
        findCountEl.textContent = '0 found'; 
    }
}

function clearSearchHighlights() {
    document.querySelectorAll('.search-highlight').forEach(el => el.classList.remove('search-highlight'));
}

async function changePage(newPageNum) {
    if (newPageNum < 1 || newPageNum > appState.totalPages) return;
    clearSelection();
    appState.currentPdfPage = newPageNum;
    updatePageInfo();
    updatePageLabelInput();
    await renderPDFPage(newPageNum);
    renderDotsForCurrentPage();
    updateAllSectionsForCurrentPage();
}

function prevPage() { 
    if (appState.currentPdfPage > 1) {
        changePage(appState.currentPdfPage - 1); 
        UndoManager.capture('Previous page');
    }
}
function nextPage() { 
    if (appState.currentPdfPage < appState.totalPages) {
        changePage(appState.currentPdfPage + 1); 
        UndoManager.capture('Next page');
    }
}

function handleMarkerTypeCodeChange(inputElement) {
    const originalCode = inputElement.dataset.originalCode;
    const newCode = inputElement.value.trim();

    if (newCode === originalCode) return;

    if (!newCode) {
        showCSVStatus("Marker type code cannot be empty.", false);
        inputElement.value = originalCode;
        return;
    }
    if (appState.markerTypes[newCode]) {
        showCSVStatus(`Marker type code "${newCode}" already exists.`, false);
        inputElement.value = originalCode;
        return;
    }

    const typeData = appState.markerTypes[originalCode];
    delete appState.markerTypes[originalCode];
    typeData.code = newCode;
    appState.markerTypes[newCode] = typeData;

    for (const pageData of appState.dotsByPage.values()) {
        for (const dot of pageData.dots.values()) {
            if (dot.markerType === originalCode) {
                dot.markerType = newCode;
            }
        }
    }
    
    if (appState.activeMarkerType === originalCode) {
        appState.activeMarkerType = newCode;
    }

    setDirtyState();
    updateAllSectionsForCurrentPage();
    updateAutomapControls();
    showCSVStatus(`Renamed code "${originalCode}" to "${newCode}".`, true);
}

function handleMarkerTypeNameChange(inputElement) {
    const code = inputElement.dataset.code;
    const originalName = inputElement.dataset.originalName;
    const newName = inputElement.value.trim();

    if (newName === originalName) return;

    if (appState.markerTypes[code]) {
        appState.markerTypes[code].name = newName;
        setDirtyState();
        updateAllSectionsForCurrentPage();
        updateAutomapControls();
        showCSVStatus(`Updated name for code "${code}".`, true);
    }
}

function addNewMarkerType() {
    let newCode = "NEW";
    let counter = 1;
    while (appState.markerTypes[newCode]) {
        newCode = `NEW-${counter++}`;
    }

    appState.markerTypes[newCode] = { 
        code: newCode, 
        name: 'New Marker Type', 
        color: '#808080', 
        textColor: '#FFFFFF', 
        designReference: null 
    };
    appState.activeMarkerType = newCode;

    setDirtyState();
    updateAllSectionsForCurrentPage();
    updateAutomapControls();
    
    setTimeout(() => {
        const container = document.getElementById('filter-checkboxes');
        const newInput = container.querySelector(`.marker-type-code-input[value="${newCode}"]`);
        if (newInput) {
            newInput.focus();
            newInput.select();
        }
    }, 100);
}

function deleteMarkerType(markerTypeCode) {
    let dotsUsingType = 0;
    for (const pageData of appState.dotsByPage.values()) {
        for (const dot of pageData.dots.values()) {
            if (dot.markerType === markerTypeCode) {
                dotsUsingType++;
            }
        }
    }

    if (dotsUsingType > 0) {
        for (const pageData of appState.dotsByPage.values()) {
            const dotsToDelete = [];
            for (const [dotId, dot] of pageData.dots.entries()) {
                if (dot.markerType === markerTypeCode) {
                    dotsToDelete.push(dotId);
                }
            }
            dotsToDelete.forEach(dotId => pageData.dots.delete(dotId));
        }
    }

    delete appState.markerTypes[markerTypeCode];

    if (appState.activeMarkerType === markerTypeCode) {
        const remainingTypes = Object.keys(appState.markerTypes);
        appState.activeMarkerType = remainingTypes.length > 0 ? remainingTypes[0] : null;
    }

    UndoManager.capture(`Delete marker type "${markerTypeCode}"`);
    setDirtyState();
    renderDotsForCurrentPage();
    updateAllSectionsForCurrentPage();
    updateAutomapControls();
    showCSVStatus(`Deleted marker type "${markerTypeCode}" and ${dotsUsingType} associated dots.`, true);
}


function setupDesignReferenceHandlers(item, markerType) {
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
            handleDesignReferenceUpload(file, markerType);
        }
        e.target.value = null;
    });
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete the design reference for ${markerType}?`)) {
                handleDesignReferenceDelete(markerType);
            }
        });
    }

    square.addEventListener('mouseenter', e => showDesignReferencePreview(e, markerType));
    square.addEventListener('mouseleave', hideDesignReferencePreview);
}

async function handleDesignReferenceUpload(file, markerType) {
    try {
        const dataUrl = await resizeImage(file, 200, 200, 0.8);
        appState.markerTypes[markerType].designReference = dataUrl;
        UndoManager.capture(`Upload design ref for ${markerType}`);
        setDirtyState();
        updateFilterCheckboxes();
    } catch (error) {
        console.error("Image upload failed:", error);
        showCSVStatus("Failed to process image.", false);
    }
}

function handleDesignReferenceDelete(markerType) {
    appState.markerTypes[markerType].designReference = null;
    UndoManager.capture(`Delete design ref for ${markerType}`);
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

function showDesignReferencePreview(e, markerType) {
    const typeData = appState.markerTypes[markerType];
    if (!typeData || !typeData.designReference) return;
    
    clearTimeout(previewTimeout);

    hideDesignReferencePreview();

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

function toggleListView() { appState.listViewMode = appState.listViewMode === 'flat' ? 'grouped' : 'flat'; updateLocationList(); }

function toggleMarkerTypeExpansion(markerTypeCode) {
    if (appState.expandedMarkerTypes.has(markerTypeCode)) { appState.expandedMarkerTypes.delete(markerTypeCode); } 
    else { appState.expandedMarkerTypes.add(markerTypeCode); }
    const itemsContainer = document.getElementById(`items-${markerTypeCode.replace(/[^a-zA-Z0-9]/g, '-')}`);
    const expandIcon = itemsContainer.parentElement.querySelector('.expand-icon');
    itemsContainer.classList.toggle('expanded', appState.expandedMarkerTypes.has(markerTypeCode));
    expandIcon.classList.toggle('expanded', appState.expandedMarkerTypes.has(markerTypeCode));
}

function renumberLocations() {
    document.getElementById('renumber-modal').style.display = 'block';
}

function performRenumber(type) {
    let description = '';
    let totalUpdated = 0;

    switch(type) {
        case 'page':
            totalUpdated = renumberCurrentPage();
            description = 'Renumber current page';
            break;
        case 'page-by-type':
            totalUpdated = renumberCurrentPageByMarkerType();
            description = 'Renumber current page by marker type';
            break;
        case 'all':
            totalUpdated = renumberAllPages();
            description = 'Renumber all pages';
            break;
        case 'all-by-type':
            totalUpdated = renumberAllPagesByMarkerType();
            description = 'Renumber all pages by marker type';
            break;
    }

    if (totalUpdated > 0) {
        UndoManager.capture(description);
        renderDotsForCurrentPage();
        updateAllSectionsForCurrentPage();
        appState.isDirty = true;
        showCSVStatus(`✅ Renumbered ${totalUpdated} locations`, true, 3000);
    }

    document.getElementById('renumber-modal').style.display = 'none';
}

function renumberCurrentPage() {
    const pageData = getCurrentPageData();
    const oldDots = Array.from(pageData.dots.values()).sort((a, b) => {
        const yDiff = a.y - b.y;
        if (Math.abs(yDiff) < 30) { return a.x - b.x; }
        return yDiff;
    });
    
    const newDots = new Map();
    oldDots.forEach((dot, index) => {
        dot.locationNumber = String(index + 1).padStart(4, '0');
        newDots.set(dot.internalId, dot);
    });
    
    pageData.dots = newDots;
    pageData.nextLocationNumber = oldDots.length + 1;
    
    return oldDots.length;
}

function renumberCurrentPageByMarkerType() {
    const pageData = getCurrentPageData();
    const dotsByMarkerType = new Map();
    
    // Group dots by marker type
    for (const dot of pageData.dots.values()) {
        if (!dotsByMarkerType.has(dot.markerType)) {
            dotsByMarkerType.set(dot.markerType, []);
        }
        dotsByMarkerType.get(dot.markerType).push(dot);
    }
    
    let totalCount = 0;
    
    // Sort marker types alphabetically
    const sortedMarkerTypes = Array.from(dotsByMarkerType.keys()).sort((a, b) => 
        a.localeCompare(b, undefined, { numeric: true })
    );
    
    // Renumber each marker type group starting from 1
    for (const markerType of sortedMarkerTypes) {
        const dotsOfType = dotsByMarkerType.get(markerType);
        dotsOfType.sort((a, b) => {
            const yDiff = a.y - b.y;
            if (Math.abs(yDiff) < 30) { return a.x - b.x; }
            return yDiff;
        });
        
        dotsOfType.forEach((dot, index) => {
            dot.locationNumber = String(index + 1).padStart(4, '0');
        });
        
        totalCount += dotsOfType.length;
    }
    
    pageData.nextLocationNumber = Math.max(...Array.from(pageData.dots.values()).map(d => parseInt(d.locationNumber, 10))) + 1;
    return totalCount;
}

function renumberAllPages() {
    let globalCounter = 1;
    let totalUpdated = 0;
    
    for (let pageNum = 1; pageNum <= appState.totalPages; pageNum++) {
        const pageData = appState.dotsByPage.get(pageNum);
        if (!pageData || pageData.dots.size === 0) continue;
        
        const dotsOnPage = Array.from(pageData.dots.values()).sort((a, b) => {
            const yDiff = a.y - b.y;
            if (Math.abs(yDiff) < 30) { return a.x - b.x; }
            return yDiff;
        });
        
        dotsOnPage.forEach(dot => {
            dot.locationNumber = String(globalCounter++).padStart(4, '0');
            totalUpdated++;
        });
        
        pageData.nextLocationNumber = globalCounter;
    }
    
    return totalUpdated;
}

function renumberAllPagesByMarkerType() {
    // Collect all dots from all pages grouped by marker type
    const dotsByMarkerType = new Map();
    
    for (let pageNum = 1; pageNum <= appState.totalPages; pageNum++) {
        const pageData = appState.dotsByPage.get(pageNum);
        if (!pageData) continue;
        
        for (const dot of pageData.dots.values()) {
            if (!dotsByMarkerType.has(dot.markerType)) {
                dotsByMarkerType.set(dot.markerType, []);
            }
            dotsByMarkerType.get(dot.markerType).push({ ...dot, pageNum });
        }
    }
    
    let totalUpdated = 0;
    
    // Sort marker types alphabetically
    const sortedMarkerTypes = Array.from(dotsByMarkerType.keys()).sort((a, b) => 
        a.localeCompare(b, undefined, { numeric: true })
    );
    
    // Process each marker type, starting from 1 for each type
    for (const markerType of sortedMarkerTypes) {
        const dotsOfType = dotsByMarkerType.get(markerType);
        
        // Sort by page first, then by position within page
        dotsOfType.sort((a, b) => {
            if (a.pageNum !== b.pageNum) {
                return a.pageNum - b.pageNum;
            }
            const yDiff = a.y - b.y;
            if (Math.abs(yDiff) < 30) { return a.x - b.x; }
            return yDiff;
        });
        
        // Renumber this marker type group starting from 1
        dotsOfType.forEach((dotInfo, index) => {
            const pageData = appState.dotsByPage.get(dotInfo.pageNum);
            const actualDot = pageData.dots.get(dotInfo.internalId);
            if (actualDot) {
                actualDot.locationNumber = String(index + 1).padStart(4, '0');
                totalUpdated++;
            }
        });
    }
    
    // Update nextLocationNumber for all pages to be the max location number + 1
    let maxLocationNumber = 0;
    for (let pageNum = 1; pageNum <= appState.totalPages; pageNum++) {
        const pageData = appState.dotsByPage.get(pageNum);
        if (pageData) {
            for (const dot of pageData.dots.values()) {
                const num = parseInt(dot.locationNumber, 10);
                if (num > maxLocationNumber) {
                    maxLocationNumber = num;
                }
            }
            pageData.nextLocationNumber = maxLocationNumber + 1;
        }
    }
    
    return totalUpdated;
}

function toggleMessages() {
    appState.messagesVisible = !appState.messagesVisible;
    const btn = document.getElementById('toggle-messages-btn');
    btn.textContent = appState.messagesVisible ? 'HIDE MSG' : 'SHOW MSG';
    btn.classList.toggle('active', appState.messagesVisible);
    document.querySelectorAll('.map-dot-message').forEach(msg => msg.classList.toggle('visible', appState.messagesVisible));
}

function openGroupEditModal() {
    const selectedCount = appState.selectedDots.size;
    if (selectedCount < 2) return;

    document.getElementById('group-edit-count').textContent = selectedCount;
    updateEditModalOptions('group-edit-marker-type', true);
    document.getElementById('group-edit-message').value = '';
    document.getElementById('group-edit-notes').value = '';

    const selectedDots = Array.from(appState.selectedDots).map(id => getCurrentPageDots().get(id));

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
    const newMarkerTypeCode = document.getElementById('group-edit-marker-type').value;
    const newMessage = document.getElementById('group-edit-message').value.trim();
    const newNotes = document.getElementById('group-edit-notes').value;
    const codeRequiredCheckbox = document.getElementById('group-edit-code-required');
    const installedCheckbox = document.getElementById('group-edit-installed');

    appState.selectedDots.forEach(internalId => {
        const dot = getCurrentPageDots().get(internalId);
        if (dot) {
            if (newMarkerTypeCode) dot.markerType = newMarkerTypeCode;
            if (newMessage) dot.message = newMessage;
            
            dot.notes = newNotes.trim();

            if (!codeRequiredCheckbox.indeterminate) {
                dot.isCodeRequired = codeRequiredCheckbox.checked;
            }
            if (!installedCheckbox.indeterminate) {
                dot.installed = installedCheckbox.checked;
            }
        }
    });
    UndoManager.capture(`Edit ${appState.selectedDots.size} dots`);

    closeGroupModal(); 

    renderDotsForCurrentPage(); 
    updateAllSectionsForCurrentPage(); 
    updateSelectionUI();
    setDirtyState();
}

function groupDeleteDots() {
    appState.selectedDots.forEach(internalId => { getCurrentPageDots().delete(internalId); });
    UndoManager.capture(`Delete ${appState.selectedDots.size} dots`);
    
    closeGroupModal(); 
    
    clearSelection(); 
    renderDotsForCurrentPage(); 
    updateAllSectionsForCurrentPage();
    setDirtyState();
}

function updateEditModalOptions(selectElementId = 'edit-marker-type', isGroupEdit = false) {
    const select = document.getElementById(selectElementId);
    const sortedMarkerTypeCodes = Object.keys(appState.markerTypes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    let optionsHtml = isGroupEdit ? '<option value="">-- Keep Individual Types --</option>' : '';
    optionsHtml += sortedMarkerTypeCodes.map(code => {
        const typeData = appState.markerTypes[code];
        return `<option value="${code}">${typeData.code} - ${typeData.name}</option>`;
    }).join('');
    select.innerHTML = optionsHtml;
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

function updateAutomapStatus(message, isError = false) {
    const statusEl = document.getElementById('automap-status');
    if (statusEl) {
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
}

function updateAutomapControls() {
    const select = document.getElementById('automap-marker-type-select');
    const datalist = document.getElementById('recent-searches-datalist');
    const checkbox = document.getElementById('automap-exact-phrase');

    const sortedMarkerTypeCodes = Object.keys(appState.markerTypes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    let optionsHtml = sortedMarkerTypeCodes.map(code => {
        const typeData = appState.markerTypes[code];
        const isSelected = code === appState.activeMarkerType ? 'selected' : '';
        return `<option value="${code}" ${isSelected}>${typeData.code} - ${typeData.name}</option>`;
    }).join('');
    select.innerHTML = optionsHtml;

    let datalistHtml = appState.recentSearches.map(term => `<option value="${term}"></option>`).join('');
    datalist.innerHTML = datalistHtml;

    checkbox.checked = appState.automapExactPhrase;
}

function openEditModal(internalId) {
    const dot = getCurrentPageDots().get(internalId); if (!dot) return;
    appState.editingDot = internalId;
    updateEditModalOptions(); 
    document.getElementById('edit-marker-type').value = dot.markerType;
    document.getElementById('edit-location-number').value = dot.locationNumber;
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
    
    const newLocationNumber = document.getElementById('edit-location-number').value.trim();
    
    if (newLocationNumber !== dot.locationNumber) {
        const dotsOnCurrentPage = getCurrentPageDots();
        for (const otherDot of dotsOnCurrentPage.values()) {
            if (otherDot.internalId !== dot.internalId && otherDot.locationNumber === newLocationNumber) {
                showCSVStatus(`Location number "${newLocationNumber}" already exists on this page.`, false, 5000);
                return;
            }
        }
    }
    
    dot.markerType = document.getElementById('edit-marker-type').value;
    dot.locationNumber = newLocationNumber;
    dot.message = document.getElementById('edit-message').value.trim();
    dot.isCodeRequired = document.getElementById('edit-code-required').checked;
    dot.installed = document.getElementById('edit-installed').checked;
    dot.notes = document.getElementById('edit-notes').value.trim();
    
    appState.activeMarkerType = dot.markerType;
    UndoManager.capture('Edit dot');

    renderDotsForCurrentPage(); 
    updateAllSectionsForCurrentPage(); 
    closeModal();
    setDirtyState();
}

function deleteDot() {
    if (appState.editingDot) {
        getCurrentPageDots().delete(appState.editingDot);
        UndoManager.capture('Delete dot');

        renderDotsForCurrentPage(); 
        updateAllSectionsForCurrentPage(); 
        closeModal();
        setDirtyState();
    }
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
    
    const codeIndex = headers.indexOf("MARKER TYPE CODE");
    const nameIndex = headers.indexOf("MARKER TYPE NAME");
    const messageIndex = headers.indexOf("MESSAGE");
    const locNumIndex = headers.indexOf("LOCATION NUMBER");
    const pageIndex = headers.indexOf("MAP PAGE");
    const codeRequiredIndex = headers.indexOf("CODE REQUIRED");
    const installedIndex = headers.indexOf("INSTALLED");

    if ([codeIndex, nameIndex, messageIndex, locNumIndex, pageIndex].includes(-1)) { 
        showCSVStatus("Update file is missing required columns (MARKER TYPE CODE, MARKER TYPE NAME, etc.).", false, 8000); 
        return; 
    }

    let updatedCount = 0; const skippedRows = [];
    for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        const markerTypeCode = row[codeIndex]; 
        const message = row[messageIndex];
        const locNum = row[locNumIndex].replace(/'/g, '').padStart(4, '0');
        const pageNum = parseInt(row[pageIndex], 10);

        if (isNaN(pageNum)) { skippedRows.push({ line: i + 1, reason: "Invalid Map Page number." }); continue; }
        if (!appState.markerTypes[markerTypeCode]) { skippedRows.push({ line: i + 1, reason: `Marker Type Code "${markerTypeCode}" does not exist in this project.` }); continue; }
        
        const dotsOnPage = getDotsForPage(pageNum);
        let dotToUpdate = null;
        for (const dot of dotsOnPage.values()) {
            if (dot.locationNumber === locNum) {
                dotToUpdate = dot;
                break;
            }
        }
        
        if (!dotToUpdate) { 
            skippedRows.push({ line: i + 1, reason: `Location ${locNum} on page ${pageNum} not found.` }); 
            continue; 
        }
        
        dotToUpdate.markerType = markerTypeCode; 
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
        UndoManager.capture('Import CSV update');
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

function copySelectedDot() {
    if (appState.selectedDots.size !== 1) {
        showCSVStatus("Please select exactly one dot to copy", false, 3000);
        return;
    }
    
    const internalId = Array.from(appState.selectedDots)[0];
    const dot = getCurrentPageDots().get(internalId);
    if (!dot) return;
    
    appState.copiedDot = {
        markerType: dot.markerType,
        message: dot.message,
        isCodeRequired: dot.isCodeRequired,
        notes: dot.notes,
        installed: dot.installed
    };
    
    showCSVStatus(`📋 Copied dot ${dot.locationNumber}`, true, 2000);
}

function pasteDotAtCursor() {
    if (!appState.copiedDot) {
        showCSVStatus("No dot copied. Select a dot and press Ctrl+C first.", false, 3000);
        return;
    }
    
    const x = appState.lastMousePosition.x;
    const y = appState.lastMousePosition.y;
    
    if (!isCollision(x, y)) {
        addDot(x, y, appState.copiedDot.markerType, appState.copiedDot.message, appState.copiedDot.isCodeRequired);
        
        const pageData = getCurrentPageData();
        const newInternalId = String(appState.nextInternalId - 1).padStart(7, '0');
        const newDot = pageData.dots.get(newInternalId);
        if (newDot) {
            newDot.notes = appState.copiedDot.notes;
            newDot.installed = appState.copiedDot.installed;
        }
        
        UndoManager.capture('Paste dot');
        showCSVStatus(`✅ Pasted dot at cursor`, true, 2000);
    } else {
        showCSVStatus("Cannot paste - collision detected at cursor position", false, 3000);
    }
}

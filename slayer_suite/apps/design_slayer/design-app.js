// apps/design_slayer/design-app.js
import SlayerAppBase from '../../core/slayer-app-base.js';
import {
    state,
    updateState,
    getNextElementId,
    getNextDepthNumber,
    migrateLegacyLayers
} from './state.js';
import { LAYER_DEFINITIONS, SCALE_FACTOR } from './config.js';
import * as UI from './ui.js';
// Canvas module replaced with SVG system
// import * as Canvas from './canvas.js';
import * as Viewer3D from './viewer3D.js';
import { fontManager } from './font-manager.js';
import { DataModels } from '../../core/index.js';
import { designSVG } from './design-svg.js';

class DesignSlayerApp extends SlayerAppBase {
    constructor() {
        super('design_slayer', 'DESIGN SLAYER', '1.0.0');
        this.eventHandlers = null;
    }

    createAppContent() {
        const contentArea = this.getContentArea();

        // Read the original index.html structure and adapt it
        contentArea.innerHTML = `
            <div class="design-slayer-app">
                <!-- Main Content -->
                <div class="design-slayer-left-panel">
                <!-- Sign Type Section -->
                <div class="design-slayer-panel-section" style="flex: 0 0 auto; min-height: auto;">
                    <div class="design-slayer-panel-header">
                        <span>SIGN TYPE</span>
                        <button class="btn btn-compact btn-primary" id="create-sign-type-btn" style="font-size: 10px; padding: 3px 8px;">NEW</button>
                    </div>
                    <div class="design-slayer-panel-content" style="padding: 10px;">
                        <div class="sign-type-selector">
                            <select id="sign-type-select" class="layer-dropdown" style="width: 100%; margin-bottom: 8px;">
                                <option value="">Select Sign Type</option>
                            </select>
                            <div id="new-sign-type-form" style="display: none;">
                                <input type="text" id="new-sign-type-code" placeholder="Sign Type Code (e.g., I.1)" class="property-input" style="margin-bottom: 5px;">
                                <input type="text" id="new-sign-type-name" placeholder="Sign Type Name" class="property-input" style="margin-bottom: 5px;">
                                <div style="display: flex; gap: 5px;">
                                    <button class="btn btn-primary btn-compact" id="save-sign-type-btn">Save</button>
                                    <button class="btn btn-secondary btn-compact" id="cancel-sign-type-btn">Cancel</button>
                                </div>
                            </div>
                            <!-- Sign type info removed - redundant since dropdown shows this info -->
                        </div>
                    </div>
                </div>
                <div class="design-slayer-panel-section">
                    <div class="design-slayer-panel-header">
                        <span>ELEMENTS</span>
                        <div class="element-controls">
                            <select id="element-type-select" class="element-dropdown">
                                <option value="">Select Element Type</option>
                                <option value="plate">Plate</option>
                                <option value="paragraph-text">Paragraph Text</option>
                                <option value="braille-text">Braille Text</option>
                                <option value="logo">Logo</option>
                                <option value="icon">Icon</option>
                            </select>
                            <button class="btn-add" id="add-element-btn">+</button>
                        </div>
                    </div>
                    <div class="design-slayer-panel-content">
                        <div class="elements-list" id="elements-list">
                            <div class="empty-state">
                                Select an element type and click + to add your first element.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Center - Design Views -->
            <div class="design-slayer-center-panel">
                <div class="design-workspace">
                    <!-- Face View -->
                    <div class="design-view">
                        <div class="design-canvas face-canvas" id="face-canvas">
                            <div class="canvas-viewport" id="face-viewport">
                                <div class="canvas-grid"></div>
                                <div class="dimensions-container" id="dimensions-container"></div>
                                <div class="drop-zone" id="face-drop-zone">
                                    Drag Sign Element Here
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Side Profile -->
                    <div class="design-view" style="flex: 0.25;">
                        <div class="design-canvas side-canvas" id="side-canvas">
                            <div class="canvas-viewport" id="side-viewport">
                                <div class="canvas-grid"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="design-slayer-footer-controls">
                <div class="design-slayer-control-group">
                    <!-- Enhanced Snap Control -->
                    <div class="snap-container">
                        <button class="btn btn-secondary btn-compact" id="snap-toggle-btn">SNAP OFF</button>
                        <div class="snap-flyout" id="snap-flyout">
                            <div class="snap-header">SNAP SETTINGS</div>
                            <div class="snap-toggle-switch" id="snap-toggle-switch">
                                <span>Enable Snap</span>
                                <div class="switch"></div>
                            </div>
                            <div class="snap-unit-toggle">
                                <button class="unit-btn active" data-unit="inches">INCHES</button>
                                <button class="unit-btn" data-unit="mm">MM</button>
                            </div>
                            <div class="snap-presets" id="snap-presets">
                                <!-- Preset buttons will be populated by JS -->
                            </div>
                            <div class="snap-custom">
                                <label for="custom-snap-input">Custom Value:</label>
                                <input type="number" id="custom-snap-input" min="0.01" step="0.01" value="0.125">
                            </div>
                        </div>
                    </div>
                    
                    <button class="btn btn-secondary btn-compact" id="view-3d-btn">3D VIEW</button>
                    <button class="btn btn-secondary btn-compact" id="unit-toggle-btn">MM</button>
                    <button class="btn btn-secondary btn-compact" id="xray-mode-btn">X-RAY OFF</button>
                    <button class="btn btn-secondary btn-compact" id="shadow-mode-btn">SHADOWS OFF</button>
                </div>
                
                <div class="design-slayer-control-group right-controls">
                    <!-- Template and export buttons removed from UI -->
                </div>
            </div>

            <!-- 3D Modal -->
            <div class="modal-overlay" id="modal-3d" style="display: none;">
                <div class="loading-spinner" id="loading-spinner">Loading 3D Model...</div>
                <div id="threejs-container">
                    <button class="modal-close-btn" id="close-modal-3d-btn">×</button>
                </div>
            </div>

            <!-- Element Properties Modal -->
            <div id="element-properties-modal" class="ds-modal">
                <div class="ds-modal-content">
                    <div class="ds-modal-header">
                        <h3 id="element-modal-title">Element Properties</h3>
                        <span class="ds-close-modal">&times;</span>
                    </div>
                    <div class="ds-modal-body">
                        <!-- Basic Properties -->
                        <div class="ds-property-section">
                            <h4>Basic Properties</h4>
                            <div class="ds-property-row">
                                <label>Name:</label>
                                <input type="text" id="modal-element-name" class="ds-modal-input" />
                            </div>
                            <div class="ds-property-row">
                                <label>Type:</label>
                                <span id="modal-element-type" class="ds-readonly-field"></span>
                            </div>
                            <div class="ds-property-row">
                                <label>Layer Depth:</label>
                                <input type="number" id="modal-element-depth" class="ds-modal-input" min="1" step="1" />
                            </div>
                        </div>
                        
                        <!-- Material Properties -->
                        <div class="ds-property-section">
                            <h4>Material & Appearance</h4>
                            <div class="ds-property-row">
                                <label>Material Description:</label>
                                <textarea id="modal-material-description" class="ds-modal-textarea" 
                                    placeholder="E.g., Brushed Aluminum - Silver Matte&#10;1/8&quot; thickness, non-glare finish"
                                    rows="3"></textarea>
                            </div>
                            <div class="ds-property-row">
                                <label>Texture:</label>
                                <div class="ds-texture-controls">
                                    <div class="ds-texture-square" id="texture-upload-square">
                                        <div class="ds-texture-empty" style="display: flex;">
                                            <span class="ds-upload-plus">+</span>
                                        </div>
                                        <div class="ds-texture-filled" style="display: none;">
                                            <img class="ds-texture-thumbnail" alt="Texture">
                                            <button class="ds-texture-delete" type="button">&times;</button>
                                        </div>
                                    </div>
                                    <input type="file" id="texture-file-input" class="ds-texture-input" 
                                        accept="image/png,image/bmp,image/jpeg" style="display: none;">
                                    <span class="ds-texture-hint">Click + to upload texture (PNG/BMP)</span>
                                </div>
                            </div>
                            <div class="ds-property-row">
                                <label>Thickness (mm):</label>
                                <input type="number" id="modal-element-thickness" class="ds-modal-input" 
                                    min="0.5" step="0.5" />
                            </div>
                        </div>
                        
                        <!-- Dimensions (for non-text elements) -->
                        <div class="ds-property-section" id="modal-dimensions-section">
                            <h4>Dimensions</h4>
                            <div class="ds-property-row">
                                <label>Width (mm):</label>
                                <input type="number" id="modal-element-width" class="ds-modal-input" 
                                    min="1" step="1" />
                            </div>
                            <div class="ds-property-row">
                                <label>Height (mm):</label>
                                <input type="number" id="modal-element-height" class="ds-modal-input" 
                                    min="1" step="1" />
                            </div>
                        </div>
                        
                        <!-- Text Properties (for text elements) -->
                        <div class="ds-property-section" id="modal-text-section" style="display: none;">
                            <h4>Text Properties</h4>
                            <div class="ds-property-row">
                                <label>Font:</label>
                                <select id="modal-element-font" class="ds-modal-input"></select>
                            </div>
                            <div class="ds-property-row">
                                <label>Font Size (pt):</label>
                                <input type="number" id="modal-element-fontsize" class="ds-modal-input" 
                                    min="8" max="144" step="0.001" />
                            </div>
                            <div class="ds-property-row">
                                <label>Text Align:</label>
                                <div class="ds-align-buttons">
                                    <button class="ds-align-btn" data-align="left">⬅</button>
                                    <button class="ds-align-btn" data-align="center">⬄</button>
                                    <button class="ds-align-btn" data-align="right">➡</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="ds-modal-footer">
                        <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
                        <button class="btn btn-primary" id="modal-apply-btn">Apply Changes</button>
                    </div>
                </div>
            </div>

            </div> <!-- End design-slayer-app -->
        `;
    }

    async initialize(container, isSuiteMode) {
        await super.initialize(container, isSuiteMode);

        // Always load Design Slayer styles
        await this.loadAppStyles();

        // Initialize functionality after styles are loaded
        await this.initializeDesignFunctionality();

        // Make UI available globally for other modules
        window.UI = UI;
    }

    async activate() {
        await super.activate();

        // Force refresh of SVG when app becomes active
        setTimeout(() => {
            designSVG.forceRefresh();
        }, 100);

        // Update element dropdown with latest fields from Thumbnail Slayer
        await this.updateElementDropdownWithFields();

        // Add message listener for test zoom control
        window.addEventListener('message', event => {
            if (event.data.type === 'SET_ZOOM' && event.data.zoom) {
                designSVG.setZoom(event.data.zoom);
                // Send confirmation back
                event.source.postMessage(
                    {
                        type: 'ZOOM_UPDATED',
                        zoom: event.data.zoom
                    },
                    '*'
                );
            }
        });
    }

    async deactivate() {
        await super.deactivate();
    }

    async loadAppStyles() {
        const link = document.createElement('link');
        link.id = 'design-slayer-css';
        link.rel = 'stylesheet';
        link.href = './apps/design_slayer/design-slayer.css';
        document.head.appendChild(link);

        // Wait for styles to load
        return new Promise(resolve => {
            link.onload = resolve;
            link.onerror = () => {
                console.error('Failed to load Design Slayer styles');
                resolve(); // Continue anyway
            };
        });
    }

    async initializeDesignFunctionality() {
        console.log('🎨 Initializing Design Slayer functionality...');

        // Make this instance globally accessible for the modal
        window.designSlayerApp = this;

        // Ensure SVG library is loaded before continuing
        await designSVG.loadSVGLibrary().catch(() => {
            console.log('SVG library may already be loaded or loading from CDN fallback');
        });

        // Initialize element properties modal
        const { initializeElementModal, setupElementRightClick } = await import(
            './element-modal.js'
        );
        initializeElementModal();
        setupElementRightClick();

        // Initialize sync adapter
        const { designSyncAdapter } = await import('./design-sync.js');
        this.syncAdapter = designSyncAdapter;

        // Initialize sync with app bridge if available
        if (window.appBridge) {
            this.syncAdapter.initialize(window.appBridge);
        }

        // Test Braille translation after everything is loaded
        setTimeout(() => {
            import('./braille-translator-v2.js')
                .then(({ testBrailleTranslation }) => {
                    testBrailleTranslation();
                })
                .catch(error => {
                    console.error('Failed to load Braille translator:', error);
                });
        }, 2000); // Give time for worker to initialize

        // Initialize event handlers
        this.setupEventHandlers();

        // Migrate existing layers to include layerDepth property if needed
        migrateLegacyLayers();

        // Setup SVG interactions
        await this.setupSVGCanvas(this.eventHandlers);

        // Setup snap flyout
        UI.setupSnapFlyout(this.eventHandlers);

        // Setup sign type handlers
        this.setupSignTypeHandlers();

        // Setup 3D modal
        UI.setup3DModal(this.eventHandlers);

        // Setup sign type functionality
        await this.setupSignTypes();

        // Setup template functionality
        await this.setupTemplates();

        // Setup template export/import handlers
        // this.setupTemplateExportImport(); // Template buttons removed from UI

        // Setup auto-save functionality
        this.setupAutoSave();

        // Initial UI refresh
        UI.refreshElementList(this.eventHandlers);
        // UI.updateGridToggleVisual(); // Grid button removed from UI

        // Force initial render of grid and rulers
        setTimeout(() => {
            designSVG.render();
        }, 100);

        console.log('✅ Design Slayer functionality initialized');

        // Expose design app instance globally for sync
        window.designApp = this;

        // Update element dropdown with dynamic fields from Thumbnail Slayer
        await this.updateElementDropdownWithFields();

        // If fields weren't available, listen for Thumbnail Slayer registration
        if (window.appBridge) {
            const registeredApps = window.appBridge.getRegisteredApps();
            if (!registeredApps.includes('thumbnail_slayer')) {
                // Listen for app registration event
                const handleAppRegistered = event => {
                    if (event.detail && event.detail.appName === 'thumbnail_slayer') {
                        console.log('Thumbnail Slayer registered - updating fields dropdown');
                        this.updateElementDropdownWithFields();
                        // Remove listener after handling
                        window.appBridge.eventBus.removeEventListener(
                            'app:registered',
                            handleAppRegistered
                        );
                    }
                };
                window.appBridge.eventBus.addEventListener('app:registered', handleAppRegistered);
            }
        }
    }

    /**
     * Setup SVG canvas interactions (replaces Canvas.setupCanvas)
     */
    async setupSVGCanvas(handlers) {
        const faceCanvas = document.getElementById('face-canvas');
        const sideCanvas = document.getElementById('side-canvas');

        if (!faceCanvas || !sideCanvas) {
            console.error('Canvas elements not found in DOM');
            return;
        }

        // Initialize the SVG system
        await designSVG.initialize();

        // Pan and Zoom listeners
        faceCanvas.addEventListener('wheel', e => this.handleZoom(e, handlers.onViewportChange));

        // Track middle click timing for double-click detection
        let lastMiddleClickTime = 0;
        const DOUBLE_CLICK_THRESHOLD = 400; // milliseconds

        faceCanvas.addEventListener('mousedown', e => {
            if (e.button === 1) {
                // Middle mouse button
                e.preventDefault();

                const currentTime = Date.now();
                const timeDiff = currentTime - lastMiddleClickTime;

                if (timeDiff < DOUBLE_CLICK_THRESHOLD) {
                    // Double middle-click detected - zoom to fit all elements
                    this.zoomToFitElements(handlers.onViewportChange);
                    lastMiddleClickTime = 0; // Reset to prevent triple-click
                } else {
                    // Single middle-click - start panning
                    this.startPan(e, handlers.onViewportChange);
                    lastMiddleClickTime = currentTime;
                }
            }
        });
        faceCanvas.addEventListener('mousemove', e => this.handlePan(e, handlers.onViewportChange));
        faceCanvas.addEventListener('mouseup', e => {
            if (e.button === 1) this.stopPan();
        });
        faceCanvas.addEventListener('mouseleave', () => this.stopPan());
        faceCanvas.addEventListener('contextmenu', e => e.preventDefault());

        // Track mouse down position for click vs drag detection
        let mouseDownPos = null;
        const DRAG_THRESHOLD = 5; // pixels of movement allowed before considering it a drag

        faceCanvas.addEventListener('mousedown', e => {
            if (e.button === 0) {
                // Left click only
                mouseDownPos = { x: e.clientX, y: e.clientY };
            }
        });

        // Deselect element listener - click off elements to deselect
        faceCanvas.addEventListener('click', e => {
            // Check if this was a drag (moved more than threshold)
            if (mouseDownPos) {
                const distance = Math.sqrt(
                    Math.pow(e.clientX - mouseDownPos.x, 2) +
                        Math.pow(e.clientY - mouseDownPos.y, 2)
                );

                // If mouse moved too much, consider it a drag, not a click
                if (distance > DRAG_THRESHOLD) {
                    mouseDownPos = null;
                    return;
                }
            }

            // Check if clicking on canvas background (not on elements)
            // SVG elements might not have classList, check various conditions
            const isBackground =
                e.target.id === 'face-canvas' ||
                e.target.classList?.contains('canvas-viewport') ||
                e.target.classList?.contains('design-svg-main') ||
                e.target.tagName === 'svg' ||
                (e.target.tagName === 'rect' && e.target.classList?.contains('grid-line')) ||
                (e.target.tagName === 'line' &&
                    (e.target.classList?.contains('grid-line-vertical') ||
                        e.target.classList?.contains('grid-line-horizontal')));

            // Also check if we're not clicking on a sign element
            const isElement =
                e.target.closest('.sign-element') ||
                e.target.closest('.resize-handle') ||
                e.target.closest('.layer-shape');

            if (isBackground && !isElement) {
                handlers.onSelectElement(null);
            }

            mouseDownPos = null;
        });

        // Keyboard handlers - ESC to deselect, Delete to delete, PgUp/PgDn for layer depth
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                // Deselect current element if one is selected
                if (state.currentElement) {
                    handlers.onSelectElement(null);
                }
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                // Delete current element if one is selected
                // Don't delete if user is typing in an input field
                if (state.currentElement && !e.target.matches('input, textarea, select')) {
                    e.preventDefault();
                    handlers.onDeleteElement(state.currentElement.id);
                }
            } else if (e.key === 'PageUp') {
                // Decrease layer depth (bring forward)
                // Don't change depth if user is typing in an input field
                if (state.currentElement && !e.target.matches('input, textarea, select')) {
                    e.preventDefault();
                    const currentDepth = state.currentElement.elementDepth || 1;
                    const newDepth = Math.max(1, currentDepth - 1);
                    if (newDepth !== currentDepth) {
                        state.currentElement.elementDepth = newDepth;
                        updateState({ elementsList: [...state.elementsList], isDirty: true });
                        this.updateElementOrder();
                        UI.refreshElementList(this.eventHandlers);
                        console.log(
                            `Layer depth changed: ${currentDepth} → ${newDepth} (brought forward)`
                        );
                    }
                }
            } else if (e.key === 'PageDown') {
                // Increase layer depth (send backward)
                // Don't change depth if user is typing in an input field
                if (state.currentElement && !e.target.matches('input, textarea, select')) {
                    e.preventDefault();
                    const currentDepth = state.currentElement.elementDepth || 1;
                    const newDepth = Math.min(99, currentDepth + 1);
                    if (newDepth !== currentDepth) {
                        state.currentElement.elementDepth = newDepth;
                        updateState({ elementsList: [...state.elementsList], isDirty: true });
                        this.updateElementOrder();
                        UI.refreshElementList(this.eventHandlers);
                        console.log(
                            `Layer depth changed: ${currentDepth} → ${newDepth} (sent backward)`
                        );
                    }
                }
            }
        });

        // Drag and Drop listeners
        [faceCanvas, sideCanvas].forEach(canvas => {
            if (canvas) {
                canvas.addEventListener('dragover', this.handleDragOver);
                canvas.addEventListener('dragenter', e => this.handleDragEnter(e, canvas));
                canvas.addEventListener('dragleave', e => this.handleDragLeave(e, canvas));
                canvas.addEventListener('drop', e => handlers.onDropOnCanvas(e, canvas));
            }
        });
    }

    // Zoom, pan and drag handlers for SVG system
    handleZoom(e, onUpdate) {
        const faceCanvas = document.getElementById('face-canvas');
        if (!faceCanvas) return;

        e.preventDefault();

        const rect = faceCanvas.getBoundingClientRect();
        // Use mouse position as zoom center for more intuitive zooming
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const currentZoom = state.faceViewState.zoom;
        const zoomFactor = 1.1;

        const newZoom =
            e.deltaY > 0
                ? Math.max(0.1, currentZoom / zoomFactor)
                : Math.min(15, currentZoom * zoomFactor);

        // Convert mouse position to world coordinates before zoom
        const worldX = (mouseX - state.faceViewState.x) / currentZoom;
        const worldY = (mouseY - state.faceViewState.y) / currentZoom;

        // Calculate new pan to keep the same world point under the mouse
        const newX = mouseX - worldX * newZoom;
        const newY = mouseY - worldY * newZoom;

        onUpdate({
            faceViewState: { x: newX, y: newY, zoom: newZoom },
            sideViewState: { ...state.sideViewState, y: newY, zoom: newZoom }
        });
    }

    startPan(e, _onUpdate) {
        updateState({ isPanning: true, lastPanPoint: { x: e.clientX, y: e.clientY } });
        const faceCanvas = document.getElementById('face-canvas');
        if (faceCanvas) {
            faceCanvas.style.cursor = 'grabbing';
        }
    }

    handlePan(e, onUpdate) {
        if (!state.isPanning) return;

        // Throttle pan updates with requestAnimationFrame
        if (this.panThrottleTimer) return;

        this.panThrottleTimer = requestAnimationFrame(() => {
            const deltaX = e.clientX - state.lastPanPoint.x;
            const deltaY = e.clientY - state.lastPanPoint.y;

            const newFaceX = state.faceViewState.x + deltaX;
            const newFaceY = state.faceViewState.y + deltaY;

            onUpdate({
                faceViewState: { ...state.faceViewState, x: newFaceX, y: newFaceY },
                sideViewState: { ...state.sideViewState, y: newFaceY },
                lastPanPoint: { x: e.clientX, y: e.clientY }
            });

            this.panThrottleTimer = null;
        });
    }

    stopPan() {
        updateState({ isPanning: false });
        const faceCanvas = document.getElementById('face-canvas');
        if (faceCanvas) {
            faceCanvas.style.cursor = 'default';
        }
    }

    zoomToFitElements(onUpdate) {
        // Get all elements on canvas
        const elementsOnCanvas = state.elementsList.filter(e => e.onCanvas);

        if (elementsOnCanvas.length === 0) {
            // No elements, reset to default view (2x = 100%)
            onUpdate({
                faceViewState: { x: 0, y: 0, zoom: 2 },
                sideViewState: { ...state.sideViewState, y: 0, zoom: 2 }
            });
            return;
        }

        // Calculate bounding box of all elements
        let minX = Infinity,
            minY = Infinity;
        let maxX = -Infinity,
            maxY = -Infinity;

        elementsOnCanvas.forEach(element => {
            minX = Math.min(minX, element.x);
            minY = Math.min(minY, element.y);
            maxX = Math.max(maxX, element.x + element.width);
            maxY = Math.max(maxY, element.y + element.height);
        });

        // Add padding around elements (in mm)
        const padding = 50; // 50mm padding
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        // Get canvas dimensions
        const faceCanvas = document.getElementById('face-canvas');
        if (!faceCanvas) return;

        const rect = faceCanvas.getBoundingClientRect();
        const canvasWidth = rect.width - 30; // Account for ruler
        const canvasHeight = rect.height - 30; // Account for ruler

        // Calculate required zoom to fit all elements
        const contentWidth = (maxX - minX) * SCALE_FACTOR;
        const contentHeight = (maxY - minY) * SCALE_FACTOR;

        const zoomX = canvasWidth / contentWidth;
        const zoomY = canvasHeight / contentHeight;
        const newZoom = Math.min(zoomX, zoomY, 4); // Cap at 4x zoom max (displayed as 200%)

        // Calculate pan to center the content
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const newX = canvasWidth / 2 - centerX * SCALE_FACTOR * newZoom;
        const newY = canvasHeight / 2 - centerY * SCALE_FACTOR * newZoom;

        // Apply the new viewport
        onUpdate({
            faceViewState: { x: newX, y: newY, zoom: newZoom },
            sideViewState: { ...state.sideViewState, y: newY, zoom: newZoom }
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }

    handleDragEnter(e, canvas) {
        e.preventDefault();
        canvas.querySelector('.drop-zone')?.classList.add('drag-over');
    }

    handleDragLeave(e, canvas) {
        if (!canvas.contains(e.relatedTarget)) {
            canvas.querySelector('.drop-zone')?.classList.remove('drag-over');
        }
    }

    /**
     * Update viewport for SVG system
     */
    updateViewport() {
        designSVG.updateViewport(
            state.faceViewState.zoom,
            state.faceViewState.x,
            state.faceViewState.y
        );
    }

    /**
     * Update dimensions visuals for SVG system
     */
    updateDimensionsVisuals() {
        // Measurement display removed from UI
        // Dimension lines could be implemented in SVG in the future
    }

    setupSignTypeHandlers() {
        const signTypeSelect = document.getElementById('sign-type-select');
        const createSignTypeBtn = document.getElementById('create-sign-type-btn');
        const newSignTypeForm = document.getElementById('new-sign-type-form');
        const saveSignTypeBtn = document.getElementById('save-sign-type-btn');
        const cancelSignTypeBtn = document.getElementById('cancel-sign-type-btn');

        // Handle sign type selection
        if (signTypeSelect) {
            signTypeSelect.addEventListener('change', async e => {
                const selectedCode = e.target.value;
                if (selectedCode) {
                    state.currentSignType = selectedCode;

                    // Update element dropdown with sign type fields
                    await this.updateElementDropdownWithFields();

                    // Refresh existing field elements with actual content
                    await this.refreshFieldElementPlaceholders();

                    // Load existing template if available
                    this.loadTemplateForSignType(selectedCode);
                } else {
                    state.currentSignType = null;

                    // Update element dropdown to remove sign type fields
                    await this.updateElementDropdownWithFields();

                    // Reset field elements to placeholder text
                    state.elementsList.forEach(element => {
                        if (element.isFieldElement && element.fieldName) {
                            element.text = `{{${element.fieldName}}}`;
                            if (element.onCanvas) {
                                designSVG.updateElement(element);
                            }
                        }
                    });
                    UI.refreshElementList(this.eventHandlers);
                }
                updateState({ isDirty: true });
            });
        }

        // Handle create new sign type
        if (createSignTypeBtn) {
            createSignTypeBtn.addEventListener('click', () => {
                newSignTypeForm.style.display = 'block';
                signTypeSelect.style.display = 'none';
                document.getElementById('new-sign-type-code').focus();
            });
        }

        // Handle save new sign type
        if (saveSignTypeBtn) {
            saveSignTypeBtn.addEventListener('click', async () => {
                const code = document.getElementById('new-sign-type-code').value.trim();
                const name = document.getElementById('new-sign-type-name').value.trim();

                if (!code || !name) {
                    alert('Please enter both code and name for the sign type.');
                    return;
                }

                try {
                    await this.syncAdapter.createSignType(code, name);

                    // Reset form
                    document.getElementById('new-sign-type-code').value = '';
                    document.getElementById('new-sign-type-name').value = '';
                    newSignTypeForm.style.display = 'none';
                    signTypeSelect.style.display = 'block';

                    // Select the new sign type
                    signTypeSelect.value = code;
                    signTypeSelect.dispatchEvent(new Event('change'));
                } catch (error) {
                    alert('Error creating sign type: ' + error.message);
                }
            });
        }

        // Handle cancel
        if (cancelSignTypeBtn) {
            cancelSignTypeBtn.addEventListener('click', () => {
                document.getElementById('new-sign-type-code').value = '';
                document.getElementById('new-sign-type-name').value = '';
                newSignTypeForm.style.display = 'none';
                signTypeSelect.style.display = 'block';
            });
        }
    }

    setupEventHandlers() {
        // Create event handlers object
        this.eventHandlers = {
            // Element List Handlers
            onDeleteElement: this.deleteElement.bind(this),
            onSelectElement: element => {
                updateState({ currentElement: element });
                UI.updateDimensionsDisplay();
                UI.updateElementSelection(); // Just update selection, don't refresh entire list
                designSVG.updateSelectionVisuals();
                this.updateDimensionsVisuals();
            },
            onUpdateElementProperties: elementId => {
                const updatedProps = UI.readElementPropertiesFromUI(elementId);
                if (!updatedProps) return;

                const element = state.elementsList.find(l => l.id === elementId);
                if (!element) return;

                Object.assign(element, updatedProps);

                if (element.onCanvas) {
                    designSVG.updateElement(element);
                }

                updateState({ elementsList: [...state.elementsList] });
                UI.updateStackVisualization();
                this.updateDimensionsVisuals();

                // If elementDepth changed, update the z-order
                if (updatedProps.elementDepth !== undefined) {
                    this.updateElementOrder();
                }

                // Force re-render of ADA guide if it's shown and font properties changed
                if (
                    element.showAdaGuide &&
                    (updatedProps.fontSize || updatedProps.font || updatedProps.verticalAlign)
                ) {
                    // The updateCanvasElement should handle this, but let's ensure it happens
                    const canvasElement = document.getElementById(element.id + '-canvas');
                    if (canvasElement) {
                        const existingGuide = canvasElement.querySelector('.ada-height-guide');
                        if (existingGuide) {
                            existingGuide.remove();
                            // It will be re-added by updateCanvasElement
                        }
                    }
                }
            },
            onMoveElementUp: elementId => {
                const index = state.elementsList.findIndex(l => l.id === elementId);
                if (index > 0) {
                    const newList = [...state.elementsList];
                    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
                    updateState({ elementsList: newList });
                    UI.refreshElementList(this.eventHandlers);
                    this.updateElementOrder();
                }
            },
            onMoveElementDown: elementId => {
                const index = state.elementsList.findIndex(l => l.id === elementId);
                if (index < state.elementsList.length - 1) {
                    const newList = [...state.elementsList];
                    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
                    updateState({ elementsList: newList });
                    UI.refreshElementList(this.eventHandlers);
                    this.updateElementOrder();
                }
            },
            onDragStartElement: (e, row) => {
                const elementId = row.dataset.elementId;
                e.dataTransfer.setData('application/element-id', elementId);
                e.dataTransfer.effectAllowed = 'copyMove';
                row.classList.add('dragging');
            },
            onDropInElementList: (e, insertIndex) => {
                e.preventDefault();
                const draggedElementId = parseInt(e.dataTransfer.getData('application/element-id'));
                if (draggedElementId) {
                    this.reorderElementAtIndex(draggedElementId, insertIndex);
                }
            },
            onToggleElementLink: (fromIndex, toIndex) => {
                if (toIndex < 0 || toIndex >= state.elementsList.length) return;

                const existingLinkIndex = state.elementLinks.findIndex(
                    link =>
                        (link.from === fromIndex && link.to === toIndex) ||
                        (link.from === toIndex && link.to === fromIndex)
                );

                let newLinks;
                if (existingLinkIndex !== -1) {
                    newLinks = state.elementLinks.filter((_, i) => i !== existingLinkIndex);
                } else {
                    newLinks = [...state.elementLinks, { from: fromIndex, to: toIndex }];
                }

                updateState({ elementLinks: newLinks });
                UI.updateLinkVisuals();
                UI.updateStackVisualization();
            },
            onToggleDimensions: elementId => {
                const element = state.elementsList.find(l => l.id === elementId);
                if (element) {
                    element.showDimensions = !element.showDimensions;
                    UI.refreshElementList(this.eventHandlers);
                    this.updateDimensionsVisuals();
                }
            },
            onDropOnCanvas: (e, canvas) => {
                e.preventDefault();
                canvas.querySelector('.drop-zone')?.classList.remove('drag-over');

                const elementId = parseInt(e.dataTransfer.getData('application/element-id'));
                const element = state.elementsList.find(l => l.id === elementId);

                if (element && !element.onCanvas && canvas.id === 'face-canvas') {
                    const rect = canvas.getBoundingClientRect();
                    // Convert drop position to world coordinates (mm)
                    const screenX = e.clientX - rect.left;
                    const screenY = e.clientY - rect.top;

                    // Use designSVG to convert to world coordinates (mm)
                    const world = designSVG.screenToWorld(screenX, screenY);
                    this.addElementToCanvas(element, world.x, world.y);
                }
            },
            onStartDrag: null, // Drag is now handled directly in SVG system
            onViewportChange: updates => {
                updateState(updates);
                this.updateViewport();
                designSVG.render();
                UI.updateStackVisualization();
                this.updateDimensionsVisuals();
            },
            // Snap and grid handlers
            onUnitChange: unit => {
                updateState({ snapUnit: unit });
                UI.updateSnapPresets(this.eventHandlers.onPresetSnapChange);
                UI.updateSnapDisplay();
            },
            onRulerToggle: () => {
                const rulersVisible = !state.rulersVisible;
                updateState({ rulersVisible });
                // Ruler toggle button removed from UI
                // const button = document.getElementById('ruler-toggle-btn');
                // if (button) {
                //     button.textContent = rulersVisible ? 'RULERS ON' : 'RULERS OFF';
                // }
                // Use the new SVG-based rulers
                designSVG.setRulersVisible(rulersVisible);
            },
            onGridToggle: () => {
                const newState = !state.gridVisible;

                updateState({ gridVisible: newState });
                designSVG.setGridVisible(state.gridVisible);
                // UI.updateGridToggleVisual(); // Grid button removed from UI
            },
            onSnapToggle: () => {
                updateState({ snapEnabled: !state.snapEnabled });
                UI.updateSnapDisplay();
            },
            onCustomSnapInput: value => {
                const numValue = parseFloat(value);
                if (numValue > 0) {
                    updateState({ snapValue: numValue });
                    UI.updateSnapDisplay();
                }
            },
            onPresetSnapChange: value => {
                updateState({ snapValue: value });
                UI.updatePresetSelection();
                UI.updateSnapDisplay();
            },
            // 3D Modal handlers
            onOpen3D: () => {
                console.log('Opening 3D modal...');
                updateState({ isModalOpen: true });
                UI.toggle3DModal(true);
                setTimeout(() => {
                    try {
                        Viewer3D.init3DViewer();
                        UI.hide3DLoadingSpinner();
                    } catch (error) {
                        console.error('Failed to initialize 3D viewer:', error);
                        UI.hide3DLoadingSpinner();
                        // Show error message
                        const container = document.getElementById('threejs-container');
                        if (container && !container.querySelector('canvas')) {
                            container.innerHTML =
                                '<div style="color: #f07727; text-align: center; padding: 40px;">Failed to initialize 3D viewer. Please check console for errors.</div>' +
                                container.innerHTML;
                        }
                    }
                }, 100);
            },
            onClose3D: () => {
                console.log('Closing 3D modal...');
                updateState({ isModalOpen: false });
                UI.toggle3DModal(false);
                Viewer3D.cleanup3DViewer();
            }
        };

        // Setup button event listeners
        this.setupButtonListeners();
    }

    setupButtonListeners() {
        // Add element button
        const addElementBtn = this.container.querySelector('#add-element-btn');
        const elementTypeSelect = this.container.querySelector('#element-type-select');

        if (addElementBtn && elementTypeSelect) {
            addElementBtn.addEventListener('click', async () => {
                // Check if a sign type is selected first
                if (!state.currentSignType) {
                    alert('Please select or create a sign type before adding elements.');
                    // Focus the sign type dropdown
                    const signTypeSelect = document.getElementById('sign-type-select');
                    if (signTypeSelect) {
                        signTypeSelect.focus();
                    }
                    return;
                }

                const type = elementTypeSelect.value;
                if (type) {
                    await this.addElement(type);
                    elementTypeSelect.value = '';
                }
            });
        }

        // 3D View button
        const view3dBtn = this.container.querySelector('#view-3d-btn');
        if (view3dBtn) {
            view3dBtn.addEventListener('click', this.eventHandlers.onOpen3D);
        }

        // Close 3D modal
        const close3dBtn = this.container.querySelector('#close-modal-3d-btn');
        if (close3dBtn) {
            close3dBtn.addEventListener('click', this.eventHandlers.onClose3D);
        }

        // Other control buttons
        const snapToggleBtn = this.container.querySelector('#snap-toggle-btn');
        if (snapToggleBtn) {
            snapToggleBtn.addEventListener('click', () => {
                updateState({ snapEnabled: !state.snapEnabled });
                UI.updateSnapDisplay();
            });
        }

        // Grid toggle button removed from UI
        // const gridToggleBtn = this.container.querySelector('#grid-toggle-btn');
        // if (gridToggleBtn) {
        //     gridToggleBtn.addEventListener('click', this.eventHandlers.onGridToggle);
        // }

        const unitToggleBtn = this.container.querySelector('#unit-toggle-btn');
        if (unitToggleBtn) {
            unitToggleBtn.addEventListener('click', () => {
                const newUnit = state.displayUnit === 'inches' ? 'mm' : 'inches';
                updateState({ displayUnit: newUnit });
                unitToggleBtn.textContent = newUnit.toUpperCase();

                // Refresh the SVG to update ruler labels
                designSVG.forceRefresh();

                // Update dimension displays
                this.updateDimensionsVisuals();
                UI.updateDimensionsDisplay();
            });
        }

        const xrayModeBtn = this.container.querySelector('#xray-mode-btn');
        if (xrayModeBtn) {
            xrayModeBtn.addEventListener('click', () => {
                updateState({ xrayMode: !state.xrayMode });
                // Apply X-ray mode to SVG
                designSVG.setXRayMode(state.xrayMode);
                xrayModeBtn.textContent = state.xrayMode ? 'X-RAY ON' : 'X-RAY OFF';
                xrayModeBtn.classList.toggle('active', state.xrayMode);
            });
        }

        const shadowModeBtn = this.container.querySelector('#shadow-mode-btn');
        if (shadowModeBtn) {
            shadowModeBtn.addEventListener('click', () => {
                updateState({ shadowMode: !state.shadowMode });
                // Apply shadow mode to SVG
                designSVG.setShadowMode(state.shadowMode);
                shadowModeBtn.textContent = state.shadowMode ? 'SHADOWS ON' : 'SHADOWS OFF';
                shadowModeBtn.classList.toggle('active', state.shadowMode);
            });
        }
    }

    // Layer management methods
    async addElement(type) {
        let definition = LAYER_DEFINITIONS[type];
        let isFieldElement = false;
        let fieldName = '';

        // Check if this is a dynamic field element
        if (type.startsWith('field:')) {
            fieldName = type.substring(6);
            isFieldElement = true;

            // Use paragraph-text as template for field elements
            definition = LAYER_DEFINITIONS['paragraph-text'];
            if (!definition) return;
        } else if (!definition) {
            return;
        }

        const elementId = getNextElementId();
        const existingCount = state.elementsList.filter(element =>
            isFieldElement ? element.fieldName === fieldName : element.type === type
        ).length;

        const newElement = {
            id: elementId,
            type: isFieldElement ? 'paragraph-text' : type,
            name: isFieldElement
                ? `${fieldName} Field${existingCount > 0 ? ` ${existingCount + 1}` : ''}`
                : `${definition.name} ${existingCount + 1}`,
            width: definition.width,
            height: definition.height,
            thickness: definition.thickness,
            material: definition.material,
            x: 63.5, // Store in mm (2.5 inches = 63.5mm)
            y: 63.5, // Store in mm (2.5 inches = 63.5mm)
            zIndex: state.elementsList.length,
            elementDepth: getNextDepthNumber(),
            onCanvas: false,
            showDimensions: false
        };

        // Add field-specific properties
        if (isFieldElement) {
            newElement.fieldName = fieldName;
            newElement.isFieldElement = true;

            // Try to fetch actual content from the current sign type
            let actualContent = null;
            if (state.currentSignType) {
                const signData = await this.fetchFirstSignDataForType(state.currentSignType);
                if (signData && signData[fieldName]) {
                    actualContent = signData[fieldName];
                }
            }

            // Set text with actual content or fallback to placeholder
            newElement.text = actualContent || `{{${fieldName}}}`;
        }

        // Add text properties if this is a text element
        if (definition.isText) {
            newElement.text = definition.defaultText || '';

            // Handle font with fallback for Braille elements
            if (definition.isBraille) {
                // Check if Braille.ttf is available, otherwise fall back to Arial
                const preferredFonts = ['Braille.ttf', 'Arial'];
                newElement.font = fontManager.getBestAvailableFont(preferredFonts, 'Arial');
            } else {
                newElement.font = definition.defaultFont || 'Arial';
            }

            // Calculate font size for braille to achieve 0.239" x-height
            if (definition.isBraille) {
                // Import dynamically to calculate font size
                import('./text-renderer.js')
                    .then(({ calculateFontSizeForXHeight }) => {
                        const calculatedSize = calculateFontSizeForXHeight(0.239, newElement.font);
                        newElement.fontSize = calculatedSize;
                        // Update the element if it's already been added
                        const elementIndex = state.elementsList.findIndex(
                            l => l.id === newElement.id
                        );
                        if (elementIndex !== -1) {
                            updateState({ isDirty: true });
                        }
                    })
                    .catch(() => {
                        // Fallback to default if calculation fails
                        newElement.fontSize = definition.defaultFontSize || 24;
                    });
                // Set initial size while calculating
                newElement.fontSize = definition.defaultFontSize || 24;
            } else {
                newElement.fontSize = definition.defaultFontSize || 24;
            }
            newElement.textAlign = definition.defaultTextAlign || 'center';
            newElement.verticalAlign = definition.defaultVerticalAlign || 'middle';
            newElement.lineSpacing = definition.defaultLineSpacing || 1.2;
            newElement.kerning = definition.defaultKerning || 0;
            newElement.textColor = definition.defaultTextColor || '#000000';

            // If this is a Braille element, set special properties
            if (definition.isBraille) {
                newElement.isBraille = true;
                newElement.brailleSourceText = definition.defaultBrailleSourceText || 'Sample Text';
                // For Braille, position it 0.4" below the first paragraph text element if it exists
                const paragraphTextElement = state.elementsList.find(
                    l => l.type === 'paragraph-text' && l.onCanvas
                );
                if (paragraphTextElement) {
                    // Positions are now in inches, so we can add directly
                    newElement.x = paragraphTextElement.x;
                    newElement.y = paragraphTextElement.y + paragraphTextElement.height + 0.4;
                }
            }
        }

        const newElementsList = [newElement, ...state.elementsList];
        updateState({ elementsList: newElementsList });
        UI.refreshElementList(this.eventHandlers);
    }

    deleteElement(elementId) {
        const elementIndex = state.elementsList.findIndex(l => l.id === elementId);
        if (elementIndex === -1) return;

        const newElementsList = state.elementsList.filter(l => l.id !== elementId);
        const newElementLinks = state.elementLinks.filter(
            link => link.from !== elementIndex && link.to !== elementIndex
        );

        updateState({
            elementsList: newElementsList,
            elementLinks: newElementLinks,
            currentElement: state.currentElement?.id === elementId ? null : state.currentElement
        });

        designSVG.removeLayer(elementId);
        designSVG.updateSelectionVisuals(); // Ensure handles are cleaned up
        UI.refreshElementList(this.eventHandlers);
        this.updateElementOrder();
        this.updateDimensionsVisuals();
    }

    updateElementOrder() {
        // Sort elements by elementDepth (lower depth = in front/on top)
        // Elements with same depth maintain their relative order
        const sortedElements = [...state.elementsList]
            .filter(e => e.onCanvas)
            .sort((a, b) => {
                const depthA = a.elementDepth || 1;
                const depthB = b.elementDepth || 1;

                // Higher depth values should be rendered first (behind)
                // Lower depth values should be rendered last (in front)
                if (depthA !== depthB) {
                    return depthB - depthA;
                }

                // If same depth, maintain current order from list
                return state.elementsList.indexOf(a) - state.elementsList.indexOf(b);
            });

        // Apply z-order to SVG layers by reordering in DOM
        if (designSVG && designSVG.viewport) {
            const viewportNode = designSVG.viewport.node;
            if (viewportNode) {
                sortedElements.forEach(element => {
                    const layerData = designSVG.layers.get(element.id);
                    if (layerData && layerData.group && layerData.group.node) {
                        // Re-append to parent moves it to the end (on top)
                        viewportNode.appendChild(layerData.group.node);
                    }
                });
            }
        }

        UI.updateStackVisualization();
    }

    addElementToCanvas(element, x, y) {
        // x and y are in world coordinates (mm)
        element.x = x;
        element.y = y;
        element.onCanvas = true;

        updateState({ elementsList: [...state.elementsList], isDirty: true });
        designSVG.createLayer(
            element,
            this.eventHandlers.onSelectElement,
            this.eventHandlers.onStartDrag
        );
        UI.refreshElementList(this.eventHandlers);
        UI.updateStackVisualization();
        this.updateDimensionsVisuals();
    }

    // startCanvasDrag method removed - dragging now handled directly in SVG system

    getSnapSize() {
        return state.snapUnit === 'mm' ? state.snapValue / 25.4 : state.snapValue;
    }

    reorderElementAtIndex(draggedId, insertIndex) {
        const draggedElement = state.elementsList.find(element => element.id === draggedId);
        if (!draggedElement) return;

        const currentIndex = state.elementsList.indexOf(draggedElement);
        const newElementsList = [...state.elementsList];
        newElementsList.splice(currentIndex, 1);

        const adjustedIndex = currentIndex < insertIndex ? insertIndex - 1 : insertIndex;
        newElementsList.splice(adjustedIndex, 0, draggedElement);

        // Clear all links because indices are now invalid
        updateState({
            elementsList: newElementsList,
            elementLinks: []
        });

        UI.refreshElementList(this.eventHandlers);
        this.updateElementOrder();
    }

    exportData() {
        // Get all templates from template manager
        const templates = {};
        if (this.templateManager) {
            this.templateManager.templates.forEach((template, code) => {
                templates[code] = template.toJSON();
            });
        }

        return {
            version: this.version,
            appState: {
                elementsList: state.elementsList,
                elementLinks: state.elementLinks,
                elementCounter: state.elementCounter,
                snapValue: state.snapValue,
                snapUnit: state.snapUnit,
                faceViewState: state.faceViewState,
                sideViewState: state.sideViewState,
                currentSignType: state.currentSignType
            },
            templates: templates,
            exported: new Date().toISOString()
        };
    }

    async importData(data) {
        if (!data || !data.appState) {
            console.log('🎨 No design data to import');
            return;
        }

        const appState = data.appState;
        updateState({
            elementsList: appState.elementsList || appState.layersList || [],
            elementLinks: appState.elementLinks || appState.layerLinks || [],
            elementCounter: appState.elementCounter || appState.layerCounter || 0,
            snapValue: appState.snapValue || 0.125,
            snapUnit: appState.snapUnit || 'inches',
            faceViewState: appState.faceViewState || { x: 0, y: 0, zoom: 1 },
            sideViewState: appState.sideViewState || { x: 0, y: 0, zoom: 1 },
            currentSignType: appState.currentSignType || null
        });

        // Import templates if available
        if (data.templates && this.templateManager) {
            this.templateManager.templates.clear();
            Object.entries(data.templates).forEach(([code, templateData]) => {
                try {
                    const { DesignTemplate } = DataModels;
                    const template = new DesignTemplate(templateData);
                    this.templateManager.templates.set(code, template);
                } catch (error) {
                    console.error(`Failed to import template ${code}:`, error);
                }
            });

            // Save templates to localStorage
            this.templateManager.saveTemplatesToStorage();
            console.log(`🎨 Imported ${Object.keys(data.templates).length} templates`);
        }

        // Refresh UI
        UI.refreshElementList(this.eventHandlers);
        UI.updateStackVisualization();
        designSVG.renderAllLayers();

        // Update sign type dropdown if needed
        if (this.syncAdapter) {
            this.syncAdapter.updateSignTypeUI();
        }

        console.log('🎨 Design data imported successfully');
    }

    async handleDataRequest(fromApp, query) {
        switch (query.type) {
            case 'get-elements':
                return { elements: state.elementsList };
            case 'get-design-specs':
                return {
                    elements: state.elementsList.map(element => ({
                        id: element.id,
                        type: element.type,
                        name: element.name,
                        width: element.width,
                        height: element.height,
                        thickness: element.thickness,
                        material: element.material
                    }))
                };
            case 'get-templates':
                // Return templates from template manager if available
                if (this.templateManager) {
                    const templates = [];
                    this.templateManager.templates.forEach((template, signTypeCode) => {
                        templates.push(template.toJSON());
                    });
                    // Removed debug log: Returning templates
                    return { templates };
                }
                // Fallback: return empty templates array
                // Removed debug log: No template manager, returning empty array
                return { templates: [] };
            case 'get-current-design': {
                // Return the current design state with full canvas data
                const canvasLayers = state.layersList.filter(layer => layer.onCanvas);
                if (canvasLayers.length === 0) {
                    return { design: null };
                }

                // Extract full canvas data using template manager
                if (this.templateManager) {
                    const canvasData = this.templateManager.extractCanvasData(state.layersList);
                    return {
                        design: {
                            id: 'current',
                            name: 'Current Design',
                            signTypeCode: state.currentSignType,
                            faceView: {
                                canvas: canvasData,
                                dimensions: canvasData.dimensions
                            },
                            width: canvasData.dimensions.width,
                            height: canvasData.dimensions.height,
                            backgroundColor: '#ffffff'
                        }
                    };
                }

                // Fallback
                return {
                    design: {
                        id: 'current',
                        name: 'Current Design',
                        layers: canvasLayers,
                        width: Math.max(...canvasLayers.map(l => l.width)),
                        height: Math.max(...canvasLayers.map(l => l.height)),
                        backgroundColor: '#ffffff'
                    }
                };
            }
            case 'get-design-for-sign-type': {
                // Return the saved template for a specific sign type
                const signTypeCode = query.signTypeCode;

                if (!signTypeCode) {
                    return { error: 'Sign type code required' };
                }

                // Ensure template manager has loaded from storage
                if (this.templateManager && this.templateManager.templates.size === 0) {
                    this.templateManager.loadTemplatesFromStorage();
                }

                // Check if we have the template in memory
                if (this.templateManager && this.templateManager.hasTemplate(signTypeCode)) {
                    const template = this.templateManager.getTemplate(signTypeCode);
                    const templateData = template.toJSON();

                    // Add enhanced field mappings for better Thumbnail Slayer integration
                    const enrichedTemplate = {
                        ...templateData,
                        fieldMappings: this.extractFieldMappings(template),
                        renderingInstructions: this.generateRenderingInstructions(template),
                        availableFields: this.getAvailableFieldsForSignType(signTypeCode)
                    };

                    return {
                        template: enrichedTemplate,
                        hasTemplate: true,
                        source: 'saved_template'
                    };
                }

                // If not in memory, check if we have a current design for this sign type
                if (
                    state.currentSignType === signTypeCode &&
                    state.elementsList &&
                    state.elementsList.some(l => l.onCanvas)
                ) {
                    // Create a template from current state
                    const canvasData = this.templateManager.extractCanvasData(state.elementsList);
                    const tempTemplate = {
                        id: `temp_${signTypeCode}`,
                        signTypeCode: signTypeCode,
                        name: `${signTypeCode} Template`,
                        faceView: {
                            canvas: canvasData,
                            dimensions: canvasData.dimensions,
                            textFields: this.templateManager.extractTextFields(canvasData),
                            graphics: this.templateManager.extractGraphics(canvasData),
                            backgroundColor: '#ffffff'
                        },
                        sideView: {
                            canvas: {
                                layers: [],
                                dimensions: { width: 2, height: canvasData.dimensions.height }
                            },
                            textFields: [],
                            graphics: []
                        },
                        width: canvasData.dimensions.width,
                        height: canvasData.dimensions.height,
                        backgroundColor: '#ffffff',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        fieldMappings: this.extractFieldMappingsFromCanvas(canvasData),
                        renderingInstructions:
                            this.generateRenderingInstructionsFromCanvas(canvasData),
                        availableFields: this.getAvailableFieldsForSignType(signTypeCode)
                    };

                    return {
                        template: tempTemplate,
                        hasTemplate: true,
                        source: 'current_design'
                    };
                }

                // No template found - return helpful information for fallback
                return {
                    template: null,
                    hasTemplate: false,
                    signTypeCode: signTypeCode,
                    availableFields: this.getAvailableFieldsForSignType(signTypeCode),
                    suggestion: `Create a template in Design Slayer for sign type: ${signTypeCode}`
                };
            }
            default:
                return { error: 'Unknown query type' };
        }
    }

    /**
     * Extract field mappings from a template for better Thumbnail Slayer integration
     */
    extractFieldMappings(template) {
        const mappings = {};

        if (template.faceView && template.faceView.textFields) {
            template.faceView.textFields.forEach(field => {
                mappings[field.fieldName] = {
                    position: field.position,
                    font: field.font,
                    size: field.size,
                    color: field.color,
                    align: field.textAlign,
                    layerType: field.layerType
                };
            });
        }

        return mappings;
    }

    /**
     * Extract field mappings from canvas data
     */
    extractFieldMappingsFromCanvas(canvasData) {
        const mappings = {};

        if (canvasData.layers) {
            canvasData.layers.forEach(layer => {
                if (layer.fieldName) {
                    mappings[layer.fieldName] = {
                        position: { x: layer.x, y: layer.y },
                        font: layer.font,
                        size: layer.fontSize,
                        color: layer.textColor,
                        align: layer.textAlign,
                        layerType: layer.type
                    };
                }
            });
        }

        return mappings;
    }

    /**
     * Generate rendering instructions for Thumbnail Slayer
     */
    generateRenderingInstructions(template) {
        const instructions = {
            dimensions: template.faceView?.canvas?.dimensions || { width: 12, height: 6 },
            backgroundColor: template.faceView?.backgroundColor || '#ffffff',
            elements: []
        };

        if (template.faceView && template.faceView.canvas && template.faceView.canvas.layers) {
            instructions.elements = template.faceView.canvas.layers.map(layer => ({
                type: layer.type,
                position: { x: layer.x, y: layer.y },
                size: { width: layer.width, height: layer.height },
                properties: this.extractLayerProperties(layer),
                zIndex: layer.zIndex || 0
            }));
        }

        return instructions;
    }

    /**
     * Generate rendering instructions from canvas data
     */
    generateRenderingInstructionsFromCanvas(canvasData) {
        const instructions = {
            dimensions: canvasData.dimensions || { width: 12, height: 6 },
            backgroundColor: '#ffffff',
            elements: []
        };

        if (canvasData.layers) {
            instructions.elements = canvasData.layers.map(layer => ({
                type: layer.type,
                position: { x: layer.x, y: layer.y },
                size: { width: layer.width, height: layer.height },
                properties: this.extractLayerProperties(layer),
                zIndex: layer.zIndex || 0
            }));
        }

        return instructions;
    }

    /**
     * Extract properties from a layer for rendering
     */
    extractLayerProperties(layer) {
        const properties = {
            // Preserve all color information for proper rendering
            color: layer.color || layer.backgroundColor,
            backgroundColor: layer.backgroundColor || layer.color,
            strokeColor: layer.strokeColor || '#000000'
        };

        // Common properties
        if (layer.color) properties.color = layer.color;
        if (layer.material) properties.material = layer.material;
        if (layer.thickness) properties.thickness = layer.thickness;

        // Text-specific properties with complete color preservation
        if (layer.type === 'paragraph-text' || layer.type === 'braille-text') {
            properties.text = layer.text;
            properties.fieldName = layer.fieldName;
            properties.fontSize = layer.fontSize || 16;
            // Preserve all text color variations for better compatibility
            properties.fontColor = layer.fontColor || layer.textColor || layer.color || '#ffffff';
            properties.textColor = layer.textColor || layer.fontColor || layer.color || '#ffffff';
            properties.color = layer.color || layer.textColor || layer.fontColor || '#ffffff';
            properties.fontFamily = layer.fontFamily || layer.font || 'Arial';
            properties.font = layer.font || layer.fontFamily || 'Arial';
            properties.textAlign = layer.textAlign || 'left';
            properties.verticalAlign = layer.verticalAlign || 'top';
            properties.lineSpacing = layer.lineSpacing || 1.2;
            properties.kerning = layer.kerning || 0;
            properties.fontWeight = layer.fontWeight || 'normal';

            if (layer.type === 'braille-text') {
                properties.isBraille = true;
                properties.brailleSourceText = layer.brailleSourceText;
            }
        }

        return properties;
    }

    /**
     * Get available fields for a sign type from Thumbnail Slayer data
     */
    getAvailableFieldsForSignType(signTypeCode) {
        // Try to get fields from sign type definition
        const signType = this.syncAdapter?.getSignType(signTypeCode);
        if (signType && signType.textFields) {
            return signType.textFields.map(field => ({
                name: field.fieldName,
                maxLength: field.maxLength || 50,
                type: 'text'
            }));
        }

        // Fallback to common fields
        return [
            { name: 'message', maxLength: 50, type: 'text' },
            { name: 'message1', maxLength: 50, type: 'text' },
            { name: 'message2', maxLength: 30, type: 'text' },
            { name: 'locationNumber', maxLength: 10, type: 'text' }
        ];
    }

    async setupSignTypes() {
        // Get sign types from Mapping Slayer
        await this.loadSignTypesFromMapping();

        // Listen for sign type events
        if (window.appBridge) {
            window.appBridge.on('sign-type:created', async data => {
                // Reload sign types when created elsewhere
                await this.loadSignTypesFromMapping();
            });

            window.appBridge.on('sign-type:updated', async data => {
                // Reload sign types when updated
                await this.loadSignTypesFromMapping();
            });

            window.appBridge.on('sign-type:deleted', async data => {
                // Reload sign types when deleted
                await this.loadSignTypesFromMapping();
            });
        }

        // Setup UI event handlers
        const signTypeSelect = this.container.querySelector('#sign-type-select');
        const createBtn = this.container.querySelector('#create-sign-type-btn');
        const newForm = this.container.querySelector('#new-sign-type-form');
        const saveBtn = this.container.querySelector('#save-sign-type-btn');
        const cancelBtn = this.container.querySelector('#cancel-sign-type-btn');
        const currentInfo = this.container.querySelector('#current-sign-type-info');

        // Handle sign type selection
        if (signTypeSelect) {
            signTypeSelect.addEventListener('change', e => {
                const selectedType = e.target.value;
                if (selectedType) {
                    updateState({ currentSignType: selectedType });
                    this.showCurrentSignType(selectedType);
                    newForm.style.display = 'none';
                }
            });
        }

        // Handle create new sign type
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                newForm.style.display = 'block';
                currentInfo.style.display = 'none';
                signTypeSelect.value = '';
            });
        }

        // Handle save new sign type
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const code = this.container.querySelector('#new-sign-type-code').value.trim();
                const name = this.container.querySelector('#new-sign-type-name').value.trim();

                if (code && name) {
                    await this.createSignType(code, name);
                    newForm.style.display = 'none';
                    this.container.querySelector('#new-sign-type-code').value = '';
                    this.container.querySelector('#new-sign-type-name').value = '';
                }
            });
        }

        // Handle cancel
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                newForm.style.display = 'none';
                this.container.querySelector('#new-sign-type-code').value = '';
                this.container.querySelector('#new-sign-type-name').value = '';
            });
        }
    }

    async loadSignTypesFromMapping() {
        if (!window.appBridge) return;

        try {
            const response = await window.appBridge.sendRequest('mapping_slayer', {
                type: 'get-sign-types'
            });

            if (response && response.signTypes) {
                const select = this.container.querySelector('#sign-type-select');
                if (select) {
                    // Clear existing options except the first
                    while (select.options.length > 1) {
                        select.remove(1);
                    }

                    // Add sign types
                    Object.entries(response.signTypes).forEach(([code, typeData]) => {
                        const option = document.createElement('option');
                        option.value = code;
                        option.textContent = `${code} - ${typeData.name}`;
                        select.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('Failed to load sign types:', error);
        }
    }

    showCurrentSignType(code) {
        const currentInfo = this.container.querySelector('#current-sign-type-info');
        const codeSpan = this.container.querySelector('#current-sign-type-code');
        const nameSpan = this.container.querySelector('#current-sign-type-name');

        if (currentInfo && window.appBridge) {
            window.appBridge
                .sendRequest('mapping_slayer', {
                    type: 'get-sign-type-details',
                    code: code
                })
                .then(response => {
                    if (response && response.signType) {
                        codeSpan.textContent = response.signType.code;
                        nameSpan.textContent = response.signType.name;
                        currentInfo.style.display = 'block';
                    }
                });
        }
    }

    async createSignType(code, name) {
        if (!window.appBridge) return;

        try {
            // Send to Mapping Slayer to create
            await window.appBridge.sendRequest('mapping_slayer', {
                type: 'create-sign-type',
                signType: {
                    code: code,
                    name: name,
                    color: '#F72020',
                    textColor: '#FFFFFF'
                }
            });

            // Reload sign types
            await this.loadSignTypesFromMapping();

            // Select the new sign type
            const select = this.container.querySelector('#sign-type-select');
            if (select) {
                select.value = code;
                updateState({ currentSignType: code });
                this.showCurrentSignType(code);
            }
        } catch (error) {
            console.error('Failed to create sign type:', error);
        }
    }

    async setupTemplates() {
        // Import template manager - keeping this for future use
        const { templateManager } = await import('./template-manager.js');
        this.templateManager = templateManager;

        // Log loaded templates from storage
        // Removed debug log: Templates loaded from storage

        // Template UI functionality is temporarily disabled
        // The infrastructure remains intact for future reactivation

        /* Commented out template UI event listeners
        // Save template button
        const saveTemplateBtn = document.getElementById('save-template-btn');
        if (saveTemplateBtn) {
            saveTemplateBtn.addEventListener('click', async () => {
                if (!state.currentSignType) {
                    alert('Please select a sign type first');
                    return;
                }

                if (state.layersList.filter(l => l.onCanvas).length === 0) {
                    alert('No layers on canvas to save as template');
                    return;
                }

                try {
                    const templateName = prompt('Enter template name:', `${state.currentSignType} Template`);
                    if (!templateName) return;

                    const template = await this.templateManager.saveAsTemplate(state.currentSignType, templateName);
                    console.log('Template saved:', template);
                    alert(`Template "${templateName}" saved successfully!`);
                } catch (error) {
                    console.error('Failed to save template:', error);
                    alert(`Failed to save template: ${error.message}`);
                }
            });
        }

        // Load template button
        const loadTemplateBtn = document.getElementById('load-template-btn');
        if (loadTemplateBtn) {
            loadTemplateBtn.addEventListener('click', async () => {
                if (!state.currentSignType) {
                    alert('Please select a sign type first');
                    return;
                }

                if (!this.templateManager.hasTemplate(state.currentSignType)) {
                    alert(`No template found for sign type ${state.currentSignType}`);
                    return;
                }

                if (state.layersList.length > 0) {
                    const confirmed = confirm('Loading a template will replace the current design. Continue?');
                    if (!confirmed) return;
                }

                try {
                    const success = await this.templateManager.loadTemplate(state.currentSignType);
                    if (success) {
                        // Re-register canvas layers with proper event handlers
                        state.layersList.forEach(layer => {
                            if (layer.onCanvas) {
                                designSVG.createLayer(
                                    layer,
                                    this.eventHandlers.onSelectLayer,
                                    this.eventHandlers.onStartDrag
                                );
                            }
                        });
                        UI.refreshElementList(this.eventHandlers);
                        this.updateElementOrder();
                        alert('Template loaded successfully!');
                    }
                } catch (error) {
                    console.error('Failed to load template:', error);
                    alert(`Failed to load template: ${error.message}`);
                }
            });
        }

        // Template library button
        const templateLibraryBtn = document.getElementById('template-library-btn');
        if (templateLibraryBtn) {
            templateLibraryBtn.addEventListener('click', () => {
                this.showTemplateLibrary();
            });
        }

        // Close template library button
        const closeTemplateLibraryBtn = document.getElementById('close-template-library-btn');
        if (closeTemplateLibraryBtn) {
            closeTemplateLibraryBtn.addEventListener('click', () => {
                document.getElementById('template-library-modal').style.display = 'none';
            });
        }
        */
    }

    // Template library display method - kept for future reactivation
    /* Commented out template library UI
    showTemplateLibrary() {
        const modal = document.getElementById('template-library-modal');
        const grid = document.getElementById('template-grid');

        if (!modal || !grid) return;

        // Clear grid
        grid.innerHTML = '';

        // Get all templates
        const templates = this.templateManager.listTemplates();

        if (templates.length === 0) {
            grid.innerHTML = '<div class="empty-state">No templates saved yet. Create your first template by designing a sign and clicking "Save Template".</div>';
        } else {
            templates.forEach(template => {
                const card = document.createElement('div');
                card.className = 'template-card';
                card.innerHTML = `
                    <div class="template-preview">
                        <div class="template-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <line x1="9" y1="9" x2="15" y2="9"/>
                                <line x1="9" y1="13" x2="15" y2="13"/>
                                <line x1="9" y1="17" x2="11" y2="17"/>
                            </svg>
                        </div>
                    </div>
                    <div class="template-info">
                        <h3>${template.name}</h3>
                        <p>Sign Type: ${template.code}</p>
                        <p>${template.layerCount} layers, ${template.textFieldCount} text fields</p>
                        <div class="template-actions">
                            <button class="btn btn-compact btn-primary" data-code="${template.code}">Load</button>
                            <button class="btn btn-compact btn-secondary" data-code="${template.code}" data-action="delete">Delete</button>
                        </div>
                    </div>
                `;

                // Add event listeners
                const loadBtn = card.querySelector('.btn-primary');
                loadBtn.addEventListener('click', async () => {
                    modal.style.display = 'none';

                    // Set the sign type first
                    const signTypeSelect = document.getElementById('sign-type-select');
                    if (signTypeSelect) {
                        signTypeSelect.value = template.code;
                        signTypeSelect.dispatchEvent(new Event('change'));
                    }

                    // Then load the template
                    setTimeout(async () => {
                        try {
                            await this.templateManager.loadTemplate(template.code);
                            // Re-register canvas layers
                            state.layersList.forEach(layer => {
                                if (layer.onCanvas) {
                                    designSVG.createLayer(
                                        layer,
                                        this.eventHandlers.onSelectLayer,
                                        this.eventHandlers.onStartDrag
                                    );
                                }
                            });
                            UI.refreshLayerList(this.eventHandlers);
                            this.updateLayerOrder();
                        } catch (error) {
                            console.error('Failed to load template:', error);
                            alert(`Failed to load template: ${error.message}`);
                        }
                    }, 100);
                });

                const deleteBtn = card.querySelector('[data-action="delete"]');
                deleteBtn.addEventListener('click', async () => {
                    if (confirm(`Delete template "${template.name}"?`)) {
                        await this.templateManager.deleteTemplate(template.code);
                        this.showTemplateLibrary(); // Refresh
                    }
                });

                grid.appendChild(card);
            });
        }

        modal.style.display = 'flex';
    }
    */

    setupAutoSave() {
        // Auto-save when layers change and a sign type is selected
        let saveTimeout = null;

        // Watch for state changes
        const originalUpdateState = window.updateState || updateState;
        window.updateState = updates => {
            originalUpdateState(updates);

            // Trigger auto-save if we have a sign type and canvas elements
            if (
                state.currentSignType &&
                state.elementsList &&
                state.elementsList.some(l => l.onCanvas)
            ) {
                // Debounce saves to avoid too frequent updates
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    this.autoSaveTemplate();
                }, 2000); // Save after 2 seconds of inactivity
            }
        };
    }

    async autoSaveTemplate() {
        // Removed debug log: autoSaveTemplate called

        if (!state.currentSignType || !this.templateManager) return;

        try {
            // Only save if we have canvas elements
            const canvasElements = state.elementsList.filter(l => l.onCanvas);
            if (canvasElements.length === 0) {
                // Removed debug log: No canvas elements to save
                return;
            }

            // Removed debug log: Canvas layers to save

            // Save the template silently
            const template = await this.templateManager.saveAsTemplate(
                state.currentSignType,
                `${state.currentSignType} Template`
            );

            console.log(`✅ Auto-saved template for ${state.currentSignType}`, {
                templateId: template.id,
                templatesInMemory: Array.from(this.templateManager.templates.keys()),
                templateData: template.toJSON()
            });

            // Broadcast template update to other apps
            if (window.appBridge) {
                // Removed debug log: Broadcasting template update to other apps
                window.appBridge.broadcast('template-updated', {
                    signTypeCode: state.currentSignType,
                    template: template.toJSON()
                });
            }
        } catch (error) {
            // Removed debug error: Auto-save failed!
        }
    }

    /**
     * Setup template export/import functionality
     * Note: Template export/import buttons removed from UI
     */
    setupTemplateExportImport() {
        // Template export/import functionality disabled - buttons removed from UI
        return;
        /*
        // Export template button
        const exportTemplateBtn = document.getElementById('export-template-btn');
        if (exportTemplateBtn) {
            exportTemplateBtn.addEventListener('click', async () => {
                if (!state.currentSignType) {
                    alert('Please select a sign type first');
                    return;
                }

                if (state.layersList.filter(l => l.onCanvas).length === 0) {
                    alert('No layers on canvas to export');
                    return;
                }

                try {
                    // Create template data
                    const template = await this.templateManager.saveAsTemplate(state.currentSignType);

                    // Export as .dslayer file
                    const exportData = {
                        version: '1.0',
                        type: 'design_template',
                        meta: {
                            exported: new Date().toISOString(),
                            signTypeCode: state.currentSignType
                        },
                        template: template.toJSON()
                    };

                    const jsonStr = JSON.stringify(exportData, null, 2);
                    const blob = new Blob([jsonStr], { type: 'application/json' });

                    // Generate filename
                    const filename = `${state.currentSignType}_template.dslayer`;

                    // Download file
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    console.log(`✅ Template exported as ${filename}`);
                } catch (error) {
                    console.error('Failed to export template:', error);
                    alert(`Failed to export template: ${error.message}`);
                }
            });
        }

        // Import template button
        const importTemplateBtn = document.getElementById('import-template-btn');
        if (importTemplateBtn) {
            importTemplateBtn.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.dslayer,.slayer';

                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    try {
                        // Read file content
                        const content = await this.readFile(file);
                        const data = JSON.parse(content);

                        // Check if it's a template file
                        if (data.type === 'design_template' && data.template) {
                            // Import the template
                            const template = new (await import('../../core/index.js')).DataModels.DesignTemplate(data.template);

                            // Get or create sign type
                            const signTypeCode = data.meta.signTypeCode || template.signTypeCode;

                            if (!signTypeCode) {
                                alert('Invalid template file: no sign type specified');
                                return;
                            }

                            // Check if sign type exists
                            let signType = this.syncAdapter.getSignType(signTypeCode);
                            if (!signType) {
                                // Create sign type
                                const name = prompt(`Sign type "${signTypeCode}" not found. Enter a name for it:`, signTypeCode);
                                if (!name) return;

                                await this.syncAdapter.createSignType(signTypeCode, name);
                            }

                            // Store template
                            this.templateManager.templates.set(signTypeCode, template);
                            this.templateManager.saveTemplatesToStorage();

                            // Select sign type and load template
                            const signTypeSelect = document.getElementById('sign-type-select');
                            if (signTypeSelect) {
                                signTypeSelect.value = signTypeCode;
                                signTypeSelect.dispatchEvent(new Event('change'));
                            }

                            // Load the template
                            await this.templateManager.loadTemplate(signTypeCode);

                            // Refresh UI
                            UI.refreshElementList(this.eventHandlers);
                            designSVG.renderAllLayers();

                            alert('Template imported successfully!');
                        }
                        // Check if it's a project file with templates - support both format types
                        else if ((data.type === 'slayer_project' || data.type === 'slayer_suite_project') && data.apps?.design_slayer?.templates) {
                            // Show template selection dialog
                            const templates = Object.entries(data.apps.design_slayer.templates);
                            if (templates.length === 0) {
                                alert('No templates found in this project file');
                                return;
                            }

                            // For simplicity, import all templates
                            let imported = 0;
                            for (const [code, templateData] of templates) {
                                try {
                                    const template = new (await import('../../core/index.js')).DataModels.DesignTemplate(templateData);
                                    this.templateManager.templates.set(code, template);
                                    imported++;
                                } catch (err) {
                                    console.error(`Failed to import template ${code}:`, err);
                                }
                            }

                            this.templateManager.saveTemplatesToStorage();
                            alert(`Imported ${imported} template${imported !== 1 ? 's' : ''} from project file`);
                        } else {
                            alert('Invalid file format. Please select a .dslayer template file or .slayer project file.');
                        }
                    } catch (error) {
                        console.error('Failed to import template:', error);
                        alert(`Failed to import template: ${error.message}`);
                    }
                };

                input.click();
            });
        }
        */
    }

    /**
     * Read file content
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    async loadTemplateForSignType(signTypeCode) {
        if (!this.templateManager || !this.templateManager.hasTemplate(signTypeCode)) {
            return;
        }

        try {
            // Clear current canvas
            state.layersList.forEach(layer => {
                if (layer.onCanvas) {
                    designSVG.removeLayer(layer.id);
                }
            });

            // Load the template
            const success = await this.templateManager.loadTemplate(signTypeCode);
            if (success) {
                // Re-create canvas layers with event handlers
                state.layersList.forEach(layer => {
                    if (layer.onCanvas) {
                        designSVG.createLayer(
                            layer,
                            this.eventHandlers.onSelectLayer,
                            this.eventHandlers.onStartDrag
                        );
                    }
                });

                UI.refreshElementList(this.eventHandlers);
                this.updateElementOrder();
                console.log(`✅ Loaded template for ${signTypeCode}`);
            }
        } catch (error) {
            console.error('Failed to load template:', error);
        }
    }

    /**
     * Fetch available fields from Thumbnail Slayer
     * @returns {Promise<Array>} Array of available field objects
     */
    async fetchAvailableFields() {
        try {
            if (!window.appBridge) {
                console.warn('App bridge not available - cannot fetch fields');
                return [];
            }

            // Check if Thumbnail Slayer is registered
            const registeredApps = window.appBridge.getRegisteredApps();
            if (!registeredApps.includes('thumbnail_slayer')) {
                console.log('Thumbnail Slayer not yet registered - will retry later');
                return [];
            }

            const response = await window.appBridge.sendRequest('thumbnail_slayer', {
                type: 'get-available-fields'
            });

            if (response && response.fields) {
                console.log('🔧 Fetched available fields from Thumbnail Slayer:', response.fields);
                return response.fields;
            }
        } catch (error) {
            console.error('Failed to fetch available fields:', error);
        }

        return [];
    }

    /**
     * Fetch first sign data for a specific sign type from Thumbnail Slayer
     * @param {string} signTypeCode - Sign type code to fetch data for
     * @returns {Promise<object|null>} First sign data or null if not found
     */
    async fetchFirstSignDataForType(signTypeCode) {
        try {
            if (!window.appBridge || !signTypeCode) {
                console.warn('App bridge not available or no sign type provided');
                return null;
            }

            const response = await window.appBridge.sendRequest('thumbnail_slayer', {
                type: 'get-first-sign-for-type',
                signTypeCode: signTypeCode
            });

            if (response && response.signData) {
                console.log(
                    `🔧 Fetched first sign data for type ${signTypeCode}:`,
                    response.signData
                );
                return response.signData;
            }
        } catch (error) {
            console.error(`Failed to fetch first sign data for type ${signTypeCode}:`, error);
        }

        return null;
    }

    /**
     * Refresh field element placeholders with actual content from current sign type
     */
    async refreshFieldElementPlaceholders() {
        if (!state.currentSignType) return;

        const signData = await this.fetchFirstSignDataForType(state.currentSignType);
        if (!signData) return;

        let updated = false;
        state.elementsList.forEach(element => {
            if (element.isFieldElement && element.fieldName) {
                const actualContent = signData[element.fieldName];
                if (actualContent) {
                    // Update text with actual content
                    element.text = actualContent;
                    updated = true;

                    // Update canvas element if it's on canvas
                    if (element.onCanvas) {
                        designSVG.updateElement(element);
                    }
                } else {
                    // Fallback to placeholder if no actual content
                    element.text = `{{${element.fieldName}}}`;
                    if (element.onCanvas) {
                        designSVG.updateElement(element);
                    }
                }
            }
        });

        if (updated) {
            updateState({ elementsList: [...state.elementsList] });
            UI.refreshElementList(this.eventHandlers);
            console.log(`🔧 Refreshed field placeholders for sign type ${state.currentSignType}`);
        }
    }

    /**
     * Update the element dropdown to include dynamic fields from Thumbnail Slayer
     */
    async updateElementDropdownWithFields() {
        const elementTypeSelect = document.getElementById('element-type-select');
        if (!elementTypeSelect) return;

        // Get available fields
        const fields = await this.fetchAvailableFields();

        // Get current selection to preserve it
        const currentValue = elementTypeSelect.value;

        // Build the new options HTML
        let optionsHTML = `
            <option value="">Select Element Type</option>
            <option value="plate">Plate</option>
            <option value="paragraph-text">Paragraph Text</option>
            <option value="braille-text">Braille Text</option>
            <option value="logo">Logo</option>
            <option value="icon">Icon</option>
        `;

        // Add dynamic fields section if we have any
        if (fields.length > 0) {
            optionsHTML += '<optgroup label="── Dynamic Fields ──">';
            fields.forEach(field => {
                optionsHTML += `<option value="field:${field.id}">${field.displayName} Field</option>`;
            });
            optionsHTML += '</optgroup>';
        }

        // Update the dropdown
        elementTypeSelect.innerHTML = optionsHTML;

        // Restore selection if it's still valid
        if (currentValue && elementTypeSelect.querySelector(`option[value="${currentValue}"]`)) {
            elementTypeSelect.value = currentValue;
        }

        console.log(`🔧 Updated element dropdown with ${fields.length} dynamic fields`);
    }
}

export default DesignSlayerApp;

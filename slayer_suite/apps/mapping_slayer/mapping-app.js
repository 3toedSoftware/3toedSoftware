// apps/mapping_slayer/mapping-app.js
import SlayerAppBase from '../../core/slayer-app-base.js';
import { ProjectIO } from './project-io.js';
import { renderPDFPage, applyMapTransform, renderDotsForCurrentPage, updateSingleDot, setupMapInteraction, centerOnDot } from './map-controller.js';
import { 
    setupCanvasEventListeners,
    addMarkerTypeEventListener,
    addPageNavigationEventListeners,
    addViewToggleEventListeners,
    addButtonEventListeners,
    setupModalEventListeners
} from './ui.js';

class MappingSlayerApp extends SlayerAppBase {
    constructor() {
        super('mapping_slayer', 'MAPPING SLAYER', '5.0.0');
        this.stateModule = null;
        this.appState = null;
        this.cssLoaded = false;
    }

    async activate() {
        // Load CSS if not already loaded
        if (!this.cssLoaded && this.isSuiteMode) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = './apps/mapping_slayer/mapping-slayer.css';
            link.id = 'mapping-slayer-css';
            document.head.appendChild(link);
            this.cssLoaded = true;
        }
        
        // Call parent activate
        await super.activate();
        
        // Add modals to body when activating (they get removed on deactivate)
        this.addModalsToBody();
        
        // Reattach event listeners to the newly created modals
        if (this.uiModule && this.uiModule.setupModalEventListeners) {
            this.uiModule.setupModalEventListeners();
        }
    }

    async deactivate() {
        // Remove CSS when deactivating
        if (this.cssLoaded && this.isSuiteMode) {
            const link = document.getElementById('mapping-slayer-css');
            if (link) {
                link.remove();
                this.cssLoaded = false;
            }
        }
        
        // Clean up modals when deactivating
        const modalIds = [
            'mapping-slayer-edit-modal',
            'mapping-slayer-group-edit-modal',
            'mapping-slayer-renumber-modal',
            'mapping-slayer-automap-progress-modal',
            'mapping-slayer-pdf-export-modal',
            'mapping-slayer-character-warning-modal',
            'mapping-slayer-controls-modal'
        ];
        
        modalIds.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.remove();
            }
        });
        
        // Call parent deactivate
        await super.deactivate();
    }

    createAppContent() {
        const contentArea = this.getContentArea();
        
        contentArea.innerHTML = `
            <div class="app-container">
                <!-- Left Panel -->
                <div class="left-panel">
                    <div class="panel-section filter-section">
                        <div class="panel-header">
                            <span>MARKER TYPES</span>
                            <button class="btn btn-small btn-primary" id="add-marker-type-btn">+</button>
                        </div>
                        <div class="panel-content">
                            <div class="filter-checkboxes" id="filter-checkboxes"></div>
                        </div>
                    </div>

                    <div class="panel-section list-section">
                        <div class="panel-header">
                            <span>LIST</span>
                            <div id="list-header-controls">
                                <button class="btn btn-secondary btn-compact" id="sort-toggle-btn">BY LOC</button>
                                <button class="btn btn-secondary btn-compact" id="toggle-view-btn">UNGROUPED</button>
                                <div class="all-pages-container">
                                    <input type="checkbox" id="all-pages-checkbox">
                                    <label for="all-pages-checkbox">All Pages</label>
                                </div>
                            </div>
                        </div>
                        <div class="panel-content" id="list-content">
                            <div class="empty-state" id="empty-state">
                                Click on the map to add your first location dot.
                            </div>
                            <div id="list-with-renumber" style="display: none; height: 100%;">
                                <div id="location-list"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Map Section -->
                <div class="map-section">
                    <div class="map-overlay-controls-top-left">
                        <div class="find-replace-container">
                            <div class="find-replace-inputs">
                                <button class="btn find-all-btn" id="find-all-btn">FIND ALL</button>
                                <input type="text" class="find-input" placeholder="FIND" id="find-input">
                                <input type="text" class="replace-input" placeholder="REPLACE" id="replace-input">
                                <button class="btn replace-btn" id="replace-btn">REPLACE</button>
                            </div>
                            <div class="replace-status" id="replace-status"></div>
                            <span id="find-count" style="display: none;"></span>
                        </div>
                        <button class="btn btn-secondary btn-compact btn-uniform-width" id="help-btn">HELP</button>
                        <button class="btn btn-secondary btn-compact btn-uniform-width" id="toggle-messages-btn">SHOW MSG</button>
                        <button class="btn btn-secondary btn-compact btn-uniform-width" id="toggle-messages2-btn">SHOW MSG2</button>
                        <button class="btn btn-secondary btn-compact btn-uniform-width" id="toggle-locations-btn">SHOW LOC</button>
                        <button class="btn btn-secondary btn-compact btn-uniform-width" id="renumber-btn">RENUMBER</button>
                    </div>
                    
                    <div class="legends-container">
                        <div class="legend-box" id="project-legend">
                            <div class="map-legend-header">
                                <span>PROJECT LEGEND</span>
                                <span class="legend-collapse-arrow">▼</span>
                            </div>
                            <div class="map-legend-content" id="project-legend-content"></div>
                        </div>
                        <div class="legend-box" id="map-legend">
                            <div class="map-legend-header">
                                <span>PAGE LEGEND</span>
                                <span class="legend-collapse-arrow">▼</span>
                            </div>
                            <div class="map-legend-content" id="map-legend-content"></div>
                        </div>
                    </div>

                    <div class="map-overlay-controls">
                        <div class="page-nav">
                            <button class="nav-btn" id="prev-page">&lt;</button>
                            <input type="text" id="page-label-input" placeholder="Enter Page Label" class="page-label-input">
                            <span id="page-info">PAGE 1 OF 1</span>
                            <button class="nav-btn" id="next-page">&gt;</button>
                        </div>
                    </div>
                    
                    <div class="map-container" id="map-container">
                         <div class="upload-area" id="upload-area">
                            <div>📄 Upload PDF or .mslay File</div>
                            <div style="margin-top: 10px; font-size: 14px;">Click to browse or drag and drop</div>
                            <div class="upload-area-note">For Automap & Scrape functions, please use a PDF with live text.</div>
                            <input type="file" id="file-input" accept=".pdf,.mslay" style="display: none;">
                        </div>

                        <div id="scrape-controls" class="scrape-controls">
                            <div class="tolerance-controls">
                                <div class="tolerance-input-group">
                                    <label for="h-tolerance-input">H:</label>
                                    <input type="number" id="h-tolerance-input" class="tolerance-input" min="0.1" max="100" step="0.1" value="1.0">
                                </div>
                                <div class="tolerance-input-group">
                                    <label for="v-tolerance-input">V:</label>
                                    <input type="number" id="v-tolerance-input" class="tolerance-input" min="0.1" max="100" step="0.1" value="25.0">
                                </div>
                                <div class="tolerance-input-group">
                                    <label for="dot-size-slider">DOT SIZE:</label>
                                    <input type="range" class="size-slider" id="dot-size-slider" min="0.5" max="3" step="0.1" value="1">
                                </div>
                            </div>
                        </div>
                        
                        <div id="map-content">
                            <canvas id="pdf-canvas"></canvas>
                        </div>
                    </div>
                </div>
                
                <!-- CSV Status -->
                <div id="csv-status" class="csv-status">
                    <div id="csv-status-content"></div>
                </div>

                <!-- Footer Controls -->
                <div class="footer-controls">
                    <div class="automap-container" id="single-automap-container">
                        <select class="form-input automap-select" id="automap-marker-type-select" disabled=""></select>
                        <input type="text" class="form-input automap-input" id="automap-text-input" placeholder="Enter text to find..." list="recent-searches-datalist" disabled="">
                        <datalist id="recent-searches-datalist"></datalist>
                        <div class="automap-checkbox-group">
                            <input type="checkbox" id="automap-exact-phrase" checked="">
                            <label for="automap-exact-phrase">Exact Phrase</label>
                        </div>
                        <button class="btn btn-success" id="single-automap-btn" disabled="">AUTOMAP IT!</button>
                        <span class="automap-status" id="automap-status"></span>
                    </div>
                    
                    <div class="control-group">                
                        <button class="btn btn-primary btn-compact" id="create-pdf-btn" disabled="">CREATE PDF</button>
                        <button class="btn btn-primary btn-compact" id="create-schedule-btn" disabled="">CREATE MESSAGE SCHEDULE</button>
                        <button class="btn btn-primary btn-compact" id="update-from-schedule-btn" disabled="">UPDATE FROM MESSAGE SCHEDULE</button>
                        <button class="btn btn-primary btn-compact" id="export-fdf-btn" disabled="">EXPORT REVU MARKUPS (BETA)</button>
                    </div>
                </div>
            </div>
        `;

        // Add modals to body level (not inside app container)
        this.addModalsToBody();

        // Initialize mapping functionality after DOM is ready
        setTimeout(() => this.initializeMappingFunctionality(), 0);
    }

    addModalsToBody() {
        // Check if modals already exist to avoid duplicates
        if (document.getElementById('mapping-slayer-edit-modal')) return;

        const modalsHTML = `
            <!-- Edit Modal -->
            <div class="modal" id="mapping-slayer-edit-modal">
                <div class="modal-content">
                    <div class="modal-header-grid">
                        <div class="modal-header-main">
                            <h3 class="modal-title">Edit Location</h3>
                        </div>
                        <div class="modal-header-checkboxes">
                            <div class="form-group-inline">
                                <label for="edit-code-required">Code Required</label>
                                <input type="checkbox" id="edit-code-required">
                            </div>
                            <div class="form-group-inline">
                                <label for="edit-vinyl-backer">Vinyl Backer</label>
                                <input type="checkbox" id="edit-vinyl-backer">
                            </div>
                            <div class="form-group-inline">
                                <label for="edit-installed">Installed</label>
                                <input type="checkbox" id="edit-installed">
                            </div>
                        </div>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label">Marker Type</label>
                            <select class="form-input" id="edit-marker-type"></select>
                        </div>
                        <div class="form-group" id="edit-location-group">
                            <label class="form-label">Location Number</label>
                            <input type="text" class="form-input" id="edit-location-number" placeholder="Enter location number">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Message</label>
                            <input type="text" class="form-input" id="edit-message" placeholder="Enter message">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Message 2</label>
                            <input type="text" class="form-input" id="edit-message2" placeholder="Enter second message">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Notes</label>
                            <textarea class="form-input form-textarea" id="edit-notes" placeholder="Enter notes..."></textarea>
                        </div>
                    </div>
                    <div class="modal-buttons">
                        <button class="btn btn-danger" id="delete-dot-btn">DELETE</button>
                        <button class="btn btn-secondary" id="cancel-modal-btn">CANCEL</button>
                        <button class="btn btn-primary" id="update-dot-btn">UPDATE</button>
                    </div>
                </div>
            </div>

            <!-- Group Edit Modal -->
            <div class="modal" id="mapping-slayer-group-edit-modal">
                <div class="modal-content">
                    <div class="modal-header-grid">
                        <div class="modal-header-main">
                            <h3 class="modal-title">Edit Multiple Locations</h3>
                            <div class="modal-subheader">(<span id="mapping-slayer-group-edit-count">0</span> selected)</div>
                        </div>
                        <div class="modal-header-checkboxes">
                            <div class="form-group-inline">
                                <label for="group-edit-code-required">Code Required</label>
                                <input type="checkbox" id="group-edit-code-required">
                            </div>
                            <div class="form-group-inline">
                                <label for="group-edit-vinyl-backer">Vinyl Backer</label>
                                <input type="checkbox" id="group-edit-vinyl-backer">
                            </div>
                            <div class="form-group-inline">
                                <label for="group-edit-installed">Installed</label>
                                <input type="checkbox" id="group-edit-installed">
                            </div>
                        </div>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label class="form-label">Marker Type</label>
                            <select class="form-input" id="group-edit-marker-type">
                                <option value="">-- Keep Individual Types --</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Message</label>
                            <input type="text" class="form-input" id="group-edit-message" placeholder="Leave blank to keep existing messages">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Message 2</label>
                            <input type="text" class="form-input" id="group-edit-message2" placeholder="Leave blank to keep existing messages">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Notes</label>
                            <textarea class="form-input form-textarea" id="group-edit-notes" placeholder="Enter notes to overwrite all selected locations..."></textarea>
                        </div>
                    </div>
                    <div class="modal-buttons">
                        <button class="btn btn-danger" id="group-delete-btn">DELETE ALL</button>
                        <button class="btn btn-secondary" id="group-cancel-btn">CANCEL</button>
                        <button class="btn btn-primary" id="group-update-btn">UPDATE ALL</button>
                    </div>
                </div>
            </div>
            
            <!-- Renumber Modal -->
            <div class="modal" id="mapping-slayer-renumber-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <span>Renumber Options</span>
                    </div>
                    <div class="modal-body">
                        <p class="modal-text">Choose how you want to renumber the locations:</p>
                        <div class="renumber-options">
                            <button class="btn btn-primary renumber-option-btn" onclick="performRenumber('page')">
                                <strong>Current Page Only</strong><br>
                                <small>Renumber dots on this page by position (top to bottom, left to right)</small>
                            </button>
                            <button class="btn btn-primary renumber-option-btn" onclick="performRenumber('page-by-type')">
                                <strong>Current Page by Marker Type</strong><br>
                                <small>Renumber each marker type separately on this page</small>
                            </button>
                            <button class="btn btn-primary renumber-option-btn" onclick="performRenumber('all')">
                                <strong>All Pages</strong><br>
                                <small>Renumber all dots across all pages continuously</small>
                            </button>
                            <button class="btn btn-primary renumber-option-btn" onclick="performRenumber('all-by-type')">
                                <strong>All Pages by Marker Type</strong><br>
                                <small>Renumber each marker type separately across all pages</small>
                            </button>
                        </div>
                    </div>
                    <div class="modal-buttons">
                        <button class="btn btn-secondary" id="cancel-renumber-btn">CANCEL</button>
                    </div>
                </div>
            </div>
            
            <!-- Automap Progress Modal -->
            <div class="automap-progress-modal" id="mapping-slayer-automap-progress-modal">
                <div class="automap-progress-content">
                    <div class="automap-progress-header">Auto-Mapping in Progress</div>
                    <div id="mapping-slayer-automap-main-status">Initializing...</div>
                    <div class="automap-progress-bar">
                        <div class="automap-progress-fill" id="mapping-slayer-automap-progress-fill"></div>
                    </div>
                    <div class="automap-activity-feed" id="mapping-slayer-automap-activity-feed"></div>
                    <div class="automap-results" id="mapping-slayer-automap-results"></div>
                    <div class="automap-buttons">
                        <button class="btn btn-secondary" id="cancel-automap-btn">CANCEL</button>
                        <button class="btn btn-primary" id="close-automap-btn" style="display: none;">CLOSE</button>
                    </div>
                </div>
            </div>
            
            <!-- PDF Export Modal -->
            <div id="mapping-slayer-pdf-export-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <span>PDF Export Options</span>
                    </div>
                    <div class="modal-body">
                        <p class="modal-text">Choose your PDF export format:</p>
                        <div class="pdf-export-options">
                            <button class="btn btn-primary pdf-export-option-btn" onclick="performPDFExport('current-with-details')">
                                <strong>Current Map - With Detail Pages</strong><br>
                                <small>This map + clickable detail pages for each location</small>
                            </button>
                            <button class="btn btn-primary pdf-export-option-btn" onclick="performPDFExport('current-only')">
                                <strong>Current Map Only</strong><br>
                                <small>Just this map page with location dots</small>
                            </button>
                            <button class="btn btn-primary pdf-export-option-btn" onclick="performPDFExport('all-maps-only')">
                                <strong>All Maps Only</strong><br>
                                <small>All map pages with dots (no detail pages)</small>
                            </button>
                        </div>
                    </div>
                    <div class="modal-buttons">
                        <button class="btn btn-secondary" id="cancel-pdf-export-btn">CANCEL</button>
                    </div>
                </div>
            </div>
            
            <!-- Character Warning Modal -->
            <div id="mapping-slayer-character-warning-modal" class="modal">
                <div class="modal-content">
                    <h2>⚠️ Character Compatibility Warning</h2>
                    <p>The following characters will be replaced for Bluebeam compatibility:</p>
                    <div id="mapping-slayer-character-changes-preview"></div>
                    <p class="affected-count">This affects <span id="mapping-slayer-affected-locations-count">0</span> location(s).</p>
                    <p>A log file will be created with all changes. Do you want to proceed?</p>
                    <div class="button-row">
                        <button class="btn btn-primary" id="proceed-character-changes-btn">Proceed with Export</button>
                        <button class="btn btn-secondary" id="cancel-character-changes-btn">Cancel</button>
                    </div>
                </div>
            </div>
            
            <!-- Hidden file inputs -->
            <input type="file" id="update-csv-input" accept=".csv" style="display: none;">
            
            <!-- Controls Modal -->
            <div id="mapping-slayer-controls-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <span>Controls</span>
                    </div>
                    <ul class="controls-list-modal">
                        <li><strong>Pan:</strong> Middle-click + drag</li>
                        <li><strong>Zoom:</strong> Scroll wheel</li>
                        <li><strong>Add Dot:</strong> Click on map</li>
                        <li><strong>Edit Dot:</strong> Right-click on dot</li>
                        <li><strong>Select Multiple:</strong> Shift + Left-drag</li>
                        <li><strong>Scrape Live Text:</strong> Shift + Right-drag</li>
                        <li><strong>OCR Scrape:</strong> Ctrl + Shift + Right-drag</li>
                        <li><strong>Delete Selected:</strong> Delete key</li>
                        <li><strong>Copy Dot:</strong> Ctrl/Cmd + C</li>
                        <li><strong>Paste at Cursor:</strong> Ctrl/Cmd + V</li>
                        <li><strong>Undo/Redo:</strong> Ctrl/Cmd + Z / Ctrl/Cmd + Y</li>
                        <li><strong>Change Page:</strong> Page Up / Page Down</li>
                        <li><strong>Change Marker Type:</strong> Up / Down Arrows</li>
                        <li><strong>Clear Selection:</strong> Escape</li>
                    </ul>
                    <div class="modal-buttons">
                        <button class="btn btn-secondary btn-compact" id="tooltips-btn">TOOL TIPS</button>
                        <button class="btn btn-secondary btn-compact" id="guide-btn">FULL GUIDE</button>
                        <button class="btn btn-primary" id="close-controls-modal-btn">CLOSE</button>
                    </div>
                </div>
            </div>
        `;

        // Append modals to document body for proper z-index stacking
        document.body.insertAdjacentHTML('beforeend', modalsHTML);
    }

    async initializeMappingFunctionality() {
        console.log('🗺️ Loading Mapping Slayer state system...');
        
        this.stateModule = await import('./state.js');
        this.appState = this.stateModule.appState;
        
        // Initialize UndoManager
        this.stateModule.initializeUndoManager();
        
        this.initializeDefaultMarkerTypes();
        this.uiModule = await import('./ui.js');
        
        // Initialize TooltipManager
        const { TooltipManager } = await import('./tooltips.js');
        this.tooltipManager = TooltipManager;
        this.tooltipManager.init();
        
        this.setupAllEventListeners();
        
        console.log('✅ Mapping Slayer functionality initialized');
    }

    initializeDefaultMarkerTypes() {
        this.stateModule.DEFAULT_MARKER_TYPES.forEach(markerType => {
            this.appState.markerTypes[markerType.code] = { 
                code: markerType.code,
                name: markerType.name,
                color: markerType.color, 
                textColor: markerType.textColor,
                designReference: null 
            };
        });
        
        const firstMarkerType = Object.keys(this.appState.markerTypes)[0];
        this.appState.activeMarkerType = firstMarkerType || null;
    }

    setupAllEventListeners() {
        this.setupBasicEventListeners();
        addMarkerTypeEventListener();
        addPageNavigationEventListeners();
        addViewToggleEventListeners();
        addButtonEventListeners();
        setupModalEventListeners();
        
        setTimeout(async () => {
            this.updateFilterCheckboxes();
            this.updateLocationList();
            this.updateAutomapSelect();
            this.enableButtons();
            
            // Initialize tolerance inputs
            const { updateToleranceInputs } = await import('./scrape.js');
            updateToleranceInputs();
        }, 100);
    }

    setupBasicEventListeners() {
        const helpBtn = this.container.querySelector('#help-btn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                const controlsModal = this.container.querySelector('#mapping-slayer-controls-modal');
                if (controlsModal) {
                    controlsModal.style.display = 'block';
                }
            });
        }
        
        // Controls modal close button
        const closeControlsModalBtn = this.container.querySelector('#close-controls-modal-btn');
        if (closeControlsModalBtn) {
            closeControlsModalBtn.addEventListener('click', () => {
                const controlsModal = this.container.querySelector('#mapping-slayer-controls-modal');
                if (controlsModal) {
                    controlsModal.style.display = 'none';
                }
            });
        }
        
        // Tooltips button
        const tooltipsBtn = this.container.querySelector('#tooltips-btn');
        if (tooltipsBtn) {
            tooltipsBtn.addEventListener('click', () => {
                if (this.tooltipManager) {
                    this.tooltipManager.toggle();
                }
            });
        }
        
        // Full Guide button
        const guideBtn = this.container.querySelector('#guide-btn');
        if (guideBtn) {
            guideBtn.addEventListener('click', () => {
                window.open('/apps/mapping_slayer/ms_user_guide.html', '_blank');
            });
        }

        const uploadArea = this.container.querySelector('#upload-area');
        const fileInput = this.container.querySelector('#file-input');
        if (uploadArea && fileInput) {
            uploadArea.addEventListener('click', () => fileInput.click());
            
            const handleFileChange = async (e) => {
                const file = e.target.files[0];
                if (file) {
                    console.log('📄 File selected:', file.name);
                    await this.loadFile(file);
                }
            };
            fileInput.addEventListener('change', handleFileChange);
            
            // Add drag and drop support
            uploadArea.addEventListener('dragover', (e) => { 
                e.preventDefault(); 
                e.currentTarget.classList.add('dragover'); 
            });
            
            uploadArea.addEventListener('dragleave', (e) => { 
                e.preventDefault(); 
                e.currentTarget.classList.remove('dragover'); 
            });
            
            uploadArea.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file) {
                    console.log('📄 File dropped:', file.name);
                    await this.loadFile(file);
                }
            });
        }

        const dotSizeSlider = this.container.querySelector('#dot-size-slider');
        if (dotSizeSlider) {
            dotSizeSlider.addEventListener('input', (e) => {
                this.appState.dotSize = parseFloat(e.target.value);
                renderDotsForCurrentPage();
            });
        }

        const hToleranceInput = this.container.querySelector('#h-tolerance-input');
        const vToleranceInput = this.container.querySelector('#v-tolerance-input');
        
        if (hToleranceInput) {
            hToleranceInput.addEventListener('change', (e) => {
                this.appState.scrapeHorizontalTolerance = parseFloat(e.target.value);
            });
        }
        
        if (vToleranceInput) {
            vToleranceInput.addEventListener('change', (e) => {
                this.appState.scrapeVerticalTolerance = parseFloat(e.target.value);
            });
        }
        
    }

    enableButtons() {
        const buttonsToEnable = [
            '#create-pdf-btn',
            '#create-schedule-btn',
            '#update-from-schedule-btn',
            '#export-fdf-btn',
            '#single-automap-btn'
        ];
        
        buttonsToEnable.forEach(selector => {
            const btn = this.container.querySelector(selector);
            if (btn && this.appState.pdfDoc) {
                btn.disabled = false;
            }
        });
        
        this.updateAutomapSelect();
    }

    updateAutomapSelect() {
        const select = this.container.querySelector('#automap-marker-type-select');
        if (!select) return;
        
        const markerTypes = Object.keys(this.appState.markerTypes);
        select.innerHTML = markerTypes.map(code => {
            const typeData = this.appState.markerTypes[code];
            return '<option value="' + code + '">' + typeData.code + ' - ' + typeData.name + '</option>';
        }).join('');
        
        select.disabled = markerTypes.length === 0 || !this.appState.pdfDoc;
        
        const textInput = this.container.querySelector('#automap-text-input');
        if (textInput) {
            textInput.disabled = markerTypes.length === 0 || !this.appState.pdfDoc;
        }
    }

    async loadFile(file) {
        const uploadArea = this.container.querySelector('#upload-area');
        if (uploadArea) {
            uploadArea.innerHTML = '<div>⚙️ Loading file...</div>';
            uploadArea.style.display = 'flex';
        }

        const loadedData = await ProjectIO.load(file);
        if (!loadedData) {
            console.error("File loading failed.");
            if (uploadArea) uploadArea.innerHTML = '<div>❌ File loading failed. Please try again.</div>';
            return;
        }
        
        this.appState.pdfDoc = loadedData.pdfDoc;
        this.appState.sourcePdfBuffer = loadedData.pdfBuffer;
        this.appState.totalPages = loadedData.pdfDoc.numPages;
        this.appState.currentPdfPage = 1;

        if (loadedData.isProject && loadedData.projectData) {
            await this.importData(loadedData.projectData);
            if (this.bridge && this.bridge.updateProjectName) {
                this.bridge.updateProjectName(loadedData.projectData.sourcePdfName || file.name);
            }
        } else {
            if (this.bridge && this.bridge.updateProjectName) {
                this.bridge.updateProjectName(file.name);
            }
        }
        
        this.appState.mapTransform = { x: 0, y: 0, scale: 1 };
        applyMapTransform();

        await renderPDFPage(1);
        await renderDotsForCurrentPage();
        
        setupCanvasEventListeners();
        setupMapInteraction();
        
        this.uiModule.updatePageInfo();
        this.uiModule.updateAllSectionsForCurrentPage();

        this.enableButtons();

        if (uploadArea) {
            uploadArea.style.display = 'none';
        }
        
        // Capture initial state for undo
        this.stateModule.UndoManager.capture('Load file');

        console.log('✅ PDF loaded and rendered successfully.');
    }

    updateFilterCheckboxes() {
        if (this.uiModule && this.uiModule.updateFilterCheckboxes) {
            this.uiModule.updateFilterCheckboxes();
        }
    }

    updateLocationList() {
        if (this.uiModule && this.uiModule.updateLocationList) {
            this.uiModule.updateLocationList();
        }
    }

    exportData() {
        if (!this.appState) {
            return { version: this.version, data: null };
        }
        
        return {
            version: this.version,
            appState: {
                dotsByPage: this.stateModule.serializeDotsByPage(this.appState.dotsByPage),
                markerTypes: this.appState.markerTypes,
                nextInternalId: this.appState.nextInternalId,
                dotSize: this.appState.dotSize,
                currentPdfPage: this.appState.currentPdfPage,
                totalPages: this.appState.totalPages,
                pageLabels: Object.fromEntries(this.appState.pageLabels || new Map()),
                recentSearches: this.appState.recentSearches,
                automapExactPhrase: this.appState.automapExactPhrase,
                scrapeHorizontalTolerance: this.appState.scrapeHorizontalTolerance,
                scrapeVerticalTolerance: this.appState.scrapeVerticalTolerance
            },
            exported: new Date().toISOString()
        };
    }

    async importData(data) {
        if (!this.appState || !data) {
            console.log('🗺️ No mapping data to import');
            return;
        }
        
        const stateToImport = data.appState || data;

        this.appState.dotsByPage = this.stateModule.deserializeDotsByPage(stateToImport.dotsByPage || {});
        
        // Import marker types directly
        this.appState.markerTypes = stateToImport.markerTypes || {};
        
        this.appState.nextInternalId = stateToImport.nextInternalId || 1;
        this.appState.dotSize = stateToImport.dotSize || 1;
        this.appState.currentPdfPage = stateToImport.currentPdfPage || 1;
        this.appState.totalPages = stateToImport.totalPages || this.appState.totalPages;
        this.appState.pageLabels = new Map(Object.entries(stateToImport.pageLabels || {}));
        this.appState.recentSearches = stateToImport.recentSearches || [];
        this.appState.automapExactPhrase = stateToImport.automapExactPhrase !== undefined ? stateToImport.automapExactPhrase : true;
        this.appState.scrapeHorizontalTolerance = stateToImport.scrapeHorizontalTolerance || 1;
        this.appState.scrapeVerticalTolerance = stateToImport.scrapeVerticalTolerance || 25;
        
        // Set active marker type
        if (stateToImport.activeMarkerType) {
            this.appState.activeMarkerType = stateToImport.activeMarkerType;
        }
        
        // Set active marker type if not set
        if (this.appState.markerTypes && Object.keys(this.appState.markerTypes).length > 0 && !this.appState.activeMarkerType) {
            this.appState.activeMarkerType = Object.keys(this.appState.markerTypes)[0];
        }
        
        // Update UI after importing
        if (this.uiModule) {
            this.uiModule.updateFilterCheckboxes();
            this.uiModule.updateLocationList();
            this.uiModule.updateAllSectionsForCurrentPage();
        }
        
        // Update dot size slider if available
        const dotSizeSlider = document.getElementById('dot-size-slider');
        if (dotSizeSlider) {
            dotSizeSlider.value = this.appState.dotSize;
        }
        
        // Render dots for current page
        if (this.renderModule && this.renderModule.renderDotsForCurrentPage) {
            this.renderModule.renderDotsForCurrentPage();
        }
        
        console.log('🗺️ Mapping data imported successfully');
    }

    async handleDataRequest(fromApp, query) {
        if (!this.appState) {
            return { error: 'State not initialized' };
        }
        
        switch (query.type) {
            case 'get-coordinates':
                const currentPageData = this.stateModule.getDotsForPage(this.appState.currentPdfPage);
                return { 
                    coordinates: Array.from(currentPageData.values()).map(dot => ({
                        id: dot.internalId,
                        x: dot.x,
                        y: dot.y,
                        locationNumber: dot.locationNumber
                    }))
                };
            case 'get-locations':
                const allLocations = [];
                for (const [pageNum, pageData] of this.appState.dotsByPage.entries()) {
                    for (const dot of pageData.dots.values()) {
                        allLocations.push(Object.assign({}, dot, { page: pageNum }));
                    }
                }
                return { locations: allLocations };
            case 'get-status':
                return { 
                    currentPage: this.appState.currentPdfPage,
                    totalPages: this.appState.totalPages,
                    totalDots: Array.from(this.appState.dotsByPage.values()).reduce((total, page) => total + page.dots.size, 0),
                    activeMarkerType: this.appState.activeMarkerType
                };
            case 'get-all-locations':
                // Return all locations with full details for Thumbnail Slayer
                const detailedLocations = [];
                
                // Check if state is properly initialized
                if (!this.appState.dotsByPage) {
                    return { 
                        locations: [],
                        markerTypes: {},
                        pageNames: {},
                        pageInfo: { totalPages: 0, pageLabels: [] }
                    };
                }
                
                for (const [pageNum, pageData] of this.appState.dotsByPage.entries()) {
                    const pageName = this.appState.pageNames ? 
                        (this.appState.pageNames.get(pageNum) || `Page ${pageNum}`) : 
                        `Page ${pageNum}`;
                    
                    for (const dot of pageData.dots.values()) {
                        detailedLocations.push({
                            id: dot.internalId,
                            locationNumber: dot.locationNumber,
                            pageNumber: pageNum,
                            sheetName: pageName,
                            message: dot.message || '',
                            message2: dot.message2 || '',
                            markerType: dot.markerType || 'default',
                            markerTypeInfo: this.appState.markerTypes ? (this.appState.markerTypes[dot.markerType] || {}) : {},
                            x: dot.x,
                            y: dot.y,
                            installed: dot.installed || false,
                            vinylBacker: dot.vinylBacker || false,
                            codeRequired: dot.isCodeRequired || false,
                            notes: dot.notes || ''
                        });
                    }
                }
                return { 
                    locations: detailedLocations,
                    markerTypes: this.appState.markerTypes || {},
                    pageNames: this.appState.pageNames ? Object.fromEntries(this.appState.pageNames) : {},
                    pageInfo: {
                        totalPages: this.appState.totalPages || 0,
                        pageLabels: this.appState.pageLabels ? Array.from(this.appState.pageLabels.entries()).map(([num, label]) => ({ pageNumber: num, label: label })) : []
                    }
                };
            case 'update-dot':
                // Update a dot's properties from external apps
                if (!query.locationId || !query.updates) {
                    return { error: 'Missing locationId or updates' };
                }
                
                // Find the dot by ID across all pages
                let foundDot = null;
                let foundPage = null;
                
                for (const [pageNum, pageData] of this.appState.dotsByPage.entries()) {
                    for (const dot of pageData.dots.values()) {
                        if (dot.internalId === query.locationId) {
                            foundDot = dot;
                            foundPage = pageNum;
                            break;
                        }
                    }
                    if (foundDot) break;
                }
                
                if (!foundDot) {
                    return { error: 'Dot not found' };
                }
                
                // Update the dot properties
                Object.assign(foundDot, query.updates);
                
                // Re-render if on current page
                if (foundPage === this.appState.currentPdfPage) {
                    // Try to update just the single dot first
                    const updated = updateSingleDot(query.locationId);
                    if (!updated) {
                        // Fallback to full re-render if single update fails
                        renderDotsForCurrentPage();
                    }
                }
                
                // Mark as dirty
                if (this.stateModule && this.stateModule.setDirtyState) {
                    this.stateModule.setDirtyState();
                }
                
                // Broadcast update event
                if (window.appBridge) {
                    window.appBridge.broadcast('marker:updated', {
                        locationId: query.locationId,
                        updates: query.updates
                    });
                }
                
                return { success: true };
            case 'get-marker-types':
                return { markerTypes: this.appState.markerTypes };
            case 'get-marker-type-details':
                const markerType = this.appState.markerTypes[query.code];
                return markerType ? { markerType } : { error: 'Marker type not found' };
            case 'create-marker-type':
                if (query.markerType && query.markerType.code && !this.appState.markerTypes[query.markerType.code]) {
                    this.appState.markerTypes[query.markerType.code] = {
                        code: query.markerType.code,
                        name: query.markerType.name || 'Unnamed Marker Type',
                        color: query.markerType.color || '#F72020',
                        textColor: query.markerType.textColor || '#FFFFFF',
                        designReference: null
                    };
                    
                    // Set as active if no active type
                    if (!this.appState.activeMarkerType) {
                        this.appState.activeMarkerType = query.markerType.code;
                    }
                    
                    // Update UI if available
                    if (this.uiModule) {
                        this.uiModule.updateFilterCheckboxes();
                        this.uiModule.updateEditModalOptions();
                    }
                    
                    // Broadcast marker type created event
                    if (window.appBridge) {
                        window.appBridge.broadcast('marker-type:created', {
                            code: query.markerType.code,
                            markerType: this.appState.markerTypes[query.markerType.code]
                        });
                    }
                    
                    return { success: true, markerType: this.appState.markerTypes[query.markerType.code] };
                } else {
                    return { error: 'Invalid marker type data or code already exists' };
                }
            default:
                return { error: 'Unknown query type' };
        }
    }
}

export default MappingSlayerApp;
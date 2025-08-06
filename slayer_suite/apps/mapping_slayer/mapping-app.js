// apps/mapping_slayer/mapping-app.js
import SlayerAppBase from '../../core/slayer-app-base.js';
import { ProjectIO } from './project-io.js';
import { renderPDFPage, applyMapTransform, renderDotsForCurrentPage, updateSingleDot, setupMapInteraction, centerOnDot, clearPDFCache } from './map-controller.js';
import { 
    setupCanvasEventListeners,
    addMarkerTypeEventListener,
    addPageNavigationEventListeners,
    addViewToggleEventListeners,
    addButtonEventListeners,
    setupModalEventListeners,
    updateAllSectionsForCurrentPage
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
        
        // Reset keyboard shortcuts flag to prevent duplicate listeners
        if (this.uiModule && this.uiModule.resetKeyboardShortcutsFlag) {
            this.uiModule.resetKeyboardShortcutsFlag();
        }
        
        // Call parent deactivate
        await super.deactivate();
    }

    createAppContent() {
        const contentArea = this.getContentArea();
        
        contentArea.innerHTML = `
            <div class="ms-app-container">
                <!-- Left Panel -->
                <div class="ms-left-panel">
                    <div class="ms-panel-section ms-filter-section">
                        <div class="ms-panel-header">
                            <span>MARKER TYPES</span>
                            <div class="ms-header-buttons">
                                <button class="ms-btn ms-btn-small ms-btn-primary" id="add-marker-type-btn">+</button>
                                <button class="ms-btn ms-btn-small ms-btn-secondary" id="import-marker-types-btn" title="Import Marker Types">IMP</button>
                                <button class="ms-btn ms-btn-small ms-btn-secondary" id="export-marker-types-btn" title="Export Marker Types">EXP</button>
                            </div>
                        </div>
                        <div class="ms-panel-content">
                            <div class="ms-filter-checkboxes" id="filter-checkboxes"></div>
                        </div>
                    </div>

                    <div class="ms-panel-section ms-list-section">
                        <div class="ms-panel-header">
                            <span>LIST</span>
                            <div id="list-header-controls">
                                <button class="ms-btn ms-btn-secondary ms-btn-compact" id="expand-list-btn">EXPAND</button>
                                <button class="ms-btn ms-btn-secondary ms-btn-compact" id="sort-toggle-btn">BY LOC</button>
                                <button class="ms-btn ms-btn-secondary ms-btn-compact" id="toggle-view-btn">UNGROUPED</button>
                                <div class="ms-all-pages-container">
                                    <input type="checkbox" id="all-pages-checkbox">
                                    <label for="all-pages-checkbox">All Pages</label>
                                </div>
                            </div>
                        </div>
                        <div class="ms-panel-content" id="list-content">
                            <div class="ms-empty-state" id="empty-state">
                                Click on the map to add your first location dot.
                            </div>
                            <div id="list-with-renumber" style="display: none; height: 100%;">
                                <div id="location-list"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Map Section -->
                <div class="ms-map-section">
                    <div class="ms-map-overlay-controls-top-left">
                        <div class="ms-find-replace-container">
                            <div class="ms-find-replace-inputs">
                                <button class="ms-btn ms-find-all-btn" id="find-all-btn">FIND ALL</button>
                                <input type="text" class="ms-find-input" placeholder="FIND" id="find-input">
                                <input type="text" class="ms-replace-input" placeholder="REPLACE" id="replace-input">
                                <button class="ms-btn ms-replace-btn" id="replace-btn">REPLACE</button>
                            </div>
                            <div class="ms-replace-status" id="replace-status"></div>
                            <span id="find-count" style="display: none;"></span>
                        </div>
                        <button class="ms-btn ms-btn-secondary ms-btn-compact ms-btn-uniform-width" id="help-btn">HELP</button>
                        <button class="ms-btn ms-btn-secondary ms-btn-compact ms-btn-uniform-width" id="toggle-locations-btn">HIDE LOC</button>
                        <button class="ms-btn ms-btn-secondary ms-btn-compact ms-btn-uniform-width" id="toggle-messages-btn">SHOW MSG1</button>
                        <button class="ms-btn ms-btn-secondary ms-btn-compact ms-btn-uniform-width" id="toggle-messages2-btn">SHOW MSG2</button>
                        <button class="ms-btn ms-btn-secondary ms-btn-compact ms-btn-uniform-width" id="toggle-code-display-btn">CODE ONLY</button>
                        <button class="ms-btn ms-btn-secondary ms-btn-compact ms-btn-uniform-width" id="toggle-inst-display-btn">INST ONLY</button>
                        <button class="ms-btn ms-btn-secondary ms-btn-compact ms-btn-uniform-width" id="renumber-btn">RENUMBER</button>
                    </div>
                    
                    <div class="ms-legends-container">
                        <div class="ms-legend-box" id="project-legend">
                            <div class="ms-map-legend-header">
                                <span>PROJECT LEGEND</span>
                                <span class="ms-legend-collapse-arrow">▼</span>
                            </div>
                            <div class="ms-map-legend-content" id="project-legend-content"></div>
                        </div>
                        <div class="ms-legend-box" id="map-legend">
                            <div class="ms-map-legend-header">
                                <span>PAGE LEGEND</span>
                                <span class="ms-legend-collapse-arrow">▼</span>
                            </div>
                            <div class="ms-map-legend-content" id="map-legend-content"></div>
                        </div>
                    </div>

                    <div class="ms-map-overlay-controls">
                        <div class="ms-page-nav">
                            <button class="ms-crop-btn" id="crop-toggle-btn" title="Toggle Crop Mode">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <!-- Top left corner -->
                                    <path d="M4 4 L4 8 M4 4 L8 4" />
                                    <!-- Top right corner -->
                                    <path d="M20 4 L16 4 M20 4 L20 8" />
                                    <!-- Bottom left corner -->
                                    <path d="M4 20 L4 16 M4 20 L8 20" />
                                    <!-- Bottom right corner -->
                                    <path d="M20 20 L20 16 M20 20 L16 20" />
                                </svg>
                            </button>
                            <div class="ms-crop-all-pages-container" id="crop-all-pages-container" style="display: none;">
                                <input type="checkbox" id="crop-all-pages-checkbox">
                                <label for="crop-all-pages-checkbox">All Pages</label>
                            </div>
                            <button class="ms-nav-btn" id="prev-page">&lt;</button>
                            <input type="text" id="page-label-input" placeholder="Enter Page Label" class="ms-page-label-input">
                            <span id="page-info">PAGE 1 OF 1</span>
                            <button class="ms-nav-btn" id="next-page">&gt;</button>
                        </div>
                    </div>
                    
                    <div class="ms-map-container" id="map-container">
                         <div class="ms-upload-area" id="upload-area">
                            <div>📄 Upload PDF or .slayer file</div>
                            <div style="margin-top: 10px; font-size: 14px;">Click to browse or drag and drop</div>
                            <div class="ms-upload-area-note">Use live text PDFs for enhanced functionality.</div>
                            <input type="file" id="file-input" accept=".pdf,.mslay,.slayer" style="display: none;">
                        </div>

                        <div id="scrape-controls" class="ms-scrape-controls">
                            <div class="ms-tolerance-controls">
                                <div class="ms-tolerance-input-group">
                                    <label for="h-tolerance-input">H:</label>
                                    <input type="number" id="h-tolerance-input" class="ms-tolerance-input" min="0.1" max="100" step="0.1" value="10.0">
                                </div>
                                <div class="ms-tolerance-input-group">
                                    <label for="v-tolerance-input">V:</label>
                                    <input type="number" id="v-tolerance-input" class="ms-tolerance-input" min="0.1" max="100" step="0.1" value="25.0">
                                </div>
                                <div class="ms-tolerance-input-group">
                                    <label for="dot-size-slider">DOT SIZE:</label>
                                    <input type="range" class="ms-size-slider" id="dot-size-slider" min="0.5" max="3" step="0.1" value="1">
                                </div>
                            </div>
                        </div>
                        
                        <div id="map-content">
                            <canvas id="pdf-canvas"></canvas>
                            <div id="crop-overlay" class="ms-crop-overlay" style="display: none;">
                                <div class="ms-crop-handle ms-crop-handle-nw" data-handle="nw"></div>
                                <div class="ms-crop-handle ms-crop-handle-n" data-handle="n"></div>
                                <div class="ms-crop-handle ms-crop-handle-ne" data-handle="ne"></div>
                                <div class="ms-crop-handle ms-crop-handle-w" data-handle="w"></div>
                                <div class="ms-crop-handle ms-crop-handle-e" data-handle="e"></div>
                                <div class="ms-crop-handle ms-crop-handle-sw" data-handle="sw"></div>
                                <div class="ms-crop-handle ms-crop-handle-s" data-handle="s"></div>
                                <div class="ms-crop-handle ms-crop-handle-se" data-handle="se"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- CSV Status -->
                <div id="csv-status" class="ms-csv-status">
                    <div id="csv-status-content"></div>
                </div>

                <!-- Footer Controls -->
                <div class="ms-footer-controls">
                    <div class="ms-automap-container" id="single-automap-container">
                        <select class="ms-form-input ms-automap-select" id="automap-marker-type-select" disabled=""></select>
                        <input type="text" class="ms-form-input ms-automap-input" id="automap-text-input" placeholder="Enter text to find..." list="recent-searches-datalist" disabled="">
                        <datalist id="recent-searches-datalist"></datalist>
                        <div class="ms-automap-checkbox-group">
                            <input type="checkbox" id="automap-exact-phrase" checked="">
                            <label for="automap-exact-phrase">Exact</label>
                        </div>
                        <button class="ms-btn ms-btn-success" id="single-automap-btn" disabled="">AUTOMAP IT!</button>
                        <span class="ms-automap-status" id="automap-status"></span>
                    </div>
                    
                    <div class="ms-control-group">                
                        <button class="ms-btn ms-btn-primary ms-btn-compact" id="create-pdf-btn" disabled="">CREATE PDF</button>
                        <button class="ms-btn ms-btn-primary ms-btn-compact" id="create-schedule-btn" disabled="">CREATE MESSAGE SCHEDULE</button>
                        <button class="ms-btn ms-btn-primary ms-btn-compact" id="update-from-schedule-btn" disabled="">UPDATE FROM MESSAGE SCHEDULE</button>
                        <button class="ms-btn ms-btn-primary ms-btn-compact" id="export-fdf-btn" disabled="">EXPORT REVU MARKUPS (BETA)</button>
                    </div>
                </div>
                
                <!-- Spreadsheet View Overlay - Outside of panels to be above everything -->
                <div id="spreadsheet-overlay" class="ms-spreadsheet-overlay" style="display: none;">
                    <div class="ms-spreadsheet-header">
                        <span>LIST - EXPANDED VIEW</span>
                    </div>
                    <div class="ms-spreadsheet-container">
                        <table class="ms-spreadsheet-table">
                            <thead>
                                <tr>
                                    <th class="ms-col-location ms-sortable" data-sort="location">LOC # <span class="ms-sort-indicator"></span></th>
                                    <th class="ms-col-marker ms-sortable" data-sort="type">TYPE <span class="ms-sort-indicator"></span></th>
                                    <th class="ms-col-message ms-sortable" data-sort="message">MESSAGE <span class="ms-sort-indicator"></span></th>
                                    <th class="ms-col-message2 ms-sortable" data-sort="message2">MESSAGE 2 <span class="ms-sort-indicator"></span></th>
                                    <th class="ms-col-notes ms-sortable" data-sort="notes">NOTES <span class="ms-sort-indicator"></span></th>
                                    <th class="ms-col-checkbox ms-sortable" data-sort="code">CODE <span class="ms-sort-indicator"></span></th>
                                    <th class="ms-col-checkbox ms-sortable" data-sort="vinyl">VINYL <span class="ms-sort-indicator"></span></th>
                                    <th class="ms-col-checkbox ms-sortable" data-sort="inst">INST <span class="ms-sort-indicator"></span></th>
                                </tr>
                            </thead>
                            <tbody id="spreadsheet-tbody">
                            </tbody>
                        </table>
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
            <div class="ms-modal" id="mapping-slayer-edit-modal">
                <div class="ms-modal-content">
                    <div class="ms-modal-header-grid">
                        <div class="ms-modal-header-main">
                            <h3 class="ms-modal-title">Edit Location</h3>
                        </div>
                        <div class="ms-modal-header-checkboxes">
                            <div class="ms-form-group-inline">
                                <label for="edit-code-required">Code Required</label>
                                <input type="checkbox" id="edit-code-required">
                            </div>
                            <div class="ms-form-group-inline">
                                <label for="edit-vinyl-backer">Vinyl Backer</label>
                                <input type="checkbox" id="edit-vinyl-backer">
                            </div>
                            <div class="ms-form-group-inline">
                                <label for="edit-installed">Installed</label>
                                <input type="checkbox" id="edit-installed">
                            </div>
                        </div>
                    </div>
                    <div class="ms-modal-body">
                        <div class="ms-form-group">
                            <label class="ms-form-label">Marker Type</label>
                            <select class="ms-form-input" id="edit-marker-type"></select>
                        </div>
                        <div class="ms-form-group" id="edit-location-group">
                            <label class="ms-form-label">Location Number</label>
                            <input type="text" class="ms-form-input" id="edit-location-number" placeholder="Enter location number">
                        </div>
                        <!-- Dynamic text fields will be inserted here -->
                        <div id="edit-dynamic-fields" class="ms-dynamic-fields-container"></div>
                        <div class="ms-form-group">
                            <label class="ms-form-label">Notes</label>
                            <textarea class="ms-form-input ms-form-textarea" id="edit-notes" placeholder="Enter notes..."></textarea>
                        </div>
                    </div>
                    <div class="ms-modal-buttons">
                        <button class="ms-btn ms-btn-danger" id="delete-dot-btn">DELETE</button>
                        <button class="ms-btn ms-btn-secondary" id="cancel-modal-btn">CANCEL</button>
                        <button class="ms-btn ms-btn-primary" id="update-dot-btn">UPDATE</button>
                    </div>
                </div>
            </div>

            <!-- Group Edit Modal -->
            <div class="ms-modal" id="mapping-slayer-group-edit-modal">
                <div class="ms-modal-content">
                    <div class="ms-modal-header-grid">
                        <div class="ms-modal-header-main">
                            <h3 class="ms-modal-title">Edit Multiple</h3>
                            <div class="ms-modal-subheader">(<span id="mapping-slayer-group-edit-count">0</span> selected)</div>
                        </div>
                        <div class="ms-modal-header-checkboxes">
                            <div class="ms-form-group-inline">
                                <label for="group-edit-code-required">Code Required</label>
                                <input type="checkbox" id="group-edit-code-required">
                            </div>
                            <div class="ms-form-group-inline">
                                <label for="group-edit-vinyl-backer">Vinyl Backer</label>
                                <input type="checkbox" id="group-edit-vinyl-backer">
                            </div>
                            <div class="ms-form-group-inline">
                                <label for="group-edit-installed">Installed</label>
                                <input type="checkbox" id="group-edit-installed">
                            </div>
                        </div>
                    </div>
                    <div class="ms-modal-body">
                        <div class="ms-form-group">
                            <label class="ms-form-label">Marker Type</label>
                            <select class="ms-form-input" id="group-edit-marker-type">
                                <option value="">-- Keep Individual Types --</option>
                            </select>
                        </div>
                        <!-- Dynamic text fields will be inserted here -->
                        <div id="group-edit-dynamic-fields" class="ms-dynamic-fields-container"></div>
                        <div class="ms-form-group">
                            <label class="ms-form-label">Notes</label>
                            <textarea class="ms-form-input ms-form-textarea" id="group-edit-notes" placeholder="Enter notes to overwrite all selected locations..."></textarea>
                        </div>
                    </div>
                    <div class="ms-modal-buttons">
                        <button class="ms-btn ms-btn-danger" id="group-delete-btn">DELETE ALL</button>
                        <button class="ms-btn ms-btn-secondary" id="group-cancel-btn">CANCEL</button>
                        <button class="ms-btn ms-btn-primary" id="group-update-btn">UPDATE ALL</button>
                    </div>
                </div>
            </div>
            
            <!-- Renumber Modal -->
            <div class="ms-modal" id="mapping-slayer-renumber-modal">
                <div class="ms-modal-content">
                    <div class="ms-modal-header">
                        <span>Renumber Options</span>
                    </div>
                    <div class="ms-modal-body">
                        <p class="ms-modal-text">Choose how you want to renumber the locations:</p>
                        <div class="ms-renumber-options">
                            <button class="ms-btn ms-btn-primary ms-renumber-option-btn" onclick="performRenumber('page')">
                                <strong>Current Page Only</strong><br>
                                <small>Renumber dots on this page by position (top to bottom, left to right)</small>
                            </button>
                            <button class="ms-btn ms-btn-primary ms-renumber-option-btn" onclick="performRenumber('page-by-type')">
                                <strong>Current Page by Marker Type</strong><br>
                                <small>Renumber each marker type separately on this page</small>
                            </button>
                            <button class="ms-btn ms-btn-primary ms-renumber-option-btn" onclick="performRenumber('all')">
                                <strong>All Pages</strong><br>
                                <small>Renumber all dots across all pages continuously</small>
                            </button>
                            <button class="ms-btn ms-btn-primary ms-renumber-option-btn" onclick="performRenumber('all-by-type')">
                                <strong>All Pages by Marker Type</strong><br>
                                <small>Renumber each marker type separately across all pages</small>
                            </button>
                        </div>
                    </div>
                    <div class="ms-modal-buttons">
                        <button class="ms-btn ms-btn-secondary" id="cancel-renumber-btn">CANCEL</button>
                    </div>
                </div>
            </div>
            
            <!-- Automap Progress Modal -->
            <div class="ms-automap-progress-modal" id="mapping-slayer-automap-progress-modal">
                <div class="ms-automap-progress-content">
                    <div class="ms-automap-progress-header">Auto-Mapping in Progress</div>
                    <div id="mapping-slayer-automap-main-status">Initializing...</div>
                    <div class="ms-automap-progress-bar">
                        <div class="ms-automap-progress-fill" id="mapping-slayer-automap-progress-fill"></div>
                    </div>
                    <div class="ms-automap-activity-feed" id="mapping-slayer-automap-activity-feed"></div>
                    <div class="ms-automap-results" id="mapping-slayer-automap-results"></div>
                    <div class="ms-automap-buttons">
                        <button class="ms-btn ms-btn-secondary" id="cancel-automap-btn">CANCEL</button>
                        <button class="ms-btn ms-btn-primary" id="close-automap-btn" style="display: none;">CLOSE</button>
                    </div>
                </div>
            </div>
            
            <!-- PDF Export Modal -->
            <div id="mapping-slayer-pdf-export-modal" class="ms-modal">
                <div class="ms-modal-content">
                    <div class="ms-modal-header">
                        <span>PDF Export Options</span>
                    </div>
                    <div class="ms-modal-body">
                        <p class="ms-modal-text">Choose your PDF export format:</p>
                        <div class="ms-pdf-export-options">
                            <button class="ms-btn ms-btn-primary ms-pdf-export-option-btn" onclick="performPDFExport('current-with-details')">
                                <strong>Current Map - With Detail Pages</strong><br>
                                <small>This map + clickable detail pages for each location</small>
                            </button>
                            <button class="ms-btn ms-btn-primary ms-pdf-export-option-btn" onclick="performPDFExport('current-only')">
                                <strong>Current Map Only</strong><br>
                                <small>Just this map page with location dots</small>
                            </button>
                            <button class="ms-btn ms-btn-primary ms-pdf-export-option-btn" onclick="performPDFExport('all-maps-only')">
                                <strong>All Maps Only</strong><br>
                                <small>All map pages with dots (no detail pages)</small>
                            </button>
                        </div>
                    </div>
                    <div class="ms-modal-buttons">
                        <button class="ms-btn ms-btn-secondary" id="cancel-pdf-export-btn">CANCEL</button>
                    </div>
                </div>
            </div>
            
            <!-- Character Warning Modal -->
            <div id="mapping-slayer-character-warning-modal" class="ms-modal">
                <div class="ms-modal-content">
                    <h2>⚠️ Character Compatibility Warning</h2>
                    <p>The following characters will be replaced for Bluebeam compatibility:</p>
                    <div id="mapping-slayer-character-changes-preview"></div>
                    <p class="ms-affected-count">This affects <span id="mapping-slayer-affected-locations-count">0</span> location(s).</p>
                    <p>A log file will be created with all changes. Do you want to proceed?</p>
                    <div class="ms-button-row">
                        <button class="ms-btn ms-btn-primary" id="proceed-character-changes-btn">Proceed with Export</button>
                        <button class="ms-btn ms-btn-secondary" id="cancel-character-changes-btn">Cancel</button>
                    </div>
                </div>
            </div>
            
            <!-- Hidden file inputs -->
            <input type="file" id="update-csv-input" accept=".csv" style="display: none;">
            
            <!-- Controls Modal -->
            <div id="mapping-slayer-controls-modal" class="ms-modal">
                <div class="ms-modal-content">
                    <div class="ms-modal-header">
                        <span>Controls</span>
                    </div>
                    <ul class="ms-controls-list-modal">
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
                        <li><strong>Annotation Line:</strong> Ctrl + drag from dot</li>
                        <li><strong>Clear Selection:</strong> Escape</li>
                    </ul>
                    <div class="ms-modal-buttons">
                        <button class="ms-btn ms-btn-secondary ms-btn-compact" id="tooltips-btn">TOOL TIPS</button>
                        <button class="ms-btn ms-btn-secondary ms-btn-compact" id="guide-btn">FULL GUIDE</button>
                        <button class="ms-btn ms-btn-primary" id="close-controls-modal-btn">CLOSE</button>
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
        
        // Initialize UndoManager - DISABLED: Using CommandUndoManager instead
        // this.stateModule.initializeUndoManager();
        
        this.initializeDefaultMarkerTypes();
        this.uiModule = await import('./ui.js');
        
        // Initialize crop tool
        const { cropTool } = await import('./crop-tool.js');
        this.cropTool = cropTool;
        this.cropTool.initialize();
        
        // Initialize sync adapter
        const { mappingSyncAdapter } = await import('./mapping-sync.js');
        this.syncAdapter = mappingSyncAdapter;
        
        // Initialize sync with app bridge if available
        if (window.appBridge) {
            this.syncAdapter.initialize(window.appBridge);
            // Sync existing marker types
            await this.syncAdapter.syncMarkerTypes(window.appBridge);
        }
        
        // Initialize TooltipManager
        const { TooltipManager } = await import('./tooltips.js');
        this.tooltipManager = TooltipManager;
        this.tooltipManager.init();
        
        this.setupAllEventListeners();
        
        console.log('✅ Mapping Slayer functionality initialized');
        
        // Expose mapping app instance globally for sync
        window.mappingApp = this;
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
        
        // Remove setTimeout to match toggle behavior timing
        (async () => {
            this.updateFilterCheckboxes();
            this.updateLocationList();
            this.uiModule.updateMarkerTypeSelect();
            this.enableButtons();
            
            // Initialize tolerance inputs
            const { updateToleranceInputs } = await import('./scrape.js');
            updateToleranceInputs();
        })();
    }

    setupBasicEventListeners() {
        const helpBtn = this.container.querySelector('#help-btn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                const controlsModal = document.getElementById('mapping-slayer-controls-modal');
                if (controlsModal) {
                    controlsModal.style.display = 'block';
                }
            });
        }
        
        // Controls modal close button
        const closeControlsModalBtn = document.getElementById('close-controls-modal-btn');
        if (closeControlsModalBtn) {
            closeControlsModalBtn.addEventListener('click', () => {
                const controlsModal = document.getElementById('mapping-slayer-controls-modal');
                if (controlsModal) {
                    controlsModal.style.display = 'none';
                }
            });
        }
        
        // Tooltips button
        const tooltipsBtn = document.getElementById('tooltips-btn');
        if (tooltipsBtn) {
            tooltipsBtn.addEventListener('click', () => {
                if (this.tooltipManager) {
                    this.tooltipManager.toggle();
                }
            });
        }
        
        // Full Guide button
        const guideBtn = document.getElementById('guide-btn');
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
                e.currentTarget.classList.add('ms-dragover'); 
            });
            
            uploadArea.addEventListener('dragleave', (e) => { 
                e.preventDefault(); 
                e.currentTarget.classList.remove('ms-dragover'); 
            });
            
            uploadArea.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('ms-dragover');
                const file = e.dataTransfer.files[0];
                if (file) {
                    console.log('📄 File dropped:', file.name);
                    
                    // Check if it's a PDF and we already have a PDF loaded
                    if (file.name.toLowerCase().endsWith('.pdf') && this.appState.pdfDoc) {
                        const confirmReplace = confirm('Replace existing PDF? Ensure dimensions are the same or markers will be off. All cropping will be reset.');
                        if (confirmReplace) {
                            await this.replacePDF(file);
                        }
                    } else {
                        await this.loadFile(file);
                    }
                }
            });
        }

        const dotSizeSlider = this.container.querySelector('#dot-size-slider');
        if (dotSizeSlider) {
            let dotSizeTimeout;
            
            // Ensure proper focus handling when slider is clicked
            dotSizeSlider.addEventListener('mousedown', (e) => {
                // Force focus back to the map container after a short delay
                setTimeout(() => {
                    const mapContainer = this.container.querySelector('#map-container');
                    if (mapContainer) {
                        // Make sure map container is focusable
                        if (!mapContainer.hasAttribute('tabindex')) {
                            mapContainer.setAttribute('tabindex', '-1');
                        }
                        mapContainer.focus();
                    }
                }, 100);
            });
            
            dotSizeSlider.addEventListener('input', (e) => {
                this.appState.dotSize = parseFloat(e.target.value);
                
                // Debounce the rendering to avoid conflicts with undo system
                clearTimeout(dotSizeTimeout);
                dotSizeTimeout = setTimeout(async () => {
                    await renderDotsForCurrentPage();
                    // Also ensure annotation lines are rendered
                    if (this.uiModule && this.uiModule.renderAnnotationLines) {
                        this.uiModule.renderAnnotationLines();
                    }
                }, 10);
            });
            
            // Add mouseup to ensure undo system is ready after slider change
            dotSizeSlider.addEventListener('mouseup', () => {
                // Blur the slider to ensure it's not capturing keyboard events
                dotSizeSlider.blur();
                
                // Reset the undo system's execution flag if it got stuck
                if (window.CommandUndoManager && window.CommandUndoManager.isExecuting) {
                    window.CommandUndoManager.resetExecutionFlag();
                }
                
                // Ensure map container has focus
                setTimeout(() => {
                    const mapContainer = this.container.querySelector('#map-container');
                    if (mapContainer) {
                        // Make sure map container is focusable
                        if (!mapContainer.hasAttribute('tabindex')) {
                            mapContainer.setAttribute('tabindex', '-1');
                        }
                        mapContainer.focus();
                        
                        // Also dispatch a synthetic click event
                        const clickEvent = new MouseEvent('mousedown', {
                            bubbles: true,
                            cancelable: true,
                            view: window,
                            clientX: 0,
                            clientY: 0
                        });
                        mapContainer.dispatchEvent(clickEvent);
                    }
                }, 0);
            });
            
            // Also handle when slider loses focus
            dotSizeSlider.addEventListener('blur', () => {
                if (window.CommandUndoManager && window.CommandUndoManager.isExecuting) {
                    window.CommandUndoManager.resetExecutionFlag();
                }
            });
        }
        
        // Add a global mousedown handler on the map container to reset undo flag if needed
        const mapContainer = this.container.querySelector('#map-container');
        if (mapContainer) {
            mapContainer.addEventListener('mousedown', (e) => {
                // Skip if clicking on the slider
                if (e.target.id === 'dot-size-slider') return;
                
                if (window.CommandUndoManager && window.CommandUndoManager.isExecuting) {
                    window.CommandUndoManager.resetExecutionFlag();
                }
            }, true); // Use capture phase

            // Add click handler for empty state to flash upload area
            mapContainer.addEventListener('click', (e) => {
                // Only handle clicks when no PDF is loaded and not clicking on upload area
                if (!this.appState.pdfDoc && !e.target.closest('.ms-upload-area')) {
                    const uploadArea = this.container.querySelector('#upload-area');
                    if (uploadArea && uploadArea.style.display !== 'none') {
                        // Add flash class
                        uploadArea.classList.add('ms-flash-green');
                        
                        // Remove class after animation completes (3 flashes * 0.5s = 1.5s)
                        setTimeout(() => {
                            uploadArea.classList.remove('ms-flash-green');
                        }, 1500);
                    }
                }
            });

            // Add drag and drop support to map container for PDF replacement
            mapContainer.addEventListener('dragover', (e) => {
                // Only allow PDF files when a PDF is already loaded
                if (this.appState.pdfDoc && e.dataTransfer.types.includes('Files')) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                    mapContainer.classList.add('ms-dragover');
                }
            });

            mapContainer.addEventListener('dragleave', (e) => {
                // Only remove class if we're actually leaving the container
                if (e.target === mapContainer) {
                    mapContainer.classList.remove('ms-dragover');
                }
            });

            mapContainer.addEventListener('drop', async (e) => {
                e.preventDefault();
                mapContainer.classList.remove('ms-dragover');
                
                const file = e.dataTransfer.files[0];
                if (file && file.name.toLowerCase().endsWith('.pdf') && this.appState.pdfDoc) {
                    const confirmReplace = confirm('Replace existing PDF? Ensure dimensions are the same or markers will be off. All cropping will be reset.');
                    if (confirmReplace) {
                        await this.replacePDF(file);
                    }
                }
            });
        }

        const hToleranceInput = this.container.querySelector('#h-tolerance-input');
        const vToleranceInput = this.container.querySelector('#v-tolerance-input');
        
        if (hToleranceInput) {
            hToleranceInput.addEventListener('change', (e) => {
                this.appState.scrapeHorizontalTolerance = parseFloat(e.target.value);
            });
            
            // Add Enter key support
            hToleranceInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur(); // This will trigger the change event if value changed
                    this.appState.scrapeHorizontalTolerance = parseFloat(e.target.value);
                }
            });
        }
        
        if (vToleranceInput) {
            vToleranceInput.addEventListener('change', (e) => {
                this.appState.scrapeVerticalTolerance = parseFloat(e.target.value);
            });
            
            // Add Enter key support
            vToleranceInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.target.blur(); // This will trigger the change event if value changed
                    this.appState.scrapeVerticalTolerance = parseFloat(e.target.value);
                }
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
        
        this.uiModule.updateMarkerTypeSelect();
    }

    // Note: updateAutomapSelect is now handled by updateMarkerTypeSelect in ui.js

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
        
        // Handle .slayer files - delegate to suite-level project manager
        if (loadedData.isSlayerFile && loadedData.requiresSuiteHandling) {
            console.log('🔄 Delegating .slayer file to suite project manager');
            if (uploadArea) uploadArea.innerHTML = '<div>🔄 Loading suite project...</div>';
            
            // Import the project manager and load the file
            const { projectManager } = await import('../../core/project-manager.js');
            const success = await projectManager.load(loadedData.file);
            
            if (success) {
                if (uploadArea) uploadArea.innerHTML = '<div>✅ Suite project loaded successfully!</div>';
                console.log('✅ .slayer file loaded successfully');
            } else {
                if (uploadArea) uploadArea.innerHTML = '<div>❌ Failed to load suite project.</div>';
                console.error('❌ Failed to load .slayer file');
            }
            return;
        }
        
        // Clear the PDF cache when loading a new PDF
        clearPDFCache();
        
        // Clear all existing data when loading a new file (but preserve marker types)
        this.clearAllDataExceptMarkerTypes();
        
        // Clear the file handle when loading a new PDF (not a project file)
        if (!loadedData.isProject) {
            if (window.saveManager && window.saveManager.clearFileHandle) {
                await window.saveManager.clearFileHandle();
            }
        }
        
        this.appState.pdfDoc = loadedData.pdfDoc;
        this.appState.sourcePdfBuffer = loadedData.pdfBuffer;
        this.appState.sourcePdfName = file.name;
        this.appState.totalPages = loadedData.pdfDoc.numPages;
        this.appState.currentPdfPage = 1;
        
        // DEBUG: Track PDF buffer state

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
        updateAllSectionsForCurrentPage();
        
        // Apply any saved crops for the first page
        if (this.cropTool) {
            this.cropTool.applySavedCrop();
        }
        
        setupCanvasEventListeners();
        setupMapInteraction();
        
        this.uiModule.updatePageInfo();

        this.enableButtons();

        if (uploadArea) {
            uploadArea.style.display = 'none';
        }
        
        // Clear undo history when loading new file
        if (this.stateModule.CommandUndoManager) {
            this.stateModule.CommandUndoManager.clear();
        }

        console.log('✅ PDF loaded and rendered successfully.');
    }

    async replacePDF(file) {
        const uploadArea = this.container.querySelector('#upload-area');
        if (uploadArea) {
            uploadArea.innerHTML = '<div>⚙️ Replacing PDF...</div>';
            uploadArea.style.display = 'flex';
        }

        // Load the new PDF without clearing project data
        const loadedData = await ProjectIO.load(file);
        if (!loadedData || !loadedData.pdfDoc) {
            console.error("PDF loading failed.");
            if (uploadArea) {
                uploadArea.innerHTML = '<div>❌ PDF loading failed. Please try again.</div>';
                uploadArea.style.display = 'none';
            }
            return;
        }

        // Clear the PDF cache for the new PDF
        clearPDFCache();
        
        // Replace the PDF document and buffer
        this.appState.pdfDoc = loadedData.pdfDoc;
        this.appState.sourcePdfBuffer = loadedData.pdfBuffer;
        this.appState.sourcePdfName = file.name;
        
        // Check if page count changed
        const newTotalPages = loadedData.pdfDoc.numPages;
        if (newTotalPages < this.appState.totalPages) {
            console.warn(`⚠️ New PDF has fewer pages (${newTotalPages}) than original (${this.appState.totalPages})`);
        }
        this.appState.totalPages = newTotalPages;
        
        // Ensure current page is valid
        if (this.appState.currentPdfPage > newTotalPages) {
            this.appState.currentPdfPage = 1;
        }

        // Clear all cropping data
        if (this.cropTool) {
            this.cropTool.clearAllCrops();
        }

        // Update project name if bridge is available
        if (this.bridge && this.bridge.updateProjectName) {
            this.bridge.updateProjectName(file.name);
        }

        // Re-render with the new PDF
        await renderPDFPage(this.appState.currentPdfPage);
        await renderDotsForCurrentPage();
        updateAllSectionsForCurrentPage();
        
        this.uiModule.updatePageInfo();

        if (uploadArea) {
            uploadArea.style.display = 'none';
        }

        // Mark project as dirty since PDF changed
        setDirtyState();

        console.log('✅ PDF replaced successfully. All dots and data preserved.');
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
    
    serializeAnnotationLines(annotationLinesMap) {
        const obj = {};
        for (const [pageNum, linesMap] of annotationLinesMap.entries()) {
            obj[pageNum] = Array.from(linesMap.values());
        }
        return obj;
    }
    
    deserializeAnnotationLines(serializedObj) {
        const annotationLinesMap = new Map();
        for (const [pageNum, lines] of Object.entries(serializedObj)) {
            const linesMap = new Map();
            lines.forEach(line => {
                linesMap.set(line.id, line);
            });
            annotationLinesMap.set(parseInt(pageNum), linesMap);
        }
        return annotationLinesMap;
    }

    exportData() {
        if (!this.appState) {
            return { version: this.version, data: null };
        }
        
        // Convert PDF buffer to base64 if it exists
        let pdfBase64 = null;
        
        if (this.appState.sourcePdfBuffer) {
            try {
                const uint8Array = new Uint8Array(this.appState.sourcePdfBuffer);
                const binaryString = uint8Array.reduce((str, byte) => str + String.fromCharCode(byte), '');
                pdfBase64 = btoa(binaryString);
            } catch (e) {
            }
        } else {
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
                scrapeVerticalTolerance: this.appState.scrapeVerticalTolerance,
                annotationLines: this.serializeAnnotationLines(this.appState.annotationLines),
                showAnnotationEndpoints: this.appState.showAnnotationEndpoints,
                // Include PDF data
                sourcePdfBase64: pdfBase64,
                sourcePdfName: this.appState.sourcePdfName
            },
            exported: new Date().toISOString()
        };
    }

    clearAllDataExceptMarkerTypes() {
        // Save marker types and active marker type before clearing
        const savedMarkerTypes = { ...this.appState.markerTypes };
        const savedActiveMarkerType = this.appState.activeMarkerType;
        
        // Call the full clear
        this.clearAllData();
        
        // Restore marker types and active marker type
        this.appState.markerTypes = savedMarkerTypes;
        this.appState.activeMarkerType = savedActiveMarkerType;
        
        // Update UI to reflect the preserved marker types
        if (this.uiModule && this.uiModule.updateFilterCheckboxes) {
            this.uiModule.updateFilterCheckboxes();
        }
        if (this.uiModule && this.uiModule.updateMarkerTypeSelect) {
            this.uiModule.updateMarkerTypeSelect();
        }
    }

    clearAllData() {
        
        // CRITICAL: First clear all DOM dot elements to prevent persistence
        const existingDots = document.querySelectorAll('.ms-map-dot');
        
        // Remove all dot elements from DOM
        existingDots.forEach((dotElement, index) => {
            dotElement.remove();
        });
        
        // Also clear any dots that might be in map-content specifically
        const mapContent = document.getElementById('map-content');
        if (mapContent) {
            const mapContentDots = mapContent.querySelectorAll('.ms-map-dot');
            mapContentDots.forEach(dot => dot.remove());
        }
        
        // Clear dots from state
        this.appState.dotsByPage.clear();
        
        // Clear marker types
        this.appState.markerTypes = {};
        
        // Clear annotation lines
        this.appState.annotationLines.clear();
        
        // Reset counters and settings
        this.appState.nextInternalId = 1;
        this.appState.nextAnnotationId = 1;
        this.appState.dotSize = 1;
        this.appState.currentPdfPage = 1;
        this.appState.totalPages = 1;
        this.appState.pageLabels.clear();
        this.appState.recentSearches = [];
        this.appState.automapExactPhrase = true;
        this.appState.scrapeHorizontalTolerance = 10;
        this.appState.scrapeVerticalTolerance = 25;
        this.appState.showAnnotationEndpoints = true;
        this.appState.activeMarkerType = null;
        
        // Clear selection
        this.appState.selectedDots.clear();
        
        // Clear canvas
        const canvas = document.getElementById('pdf-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        
        // Clear undo history
        if (this.stateModule && this.stateModule.CommandUndoManager) {
            this.stateModule.CommandUndoManager.clear();
        }
        
        // CRITICAL: Clear location list DOM to prevent persistence
        const locationList = document.getElementById('location-list');
        if (locationList) {
            locationList.innerHTML = '';
        }
        
        // Update UI to reflect cleared state
        if (this.uiModule) {
            this.uiModule.updateFilterCheckboxes();
            this.uiModule.updateLocationList();
            this.uiModule.updatePageInfo();
        }
        
        // Final verification
        const remainingDots = document.querySelectorAll('.ms-map-dot');
        if (remainingDots.length > 0) {
            console.error('WARNING! Still found', remainingDots.length, 'dot elements after cleanup!');
        }
        
    }
    

    async importData(data) {
        if (!this.appState || !data) {
            console.log('🗺️ No mapping data to import');
            return;
        }
        
        
        // CRITICAL: Clear all existing data first with detailed logging
        this.clearAllData();
        
        // Reset dirty state when importing
        this.appState.isDirty = false;
        
        const stateToImport = data.appState || data;

        
        // Log details of each page's dots in the import data
        if (stateToImport.dotsByPage) {
            Object.entries(stateToImport.dotsByPage).forEach(([pageNum, pageData]) => {
                if (pageData.dots && pageData.dots.length > 0) {
                    pageData.dots.forEach((dot, index) => {
                    });
                }
            });
        }
        
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
        
        // Import annotation lines
        if (stateToImport.annotationLines) {
            this.appState.annotationLines = this.deserializeAnnotationLines(stateToImport.annotationLines);
        }
        
        // Import annotation endpoints setting
        if (stateToImport.showAnnotationEndpoints !== undefined) {
            this.appState.showAnnotationEndpoints = stateToImport.showAnnotationEndpoints;
        }
        
        // Update next annotation ID based on imported lines
        let maxAnnotationId = 0;
        this.appState.annotationLines.forEach(linesMap => {
            linesMap.forEach(line => {
                const idNum = parseInt(line.id.replace('annotation_', ''));
                if (idNum > maxAnnotationId) maxAnnotationId = idNum;
            });
        });
        this.appState.nextAnnotationId = maxAnnotationId + 1;
        
        // Set active marker type
        if (stateToImport.activeMarkerType) {
            this.appState.activeMarkerType = stateToImport.activeMarkerType;
        }
        
        // Set active marker type if not set
        if (this.appState.markerTypes && Object.keys(this.appState.markerTypes).length > 0 && !this.appState.activeMarkerType) {
            this.appState.activeMarkerType = Object.keys(this.appState.markerTypes)[0];
        }
        
        // Load PDF if available
        if (stateToImport.sourcePdfBase64) {
            try {
                
                // Convert base64 back to ArrayBuffer
                const binaryString = atob(stateToImport.sourcePdfBase64);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                // CRITICAL: This OVERWRITES the original PDF buffer!
                
                this.appState.sourcePdfBuffer = bytes.buffer;
                this.appState.sourcePdfName = stateToImport.sourcePdfName || 'imported.pdf';
                
                
                // POTENTIAL BUG: If we already have a valid PDF buffer from the .slayer file,
                // we shouldn't overwrite it with the base64 version which might be incomplete!
                // This could be why PDF buffer is "lost" when reference images are present.
                
                // Load the PDF document
                const loadingTask = pdfjsLib.getDocument({ data: this.appState.sourcePdfBuffer });
                this.appState.pdfDoc = await loadingTask.promise;
                this.appState.totalPages = this.appState.pdfDoc.numPages;
                
                // Clear PDF cache and render first page
                clearPDFCache();
                await renderPDFPage(this.appState.currentPdfPage || 1);
                
                // Hide upload area
                const uploadArea = document.getElementById('upload-area');
                if (uploadArea) {
                    uploadArea.style.display = 'none';
                }
                
                // Apply any saved crops
                if (this.cropTool) {
                    this.cropTool.applySavedCrop();
                }
                
                // Setup canvas event listeners
                setupCanvasEventListeners();
                setupMapInteraction();
                
                // Enable buttons
                this.enableButtons();
                
            } catch (e) {
            }
        } else if (!stateToImport.sourcePdfBase64 && !hasValidCurrentBuffer) {
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
        
        // Render annotation lines
        if (this.uiModule && this.uiModule.renderAnnotationLines) {
            this.uiModule.renderAnnotationLines();
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
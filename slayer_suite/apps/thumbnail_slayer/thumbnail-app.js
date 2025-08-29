// apps/thumbnail_slayer/thumbnail-app.js
import SlayerAppBase from '../../core/slayer-app-base.js';
import { thumbnailState, serializeState, deserializeState, resetState } from './thumbnail-state.js';
import * as UI from './thumbnail-ui.js';
import { setupDataListeners, getMockData, syncAllData } from './data-integration.js';
import { saveManager } from '../../core/save-manager.js';
import { thumbnailSyncAdapter } from './thumbnail-sync.js';
import { thumbnailSpreadsheet } from './thumbnail-spreadsheet.js';

class ThumbnailSlayerApp extends SlayerAppBase {
    constructor() {
        super('thumbnail_slayer', 'THUMBNAIL SLAYER', '1.0.0');
        this.eventHandlers = null;
        this.cssLoaded = false;
    }

    async activate() {
        console.log('🔄 Thumbnail Slayer activating...');

        // Load CSS if not already loaded
        if (!this.cssLoaded && this.isSuiteMode) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = './apps/thumbnail_slayer/thumbnail-slayer.css';
            link.id = 'thumbnail-slayer-css';
            document.head.appendChild(link);
            this.cssLoaded = true;
        }

        // Call parent activate
        await super.activate();

        // Check if we have cached state
        const hasCachedState = localStorage.getItem('thumbnail_slayer_state') !== null;

        // Load cached state from localStorage first
        if (hasCachedState) {
            console.log('🔄 Loading cached state...');
            this.loadCachedState();
        }

        // Auto-sync data when activating
        UI.showLoading(true);
        try {
            console.log('🔄 Auto-syncing data...');
            // Use sync adapter's fetchAllData to preserve flags
            if (this.syncAdapter && window.appBridge) {
                await this.syncAdapter.fetchAllData(window.appBridge);
                thumbnailState.lastSync = new Date().toISOString();

                // Only update UI and save if we got data or had no cached state
                const hasData = thumbnailState.locations && thumbnailState.locations.size > 0;
                if (hasData || !hasCachedState) {
                    UI.updateAllUI();
                    console.log('🔄 Sync complete via adapter, UI updated');

                    // Update spreadsheet column names with flag configuration
                    if (thumbnailSpreadsheet && thumbnailSpreadsheet.updateFlagColumnNames) {
                        const updated = thumbnailSpreadsheet.updateFlagColumnNames();
                        if (updated) {
                            console.log('📋 Updated spreadsheet flag column names');
                            thumbnailSpreadsheet.updateHeaderCells();
                        }
                    }

                    // Save state to localStorage after successful sync
                    this.saveCachedState();
                } else {
                    console.log('🔄 No data from Mapping Slayer, keeping cached state');
                    UI.updateAllUI();
                }
            } else {
                // Fallback to old method
                const result = await syncAllData();
                if (result.success) {
                    thumbnailState.lastSync = new Date().toISOString();
                    UI.updateAllUI();
                    console.log('🔄 Sync complete via legacy, UI updated');

                    // Save state to localStorage after successful sync
                    this.saveCachedState();
                }
            }
        } catch (error) {
            console.error('Auto-sync failed:', error);
        } finally {
            UI.showLoading(false);
        }
    }

    async deactivate() {
        // Save state before deactivating
        this.saveCachedState();

        // Remove CSS when deactivating
        if (this.cssLoaded && this.isSuiteMode) {
            const link = document.getElementById('thumbnail-slayer-css');
            if (link) {
                link.remove();
                this.cssLoaded = false;
            }
        }

        // Call parent deactivate
        await super.deactivate();
    }

    createAppContent() {
        const contentArea = this.getContentArea();

        contentArea.innerHTML = `
            <div class="thumbnail-slayer-app">
                <!-- Main Content Container -->
                <div class="main-content">
                    <!-- Split View Content with Resizer -->
                    <div class="split-view-container" id="split-container">
                    <!-- Left Panel: Spreadsheet -->
                    <div class="spreadsheet-panel" id="left-panel">
                        <div class="panel-section">
                            <div class="panel-header">
                                <h3>Sign Data Spreadsheet</h3>
                                <div class="panel-stats">
                                    <span class="stat-value" id="total-signs">0</span>
                                    <span class="stat-label">Total Signs</span>
                                </div>
                            </div>
                            <div class="spreadsheet-container">
                                <div class="spreadsheet-grid" id="spreadsheet-grid">
                                    <div class="empty-state">
                                        <div class="empty-text">No signs to display</div>
                                        <div class="empty-hint">Data will sync automatically from Mapping Slayer</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Resizer Handle -->
                    <div class="panel-resizer" id="panel-resizer"></div>
                    
                    <!-- Right Panel: Single Preview -->
                    <div class="thumbnails-panel" id="right-panel">
                        <div class="panel-section">
                            <div class="panel-header">
                                <h3 id="preview-title">Sign Preview</h3>
                                <div class="preview-toggle-controls">
                                    <button class="btn btn-compact" id="toggle-sign-preview" data-mode="sign">Thumbnail</button>
                                    <button class="btn btn-compact btn-secondary" id="toggle-map-preview" data-mode="map">Map Location</button>
                                </div>
                            </div>
                            <div class="preview-container" id="preview-container">
                                <div class="empty-state">
                                    <div class="empty-text">No sign selected</div>
                                    <div class="empty-hint">Click a row in the spreadsheet to preview</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    </div>
                </div>
                
                <!-- Loading Overlay -->
                <div class="loading-overlay" id="loading-overlay" style="display: none;">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Loading...</div>
                </div>
            </div>
        `;
    }

    async initialize(container, isSuiteMode) {
        await super.initialize(container, isSuiteMode);

        // Load Thumbnail Slayer specific styles only in standalone mode
        if (!isSuiteMode) {
            await this.loadAppStyles();
        }

        // Initialize functionality
        await this.initializeThumbnailFunctionality();
    }

    async loadAppStyles() {
        const link = document.createElement('link');
        link.id = 'thumbnail-slayer-css';
        link.rel = 'stylesheet';
        link.href = './apps/thumbnail_slayer/thumbnail-slayer.css';
        document.head.appendChild(link);

        // Wait for styles to load
        return new Promise(resolve => {
            link.onload = resolve;
            link.onerror = () => {
                console.error('Failed to load Thumbnail Slayer styles');
                resolve();
            };
        });
    }

    async initializeThumbnailFunctionality() {
        console.log('🖼️ Initializing Thumbnail Slayer functionality...');

        // Initialize sync adapter
        this.syncAdapter = thumbnailSyncAdapter;
        if (window.appBridge) {
            this.syncAdapter.initialize(window.appBridge);
        }

        // Setup event handlers
        this.setupEventHandlers();

        // Initialize UI
        UI.initializeUI(this.eventHandlers);

        // Initialize panel resizer
        this.initializePanelResizer();

        // Setup data listeners
        setupDataListeners();

        // Load mock data if in development
        if (!window.appBridge || window.location.hostname === 'localhost') {
            console.log('Loading mock data for development...');
            getMockData();
            UI.updateAllUI();
        }

        // Expose thumbnail app instance globally for renderer
        window.thumbnailApp = this;

        console.log('✅ Thumbnail Slayer functionality initialized');
    }

    setupEventHandlers() {
        this.eventHandlers = {
            onExport: () => {
                this.exportReport();
            }
        };
    }

    exportReport() {
        const items = Array.from(thumbnailState.productionItems.values());

        if (items.length === 0) {
            UI.showError('No signs to export');
            return;
        }

        // Generate CSV report
        const headers = ['Location', 'Message 1', 'Message 2', 'Type', 'Sheet'];
        const rows = items.map(item => [
            item.locationNumber,
            item.message1 || '',
            item.message2 || '',
            item.signType,
            item.sheetName
        ]);

        // Convert to CSV
        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sign_production_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        UI.showSuccess('Report exported successfully');
    }

    exportData() {
        return {
            version: this.version,
            thumbnailData: serializeState(),
            exported: new Date().toISOString()
        };
    }

    async importData(data) {
        if (!data || !data.thumbnailData) {
            console.log('🖼️ No thumbnail data to import');
            return;
        }

        // Reset and restore state
        resetState();
        deserializeState(data.thumbnailData);

        // Update all UI
        UI.updateAllUI();

        console.log('🖼️ Thumbnail data imported successfully');
    }

    async handleDataRequest(fromApp, query) {
        switch (query.type) {
            case 'get-production-status':
                // Return production status for all signs
                const statuses = {};
                thumbnailState.productionItems.forEach((item, id) => {
                    statuses[item.locationId] = item.status;
                });
                return { statuses };

            case 'get-sign-thumbnail':
                // Return thumbnail for a specific sign
                if (query.locationId) {
                    const item = Array.from(thumbnailState.productionItems.values()).find(
                        item => item.locationId === query.locationId
                    );
                    if (item) {
                        const { renderSignThumbnailSVG, svgToDataURL } = await import(
                            './sign-renderer-svg.js'
                        );
                        const svg = await renderSignThumbnailSVG(item, 400);
                        return {
                            thumbnail: svgToDataURL(svg),
                            status: item.status
                        };
                    }
                }
                return { error: 'Sign not found' };

            case 'get-available-fields':
                // Return available fields/columns from the spreadsheet
                return this.getAvailableFields();

            case 'get-first-sign-for-type':
                // Return first sign data for a specific sign type
                if (query.signTypeCode) {
                    const firstSign = Array.from(thumbnailState.productionItems.values()).find(
                        item =>
                            item.signTypeCode === query.signTypeCode ||
                            item.signType === query.signTypeCode
                    );
                    if (firstSign) {
                        return {
                            signData: {
                                message1: firstSign.message1 || firstSign.message || '',
                                message2: firstSign.message2 || '',
                                locationNumber: firstSign.locationNumber,
                                signType: firstSign.signType,
                                signTypeCode: firstSign.signTypeCode
                            }
                        };
                    }
                }
                return { signData: null };

            default:
                return { error: 'Unknown query type' };
        }
    }

    /**
     * Get available fields from the spreadsheet for use in Design Slayer
     * @returns {object} Object containing available fields
     */
    getAvailableFields() {
        if (!thumbnailSpreadsheet || !thumbnailSpreadsheet.columns) {
            return { fields: [] };
        }

        // Filter to text fields that can be used as dynamic content
        const availableFields = thumbnailSpreadsheet.columns
            .filter(
                col =>
                    col.editable &&
                    col.type === 'text' &&
                    col.id !== 'notes' && // Exclude notes - too long for signs
                    col.id !== 'signTypeCode' // Exclude sign type - not dynamic content
            )
            .map(col => ({
                id: col.id,
                name: col.name,
                displayName: col.name
            }));

        return {
            fields: availableFields,
            lastUpdated: new Date().toISOString()
        };
    }

    initializePanelResizer() {
        const resizer = document.getElementById('panel-resizer');
        const leftPanel = document.getElementById('left-panel');
        const rightPanel = document.getElementById('right-panel');
        const container = document.getElementById('split-container');

        if (!resizer || !leftPanel || !rightPanel || !container) return;

        let isResizing = false;
        let startX = 0;
        let startLeftWidth = 0;
        let startRightWidth = 0;

        // Get saved panel widths from localStorage
        const savedLeftWidth = localStorage.getItem('thumbnail-left-panel-width');
        if (savedLeftWidth) {
            leftPanel.style.flex = `0 0 ${savedLeftWidth}px`;
            rightPanel.style.flex = '1';
        }

        resizer.addEventListener('mousedown', e => {
            isResizing = true;
            startX = e.clientX;
            startLeftWidth = leftPanel.offsetWidth;
            startRightWidth = rightPanel.offsetWidth;
            container.classList.add('resizing');
            e.preventDefault();
        });

        document.addEventListener('mousemove', e => {
            if (!isResizing) return;

            const dx = e.clientX - startX;
            const newLeftWidth = startLeftWidth + dx;
            const containerWidth = container.offsetWidth;

            // Enforce minimum widths
            if (newLeftWidth >= 300 && newLeftWidth <= containerWidth - 200 - 4) {
                leftPanel.style.flex = `0 0 ${newLeftWidth}px`;
                rightPanel.style.flex = '1';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                container.classList.remove('resizing');

                // Save panel width to localStorage
                localStorage.setItem('thumbnail-left-panel-width', leftPanel.offsetWidth);

                // Trigger resize event for Tabulator to recalculate
                window.dispatchEvent(new Event('resize'));
            }
        });
    }

    /**
     * Save the current state to localStorage for persistence
     */
    saveCachedState() {
        try {
            const state = serializeState();
            localStorage.setItem('thumbnail_slayer_state', JSON.stringify(state));
            console.log('💾 Saved state to localStorage');
        } catch (error) {
            console.error('Failed to save state to localStorage:', error);
        }
    }

    /**
     * Load cached state from localStorage
     */
    loadCachedState() {
        try {
            const cachedState = localStorage.getItem('thumbnail_slayer_state');
            if (cachedState) {
                const state = JSON.parse(cachedState);
                deserializeState(state);
                console.log('💾 Loaded cached state from localStorage');
                UI.updateAllUI();
            }
        } catch (error) {
            console.error('Failed to load cached state from localStorage:', error);
        }
    }

    /**
     * Clear all cached data (for debugging)
     */
    clearCachedData() {
        try {
            localStorage.removeItem('thumbnail_slayer_state');
            localStorage.removeItem('thumbnail_slayer_flags');
            console.log('💾 Cleared all cached data from localStorage');
        } catch (error) {
            console.error('Failed to clear cached data:', error);
        }
    }
}

export default ThumbnailSlayerApp;

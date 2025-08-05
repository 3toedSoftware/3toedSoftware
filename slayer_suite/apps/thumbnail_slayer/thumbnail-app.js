// apps/thumbnail_slayer/thumbnail-app.js
import SlayerAppBase from '../../core/slayer-app-base.js';
import { thumbnailState, serializeState, deserializeState, resetState } from './thumbnail-state.js';
import * as UI from './thumbnail-ui.js';
import { setupDataListeners, getMockData, syncAllData } from './data-integration.js';
import { saveManager } from '../../core/save-manager.js';
import { thumbnailSyncAdapter } from './thumbnail-sync.js';

class ThumbnailSlayerApp extends SlayerAppBase {
    constructor() {
        super('thumbnail_slayer', 'THUMBNAIL SLAYER', '1.0.0');
        this.eventHandlers = null;
        this.cssLoaded = false;
    }

    async activate() {
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
        
        // Auto-sync data when activating
        UI.showLoading(true);
        try {
            const result = await syncAllData();
            if (result.success) {
                thumbnailState.lastSync = new Date().toISOString();
                UI.updateAllUI();
            }
        } catch (error) {
            console.error('Auto-sync failed:', error);
        } finally {
            UI.showLoading(false);
        }
    }

    async deactivate() {
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
                <!-- Top Bar -->
                <div class="top-bar">
                    <div class="filter-controls">
                        <div class="filter-group">
                            <label>Page:</label>
                            <select id="page-filter" class="filter-select">
                                <option value="all">All Pages</option>
                            </select>
                        </div>
                        
                        <div class="filter-group">
                            <label>Type:</label>
                            <select id="type-filter" class="filter-select">
                                <option value="all">All Types</option>
                            </select>
                        </div>
                        
                        
                        <div class="filter-group">
                            <label>Sort:</label>
                            <select id="sort-by" class="filter-select">
                                <option value="location">Location</option>
                                <option value="type">Type</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="view-controls">
                        <button class="view-btn active" id="grid-view-btn" title="Grid View">⊞</button>
                        <button class="view-btn" id="list-view-btn" title="List View">☰</button>
                    </div>
                </div>
                
                <!-- Main Content Area -->
                <div class="main-content">
                    <!-- Thumbnail Grid -->
                    <div class="thumbnail-grid" id="thumbnail-grid">
                        <div class="empty-state">
                            <div class="empty-icon">📋</div>
                            <div class="empty-text">No signs to display</div>
                            <div class="empty-hint">Click "Sync Data" to load signs from Mapping Slayer</div>
                        </div>
                    </div>
                    
                    <!-- List View -->
                    <div class="list-view" id="list-view" style="display: none;">
                        <!-- List table will be populated here -->
                    </div>
                    
                    <!-- Detail Panel -->
                    <div class="detail-panel" id="detail-panel" style="display: none;">
                        <!-- Sign details will be shown here -->
                    </div>
                </div>
                
                <!-- Bottom Bar -->
                <div class="bottom-bar">
                    <div class="stats-container">
                        <div class="stat-item">
                            <span class="stat-value" id="total-signs">0</span>
                            <span class="stat-label">Total Signs</span>
                        </div>
                    </div>
                    
                    
                    <div class="action-buttons">
                        <button class="btn btn-primary" id="export-btn">EXPORT REPORT</button>
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
        return new Promise((resolve) => {
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
                    const item = Array.from(thumbnailState.productionItems.values())
                        .find(item => item.locationId === query.locationId);
                    if (item) {
                        const { renderSignThumbnail, canvasToDataURL } = await import('./sign-renderer.js');
                        const canvas = await renderSignThumbnail(item, 400);
                        return {
                            thumbnail: canvasToDataURL(canvas),
                            status: item.status
                        };
                    }
                }
                return { error: 'Sign not found' };
                
            default:
                return { error: 'Unknown query type' };
        }
    }
}

export default ThumbnailSlayerApp;
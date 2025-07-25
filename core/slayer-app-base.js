// core/slayer-app-base.js
/**
 * Slayer App Base Class - Template for all Slayer Suite applications
 * Provides unified header, loading states, and core app lifecycle management
 */

import { appBridge, projectManager, BRIDGE_EVENTS, APP_STATUS, appLog, createAppData } from './index.js';

export default class SlayerAppBase {
    constructor(appName, displayName, version = '1.0.0') {
        this.appName = appName;              // e.g., 'mapping_slayer'
        this.displayName = displayName;      // e.g., 'MAPPING SLAYER'
        this.version = version;
        this.status = APP_STATUS.UNREGISTERED;
        this.container = null;
        this.isActive = false;
        
        // UI element references
        this.elements = {
            header: null,
            contentArea: null,
            loadingOverlay: null
        };
        
        // Loading state
        this.loadingState = {
            isLoading: false,
            currentOperation: null,
            progress: 0
        };
        
        // App-specific data (override in child classes)
        this.appData = {};
        
        appLog(this.appName, `App instance created: ${displayName} v${version}`);
    }

    /**
     * Initialize the app - creates UI structure and sets up core systems
     * Call this from child class after creating app-specific content
     */
    async initialize(container, isSuiteMode = false) {
        try {
            this.status = APP_STATUS.INITIALIZING;
            this.container = container;
            this.isSuiteMode = isSuiteMode;
            
            appLog(this.appName, 'Initializing base app structure...');
            
            if (!isSuiteMode) {
                // Create unified app structure only in standalone mode
                this.createAppStructure();
                
                // Load shared styles
                await this.loadSharedStyles();
                
                // Set up core event listeners
                this.setupCoreEventListeners();
            } else {
                // In suite mode, use the container directly as the content area
                this.elements.contentArea = this.container;
                // Make sure container has proper display style for content
                this.container.style.display = 'block';
            }
            
            // Call child class content creation
            this.createAppContent();
            
            // In suite mode, hide it after content creation (will be shown on activate)
            if (this.isSuiteMode) {
                this.container.style.display = 'none';
            }
            
            // Register with app bridge
            appBridge.register(this.appName, this);
            
            this.status = APP_STATUS.REGISTERED;
            appLog(this.appName, 'Base initialization complete');
            
        } catch (error) {
            this.status = APP_STATUS.ERROR;
            console.error(`${this.appName}: Base initialization failed:`, error);
            throw error;
        }
    }

    /**
     * Create the unified app structure with header and content area
     */
    createAppStructure() {
        this.container.className = 'slayer-app-container';
        this.container.innerHTML = `
            <!-- Unified Header -->
            <div class="slayer-header">
                <!-- User Menu -->
                <div class="user-menu">
                    <div class="user-icon">3T</div>
                    <div class="user-flyout">
                        <div class="flyout-item">👤 Profile Settings</div>
                        <div class="flyout-item">⚙️ Preferences</div>
                        <div class="flyout-item">📊 Usage Stats</div>
                        <div class="flyout-item">❓ Help & Support</div>
                        <div class="flyout-item">📄 Documentation</div>
                        <div class="flyout-item danger">🚪 Sign Out</div>
                    </div>
                </div>

                <!-- Logo Section -->
                <div class="logo-section">
                    <a href="#" class="suite-logo">SLAYER SUITE</a>
                    <span class="breadcrumb-separator">/</span>
                    <div class="app-logo">
                        <img src="../../shared/assets/MSLogo.svg" alt="App" class="app-icon" id="current-app-icon">
                        <span id="current-app-name">${this.displayName}</span>
                    </div>
                </div>

                <!-- App Navigation -->
                <div class="app-navigation">
                    <button class="app-nav-btn" data-app="mapping_slayer" data-tooltip="Mapping Slayer">MS</button>
                    <button class="app-nav-btn" data-app="survey_slayer" data-tooltip="Survey Slayer">SS</button>
                    <button class="app-nav-btn" data-app="design_slayer" data-tooltip="Design Slayer">DS</button>
                    <button class="app-nav-btn" data-app="thumbnail_slayer" data-tooltip="Thumbnail Slayer">TS</button>
                    <button class="app-nav-btn" data-app="production_slayer" data-tooltip="Production Slayer">PS</button>
                    <button class="app-nav-btn" data-app="install_slayer" data-tooltip="Install Slayer">IS</button>
                    <button class="app-nav-btn" data-app="workflow_slayer" data-tooltip="Workflow Slayer">WS</button>
                </div>

                <!-- Project Info -->
                <div class="project-info">
                    <div class="project-name" id="project-name">No Project</div>
                    <div class="project-status">
                        <span class="status-dot status-saved" id="status-dot"></span>
                        <span id="status-text">Saved</span>
                    </div>
                </div>

                <!-- Save/Load Section -->
                <div class="save-load-section">
                    <button class="header-btn header-btn-secondary" id="load-btn">LOAD</button>
                    <button class="header-btn header-btn-primary" id="save-btn">SAVE</button>
                </div>
            </div>

            <!-- App Content Area -->
            <div class="app-content-area" id="app-content">
                <!-- Child apps will populate this area -->
            </div>

            <!-- Loading Overlay -->
            <div class="loading-overlay" id="loading-overlay">
                <div class="loading-container">
                    <div class="loading-app-logo" id="loading-logo">${this.getAppCode()}</div>
                    <div class="loading-title" id="loading-title">Loading ${this.displayName}</div>
                    <div class="loading-subtitle" id="loading-subtitle">Initializing...</div>
                    
                    <div class="progress-container">
                        <div class="progress-bar" id="progress-bar"></div>
                    </div>
                    
                    <div class="progress-text">
                        <span id="progress-text">Preparing app...</span>
                        <span class="progress-percentage" id="progress-percent">0%</span>
                    </div>
                    
                    <div class="loading-activity" id="activity-feed"></div>
                    
                    <button class="loading-cancel" id="cancel-loading" style="display: none;">Cancel</button>
                </div>
            </div>
        `;

        // Store element references
        this.elements.header = this.container.querySelector('.slayer-header');
        this.elements.contentArea = this.container.querySelector('#app-content');
        this.elements.loadingOverlay = this.container.querySelector('#loading-overlay');
        
        // Set active app button
        this.updateActiveAppButton();
    }

    /**
     * Load shared styles for unified header and loading states
     */
    async loadSharedStyles() {
        const styleId = 'slayer-shared-styles';
        if (document.getElementById(styleId)) return; // Already loaded

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* Slayer Suite Unified Styles */
            .slayer-app-container {
                height: 100vh;
                display: flex;
                flex-direction: column;
                background: #1B1C1D;
                color: #ffffff;
                font-family: Helvetica, Arial, sans-serif;
            }

            /* Header Styles */
            .slayer-header {
                background: #333537;
                display: flex;
                align-items: center;
                padding: 0 20px;
                border-bottom: 1px solid #555;
                height: 60px;
                flex-shrink: 0;
            }

            .user-menu { position: relative; margin-right: 30px; }
            .user-icon {
                width: 40px; height: 40px; border-radius: 50%; background: #f07727;
                display: flex; align-items: center; justify-content: center; cursor: pointer;
                font-weight: bold; font-size: 14px; transition: all 0.3s ease;
            }
            .user-icon:hover { background: #e55a00; transform: scale(1.05); }
            .user-flyout {
                position: absolute; top: 50px; left: 0; background: #2a2a2a;
                border: 1px solid #555; border-radius: 6px; min-width: 200px;
                opacity: 0; visibility: hidden; transform: translateY(-10px);
                transition: all 0.3s ease; z-index: 1000;
            }
            .user-menu:hover .user-flyout {
                opacity: 1; visibility: visible; transform: translateY(0);
            }
            .flyout-item {
                padding: 12px 16px; border-bottom: 1px solid #444; cursor: pointer;
                transition: background 0.2s; font-size: 14px;
            }
            .flyout-item:hover { background: #3a3a3a; }
            .flyout-item:last-child { border-bottom: none; }
            .flyout-item.danger:hover { background: #5a2626; color: #ff6b6b; }

            .logo-section { display: flex; align-items: center; gap: 15px; margin-right: 30px; min-width: 400px; }
            .suite-logo { font-size: 20px; font-weight: bold; color: #f07727; text-decoration: none; }
            .breadcrumb-separator { color: #666; font-size: 20px; }
            .app-logo { font-size: 20px; font-weight: bold; color: #ccc; display: flex; align-items: center; gap: 8px; }
            .app-icon { width: 24px; height: 24px; }

            .app-navigation { display: flex; gap: 8px; margin-right: auto; }
            .app-nav-btn {
                width: 40px; height: 40px; border: none; border-radius: 6px; cursor: pointer;
                font-weight: bold; font-size: 12px; transition: all 0.3s ease;
                display: flex; align-items: center; justify-content: center;
                background: #555; color: #ccc; position: relative; flex-shrink: 0;
            }
            .app-nav-btn:hover { background: #666; color: #fff; transform: translateY(-2px); }
            .app-nav-btn.active { background: #f07727; color: #ffffff; box-shadow: 0 0 10px rgba(240, 119, 39, 0.5); }
            .app-nav-btn.disabled { background: #444; color: #666; cursor: not-allowed; opacity: 0.6; }
            .app-nav-btn.disabled:hover { transform: none; background: #444; }

            .project-info { display: flex; flex-direction: column; align-items: flex-end; font-size: 10px; color: #aaa; margin-right: 15px; }
            .project-name { font-weight: bold; color: #ccc; }
            .project-status { margin-top: 2px; }
            .status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 4px; }
            .status-saved { background: #00b360; }
            .status-unsaved { background: #f07727; }

            .save-load-section { display: flex; gap: 12px; align-items: center; }
            .header-btn {
                padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer;
                font-weight: bold; font-size: 12px; transition: all 0.3s ease;
                display: flex; align-items: center; gap: 6px;
            }
            .header-btn-primary { background: #f07727; color: #ffffff; }
            .header-btn-primary:hover { background: #e55a00; transform: translateY(-1px); }
            .header-btn-secondary { background: #6c757d; color: white; }
            .header-btn-secondary:hover { background: #5a6268; transform: translateY(-1px); }
            .header-btn:disabled { background: #444; color: #666; cursor: not-allowed; opacity: 0.6; }

            /* Content Area */
            .app-content-area {
                flex: 1;
                overflow: hidden;
                position: relative;
            }

            /* Loading Overlay Styles */
            .loading-overlay {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(27, 28, 29, 0.95); backdrop-filter: blur(5px);
                display: flex; align-items: center; justify-content: center; z-index: 10000;
                opacity: 0; visibility: hidden; transition: all 0.3s ease;
            }
            .loading-overlay.visible { opacity: 1; visibility: visible; }
            .loading-container {
                text-align: center; max-width: 400px; padding: 40px;
                background: #333537; border-radius: 12px; border: 1px solid #555;
            }
            .loading-app-logo {
                width: 80px; height: 80px; margin: 0 auto 20px; background: #f07727;
                border-radius: 50%; display: flex; align-items: center; justify-content: center;
                font-size: 24px; font-weight: bold; color: white; animation: pulse 2s ease-in-out infinite;
            }
            @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.05); opacity: 0.8; } }
            .loading-title { font-size: 24px; font-weight: bold; color: #f07727; margin-bottom: 8px; }
            .loading-subtitle { font-size: 16px; color: #ccc; margin-bottom: 30px; }
            .progress-container {
                background: #2a2a2a; border-radius: 20px; height: 8px; margin-bottom: 20px;
                overflow: hidden; border: 1px solid #444;
            }
            .progress-bar {
                height: 100%; background: linear-gradient(90deg, #f07727, #ff8c42);
                border-radius: 20px; width: 0%; transition: width 0.3s ease;
            }
            .progress-text { font-size: 14px; color: #aaa; margin-bottom: 15px; }
            .progress-percentage { font-size: 12px; color: #f07727; font-weight: bold; }
            .loading-activity {
                text-align: left; background: #2a2a2a; border-radius: 6px; padding: 15px;
                max-height: 120px; overflow-y: auto; border: 1px solid #444;
            }
            .loading-cancel {
                margin-top: 20px; padding: 8px 16px; background: transparent;
                border: 2px solid #666; color: #ccc; border-radius: 6px; cursor: pointer;
                font-size: 12px; transition: all 0.3s ease;
            }
            .loading-cancel:hover { border-color: #f07727; color: #f07727; }
        `;
        document.head.appendChild(style);
    }

    /**
     * Set up core event listeners for header interactions
     */
    setupCoreEventListeners() {
        // App navigation buttons
        this.container.querySelectorAll('.app-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetApp = btn.dataset.app;
                if (targetApp && !btn.classList.contains('disabled')) {
                    this.switchToApp(targetApp);
                }
            });
        });

        // Save/Load buttons
        this.container.querySelector('#save-btn').addEventListener('click', () => {
            this.saveProject();
        });

        this.container.querySelector('#load-btn').addEventListener('click', () => {
            this.loadProject();
        });

        // Cancel loading
        this.container.querySelector('#cancel-loading').addEventListener('click', () => {
            this.hideLoading();
        });

        // Listen for project status changes
        appBridge.subscribe(BRIDGE_EVENTS.PROJECT_DIRTY, () => {
            this.updateProjectStatus(true);
        });

        appBridge.subscribe(BRIDGE_EVENTS.PROJECT_SAVED, () => {
            this.updateProjectStatus(false);
        });
    }

    /**
     * App Lifecycle Methods (Override in child classes)
     */
    async activate() {
        try {
            this.isActive = true;
            this.status = APP_STATUS.ACTIVE;
            this.container.style.display = 'block';
            
            if (!this.isSuiteMode) {
                this.updateActiveAppButton();
            }
            
            appLog(this.appName, 'App activated');
            
        } catch (error) {
            this.status = APP_STATUS.ERROR;
            console.error(`${this.appName}: Activation failed:`, error);
        }
    }

    async deactivate() {
        try {
            this.isActive = false;
            this.status = APP_STATUS.INACTIVE;
            this.container.style.display = 'none';
            
            appLog(this.appName, 'App deactivated');
            
        } catch (error) {
            console.error(`${this.appName}: Deactivation failed:`, error);
        }
    }

    exportData() {
        return createAppData(this.version, this.appData);
    }

    async importData(data) {
        this.appData = data || {};
        appLog(this.appName, 'Data imported');
    }

    async handleDataRequest(fromApp, query) {
        appLog(this.appName, `Data request from ${fromApp}:`, query);
        return { status: 'not-implemented', appName: this.appName };
    }

    /**
     * Loading State Management
     */
    showLoading(title = null, subtitle = null, showCancel = false) {
        const overlay = this.elements.loadingOverlay;
        const titleEl = overlay.querySelector('#loading-title');
        const subtitleEl = overlay.querySelector('#loading-subtitle');
        const cancelBtn = overlay.querySelector('#cancel-loading');
        
        titleEl.textContent = title || `Loading ${this.displayName}`;
        subtitleEl.textContent = subtitle || 'Preparing app...';
        cancelBtn.style.display = showCancel ? 'block' : 'none';
        
        overlay.classList.add('visible');
        this.loadingState.isLoading = true;
    }

    hideLoading() {
        this.elements.loadingOverlay.classList.remove('visible');
        this.loadingState.isLoading = false;
        this.loadingState.progress = 0;
    }

    updateProgress(percentage, text = null, activity = null) {
        if (!this.loadingState.isLoading) return;
        
        const progressBar = this.elements.loadingOverlay.querySelector('#progress-bar');
        const progressText = this.elements.loadingOverlay.querySelector('#progress-text');
        const progressPercent = this.elements.loadingOverlay.querySelector('#progress-percent');
        
        progressBar.style.width = `${percentage}%`;
        progressPercent.textContent = `${percentage}%`;
        
        if (text) {
            progressText.textContent = text;
        }
        
        if (activity) {
            this.addActivityItem(activity);
        }
    }

    addActivityItem(text) {
        const activityFeed = this.elements.loadingOverlay.querySelector('#activity-feed');
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <span style="color: #f07727; margin-right: 8px;">⚡</span>
            <span style="font-size: 12px; color: #ccc;">${text}</span>
            <span style="margin-left: auto; font-size: 10px; color: #666;">${Date.now() % 10000}ms</span>
        `;
        
        activityFeed.appendChild(item);
        
        // Keep only last 4 items
        while (activityFeed.children.length > 4) {
            activityFeed.removeChild(activityFeed.firstChild);
        }
        
        activityFeed.scrollTop = activityFeed.scrollHeight;
    }

    /**
     * Header Management
     */
    updateActiveAppButton() {
        this.container.querySelectorAll('.app-nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.app === this.appName) {
                btn.classList.add('active');
            }
        });
    }

    updateProjectStatus(isDirty) {
        const statusDot = this.container.querySelector('#status-dot');
        const statusText = this.container.querySelector('#status-text');
        
        if (statusDot && statusText) {
            if (isDirty) {
                statusDot.className = 'status-dot status-unsaved';
                statusText.textContent = 'Unsaved Changes';
            } else {
                statusDot.className = 'status-dot status-saved';
                statusText.textContent = 'Saved';
            }
        }
    }

    updateProjectName(name) {
        const projectNameEl = this.container.querySelector('#project-name');
        if (projectNameEl) {
            projectNameEl.textContent = name || 'No Project';
        }
    }

    /**
     * Navigation Methods
     */
    async switchToApp(appName) {
        await appBridge.switchToApp(appName);
    }

    async saveProject() {
        await projectManager.save();
    }

    async loadProject() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.slayer';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                await projectManager.load(file);
            }
        };
        input.click();
    }

    /**
     * Utility Methods
     */
    getAppCode() {
        // Extract app code from app name (e.g., 'mapping_slayer' -> 'MS')
        return this.appName.split('_').map(word => word[0].toUpperCase()).join('');
    }

    getContentArea() {
        return this.elements.contentArea;
    }

    /**
     * Child classes should override this to create their specific content
     */
    createAppContent() {
        // Override in child classes
        this.elements.contentArea.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #666;">
                <h2 style="color: #f07727;">${this.displayName}</h2>
                <p>Override createAppContent() in your app class to add functionality.</p>
            </div>
        `;
    }
}
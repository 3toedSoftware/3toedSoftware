/**
 * Save Manager for Slayer Suite
 * Implements context-aware save/load for individual apps
 */

import { appBridge } from './app-bridge.js';

// File extension mapping for each app
const FILE_EXTENSIONS = {
    'mapping_slayer': '.mslay',
    'design_slayer': '.dslay',
    'survey_slayer': '.sslay',
    'thumbnail_slayer': '.tslay',
    'production_slayer': '.pslay',
    'install_slayer': '.islay',
    'workflow_slayer': '.wslay'
};

// Reverse mapping for loading
const EXTENSION_TO_APP = {
    'mslay': 'mapping_slayer',
    'dslay': 'design_slayer',
    'sslay': 'survey_slayer',
    'tslay': 'thumbnail_slayer',
    'pslay': 'production_slayer',
    'islay': 'install_slayer',
    'wslay': 'workflow_slayer'
};

class SaveManager {
    constructor() {
        this.currentProjectName = 'Untitled';
        this.lastSavedFile = null;
    }

    /**
     * Initialize the save manager
     */
    async initialize() {
        // Set up save/load button handlers
        this.setupEventHandlers();
        
        console.log('💾 Save Manager initialized (context-aware mode)');
    }

    /**
     * Setup event handlers for save/load buttons
     */
    setupEventHandlers() {
        const saveBtn = document.getElementById('save-project-btn');
        const loadBtn = document.getElementById('load-project-btn');
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveActiveApp());
        }
        
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.loadProject());
        }
    }

    /**
     * Save the currently active app's data
     */
    async saveActiveApp() {
        console.log('💾 Starting context-aware save...');
        
        // Get the active app
        const activeApp = appBridge.activeApp;
        if (!activeApp) {
            console.warn('⚠️ No active app to save');
            this.showMessage('Please select an app first');
            return;
        }

        const appName = appBridge.getAppName(activeApp);
        console.log(`💾 Saving ${appName}...`);
        
        const saveBtn = document.getElementById('save-project-btn');
        const originalText = saveBtn?.textContent || 'SAVE';
        if (saveBtn) saveBtn.textContent = 'SAVING...';
        
        try {
            // Get data from the active app only
            const appData = await activeApp.exportData();
            
            if (!appData) {
                throw new Error('No data to save');
            }
            
            // Create save data structure
            const saveData = {
                appType: appName,
                version: activeApp.version,
                projectName: this.currentProjectName,
                data: appData,
                saved: new Date().toISOString()
            };
            
            // Create the save file
            const file = this.createSaveFile(saveData);
            
            // Generate filename with proper extension
            const extension = FILE_EXTENSIONS[appName] || '.save';
            const filename = this.generateFilename(this.currentProjectName, extension);
            
            // Download the file
            this.downloadFile(file, filename);
            
            // Update UI
            this.updateSaveStatus('saved');
            this.lastSavedFile = filename;
            
            console.log(`✅ ${appName} saved successfully as ${filename}`);
            
        } catch (error) {
            console.error('❌ Save failed:', error);
            this.showError(`Failed to save ${appName}: ${error.message}`);
        } finally {
            if (saveBtn) saveBtn.textContent = originalText;
        }
    }

    /**
     * Load a project file
     */
    async loadProject() {
        const input = document.createElement('input');
        input.type = 'file';
        
        // Accept all app file types
        const extensions = Object.values(FILE_EXTENSIONS).join(',');
        input.accept = extensions;
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                // Detect app type from file extension
                const ext = file.name.split('.').pop().toLowerCase();
                const targetAppName = EXTENSION_TO_APP[ext];
                
                if (!targetAppName) {
                    throw new Error(`Unknown file type: .${ext}`);
                }
                
                console.log(`📂 Loading ${targetAppName} file: ${file.name}`);
                
                // Read file content
                const content = await this.readFile(file);
                const projectData = JSON.parse(content);
                
                // Validate file structure
                if (!projectData.data) {
                    throw new Error('Invalid file format');
                }
                
                // Check if we need to switch apps
                const activeApp = appBridge.activeApp;
                const currentAppName = activeApp ? appBridge.getAppName(activeApp) : null;
                
                if (currentAppName !== targetAppName) {
                    console.log(`🔄 Switching to ${targetAppName}...`);
                    await window.slayerSuite.switchToApp(targetAppName);
                    
                    // Wait a bit for app to fully load
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
                // Get the target app
                const apps = appBridge.getRegisteredAppInstances();
                const targetApp = apps[targetAppName];
                
                if (!targetApp) {
                    throw new Error(`${targetAppName} is not available`);
                }
                
                // Import the data
                // The projectData.data contains what exportData() returned
                await targetApp.importData(projectData.data);
                
                // Update project info
                this.currentProjectName = projectData.projectName || this.extractProjectName(file.name);
                this.updateProjectName(this.currentProjectName);
                this.updateSaveStatus('saved');
                
                console.log(`✅ Loaded ${targetAppName} project: ${this.currentProjectName}`);
                
            } catch (error) {
                console.error('❌ Failed to load project:', error);
                this.showError(`Failed to load project: ${error.message}`);
            }
        };
        
        input.click();
    }

    /**
     * Create the save file blob
     */
    createSaveFile(saveData) {
        const jsonStr = JSON.stringify(saveData, null, 2);
        return new Blob([jsonStr], { type: 'application/json' });
    }

    /**
     * Generate filename with proper extension
     */
    generateFilename(projectName, extension) {
        const safeName = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const timestamp = new Date().toISOString().slice(0, 10);
        return `${safeName}_${timestamp}${extension}`;
    }

    /**
     * Extract project name from filename
     */
    extractProjectName(filename) {
        // Remove extension and date
        let name = filename.replace(/\.[^/.]+$/, '');
        name = name.replace(/_\d{4}-\d{2}-\d{2}$/, '');
        name = name.replace(/_/g, ' ');
        
        // Capitalize words
        return name.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Download file to user's computer
     */
    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Read file content
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    /**
     * Update save status in UI
     */
    updateSaveStatus(status) {
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        
        if (statusDot && statusText) {
            switch (status) {
                case 'saved':
                    statusDot.className = 'status-dot status-saved';
                    statusText.textContent = 'Saved';
                    break;
                case 'unsaved':
                    statusDot.className = 'status-dot status-unsaved';
                    statusText.textContent = 'Unsaved';
                    break;
            }
        }
    }

    /**
     * Update project name in UI
     */
    updateProjectName(name) {
        const projectNameEl = document.getElementById('project-name');
        if (projectNameEl) {
            projectNameEl.textContent = name;
        }
        this.currentProjectName = name;
    }

    /**
     * Show a message to the user
     */
    showMessage(message) {
        // For now, just alert - in future, create proper notification
        alert(message);
    }

    /**
     * Show an error to the user
     */
    showError(error) {
        // For now, just alert - in future, create proper error modal
        alert(error);
    }

    /**
     * Set the current project name
     */
    setProjectName(name) {
        this.currentProjectName = name;
        this.updateProjectName(name);
    }

    /**
     * Mark the current state as unsaved
     */
    markUnsaved() {
        this.updateSaveStatus('unsaved');
    }
}

// Create and export singleton instance
export const saveManager = new SaveManager();
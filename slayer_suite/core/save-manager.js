/**
 * Save Manager for Slayer Suite with Persistent Permissions
 * Handles saving and loading .slayer files with File System Access API
 */

import { appBridge } from './app-bridge.js';
import { fileHandleStore } from './file-handle-store.js';

class SaveManager {
    constructor() {
        this.projectName = 'untitled';
        this.fileHandle = null; // File System Access API handle
        this.hasUnsavedChanges = false;
        this.autosaveInterval = null;
        this.autosaveEnabled = false;
        this.fileHandleKey = 'current-project'; // Key for IndexedDB storage
    }

    /**
     * Initialize the save manager
     */
    async initialize() {
        this.setupEventHandlers();
        
        // Initialize file handle store but DON'T restore file handle
        // This ensures save button stays disabled until explicit Save As
        try {
            console.log('🐛 Initializing fileHandleStore...');
            await fileHandleStore.init();
            console.log('🐛 FileHandleStore initialized');
            
            // Clear any stored file handle to ensure fresh start
            await fileHandleStore.delete(this.fileHandleKey);
            console.log('🐛 Cleared any stored file handle - starting fresh');
            
            // Explicitly set fileHandle to null
            this.fileHandle = null;
        } catch (err) {
            console.log('🐛 Could not initialize file handle store:', err);
        }
        
        console.log('💾 Save Manager initialized');
    }

    /**
     * Setup event handlers for save/load buttons
     */
    setupEventHandlers() {
        const saveBtn = document.getElementById('save-project-btn');
        const saveAsBtn = document.getElementById('save-as-project-btn');
        const loadBtn = document.getElementById('load-project-btn');
        const autosaveCheckbox = document.getElementById('autosave-checkbox');
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.save());
        }
        
        if (saveAsBtn) {
            saveAsBtn.addEventListener('click', () => this.saveAs());
        }
        
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.load());
        }
        
        if (autosaveCheckbox) {
            autosaveCheckbox.addEventListener('change', (e) => this.toggleAutosave(e.target.checked));
        }
        
        // Listen for project dirty state
        appBridge.subscribe('project:dirty', () => {
            this.hasUnsavedChanges = true;
            this.updateSaveButton();
        });
        
        appBridge.subscribe('project:saved', () => {
            this.hasUnsavedChanges = false;
            this.updateSaveButton();
        });
        
        // Initial button state
        this.updateSaveButton();
    }

    /**
     * Verify we have permission to write to the file
     */
    async verifyPermission(fileHandle, withWrite = true) {
        console.log('🐛 verifyPermission called for:', fileHandle.name);
        console.log('🐛 withWrite:', withWrite);
        
        const options = {};
        if (withWrite) {
            options.mode = 'readwrite';
        }
        
        console.log('🐛 Permission options:', options);
        
        // Check if we already have permission
        const queryResult = await fileHandle.queryPermission(options);
        console.log('🐛 queryPermission result:', queryResult);
        
        if (queryResult === 'granted') {
            console.log('🐛 Permission already granted');
            return true;
        }
        
        console.log('🐛 Permission not granted, requesting...');
        
        // Request permission (this may show a dialog)
        // In Chrome 122+, users can choose "Allow on every visit" for persistent permission
        const requestResult = await fileHandle.requestPermission(options);
        console.log('🐛 requestPermission result:', requestResult);
        
        if (requestResult === 'granted') {
            console.log('🐛 Permission granted after request');
            return true;
        }
        
        console.log('🐛 Permission denied');
        return false;
    }

    /**
     * Save project to .slayer file
     */
    async save() {
        console.log('🐛 DEBUG BEAST: save() method called');
        console.log('🐛 Current fileHandle:', this.fileHandle);
        console.log('🐛 fileHandle type:', this.fileHandle ? this.fileHandle.constructor.name : 'null');
        
        // If no file has been saved yet, do Save As
        if (!this.fileHandle) {
            console.log('🐛 No fileHandle found, redirecting to saveAs()');
            return this.saveAs();
        }
        
        console.log('🐛 fileHandle exists, proceeding with silent save...');
        
        const saveBtn = document.getElementById('save-project-btn');
        const originalText = saveBtn ? saveBtn.textContent : 'SAVE';
        if (saveBtn) saveBtn.textContent = 'SAVING...';
        
        try {
            // Get data from all apps
            const projectData = await appBridge.getProjectData();
            
            // Create save data
            const saveData = {
                type: 'slayer_suite_project',
                version: '1.0',
                saved: new Date().toISOString(),
                projectName: this.projectName,
                apps: projectData.apps
            };
            
            // Convert to JSON
            const jsonString = JSON.stringify(saveData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            
            // Use File System Access API for silent save
            try {
                console.log('🐛 About to verify permissions for fileHandle:', this.fileHandle.name);
                
                // Verify permission first
                if (!await this.verifyPermission(this.fileHandle)) {
                    console.warn('🐛 Permission denied for file handle');
                    // Permission denied - need to use Save As
                    this.fileHandle = null;
                    await fileHandleStore.delete(this.fileHandleKey);
                    console.log('🐛 Permissions failed, redirecting to saveAs()');
                    return this.saveAs();
                }
                
                console.log('🐛 Permissions verified, proceeding with write...');
                
                const writable = await this.fileHandle.createWritable();
                console.log('🐛 Writable stream created');
                await writable.write(blob);
                console.log('🐛 Data written to stream');
                await writable.close();
                console.log('🐛 Stream closed');
                
                // Store the file handle for future use
                await fileHandleStore.set(this.fileHandleKey, this.fileHandle);
                console.log('🐛 FileHandle stored in IndexedDB');
                
                console.log('✅ Silent save successful');
            } catch (err) {
                console.error('Silent save failed:', err);
                // Only show error, don't fall back to download
                alert('Unable to save to the file. The file may have been moved or deleted.');
                throw err;
            }
            
            console.log('✅ Project saved successfully');
            
            // Mark as saved
            this.hasUnsavedChanges = false;
            appBridge.broadcast('project:saved');
            
        } catch (error) {
            console.error('❌ Save failed:', error);
            alert(`Failed to save project: ${error.message}`);
        } finally {
            if (saveBtn) saveBtn.textContent = originalText;
        }
    }

    /**
     * Load project from .slayer file
     */
    async load() {
        console.log('🐛 DEBUG: load() called');
        console.log('🐛 showOpenFilePicker available?', 'showOpenFilePicker' in window);
        
        // Try to use File System Access API for loading
        if ('showOpenFilePicker' in window) {
            console.log('🐛 Using File System Access API for loading');
            try {
                const [fileHandle] = await window.showOpenFilePicker({
                    types: [{
                        description: 'Slayer Project',
                        accept: { 'application/json': ['.slayer'] }
                    }],
                    multiple: false
                });
                
                const file = await fileHandle.getFile();
                console.log('🐛 File selected via File System Access API:', file.name);
                
                this.fileHandle = fileHandle; // Save handle for later silent saves
                console.log('🐛 FileHandle saved to this.fileHandle:', this.fileHandle);
                console.log('🐛 FileHandle type:', this.fileHandle.constructor.name);
                
                // Store the file handle for persistent access
                await fileHandleStore.set(this.fileHandleKey, fileHandle);
                console.log('🐛 FileHandle stored in IndexedDB with key:', this.fileHandleKey);
                
                await this.loadFile(file);
                return;
            } catch (err) {
                if (err.name === 'AbortError') {
                    return; // User cancelled
                }
                // Fall back to regular input if API fails
                console.log('🐛 File System Access API failed, error:', err);
                console.log('🐛 Using fallback file input method');
            }
        }
        
        // Fallback for browsers without File System Access API
        console.log('🐛 Creating fallback file input (no silent save possible)');
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.slayer';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            console.log('🐛 File selected via fallback method:', file.name);
            this.fileHandle = null; // No handle available with regular input
            console.log('🐛 fileHandle set to null (fallback method cannot do silent saves)');
            await this.loadFile(file);
        };
        
        input.click();
    }
    
    /**
     * Load a file
     */
    async loadFile(file) {
            
            const loadBtn = document.getElementById('load-project-btn');
            const originalText = loadBtn ? loadBtn.textContent : 'LOAD';
            if (loadBtn) loadBtn.textContent = 'LOADING...';
            
            try {
                // Read file
                const text = await file.text();
                const projectData = JSON.parse(text);
                
                // Validate file - support both formats for compatibility
                const isValidFormat = (
                    (projectData.type && projectData.type.includes('slayer')) ||
                    (projectData.fileType && projectData.fileType.includes('slayer'))
                );
                
                if (!isValidFormat) {
                    throw new Error('Invalid slayer file format');
                }
                
                // Extract apps data based on format
                let appsData;
                if (projectData.apps) {
                    // save-manager format
                    appsData = projectData;
                } else if (projectData.project && projectData.project.apps) {
                    // project-manager format
                    appsData = projectData.project;
                } else {
                    throw new Error('Invalid slayer file - no apps data found');
                }
                
                // Load data into apps
                const results = await appBridge.loadProjectData(appsData);
                
                // Update project name from filename
                this.projectName = file.name.replace('.slayer', '');
                // Note: fileHandle is set in load() method when using File System Access API
                this.updateProjectDisplay();
                
                // Switch to first successfully loaded app
                if (results.success.length > 0) {
                    await window.slayerSuite.switchToApp(results.success[0]);
                }
                
                console.log('✅ Project loaded successfully');
                
            } catch (error) {
                console.error('❌ Load failed:', error);
                alert(`Failed to load project: ${error.message}`);
            } finally {
                if (loadBtn) loadBtn.textContent = originalText;
            }
    }

    /**
     * Save As - always shows file dialog
     */
    async saveAs() {
        const saveAsBtn = document.getElementById('save-as-project-btn');
        const originalText = saveAsBtn ? saveAsBtn.textContent : 'SAVE AS';
        if (saveAsBtn) saveAsBtn.textContent = 'SAVING...';
        
        try {
            // Get data from all apps
            const projectData = await appBridge.getProjectData();
            
            // Create save data
            const saveData = {
                type: 'slayer_suite_project',
                version: '1.0',
                saved: new Date().toISOString(),
                projectName: this.projectName,
                apps: projectData.apps
            };
            
            // Convert to JSON
            const jsonString = JSON.stringify(saveData, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            
            // Try to use File System Access API
            if ('showSaveFilePicker' in window) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: `${this.projectName}.slayer`,
                        types: [{
                            description: 'Slayer Project',
                            accept: { 'application/json': ['.slayer'] }
                        }]
                    });
                    
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    
                    // Save the handle and update project name
                    this.fileHandle = handle;
                    this.projectName = handle.name.replace('.slayer', '');
                    this.updateProjectDisplay();
                    
                    // Store the file handle for persistent access
                    await fileHandleStore.set(this.fileHandleKey, handle);
                    
                } catch (err) {
                    if (err.name !== 'AbortError') {
                        console.error('Save picker failed:', err);
                        // Fall back to download
                        this.downloadFile(blob);
                    }
                    return; // User cancelled
                }
            } else {
                // Fall back to download for browsers without File System Access API
                this.downloadFile(blob);
            }
            
            console.log('✅ Project saved successfully');
            
            // Mark as saved
            this.hasUnsavedChanges = false;
            appBridge.broadcast('project:saved');
            
        } catch (error) {
            console.error('❌ Save failed:', error);
            alert(`Failed to save project: ${error.message}`);
        } finally {
            if (saveAsBtn) saveAsBtn.textContent = originalText;
        }
    }
    
    /**
     * Update project name display
     */
    updateProjectDisplay() {
        const display = document.getElementById('project-name-display');
        if (display) {
            display.textContent = this.projectName || 'No project loaded';
        }
    }
    
    /**
     * Toggle autosave
     */
    toggleAutosave(enabled) {
        this.autosaveEnabled = enabled;
        
        if (enabled) {
            // Start autosave interval (5 minutes)
            this.autosaveInterval = setInterval(() => {
                if (this.hasUnsavedChanges) {
                    console.log('🔄 Autosaving...');
                    this.save();
                }
            }, 5 * 60 * 1000); // 5 minutes
        } else {
            // Stop autosave
            if (this.autosaveInterval) {
                clearInterval(this.autosaveInterval);
                this.autosaveInterval = null;
            }
        }
    }
    
    /**
     * Download file fallback
     */
    downloadFile(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.projectName}.slayer`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    /**
     * Update save button state
     */
    updateSaveButton() {
        const saveBtn = document.getElementById('save-project-btn');
        if (saveBtn) {
            // Disable save button if no file handle (never saved) or no unsaved changes
            const shouldDisable = !this.fileHandle || !this.hasUnsavedChanges;
            saveBtn.disabled = shouldDisable;
            saveBtn.style.opacity = shouldDisable ? '0.5' : '1';
            saveBtn.style.cursor = shouldDisable ? 'not-allowed' : 'pointer';
        }
    }
    
    /**
     * Set the project name
     */
    setProjectName(name) {
        this.projectName = name;
        this.updateProjectDisplay();
    }

    /**
     * Clear the file handle (for starting fresh)
     */
    async clearFileHandle() {
        console.log('[SAVE MANAGER] Clearing file handle');
        this.fileHandle = null;
        try {
            await fileHandleStore.delete(this.fileHandleKey);
        } catch (err) {
            console.warn('Failed to clear file handle from storage:', err);
        }
        this.updateSaveButton();
    }
}

// Create and export singleton instance
export const saveManager = new SaveManager();
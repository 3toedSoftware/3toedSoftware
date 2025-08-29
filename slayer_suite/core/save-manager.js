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
        console.log('📊 [SaveManager] Setting up event handlers...');

        const saveBtn = document.getElementById('save-project-btn');
        const saveAsBtn = document.getElementById('save-as-project-btn');
        const loadBtn = document.getElementById('load-project-btn');
        const autosaveCheckbox = document.getElementById('autosave-checkbox');

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.save());
            console.log('📊 [SaveManager] SAVE button listener attached');
        }

        if (saveAsBtn) {
            saveAsBtn.addEventListener('click', () => this.saveAs());
            console.log('📊 [SaveManager] SAVE AS button listener attached');
        }

        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.load());
            console.log('📊 [SaveManager] LOAD button listener attached');
        }

        if (autosaveCheckbox) {
            autosaveCheckbox.addEventListener('change', e => this.toggleAutosave(e.target.checked));
        }

        // Listen for project dirty state
        console.log('📊 [SaveManager] Subscribing to appBridge events...');
        appBridge.subscribe('project:dirty', data => {
            console.log('📊 [SaveManager] Received project:dirty event', data);
            this.hasUnsavedChanges = true;
            this.updateSaveButton();
        });

        appBridge.subscribe('project:saved', data => {
            console.log('📊 [SaveManager] Received project:saved event', data);
            this.hasUnsavedChanges = false;
            this.updateSaveButton();
        });

        console.log('📊 [SaveManager] Event subscriptions complete');

        // Initial button state
        console.log('📊 [SaveManager] Setting initial button state...');
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
        console.log(
            '🐛 fileHandle type:',
            this.fileHandle ? this.fileHandle.constructor.name : 'null'
        );

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
                if (!(await this.verifyPermission(this.fileHandle))) {
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
                    types: [
                        {
                            description: 'Slayer Project',
                            accept: { 'application/json': ['.slayer'] }
                        }
                    ],
                    multiple: false
                });

                const file = await fileHandle.getFile();
                console.log('🐛 File selected via File System Access API:', file.name);

                this.fileHandle = fileHandle; // Save handle for later silent saves
                console.log('📊 [FileHandle SAVED]:', {
                    exists: !!this.fileHandle,
                    type: this.fileHandle.constructor.name,
                    name: file.name
                });

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

        input.onchange = async e => {
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
     * Load a file directly (e.g., from drag-and-drop)
     * This method won't have a file handle for silent saves
     */
    async loadFileDirectly(file) {
        console.log('🐛 loadFileDirectly called with:', file.name);

        // Clear file handle since this is a direct load without File System Access API
        this.fileHandle = null;
        console.log('🐛 fileHandle cleared (direct load cannot do silent saves)');

        // Load the file
        await this.loadFile(file);

        // Enable Save As button, disable Save button
        this.updateSaveButtons();
    }

    /**
     * Load a file with a file handle (e.g., from drag-and-drop with handle support)
     * This enables the SAVE button for silent saves
     */
    async loadFileWithHandle(file, fileHandle) {
        console.log('📊 [SaveManager] loadFileWithHandle called');
        console.log('📊 [SaveManager] File:', file.name);
        console.log('📊 [SaveManager] FileHandle:', fileHandle ? 'YES' : 'NO');

        if (fileHandle) {
            this.fileHandle = fileHandle;
            console.log('📊 [FileHandle SAVED from drag-drop]:', {
                exists: !!this.fileHandle,
                type: this.fileHandle.constructor.name,
                name: file.name
            });

            // Store the file handle for persistent access
            try {
                await fileHandleStore.set(this.fileHandleKey, fileHandle);
                console.log('📊 [SaveManager] FileHandle stored in IndexedDB');
            } catch (err) {
                console.log('📊 [SaveManager] Could not store file handle:', err.message);
            }
        } else {
            this.fileHandle = null;
            console.log('📊 [SaveManager] No file handle provided');
        }

        // Load the file
        await this.loadFile(file);
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
            const isValidFormat =
                (projectData.type && projectData.type.includes('slayer')) ||
                (projectData.fileType && projectData.fileType.includes('slayer'));

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

            // Enable save button if we have a file handle
            this.hasUnsavedChanges = false; // Just loaded, no changes yet
            this.updateSaveButton();
            console.log(
                '🐛 After load - fileHandle exists:',
                !!this.fileHandle,
                'Save button updated'
            );

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
                        types: [
                            {
                                description: 'Slayer Project',
                                accept: { 'application/json': ['.slayer'] }
                            }
                        ]
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
            this.autosaveInterval = setInterval(
                () => {
                    if (this.hasUnsavedChanges) {
                        console.log('🔄 Autosaving...');
                        this.save();
                    }
                },
                5 * 60 * 1000
            ); // 5 minutes
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

            console.log('📊 [SAVE Button Update]', {
                fileHandle: !!this.fileHandle,
                fileHandleType: this.fileHandle ? this.fileHandle.constructor.name : 'null',
                hasUnsavedChanges: this.hasUnsavedChanges,
                shouldDisable: shouldDisable,
                projectName: this.projectName
            });

            saveBtn.disabled = shouldDisable;
            saveBtn.style.opacity = shouldDisable ? '0.5' : '1';
            saveBtn.style.cursor = shouldDisable ? 'not-allowed' : 'pointer';

            console.log('📊 [SAVE Button State]', saveBtn.disabled ? 'DISABLED' : 'ENABLED');
        } else {
            console.log('📊 [SAVE Button Update] Button not found in DOM');
        }
    }

    /**
     * Update both save and save-as button states
     */
    updateSaveButtons() {
        this.updateSaveButton();

        // Save As button should always be enabled after a file is loaded
        const saveAsBtn = document.getElementById('save-as-project-btn');
        if (saveAsBtn) {
            saveAsBtn.disabled = false;
            saveAsBtn.style.opacity = '1';
            saveAsBtn.style.cursor = 'pointer';
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

// Global helper for debugging
window.checkSaveState = () => {
    console.log('=== SAVE State Debug ===');
    console.log('File Handle:', !!saveManager.fileHandle);
    console.log('Has Unsaved Changes:', saveManager.hasUnsavedChanges);
    console.log('Project Name:', saveManager.projectName);
    const saveBtn = document.getElementById('save-project-btn');
    console.log('SAVE Button Disabled:', saveBtn ? saveBtn.disabled : 'Button not found');
    console.log('========================');
    return {
        fileHandle: !!saveManager.fileHandle,
        hasUnsavedChanges: saveManager.hasUnsavedChanges,
        projectName: saveManager.projectName,
        saveDisabled: saveBtn ? saveBtn.disabled : null
    };
};

window.testSaveButton = () => {
    console.log('🧪 Testing save button flow...');
    console.log('1. Simulating project:dirty event');
    appBridge.broadcast('project:dirty');
    setTimeout(() => {
        console.log('2. Checking state after dirty event:');
        window.checkSaveState();
    }, 100);
};

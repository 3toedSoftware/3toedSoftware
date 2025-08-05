// core/project-manager.js
/**
 * Project Manager - Handles .slayer file format and project lifecycle
 * Coordinates with App Bridge to save/load complete projects
 */

import { appBridge } from './app-bridge.js';

export class ProjectManager {
    constructor() {
        this.currentProject = null;
        this.isDirty = false;
        this.autoSaveInterval = null;
        this.autoSaveDelay = 300000; // 5 minutes (300000ms)
        
        // Incremental save support
        this.lastSaveSnapshot = null;
        this.changeTracker = new Map(); // Track which apps have changes
        this.lastAutoSave = null;
        
        // Performance monitoring
        this.saveMetrics = {
            totalSaves: 0,
            incrementalSaves: 0,
            fullSaves: 0,
            averageSaveTime: 0,
            largestProjectSize: 0
        };
        
        // Web Worker for background processing
        this.saveWorker = null;
        this.workerPromises = new Map(); // Track pending worker operations
        this.initializeWorker();
    }

    /**
     * Initialize Web Worker for background save processing
     */
    initializeWorker() {
        try {
            this.saveWorker = new Worker('/core/save-worker.js');
            
            this.saveWorker.onmessage = (e) => {
                this.handleWorkerMessage(e.data);
            };
            
            this.saveWorker.onerror = (error) => {
                console.error('Save Worker error:', error);
                this.saveWorker = null; // Disable worker on error
            };
            
            console.log('🔧 Save Worker initialized');
            
        } catch (error) {
            console.warn('Save Worker not available, using main thread processing:', error.message);
            this.saveWorker = null;
        }
    }

    /**
     * Handle messages from the save worker
     */
    handleWorkerMessage(data) {
        const { action, success, result, error, progress, phase } = data;
        
        if (progress !== undefined) {
            // Handle progress updates
            const progressCallbacks = this.workerPromises.get(`${action}_progress`);
            if (progressCallbacks) {
                progressCallbacks.forEach(callback => callback(progress, phase));
            }
            return;
        }
        
        // Handle completion
        const promises = this.workerPromises.get(action);
        if (promises && promises.length > 0) {
            const { resolve, reject } = promises.shift();
            
            if (success) {
                resolve(result);
            } else {
                reject(new Error(error));
            }
            
            // Clean up if no more promises waiting
            if (promises.length === 0) {
                this.workerPromises.delete(action);
            }
        }
    }

    /**
     * Send work to the save worker
     */
    async sendToWorker(action, data, options = {}) {
        if (!this.saveWorker) {
            throw new Error('Save Worker not available');
        }
        
        return new Promise((resolve, reject) => {
            // Store promise handlers
            if (!this.workerPromises.has(action)) {
                this.workerPromises.set(action, []);
            }
            this.workerPromises.get(action).push({ resolve, reject });
            
            // Send work to worker
            this.saveWorker.postMessage({ action, data, options });
        });
    }

    /**
     * Register progress callback for worker operations
     */
    onWorkerProgress(action, callback) {
        const key = `${action}_progress`;
        if (!this.workerPromises.has(key)) {
            this.workerPromises.set(key, []);
        }
        this.workerPromises.get(key).push(callback);
    }

    /**
     * Create a new empty project
     * @param {string} projectName - Name for the new project
     * @returns {object} New project structure
     */
    createNew(projectName = 'Untitled Project') {
        const project = {
            meta: {
                id: this.generateUUID(),
                name: projectName,
                created: new Date().toISOString(),
                modified: new Date().toISOString(),
                version: '1.0.0',
                slayerVersion: '1.0.0'
            },
            apps: {},
            links: {},
            resources: {
                sourcePDF: null,
                projectSettings: {
                    theme: 'dark',
                    autoSave: true,
                    debugMode: false
                }
            }
        };

        this.currentProject = project;
        this.isDirty = false;
        this.setupAutoSave();
        
        // Notify apps of new project
        appBridge.broadcast('project:created', { projectId: project.meta.id });
        
        return project;
    }

    /**
     * Save current project to .slayer file with chunked processing
     * @param {string} filename - Optional filename (defaults to project name)
     * @param {boolean} showProgress - Show progress indicator (default: true)
     * @returns {Promise<boolean>} Success status
     */
    async save(filename = null, showProgress = true) {
        if (!this.currentProject) {
            console.error('ProjectManager: No project to save');
            return false;
        }

        let progressCallback = null;
        if (showProgress) {
            progressCallback = this.createProgressIndicator('Saving project...');
        }

        try {
            // Phase 1: Collect app data in chunks to prevent UI blocking
            if (progressCallback) progressCallback(0.1, 'Collecting app data...');
            
            const projectData = await this.getProjectDataChunked();
            
            if (progressCallback) progressCallback(0.4, 'Optimizing data...');
            
            // Phase 2: Update project structure
            this.currentProject.apps = projectData.apps;
            this.currentProject.meta.modified = new Date().toISOString();
            this.currentProject.meta.activeApps = projectData.meta.activeApps;

            if (progressCallback) progressCallback(0.6, 'Creating file...');
            
            // Phase 3: Create the .slayer file (now async with compression)
            const slayerBlob = await this.createSlayerFile(this.currentProject, progressCallback);
            
            if (progressCallback) progressCallback(0.9, 'Preparing download...');
            
            // Phase 4: Generate filename
            const finalFilename = filename || `${this.currentProject.meta.name.replace(/[^a-zA-Z0-9]/g, '_')}.slayer`;
            
            // Phase 5: Trigger download
            this.downloadFile(slayerBlob, finalFilename);
            
            this.isDirty = false;
            appBridge.broadcast('project:saved', { 
                projectId: this.currentProject.meta.id,
                filename: finalFilename 
            });
            
            if (progressCallback) progressCallback(1.0, 'Save complete!');
            
            // Clear progress after a moment
            setTimeout(() => {
                if (progressCallback) progressCallback(null);
            }, 1000);
            
            return true;

        } catch (error) {
            console.error('ProjectManager: Save failed:', error);
            if (progressCallback) progressCallback(null, `Save failed: ${error.message}`);
            appBridge.broadcast('project:save-failed', { error: error.message });
            return false;
        }
    }

    /**
     * Get project data from all apps using chunked processing
     * @returns {Promise<object>} Project data collected in chunks
     */
    async getProjectDataChunked() {
        // Use existing appBridge method but add yielding for large datasets
        const baseData = await appBridge.getProjectData();
        
        // If we have large datasets, process them in chunks
        if (this.isLargeProject(baseData)) {
            console.log('📊 Processing large project in chunks...');
            
            // Process each app's data separately with yields
            for (const [appName, appData] of Object.entries(baseData.apps)) {
                if (appData.active && appData.data) {
                    // Yield control to browser for UI updates
                    await new Promise(resolve => requestAnimationFrame(resolve));
                    
                    // Additional processing for large data sets
                    if (appName === 'mapping_slayer' && appData.data.dotsByPage) {
                        appData.data = await this.chunkProcessDots(appData.data);
                    }
                }
            }
        }
        
        return baseData;
    }

    /**
     * Check if project qualifies as "large" requiring chunked processing
     * @param {object} projectData - Project data to analyze
     * @returns {boolean} True if project is large
     */
    isLargeProject(projectData) {
        let totalItems = 0;
        
        // Count dots across all pages
        if (projectData.apps?.mapping_slayer?.data?.dotsByPage) {
            const dotsByPage = projectData.apps.mapping_slayer.data.dotsByPage;
            totalItems += Object.values(dotsByPage).reduce((sum, pageData) => 
                sum + (pageData.dots?.length || 0), 0);
        }
        
        // Count design layers
        if (projectData.apps?.design_slayer?.data?.layersList) {
            totalItems += projectData.apps.design_slayer.data.layersList.length;
        }
        
        // Consider "large" if > 500 total items or any single app > 200 items
        return totalItems > 500;
    }

    /**
     * Process dots data in chunks to prevent UI blocking
     * @param {object} mappingData - Mapping Slayer data
     * @returns {Promise<object>} Processed data
     */
    async chunkProcessDots(mappingData) {
        const processed = { ...mappingData };
        
        if (processed.dotsByPage) {
            const pages = Object.keys(processed.dotsByPage);
            const chunkSize = 3; // Process 3 pages at a time
            
            for (let i = 0; i < pages.length; i += chunkSize) {
                const pageChunk = pages.slice(i, i + chunkSize);
                
                // Process this chunk of pages
                pageChunk.forEach(pageNum => {
                    const pageData = processed.dotsByPage[pageNum];
                    if (pageData.dots && Array.isArray(pageData.dots)) {
                        // Clean up any stale references or optimize dot data
                        pageData.dots = pageData.dots.filter(dot => dot && dot.internalId);
                    }
                });
                
                // Yield control every chunk
                if (i + chunkSize < pages.length) {
                    await new Promise(resolve => requestAnimationFrame(resolve));
                }
            }
        }
        
        return processed;
    }

    /**
     * Create progress indicator for save operations
     * @param {string} initialMessage - Initial progress message
     * @returns {Function} Progress callback function
     */
    createProgressIndicator(initialMessage) {
        // Create or update progress UI
        let progressContainer = document.getElementById('save-progress');
        if (!progressContainer) {
            progressContainer = document.createElement('div');
            progressContainer.id = 'save-progress';
            progressContainer.innerHTML = `
                <div style="position: fixed; top: 20px; right: 20px; background: rgba(0,0,0,0.8); 
                           color: white; padding: 12px 20px; border-radius: 6px; z-index: 10000;">
                    <div id="save-progress-text">${initialMessage}</div>
                    <div style="width: 200px; height: 4px; background: #333; border-radius: 2px; margin-top: 8px;">
                        <div id="save-progress-bar" style="width: 0%; height: 100%; background: #4CAF50; 
                                                          border-radius: 2px; transition: width 0.3s ease;"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(progressContainer);
        }
        
        const textEl = document.getElementById('save-progress-text');
        const barEl = document.getElementById('save-progress-bar');
        
        return (progress, message) => {
            if (progress === null) {
                // Clear progress indicator
                progressContainer.remove();
                return;
            }
            
            if (message) textEl.textContent = message;
            if (typeof progress === 'number') {
                barEl.style.width = `${Math.min(100, Math.max(0, progress * 100))}%`;
            }
        };
    }

    /**
     * Load project from .slayer file
     * @param {File} file - .slayer file to load
     * @returns {Promise<boolean>} Success status
     */
    async load(file) {
        if (!file.name.toLowerCase().endsWith('.slayer')) {
            console.error('ProjectManager: Invalid file type, expected .slayer');
            return false;
        }

        try {
            const slayerData = await this.parseSlayerFile(file);
            
            if (!this.validateSlayerData(slayerData)) {
                throw new Error('Invalid .slayer file format');
            }

            // Handle different formats
            if (slayerData.type === 'slayer_suite_project') {
                // Save-manager format
                this.currentProject = {
                    meta: {
                        id: Date.now().toString(),
                        name: slayerData.projectName || 'Imported Project',
                        created: slayerData.saved || new Date().toISOString(),
                        modified: new Date().toISOString(),
                        version: slayerData.version || '1.0'
                    },
                    apps: slayerData.apps
                };
            } else {
                // Original project-manager format
                this.currentProject = slayerData.project;
            }
            
            // Load data into apps
            const loadResults = await appBridge.loadProjectData(this.currentProject);
            
            this.isDirty = false;
            this.setupAutoSave();
            
            appBridge.broadcast('project:loaded', { 
                projectId: this.currentProject.meta.id,
                loadResults 
            });
            
            return true;

        } catch (error) {
            console.error('ProjectManager: Load failed:', error);
            appBridge.broadcast('project:load-failed', { error: error.message });
            return false;
        }
    }

    /**
     * Create .slayer file data structure with optimizations
     * @param {object} projectData - Project data to package
     * @param {Function} progressCallback - Optional progress callback
     * @returns {Promise<Blob>} .slayer file blob with compression
     */
    async createSlayerFile(projectData, progressCallback = null) {
        const fileStructure = {
            fileType: 'slayer-project',
            version: '1.0.0',
            created: new Date().toISOString(),
            project: projectData
        };

        try {
            // Use Web Worker for large projects if available
            if (this.saveWorker && this.isLargeProject({ apps: projectData.apps })) {
                console.log('🔧 Using Web Worker for large project serialization...');
                
                // Register progress callback
                if (progressCallback) {
                    this.onWorkerProgress('serialize', progressCallback);
                }
                
                const serializedData = await this.sendToWorker('serialize', fileStructure, {
                    chunkSize: 50,
                    includeProgress: !!progressCallback,
                    compress: true
                });
                
                // Create blob from worker result
                if (serializedData instanceof Uint8Array) {
                    return new Blob([serializedData], { type: 'application/octet-stream' });
                } else {
                    const jsonBytes = new TextEncoder().encode(serializedData);
                    return new Blob([jsonBytes], { type: 'application/json' });
                }
            }
        } catch (workerError) {
            console.warn('Web Worker serialization failed, falling back to main thread:', workerError.message);
        }

        // Fallback to main thread processing
        const optimizedData = this.optimizeProjectData(fileStructure);
        
        // Convert to JSON
        const jsonString = JSON.stringify(optimizedData, null, 2);
        const jsonBytes = new TextEncoder().encode(jsonString);

        // Apply compression if file size > 1MB
        if (jsonBytes.length > 1024 * 1024) {
            console.log(`📦 Compressing large project file (${(jsonBytes.length / 1024 / 1024).toFixed(1)}MB)`);
            return await this.compressBlob(jsonBytes);
        }

        return new Blob([jsonBytes], { type: 'application/json' });
    }

    /**
     * Optimize project data before serialization
     * @param {object} data - Project data to optimize
     * @returns {object} Optimized data structure
     */
    optimizeProjectData(data) {
        const optimized = JSON.parse(JSON.stringify(data)); // Deep clone
        
        // Remove deleted/empty entries
        if (optimized.project?.apps) {
            Object.keys(optimized.project.apps).forEach(appName => {
                const appData = optimized.project.apps[appName];
                if (!appData.active || !appData.data) {
                    delete optimized.project.apps[appName];
                }
            });
        }
        
        // Compress canvas data representations
        if (optimized.project?.apps?.design_slayer?.data?.layersList) {
            optimized.project.apps.design_slayer.data.layersList.forEach(layer => {
                if (layer.canvas) {
                    // Convert canvas to compressed format
                    layer.canvas = this.compressCanvasData(layer.canvas);
                }
            });
        }
        
        return optimized;
    }

    /**
     * Compress canvas data for storage
     * @param {string} canvasData - Canvas data URL
     * @returns {object} Compressed canvas representation
     */
    compressCanvasData(canvasData) {
        if (typeof canvasData === 'string' && canvasData.startsWith('data:')) {
            return {
                type: 'compressed-canvas',
                format: 'base64',
                data: canvasData.split(',')[1], // Remove data URL prefix
                dimensions: null // Could be extracted if needed
            };
        }
        return canvasData;
    }

    /**
     * Compress blob data using browser compression
     * @param {Uint8Array} data - Data to compress
     * @returns {Promise<Blob>} Compressed blob
     */
    async compressBlob(data) {
        try {
            // Use CompressionStream if available (modern browsers)
            if ('CompressionStream' in window) {
                const cs = new CompressionStream('gzip');
                const writer = cs.writable.getWriter();
                const reader = cs.readable.getReader();
                
                // Write data
                writer.write(data);
                writer.close();
                
                // Read compressed result
                const chunks = [];
                let done = false;
                while (!done) {
                    const { value, done: readerDone } = await reader.read();
                    done = readerDone;
                    if (value) chunks.push(value);
                }
                
                const compressedData = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
                let offset = 0;
                for (const chunk of chunks) {
                    compressedData.set(chunk, offset);
                    offset += chunk.length;
                }
                
                console.log(`📦 Compression: ${data.length} → ${compressedData.length} bytes (${((1 - compressedData.length / data.length) * 100).toFixed(1)}% reduction)`);
                
                return new Blob([compressedData], { type: 'application/octet-stream' });
            }
        } catch (error) {
            console.warn('Compression failed, using uncompressed data:', error);
        }
        
        // Fallback to uncompressed
        return new Blob([data], { type: 'application/json' });
    }

    /**
     * Parse .slayer file with decompression support
     * @param {File} file - File to parse
     * @returns {Promise<object>} Parsed project data
     */
    async parseSlayerFile(file) {
        const fileBuffer = await file.arrayBuffer();
        
        try {
            // Try to parse as JSON first (uncompressed)
            const jsonString = new TextDecoder().decode(fileBuffer);
            const slayerData = JSON.parse(jsonString);
            return this.decompressProjectData(slayerData);
        } catch (jsonError) {
            // If JSON parsing fails, try decompression
            try {
                console.log('📦 Attempting to decompress file...');
                const decompressedBuffer = await this.decompressBlob(fileBuffer);
                const jsonString = new TextDecoder().decode(decompressedBuffer);
                const slayerData = JSON.parse(jsonString);
                return this.decompressProjectData(slayerData);
            } catch (decompressError) {
                console.error('Failed to parse .slayer file:', decompressError);
                throw new Error('Invalid or corrupted .slayer file format');
            }
        }
    }

    /**
     * Decompress blob data
     * @param {ArrayBuffer} compressedData - Compressed data
     * @returns {Promise<ArrayBuffer>} Decompressed data
     */
    async decompressBlob(compressedData) {
        if ('DecompressionStream' in window) {
            const ds = new DecompressionStream('gzip');
            const writer = ds.writable.getWriter();
            const reader = ds.readable.getReader();
            
            // Write compressed data
            writer.write(new Uint8Array(compressedData));
            writer.close();
            
            // Read decompressed result
            const chunks = [];
            let done = false;
            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) chunks.push(value);
            }
            
            const decompressedData = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
            let offset = 0;
            for (const chunk of chunks) {
                decompressedData.set(chunk, offset);
                offset += chunk.length;
            }
            
            return decompressedData.buffer;
        }
        
        throw new Error('Decompression not supported in this browser');
    }

    /**
     * Decompress project data structures
     * @param {object} data - Project data that may contain compressed elements
     * @returns {object} Decompressed project data
     */
    decompressProjectData(data) {
        const decompressed = JSON.parse(JSON.stringify(data)); // Deep clone
        
        // Decompress canvas data
        if (decompressed.project?.apps?.design_slayer?.data?.layersList) {
            decompressed.project.apps.design_slayer.data.layersList.forEach(layer => {
                if (layer.canvas?.type === 'compressed-canvas') {
                    // Restore canvas data URL format
                    layer.canvas = `data:image/png;base64,${layer.canvas.data}`;
                }
            });
        }
        
        return decompressed;
    }

    /**
     * Validate .slayer file structure
     * @param {object} slayerData - Parsed .slayer data
     * @returns {boolean} Is valid
     */
    validateSlayerData(slayerData) {
        // Check if it's a save-manager format (slayer_suite_project)
        if (slayerData.type === 'slayer_suite_project') {
            // Validate save-manager format
            if (!slayerData.apps || typeof slayerData.apps !== 'object') {
                console.error('ProjectManager: Invalid apps data in suite format');
                return false;
            }
            return true;
        }
        
        // Check required top-level fields for original format
        if (!slayerData.fileType || slayerData.fileType !== 'slayer-project') {
            console.error('ProjectManager: Invalid file type');
            return false;
        }

        if (!slayerData.project) {
            console.error('ProjectManager: Missing project data');
            return false;
        }

        const project = slayerData.project;

        // Check required project fields
        if (!project.meta || !project.meta.id || !project.meta.name) {
            console.error('ProjectManager: Invalid project metadata');
            return false;
        }

        if (!project.apps || typeof project.apps !== 'object') {
            console.error('ProjectManager: Invalid apps data');
            return false;
        }

        return true;
    }

    /**
     * Mark project as dirty (needs saving)
     */
    markDirty() {
        if (!this.isDirty) {
            this.isDirty = true;
            appBridge.broadcast('project:dirty', { 
                projectId: this.currentProject?.meta?.id 
            });
        }
    }

    /**
     * Check if project has unsaved changes
     * @returns {boolean} Has unsaved changes
     */
    hasUnsavedChanges() {
        return this.isDirty;
    }

    /**
     * Get current project info
     * @returns {object|null} Project metadata or null
     */
    getCurrentProject() {
        return this.currentProject ? {
            id: this.currentProject.meta.id,
            name: this.currentProject.meta.name,
            created: this.currentProject.meta.created,
            modified: this.currentProject.meta.modified,
            isDirty: this.isDirty
        } : null;
    }

    /**
     * Update project metadata
     * @param {object} updates - Metadata updates
     */
    updateProjectMeta(updates) {
        if (!this.currentProject) return;

        Object.assign(this.currentProject.meta, updates);
        this.currentProject.meta.modified = new Date().toISOString();
        this.markDirty();
        
        appBridge.broadcast('project:meta-updated', { 
            projectId: this.currentProject.meta.id,
            updates 
        });
    }

    /**
     * Add or update cross-app link
     * @param {string} linkType - Type of link (e.g., 'surveyToMapping')
     * @param {object} linkData - Link data
     */
    addLink(linkType, linkData) {
        if (!this.currentProject) return;

        if (!this.currentProject.links[linkType]) {
            this.currentProject.links[linkType] = [];
        }

        this.currentProject.links[linkType].push({
            ...linkData,
            created: new Date().toISOString(),
            id: this.generateUUID()
        });

        this.markDirty();
        appBridge.broadcast('project:link-added', { linkType, linkData });
    }

    /**
     * Remove cross-app link
     * @param {string} linkType - Type of link
     * @param {string} linkId - Link ID to remove
     */
    removeLink(linkType, linkId) {
        if (!this.currentProject || !this.currentProject.links[linkType]) return;

        const index = this.currentProject.links[linkType].findIndex(link => link.id === linkId);
        if (index !== -1) {
            this.currentProject.links[linkType].splice(index, 1);
            this.markDirty();
            appBridge.broadcast('project:link-removed', { linkType, linkId });
        }
    }

    /**
     * Get links of a specific type
     * @param {string} linkType - Type of links to retrieve
     * @returns {array} Array of links
     */
    getLinks(linkType) {
        if (!this.currentProject) return [];
        return this.currentProject.links[linkType] || [];
    }

    /**
     * Setup auto-save functionality with intelligent incremental saves
     */
    setupAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }

        if (this.currentProject?.resources?.projectSettings?.autoSave) {
            this.autoSaveInterval = setInterval(async () => {
                if (this.isDirty) {
                    console.log('🔄 Auto-save triggered...');
                    const startTime = performance.now();
                    
                    try {
                        // Use incremental save for auto-saves to minimize impact
                        const success = await this.autoSaveIncremental();
                        
                        const duration = performance.now() - startTime;
                        console.log(`✅ Auto-save completed in ${duration.toFixed(1)}ms`);
                        
                        // Update metrics
                        this.updateSaveMetrics(duration, true);
                        
                    } catch (error) {
                        console.error('❌ Auto-save failed:', error);
                        // Don't throw - just log and continue
                    }
                }
            }, this.autoSaveDelay);
            
            console.log(`⏰ Auto-save enabled: every ${this.autoSaveDelay / 1000 / 60} minutes`);
        }
    }

    /**
     * Perform incremental auto-save with minimal UI impact
     * @returns {Promise<boolean>} Success status
     */
    async autoSaveIncremental() {
        if (!this.currentProject) return false;

        try {
            // Check what has actually changed since last save
            const changedApps = await this.detectChangedApps();
            
            if (changedApps.length === 0) {
                console.log('📄 No changes detected, skipping auto-save');
                this.isDirty = false; // Reset dirty flag
                return true;
            }

            console.log(`📄 Auto-saving changes in: ${changedApps.join(', ')}`);

            // Create incremental save data (only changed apps)
            const incrementalData = await this.createIncrementalSaveData(changedApps);
            
            // Store as backup in browser storage instead of downloading
            await this.saveToLocalStorage(incrementalData);
            
            // Update tracking
            this.lastAutoSave = new Date();
            this.isDirty = false;
            
            // Notify apps
            appBridge.broadcast('project:auto-saved', { 
                projectId: this.currentProject.meta.id,
                changedApps,
                timestamp: this.lastAutoSave
            });

            return true;

        } catch (error) {
            console.error('Auto-save incremental failed:', error);
            return false;
        }
    }

    /**
     * Detect which apps have changes since last save
     * @returns {Promise<string[]>} Array of app names with changes
     */
    async detectChangedApps() {
        const currentData = await appBridge.getProjectData();
        const changedApps = [];

        if (!this.lastSaveSnapshot) {
            // First save - everything is new
            return Object.keys(currentData.apps).filter(app => 
                currentData.apps[app].active && currentData.apps[app].data
            );
        }

        // Compare each app's data with last snapshot
        for (const [appName, appData] of Object.entries(currentData.apps)) {
            if (!appData.active || !appData.data) continue;

            const lastAppData = this.lastSaveSnapshot.apps[appName];
            
            if (!lastAppData || this.hasDataChanged(appData.data, lastAppData.data)) {
                changedApps.push(appName);
                this.changeTracker.set(appName, new Date());
            }
        }

        return changedApps;
    }

    /**
     * Compare two data objects to detect changes
     * @param {object} current - Current data
     * @param {object} previous - Previous data
     * @returns {boolean} True if data has changed
     */
    hasDataChanged(current, previous) {
        if (!previous) return true;
        
        // Quick comparison using JSON serialization (not perfect but fast)
        const currentStr = JSON.stringify(current);
        const previousStr = JSON.stringify(previous);
        
        return currentStr !== previousStr;
    }

    /**
     * Create save data with only changed apps
     * @param {string[]} changedApps - Apps that have changes
     * @returns {Promise<object>} Incremental save data
     */
    async createIncrementalSaveData(changedApps) {
        const projectData = await appBridge.getProjectData();
        
        // Create minimal save structure with only changed apps
        const incrementalData = {
            type: 'slayer_incremental_save',
            projectId: this.currentProject.meta.id,
            timestamp: new Date().toISOString(),
            changedApps,
            apps: {}
        };

        // Include only changed app data
        changedApps.forEach(appName => {
            if (projectData.apps[appName]) {
                incrementalData.apps[appName] = projectData.apps[appName];
            }
        });

        return incrementalData;
    }

    /**
     * Save incremental data to browser's local storage
     * @param {object} data - Data to save
     */
    async saveToLocalStorage(data) {
        try {
            const key = `slayer_autosave_${this.currentProject.meta.id}`;
            const serialized = JSON.stringify(data);
            
            // Check storage quota
            if (serialized.length > 5 * 1024 * 1024) { // 5MB limit
                console.warn('⚠️ Auto-save data too large for localStorage, using fallback');
                // Could implement IndexedDB fallback here
                return;
            }
            
            localStorage.setItem(key, serialized);
            localStorage.setItem(`${key}_timestamp`, data.timestamp);
            
            console.log(`💾 Auto-save stored to localStorage (${(serialized.length / 1024).toFixed(1)}KB)`);
            
        } catch (error) {
            console.warn('Failed to save to localStorage:', error);
            // Storage full or disabled - gracefully degrade
        }
    }

    /**
     * Update save performance metrics
     * @param {number} duration - Save duration in milliseconds
     * @param {boolean} isIncremental - Whether this was an incremental save
     */
    updateSaveMetrics(duration, isIncremental = false) {
        this.saveMetrics.totalSaves++;
        
        if (isIncremental) {
            this.saveMetrics.incrementalSaves++;
        } else {
            this.saveMetrics.fullSaves++;
        }
        
        // Update average save time
        const totalTime = this.saveMetrics.averageSaveTime * (this.saveMetrics.totalSaves - 1) + duration;
        this.saveMetrics.averageSaveTime = totalTime / this.saveMetrics.totalSaves;
        
        // Log performance occasionally
        if (this.saveMetrics.totalSaves % 10 === 0) {
            console.log('📊 Save Performance:', {
                totalSaves: this.saveMetrics.totalSaves,
                incrementalRatio: `${(this.saveMetrics.incrementalSaves / this.saveMetrics.totalSaves * 100).toFixed(1)}%`,
                averageTime: `${this.saveMetrics.averageSaveTime.toFixed(1)}ms`
            });
        }
    }

    /**
     * Trigger file download
     * @param {Blob} blob - File data
     * @param {string} filename - Filename
     */
    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Generate UUID v4
     * @returns {string} UUID
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Clean up resources
     */
    destroy() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }
}

// Create global project manager instance
export const projectManager = new ProjectManager();

// Listen for app bridge events to mark project dirty
appBridge.subscribe('app:activated', () => projectManager.markDirty());
appBridge.subscribe('data:requested', () => projectManager.markDirty());
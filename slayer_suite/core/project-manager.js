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
        this.autoSaveDelay = 30000; // 30 seconds
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
     * Save current project to .slayer file
     * @param {string} filename - Optional filename (defaults to project name)
     * @returns {Promise<boolean>} Success status
     */
    async save(filename = null) {
        if (!this.currentProject) {
            console.error('ProjectManager: No project to save');
            return false;
        }

        try {
            // Get latest data from all apps
            const projectData = await appBridge.getProjectData();
            
            // Update current project with app data
            this.currentProject.apps = projectData.apps;
            this.currentProject.meta.modified = new Date().toISOString();
            this.currentProject.meta.activeApps = projectData.meta.activeApps;

            // Create the .slayer file
            const slayerData = this.createSlayerFile(this.currentProject);
            
            // Generate filename
            const finalFilename = filename || `${this.currentProject.meta.name.replace(/[^a-zA-Z0-9]/g, '_')}.slayer`;
            
            // Trigger download
            this.downloadFile(slayerData, finalFilename);
            
            this.isDirty = false;
            appBridge.broadcast('project:saved', { 
                projectId: this.currentProject.meta.id,
                filename: finalFilename 
            });
            
            return true;

        } catch (error) {
            console.error('ProjectManager: Save failed:', error);
            appBridge.broadcast('project:save-failed', { error: error.message });
            return false;
        }
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

            // Load project data
            this.currentProject = slayerData.project;
            
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
     * Create .slayer file data structure
     * @param {object} projectData - Project data to package
     * @returns {Blob} .slayer file blob
     */
    createSlayerFile(projectData) {
        const fileStructure = {
            fileType: 'slayer-project',
            version: '1.0.0',
            created: new Date().toISOString(),
            project: projectData
        };

        // Convert to JSON and create blob
        const jsonString = JSON.stringify(fileStructure, null, 2);
        const jsonBytes = new TextEncoder().encode(jsonString);

        // For now, use simple JSON format
        // Later we can add compression or binary format if needed
        return new Blob([jsonBytes], { type: 'application/json' });
    }

    /**
     * Parse .slayer file
     * @param {File} file - File to parse
     * @returns {Promise<object>} Parsed project data
     */
    async parseSlayerFile(file) {
        const fileBuffer = await file.arrayBuffer();
        const jsonString = new TextDecoder().decode(fileBuffer);
        const slayerData = JSON.parse(jsonString);
        
        return slayerData;
    }

    /**
     * Validate .slayer file structure
     * @param {object} slayerData - Parsed .slayer data
     * @returns {boolean} Is valid
     */
    validateSlayerData(slayerData) {
        // Check required top-level fields
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
     * Setup auto-save functionality
     */
    setupAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }

        if (this.currentProject?.resources?.projectSettings?.autoSave) {
            this.autoSaveInterval = setInterval(() => {
                if (this.isDirty) {
                    this.save(`${this.currentProject.meta.name}_autosave.slayer`);
                }
            }, this.autoSaveDelay);
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
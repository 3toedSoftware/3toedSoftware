/**
 * thumbnail-sync.js
 * Synchronization adapter for Thumbnail Slayer
 */

import { createSyncManager, SYNC_EVENTS, DataModels } from '../../core/index.js';
import { updateLocationData, updateDesignTemplates, getState } from './thumbnail-state.js';
import { updateAllUI } from './thumbnail-ui.js';

const { SignType, SignInstance, DesignTemplate } = DataModels;

class ThumbnailSyncAdapter {
    constructor() {
        this.syncManager = null;
        this.appName = 'thumbnail_slayer';
        this.signTypes = new Map(); // Local cache of sign types
        this.templates = new Map(); // Local cache of design templates
    }

    /**
     * Initialize sync adapter
     * @param {AppBridge} appBridge - App bridge instance
     */
    initialize(appBridge) {
        this.syncManager = createSyncManager(appBridge);
        
        // Custom handlers for Thumbnail Slayer
        const handlers = {
            [SYNC_EVENTS.SIGN_TYPE_CREATED]: (data) => this.handleSignTypeCreated(data),
            [SYNC_EVENTS.SIGN_TYPE_UPDATED]: (data) => this.handleSignTypeUpdated(data),
            [SYNC_EVENTS.SIGN_TYPE_DELETED]: (data) => this.handleSignTypeDeleted(data),
            [SYNC_EVENTS.SIGN_TYPE_FIELD_ADDED]: (data) => this.handleFieldAdded(data),
            [SYNC_EVENTS.SIGN_TYPE_FIELD_REMOVED]: (data) => this.handleFieldRemoved(data),
            [SYNC_EVENTS.SIGN_NOTES_CHANGED]: (data) => this.handleNotesChanged(data),
            [SYNC_EVENTS.SIGN_MESSAGE_CHANGED]: (data) => this.handleMessageChanged(data),
            [SYNC_EVENTS.TEMPLATE_CREATED]: (data) => this.handleTemplateCreated(data),
            [SYNC_EVENTS.TEMPLATE_UPDATED]: (data) => this.handleTemplateUpdated(data),
            [SYNC_EVENTS.TEMPLATE_DELETED]: (data) => this.handleTemplateDeleted(data)
        };
        
        this.syncManager.initializeApp(this.appName, handlers);
        
        // Load initial data
        this.loadSignTypes(appBridge);
        this.fetchAllData(appBridge);
        
        // Listen for template updates from Design Slayer
        if (appBridge) {
            appBridge.on('template-updated', (data) => {
                // Removed debug log (Thumbnail): Received template-updated broadcast
                if (data && data.template) {
                    this.handleTemplateUpdated(data.template);
                }
            });
        }
    }

    /**
     * Load sign types from shared data
     */
    loadSignTypes(appBridge) {
        const sharedSignTypes = appBridge.getSignTypes();
        this.signTypes.clear();
        
        sharedSignTypes.forEach((signTypeData, code) => {
            this.signTypes.set(code, new SignType(signTypeData));
        });
    }

    /**
     * Fetch all location and template data
     */
    async fetchAllData(appBridge) {
        try {
            // Fetch locations from Mapping Slayer
            const locationsResponse = await appBridge.sendRequest('mapping_slayer', {
                type: 'get-all-locations'
            });
            
            if (locationsResponse && locationsResponse.locations) {
                this.processLocationData(locationsResponse.locations);
            }
            
            // Fetch templates from Design Slayer
            const templatesResponse = await appBridge.sendRequest('design_slayer', {
                type: 'get-templates'
            });
            
            if (templatesResponse && templatesResponse.templates) {
                this.processTemplateData(templatesResponse.templates);
            }
        } catch (error) {
            console.error('Failed to fetch initial data:', error);
        }
    }

    /**
     * Fetch template for a specific sign type
     */
    async fetchTemplateForSignType(signTypeCode) {
        if (!window.appBridge) return null;
        
        // Removed debug log (Thumbnail): Fetching template for sign type
        
        try {
            const response = await window.appBridge.sendRequest('design_slayer', {
                type: 'get-design-for-sign-type',
                signTypeCode: signTypeCode
            });
            
            // Removed debug log (Thumbnail): Received response
            
            if (response && response.template) {
                const template = new DesignTemplate(response.template);
                this.templates.set(signTypeCode, template);
                return template;
            }
        } catch (error) {
            // Removed debug error (Thumbnail): Failed to fetch template
        }
        
        return null;
    }
    
    /**
     * Process location data from Mapping Slayer
     */
    processLocationData(locations) {
        // Transform locations to include dynamic fields
        const processedLocations = locations.map(loc => {
            const signType = this.signTypes.get(loc.markerType);
            const processed = {
                id: loc.internalId || `loc_${loc.locationNumber}_${loc.pageNumber}`,
                locationId: loc.internalId || loc.id || `loc_${loc.locationNumber}_${loc.pageNumber}`,
                locationNumber: loc.locationNumber,
                pageNumber: loc.pageNumber || 1,
                sheetName: loc.sheetName || `Page ${loc.pageNumber || 1}`,
                
                // Sign type info
                signType: loc.markerType || 'default',
                signTypeCode: loc.markerType || '',
                signTypeName: signType?.name || loc.markerType || 'Default',
                signTypeInfo: signType ? signType.toJSON() : {},
                
                // Position
                x: loc.x,
                y: loc.y,
                
                // Status flags
                installed: loc.installed || false,
                vinylBacker: loc.vinylBacker || false,
                codeRequired: loc.codeRequired || loc.isCodeRequired || false,
                notes: loc.notes || ''
            };
            
            // Add dynamic text fields
            if (signType) {
                signType.textFields.forEach(field => {
                    processed[field.fieldName] = loc[field.fieldName] || '';
                });
            } else {
                // Default fields
                processed.message = loc.message || '';
                processed.message2 = loc.message2 || '';
            }
            
            return processed;
        });
        
        updateLocationData(processedLocations);
    }

    /**
     * Process template data from Design Slayer
     */
    processTemplateData(templates) {
        this.templates.clear();
        
        const processedTemplates = templates.map(template => {
            const designTemplate = new DesignTemplate(template);
            this.templates.set(template.id, designTemplate);
            
            return {
                id: template.id,
                name: template.name,
                signTypeCode: template.signTypeCode,
                layers: this.extractLayersFromTemplate(designTemplate),
                width: template.faceView?.dimensions?.width || 12,
                height: template.faceView?.dimensions?.height || 6,
                backgroundColor: template.faceView?.backgroundColor || '#ffffff',
                created: template.createdAt,
                modified: template.updatedAt
            };
        });
        
        updateDesignTemplates(processedTemplates);
    }

    /**
     * Extract layers from template for rendering
     */
    extractLayersFromTemplate(template) {
        const layers = [];
        const faceView = template.faceView;
        
        // Removed debug log (Thumbnail): Extracting layers from template
        
        if (!faceView) return layers;
        
        // Extract all layers from the canvas data
        if (faceView.canvas && faceView.canvas.layers) {
            // Convert Design Slayer layers to Thumbnail Slayer format
            faceView.canvas.layers.forEach(layer => {
                const thumbnailLayer = {
                    type: layer.type,
                    name: layer.name,
                    x: layer.x,
                    y: layer.y,
                    width: layer.width,
                    height: layer.height,
                    zIndex: layer.zIndex || 0
                };
                
                // Add type-specific properties
                if (layer.type === 'plate') {
                    thumbnailLayer.backgroundColor = layer.color || '#003366';
                    thumbnailLayer.material = layer.material;
                    thumbnailLayer.thickness = layer.thickness;
                } else if (layer.type === 'paragraph-text' || layer.type === 'braille-text') {
                    thumbnailLayer.type = 'text'; // Normalize text types
                    thumbnailLayer.text = layer.text || '';
                    thumbnailLayer.fieldName = layer.fieldName;
                    thumbnailLayer.fontSize = layer.fontSize || 24;
                    thumbnailLayer.fontColor = layer.textColor || '#000000';
                    thumbnailLayer.fontFamily = layer.font || 'Arial';
                    thumbnailLayer.textAlign = layer.textAlign || 'left';
                    thumbnailLayer.verticalAlign = layer.verticalAlign || 'top';
                    thumbnailLayer.lineSpacing = layer.lineSpacing || 1.2;
                    thumbnailLayer.kerning = layer.kerning || 0;
                    thumbnailLayer.isBraille = layer.type === 'braille-text';
                    thumbnailLayer.brailleSourceText = layer.brailleSourceText;
                } else if (layer.type === 'logo' || layer.type === 'icon') {
                    thumbnailLayer.backgroundColor = layer.color || '#f07727';
                }
                
                layers.push(thumbnailLayer);
            });
            
            // Sort by zIndex to maintain proper layering
            layers.sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
        }
        
        return layers;
    }

    /**
     * Update a location's field value and sync
     */
    async updateLocationField(locationId, fieldName, value) {
        try {
            // Send update directly through appBridge if available
            if (window.appBridge) {
                const updates = {};
                updates[fieldName] = value;
                
                const response = await window.appBridge.sendRequest('mapping_slayer', {
                    type: 'update-dot',
                    locationId: locationId,
                    updates: updates
                });
                
                if (response && response.success) {
                    // Sync with other apps through sync manager
                    if (fieldName === 'notes') {
                        await this.syncManager.syncNotesChange(locationId, value, this.appName);
                    } else {
                        await this.syncManager.syncMessageChange(locationId, fieldName, value, this.appName);
                    }
                    
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('Failed to update location field:', error);
            throw error;
        }
    }

    // Handler implementations
    handleSignTypeCreated(data) {
        console.log('Thumbnail Slayer: Sign type created', data);
        
        // Add to local cache
        const signType = new SignType(data);
        this.signTypes.set(data.code, signType);
        
        // Refresh location data to include new fields
        this.refreshLocationData();
    }

    handleSignTypeUpdated(data) {
        console.log('Thumbnail Slayer: Sign type updated', data);
        
        // Update local cache
        const signType = new SignType(data);
        this.signTypes.set(data.code, signType);
        
        // Refresh location data
        this.refreshLocationData();
    }

    handleSignTypeDeleted(data) {
        console.log('Thumbnail Slayer: Sign type deleted', data);
        
        // Remove from local cache
        this.signTypes.delete(data.code);
        
        // Update affected locations
        const state = getState();
        // Fixed: state.locations is a Map, not an Array!
        const affectedLocations = Array.from(state.locations.values()).filter(loc => loc.signTypeCode === data.code);
        
        affectedLocations.forEach(loc => {
            loc.signTypeCode = '';
            loc.signTypeName = 'Default';
            loc.signTypeInfo = {};
        });
        
        updateAllUI();
    }

    handleFieldAdded(data) {
        console.log('Thumbnail Slayer: Field added', data);
        
        // Update sign type in cache
        const signType = this.signTypes.get(data.signTypeCode);
        if (signType) {
            signType.addTextField(data.fieldName, data.fieldOptions.maxLength);
        }
        
        // Add field to affected locations
        const state = getState();
        // Fixed: state.locations is a Map, not an Array!
        const affectedLocations = Array.from(state.locations.values()).filter(loc => loc.signTypeCode === data.signTypeCode);
        
        affectedLocations.forEach(loc => {
            if (!loc[data.fieldName]) {
                loc[data.fieldName] = '';
            }
        });
        
        updateAllUI();
    }

    handleFieldRemoved(data) {
        console.log('Thumbnail Slayer: Field removed', data);
        
        // Update sign type in cache
        const signType = this.signTypes.get(data.signTypeCode);
        if (signType) {
            signType.removeTextField(data.fieldName);
        }
        
        // Remove field from affected locations
        const state = getState();
        // Fixed: state.locations is a Map, not an Array!
        const affectedLocations = Array.from(state.locations.values()).filter(loc => loc.signTypeCode === data.signTypeCode);
        
        affectedLocations.forEach(loc => {
            delete loc[data.fieldName];
        });
        
        updateAllUI();
    }

    handleNotesChanged(data) {
        console.log('Thumbnail Slayer: Notes changed', data);
        
        // Update location notes
        const state = getState();
        // Fixed: state.locations is a Map, not an Array!
        const location = Array.from(state.locations.values()).find(loc => loc.id === data.signId);
        
        if (location) {
            location.notes = data.notes;
            updateAllUI();
        }
    }

    handleMessageChanged(data) {
        console.log('Thumbnail Slayer: Message changed', data);
        
        // Update location field
        const state = getState();
        // Fixed: state.locations is a Map, not an Array!
        const location = Array.from(state.locations.values()).find(loc => loc.id === data.signId);
        
        if (location) {
            location[data.fieldName] = data.value;
            updateAllUI();
        }
    }

    handleTemplateCreated(data) {
        console.log('Thumbnail Slayer: Template created', data);
        
        // Add template to cache and process
        const template = new DesignTemplate(data);
        this.templates.set(data.id, template);
        
        // Refresh templates
        this.refreshTemplateData();
    }

    handleTemplateUpdated(data) {
        console.log('Thumbnail Slayer: Template updated', data);
        
        // Update template in cache
        const template = new DesignTemplate(data);
        this.templates.set(data.id, template);
        
        // Refresh templates
        this.refreshTemplateData();
    }

    handleTemplateDeleted(data) {
        console.log('Thumbnail Slayer: Template deleted', data);
        
        // Remove from cache
        this.templates.delete(data.id);
        
        // Refresh templates
        this.refreshTemplateData();
    }

    /**
     * Refresh location data from current state
     */
    async refreshLocationData() {
        if (!window.appBridge) return;
        
        try {
            const response = await window.appBridge.sendRequest('mapping_slayer', {
                type: 'get-all-locations'
            });
            
            if (response && response.locations) {
                this.processLocationData(response.locations);
            }
        } catch (error) {
            console.error('Failed to refresh location data:', error);
        }
    }

    /**
     * Refresh template data
     */
    refreshTemplateData() {
        const processedTemplates = Array.from(this.templates.values()).map(template => ({
            id: template.id,
            name: template.name,
            signTypeCode: template.signTypeCode,
            layers: this.extractLayersFromTemplate(template),
            width: template.faceView?.dimensions?.width || 12,
            height: template.faceView?.dimensions?.height || 6,
            backgroundColor: template.faceView?.backgroundColor || '#ffffff',
            created: template.createdAt,
            modified: template.updatedAt
        }));
        
        updateDesignTemplates(processedTemplates);
        updateAllUI();
    }

    /**
     * Get sign types for UI
     */
    getSignTypes() {
        return this.signTypes;
    }

    /**
     * Get templates for a specific sign type
     */
    getTemplatesForSignType(signTypeCode) {
        return Array.from(this.templates.values())
            .filter(template => template.signTypeCode === signTypeCode);
    }
}

// Create and export singleton instance
export const thumbnailSyncAdapter = new ThumbnailSyncAdapter();
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
        this.globalFlagConfiguration = null; // Store global flag configuration from Mapping Slayer
    }

    /**
     * Initialize sync adapter
     * @param {AppBridge} appBridge - App bridge instance
     */
    initialize(appBridge) {
        this.syncManager = createSyncManager(appBridge);

        // Custom handlers for Thumbnail Slayer
        const handlers = {
            [SYNC_EVENTS.SIGN_TYPE_CREATED]: data => this.handleSignTypeCreated(data),
            [SYNC_EVENTS.SIGN_TYPE_UPDATED]: data => this.handleSignTypeUpdated(data),
            [SYNC_EVENTS.SIGN_TYPE_DELETED]: data => this.handleSignTypeDeleted(data),
            [SYNC_EVENTS.SIGN_TYPE_FIELD_ADDED]: data => this.handleFieldAdded(data),
            [SYNC_EVENTS.SIGN_TYPE_FIELD_REMOVED]: data => this.handleFieldRemoved(data),
            [SYNC_EVENTS.SIGN_NOTES_CHANGED]: data => this.handleNotesChanged(data),
            [SYNC_EVENTS.SIGN_MESSAGE_CHANGED]: data => this.handleMessageChanged(data),
            [SYNC_EVENTS.TEMPLATE_CREATED]: data => this.handleTemplateCreated(data),
            [SYNC_EVENTS.TEMPLATE_UPDATED]: data => this.handleTemplateUpdated(data),
            [SYNC_EVENTS.TEMPLATE_DELETED]: data => this.handleTemplateDeleted(data)
        };

        this.syncManager.initializeApp(this.appName, handlers);

        // Load initial data
        this.loadSignTypes(appBridge);
        this.fetchAllData(appBridge);

        // Listen for template updates from Design Slayer
        if (appBridge) {
            appBridge.on('template-updated', data => {
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
                // Store marker types if provided
                if (locationsResponse.markerTypes) {
                    const { updateMarkerTypes } = await import('./thumbnail-state.js');
                    updateMarkerTypes(locationsResponse.markerTypes);
                    console.log(
                        '🎨 Received marker types:',
                        Object.keys(locationsResponse.markerTypes).length,
                        'types'
                    );
                }

                // Store global flag configuration if provided
                if (locationsResponse.globalFlagConfiguration) {
                    this.globalFlagConfiguration = locationsResponse.globalFlagConfiguration;
                    console.log(
                        '📍 Received global flag configuration:',
                        this.globalFlagConfiguration
                    );
                }

                this.processLocationData(locationsResponse.locations);
                // No longer need to fetch flag states separately - they're included now!

                // Clear map preview cache when new data is loaded
                const { clearMapPreviewCache } = await import('./thumbnail-state.js');
                clearMapPreviewCache();
            }

            // Fetch all available templates from Design Slayer
            await this.fetchAllTemplates();
        } catch (error) {
            console.error('Failed to fetch initial data:', error);
        }
    }

    /**
     * Fetch template for a specific sign type with enhanced error handling and caching
     */
    async fetchTemplateForSignType(signTypeCode) {
        if (!window.appBridge) {
            console.warn('App bridge not available for template fetching');
            return null;
        }

        // Check cache first
        if (this.templates.has(signTypeCode)) {
            const cachedTemplate = this.templates.get(signTypeCode);
            // Check if cached template is still fresh (less than 5 minutes old)
            const cacheAge = Date.now() - (cachedTemplate.lastFetched || 0);
            if (cacheAge < 5 * 60 * 1000) {
                // 5 minutes
                return cachedTemplate;
            }
        }

        try {
            console.log(`🎨 Fetching template for sign type: ${signTypeCode}`);
            const response = await window.appBridge.sendRequest('design_slayer', {
                type: 'get-design-for-sign-type',
                signTypeCode: signTypeCode
            });

            if (response && response.hasTemplate && response.template) {
                // Create enhanced template object
                const template = new DesignTemplate(response.template);
                template.lastFetched = Date.now();
                template.source = response.source;
                template.fieldMappings = response.template.fieldMappings || {};
                template.renderingInstructions = response.template.renderingInstructions || {};
                template.availableFields = response.template.availableFields || [];

                // Cache the template
                this.templates.set(signTypeCode, template);

                console.log(
                    `✅ Successfully fetched template for ${signTypeCode} (source: ${response.source})`
                );
                return template;
            } else if (response && !response.hasTemplate) {
                console.log(`📝 No template found for sign type: ${signTypeCode}`);
                console.log(
                    `💡 Suggestion: ${response.suggestion || 'Create a template in Design Slayer'}`
                );

                // Cache the "no template" result to avoid repeated requests
                this.templates.set(signTypeCode, {
                    hasTemplate: false,
                    signTypeCode: signTypeCode,
                    lastFetched: Date.now(),
                    suggestion: response.suggestion,
                    availableFields: response.availableFields || []
                });

                return null;
            }
        } catch (error) {
            console.error(`❌ Failed to fetch template for ${signTypeCode}:`, error);
        }

        return null;
    }

    /**
     * Fetch and cache all available templates
     */
    async fetchAllTemplates() {
        if (!window.appBridge) return;

        try {
            console.log('🎨 Fetching all available templates...');
            const response = await window.appBridge.sendRequest('design_slayer', {
                type: 'get-templates'
            });

            if (response && response.templates) {
                this.processTemplateData(response.templates);
                console.log(`✅ Fetched ${response.templates.length} templates from Design Slayer`);
            }
        } catch (error) {
            console.error('Failed to fetch all templates:', error);
        }
    }

    /**
     * Clear template cache (useful for forcing refresh)
     */
    clearTemplateCache() {
        this.templates.clear();
        console.log('🗑️ Template cache cleared');
    }

    /**
     * Process location data from Mapping Slayer
     */
    processLocationData(locations) {
        console.log('📍 processLocationData called with', locations.length, 'locations');

        // If we get empty locations and have existing data, don't clear it
        if (locations.length === 0) {
            const state = getState();
            if (state.locations && state.locations.size > 0) {
                console.log(
                    '📍 Received empty locations but have existing data - keeping existing data'
                );
                return;
            }
        }

        // Transform locations to include dynamic fields
        const processedLocations = locations.map(loc => {
            const signType = this.signTypes.get(loc.markerType);
            const processed = {
                id: loc.internalId || loc.id || `loc_${loc.locationNumber}_${loc.pageNumber}`,
                locationId:
                    loc.internalId || loc.id || `loc_${loc.locationNumber}_${loc.pageNumber}`,
                internalId: loc.internalId || loc.id,
                locationNumber: loc.locationNumber,
                pageNumber: loc.pageNumber || 1,
                sheetName: loc.sheetName || `Page ${loc.pageNumber || 1}`,

                // Sign type info
                signType: loc.markerType || 'default',
                signTypeCode: loc.markerType || '',
                signTypeName: signType?.name || loc.markerType || 'Default',
                signTypeInfo: signType ? signType.toJSON() : {},
                markerType: loc.markerType || 'default', // Preserve for DOT column color matching

                // Position
                x: loc.x,
                y: loc.y,

                // Status flags
                installed: loc.installed || false,
                notes: loc.notes || '',

                // Corner flags - use from Mapping Slayer response
                flags: loc.flags || {
                    topLeft: false,
                    topRight: false,
                    bottomLeft: false,
                    bottomRight: false
                }
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

                // Add type-specific properties with better color preservation
                if (layer.type === 'plate') {
                    // Preserve all color properties from Design Slayer
                    thumbnailLayer.backgroundColor =
                        layer.backgroundColor || layer.color || '#003366';
                    thumbnailLayer.color = layer.color || layer.backgroundColor || '#003366';
                    thumbnailLayer.material = layer.material;
                    thumbnailLayer.thickness = layer.thickness;
                } else if (layer.type === 'paragraph-text' || layer.type === 'braille-text') {
                    thumbnailLayer.type = 'text'; // Normalize text types
                    thumbnailLayer.text = layer.text || '';
                    thumbnailLayer.fieldName = layer.fieldName;
                    thumbnailLayer.fontSize = layer.fontSize || 16;
                    // Preserve text color properties from Design Slayer
                    thumbnailLayer.fontColor =
                        layer.fontColor || layer.textColor || layer.color || '#ffffff';
                    thumbnailLayer.textColor =
                        layer.textColor || layer.fontColor || layer.color || '#ffffff';
                    thumbnailLayer.color =
                        layer.color || layer.textColor || layer.fontColor || '#ffffff';
                    thumbnailLayer.fontFamily = layer.fontFamily || layer.font || 'Arial';
                    thumbnailLayer.font = layer.font || layer.fontFamily || 'Arial';
                    thumbnailLayer.textAlign = layer.textAlign || 'left';
                    thumbnailLayer.verticalAlign = layer.verticalAlign || 'top';
                    thumbnailLayer.lineSpacing = layer.lineSpacing || 1.2;
                    thumbnailLayer.kerning = layer.kerning || 0;
                    thumbnailLayer.fontWeight = layer.fontWeight || 'normal';
                    thumbnailLayer.isBraille = layer.type === 'braille-text';
                    thumbnailLayer.brailleSourceText = layer.brailleSourceText;
                } else if (layer.type === 'logo' || layer.type === 'icon') {
                    thumbnailLayer.backgroundColor =
                        layer.backgroundColor || layer.color || '#f07727';
                    thumbnailLayer.color = layer.color || layer.backgroundColor || '#f07727';
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
        console.log('🚀 updateLocationField called', { locationId, fieldName, value });

        try {
            // Send update directly through appBridge if available
            if (window.appBridge) {
                const updates = {};

                // Handle flag fields specially - send them individually like installed
                if (['topLeft', 'topRight', 'bottomLeft', 'bottomRight'].includes(fieldName)) {
                    // For flags, we send them as individual fields, not nested
                    // This matches how 'installed' works
                    updates[fieldName] = value;

                    console.log('🚀 Updating flag field:', {
                        locationId,
                        fieldName,
                        value,
                        updates
                    });

                    // Update our local state
                    const state = getState();
                    const location = Array.from(state.locations.values()).find(
                        loc => loc.locationId === locationId || loc.id === locationId
                    );

                    if (location) {
                        if (!location.flags) {
                            location.flags = {
                                topLeft: false,
                                topRight: false,
                                bottomLeft: false,
                                bottomRight: false
                            };
                        }
                        location.flags[fieldName] = value;
                    }
                } else {
                    updates[fieldName] = value;
                }

                console.log('🚀 Sending update-dot request:', { locationId, updates });

                const response = await window.appBridge.sendRequest('mapping_slayer', {
                    type: 'update-dot',
                    locationId: locationId,
                    updates: updates
                });

                console.log('🚀 update-dot response:', response);

                if (response && response.error) {
                    console.error('🚀 update-dot error:', response.error);
                    return false;
                }

                if (response && response.success) {
                    // Sync with other apps through sync manager
                    if (this.syncManager) {
                        if (fieldName === 'notes') {
                            await this.syncManager.syncNotesChange(locationId, value, this.appName);
                        } else if (
                            ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'].includes(fieldName)
                        ) {
                            // For flags, sync as a message change with the flag path
                            await this.syncManager.syncMessageChange(
                                locationId,
                                `flags.${fieldName}`,
                                value,
                                this.appName
                            );
                        } else {
                            await this.syncManager.syncMessageChange(
                                locationId,
                                fieldName,
                                value,
                                this.appName
                            );
                        }
                    } else {
                        console.warn('🚀 syncManager not available for broadcast');
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
        const affectedLocations = Array.from(state.locations.values()).filter(
            loc => loc.signTypeCode === data.code
        );

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
        const affectedLocations = Array.from(state.locations.values()).filter(
            loc => loc.signTypeCode === data.signTypeCode
        );

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
        const affectedLocations = Array.from(state.locations.values()).filter(
            loc => loc.signTypeCode === data.signTypeCode
        );

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
            // Check if this is a flag field update
            if (data.fieldName && data.fieldName.startsWith('flags.')) {
                // Extract flag name (e.g., 'flags.topLeft' -> 'topLeft')
                const flagName = data.fieldName.split('.')[1];
                if (!location.flags) {
                    location.flags = {
                        topLeft: false,
                        topRight: false,
                        bottomLeft: false,
                        bottomRight: false
                    };
                }
                location.flags[flagName] = data.value;
            } else {
                // Regular field update
                location[data.fieldName] = data.value;
            }
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
        return Array.from(this.templates.values()).filter(
            template => template.signTypeCode === signTypeCode
        );
    }

    /**
     * Save flags to localStorage for persistence
     */
    saveFlagsToStorage(locationId, flags) {
        try {
            const storageKey = 'thumbnail_slayer_flags';
            const storedData = localStorage.getItem(storageKey);
            const flagsData = storedData ? JSON.parse(storedData) : {};

            flagsData[locationId] = flags;

            localStorage.setItem(storageKey, JSON.stringify(flagsData));
            console.log('💾 Saved flags to localStorage for location:', locationId);
        } catch (error) {
            console.error('Failed to save flags to localStorage:', error);
        }
    }

    /**
     * Load flags from localStorage
     */
    loadFlagsFromStorage() {
        const flagsMap = new Map();
        try {
            const storageKey = 'thumbnail_slayer_flags';
            const storedData = localStorage.getItem(storageKey);

            if (storedData) {
                const flagsData = JSON.parse(storedData);
                Object.entries(flagsData).forEach(([locationId, flags]) => {
                    flagsMap.set(locationId, flags);
                });
                console.log('💾 Loaded', flagsMap.size, 'flag states from localStorage');
            }
        } catch (error) {
            console.error('Failed to load flags from localStorage:', error);
        }
        return flagsMap;
    }

    /**
     * Clear flags from localStorage (for cleanup if needed)
     */
    clearFlagsFromStorage() {
        try {
            localStorage.removeItem('thumbnail_slayer_flags');
            console.log('💾 Cleared flags from localStorage');
        } catch (error) {
            console.error('Failed to clear flags from localStorage:', error);
        }
    }
}

// Create and export singleton instance
export const thumbnailSyncAdapter = new ThumbnailSyncAdapter();

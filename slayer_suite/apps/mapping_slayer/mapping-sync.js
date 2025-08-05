/**
 * mapping-sync.js
 * Synchronization adapter for Mapping Slayer
 */

import { createSyncManager, SYNC_EVENTS, DataModels } from '../../core/index.js';
import { appState, setDirtyState } from './state.js';
import { updateFilterCheckboxes, updateMarkerTypeSelect } from './ui.js';
import { renderDotsForCurrentPage } from './map-controller.js';

const { SignType, SignInstance } = DataModels;

class MappingSyncAdapter {
    constructor() {
        this.syncManager = null;
        this.appName = 'mapping_slayer';
    }

    /**
     * Initialize sync adapter
     * @param {AppBridge} appBridge - App bridge instance
     */
    initialize(appBridge) {
        this.syncManager = createSyncManager(appBridge);
        
        // Custom handlers for Mapping Slayer
        const handlers = {
            [SYNC_EVENTS.SIGN_TYPE_CREATED]: (data) => this.handleSignTypeCreated(data),
            [SYNC_EVENTS.SIGN_TYPE_UPDATED]: (data) => this.handleSignTypeUpdated(data),
            [SYNC_EVENTS.SIGN_TYPE_DELETED]: (data) => this.handleSignTypeDeleted(data),
            [SYNC_EVENTS.SIGN_TYPE_FIELD_ADDED]: (data) => this.handleFieldAdded(data),
            [SYNC_EVENTS.SIGN_TYPE_FIELD_REMOVED]: (data) => this.handleFieldRemoved(data),
            [SYNC_EVENTS.SIGN_NOTES_CHANGED]: (data) => this.handleNotesChanged(data),
            [SYNC_EVENTS.SIGN_MESSAGE_CHANGED]: (data) => this.handleMessageChanged(data)
        };
        
        this.syncManager.initializeApp(this.appName, handlers);
        
        // Override helper methods
        this.syncManager.getSignsForType = (code) => this.getSignsForType(code);
        this.syncManager.getSignsWithFieldData = (code, fieldName) => this.getSignsWithFieldData(code, fieldName);
    }

    /**
     * Convert current markerTypes to SignType format and sync
     */
    async syncMarkerTypes(appBridge) {
        const signTypes = new Map();
        
        // Convert existing markerTypes to SignType instances
        Object.entries(appState.markerTypes).forEach(([code, markerData]) => {
            const signType = SignType.fromMarkerType(code, markerData);
            signTypes.set(code, signType.toJSON());
        });
        
        // Update shared data
        appBridge.updateSignTypes(signTypes, this.appName);
    }

    /**
     * Create a new marker type and sync
     */
    async createMarkerType(code, name, color, textColor) {
        const signType = new SignType({
            code,
            name,
            color,
            textColor,
            createdBy: this.appName
        });
        
        // Add to local state
        appState.markerTypes[code] = signType.toMarkerType();
        // Include text fields in local state
        appState.markerTypes[code].textFields = signType.textFields;
        
        // Set as active marker type
        appState.activeMarkerType = code;
        
        setDirtyState();
        
        // Sync with other apps
        await this.syncManager.createSignType(signType, this.appName);
        
        // Update UI
        updateFilterCheckboxes();
        updateMarkerTypeSelect();
        
        return signType;
    }

    /**
     * Update a marker type
     */
    async updateMarkerType(code, updates) {
        if (!appState.markerTypes[code]) {
            throw new Error(`Marker type ${code} not found`);
        }
        
        // Update local state
        Object.assign(appState.markerTypes[code], updates);
        setDirtyState();
        
        // Sync with other apps
        await this.syncManager.updateSignType(code, updates, this.appName);
        
        // Update UI
        updateFilterCheckboxes();
        renderDotsForCurrentPage();
    }

    /**
     * Delete a marker type with cascade
     */
    async deleteMarkerType(code, confirmCallback) {
        const result = await this.syncManager.deleteSignType(code, this.appName, confirmCallback);
        
        if (result) {
            // Remove from local state
            delete appState.markerTypes[code];
            
            // Remove all dots of this type
            for (const pageData of appState.dotsByPage.values()) {
                for (const [dotId, dot] of pageData.dots.entries()) {
                    if (dot.markerType === code) {
                        pageData.dots.delete(dotId);
                    }
                }
            }
            
            // Update active marker type if needed
            if (appState.activeMarkerType === code) {
                const remainingTypes = Object.keys(appState.markerTypes);
                appState.activeMarkerType = remainingTypes.length > 0 ? remainingTypes[0] : null;
            }
            
            setDirtyState();
            
            // Update UI
            updateFilterCheckboxes();
            updateMarkerTypeSelect();
            renderDotsForCurrentPage();
        }
        
        return result;
    }

    /**
     * Add a text field to all dots of a marker type
     */
    async addTextFieldToDots(markerTypeCode, fieldName) {
        // Add field to all existing dots
        for (const pageData of appState.dotsByPage.values()) {
            for (const dot of pageData.dots.values()) {
                if (dot.markerType === markerTypeCode) {
                    if (!dot[fieldName]) {
                        dot[fieldName] = '';
                    }
                }
            }
        }
        
        setDirtyState();
    }

    /**
     * Remove a text field from all dots of a marker type
     */
    async removeTextFieldFromDots(markerTypeCode, fieldName) {
        // Remove field from all existing dots
        for (const pageData of appState.dotsByPage.values()) {
            for (const dot of pageData.dots.values()) {
                if (dot.markerType === markerTypeCode) {
                    delete dot[fieldName];
                }
            }
        }
        
        setDirtyState();
    }

    // Handler implementations
    handleSignTypeCreated(data) {
        console.log('Mapping Slayer: Sign type created', data);
        
        // Add to local markerTypes if it doesn't exist
        if (!appState.markerTypes[data.code]) {
            const signType = new SignType(data);
            appState.markerTypes[data.code] = signType.toMarkerType();
            setDirtyState();
            
            updateFilterCheckboxes();
            updateMarkerTypeSelect();
        }
    }

    handleSignTypeUpdated(data) {
        console.log('Mapping Slayer: Sign type updated', data);
        
        // Update local markerType
        if (appState.markerTypes[data.code]) {
            const signType = new SignType(data);
            appState.markerTypes[data.code] = signType.toMarkerType();
            setDirtyState();
            
            updateFilterCheckboxes();
            renderDotsForCurrentPage();
        }
    }

    handleSignTypeDeleted(data) {
        console.log('Mapping Slayer: Sign type deleted', data);
        
        // Remove from local state
        if (appState.markerTypes[data.code]) {
            delete appState.markerTypes[data.code];
            
            // Remove cascaded signs
            if (data.cascadedSigns) {
                for (const pageData of appState.dotsByPage.values()) {
                    for (const sign of data.cascadedSigns) {
                        if (pageData.dots.has(sign.internalId)) {
                            pageData.dots.delete(sign.internalId);
                        }
                    }
                }
            }
            
            setDirtyState();
            updateFilterCheckboxes();
            updateMarkerTypeSelect();
            renderDotsForCurrentPage();
        }
    }

    handleFieldAdded(data) {
        console.log('Mapping Slayer: Field added', data);
        
        const { signTypeCode, field } = data;
        
        if (appState.markerTypes[signTypeCode]) {
            // Initialize textFields array if not exists
            if (!appState.markerTypes[signTypeCode].textFields) {
                appState.markerTypes[signTypeCode].textFields = [
                    { fieldName: 'message', maxLength: null },
                    { fieldName: 'message2', maxLength: null }
                ];
            }
            
            // Add the new field if it doesn't exist
            const exists = appState.markerTypes[signTypeCode].textFields.some(
                f => f.fieldName === field.fieldName
            );
            
            if (!exists) {
                appState.markerTypes[signTypeCode].textFields.push(field);
            }
            
            // Add field to all dots of this type
            this.addTextFieldToDots(signTypeCode, field.fieldName);
            
            // Update UI
            updateFilterCheckboxes();
            setDirtyState();
        }
    }

    handleFieldRemoved(data) {
        console.log('Mapping Slayer: Field removed', data);
        
        const { signTypeCode, fieldName } = data;
        
        if (appState.markerTypes[signTypeCode]) {
            // Remove from textFields array
            if (appState.markerTypes[signTypeCode].textFields) {
                const index = appState.markerTypes[signTypeCode].textFields.findIndex(
                    f => f.fieldName === fieldName
                );
                if (index !== -1) {
                    appState.markerTypes[signTypeCode].textFields.splice(index, 1);
                }
            }
            
            // Remove field from all dots of this type
            this.removeTextFieldFromDots(signTypeCode, fieldName);
            
            // Update UI
            updateFilterCheckboxes();
            setDirtyState();
        }
    }

    handleNotesChanged(data) {
        console.log('Mapping Slayer: Notes changed', data);
        
        // Find the dot and update its notes
        for (const pageData of appState.dotsByPage.values()) {
            for (const dot of pageData.dots.values()) {
                if (dot.internalId === data.signId) {
                    dot.notes = data.notes;
                    setDirtyState();
                    
                    // Update UI if this dot is visible
                    // TODO: Update dot display
                    return;
                }
            }
        }
    }

    handleMessageChanged(data) {
        console.log('Mapping Slayer: Message changed', data);
        
        // Find the dot and update its message
        for (const pageData of appState.dotsByPage.values()) {
            for (const dot of pageData.dots.values()) {
                if (dot.internalId === data.signId) {
                    dot[data.fieldName] = data.value;
                    setDirtyState();
                    
                    // Update UI if this dot is visible
                    renderDotsForCurrentPage();
                    return;
                }
            }
        }
    }

    // Helper method implementations
    async getSignsForType(signTypeCode) {
        const signs = [];
        
        for (const [pageNum, pageData] of appState.dotsByPage.entries()) {
            for (const dot of pageData.dots.values()) {
                if (dot.markerType === signTypeCode) {
                    const signInstance = SignInstance.fromDot(dot, pageNum);
                    signs.push(signInstance);
                }
            }
        }
        
        return signs;
    }

    async getSignsWithFieldData(signTypeCode, fieldName) {
        const signs = [];
        
        for (const [pageNum, pageData] of appState.dotsByPage.entries()) {
            for (const dot of pageData.dots.values()) {
                if (dot.markerType === signTypeCode && dot[fieldName]) {
                    const signInstance = SignInstance.fromDot(dot, pageNum);
                    signs.push(signInstance);
                }
            }
        }
        
        return signs;
    }

    /**
     * Sync a dot change (message or notes)
     */
    async syncDotChange(dot, fieldName, value) {
        if (fieldName === 'notes') {
            await this.syncManager.syncNotesChange(dot.internalId, value, this.appName);
        } else {
            // Handle all text fields (message, message2, custom fields)
            await this.syncManager.syncMessageChange(dot.internalId, fieldName, value, this.appName);
        }
    }
    
    /**
     * Sync text field added to marker type
     */
    async syncTextFieldAdded(markerTypeCode, field) {
        await this.syncManager.addTextField(
            markerTypeCode,
            field.fieldName,
            {
                maxLength: field.maxLength
            },
            this.appName
        );
    }
    
    /**
     * Sync text field removed from marker type
     */
    async syncTextFieldRemoved(markerTypeCode, fieldName) {
        await this.syncManager.removeTextField(
            markerTypeCode,
            fieldName,
            this.appName
        );
    }
    
    /**
     * Sync text field updated
     * Note: Currently only maxLength can be updated since required is now auto-determined
     */
    async syncTextFieldUpdated(markerTypeCode, fieldName, field) {
        // Since updateSignTypeField doesn't exist in sync-manager and we removed the required property,
        // we only need to update the sign type if maxLength changed
        const signTypes = this.syncManager.appBridge.getSignTypes();
        const signTypeData = signTypes.get(markerTypeCode);
        
        if (signTypeData) {
            const signType = new SignType(signTypeData);
            signType.updateTextField(fieldName, { maxLength: field.maxLength });
            
            // Update shared data
            signTypes.set(markerTypeCode, signType.toJSON());
            this.syncManager.appBridge.updateSignTypes(signTypes, this.appName);
            
            // Emit update event
            this.syncManager.appBridge.emitSyncEvent(SYNC_EVENTS.SIGN_TYPE_UPDATED, signType.toJSON(), this.appName);
        }
    }
}

// Create and export singleton instance
export const mappingSyncAdapter = new MappingSyncAdapter();
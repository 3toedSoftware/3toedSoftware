/**
 * sync-manager.js
 * Central synchronization management for the Slayer Suite.
 *
 * This module handles all cross-app data synchronization, ensuring that changes
 * in one app are immediately reflected in all other apps. It manages event
 * broadcasting, data consistency, cascade operations, and conflict resolution.
 *
 * @module core/sync-manager
 */

import { SignType, SYNC_EVENTS, Validators } from './data-models.js';

/**
 * SyncManager class handles cross-app data synchronization.
 * Each app should create its own instance and customize the event handlers.
 *
 * @class SyncManager
 * @example
 * // In Mapping Slayer
 * const syncManager = new SyncManager(appBridge);
 * syncManager.initializeApp('mapping_slayer', {
 *   [SYNC_EVENTS.SIGN_TYPE_CREATED]: (data) => {
 *     // Add new sign type to marker types
 *     markerTypes[data.code] = SignType.fromMarkerType(data);
 *   }
 * });
 *
 * // Create a new sign type and sync it
 * await syncManager.createSignType({
 *   code: 'I.1',
 *   name: 'Room Sign',
 *   color: '#0066CC'
 * }, 'mapping_slayer');
 */
export class SyncManager {
    constructor(appBridge) {
        this.appBridge = appBridge;
        this.pendingSync = new Map();
        this.syncInProgress = false;
        this.conflictResolution = 'last-write-wins'; // or 'merge', 'manual'
    }

    /**
     * Initialize sync manager for an app with custom event handlers
     * @param {string} appName - Name of the app (e.g., 'mapping_slayer')
     * @param {Object} handlers - Custom event handlers for sync events
     * @example
     * syncManager.initializeApp('design_slayer', {
     *   [SYNC_EVENTS.SIGN_TYPE_FIELD_ADDED]: (data) => {
     *     // Update UI to show new field option
     *     addFieldToLayerOptions(data.fieldName);
     *   }
     * });
     */
    initializeApp(appName, handlers = {}) {
        // Register default handlers
        const defaultHandlers = {
            [SYNC_EVENTS.SIGN_TYPE_CREATED]: data => this.handleSignTypeCreated(appName, data),
            [SYNC_EVENTS.SIGN_TYPE_UPDATED]: data => this.handleSignTypeUpdated(appName, data),
            [SYNC_EVENTS.SIGN_TYPE_DELETED]: data => this.handleSignTypeDeleted(appName, data),
            [SYNC_EVENTS.SIGN_TYPE_FIELD_ADDED]: data => this.handleFieldAdded(appName, data),
            [SYNC_EVENTS.SIGN_TYPE_FIELD_REMOVED]: data => this.handleFieldRemoved(appName, data),
            [SYNC_EVENTS.SIGN_MESSAGE_CHANGED]: data => this.handleMessageChanged(appName, data),
            [SYNC_EVENTS.SIGN_NOTES_CHANGED]: data => this.handleNotesChanged(appName, data),
            ...handlers
        };

        // Register handlers with app bridge
        Object.entries(defaultHandlers).forEach(([event, handler]) => {
            this.appBridge.registerSyncHandler(appName, event, handler);
        });
    }

    /**
     * Sync all sign types between apps
     * Typically called during app initialization or after bulk changes
     * @param {Map|Object} signTypes - Complete set of sign types to sync
     * @param {string} sourceApp - App that initiated the sync
     * @returns {Promise<void>}
     * @example
     * // Sync all marker types from Mapping Slayer
     * await syncManager.syncSignTypes(markerTypes, 'mapping_slayer');
     */
    async syncSignTypes(signTypes, sourceApp) {
        const signTypesMap =
            signTypes instanceof Map ? signTypes : new Map(Object.entries(signTypes));

        // Update shared data
        this.appBridge.updateSignTypes(signTypesMap, sourceApp);

        // Notify other apps
        this.appBridge.emitSyncEvent(
            SYNC_EVENTS.SIGN_TYPE_UPDATED,
            {
                signTypes: Array.from(signTypesMap.values()).map(st =>
                    st instanceof SignType ? st.toJSON() : st
                )
            },
            sourceApp
        );
    }

    /**
     * Create a new sign type and sync across all apps
     * @param {SignType|Object} signTypeData - Sign type data or SignType instance
     * @param {string} sourceApp - App creating the sign type
     * @returns {Promise<SignType>} The created sign type
     * @throws {Error} If sign type code is invalid or already exists
     * @example
     * const newSignType = await syncManager.createSignType({
     *   code: 'E.1',
     *   name: 'Exit Sign',
     *   color: '#FF0000',
     *   textFields: [
     *     { fieldName: 'exitRoute' }
     *   ]
     * }, 'design_slayer');
     */
    async createSignType(signTypeData, sourceApp) {
        const signType =
            signTypeData instanceof SignType ? signTypeData : new SignType(signTypeData);

        // Validate
        if (!Validators.isValidSignTypeCode(signType.code)) {
            throw new Error(`Invalid sign type code: ${signType.code}`);
        }

        // Get current sign types
        const signTypes = this.appBridge.getSignTypes();

        // Check for duplicates
        if (signTypes.has(signType.code)) {
            throw new Error(`Sign type with code ${signType.code} already exists`);
        }

        // Add to shared data
        signTypes.set(signType.code, signType.toJSON());
        this.appBridge.updateSignTypes(signTypes, sourceApp);

        // Emit event
        this.appBridge.emitSignTypeEvent(
            SYNC_EVENTS.SIGN_TYPE_CREATED,
            signType.toJSON(),
            sourceApp
        );

        return signType;
    }

    /**
     * Update an existing sign type
     * @param {string} code - Sign type code
     * @param {Object} updates - Updates to apply
     * @param {string} sourceApp - App making the update
     */
    async updateSignType(code, updates, sourceApp) {
        const signTypes = this.appBridge.getSignTypes();
        const existing = signTypes.get(code);

        if (!existing) {
            throw new Error(`Sign type ${code} not found`);
        }

        // Apply updates
        const updated = { ...existing, ...updates, lastModified: new Date().toISOString() };
        signTypes.set(code, updated);

        // Update shared data
        this.appBridge.updateSignTypes(signTypes, sourceApp);

        // Emit event
        this.appBridge.emitSignTypeEvent(SYNC_EVENTS.SIGN_TYPE_UPDATED, updated, sourceApp);

        return updated;
    }

    /**
     * Delete a sign type with cascade warning for associated signs
     * @param {string} code - Sign type code to delete
     * @param {string} sourceApp - App requesting deletion
     * @param {Function} confirmCallback - Async callback to confirm deletion
     * @returns {Promise<boolean>} True if deleted, false if cancelled
     * @example
     * const deleted = await syncManager.deleteSignType('I.1', 'design_slayer',
     *   async (warningMessage) => {
     *     return await showConfirmDialog(warningMessage);
     *   }
     * );
     */
    async deleteSignType(code, sourceApp, confirmCallback) {
        const signTypes = this.appBridge.getSignTypes();
        const signType = signTypes.get(code);

        if (!signType) {
            throw new Error(`Sign type ${code} not found`);
        }

        // Check for associated signs
        const associatedSigns = await this.getSignsForType(code);

        if (associatedSigns.length > 0) {
            const message =
                `Warning: There are ${associatedSigns.length} mapped locations of sign type "${code} - ${signType.name}". ` +
                'Deleting this sign type will delete all corresponding dots in Mapping Slayer. This cannot be undone.';

            if (confirmCallback) {
                const confirmed = await confirmCallback(message);
                if (!confirmed) return false;
            }
        }

        // Delete from shared data
        signTypes.delete(code);
        this.appBridge.updateSignTypes(signTypes, sourceApp);

        // Emit deletion event
        this.appBridge.emitSignTypeEvent(
            SYNC_EVENTS.SIGN_TYPE_DELETED,
            {
                code,
                signType,
                cascadedSigns: associatedSigns
            },
            sourceApp
        );

        return true;
    }

    /**
     * Add a text field to a sign type and sync to all apps
     * @param {string} code - Sign type code
     * @param {string} fieldName - Field name to add (e.g., 'department')
     * @param {Object} fieldOptions - Field configuration
     * @param {number} fieldOptions.maxLength - Maximum character length
     * @param {string} sourceApp - App adding the field
     * @returns {Promise<SignType>} Updated sign type
     * @throws {Error} If field name is invalid or already exists
     * @example
     * await syncManager.addTextField('I.1', 'occupantName',
     *   { maxLength: 50 },
     *   'mapping_slayer'
     * );
     */
    async addTextField(code, fieldName, fieldOptions, sourceApp) {
        if (!Validators.isValidFieldName(fieldName)) {
            throw new Error(`Invalid field name: ${fieldName}`);
        }

        const signTypes = this.appBridge.getSignTypes();
        const signTypeData = signTypes.get(code);

        if (!signTypeData) {
            throw new Error(`Sign type ${code} not found`);
        }

        // Create SignType instance to use its methods
        const signType = new SignType(signTypeData);

        // Check if field already exists
        if (signType.textFields.find(f => f.fieldName === fieldName)) {
            throw new Error(`Field ${fieldName} already exists in sign type ${code}`);
        }

        // Add field
        signType.addTextField(fieldName, fieldOptions.maxLength);

        // Update shared data
        signTypes.set(code, signType.toJSON());
        this.appBridge.updateSignTypes(signTypes, sourceApp);

        // Emit event
        this.appBridge.emitSyncEvent(
            SYNC_EVENTS.SIGN_TYPE_FIELD_ADDED,
            {
                signTypeCode: code,
                fieldName,
                fieldOptions,
                signType: signType.toJSON()
            },
            sourceApp
        );

        return signType;
    }

    /**
     * Remove a text field from a sign type
     * @param {string} code - Sign type code
     * @param {string} fieldName - Field name to remove
     * @param {string} sourceApp - App removing the field
     * @param {Function} confirmCallback - Callback to confirm removal
     */
    async removeTextField(code, fieldName, sourceApp, confirmCallback) {
        const signTypes = this.appBridge.getSignTypes();
        const signTypeData = signTypes.get(code);

        if (!signTypeData) {
            throw new Error(`Sign type ${code} not found`);
        }

        // Check if field has data
        const signsWithData = await this.getSignsWithFieldData(code, fieldName);

        if (signsWithData.length > 0 && confirmCallback) {
            const message =
                `Warning: ${signsWithData.length} signs have data in the "${fieldName}" field. ` +
                'Removing this field will delete all associated data. This cannot be undone.';

            const confirmed = await confirmCallback(message);
            if (!confirmed) return false;
        }

        // Create SignType instance and remove field
        const signType = new SignType(signTypeData);
        signType.removeTextField(fieldName);

        // Update shared data
        signTypes.set(code, signType.toJSON());
        this.appBridge.updateSignTypes(signTypes, sourceApp);

        // Emit event
        this.appBridge.emitSyncEvent(
            SYNC_EVENTS.SIGN_TYPE_FIELD_REMOVED,
            {
                signTypeCode: code,
                fieldName,
                affectedSigns: signsWithData,
                signType: signType.toJSON()
            },
            sourceApp
        );

        return true;
    }

    /**
     * Sync message field changes between apps in real-time
     * @param {string} signId - Sign instance ID or internalId
     * @param {string} fieldName - Field that changed (e.g., 'message', 'department')
     * @param {string} value - New value for the field
     * @param {string} sourceApp - App that made the change
     * @fires SYNC_EVENTS.SIGN_MESSAGE_CHANGED
     * @example
     * // When user types in message field
     * await syncManager.syncMessageChange(dot.internalId, 'message',
     *   'Conference Room A', 'mapping_slayer');
     */
    async syncMessageChange(signId, fieldName, value, sourceApp) {
        this.appBridge.emitSignEvent(
            SYNC_EVENTS.SIGN_MESSAGE_CHANGED,
            {
                signId,
                fieldName,
                value,
                timestamp: new Date().toISOString()
            },
            sourceApp
        );
    }

    /**
     * Sync notes changes between apps in real-time
     * @param {string} signId - Sign instance ID or internalId
     * @param {string} notes - New notes content
     * @param {string} sourceApp - App that made the change
     * @fires SYNC_EVENTS.SIGN_NOTES_CHANGED
     * @example
     * // When user updates notes in Thumbnail Slayer
     * await syncManager.syncNotesChange(thumbnail.id,
     *   'Needs special mounting bracket', 'thumbnail_slayer');
     */
    async syncNotesChange(signId, notes, sourceApp) {
        this.appBridge.emitSignEvent(
            SYNC_EVENTS.SIGN_NOTES_CHANGED,
            {
                signId,
                notes,
                timestamp: new Date().toISOString()
            },
            sourceApp
        );
    }

    // Handler methods (to be overridden by apps)
    handleSignTypeCreated(appName, data) {
        // console.log(`[${appName}] Sign type created:`, data);
    }

    handleSignTypeUpdated(appName, data) {
        // console.log(`[${appName}] Sign type updated:`, data);
    }

    handleSignTypeDeleted(appName, data) {
        // console.log(`[${appName}] Sign type deleted:`, data);
    }

    handleFieldAdded(appName, data) {
        // console.log(`[${appName}] Field added:`, data);
    }

    handleFieldRemoved(appName, data) {
        // console.log(`[${appName}] Field removed:`, data);
    }

    handleMessageChanged(appName, data) {
        // console.log(`[${appName}] Message changed:`, data);
    }

    handleNotesChanged(appName, data) {
        // console.log(`[${appName}] Notes changed:`, data);
    }

    /**
     * Get all signs of a specific type (to be implemented by each app)
     * @abstract
     * @param {string} signTypeCode - Sign type code to search for
     * @returns {Promise<Array>} Array of sign instances
     * @example
     * // Implementation in Mapping Slayer
     * async getSignsForType(signTypeCode) {
     *   return this.dots.filter(dot => dot.markerType === signTypeCode);
     * }
     */
    async getSignsForType(signTypeCode) {
        // This should be implemented by the app to return signs of a specific type
        return [];
    }

    async getSignsWithFieldData(signTypeCode, fieldName) {
        // This should be implemented by the app to return signs with data in a specific field
        return [];
    }
}

/**
 * Factory function to create a sync manager instance for an app
 * @param {AppBridge} appBridge - App bridge instance
 * @returns {SyncManager} Configured sync manager instance
 * @example
 * import { appBridge } from '../core/app-bridge.js';
 * import { createSyncManager } from '../core/sync-manager.js';
 *
 * const syncManager = createSyncManager(appBridge);
 * syncManager.initializeApp('my_app', handlers);
 */
export function createSyncManager(appBridge) {
    return new SyncManager(appBridge);
}

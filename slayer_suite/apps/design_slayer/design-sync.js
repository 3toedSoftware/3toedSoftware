/**
 * design-sync.js
 * Synchronization adapter for Design Slayer
 */

import { createSyncManager, SYNC_EVENTS, DataModels } from '../../core/index.js';
import { state, updateState } from './state.js';

const { SignType, DesignTemplate } = DataModels;

class DesignSyncAdapter {
    constructor() {
        this.syncManager = null;
        this.appName = 'design_slayer';
        this.signTypes = new Map(); // Local cache of sign types
    }

    /**
     * Initialize sync adapter
     * @param {AppBridge} appBridge - App bridge instance
     */
    initialize(appBridge) {
        this.syncManager = createSyncManager(appBridge);

        // Custom handlers for Design Slayer
        const handlers = {
            [SYNC_EVENTS.SIGN_TYPE_CREATED]: data => this.handleSignTypeCreated(data),
            [SYNC_EVENTS.SIGN_TYPE_UPDATED]: data => this.handleSignTypeUpdated(data),
            [SYNC_EVENTS.SIGN_TYPE_DELETED]: data => this.handleSignTypeDeleted(data),
            [SYNC_EVENTS.SIGN_TYPE_FIELD_ADDED]: data => this.handleFieldAdded(data),
            [SYNC_EVENTS.SIGN_TYPE_FIELD_REMOVED]: data => this.handleFieldRemoved(data),
            [SYNC_EVENTS.TEMPLATE_CREATED]: data => this.handleTemplateCreated(data),
            [SYNC_EVENTS.TEMPLATE_UPDATED]: data => this.handleTemplateUpdated(data),
            [SYNC_EVENTS.TEMPLATE_DELETED]: data => this.handleTemplateDeleted(data)
        };

        this.syncManager.initializeApp(this.appName, handlers);

        // Load existing sign types from shared data
        this.loadSignTypes(appBridge);

        // Listen for bulk sign type changes (e.g., when loading from .slayer files)
        appBridge.on('sharedData:changed', event => {
            if (event.key === 'signTypes') {
                console.log(
                    '📦 Design Slayer: Bulk sign types update received, count:',
                    event.value ? event.value.size : 0
                );
                this.loadSignTypes(appBridge);
            }
        });
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

        // Update UI if needed
        this.updateSignTypeUI();
    }

    /**
     * Create a new sign type
     */
    async createSignType(code, name) {
        const signType = new SignType({
            code,
            name,
            createdBy: this.appName
        });

        // Add to local cache
        this.signTypes.set(code, signType);

        // Sync with other apps
        await this.syncManager.createSignType(signType, this.appName);

        // Update UI
        this.updateSignTypeUI();

        // Set as current if no current sign type
        if (!state.currentSignType) {
            state.currentSignType = code;
        }

        return signType;
    }

    /**
     * Delete a sign type
     */
    async deleteSignType(code, confirmCallback) {
        const result = await this.syncManager.deleteSignType(code, this.appName, confirmCallback);

        if (result) {
            // Remove from local cache
            this.signTypes.delete(code);

            // Clear current sign type if it was deleted
            if (state.currentSignType === code) {
                const remaining = Array.from(this.signTypes.keys());
                state.currentSignType = remaining.length > 0 ? remaining[0] : null;
            }

            // Update UI
            this.updateSignTypeUI();
        }

        return result;
    }

    /**
     * Add a text field layer for a sign type
     */
    async addTextFieldLayer(signTypeCode, fieldName) {
        const signType = this.signTypes.get(signTypeCode);
        if (!signType) return;

        // Add field to sign type
        await this.syncManager.addTextField(
            signTypeCode,
            fieldName,
            {
                maxLength: null
            },
            this.appName
        );

        // Create a text layer in the current design
        if (state.currentSignType === signTypeCode) {
            this.createTextLayer(fieldName);
        }
    }

    /**
     * Create a text layer for a field
     */
    createTextLayer(fieldName) {
        // This will be implemented to create actual canvas layers
        // TODO: Create layer object and integrate with Design Slayer layer system
        // For now, just mark state as dirty
        updateState({ isDirty: true });
    }

    /**
     * Update sign type dropdown UI
     */
    updateSignTypeUI() {
        // This will be implemented to update the actual UI
        const signTypeSelect = document.getElementById('sign-type-select');
        if (!signTypeSelect) return;

        // Clear and rebuild options
        signTypeSelect.innerHTML = '<option value="">Select Sign Type...</option>';

        const sortedTypes = Array.from(this.signTypes.entries()).sort((a, b) =>
            a[0].localeCompare(b[0])
        );

        sortedTypes.forEach(([code, signType]) => {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = `${code} - ${signType.name}`;
            signTypeSelect.appendChild(option);
        });

        // Restore selection
        if (state.currentSignType) {
            signTypeSelect.value = state.currentSignType;
        }

        // Update layer dropdown
        this.updateLayerDropdown();
    }

    /**
     * Update layer dropdown with dynamic text fields
     */
    updateLayerDropdown() {
        const layerTypeSelect = document.getElementById('layer-type-select');
        if (!layerTypeSelect) return;

        // Clear current options
        layerTypeSelect.innerHTML = '<option value="">Select Layer Type</option>';

        // Add standard layer types
        const standardOptions = `
            <option value="plate">Plate</option>
            <option value="paragraph-text">Paragraph Text</option>
            <option value="braille-text">Braille Text</option>
            <option value="logo">Logo</option>
            <option value="icon">Icon</option>
        `;
        layerTypeSelect.innerHTML += standardOptions;

        // Add dynamic text fields if a sign type is selected
        if (state.currentSignType) {
            const signType = this.signTypes.get(state.currentSignType);
            if (signType && signType.textFields.length > 0) {
                // Add separator
                const separator = document.createElement('option');
                separator.disabled = true;
                separator.textContent = '── Message Fields ──';
                layerTypeSelect.appendChild(separator);

                // Add text field options
                signType.textFields.forEach(async field => {
                    const option = document.createElement('option');
                    option.value = `field:${field.fieldName}`;

                    // Check if field is required based on usage
                    const isRequired = await signType.isFieldRequired(field.fieldName);
                    option.textContent = `${field.fieldName} Field ${isRequired ? '(Required)' : ''}`;
                    layerTypeSelect.appendChild(option);
                });
            }
        }
    }

    // Handler implementations
    handleSignTypeCreated(data) {
        // Add to local cache
        const signType = new SignType(data);
        this.signTypes.set(data.code, signType);

        // Update UI
        this.updateSignTypeUI();
    }

    handleSignTypeUpdated(data) {
        // Update local cache
        if (this.signTypes.has(data.code)) {
            this.signTypes.set(data.code, new SignType(data));
            this.updateSignTypeUI();
        }
    }

    handleSignTypeDeleted(data) {
        // Remove from local cache
        this.signTypes.delete(data.code);

        // Update current selection if needed
        if (state.currentSignType === data.code) {
            const remaining = Array.from(this.signTypes.keys());
            state.currentSignType = remaining.length > 0 ? remaining[0] : null;
        }

        // Update UI
        this.updateSignTypeUI();
    }

    handleFieldAdded(data) {
        // Update local sign type
        const signType = this.signTypes.get(data.signTypeCode);
        if (signType) {
            signType.addTextField(data.fieldName, data.fieldOptions.maxLength);

            // If this is the current sign type, add a layer
            if (state.currentSignType === data.signTypeCode) {
                this.createTextLayer(data.fieldName);
            }
        }
    }

    handleFieldRemoved(data) {
        // Update local sign type
        const signType = this.signTypes.get(data.signTypeCode);
        if (signType) {
            signType.removeTextField(data.fieldName);

            // TODO: Remove corresponding layers from current design
        }
    }

    /**
     * Get all available sign types
     */
    getSignTypes() {
        return this.signTypes;
    }

    /**
     * Get a specific sign type
     */
    getSignType(code) {
        return this.signTypes.get(code);
    }

    /**
     * Save current design as template for sign type
     */
    async saveDesignTemplate(signTypeCode, canvasData) {
        const template = new DesignTemplate({
            signTypeCode,
            signTypeId: this.signTypes.get(signTypeCode)?.id,
            name: `${signTypeCode} Template`,
            faceView: {
                canvas: canvasData.face,
                textFields: this.extractTextFields(canvasData.face),
                graphics: this.extractGraphics(canvasData.face)
            },
            sideView: {
                canvas: canvasData.side,
                textFields: this.extractTextFields(canvasData.side),
                graphics: this.extractGraphics(canvasData.side)
            }
        });

        // Emit template created event
        if (window.appBridge) {
            window.appBridge.emitSyncEvent(
                SYNC_EVENTS.TEMPLATE_CREATED,
                template.toJSON(),
                this.appName
            );
        }

        return template;
    }

    // Helper methods
    extractTextFields(canvasData) {
        const textFields = [];

        if (!canvasData || !canvasData.layers) return textFields;

        canvasData.layers.forEach(layer => {
            // Check if this is a text layer with field reference
            if (layer.type && layer.type.includes('text')) {
                // Check for field name or placeholder text
                if (layer.fieldName) {
                    textFields.push({
                        fieldName: layer.fieldName,
                        position: { x: layer.x, y: layer.y },
                        font: layer.font || 'Arial',
                        size: layer.fontSize || 24,
                        color: layer.textColor || '#000000',
                        placeholder: `{{${layer.fieldName}}}`
                    });
                } else if (layer.text && layer.text.match(/\{\{(\w+)\}\}/)) {
                    const match = layer.text.match(/\{\{(\w+)\}\}/);
                    textFields.push({
                        fieldName: match[1],
                        position: { x: layer.x, y: layer.y },
                        font: layer.font || 'Arial',
                        size: layer.fontSize || 24,
                        color: layer.textColor || '#000000',
                        placeholder: layer.text
                    });
                }
            }
        });

        return textFields;
    }

    extractGraphics(canvasData) {
        const graphics = [];

        if (!canvasData || !canvasData.layers) return graphics;

        canvasData.layers.forEach(layer => {
            // Non-text layers are considered graphics
            if (layer.type && !layer.type.includes('text')) {
                graphics.push({
                    type: layer.type,
                    name: layer.name,
                    position: { x: layer.x, y: layer.y },
                    dimensions: { width: layer.width, height: layer.height },
                    color: layer.color,
                    material: layer.material,
                    thickness: layer.thickness,
                    zIndex: layer.zIndex
                });
            }
        });

        return graphics;
    }

    // Template event handlers
    handleTemplateCreated(data) {
        // If this template was created by another app, store it locally
        if (data.createdBy !== this.appName && window.designApp?.templateManager) {
            const template = new DesignTemplate(data);
            window.designApp.templateManager.templates.set(data.signTypeCode, template);
        }
    }

    handleTemplateUpdated(data) {
        // Update local template cache
        if (window.designApp?.templateManager) {
            const existingTemplate = window.designApp.templateManager.templates.get(
                data.signTypeCode
            );
            if (existingTemplate) {
                Object.assign(existingTemplate, data);
            }
        }
    }

    handleTemplateDeleted(data) {
        // Remove from local cache
        if (window.designApp?.templateManager) {
            window.designApp.templateManager.templates.delete(data.signTypeCode);
        }
    }
}

// Create and export singleton instance
export const designSyncAdapter = new DesignSyncAdapter();

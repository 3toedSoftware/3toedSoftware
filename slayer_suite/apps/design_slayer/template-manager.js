/**
 * template-manager.js
 * Manages design templates for sign types in Design Slayer
 */

import { state, updateState } from './state.js';
import { LAYER_DEFINITIONS, SCALE_FACTOR } from './config.js';
import { DataModels } from '../../core/index.js';

const { DesignTemplate } = DataModels;

export class TemplateManager {
    constructor() {
        this.templates = new Map(); // signTypeCode -> DesignTemplate
        this.currentTemplate = null;
        this.storageKey = 'slayer_design_templates';

        // Load templates from localStorage on initialization
        this.loadTemplatesFromStorage();
    }

    /**
     * Load templates from localStorage
     */
    loadTemplatesFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const data = JSON.parse(stored);
                // Removed debug log: Loading templates from storage

                // Reconstruct templates
                Object.entries(data).forEach(([signTypeCode, templateData]) => {
                    try {
                        const template = new DesignTemplate(templateData);
                        this.templates.set(signTypeCode, template);
                    } catch (err) {
                        console.error(`Failed to load template for ${signTypeCode}:`, err);
                    }
                });
            }
        } catch (error) {
            console.error('Failed to load templates from storage:', error);
        }
    }

    /**
     * Save templates to localStorage
     */
    saveTemplatesToStorage() {
        try {
            const data = {};
            this.templates.forEach((template, signTypeCode) => {
                data[signTypeCode] = template.toJSON();
            });

            localStorage.setItem(this.storageKey, JSON.stringify(data));
            // Removed debug log: Saved templates to storage
        } catch (error) {
            console.error('Failed to save templates to storage:', error);
        }
    }

    /**
     * Extract canvas data for template storage
     * @param {Array} layers - The layers to extract
     * @returns {Object} Canvas data with layers, dimensions, and metadata
     */
    extractCanvasData(layers) {
        // Filter layers that are on canvas
        const canvasLayers = layers.filter(layer => layer.onCanvas);

        // Find the bounds of all layers
        let minX = Infinity,
            minY = Infinity;
        let maxX = -Infinity,
            maxY = -Infinity;

        canvasLayers.forEach(layer => {
            minX = Math.min(minX, layer.x);
            minY = Math.min(minY, layer.y);
            maxX = Math.max(maxX, layer.x + layer.width * SCALE_FACTOR);
            maxY = Math.max(maxY, layer.y + layer.height * SCALE_FACTOR);
        });

        // Calculate canvas dimensions
        const canvasWidth = maxX - minX;
        const canvasHeight = maxY - minY;

        // Extract layer data
        const layerData = canvasLayers.map(layer => ({
            type: layer.type,
            name: layer.name,
            x: layer.x - minX, // Normalize positions
            y: layer.y - minY,
            width: layer.width,
            height: layer.height,
            zIndex: layer.zIndex,
            color: layer.color,
            material: layer.material,
            thickness: layer.thickness,
            // Text-specific properties
            text: layer.text,
            font: layer.font,
            fontSize: layer.fontSize,
            textColor: layer.textColor,
            textAlign: layer.textAlign,
            verticalAlign: layer.verticalAlign,
            lineSpacing: layer.lineSpacing,
            kerning: layer.kerning,
            // Braille-specific
            brailleSourceText: layer.brailleSourceText,
            // Field reference for dynamic text
            fieldName: layer.fieldName
        }));

        return {
            layers: layerData,
            dimensions: {
                width: canvasWidth / SCALE_FACTOR,
                height: canvasHeight / SCALE_FACTOR
            },
            metadata: {
                layerCount: layerData.length,
                createdAt: new Date().toISOString()
            }
        };
    }

    /**
     * Extract text fields with placeholders from canvas layers
     * @param {Object} canvasData - The canvas data
     * @returns {Array} Text field definitions
     */
    extractTextFields(canvasData) {
        const textFields = [];

        canvasData.layers.forEach(layer => {
            const definition = LAYER_DEFINITIONS[layer.type];

            // Check if this is a text layer with a field reference
            if (definition && definition.isText && layer.fieldName) {
                textFields.push({
                    fieldName: layer.fieldName,
                    position: { x: layer.x, y: layer.y },
                    font: layer.font || definition.defaultFont,
                    size: layer.fontSize || definition.defaultFontSize,
                    color: layer.textColor || definition.defaultTextColor || '#000000',
                    placeholder: `{{${layer.fieldName}}}`,
                    layerType: layer.type,
                    textAlign: layer.textAlign || 'left',
                    verticalAlign: layer.verticalAlign || 'top'
                });
            }
            // Also check for placeholder text in regular text layers
            else if (definition && definition.isText && layer.text) {
                const placeholderMatch = layer.text.match(/\{\{(\w+)\}\}/);
                if (placeholderMatch) {
                    const fieldName = placeholderMatch[1];
                    textFields.push({
                        fieldName: fieldName,
                        position: { x: layer.x, y: layer.y },
                        font: layer.font || definition.defaultFont,
                        size: layer.fontSize || definition.defaultFontSize,
                        color: layer.textColor || definition.defaultTextColor || '#000000',
                        placeholder: layer.text,
                        layerType: layer.type,
                        textAlign: layer.textAlign || 'left',
                        verticalAlign: layer.verticalAlign || 'top'
                    });
                }
            }
        });

        return textFields;
    }

    /**
     * Extract graphics (non-text layers) from canvas data
     * @param {Object} canvasData - The canvas data
     * @returns {Array} Graphics definitions
     */
    extractGraphics(canvasData) {
        const graphics = [];

        canvasData.layers.forEach(layer => {
            const definition = LAYER_DEFINITIONS[layer.type];

            // Non-text layers are considered graphics
            if (definition && !definition.isText) {
                graphics.push({
                    type: layer.type,
                    name: layer.name,
                    position: { x: layer.x, y: layer.y },
                    dimensions: { width: layer.width, height: layer.height },
                    color: layer.color || definition.color,
                    material: layer.material || definition.material,
                    thickness: layer.thickness || definition.thickness,
                    zIndex: layer.zIndex
                });
            }
        });

        return graphics;
    }

    /**
     * Save current design as a template
     * @param {string} signTypeCode - The sign type code
     * @param {string} templateName - Optional template name
     * @returns {DesignTemplate} The created template
     */
    async saveAsTemplate(signTypeCode, templateName = null) {
        if (!signTypeCode) {
            throw new Error('Sign type code is required to save template');
        }

        // Get the sign type from sync adapter
        const signType = window.designApp?.syncAdapter?.getSignType(signTypeCode);
        if (!signType) {
            throw new Error(`Sign type ${signTypeCode} not found`);
        }

        // Extract canvas data from current layers
        const faceCanvasData = this.extractCanvasData(state.layersList);

        // For now, side view is empty - could be enhanced later
        const sideCanvasData = {
            layers: [],
            dimensions: { width: 2, height: faceCanvasData.dimensions.height },
            metadata: { layerCount: 0, createdAt: new Date().toISOString() }
        };

        // Create the template
        const template = new DesignTemplate({
            signTypeCode: signTypeCode,
            signTypeId: signType.id,
            name: templateName || `${signTypeCode} Template`,
            faceView: {
                canvas: faceCanvasData,
                textFields: this.extractTextFields(faceCanvasData),
                graphics: this.extractGraphics(faceCanvasData)
            },
            sideView: {
                canvas: sideCanvasData,
                textFields: [],
                graphics: []
            },
            materials: this.extractMaterials(faceCanvasData),
            createdBy: 'design_slayer'
        });

        // Store template
        this.templates.set(signTypeCode, template);

        // Save to localStorage
        this.saveTemplatesToStorage();

        // Emit sync event if available
        if (window.appBridge) {
            const { SYNC_EVENTS } = await import('../../core/index.js');
            window.appBridge.emitSyncEvent(
                SYNC_EVENTS.TEMPLATE_CREATED,
                template.toJSON(),
                'design_slayer'
            );
        }

        // Update sign type to reference this template
        signType.designTemplateId = template.id;

        // Removed debug log: Template saved and persisted

        return template;
    }

    /**
     * Extract material specifications from canvas data
     * @param {Object} canvasData - The canvas data
     * @returns {Object} Material specifications
     */
    extractMaterials(canvasData) {
        const materials = {
            substrate: '',
            mounting: '',
            finish: ''
        };

        // Find the main plate layer
        const plateLayers = canvasData.layers.filter(l => l.type === 'plate');
        if (plateLayers.length > 0) {
            const mainPlate = plateLayers[0];
            materials.substrate = mainPlate.material || 'Aluminum';
        }

        return materials;
    }

    /**
     * Load a template for the current sign type
     * @param {string} signTypeCode - The sign type code
     * @returns {boolean} Success status
     */
    async loadTemplate(signTypeCode) {
        const template = this.templates.get(signTypeCode);
        if (!template) {
            console.warn(`No template found for sign type ${signTypeCode}`);
            return false;
        }

        // Clear current canvas
        state.layersList = [];
        state.layerCounter = 0;

        // Load layers from template
        const faceData = template.faceView.canvas;
        if (faceData && faceData.layers) {
            faceData.layers.forEach(layerData => {
                const layerId = `layer-${getNextLayerId()}`;

                // Create new layer from template data
                const newLayer = {
                    id: layerId,
                    ...layerData,
                    onCanvas: true,
                    showDimensions: false
                };

                state.layersList.push(newLayer);
            });
        }

        // Update state
        updateState({
            layersList: state.layersList,
            currentTemplate: template,
            isDirty: false
        });

        // Refresh UI
        if (window.designApp) {
            const { refreshLayerList } = await import('./ui.js');
            const { designSVG } = await import('./design-svg.js');

            refreshLayerList(window.designApp.eventHandlers);

            // Create SVG layers
            state.layersList.forEach(layer => {
                if (layer.onCanvas) {
                    designSVG.createLayer(
                        layer,
                        window.designApp.eventHandlers.onSelectLayer,
                        window.designApp.eventHandlers.onStartDrag
                    );
                }
            });

            // SVG layers are automatically ordered by z-index
        }

        this.currentTemplate = template;
        return true;
    }

    /**
     * Get template for a sign type
     * @param {string} signTypeCode - The sign type code
     * @returns {DesignTemplate|null} The template or null
     */
    getTemplate(signTypeCode) {
        return this.templates.get(signTypeCode) || null;
    }

    /**
     * List all available templates
     * @returns {Array} Array of template summaries
     */
    listTemplates() {
        const templates = [];
        this.templates.forEach((template, code) => {
            templates.push({
                code: code,
                id: template.id,
                name: template.name,
                layerCount: template.faceView.canvas?.layers?.length || 0,
                textFieldCount: template.faceView.textFields?.length || 0,
                lastModified: template.lastModified
            });
        });
        return templates;
    }

    /**
     * Delete a template
     * @param {string} signTypeCode - The sign type code
     * @returns {boolean} Success status
     */
    async deleteTemplate(signTypeCode) {
        const template = this.templates.get(signTypeCode);
        if (!template) return false;

        this.templates.delete(signTypeCode);

        // Save to localStorage after deletion
        this.saveTemplatesToStorage();

        // Emit sync event if available
        if (window.appBridge) {
            const { SYNC_EVENTS } = await import('../../core/index.js');
            window.appBridge.emitSyncEvent(
                SYNC_EVENTS.TEMPLATE_DELETED,
                { id: template.id, signTypeCode },
                'design_slayer'
            );
        }

        return true;
    }

    /**
     * Check if a template exists for a sign type
     * @param {string} signTypeCode - The sign type code
     * @returns {boolean} Whether template exists
     */
    hasTemplate(signTypeCode) {
        return this.templates.has(signTypeCode);
    }
}

// Create and export singleton instance
export const templateManager = new TemplateManager();

// Helper to get the next layer ID
function getNextLayerId() {
    return ++state.layerCounter;
}

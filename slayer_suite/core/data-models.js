/**
 * data-models.js
 * Shared data models for cross-app synchronization in Slayer Suite
 *
 * This module provides the foundational data structures that enable seamless
 * integration between all Slayer Suite applications. These models ensure
 * consistent data representation and automatic format conversion between
 * app-specific implementations.
 *
 * @module core/data-models
 */

/**
 * SignType Model
 * Represents a sign type that can be used across all Slayer Suite apps.
 * This is the central data structure for sign type definitions, managing
 * everything from visual properties to dynamic text fields.
 *
 * @class SignType
 * @example
 * // Create a new sign type
 * const roomSign = new SignType({
 *   code: 'I.1',
 *   name: 'Room Identification',
 *   color: '#0066CC',
 *   textFields: [
 *     { fieldName: 'roomNumber' },
 *     { fieldName: 'roomName' },
 *     { fieldName: 'department' }
 *   ]
 * });
 *
 * // Add a new field dynamically
 * roomSign.addTextField('occupant', 50);
 *
 * // Check if a field is required based on usage
 * const isDeptRequired = await roomSign.isFieldRequired('department');
 *
 * // Convert to Mapping Slayer format
 * const markerType = roomSign.toMarkerType();
 */
export class SignType {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.code = data.code || 'NEW';
        this.name = data.name || 'Sign Type Name';
        this.color = data.color || '#F72020';
        this.textColor = data.textColor || '#FFFFFF';
        this.textFields = data.textFields || [
            { fieldName: 'message', maxLength: null },
            { fieldName: 'message2', maxLength: null }
        ];
        this.hasArrowField = data.hasArrowField || false;
        this.createdBy = data.createdBy || 'mapping_slayer';
        this.lastModified = data.lastModified || new Date().toISOString();
        this.designTemplateId = data.designTemplateId || null;
    }

    /**
     * Generate a unique identifier for the sign type
     * @private
     * @returns {string} Unique ID with timestamp and random component
     */
    generateId() {
        return `signtype_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Add a new text field to the sign type
     * @param {string} fieldName - Name of the field (e.g., 'roomFunction')
     * @param {number|null} [maxLength=null] - Maximum character length
     * @returns {Object} The created field object
     * @throws {Error} If field name is invalid or already exists
     * @example
     * signType.addTextField('department', 30);
     */
    addTextField(fieldName, maxLength = null) {
        const field = { fieldName, maxLength };
        this.textFields.push(field);
        this.lastModified = new Date().toISOString();
        return field;
    }

    /**
     * Remove a text field from the sign type
     * @param {string} fieldName - Name of the field to remove
     * @returns {boolean} True if field was removed, false if not found
     * @example
     * const removed = signType.removeTextField('department');
     */
    removeTextField(fieldName) {
        const index = this.textFields.findIndex(f => f.fieldName === fieldName);
        if (index !== -1) {
            this.textFields.splice(index, 1);
            this.lastModified = new Date().toISOString();
            return true;
        }
        return false;
    }

    updateTextField(fieldName, updates) {
        const field = this.textFields.find(f => f.fieldName === fieldName);
        if (field) {
            Object.assign(field, updates);
            this.lastModified = new Date().toISOString();
            return true;
        }
        return false;
    }

    /**
     * Check if a field is required based on actual usage in sign instances
     * A field is considered required if ANY sign instance has data in that field
     * @param {string} fieldName - Name of the field to check
     * @returns {Promise<boolean>} True if field has data in any sign instance
     * @example
     * const isRequired = await signType.isFieldRequired('department');
     */
    async isFieldRequired(fieldName) {
        // Check if we have access to app bridge to query sign instances
        if (typeof window !== 'undefined' && window.appBridge) {
            try {
                // Get the sync manager to check for signs with field data
                const syncManager =
                    window.appBridge.apps.get('mapping_slayer')?.syncAdapter?.syncManager;
                if (syncManager && syncManager.getSignsWithFieldData) {
                    const signsWithData = await syncManager.getSignsWithFieldData(
                        this.code,
                        fieldName
                    );
                    return signsWithData && signsWithData.length > 0;
                }
            } catch (error) {
                console.warn('Error checking field requirement:', error);
            }
        }

        // Default to false if we can't check
        return false;
    }

    toJSON() {
        return {
            id: this.id,
            code: this.code,
            name: this.name,
            color: this.color,
            textColor: this.textColor,
            textFields: this.textFields,
            hasArrowField: this.hasArrowField,
            createdBy: this.createdBy,
            lastModified: this.lastModified,
            designTemplateId: this.designTemplateId
        };
    }

    /**
     * Convert SignType to Mapping Slayer's markerType format
     * Used for backward compatibility with existing Mapping Slayer code
     * @returns {Object} MarkerType format object
     * @example
     * const markerType = signType.toMarkerType();
     * // Returns: { code: 'I.1', name: 'Room Sign', color: '#0066CC', ... }
     */
    toMarkerType() {
        return {
            code: this.code,
            name: this.name,
            color: this.color,
            textColor: this.textColor,
            designReference: this.designTemplateId
        };
    }

    /**
     * Create a SignType instance from Mapping Slayer's markerType format
     * @static
     * @param {string} code - Sign type code
     * @param {Object} markerTypeData - Marker type data from Mapping Slayer
     * @returns {SignType} New SignType instance
     * @example
     * const signType = SignType.fromMarkerType('I.1', {
     *   name: 'Room Sign',
     *   color: '#0066CC',
     *   textColor: '#FFFFFF'
     * });
     */
    static fromMarkerType(code, markerTypeData) {
        return new SignType({
            code: code,
            name: markerTypeData.name,
            color: markerTypeData.color,
            textColor: markerTypeData.textColor,
            designTemplateId: markerTypeData.designReference,
            createdBy: 'mapping_slayer'
        });
    }
}

/**
 * SignInstance Model
 * Represents a placed sign (dot) with location and content.
 * This model bridges the gap between abstract sign types and concrete
 * sign placements on floor plans, maintaining all instance-specific data.
 *
 * @class SignInstance
 * @example
 * // Create a sign instance from a dot
 * const sign = new SignInstance({
 *   signTypeCode: 'I.1',
 *   location: { x: 100, y: 200, pageNumber: 1 },
 *   messages: {
 *     message: 'Room 101',
 *     message2: 'Conference Room',
 *     department: 'Engineering'
 *   },
 *   notes: 'Near main entrance'
 * });
 *
 * // Update a message field
 * sign.updateMessage('department', 'Product Development');
 *
 * // Convert to dot format for Mapping Slayer
 * const dot = sign.toDot();
 */
export class SignInstance {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.internalId = data.internalId || null;
        this.signTypeId = data.signTypeId || null;
        this.signTypeCode = data.signTypeCode || null;

        // Location data
        this.location = {
            x: data.location?.x || 0,
            y: data.location?.y || 0,
            pageNumber: data.location?.pageNumber || 1,
            floor: data.location?.floor || null
        };

        // Content - dynamic based on sign type
        this.messages = data.messages || {
            message: '',
            message2: ''
        };

        // Optional fields
        this.arrow = data.arrow || null; // '<up>', '<down>', '<left>', '<right>'
        this.notes = data.notes || '';
        this.codeRequirements = data.codeRequirements || '';
        this.locationNumber = data.locationNumber || null;

        // Metadata
        this.createdBy = data.createdBy || 'mapping_slayer';
        this.lastModified = data.lastModified || new Date().toISOString();

        // Production status
        this.installed = data.installed || false;
        this.produced = data.produced || false;
    }

    generateId() {
        return `sign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Update a message field value
     * @param {string} fieldName - Field to update (e.g., 'message', 'department')
     * @param {string} value - New value for the field
     * @fires SIGN_MESSAGE_CHANGED via SyncManager
     */
    updateMessage(fieldName, value) {
        this.messages[fieldName] = value;
        this.lastModified = new Date().toISOString();
    }

    /**
     * Update the notes for this sign instance
     * @param {string} notes - New notes content
     * @fires SIGN_NOTES_CHANGED via SyncManager
     */
    updateNotes(notes) {
        this.notes = notes;
        this.lastModified = new Date().toISOString();
    }

    toJSON() {
        return {
            id: this.id,
            internalId: this.internalId,
            signTypeId: this.signTypeId,
            signTypeCode: this.signTypeCode,
            location: this.location,
            messages: this.messages,
            arrow: this.arrow,
            notes: this.notes,
            codeRequirements: this.codeRequirements,
            locationNumber: this.locationNumber,
            createdBy: this.createdBy,
            lastModified: this.lastModified,
            installed: this.installed,
            produced: this.produced
        };
    }

    /**
     * Convert SignInstance to Mapping Slayer's dot format
     * @returns {Object} Dot format object with all message fields
     * @example
     * const dot = signInstance.toDot();
     * // Returns: { internalId: '...', markerType: 'I.1', x: 100, y: 200, ... }
     */
    toDot() {
        const dot = {
            internalId: this.internalId,
            markerType: this.signTypeCode,
            x: this.location.x,
            y: this.location.y,
            locationNumber: this.locationNumber,
            message: this.messages.message || '',
            message2: this.messages.message2 || '',
            notes: this.notes,
            installed: this.installed
        };

        // Include all dynamic message fields
        Object.keys(this.messages).forEach(key => {
            if (key !== 'message' && key !== 'message2') {
                dot[key] = this.messages[key];
            }
        });

        return dot;
    }

    /**
     * Create a SignInstance from Mapping Slayer's dot format
     * Automatically extracts all message fields including dynamic ones
     * @static
     * @param {Object} dot - Dot data from Mapping Slayer
     * @param {number} [pageNumber=1] - Page number where dot is located
     * @returns {SignInstance} New SignInstance object
     * @example
     * const signInstance = SignInstance.fromDot({
     *   internalId: 'dot_123',
     *   markerType: 'I.1',
     *   x: 100, y: 200,
     *   message: 'Room 101',
     *   department: 'Engineering'
     * });
     */
    static fromDot(dot, pageNumber = 1) {
        const messages = {
            message: dot.message || '',
            message2: dot.message2 || ''
        };

        // Include any additional message fields (dynamic fields)
        Object.keys(dot).forEach(key => {
            if (key.startsWith('message') && key !== 'message' && key !== 'message2') {
                messages[key] = dot[key];
            }
            // Also check for custom fields that don't start with 'message'
            else if (
                ![
                    'internalId',
                    'markerType',
                    'x',
                    'y',
                    'locationNumber',
                    'notes',
                    'installed'
                ].includes(key)
            ) {
                // Assume it's a custom field if not a known property
                messages[key] = dot[key];
            }
        });

        return new SignInstance({
            internalId: dot.internalId,
            signTypeCode: dot.markerType,
            location: {
                x: dot.x,
                y: dot.y,
                pageNumber: pageNumber
            },
            messages: messages,
            notes: dot.notes || '',
            locationNumber: dot.locationNumber,
            installed: dot.installed || false,
            createdBy: 'mapping_slayer'
        });
    }
}

/**
 * DesignTemplate Model
 * Represents a design template created in Design Slayer.
 * Templates can be saved, loaded, and reused across different sign types,
 * enabling consistent design patterns throughout a project.
 *
 * @class DesignTemplate
 * @example
 * // Create a new design template
 * const template = new DesignTemplate({
 *   signTypeCode: 'I.1',
 *   name: 'Standard Room Sign Template',
 *   faceView: {
 *     textFields: [
 *       {
 *         fieldName: 'message',
 *         position: { x: 50, y: 100 },
 *         font: 'Arial',
 *         size: 24,
 *         placeholder: '{{message}}'
 *       }
 *     ]
 *   }
 * });
 *
 * // Add a new text field to the template
 * template.addTextField('face', {
 *   fieldName: 'department',
 *   position: { x: 50, y: 150 },
 *   placeholder: '{{department}}'
 * });
 */
export class DesignTemplate {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.signTypeId = data.signTypeId || null;
        this.signTypeCode = data.signTypeCode || null;
        this.name = data.name || 'Untitled Design';

        // Canvas data for face and side views
        this.faceView = data.faceView || {
            canvas: null,
            textFields: [],
            graphics: []
        };

        this.sideView = data.sideView || {
            canvas: null,
            textFields: [],
            graphics: []
        };

        // Material specifications
        this.materials = data.materials || {
            substrate: '',
            mounting: '',
            finish: ''
        };

        this.lastModified = data.lastModified || new Date().toISOString();
    }

    generateId() {
        return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Add a text field to the template
     * @param {'face'|'side'} view - Which view to add the field to
     * @param {Object} fieldData - Field configuration
     * @param {string} fieldData.fieldName - Name of the field
     * @param {Object} fieldData.position - X,Y position on canvas
     * @param {string} fieldData.font - Font family
     * @param {number} fieldData.size - Font size
     * @param {string} fieldData.color - Text color
     * @param {string} fieldData.placeholder - Placeholder text (e.g., '{{message}}')
     * @returns {Object} The created text field object
     * @example
     * template.addTextField('face', {
     *   fieldName: 'roomFunction',
     *   position: { x: 50, y: 200 },
     *   font: 'Arial',
     *   size: 18,
     *   placeholder: '{{roomFunction}}'
     * });
     */
    addTextField(view, fieldData) {
        const textField = {
            fieldName: fieldData.fieldName,
            position: fieldData.position || { x: 0, y: 0 },
            font: fieldData.font || 'Arial',
            size: fieldData.size || 14,
            color: fieldData.color || '#000000',
            placeholder: fieldData.placeholder || `{{${fieldData.fieldName}}}`
        };

        if (view === 'face') {
            this.faceView.textFields.push(textField);
        } else if (view === 'side') {
            this.sideView.textFields.push(textField);
        }

        this.lastModified = new Date().toISOString();
        return textField;
    }

    removeTextField(view, fieldName) {
        const viewData = view === 'face' ? this.faceView : this.sideView;
        const index = viewData.textFields.findIndex(f => f.fieldName === fieldName);

        if (index !== -1) {
            viewData.textFields.splice(index, 1);
            this.lastModified = new Date().toISOString();
            return true;
        }
        return false;
    }

    toJSON() {
        return {
            id: this.id,
            signTypeId: this.signTypeId,
            signTypeCode: this.signTypeCode,
            name: this.name,
            faceView: this.faceView,
            sideView: this.sideView,
            materials: this.materials,
            lastModified: this.lastModified
        };
    }
}

/**
 * Synchronization event types used across all Slayer Suite apps.
 * These events enable real-time data synchronization between applications.
 *
 * @constant {Object} SYNC_EVENTS
 * @example
 * // Listen for sign type creation
 * appBridge.on(SYNC_EVENTS.SIGN_TYPE_CREATED, (data) => {
 *   console.log('New sign type:', data);
 * });
 */
export const SYNC_EVENTS = {
    // Sign Type Events
    SIGN_TYPE_CREATED: 'signType:created',
    SIGN_TYPE_UPDATED: 'signType:updated',
    SIGN_TYPE_DELETED: 'signType:deleted',
    SIGN_TYPE_FIELD_ADDED: 'signType:fieldAdded',
    SIGN_TYPE_FIELD_REMOVED: 'signType:fieldRemoved',

    // Sign Instance Events
    SIGN_CREATED: 'sign:created',
    SIGN_UPDATED: 'sign:updated',
    SIGN_DELETED: 'sign:deleted',
    SIGN_MESSAGE_CHANGED: 'sign:messageChanged',
    SIGN_NOTES_CHANGED: 'sign:notesChanged',

    // Template Events
    TEMPLATE_CREATED: 'template:created',
    TEMPLATE_UPDATED: 'template:updated',
    TEMPLATE_DELETED: 'template:deleted',

    // Graphics Events
    GRAPHICS_LIBRARY_UPDATED: 'graphics:libraryUpdated',
    GRAPHICS_ASSET_ADDED: 'graphics:assetAdded'
};

/**
 * Default sign layout configuration for thumbnails without templates.
 * Used by Thumbnail Slayer when no Design Slayer template exists.
 *
 * @constant {Object} DEFAULT_SIGN_LAYOUT
 */
export const DEFAULT_SIGN_LAYOUT = {
    shape: 'square',
    size: { width: 200, height: 200 },
    background: 'white',
    textStyle: {
        font: 'Times New Roman',
        size: 14,
        color: 'black',
        align: 'left',
        spacing: 1.5
    },
    padding: 20
};

/**
 * Valid arrow directions for directional signage.
 * Used in arrow fields to indicate wayfinding direction.
 *
 * @constant {Object} ARROW_DIRECTIONS
 * @example
 * sign.arrow = ARROW_DIRECTIONS.LEFT; // '<left>'
 */
export const ARROW_DIRECTIONS = {
    UP: '<up>',
    DOWN: '<down>',
    LEFT: '<left>',
    RIGHT: '<right>'
};

/**
 * Validation utilities for data integrity across the suite.
 * Ensures consistent naming conventions and valid data formats.
 *
 * @namespace Validators
 */
export const Validators = {
    /**
     * Validate sign type code format
     * @param {string} code - Sign type code to validate
     * @returns {boolean} True if valid (alphanumeric, dots, underscores, hyphens)
     * @example
     * Validators.isValidSignTypeCode('I.1'); // true
     * Validators.isValidSignTypeCode('Room Sign'); // false (spaces not allowed)
     */
    isValidSignTypeCode(code) {
        return /^[A-Z0-9._-]+$/i.test(code);
    },

    /**
     * Validate field name format
     * @param {string} name - Field name to validate
     * @returns {boolean} True if valid (starts with letter, alphanumeric + underscore)
     * @example
     * Validators.isValidFieldName('roomFunction'); // true
     * Validators.isValidFieldName('3rdFloor'); // false (can't start with number)
     */
    isValidFieldName(name) {
        return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name);
    },

    isValidArrowDirection(direction) {
        return Object.values(ARROW_DIRECTIONS).includes(direction);
    }
};

// core/index.js
/**
 * Core Module Exports - Central import point for all Slayer Suite core utilities
 * Import everything from here: import { appBridge, projectManager } from '../core/index.js'
 */

// Communication & Coordination
export { AppBridge, appBridge } from './app-bridge.js';
export { ProjectManager, projectManager } from './project-manager.js';
export { saveManager } from './save-manager.js';

// Core utility functions and constants
export const SLAYER_VERSION = '1.0.0';

/**
 * Default project settings
 */
export const DEFAULT_PROJECT_SETTINGS = {
    theme: 'dark',
    autoSave: true,
    autoSaveInterval: 30000, // 30 seconds
    debugMode: false,
    showTooltips: false
};

/**
 * App status constants
 */
export const APP_STATUS = {
    UNREGISTERED: 'unregistered',
    REGISTERED: 'registered', 
    INITIALIZING: 'initializing',
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    ERROR: 'error'
};

/**
 * Event types for cross-app communication
 */
export const BRIDGE_EVENTS = {
    // App lifecycle
    APP_REGISTERED: 'app:registered',
    APP_UNREGISTERED: 'app:unregistered',
    APP_ACTIVATED: 'app:activated',
    APP_DEACTIVATED: 'app:deactivated',
    
    // Data operations
    DATA_REQUESTED: 'data:requested',
    DATA_SHARED: 'data:shared',
    
    // Project lifecycle
    PROJECT_CREATED: 'project:created',
    PROJECT_LOADED: 'project:loaded',
    PROJECT_SAVED: 'project:saved',
    PROJECT_DIRTY: 'project:dirty',
    PROJECT_META_UPDATED: 'project:meta-updated',
    
    // Cross-app links
    LINK_ADDED: 'project:link-added',
    LINK_REMOVED: 'project:link-removed',
    
    // Error events
    SAVE_FAILED: 'project:save-failed',
    LOAD_FAILED: 'project:load-failed'
};

/**
 * Common data query types for cross-app communication
 */
export const QUERY_TYPES = {
    // General queries
    GET_ALL_DATA: 'get-all-data',
    GET_STATUS: 'get-status',
    GET_METADATA: 'get-metadata',
    
    // Location-based queries (for mapping/survey integration)
    GET_COORDINATES: 'get-coordinates',
    GET_LOCATIONS: 'get-locations',
    GET_MEASUREMENTS: 'get-measurements',
    
    // Design-related queries
    GET_LAYOUTS: 'get-layouts',
    GET_SPECIFICATIONS: 'get-specifications',
    
    // Production queries
    GET_SCHEDULES: 'get-schedules',
    GET_RESOURCES: 'get-resources',
    
    // Installation queries
    GET_WORK_ORDERS: 'get-work-orders',
    GET_PROGRESS: 'get-progress'
};

/**
 * Utility function to validate app instance
 * @param {object} app - App instance to validate
 * @returns {boolean} Is valid app
 */
export function validateApp(app) {
    const requiredMethods = [
        'initialize',
        'activate', 
        'deactivate',
        'exportData',
        'importData'
    ];

    for (const method of requiredMethods) {
        if (typeof app[method] !== 'function') {
            console.error(`App validation failed: missing method '${method}'`);
            return false;
        }
    }

    return true;
}

/**
 * Utility function to create standardized app data structure
 * @param {string} version - App version
 * @param {object} data - App-specific data
 * @returns {object} Standardized app data
 */
export function createAppData(version, data) {
    return {
        version: version || '1.0.0',
        active: data !== null && data !== undefined,
        data: data,
        exported: new Date().toISOString()
    };
}

/**
 * Utility function to generate consistent app container IDs
 * @param {string} appName - App name (e.g., 'mapping_slayer')
 * @returns {string} Container ID
 */
export function getAppContainerId(appName) {
    return `app-container-${appName.replace(/_/g, '-')}`;
}

/**
 * Utility function to create app-specific event names
 * @param {string} appName - App name
 * @param {string} eventType - Event type
 * @returns {string} Full event name
 */
export function createAppEvent(appName, eventType) {
    return `${appName}:${eventType}`;
}

/**
 * Debug utility - log with app context
 * @param {string} appName - App name
 * @param {string} message - Log message
 * @param {any} data - Optional data
 */
export function appLog(appName, message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${appName.toUpperCase()} ${timestamp}]`;
    
    if (data !== null) {
        console.log(prefix, message, data);
    } else {
        console.log(prefix, message);
    }
}

/**
 * Initialize core systems
 * Call this before registering any apps
 */
export function initializeCore(debugMode = false) {
    // Import here to avoid circular dependency
    import('./app-bridge.js').then(({ appBridge }) => {
        appBridge.setDebugMode(debugMode);
    });
    
    // Set up global error handling for unhandled promises
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection in Slayer Suite:', event.reason);
        // Only broadcast if appBridge is available
        if (typeof appBridge !== 'undefined') {
            appBridge.broadcast('system:error', { 
                type: 'unhandled-rejection',
                error: event.reason 
            });
        }
    });

    // Set up beforeunload warning for unsaved changes
    window.addEventListener('beforeunload', (event) => {
        // Only check if projectManager is available
        if (typeof projectManager !== 'undefined' && projectManager.hasUnsavedChanges()) {
            event.preventDefault();
            event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            return event.returnValue;
        }
    });

    appLog('CORE', 'Slayer Suite core systems initialized');
}

/**
 * Get system status
 * @returns {object} Complete system status
 */
export function getSystemStatus() {
    return {
        version: SLAYER_VERSION,
        bridge: appBridge.getStatus(),
        project: projectManager.getCurrentProject(),
        timestamp: new Date().toISOString()
    };
}
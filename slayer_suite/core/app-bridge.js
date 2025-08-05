// core/app-bridge.js
/**
 * App Bridge - Cross-app communication system for Slayer Suite
 * Handles app registration, data requests, and event broadcasting
 */

import { SYNC_EVENTS } from './data-models.js';

export class AppBridge {
    constructor() {
        this.apps = new Map();           // Registered apps: name -> app instance
        this.eventBus = new EventTarget(); // Event system for broadcasts
        this.activeApp = null;           // Currently active app
        this.isDebugMode = false;        // Debug logging
        this.syncHandlers = new Map();   // Sync event handlers
        this.sharedData = new Map();     // Shared data store for cross-app state
    }

    /**
     * Register an app with the bridge system
     * @param {string} name - App identifier (e.g., 'mapping_slayer')
     * @param {object} app - App instance with required methods
     */
    register(name, app) {
        if (this.apps.has(name)) {
            console.warn(`AppBridge: App '${name}' already registered, replacing...`);
        }

        // Validate app has required methods
        const requiredMethods = ['initialize', 'activate', 'deactivate', 'exportData', 'importData'];
        for (const method of requiredMethods) {
            if (typeof app[method] !== 'function') {
                throw new Error(`AppBridge: App '${name}' missing required method: ${method}`);
            }
        }

        this.apps.set(name, app);
        this.log(`Registered app: ${name}`);

        // Notify other apps of new registration
        this.broadcast('app:registered', { appName: name });
    }

    /**
     * Unregister an app from the bridge
     * @param {string} name - App identifier
     */
    unregister(name) {
        if (this.apps.has(name)) {
            const app = this.apps.get(name);
            if (this.activeApp === app) {
                this.activeApp = null;
            }
            this.apps.delete(name);
            this.broadcast('app:unregistered', { appName: name });
            this.log(`Unregistered app: ${name}`);
        }
    }

    /**
     * Get list of registered app names
     * @returns {string[]} Array of app names
     */
    getRegisteredApps() {
        return Array.from(this.apps.keys());
    }

    /**
     * Get all registered app instances as an object
     * @returns {Object} Object with app names as keys and app instances as values
     */
    getRegisteredAppInstances() {
        const appInstances = {};
        for (const [name, app] of this.apps) {
            appInstances[name] = app;
        }
        return appInstances;
    }

    /**
     * Switch to a different app
     * @param {string} appName - Name of app to activate
     * @returns {Promise<boolean>} Success status
     */
    async switchToApp(appName) {
        const targetApp = this.apps.get(appName);
        if (!targetApp) {
            console.error(`AppBridge: App '${appName}' not found`);
            return false;
        }

        try {
            // Deactivate current app
            if (this.activeApp) {
                await this.activeApp.deactivate();
                this.broadcast('app:deactivated', { appName: this.getAppName(this.activeApp) });
            }

            // Activate target app
            await targetApp.activate();
            this.activeApp = targetApp;
            this.broadcast('app:activated', { appName: appName });
            
            this.log(`Switched to app: ${appName}`);
            return true;

        } catch (error) {
            console.error(`AppBridge: Error switching to app '${appName}':`, error);
            return false;
        }
    }

    /**
     * Request data from another app
     * @param {string} fromApp - Requesting app name
     * @param {string} targetApp - Target app name
     * @param {object} query - Data request query
     * @returns {Promise<any>} Requested data or null
     */
    async requestData(fromApp, targetApp, query) {
        const target = this.apps.get(targetApp);
        if (!target) {
            console.error(`AppBridge: Target app '${targetApp}' not found for data request`);
            return null;
        }

        try {
            this.log(`Data request: ${fromApp} -> ${targetApp}`, query);
            
            // Check if target app supports data requests
            if (typeof target.handleDataRequest === 'function') {
                const result = await target.handleDataRequest(fromApp, query);
                this.broadcast('data:requested', { 
                    fromApp, 
                    targetApp, 
                    query, 
                    success: true 
                });
                return result;
            } else {
                console.warn(`AppBridge: App '${targetApp}' doesn't support data requests`);
                return null;
            }

        } catch (error) {
            console.error(`AppBridge: Error requesting data from '${targetApp}':`, error);
            this.broadcast('data:requested', { 
                fromApp, 
                targetApp, 
                query, 
                success: false, 
                error: error.message 
            });
            return null;
        }
    }

    /**
     * Convenience method for cross-app requests (used by Thumbnail Slayer)
     * @param {string} targetApp - Target app name
     * @param {object} query - Data request query
     * @returns {Promise<any>} Requested data or null
     */
    async sendRequest(targetApp, query) {
        // Auto-detect calling app from active app or default to 'unknown'
        const fromApp = this.activeApp ? this.getAppName(this.activeApp) : 'unknown';
        return this.requestData(fromApp, targetApp, query);
    }

    /**
     * Subscribe to events (convenience method)
     * @param {string} eventType - Event type to listen for
     * @param {Function} callback - Event handler function
     */
    on(eventType, callback) {
        return this.subscribe(eventType, callback);
    }

    /**
     * Broadcast an event to all registered apps
     * @param {string} eventType - Event type identifier
     * @param {object} data - Event data
     */
    broadcast(eventType, data = {}) {
        const event = new CustomEvent(eventType, { 
            detail: { 
                ...data, 
                timestamp: Date.now(),
                source: 'app-bridge'
            } 
        });
        
        this.eventBus.dispatchEvent(event);
        this.log(`Broadcast event: ${eventType}`, data);
    }

    /**
     * Subscribe to bridge events
     * @param {string} eventType - Event type to listen for
     * @param {Function} callback - Event handler function
     * @returns {Function} Unsubscribe function
     */
    subscribe(eventType, callback) {
        const handler = (event) => callback(event.detail);
        this.eventBus.addEventListener(eventType, handler);
        
        // Return unsubscribe function
        return () => {
            this.eventBus.removeEventListener(eventType, handler);
        };
    }

    /**
     * Get project data from all active apps
     * @returns {object} Combined project data
     */
    async getProjectData() {
        const projectData = {
            meta: {
                timestamp: new Date().toISOString(),
                activeApps: []
            },
            apps: {}
        };

        for (const [name, app] of this.apps.entries()) {
            try {
                const appData = await app.exportData();
                if (appData && appData !== null) {
                    projectData.apps[name] = {
                        version: appData.version || '1.0.0',
                        active: true,
                        data: appData
                    };
                    projectData.meta.activeApps.push(name);
                } else {
                    projectData.apps[name] = {
                        version: '1.0.0',
                        active: false,
                        data: null
                    };
                }
            } catch (error) {
                console.error(`AppBridge: Error getting data from app '${name}':`, error);
                projectData.apps[name] = {
                    version: '1.0.0',
                    active: false,
                    data: null,
                    error: error.message
                };
            }
        }

        return projectData;
    }

    /**
     * Load project data into all registered apps
     * @param {object} projectData - Project data to load
     * @returns {Promise<object>} Load results
     */
    async loadProjectData(projectData) {
        const results = {
            success: [],
            failed: [],
            skipped: []
        };

        if (!projectData.apps) {
            console.error('AppBridge: Invalid project data - missing apps section');
            return results;
        }

        for (const [appName, appData] of Object.entries(projectData.apps)) {
            const app = this.apps.get(appName);
            
            if (!app) {
                results.skipped.push({ app: appName, reason: 'App not registered' });
                continue;
            }

            if (!appData.active || !appData.data) {
                results.skipped.push({ app: appName, reason: 'No data to load' });
                continue;
            }

            try {
                await app.importData(appData.data);
                results.success.push(appName);
                this.log(`Loaded data for app: ${appName}`);
            } catch (error) {
                console.error(`AppBridge: Error loading data for app '${appName}':`, error);
                results.failed.push({ app: appName, error: error.message });
            }
        }

        this.broadcast('project:loaded', results);
        return results;
    }

    /**
     * Enable or disable debug logging
     * @param {boolean} enabled - Debug mode state
     */
    setDebugMode(enabled) {
        this.isDebugMode = enabled;
        this.log(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Get the name of an app instance
     * @param {object} appInstance - App instance to find name for
     * @returns {string|null} App name or null if not found
     */
    getAppName(appInstance) {
        for (const [name, app] of this.apps.entries()) {
            if (app === appInstance) return name;
        }
        return null;
    }

    /**
     * Internal logging method
     * @param {string} message - Log message
     * @param {any} data - Optional data to log
     */
    log(message, data = null) {
        if (this.isDebugMode) {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[AppBridge ${timestamp}] ${message}`, data || '');
        }
    }

    /**
     * Get bridge status and statistics
     * @returns {object} Status information
     */
    getStatus() {
        return {
            registeredApps: this.getRegisteredApps(),
            activeApp: this.activeApp ? this.getAppName(this.activeApp) : null,
            totalApps: this.apps.size,
            debugMode: this.isDebugMode,
            uptime: Date.now() // Could track actual uptime if needed
        };
    }

    /**
     * Register a sync handler for specific event types.
     * Handlers are called when sync events are emitted by other apps.
     * 
     * @param {string} appName - App registering the handler
     * @param {string} eventType - Event type from SYNC_EVENTS
     * @param {Function} handler - Handler function (data, sourceApp) => void
     * @example
     * appBridge.registerSyncHandler('mapping_slayer', 
     *   SYNC_EVENTS.SIGN_TYPE_CREATED, 
     *   (data, sourceApp) => {
     *     console.log(`New sign type from ${sourceApp}:`, data);
     *     // Update local state
     *   }
     * );
     */
    registerSyncHandler(appName, eventType, handler) {
        const key = `${appName}:${eventType}`;
        this.syncHandlers.set(key, handler);
        this.log(`Registered sync handler: ${key}`);
    }

    /**
     * Emit a sync event to all registered handlers.
     * This is the core method that enables cross-app synchronization.
     * Events are sent to all apps except the source app.
     * 
     * @param {string} eventType - Event type from SYNC_EVENTS
     * @param {object} data - Event data to broadcast
     * @param {string} sourceApp - App that triggered the event
     * @fires Custom event with the eventType name
     * @example
     * // Emit a sign type update event
     * appBridge.emitSyncEvent(
     *   SYNC_EVENTS.SIGN_TYPE_UPDATED,
     *   { code: 'I.1', name: 'Updated Room Sign' },
     *   'design_slayer'
     * );
     */
    emitSyncEvent(eventType, data, sourceApp) {
        this.log(`Sync event: ${eventType} from ${sourceApp}`, data);
        
        // Broadcast to all apps except the source
        for (const [appName, app] of this.apps) {
            if (appName !== sourceApp) {
                const key = `${appName}:${eventType}`;
                const handler = this.syncHandlers.get(key);
                
                if (handler) {
                    try {
                        handler(data, sourceApp);
                    } catch (error) {
                        console.error(`Error in sync handler ${key}:`, error);
                    }
                }
                
                // Also check if app has a generic sync handler
                if (typeof app.handleSyncEvent === 'function') {
                    try {
                        app.handleSyncEvent(eventType, data, sourceApp);
                    } catch (error) {
                        console.error(`Error in app sync handler ${appName}:`, error);
                    }
                }
            }
        }
        
        // Also broadcast as a regular event
        this.broadcast(eventType, { ...data, sourceApp });
    }

    /**
     * Get shared data by key
     * @param {string} key - Data key
     * @returns {any} Shared data value
     */
    getSharedData(key) {
        return this.sharedData.get(key);
    }

    /**
     * Set shared data
     * @param {string} key - Data key
     * @param {any} value - Data value
     * @param {string} sourceApp - App setting the data
     */
    setSharedData(key, value, sourceApp) {
        const oldValue = this.sharedData.get(key);
        this.sharedData.set(key, value);
        
        // Broadcast data change
        this.broadcast('sharedData:changed', {
            key,
            value,
            oldValue,
            sourceApp
        });
    }

    /**
     * Get all sign types from shared data store.
     * This is the single source of truth for sign types across all apps.
     * 
     * @returns {Map} Map of sign type code -> SignType data
     * @example
     * const signTypes = appBridge.getSignTypes();
     * signTypes.forEach((signType, code) => {
     *   console.log(`${code}: ${signType.name}`);
     * });
     */
    getSignTypes() {
        return this.getSharedData('signTypes') || new Map();
    }

    /**
     * Update sign types in shared data store.
     * Automatically broadcasts changes to all registered apps.
     * 
     * @param {Map} signTypes - Complete updated sign types map
     * @param {string} sourceApp - App updating the data
     * @fires sharedData:changed event
     * @example
     * const signTypes = appBridge.getSignTypes();
     * signTypes.set('E.1', newExitSignType);
     * appBridge.updateSignTypes(signTypes, 'design_slayer');
     */
    updateSignTypes(signTypes, sourceApp) {
        this.setSharedData('signTypes', signTypes, sourceApp);
    }

    /**
     * Convenience method to emit sign type-specific events.
     * Wraps emitSyncEvent for sign type operations.
     * 
     * @param {string} eventType - Event type (e.g., SYNC_EVENTS.SIGN_TYPE_CREATED)
     * @param {object} signTypeData - Sign type data or update info
     * @param {string} sourceApp - Source app name
     * @example
     * appBridge.emitSignTypeEvent(
     *   SYNC_EVENTS.SIGN_TYPE_DELETED,
     *   { code: 'I.1', cascadedSigns: [] }, // affected signs array
     *   'mapping_slayer'
     * );
     */
    emitSignTypeEvent(eventType, signTypeData, sourceApp) {
        this.emitSyncEvent(eventType, signTypeData, sourceApp);
    }

    /**
     * Convenience method to emit sign instance events.
     * Used for individual sign updates (messages, notes, etc.).
     * 
     * @param {string} eventType - Event type (e.g., SYNC_EVENTS.SIGN_MESSAGE_CHANGED)
     * @param {object} signData - Sign instance data or update info
     * @param {string} sourceApp - Source app name
     * @example
     * appBridge.emitSignEvent(
     *   SYNC_EVENTS.SIGN_NOTES_CHANGED,
     *   { signId: 'dot_123', notes: 'Updated installation notes' },
     *   'thumbnail_slayer'
     * );
     */
    emitSignEvent(eventType, signData, sourceApp) {
        this.emitSyncEvent(eventType, signData, sourceApp);
    }
}

// Create global bridge instance
export const appBridge = new AppBridge();

// Export event types for convenience
export { SYNC_EVENTS };
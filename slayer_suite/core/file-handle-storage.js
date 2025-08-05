/**
 * File Handle Storage
 * Manages persistent file handles using IndexedDB for File System Access API
 */

class FileHandleStorage {
    constructor() {
        this.dbName = 'SlayerSuiteFileHandles';
        this.storeName = 'fileHandles';
        this.db = null;
    }

    /**
     * Initialize the IndexedDB
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('lastUsed', 'lastUsed', { unique: false });
                }
            };
        });
    }

    /**
     * Store a file handle
     */
    async storeHandle(handle, metadata = {}) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const data = {
                id: 'current_project',
                handle: handle,
                name: handle.name,
                lastUsed: new Date().toISOString(),
                ...metadata
            };

            const request = store.put(data);
            request.onsuccess = () => resolve(data);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Retrieve the current project handle
     */
    async getCurrentHandle() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get('current_project');

            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.handle : null);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Store recent project handles
     */
    async addRecentProject(handle, projectName) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);

            const data = {
                id: `recent_${Date.now()}`,
                handle: handle,
                name: projectName,
                path: handle.name,
                lastUsed: new Date().toISOString(),
                isRecent: true
            };

            const request = store.put(data);
            request.onsuccess = () => resolve(data);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get recent projects
     */
    async getRecentProjects(limit = 5) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('lastUsed');
            const request = index.openCursor(null, 'prev');

            const projects = [];
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && projects.length < limit) {
                    if (cursor.value.isRecent) {
                        projects.push({
                            id: cursor.value.id,
                            name: cursor.value.name,
                            path: cursor.value.path,
                            lastUsed: cursor.value.lastUsed,
                            handle: cursor.value.handle
                        });
                    }
                    cursor.continue();
                } else {
                    resolve(projects);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear all stored handles
     */
    async clear() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

// Export singleton instance
export const fileHandleStorage = new FileHandleStorage();
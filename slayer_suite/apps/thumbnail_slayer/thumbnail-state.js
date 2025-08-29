/**
 * thumbnail-state.js
 * State management for Thumbnail Slayer - Sign Production
 */

// Initial state
export const thumbnailState = {
    // Design templates from Design Slayer
    designTemplates: new Map(), // Map of templateId -> design data
    activeDesignId: null,

    // Location data from Mapping Slayer
    locations: new Map(), // Map of locationId -> location data
    pageData: new Map(), // Map of pageNumber -> page info
    markerTypes: {}, // Map of markerTypeCode -> markerType info with colors

    // Sign production items (combined data)
    productionItems: new Map(), // Map of itemId -> production item
    nextItemId: 1,

    // Filter and display settings
    currentPage: null,
    filterByType: null,
    sortBy: 'location', // 'location', 'type'
    viewMode: 'grid', // 'grid', 'list', 'detail'

    // Thumbnail settings
    thumbnailSize: 200, // px
    showLocationNumbers: true,
    showMessages: true,
    showSignType: true,

    // UI state
    selectedItemId: null,
    isLoading: false,
    lastSync: null,
    previewMode: 'sign', // 'sign' or 'map'

    // Map preview cache
    mapPreviewCache: new Map(), // Cache page images to avoid reloading

    // Statistics
    totalSigns: 0
};

/**
 * Create a production item from location and design data
 */
export function createProductionItem(location, design = null) {
    const itemId = `item_${thumbnailState.nextItemId++}`;

    const productionItem = {
        id: itemId,
        locationId: location.id,
        locationNumber: location.locationNumber,
        pageNumber: location.pageNumber || 1,
        sheetName: location.sheetName || `Page ${location.pageNumber || 1}`,

        // Sign content
        message1: location.message1 || location.message || '',
        message2: location.message2 || '',
        signType: location.signType || location.markerType || 'default',
        markerType: location.markerType || location.signType || 'default', // For DOT column color matching

        // Sign type details
        signTypeCode: location.signTypeCode || location.signCode || '',
        signTypeName: location.signTypeName || '',
        signTypeInfo: location.signTypeInfo || location.markerTypeInfo || {},

        // Production details
        notes: location.notes || '',
        installed: location.installed || false,
        flags: location.flags || {
            topLeft: false,
            topRight: false,
            bottomLeft: false,
            bottomRight: false
        },

        // Design reference
        designId: design?.id || null,
        designName: design?.name || 'No Design',
        hasDesign: !!design,

        // Position data
        x: location.x,
        y: location.y,

        // Timestamps
        created: new Date().toISOString(),
        modified: new Date().toISOString()
    };

    thumbnailState.productionItems.set(itemId, productionItem);
    updateStatistics();

    return productionItem;
}

/**
 * Update design templates from Design Slayer
 */
export function updateDesignTemplates(designs) {
    thumbnailState.designTemplates.clear();

    if (Array.isArray(designs)) {
        designs.forEach(design => {
            thumbnailState.designTemplates.set(design.id, design);
        });
    }

    // Set active design if not set
    if (!thumbnailState.activeDesignId && thumbnailState.designTemplates.size > 0) {
        thumbnailState.activeDesignId = thumbnailState.designTemplates.keys().next().value;
    }
}

/**
 * Update marker types from Mapping Slayer
 */
export function updateMarkerTypes(markerTypes) {
    if (markerTypes && typeof markerTypes === 'object') {
        thumbnailState.markerTypes = markerTypes;
        console.log('🎨 Updated marker types in state:', Object.keys(markerTypes).length, 'types');
    }
}

/**
 * Update location data from Mapping Slayer
 */
export function updateLocationData(locations, pageInfo = null) {
    thumbnailState.locations.clear();

    if (Array.isArray(locations)) {
        locations.forEach(loc => {
            thumbnailState.locations.set(loc.id, loc);
        });
    }

    if (pageInfo) {
        thumbnailState.pageData = new Map(Object.entries(pageInfo));
    }

    // Regenerate production items
    regenerateProductionItems();
}

/**
 * Regenerate production items from current data
 */
export function regenerateProductionItems() {
    // Clear current items
    thumbnailState.productionItems.clear();
    thumbnailState.nextItemId = 1;

    // Get active design
    const activeDesign = thumbnailState.activeDesignId
        ? thumbnailState.designTemplates.get(thumbnailState.activeDesignId)
        : null;

    // Create production items for each location
    thumbnailState.locations.forEach(location => {
        createProductionItem(location, activeDesign);
    });

    updateStatistics();
}

/**
 * Clear the map preview cache
 */
export function clearMapPreviewCache() {
    thumbnailState.mapPreviewCache.clear();
}

/**
 * Get filtered production items
 */
export function getFilteredItems() {
    let items = Array.from(thumbnailState.productionItems.values());

    // Filter by page
    if (thumbnailState.currentPage !== null) {
        items = items.filter(item => item.pageNumber === thumbnailState.currentPage);
    }

    // Filter by type
    if (thumbnailState.filterByType) {
        items = items.filter(item => item.signType === thumbnailState.filterByType);
    }

    // Sort
    switch (thumbnailState.sortBy) {
        case 'location':
            items.sort((a, b) => {
                if (a.pageNumber !== b.pageNumber) {
                    return a.pageNumber - b.pageNumber;
                }
                return a.locationNumber - b.locationNumber;
            });
            break;
        case 'type':
            items.sort((a, b) => a.signType.localeCompare(b.signType));
            break;
    }

    return items;
}

/**
 * Update statistics
 */
function updateStatistics() {
    const items = Array.from(thumbnailState.productionItems.values());
    thumbnailState.totalSigns = items.length;
}

/**
 * Get current state
 */
export function getState() {
    return thumbnailState;
}

/**
 * Get sign types from location data
 */
export function getSignTypes() {
    const types = new Set();
    thumbnailState.locations.forEach(loc => {
        if (loc.signType || loc.markerType) {
            types.add(loc.signType || loc.markerType);
        }
    });
    return Array.from(types);
}

/**
 * Get page numbers
 */
export function getPageNumbers() {
    const pages = new Set();
    thumbnailState.locations.forEach(loc => {
        pages.add(loc.pageNumber || 1);
    });
    return Array.from(pages).sort((a, b) => a - b);
}

/**
 * Reset state
 */
export function resetState() {
    thumbnailState.designTemplates.clear();
    thumbnailState.locations.clear();
    thumbnailState.pageData.clear();
    thumbnailState.productionItems.clear();

    thumbnailState.activeDesignId = null;
    thumbnailState.currentPage = null;
    thumbnailState.filterByType = null;
    thumbnailState.selectedItemId = null;
    thumbnailState.lastSync = null;
    thumbnailState.nextItemId = 1;

    updateStatistics();
}

/**
 * Serialize state for saving
 */
export function serializeState() {
    return {
        activeDesignId: thumbnailState.activeDesignId,
        currentPage: thumbnailState.currentPage,
        filterByType: thumbnailState.filterByType,
        sortBy: thumbnailState.sortBy,
        viewMode: thumbnailState.viewMode,
        thumbnailSize: thumbnailState.thumbnailSize,
        showLocationNumbers: thumbnailState.showLocationNumbers,
        showMessages: thumbnailState.showMessages,
        showSignType: thumbnailState.showSignType,
        lastSync: thumbnailState.lastSync
    };
}

/**
 * Deserialize state from saved data
 */
export function deserializeState(data) {
    if (data.activeDesignId) thumbnailState.activeDesignId = data.activeDesignId;
    if (data.currentPage !== undefined) thumbnailState.currentPage = data.currentPage;
    if (data.filterByType) thumbnailState.filterByType = data.filterByType;
    if (data.sortBy) thumbnailState.sortBy = data.sortBy;
    if (data.viewMode) thumbnailState.viewMode = data.viewMode;
    if (data.thumbnailSize) thumbnailState.thumbnailSize = data.thumbnailSize;
    if (data.showLocationNumbers !== undefined) {
        thumbnailState.showLocationNumbers = data.showLocationNumbers;
    }
    if (data.showMessages !== undefined) thumbnailState.showMessages = data.showMessages;
    if (data.showSignType !== undefined) thumbnailState.showSignType = data.showSignType;
    if (data.lastSync) thumbnailState.lastSync = data.lastSync;
}

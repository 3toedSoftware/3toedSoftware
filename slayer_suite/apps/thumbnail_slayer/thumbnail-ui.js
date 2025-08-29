/**
 * thumbnail-ui.js
 * UI management for Thumbnail Slayer - Sign Production
 */

import {
    thumbnailState,
    getFilteredItems
} from './thumbnail-state.js';
import { thumbnailSyncAdapter } from './thumbnail-sync.js';
import { viewportManager } from './viewport-manager.js';
import { thumbnailSpreadsheet } from './thumbnail-spreadsheet.js';

// DOM element cache
const dom = new Proxy(
    {},
    {
        get(target, prop) {
            if (target[prop]) return target[prop];

            const elementMappings = {
                // Filter controls
                // Filter controls removed

                // Split view components
                spreadsheetGrid: () => document.getElementById('spreadsheet-grid'),
                previewContainer: () => document.getElementById('preview-container'),
                thumbnailSize: () => document.getElementById('thumbnail-size'),

                // Stats
                totalSigns: () => document.getElementById('total-signs'),

                // Actions
                // Export button removed

                // Loading indicator
                loadingOverlay: () => document.getElementById('loading-overlay')
            };

            if (elementMappings[prop]) {
                target[prop] = elementMappings[prop]();
                return target[prop];
            }

            return null;
        }
    }
);

/**
 * Initialize UI
 */
export function initializeUI(handlers) {
    setupFilterHandlers(handlers);
    setupSplitViewHandlers(handlers);
    setupActionHandlers(handlers);
    updateAllUI();

    // Globally prevent middle-click scrolling
    document.addEventListener(
        'mousedown',
        e => {
            if (e.button === 1) {
                e.preventDefault();
                return false;
            }
        },
        true
    );

    document.addEventListener(
        'auxclick',
        e => {
            if (e.button === 1) {
                e.preventDefault();
                return false;
            }
        },
        true
    );
}

/**
 * Setup sync handlers
 */
function setupSyncHandlers(handlers) {
    // Sync handlers removed - auto-sync on activate
}

/**
 * Setup filter handlers
 */
function setupFilterHandlers(handlers) {
    // Filter handlers removed - no longer needed
}

/**
 * Setup split view handlers
 */
function setupSplitViewHandlers(handlers) {
    // Thumbnail size slider
    if (dom.thumbnailSize) {
        dom.thumbnailSize.addEventListener('input', e => {
            thumbnailState.thumbnailSize = parseInt(e.target.value);
            updateThumbnailSize();
        });
    }

    // Set up preview toggle handlers
    setupPreviewToggleHandlers();

    // Set up spreadsheet and thumbnail interaction handlers
    setupSpreadsheetHandlers();
    setupThumbnailHandlers();
}

/**
 * Setup action handlers
 */
function setupActionHandlers(handlers) {
    // Export button removed
}

/**
 * Update all UI elements
 */
export function updateAllUI() {
    updateFilters();
    updateStats();
    updateSpreadsheet();
    updateThumbnailGrid();
}

/**
 * Update filter dropdowns
 */
function updateFilters() {
    // Filter updates removed - no longer needed
}

/**
 * Update statistics
 */
function updateStats() {
    if (dom.totalSigns) {
        dom.totalSigns.textContent = thumbnailState.totalSigns;
    }
}

/**
 * Update spreadsheet view
 */
function updateSpreadsheet() {
    if (!dom.spreadsheetGrid) {
        console.warn('Spreadsheet grid container not found');
        return;
    }

    const items = getFilteredItems();
    console.log('Updating spreadsheet with', items.length, 'filtered items');

    // Initialize spreadsheet if not already done
    if (!thumbnailSpreadsheet.table) {
        console.log('Initializing spreadsheet for the first time');
        thumbnailSpreadsheet.init(dom.spreadsheetGrid);

        // Set up data change handler to sync with Mapping Slayer
        thumbnailSpreadsheet.onDataChange = data => {
            // Update thumbnail state when data changes
            data.forEach(item => {
                if (item.id) {
                    thumbnailState.productionItems.set(item.id, item);
                }
            });
        };
    }

    // Transform items to ensure they have all required fields for the spreadsheet
    const spreadsheetData = items.map(item => {
        // Use flags from the item (now properly included from createProductionItem)
        const flags = item.flags || {
            topLeft: false,
            topRight: false,
            bottomLeft: false,
            bottomRight: false
        };

        return {
            id: item.id,
            locationNumber: item.locationNumber || '',
            signTypeCode: item.signType || item.signTypeCode || '',
            markerType: item.markerType || item.signType || item.signTypeCode || 'default',
            pageNumber: item.pageNumber || 1,
            message1: item.message1 || '',
            message2: item.message2 || '',
            // Include both nested flags object and flat fields for spreadsheet
            flags: flags,
            flag1: flags.topLeft,
            flag2: flags.topRight,
            flag3: flags.bottomLeft,
            flag4: flags.bottomRight,
            installed: item.installed || false,
            notes: item.notes || '',
            // Include position data for map preview
            x: item.x,
            y: item.y,
            // Keep original item reference for rendering
            _originalItem: item
        };
    });

    console.log('Spreadsheet data prepared:', spreadsheetData.length, 'items');

    // Update data in spreadsheet
    thumbnailSpreadsheet.setData(spreadsheetData);

    // Make selectRowAndThumbnail globally available for the spreadsheet
    window.selectRowAndThumbnail = selectRowAndThumbnail;

    // Add middle-click handler for zooming to dot
    window.handleMiddleClickZoom = itemId => {
        console.log('🔶 handleMiddleClickZoom called:', {
            itemId,
            previewMode: thumbnailState.previewMode,
            isMapMode: thumbnailState.previewMode === 'map'
        });
        if (thumbnailState.previewMode === 'map') {
            selectRowAndThumbnail(itemId, true); // true = zoom to dot
        }
    };

    // Make the thumbnail app available for syncing
    if (window.thumbnailApp) {
        window.thumbnailApp.syncAdapter = thumbnailSyncAdapter;
    }

    // Update flag column names if configuration is available
    if (thumbnailSpreadsheet.updateFlagColumnNames) {
        const updated = thumbnailSpreadsheet.updateFlagColumnNames();
        if (updated) {
            thumbnailSpreadsheet.updateHeaderCells();
        }
    }
}

/**
 * Create spreadsheet row for an item
 */

/**
 * Setup spreadsheet handlers
 */
function setupSpreadsheetHandlers() {
    // Handled by setupSpreadsheetRowHandlers after table creation
}

/**
 * Setup spreadsheet row interaction handlers
 */

/**
 * Handle spreadsheet click events
 */
function handleSpreadsheetClick(e) {
    const row = e.target.closest('.spreadsheet-row');
    if (!row) return;

    const itemId = row.dataset.itemId;
    const item = thumbnailState.productionItems.get(itemId);
    if (!item) return;

    // Location cell click - highlight thumbnail
    if (e.target.classList.contains('cell-location')) {
        selectRowAndThumbnail(itemId);
        // scrollToThumbnail(itemId); // TODO: Implement if needed
        return;
    }

    // Regular row click - just select
    selectRowAndThumbnail(itemId);
}

/**
 * Handle spreadsheet double-click events for editing
 */
function handleSpreadsheetDoubleClick(e) {
    const cell = e.target.closest('.cell-editable');
    if (!cell) return;

    const row = cell.closest('.spreadsheet-row');
    if (!row) return;

    const itemId = row.dataset.itemId;
    const item = thumbnailState.productionItems.get(itemId);
    if (!item) return;

    makeSpreadsheetCellEditable(cell, item);
}

/**
 * Make a spreadsheet cell editable
 */
function makeSpreadsheetCellEditable(cell, item) {
    if (cell.classList.contains('editing')) return;

    const field = cell.dataset.field;
    const currentValue = item[field] || '';

    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;
    input.className = 'cell-input';

    // Replace cell content with input
    cell.innerHTML = '';
    cell.appendChild(input);
    cell.classList.add('editing');

    // Focus and select
    input.focus();
    input.select();

    // Save on blur or Enter
    const saveEdit = async () => {
        const newValue = input.value.trim();

        if (newValue !== currentValue) {
            // Update local state
            item[field] = newValue;
            item.modified = new Date().toISOString();
            thumbnailState.productionItems.set(item.id, item);

            // Sync to Mapping Slayer
            try {
                await thumbnailSyncAdapter.updateLocationField(item.locationId, field, newValue);
                showSuccess('Field updated successfully');

                // Update thumbnail if visible
                updateThumbnailForItem(item.id);
            } catch (error) {
                console.error('Failed to sync field update:', error);
                showError('Failed to sync changes');
            }
        }

        // Restore cell display
        cell.textContent = item[field] || '';
        cell.classList.remove('editing');
    };

    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cell.textContent = currentValue;
            cell.classList.remove('editing');
        }
    });
}

/**
 * Select row and corresponding thumbnail
 * @param {string} itemId - The item ID to select
 * @param {boolean} zoomToDot - Whether to zoom to dot (for middle-click)
 */
function selectRowAndThumbnail(itemId, zoomToDot = false) {
    console.log('🔵 selectRowAndThumbnail called:', {
        itemId,
        zoomToDot,
        caller: new Error().stack.split('\n')[2]
    });

    // Update selected state
    thumbnailState.selectedItemId = itemId;

    // Update row selection
    document.querySelectorAll('.spreadsheet-row').forEach(row => {
        row.classList.toggle('selected', row.dataset.itemId === itemId);
    });

    // Show single preview for selected item
    showSinglePreview(itemId, zoomToDot);
}

/**
 * Show single preview for selected item
 * @param {string} itemId - The item ID to show
 * @param {boolean} zoomToDot - Whether to zoom to dot (for middle-click)
 */
async function showSinglePreview(itemId, zoomToDot = false) {
    console.log('🟢 showSinglePreview called:', {
        itemId,
        zoomToDot,
        previewMode: thumbnailState.previewMode
    });

    const preview = dom.previewContainer;
    if (!preview) return;

    const item = thumbnailState.productionItems.get(itemId);
    if (!item) {
        preview.innerHTML = `
            <div class="empty-state">
                <div class="empty-text">No sign selected</div>
                <div class="empty-hint">Click a row in the spreadsheet to preview</div>
            </div>
        `;
        return;
    }

    // Use original item if it's a transformed spreadsheet item, but keep the x/y from the spreadsheet item
    const renderItem = item._originalItem || item;
    // Ensure we have the position data
    if (item.x !== undefined) renderItem.x = item.x;
    if (item.y !== undefined) renderItem.y = item.y;

    // Check preview mode and show appropriate preview
    const previewMode = thumbnailState.previewMode || 'sign';

    console.log('🟡 Preview mode check:', {
        previewMode,
        willShowMap: previewMode === 'map',
        zoomToDot
    });

    if (previewMode === 'map') {
        await showMapLocationPreview(renderItem, zoomToDot);
    } else {
        // Clear and render sign preview directly to the preview container
        preview.innerHTML = '';
        preview.dataset.itemId = itemId;
        await renderThumbnailImage(renderItem, preview);
    }
}

/**
 * Scroll to spreadsheet row in left panel
 */

/**
 * Setup thumbnail handlers for split view
 */
function setupThumbnailHandlers() {
    // This will be called by updateThumbnailGrid when thumbnails are created
}

/**
 * Update thumbnail size based on slider
 */
function updateThumbnailSize() {
    // Removed - single preview doesn't use dynamic sizing
}

/**
 * Open edit modal for sign
 */
function openEditModal(item) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'edit-modal-overlay';

    // Get sign type info to know which fields to show
    const signType = item.signTypeInfo;
    let textFields = [];

    // Check if we have proper sign type info with text fields
    if (signType && Array.isArray(signType.textFields) && signType.textFields.length > 0) {
        textFields = signType.textFields;
    } else {
        // Default fields for signs without defined type
        textFields = [
            { fieldName: 'message', displayName: 'Message', maxLength: 50 },
            { fieldName: 'message2', displayName: 'Message 2', maxLength: 50 }
        ];

        // Also check if item has any other text fields we should include
        const knownFields = [
            'id',
            'locationId',
            'locationNumber',
            'pageNumber',
            'sheetName',
            'signType',
            'signTypeCode',
            'signTypeName',
            'signTypeInfo',
            'x',
            'y',
            'installed',
            'notes',
            'message1',
            'status',
            'modified'
        ];

        Object.keys(item).forEach(key => {
            if (
                !knownFields.includes(key) &&
                typeof item[key] === 'string' &&
                !textFields.find(f => f.fieldName === key)
            ) {
                // Add any unknown string fields as potential text fields
                textFields.push({
                    fieldName: key,
                    displayName: key.charAt(0).toUpperCase() + key.slice(1),
                    required: false,
                    maxLength: 100
                });
            }
        });
    }

    modal.innerHTML = `
        <div class="edit-modal">
            <div class="edit-modal-header">
                <h3>Edit Sign Text - Location ${item.locationNumber}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="edit-modal-body">
                <div class="edit-modal-sign-info">
                    <span class="sign-type-badge">${item.signTypeCode || 'DEFAULT'}</span>
                    <span class="sign-type-name">${item.signTypeName || 'Default Sign'}</span>
                </div>
                <div class="edit-fields">
                    ${textFields
        .map(field => {
            const fieldValue = item[field.fieldName] || '';
            const displayName = field.displayName || field.fieldName;
            // For now, we'll show fields as not required in the UI
            // TODO: Update to use signType.isFieldRequired(field.fieldName) when sign type is available
            const isRequired = '';
            const maxLength = field.maxLength || 100;

            return `
                            <div class="edit-field-group">
                                <label for="field-${field.fieldName}">
                                    ${displayName}${isRequired}
                                    <span class="field-counter" data-field="${field.fieldName}">${fieldValue.length}/${maxLength}</span>
                                </label>
                                <input 
                                    type="text" 
                                    id="field-${field.fieldName}" 
                                    class="edit-field-input" 
                                    data-field="${field.fieldName}"
                                    value="${fieldValue.replace(/"/g, '&quot;')}"
                                    maxlength="${maxLength}"
                                    ${''} 
                                />
                            </div>
                        `;
        })
        .join('')}
                </div>
            </div>
            <div class="edit-modal-footer">
                <button class="btn btn-secondary modal-cancel">Cancel</button>
                <button class="btn btn-primary modal-save">Save Changes</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Setup event handlers
    const closeModal = () => {
        modal.remove();
    };

    // Close button
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.modal-cancel').addEventListener('click', closeModal);

    // Click outside
    modal.addEventListener('click', e => {
        if (e.target === modal) closeModal();
    });

    // Character counters
    modal.querySelectorAll('.edit-field-input').forEach(input => {
        input.addEventListener('input', e => {
            const fieldName = e.target.dataset.field;
            const counter = modal.querySelector(`.field-counter[data-field="${fieldName}"]`);
            if (counter) {
                counter.textContent = `${e.target.value.length}/${e.target.maxLength}`;
            }
        });
    });

    // Save button
    modal.querySelector('.modal-save').addEventListener('click', async () => {
        const updates = {};
        let hasChanges = false;

        // Collect all field values
        modal.querySelectorAll('.edit-field-input').forEach(input => {
            const fieldName = input.dataset.field;
            const newValue = input.value.trim();
            const oldValue = item[fieldName] || '';

            if (newValue !== oldValue) {
                updates[fieldName] = newValue;
                hasChanges = true;
            }
        });

        if (!hasChanges) {
            closeModal();
            return;
        }

        // Show loading state
        const saveBtn = modal.querySelector('.modal-save');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        try {
            // Update local state
            Object.entries(updates).forEach(([field, value]) => {
                item[field] = value;
                // Also update message1/message2 aliases
                if (field === 'message') item.message1 = value;
                if (field === 'message2') item.message2 = value;
            });

            // Send updates to Mapping Slayer using sync adapter
            let allUpdatesSuccessful = true;
            for (const [field, value] of Object.entries(updates)) {
                const success = await thumbnailSyncAdapter.updateLocationField(
                    item.locationId,
                    field,
                    value
                );
                if (!success) {
                    allUpdatesSuccessful = false;
                }
            }

            if (!allUpdatesSuccessful) {
                throw new Error('Some updates failed');
            }

            // Re-render the thumbnail using viewport manager
            await viewportManager.updateSingleThumbnail(item.id);

            closeModal();
            showSuccess('Sign text updated successfully');
        } catch (error) {
            console.error('Failed to update sign:', error);
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
            showError('Failed to update sign text');
        }
    });

    // Focus first input
    const firstInput = modal.querySelector('.edit-field-input');
    if (firstInput) {
        firstInput.focus();
        firstInput.select();
    }
}

/**
 * Update thumbnail grid for split view
 */
async function updateThumbnailGrid() {
    // Grid view removed - using single preview on row click instead
    // Update state with filtered items for compatibility
    const items = getFilteredItems();
    thumbnailState.productionItems.clear();
    items.forEach(item => thumbnailState.productionItems.set(item.id, item));
}

/**
 * Create split view thumbnail element (simplified version without icons)
 */

/**
 * Render thumbnail image for an item
 */
async function renderThumbnailImage(item, container) {
    try {
        let element;
        let size = thumbnailState.thumbnailSize;

        // Calculate size based on container if it's the preview
        if (container.id === 'preview-container') {
            // For preview, use 80% of the smaller container dimension
            const rect = container.getBoundingClientRect();
            size = Math.min(rect.width, rect.height) * 0.8;
            // Cap at a reasonable maximum
            size = Math.min(size, 800);
        }

        // Use SVG renderer
        const { renderSignThumbnailSVG } = await import('./sign-renderer-svg.js');
        element = await renderSignThumbnailSVG(item, size);

        // Find existing SVG element and replace
        const existingElement = container.querySelector('svg');
        if (existingElement) {
            existingElement.replaceWith(element);
        } else {
            // Insert element as first child to keep it behind overlays
            container.insertBefore(element, container.firstChild);
        }

        // Add class to identify SVG thumbnail
        element.classList.add('svg-thumbnail');
    } catch (error) {
        console.error('Failed to render thumbnail:', error);
        // Create placeholder without removing overlays
        let placeholder = container.querySelector('.thumbnail-placeholder');
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.className = 'thumbnail-placeholder';
            placeholder.textContent = 'Failed to load';
            container.insertBefore(placeholder, container.firstChild);
        }
    }
}

/**
 * Update thumbnail for specific item
 */
async function updateThumbnailForItem(itemId) {
    const item = thumbnailState.productionItems.get(itemId);
    if (!item) return;

    // Update thumbnail via viewport manager if possible
    if (viewportManager.updateSingleThumbnail) {
        await viewportManager.updateSingleThumbnail(itemId);
    } else {
        // Fallback: find and update the thumbnail element directly
        const thumbnailElement = document.querySelector(
            `.thumbnail-item[data-item-id="${itemId}"]`
        );
        if (thumbnailElement) {
            const imageContainer = thumbnailElement.querySelector('.thumbnail-image');
            const textInfo = thumbnailElement.querySelector('.thumbnail-text-info');

            if (imageContainer) {
                await renderThumbnailImage(item, imageContainer);
            }

            // Text overlays removed
        }
    }
}

// Note: List view removed - replaced with spreadsheet view

// Note: selectItem and showDetailPanel removed - replaced with selectRowAndThumbnail

// Note: Message overlay editing functions removed - replaced with spreadsheet inline editing

/**
 * Setup event handlers for thumbnails in split view
 */

/**
 * Handle thumbnail click events in split view
 */

// Note: Old thumbnail interaction handlers removed - simplified for split view

/**
 * Send update to Mapping Slayer
 */
// Note: updateDotInMappingSlayer has been replaced with thumbnailSyncAdapter.updateLocationField
// The sync adapter handles all communication with Mapping Slayer through the proper sync channels

/**
 * Show loading overlay with optional message
 */
export function showLoading(show, message = 'Loading...') {
    if (dom.loadingOverlay) {
        dom.loadingOverlay.style.display = show ? 'flex' : 'none';
        const loadingText = dom.loadingOverlay.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = message;
        }
    }
}

/**
 * Show success message
 */
export function showSuccess(message) {
    showToast(message, 'success');
}

/**
 * Show error message
 */
export function showError(message) {
    showToast(message, 'error');
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Setup preview toggle handlers
 */
function setupPreviewToggleHandlers() {
    const signToggle = document.getElementById('toggle-sign-preview');
    const mapToggle = document.getElementById('toggle-map-preview');
    const previewTitle = document.getElementById('preview-title');

    if (!signToggle || !mapToggle || !previewTitle) return;

    // Initialize state - Sign Preview is active by default
    thumbnailState.previewMode = 'sign';

    signToggle.addEventListener('click', () => {
        if (thumbnailState.previewMode !== 'sign') {
            thumbnailState.previewMode = 'sign';
            signToggle.classList.remove('btn-secondary');
            mapToggle.classList.add('btn-secondary');
            previewTitle.textContent = 'Thumbnail Preview';

            // Refresh preview if item is selected
            if (thumbnailState.selectedItemId) {
                showSinglePreview(thumbnailState.selectedItemId);
            }
        }
    });

    mapToggle.addEventListener('click', () => {
        if (thumbnailState.previewMode !== 'map') {
            thumbnailState.previewMode = 'map';
            mapToggle.classList.remove('btn-secondary');
            signToggle.classList.add('btn-secondary');
            previewTitle.textContent = 'Map Location Preview';

            // Refresh preview if item is selected
            if (thumbnailState.selectedItemId) {
                showSinglePreview(thumbnailState.selectedItemId);
            }
        }
    });
}

/**
 * Apply transform to map content
 */
function applyMapTransform(mapContent, transform) {
    mapContent.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
}

/**
 * Setup map interaction handlers
 */
function setupMapInteraction(mapContainer, mapContent) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialTransform = { x: 0, y: 0 };

    // Mouse wheel zoom
    mapContainer.addEventListener('wheel', e => {
        e.preventDefault();
        const rect = mapContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const transform = thumbnailState.mapTransform;
        const oldScale = transform.scale;
        const newScale = Math.max(0.1, Math.min(5, oldScale * scaleFactor));

        // Zoom from mouse position
        transform.x = mouseX - (mouseX - transform.x) * (newScale / oldScale);
        transform.y = mouseY - (mouseY - transform.y) * (newScale / oldScale);
        transform.scale = newScale;

        applyMapTransform(mapContent, transform);
    });

    // Mouse down - start panning with middle button only
    mapContainer.addEventListener('mousedown', e => {
        if (e.button === 1) {
            // Middle button for panning
            e.preventDefault();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            initialTransform = {
                x: thumbnailState.mapTransform.x,
                y: thumbnailState.mapTransform.y
            };
            mapContainer.style.cursor = 'grabbing';
            mapContent.style.transition = 'none';
        } else if (e.button === 0) {
            // Left button - do nothing (no panning)
            e.preventDefault();
        }
    });

    // Mouse move - pan if dragging
    document.addEventListener('mousemove', e => {
        if (isDragging) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            thumbnailState.mapTransform.x = initialTransform.x + dx;
            thumbnailState.mapTransform.y = initialTransform.y + dy;

            applyMapTransform(mapContent, thumbnailState.mapTransform);
        }
    });

    // Mouse up - stop panning
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            mapContainer.style.cursor = 'default';
            mapContent.style.transition = 'transform 0.3s ease-out';
        }
    });

    // Prevent context menu on right click
    mapContainer.addEventListener('contextmenu', e => {
        e.preventDefault();
    });
}

/**
 * Show Map Location Preview for selected item
 * @param {Object} item - The item to show
 * @param {boolean} zoomToDot - Whether to zoom to the dot location
 */
async function showMapLocationPreview(item, zoomToDot = false) {
    const preview = dom.previewContainer;
    if (!preview) return;

    try {
        const pageNum = item.pageNumber || 1;

        // Initialize state if needed
        if (!thumbnailState.mapTransform) {
            thumbnailState.mapTransform = { x: 0, y: 0, scale: 1 };
        }
        if (thumbnailState.isPanning === undefined) {
            thumbnailState.isPanning = false;
        }
        if (!thumbnailState.panStart) {
            thumbnailState.panStart = { x: 0, y: 0 };
        }

        console.log('🔴 showMapLocationPreview called:', {
            itemId: item.id,
            zoomToDot,
            hasExistingTransform: !!thumbnailState.mapTransform,
            existingTransform: thumbnailState.mapTransform,
            hasInitializedMap: thumbnailState.hasInitializedMap,
            currentPageNum: thumbnailState.currentPageNum
        });

        // Check if we already have a map displayed for the same page
        const existingMapContainer = preview.querySelector('.map-preview-container');
        const needsNewMap = !existingMapContainer || thumbnailState.currentPageNum !== pageNum;

        console.log('🔴 Map state check:', {
            hasExistingMap: !!existingMapContainer,
            currentPage: thumbnailState.currentPageNum,
            newPage: pageNum,
            needsNewMap
        });

        // Get page data (cache per page, not per item)
        const pageCacheKey = `page_${pageNum}`;
        let response = thumbnailState.mapPreviewCache.get(pageCacheKey);

        if (!response) {
            // Show loading state only if we need to fetch
            preview.innerHTML = `
                <div class="map-preview-loading">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Loading map preview...</div>
                </div>
            `;

            // Request PDF page image from Mapping Slayer
            response = await window.appBridge.sendRequest('mapping_slayer', {
                type: 'get-page-image',
                pageNumber: pageNum,
                scale: 1.5 // Good balance of quality and performance
            });

            if (!response || response.error) {
                throw new Error(response?.error || 'Failed to get map data');
            }

            // Cache the response for future use
            thumbnailState.mapPreviewCache.set(pageCacheKey, response);
        }

        // Create the map preview container
        const mapContainer = document.createElement('div');
        mapContainer.className = 'map-preview-container';
        mapContainer.style.cssText = `
            position: relative;
            width: 100%;
            height: 100%;
            overflow: hidden;
            cursor: default;
            user-select: none;
        `;

        // Create a content wrapper for transformation
        const mapContent = document.createElement('div');
        mapContent.className = 'map-preview-content';
        mapContent.style.cssText = `
            position: absolute;
            transform-origin: 0 0;
            transition: transform 0.3s ease-out;
            will-change: transform;
        `;

        // Create the map image
        const mapImage = document.createElement('img');
        mapImage.src = response.imageData;
        mapImage.style.cssText = `
            display: block;
            background: #fff;
            border: 1px solid #555;
            pointer-events: none;
        `;
        mapImage.draggable = false;

        // Calculate dot position on the scaled image
        // The dots are stored at 4x scale in Mapping Slayer
        // We need to convert from 4x coordinates to the requested scale
        const originalScale = 4.0; // Mapping Slayer's pdfScale
        const requestedScale = response.scale || 1.5;
        const scaleRatio = requestedScale / originalScale;
        const dotX = (item.x || 0) * scaleRatio;
        const dotY = (item.y || 0) * scaleRatio;

        console.log('Map preview item data:', {
            itemId: item.id,
            locationNumber: item.locationNumber,
            x: item.x,
            y: item.y,
            pageNumber: item.pageNumber,
            dotX,
            dotY,
            requestedScale,
            scaleRatio,
            imageDimensions: response.dimensions
        });

        // Create and position the dot (outside of onload)
        const dot = document.createElement('div');
        dot.className = 'map-preview-dot';
        dot.style.cssText = `
            position: absolute;
            width: 16px;
            height: 16px;
            background: #f07727;
            border: 3px solid #fff;
            border-radius: 50%;
            box-shadow: 0 0 10px rgba(240, 119, 39, 0.8);
            z-index: 10;
            pointer-events: none;
            left: ${dotX - 8}px;
            top: ${dotY - 8}px;
        `;

        // Function to setup the map view
        const setupMapView = () => {
            const containerRect = mapContainer.getBoundingClientRect();
            const imgWidth = mapImage.naturalWidth || response.dimensions.width;
            const imgHeight = mapImage.naturalHeight || response.dimensions.height;

            console.log('🟣 setupMapView called:', {
                zoomToDot,
                hasInitializedMap: thumbnailState.hasInitializedMap,
                currentTransform: thumbnailState.mapTransform,
                containerSize: { width: containerRect.width, height: containerRect.height },
                imageSize: { width: imgWidth, height: imgHeight }
            });

            if (zoomToDot) {
                // Zoom to dot when requested (middle-click)
                const zoomLevel = 2.0;

                // Calculate transform to center on the dot
                thumbnailState.mapTransform = {
                    scale: zoomLevel,
                    // Center the dot in the container
                    x: containerRect.width / 2 - dotX * zoomLevel,
                    y: containerRect.height / 2 - dotY * zoomLevel
                };

                console.log('🟣 ZOOMING to dot (middle-click):', {
                    dotX,
                    dotY,
                    zoomLevel,
                    newTransform: thumbnailState.mapTransform
                });

                // Apply the zoom transform
                applyMapTransform(mapContent, thumbnailState.mapTransform);
            } else if (!thumbnailState.mapTransform || !thumbnailState.hasInitializedMap) {
                // Very first time - initialize with full view
                const scale =
                    Math.min(containerRect.width / imgWidth, containerRect.height / imgHeight) *
                    0.9; // 90% to leave some margin

                thumbnailState.mapTransform = {
                    scale: scale,
                    x: (containerRect.width - imgWidth * scale) / 2,
                    y: (containerRect.height - imgHeight * scale) / 2
                };

                thumbnailState.hasInitializedMap = true;
                console.log('🟣 INITIALIZING map view (first time):', {
                    newTransform: thumbnailState.mapTransform
                });
                applyMapTransform(mapContent, thumbnailState.mapTransform);
            } else {
                // Regular click - keep existing transform, don't change anything
                console.log('🟣 KEEPING existing transform (left-click):', {
                    existingTransform: thumbnailState.mapTransform
                });
                applyMapTransform(mapContent, thumbnailState.mapTransform);
            }
        };

        // If we already have a map for this page, just update the dot
        if (!needsNewMap && existingMapContainer) {
            console.log('🔴 Updating existing map - just moving dot');

            // Find and update the existing dot
            const existingDot = existingMapContainer.querySelector('.map-preview-dot');
            if (existingDot) {
                existingDot.style.left = `${dotX - 8}px`;
                existingDot.style.top = `${dotY - 8}px`;
            } else {
                // Add the dot if it doesn't exist
                const mapContent = existingMapContainer.querySelector('.map-preview-content');
                if (mapContent) {
                    mapContent.appendChild(dot);
                }
            }

            // ONLY zoom/pan if specifically requested (middle-click)
            if (zoomToDot) {
                const containerRect = existingMapContainer.getBoundingClientRect();
                const zoomLevel = 2.0;

                thumbnailState.mapTransform = {
                    scale: zoomLevel,
                    x: containerRect.width / 2 - dotX * zoomLevel,
                    y: containerRect.height / 2 - dotY * zoomLevel
                };

                console.log('🔴 ZOOMING to dot on existing map (middle-click)');
                const mapContent = existingMapContainer.querySelector('.map-preview-content');
                if (mapContent) {
                    applyMapTransform(mapContent, thumbnailState.mapTransform);
                }
            } else {
                console.log('🔴 NOT moving map (left-click) - just updating dot position');
            }

            // Don't rebuild the map, just return
            return;
        }

        // Otherwise, build a new map
        console.log('🔴 Building new map container');

        mapContent.appendChild(mapImage);
        mapContent.appendChild(dot); // Add dot after image
        mapContainer.appendChild(mapContent);

        // Add mouse event handlers for pan and zoom
        setupMapInteraction(mapContainer, mapContent);

        preview.innerHTML = '';
        preview.appendChild(mapContainer);

        // Store current page
        thumbnailState.currentPageNum = pageNum;

        // Setup on load or immediately if already loaded, after container is in DOM
        if (mapImage.complete) {
            // Use setTimeout to ensure container dimensions are calculated
            setTimeout(setupMapView, 0);
        } else {
            mapImage.onload = () => setTimeout(setupMapView, 0);
        }
    } catch (error) {
        console.error('Failed to show map preview:', error);
        preview.innerHTML = `
            <div class="empty-state">
                <div class="empty-text">Map preview unavailable</div>
                <div class="empty-hint">${error.message}</div>
            </div>
        `;
    }
}

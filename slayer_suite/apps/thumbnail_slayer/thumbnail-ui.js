/**
 * thumbnail-ui.js
 * UI management for Thumbnail Slayer - Sign Production
 */

import { thumbnailState, getFilteredItems, getSignTypes, getPageNumbers } from './thumbnail-state.js';
import { renderSignThumbnail } from './sign-renderer.js';
import { syncAllData } from './data-integration.js';

// DOM element cache
const dom = new Proxy({}, {
    get(target, prop) {
        if (target[prop]) return target[prop];
        
        const elementMappings = {
            // Filter controls
            pageFilter: () => document.getElementById('page-filter'),
            typeFilter: () => document.getElementById('type-filter'),
            sortBy: () => document.getElementById('sort-by'),
            
            // View controls
            gridViewBtn: () => document.getElementById('grid-view-btn'),
            listViewBtn: () => document.getElementById('list-view-btn'),
            
            // Main content
            thumbnailGrid: () => document.getElementById('thumbnail-grid'),
            listView: () => document.getElementById('list-view'),
            detailPanel: () => document.getElementById('detail-panel'),
            
            // Stats
            totalSigns: () => document.getElementById('total-signs'),
            
            // Actions
            exportBtn: () => document.getElementById('export-btn'),
            
            // Loading indicator
            loadingOverlay: () => document.getElementById('loading-overlay')
        };
        
        if (elementMappings[prop]) {
            target[prop] = elementMappings[prop]();
            return target[prop];
        }
        
        return null;
    }
});

/**
 * Initialize UI
 */
export function initializeUI(handlers) {
    setupSyncHandlers(handlers);
    setupFilterHandlers(handlers);
    setupViewHandlers(handlers);
    setupActionHandlers(handlers);
    updateAllUI();
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
    // Page filter
    if (dom.pageFilter) {
        dom.pageFilter.addEventListener('change', (e) => {
            thumbnailState.currentPage = e.target.value === 'all' ? null : parseInt(e.target.value);
            updateThumbnailGrid();
        });
    }
    
    // Type filter
    if (dom.typeFilter) {
        dom.typeFilter.addEventListener('change', (e) => {
            thumbnailState.filterByType = e.target.value === 'all' ? null : e.target.value;
            updateThumbnailGrid();
        });
    }
    
    
    // Sort by
    if (dom.sortBy) {
        dom.sortBy.addEventListener('change', (e) => {
            thumbnailState.sortBy = e.target.value;
            updateThumbnailGrid();
        });
    }
}

/**
 * Setup view handlers
 */
function setupViewHandlers(handlers) {
    // View mode buttons
    if (dom.gridViewBtn) {
        dom.gridViewBtn.addEventListener('click', () => {
            thumbnailState.viewMode = 'grid';
            updateViewMode();
        });
    }
    
    if (dom.listViewBtn) {
        dom.listViewBtn.addEventListener('click', () => {
            thumbnailState.viewMode = 'list';
            updateViewMode();
        });
    }
    
    // Display toggles removed - always show all elements
}

/**
 * Setup action handlers
 */
function setupActionHandlers(handlers) {
    if (dom.exportBtn) {
        dom.exportBtn.addEventListener('click', () => {
            if (handlers.onExport) handlers.onExport();
        });
    }
    
}

/**
 * Update all UI elements
 */
export function updateAllUI() {
    updateFilters();
    updateStats();
    updateViewMode();
    updateThumbnailGrid();
}

/**
 * Update filter dropdowns
 */
function updateFilters() {
    // Update page filter
    if (dom.pageFilter) {
        const pages = getPageNumbers();
        dom.pageFilter.innerHTML = `
            <option value="all">All Pages</option>
            ${pages.map(page => `
                <option value="${page}" ${thumbnailState.currentPage === page ? 'selected' : ''}>
                    Page ${page}
                </option>
            `).join('')}
        `;
    }
    
    // Update type filter
    if (dom.typeFilter) {
        const types = getSignTypes();
        dom.typeFilter.innerHTML = `
            <option value="all">All Types</option>
            ${types.map(type => `
                <option value="${type}" ${thumbnailState.filterByType === type ? 'selected' : ''}>
                    ${type.toUpperCase()}
                </option>
            `).join('')}
        `;
    }
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
 * Update view mode
 */
function updateViewMode() {
    if (dom.thumbnailGrid && dom.listView) {
        if (thumbnailState.viewMode === 'grid') {
            dom.thumbnailGrid.style.display = 'grid';
            dom.listView.style.display = 'none';
            if (dom.gridViewBtn) dom.gridViewBtn.classList.add('active');
            if (dom.listViewBtn) dom.listViewBtn.classList.remove('active');
        } else {
            dom.thumbnailGrid.style.display = 'none';
            dom.listView.style.display = 'block';
            if (dom.gridViewBtn) dom.gridViewBtn.classList.remove('active');
            if (dom.listViewBtn) dom.listViewBtn.classList.add('active');
            updateListView();
        }
    }
}

/**
 * Update thumbnail grid
 */
async function updateThumbnailGrid() {
    if (!dom.thumbnailGrid) return;
    
    const items = getFilteredItems();
    
    if (items.length === 0) {
        dom.thumbnailGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <div class="empty-text">No signs to display</div>
                <div class="empty-hint">Click "Sync Data" to load signs from Mapping Slayer</div>
            </div>
        `;
        return;
    }
    
    // Clear grid
    dom.thumbnailGrid.innerHTML = '';
    
    // Render thumbnails
    for (const item of items) {
        const thumbnailEl = await createThumbnailElement(item);
        dom.thumbnailGrid.appendChild(thumbnailEl);
    }
}

/**
 * Create thumbnail element
 */
async function createThumbnailElement(item) {
    const div = document.createElement('div');
    div.className = 'thumbnail-item';
    div.dataset.itemId = item.id;
    
    // Render thumbnail
    const canvas = await renderSignThumbnail(item, thumbnailState.thumbnailSize);
    
    // Create the structure with elements around the canvas
    div.innerHTML = `
        <div class="thumbnail-container">
            <!-- Top bar with location and icons -->
            <div class="thumbnail-top-bar">
                <div class="thumbnail-location-badge">${item.locationNumber}</div>
                <div class="thumbnail-icons">
                    <span class="icon-notes ${item.notes ? 'active' : ''}" title="${item.notes || 'Notes'}">📝</span>
                    <span class="icon-code ${item.codeRequired ? 'active' : ''}" title="Code Required">⭐</span>
                    <span class="icon-vinyl ${item.vinylBacker ? 'active' : ''}" title="Vinyl Backer">V</span>
                    <span class="icon-installed ${item.installed ? 'active' : ''}" title="Installed">✓</span>
                </div>
            </div>
            
            <!-- Canvas container -->
            <div class="thumbnail-image">
                ${item.message1 ? `<div class="message-overlay message1-overlay" contenteditable="false" data-field="message">${item.message1}</div>` : ''}
                ${item.message2 ? `<div class="message-overlay message2-overlay" contenteditable="false" data-field="message2">${item.message2}</div>` : ''}
            </div>
            
            <!-- Bottom bar with sign type info -->
            <div class="thumbnail-bottom-bar">
                ${item.signTypeCode || ''} ${item.signTypeName || ''}
            </div>
        </div>
    `;
    
    // Append the canvas element
    const imageContainer = div.querySelector('.thumbnail-image');
    imageContainer.appendChild(canvas);
    
    // Add double-click handler to create new messages
    imageContainer.addEventListener('dblclick', (e) => {
        if (e.target.classList.contains('message-overlay')) return;
        
        const rect = imageContainer.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const relativeY = y / rect.height;
        
        // Determine which message to create based on click position
        const field = relativeY < 0.5 ? 'message' : 'message2';
        const fieldName = field === 'message' ? 'message1' : field;
        
        if (!item[fieldName]) {
            // Create new message overlay
            const overlay = document.createElement('div');
            overlay.className = `message-overlay ${fieldName}-overlay`;
            overlay.contentEditable = 'false';
            overlay.dataset.field = field;
            overlay.textContent = 'New Message';
            imageContainer.appendChild(overlay);
            
            // Add event handlers
            setupMessageOverlay(overlay, item);
            
            // Make it editable immediately
            makeEditable(overlay, item);
        }
    });
    
    // Add message edit handlers
    const messageOverlays = div.querySelectorAll('.message-overlay');
    messageOverlays.forEach(overlay => {
        setupMessageOverlay(overlay, item);
    });
    
    // Add click handlers
    div.addEventListener('click', (e) => {
        // Check if clicking on an icon
        const icon = e.target.closest('.thumbnail-icons span');
        if (icon) {
            e.stopPropagation();
            handleIconClick(item, icon);
            return;
        }
        
        // Otherwise select the item
        selectItem(item.id);
    });
    
    return div;
}

/**
 * Update list view
 */
function updateListView() {
    if (!dom.listView) return;
    
    const items = getFilteredItems();
    
    if (items.length === 0) {
        dom.listView.innerHTML = `
            <div class="empty-state">
                No signs to display
            </div>
        `;
        return;
    }
    
    dom.listView.innerHTML = `
        <table class="list-table">
            <thead>
                <tr>
                    <th>Location</th>
                    <th>Sign Type</th>
                    <th>Message 1</th>
                    <th>Message 2</th>
                    <th>Sheet</th>
                    <th>Details</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(item => `
                    <tr data-item-id="${item.id}" class="list-row">
                        <td class="loc-cell">${item.locationNumber}</td>
                        <td class="type-cell">
                            ${item.signTypeCode ? `<span class="sign-code">${item.signTypeCode}</span>` : ''}
                            ${item.signTypeName ? `<span class="sign-name">${item.signTypeName}</span>` : ''}
                        </td>
                        <td class="msg-cell">${item.message1 || '-'}</td>
                        <td class="msg-cell">${item.message2 || '-'}</td>
                        <td class="sheet-cell">${item.sheetName}</td>
                        <td class="details-cell">
                            ${item.notes ? `<span title="${item.notes}">📝</span>` : ''}
                            ${item.vinylBacker ? `<span title="Vinyl Backer">🎨</span>` : ''}
                            ${item.codeRequired ? `<span title="Code Required">📋</span>` : ''}
                            ${item.installed ? `<span title="Installed">✅</span>` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

/**
 * Select an item
 */
function selectItem(itemId) {
    thumbnailState.selectedItemId = itemId;
    
    // Update visual selection
    document.querySelectorAll('.thumbnail-item').forEach(el => {
        el.classList.toggle('selected', el.dataset.itemId === itemId);
    });
    
    // Show detail panel if needed
    showDetailPanel(itemId);
}

/**
 * Show detail panel
 */
function showDetailPanel(itemId) {
    if (!dom.detailPanel) return;
    
    const item = thumbnailState.productionItems.get(itemId);
    if (!item) return;
    
    // TODO: Implement detail panel display
}

/**
 * Setup message overlay event handlers
 */
function setupMessageOverlay(overlay, item) {
    overlay.addEventListener('click', (e) => {
        e.stopPropagation();
        makeEditable(overlay, item);
    });
    
    overlay.addEventListener('blur', async () => {
        await saveMessageEdit(overlay, item);
    });
    
    overlay.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            overlay.blur();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            const fieldName = overlay.dataset.field === 'message' ? 'message1' : overlay.dataset.field;
            overlay.textContent = item[fieldName] || '';
            overlay.contentEditable = 'false';
        }
    });
}

/**
 * Make message overlay editable
 */
function makeEditable(overlay, item) {
    overlay.contentEditable = 'true';
    overlay.focus();
    
    // Select all text
    const range = document.createRange();
    range.selectNodeContents(overlay);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

/**
 * Save message edit and update Mapping Slayer
 */
async function saveMessageEdit(overlay, item) {
    if (overlay.contentEditable !== 'true') return;
    
    overlay.contentEditable = 'false';
    
    const field = overlay.dataset.field;
    const newValue = overlay.textContent.trim();
    const fieldName = field === 'message' ? 'message1' : field;
    const oldValue = item[fieldName] || '';
    
    // Check if value changed
    if (newValue === oldValue) return;
    
    // Update local state
    item[fieldName] = newValue;
    if (field === 'message') {
        item.message = newValue; // Also update message field
    }
    item.modified = new Date().toISOString();
    thumbnailState.productionItems.set(item.id, item);
    
    // Send update to Mapping Slayer
    await updateDotInMappingSlayer(item.locationId, field, newValue);
    
    // Re-render the thumbnail with new message
    const thumbnailEl = overlay.closest('.thumbnail-item');
    if (thumbnailEl) {
        const canvas = await renderSignThumbnail(item, thumbnailState.thumbnailSize);
        const imageContainer = thumbnailEl.querySelector('.thumbnail-image');
        const oldCanvas = imageContainer.querySelector('canvas');
        if (oldCanvas) {
            imageContainer.replaceChild(canvas, oldCanvas);
        }
    }
}

/**
 * Handle icon click to toggle state
 */
async function handleIconClick(item, iconElement) {
    // Determine which icon was clicked
    let field, newValue;
    
    if (iconElement.classList.contains('icon-code')) {
        field = 'isCodeRequired';
        newValue = !item.codeRequired;
    } else if (iconElement.classList.contains('icon-notes')) {
        // For notes, we might want to open an edit dialog instead
        // For now, we'll just toggle presence
        return; // Skip notes for now
    } else if (iconElement.classList.contains('icon-vinyl')) {
        field = 'vinylBacker';
        newValue = !item.vinylBacker;
    } else if (iconElement.classList.contains('icon-installed')) {
        field = 'installed';
        newValue = !item.installed;
    } else {
        return;
    }
    
    // Update local state
    if (field === 'isCodeRequired') {
        item.codeRequired = newValue; // Update the local property name
    } else {
        item[field] = newValue;
    }
    
    // Update the item in the state map to ensure consistency
    item.modified = new Date().toISOString();
    thumbnailState.productionItems.set(item.id, item);
    
    // Send update to Mapping Slayer
    await updateDotInMappingSlayer(item.locationId, field, newValue);
    
    // Re-render the thumbnail
    updateThumbnailGrid();
}

/**
 * Send update to Mapping Slayer
 */
async function updateDotInMappingSlayer(locationId, field, value) {
    if (!window.appBridge) {
        console.warn('AppBridge not available');
        return;
    }
    
    try {
        const updates = {};
        updates[field] = value;
        
        const response = await window.appBridge.sendRequest('mapping_slayer', {
            type: 'update-dot',
            locationId: locationId,
            updates: updates
        });
        
        if (response && response.success) {
            showSuccess('Updated successfully');
        } else {
            showError('Failed to update');
        }
    } catch (error) {
        console.error('Failed to update dot:', error);
        showError('Update failed: ' + error.message);
    }
}

/**
 * Show loading overlay
 */
export function showLoading(show) {
    if (dom.loadingOverlay) {
        dom.loadingOverlay.style.display = show ? 'flex' : 'none';
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


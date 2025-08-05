/**
 * thumbnail-ui.js
 * UI management for Thumbnail Slayer - Sign Production
 */

import { thumbnailState, getFilteredItems, getSignTypes, getPageNumbers } from './thumbnail-state.js';
import { renderSignThumbnail } from './sign-renderer.js';
import { syncAllData } from './data-integration.js';
import { thumbnailSyncAdapter } from './thumbnail-sync.js';
import { viewportManager } from './viewport-manager.js';

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
        // Cleanup viewport manager when switching views
        viewportManager.cleanup();
        
        if (thumbnailState.viewMode === 'grid') {
            dom.thumbnailGrid.style.display = 'grid';
            dom.listView.style.display = 'none';
            if (dom.gridViewBtn) dom.gridViewBtn.classList.add('active');
            if (dom.listViewBtn) dom.listViewBtn.classList.remove('active');
            updateThumbnailGrid();
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
        const knownFields = ['id', 'locationId', 'locationNumber', 'pageNumber', 'sheetName', 
                           'signType', 'signTypeCode', 'signTypeName', 'signTypeInfo',
                           'x', 'y', 'installed', 'vinylBacker', 'codeRequired', 'notes',
                           'message1', 'status', 'modified'];
        
        Object.keys(item).forEach(key => {
            if (!knownFields.includes(key) && typeof item[key] === 'string' && 
                !textFields.find(f => f.fieldName === key)) {
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
                    ${textFields.map(field => {
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
                    }).join('')}
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
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // Character counters
    modal.querySelectorAll('.edit-field-input').forEach(input => {
        input.addEventListener('input', (e) => {
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
                const success = await thumbnailSyncAdapter.updateLocationField(item.locationId, field, value);
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
 * Update thumbnail grid with viewport optimization
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
    
    // Clear existing content and cleanup viewport manager
    viewportManager.cleanup();
    dom.thumbnailGrid.innerHTML = '';
    
    // Update state with filtered items for viewport manager
    thumbnailState.productionItems.clear();
    items.forEach(item => thumbnailState.productionItems.set(item.id, item));
    
    // Initialize viewport manager for grid view
    const scrollContainer = dom.thumbnailGrid.parentElement || dom.thumbnailGrid;
    viewportManager.initialize(dom.thumbnailGrid, scrollContainer);
    
    // Set progress callback
    viewportManager.onProgress = (message, progress) => {
        showLoading(true, message);
        if (progress >= 100) {
            setTimeout(() => showLoading(false), 500);
        }
    };
    
    // Start viewport-based rendering
    await viewportManager.updateViewport();
    
    // Setup event handlers for thumbnails
    setupThumbnailEventHandlers();
}

// Note: createThumbnailElement has been replaced by viewport-manager.js
// which handles efficient rendering with viewport virtualization

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
                    <th>Actions</th>
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
                        <td class="actions-cell">
                            <button class="list-edit-btn" data-item-id="${item.id}" title="Edit text fields">✏️</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    // Add click handlers for edit buttons
    dom.listView.querySelectorAll('.list-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.itemId;
            const item = thumbnailState.productionItems.get(itemId);
            if (item) {
                openEditModal(item);
            }
        });
    });
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

// Note: setupMessageOverlay has been replaced with event delegation in setupThumbnailEventHandlers

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
    
    // Send update to Mapping Slayer using sync adapter
    await thumbnailSyncAdapter.updateLocationField(item.locationId, field, newValue);
    
    // Re-render the thumbnail with new message using viewport manager
    await viewportManager.updateSingleThumbnail(item.id);
}

/**
 * Setup event handlers for thumbnails (using event delegation)
 */
function setupThumbnailEventHandlers() {
    if (!dom.thumbnailGrid) return;
    
    // Remove any existing listeners to prevent duplicates
    dom.thumbnailGrid.removeEventListener('click', handleThumbnailClick);
    dom.thumbnailGrid.removeEventListener('dblclick', handleThumbnailDoubleClick);
    
    // Add delegated event handlers
    dom.thumbnailGrid.addEventListener('click', handleThumbnailClick);
    dom.thumbnailGrid.addEventListener('dblclick', handleThumbnailDoubleClick);
    
    // Add delegated handlers for message overlays
    dom.thumbnailGrid.addEventListener('blur', handleMessageBlur, true);
    dom.thumbnailGrid.addEventListener('keydown', handleMessageKeydown, true);
}

/**
 * Handle thumbnail click events (delegated)
 */
function handleThumbnailClick(e) {
    const thumbnailItem = e.target.closest('.thumbnail-item');
    if (!thumbnailItem) return;
    
    const itemId = thumbnailItem.dataset.itemId;
    const item = thumbnailState.productionItems.get(itemId);
    if (!item) return;
    
    // Check if clicking on edit button
    if (e.target.closest('.thumbnail-edit-btn')) {
        e.stopPropagation();
        openEditModal(item);
        return;
    }
    
    // Check if clicking on an icon
    const icon = e.target.closest('.thumbnail-icons span');
    if (icon) {
        e.stopPropagation();
        handleIconClick(item, icon);
        return;
    }
    
    // Check if clicking on message overlay
    const messageOverlay = e.target.closest('.message-overlay');
    if (messageOverlay) {
        e.stopPropagation();
        makeEditable(messageOverlay, item);
        return;
    }
    
    // Otherwise select the item
    selectItem(item.id);
}

/**
 * Handle thumbnail double-click events (delegated)
 */
function handleThumbnailDoubleClick(e) {
    const imageContainer = e.target.closest('.thumbnail-image');
    if (!imageContainer || e.target.classList.contains('message-overlay')) return;
    
    const thumbnailItem = e.target.closest('.thumbnail-item');
    if (!thumbnailItem) return;
    
    const itemId = thumbnailItem.dataset.itemId;
    const item = thumbnailState.productionItems.get(itemId);
    if (!item) return;
    
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
        
        // Make it editable immediately
        makeEditable(overlay, item);
    }
}

/**
 * Handle message blur events (delegated)
 */
async function handleMessageBlur(e) {
    const messageOverlay = e.target.closest('.message-overlay');
    if (!messageOverlay || messageOverlay.contentEditable !== 'true') return;
    
    const thumbnailItem = messageOverlay.closest('.thumbnail-item');
    if (!thumbnailItem) return;
    
    const itemId = thumbnailItem.dataset.itemId;
    const item = thumbnailState.productionItems.get(itemId);
    if (!item) return;
    
    await saveMessageEdit(messageOverlay, item);
}

/**
 * Handle message keydown events (delegated)
 */
async function handleMessageKeydown(e) {
    const messageOverlay = e.target.closest('.message-overlay');
    if (!messageOverlay || messageOverlay.contentEditable !== 'true') return;
    
    if (e.key === 'Enter') {
        e.preventDefault();
        messageOverlay.blur();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        const thumbnailItem = messageOverlay.closest('.thumbnail-item');
        if (!thumbnailItem) return;
        
        const itemId = thumbnailItem.dataset.itemId;
        const item = thumbnailState.productionItems.get(itemId);
        if (!item) return;
        
        const fieldName = messageOverlay.dataset.field === 'message' ? 'message1' : messageOverlay.dataset.field;
        messageOverlay.textContent = item[fieldName] || '';
        messageOverlay.contentEditable = 'false';
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
    
    // Send update to Mapping Slayer using sync adapter
    await thumbnailSyncAdapter.updateLocationField(item.locationId, field, newValue);
    
    // Re-render just this thumbnail using viewport manager
    await viewportManager.updateSingleThumbnail(item.id);
}

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


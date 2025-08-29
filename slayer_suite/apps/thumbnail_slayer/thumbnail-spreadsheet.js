/**
 * thumbnail-spreadsheet.js
 * Custom spreadsheet implementation for Thumbnail Slayer
 * Provides Excel/Sheets-like editing with proper multi-cell selection
 */

import { thumbnailState } from './thumbnail-state.js';

// Default marker type colors (matching Mapping Slayer defaults)
const DEFAULT_MARKER_COLORS = {
    'room-id': '#FF6B6B', // Red
    office: '#4ECDC4', // Teal
    utility: '#95E77E', // Green
    emergency: '#FFD93D', // Yellow
    directional: '#A8E6CF', // Light green
    default: '#F07727' // Orange (Slayer Suite theme color)
};

/**
 * Get color for a marker type
 */
function getMarkerTypeColor(markerType) {
    // First check if we have marker type info from state
    if (thumbnailState.markerTypes && thumbnailState.markerTypes[markerType]) {
        return thumbnailState.markerTypes[markerType].color || DEFAULT_MARKER_COLORS.default;
    }

    // Fall back to default colors
    return DEFAULT_MARKER_COLORS[markerType] || DEFAULT_MARKER_COLORS.default;
}

class ThumbnailSpreadsheet {
    constructor() {
        this.container = null;
        this.table = null;
        this.data = [];
        this.columns = [];

        // Sort state
        this.sortColumn = null; // Current sort column
        this.sortDirection = 'asc'; // 'asc' or 'desc'

        // Selection state
        this.selectedCells = new Set();
        this.selectionStart = null;
        this.selectionEnd = null;
        this.startCell = null;
        this.endCell = null;
        this.dragStartCell = null;
        this.selectedRange = [];
        this.isSelecting = false;
        this.isDragging = false;
        this.isEditing = false;

        // Edit state
        this.editingCell = null;
        this.editingInput = null;

        // Callbacks
        this.onDataChange = null;
    }

    /**
     * Initialize the spreadsheet
     */
    init(container) {
        if (!container) {
            console.error('Cannot initialize spreadsheet: container is null');
            return;
        }

        this.container = container;
        this.setupColumns();
        this.createTable();
        this.attachEventListeners();

        console.log('Spreadsheet initialized with container:', container);
    }

    /**
     * Setup column definitions
     */
    setupColumns() {
        this.columns = [
            { id: 'dot', name: 'DOT', width: 40, editable: false, type: 'dot' },
            { id: 'locationNumber', name: 'Location', width: 80, editable: true, type: 'number' },
            { id: 'signTypeCode', name: 'Sign Type', width: 100, editable: true, type: 'text' },
            { id: 'pageNumber', name: 'Page', width: 70, editable: true, type: 'number' },
            { id: 'message1', name: 'Message 1', width: 200, editable: true, type: 'text' },
            { id: 'message2', name: 'Message 2', width: 200, editable: true, type: 'text' },
            {
                id: 'flag1',
                name: 'Flag 1',
                width: 70,
                editable: true,
                type: 'checkbox',
                flagPosition: 'topLeft'
            },
            {
                id: 'flag2',
                name: 'Flag 2',
                width: 70,
                editable: true,
                type: 'checkbox',
                flagPosition: 'topRight'
            },
            {
                id: 'flag3',
                name: 'Flag 3',
                width: 70,
                editable: true,
                type: 'checkbox',
                flagPosition: 'bottomLeft'
            },
            {
                id: 'flag4',
                name: 'Flag 4',
                width: 70,
                editable: true,
                type: 'checkbox',
                flagPosition: 'bottomRight'
            },
            { id: 'installed', name: 'Installed', width: 80, editable: true, type: 'checkbox' },
            { id: 'notes', name: 'Notes', width: 250, editable: true, type: 'text' }
        ];

        // Update flag column names from configuration if available
        this.updateFlagColumnNames();
    }

    /**
     * Update flag column names based on global flag configuration from Mapping Slayer
     */
    updateFlagColumnNames() {
        if (
            !window.thumbnailApp ||
            !window.thumbnailApp.syncAdapter ||
            !window.thumbnailApp.syncAdapter.globalFlagConfiguration
        ) {
            return false;
        }

        const globalFlagConfig = window.thumbnailApp.syncAdapter.globalFlagConfiguration;
        if (!globalFlagConfig) return false;

        let updated = false;

        // Update each flag column with the configured name
        this.columns.forEach(col => {
            if (col.flagPosition && globalFlagConfig[col.flagPosition]) {
                const flagConfig = globalFlagConfig[col.flagPosition];
                if (flagConfig && flagConfig.name) {
                    const oldName = col.name;
                    // Include symbol if configured
                    const symbol = this.getFlagSymbol(flagConfig.symbol);
                    col.name = symbol ? `${symbol} ${flagConfig.name}` : flagConfig.name;
                    if (oldName !== col.name) {
                        updated = true;
                    }
                }
            }
        });

        return updated;
    }

    /**
     * Update header cells without recreating the table
     */
    updateHeaderCells() {
        if (!this.table) return;

        const headerCells = this.table.querySelectorAll('thead th');
        this.columns.forEach((col, index) => {
            if (headerCells[index]) {
                headerCells[index].textContent = col.name;
            }
        });
    }

    /**
     * Get flag symbol display
     */
    getFlagSymbol(symbolValue) {
        const symbols = {
            star: '⭐',
            exclamation: '❗',
            question: '❓',
            check: '✓',
            x: '✗',
            warning: '⚠️',
            lock: '🔒',
            key: '🔑',
            flag: '🚩',
            pin: '📍',
            'red-circle': '🔴',
            'yellow-circle': '🟡',
            'green-circle': '🟢',
            'blue-circle': '🔵'
        };
        return symbols[symbolValue] || '';
    }

    /**
     * Create the table structure
     */
    createTable() {
        // Clear container
        this.container.innerHTML = '';

        // Create table wrapper for scrolling
        const wrapper = document.createElement('div');
        wrapper.className = 'spreadsheet-wrapper';
        wrapper.style.height = '100%';
        wrapper.style.overflow = 'auto';
        wrapper.style.position = 'relative';

        // Create table
        this.table = document.createElement('table');
        this.table.className = 'spreadsheet-table';
        this.table.style.borderCollapse = 'collapse';
        this.table.style.width = '100%';
        this.table.style.userSelect = 'none';
        this.table.tabIndex = 0; // Make focusable
        this.table.style.outline = 'none'; // Remove focus outline

        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        this.columns.forEach(col => {
            const th = document.createElement('th');
            th.dataset.columnId = col.id;
            th.style.width = col.width + 'px';
            th.style.padding = '5px 8px';
            th.style.borderBottom = '2px solid #555';
            th.style.backgroundColor = '#2a2a2a';
            th.style.color = '#fff';
            th.style.position = 'sticky';
            th.style.top = '0';
            th.style.zIndex = '10';
            th.style.textAlign = col.type === 'checkbox' ? 'center' : 'left';
            th.style.cursor = 'pointer';
            th.style.userSelect = 'none';

            // Create header content with sort indicator
            const headerContent = document.createElement('div');
            headerContent.style.display = 'flex';
            headerContent.style.alignItems = 'center';
            headerContent.style.justifyContent =
                col.type === 'checkbox' ? 'center' : 'space-between';

            const nameSpan = document.createElement('span');
            nameSpan.textContent = col.name;
            headerContent.appendChild(nameSpan);

            // Add sort indicator
            const sortIndicator = document.createElement('span');
            sortIndicator.className = 'sort-indicator';
            sortIndicator.style.marginLeft = '5px';
            sortIndicator.style.fontSize = '12px';
            sortIndicator.style.opacity = '0.5';
            sortIndicator.textContent = '';
            headerContent.appendChild(sortIndicator);

            th.appendChild(headerContent);

            // Add click handler for sorting
            th.addEventListener('click', () => this.handleHeaderClick(col.id));

            // Add hover effect
            th.addEventListener('mouseenter', () => {
                th.style.backgroundColor = '#333';
            });
            th.addEventListener('mouseleave', () => {
                th.style.backgroundColor = '#2a2a2a';
            });

            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        this.table.appendChild(thead);

        // Create tbody
        const tbody = document.createElement('tbody');
        tbody.id = 'spreadsheet-body';
        this.table.appendChild(tbody);

        // Add to wrapper and container
        wrapper.appendChild(this.table);
        this.container.appendChild(wrapper);
    }

    /**
     * Set data and render rows
     */
    setData(data) {
        console.log('Setting spreadsheet data:', data ? data.length : 0, 'items');

        this.data = data || [];

        // Update column names when data is loaded (flag configs might be available now)
        const columnsUpdated = this.updateFlagColumnNames();

        // Update header cells if columns changed
        if (columnsUpdated && this.table) {
            this.updateHeaderCells();
        }

        // Only render if table exists
        if (this.table) {
            this.renderRows();
        } else {
            console.warn('Cannot render rows: table not initialized yet');
        }
    }

    /**
     * Render all rows
     */
    renderRows() {
        if (!this.table) {
            console.error('Cannot render rows: table is null');
            return;
        }

        const tbody = this.table.querySelector('tbody');
        if (!tbody) {
            console.error('Cannot find tbody element');
            return;
        }

        console.log('Rendering', this.data.length, 'rows');
        tbody.innerHTML = '';

        this.data.forEach((item, rowIndex) => {
            const tr = document.createElement('tr');
            tr.dataset.rowIndex = rowIndex;
            tr.dataset.itemId = item.id;

            this.columns.forEach(col => {
                const td = document.createElement('td');
                td.dataset.rowIndex = rowIndex;
                td.dataset.colId = col.id;
                td.dataset.cellId = `${rowIndex}-${col.id}`;
                td.style.padding = '3px 6px';
                td.style.border = '1px solid #444';
                td.style.backgroundColor = '#1a1a1a';
                td.style.color = '#fff';
                td.style.cursor = 'default';

                // Render cell content based on type
                if (col.type === 'dot') {
                    // Render color dot
                    const markerType = item.markerType || item.signTypeCode || 'default';
                    const color = getMarkerTypeColor(markerType);
                    td.innerHTML = `<div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${color}; margin: 0 auto; border: 1px solid rgba(255,255,255,0.2); cursor: pointer; transition: transform 0.2s;"></div>`;
                    td.style.textAlign = 'center';
                    td.style.cursor = 'pointer';
                    td.title = 'Click to preview sign';

                    // Add hover effect
                    td.addEventListener('mouseenter', () => {
                        const dot = td.querySelector('div');
                        if (dot) {
                            dot.style.transform = 'scale(1.2)';
                            dot.style.border = '2px solid rgba(255,255,255,0.5)';
                        }
                    });
                    td.addEventListener('mouseleave', () => {
                        const dot = td.querySelector('div');
                        if (dot) {
                            dot.style.transform = 'scale(1)';
                            dot.style.border = '1px solid rgba(255,255,255,0.2)';
                        }
                    });
                } else if (col.type === 'checkbox') {
                    // Render checkbox
                    const checked = item[col.id] || false;
                    td.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''} style="pointer-events: none;">`;
                    td.style.textAlign = 'center';
                } else {
                    // Render text/number
                    td.textContent = item[col.id] || '';
                }

                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Track editing state
        this.table.addEventListener('focusin', e => {
            if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
                this.isEditing = true;
            }
        });

        this.table.addEventListener('focusout', e => {
            if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
                this.isEditing = false;
            }
        });

        // Prevent text selection while dragging
        this.table.addEventListener('selectstart', e => {
            if (this.isDragging) e.preventDefault();
        });

        // Middle-click handler for zooming to dot in map view (using mousedown for better compatibility)
        this.table.addEventListener(
            'mousedown',
            e => {
                if (e.button === 1) {
                    // Middle button
                    console.log('🟠 Middle-click mousedown detected', {
                        button: e.button,
                        target: e.target,
                        targetTag: e.target.tagName
                    });

                    e.preventDefault();
                    e.stopPropagation();

                    const cell = e.target.closest('td');
                    if (!cell) {
                        console.log('🟠 No cell found');
                        return;
                    }

                    const rowIndex = parseInt(cell.dataset.rowIndex);
                    console.log('🟠 Row index from cell:', rowIndex);

                    if (isNaN(rowIndex)) {
                        console.log('🟠 Invalid row index');
                        return;
                    }

                    const rowData = this.data[rowIndex];
                    console.log('🟠 Middle-click on row:', {
                        rowIndex,
                        rowData,
                        hasHandler: !!window.handleMiddleClickZoom
                    });

                    if (rowData && window.handleMiddleClickZoom) {
                        window.handleMiddleClickZoom(rowData.id);
                    }
                    return false;
                }
            },
            true
        ); // Use capture phase

        // Also prevent middle-click scroll
        this.table.addEventListener('auxclick', e => {
            if (e.button === 1) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        });

        // Cell click - handle with shift support
        this.table.addEventListener('click', e => {
            const cell = e.target.closest('td');
            if (!cell) return;

            console.log('🟡 Click event', {
                cell: cell.dataset.cellId,
                isEditing: this.isEditing,
                editingCell: this.editingCell?.dataset?.cellId,
                target: e.target.tagName
            });

            // Don't interfere with editing
            if (this.isEditing) {
                console.log('🟡 Click blocked - isEditing is true');
                return;
            }

            const colId = cell.dataset.colId;
            const col = this.columns.find(c => c.id === colId);

            // Special handling for DOT column click
            if (colId === 'dot') {
                // Show preview for this row when DOT is clicked
                const rowIndex = parseInt(cell.dataset.rowIndex);
                const item = this.data[rowIndex];
                if (item && window.selectRowAndThumbnail) {
                    // Make sure the item has the current message values
                    // Update the original item with current spreadsheet values
                    if (item._originalItem) {
                        item._originalItem.message1 = item.message1 || item._originalItem.message1;
                        item._originalItem.message2 = item.message2 || item._originalItem.message2;
                        item._originalItem.message = item.message1 || item._originalItem.message;
                    }
                    window.selectRowAndThumbnail(item.id);
                }
                // Focus the table to enable keyboard shortcuts
                this.table.focus();
                return;
            }

            // Don't select non-editable cells
            if (!col || !col.editable) return;

            if (e.shiftKey && this.startCell) {
                // Shift+click to extend selection
                e.preventDefault();
                this.endCell = cell;
                this.updateRangeSelection();
            } else {
                // Single click - immediately select the cell
                this.startCell = cell;
                this.endCell = cell;
                this.clearRangeSelection();
                this.updateRangeSelection();

                // Show preview for this row
                const rowIndex = parseInt(cell.dataset.rowIndex);
                const item = this.data[rowIndex];
                if (item && window.selectRowAndThumbnail) {
                    // Update the original item with current spreadsheet values
                    if (item._originalItem) {
                        item._originalItem.message1 = item.message1 || item._originalItem.message1;
                        item._originalItem.message2 = item.message2 || item._originalItem.message2;
                        item._originalItem.message = item.message1 || item._originalItem.message;
                    }
                    window.selectRowAndThumbnail(item.id);
                }

                // Focus the table to enable keyboard shortcuts
                this.table.focus();
            }
        });

        // Cell mousedown - track for drag selection
        this.table.addEventListener('mousedown', e => {
            // Don't start selection if we're editing
            if (this.isEditing) return;

            // Check if this is going to start editing (double click)
            if (e.detail === 2) return;

            const cell = e.target.closest('td');
            if (!cell) return;

            // Don't select non-editable cells
            const colId = cell.dataset.colId;
            const col = this.columns.find(c => c.id === colId);
            if (!col || !col.editable) return;

            // Only start dragging, don't update selection here (let click handle it)
            this.isDragging = true;
            this.dragStartCell = cell;
        });

        // Cell mouseenter - extend selection while dragging
        this.table.addEventListener(
            'mouseenter',
            e => {
                if (this.isDragging && !this.isEditing && this.dragStartCell) {
                    const cell = e.target.closest('td');
                    if (!cell) return;

                    const colId = cell.dataset.colId;
                    const col = this.columns.find(c => c.id === colId);
                    if (!col || !col.editable) return;

                    // Update selection range from drag start to current
                    this.startCell = this.dragStartCell;
                    this.endCell = cell;
                    this.updateRangeSelection();
                }
            },
            true
        );

        // Document mouseup - end selection
        document.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.dragStartCell = null;
        });

        // Double-click to edit
        this.table.addEventListener('dblclick', e => {
            const cell = e.target.closest('td');
            if (!cell) return;

            const colId = cell.dataset.colId;
            const col = this.columns.find(c => c.id === colId);
            if (!col || !col.editable) return;

            this.startEdit(cell);
        });

        // Keyboard shortcuts
        this.table.addEventListener('keydown', e => {
            // Copy (Ctrl+C)
            if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !this.isEditing) {
                e.preventDefault();
                this.copySelection();
            }

            // Paste (Ctrl+V)
            if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !this.isEditing) {
                e.preventDefault();
                this.pasteSelection();
            }

            // Delete - clear cells
            if (e.key === 'Delete') {
                e.preventDefault();
                this.clearSelection();
            }

            // F2 - edit cell
            if (e.key === 'F2' && this.selectionStart) {
                e.preventDefault();
                this.startEdit(this.selectionStart);
            }

            // Enter - edit cell or move down
            if (e.key === 'Enter') {
                if (this.editingCell) {
                    e.preventDefault();
                    this.finishEdit();
                    this.moveSelection('down');
                } else if (this.selectionStart) {
                    e.preventDefault();
                    this.startEdit(this.selectionStart);
                }
            }

            // Tab - move right
            if (e.key === 'Tab') {
                e.preventDefault();
                if (this.editingCell) {
                    this.finishEdit();
                }
                this.moveSelection(e.shiftKey ? 'left' : 'right');
            }

            // Escape - cancel edit or clear selection
            if (e.key === 'Escape') {
                e.preventDefault();
                if (this.editingCell) {
                    this.cancelEdit();
                } else {
                    this.clearRangeSelection();
                    this.updateStatusBar();
                }
            }

            // Arrow keys - navigate
            if (
                !this.editingCell &&
                ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
            ) {
                e.preventDefault();
                const direction = e.key.replace('Arrow', '').toLowerCase();
                if (e.shiftKey) {
                    this.extendSelection(direction);
                } else {
                    this.moveSelection(direction);
                }
            }

            // Type to edit - any printable character
            if (!this.editingCell && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                if (this.selectionStart) {
                    const colId = this.selectionStart.dataset.colId;
                    const col = this.columns.find(c => c.id === colId);
                    if (col && col.editable && col.type !== 'checkbox') {
                        this.startEdit(this.selectionStart, e.key);
                    }
                }
            }
        });

        // Handle paste event - only when not editing
        document.addEventListener('paste', e => {
            if (
                this.container.contains(document.activeElement) &&
                !this.isEditing &&
                !this.editingCell
            ) {
                e.preventDefault();
                const text = e.clipboardData.getData('text/plain');
                this.handlePasteWithRepeat(text);
            }
        });

        // Handle copy event - only when not editing
        document.addEventListener('copy', e => {
            if (
                this.container.contains(document.activeElement) &&
                !this.isEditing &&
                !this.editingCell
            ) {
                e.preventDefault();
                const text = this.getRangeSelectionAsText();
                e.clipboardData.setData('text/plain', text);

                // Show feedback
                const statusEl = document.getElementById('selection-info');
                if (statusEl) {
                    const originalText = statusEl.textContent;
                    statusEl.textContent = '✓ Copied to clipboard!';
                    setTimeout(() => {
                        statusEl.textContent = originalText;
                    }, 1500);
                }
            }
        });
    }

    /**
     * Update selection highlighting (kept for backward compatibility)
     */
    updateSelection() {
        this.updateRangeSelection();
    }

    /**
     * Update range selection with improved visual feedback
     */
    updateRangeSelection() {
        // Clear previous selection
        this.clearRangeSelection();

        if (!this.startCell || !this.endCell) return;

        // Get selection bounds
        const startRow = parseInt(this.startCell.dataset.rowIndex);
        const endRow = parseInt(this.endCell.dataset.rowIndex);
        const startColIndex = Array.from(this.startCell.parentElement.children).indexOf(
            this.startCell
        );
        const endColIndex = Array.from(this.endCell.parentElement.children).indexOf(this.endCell);

        const minRow = Math.min(startRow, endRow);
        const maxRow = Math.max(startRow, endRow);
        const minCol = Math.min(startColIndex, endColIndex);
        const maxCol = Math.max(startColIndex, endColIndex);

        // Build selected range array
        this.selectedRange = [];
        const rows = this.table.querySelectorAll('tbody tr');

        for (let r = minRow; r <= maxRow && r < rows.length; r++) {
            const rowCells = [];
            const cells = rows[r].querySelectorAll('td');

            for (let c = minCol; c <= maxCol && c < cells.length; c++) {
                const cell = cells[c];
                const colId = cell.dataset.colId;
                const col = this.columns.find(col => col.id === colId);

                // Only select editable cells
                if (col && col.editable) {
                    cell.classList.add('range-selected');
                    // Use orange theme color with transparency for dark theme
                    cell.style.backgroundColor = 'rgba(240, 119, 39, 0.3)';
                    cell.style.position = 'relative';

                    // Add border for range - using orange theme color
                    const borderStyle = '2px solid #f07727';

                    // Apply borders to create a continuous selection box
                    if (r === minRow) cell.style.borderTop = borderStyle;
                    if (r === maxRow) cell.style.borderBottom = borderStyle;
                    if (c === minCol) cell.style.borderLeft = borderStyle;
                    if (c === maxCol) cell.style.borderRight = borderStyle;

                    // Mark the active/start cell with brighter highlight
                    if (cell === this.startCell) {
                        cell.classList.add('active-cell');
                        cell.style.outline = '2px solid #ff9944';
                        cell.style.outlineOffset = '-1px';
                        cell.style.zIndex = '10';
                        cell.style.backgroundColor = 'rgba(240, 119, 39, 0.5)';
                    }

                    this.selectedCells.add(cell);
                    rowCells.push(cell);
                }
            }

            if (rowCells.length > 0) {
                this.selectedRange.push(rowCells);
            }
        }

        this.updateStatusBar();
    }

    /**
     * Clear range selection
     */
    clearRangeSelection() {
        // Remove selection styling from all cells
        this.table.querySelectorAll('.range-selected').forEach(el => {
            el.classList.remove('range-selected', 'active-cell');
            el.style.backgroundColor = '#1a1a1a';
            el.style.border = '1px solid #444';
            el.style.outline = 'none';
            el.style.outlineOffset = '';
            el.style.zIndex = '';
            el.style.position = '';
        });
        this.selectedCells.clear();
        this.selectedRange = [];
    }

    /**
     * Update status bar with selection info
     */
    updateStatusBar() {
        const statusEl = document.getElementById('selection-info');
        if (!statusEl) return;

        if (this.selectedRange.length > 0) {
            const rows = this.selectedRange.length;
            const cols = this.selectedRange[0]?.length || 0;
            statusEl.textContent = `Selected: ${rows} rows × ${cols} columns (${rows * cols} cells)`;
        } else {
            statusEl.textContent = 'No selection';
        }
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.selectedCells.forEach(cell => {
            cell.classList.remove('selected', 'selection-start');
            cell.style.backgroundColor = '#1a1a1a';
            cell.style.outline = 'none';
        });
        this.selectedCells.clear();
        this.selectionStart = null;
        this.selectionEnd = null;
    }

    /**
     * Start editing a cell
     */
    startEdit(cell, initialChar = '') {
        console.log('🔵 startEdit called', {
            cell: cell?.dataset?.cellId,
            initialChar,
            currentEditingCell: this.editingCell?.dataset?.cellId,
            isEditing: this.isEditing
        });

        if (this.editingCell) {
            this.finishEdit();
        }

        const rowIndex = parseInt(cell.dataset.rowIndex);
        const colId = cell.dataset.colId;
        const col = this.columns.find(c => c.id === colId);
        const item = this.data[rowIndex];

        if (!col || !col.editable || !item) return;

        this.editingCell = cell;
        console.log('🔵 editingCell set to:', cell.dataset.cellId);

        if (col.type === 'checkbox') {
            // Toggle checkbox
            const oldValue = item[colId];
            item[colId] = !item[colId];
            this.updateCell(cell, item, col);

            // Update original item's flags if this is a flag field
            if (item._originalItem && colId.startsWith('flag')) {
                const flagMap = {
                    flag1: 'topLeft',
                    flag2: 'topRight',
                    flag3: 'bottomLeft',
                    flag4: 'bottomRight'
                };
                const flagName = flagMap[colId];
                if (flagName) {
                    // Ensure flags object exists
                    if (!item._originalItem.flags) {
                        item._originalItem.flags = {
                            topLeft: false,
                            topRight: false,
                            bottomLeft: false,
                            bottomRight: false
                        };
                    }
                    // Update the flag value
                    item._originalItem.flags[flagName] = item[colId];
                    // Also update the nested flags in the spreadsheet item
                    if (!item.flags) {
                        item.flags = { ...item._originalItem.flags };
                    } else {
                        item.flags[flagName] = item[colId];
                    }
                }
            }

            // Update original item's installed flag
            if (item._originalItem && colId === 'installed') {
                item._originalItem.installed = item[colId];
            }

            // Set editing cell to track the changed field for sync
            this.editingCell = cell;
            this.finishEdit();
        } else {
            // Create input for text/number
            const input = document.createElement('input');
            input.type = col.type === 'number' ? 'number' : 'text';
            input.value = initialChar || item[colId] || '';
            input.style.width = '100%';
            input.style.padding = '4px';
            input.style.border = 'none';
            input.style.backgroundColor = '#2a2a2a';
            input.style.color = '#fff';
            input.style.outline = '2px solid #ff9944';

            // Replace cell content with input
            cell.innerHTML = '';
            cell.appendChild(input);
            this.editingInput = input;

            // Mark as editing BEFORE focusing
            this.isEditing = true;
            console.log('🔵 isEditing set to true');

            // Focus and select
            input.focus();
            if (initialChar) {
                // Place cursor after initial character
                input.setSelectionRange(1, 1);
            } else {
                input.select();
            }

            // Handle input events
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.finishEdit();
                    // Don't move selection here - it's handled in the main keydown handler
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.cancelEdit();
                } else if (e.key === 'Tab') {
                    e.preventDefault();
                    this.finishEdit();
                    this.moveSelection(e.shiftKey ? 'left' : 'right');
                }
            });

            input.addEventListener('blur', () => {
                if (this.editingCell === cell) {
                    this.finishEdit();
                }
            });
        }
    }

    /**
     * Finish editing and save value
     */
    finishEdit() {
        console.log('🟢 finishEdit called', {
            editingCell: this.editingCell?.dataset?.cellId,
            isEditing: this.isEditing,
            startCell: this.startCell?.dataset?.cellId,
            endCell: this.endCell?.dataset?.cellId
        });

        if (!this.editingCell) return;

        const rowIndex = parseInt(this.editingCell.dataset.rowIndex);
        const colId = this.editingCell.dataset.colId;
        const col = this.columns.find(c => c.id === colId);
        const item = this.data[rowIndex];

        let changedField = null;
        let newValue = null;

        if (this.editingInput) {
            // Save the value for text/number inputs
            newValue = this.editingInput.value;
            const oldValue = item[colId];
            item[colId] = col.type === 'number' ? parseFloat(newValue) || 0 : newValue;

            // Track if value actually changed
            if (oldValue !== item[colId]) {
                changedField = colId;
            }

            // Update cell display
            this.updateCell(this.editingCell, item, col);
        } else if (col.type === 'checkbox') {
            // For checkboxes, the value was already changed in startEdit
            // Just mark it as changed for syncing
            changedField = colId;
            newValue = item[colId];
        }

        // Remember the cell for selection
        const editedCell = this.editingCell;

        // Clear editing state
        this.editingCell = null;
        this.editingInput = null;
        this.isEditing = false; // Make sure to clear this flag

        // Maintain selection on the edited cell
        if (editedCell) {
            this.startCell = editedCell;
            this.endCell = editedCell;
            this.selectionStart = editedCell;
            this.selectionEnd = editedCell;
            console.log('🟢 Selection maintained on:', editedCell.dataset.cellId);
        }

        console.log('🟢 finishEdit complete', {
            startCell: this.startCell?.dataset?.cellId,
            isEditing: this.isEditing
        });

        // Notify of data change
        if (this.onDataChange) {
            this.onDataChange(this.data);
        }

        // Save state to localStorage after data change
        if (window.thumbnailApp && window.thumbnailApp.saveCachedState) {
            window.thumbnailApp.saveCachedState();
        }

        // Sync to Mapping Slayer only if value changed
        if (changedField) {
            this.syncFieldToMappingSlayer(item, changedField);

            // If we edited a message field, update the preview
            if (
                (changedField === 'message1' || changedField === 'message2') &&
                window.selectRowAndThumbnail
            ) {
                // Update the original item with the new value
                if (item._originalItem) {
                    item._originalItem[changedField] = item[changedField];
                    if (changedField === 'message1') {
                        item._originalItem.message = item[changedField];
                    }
                }
                // Refresh the preview if this item is currently selected
                const currentPreview = document.getElementById('preview-container');
                if (currentPreview && currentPreview.dataset.itemId === item.id) {
                    window.selectRowAndThumbnail(item.id);
                }
            }
        }
    }

    /**
     * Cancel editing without saving
     */
    cancelEdit() {
        if (!this.editingCell) return;

        const rowIndex = parseInt(this.editingCell.dataset.rowIndex);
        const colId = this.editingCell.dataset.colId;
        const col = this.columns.find(c => c.id === colId);
        const item = this.data[rowIndex];

        // Restore original value
        this.updateCell(this.editingCell, item, col);

        // Clear editing state
        this.editingCell = null;
        this.editingInput = null;
        this.isEditing = false;
        console.log('🔴 cancelEdit - isEditing set to false');
    }

    /**
     * Update cell display
     */
    updateCell(cell, item, col) {
        if (col.type === 'checkbox') {
            const checked = item[col.id] || false;
            cell.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''} style="pointer-events: none;">`;
        } else {
            cell.textContent = item[col.id] || '';
        }
    }

    /**
     * Move selection in a direction
     */
    moveSelection(direction) {
        // Use startCell instead of selectionStart for consistency
        if (!this.startCell) return;

        const rowIndex = parseInt(this.startCell.dataset.rowIndex);
        const colIndex = Array.from(this.startCell.parentElement.children).indexOf(this.startCell);
        const rows = this.table.querySelectorAll('tbody tr');

        let newRow = rowIndex;
        let newCol = colIndex;

        switch (direction) {
            case 'up':
                newRow = Math.max(0, rowIndex - 1);
                break;
            case 'down':
                newRow = Math.min(rows.length - 1, rowIndex + 1);
                break;
            case 'left':
                newCol = Math.max(1, colIndex - 1); // Skip DOT column
                break;
            case 'right':
                newCol = Math.min(this.columns.length - 1, colIndex + 1);
                break;
        }

        if (rows[newRow]) {
            const newCell = rows[newRow].children[newCol];
            if (newCell) {
                // Clear old selection and set new
                this.clearRangeSelection();
                this.startCell = newCell;
                this.endCell = newCell;
                this.selectionStart = newCell; // Keep for backward compatibility
                this.selectionEnd = newCell;
                this.updateRangeSelection();

                // Focus table to receive keyboard events
                this.table.focus();
            }
        }
    }

    /**
     * Extend selection in a direction
     */
    extendSelection(direction) {
        if (!this.selectionEnd) return;

        const rowIndex = parseInt(this.selectionEnd.dataset.rowIndex);
        const colIndex = Array.from(this.selectionEnd.parentElement.children).indexOf(
            this.selectionEnd
        );
        const rows = this.table.querySelectorAll('tbody tr');

        let newRow = rowIndex;
        let newCol = colIndex;

        switch (direction) {
            case 'up':
                newRow = Math.max(0, rowIndex - 1);
                break;
            case 'down':
                newRow = Math.min(rows.length - 1, rowIndex + 1);
                break;
            case 'left':
                newCol = Math.max(1, colIndex - 1); // Skip DOT column
                break;
            case 'right':
                newCol = Math.min(this.columns.length - 1, colIndex + 1);
                break;
        }

        if (rows[newRow]) {
            const newCell = rows[newRow].children[newCol];
            if (newCell) {
                this.selectionEnd = newCell;
                this.updateSelection();
            }
        }
    }

    /**
     * Get selection as tab-delimited text
     */
    getSelectionAsText() {
        if (!this.selectedCells.size) return '';

        // Group cells by row
        const cellsByRow = new Map();
        this.selectedCells.forEach(cell => {
            const rowIndex = parseInt(cell.dataset.rowIndex);
            if (!cellsByRow.has(rowIndex)) {
                cellsByRow.set(rowIndex, []);
            }
            cellsByRow.get(rowIndex).push(cell);
        });

        // Sort rows and cells within rows
        const sortedRows = Array.from(cellsByRow.keys()).sort((a, b) => a - b);
        const rows = [];

        sortedRows.forEach(rowIndex => {
            const cells = cellsByRow.get(rowIndex);
            cells.sort((a, b) => {
                const aIndex = Array.from(a.parentElement.children).indexOf(a);
                const bIndex = Array.from(b.parentElement.children).indexOf(b);
                return aIndex - bIndex;
            });

            const values = cells.map(cell => {
                const colId = cell.dataset.colId;
                const col = this.columns.find(c => c.id === colId);
                const item = this.data[rowIndex];

                if (col.type === 'checkbox') {
                    return item[colId] ? 'TRUE' : 'FALSE';
                } else {
                    return item[colId] || '';
                }
            });

            rows.push(values.join('\t'));
        });

        return rows.join('\n');
    }

    /**
     * Get range selection as text for copying
     */
    getRangeSelectionAsText() {
        if (this.selectedRange.length === 0) return '';

        const data = [];
        for (const row of this.selectedRange) {
            const rowData = row.map(cell => {
                const rowIndex = parseInt(cell.dataset.rowIndex);
                const colId = cell.dataset.colId;
                const col = this.columns.find(c => c.id === colId);
                const item = this.data[rowIndex];

                if (col && item) {
                    if (col.type === 'checkbox') {
                        return item[colId] ? 'TRUE' : 'FALSE';
                    } else {
                        const value = item[colId];
                        return value !== null && value !== undefined ? value : '';
                    }
                }
                return '';
            });
            data.push(rowData.join('\t'));
        }

        return data.join('\n');
    }

    /**
     * Handle paste with repeat to fill selection
     */
    handlePasteWithRepeat(text) {
        if (!text || this.selectedRange.length === 0) return;

        // Parse pasted data
        const pastedRows = text.trim().split('\n');
        const parsedData = pastedRows.map(row => row.split('\t'));

        // Show preview (optional - you can add a preview element)
        console.log(
            `Pasting data (${parsedData.length}×${parsedData[0]?.length || 0}) into selection (${this.selectedRange.length} rows)`
        );

        // Collect all updates first
        const updates = [];

        // Special handling for single cell copy to multiple cells
        const isSingleCellPaste = parsedData.length === 1 && parsedData[0].length === 1;

        if (isSingleCellPaste) {
            // Fill ALL selected cells with the single value
            const singleValue = parsedData[0][0];

            for (let r = 0; r < this.selectedRange.length; r++) {
                const row = this.selectedRange[r];
                for (let c = 0; c < row.length; c++) {
                    const cell = row[c];
                    const rowIndex = parseInt(cell.dataset.rowIndex);
                    const colId = cell.dataset.colId;
                    const col = this.columns.find(col => col.id === colId);
                    const item = this.data[rowIndex];

                    if (col && item) {
                        // Convert value based on column type
                        let newValue;
                        if (col.type === 'checkbox') {
                            newValue = singleValue.toLowerCase() === 'true' || singleValue === '1';
                        } else if (col.type === 'number') {
                            newValue = parseFloat(singleValue) || 0;
                        } else {
                            newValue = singleValue;
                        }

                        // Store the update
                        updates.push({
                            item: item,
                            field: colId,
                            value: newValue,
                            cell: cell
                        });
                    }
                }
            }
        } else {
            // Original logic for multi-cell paste with repeat pattern
            for (let r = 0; r < this.selectedRange.length; r++) {
                const row = this.selectedRange[r];
                const sourceRowIndex = r % parsedData.length;
                const sourceRow = parsedData[sourceRowIndex];

                for (let c = 0; c < row.length; c++) {
                    const cell = row[c];
                    const sourceColIndex = c % sourceRow.length;
                    const value = sourceRow[sourceColIndex];

                    if (value !== undefined) {
                        const rowIndex = parseInt(cell.dataset.rowIndex);
                        const colId = cell.dataset.colId;
                        const col = this.columns.find(col => col.id === colId);
                        const item = this.data[rowIndex];

                        if (col && item) {
                            // Convert value based on column type
                            let newValue;
                            if (col.type === 'checkbox') {
                                newValue = value.toLowerCase() === 'true' || value === '1';
                            } else if (col.type === 'number') {
                                newValue = parseFloat(value) || 0;
                            } else {
                                newValue = value;
                            }

                            // Store the update
                            updates.push({
                                item: item,
                                field: colId,
                                value: newValue,
                                cell: cell
                            });
                        }
                    }
                }
            }
        }

        // Apply all updates
        updates.forEach(update => {
            update.item[update.field] = update.value;

            // Update original item's flags if this is a flag field
            if (update.item._originalItem && update.field.startsWith('flag')) {
                const flagMap = {
                    flag1: 'topLeft',
                    flag2: 'topRight',
                    flag3: 'bottomLeft',
                    flag4: 'bottomRight'
                };
                const flagName = flagMap[update.field];
                if (flagName) {
                    if (!update.item._originalItem.flags) {
                        update.item._originalItem.flags = {};
                    }
                    update.item._originalItem.flags[flagName] = update.value;
                }
            }
        });

        // Re-render affected rows
        this.renderRows();

        // Restore selection after re-render
        setTimeout(() => {
            this.updateRangeSelection();
        }, 0);

        // Notify of data change
        if (this.onDataChange) {
            this.onDataChange(this.data);
        }

        // Sync each updated field individually to Mapping Slayer
        // Group updates by item for efficiency
        const updatesByItem = new Map();
        updates.forEach(update => {
            if (!updatesByItem.has(update.item)) {
                updatesByItem.set(update.item, []);
            }
            updatesByItem.get(update.item).push(update.field);
        });

        // Sync each field for each item
        updatesByItem.forEach((fields, item) => {
            fields.forEach(field => {
                this.syncFieldToMappingSlayer(item, field);
            });
        });

        // Show feedback
        const statusEl = document.getElementById('selection-info');
        if (statusEl) {
            const originalText = statusEl.textContent;
            statusEl.textContent = '✓ Data pasted successfully!';
            setTimeout(() => {
                statusEl.textContent = originalText;
            }, 1500);
        }
    }

    /**
     * Handle paste (legacy method kept for compatibility)
     */
    handlePaste(text) {
        this.handlePasteWithRepeat(text);
    }

    /**
     * Copy selection
     */
    copySelection() {
        const text = this.getRangeSelectionAsText();
        if (text) {
            navigator.clipboard.writeText(text);
            console.log('Copied to clipboard:', text);

            // Show feedback
            const statusEl = document.getElementById('selection-info');
            if (statusEl) {
                const originalText = statusEl.textContent;
                statusEl.textContent = '✓ Copied to clipboard!';
                setTimeout(() => {
                    statusEl.textContent = originalText;
                }, 1500);
            }
        }
    }

    /**
     * Paste from clipboard
     */
    async pasteSelection() {
        try {
            const text = await navigator.clipboard.readText();
            this.handlePasteWithRepeat(text);
        } catch (error) {
            console.error('Failed to read clipboard:', error);
            // Show error feedback
            const statusEl = document.getElementById('selection-info');
            if (statusEl) {
                const originalText = statusEl.textContent;
                statusEl.textContent = '✗ Failed to paste from clipboard';
                setTimeout(() => {
                    statusEl.textContent = originalText;
                }, 1500);
            }
        }
    }

    /**
     * Clear selected cells
     */
    clearSelection() {
        this.selectedCells.forEach(cell => {
            const rowIndex = parseInt(cell.dataset.rowIndex);
            const colId = cell.dataset.colId;
            const col = this.columns.find(c => c.id === colId);
            const item = this.data[rowIndex];

            if (col && col.editable && item) {
                if (col.type === 'checkbox') {
                    item[colId] = false;
                } else {
                    item[colId] = '';
                }

                this.updateCell(cell, item, col);
            }
        });

        // Notify of data change
        if (this.onDataChange) {
            this.onDataChange(this.data);
        }
    }

    /**
     * Sync a single field to Mapping Slayer
     */
    async syncFieldToMappingSlayer(item, fieldName) {
        try {
            // Use the sync adapter if available
            if (window.thumbnailApp?.syncAdapter) {
                // Get the original item if this is a transformed spreadsheet item
                const originalItem = item._originalItem || item;
                const locationId = originalItem.locationId || originalItem.id;

                console.log('🔸 syncFieldToMappingSlayer', {
                    fieldName,
                    value: item[fieldName],
                    locationId,
                    itemId: item.id,
                    originalItem: originalItem
                });

                // Map spreadsheet field names to Mapping Slayer field names
                let mappedFieldName = fieldName;
                if (fieldName === 'flag1') mappedFieldName = 'topLeft';
                else if (fieldName === 'flag2') mappedFieldName = 'topRight';
                else if (fieldName === 'flag3') mappedFieldName = 'bottomLeft';
                else if (fieldName === 'flag4') mappedFieldName = 'bottomRight';
                else if (fieldName === 'message1') mappedFieldName = 'message';

                const success = await window.thumbnailApp.syncAdapter.updateLocationField(
                    locationId,
                    mappedFieldName,
                    item[fieldName]
                );

                if (success) {
                    console.log(
                        `✅ Synced field ${fieldName} for item ${item.id} to Mapping Slayer`
                    );
                } else {
                    console.error(`❌ Failed to sync field ${fieldName} for item ${item.id}`);
                }
            } else {
                console.error('❌ Sync adapter not available');
            }
        } catch (error) {
            console.error('Failed to sync field to Mapping Slayer:', error);
        }
    }

    /**
     * Sync all changes to Mapping Slayer
     */
    async syncToMappingSlayer(item) {
        try {
            // Use the sync adapter if available
            if (window.thumbnailApp?.syncAdapter) {
                // Get the original item if this is a transformed spreadsheet item
                const originalItem = item._originalItem || item;
                const locationId = originalItem.locationId || originalItem.id;

                // Sync each changed field
                const fieldsToSync = [
                    'message1',
                    'message2',
                    'flag1',
                    'flag2',
                    'flag3',
                    'flag4',
                    'installed',
                    'notes',
                    'locationNumber',
                    'signTypeCode',
                    'pageNumber'
                ];

                for (const field of fieldsToSync) {
                    if (item.hasOwnProperty(field)) {
                        // Map flag fields to their proper names
                        let fieldName = field;
                        if (field === 'flag1') fieldName = 'topLeft';
                        else if (field === 'flag2') fieldName = 'topRight';
                        else if (field === 'flag3') fieldName = 'bottomLeft';
                        else if (field === 'flag4') fieldName = 'bottomRight';
                        else if (field === 'message1') fieldName = 'message';

                        await window.thumbnailApp.syncAdapter.updateLocationField(
                            locationId,
                            fieldName,
                            item[field]
                        );
                    }
                }

                console.log(`Synced item ${item.id} to Mapping Slayer`);
            }
        } catch (error) {
            console.error('Failed to sync to Mapping Slayer:', error);
        }
    }

    /**
     * Get all data
     */
    getData() {
        return this.data;
    }

    /**
     * Refresh display
     */
    refresh() {
        this.renderRows();
    }

    /**
     * Handle header click for sorting
     */
    handleHeaderClick(columnId) {
        // If clicking the same column, toggle direction
        if (this.sortColumn === columnId) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            // New column, default to ascending
            this.sortColumn = columnId;
            this.sortDirection = 'asc';
        }

        // Sort the data
        this.sortData();

        // Update sort indicators
        this.updateSortIndicators();

        // Re-render the rows
        this.renderRows();
    }

    /**
     * Sort the data based on current sort column and direction
     */
    sortData() {
        if (!this.sortColumn) return;

        const column = this.columns.find(col => col.id === this.sortColumn);
        if (!column) return;

        this.data.sort((a, b) => {
            let aVal = a[this.sortColumn];
            let bVal = b[this.sortColumn];

            // Handle checkbox columns (boolean values)
            if (column.type === 'checkbox') {
                aVal = aVal ? 1 : 0;
                bVal = bVal ? 1 : 0;
            }
            // Handle numeric columns
            else if (this.sortColumn === 'locationNumber' || this.sortColumn === 'pageNumber') {
                aVal = parseInt(aVal) || 0;
                bVal = parseInt(bVal) || 0;
            }
            // Handle string columns
            else {
                aVal = (aVal || '').toString().toLowerCase();
                bVal = (bVal || '').toString().toLowerCase();
            }

            // Compare values
            let comparison = 0;
            if (aVal < bVal) comparison = -1;
            else if (aVal > bVal) comparison = 1;

            // Apply sort direction
            return this.sortDirection === 'asc' ? comparison : -comparison;
        });
    }

    /**
     * Update sort indicators in headers
     */
    updateSortIndicators() {
        if (!this.table) return;

        const headers = this.table.querySelectorAll('thead th');
        headers.forEach(th => {
            const columnId = th.dataset.columnId;
            const indicator = th.querySelector('.sort-indicator');
            if (indicator) {
                if (columnId === this.sortColumn) {
                    indicator.textContent = this.sortDirection === 'asc' ? '▲' : '▼';
                    indicator.style.opacity = '1';
                } else {
                    indicator.textContent = '';
                    indicator.style.opacity = '0.5';
                }
            }
        });
    }

    /**
     * Destroy the spreadsheet
     */
    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.table = null;
        this.data = [];
        this.selectedCells.clear();
    }
}

// Export singleton instance
export const thumbnailSpreadsheet = new ThumbnailSpreadsheet();

/**
 * ui.js
 * This module is responsible for all DOM manipulation and UI updates
 * that are not part of the 2D or 3D canvas rendering.
 */

import { state, updateState } from './state.js';
import { LAYER_DEFINITIONS, SNAP_PRESETS, SCALE_FACTOR } from './config.js';
import { measureCapitalXHeight, getTextBaseline, measureText, SCALE_FACTOR as TEXT_SCALE_FACTOR } from './text-renderer.js';
import { fontManager } from './font-manager.js';

// --- DOM Element Selectors ---
const getElement = (id) => document.getElementById(id);
const querySelector = (selector) => document.querySelector(selector);
const querySelectorAll = (selector) => document.querySelectorAll(selector);

// --- Helper Functions ---

/**
 * Generates font options for the font selector
 * @param {string} selectedFont - The currently selected font
 * @returns {string} HTML string of option elements
 */
function generateFontOptions(selectedFont = 'Arial') {
    let html = '';
    
    // Add Upload Font option first
    html += '<option value="__upload__">📁 Upload Font...</option>';
    
    // Get uploaded fonts
    const uploadedFonts = fontManager.getUploadedFonts();
    
    // Add uploaded fonts section if any exist
    if (uploadedFonts.length > 0) {
        html += '<optgroup label="── Uploaded Fonts ──">';
        uploadedFonts.forEach(font => {
            html += `<option value="${font}" ${font === selectedFont ? 'selected' : ''}>${font}</option>`;
        });
        html += '</optgroup>';
    }
    
    // System fonts
    const commonFonts = [
        'Arial',
        'Arial Black',
        'Arial Narrow',
        'Calibri',
        'Cambria',
        'Century Gothic',
        'Comic Sans MS',
        'Consolas',
        'Courier',
        'Courier New',
        'Franklin Gothic',
        'Garamond',
        'Georgia',
        'Helvetica',
        'Helvetica Neue',
        'Impact',
        'Lucida Console',
        'Lucida Sans Unicode',
        'Microsoft Sans Serif',
        'Palatino Linotype',
        'Segoe UI',
        'Tahoma',
        'Times New Roman',
        'Trebuchet MS',
        'Verdana',
        // Add some specialty/sign fonts
        'Highway Gothic',
        'ClearviewHwy',
        'Interstate',
        'DIN',
        'Frutiger',
        'Futura',
        'Univers',
        // Braille fonts
        'Braille.ttf',
        'SimBraille',
        'Braille29',
        'Braille3D'
    ];
    
    html += '<optgroup label="── System Fonts ──">';
    commonFonts.forEach(font => {
        html += `<option value="${font}" ${font === selectedFont ? 'selected' : ''}>${font}</option>`;
    });
    html += '</optgroup>';
    
    return html;
}

// Create a lazy-loaded DOM object that queries elements only when accessed
const dom = new Proxy({}, {
    get(target, prop) {
        if (target[prop]) return target[prop];
        
        // Define element mappings
        const elementMappings = {
            layersList: () => getElement('layers-list'),
            layerTypeSelect: () => getElement('layer-type-select'),
            addLayerBtn: () => getElement('add-layer-btn'),
            faceViewport: () => getElement('face-viewport'),
            sideViewport: () => getElement('side-viewport'),
            dimensionsContainer: () => getElement('dimensions-container'),
            signDimensions: () => getElement('sign-dimensions'),
            snapFlyout: () => getElement('snap-flyout'),
            snapButton: () => getElement('snap-toggle-btn'),
            snapToggleSwitch: () => getElement('snap-toggle-switch'),
            gridToggleBtn: () => getElement('grid-toggle-btn'),
            snapPresets: () => getElement('snap-presets'),
            snapCustomInput: () => getElement('custom-snap-input'),
            unitButtons: () => querySelectorAll('.unit-btn'),
            xrayToggleBtn: () => getElement('xray-mode-btn'),
            shadowToggleBtn: () => getElement('shadow-mode-btn'),
            modal3d: () => getElement('modal-3d'),
            close3dModalBtn: () => getElement('close-modal-3d-btn'),
            view3dBtn: () => getElement('view-3d-btn'),
            loadingSpinner: () => getElement('loading-spinner'),
        };
        
        if (elementMappings[prop]) {
            target[prop] = elementMappings[prop]();
            return target[prop];
        }
        
        return null;
    }
});

// --- Layer List UI ---

/**
 * Re-renders the entire layer list based on the current state.
 * @param {object} eventHandlers - An object containing event handler functions to attach to layer rows.
 */
export function refreshLayerList(eventHandlers) {
    if (!dom.layersList) return;
    
    dom.layersList.innerHTML = '';
    if (state.layersList.length === 0) {
        dom.layersList.innerHTML = '<div class="empty-state">Select a layer type and click + to add your first layer.</div>';
        return;
    }
    state.layersList.forEach((layer, index) => {
        const row = renderLayerRow(layer, index, eventHandlers);
        dom.layersList.appendChild(row);
        
        // Restore expanded state if the layer was previously expanded
        if (state.expandedLayers.has(layer.id)) {
            const propertiesDiv = getElement(`props-${layer.id}`);
            const arrow = querySelector(`[data-layer-id="${layer.id}"] .layer-expand-arrow`);
            if (propertiesDiv && arrow) {
                propertiesDiv.classList.add('expanded');
                arrow.classList.add('expanded');
                // Re-populate the properties if needed
                if (propertiesDiv.children.length === 0) {
                    toggleLayerProperties(layer.id, eventHandlers.onUpdateLayerProperties);
                }
            }
        }
    });
    if (state.currentLayer) {
        const selectedRow = querySelector(`[data-layer-id="${state.currentLayer.id}"]`);
        if (selectedRow) selectedRow.classList.add('selected');
    }
    updateLinkVisuals();
}

/**
 * Updates only the selection state of layers without refreshing the entire list
 */
export function updateLayerSelection() {
    // Remove selected class from all rows
    querySelectorAll('.layer-row').forEach(row => row.classList.remove('selected'));
    
    // Add selected class to current layer
    if (state.currentLayer) {
        const selectedRow = querySelector(`[data-layer-id="${state.currentLayer.id}"]`);
        if (selectedRow) selectedRow.classList.add('selected');
    }
}

/**
 * Creates and returns a DOM element for a single layer row.
 * @param {object} layer - The layer object from state.
 * @param {number} index - The index of the layer in the list.
 * @param {object} eventHandlers - Event handlers to attach.
 * @returns {HTMLElement} The created layer row element.
 */
function renderLayerRow(layer, index, eventHandlers) {
    const definition = LAYER_DEFINITIONS[layer.type];
    const dropZoneBefore = createDropZone(index, eventHandlers.onDropInLayerList);
    
    const row = document.createElement('div');
    row.className = `layer-row ${layer.onCanvas ? '' : 'not-on-canvas'}`;
    row.dataset.layerId = layer.id;
    row.style.borderLeftColor = layer.color || definition.color;
    
    row.innerHTML = `
        <div class="layer-header">
            <div class="layer-drag-handle" draggable="true">⋮⋮</div>
            <div class="layer-link-handle">
                <div class="link-top" data-index="${index}" data-dir="up"></div>
                <div class="link-bottom" data-index="${index}" data-dir="down"></div>
            </div>
            <div class="layer-expand-arrow">▶</div>
            <div class="layer-info">
                <div class="layer-name">${layer.name}</div>
            </div>
            <div class="layer-actions">
                <button class="btn-icon dim-toggle ${layer.showDimensions ? 'active' : ''}" title="Toggle Dimensions">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3H3C2.4 3 2 3.4 2 4V20C2 20.6 2.4 21 3 21H21C21.6 21 22 20.6 22 20V4C22 3.4 21.6 3 21 3Z"></path><path d="M10 3V21"></path><path d="M3 10H21"></path></svg>
                </button>
                <div class="color-picker-wrapper" data-layer-id="${layer.id}" style="background-color: ${layer.color || definition.color}"></div>
                <button class="btn-small delete">×</button>
            </div>
        </div>
        <div class="layer-properties" id="props-${layer.id}"></div>
    `;

    // Attach event listeners
    row.querySelector('.delete').addEventListener('click', (e) => {
        e.stopPropagation();
        eventHandlers.onDeleteLayer(layer.id);
    });
    row.addEventListener('click', (e) => {
        if (!e.target.closest('.layer-link-handle, .layer-expand-arrow, .layer-actions, .property-input, .layer-properties, .align-btn')) {
            eventHandlers.onSelectLayer(layer);
        }
    });
    row.querySelector('.layer-expand-arrow').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleLayerProperties(layer.id, eventHandlers.onUpdateLayerProperties);
    });
    const dragHandle = row.querySelector('.layer-drag-handle');
    dragHandle.addEventListener('dragstart', (e) => eventHandlers.onDragStartLayer(e, row));
    dragHandle.addEventListener('dragend', () => row.classList.remove('dragging'));
    row.querySelector('.link-top').addEventListener('click', (e) => {
        e.stopPropagation();
        eventHandlers.onToggleLayerLink(index, index - 1);
    });
    row.querySelector('.link-bottom').addEventListener('click', (e) => {
        e.stopPropagation();
        eventHandlers.onToggleLayerLink(index, index + 1);
    });
    row.querySelector('.dim-toggle').addEventListener('click', (e) => {
        e.stopPropagation();
        eventHandlers.onToggleDimensions(layer.id);
    });

    // Initialize color picker for this layer
    initializeLayerColorPicker(row.querySelector('.color-picker-wrapper'), layer, eventHandlers);

    const fragment = document.createDocumentFragment();
    fragment.appendChild(dropZoneBefore);
    fragment.appendChild(row);

    if (index === state.layersList.length - 1) {
        const dropZoneAfter = createDropZone(state.layersList.length, eventHandlers.onDropInLayerList);
        fragment.appendChild(dropZoneAfter);
    }
    return fragment;
}

/**
 * Creates a drop zone element for reordering layers.
 * @param {number} index - The index where a dropped layer should be inserted.
 * @param {function} onDropHandler - The handler function for the drop event.
 * @returns {HTMLElement} The created drop zone element.
 */
function createDropZone(index, onDropHandler) {
    const dropZone = document.createElement('div');
    dropZone.className = 'layer-drop-zone';
    dropZone.dataset.insertIndex = index;
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });
    dropZone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        onDropHandler(e, index);
    });
    return dropZone;
}


// --- Properties Panel UI ---

/**
 * Toggles the visibility of a layer's properties panel and populates it if needed.
 * @param {string} layerId - The ID of the layer.
 * @param {function} onUpdate - The callback function to run when a property changes.
 */
export function toggleLayerProperties(layerId, onUpdate) {
    const propertiesDiv = getElement(`props-${layerId}`);
    const arrow = querySelector(`[data-layer-id="${layerId}"] .layer-expand-arrow`);
    if (!propertiesDiv || !arrow) return;

    // Toggle the expanded state in our state management
    if (state.expandedLayers.has(layerId)) {
        state.expandedLayers.delete(layerId);
    } else {
        state.expandedLayers.add(layerId);
    }
    
    const isExpanded = state.expandedLayers.has(layerId);
    propertiesDiv.classList.toggle('expanded', isExpanded);
    arrow.classList.toggle('expanded', isExpanded);

    if (isExpanded && propertiesDiv.children.length === 0) {
        const layer = state.layersList.find(l => l.id === layerId);
        const definition = LAYER_DEFINITIONS[layer.type];
        
        let textPropertiesHTML = '';
        if (definition.isText) {
            textPropertiesHTML = `
                <div class="property-group-header">Text Properties</div>
                <div class="property-group">
                    <label class="property-label">Font</label>
                    <select class="property-input prop-font">
                        ${generateFontOptions(layer.font || definition.defaultFont)}
                    </select>
                </div>
                <div class="property-group">
                    <label class="property-label">Font Size (pt)</label>
                    <input type="number" class="property-input prop-fontSize" value="${layer.fontSize || definition.defaultFontSize || 24}" min="8" max="144" step="0.001">
                </div>
                <div class="property-group">
                    <label class="property-label">X-Height (inches)</label>
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <input type="number" class="property-input prop-xHeight" step="0.001" min="0.1" placeholder="e.g. 0.625">
                        <button class="btn btn-compact btn-secondary apply-xheight" style="white-space: nowrap;">Apply</button>
                    </div>
                </div>
                <div class="property-group">
                    <label class="property-label">Horizontal Align</label>
                    <div class="alignment-buttons">
                        <button class="align-btn prop-textAlign" data-align="left" ${(layer.textAlign || definition.defaultTextAlign) === 'left' ? 'data-active="true"' : ''}>⬅</button>
                        <button class="align-btn prop-textAlign" data-align="center" ${(layer.textAlign || definition.defaultTextAlign) === 'center' ? 'data-active="true"' : ''}>⬄</button>
                        <button class="align-btn prop-textAlign" data-align="right" ${(layer.textAlign || definition.defaultTextAlign) === 'right' ? 'data-active="true"' : ''}>➡</button>
                    </div>
                </div>
                <div class="property-group">
                    <label class="property-label">Vertical Align</label>
                    <div class="alignment-buttons">
                        <button class="align-btn prop-verticalAlign" data-align="top" ${(layer.verticalAlign || definition.defaultVerticalAlign) === 'top' ? 'data-active="true"' : ''}>⬆</button>
                        <button class="align-btn prop-verticalAlign" data-align="middle" ${(layer.verticalAlign || definition.defaultVerticalAlign) === 'middle' ? 'data-active="true"' : ''}>⬍</button>
                        <button class="align-btn prop-verticalAlign" data-align="bottom" ${(layer.verticalAlign || definition.defaultVerticalAlign) === 'bottom' ? 'data-active="true"' : ''}>⬇</button>
                    </div>
                </div>
                <div class="property-group">
                    <label class="property-label">Line Spacing</label>
                    <input type="range" class="property-input prop-lineSpacing" value="${layer.lineSpacing || definition.defaultLineSpacing || 1.2}" min="0.8" max="3" step="0.1">
                    <span class="range-value">${layer.lineSpacing || definition.defaultLineSpacing || 1.2}</span>
                </div>
                <div class="property-group">
                    <label class="property-label">Kerning</label>
                    <input type="range" class="property-input prop-kerning" value="${layer.kerning || definition.defaultKerning || 0}" min="-50" max="50" step="1">
                    <span class="range-value">${layer.kerning || definition.defaultKerning || 0}</span>
                </div>
                <div class="property-group-header">Physical Properties</div>
            `;
        }
        
        // Non-text layers keep editable width/height
        let dimensionsHTML = '';
        if (!definition.isText) {
            dimensionsHTML = `
                <div class="property-group">
                    <label class="property-label">Width (inches)</label>
                    <input type="number" class="property-input prop-width" value="${layer.width}" step="0.125" min="0.125">
                </div>
                <div class="property-group">
                    <label class="property-label">Height (inches)</label>
                    <input type="number" class="property-input prop-height" value="${layer.height}" step="0.125" min="0.125">
                </div>
            `;
        }
        
        // Generate material options based on layer type
        let materialOptionsHTML = '';
        if (definition.isBraille) {
            // Special Braille material options
            materialOptionsHTML = `
                <option value="raised" ${layer.material === 'raised' ? 'selected' : ''}>Raised</option>
                <option value="raster plastic" ${layer.material === 'raster plastic' ? 'selected' : ''}>Raster Plastic</option>
                <option value="raster stainless steel" ${layer.material === 'raster stainless steel' ? 'selected' : ''}>Raster Stainless Steel</option>
                <option value="other" ${layer.material === 'other' ? 'selected' : ''}>Other</option>
            `;
        } else {
            // Standard material options
            materialOptionsHTML = `
                <option value="acrylic" ${layer.material === 'acrylic' ? 'selected' : ''}>Acrylic</option>
                <option value="aluminum" ${layer.material === 'aluminum' ? 'selected' : ''}>Aluminum</option>
                <option value="vinyl" ${layer.material === 'vinyl' ? 'selected' : ''}>Vinyl</option>
                <option value="wood" ${layer.material === 'wood' ? 'selected' : ''}>Wood</option>
                <option value="steel" ${layer.material === 'steel' ? 'selected' : ''}>Steel</option>
            `;
        }
        
        // Add Braille source text input for Braille layers
        let brailleTextHTML = '';
        if (definition.isBraille) {
            brailleTextHTML = `
                <div class="property-group">
                    <label class="property-label">Braille Text</label>
                    <input type="text" class="property-input prop-brailleSourceText" 
                           value="${layer.brailleSourceText || definition.defaultBrailleSourceText || ''}" 
                           placeholder="Enter text to translate to Braille">
                </div>
            `;
        }
        
        propertiesDiv.innerHTML = `
            <div class="property-group">
                <label class="property-label">Layer Name</label>
                <input type="text" class="property-input prop-name" value="${layer.name}">
            </div>
            ${brailleTextHTML}
            ${textPropertiesHTML}
            ${dimensionsHTML}
            <div class="property-group">
                <label class="property-label">Thickness (inches)</label>
                <input type="number" class="property-input prop-thickness" value="${layer.thickness}" step="0.0625" min="0.0625">
            </div>
            <div class="property-group">
                <label class="property-label">Material</label>
                <select class="property-input prop-material">
                    ${materialOptionsHTML}
                </select>
            </div>
        `;
        
        // Add event listeners for standard inputs
        propertiesDiv.querySelectorAll('.property-input').forEach(input => {
            if (!input.classList.contains('prop-textAlign') && !input.classList.contains('prop-verticalAlign')) {
                input.addEventListener('input', async (e) => {
                    // Handle font upload selection
                    if (input.classList.contains('prop-font') && input.value === '__upload__') {
                        const fileInput = document.createElement('input');
                        fileInput.type = 'file';
                        fileInput.accept = '.ttf,.otf,.woff,.woff2';
                        fileInput.multiple = true;
                        
                        fileInput.addEventListener('change', async (fileEvent) => {
                            if (fileEvent.target.files.length > 0) {
                                const results = await fontManager.uploadFonts(fileEvent.target.files);
                                
                                // Handle upload results
                                let successCount = 0;
                                let firstSuccessFont = null;
                                
                                results.forEach(result => {
                                    if (result.success) {
                                        successCount++;
                                        if (!firstSuccessFont) {
                                            firstSuccessFont = result.font.name;
                                        }
                                        console.log(`Font "${result.font.name}" uploaded successfully`);
                                    } else {
                                        console.error(`Failed to upload ${result.file}: ${result.error}`);
                                    }
                                });
                                
                                if (successCount > 0) {
                                    // Refresh the font dropdown
                                    const newOptions = generateFontOptions(firstSuccessFont);
                                    input.innerHTML = newOptions;
                                    input.value = firstSuccessFont;
                                    
                                    // Update the layer
                                    onUpdate(layerId);
                                } else {
                                    // Revert to previous selection if no fonts uploaded
                                    input.value = layer.font || definition.defaultFont || 'Arial';
                                }
                            } else {
                                // User cancelled, revert selection
                                input.value = layer.font || definition.defaultFont || 'Arial';
                            }
                        });
                        
                        fileInput.click();
                        return;
                    }
                    
                    onUpdate(layerId);
                    
                    // Update layer name in the layer list when changed
                    if (input.classList.contains('prop-name')) {
                        const layerRow = document.querySelector(`[data-layer-id="${layerId}"]`);
                        if (layerRow) {
                            const layerNameElement = layerRow.querySelector('.layer-name');
                            if (layerNameElement) {
                                layerNameElement.textContent = input.value;
                            }
                        }
                    }
                    
                    // Update X-height input when font size or font changes
                    if ((input.classList.contains('prop-fontSize') || input.classList.contains('prop-font'))) {
                        const xHeightInput = propertiesDiv.querySelector('.prop-xHeight');
                        if (xHeightInput) {
                            // Get updated values
                            const fontSizeInput = propertiesDiv.querySelector('.prop-fontSize');
                            const fontSelect = propertiesDiv.querySelector('.prop-font');
                            const fontSize = parseFloat(fontSizeInput?.value) || layer.fontSize || definition.defaultFontSize;
                            const fontFamily = fontSelect?.value || layer.font || definition.defaultFont;
                            
                            // Recalculate X-height and update input
                            import('./text-renderer.js').then(({ measureCapitalXHeight, SCALE_FACTOR }) => {
                                const xHeightPixels = measureCapitalXHeight(fontSize, fontFamily);
                                const xHeightInches = xHeightPixels / SCALE_FACTOR;
                                xHeightInput.value = xHeightInches.toFixed(3);
                            });
                        }
                    }
                    
                    // Update calculated dimensions for text layers
                    if (definition.isText && (input.classList.contains('prop-fontSize') || 
                        input.classList.contains('prop-font') || input.classList.contains('prop-lineSpacing'))) {
                        // Get current values
                        const fontSizeInput = propertiesDiv.querySelector('.prop-fontSize');
                        const fontSelect = propertiesDiv.querySelector('.prop-font');
                        const lineSpacingInput = propertiesDiv.querySelector('.prop-lineSpacing');
                        
                        const text = layer.text || definition.defaultText || '';
                        const fontSize = parseFloat(fontSizeInput?.value) || layer.fontSize || definition.defaultFontSize;
                        const fontFamily = fontSelect?.value || layer.font || definition.defaultFont;
                        const lineSpacing = parseFloat(lineSpacingInput?.value) || layer.lineSpacing || definition.defaultLineSpacing;
                        
                        // Recalculate dimensions
                        import('./text-renderer.js').then(({ calculateTextDimensions }) => {
                            const dims = calculateTextDimensions(text, fontFamily, fontSize, lineSpacing);
                            
                            const widthElement = propertiesDiv.querySelector('.calculated-width');
                            const heightElement = propertiesDiv.querySelector('.calculated-height');
                            if (widthElement) widthElement.textContent = `${dims.width.toFixed(3)}"`;
                            if (heightElement) heightElement.textContent = `${dims.height.toFixed(3)}"`;
                        });
                    }
                });
                
                // Add Enter key support for text inputs
                if (input.type === 'text' || input.type === 'number') {
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            input.blur(); // Trigger blur to save
                            onUpdate(layerId);
                        }
                    });
                }
            }
        });
        
        // Add event listeners for X-height control
        const xHeightInput = propertiesDiv.querySelector('.prop-xHeight');
        const applyXHeightBtn = propertiesDiv.querySelector('.apply-xheight');
        
        // Calculate and set initial X-height value
        if (xHeightInput) {
            import('./text-renderer.js').then(({ measureCapitalXHeight, SCALE_FACTOR }) => {
                const fontSize = layer.fontSize || definition.defaultFontSize;
                const fontFamily = layer.font || definition.defaultFont;
                const xHeightPixels = measureCapitalXHeight(fontSize, fontFamily);
                const xHeightInches = xHeightPixels / SCALE_FACTOR;
                xHeightInput.value = xHeightInches.toFixed(3);
            });
        }
        
        // Handle apply button click
        if (applyXHeightBtn && xHeightInput) {
            applyXHeightBtn.addEventListener('click', async () => {
                const desiredXHeight = parseFloat(xHeightInput.value);
                if (!desiredXHeight || desiredXHeight <= 0) return;
                
                const { calculateFontSizeForXHeight } = await import('./text-renderer.js');
                const newFontSize = calculateFontSizeForXHeight(desiredXHeight, layer.font || definition.defaultFont);
                
                // Update font size input
                const fontSizeInput = propertiesDiv.querySelector('.prop-fontSize');
                if (fontSizeInput) {
                    fontSizeInput.value = newFontSize;
                    onUpdate(layerId);
                }
            });
            
            // Allow Enter key to apply
            xHeightInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    applyXHeightBtn.click();
                }
            });
        }
        
        // Add event listeners for alignment buttons
        propertiesDiv.querySelectorAll('.align-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent the row click event from bubbling up
                const group = e.target.classList.contains('prop-textAlign') ? 'prop-textAlign' : 'prop-verticalAlign';
                propertiesDiv.querySelectorAll(`.${group}`).forEach(b => b.removeAttribute('data-active'));
                e.target.setAttribute('data-active', 'true');
                onUpdate(layerId);
            });
        });
        
        // Update range value displays
        propertiesDiv.querySelectorAll('input[type="range"]').forEach(range => {
            range.addEventListener('input', (e) => {
                const valueSpan = e.target.nextElementSibling;
                if (valueSpan && valueSpan.classList.contains('range-value')) {
                    valueSpan.textContent = e.target.value;
                }
            });
        });
        
    }
}

/**
 * Reads the current values from the properties panel for a given layer.
 * @param {string} layerId - The ID of the layer to read properties for.
 * @returns {object|null} An object with the updated properties, or null if not found.
 */
export function readLayerPropertiesFromUI(layerId) {
    const propsEl = getElement(`props-${layerId}`);
    if (!propsEl) return null;
    
    const layer = state.layersList.find(l => l.id === layerId);
    const definition = LAYER_DEFINITIONS[layer.type];
    
    let props = {
        name: propsEl.querySelector('.prop-name').value,
        thickness: parseFloat(propsEl.querySelector('.prop-thickness').value),
        material: propsEl.querySelector('.prop-material').value,
    };
    
    // Only read width/height for non-text layers
    const widthInput = propsEl.querySelector('.prop-width');
    const heightInput = propsEl.querySelector('.prop-height');
    if (widthInput && heightInput) {
        props.width = parseFloat(widthInput.value);
        props.height = parseFloat(heightInput.value);
    }
    
    // Add text properties if this is a text layer
    if (definition.isText) {
        const fontSelect = propsEl.querySelector('.prop-font');
        const fontSizeInput = propsEl.querySelector('.prop-fontSize');
        const lineSpacingInput = propsEl.querySelector('.prop-lineSpacing');
        const kerningInput = propsEl.querySelector('.prop-kerning');
        
        // Get active alignment buttons
        const activeTextAlign = propsEl.querySelector('.prop-textAlign[data-active="true"]');
        const activeVerticalAlign = propsEl.querySelector('.prop-verticalAlign[data-active="true"]');
        
        props.font = fontSelect ? fontSelect.value : layer.font;
        props.fontSize = fontSizeInput ? parseFloat(fontSizeInput.value) : layer.fontSize;
        props.textAlign = activeTextAlign ? activeTextAlign.dataset.align : layer.textAlign;
        props.verticalAlign = activeVerticalAlign ? activeVerticalAlign.dataset.align : layer.verticalAlign;
        props.lineSpacing = lineSpacingInput ? parseFloat(lineSpacingInput.value) : layer.lineSpacing;
        props.kerning = kerningInput ? parseFloat(kerningInput.value) : layer.kerning;
        // Note: textColor is handled by the color picker separately
        
        // Add Braille source text for Braille layers
        if (definition.isBraille) {
            const brailleInput = propsEl.querySelector('.prop-brailleSourceText');
            if (brailleInput) {
                props.brailleSourceText = brailleInput.value;
            }
        }
    }
    
    return props;
}


// --- General UI Updates ---

/**
 * Updates the visual state of layer links (connectors).
 */
export function updateLinkVisuals() {
    querySelectorAll('.link-top, .link-bottom').forEach(handle => {
        const index = parseInt(handle.dataset.index);
        const dir = handle.dataset.dir;
        const otherIndex = dir === 'up' ? index - 1 : index + 1;
        const isActive = state.layerLinks.some(link =>
            (link.from === index && link.to === otherIndex) ||
            (link.from === otherIndex && link.to === index)
        );
        handle.classList.toggle('active', isActive);
    });
}

/**
 * Updates the dimension display in the footer.
 */
export function updateDimensionsDisplay() {
    if (!dom.signDimensions) return;
    
    if (state.currentLayer) {
        dom.signDimensions.textContent = `${state.currentLayer.width.toFixed(2)}" × ${state.currentLayer.height.toFixed(2)}" × ${state.currentLayer.thickness.toFixed(3)}"`;
    } else {
        dom.signDimensions.textContent = "No layer selected";
    }
}

/**
 * Updates the visibility of all layers to reflect X-Ray mode.
 */
export function updateXrayMode() {
    if (!dom.xrayToggleBtn) return;
    
    dom.xrayToggleBtn.textContent = state.xrayMode ? 'X-RAY ON' : 'X-RAY OFF';
    dom.xrayToggleBtn.classList.toggle('active', state.xrayMode);
    // Canvas and 3D viewer updates will be handled in their respective modules
}

/**
 * Updates the shadow visibility of all layers.
 */
export function updateShadowMode() {
    if (!dom.shadowToggleBtn) return;
    
    dom.shadowToggleBtn.textContent = state.shadowMode ? 'SHADOW ON' : 'SHADOW OFF';
    dom.shadowToggleBtn.classList.toggle('active', state.shadowMode);
    // Canvas update will be handled in canvas.js
}

// --- Snap & Grid UI ---

/**
 * Sets up event listeners for the snap flyout panel.
 * @param {object} handlers - Event handler functions.
 */
export function setupSnapFlyout(handlers) {
    if (dom.snapButton) {
        dom.snapButton.addEventListener('click', (e) => {
            e.stopPropagation();
            updateState({ snapFlyoutOpen: !state.snapFlyoutOpen });
            if (dom.snapFlyout) {
                dom.snapFlyout.classList.toggle('show', state.snapFlyoutOpen);
            }
        });
    }
    
    document.addEventListener('click', (e) => {
        if (dom.snapButton && dom.snapFlyout && 
            !dom.snapButton.contains(e.target) && 
            !dom.snapFlyout.contains(e.target)) {
            updateState({ snapFlyoutOpen: false });
            dom.snapFlyout.classList.remove('show');
        }
    });
    
    if (dom.unitButtons) {
        dom.unitButtons.forEach(btn => {
            btn.addEventListener('click', () => handlers.onUnitChange(btn.dataset.unit));
        });
    }
    
    if (dom.gridToggleBtn) {
        dom.gridToggleBtn.addEventListener('click', handlers.onGridToggle);
    }
    
    if (dom.snapToggleSwitch) {
        dom.snapToggleSwitch.addEventListener('click', handlers.onSnapToggle);
    }
    
    if (dom.snapCustomInput) {
        dom.snapCustomInput.addEventListener('input', (e) => handlers.onCustomSnapInput(e.target.value));
    }
    
    updateSnapPresets(handlers.onPresetSnapChange);
}

/**
 * Re-populates the snap preset buttons based on the current unit.
 * @param {function} onPresetChange - The event handler for preset button clicks.
 */
export function updateSnapPresets(onPresetChange) {
    if (!dom.snapPresets) return;
    
    const presets = SNAP_PRESETS[state.snapUnit];
    dom.snapPresets.innerHTML = '';
    presets.forEach(preset => {
        const btn = document.createElement('button');
        btn.className = 'preset-btn';
        btn.textContent = preset.label;
        btn.addEventListener('click', () => onPresetChange(preset.value));
        dom.snapPresets.appendChild(btn);
    });
    updatePresetSelection();
}

/**
 * Updates the active state of preset buttons.
 */
export function updatePresetSelection() {
    querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    const presets = SNAP_PRESETS[state.snapUnit];
    const matchingPreset = presets.find(p => Math.abs(p.value - state.snapValue) < 0.001);
    if (matchingPreset) {
        const index = presets.indexOf(matchingPreset);
        const buttons = querySelectorAll('.preset-btn');
        if (buttons[index]) buttons[index].classList.add('active');
    }
}

/**
 * Clears the active state from all preset buttons.
 */
export function clearPresetSelection() {
    querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
}

/**
 * Updates the main snap button text and the toggle switch state.
 */
export function updateSnapDisplay() {
    if (!dom.snapButton) return;
    
    if (state.snapEnabled) {
        const displayValue = state.snapUnit === 'inches' ?
            formatInchesDisplay(state.snapValue) :
            `${state.snapValue}mm`;
        dom.snapButton.textContent = `SNAP: ${displayValue}`;
        dom.snapButton.classList.add('active');
    } else {
        dom.snapButton.textContent = 'SNAP OFF';
        dom.snapButton.classList.remove('active');
    }
    
    if (dom.snapToggleSwitch) {
        dom.snapToggleSwitch.classList.toggle('active', state.snapEnabled);
    }
}

// Alias for compatibility
export const updateSnapButton = updateSnapDisplay;

/**
 * Formats a decimal inch value into a fractional string where possible.
 * @param {number} value - The decimal value.
 * @returns {string} The formatted string.
 */
function formatInchesDisplay(value) {
    const fractions = {0.0625: '1/16"', 0.125: '1/8"', 0.25: '1/4"', 0.375: '3/8"', 0.5: '1/2"', 0.625: '5/8"', 0.75: '3/4"', 0.875: '7/8"', 1.0: '1"', 1.5: '1.5"', 2.0: '2"'};
    return fractions[value] || `${value}"`;
}

/**
 * Updates the grid toggle switch visual state.
 */
export function updateGridToggleVisual() {
    if (dom.gridToggleBtn) {
        dom.gridToggleBtn.classList.toggle('active', state.gridVisible);
        dom.gridToggleBtn.textContent = state.gridVisible ? 'GRID ON' : 'GRID OFF';
    }
}


// --- 3D Modal UI ---

/**
 * Sets up event listeners for the 3D modal.
 * @param {object} handlers - Event handler functions.
 */
export function setup3DModal(handlers) {
    // Ensure modal is hidden initially
    if (dom.modal3d) {
        dom.modal3d.style.display = 'none';
        dom.modal3d.classList.remove('show');
    }
    
    if (dom.view3dBtn) {
        dom.view3dBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handlers.onOpen3D();
        });
    }
    
    if (dom.close3dModalBtn) {
        dom.close3dModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handlers.onClose3D();
        });
    }
    
    if (dom.modal3d) {
        dom.modal3d.addEventListener('click', (e) => {
            if (e.target === dom.modal3d) {
                handlers.onClose3D();
            }
        });
    }
    
    document.addEventListener('keydown', (e) => {
        // Prevent Page Up/Page Down when editing text
        if ((e.key === 'PageUp' || e.key === 'PageDown') && state.editingLayerId) {
            e.preventDefault();
            return;
        }
        
        if (e.key === 'Escape') {
            // Close 3D modal if open
            if (state.isModalOpen) {
                handlers.onClose3D();
            }
            // Exit text editing if active
            else if (state.editingLayerId) {
                // Find the active contentEditable element and blur it
                const activeTextArea = document.querySelector('.paragraph-text-editor[contenteditable="true"]');
                if (activeTextArea) {
                    activeTextArea.blur();
                }
            }
        }
    });
}

/**
 * Shows the 3D modal and loading spinner.
 */
export function open3DModal() {
    if (dom.modal3d) {
        dom.modal3d.style.display = 'flex';
        dom.modal3d.classList.add('show');
    }
    if (dom.loadingSpinner) {
        dom.loadingSpinner.style.display = 'block';
    }
}

/**
 * Toggle the 3D modal visibility
 */
export function toggle3DModal(show) {
    if (show) {
        open3DModal();
    } else {
        close3DModal();
    }
}

/**
 * Hides the 3D modal.
 */
export function close3DModal() {
    if (dom.modal3d) {
        dom.modal3d.classList.remove('show');
        // Also set display to none after removing the class
        setTimeout(() => {
            if (dom.modal3d && !dom.modal3d.classList.contains('show')) {
                dom.modal3d.style.display = 'none';
            }
        }, 300); // Match CSS transition time
    }
}

/**
 * Hides the loading spinner in the 3D modal.
 */
export function hide3DLoadingSpinner() {
    if (dom.loadingSpinner) {
        dom.loadingSpinner.style.display = 'none';
    }
}

// --- Color Picker ---

/**
 * Initializes a Pickr color picker instance for a layer.
 * @param {HTMLElement} element - The color picker wrapper element.
 * @param {object} layer - The layer object.
 * @param {object} eventHandlers - Event handlers object.
 */
function initializeLayerColorPicker(element, layer, eventHandlers) {
    if (!element || !window.Pickr) return;
    
    const definition = LAYER_DEFINITIONS[layer.type];
    
    // For text layers, use text color; for others use layer color
    const currentColor = definition.isText 
        ? (layer.textColor || definition.defaultTextColor || '#000000')  // Text layers default to black text
        : (layer.color || definition.color);
    
    const pickr = Pickr.create({
        el: element,
        theme: 'classic',
        useAsButton: true,
        default: currentColor,
        components: {
            preview: true,
            opacity: false,
            hue: true,
            interaction: {
                hex: true,
                rgba: false,
                input: true,
                save: true,
                clear: false
            }
        }
    });
    
    // Update preview in real-time
    pickr.on('change', (color) => {
        element.style.backgroundColor = color.toHEXA().toString();
    });
    
    pickr.on('save', (color) => {
        if (color) {
            const hexColor = color.toHEXA().toString();
            
            // For text layers, save as textColor; for others as layer color
            if (definition.isText) {
                layer.textColor = hexColor;
            } else {
                layer.color = hexColor;
            }
            
            // Update the color picker background
            element.style.backgroundColor = hexColor;
            
            // Update layer row border color
            const layerRow = element.closest('.layer-row');
            if (layerRow) {
                layerRow.style.borderLeftColor = hexColor;
            }
            
            // Update canvas if layer is on canvas
            if (layer.onCanvas) {
                import('./canvas.js').then(Canvas => {
                    Canvas.updateCanvasLayer(layer);
                });
            }
            
            // Update stack visualization
            updateStackVisualization();
            
            // Hide the picker after save
            pickr.hide();
        }
    });
    
    // Store pickr instance for cleanup
    element._pickr = pickr;
}

// --- Side Profile Visualization ---

/**
 * Renders the side profile view of the layer stack.
 */
export function updateStackVisualization() {
    if (!dom.sideViewport) return;
    
    console.log('[Side View Debug] Starting updateStackVisualization');
    
    dom.sideViewport.querySelector('.stack-visualization')?.remove();
    
    const canvasLayers = state.layersList.filter(layer => layer.onCanvas);
    console.log('[Side View Debug] Canvas layers:', canvasLayers.length);
    
    const sideDropZone = dom.sideViewport.querySelector('.drop-zone');
    sideDropZone.style.display = canvasLayers.length > 0 ? 'none' : 'flex';
    if (canvasLayers.length === 0) return;

    const totalStackWidth = canvasLayers.reduce((sum, layer) => sum + (layer.thickness * SCALE_FACTOR * state.faceViewState.zoom), 0);
    const sideViewWidth = dom.sideViewport.parentElement.offsetWidth - 40;
    const startOffset = (sideViewWidth - totalStackWidth) / 2;
    
    const stackContainer = document.createElement('div');
    stackContainer.className = 'stack-visualization';
    stackContainer.style.position = 'relative';
    stackContainer.style.width = '100%';
    stackContainer.style.height = '100%';
    
    let leftOffset = startOffset;
    canvasLayers.forEach(layer => {
        const visualY = (layer.y * state.faceViewState.zoom) + state.faceViewState.y;
        const visualThickness = layer.thickness * SCALE_FACTOR * state.faceViewState.zoom;
        const definition = LAYER_DEFINITIONS[layer.type];
        
        if (definition.isText) {
            // For text layers, render X-height bars for each line
            console.log(`[Side View Debug] Processing text layer: "${layer.text}"`);
            
            const fontSize = layer.fontSize || definition.defaultFontSize || 24;
            const fontFamily = layer.font || definition.defaultFont || 'Arial';
            const lineSpacing = layer.lineSpacing || definition.defaultLineSpacing || 1.2;
            const text = layer.text || definition.defaultText || '';
            const font = `${fontSize}px "${fontFamily}"`;
            
            console.log(`[Side View Debug] Font: ${font}, Line spacing: ${lineSpacing}`);
            
            // Calculate X-height
            const xHeightPixels = measureCapitalXHeight(fontSize, fontFamily);
            const visualXHeight = xHeightPixels * state.faceViewState.zoom;
            
            console.log(`[Side View Debug] X-height: ${xHeightPixels}px, Visual X-height: ${visualXHeight}px`);
            
            // Get baseline metrics
            const baselineMetrics = getTextBaseline(text, font);
            const baselineFromTop = baselineMetrics.ascent; // Distance from top of text to baseline
            
            console.log(`[Side View Debug] Baseline from top: ${baselineFromTop}px`);
            
            // Use DOM-based measurement for consistent line wrapping
            // Create a hidden div with identical styles to the paragraph text editor
            const measureDiv = document.createElement('div');
            const containerHeight = layer.height * TEXT_SCALE_FACTOR;
            measureDiv.style.cssText = `
                position: absolute;
                visibility: hidden;
                width: ${layer.width * TEXT_SCALE_FACTOR}px;
                height: ${containerHeight}px;
                padding: 4px;
                box-sizing: border-box;
                font: ${font};
                line-height: ${lineSpacing};
                letter-spacing: ${(layer.kerning || 0) / 10}px;
                text-align: ${layer.textAlign || 'left'};
                white-space: pre-wrap;
                word-wrap: break-word;
                overflow: hidden;
            `;
            document.body.appendChild(measureDiv);
            
            // Set the text and let the browser calculate line breaks
            measureDiv.innerText = text;
            
            // Get line boxes using getClientRects()
            const textNode = measureDiv.firstChild;
            const lines = [];
            
            if (textNode && text.length > 0) {
                const range = document.createRange();
                range.selectNodeContents(textNode);
                
                // Get all client rects (line boxes)
                const rects = range.getClientRects();
                const measureDivRect = measureDiv.getBoundingClientRect();
                
                console.log(`[Side View Debug] Found ${rects.length} line boxes`);
                
                // Convert DOMRectList to array and process each line box
                const lineBoxes = Array.from(rects);
                
                // Group rects by Y position (handle cases where a line might have multiple rects)
                const lineMap = new Map();
                lineBoxes.forEach(rect => {
                    const lineY = Math.round(rect.top);
                    if (!lineMap.has(lineY)) {
                        lineMap.set(lineY, []);
                    }
                    lineMap.get(lineY).push(rect);
                });
                
                // Calculate which lines are visible within the container
                const containerTop = measureDivRect.top;
                const containerBottom = containerTop + containerHeight;
                const visibleLines = [];
                
                // Sort by Y position and check visibility
                const sortedLines = Array.from(lineMap.entries()).sort((a, b) => a[0] - b[0]);
                
                sortedLines.forEach(([lineY, lineRects]) => {
                    // Get the bottom of the line (approximate based on line height)
                    const lineBottom = lineY + (fontSize * lineSpacing);
                    
                    // Check if this line is at least partially visible
                    if (lineY < containerBottom && lineBottom > containerTop) {
                        visibleLines.push({ y: lineY, rects: lineRects });
                    }
                });
                
                console.log(`[Side View Debug] ${visibleLines.length} lines are visible within container`);
                
                // For each visible line, create a placeholder entry
                // We don't need the actual text content, just the count of visible lines
                visibleLines.forEach((line, index) => {
                    lines.push(`Line ${index + 1}`);
                });
            }
            
            // Clean up
            document.body.removeChild(measureDiv);
            
            console.log(`[Side View Debug] Max width for wrapping: ${layer.width * TEXT_SCALE_FACTOR}px (with padding)`);
            console.log(`[Side View Debug] Container height: ${containerHeight}px`);
            console.log(`[Side View Debug] Using DOM measurement with getClientRects()`);
            
            console.log(`[Side View Debug] Number of lines (with wrapping): ${lines.length}`);
            lines.forEach((line, i) => console.log(`[Side View Debug]   Line ${i+1}: "${line}"`));
            
            // Calculate line height (spacing between baselines)
            const lineHeight = fontSize * lineSpacing;
            const visualLineHeight = lineHeight * state.faceViewState.zoom;
                
            // Calculate where the text actually starts in the container
            let textStartY = 0;
            const totalTextHeight = lines.length * lineHeight;
            
            console.log(`[Side View Debug] Container height: ${containerHeight}px, Total text height: ${totalTextHeight}px`);
            
            if (definition.isParagraphText) {
                // Paragraph text has padding
                const padding = 10;
                
                if (layer.verticalAlign === 'top' || !layer.verticalAlign) {
                    textStartY = padding;
                } else if (layer.verticalAlign === 'middle') {
                    textStartY = (containerHeight - totalTextHeight) / 2;
                } else { // bottom
                    textStartY = containerHeight - totalTextHeight - padding;
                }
            } else {
                // Regular text layers
                if (layer.verticalAlign === 'top') {
                    textStartY = 0;
                } else if (layer.verticalAlign === 'middle' || !layer.verticalAlign) {
                    textStartY = (containerHeight - totalTextHeight) / 2;
                } else { // bottom
                    textStartY = containerHeight - totalTextHeight;
                }
            }
            
            console.log(`[Side View Debug] Text start Y: ${textStartY}px, Vertical align: ${layer.verticalAlign || 'default'}`);
            
            // Render each line as a bar aligned with its baseline
            lines.forEach((line, index) => {
                // Calculate baseline position for this line
                const lineTextTop = visualY + (textStartY * state.faceViewState.zoom) + (index * visualLineHeight);
                const baselineY = lineTextTop + (baselineFromTop * state.faceViewState.zoom);
                // Position bar so its bottom edge aligns with baseline
                const barTopY = baselineY - visualXHeight;
                
                console.log(`[Side View Debug] Line ${index + 1}:`);
                console.log(`  - Line text top: ${lineTextTop}px`);
                console.log(`  - Baseline Y: ${baselineY}px`);
                console.log(`  - Bar top Y: ${barTopY}px`);
                
                const lineElement = document.createElement('div');
                lineElement.className = 'stack-layer text-line';
                Object.assign(lineElement.style, {
                    position: 'absolute',
                    left: leftOffset + 'px',
                    top: barTopY + 'px',
                    width: visualThickness + 'px',
                    height: visualXHeight + 'px',
                    background: (layer.textColor || definition.defaultTextColor || '#000000') + (state.xrayMode ? '80' : 'FF'),
                    border: 'none'
                });
                stackContainer.appendChild(lineElement);
                console.log(`[Side View Debug] Created bar for line ${index + 1}`);
            });
        } else {
            // Non-text layers render as before
            const visualHeight = layer.height * SCALE_FACTOR * state.faceViewState.zoom;
            const layerElement = document.createElement('div');
            layerElement.className = 'stack-layer';
            Object.assign(layerElement.style, {
                position: 'absolute',
                left: leftOffset + 'px',
                top: visualY + 'px',
                width: visualThickness + 'px',
                height: visualHeight + 'px',
                background: (layer.color || definition.color) + (state.xrayMode ? '80' : 'FF'),
                border: 'none'
            });
            stackContainer.appendChild(layerElement);
        }
        
        leftOffset += visualThickness;
    });
    dom.sideViewport.appendChild(stackContainer);
    console.log('[Side View Debug] Stack visualization complete');
}

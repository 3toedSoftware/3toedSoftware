/**
 * ui.js
 * This module is responsible for all DOM manipulation and UI updates
 * that are not part of the 2D or 3D canvas rendering.
 */

import { state, updateState } from './state.js';
import { LAYER_DEFINITIONS, SNAP_PRESETS, SCALE_FACTOR } from './config.js';
import {
    measureCapitalXHeight,
    getTextBaseline,
    measureText,
    SCALE_FACTOR as TEXT_SCALE_FACTOR
} from './text-renderer.js';
import { fontManager } from './font-manager.js';
import { inchesToMm, mmToInches } from './units.js';

// --- DOM Element Selectors ---
const getElement = id => document.getElementById(id);
const querySelector = selector => document.querySelector(selector);
const querySelectorAll = selector => document.querySelectorAll(selector);

// --- Helper Functions ---


// Create a lazy-loaded DOM object that queries elements only when accessed
const dom = new Proxy(
    {},
    {
        get(target, prop) {
            if (target[prop]) return target[prop];

            // Define element mappings
            const elementMappings = {
                elementsList: () => getElement('elements-list'),
                elementTypeSelect: () => getElement('element-type-select'),
                addElementBtn: () => getElement('add-element-btn'),
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
                loadingSpinner: () => getElement('loading-spinner')
            };

            if (elementMappings[prop]) {
                target[prop] = elementMappings[prop]();
                return target[prop];
            }

            return null;
        }
    }
);

// --- Element List UI ---

/**
 * Re-renders the entire element list based on the current state.
 * @param {object} eventHandlers - An object containing event handler functions to attach to element rows.
 */
export function refreshElementList(eventHandlers) {
    if (!dom.elementsList) return;

    dom.elementsList.innerHTML = '';
    if (state.elementsList.length === 0) {
        dom.elementsList.innerHTML =
            '<div class="empty-state">Select an element type and click + to add your first element.</div>';
        return;
    }
    state.elementsList.forEach((element, index) => {
        const row = renderElementRow(element, index, eventHandlers);
        dom.elementsList.appendChild(row);

        // Restore expanded state if the element was previously expanded
        if (state.expandedElements.has(element.id)) {
            const propertiesDiv = getElement(`props-${element.id}`);
            const arrow = querySelector(`[data-element-id="${element.id}"] .element-expand-arrow`);
            if (propertiesDiv && arrow) {
                propertiesDiv.classList.add('expanded');
                arrow.classList.add('expanded');
                // Re-populate the properties if needed
                if (propertiesDiv.children.length === 0) {
                    toggleElementProperties(element.id, eventHandlers.onUpdateElementProperties);
                }
            }
        }
    });
    if (state.currentElement) {
        const selectedRow = querySelector(`[data-element-id="${state.currentElement.id}"]`);
        if (selectedRow) selectedRow.classList.add('selected');
    }
    updateLinkVisuals();
}

/**
 * Updates only the selection state of elements without refreshing the entire list
 */
export function updateElementSelection() {
    // Remove selected class from all rows
    querySelectorAll('.element-row').forEach(row => row.classList.remove('selected'));

    // Add selected class to current element
    if (state.currentElement) {
        const selectedRow = querySelector(`[data-element-id="${state.currentElement.id}"]`);
        if (selectedRow) selectedRow.classList.add('selected');
    }
}

/**
 * Creates and returns a DOM element for a single element row.
 * @param {object} element - The element object from state.
 * @param {number} index - The index of the element in the list.
 * @param {object} eventHandlers - Event handlers to attach.
 * @returns {HTMLElement} The created element row element.
 */
function renderElementRow(element, index, eventHandlers) {
    const definition = LAYER_DEFINITIONS[element.type];
    const dropZoneBefore = createDropZone(index, eventHandlers.onDropInElementList);

    const row = document.createElement('div');
    row.className = `element-row ${element.onCanvas ? '' : 'not-on-canvas'}`;
    row.dataset.elementId = element.id;
    row.style.borderLeftColor = element.color || definition.color;

    row.innerHTML = `
        <div class="element-header">
            <div class="element-drag-handle" draggable="true">⋮⋮</div>
            <div class="element-link-handle">
                <div class="link-top" data-index="${index}" data-dir="up"></div>
                <div class="link-bottom" data-index="${index}" data-dir="down"></div>
            </div>
            <div class="element-info">
                <div class="element-name">${element.name}</div>
            </div>
            <div class="element-actions">
                <button class="btn-icon dim-toggle ${element.showDimensions ? 'active' : ''}" title="Toggle Dimensions">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3H3C2.4 3 2 3.4 2 4V20C2 20.6 2.4 21 3 21H21C21.6 21 22 20.6 22 20V4C22 3.4 21.6 3 21 3Z"></path><path d="M10 3V21"></path><path d="M3 10H21"></path></svg>
                </button>
                <div class="color-picker-wrapper" data-element-id="${element.id}" style="background-color: ${element.color || definition.color}"></div>
                <button class="btn-small delete" title="Delete Element" style="background: #dc3545; color: white; border: none; padding: 2px 8px; border-radius: 3px; cursor: pointer;">×</button>
            </div>
        </div>
    `;

    // Attach event listeners
    row.querySelector('.delete').addEventListener('click', e => {
        e.stopPropagation();
        eventHandlers.onDeleteElement(element.id);
    });
    row.addEventListener('click', e => {
        if (!e.target.closest('.element-link-handle, .element-actions')) {
            // Click on selected element deselects it, otherwise select
            if (state.currentElement && state.currentElement.id === element.id) {
                eventHandlers.onSelectElement(null); // Deselect
            } else {
                eventHandlers.onSelectElement(element); // Select
            }
        }
    });
    const dragHandle = row.querySelector('.element-drag-handle');
    dragHandle.addEventListener('dragstart', e => eventHandlers.onDragStartElement(e, row));
    dragHandle.addEventListener('dragend', () => row.classList.remove('dragging'));
    row.querySelector('.link-top').addEventListener('click', e => {
        e.stopPropagation();
        eventHandlers.onToggleElementLink(index, index - 1);
    });
    row.querySelector('.link-bottom').addEventListener('click', e => {
        e.stopPropagation();
        eventHandlers.onToggleElementLink(index, index + 1);
    });
    row.querySelector('.dim-toggle').addEventListener('click', e => {
        e.stopPropagation();
        eventHandlers.onToggleDimensions(element.id);
    });

    // Initialize color picker for this element
    initializeElementColorPicker(
        row.querySelector('.color-picker-wrapper'),
        element,
        eventHandlers
    );

    const fragment = document.createDocumentFragment();
    fragment.appendChild(dropZoneBefore);
    fragment.appendChild(row);

    if (index === state.elementsList.length - 1) {
        const dropZoneAfter = createDropZone(
            state.elementsList.length,
            eventHandlers.onDropInElementList
        );
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
    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });
    dropZone.addEventListener('dragenter', e => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        onDropHandler(e, index);
    });
    return dropZone;
}

// --- Properties Panel UI --- (REMOVED - Using modal instead)

/**
 * DEPRECATED - Properties are now handled through the right-click modal
 * @deprecated Use the element modal instead
 */
export function toggleElementProperties(elementId, onUpdate) {
    // Function kept for compatibility but does nothing
    // Properties are now handled through the right-click modal
    return;
}

/**
 * DEPRECATED - Reads element properties from UI
 * @deprecated Use the element modal instead
 */
export function readElementPropertiesFromUI(elementId) {
    // Properties are now handled through the modal
    return null;
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
        const isActive = state.elementLinks.some(
            link =>
                (link.from === index && link.to === otherIndex) ||
                (link.from === otherIndex && link.to === index)
        );
        handle.classList.toggle('active', isActive);
    });
}

/**
 * Updates the dimension display in the footer.
 * Note: Dimension display removed from UI
 */
export function updateDimensionsDisplay() {
    // Dimension display removed from UI
    return;
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
    // SVG update will be handled in design-svg.js
}

// --- Snap & Grid UI ---

/**
 * Sets up event listeners for the snap flyout panel.
 * @param {object} handlers - Event handler functions.
 */
export function setupSnapFlyout(handlers) {
    if (dom.snapButton) {
        dom.snapButton.addEventListener('click', e => {
            e.stopPropagation();
            updateState({ snapFlyoutOpen: !state.snapFlyoutOpen });
            if (dom.snapFlyout) {
                dom.snapFlyout.classList.toggle('show', state.snapFlyoutOpen);
            }
        });
    }

    document.addEventListener('click', e => {
        if (
            dom.snapButton &&
            dom.snapFlyout &&
            !dom.snapButton.contains(e.target) &&
            !dom.snapFlyout.contains(e.target)
        ) {
            updateState({ snapFlyoutOpen: false });
            dom.snapFlyout.classList.remove('show');
        }
    });

    if (dom.unitButtons) {
        dom.unitButtons.forEach(btn => {
            btn.addEventListener('click', () => handlers.onUnitChange(btn.dataset.unit));
        });
    }

    const rulerToggleBtn = document.getElementById('ruler-toggle-btn');
    if (rulerToggleBtn) {
        rulerToggleBtn.addEventListener('click', handlers.onRulerToggle);
    }

    if (dom.gridToggleBtn) {
        dom.gridToggleBtn.addEventListener('click', handlers.onGridToggle);
    }

    if (dom.snapToggleSwitch) {
        dom.snapToggleSwitch.addEventListener('click', handlers.onSnapToggle);
    }

    if (dom.snapCustomInput) {
        dom.snapCustomInput.addEventListener('input', e =>
            handlers.onCustomSnapInput(e.target.value)
        );
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
        const displayValue =
            state.snapUnit === 'inches'
                ? formatInchesDisplay(state.snapValue)
                : `${state.snapValue}mm`;
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
    const fractions = {
        0.0625: '1/16"',
        0.125: '1/8"',
        0.25: '1/4"',
        0.375: '3/8"',
        0.5: '1/2"',
        0.625: '5/8"',
        0.75: '3/4"',
        0.875: '7/8"',
        1.0: '1"',
        1.5: '1.5"',
        2.0: '2"'
    };
    return fractions[value] || `${value}"`;
}

/**
 * Updates the grid toggle switch visual state.
 * Note: Grid button removed from UI
 */
export function updateGridToggleVisual() {
    // Grid button removed from UI
    return;
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
        dom.view3dBtn.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            handlers.onOpen3D();
        });
    }

    if (dom.close3dModalBtn) {
        dom.close3dModalBtn.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            handlers.onClose3D();
        });
    }

    if (dom.modal3d) {
        dom.modal3d.addEventListener('click', e => {
            if (e.target === dom.modal3d) {
                handlers.onClose3D();
            }
        });
    }

    document.addEventListener('keydown', e => {
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
                const activeTextArea = document.querySelector(
                    '.paragraph-text-editor[contenteditable="true"]'
                );
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
 * Initializes a Pickr color picker instance for a element.
 * @param {HTMLElement} element - The color picker wrapper element.
 * @param {object} layer - The layer object.
 * @param {object} eventHandlers - Event handlers object.
 */
function initializeElementColorPicker(container, element, eventHandlers) {
    if (!container || !window.Pickr) return;

    const definition = LAYER_DEFINITIONS[element.type];

    // For text elements, use text color; for others use element color
    const currentColor = definition.isText
        ? element.textColor || definition.defaultTextColor || '#000000' // Text elements default to black text
        : element.color || definition.color;

    const pickr = Pickr.create({
        el: container,
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
    pickr.on('change', color => {
        container.style.backgroundColor = color.toHEXA().toString();
    });

    pickr.on('save', color => {
        if (color) {
            const hexColor = color.toHEXA().toString();

            // For text elements, save as textColor; for others as element color
            if (definition.isText) {
                element.textColor = hexColor;
            } else {
                element.color = hexColor;
            }

            // Update the color picker background
            container.style.backgroundColor = hexColor;

            // Update element row border color
            const elementRow = container.closest('.element-item');
            if (elementRow) {
                elementRow.style.borderLeftColor = hexColor;
            }

            // Update SVG if element is on canvas
            if (element.onCanvas) {
                import('./design-svg.js').then(({ designSVG }) => {
                    designSVG.updateElement(element);
                });
            }

            // Update stack visualization
            updateStackVisualization();

            // Hide the picker after save
            pickr.hide();
        }
    });

    // Store pickr instance for cleanup
    container._pickr = pickr;
}

// --- Side Profile Visualization ---

/**
 * Renders the side profile view of the layer stack.
 */
export function updateStackVisualization() {
    if (!dom.sideViewport) return;

    dom.sideViewport.querySelector('.stack-visualization')?.remove();

    const canvasLayers = state.elementsList.filter(element => element.onCanvas);

    if (canvasLayers.length === 0) return;

    // Group layers by depth number
    const layersByDepth = new Map();
    canvasLayers.forEach(element => {
        const depth = element.elementDepth || 1;
        if (!layersByDepth.has(depth)) {
            layersByDepth.set(depth, []);
        }
        layersByDepth.get(depth).push(element);
    });

    // Sort depth groups by depth number
    const sortedDepthGroups = Array.from(layersByDepth.entries()).sort((a, b) => a[0] - b[0]);

    // Calculate total stack width using maximum thickness per depth group
    const totalStackWidth = sortedDepthGroups.reduce((sum, [depth, layers]) => {
        const maxThickness = Math.max(...layers.map(element => element.thickness));
        return sum + maxThickness * SCALE_FACTOR * state.faceViewState.zoom;
    }, 0);

    const sideViewWidth = dom.sideViewport.parentElement.offsetWidth - 40;
    const startOffset = (sideViewWidth - totalStackWidth) / 2;

    const stackContainer = document.createElement('div');
    stackContainer.className = 'stack-visualization';
    stackContainer.style.position = 'relative';
    stackContainer.style.width = '100%';
    stackContainer.style.height = '100%';

    let leftOffset = startOffset;

    // Process each depth group
    sortedDepthGroups.forEach(([depth, layersInGroup]) => {
        // Use maximum thickness for this depth group
        const maxThickness = Math.max(...layersInGroup.map(element => element.thickness));
        const visualThickness = maxThickness * SCALE_FACTOR * state.faceViewState.zoom;

        // Process all layers in this depth group
        layersInGroup.forEach(element => {
            // Convert world coordinates (inches) to pixels, then apply zoom
            const visualY =
                element.y * SCALE_FACTOR * state.faceViewState.zoom + state.faceViewState.y;
            const definition = LAYER_DEFINITIONS[element.type];

            if (definition.isText) {
                // For text layers, render X-height bars for each line

                const fontSize = element.fontSize || definition.defaultFontSize || 24;
                const fontFamily = element.font || definition.defaultFont || 'Arial';
                const lineSpacing = element.lineSpacing || definition.defaultLineSpacing || 1.2;
                const text = element.text || definition.defaultText || '';
                const font = `${fontSize}px "${fontFamily}"`;

                // Calculate X-height
                const xHeightPixels = measureCapitalXHeight(fontSize, fontFamily);
                const visualXHeight = xHeightPixels * state.faceViewState.zoom;

                // Get baseline metrics
                const baselineMetrics = getTextBaseline(text, font);
                const baselineFromTop = baselineMetrics.ascent; // Distance from top of text to baseline

                // Use DOM-based measurement for consistent line wrapping
                // Create a hidden div with identical styles to the paragraph text editor
                const measureDiv = document.createElement('div');
                const containerHeight = element.height * TEXT_SCALE_FACTOR;
                measureDiv.style.cssText = `
                position: absolute;
                visibility: hidden;
                width: ${element.width * TEXT_SCALE_FACTOR}px;
                height: ${containerHeight}px;
                padding: 4px;
                box-sizing: border-box;
                font: ${font};
                line-height: ${lineSpacing};
                letter-spacing: ${(element.kerning || 0) / 10}px;
                text-align: ${element.textAlign || 'left'};
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
                        const lineBottom = lineY + fontSize * lineSpacing;

                        // Check if this line is at least partially visible
                        if (lineY < containerBottom && lineBottom > containerTop) {
                            visibleLines.push({ y: lineY, rects: lineRects });
                        }
                    });

                    // For each visible line, create a placeholder entry
                    // We don't need the actual text content, just the count of visible lines
                    visibleLines.forEach((line, index) => {
                        lines.push(`Line ${index + 1}`);
                    });
                }

                // Clean up
                document.body.removeChild(measureDiv);

                // Calculate line height (spacing between baselines)
                const lineHeight = fontSize * lineSpacing;
                const visualLineHeight = lineHeight * state.faceViewState.zoom;

                // Calculate where the text actually starts in the container
                let textStartY = 0;
                const totalTextHeight = lines.length * lineHeight;

                if (definition.isParagraphText) {
                    // Paragraph text has padding
                    const padding = 10;

                    if (element.verticalAlign === 'top' || !element.verticalAlign) {
                        textStartY = padding;
                    } else if (element.verticalAlign === 'middle') {
                        textStartY = (containerHeight - totalTextHeight) / 2;
                    } else {
                        // bottom
                        textStartY = containerHeight - totalTextHeight - padding;
                    }
                } else {
                    // Regular text layers
                    if (element.verticalAlign === 'top') {
                        textStartY = 0;
                    } else if (element.verticalAlign === 'middle' || !element.verticalAlign) {
                        textStartY = (containerHeight - totalTextHeight) / 2;
                    } else {
                        // bottom
                        textStartY = containerHeight - totalTextHeight;
                    }
                }

                // Render each line as a bar aligned with its baseline
                lines.forEach((line, index) => {
                    // Calculate baseline position for this line
                    const lineTextTop =
                        visualY + textStartY * state.faceViewState.zoom + index * visualLineHeight;
                    const baselineY = lineTextTop + baselineFromTop * state.faceViewState.zoom;
                    // Position bar so its bottom edge aligns with baseline
                    const barTopY = baselineY - visualXHeight;

                    const lineElement = document.createElement('div');
                    lineElement.className = 'stack-layer text-line';
                    Object.assign(lineElement.style, {
                        position: 'absolute',
                        left: leftOffset + 'px',
                        top: barTopY + 'px',
                        width: visualThickness + 'px',
                        height: visualXHeight + 'px',
                        background:
                            (element.textColor || definition.defaultTextColor || '#000000') +
                            (state.xrayMode ? '80' : 'FF'),
                        border: 'none'
                    });
                    stackContainer.appendChild(lineElement);
                });
            } else {
                // Non-text layers render as before
                const visualHeight = element.height * SCALE_FACTOR * state.faceViewState.zoom;
                const layerElement = document.createElement('div');
                layerElement.className = 'stack-layer';
                Object.assign(layerElement.style, {
                    position: 'absolute',
                    left: leftOffset + 'px',
                    top: visualY + 'px',
                    width: visualThickness + 'px',
                    height: visualHeight + 'px',
                    background:
                        (element.color || definition.color) + (state.xrayMode ? '80' : 'FF'),
                    border: 'none'
                });
                stackContainer.appendChild(layerElement);
            }
        });

        // Move to next depth group position
        leftOffset += visualThickness;
    });

    dom.sideViewport.appendChild(stackContainer);
}

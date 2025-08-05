/**
 * canvas.js
 * This module handles all logic for the 2D design canvas, including
 * rendering layers, pan, zoom, grid, and interactions.
 */

import { state, updateState, getLinkedGroup } from './state.js';
import { LAYER_DEFINITIONS, SCALE_FACTOR, GRID_LEVELS } from './config.js';
import { updateStackVisualization } from './ui.js';
import { renderAlignedText, getTextBaseline } from './text-renderer.js';
import { translateToGrade2Braille } from './braille-translator-v2.js';

// --- DOM Element Selectors ---
const getElement = (id) => document.getElementById(id);
const querySelector = (selector) => document.querySelector(selector);

// Lazy-loaded DOM references
const dom = new Proxy({}, {
    get(target, prop) {
        if (target[prop]) return target[prop];
        
        const elementMappings = {
            faceCanvas: () => getElement('face-canvas'),
            sideCanvas: () => getElement('side-canvas'),
            faceViewport: () => getElement('face-viewport'),
            dimensionsContainer: () => getElement('dimensions-container'),
        };
        
        if (elementMappings[prop]) {
            target[prop] = elementMappings[prop]();
            return target[prop];
        }
        
        return null;
    }
});

// --- Main Setup ---

/**
 * Initializes all event listeners for the 2D canvas areas.
 * @param {object} handlers - A collection of event handler functions from main.js.
 */
export function setupCanvas(handlers) {
    // Ensure DOM is ready
    if (!dom.faceCanvas || !dom.sideCanvas) {
        console.error('Canvas elements not found in DOM');
        return;
    }
    
    // Pan and Zoom listeners
    dom.faceCanvas.addEventListener('wheel', (e) => handleZoom(e, handlers.onViewportChange));
    dom.faceCanvas.addEventListener('mousedown', (e) => {
        if (e.button === 1) { // Middle mouse button
            e.preventDefault();
            startPan(e, handlers.onViewportChange);
        }
    });
    dom.faceCanvas.addEventListener('mousemove', (e) => handlePan(e, handlers.onViewportChange));
    dom.faceCanvas.addEventListener('mouseup', (e) => {
        if (e.button === 1) stopPan();
    });
    dom.faceCanvas.addEventListener('mouseleave', stopPan);
    dom.faceCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Deselect layer listener
    dom.faceCanvas.addEventListener('click', (e) => {
        if (e.target.id === 'face-canvas' || e.target.classList.contains('canvas-viewport')) {
            handlers.onSelectLayer(null);
        }
    });

    // Drag and Drop listeners
    [dom.faceCanvas, dom.sideCanvas].forEach(canvas => {
        if (canvas) {
            canvas.addEventListener('dragover', handleDragOver);
            canvas.addEventListener('dragenter', (e) => handleDragEnter(e, canvas));
            canvas.addEventListener('dragleave', (e) => handleDragLeave(e, canvas));
            canvas.addEventListener('drop', (e) => handlers.onDropOnCanvas(e, canvas));
        }
    });
}


// --- Canvas Rendering ---

/**
 * Creates a new DOM element for a layer on the canvas.
 * @param {object} layer - The layer object to create.
 * @param {function} onSelectLayer - Callback for when the layer is selected.
 * @param {function} onStartDrag - Callback for when dragging starts.
 */
export function createCanvasLayer(layer, onSelectLayer, onStartDrag) {
    if (!dom.faceViewport) return;
    
    if (getCanvasLayersCount() >= 1) {
        const dropZone = dom.faceViewport.querySelector('.drop-zone');
        if (dropZone) dropZone.style.display = 'none';
    }
    const signLayerElement = document.createElement('div');
    signLayerElement.className = 'sign-layer';
    signLayerElement.id = layer.id + '-canvas';
    signLayerElement.setAttribute('data-layer-type', layer.type);
    
    signLayerElement.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log(`[Position Debug] Layer clicked:`, layer.id);
        const beforeSelect = signLayerElement.getBoundingClientRect();
        console.log(`[Position Debug] Position before select:`, {
            left: beforeSelect.left,
            top: beforeSelect.top
        });
        onSelectLayer(layer);
    });
    signLayerElement.addEventListener('mousedown', (e) => {
        // Don't start dragging if we're in edit mode for this layer
        if (e.button === 0 && state.editingLayerId !== layer.id) {
            onStartDrag(e, layer);
        }
    });

    dom.faceViewport.appendChild(signLayerElement);
    updateCanvasLayer(layer);
}

/**
 * Updates an existing layer's element on the canvas with its current properties.
 * @param {object} layer - The layer object to update.
 */
export function updateCanvasLayer(layer) {
    const signLayerElement = getElement(layer.id + '-canvas');
    if (signLayerElement) {
        const definition = LAYER_DEFINITIONS[layer.type];
        
        // Debug: Log position before update
        const beforeRect = signLayerElement.getBoundingClientRect();
        console.log(`[Position Debug] Before update - Layer ${layer.id}:`, {
            left: beforeRect.left,
            top: beforeRect.top,
            width: beforeRect.width,
            height: beforeRect.height,
            isSelected: state.currentLayer && state.currentLayer.id === layer.id
        });
        
        Object.assign(signLayerElement.style, {
            left: layer.x + 'px',
            top: layer.y + 'px',
            width: (layer.width * SCALE_FACTOR) + 'px',
            height: (layer.height * SCALE_FACTOR) + 'px',
            background: definition.isText ? 'transparent' : (layer.color || definition.color) + (state.xrayMode ? '80' : 'FF'),
            border: 'none',
            boxShadow: state.shadowMode && !definition.isText ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
            zIndex: layer.zIndex,
        });
        
        // Handle text layers
        if (definition.isText) {
            // Check if this is a paragraph text layer
            if (definition.isParagraphText) {
                renderParagraphText(signLayerElement, layer, definition);
                
                // Add resize handles if selected
                if (state.currentLayer && state.currentLayer.id === layer.id) {
                    addResizeHandles(signLayerElement, layer);
                }
            } else {
                renderTextContent(signLayerElement, layer, definition);
                
                // Add resize handles for Braille layers when selected
                if (definition.isBraille && state.currentLayer && state.currentLayer.id === layer.id) {
                    addResizeHandles(signLayerElement, layer);
                }
            }
            
            // Debug: Log position after text render
            setTimeout(() => {
                const afterRect = signLayerElement.getBoundingClientRect();
                console.log(`[Position Debug] After text render - Layer ${layer.id}:`, {
                    left: afterRect.left,
                    top: afterRect.top,
                    width: afterRect.width,
                    height: afterRect.height,
                    leftShift: afterRect.left - beforeRect.left,
                    topShift: afterRect.top - beforeRect.top
                });
            }, 0);
            
            // Add or remove ADA height guide based on checkbox state
            const existingGuide = signLayerElement.querySelector('.ada-height-guide');
            
            if (layer.showAdaGuide) {
                // Always re-render to update position when text properties change
                if (existingGuide) {
                    existingGuide.remove();
                }
                renderAdaHeightGuide(signLayerElement, layer);
            } else if (existingGuide) {
                existingGuide.remove();
            }
        } else {
            // Clear any text content for non-text layers
            signLayerElement.innerHTML = '';
        }
    }
}

/**
 * Renders ADA height guide box aligned to text baseline
 * @param {HTMLElement} element - The layer DOM element
 * @param {object} layer - The layer data
 */
function renderAdaHeightGuide(element, layer) {
    // Create guide box
    const guide = document.createElement('div');
    guide.className = 'ada-height-guide';
    
    // Calculate guide height (0.625 inches)
    const guideHeight = 0.625 * SCALE_FACTOR;
    
    // Get layer properties
    const definition = LAYER_DEFINITIONS[layer.type];
    const fontSize = layer.fontSize || definition.defaultFontSize || 24;
    const font = `${fontSize}px "${layer.font || definition.defaultFont || 'Arial'}"`;
    
    // Get exact baseline position using canvas measurement
    const baselineMetrics = getTextBaseline(layer.text || definition.defaultText || '', font);
    const baselineFromTop = baselineMetrics.ascent; // Distance from top of text to baseline
    
    // Calculate where the text actually starts in the container
    let textStartY = 0;
    const containerHeight = layer.height * SCALE_FACTOR;
    
    if (definition.isParagraphText) {
        // Paragraph text has padding and flex container
        const padding = 5;
        
        // For paragraph text with flex container
        // We need to calculate based on how the flex container positions the text
        if (layer.verticalAlign === 'top' || !layer.verticalAlign) {
            textStartY = padding;
        } else if (layer.verticalAlign === 'middle') {
            // For middle alignment, the text editor's actual height matters
            // Use a reasonable estimate for single-line text
            const lineHeight = fontSize * (layer.lineSpacing || 1.2);
            textStartY = (containerHeight - lineHeight) / 2;
        } else { // bottom
            // For bottom alignment, need to account for text height
            const lineHeight = fontSize * (layer.lineSpacing || 1.2);
            textStartY = containerHeight - lineHeight - padding;
        }
    } else {
        // Regular text layers use the text-wrapper positioning
        // Look for the text wrapper to get its actual position
        const textWrapper = element.querySelector('.text-wrapper');
        if (textWrapper) {
            const wrapperTop = parseInt(textWrapper.style.top) || 0;
            textStartY = wrapperTop;
        } else {
            // Fallback calculation if wrapper not found
            const lineHeight = fontSize * (layer.lineSpacing || definition.defaultLineSpacing || 1.2);
            
            if (layer.verticalAlign === 'top') {
                textStartY = 0;
            } else if (layer.verticalAlign === 'middle') {
                textStartY = (containerHeight - lineHeight) / 2;
            } else { // bottom
                textStartY = containerHeight - lineHeight;
            }
        }
    }
    
    // Position guide so its bottom edge aligns with the baseline
    // Baseline position = textStartY + baselineFromTop
    // Guide top = baseline - guideHeight
    const baselineY = textStartY + baselineFromTop;
    const guideTop = baselineY - guideHeight;
    
    guide.style.cssText = `
        position: absolute;
        left: 0;
        right: 0;
        top: ${Math.max(0, guideTop)}px;
        height: ${guideHeight}px;
        background: rgba(255, 100, 100, 0.2);
        border: 1px dashed #ff6464;
        pointer-events: none;
        z-index: 1; /* Behind text */
    `;
    
    // Insert guide as first child so it's behind text
    element.insertBefore(guide, element.firstChild);
}

/**
 * Renders paragraph text with editable functionality
 * @param {HTMLElement} element - The layer DOM element
 * @param {object} layer - The layer data
 * @param {object} definition - The layer type definition
 */
function renderParagraphText(element, layer, definition) {
    // Remove any existing content
    element.innerHTML = '';
    
    console.log(`[Position Debug] renderParagraphText called for layer ${layer.id}`);
    
    // Create editable text area without container
    const textArea = document.createElement('div');
    textArea.className = 'paragraph-text-editor';
    textArea.contentEditable = false; // Will be made editable on click
    
    // Calculate position based on vertical alignment
    let topPosition = '0';
    if (layer.verticalAlign === 'middle' || layer.verticalAlign === 'center') {
        topPosition = '50%';
    } else if (layer.verticalAlign === 'bottom') {
        topPosition = 'auto';
    }
    
    textArea.style.cssText = `
        position: absolute;
        left: 0;
        right: 0;
        top: ${topPosition};
        ${layer.verticalAlign === 'bottom' ? 'bottom: 0;' : ''}
        ${layer.verticalAlign === 'middle' || layer.verticalAlign === 'center' ? 'transform: translateY(-50%);' : ''}
        padding: 4px;
        margin: 0;
        box-sizing: border-box;
        outline: none;
        cursor: text;
        overflow: hidden;
        font: ${layer.fontSize || definition.defaultFontSize}px "${layer.font || definition.defaultFont}";
        color: ${layer.textColor || definition.defaultTextColor || '#000000'};
        line-height: ${layer.lineSpacing || definition.defaultLineSpacing || 1.2};
        letter-spacing: ${(layer.kerning || 0) / 10}px;
        text-align: ${layer.textAlign || 'left'};
    `;
    
    // Set initial text
    textArea.innerText = layer.text || definition.defaultText || '';
    
    // Add edit functionality
    textArea.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        enterEditMode(textArea, layer);
    });
    
    textArea.addEventListener('blur', () => {
        exitEditMode(textArea, layer);
    });
    
    textArea.addEventListener('input', () => {
        // Update layer text as user types
        layer.text = textArea.innerText;
        updateState({ layersList: [...state.layersList] });
        
        // Check for text overflow after input
        checkTextOverflow(element, textArea);
    });
    
    // Ensure Delete key and other text editing keys work properly
    textArea.addEventListener('keydown', (e) => {
        // Allow all text editing keys when contentEditable is true
        if (textArea.contentEditable === 'true') {
            // Stop propagation to prevent any parent handlers from interfering
            e.stopPropagation();
        }
    });
    
    element.appendChild(textArea);
    
    // Debug: Log text area computed styles after append
    setTimeout(() => {
        console.log(`[Position Debug] TextArea computed styles:`, {
            padding: window.getComputedStyle(textArea).padding,
            margin: window.getComputedStyle(textArea).margin,
            boxSizing: window.getComputedStyle(textArea).boxSizing,
            position: window.getComputedStyle(textArea).position,
            top: window.getComputedStyle(textArea).top,
            left: window.getComputedStyle(textArea).left
        });
        
        // Check for overflow on initial render
        checkTextOverflow(element, textArea);
    }, 0);
}

/**
 * Checks if text overflows its container and adds visual indicator
 * @param {HTMLElement} signLayerElement - The sign layer element
 * @param {HTMLElement} textArea - The text area element
 */
function checkTextOverflow(signLayerElement, textArea) {
    // Check if text overflows vertically or horizontally
    const hasOverflow = textArea.scrollHeight > textArea.clientHeight || 
                       textArea.scrollWidth > textArea.clientWidth;
    
    if (hasOverflow) {
        signLayerElement.classList.add('text-overflow');
    } else {
        signLayerElement.classList.remove('text-overflow');
    }
}

/**
 * Adds resize handles to a paragraph text layer
 * @param {HTMLElement} element - The layer DOM element
 * @param {object} layer - The layer data
 */
function addResizeHandles(element, layer) {
    // Remove existing handles
    element.querySelectorAll('.resize-handle').forEach(h => h.remove());
    
    // Define handle positions - simplified since CSS handles positioning
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    
    handles.forEach(handleClass => {
        const handleEl = document.createElement('div');
        handleEl.className = `resize-handle resize-handle-${handleClass}`;
        
        handleEl.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            startResize(e, layer, handleClass);
        });
        
        element.appendChild(handleEl);
    });
}

/**
 * Enters edit mode for paragraph text
 */
function enterEditMode(textArea, layer) {
    textArea.contentEditable = true;
    textArea.focus();
    textArea.style.cursor = 'text';
    textArea.style.background = 'rgba(255, 255, 255, 0.9)';
    
    // Don't select all text automatically - let user drag to select
    // Just place cursor at the end
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(textArea);
    range.collapse(false); // Collapse to end
    selection.removeAllRanges();
    selection.addRange(range);
    
    updateState({ editingLayerId: layer.id });
}

/**
 * Exits edit mode for paragraph text
 */
function exitEditMode(textArea, layer) {
    textArea.contentEditable = false;
    textArea.style.cursor = 'move';
    textArea.style.background = 'transparent';
    
    // Save the text
    layer.text = textArea.innerText;
    updateState({ 
        layersList: [...state.layersList],
        editingLayerId: null 
    });
    
    // Update the side view to reflect text changes
    updateStackVisualization();
    
    // Check for overflow after exiting edit mode
    const signLayerElement = textArea.closest('.sign-layer');
    if (signLayerElement) {
        checkTextOverflow(signLayerElement, textArea);
    }
}

/**
 * Handles resize start
 */
function startResize(e, layer, handleClass) {
    e.preventDefault();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = layer.width * SCALE_FACTOR;
    const startHeight = layer.height * SCALE_FACTOR;
    const startLeft = layer.x;
    const startTop = layer.y;
    
    const onMouseMove = (moveEvent) => {
        // Account for zoom level when calculating mouse movement
        const currentZoom = state.faceViewState.zoom;
        const deltaX = (moveEvent.clientX - startX) / currentZoom;
        const deltaY = (moveEvent.clientY - startY) / currentZoom;
        
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newX = startLeft;
        let newY = startTop;
        
        // Handle different resize directions
        if (handleClass.includes('e')) {
            newWidth = startWidth + deltaX;
        }
        if (handleClass.includes('w')) {
            newWidth = startWidth - deltaX;
            newX = startLeft + deltaX;
        }
        if (handleClass.includes('s')) {
            newHeight = startHeight + deltaY;
        }
        if (handleClass.includes('n')) {
            newHeight = startHeight - deltaY;
            newY = startTop + deltaY;
        }
        
        // Update dimensions (no minimum enforced)
        layer.width = Math.max(0.1, newWidth / SCALE_FACTOR); // Just prevent zero/negative
        layer.height = Math.max(0.1, newHeight / SCALE_FACTOR);
        layer.x = newX;
        layer.y = newY;
        
        updateCanvasLayer(layer);
        updateStackVisualization();
    };
    
    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        updateState({ layersList: [...state.layersList] });
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

/**
 * Renders text content inside a layer element
 * @param {HTMLElement} element - The layer DOM element
 * @param {object} layer - The layer data
 * @param {object} definition - The layer type definition
 */
function renderTextContent(element, layer, definition) {
    // Clear any existing text content
    const existingText = element.querySelector('.layer-text-content');
    if (existingText) {
        existingText.remove();
    }
    const existingWrapper = element.querySelector('.text-wrapper');
    if (existingWrapper) {
        existingWrapper.remove();
    }
    
    // Handle Braille conversion
    if (definition.isBraille) {
        console.log('[CANVAS] Braille layer detected:', layer.id);
        console.log('[CANVAS] brailleSourceText:', layer.brailleSourceText);
        
        // Get the source text
        const sourceText = layer.brailleSourceText || definition.defaultBrailleSourceText || '';
        console.log('[CANVAS] Braille source text:', sourceText);
        
        // Translate to Grade 2 Braille using the worker
        translateToGrade2Braille(sourceText).then(brailleText => {
            console.log('[CANVAS] Translated to Braille:', brailleText);
            
            // Create a modified layer object with the Braille text
            const brailleLayer = {
                ...layer,
                text: brailleText
            };
            
            renderAlignedText(element, brailleLayer, definition);
            
            // Update the layer's text property
            layer.text = brailleText;
        }).catch(error => {
            console.error('[CANVAS] Braille translation error:', error);
            // Fallback to showing source text
            renderAlignedText(element, layer, definition);
        });
    } else {
        renderAlignedText(element, layer, definition);
    }
}

/**
 * Removes a layer's element from the canvas.
 * @param {string} layerId - The ID of the layer to remove.
 */
export function removeCanvasLayer(layerId) {
    getElement(layerId + '-canvas')?.remove();
    if (getCanvasLayersCount() === 0 && dom.faceViewport) {
        const dropZone = dom.faceViewport.querySelector('.drop-zone');
        if (dropZone) dropZone.style.display = 'flex';
    }
}

/**
 * Updates the visual selection state of all layers on the canvas.
 */
export function updateSelectionVisuals() {
    console.log('[Position Debug] updateSelectionVisuals called');
    
    // Remove all resize handles
    document.querySelectorAll('.resize-handle').forEach(h => h.remove());
    
    document.querySelectorAll('.sign-layer').forEach(el => {
        const wasSelected = el.classList.contains('selected');
        if (wasSelected) {
            const beforeRect = el.getBoundingClientRect();
            console.log(`[Position Debug] Removing selected from ${el.id}:`, {
                left: beforeRect.left,
                top: beforeRect.top
            });
            
            // Check text editor position before removing selected
            const textEditor = el.querySelector('.paragraph-text-editor');
            if (textEditor) {
                const textRect = textEditor.getBoundingClientRect();
                console.log(`[Position Debug] Text editor position before deselection:`, {
                    left: textRect.left,
                    top: textRect.top,
                    relativeLeft: textRect.left - beforeRect.left,
                    relativeTop: textRect.top - beforeRect.top
                });
            }
        }
        el.classList.remove('selected');
    });
    
    if (state.currentLayer && state.currentLayer.onCanvas) {
        const linkedLayers = getLinkedGroup(state.currentLayer);
        linkedLayers.forEach(linkedLayer => {
            const canvasElement = getElement(linkedLayer.id + '-canvas');
            if (canvasElement) {
                const beforeRect = canvasElement.getBoundingClientRect();
                console.log(`[Position Debug] Before adding selected to ${canvasElement.id}:`, {
                    left: beforeRect.left,
                    top: beforeRect.top
                });
                
                canvasElement.classList.add('selected');
                
                const afterRect = canvasElement.getBoundingClientRect();
                console.log(`[Position Debug] After adding selected:`, {
                    left: afterRect.left,
                    top: afterRect.top,
                    leftShift: afterRect.left - beforeRect.left,
                    topShift: afterRect.top - beforeRect.top
                });
                
                // Check inner elements for text layers
                const definition = LAYER_DEFINITIONS[linkedLayer.type];
                if (definition.isText) {
                    const textEditor = canvasElement.querySelector('.paragraph-text-editor');
                    const container = canvasElement.querySelector('div');
                    
                    if (textEditor) {
                        const textRect = textEditor.getBoundingClientRect();
                        console.log(`[Position Debug] Text editor position after selection:`, {
                            left: textRect.left,
                            top: textRect.top,
                            relativeLeft: textRect.left - afterRect.left,
                            relativeTop: textRect.top - afterRect.top
                        });
                    }
                    
                    if (container) {
                        const containerRect = container.getBoundingClientRect();
                        console.log(`[Position Debug] Container position after selection:`, {
                            left: containerRect.left,
                            top: containerRect.top,
                            relativeLeft: containerRect.left - afterRect.left,
                            relativeTop: containerRect.top - afterRect.top
                        });
                    }
                }
                
                // Add resize handles for paragraph text and Braille text
                if ((definition.isParagraphText || definition.isBraille) && linkedLayer.id === state.currentLayer.id) {
                    addResizeHandles(canvasElement, linkedLayer);
                }
            }
        });
    }
}


// --- Viewport and Pan/Zoom ---

/**
 * Applies the current pan and zoom state to the viewport's transform style.
 */
export function updateViewport() {
    if (dom.faceViewport) {
        dom.faceViewport.style.transform = `translate(${state.faceViewState.x}px, ${state.faceViewState.y}px) scale(${state.faceViewState.zoom})`;
        // Set CSS custom property for zoom level so child elements can use it
        dom.faceViewport.style.setProperty('--zoom-scale', state.faceViewState.zoom);
    }
}

function handleZoom(e, onUpdate) {
    if (!dom.faceCanvas) return;
    
    const rect = dom.faceCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(15, state.faceViewState.zoom * zoomFactor));
    const zoomRatio = newZoom / state.faceViewState.zoom;
    
    const newX = mouseX - (mouseX - state.faceViewState.x) * zoomRatio;
    const newY = mouseY - (mouseY - state.faceViewState.y) * zoomRatio;
    
    onUpdate({
        faceViewState: { x: newX, y: newY, zoom: newZoom },
        sideViewState: { ...state.sideViewState, y: newY, zoom: newZoom }
    });
}

function startPan(e, onUpdate) {
    updateState({ isPanning: true, lastPanPoint: { x: e.clientX, y: e.clientY } });
    if (dom.faceCanvas) {
        dom.faceCanvas.style.cursor = 'grabbing';
    }
}

function handlePan(e, onUpdate) {
    if (!state.isPanning) return;
    const deltaX = e.clientX - state.lastPanPoint.x;
    const deltaY = e.clientY - state.lastPanPoint.y;
    
    const newFaceX = state.faceViewState.x + deltaX;
    const newFaceY = state.faceViewState.y + deltaY;

    onUpdate({
        faceViewState: { ...state.faceViewState, x: newFaceX, y: newFaceY },
        sideViewState: { ...state.sideViewState, y: newFaceY },
        lastPanPoint: { x: e.clientX, y: e.clientY }
    });
}

function stopPan() {
    updateState({ isPanning: false });
    if (dom.faceCanvas) {
        dom.faceCanvas.style.cursor = 'grab';
    }
}


// --- Grid and Dimensions ---

/**
 * Toggles the visibility of the grid container.
 */
export function updateGrid() {
    if (!dom.faceViewport) return;
    
    const gridEl = dom.faceViewport.querySelector('.canvas-grid');
    if (gridEl) {
        gridEl.style.display = state.gridVisible ? 'block' : 'none';
        if (state.gridVisible) {
            updateGridSize();
        }
    }
}

/**
 * Recalculates and redraws the grid lines based on the current zoom level.
 */
export function updateGridSize() {
    if (!state.gridVisible || !dom.faceViewport) return;

    const gridEl = dom.faceViewport.querySelector('.canvas-grid');
    if (!gridEl) return;

    // Calculate grid size based on snap value
    let snapInInches = state.snapUnit === 'mm' ? state.snapValue / 25.4 : state.snapValue;
    const gridSizePixels = snapInInches * SCALE_FACTOR * state.faceViewState.zoom;
    
    // Update the CSS background grid size
    gridEl.style.backgroundSize = `${gridSizePixels}px ${gridSizePixels}px`;
}

/**
 * Draws dimension lines for layers that have `showDimensions` set to true.
 */
export function updateDimensionsVisuals() {
    if (!dom.dimensionsContainer) return;
    
    dom.dimensionsContainer.innerHTML = '';
    const layersToShow = state.layersList.filter(l => l.showDimensions && l.onCanvas);
    if (layersToShow.length === 0) return;

    let minX = Infinity, minY = Infinity;
    state.layersList.filter(l => l.onCanvas).forEach(l => {
        if (l.x < minX) minX = l.x;
        if (l.y < minY) minY = l.y;
    });

    let vOffset = 20, hOffset = 20;
    const offsetIncrement = 15;

    layersToShow.forEach(layer => {
        const definition = LAYER_DEFINITIONS[layer.type];
        
        if (definition.isText) {
            // For text layers, calculate actual dimensions
            import('./text-renderer.js').then(({ calculateTextDimensions, measureCapitalXHeight }) => {
                if (definition.isParagraphText) {
                    // For paragraph text, only show X-height dimension
                    const fontSize = layer.fontSize || definition.defaultFontSize || 24;
                    const fontFamily = layer.font || definition.defaultFont || 'Arial';
                    const xHeightPixels = measureCapitalXHeight(fontSize, fontFamily);
                    const xHeightInches = xHeightPixels / SCALE_FACTOR;
                    
                    // Only show height dimension for X-height
                    // Add 10px offset to align with text baseline (accounting for padding)
                    const heightLine = createDimLine('v', minX - hOffset, layer.y + 10, xHeightPixels, `${xHeightInches.toFixed(3)}"`);
                    dom.dimensionsContainer.appendChild(heightLine);
                } else {
                    // For regular text layers, show both dimensions
                    const dims = calculateTextDimensions(
                        layer.text || definition.defaultText || '',
                        layer.font || definition.defaultFont || 'Arial',
                        layer.fontSize || definition.defaultFontSize || 24,
                        layer.lineSpacing || definition.defaultLineSpacing || 1.2
                    );
                    
                    // Width Dimension
                    const widthLine = createDimLine('h', layer.x, minY - vOffset, dims.width * SCALE_FACTOR, `${dims.width.toFixed(3)}" ${layer.name}`);
                    dom.dimensionsContainer.appendChild(widthLine);
                    
                    // Height Dimension (use Y position for text baseline)
                    const heightLine = createDimLine('v', minX - hOffset, layer.y, dims.height * SCALE_FACTOR, `${dims.height.toFixed(3)}" ${layer.name}`);
                    dom.dimensionsContainer.appendChild(heightLine);
                }
            });
        } else {
            // Non-text layers use stored dimensions
            // Width Dimension
            const widthLine = createDimLine('h', layer.x, minY - vOffset, layer.width * SCALE_FACTOR, `${layer.width.toFixed(2)}" ${layer.name}`);
            dom.dimensionsContainer.appendChild(widthLine);
            
            // Height Dimension
            const heightLine = createDimLine('v', minX - hOffset, layer.y, layer.height * SCALE_FACTOR, `${layer.height.toFixed(2)}" ${layer.name}`);
            dom.dimensionsContainer.appendChild(heightLine);
        }
        
        vOffset += offsetIncrement;
        hOffset += offsetIncrement;
    });
}

/**
 * Helper function to create a single dimension line element.
 * @param {string} dir - 'h' for horizontal, 'v' for vertical.
 * @param {number} x - Left position.
 * @param {number} y - Top position.
 * @param {number} size - Width or height of the line.
 * @param {string} text - The text label for the dimension.
 * @returns {HTMLElement} The dimension line element.
 */
function createDimLine(dir, x, y, size, text) {
    const line = document.createElement('div');
    line.className = `dim-line dim-line-${dir}`;
    line.style.left = `${x}px`;
    line.style.top = `${y}px`;

    const tick1 = document.createElement('div');
    tick1.className = `dim-tick dim-tick-${dir}`;
    const tick2 = document.createElement('div');
    tick2.className = `dim-tick dim-tick-${dir}`;
    const textEl = document.createElement('div');
    textEl.className = 'dim-text';
    textEl.textContent = text;

    if (dir === 'h') {
        line.style.width = `${size}px`;
        tick1.style.left = '0px'; tick1.style.top = '-2px';
        tick2.style.right = '0px'; tick2.style.top = '-2px';
    } else {
        line.style.height = `${size}px`;
        tick1.style.top = '0px'; tick1.style.left = '-2px';
        tick2.style.bottom = '0px'; tick2.style.left = '-2px';
        textEl.style.transform = 'rotate(-90deg)';
    }

    line.appendChild(tick1);
    line.appendChild(tick2);
    line.appendChild(textEl);
    return line;
}


// --- Drag and Drop ---

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
}

function handleDragEnter(e, canvas) {
    e.preventDefault();
    canvas.querySelector('.drop-zone')?.classList.add('drag-over');
}

function handleDragLeave(e, canvas) {
    if (!canvas.contains(e.relatedTarget)) {
        canvas.querySelector('.drop-zone')?.classList.remove('drag-over');
    }
}


export function updateAllCanvasLayers() {
    state.layersList.filter(layer => layer.onCanvas).forEach(layer => {
        updateCanvasLayer(layer);
    });
}

// Function to update all Braille layers specifically
export function updateAllBrailleLayers() {
    console.log('[CANVAS] Updating all Braille layers...');
    state.layersList.filter(layer => {
        const definition = LAYER_DEFINITIONS[layer.type];
        return layer.onCanvas && definition && definition.isBraille;
    }).forEach(layer => {
        console.log('[CANVAS] Updating Braille layer:', layer.id);
        updateCanvasLayer(layer);
    });
}

// Make it globally available for the Braille translator
window.updateAllBrailleLayers = updateAllBrailleLayers;

// --- Helpers ---

function getCanvasLayersCount() {
    return state.layersList.filter(layer => layer.onCanvas).length;
}

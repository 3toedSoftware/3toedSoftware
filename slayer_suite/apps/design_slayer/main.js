/**
 * main.js
 * This is the main entry point for the Design Slayer application.
 * It imports all other modules, defines the main event handlers,
 * and initializes the application.
 */

// --- Module Imports ---
import { state, updateState, getNextLayerId } from './state.js';
import { LAYER_DEFINITIONS, SCALE_FACTOR } from './config.js';
import * as UI from './ui.js';
import * as Canvas from './canvas.js';
import * as Viewer3D from './viewer3D.js';

// --- Layer Management ---

/**
 * Adds a new layer of a given type to the application state.
 * @param {string} type - The type of layer to add (e.g., 'plate', 'primary-text').
 */
function addLayer(type) {
    const definition = LAYER_DEFINITIONS[type];
    if (!definition) return;

    const layerId = `layer-${getNextLayerId()}`;
    const existingCount = state.layersList.filter(layer => layer.type === type).length;

    const newLayer = {
        id: layerId,
        type: type,
        name: `${definition.name} ${existingCount + 1}`,
        width: definition.width,
        height: definition.height,
        thickness: definition.thickness,
        material: definition.material,
        x: 50,
        y: 50,
        zIndex: state.layersList.length,
        onCanvas: false,
        showDimensions: false,
    };

    const newLayersList = [newLayer, ...state.layersList];
    updateState({ layersList: newLayersList });
    UI.refreshLayerList(eventHandlers);
}

/**
 * Deletes a layer and all associated data.
 * @param {string} layerId - The ID of the layer to delete.
 */
function deleteLayer(layerId) {
    const layerIndex = state.layersList.findIndex(l => l.id === layerId);
    if (layerIndex === -1) return;

    // Filter out the deleted layer and any links associated with it.
    const newLayersList = state.layersList.filter(l => l.id !== layerId);
    const newLayerLinks = state.layerLinks.filter(link => link.from !== layerIndex && link.to !== layerIndex);

    updateState({
        layersList: newLayersList,
        layerLinks: newLayerLinks,
        currentLayer: (state.currentLayer?.id === layerId) ? null : state.currentLayer,
    });

    Canvas.removeCanvasLayer(layerId);
    UI.refreshLayerList(eventHandlers);
    updateLayerOrder();
    Canvas.updateDimensionsVisuals();
}

/**
 * Updates the z-index of all layers based on their order in the list.
 */
function updateLayerOrder() {
    state.layersList.forEach((layer, index) => {
        layer.zIndex = state.layersList.length - 1 - index;
        if (layer.onCanvas) {
            Canvas.updateCanvasLayer(layer);
        }
    });
    UI.updateStackVisualization();
}

// --- Event Handlers ---
// This object centralizes all event handling logic, connecting UI events to state changes and re-renders.
const eventHandlers = {
    // Layer List Handlers
    onDeleteLayer: deleteLayer,
    onSelectLayer: (layer) => {
        updateState({ currentLayer: layer });
        UI.updateDimensionsDisplay();
        UI.refreshLayerList(eventHandlers); // To update selection style in list
        Canvas.updateSelectionVisuals();
        Canvas.updateDimensionsVisuals();
    },
    onUpdateLayerProperties: (layerId) => {
        const updatedProps = UI.readLayerPropertiesFromUI(layerId);
        if (!updatedProps) return;
        
        const layer = state.layersList.find(l => l.id === layerId);
        Object.assign(layer, updatedProps);

        UI.refreshLayerList(eventHandlers); // Refresh to show new specs
        if (layer.onCanvas) {
            Canvas.updateCanvasLayer(layer);
            Canvas.updateDimensionsVisuals();
            UI.updateStackVisualization();
        }
    },
    onDragStartLayer: (event, row) => {
        event.dataTransfer.setData('application/layer-id', row.dataset.layerId);
        event.dataTransfer.effectAllowed = 'copyMove';
        row.classList.add('dragging');
    },
    onDropInLayerList: (event, insertIndex) => {
        const draggedId = event.dataTransfer.getData('application/layer-id');
        const draggedLayer = state.layersList.find(layer => layer.id === draggedId);
        if (!draggedLayer) return;

        const currentIndex = state.layersList.indexOf(draggedLayer);
        const newList = [...state.layersList];
        newList.splice(currentIndex, 1);
        const adjustedIndex = (currentIndex < insertIndex) ? insertIndex - 1 : insertIndex;
        newList.splice(adjustedIndex, 0, draggedLayer);

        updateState({ layersList: newList, layerLinks: [] }); // Reset links on reorder
        UI.refreshLayerList(eventHandlers);
        updateLayerOrder();
    },

    // Canvas Handlers
    onDropOnCanvas: (event, canvas) => {
        canvas.querySelector('.drop-zone')?.classList.remove('drag-over');
        const layerId = event.dataTransfer.getData('application/layer-id');
        const layer = state.layersList.find(l => l.id === layerId);

        if (layer && !layer.onCanvas && canvas.id === 'face-canvas') {
            const rect = canvas.getBoundingClientRect();
            layer.x = (event.clientX - rect.left - state.faceViewState.x) / state.faceViewState.zoom;
            layer.y = (event.clientY - rect.top - state.faceViewState.y) / state.faceViewState.zoom;
            layer.onCanvas = true;

            UI.refreshLayerList(eventHandlers);
            Canvas.createCanvasLayer(layer, eventHandlers.onSelectLayer, startLayerDrag);
            updateLayerOrder();
        }
    },
    onViewportChange: (newValues) => {
        updateState(newValues);
        Canvas.updateViewport();
        Canvas.updateGridSize();
        UI.updateStackVisualization();
        Canvas.updateDimensionsVisuals();
    },

    // Tooling and Controls Handlers
    onToggleLayerLink: (fromIndex, toIndex) => {
        if (toIndex < 0 || toIndex >= state.layersList.length) return;
        const linkIndex = state.layerLinks.findIndex(link =>
            (link.from === fromIndex && link.to === toIndex) ||
            (link.from === toIndex && link.to === fromIndex)
        );
        const newLinks = [...state.layerLinks];
        if (linkIndex > -1) {
            newLinks.splice(linkIndex, 1);
        } else {
            newLinks.push({ from: fromIndex, to: toIndex });
        }
        updateState({ layerLinks: newLinks });
        UI.updateLinkVisuals();
    },
    onToggleDimensions: (layerId) => {
        const layer = state.layersList.find(l => l.id === layerId);
        if (layer) {
            layer.showDimensions = !layer.showDimensions;
            UI.refreshLayerList(eventHandlers);
            Canvas.updateDimensionsVisuals();
        }
    },
    onGridToggle: () => {
        updateState({ gridVisible: !state.gridVisible });
        UI.updateGridToggleVisual();
        Canvas.updateGrid();
    },
    onSnapToggle: () => {
        updateState({ snapEnabled: !state.snapEnabled });
        UI.updateSnapDisplay();
    },
    onUnitChange: (unit) => {
        updateState({ snapUnit: unit });
        UI.updateSnapPresets(eventHandlers.onPresetSnapChange);
        UI.updateSnapDisplay();
    },
    onCustomSnapInput: (value) => {
        const numValue = parseFloat(value);
        if (numValue > 0) {
            updateState({ snapValue: numValue });
            UI.clearPresetSelection();
            UI.updateSnapDisplay();
            Canvas.updateGridSize();
        }
    },
    onPresetSnapChange: (value) => {
        updateState({ snapValue: value });
        document.getElementById('snap-custom-input').value = '';
        UI.updatePresetSelection();
        UI.updateSnapDisplay();
        Canvas.updateGridSize();
    },
    onXRayToggle: () => {
        updateState({ xrayMode: !state.xrayMode });
        UI.updateXrayMode();
        state.layersList.forEach(l => { if (l.onCanvas) Canvas.updateCanvasLayer(l) });
        UI.updateStackVisualization();
    },
    onShadowToggle: () => {
        updateState({ shadowMode: !state.shadowMode });
        UI.updateShadowMode();
        state.layersList.forEach(l => { if (l.onCanvas) Canvas.updateCanvasLayer(l) });
    },

    // 3D Modal Handlers
    onOpen3D: () => {
        updateState({ isModalOpen: true });
        UI.open3DModal();
        setTimeout(() => {
            Viewer3D.init3DViewer();
            UI.hide3DLoadingSpinner();
        }, 100);
    },
    onClose3D: () => {
        updateState({ isModalOpen: false });
        UI.close3DModal();
        Viewer3D.cleanup3DViewer();
    },
};

/**
 * Handles the start of a drag operation for a layer on the canvas.
 * @param {MouseEvent} e - The mousedown event.
 * @param {object} layer - The layer being dragged.
 */
function startLayerDrag(e, layer) {
    e.preventDefault();
    const canvas = e.target.closest('.design-canvas');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const viewState = state.faceViewState;
    
    const offsetX = (e.clientX - rect.left - viewState.x) / viewState.zoom - layer.x;
    const offsetY = (e.clientY - rect.top - viewState.y) / viewState.zoom - layer.y;
    
    let lastX = layer.x;
    let lastY = layer.y;

    const linkedLayers = getLinkedGroup(layer);

    function onMouseMove(moveEvent) {
        const snapSize = state.snapEnabled ? (state.snapUnit === 'mm' ? state.snapValue / 25.4 : state.snapValue) * SCALE_FACTOR : 1;
        
        const x = (moveEvent.clientX - rect.left - viewState.x) / viewState.zoom - offsetX;
        const y = (moveEvent.clientY - rect.top - viewState.y) / viewState.zoom - offsetY;
        
        const snappedX = state.snapEnabled ? Math.round(x / snapSize) * snapSize : x;
        const snappedY = state.snapEnabled ? Math.round(y / snapSize) * snapSize : y;

        const deltaX = snappedX - lastX;
        const deltaY = snappedY - lastY;

        linkedLayers.forEach(linkedLayer => {
            linkedLayer.x += deltaX;
            linkedLayer.y += deltaY;
            Canvas.updateCanvasLayer(linkedLayer);
        });

        lastX = snappedX;
        lastY = snappedY;
        UI.updateStackVisualization();
        Canvas.updateDimensionsVisuals();
    }

    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

/**
 * Finds all layers that are linked together in a group.
 * @param {object} layer - The starting layer.
 * @returns {Array<object>} An array of all layers in the group.
 */
export function getLinkedGroup(layer) {
    const startIndex = state.layersList.indexOf(layer);
    if (startIndex === -1) return [layer];
    
    const group = new Set([startIndex]);
    const toCheck = [startIndex];
    
    while (toCheck.length > 0) {
        const currentIndex = toCheck.pop();
        state.layerLinks.forEach(link => {
            if (link.from === currentIndex && !group.has(link.to)) {
                group.add(link.to);
                toCheck.push(link.to);
            }
            if (link.to === currentIndex && !group.has(link.from)) {
                group.add(link.from);
                toCheck.push(link.from);
            }
        });
    }
    
    return Array.from(group)
        .map(index => state.layersList[index])
        .filter(l => l && l.onCanvas);
}


// --- App Initialization ---

/**
 * The main initialization function for the application.
 */
function init() {
    // Setup UI event listeners
    document.getElementById('add-layer-btn').addEventListener('click', () => {
        const selectedType = document.getElementById('layer-type-select').value;
        if (selectedType) {
            addLayer(selectedType);
            document.getElementById('layer-type-select').value = '';
        }
    });

    UI.setupSnapFlyout({
        onUnitChange: eventHandlers.onUnitChange,
        onGridToggle: eventHandlers.onGridToggle,
        onSnapToggle: eventHandlers.onSnapToggle,
        onCustomSnapInput: eventHandlers.onCustomSnapInput,
        onPresetSnapChange: eventHandlers.onPresetSnapChange,
    });
    
    document.getElementById('xray-toggle-btn').addEventListener('click', eventHandlers.onXRayToggle);
    document.getElementById('shadow-toggle-btn').addEventListener('click', eventHandlers.onShadowToggle);

    // Setup Canvas event listeners
    Canvas.setupCanvas({
        onSelectLayer: eventHandlers.onSelectLayer,
        onDropOnCanvas: eventHandlers.onDropOnCanvas,
        onViewportChange: eventHandlers.onViewportChange,
    });
    
    // Setup 3D Modal
    UI.setup3DModal({
        onOpen3D: eventHandlers.onOpen3D,
        onClose3D: eventHandlers.onClose3D,
    });

    // Initial render
    UI.refreshLayerList(eventHandlers);
    console.log("🚀 Design Slayer Initialized");
}

// --- Start the App ---
document.addEventListener('DOMContentLoaded', init);

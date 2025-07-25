// state.js - State management for Design Slayer
import { DEFAULT_VIEWPORT_STATE } from './config.js';

// Application state
export const state = {
    layerCounter: 0,
    selectedLayer: null,
    currentLayer: null,
    layersList: [],
    layerLinks: [],
    
    // UI state
    snapEnabled: false,
    gridVisible: false,
    xrayMode: false,
    shadowMode: false,
    editingLayerId: null,
    
    // Snap settings
    snapValue: 0.125, // Default 1/8 inch
    snapUnit: 'inches', // 'inches' or 'mm'
    snapFlyoutOpen: false,
    
    // Viewport states
    faceViewState: { ...DEFAULT_VIEWPORT_STATE },
    sideViewState: { ...DEFAULT_VIEWPORT_STATE },
    
    // 3D viewer state
    isModalOpen: false,
    
    // Sign type state
    currentSignType: null,
    
    // File state
    currentFileName: 'No file loaded',
    isDirty: false,
    
    // UI state for expanded layers
    expandedLayers: new Set()
};

// State update function
export function updateState(updates) {
    Object.assign(state, updates);
    
    // Trigger any necessary side effects
    if ('isDirty' in updates && window.appBridge) {
        window.appBridge.broadcast('project:dirty', { isDirty: updates.isDirty });
    }
}

// Layer ID generator
export function getNextLayerId() {
    return ++state.layerCounter;
}

// Layer operations
export function addLayer(layer) {
    state.layersList.unshift(layer);
    updateState({ isDirty: true });
}

export function removeLayer(layerId) {
    const index = state.layersList.findIndex(l => l.id === layerId);
    if (index !== -1) {
        state.layersList.splice(index, 1);
        
        // Remove associated links
        state.layerLinks = state.layerLinks.filter(
            link => link.from !== index && link.to !== index
        );
        
        // Clear current layer if it was deleted
        if (state.currentLayer?.id === layerId) {
            state.currentLayer = null;
        }
        
        updateState({ isDirty: true });
    }
}

export function updateLayer(layerId, updates) {
    const layer = state.layersList.find(l => l.id === layerId);
    if (layer) {
        Object.assign(layer, updates);
        updateState({ isDirty: true });
    }
}

// Layer linking operations
export function toggleLayerLink(fromIndex, toIndex) {
    const existingLinkIndex = state.layerLinks.findIndex(
        link => link.from === fromIndex && link.to === toIndex
    );
    
    if (existingLinkIndex !== -1) {
        state.layerLinks.splice(existingLinkIndex, 1);
    } else {
        state.layerLinks.push({ from: fromIndex, to: toIndex });
    }
    
    updateState({ isDirty: true });
}

export function getLinkedGroup(layer) {
    const layerIndex = state.layersList.indexOf(layer);
    if (layerIndex === -1) return [layer];
    
    const linkedIndices = new Set([layerIndex]);
    let changed = true;
    
    while (changed) {
        changed = false;
        for (const link of state.layerLinks) {
            if (linkedIndices.has(link.from) && !linkedIndices.has(link.to)) {
                linkedIndices.add(link.to);
                changed = true;
            } else if (linkedIndices.has(link.to) && !linkedIndices.has(link.from)) {
                linkedIndices.add(link.from);
                changed = true;
            }
        }
    }
    
    return Array.from(linkedIndices).map(i => state.layersList[i]).filter(Boolean);
}

// Reset state
export function resetState() {
    state.layerCounter = 0;
    state.selectedLayer = null;
    state.currentLayer = null;
    state.layersList = [];
    state.layerLinks = [];
    state.snapEnabled = false;
    state.gridVisible = false;
    state.xrayMode = false;
    state.shadowMode = false;
    state.snapValue = 0.125;
    state.snapUnit = 'inches';
    state.snapFlyoutOpen = false;
    state.faceViewState = { ...DEFAULT_VIEWPORT_STATE };
    state.sideViewState = { ...DEFAULT_VIEWPORT_STATE };
    state.isModalOpen = false;
    state.editingLayerId = null;
    state.currentFileName = 'No file loaded';
    state.isDirty = false;
}
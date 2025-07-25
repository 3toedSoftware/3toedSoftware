// apps/design_slayer/design-app.js
import SlayerAppBase from '../../core/slayer-app-base.js';
import { state, updateState, getNextLayerId, getLinkedGroup } from './state.js';
import { LAYER_DEFINITIONS, SCALE_FACTOR } from './config.js';
import * as UI from './ui.js';
import * as Canvas from './canvas.js';
import * as Viewer3D from './viewer3D.js';

class DesignSlayerApp extends SlayerAppBase {
    constructor() {
        super('design_slayer', 'DESIGN SLAYER', '1.0.0');
        this.eventHandlers = null;
        this.cssLoaded = false;
    }

    async activate() {
        // Load CSS if not already loaded
        if (!this.cssLoaded && this.isSuiteMode) {
            await this.loadAppStyles();
            this.cssLoaded = true;
        }
        
        // Call parent activate
        await super.activate();
    }

    async deactivate() {
        // Remove CSS when deactivating
        if (this.cssLoaded && this.isSuiteMode) {
            const link = document.getElementById('design-slayer-css');
            if (link) {
                link.remove();
                this.cssLoaded = false;
            }
        }
        
        // Call parent deactivate
        await super.deactivate();
    }

    createAppContent() {
        const contentArea = this.getContentArea();
        
        // Read the original index.html structure and adapt it
        contentArea.innerHTML = `
            <div class="design-slayer-app">
                <!-- Main Content -->
                <div class="left-panel">
                <!-- Sign Type Section -->
                <div class="panel-section" style="flex: 0 0 auto; min-height: auto;">
                    <div class="panel-header">
                        <span>SIGN TYPE</span>
                        <button class="btn btn-compact btn-primary" id="create-sign-type-btn" style="font-size: 10px; padding: 3px 8px;">NEW</button>
                    </div>
                    <div class="panel-content" style="padding: 10px;">
                        <div class="sign-type-selector">
                            <select id="sign-type-select" class="layer-dropdown" style="width: 100%; margin-bottom: 8px;">
                                <option value="">Select Sign Type</option>
                            </select>
                            <div id="new-sign-type-form" style="display: none;">
                                <input type="text" id="new-sign-type-code" placeholder="Sign Type Code (e.g., I.1)" class="property-input" style="margin-bottom: 5px;">
                                <input type="text" id="new-sign-type-name" placeholder="Sign Type Name" class="property-input" style="margin-bottom: 5px;">
                                <div style="display: flex; gap: 5px;">
                                    <button class="btn btn-primary btn-compact" id="save-sign-type-btn">Save</button>
                                    <button class="btn btn-secondary btn-compact" id="cancel-sign-type-btn">Cancel</button>
                                </div>
                            </div>
                            <div id="current-sign-type-info" style="display: none; margin-top: 8px; font-size: 11px; color: #ccc;">
                                <div>Code: <span id="current-sign-type-code" style="color: #f07727;"></span></div>
                                <div>Name: <span id="current-sign-type-name" style="color: #f07727;"></span></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="panel-section">
                    <div class="panel-header">
                        <span>SIGN LAYERS</span>
                        <div class="layer-controls">
                            <select id="layer-type-select" class="layer-dropdown">
                                <option value="">Select Layer Type</option>
                                <option value="plate">Plate</option>
                                <option value="primary-text">Primary Text</option>
                                <option value="secondary-text">Secondary Text</option>
                                <option value="paragraph-text">Paragraph Text</option>
                                <option value="braille-text">Braille Text</option>
                                <option value="logo">Logo</option>
                                <option value="icon">Icon</option>
                            </select>
                            <button class="btn-add" id="add-layer-btn">+</button>
                        </div>
                    </div>
                    <div class="panel-content">
                        <div class="layers-list" id="layers-list">
                            <div class="empty-state">
                                Select a layer type and click + to add your first layer.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Center - Design Views -->
            <div class="center-panel">
                <div class="design-workspace">
                    <!-- Face View -->
                    <div class="design-view">
                        <div class="design-canvas face-canvas" id="face-canvas">
                            <div class="canvas-viewport" id="face-viewport">
                                <div class="canvas-grid"></div>
                                <div class="dimensions-container" id="dimensions-container"></div>
                                <div class="drop-zone" id="face-drop-zone">
                                    Drag Layer Here
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Side Profile -->
                    <div class="design-view" style="flex: 0.25;">
                        <div class="design-canvas side-canvas" id="side-canvas">
                            <div class="canvas-viewport" id="side-viewport">
                                <div class="canvas-grid"></div>
                                <div class="drop-zone" id="side-drop-zone">
                                    Side profile view
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="footer-controls">
                <div class="control-group">
                    <!-- Enhanced Snap Control -->
                    <div class="snap-container">
                        <button class="btn btn-secondary btn-compact" id="snap-toggle-btn">SNAP OFF</button>
                        <div class="snap-flyout" id="snap-flyout">
                            <div class="snap-header">SNAP SETTINGS</div>
                            <div class="snap-unit-toggle">
                                <button class="unit-btn active" data-unit="inches">INCHES</button>
                                <button class="unit-btn" data-unit="mm">MM</button>
                            </div>
                            <div class="snap-presets" id="snap-presets">
                                <!-- Preset buttons will be populated by JS -->
                            </div>
                            <div class="snap-custom">
                                <label for="custom-snap-input">Custom Value:</label>
                                <input type="number" id="custom-snap-input" min="0.01" step="0.01" value="0.125">
                            </div>
                        </div>
                    </div>
                    
                    <button class="btn btn-secondary btn-compact" id="view-3d-btn">3D VIEW</button>
                    <button class="btn btn-secondary btn-compact" id="grid-toggle-btn">GRID OFF</button>
                    <button class="btn btn-secondary btn-compact" id="xray-mode-btn">X-RAY OFF</button>
                    <button class="btn btn-secondary btn-compact" id="shadow-mode-btn">SHADOWS OFF</button>
                    
                    <div class="measurement-display">
                        <span>PLATE: </span>
                        <span id="sign-dimensions">No layer selected</span>
                    </div>
                </div>
                
                <div class="control-group right-controls">
                    <button class="btn btn-primary btn-compact" id="export-btn">EXPORT</button>
                    <button class="btn btn-success btn-compact" id="order-btn">ORDER</button>
                </div>
            </div>

            <!-- 3D Modal -->
            <div class="modal-overlay" id="modal-3d" style="display: none;">
                <div class="loading-spinner" id="loading-spinner">Loading 3D Model...</div>
                <div id="threejs-container">
                    <button class="modal-close-btn" id="close-modal-3d-btn">×</button>
                </div>
            </div>
            </div> <!-- End design-slayer-app -->
        `;
    }

    async initialize(container, isSuiteMode) {
        await super.initialize(container, isSuiteMode);
        
        // Load Design Slayer specific styles only in standalone mode
        if (!isSuiteMode) {
            await this.loadAppStyles();
        }
        
        // Initialize functionality after styles are loaded
        await this.initializeDesignFunctionality();
    }
    
    async activate() {
        // Load CSS when activated in suite mode
        if (this.isSuiteMode && !this.cssLoaded) {
            await this.loadAppStyles();
            this.cssLoaded = true;
        }
        
        await super.activate();
    }
    
    async deactivate() {
        // Remove CSS when deactivated in suite mode
        if (this.isSuiteMode && this.cssLoaded) {
            const cssLink = document.getElementById('design-slayer-css');
            if (cssLink) {
                cssLink.remove();
            }
            this.cssLoaded = false;
        }
        
        await super.deactivate();
    }
    
    async loadAppStyles() {
        const link = document.createElement('link');
        link.id = 'design-slayer-css';
        link.rel = 'stylesheet';
        link.href = './apps/design_slayer/design-slayer.css';
        document.head.appendChild(link);
        
        // Wait for styles to load
        return new Promise((resolve) => {
            link.onload = resolve;
            link.onerror = () => {
                console.error('Failed to load Design Slayer styles');
                resolve(); // Continue anyway
            };
        });
    }

    async initializeDesignFunctionality() {
        console.log('🎨 Initializing Design Slayer functionality...');
        
        // Initialize event handlers
        this.setupEventHandlers();
        
        // Setup canvas interactions
        Canvas.setupCanvas(this.eventHandlers);
        
        // Setup snap flyout
        UI.setupSnapFlyout(this.eventHandlers);
        
        // Setup 3D modal
        UI.setup3DModal(this.eventHandlers);
        
        // Setup sign type functionality
        await this.setupSignTypes();
        
        // Initial UI refresh
        UI.refreshLayerList(this.eventHandlers);
        
        console.log('✅ Design Slayer functionality initialized');
    }

    setupEventHandlers() {
        // Create event handlers object
        this.eventHandlers = {
            // Layer List Handlers
            onDeleteLayer: this.deleteLayer.bind(this),
            onSelectLayer: (layer) => {
                updateState({ currentLayer: layer });
                UI.updateDimensionsDisplay();
                UI.updateLayerSelection(); // Just update selection, don't refresh entire list
                Canvas.updateSelectionVisuals();
                Canvas.updateDimensionsVisuals();
            },
            onUpdateLayerProperties: (layerId) => {
                const updatedProps = UI.readLayerPropertiesFromUI(layerId);
                if (!updatedProps) return;
                
                const layer = state.layersList.find(l => l.id === layerId);
                if (!layer) return;
                
                Object.assign(layer, updatedProps);
                
                if (layer.onCanvas) {
                    Canvas.updateCanvasLayer(layer);
                }
                
                updateState({ layersList: [...state.layersList] });
                UI.updateStackVisualization();
                Canvas.updateDimensionsVisuals();
                
                // Force re-render of ADA guide if it's shown and font properties changed
                if (layer.showAdaGuide && (updatedProps.fontSize || updatedProps.font || updatedProps.verticalAlign)) {
                    // The updateCanvasLayer should handle this, but let's ensure it happens
                    const canvasElement = document.getElementById(layer.id + '-canvas');
                    if (canvasElement) {
                        const existingGuide = canvasElement.querySelector('.ada-height-guide');
                        if (existingGuide) {
                            existingGuide.remove();
                            // It will be re-added by updateCanvasLayer
                        }
                    }
                }
            },
            onMoveLayerUp: (layerId) => {
                const index = state.layersList.findIndex(l => l.id === layerId);
                if (index > 0) {
                    const newList = [...state.layersList];
                    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
                    updateState({ layersList: newList });
                    UI.refreshLayerList(this.eventHandlers);
                    this.updateLayerOrder();
                }
            },
            onMoveLayerDown: (layerId) => {
                const index = state.layersList.findIndex(l => l.id === layerId);
                if (index < state.layersList.length - 1) {
                    const newList = [...state.layersList];
                    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
                    updateState({ layersList: newList });
                    UI.refreshLayerList(this.eventHandlers);
                    this.updateLayerOrder();
                }
            },
            onDragStartLayer: (e, row) => {
                const layerId = row.dataset.layerId;
                e.dataTransfer.setData('application/layer-id', layerId);
                e.dataTransfer.effectAllowed = 'copyMove';
                row.classList.add('dragging');
            },
            onDropInLayerList: (e, insertIndex) => {
                e.preventDefault();
                const draggedLayerId = e.dataTransfer.getData('application/layer-id');
                if (draggedLayerId) {
                    this.reorderLayerAtIndex(draggedLayerId, insertIndex);
                }
            },
            onToggleLayerLink: (fromIndex, toIndex) => {
                if (toIndex < 0 || toIndex >= state.layersList.length) return;
                
                const existingLinkIndex = state.layerLinks.findIndex(
                    link => (link.from === fromIndex && link.to === toIndex) ||
                           (link.from === toIndex && link.to === fromIndex)
                );
                
                let newLinks;
                if (existingLinkIndex !== -1) {
                    newLinks = state.layerLinks.filter((_, i) => i !== existingLinkIndex);
                } else {
                    newLinks = [...state.layerLinks, { from: fromIndex, to: toIndex }];
                }
                
                updateState({ layerLinks: newLinks });
                UI.updateLinkVisuals();
                UI.updateStackVisualization();
            },
            onToggleDimensions: (layerId) => {
                const layer = state.layersList.find(l => l.id === layerId);
                if (layer) {
                    layer.showDimensions = !layer.showDimensions;
                    UI.refreshLayerList(this.eventHandlers);
                    Canvas.updateDimensionsVisuals();
                }
            },
            onDropOnCanvas: (e, canvas) => {
                e.preventDefault();
                canvas.querySelector('.drop-zone')?.classList.remove('drag-over');
                
                const layerId = e.dataTransfer.getData('application/layer-id');
                const layer = state.layersList.find(l => l.id === layerId);
                
                if (layer && !layer.onCanvas && canvas.id === 'face-canvas') {
                    const rect = canvas.getBoundingClientRect();
                    const x = (e.clientX - rect.left - state.faceViewState.x) / state.faceViewState.zoom;
                    const y = (e.clientY - rect.top - state.faceViewState.y) / state.faceViewState.zoom;
                    
                    this.addLayerToCanvas(layer, x, y);
                }
            },
            onStartDrag: (e, layer) => {
                this.startCanvasDrag(e, layer);
            },
            onViewportChange: (updates) => {
                updateState(updates);
                Canvas.updateViewport();
                Canvas.updateGridSize();
                UI.updateStackVisualization();
                Canvas.updateDimensionsVisuals();
            },
            // Snap and grid handlers
            onUnitChange: (unit) => {
                updateState({ snapUnit: unit });
                UI.updateSnapPresets(this.eventHandlers.onPresetSnapChange);
                UI.updateSnapDisplay();
            },
            onGridToggle: () => {
                updateState({ gridVisible: !state.gridVisible });
                Canvas.updateGrid();
                UI.updateGridToggleVisual();
            },
            onSnapToggle: () => {
                updateState({ snapEnabled: !state.snapEnabled });
                UI.updateSnapDisplay();
            },
            onCustomSnapInput: (value) => {
                const numValue = parseFloat(value);
                if (numValue > 0) {
                    updateState({ snapValue: numValue });
                    UI.updateSnapDisplay();
                }
            },
            onPresetSnapChange: (value) => {
                updateState({ snapValue: value });
                UI.updatePresetSelection();
                UI.updateSnapDisplay();
            },
            // 3D Modal handlers
            onOpen3D: () => {
                console.log('Opening 3D modal...');
                updateState({ isModalOpen: true });
                UI.toggle3DModal(true);
                setTimeout(() => {
                    try {
                        Viewer3D.init3DViewer();
                        UI.hide3DLoadingSpinner();
                    } catch (error) {
                        console.error('Failed to initialize 3D viewer:', error);
                        UI.hide3DLoadingSpinner();
                        // Show error message
                        const container = document.getElementById('threejs-container');
                        if (container && !container.querySelector('canvas')) {
                            container.innerHTML = '<div style="color: #f07727; text-align: center; padding: 40px;">Failed to initialize 3D viewer. Please check console for errors.</div>' + container.innerHTML;
                        }
                    }
                }, 100);
            },
            onClose3D: () => {
                console.log('Closing 3D modal...');
                updateState({ isModalOpen: false });
                UI.toggle3DModal(false);
                Viewer3D.cleanup3DViewer();
            }
        };

        // Setup button event listeners
        this.setupButtonListeners();
    }

    setupButtonListeners() {
        // Add layer button
        const addLayerBtn = this.container.querySelector('#add-layer-btn');
        const layerTypeSelect = this.container.querySelector('#layer-type-select');
        
        if (addLayerBtn && layerTypeSelect) {
            addLayerBtn.addEventListener('click', () => {
                const type = layerTypeSelect.value;
                if (type) {
                    this.addLayer(type);
                    layerTypeSelect.value = '';
                }
            });
        }

        // 3D View button
        const view3dBtn = this.container.querySelector('#view-3d-btn');
        if (view3dBtn) {
            view3dBtn.addEventListener('click', this.eventHandlers.onOpen3D);
        }

        // Close 3D modal
        const close3dBtn = this.container.querySelector('#close-modal-3d-btn');
        if (close3dBtn) {
            close3dBtn.addEventListener('click', this.eventHandlers.onClose3D);
        }

        // Other control buttons
        const snapToggleBtn = this.container.querySelector('#snap-toggle-btn');
        if (snapToggleBtn) {
            snapToggleBtn.addEventListener('click', () => {
                updateState({ snapEnabled: !state.snapEnabled });
                UI.updateSnapDisplay();
            });
        }

        const gridToggleBtn = this.container.querySelector('#grid-toggle-btn');
        if (gridToggleBtn) {
            gridToggleBtn.addEventListener('click', this.eventHandlers.onGridToggle);
        } else {
            console.error('Grid toggle button not found!');
        }

        const xrayModeBtn = this.container.querySelector('#xray-mode-btn');
        if (xrayModeBtn) {
            xrayModeBtn.addEventListener('click', () => {
                updateState({ xrayMode: !state.xrayMode });
                // Update all canvas layers to reflect xray mode
                state.layersList.filter(l => l.onCanvas).forEach(layer => {
                    Canvas.updateCanvasLayer(layer);
                });
                xrayModeBtn.textContent = state.xrayMode ? 'X-RAY ON' : 'X-RAY OFF';
            });
        }

        const shadowModeBtn = this.container.querySelector('#shadow-mode-btn');
        if (shadowModeBtn) {
            shadowModeBtn.addEventListener('click', () => {
                updateState({ shadowMode: !state.shadowMode });
                // Update all canvas layers to reflect shadow mode
                state.layersList.filter(l => l.onCanvas).forEach(layer => {
                    Canvas.updateCanvasLayer(layer);
                });
                shadowModeBtn.textContent = state.shadowMode ? 'SHADOWS ON' : 'SHADOWS OFF';
            });
        }

    }

    // Layer management methods
    addLayer(type) {
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
        
        // Add text properties if this is a text layer
        if (definition.isText) {
            newLayer.text = definition.defaultText || '';
            newLayer.font = definition.defaultFont || 'Arial';
            newLayer.fontSize = definition.defaultFontSize || 24;
            newLayer.textAlign = definition.defaultTextAlign || 'center';
            newLayer.verticalAlign = definition.defaultVerticalAlign || 'middle';
            newLayer.lineSpacing = definition.defaultLineSpacing || 1.2;
            newLayer.kerning = definition.defaultKerning || 0;
            newLayer.textColor = definition.defaultTextColor || '#000000';
            
            // If this is a Braille layer, set special properties
            if (definition.isBraille) {
                newLayer.isBraille = true;
                // For Braille, position it 0.4" below the primary text layer if it exists
                const primaryTextLayer = state.layersList.find(l => l.type === 'primary-text' && l.onCanvas);
                if (primaryTextLayer) {
                    newLayer.x = primaryTextLayer.x;
                    newLayer.y = primaryTextLayer.y + primaryTextLayer.height + 0.4;
                }
            }
        }

        const newLayersList = [newLayer, ...state.layersList];
        updateState({ layersList: newLayersList });
        UI.refreshLayerList(this.eventHandlers);
    }


    deleteLayer(layerId) {
        const layerIndex = state.layersList.findIndex(l => l.id === layerId);
        if (layerIndex === -1) return;

        const newLayersList = state.layersList.filter(l => l.id !== layerId);
        const newLayerLinks = state.layerLinks.filter(link => link.from !== layerIndex && link.to !== layerIndex);

        updateState({
            layersList: newLayersList,
            layerLinks: newLayerLinks,
            currentLayer: (state.currentLayer?.id === layerId) ? null : state.currentLayer,
        });

        Canvas.removeCanvasLayer(layerId);
        UI.refreshLayerList(this.eventHandlers);
        this.updateLayerOrder();
        Canvas.updateDimensionsVisuals();
    }

    updateLayerOrder() {
        state.layersList.forEach((layer, index) => {
            layer.zIndex = state.layersList.length - 1 - index;
            if (layer.onCanvas) {
                Canvas.updateCanvasLayer(layer);
            }
        });
        UI.updateStackVisualization();
    }

    addLayerToCanvas(layer, x, y) {
        layer.x = x;
        layer.y = y;
        layer.onCanvas = true;
        
        updateState({ layersList: [...state.layersList] });
        Canvas.createCanvasLayer(layer, this.eventHandlers.onSelectLayer, this.eventHandlers.onStartDrag);
        UI.refreshLayerList(this.eventHandlers);
        UI.updateStackVisualization();
        Canvas.updateDimensionsVisuals();
    }

    startCanvasDrag(e, layer) {
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

        const onMouseMove = (moveEvent) => {
            const x = (moveEvent.clientX - rect.left - viewState.x) / viewState.zoom - offsetX;
            const y = (moveEvent.clientY - rect.top - viewState.y) / viewState.zoom - offsetY;
            
            const snapSize = this.getSnapSize();
            const snappedX = state.snapEnabled ? Math.round(x / (snapSize * SCALE_FACTOR)) * (snapSize * SCALE_FACTOR) : x;
            const snappedY = state.snapEnabled ? Math.round(y / (snapSize * SCALE_FACTOR)) * (snapSize * SCALE_FACTOR) : y;

            const deltaX = snappedX - lastX;
            const deltaY = snappedY - lastY;

            linkedLayers.forEach(linkedLayer => {
                linkedLayer.x += deltaX;
                linkedLayer.y += deltaY;
                const el = document.getElementById(linkedLayer.id + '-canvas');
                if(el) {
                    el.style.left = linkedLayer.x + 'px';
                    el.style.top = linkedLayer.y + 'px';
                }
            });

            lastX = snappedX;
            lastY = snappedY;
            UI.updateStackVisualization();
            Canvas.updateDimensionsVisuals();
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    getSnapSize() {
        return state.snapUnit === 'mm' ? state.snapValue / 25.4 : state.snapValue;
    }

    reorderLayerAtIndex(draggedId, insertIndex) {
        const draggedLayer = state.layersList.find(layer => layer.id === draggedId);
        if (!draggedLayer) return;
        
        const currentIndex = state.layersList.indexOf(draggedLayer);
        const newLayersList = [...state.layersList];
        newLayersList.splice(currentIndex, 1);
        
        let adjustedIndex = (currentIndex < insertIndex) ? insertIndex - 1 : insertIndex;
        newLayersList.splice(adjustedIndex, 0, draggedLayer);
        
        // Clear all links because indices are now invalid
        updateState({ 
            layersList: newLayersList,
            layerLinks: []
        });

        UI.refreshLayerList(this.eventHandlers);
        this.updateLayerOrder();
    }

    exportData() {
        return {
            version: this.version,
            appState: {
                layersList: state.layersList,
                layerLinks: state.layerLinks,
                layerCounter: state.layerCounter,
                snapValue: state.snapValue,
                snapUnit: state.snapUnit,
                faceViewState: state.faceViewState,
                sideViewState: state.sideViewState,
                currentSignType: state.currentSignType
            },
            exported: new Date().toISOString()
        };
    }

    async importData(data) {
        if (!data || !data.appState) {
            console.log('🎨 No design data to import');
            return;
        }

        const appState = data.appState;
        updateState({
            layersList: appState.layersList || [],
            layerLinks: appState.layerLinks || [],
            layerCounter: appState.layerCounter || 0,
            snapValue: appState.snapValue || 0.125,
            snapUnit: appState.snapUnit || 'inches',
            faceViewState: appState.faceViewState || { x: 0, y: 0, zoom: 1 },
            sideViewState: appState.sideViewState || { x: 0, y: 0, zoom: 1 },
            currentSignType: appState.currentSignType || null
        });

        // Refresh UI
        UI.refreshLayerList(this.eventHandlers);
        UI.updateStackVisualization();
        Canvas.updateAllCanvasLayers();
        
        console.log('🎨 Design data imported successfully');
    }

    async handleDataRequest(fromApp, query) {
        switch (query.type) {
            case 'get-layers':
                return { layers: state.layersList };
            case 'get-design-specs':
                return {
                    layers: state.layersList.map(layer => ({
                        id: layer.id,
                        type: layer.type,
                        name: layer.name,
                        width: layer.width,
                        height: layer.height,
                        thickness: layer.thickness,
                        material: layer.material
                    }))
                };
            case 'get-templates':
                // Return saved design templates (for now, return current layers as templates)
                const templates = state.layersList.filter(layer => layer.onCanvas).map(layer => ({
                    id: `template_${layer.id}`,
                    name: `Design Template ${layer.name}`,
                    layers: [layer],
                    width: layer.width,
                    height: layer.height,
                    backgroundColor: LAYER_DEFINITIONS[layer.type]?.color || '#ffffff',
                    created: new Date().toISOString(),
                    modified: new Date().toISOString()
                }));
                return { templates };
            case 'get-current-design':
                // Return the current design state
                const canvasLayers = state.layersList.filter(layer => layer.onCanvas);
                if (canvasLayers.length === 0) {
                    return { design: null };
                }
                return {
                    design: {
                        id: 'current',
                        name: 'Current Design',
                        layers: canvasLayers,
                        width: Math.max(...canvasLayers.map(l => l.width)),
                        height: Math.max(...canvasLayers.map(l => l.height)),
                        backgroundColor: '#ffffff'
                    }
                };
            default:
                return { error: 'Unknown query type' };
        }
    }

    async setupSignTypes() {
        // Get sign types from Mapping Slayer
        await this.loadSignTypesFromMapping();
        
        // Listen for sign type events
        if (window.appBridge) {
            window.appBridge.on('sign-type:created', async (data) => {
                // Reload sign types when created elsewhere
                await this.loadSignTypesFromMapping();
            });
            
            window.appBridge.on('sign-type:updated', async (data) => {
                // Reload sign types when updated
                await this.loadSignTypesFromMapping();
            });
            
            window.appBridge.on('sign-type:deleted', async (data) => {
                // Reload sign types when deleted
                await this.loadSignTypesFromMapping();
            });
        }
        
        // Setup UI event handlers
        const signTypeSelect = this.container.querySelector('#sign-type-select');
        const createBtn = this.container.querySelector('#create-sign-type-btn');
        const newForm = this.container.querySelector('#new-sign-type-form');
        const saveBtn = this.container.querySelector('#save-sign-type-btn');
        const cancelBtn = this.container.querySelector('#cancel-sign-type-btn');
        const currentInfo = this.container.querySelector('#current-sign-type-info');
        
        // Handle sign type selection
        if (signTypeSelect) {
            signTypeSelect.addEventListener('change', (e) => {
                const selectedType = e.target.value;
                if (selectedType) {
                    updateState({ currentSignType: selectedType });
                    this.showCurrentSignType(selectedType);
                    newForm.style.display = 'none';
                }
            });
        }
        
        // Handle create new sign type
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                newForm.style.display = 'block';
                currentInfo.style.display = 'none';
                signTypeSelect.value = '';
            });
        }
        
        // Handle save new sign type
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const code = this.container.querySelector('#new-sign-type-code').value.trim();
                const name = this.container.querySelector('#new-sign-type-name').value.trim();
                
                if (code && name) {
                    await this.createSignType(code, name);
                    newForm.style.display = 'none';
                    this.container.querySelector('#new-sign-type-code').value = '';
                    this.container.querySelector('#new-sign-type-name').value = '';
                }
            });
        }
        
        // Handle cancel
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                newForm.style.display = 'none';
                this.container.querySelector('#new-sign-type-code').value = '';
                this.container.querySelector('#new-sign-type-name').value = '';
            });
        }
    }
    
    async loadSignTypesFromMapping() {
        if (!window.appBridge) return;
        
        try {
            const response = await window.appBridge.sendRequest('mapping_slayer', {
                type: 'get-sign-types'
            });
            
            if (response && response.signTypes) {
                const select = this.container.querySelector('#sign-type-select');
                if (select) {
                    // Clear existing options except the first
                    while (select.options.length > 1) {
                        select.remove(1);
                    }
                    
                    // Add sign types
                    Object.entries(response.signTypes).forEach(([code, typeData]) => {
                        const option = document.createElement('option');
                        option.value = code;
                        option.textContent = `${code} - ${typeData.name}`;
                        select.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('Failed to load sign types:', error);
        }
    }
    
    showCurrentSignType(code) {
        const currentInfo = this.container.querySelector('#current-sign-type-info');
        const codeSpan = this.container.querySelector('#current-sign-type-code');
        const nameSpan = this.container.querySelector('#current-sign-type-name');
        
        if (currentInfo && window.appBridge) {
            window.appBridge.sendRequest('mapping_slayer', {
                type: 'get-sign-type-details',
                code: code
            }).then(response => {
                if (response && response.signType) {
                    codeSpan.textContent = response.signType.code;
                    nameSpan.textContent = response.signType.name;
                    currentInfo.style.display = 'block';
                }
            });
        }
    }
    
    async createSignType(code, name) {
        if (!window.appBridge) return;
        
        try {
            // Send to Mapping Slayer to create
            await window.appBridge.sendRequest('mapping_slayer', {
                type: 'create-sign-type',
                signType: {
                    code: code,
                    name: name,
                    color: '#F72020',
                    textColor: '#FFFFFF',
                    codeRequired: false,
                    defaultVinylBacker: false
                }
            });
            
            // Reload sign types
            await this.loadSignTypesFromMapping();
            
            // Select the new sign type
            const select = this.container.querySelector('#sign-type-select');
            if (select) {
                select.value = code;
                updateState({ currentSignType: code });
                this.showCurrentSignType(code);
            }
            
            
        } catch (error) {
            console.error('Failed to create sign type:', error);
        }
    }
}

export default DesignSlayerApp;
// apps/design_slayer/design-app.js
import SlayerAppBase from '../../core/slayer-app-base.js';
import { state, updateState, getNextLayerId, getLinkedGroup } from './state.js';
import { LAYER_DEFINITIONS, SCALE_FACTOR } from './config.js';
import * as UI from './ui.js';
import * as Canvas from './canvas.js';
import * as Viewer3D from './viewer3D.js';
import { fontManager } from './font-manager.js';
import { DataModels } from '../../core/index.js';

class DesignSlayerApp extends SlayerAppBase {
    constructor() {
        super('design_slayer', 'DESIGN SLAYER', '1.0.0');
        this.eventHandlers = null;
    }

    async activate() {
        // Call parent activate
        await super.activate();
    }

    async deactivate() {
        // Call parent deactivate
        await super.deactivate();
    }

    createAppContent() {
        const contentArea = this.getContentArea();
        
        // Read the original index.html structure and adapt it
        contentArea.innerHTML = `
            <div class="design-slayer-app">
                <!-- Main Content -->
                <div class="design-slayer-left-panel">
                <!-- Sign Type Section -->
                <div class="design-slayer-panel-section" style="flex: 0 0 auto; min-height: auto;">
                    <div class="design-slayer-panel-header">
                        <span>SIGN TYPE</span>
                        <button class="btn btn-compact btn-primary" id="create-sign-type-btn" style="font-size: 10px; padding: 3px 8px;">NEW</button>
                    </div>
                    <div class="design-slayer-panel-content" style="padding: 10px;">
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
                <div class="design-slayer-panel-section">
                    <div class="design-slayer-panel-header">
                        <span>SIGN LAYERS</span>
                        <div class="layer-controls">
                            <select id="layer-type-select" class="layer-dropdown">
                                <option value="">Select Layer Type</option>
                                <option value="plate">Plate</option>
                                <option value="paragraph-text">Paragraph Text</option>
                                <option value="braille-text">Braille Text</option>
                                <option value="logo">Logo</option>
                                <option value="icon">Icon</option>
                            </select>
                            <button class="btn-add" id="add-layer-btn">+</button>
                        </div>
                    </div>
                    <div class="design-slayer-panel-content">
                        <div class="layers-list" id="layers-list">
                            <div class="empty-state">
                                Select a layer type and click + to add your first layer.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Center - Design Views -->
            <div class="design-slayer-center-panel">
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
            <div class="design-slayer-footer-controls">
                <div class="design-slayer-control-group">
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
                
                <div class="design-slayer-control-group right-controls">
                    <button class="btn btn-secondary btn-compact" id="import-template-btn">IMPORT TEMPLATE</button>
                    <button class="btn btn-primary btn-compact" id="export-template-btn">EXPORT TEMPLATE</button>
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
        
        // Always load Design Slayer styles
        await this.loadAppStyles();
        
        // Initialize functionality after styles are loaded
        await this.initializeDesignFunctionality();
    }
    
    async activate() {
        await super.activate();
    }
    
    async deactivate() {
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
        
        // Initialize sync adapter
        const { designSyncAdapter } = await import('./design-sync.js');
        this.syncAdapter = designSyncAdapter;
        
        // Initialize sync with app bridge if available
        if (window.appBridge) {
            this.syncAdapter.initialize(window.appBridge);
        }
        
        // Test Braille translation after everything is loaded
        setTimeout(() => {
            import('./braille-translator-v2.js').then(({ testBrailleTranslation }) => {
                testBrailleTranslation();
            }).catch(error => {
                console.error('Failed to load Braille translator:', error);
            });
        }, 2000); // Give time for worker to initialize
        
        // Initialize event handlers
        this.setupEventHandlers();
        
        // Setup canvas interactions
        Canvas.setupCanvas(this.eventHandlers);
        
        // Setup snap flyout
        UI.setupSnapFlyout(this.eventHandlers);
        
        // Setup sign type handlers
        this.setupSignTypeHandlers();
        
        // Setup 3D modal
        UI.setup3DModal(this.eventHandlers);
        
        // Setup sign type functionality
        await this.setupSignTypes();
        
        // Setup template functionality
        await this.setupTemplates();
        
        // Setup template export/import handlers
        this.setupTemplateExportImport();
        
        // Setup auto-save functionality
        this.setupAutoSave();
        
        // Initial UI refresh
        UI.refreshLayerList(this.eventHandlers);
        
        console.log('✅ Design Slayer functionality initialized');
        
        // Expose design app instance globally for sync
        window.designApp = this;
    }

    setupSignTypeHandlers() {
        const signTypeSelect = document.getElementById('sign-type-select');
        const createSignTypeBtn = document.getElementById('create-sign-type-btn');
        const newSignTypeForm = document.getElementById('new-sign-type-form');
        const saveSignTypeBtn = document.getElementById('save-sign-type-btn');
        const cancelSignTypeBtn = document.getElementById('cancel-sign-type-btn');
        const currentSignTypeInfo = document.getElementById('current-sign-type-info');
        
        // Handle sign type selection
        if (signTypeSelect) {
            signTypeSelect.addEventListener('change', (e) => {
                const selectedCode = e.target.value;
                if (selectedCode) {
                    state.currentSignType = selectedCode;
                    currentSignTypeInfo.style.display = 'block';
                    document.getElementById('current-sign-type-code').textContent = selectedCode;
                    
                    const signType = this.syncAdapter.getSignType(selectedCode);
                    if (signType) {
                        document.getElementById('current-sign-type-name').textContent = signType.name;
                    }
                    
                    // Update layer dropdown with sign type fields
                    this.syncAdapter.updateLayerDropdown();
                    
                    // Load existing template if available
                    this.loadTemplateForSignType(selectedCode);
                } else {
                    state.currentSignType = null;
                    currentSignTypeInfo.style.display = 'none';
                    
                    // Update layer dropdown to remove sign type fields
                    this.syncAdapter.updateLayerDropdown();
                }
                updateState({ isDirty: true });
            });
        }
        
        // Handle create new sign type
        if (createSignTypeBtn) {
            createSignTypeBtn.addEventListener('click', () => {
                newSignTypeForm.style.display = 'block';
                signTypeSelect.style.display = 'none';
                document.getElementById('new-sign-type-code').focus();
            });
        }
        
        // Handle save new sign type
        if (saveSignTypeBtn) {
            saveSignTypeBtn.addEventListener('click', async () => {
                const code = document.getElementById('new-sign-type-code').value.trim();
                const name = document.getElementById('new-sign-type-name').value.trim();
                
                if (!code || !name) {
                    alert('Please enter both code and name for the sign type.');
                    return;
                }
                
                try {
                    await this.syncAdapter.createSignType(code, name);
                    
                    // Reset form
                    document.getElementById('new-sign-type-code').value = '';
                    document.getElementById('new-sign-type-name').value = '';
                    newSignTypeForm.style.display = 'none';
                    signTypeSelect.style.display = 'block';
                    
                    // Select the new sign type
                    signTypeSelect.value = code;
                    signTypeSelect.dispatchEvent(new Event('change'));
                } catch (error) {
                    alert('Error creating sign type: ' + error.message);
                }
            });
        }
        
        // Handle cancel
        if (cancelSignTypeBtn) {
            cancelSignTypeBtn.addEventListener('click', () => {
                document.getElementById('new-sign-type-code').value = '';
                document.getElementById('new-sign-type-name').value = '';
                newSignTypeForm.style.display = 'none';
                signTypeSelect.style.display = 'block';
            });
        }
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
        let definition = LAYER_DEFINITIONS[type];
        let isFieldLayer = false;
        let fieldName = '';
        
        // Check if this is a dynamic field layer
        if (type.startsWith('field:')) {
            fieldName = type.substring(6);
            isFieldLayer = true;
            
            // Use paragraph-text as template for field layers
            definition = LAYER_DEFINITIONS['paragraph-text'];
            if (!definition) return;
        } else if (!definition) {
            return;
        }

        const layerId = `layer-${getNextLayerId()}`;
        const existingCount = state.layersList.filter(layer => 
            isFieldLayer ? layer.fieldName === fieldName : layer.type === type
        ).length;

        const newLayer = {
            id: layerId,
            type: isFieldLayer ? 'paragraph-text' : type,
            name: isFieldLayer ? `${fieldName} Field${existingCount > 0 ? ` ${existingCount + 1}` : ''}` : `${definition.name} ${existingCount + 1}`,
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
        
        // Add field-specific properties
        if (isFieldLayer) {
            newLayer.fieldName = fieldName;
            newLayer.text = `{{${fieldName}}}`;
            newLayer.isFieldLayer = true;
        }
        
        // Add text properties if this is a text layer
        if (definition.isText) {
            newLayer.text = definition.defaultText || '';
            
            // Handle font with fallback for Braille layers
            if (definition.isBraille) {
                // Check if Braille.ttf is available, otherwise fall back to Arial
                const preferredFonts = ['Braille.ttf', 'Arial'];
                newLayer.font = fontManager.getBestAvailableFont(preferredFonts, 'Arial');
            } else {
                newLayer.font = definition.defaultFont || 'Arial';
            }
            
            // Calculate font size for braille to achieve 0.239" x-height
            if (definition.isBraille) {
                // Import dynamically to calculate font size
                import('./text-renderer.js').then(({ calculateFontSizeForXHeight }) => {
                    const calculatedSize = calculateFontSizeForXHeight(0.239, newLayer.font);
                    newLayer.fontSize = calculatedSize;
                    // Update the layer if it's already been added
                    const layerIndex = state.layersList.findIndex(l => l.id === newLayer.id);
                    if (layerIndex !== -1) {
                        updateState({ isDirty: true });
                    }
                }).catch(() => {
                    // Fallback to default if calculation fails
                    newLayer.fontSize = definition.defaultFontSize || 24;
                });
                // Set initial size while calculating
                newLayer.fontSize = definition.defaultFontSize || 24;
            } else {
                newLayer.fontSize = definition.defaultFontSize || 24;
            }
            newLayer.textAlign = definition.defaultTextAlign || 'center';
            newLayer.verticalAlign = definition.defaultVerticalAlign || 'middle';
            newLayer.lineSpacing = definition.defaultLineSpacing || 1.2;
            newLayer.kerning = definition.defaultKerning || 0;
            newLayer.textColor = definition.defaultTextColor || '#000000';
            
            // If this is a Braille layer, set special properties
            if (definition.isBraille) {
                newLayer.isBraille = true;
                newLayer.brailleSourceText = definition.defaultBrailleSourceText || 'Sample Text';
                // For Braille, position it 0.4" below the first paragraph text layer if it exists
                const paragraphTextLayer = state.layersList.find(l => l.type === 'paragraph-text' && l.onCanvas);
                if (paragraphTextLayer) {
                    newLayer.x = paragraphTextLayer.x;
                    newLayer.y = paragraphTextLayer.y + paragraphTextLayer.height + 0.4;
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
        
        updateState({ layersList: [...state.layersList], isDirty: true });
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
        // Get all templates from template manager
        const templates = {};
        if (this.templateManager) {
            this.templateManager.templates.forEach((template, code) => {
                templates[code] = template.toJSON();
            });
        }
        
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
            templates: templates,
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

        // Import templates if available
        if (data.templates && this.templateManager) {
            this.templateManager.templates.clear();
            Object.entries(data.templates).forEach(([code, templateData]) => {
                try {
                    const { DesignTemplate } = DataModels;
                    const template = new DesignTemplate(templateData);
                    this.templateManager.templates.set(code, template);
                } catch (error) {
                    console.error(`Failed to import template ${code}:`, error);
                }
            });
            
            // Save templates to localStorage
            this.templateManager.saveTemplatesToStorage();
            console.log(`🎨 Imported ${Object.keys(data.templates).length} templates`);
        }

        // Refresh UI
        UI.refreshLayerList(this.eventHandlers);
        UI.updateStackVisualization();
        Canvas.updateAllCanvasLayers();
        
        // Update sign type dropdown if needed
        if (this.syncAdapter) {
            this.syncAdapter.updateSignTypeUI();
        }
        
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
                // Return templates from template manager if available
                if (this.templateManager) {
                    const templates = [];
                    this.templateManager.templates.forEach((template, signTypeCode) => {
                        templates.push(template.toJSON());
                    });
                    // Removed debug log: Returning templates
                    return { templates };
                }
                // Fallback: return empty templates array
                // Removed debug log: No template manager, returning empty array
                return { templates: [] };
            case 'get-current-design':
                // Return the current design state with full canvas data
                const canvasLayers = state.layersList.filter(layer => layer.onCanvas);
                if (canvasLayers.length === 0) {
                    return { design: null };
                }
                
                // Extract full canvas data using template manager
                if (this.templateManager) {
                    const canvasData = this.templateManager.extractCanvasData(state.layersList);
                    return {
                        design: {
                            id: 'current',
                            name: 'Current Design',
                            signTypeCode: state.currentSignType,
                            faceView: {
                                canvas: canvasData,
                                dimensions: canvasData.dimensions
                            },
                            width: canvasData.dimensions.width,
                            height: canvasData.dimensions.height,
                            backgroundColor: '#ffffff'
                        }
                    };
                }
                
                // Fallback
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
            case 'get-design-for-sign-type':
                // Return the saved template for a specific sign type
                const signTypeCode = query.signTypeCode;
                // Removed debug log: get-design-for-sign-type request
                
                if (!signTypeCode) {
                    return { error: 'Sign type code required' };
                }
                
                // Ensure template manager has loaded from storage
                if (this.templateManager && this.templateManager.templates.size === 0) {
                    // Removed debug log: Template manager empty, reloading from storage...
                    this.templateManager.loadTemplatesFromStorage();
                }
                
                // Check if we have the template in memory
                if (this.templateManager && this.templateManager.hasTemplate(signTypeCode)) {
                    const template = this.templateManager.getTemplate(signTypeCode);
                    const templateData = template.toJSON();
                    // Removed debug log: Found template in memory!
                    return { template: templateData };
                }
                
                // If not in memory, check if we have a current design for this sign type
                if (state.currentSignType === signTypeCode && state.layersList.some(l => l.onCanvas)) {
                    // Removed debug log: No saved template, but current design matches sign type. Creating template on-the-fly...
                    
                    // Create a template from current state
                    const canvasData = this.templateManager.extractCanvasData(state.layersList);
                    const tempTemplate = {
                        id: `temp_${signTypeCode}`,
                        signTypeCode: signTypeCode,
                        name: `${signTypeCode} Template`,
                        faceView: {
                            canvas: canvasData,
                            dimensions: canvasData.dimensions,
                            textFields: this.templateManager.extractTextFields(canvasData),
                            graphics: this.templateManager.extractGraphics(canvasData),
                            backgroundColor: '#ffffff'
                        },
                        sideView: {
                            canvas: { layers: [], dimensions: { width: 2, height: canvasData.dimensions.height } },
                            textFields: [],
                            graphics: []
                        },
                        width: canvasData.dimensions.width,
                        height: canvasData.dimensions.height,
                        backgroundColor: '#ffffff',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    
                    // Removed debug log: Returning on-the-fly template
                    return { template: tempTemplate };
                }
                
                // Removed debug log: No template found for sign type
                return { template: null };
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

    async setupTemplates() {
        // Import template manager - keeping this for future use
        const { templateManager } = await import('./template-manager.js');
        this.templateManager = templateManager;
        
        // Log loaded templates from storage
        // Removed debug log: Templates loaded from storage
        
        // Template UI functionality is temporarily disabled
        // The infrastructure remains intact for future reactivation
        
        /* Commented out template UI event listeners
        // Save template button
        const saveTemplateBtn = document.getElementById('save-template-btn');
        if (saveTemplateBtn) {
            saveTemplateBtn.addEventListener('click', async () => {
                if (!state.currentSignType) {
                    alert('Please select a sign type first');
                    return;
                }
                
                if (state.layersList.filter(l => l.onCanvas).length === 0) {
                    alert('No layers on canvas to save as template');
                    return;
                }
                
                try {
                    const templateName = prompt('Enter template name:', `${state.currentSignType} Template`);
                    if (!templateName) return;
                    
                    const template = await this.templateManager.saveAsTemplate(state.currentSignType, templateName);
                    console.log('Template saved:', template);
                    alert(`Template "${templateName}" saved successfully!`);
                } catch (error) {
                    console.error('Failed to save template:', error);
                    alert(`Failed to save template: ${error.message}`);
                }
            });
        }
        
        // Load template button
        const loadTemplateBtn = document.getElementById('load-template-btn');
        if (loadTemplateBtn) {
            loadTemplateBtn.addEventListener('click', async () => {
                if (!state.currentSignType) {
                    alert('Please select a sign type first');
                    return;
                }
                
                if (!this.templateManager.hasTemplate(state.currentSignType)) {
                    alert(`No template found for sign type ${state.currentSignType}`);
                    return;
                }
                
                if (state.layersList.length > 0) {
                    const confirmed = confirm('Loading a template will replace the current design. Continue?');
                    if (!confirmed) return;
                }
                
                try {
                    const success = await this.templateManager.loadTemplate(state.currentSignType);
                    if (success) {
                        // Re-register canvas layers with proper event handlers
                        state.layersList.forEach(layer => {
                            if (layer.onCanvas) {
                                Canvas.createCanvasLayer(
                                    layer,
                                    this.eventHandlers.onSelectLayer,
                                    this.eventHandlers.onStartDrag
                                );
                            }
                        });
                        UI.refreshLayerList(this.eventHandlers);
                        this.updateLayerOrder();
                        alert('Template loaded successfully!');
                    }
                } catch (error) {
                    console.error('Failed to load template:', error);
                    alert(`Failed to load template: ${error.message}`);
                }
            });
        }
        
        // Template library button
        const templateLibraryBtn = document.getElementById('template-library-btn');
        if (templateLibraryBtn) {
            templateLibraryBtn.addEventListener('click', () => {
                this.showTemplateLibrary();
            });
        }
        
        // Close template library button
        const closeTemplateLibraryBtn = document.getElementById('close-template-library-btn');
        if (closeTemplateLibraryBtn) {
            closeTemplateLibraryBtn.addEventListener('click', () => {
                document.getElementById('template-library-modal').style.display = 'none';
            });
        }
        */
    }

    // Template library display method - kept for future reactivation
    /* Commented out template library UI
    showTemplateLibrary() {
        const modal = document.getElementById('template-library-modal');
        const grid = document.getElementById('template-grid');
        
        if (!modal || !grid) return;
        
        // Clear grid
        grid.innerHTML = '';
        
        // Get all templates
        const templates = this.templateManager.listTemplates();
        
        if (templates.length === 0) {
            grid.innerHTML = '<div class="empty-state">No templates saved yet. Create your first template by designing a sign and clicking "Save Template".</div>';
        } else {
            templates.forEach(template => {
                const card = document.createElement('div');
                card.className = 'template-card';
                card.innerHTML = `
                    <div class="template-preview">
                        <div class="template-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <line x1="9" y1="9" x2="15" y2="9"/>
                                <line x1="9" y1="13" x2="15" y2="13"/>
                                <line x1="9" y1="17" x2="11" y2="17"/>
                            </svg>
                        </div>
                    </div>
                    <div class="template-info">
                        <h3>${template.name}</h3>
                        <p>Sign Type: ${template.code}</p>
                        <p>${template.layerCount} layers, ${template.textFieldCount} text fields</p>
                        <div class="template-actions">
                            <button class="btn btn-compact btn-primary" data-code="${template.code}">Load</button>
                            <button class="btn btn-compact btn-secondary" data-code="${template.code}" data-action="delete">Delete</button>
                        </div>
                    </div>
                `;
                
                // Add event listeners
                const loadBtn = card.querySelector('.btn-primary');
                loadBtn.addEventListener('click', async () => {
                    modal.style.display = 'none';
                    
                    // Set the sign type first
                    const signTypeSelect = document.getElementById('sign-type-select');
                    if (signTypeSelect) {
                        signTypeSelect.value = template.code;
                        signTypeSelect.dispatchEvent(new Event('change'));
                    }
                    
                    // Then load the template
                    setTimeout(async () => {
                        try {
                            await this.templateManager.loadTemplate(template.code);
                            // Re-register canvas layers
                            state.layersList.forEach(layer => {
                                if (layer.onCanvas) {
                                    Canvas.createCanvasLayer(
                                        layer,
                                        this.eventHandlers.onSelectLayer,
                                        this.eventHandlers.onStartDrag
                                    );
                                }
                            });
                            UI.refreshLayerList(this.eventHandlers);
                            this.updateLayerOrder();
                        } catch (error) {
                            console.error('Failed to load template:', error);
                            alert(`Failed to load template: ${error.message}`);
                        }
                    }, 100);
                });
                
                const deleteBtn = card.querySelector('[data-action="delete"]');
                deleteBtn.addEventListener('click', async () => {
                    if (confirm(`Delete template "${template.name}"?`)) {
                        await this.templateManager.deleteTemplate(template.code);
                        this.showTemplateLibrary(); // Refresh
                    }
                });
                
                grid.appendChild(card);
            });
        }
        
        modal.style.display = 'flex';
    }
    */
    
    setupAutoSave() {
        // Auto-save when layers change and a sign type is selected
        let saveTimeout = null;
        
        // Watch for state changes
        const originalUpdateState = window.updateState || updateState;
        window.updateState = (updates) => {
            originalUpdateState(updates);
            
            // Trigger auto-save if we have a sign type and canvas layers
            if (state.currentSignType && state.layersList.some(l => l.onCanvas)) {
                // Debounce saves to avoid too frequent updates
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    this.autoSaveTemplate();
                }, 2000); // Save after 2 seconds of inactivity
            }
        };
    }
    
    async autoSaveTemplate() {
        // Removed debug log: autoSaveTemplate called
        
        if (!state.currentSignType || !this.templateManager) return;
        
        try {
            // Only save if we have canvas layers
            const canvasLayers = state.layersList.filter(l => l.onCanvas);
            if (canvasLayers.length === 0) {
                // Removed debug log: No canvas layers to save
                return;
            }
            
            // Removed debug log: Canvas layers to save
            
            // Save the template silently
            const template = await this.templateManager.saveAsTemplate(
                state.currentSignType,
                `${state.currentSignType} Template`
            );
            
            console.log(`✅ Auto-saved template for ${state.currentSignType}`, {
                templateId: template.id,
                templatesInMemory: Array.from(this.templateManager.templates.keys()),
                templateData: template.toJSON()
            });
            
            // Broadcast template update to other apps
            if (window.appBridge) {
                // Removed debug log: Broadcasting template update to other apps
                window.appBridge.broadcast('template-updated', {
                    signTypeCode: state.currentSignType,
                    template: template.toJSON()
                });
            }
        } catch (error) {
            // Removed debug error: Auto-save failed!
        }
    }

    /**
     * Setup template export/import functionality
     */
    setupTemplateExportImport() {
        // Export template button
        const exportTemplateBtn = document.getElementById('export-template-btn');
        if (exportTemplateBtn) {
            exportTemplateBtn.addEventListener('click', async () => {
                if (!state.currentSignType) {
                    alert('Please select a sign type first');
                    return;
                }
                
                if (state.layersList.filter(l => l.onCanvas).length === 0) {
                    alert('No layers on canvas to export');
                    return;
                }
                
                try {
                    // Create template data
                    const template = await this.templateManager.saveAsTemplate(state.currentSignType);
                    
                    // Export as .dslayer file
                    const exportData = {
                        version: '1.0',
                        type: 'design_template',
                        meta: {
                            exported: new Date().toISOString(),
                            signTypeCode: state.currentSignType
                        },
                        template: template.toJSON()
                    };
                    
                    const jsonStr = JSON.stringify(exportData, null, 2);
                    const blob = new Blob([jsonStr], { type: 'application/json' });
                    
                    // Generate filename
                    const filename = `${state.currentSignType}_template.dslayer`;
                    
                    // Download file
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    console.log(`✅ Template exported as ${filename}`);
                } catch (error) {
                    console.error('Failed to export template:', error);
                    alert(`Failed to export template: ${error.message}`);
                }
            });
        }
        
        // Import template button
        const importTemplateBtn = document.getElementById('import-template-btn');
        if (importTemplateBtn) {
            importTemplateBtn.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.dslayer,.slayer';
                
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    
                    try {
                        // Read file content
                        const content = await this.readFile(file);
                        const data = JSON.parse(content);
                        
                        // Check if it's a template file
                        if (data.type === 'design_template' && data.template) {
                            // Import the template
                            const template = new (await import('../../core/index.js')).DataModels.DesignTemplate(data.template);
                            
                            // Get or create sign type
                            const signTypeCode = data.meta.signTypeCode || template.signTypeCode;
                            
                            if (!signTypeCode) {
                                alert('Invalid template file: no sign type specified');
                                return;
                            }
                            
                            // Check if sign type exists
                            let signType = this.syncAdapter.getSignType(signTypeCode);
                            if (!signType) {
                                // Create sign type
                                const name = prompt(`Sign type "${signTypeCode}" not found. Enter a name for it:`, signTypeCode);
                                if (!name) return;
                                
                                await this.syncAdapter.createSignType(signTypeCode, name);
                            }
                            
                            // Store template
                            this.templateManager.templates.set(signTypeCode, template);
                            this.templateManager.saveTemplatesToStorage();
                            
                            // Select sign type and load template
                            const signTypeSelect = document.getElementById('sign-type-select');
                            if (signTypeSelect) {
                                signTypeSelect.value = signTypeCode;
                                signTypeSelect.dispatchEvent(new Event('change'));
                            }
                            
                            // Load the template
                            await this.templateManager.loadTemplate(signTypeCode);
                            
                            // Refresh UI
                            UI.refreshLayerList(this.eventHandlers);
                            Canvas.updateAllCanvasLayers();
                            
                            alert('Template imported successfully!');
                        }
                        // Check if it's a project file with templates - support both format types
                        else if ((data.type === 'slayer_project' || data.type === 'slayer_suite_project') && data.apps?.design_slayer?.templates) {
                            // Show template selection dialog
                            const templates = Object.entries(data.apps.design_slayer.templates);
                            if (templates.length === 0) {
                                alert('No templates found in this project file');
                                return;
                            }
                            
                            // For simplicity, import all templates
                            let imported = 0;
                            for (const [code, templateData] of templates) {
                                try {
                                    const template = new (await import('../../core/index.js')).DataModels.DesignTemplate(templateData);
                                    this.templateManager.templates.set(code, template);
                                    imported++;
                                } catch (err) {
                                    console.error(`Failed to import template ${code}:`, err);
                                }
                            }
                            
                            this.templateManager.saveTemplatesToStorage();
                            alert(`Imported ${imported} template${imported !== 1 ? 's' : ''} from project file`);
                        } else {
                            alert('Invalid file format. Please select a .dslayer template file or .slayer project file.');
                        }
                    } catch (error) {
                        console.error('Failed to import template:', error);
                        alert(`Failed to import template: ${error.message}`);
                    }
                };
                
                input.click();
            });
        }
    }
    
    /**
     * Read file content
     */
    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
    
    async loadTemplateForSignType(signTypeCode) {
        if (!this.templateManager || !this.templateManager.hasTemplate(signTypeCode)) {
            return;
        }
        
        try {
            // Clear current canvas
            state.layersList.forEach(layer => {
                if (layer.onCanvas) {
                    Canvas.removeCanvasLayer(layer.id);
                }
            });
            
            // Load the template
            const success = await this.templateManager.loadTemplate(signTypeCode);
            if (success) {
                // Re-create canvas layers with event handlers
                state.layersList.forEach(layer => {
                    if (layer.onCanvas) {
                        Canvas.createCanvasLayer(
                            layer,
                            this.eventHandlers.onSelectLayer,
                            this.eventHandlers.onStartDrag
                        );
                    }
                });
                
                UI.refreshLayerList(this.eventHandlers);
                this.updateLayerOrder();
                console.log(`✅ Loaded template for ${signTypeCode}`);
            }
        } catch (error) {
            console.error('Failed to load template:', error);
        }
    }
    
}

export default DesignSlayerApp;
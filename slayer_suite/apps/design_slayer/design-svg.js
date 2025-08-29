/**
 * design-svg.js
 * SVG-based design system for Design Slayer
 * Replaces the Canvas-based rendering with clean SVG implementation using SVG.js
 */

import { state, updateState, getLinkedGroup } from './state.js';
import { PIXELS_PER_MM } from './units.js';
import { LAYER_DEFINITIONS } from './config.js';
import { updateDimensionsDisplay } from './ui.js';

// SVG.js will be loaded dynamically
let SVG = null;

export class DesignSVG {
    constructor() {
        this.svg = null;
        this.viewport = null;
        this.rulerGroup = null;
        this.gridGroup = null;
        this.layersGroup = null;
        this.selectionsGroup = null;
        this.initialized = false;

        // Ruler and grid constants
        this.RULER_SIZE = 30;
        this.PIXELS_PER_MM = PIXELS_PER_MM;

        // Viewport state
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.gridVisible = true;
        this.rulersVisible = true;

        // Layer registry
        this.layers = new Map();
        this.selectionHandles = null;

        // Grid settings
        this.snapToGridEnabled = true;
        this.snapInterval = 5; // mm

        // Performance: Cache grid and ruler elements
        this.gridLineCache = new Map(); // Cache grid line SVG elements
        this.rulerMarkCache = new Map(); // Cache ruler mark SVG elements
        this.useElementCaching = true; // Enable element caching for performance
    }

    /**
     * Load SVG.js library dynamically
     */
    async loadSVGLibrary() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = './apps/design_slayer/lib/svg.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Initialize the SVG system
     */
    async initialize() {
        if (this.initialized) return;

        // Load SVG.js if not already available
        if (!SVG) {
            if (window.SVG) {
                SVG = window.SVG;
            } else {
                // Load SVG.js script
                await this.loadSVGLibrary();
                SVG = window.SVG;
            }
        }

        if (!SVG) {
            console.error('Failed to load SVG.js library');
            return;
        }

        const faceCanvas = document.getElementById('face-canvas');
        if (!faceCanvas) {
            console.error('face-canvas element not found');
            return;
        }

        // Clean up any old elements
        const oldElements = faceCanvas.querySelectorAll(
            '.unified-ruler-grid, .grid-canvas, .ruler-horizontal, .ruler-vertical, .ruler-corner, .canvas-grid'
        );
        oldElements.forEach(el => el.remove());

        // Create main SVG container
        this.svg = SVG().addTo(faceCanvas).size('100%', '100%');
        this.svg.addClass('design-svg-main');
        this.svg.style({
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            'z-index': 1
        });

        // Set up coordinate system and viewBox
        this.setupCoordinateSystem();

        // Debug: Check what's capturing mouse events
        this.svg.node.addEventListener('mousedown', e => {
            console.log(
                '🔍 SVG clicked, target:',
                e.target,
                'classList:',
                e.target.classList ? e.target.classList.value : 'none'
            );
        });

        // Mouse sniffer disabled - uncomment to enable for debugging
        // this.createMouseSniffer();

        // Remove any existing mouse sniffer
        const existingSniffer = document.getElementById('mouse-sniffer');
        if (existingSniffer) {
            existingSniffer.remove();
        }

        // Create layer groups in proper order
        this.gridGroup = this.svg.group().addClass('grid-group').style('pointer-events', 'none');
        this.rulerGroup = this.svg.group().addClass('ruler-group').style('pointer-events', 'none');
        this.layersGroup = this.svg.group().addClass('layers-group').style('pointer-events', 'all');
        this.selectionsGroup = this.svg
            .group()
            .addClass('selections-group')
            .style('pointer-events', 'none');

        // Create viewport group for layer transformations
        this.viewport = this.layersGroup
            .group()
            .addClass('viewport-group')
            .style('pointer-events', 'all');

        // Set initial visibility
        this.setGridVisible(state.gridVisible);
        this.setRulersVisible(state.rulersVisible);

        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());

        // Handle document visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                setTimeout(() => this.forceRefresh(), 100);
            }
        });

        this.initialized = true;

        // Set initial viewport state
        this.updateViewport(state.faceViewState.zoom, state.faceViewState.x, state.faceViewState.y);

        // Initial render
        this.render();

        console.log('✅ SVG design system initialized');
        console.log('📋 SVG System Ready:', {
            svg: !!this.svg,
            viewport: !!this.viewport,
            rulerGroup: !!this.rulerGroup,
            gridGroup: !!this.gridGroup,
            layersGroup: !!this.layersGroup,
            selectionsGroup: !!this.selectionsGroup
        });
    }

    /**
     * Create a mouse position sniffer for debugging
     */
    createMouseSniffer() {
        const faceCanvas = document.getElementById('face-canvas');

        // Remove any existing sniffer first
        const existingSniffer = document.getElementById('mouse-sniffer');
        if (existingSniffer) {
            existingSniffer.remove();
        }

        // Create sniffer display
        const sniffer = document.createElement('div');
        sniffer.id = 'mouse-sniffer';
        sniffer.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.9);
            color: #0ff;
            padding: 10px;
            font-family: monospace;
            font-size: 12px;
            border: 1px solid #0ff;
            border-radius: 4px;
            z-index: 10000;
            min-width: 300px;
            pointer-events: none;
        `;
        document.body.appendChild(sniffer);

        // Track mouse movement
        faceCanvas.addEventListener('mousemove', e => {
            const rect = faceCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Get element at point
            const elementAtPoint = document.elementFromPoint(e.clientX, e.clientY);

            // Get all elements at this point
            const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);

            // Build element stack info
            const stackInfo = elementsAtPoint
                .slice(0, 5)
                .map(el => {
                    const id = el.id ? `#${el.id}` : '';
                    const classes =
                        el.classList.length > 0 ? `.${Array.from(el.classList).join('.')}` : '';
                    const tag = el.tagName.toLowerCase();
                    const dataAttrs = Array.from(el.attributes)
                        .filter(attr => attr.name.startsWith('data-'))
                        .map(attr => `${attr.name}="${attr.value}"`)
                        .join(' ');
                    const pointerEvents = window.getComputedStyle(el).pointerEvents;
                    return `  ${tag}${id}${classes} [${pointerEvents}] ${dataAttrs}`;
                })
                .join('\n');

            sniffer.innerHTML = `
                <div style="color: #0ff; font-weight: bold;">🎯 MOUSE SNIFFER</div>
                <div>Position: ${Math.round(x)}, ${Math.round(y)}</div>
                <div>Top Element: ${elementAtPoint ? elementAtPoint.tagName : 'none'}</div>
                <div style="margin-top: 5px; color: #f07727;">Element Stack:</div>
                <pre style="margin: 2px 0; color: #fff; font-size: 11px;">${stackInfo}</pre>
            `;
        });

        // Track mouse clicks
        faceCanvas.addEventListener('click', e => {
            console.log('🖱️ CLICK EVENT:', {
                target: e.target,
                currentTarget: e.currentTarget,
                path: e.composedPath(),
                clientX: e.clientX,
                clientY: e.clientY
            });
        });
    }

    /**
     * Set up the SVG coordinate system and viewBox
     */
    setupCoordinateSystem() {
        // Get container dimensions
        const container = this.svg.node.parentElement;
        const rect = container.getBoundingClientRect();

        // Set viewBox to match container with ruler offset
        this.svg.viewbox(0, 0, rect.width, rect.height);
    }

    /**
     * Handle window resize events
     */
    handleResize() {
        if (!this.initialized) return;

        this.setupCoordinateSystem();
        this.render();
    }

    /**
     * Force a complete refresh
     */
    forceRefresh() {
        if (!this.initialized) return;

        this.handleResize();
        this.render();
    }

    /**
     * Set zoom level programmatically (for testing)
     */
    setZoom(zoomLevel) {
        this.updateViewport(zoomLevel, this.panX, this.panY);
    }

    /**
     * Update viewport transformation
     */
    updateViewport(zoom, panX, panY) {
        const perfStart = performance.now();

        this.zoom = zoom;
        this.panX = panX;
        this.panY = panY;

        if (this.viewport) {
            // Apply viewport transformation to the layers group
            // Account for ruler offset to align with grid
            // Translate first (including ruler offset), then scale from origin
            const transformStart = performance.now();
            this.viewport.transform({
                translateX: panX + this.RULER_SIZE,
                translateY: panY + this.RULER_SIZE,
                scaleX: zoom,
                scaleY: zoom,
                originX: 0,
                originY: 0
            });
            const transformTime = performance.now() - transformStart;

            if (transformTime > 5) {
                console.log(`⚠️ Viewport transform took ${transformTime.toFixed(1)}ms`);
            }
        }

        // Throttle grid/ruler updates - they're expensive!
        if (this.renderThrottleTimer) {
            clearTimeout(this.renderThrottleTimer);
        }

        this.renderThrottleTimer = setTimeout(() => {
            const gridStart = performance.now();
            this.renderRulers();
            this.renderGrid();

            // Update selection handle positions for zoom changes
            if (state.currentElement && this.selectionHandles) {
                this.updateSelectionHandlePositions();
            }

            const gridTime = performance.now() - gridStart;

            if (gridTime > 10) {
                console.log(`⚠️ Grid/ruler render took ${gridTime.toFixed(1)}ms`);
            }
        }, 16); // ~60fps throttle

        const totalTime = performance.now() - perfStart;
        if (totalTime > 10) {
            console.log(`⚠️ Total updateViewport took ${totalTime.toFixed(1)}ms`);
        }
    }

    /**
     * Main render function
     */
    render() {
        this.renderRulers();
        this.renderGrid();
        this.renderAllLayers();
    }

    /**
     * Render rulers
     */
    renderRulers() {
        if (!this.rulerGroup || !this.rulersVisible) return;

        // Clear existing rulers
        this.rulerGroup.clear();

        const container = this.svg.node.parentElement;
        const rect = container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        // Ruler backgrounds
        this.rulerGroup
            .rect(width, this.RULER_SIZE)
            .move(0, 0)
            .fill('#2a2a2a')
            .addClass('ruler-horizontal-bg');

        this.rulerGroup
            .rect(this.RULER_SIZE, height)
            .move(0, 0)
            .fill('#2a2a2a')
            .addClass('ruler-vertical-bg');

        // Ruler corner
        this.rulerGroup
            .rect(this.RULER_SIZE, this.RULER_SIZE)
            .move(0, 0)
            .fill('#333')
            .addClass('ruler-corner');

        // Add zoom indicator in corner (display 2x as 100%)
        this.rulerGroup
            .text(`${Math.round(this.zoom * 50)}%`)
            .move(this.RULER_SIZE / 2, this.RULER_SIZE / 2)
            .font({ family: 'Arial', size: 10, anchor: 'middle' })
            .fill('#aaa')
            .addClass('zoom-indicator');

        // Calculate visible world bounds
        const topLeft = this.screenToWorld(0, 0);
        const bottomRight = this.screenToWorld(width - this.RULER_SIZE, height - this.RULER_SIZE);

        // Get intervals
        const majorInterval = this.getInterval();
        const divisions =
            majorInterval === 10 ||
            majorInterval === 20 ||
            majorInterval === 50 ||
            majorInterval === 100
                ? 10
                : 5;
        const minorInterval = Math.max(1, majorInterval / divisions);
        const labelInterval = this.getLabelInterval();

        // Calculate mark boundaries
        const startX = Math.floor(topLeft.x / minorInterval) * minorInterval;
        const endX = Math.ceil(bottomRight.x / minorInterval) * minorInterval;
        const startY = Math.floor(topLeft.y / minorInterval) * minorInterval;
        const endY = Math.ceil(bottomRight.y / minorInterval) * minorInterval;

        // Draw horizontal ruler marks
        for (let x = startX; x <= endX; x += minorInterval) {
            const screen = this.worldToScreen(x, 0);
            const pixelX = screen.x + this.RULER_SIZE;

            if (pixelX < this.RULER_SIZE || pixelX > width) continue;

            const isMajor = this.isAtInterval(x, majorInterval);
            const markHeight = isMajor ? 20 : 10;

            // Draw ruler mark
            this.rulerGroup
                .line(pixelX, 0, pixelX, markHeight)
                .stroke({ color: isMajor ? '#666' : '#444', width: 1 })
                .addClass('ruler-mark-horizontal');

            // Draw label
            if (this.isAtInterval(x, labelInterval)) {
                this.rulerGroup
                    .text(this.formatLabel(x))
                    .move(pixelX + 2, 25)
                    .font({ family: 'Arial', size: 9 })
                    .fill('#aaa')
                    .addClass('ruler-label-horizontal');
            }
        }

        // Draw vertical ruler marks
        for (let y = startY; y <= endY; y += minorInterval) {
            const screen = this.worldToScreen(0, y);
            const pixelY = screen.y + this.RULER_SIZE;

            if (pixelY < this.RULER_SIZE || pixelY > height) continue;

            const isMajor = this.isAtInterval(y, majorInterval);
            const markWidth = isMajor ? 20 : 10;

            // Draw ruler mark
            this.rulerGroup
                .line(0, pixelY, markWidth, pixelY)
                .stroke({ color: isMajor ? '#666' : '#444', width: 1 })
                .addClass('ruler-mark-vertical');

            // Draw label
            if (this.isAtInterval(y, labelInterval)) {
                this.rulerGroup
                    .text(this.formatLabel(y))
                    .move(25, pixelY - 2)
                    .font({ family: 'Arial', size: 9 })
                    .fill('#aaa')
                    .transform({ rotate: -90, originX: 25, originY: pixelY - 2 })
                    .addClass('ruler-label-vertical');
            }
        }

        // Draw ruler borders
        this.rulerGroup
            .line(this.RULER_SIZE, 0, this.RULER_SIZE, height)
            .stroke({ color: '#555', width: 1 })
            .addClass('ruler-border-vertical');

        this.rulerGroup
            .line(0, this.RULER_SIZE, width, this.RULER_SIZE)
            .stroke({ color: '#555', width: 1 })
            .addClass('ruler-border-horizontal');
    }

    /**
     * Render grid using SVG patterns for better performance
     */
    renderGrid() {
        if (!this.gridGroup || !this.gridVisible) return;

        // Clear existing grid
        this.gridGroup.clear();

        const container = this.svg.node.parentElement;
        const rect = container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        // Ensure we have valid dimensions before rendering
        const gridWidth = width - this.RULER_SIZE;
        const gridHeight = height - this.RULER_SIZE;

        if (gridWidth <= 0 || gridHeight <= 0) {
            // Container too small to render grid
            return;
        }

        // Get major interval only - grid lines only at major tick marks
        const majorInterval = this.getInterval();

        // Convert major interval to pixels for pattern
        const gridSize = majorInterval * this.PIXELS_PER_MM * this.zoom;

        // Create or update grid pattern (major spacing only)
        this.createSimpleGridPattern(gridSize);

        // Calculate pattern offset based on pan
        const offsetX = (this.panX + this.RULER_SIZE) % gridSize;
        const offsetY = (this.panY + this.RULER_SIZE) % gridSize;

        // Apply grid pattern to a single rectangle
        this.gridGroup
            .rect(gridWidth, gridHeight)
            .move(this.RULER_SIZE, this.RULER_SIZE)
            .fill('url(#gridPattern)')
            .attr('pointer-events', 'none')
            .transform({
                translateX: offsetX,
                translateY: offsetY
            });
    }

    /**
     * Create two-level grid pattern with darker lines at label intervals
     */
    createTwoLevelGridPattern(majorSize, labelSize, divisions) {
        // Get or create defs element
        let defsElement = this.svg.node.querySelector('defs');
        if (!defsElement) {
            defsElement = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            this.svg.node.appendChild(defsElement);
        }

        // Remove old pattern if it exists
        const oldPattern = defsElement.querySelector('#gridPattern');
        if (oldPattern) oldPattern.remove();

        // Create pattern that repeats at label intervals
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', 'gridPattern');
        pattern.setAttribute('width', labelSize);
        pattern.setAttribute('height', labelSize);
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');

        // Add the darker lines at label interval (where numbers appear)
        const darkVLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        darkVLine.setAttribute('x1', '0');
        darkVLine.setAttribute('y1', '0');
        darkVLine.setAttribute('x2', '0');
        darkVLine.setAttribute('y2', labelSize);
        darkVLine.setAttribute('stroke', '#000');
        darkVLine.setAttribute('stroke-width', '0.5');
        darkVLine.setAttribute('opacity', '0.15'); // Darker for label lines
        pattern.appendChild(darkVLine);

        const darkHLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        darkHLine.setAttribute('x1', '0');
        darkHLine.setAttribute('y1', '0');
        darkHLine.setAttribute('x2', labelSize);
        darkHLine.setAttribute('y2', '0');
        darkHLine.setAttribute('stroke', '#000');
        darkHLine.setAttribute('stroke-width', '0.5');
        darkHLine.setAttribute('opacity', '0.15'); // Darker for label lines
        pattern.appendChild(darkHLine);

        // Add lighter lines at major intervals (if there are divisions between labels)
        if (divisions > 1) {
            for (let i = 1; i < divisions; i++) {
                const offset = i * majorSize;

                // Vertical line
                const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                vLine.setAttribute('x1', offset);
                vLine.setAttribute('y1', '0');
                vLine.setAttribute('x2', offset);
                vLine.setAttribute('y2', labelSize);
                vLine.setAttribute('stroke', '#000');
                vLine.setAttribute('stroke-width', '0.5');
                vLine.setAttribute('opacity', '0.06'); // Lighter for non-label lines
                pattern.appendChild(vLine);

                // Horizontal line
                const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                hLine.setAttribute('x1', '0');
                hLine.setAttribute('y1', offset);
                hLine.setAttribute('x2', labelSize);
                hLine.setAttribute('y2', offset);
                hLine.setAttribute('stroke', '#000');
                hLine.setAttribute('stroke-width', '0.5');
                hLine.setAttribute('opacity', '0.06'); // Lighter for non-label lines
                pattern.appendChild(hLine);
            }
        }

        // Add the pattern to defs
        defsElement.appendChild(pattern);
    }

    /**
     * Create simple grid pattern with single spacing (no subdivisions)
     */
    createSimpleGridPattern(gridSize) {
        // Get or create defs element - use native DOM since SVG.js doesn't have defs()
        let defsElement = this.svg.node.querySelector('defs');
        if (!defsElement) {
            defsElement = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            this.svg.node.appendChild(defsElement);
        }

        // Remove old pattern if it exists
        const oldPattern = defsElement.querySelector('#gridPattern');
        if (oldPattern) oldPattern.remove();

        // Create pattern element directly
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', 'gridPattern');
        pattern.setAttribute('width', gridSize);
        pattern.setAttribute('height', gridSize);
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');

        // Add single grid lines to pattern (matching major ruler ticks)
        const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        vLine.setAttribute('x1', '0');
        vLine.setAttribute('y1', '0');
        vLine.setAttribute('x2', '0');
        vLine.setAttribute('y2', gridSize);
        vLine.setAttribute('stroke', '#000');
        vLine.setAttribute('stroke-width', '0.5');
        vLine.setAttribute('opacity', '0.08'); // Slightly more visible for major lines
        pattern.appendChild(vLine);

        const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        hLine.setAttribute('x1', '0');
        hLine.setAttribute('y1', '0');
        hLine.setAttribute('x2', gridSize);
        hLine.setAttribute('y2', '0');
        hLine.setAttribute('stroke', '#000');
        hLine.setAttribute('stroke-width', '0.5');
        hLine.setAttribute('opacity', '0.08'); // Slightly more visible for major lines
        pattern.appendChild(hLine);

        // Add the pattern to defs
        defsElement.appendChild(pattern);
    }

    /**
     * Create or update the grid pattern (old method - kept for reference)
     */
    createGridPattern(minorSize, majorSize, divisions) {
        // Get or create defs element - use native DOM since SVG.js doesn't have defs()
        let defsElement = this.svg.node.querySelector('defs');
        if (!defsElement) {
            defsElement = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            this.svg.node.appendChild(defsElement);
        }

        // Remove old patterns if they exist
        const oldPattern = defsElement.querySelector('#gridPattern');
        if (oldPattern) oldPattern.remove();

        const oldMajorPattern = defsElement.querySelector('#majorGridPattern');
        if (oldMajorPattern) oldMajorPattern.remove();

        // Create pattern element directly
        const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
        pattern.setAttribute('id', 'gridPattern');
        pattern.setAttribute('width', minorSize);
        pattern.setAttribute('height', minorSize);
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');

        // Add minor grid lines to pattern
        const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        vLine.setAttribute('x1', '0');
        vLine.setAttribute('y1', '0');
        vLine.setAttribute('x2', '0');
        vLine.setAttribute('y2', minorSize);
        vLine.setAttribute('stroke', '#000');
        vLine.setAttribute('stroke-width', '0.5');
        vLine.setAttribute('opacity', '0.03');
        pattern.appendChild(vLine);

        const hLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        hLine.setAttribute('x1', '0');
        hLine.setAttribute('y1', '0');
        hLine.setAttribute('x2', minorSize);
        hLine.setAttribute('y2', '0');
        hLine.setAttribute('stroke', '#000');
        hLine.setAttribute('stroke-width', '0.5');
        hLine.setAttribute('opacity', '0.03');
        pattern.appendChild(hLine);

        defsElement.appendChild(pattern);

        // Add major grid lines overlay if needed
        if (divisions > 1) {
            // Create major pattern element directly
            const majorPattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
            majorPattern.setAttribute('id', 'majorGridPattern');
            majorPattern.setAttribute('width', majorSize);
            majorPattern.setAttribute('height', majorSize);
            majorPattern.setAttribute('patternUnits', 'userSpaceOnUse');

            // Add major grid lines to pattern
            const majorVLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            majorVLine.setAttribute('x1', '0');
            majorVLine.setAttribute('y1', '0');
            majorVLine.setAttribute('x2', '0');
            majorVLine.setAttribute('y2', majorSize);
            majorVLine.setAttribute('stroke', '#000');
            majorVLine.setAttribute('stroke-width', '1');
            majorVLine.setAttribute('opacity', '0.06');
            majorPattern.appendChild(majorVLine);

            const majorHLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            majorHLine.setAttribute('x1', '0');
            majorHLine.setAttribute('y1', '0');
            majorHLine.setAttribute('x2', majorSize);
            majorHLine.setAttribute('y2', '0');
            majorHLine.setAttribute('stroke', '#000');
            majorHLine.setAttribute('stroke-width', '1');
            majorHLine.setAttribute('opacity', '0.06');
            majorPattern.appendChild(majorHLine);

            defsElement.appendChild(majorPattern);

            // Apply major grid pattern as overlay
            const container = this.svg.node.parentElement;
            const rect = container.getBoundingClientRect();
            const offsetX = (this.panX + this.RULER_SIZE) % majorSize;
            const offsetY = (this.panY + this.RULER_SIZE) % majorSize;

            this.gridGroup
                .rect(rect.width - this.RULER_SIZE, rect.height - this.RULER_SIZE)
                .move(this.RULER_SIZE, this.RULER_SIZE)
                .fill('url(#majorGridPattern)')
                .attr('pointer-events', 'none')
                .transform({
                    translateX: offsetX,
                    translateY: offsetY
                });
        }
    }

    /**
     * Create a new layer in the SVG system
     */
    createLayer(layer, onSelectElement, onStartDrag) {
        if (this.layers.has(layer.id)) {
            // Update existing layer
            this.updateElement(layer);
            return;
        }

        // Create layer group
        const layerGroup = this.viewport
            .group()
            .addClass('sign-element')
            .attr('data-element-id', layer.id)
            .attr('data-element-type', layer.type);

        // Store layer reference
        this.layers.set(layer.id, {
            layer: layer,
            group: layerGroup,
            onSelectElement: onSelectElement,
            onStartDrag: onStartDrag
        });

        // Note: Click handling is done in makeDraggable to properly distinguish clicks from drags

        // Enable pointer events for interaction
        layerGroup.style('pointer-events', 'all');

        // Make the layer draggable
        this.makeDraggable(layerGroup, layer, onSelectElement);

        // Apply X-ray mode if enabled
        if (this.xrayMode) {
            layerGroup.opacity(0.5);
        }

        // Apply shadow mode if enabled
        if (this.shadowMode && layerGroup.node) {
            layerGroup.node.setAttribute('filter', 'url(#dropShadow)');
        }

        // Initial render
        this.updateElement(layer);

        console.log(`✅ Created SVG layer: ${layer.id}`, {
            type: layer.type,
            position: { x: layer.x, y: layer.y },
            size: { width: layer.width, height: layer.height },
            onCanvas: layer.onCanvas
        });

        // Hide the drop zone since we have elements now
        const dropZone = document.getElementById('face-drop-zone');
        if (dropZone) {
            dropZone.style.display = 'none';
        }
    }

    /**
     * Make a layer group draggable with proper constraints and feedback
     */
    makeDraggable(layerGroup, layer, onSelectElement) {
        // Store reference to the designSVG instance for use in event handlers
        const self = this;

        // Track drag state
        let isDragging = false;
        let dragStartPos = null;

        // Add cursor style to show it's draggable
        layerGroup.style('cursor', 'grab');

        // Get the native DOM element
        const groupElement = layerGroup.node;

        // Ensure the group element can receive events
        groupElement.style.pointerEvents = 'all';

        // Mouse down event using native DOM
        groupElement.addEventListener('mousedown', e => {
            // Only allow left mouse button (0) to drag elements
            // Middle button (1) is for panning, right button (2) for context menu
            if (e.button !== 0) {
                // Don't stop propagation for middle/right mouse - let it bubble up for panning
                return;
            }

            e.stopPropagation();
            e.preventDefault();

            // Store mouse down position for drag threshold detection
            dragStartPos = {
                x: e.clientX,
                y: e.clientY,
                layerX: layer.x,
                layerY: layer.y
            };

            // Add global mouse event listeners for potential drag
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        // Mouse move handler
        const onMouseMove = e => {
            if (!dragStartPos) return;

            // Check if we've moved beyond the drag threshold
            const DRAG_THRESHOLD = 5; // pixels
            const deltaScreenX = e.clientX - dragStartPos.x;
            const deltaScreenY = e.clientY - dragStartPos.y;
            const distance = Math.sqrt(deltaScreenX * deltaScreenX + deltaScreenY * deltaScreenY);

            // If we haven't started dragging yet, check if we should
            if (!isDragging) {
                if (distance > DRAG_THRESHOLD) {
                    // Start dragging
                    isDragging = true;

                    // Handle selection: select this element (deselecting others)
                    onSelectElement(layer);

                    // Visual feedback - add dragging class and change cursor
                    layerGroup.addClass('dragging');
                    layerGroup.style('cursor', 'grabbing');
                    groupElement.style.cursor = 'grabbing';
                    document.body.style.cursor = 'grabbing'; // Set document cursor too
                } else {
                    // Still within threshold, don't start dragging yet
                    return;
                }
            }

            e.preventDefault();

            // Convert screen delta to world delta
            const worldDeltaX = deltaScreenX / (self.PIXELS_PER_MM * self.zoom);
            const worldDeltaY = deltaScreenY / (self.PIXELS_PER_MM * self.zoom);

            // Calculate new position for primary layer
            let newX = dragStartPos.layerX + worldDeltaX;
            let newY = dragStartPos.layerY + worldDeltaY;

            // Apply snap-to-grid if enabled
            if (state.snapEnabled) {
                const snapped = self.snapToGrid(newX, newY);
                newX = snapped.x;
                newY = snapped.y;
            }

            // Apply bounds checking
            const bounds = self.getCanvasBounds();
            newX = Math.max(bounds.minX, Math.min(bounds.maxX - layer.width, newX));
            newY = Math.max(bounds.minY, Math.min(bounds.maxY - layer.height, newY));

            // Calculate delta from current position
            const deltaX = newX - layer.x;
            const deltaY = newY - layer.y;

            // Get linked layers
            const layersToMove = getLinkedGroup(layer);

            // Update all linked layers
            layersToMove.forEach(linkedLayer => {
                linkedLayer.x += deltaX;
                linkedLayer.y += deltaY;

                // Update visual position for each layer
                const layerData = self.layers.get(linkedLayer.id);
                if (layerData) {
                    const pixelX = linkedLayer.x * self.PIXELS_PER_MM;
                    const pixelY = linkedLayer.y * self.PIXELS_PER_MM;
                    layerData.group.transform({
                        translateX: pixelX,
                        translateY: pixelY
                    });
                }
            });

            // Update selection handles if the primary layer is selected
            if (state.currentElement && state.currentElement.id === layer.id) {
                self.updateSelectionHandles(layer);
            }

            // Mark state as dirty
            updateState({ isDirty: true });

            // Update side view during drag
            if (window.UI && window.UI.updateStackVisualization) {
                window.UI.updateStackVisualization();
            }
        };

        // Mouse up handler
        const onMouseUp = e => {
            // Remove global event listeners regardless
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            if (!dragStartPos) return;

            if (isDragging) {
                // We were dragging - finish the drag
                isDragging = false;

                // Restore visual feedback
                layerGroup.removeClass('dragging');
                layerGroup.style('cursor', 'pointer');
                groupElement.style.cursor = 'pointer';
                document.body.style.cursor = 'default'; // Reset document cursor

                // Final update to state
                updateState({
                    elementsList: [...state.elementsList],
                    isDirty: true
                });
            } else {
                // No dragging occurred - this was a click

                // Click on selected element deselects it, otherwise select
                if (state.currentElement && state.currentElement.id === layer.id) {
                    // Element is already selected - deselect it
                    onSelectElement(null);
                    // Force update visuals immediately - use stored reference
                    requestAnimationFrame(() => {
                        self.updateSelectionVisuals();
                        self.hideSelectionHandles();
                    });
                } else {
                    // Select this element (deselecting others)
                    onSelectElement(layer);
                }
            }

            // Reset drag state
            dragStartPos = null;
        };

        // Set cursor states
        layerGroup.style('cursor', 'pointer');

        // Add hover effect for visual feedback
        groupElement.addEventListener('mouseenter', () => {
            if (!isDragging) {
                groupElement.style.cursor = 'pointer';
            }
        });

        groupElement.addEventListener('mouseleave', () => {
            if (!isDragging) {
                groupElement.style.cursor = 'default';
            }
        });
    }

    /**
     * Get canvas bounds for drag constraint
     */
    getCanvasBounds() {
        // Allow very generous canvas space for design work
        // Signs can be quite large and users need freedom to position elements
        return {
            minX: -5000, // Allow 5 meters off the left edge
            minY: -5000, // Allow 5 meters off the top edge
            maxX: 10000, // Max 10 meters to the right
            maxY: 10000 // Max 10 meters down
        };
    }

    /**
     * Update selection handles position during drag
     */
    updateSelectionHandles(layer) {
        if (!this.selectionHandles) return;

        // Simply recreate handles at new position for now
        // Since handles are in screen space, position updates are complex
        this.showSelectionHandles(layer);
    }

    /**
     * Update selection handle positions for zoom changes
     */
    updateSelectionHandlePositions() {
        if (!this.selectionHandles || !state.currentElement) return;

        // Recreate handles at new screen positions
        // This is necessary because handles are in screen space
        this.showSelectionHandles(state.currentElement);
    }

    /**
     * Update an existing layer
     */
    updateElement(element) {
        const layerData = this.layers.get(element.id);
        if (!layerData) return;

        const group = layerData.group;

        // Clear existing content
        group.clear();

        // Position and size the element (convert mm to pixels)
        const pixelX = element.x * this.PIXELS_PER_MM;
        const pixelY = element.y * this.PIXELS_PER_MM;
        const pixelWidth = element.width * this.PIXELS_PER_MM;
        const pixelHeight = element.height * this.PIXELS_PER_MM;

        group.transform({
            translateX: pixelX,
            translateY: pixelY
        });

        // Render element content based on type
        this.renderLayerContent(group, element, pixelWidth, pixelHeight);

        // Update z-index
        group.attr('data-z-index', element.zIndex);

        // Apply selection state
        if (state.currentElement && state.currentElement.id === element.id) {
            group.addClass('selected');
            this.showSelectionHandles(element);
        } else {
            group.removeClass('selected');
        }
    }

    /**
     * Render the content of a layer based on its type
     */
    renderLayerContent(group, layer, width, height) {
        const definition = this.getLayerDefinition(layer.type);

        if (definition.isText) {
            this.renderTextLayer(group, layer, width, height, definition);
        } else {
            this.renderShapeLayer(group, layer, width, height, definition);
        }
    }

    /**
     * Render a text layer
     */
    renderTextLayer(group, layer, width, height, definition) {
        // Create background rectangle for visual bounds
        const bg = group
            .rect(width, height)
            .fill('transparent')
            .stroke({ color: '#f07727', width: 1, opacity: 0 })
            .addClass('layer-background');

        // Show border when selected
        if (state.currentElement && state.currentElement.id === layer.id) {
            bg.stroke({ opacity: 1 });
        }

        // Create text element
        const text = group
            .text(layer.text || definition.defaultText || '')
            .font({
                family: layer.font || definition.defaultFont || 'Arial',
                size:
                    (layer.fontSize || definition.defaultFontSize || 24) *
                    0.3528 *
                    this.PIXELS_PER_MM, // Convert pt to mm then to SVG units (1pt = 0.3528mm)
                weight: layer.fontWeight || 'normal'
            })
            .fill(layer.textColor || definition.defaultTextColor || '#000000')
            .addClass('layer-text');

        // Position text based on alignment
        this.positionText(text, layer, width, height);

        // Handle Braille text
        if (definition.isBraille && layer.brailleSourceText) {
            // Note: Braille translation would be handled by the existing braille-translator-v2.js
            // For now, display the translated text as provided
        }
    }

    /**
     * Render a shape layer (plate, logo, icon)
     */
    renderShapeLayer(group, layer, width, height, definition) {
        const rect = group
            .rect(width, height)
            .addClass('layer-shape')
            .style('pointer-events', 'all');

        // Apply texture if available, otherwise use color
        if (layer.textureReference && this.faceCanvas) {
            console.log(
                'Applying texture to element:',
                layer.id,
                layer.textureReference.substring(0, 50)
            );

            // Create a pattern for the texture
            const patternId = `texture-pattern-${layer.id}`;

            // Get or create defs element
            let defs = this.faceCanvas.defs();
            if (!defs) {
                defs = this.faceCanvas.defs();
            }

            // Remove old pattern if it exists
            const oldPattern = defs.findOne(`#${patternId}`);
            if (oldPattern) {
                oldPattern.remove();
            }

            // Create new pattern with patternUnits="userSpaceOnUse"
            const pattern = this.faceCanvas.pattern(width, height, function (add) {
                add.image(layer.textureReference).size(width, height);
            });
            pattern.id(patternId);
            pattern.attr('patternUnits', 'userSpaceOnUse');

            // Add pattern to defs
            defs.add(pattern);

            // Apply pattern as fill using url reference
            rect.fill(`url(#${patternId})`);
            console.log('Pattern applied:', patternId);
        } else {
            // Use solid color
            rect.fill(layer.color || definition.color || '#cccccc');
        }

        // Apply opacity for x-ray mode
        if (state.xrayMode) {
            rect.opacity(0.5);
        }

        // Add shadow effect if enabled
        if (state.shadowMode && !definition.isText) {
            rect.attr('filter', 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))');
        }
    }

    /**
     * Position text within its container based on alignment settings
     */
    positionText(textElement, layer, width, height) {
        const textAlign = layer.textAlign || 'center';
        const verticalAlign = layer.verticalAlign || 'middle';

        // Get text bounding box
        const bbox = textElement.bbox();

        // Calculate horizontal position
        let x = 0;
        switch (textAlign) {
            case 'left':
                x = 0;
                break;
            case 'center':
                x = (width - bbox.width) / 2;
                break;
            case 'right':
                x = width - bbox.width;
                break;
        }

        // Calculate vertical position
        let y = 0;
        switch (verticalAlign) {
            case 'top':
                y = 0;
                break;
            case 'middle':
                y = (height - bbox.height) / 2;
                break;
            case 'bottom':
                y = height - bbox.height;
                break;
        }

        textElement.move(x, y);
    }

    /**
     * Remove a layer from the SVG system
     */
    removeLayer(layerId) {
        const layerData = this.layers.get(layerId);
        if (layerData) {
            layerData.group.remove();
            this.layers.delete(layerId);
        }

        // Hide selection handles if this was the selected layer
        if (state.currentElement && state.currentElement.id === layerId) {
            this.hideSelectionHandles();
        }
    }

    /**
     * Show selection handles for a layer
     */
    showSelectionHandles(layer) {
        this.hideSelectionHandles(); // Clear existing handles

        const layerData = this.layers.get(layer.id);
        if (!layerData) return;

        // Create selection handles group in selectionsGroup (outside viewport transform)
        // This prevents handles from being affected by zoom transform
        this.selectionHandles = this.selectionsGroup
            .group()
            .addClass('selection-handles')
            .attr('data-element-id', layer.id);

        // Calculate element position in screen coordinates (accounting for zoom and pan)
        const pixelX = layer.x * this.PIXELS_PER_MM;
        const pixelY = layer.y * this.PIXELS_PER_MM;

        // Transform handle group position to account for viewport transform
        const screenX = pixelX * this.zoom + this.panX + this.RULER_SIZE;
        const screenY = pixelY * this.zoom + this.panY + this.RULER_SIZE;

        // Get layer size in screen pixels (accounting for zoom)
        const screenWidth = layer.width * this.PIXELS_PER_MM * this.zoom;
        const screenHeight = layer.height * this.PIXELS_PER_MM * this.zoom;

        // Handle size is now in screen pixels (no scaling needed)
        const handleSize = 10; // Fixed size in screen pixels
        const halfHandle = handleSize / 2;

        const handles = [
            { pos: 'nw', x: screenX - halfHandle, y: screenY - halfHandle },
            { pos: 'n', x: screenX + screenWidth / 2 - halfHandle, y: screenY - halfHandle },
            { pos: 'ne', x: screenX + screenWidth - halfHandle, y: screenY - halfHandle },
            {
                pos: 'e',
                x: screenX + screenWidth - halfHandle,
                y: screenY + screenHeight / 2 - halfHandle
            },
            {
                pos: 'se',
                x: screenX + screenWidth - halfHandle,
                y: screenY + screenHeight - halfHandle
            },
            {
                pos: 's',
                x: screenX + screenWidth / 2 - halfHandle,
                y: screenY + screenHeight - halfHandle
            },
            { pos: 'sw', x: screenX - halfHandle, y: screenY + screenHeight - halfHandle },
            { pos: 'w', x: screenX - halfHandle, y: screenY + screenHeight / 2 - halfHandle }
        ];

        // Create handle elements
        handles.forEach(handle => {
            // Position handles directly in screen coordinates
            const handleElement = this.selectionHandles
                .rect(handleSize, handleSize)
                .move(handle.x, handle.y)
                .fill('#f07727')
                .stroke({ color: '#fff', width: 1 })
                .addClass(`resize-handle resize-handle-${handle.pos}`)
                .style('cursor', this.getResizeCursor(handle.pos))
                .style('pointer-events', 'all')
                .attr('data-handle-pos', handle.pos);

            // Add resize functionality
            this.addResizeHandler(handleElement, layer, handle.pos);
        });
    }

    /**
     * Hide selection handles
     */
    hideSelectionHandles() {
        if (this.selectionHandles) {
            this.selectionHandles.remove();
            this.selectionHandles = null;
        }
    }

    /**
     * Get the appropriate cursor for a resize handle
     */
    getResizeCursor(position) {
        const cursors = {
            nw: 'nw-resize',
            n: 'n-resize',
            ne: 'ne-resize',
            e: 'e-resize',
            se: 'se-resize',
            s: 's-resize',
            sw: 'sw-resize',
            w: 'w-resize'
        };
        return cursors[position] || 'pointer';
    }

    /**
     * Add resize handler to a handle element
     */
    addResizeHandler(handleElement, layer, position) {
        handleElement.style('pointer-events', 'all');

        handleElement.mousedown(e => {
            e.stopPropagation();
            e.preventDefault();

            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = layer.width;
            const startHeight = layer.height;
            const startLeft = layer.x;
            const startTop = layer.y;

            const onMouseMove = moveEvent => {
                // Convert mouse delta to world coordinates
                const deltaX = (moveEvent.clientX - startX) / (this.zoom * this.PIXELS_PER_MM);
                const deltaY = (moveEvent.clientY - startY) / (this.zoom * this.PIXELS_PER_MM);

                let newWidth = startWidth;
                let newHeight = startHeight;
                let newX = startLeft;
                let newY = startTop;

                // Handle different resize directions
                if (position.includes('e')) {
                    newWidth = startWidth + deltaX;
                }
                if (position.includes('w')) {
                    newWidth = startWidth - deltaX;
                    newX = startLeft + deltaX;
                }
                if (position.includes('s')) {
                    newHeight = startHeight + deltaY;
                }
                if (position.includes('n')) {
                    newHeight = startHeight - deltaY;
                    newY = startTop + deltaY;
                }

                // Apply minimum dimensions
                layer.width = Math.max(10, newWidth); // Minimum 10mm
                layer.height = Math.max(10, newHeight); // Minimum 10mm
                layer.x = newX;
                layer.y = newY;

                // Update the element
                this.updateElement(layer);

                // Update property panel inputs
                const widthInput = document.querySelector(`#props-${layer.id} .prop-width`);
                const heightInput = document.querySelector(`#props-${layer.id} .prop-height`);
                if (widthInput && heightInput) {
                    // Display in mm
                    widthInput.value = layer.width.toFixed(1);
                    heightInput.value = layer.height.toFixed(1);
                }

                // Update UI display
                updateDimensionsDisplay();
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                // Final update to ensure properties are in sync
                const widthInput = document.querySelector(`#props-${layer.id} .prop-width`);
                const heightInput = document.querySelector(`#props-${layer.id} .prop-height`);
                if (widthInput && heightInput) {
                    // Display in mm
                    widthInput.value = layer.width.toFixed(1);
                    heightInput.value = layer.height.toFixed(1);
                }

                // Update state
                updateState({ elementsList: [...state.elementsList] });
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    /**
     * Render all layers
     */
    renderAllLayers() {
        // Clear and re-render all layers
        this.layers.forEach((layerData, layerId) => {
            this.updateElement(layerData.layer);
        });
    }

    /**
     * Update selection visuals
     */
    updateSelectionVisuals() {
        // Update all layer selection states
        this.layers.forEach((layerData, layerId) => {
            const group = layerData.group;
            const isSelected = state.currentElement && state.currentElement.id === layerId;

            if (isSelected) {
                group.addClass('selected');
                this.showSelectionHandles(layerData.layer);
            } else {
                group.removeClass('selected');
            }
        });

        // Hide handles if no layer is selected
        if (!state.currentElement) {
            this.hideSelectionHandles();
        }
    }

    /**
     * Convert world coordinates to screen coordinates
     */
    worldToScreen(worldX, worldY) {
        const screenX = worldX * this.PIXELS_PER_MM * this.zoom + this.panX;
        const screenY = worldY * this.PIXELS_PER_MM * this.zoom + this.panY;
        return { x: screenX, y: screenY };
    }

    /**
     * Convert screen coordinates to world coordinates
     */
    screenToWorld(screenX, screenY) {
        const worldX = (screenX - this.panX) / (this.PIXELS_PER_MM * this.zoom);
        const worldY = (screenY - this.panY) / (this.PIXELS_PER_MM * this.zoom);
        return { x: worldX, y: worldY };
    }

    /**
     * Snap coordinates to grid
     */
    snapToGrid(worldX, worldY) {
        const interval = this.getSnapInterval();
        const snappedX = Math.round(worldX / interval) * interval;
        const snappedY = Math.round(worldY / interval) * interval;

        return {
            x: Math.round(snappedX * 1000) / 1000,
            y: Math.round(snappedY * 1000) / 1000
        };
    }

    /**
     * Get grid interval based on zoom level
     */
    getInterval() {
        if (this.zoom < 0.2) return 100;
        if (this.zoom < 0.5) return 50;
        if (this.zoom < 1) return 10;
        if (this.zoom < 2) return 10;
        if (this.zoom < 5) return 5;
        return 1;
    }

    /**
     * Get label interval
     */
    getLabelInterval() {
        const minPixelSpacing = 40;
        const worldSpacing = minPixelSpacing / (this.PIXELS_PER_MM * this.zoom);

        if (worldSpacing > 100) return 200;
        if (worldSpacing > 50) return 100;
        if (worldSpacing > 20) return 50;
        if (worldSpacing > 10) return 20;
        if (worldSpacing > 5) return 10;
        if (worldSpacing > 2) return 5;
        if (worldSpacing > 1) return 2;
        return 1;
    }

    /**
     * Get snap interval
     */
    getSnapInterval() {
        const majorInterval = this.getInterval();
        const divisions =
            majorInterval === 10 ||
            majorInterval === 20 ||
            majorInterval === 50 ||
            majorInterval === 100
                ? 10
                : 5;
        const minorInterval = majorInterval / divisions;
        return Math.max(1, minorInterval);
    }

    /**
     * Check if value is at interval
     */
    isAtInterval(value, interval) {
        const remainder = Math.abs(value % interval);
        const tolerance = interval * 0.001;
        return remainder < tolerance || remainder > interval - tolerance;
    }

    /**
     * Format label for ruler
     */
    formatLabel(valueMm) {
        return Math.round(valueMm).toString();
    }

    /**
     * Set grid visibility
     */
    setGridVisible(visible) {
        this.gridVisible = visible;
        if (this.gridGroup) {
            this.gridGroup.style('display', visible ? 'block' : 'none');
        }
    }

    /**
     * Set rulers visibility
     */
    setRulersVisible(visible) {
        this.rulersVisible = visible;
        if (this.rulerGroup) {
            this.rulerGroup.style('display', visible ? 'block' : 'none');
        }
    }

    /**
     * Set X-ray mode (50% opacity for all elements)
     */
    setXRayMode(enabled) {
        this.xrayMode = enabled;
        if (this.layersGroup) {
            // Apply opacity to all layer groups
            this.layers.forEach(layerData => {
                const group = layerData.group;
                if (group) {
                    group.opacity(enabled ? 0.5 : 1);
                }
            });
        }
    }

    /**
     * Set shadow mode (drop shadows for all elements)
     */
    setShadowMode(enabled) {
        this.shadowMode = enabled;

        if (!this.svg) return;

        // Get or create defs element
        let defsElement = this.svg.node.querySelector('defs');
        if (!defsElement) {
            defsElement = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            this.svg.node.appendChild(defsElement);
        }

        if (enabled) {
            // Create shadow filter if it doesn't exist
            let shadowFilter = defsElement.querySelector('#dropShadow');
            if (!shadowFilter) {
                shadowFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
                shadowFilter.setAttribute('id', 'dropShadow');
                shadowFilter.setAttribute('x', '-50%');
                shadowFilter.setAttribute('y', '-50%');
                shadowFilter.setAttribute('width', '200%');
                shadowFilter.setAttribute('height', '200%');

                // Create the shadow effect
                const feGaussianBlur = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'feGaussianBlur'
                );
                feGaussianBlur.setAttribute('in', 'SourceAlpha');
                feGaussianBlur.setAttribute('stdDeviation', '3');

                const feOffset = document.createElementNS('http://www.w3.org/2000/svg', 'feOffset');
                feOffset.setAttribute('dx', '2');
                feOffset.setAttribute('dy', '2');
                feOffset.setAttribute('result', 'offsetblur');

                const feFlood = document.createElementNS('http://www.w3.org/2000/svg', 'feFlood');
                feFlood.setAttribute('flood-color', '#000000');
                feFlood.setAttribute('flood-opacity', '0.3');

                const feComposite = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'feComposite'
                );
                feComposite.setAttribute('in2', 'offsetblur');
                feComposite.setAttribute('operator', 'in');

                const feMerge = document.createElementNS('http://www.w3.org/2000/svg', 'feMerge');
                const feMergeNode1 = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'feMergeNode'
                );
                const feMergeNode2 = document.createElementNS(
                    'http://www.w3.org/2000/svg',
                    'feMergeNode'
                );
                feMergeNode2.setAttribute('in', 'SourceGraphic');

                feMerge.appendChild(feMergeNode1);
                feMerge.appendChild(feMergeNode2);

                shadowFilter.appendChild(feGaussianBlur);
                shadowFilter.appendChild(feOffset);
                shadowFilter.appendChild(feFlood);
                shadowFilter.appendChild(feComposite);
                shadowFilter.appendChild(feMerge);

                defsElement.appendChild(shadowFilter);
            }

            // Apply filter to all layers
            this.layers.forEach(layerData => {
                const group = layerData.group;
                if (group && group.node) {
                    group.node.setAttribute('filter', 'url(#dropShadow)');
                }
            });
        } else {
            // Remove shadow filter from all layers
            this.layers.forEach(layerData => {
                const group = layerData.group;
                if (group && group.node) {
                    group.node.removeAttribute('filter');
                }
            });
        }
    }

    /**
     * Get layer definition from config.js
     */
    getLayerDefinition(type) {
        return LAYER_DEFINITIONS[type] || { isText: false, color: '#cccccc' };
    }
}

// Create singleton instance
export const designSVG = new DesignSVG();

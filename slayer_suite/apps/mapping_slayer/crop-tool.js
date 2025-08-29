// crop-tool.js - Handles the masking/crop functionality for Mapping Slayer

import { appState } from './state.js';

export class CropTool {
    constructor() {
        this.isActive = false;
        this.cropBounds = null; // Current working crop bounds (in pixels)
        this.cropBoundsPerPage = new Map(); // Store normalized crop bounds per page (0-1 range)
        this.globalCropBounds = null; // Global normalized crop bounds for all pages (0-1 range)
        this.cropAllPages = false; // Whether to use global crop
        this.isDragging = false;
        this.activeHandle = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragStartScale = 1;
        this.startBounds = null;

        // Store original state for canceling
        this.originalCropBounds = null;
        this.originalCropBoundsPerPage = new Map();
        this.originalGlobalCropBounds = null;
        this.originalCropAllPages = false;

        this.button = null;
        this.overlay = null;
        this.mapContent = null;
        this.canvas = null;
        this.allPagesCheckbox = null;
    }

    initialize() {
        this.button = document.getElementById('crop-toggle-btn');
        this.overlay = document.getElementById('crop-overlay');
        this.mapContent = document.getElementById('map-content');
        this.canvas = document.getElementById('pdf-canvas');
        this.allPagesCheckbox = document.getElementById('crop-all-pages-checkbox');

        if (!this.button || !this.overlay || !this.mapContent) {
            console.error('Crop tool: Required elements not found');
            return;
        }

        // Set up event listeners
        this.button.addEventListener('click', () => this.toggle());

        // Handle resize events
        const handles = this.overlay.querySelectorAll('.ms-crop-handle');
        handles.forEach(handle => {
            handle.addEventListener('mousedown', e => this.startResize(e));
        });

        // Handle all pages checkbox
        if (this.allPagesCheckbox) {
            this.allPagesCheckbox.addEventListener('change', e => {
                this.cropAllPages = e.target.checked;

                if (this.cropAllPages) {
                    // When switching to all pages mode, save current bounds as global
                    if (this.cropBounds) {
                        this.globalCropBounds = this.normalizePixelBounds(this.cropBounds);
                    }
                    // Clear all per-page crops
                    this.cropBoundsPerPage.clear();
                } else {
                    // When switching back to per-page mode, save global as current page
                    if (this.globalCropBounds) {
                        const currentPage = appState.currentPdfPage;
                        this.cropBoundsPerPage.set(currentPage, this.globalCropBounds);
                        // Update current pixel bounds from normalized
                        this.cropBounds = this.denormalizePixelBounds(this.globalCropBounds);
                    }
                }
            });
        }

        // Global mouse events for dragging
        document.addEventListener('mousemove', e => this.handleMouseMove(e));
        document.addEventListener('mouseup', () => this.stopResize());

        // Add escape key handler to cancel crop
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && this.isActive) {
                e.preventDefault();
                this.cancel();
            }
        });

        // Listen for zoom changes
        this.setupZoomListener();

        // Listen for page changes
        this.setupPageChangeListener();
    }

    setupZoomListener() {
        // Create a custom event listener for zoom changes
        const mapContent = document.getElementById('map-content');
        if (mapContent) {
            const observer = new MutationObserver(() => {
                if (this.isActive) {
                    this.updateOverlayPosition();
                    this.updateHandleSize();
                }
            });

            observer.observe(mapContent, {
                attributes: true,
                attributeFilter: ['style']
            });
        }
    }

    setupPageChangeListener() {
        // Listen for page change events
        document.addEventListener('pageChanged', () => {
            if (this.isActive) {
                // Apply saved crop after page is fully rendered
                requestAnimationFrame(() => {
                    this.loadCropForCurrentPage();
                });
            }
        });
    }

    // Convert pixel bounds to normalized coordinates (0-1 range)
    normalizePixelBounds(pixelBounds) {
        if (!this.canvas) return null;

        const canvasRect = this.canvas.getBoundingClientRect();
        const mapContentRect = this.mapContent.getBoundingClientRect();
        const scale = appState.mapTransform.scale;

        // Get canvas position relative to map content
        const canvasLeft = (canvasRect.left - mapContentRect.left) / scale;
        const canvasTop = (canvasRect.top - mapContentRect.top) / scale;
        const canvasWidth = canvasRect.width / scale;
        const canvasHeight = canvasRect.height / scale;

        return {
            left: (pixelBounds.left - canvasLeft) / canvasWidth,
            top: (pixelBounds.top - canvasTop) / canvasHeight,
            width: pixelBounds.width / canvasWidth,
            height: pixelBounds.height / canvasHeight
        };
    }

    // Convert normalized coordinates (0-1 range) to pixel bounds
    denormalizePixelBounds(normalizedBounds) {
        if (!this.canvas || !normalizedBounds) return null;

        const canvasRect = this.canvas.getBoundingClientRect();
        const mapContentRect = this.mapContent.getBoundingClientRect();
        const scale = appState.mapTransform.scale;

        // Get canvas position relative to map content
        const canvasLeft = (canvasRect.left - mapContentRect.left) / scale;
        const canvasTop = (canvasRect.top - mapContentRect.top) / scale;
        const canvasWidth = canvasRect.width / scale;
        const canvasHeight = canvasRect.height / scale;

        return {
            left: canvasLeft + normalizedBounds.left * canvasWidth,
            top: canvasTop + normalizedBounds.top * canvasHeight,
            width: normalizedBounds.width * canvasWidth,
            height: normalizedBounds.height * canvasHeight
        };
    }

    // Load crop for current page
    loadCropForCurrentPage() {
        // Clear any existing crop mask
        if (this.canvas) {
            this.canvas.style.clipPath = '';
        }

        // Load appropriate normalized crop bounds
        let normalizedBounds;
        if (this.cropAllPages && this.globalCropBounds) {
            normalizedBounds = this.globalCropBounds;
        } else {
            const currentPage = appState.currentPdfPage;
            normalizedBounds = this.cropBoundsPerPage.get(currentPage);
        }

        if (normalizedBounds) {
            // Convert normalized bounds to pixel bounds for current canvas
            this.cropBounds = this.denormalizePixelBounds(normalizedBounds);
            if (this.cropBounds) {
                this.updateOverlayPosition();
                this.updateHandleSize();
            }
        } else {
            // Initialize default bounds for new page
            const canvasRect = this.canvas.getBoundingClientRect();
            const mapContentRect = this.mapContent.getBoundingClientRect();
            const scale = appState.mapTransform.scale;

            this.cropBounds = {
                left: (canvasRect.left - mapContentRect.left) / scale,
                top: (canvasRect.top - mapContentRect.top) / scale,
                width: canvasRect.width / scale,
                height: canvasRect.height / scale
            };

            this.updateOverlayPosition();
            this.updateHandleSize();
        }
    }

    toggle() {
        if (this.isActive) {
            this.deactivate();
        } else {
            this.activate();
        }
    }

    activate() {
        if (!this.canvas || this.canvas.style.display === 'none') {
            alert('Please load a PDF first');
            return;
        }

        // Save current state before making any changes
        this.saveOriginalState();

        this.isActive = true;
        this.button.classList.add('active');

        // Show the all pages checkbox
        const checkboxContainer = document.getElementById('crop-all-pages-container');
        if (checkboxContainer) {
            checkboxContainer.style.display = 'flex';
        }

        // Show overlay
        this.overlay.style.display = 'block';
        this.overlay.classList.add('active');

        // Load crop for current page
        this.loadCropForCurrentPage();
    }

    saveOriginalState() {
        // Save the current crop state so we can restore it on cancel
        this.originalCropBounds = this.cropBounds ? { ...this.cropBounds } : null;
        this.originalGlobalCropBounds = this.globalCropBounds ? { ...this.globalCropBounds } : null;
        this.originalCropAllPages = this.cropAllPages;

        // Deep copy the per-page crop bounds
        this.originalCropBoundsPerPage.clear();
        this.cropBoundsPerPage.forEach((value, key) => {
            this.originalCropBoundsPerPage.set(key, { ...value });
        });
    }

    cancel() {
        // Restore original state
        this.cropBounds = this.originalCropBounds ? { ...this.originalCropBounds } : null;
        this.globalCropBounds = this.originalGlobalCropBounds
            ? { ...this.originalGlobalCropBounds }
            : null;
        this.cropAllPages = this.originalCropAllPages;

        // Restore per-page crop bounds
        this.cropBoundsPerPage.clear();
        this.originalCropBoundsPerPage.forEach((value, key) => {
            this.cropBoundsPerPage.set(key, { ...value });
        });

        // Update checkbox state
        if (this.allPagesCheckbox) {
            this.allPagesCheckbox.checked = this.originalCropAllPages;
        }

        // Re-apply the original crop (or clear if there was none)
        this.loadCropForCurrentPage();

        // Now deactivate
        this.deactivate();
    }

    deactivate() {
        this.isActive = false;
        this.button.classList.remove('active');
        this.overlay.style.display = 'none';
        this.overlay.classList.remove('active');

        // Hide the all pages checkbox
        const checkboxContainer = document.getElementById('crop-all-pages-container');
        if (checkboxContainer) {
            checkboxContainer.style.display = 'none';
        }

        // Store normalized crop bounds
        if (this.cropBounds) {
            const normalizedBounds = this.normalizePixelBounds(this.cropBounds);

            if (normalizedBounds) {
                if (this.cropAllPages) {
                    // Save as global crop
                    this.globalCropBounds = normalizedBounds;
                    // Clear per-page crops since we're using global
                    this.cropBoundsPerPage.clear();
                } else {
                    // Save to current page only
                    const currentPage = appState.currentPdfPage;
                    this.cropBoundsPerPage.set(currentPage, normalizedBounds);
                }
            }

            this.applyCrop();
        }
    }

    updateOverlayPosition() {
        if (!this.cropBounds || !this.overlay) return;

        // Since overlay is inside map-content which has transform applied,
        // we use the original crop bounds directly (they're already in map-content coordinates)
        this.overlay.style.left = this.cropBounds.left + 'px';
        this.overlay.style.top = this.cropBounds.top + 'px';
        this.overlay.style.width = this.cropBounds.width + 'px';
        this.overlay.style.height = this.cropBounds.height + 'px';
    }

    updateHandleSize() {
        if (!this.overlay) return;

        const scale = appState.mapTransform.scale;
        const handles = this.overlay.querySelectorAll('.ms-crop-handle');

        // Make handles appear 25px regardless of zoom level
        handles.forEach(handle => {
            handle.style.transform = `scale(${1 / scale})`;
            handle.style.transformOrigin = 'center';
        });

        // Adjust position-specific transforms
        const handleN = this.overlay.querySelector('.ms-crop-handle-n');
        const handleS = this.overlay.querySelector('.ms-crop-handle-s');
        const handleW = this.overlay.querySelector('.ms-crop-handle-w');
        const handleE = this.overlay.querySelector('.ms-crop-handle-e');

        if (handleN) handleN.style.transform = `translateX(-50%) scale(${1 / scale})`;
        if (handleS) handleS.style.transform = `translateX(-50%) scale(${1 / scale})`;
        if (handleW) handleW.style.transform = `translateY(-50%) scale(${1 / scale})`;
        if (handleE) handleE.style.transform = `translateY(-50%) scale(${1 / scale})`;
    }

    startResize(e) {
        e.preventDefault();
        e.stopPropagation();

        this.isDragging = true;
        this.activeHandle = e.target.dataset.handle;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.startBounds = { ...this.cropBounds };

        // Store the scale at drag start
        this.dragStartScale = appState.mapTransform.scale;

        // Change cursor
        document.body.style.cursor = e.target.style.cursor;
    }

    handleMouseMove(e) {
        if (!this.isDragging || !this.activeHandle) return;

        // Use the scale from when dragging started to ensure consistent movement
        const deltaX = (e.clientX - this.dragStartX) / this.dragStartScale;
        const deltaY = (e.clientY - this.dragStartY) / this.dragStartScale;

        const newBounds = { ...this.startBounds };

        // Update bounds based on handle
        switch (this.activeHandle) {
            case 'nw':
                newBounds.left += deltaX;
                newBounds.top += deltaY;
                newBounds.width -= deltaX;
                newBounds.height -= deltaY;
                break;
            case 'n':
                newBounds.top += deltaY;
                newBounds.height -= deltaY;
                break;
            case 'ne':
                newBounds.top += deltaY;
                newBounds.width += deltaX;
                newBounds.height -= deltaY;
                break;
            case 'w':
                newBounds.left += deltaX;
                newBounds.width -= deltaX;
                break;
            case 'e':
                newBounds.width += deltaX;
                break;
            case 'sw':
                newBounds.left += deltaX;
                newBounds.width -= deltaX;
                newBounds.height += deltaY;
                break;
            case 's':
                newBounds.height += deltaY;
                break;
            case 'se':
                newBounds.width += deltaX;
                newBounds.height += deltaY;
                break;
        }

        // Ensure minimum size
        if (newBounds.width >= 50 && newBounds.height >= 50) {
            this.cropBounds = newBounds;
            this.updateOverlayPosition();
        }
    }

    stopResize() {
        if (this.isDragging) {
            this.isDragging = false;
            this.activeHandle = null;
            document.body.style.cursor = '';
        }
    }

    getActiveCropBounds() {
        // Get the normalized crop bounds that should be used for the current page
        let normalizedBounds;
        if (this.cropAllPages && this.globalCropBounds) {
            normalizedBounds = this.globalCropBounds;
        } else {
            const currentPage = appState.currentPdfPage;
            normalizedBounds = this.cropBoundsPerPage.get(currentPage);
        }

        // Convert to pixel bounds for current canvas
        return normalizedBounds ? this.denormalizePixelBounds(normalizedBounds) : null;
    }

    applyCrop() {
        const activeCropBounds = this.getActiveCropBounds();
        if (!activeCropBounds) return;

        // Get all dots and annotation lines
        const dots = this.mapContent.querySelectorAll('.ms-map-dot');
        const annotationLines = this.mapContent.querySelectorAll('.ms-annotation-line');

        // Hide dots outside crop area
        dots.forEach(dot => {
            const dotLeft = parseFloat(dot.style.left);
            const dotTop = parseFloat(dot.style.top);

            if (
                dotLeft < activeCropBounds.left ||
                dotLeft > activeCropBounds.left + activeCropBounds.width ||
                dotTop < activeCropBounds.top ||
                dotTop > activeCropBounds.top + activeCropBounds.height
            ) {
                dot.style.display = 'none';
            }
        });

        // Hide annotation lines outside crop area
        annotationLines.forEach(line => {
            const lineLeft = parseFloat(line.style.left);
            const lineTop = parseFloat(line.style.top);
            const lineWidth = parseFloat(line.style.width);
            const lineHeight = parseFloat(line.style.height);
            const lineRight = lineLeft + lineWidth;
            const lineBottom = lineTop + lineHeight;

            const cropRight = activeCropBounds.left + activeCropBounds.width;
            const cropBottom = activeCropBounds.top + activeCropBounds.height;

            // Check if line is completely outside crop area
            if (
                lineRight < activeCropBounds.left ||
                lineLeft > cropRight ||
                lineBottom < activeCropBounds.top ||
                lineTop > cropBottom
            ) {
                line.style.display = 'none';
            }
        });

        // Apply visual mask to canvas area outside crop
        this.applyCanvasMask();
    }

    applyCanvasMask() {
        const activeCropBounds = this.getActiveCropBounds();
        if (!activeCropBounds) {
            this.canvas.style.clipPath = '';
            return;
        }

        // Apply CSS clip-path to the canvas to only show the crop area
        const clipPath = `polygon(
            ${activeCropBounds.left}px ${activeCropBounds.top}px,
            ${activeCropBounds.left + activeCropBounds.width}px ${activeCropBounds.top}px,
            ${activeCropBounds.left + activeCropBounds.width}px ${activeCropBounds.top + activeCropBounds.height}px,
            ${activeCropBounds.left}px ${activeCropBounds.top + activeCropBounds.height}px
        )`;

        this.canvas.style.clipPath = clipPath;
    }

    reset() {
        // Remove clip-path from canvas
        if (this.canvas) {
            this.canvas.style.clipPath = '';
        }

        // Show all hidden elements
        const dots = this.mapContent.querySelectorAll('.ms-map-dot[style*="display: none"]');
        const lines = this.mapContent.querySelectorAll(
            '.ms-annotation-line[style*="display: none"]'
        );

        dots.forEach(dot => (dot.style.display = ''));
        lines.forEach(line => (line.style.display = ''));

        // Clear all crop data
        this.cropBounds = null;
        this.cropBoundsPerPage.clear();
        this.globalCropBounds = null;
        this.cropAllPages = false;

        if (this.allPagesCheckbox) {
            this.allPagesCheckbox.checked = false;
        }
    }

    // Apply any saved crops for the current page
    applySavedCrop() {
        // Wait for canvas to be fully rendered
        requestAnimationFrame(() => {
            const activeCropBounds = this.getActiveCropBounds();
            if (activeCropBounds) {
                // Apply the crop
                this.applyCanvasMask();

                // Also hide dots/lines outside crop area
                this.applyCrop();
            }
        });
    }

    clearAllCrops() {
        // Clear all crop data and remove any active crops
        this.cropBounds = null;
        this.cropBoundsPerPage.clear();
        this.globalCropBounds = null;
        this.cropAllPages = false;

        if (this.allPagesCheckbox) {
            this.allPagesCheckbox.checked = false;
        }

        if (this.canvas) {
            this.canvas.style.clipPath = '';
        }
    }
}

// Export a singleton instance
export const cropTool = new CropTool();

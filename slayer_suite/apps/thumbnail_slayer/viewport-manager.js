/**
 * viewport-manager.js
 * Handles viewport virtualization and optimized rendering for Thumbnail Slayer
 * Based on optimization patterns from Mapping Slayer
 */

import { thumbnailState } from './thumbnail-state.js';
import { renderSignThumbnailSVG } from './sign-renderer-svg.js';

/**
 * Viewport Manager Class
 * Manages efficient rendering of thumbnails using viewport virtualization
 */
export class ViewportManager {
    constructor() {
        // DOM element references
        this.container = null;
        this.scrollContainer = null;

        // Viewport state
        this.visibleItems = new Map();
        this.pendingRenders = new Set();
        this.renderQueue = [];

        // Configuration
        this.config = {
            // Grid mode settings
            gridItemWidth: 280, // Average width including gap
            gridItemHeight: 320, // Average height including gap

            // List mode settings
            listItemHeight: 60, // Height of list row

            // Buffer settings
            bufferSize: 2, // Number of items to render outside viewport
            batchSize: 10, // Number of items to render per batch
            renderDelay: 16, // Delay between batches (1 frame)

            // Scroll handling
            scrollDebounceDelay: 150,

            // DOM recycling pool
            maxPoolSize: 100,
            elementPool: []
        };

        // Intersection Observer for efficient visibility detection
        this.intersectionObserver = null;

        // Render state
        this.isRendering = false;
        this.renderAnimationFrame = null;
        this.scrollTimeout = null;

        // Performance metrics
        this.metrics = {
            totalRenders: 0,
            recycledElements: 0,
            createdElements: 0
        };
    }

    /**
     * Initialize the viewport manager
     */
    initialize(container, scrollContainer) {
        this.container = container;
        this.scrollContainer = scrollContainer || container;

        // Setup Intersection Observer
        this.setupIntersectionObserver();

        // Setup scroll handler
        this.setupScrollHandler();

        // Initial render
        this.updateViewport();
    }

    /**
     * Setup Intersection Observer for visibility detection
     */
    setupIntersectionObserver() {
        const options = {
            root: this.scrollContainer,
            rootMargin: `${this.config.gridItemHeight * this.config.bufferSize}px`,
            threshold: 0
        };

        this.intersectionObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const itemId = entry.target.dataset.itemId;

                if (entry.isIntersecting) {
                    // Item is entering viewport
                    if (!this.visibleItems.has(itemId)) {
                        this.visibleItems.set(itemId, entry.target);
                        this.queueLazyLoad(entry.target);
                    }
                } else {
                    // Item is leaving viewport
                    this.visibleItems.delete(itemId);
                    this.unloadItem(entry.target);
                }
            });
        }, options);
    }

    /**
     * Setup debounced scroll handler
     */
    setupScrollHandler() {
        let lastScrollTop = 0;
        let scrollVelocity = 0;

        const handleScroll = () => {
            const currentScrollTop = this.scrollContainer.scrollTop;
            scrollVelocity = Math.abs(currentScrollTop - lastScrollTop);
            lastScrollTop = currentScrollTop;

            // Clear existing timeout
            if (this.scrollTimeout) {
                clearTimeout(this.scrollTimeout);
            }

            // Adjust delay based on scroll velocity
            const delay =
                scrollVelocity > 500
                    ? this.config.scrollDebounceDelay * 2
                    : this.config.scrollDebounceDelay;

            // Debounce viewport update
            this.scrollTimeout = setTimeout(() => {
                this.updateViewport();
            }, delay);
        };

        this.scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    }

    /**
     * Calculate visible range based on scroll position
     */
    calculateVisibleRange() {
        // Safety check - return empty range if not initialized
        if (!this.scrollContainer || !this.container) {
            // Removed debug log: calculateVisibleRange called before initialization');
            return { startIndex: 0, endIndex: 0, itemsPerRow: 1 };
        }

        const scrollTop = this.scrollContainer.scrollTop;
        const containerHeight = this.scrollContainer.clientHeight;
        const viewMode = thumbnailState.viewMode;

        if (viewMode === 'grid') {
            // Calculate for grid layout
            const containerWidth = this.container.clientWidth;
            const itemsPerRow = Math.floor(containerWidth / this.config.gridItemWidth);
            const rowHeight = this.config.gridItemHeight;

            const startRow = Math.floor(scrollTop / rowHeight) - this.config.bufferSize;
            const endRow =
                Math.ceil((scrollTop + containerHeight) / rowHeight) + this.config.bufferSize;

            const startIndex = Math.max(0, startRow * itemsPerRow);
            const endIndex = endRow * itemsPerRow;

            return { startIndex, endIndex, itemsPerRow };
        } else {
            // Calculate for list layout
            const itemHeight = this.config.listItemHeight;
            const startIndex = Math.max(
                0,
                Math.floor(scrollTop / itemHeight) - this.config.bufferSize
            );
            const endIndex =
                Math.ceil((scrollTop + containerHeight) / itemHeight) + this.config.bufferSize;

            return { startIndex, endIndex, itemsPerRow: 1 };
        }
    }

    /**
     * Update viewport and render visible items
     */
    async updateViewport() {
        if (this.isRendering) return;

        this.isRendering = true;
        const items = Array.from(thumbnailState.productionItems.values());
        const { startIndex, endIndex } = this.calculateVisibleRange();

        // Get items that should be visible
        const visibleItems = items.slice(startIndex, endIndex + 1);

        // Create placeholder structure
        this.createViewportStructure(items.length, startIndex, endIndex);

        // Render visible items progressively
        await this.renderItemsAsync(visibleItems, startIndex);

        this.isRendering = false;
    }

    /**
     * Create viewport structure with placeholders
     */
    createViewportStructure(totalItems, startIndex, endIndex) {
        // Safety check
        if (!this.container) {
            // Removed debug log: createViewportStructure called without container');
            return;
        }

        const viewMode = thumbnailState.viewMode;

        if (viewMode === 'grid') {
            // Create spacer for items before viewport
            const spacerHeight =
                Math.floor(startIndex / this.getItemsPerRow()) * this.config.gridItemHeight;
            this.container.style.paddingTop = `${spacerHeight}px`;

            // Set total height to enable proper scrolling
            const totalRows = Math.ceil(totalItems / this.getItemsPerRow());
            const totalHeight = totalRows * this.config.gridItemHeight;
            this.container.style.height = `${totalHeight}px`;
        } else {
            // List mode spacers
            const spacerHeight = startIndex * this.config.listItemHeight;
            this.container.style.paddingTop = `${spacerHeight}px`;

            const totalHeight = totalItems * this.config.listItemHeight;
            this.container.style.height = `${totalHeight}px`;
        }
    }

    /**
     * Get items per row for grid layout
     */
    getItemsPerRow() {
        // Safety check - return default if container doesn't exist
        if (!this.container) {
            // Removed debug log: getItemsPerRow called without container, using default');
            return 4; // Default to 4 items per row
        }

        const containerWidth = this.container.clientWidth;
        return Math.max(1, Math.floor(containerWidth / this.config.gridItemWidth));
    }

    /**
     * Render items asynchronously in batches
     */
    async renderItemsAsync(items, startIndex) {
        const batchSize = this.config.batchSize;

        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);

            // Render batch
            await this.renderBatch(batch, startIndex + i);

            // Update progress if callback provided
            const progress = Math.min(100, Math.round(((i + batchSize) / items.length) * 100));
            this.onProgress?.(
                `Rendering thumbnails: ${Math.min(i + batchSize, items.length)}/${items.length}`,
                progress
            );

            // Allow browser to breathe
            await new Promise(resolve => {
                this.renderAnimationFrame = requestAnimationFrame(resolve);
            });
        }
    }

    /**
     * Render a batch of items
     */
    async renderBatch(items, baseIndex) {
        const fragment = document.createDocumentFragment();

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const element = await this.createOrRecycleElement(item, baseIndex + i);

            if (element) {
                fragment.appendChild(element);
                this.intersectionObserver.observe(element);
            }
        }

        // Append all at once for better performance
        if (this.container) {
            this.container.appendChild(fragment);
        } else {
            // Removed debug log: renderBatch - container is null, cannot append fragment');
        }
    }

    /**
     * Create or recycle a thumbnail element
     */
    async createOrRecycleElement(item, index) {
        let element;

        // Check if we have a custom renderer (for split view)
        if (this.thumbnailRenderer && typeof this.thumbnailRenderer === 'function') {
            element = this.thumbnailRenderer(item);
            if (element) {
                element.dataset.itemId = item.id;
                element.dataset.index = index;
                return element;
            }
        }

        // Try to get from pool
        if (this.config.elementPool.length > 0) {
            element = this.config.elementPool.pop();
            element.className = 'thumbnail-item';
            element.innerHTML = '';
            this.metrics.recycledElements++;
        } else {
            element = document.createElement('div');
            element.className = 'thumbnail-item';
            this.metrics.createdElements++;
        }

        // Set data attributes
        element.dataset.itemId = item.id;
        element.dataset.index = index;

        // Create placeholder structure
        element.innerHTML = this.createPlaceholderHTML(item);

        // Mark for lazy loading
        element.dataset.pending = 'true';

        return element;
    }

    /**
     * Create placeholder HTML for thumbnail (fallback for split view)
     */
    createPlaceholderHTML(item) {
        return `
            <div class="thumbnail-image">
                <div class="thumbnail-placeholder">
                    <div class="loading-spinner"></div>
                </div>
            </div>
            <!-- Overlays removed -->
        `;
    }

    /**
     * Queue item for lazy loading
     */
    queueLazyLoad(element) {
        if (element.dataset.pending !== 'true') return;

        this.renderQueue.push(element);
        this.processRenderQueue();
    }

    /**
     * Process render queue
     */
    async processRenderQueue() {
        if (this.renderQueue.length === 0) return;

        const element = this.renderQueue.shift();
        if (!element || element.dataset.pending !== 'true') {
            this.processRenderQueue();
            return;
        }

        // Get item data
        const itemId = element.dataset.itemId;
        const item = thumbnailState.productionItems.get(itemId);

        if (item) {
            await this.renderThumbnail(element, item);
        }

        // Continue processing queue
        if (this.renderQueue.length > 0) {
            requestAnimationFrame(() => this.processRenderQueue());
        }
    }

    /**
     * Render actual thumbnail content
     */
    async renderThumbnail(element, item) {
        try {
            // Render the SVG
            const svg = await renderSignThumbnailSVG(item, thumbnailState.thumbnailSize);

            // Update the thumbnail image container
            const imageContainer = element.querySelector('.thumbnail-image');
            if (imageContainer) {
                // Remove placeholder
                const placeholder = imageContainer.querySelector('.thumbnail-placeholder');
                if (placeholder) placeholder.remove();

                // Add SVG
                imageContainer.appendChild(svg);

                // Message overlays removed
            }

            // Mark as loaded
            element.dataset.pending = 'false';
            this.metrics.totalRenders++;
        } catch (error) {
            console.error('Failed to render thumbnail:', error);
        }
    }

    /**
     * Unload item when it leaves viewport
     */
    unloadItem(element) {
        // Only unload if we have too many elements
        if (this.visibleItems.size < this.config.maxPoolSize / 2) return;

        // Remove SVG to free memory
        const svg = element.querySelector('svg');
        if (svg) {
            svg.remove();
        }

        // Mark as pending again
        element.dataset.pending = 'true';

        // Add placeholder back
        const imageContainer = element.querySelector('.thumbnail-image');
        if (imageContainer && !imageContainer.querySelector('.thumbnail-placeholder')) {
            imageContainer.innerHTML = `
                <div class="thumbnail-placeholder">
                    <div class="loading-spinner"></div>
                </div>
            `;
        }
    }

    /**
     * Clean up when switching views or pages
     */
    cleanup() {
        // Removed debug log: ViewportManager cleanup called, container:', this.container);

        // Cancel any pending renders
        if (this.renderAnimationFrame) {
            cancelAnimationFrame(this.renderAnimationFrame);
        }

        // Clear timeouts
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }

        // Disconnect observer
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }

        // Clear render queue
        this.renderQueue = [];
        this.visibleItems.clear();

        // Return elements to pool - ONLY if container exists!
        if (this.container) {
            const elements = this.container.querySelectorAll('.thumbnail-item');
            elements.forEach(el => {
                if (this.config.elementPool.length < this.config.maxPoolSize) {
                    el.remove();
                    this.config.elementPool.push(el);
                }
            });

            // Reset container styles
            this.container.style.paddingTop = '0';
            this.container.style.height = 'auto';
        } else {
            // Removed debug log: Container is null, skipping DOM cleanup');
        }
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            poolSize: this.config.elementPool.length,
            visibleItems: this.visibleItems.size,
            queueLength: this.renderQueue.length
        };
    }

    /**
     * Update single thumbnail
     */
    async updateSingleThumbnail(itemId) {
        // Safety check - container must exist
        if (!this.container) {
            // Removed debug log: updateSingleThumbnail called before initialization');
            return;
        }

        const element = this.container.querySelector(`[data-item-id="${itemId}"]`);
        if (!element) return;

        const item = thumbnailState.productionItems.get(itemId);
        if (!item) return;

        // Re-render the thumbnail
        await this.renderThumbnail(element, item);
    }

    /**
     * Force refresh of visible items
     */
    forceRefresh() {
        this.visibleItems.forEach((element, itemId) => {
            if (element.dataset.pending !== 'true') {
                element.dataset.pending = 'true';
                this.queueLazyLoad(element);
            }
        });
    }
}

// Create singleton instance
export const viewportManager = new ViewportManager();

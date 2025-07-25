// map-controller.js
import { appState, getCurrentPageDots } from './state.js';

// Viewport virtualization functions
function getViewportBounds() {
    const mapContainer = document.getElementById('map-container');
    const containerRect = mapContainer.getBoundingClientRect();
    const { x: mapX, y: mapY, scale } = appState.mapTransform;
    
    // Calculate visible area in canvas coordinates with buffer
    const bufferSize = 200; // pixels of buffer around visible area
    
    const viewportBounds = {
        left: (-mapX - bufferSize) / scale,
        top: (-mapY - bufferSize) / scale, 
        right: (-mapX + containerRect.width + bufferSize) / scale,
        bottom: (-mapY + containerRect.height + bufferSize) / scale
    };
    
    return viewportBounds;
}

function isDotInViewport(dot, viewportBounds) {
    const dotRadius = (20 * appState.dotSize * 2) / 2; // Account for dot size
    
    return (dot.x + dotRadius >= viewportBounds.left &&
            dot.x - dotRadius <= viewportBounds.right &&
            dot.y + dotRadius >= viewportBounds.top &&
            dot.y - dotRadius <= viewportBounds.bottom);
}

function getVisibleDots() {
    const viewportBounds = getViewportBounds();
    const allDots = getCurrentPageDots();
    const visibleDots = new Map();
    
    for (const [id, dot] of allDots.entries()) {
        if (isDotInViewport(dot, viewportBounds)) {
            visibleDots.set(id, dot);
        }
    }
    
    return visibleDots;
}

async function renderPDFPage(pageNum) {
    if (!appState.pdfDoc) return;

    // Cancel any pending render task
    if (appState.pdfRenderTask) {
        appState.pdfRenderTask.cancel();
    }

    const page = await appState.pdfDoc.getPage(pageNum);
    const canvas = document.getElementById('pdf-canvas');
    const context = canvas.getContext('2d');
    const viewport = page.getViewport({ scale: appState.pdfScale });
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.display = 'block';

    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };

    // Store and await the new render task
    appState.pdfRenderTask = page.render(renderContext);
    try {
        await appState.pdfRenderTask.promise;
    } catch (error) {
        if (error.name !== 'RenderingCancelledException') {
            console.error("PDF rendering failed:", error);
        }
    } finally {
        appState.pdfRenderTask = null;
    }
    
    const mapContent = document.getElementById('map-content');
    mapContent.style.width = `${viewport.width}px`;
    mapContent.style.height = `${viewport.height}px`;
}

async function renderDotsForCurrentPage(useAsync = false) {
    document.getElementById('map-content').querySelectorAll('.map-dot').forEach(dot => dot.remove());
    const visibleDots = getVisibleDots();
    
    if (useAsync && visibleDots.size > 50) {
        // Use async rendering for large batches
        await renderDotsAsync(visibleDots);
    } else {
        // Use synchronous rendering for small amounts
        visibleDots.forEach(dot => createDotElement(dot));
    }
    
    console.log(`Rendered ${visibleDots.size} of ${getCurrentPageDots().size} dots`);
}

function updateSingleDot(internalId) {
    // Find the dot data
    const dot = getCurrentPageDots().get(internalId);
    if (!dot) return false;
    
    // Remove existing dot element
    const existingDot = document.querySelector(`.map-dot[data-dot-id="${internalId}"]`);
    if (existingDot) {
        existingDot.remove();
    }
    
    // Re-create the dot with updated properties
    createDotElement(dot);
    return true;
}

function createDotElement(dot) {
    const mapContent = document.getElementById('map-content');
    if (!mapContent) return;
    const dotElement = document.createElement('div');
    dotElement.className = 'map-dot';
    dotElement.dataset.dotId = dot.internalId;
    
    const effectiveMultiplier = appState.dotSize * 2;
    const size = 20 * effectiveMultiplier;
    const halfSize = size / 2;
    
    // Position the dot centered on the click point
    Object.assign(dotElement.style, { 
        left: `${dot.x - halfSize}px`, 
        top: `${dot.y - halfSize}px`,
        transform: 'none' // Override the CSS transform
    });
    
    const markerTypeInfo = appState.markerTypes[dot.markerType] || { color: '#ff0000', textColor: '#FFFFFF' };
    Object.assign(dotElement.style, { 
        backgroundColor: markerTypeInfo.color, 
        color: markerTypeInfo.textColor,
        width: `${size}px`, 
        height: `${size}px`, 
        fontSize: `${8 * effectiveMultiplier}px` 
    });

    if (appState.selectedDots.has(dot.internalId)) { 
        dotElement.classList.add('selected');
        Object.assign(dotElement.style, {
            boxShadow: '0 0 15px #00ff88, 0 0 30px #00ff88',
            border: '2px solid #00ff88',
            zIndex: '200'
        });
    }
    
    if (dot.isCodeRequired) { 
        dotElement.classList.add('code-required-dot');
    }

    const messageFontSize = 10 * effectiveMultiplier;
    const locationDisplay = appState.locationsVisible ? '' : 'display: none;';
    const iconSize = 8 * effectiveMultiplier;
    const installedCheckmark = dot.installed ? `<div class="dot-installed-checkmark" style="width: ${size}px; height: ${size}px; top: 0; left: 0; border: none; background: none; overflow: hidden;"><div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(45deg, transparent 47%, #00ff00 47%, #00ff00 53%, transparent 53%);"></div></div>` : '';
    const vinylBackerSymbol = dot.vinylBacker ? `<div class="dot-vinyl-backer" style="width: ${iconSize}px; height: ${iconSize}px; font-size: ${5 * effectiveMultiplier}px; top: ${15 * effectiveMultiplier}px; left: 50%; transform: translateX(-50%); border-width: ${1 * effectiveMultiplier}px;"></div>` : '';
    const codeRequiredStar = dot.isCodeRequired ? `<div class="dot-code-required-star" style="position: absolute; top: ${-10 * effectiveMultiplier}px; left: 50%; transform: translateX(-50%); font-size: ${10 * effectiveMultiplier}px; color: #FFD700; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">⭐</div>` : '';
    dotElement.innerHTML = `${codeRequiredStar}<span class="dot-number" style="${locationDisplay}">${dot.locationNumber}</span>${vinylBackerSymbol}<div class="map-dot-message" style="color: ${markerTypeInfo.color}; font-size: ${messageFontSize}px;">${dot.message}</div><div class="map-dot-message2" style="color: ${markerTypeInfo.color}; font-size: ${messageFontSize}px; margin-top: ${8 * effectiveMultiplier}px;">${dot.message2 || ''}</div>${installedCheckmark}`;

    if (dot.notes && dot.notes.trim()) {
        dotElement.setAttribute('title', dot.notes);
    }

    if (appState.messagesVisible) { dotElement.querySelector('.map-dot-message').classList.add('visible'); }
    if (appState.messages2Visible) { 
        const msg2Element = dotElement.querySelector('.map-dot-message2');
        if (msg2Element) msg2Element.classList.add('visible'); 
    }
    mapContent.appendChild(dotElement);
}

function applyMapTransform() {
    const mapContent = document.getElementById('map-content');
    const { x, y, scale } = appState.mapTransform;
    mapContent.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    
    // Update visible dots after transform change
    updateViewportDots();
}

function centerOnDot(internalId, zoomLevel = 1.5) {
    const dot = getCurrentPageDots().get(internalId); if (!dot) return;
    const containerRect = document.getElementById('map-container').getBoundingClientRect();
    appState.mapTransform.scale = zoomLevel;
    appState.mapTransform.x = (containerRect.width / 2) - (dot.x * zoomLevel);
    appState.mapTransform.y = (containerRect.height / 2) - (dot.y * zoomLevel);
    applyMapTransform();
}

async function renderDotsAsync(dots, statusCallback = null) {
    const BATCH_SIZE = 25; // Process 25 dots at a time
    const dotsArray = Array.from(dots.values());
    
    for (let i = 0; i < dotsArray.length; i += BATCH_SIZE) {
        const batch = dotsArray.slice(i, i + BATCH_SIZE);
        
        // Create DOM elements for this batch
        batch.forEach(dot => createDotElement(dot));
        
        // Update progress if callback provided
        if (statusCallback) {
            const progress = Math.min(100, Math.round(((i + BATCH_SIZE) / dotsArray.length) * 100));
            statusCallback(`Rendering dots: ${Math.min(i + BATCH_SIZE, dotsArray.length)}/${dotsArray.length}`, progress);
        }
        
        // Allow browser to breathe (paint, handle events)
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

function updateViewportDots() {
    // Only re-render if we have dots and a PDF loaded
    if (!appState.pdfDoc || getCurrentPageDots().size === 0) return;
    
    const currentVisibleIds = new Set();
    document.querySelectorAll('.map-dot').forEach(dot => {
        currentVisibleIds.add(dot.dataset.dotId);
    });
    
    const shouldBeVisible = getVisibleDots();
    const shouldBeVisibleIds = new Set(shouldBeVisible.keys());
    
    // Remove dots that should no longer be visible
    currentVisibleIds.forEach(id => {
        if (!shouldBeVisibleIds.has(id)) {
            const dotElement = document.querySelector(`.map-dot[data-dot-id="${id}"]`);
            if (dotElement) dotElement.remove();
        }
    });
    
    // Add dots that should now be visible
    shouldBeVisibleIds.forEach(id => {
        if (!currentVisibleIds.has(id)) {
            const dot = shouldBeVisible.get(id);
            if (dot) createDotElement(dot);
        }
    });
}

function isDotVisible(internalId) {
    const dotElement = document.querySelector(`.map-dot[data-dot-id="${internalId}"]`); if (!dotElement) return false;
    const mapRect = document.getElementById('map-container').getBoundingClientRect();
    const dotRect = dotElement.getBoundingClientRect();
    return !(dotRect.right < mapRect.left || dotRect.left > mapRect.right || dotRect.bottom < mapRect.top || dotRect.top > mapRect.bottom);
}

// Map interaction handlers
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let lastTransform = { x: 0, y: 0 };

function handleMapMouseDown(e) {
    if (e.button !== 1) return; // Only middle mouse button
    
    isDragging = true;
    dragStart.x = e.clientX;
    dragStart.y = e.clientY;
    lastTransform.x = appState.mapTransform.x;
    lastTransform.y = appState.mapTransform.y;
    
    document.addEventListener('mousemove', handleMapMouseMove);
    document.addEventListener('mouseup', handleMapMouseUp);
    
    e.preventDefault();
}

function handleMapMouseMove(e) {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    appState.mapTransform.x = lastTransform.x + deltaX;
    appState.mapTransform.y = lastTransform.y + deltaY;
    
    applyMapTransform();
    updateViewportDots();
}

function handleMapMouseUp(e) {
    isDragging = false;
    document.removeEventListener('mousemove', handleMapMouseMove);
    document.removeEventListener('mouseup', handleMapMouseUp);
}

function handleMapWheel(e) {
    e.preventDefault();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(5, appState.mapTransform.scale * zoomFactor));
    
    // Zoom towards mouse position
    const scaleChange = newScale / appState.mapTransform.scale;
    appState.mapTransform.x = mouseX - (mouseX - appState.mapTransform.x) * scaleChange;
    appState.mapTransform.y = mouseY - (mouseY - appState.mapTransform.y) * scaleChange;
    appState.mapTransform.scale = newScale;
    
    applyMapTransform();
    updateViewportDots();
}

function setupMapInteraction() {
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer) return;
    
    mapContainer.addEventListener('mousedown', handleMapMouseDown);
    mapContainer.addEventListener('wheel', handleMapWheel, { passive: false });
    mapContainer.style.cursor = 'grab';
    
    // Change cursor during drag
    document.addEventListener('mousedown', (e) => {
        if (e.target.closest('#map-container')) {
            mapContainer.style.cursor = 'grabbing';
        }
    });
    
    document.addEventListener('mouseup', () => {
        mapContainer.style.cursor = 'grab';
    });
}

export {
    renderPDFPage,
    renderDotsForCurrentPage,
    updateSingleDot,
    applyMapTransform,
    isDotVisible,
    centerOnDot,
    setupMapInteraction
};

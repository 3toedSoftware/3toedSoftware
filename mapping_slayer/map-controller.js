// map-controller.js

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
    const mapContent = document.getElementById('map-content');
    const visibleDots = getVisibleDots();
    const existingDotElements = new Map();
    
    // Build a map of existing dot elements
    mapContent.querySelectorAll('.map-dot').forEach(dotEl => {
        existingDotElements.set(dotEl.dataset.dotId, dotEl);
    });
    
    // Track which dots we've processed
    const processedIds = new Set();
    
    // Update or create dots
    for (const [dotId, dot] of visibleDots) {
        processedIds.add(dotId);
        const existingElement = existingDotElements.get(dotId);
        
        if (existingElement) {
            // Update existing dot instead of recreating
            updateDotElement(existingElement, dot);
        } else {
            // Create new dot
            createDotElement(dot);
        }
    }
    
    // Remove dots that are no longer visible
    for (const [dotId, dotEl] of existingDotElements) {
        if (!processedIds.has(dotId)) {
            dotEl.remove();
        }
    }
    
    console.log(`Updated ${visibleDots.size} of ${getCurrentPageDots().size} dots`);
}

function updateDotElement(dotElement, dot) {
    // Update position
    dotElement.style.left = `${dot.x}px`;
    dotElement.style.top = `${dot.y}px`;
    
    // Update marker type info
    const markerTypeInfo = appState.markerTypes[dot.markerType] || { color: '#ff0000', textColor: '#FFFFFF' };
    dotElement.style.backgroundColor = markerTypeInfo.color;
    dotElement.style.color = markerTypeInfo.textColor;
    
    // Update size
    const effectiveMultiplier = appState.dotSize * 2;
    const size = 20 * effectiveMultiplier;
    dotElement.style.width = `${size}px`;
    dotElement.style.height = `${size}px`;
    dotElement.style.fontSize = `${8 * effectiveMultiplier}px`;
    
    // Update selection state
    if (appState.selectedDots.has(dot.internalId)) {
        if (!dotElement.classList.contains('selected')) {
            dotElement.classList.add('selected');
            Object.assign(dotElement.style, {
                boxShadow: '0 0 15px #00ff88, 0 0 30px #00ff88',
                border: '2px solid #00ff88',
                zIndex: '200'
            });
        }
    } else {
        if (dotElement.classList.contains('selected')) {
            dotElement.classList.remove('selected');
            Object.assign(dotElement.style, { boxShadow: '', border: '', zIndex: '' });
        }
    }
    
    // Update code required state
    if (dot.isCodeRequired) {
        if (!dotElement.classList.contains('code-required-dot')) {
            dotElement.classList.add('code-required-dot');
            const innerOutline = Math.max(2, Math.round(2 * effectiveMultiplier));
            const outerOutline = Math.max(3, Math.round(3 * effectiveMultiplier));
            dotElement.style.boxShadow = `0 0 0 ${innerOutline}px #f2ff00, 0 0 0 ${outerOutline}px rgb(25, 25, 25)`;
        }
    } else {
        dotElement.classList.remove('code-required-dot');
        if (!appState.selectedDots.has(dot.internalId)) {
            dotElement.style.boxShadow = '';
        }
    }
    
    // Update location number
    const dotNumber = dotElement.querySelector('.dot-number');
    if (dotNumber) {
        dotNumber.textContent = dot.locationNumber;
        dotNumber.style.display = appState.locationsVisible ? '' : 'none';
    }
    
    // Update messages
    const message1 = dotElement.querySelector('.map-dot-message');
    if (message1) {
        message1.textContent = dot.message;
        message1.style.color = markerTypeInfo.color;
        message1.style.fontSize = `${10 * effectiveMultiplier}px`;
        message1.classList.toggle('visible', appState.messagesVisible);
    }
    
    const message2 = dotElement.querySelector('.map-dot-message2');
    if (message2) {
        message2.textContent = dot.message2 || '';
        message2.style.color = markerTypeInfo.color;
        message2.style.fontSize = `${10 * effectiveMultiplier}px`;
        message2.style.marginTop = `${8 * effectiveMultiplier}px`;
        message2.classList.toggle('visible', appState.messages2Visible);
    }
    
    // Update title (notes)
    if (dot.notes && dot.notes.trim()) {
        dotElement.setAttribute('title', dot.notes);
    } else {
        dotElement.removeAttribute('title');
    }
}

function createDotElement(dot) {
    const mapContent = document.getElementById('map-content');
    if (!mapContent) return;
    const dotElement = document.createElement('div');
    dotElement.className = 'map-dot';
    dotElement.dataset.dotId = dot.internalId;
    Object.assign(dotElement.style, { left: `${dot.x}px`, top: `${dot.y}px` });
    const markerTypeInfo = appState.markerTypes[dot.markerType] || { color: '#ff0000', textColor: '#FFFFFF' };
    Object.assign(dotElement.style, { backgroundColor: markerTypeInfo.color, color: markerTypeInfo.textColor });

    const effectiveMultiplier = appState.dotSize * 2;
    const size = 20 * effectiveMultiplier;
    Object.assign(dotElement.style, { width: `${size}px`, height: `${size}px`, fontSize: `${8 * effectiveMultiplier}px` });

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
        // Apply scaled code required outline
        const innerOutline = Math.max(2, Math.round(2 * effectiveMultiplier));
        const outerOutline = Math.max(3, Math.round(3 * effectiveMultiplier));
        dotElement.style.boxShadow = `0 0 0 ${innerOutline}px #f2ff00, 0 0 0 ${outerOutline}px rgb(25, 25, 25)`;
    }

    const messageFontSize = 10 * effectiveMultiplier;
    const locationDisplay = appState.locationsVisible ? '' : 'display: none;';
    const iconSize = 8 * effectiveMultiplier;
    const installedCheckmark = dot.installed ? `<div class="dot-installed-checkmark" style="width: ${size}px; height: ${size}px; top: 0; left: 0; border: none; background: none; overflow: hidden;"><div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(45deg, transparent 47%, #00ff00 47%, #00ff00 53%, transparent 53%);"></div></div>` : '';
    const vinylBackerSymbol = dot.vinylBacker ? `<div class="dot-vinyl-backer" style="width: ${iconSize}px; height: ${iconSize}px; font-size: ${5 * effectiveMultiplier}px; top: ${3 * effectiveMultiplier + 24}px; left: 50%; transform: translateX(-50%); border-width: ${1 * effectiveMultiplier}px;"></div>` : '';
    dotElement.innerHTML = `<span class="dot-number" style="${locationDisplay}">${dot.locationNumber}</span><div class="map-dot-message" style="color: ${markerTypeInfo.color}; font-size: ${messageFontSize}px;">${dot.message}</div><div class="map-dot-message2" style="color: ${markerTypeInfo.color}; font-size: ${messageFontSize}px; margin-top: ${8 * effectiveMultiplier}px;">${dot.message2 || ''}</div>${vinylBackerSymbol}${installedCheckmark}`;

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

// map-controller.js

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

function renderDotsForCurrentPage() {
    document.getElementById('map-content').querySelectorAll('.map-dot').forEach(dot => dot.remove());
    getCurrentPageDots().forEach(dot => createDotElement(dot));
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

    if (appState.selectedDots.has(dot.internalId)) { dotElement.classList.add('selected'); }
    if (dot.isCodeRequired) { dotElement.classList.add('code-required-dot'); }

    const messageFontSize = 10 * effectiveMultiplier;
    const dotNumberDecoration = dot.installed ? 'text-decoration: underline;' : '';
    dotElement.innerHTML = `<span class="dot-number" style="${dotNumberDecoration}">${dot.locationNumber}</span><div class="map-dot-message" style="color: ${markerTypeInfo.color}; font-size: ${messageFontSize}px;">${dot.message}</div>`;

    if (dot.notes && dot.notes.trim()) {
        dotElement.setAttribute('title', dot.notes);
    }

    if (appState.messagesVisible) { dotElement.querySelector('.map-dot-message').classList.add('visible'); }
    mapContent.appendChild(dotElement);
}

function applyMapTransform() {
    const mapContent = document.getElementById('map-content');
    const { x, y, scale } = appState.mapTransform;
    mapContent.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

function centerOnDot(internalId, zoomLevel = 1.5) {
    const dot = getCurrentPageDots().get(internalId); if (!dot) return;
    const containerRect = document.getElementById('map-container').getBoundingClientRect();
    appState.mapTransform.scale = zoomLevel;
    appState.mapTransform.x = (containerRect.width / 2) - (dot.x * zoomLevel);
    appState.mapTransform.y = (containerRect.height / 2) - (dot.y * zoomLevel);
    applyMapTransform();
}

function isDotVisible(internalId) {
    const dotElement = document.querySelector(`.map-dot[data-dot-id="${internalId}"]`); if (!dotElement) return false;
    const mapRect = document.getElementById('map-container').getBoundingClientRect();
    const dotRect = dotElement.getBoundingClientRect();
    return !(dotRect.right < mapRect.left || dotRect.left > mapRect.right || dotRect.bottom < mapRect.top || dotRect.top > mapRect.bottom);
}

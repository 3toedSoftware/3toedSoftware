// ui.js - Fixed version with proper syntax

// Import the state system
import { appState, getCurrentPageDots, getDotsForPage, setDirtyState, getCurrentPageData, UndoManager } from './state.js';
import { renderDotsForCurrentPage, renderPDFPage, centerOnDot, applyMapTransform, updateSingleDot } from './map-controller.js';

let previewTimeout = null;

function showCSVStatus(message, isSuccess = true, duration = 5000) {
    const statusDiv = document.getElementById('csv-status');
    const contentDiv = document.getElementById('csv-status-content');
    if (statusDiv && contentDiv) {
        contentDiv.textContent = message;
        statusDiv.className = 'csv-status visible ' + (isSuccess ? 'success' : 'error');
        setTimeout(() => statusDiv.classList.remove('visible'), duration);
    }
}

function updatePageInfo() {
    if (!appState.pdfDoc) return;
    const pageInfo = document.getElementById('page-info');
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (pageInfo) {
        pageInfo.textContent = 'PAGE ' + appState.currentPdfPage + ' OF ' + appState.totalPages;
    }
    if (prevBtn) {
        prevBtn.disabled = appState.currentPdfPage <= 1;
    }
    if (nextBtn) {
        nextBtn.disabled = appState.currentPdfPage >= appState.totalPages;
    }
}

function updatePageLabelInput() {
    const labelInput = document.getElementById('page-label-input');
    if (labelInput) {
        const currentLabel = appState.pageLabels.get(appState.currentPdfPage) || '';
        labelInput.value = currentLabel;
    }
}

function updateAllSectionsForCurrentPage() {
    updateFilterCheckboxes();
    updateLocationList();
    updateMapLegend();
    updateProjectLegend();
    updateEditModalOptions();
}

function updateFilterCheckboxes() {
    const container = document.getElementById('filter-checkboxes');
    if (!container) return;
    
    const scrollPosition = container.scrollTop;
    container.innerHTML = '';
    
    const sortedMarkerTypeCodes = Object.keys(appState.markerTypes).sort((a, b) => 
        a.localeCompare(b, undefined, { numeric: true })
    );

    if (sortedMarkerTypeCodes.length === 0) {
        container.innerHTML = '<div class="empty-state" style="font-size: 12px; padding: 10px;">No marker types exist. Click + to add one.</div>';
        return;
    }

    sortedMarkerTypeCodes.forEach(markerTypeCode => {
        const typeData = appState.markerTypes[markerTypeCode];
        const count = Array.from(getCurrentPageDots().values()).filter(d => d.markerType === markerTypeCode).length;
        
        const item = document.createElement('div');
        item.className = 'filter-checkbox';
        if (markerTypeCode === appState.activeMarkerType) {
            item.classList.add('legend-item-active');
        }
        
        // Build innerHTML with proper concatenation to avoid template literal issues
        const checkboxInput = '<input type="checkbox" data-marker-type-code="' + markerTypeCode + '" checked>';
        const countLabel = '<span class="checkbox-label">(' + count + ')</span>';
        const codeInput = '<input type="text" class="marker-type-code-input" placeholder="Enter code..." value="' + typeData.code + '" data-original-code="' + typeData.code + '">';
        const nameInput = '<input type="text" class="marker-type-name-input" placeholder="Enter name..." value="' + typeData.name + '" data-original-name="' + typeData.name + '" data-code="' + typeData.code + '">';
        const designRefSquare = '<div class="design-reference-square" data-marker-type="' + markerTypeCode + '">' +
            '<div class="design-reference-empty" style="display: ' + (typeData.designReference ? 'none' : 'flex') + ';"><span class="upload-plus-icon">+</span></div>' +
            '<div class="design-reference-filled" style="display: ' + (typeData.designReference ? 'flex' : 'none') + ';"><img class="design-reference-thumbnail" src="' + (typeData.designReference || '') + '" alt="Design Reference"><button class="design-reference-delete" type="button">&times;</button></div>' +
            '</div>';
        const fileInput = '<input type="file" class="design-reference-input" accept="image/jpeg,image/jpg,image/png" style="display: none;" data-marker-type="' + markerTypeCode + '">';
        const colorPickers = '<div class="color-picker-wrapper" data-marker-type-code="' + markerTypeCode + '" data-color-type="dot"></div>' +
            '<div class="color-picker-wrapper" data-marker-type-code="' + markerTypeCode + '" data-color-type="text"></div>';
        const deleteBtn = '<button class="delete-marker-type-btn" data-marker-type-code="' + markerTypeCode + '">×</button>';
        
        item.innerHTML = checkboxInput + countLabel +
            '<div class="marker-type-inputs">' + codeInput + nameInput + '</div>' +
            '<div class="design-reference-container">' + designRefSquare + fileInput + '</div>' +
            '<div class="marker-type-controls">' + colorPickers + deleteBtn + '</div>';
        
        container.appendChild(item);
        
        setupDesignReferenceHandlers(item, markerTypeCode);
        
        const codeInputEl = item.querySelector('.marker-type-code-input');
        const nameInputEl = item.querySelector('.marker-type-name-input');
        
        resizeInput(codeInputEl);
        codeInputEl.addEventListener('input', () => resizeInput(codeInputEl));
        codeInputEl.addEventListener('focus', () => resizeInput(codeInputEl));
        codeInputEl.addEventListener('blur', () => resizeInput(codeInputEl));
        
        item.addEventListener('click', (e) => {
            if (e.target.closest('input, .pcr-app, .color-picker-wrapper, .delete-marker-type-btn, .design-reference-square')) return;
            e.preventDefault();
            appState.activeMarkerType = markerTypeCode;
            updateFilterCheckboxes();
        });

        item.querySelector('input[type="checkbox"]').addEventListener('change', applyFilters);
        codeInputEl.addEventListener('change', (e) => handleMarkerTypeCodeChange(e.target));
        nameInputEl.addEventListener('change', (e) => handleMarkerTypeNameChange(e.target));
        item.querySelector('.delete-marker-type-btn').addEventListener('click', () => deleteMarkerType(markerTypeCode));
        
        initializeColorPickers(item, markerTypeCode, typeData);
    });

    container.scrollTop = scrollPosition;
}

function resizeInput(input) {
    const temp = document.createElement('span');
    temp.style.visibility = 'hidden';
    temp.style.position = 'absolute';
    temp.style.font = window.getComputedStyle(input).font;
    temp.style.padding = window.getComputedStyle(input).padding;
    temp.textContent = input.value || input.placeholder || 'A';
    document.body.appendChild(temp);
    
    // Add 5px extra for padding to prevent text cutoff
    const width = Math.max(42, temp.offsetWidth + 5);
    input.style.width = width + 'px';
    
    document.body.removeChild(temp);
}

function initializeColorPickers(item, markerTypeCode, typeData) {
    if (!window.Pickr) {
        console.warn('Pickr color picker library not loaded');
        return;
    }
    
    item.querySelectorAll('.color-picker-wrapper').forEach(wrapper => {
        const colorType = wrapper.dataset.colorType;
        const initialColor = (colorType === 'dot') ? typeData.color : typeData.textColor;
        wrapper.style.backgroundColor = initialColor;

        const pickr = Pickr.create({
            el: wrapper, 
            theme: 'classic', 
            useAsButton: true, 
            default: initialColor,
            components: { 
                preview: true, 
                opacity: false, 
                hue: true, 
                interaction: { hex: true, rgba: false, input: true, save: true, clear: false } 
            }
        });

        pickr.on('change', (color) => { 
            wrapper.style.backgroundColor = color.toHEXA().toString(); 
        });
        
        pickr.on('save', (color) => {
            const newColor = color.toHEXA().toString();
            if (colorType === 'dot') { 
                appState.markerTypes[markerTypeCode].color = newColor; 
            } else { 
                appState.markerTypes[markerTypeCode].textColor = newColor; 
            }
            wrapper.style.backgroundColor = newColor;
            setDirtyState();
            updateAllSectionsForCurrentPage();
            renderDotsForCurrentPage();
            pickr.hide();
        });
        
        pickr.on('hide', () => {
            const currentColor = (colorType === 'dot') ? appState.markerTypes[markerTypeCode].color : appState.markerTypes[markerTypeCode].textColor;
            wrapper.style.backgroundColor = currentColor;
        });
    });
}

function updateMapLegend() {
    const legend = document.getElementById('map-legend');
    const content = document.getElementById('map-legend-content');
    if (!legend || !content) return;
    
    const usedMarkerTypeCodes = new Set(Array.from(getCurrentPageDots().values()).map(d => d.markerType));
    
    legend.classList.toggle('collapsed', appState.pageLegendCollapsed);

    if (usedMarkerTypeCodes.size === 0) {
        legend.classList.remove('visible');
        return;
    }
    
    legend.classList.add('visible');
    content.innerHTML = '';
    
    const sortedMarkerTypeCodes = Array.from(usedMarkerTypeCodes).sort((a, b) => 
        a.localeCompare(b, undefined, { numeric: true })
    );
    
    sortedMarkerTypeCodes.forEach(code => {
        const typeData = appState.markerTypes[code];
        if (!typeData) return;
        
        const count = Array.from(getCurrentPageDots().values()).filter(d => d.markerType === code).length;
        const item = document.createElement('div');
        item.className = 'map-legend-item';
        item.innerHTML = '<div class="map-legend-dot" style="background-color: ' + typeData.color + ';"></div>' +
            '<span class="map-legend-text">' + typeData.code + ' - ' + typeData.name + '</span>' +
            '<span class="map-legend-count">' + count + '</span>';
        content.appendChild(item);
    });
}

function updateProjectLegend() {
    const legend = document.getElementById('project-legend');
    const content = document.getElementById('project-legend-content');
    if (!legend || !content) return;

    const projectCounts = new Map();
    for (const pageData of appState.dotsByPage.values()) {
        for (const dot of pageData.dots.values()) {
            projectCounts.set(dot.markerType, (projectCounts.get(dot.markerType) || 0) + 1);
        }
    }

    legend.classList.toggle('collapsed', appState.projectLegendCollapsed);

    if (projectCounts.size === 0) {
        legend.classList.remove('visible');
        return;
    }

    legend.classList.add('visible');
    content.innerHTML = '';

    const sortedMarkerTypeCodes = Array.from(projectCounts.keys()).sort((a,b) => 
        a.localeCompare(b, undefined, { numeric: true })
    );

    sortedMarkerTypeCodes.forEach(code => {
        const typeData = appState.markerTypes[code];
        if (!typeData) return;
        
        const count = projectCounts.get(code);
        const item = document.createElement('div');
        item.className = 'map-legend-item';
        item.innerHTML = '<div class="map-legend-dot" style="background-color: ' + typeData.color + ';"></div>' +
            '<span class="map-legend-text">' + typeData.code + ' - ' + typeData.name + '</span>' +
            '<span class="map-legend-count">' + count + '</span>';
        content.appendChild(item);
    });
}

function getActiveFilters() {
    const container = document.getElementById('filter-checkboxes');
    if (!container || !container.hasChildNodes()) return [];
    return Array.from(container.querySelectorAll('input:checked')).map(cb => cb.dataset.markerTypeCode);
}

function applyFilters() {
    const activeFilters = getActiveFilters();
    document.querySelectorAll('.map-dot').forEach(dotElement => {
        const dot = getCurrentPageDots().get(dotElement.dataset.dotId);
        dotElement.style.display = dot && activeFilters.includes(dot.markerType) ? 'flex' : 'none';
    });
    updateLocationList(); 
    updateMapLegend();
}

function updateLocationList() {
    const container = document.getElementById('location-list');
    if (!container) return;
    
    container.innerHTML = '';
    const listWrapper = document.getElementById('list-with-renumber');
    const emptyState = document.getElementById('empty-state');
    const activeFilters = getActiveFilters();
    let allDots = [];

    if (appState.isAllPagesView) {
        for (let pageNum = 1; pageNum <= appState.totalPages; pageNum++) {
            const dotsOnPage = Array.from(getDotsForPage(pageNum).values());
            const visibleDots = dotsOnPage
                .filter(dot => activeFilters.includes(dot.markerType))
                .map(dot => Object.assign({}, dot, { page: pageNum }));
            allDots.push(...visibleDots);
        }
    } else {
        allDots = Array.from(getCurrentPageDots().values()).filter(dot => activeFilters.includes(dot.markerType));
    }

    if (allDots.length === 0) {
        if (listWrapper) listWrapper.style.display = 'none';
        if (emptyState) {
            emptyState.style.display = 'block';
            if (appState.isAllPagesView) {
                emptyState.textContent = 'No dots match the current filter across all pages.';
            } else {
                emptyState.textContent = getCurrentPageDots().size > 0 ? 'No dots match the current filter.' : 'Click on the map to add your first location dot.';
            }
        }
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (listWrapper) listWrapper.style.display = 'block';
    
    const toggleBtn = document.getElementById('toggle-view-btn');
    if (toggleBtn) {
        toggleBtn.textContent = appState.listViewMode === 'flat' ? 'UNGROUPED' : 'GROUPED';
    }
    
    if (appState.listViewMode === 'grouped') {
        renderGroupedLocationList(allDots, container);
    } else {
        renderFlatLocationList(allDots, container);
    }
}

function renderFlatLocationList(allDots, container) {
    allDots.sort((a, b) => {
        if (appState.isAllPagesView && a.page !== b.page) {
            return a.page - b.page;
        }
        if (appState.sortMode === 'location') {
            return a.locationNumber.localeCompare(b.locationNumber);
        } else {
            return a.message.localeCompare(b.message);
        }
    }).forEach(dot => {
        const typeData = appState.markerTypes[dot.markerType];
        const item = document.createElement('div');
        item.className = 'location-item';
        item.dataset.dotId = dot.internalId;
        
        if (dot.page) {
            item.dataset.dotPage = dot.page;
        }
        if (appState.selectedDots.has(dot.internalId)) {
            item.classList.add('selected');
        }

        const badgeClass = dot.isCodeRequired ? 'marker-type-badge code-required-badge' : 'marker-type-badge';
        const badgeText = typeData.code + ' - ' + typeData.name;
        const pagePrefix = appState.isAllPagesView ? '(P' + dot.page + ') ' : '';

        item.innerHTML = '<div class="location-header">' +
            '<span class="location-number">' + pagePrefix + dot.locationNumber + '</span>' +
            '<input type="text" class="location-message-input" value="' + dot.message + '" data-dot-id="' + dot.internalId + '">' +
            '<span class="' + badgeClass + '" style="background-color:' + typeData.color + '; color: ' + typeData.textColor + ';" title="' + badgeText + '">' + badgeText + '</span>' +
            '</div>';
        
        container.appendChild(item);

        item.addEventListener('click', async (e) => {
            const dotPage = e.currentTarget.dataset.dotPage ? parseInt(e.currentTarget.dataset.dotPage, 10) : appState.currentPdfPage;
            if (dotPage !== appState.currentPdfPage) {
                await changePage(dotPage);
            }
            centerOnDot(dot.internalId);
            
            setTimeout(() => {
                if (e.shiftKey) {
                    toggleDotSelection(dot.internalId);
                } else {
                    if (appState.selectedDots.has(dot.internalId) && appState.selectedDots.size === 1) {
                        clearSelection();
                    } else {
                        clearSelection();
                        selectDot(dot.internalId);
                    }
                }
                updateSelectionUI();
            }, 100);
        });

        const messageInput = item.querySelector('.location-message-input');
        let originalMessage = dot.message;
        
        messageInput.addEventListener('focus', (e) => {
            originalMessage = e.target.value;
        });
        
        messageInput.addEventListener('blur', (e) => {
            if (e.target.value !== originalMessage) {
                UndoManager.capture('Edit message');
            }
        });
        
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur(); // This will trigger the blur event and save changes
            }
        });
        
        messageInput.addEventListener('input', (e) => {
            const dotToUpdate = getDotsForPage(dot.page || appState.currentPdfPage).get(dot.internalId);
            if (dotToUpdate) {
                dotToUpdate.message = e.target.value;
                setDirtyState();
                renderDotsForCurrentPage();
            }
        });

        messageInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });

    });
}

function renderGroupedLocationList(allDots, container) {
    const groupedDots = {};
    allDots.forEach(dot => {
        if (!groupedDots[dot.markerType]) groupedDots[dot.markerType] = [];
        groupedDots[dot.markerType].push(dot);
    });

    const sortedMarkerTypeCodes = Object.keys(groupedDots).sort((a, b) => 
        a.localeCompare(b, undefined, { numeric: true })
    );

    sortedMarkerTypeCodes.forEach(markerTypeCode => {
        const dots = groupedDots[markerTypeCode];
        
        // Sort dots within each group
        dots.sort((a, b) => {
            if (appState.isAllPagesView && a.page !== b.page) {
                return a.page - b.page;
            }
            if (appState.sortMode === 'location') {
                return a.locationNumber.localeCompare(b.locationNumber);
            } else {
                return a.message.localeCompare(b.message);
            }
        });
        
        const typeData = appState.markerTypes[markerTypeCode];
        const isExpanded = appState.expandedMarkerTypes.has(markerTypeCode);
        const category = document.createElement('div');
        category.className = 'marker-type-category';
        category.style.borderLeftColor = typeData.color;
        const displayName = typeData.code + ' - ' + typeData.name;
        
        category.innerHTML = '<div class="marker-type-category-header">' +
            '<div class="marker-type-category-title">' +
            '<span class="expand-icon ' + (isExpanded ? 'expanded' : '') + '">▶</span>' + displayName +
            '</div>' +
            '<span class="marker-type-category-count">' + dots.length + '</span>' +
            '</div>' +
            '<div class="marker-type-items ' + (isExpanded ? 'expanded' : '') + '" id="items-' + markerTypeCode.replace(/[^a-zA-Z0-9]/g, '-') + '"></div>';
        
        container.appendChild(category);
        category.querySelector('.marker-type-category-header').addEventListener('click', () => toggleMarkerTypeExpansion(markerTypeCode));

        const itemsContainer = category.querySelector('.marker-type-items');
        dots.forEach(dot => {
            const item = document.createElement('div');
            item.className = 'grouped-location-item';
            item.dataset.dotId = dot.internalId;
            if (dot.page) {
                item.dataset.dotPage = dot.page;
            }
            if (appState.selectedDots.has(dot.internalId)) {
                item.classList.add('selected');
            }

            const pagePrefix = appState.isAllPagesView ? '(P' + dot.page + ') ' : '';
            item.innerHTML = '<div class="grouped-location-header">' +
                '<span class="location-number">' + pagePrefix + dot.locationNumber + '</span>' +
                '<span class="location-message">' + dot.message + '</span>' +
                '</div>';
            itemsContainer.appendChild(item);

            item.addEventListener('click', async (e) => {
                const dotPage = e.currentTarget.dataset.dotPage ? parseInt(e.currentTarget.dataset.dotPage, 10) : appState.currentPdfPage;
                if (dotPage !== appState.currentPdfPage) {
                    await changePage(dotPage);
                }
                centerOnDot(dot.internalId);
                
                setTimeout(() => {
                    if (e.shiftKey) {
                        toggleDotSelection(dot.internalId);
                    } else {
                        if (appState.selectedDots.has(dot.internalId) && appState.selectedDots.size === 1) {
                            clearSelection();
                        } else {
                            clearSelection();
                            selectDot(dot.internalId);
                        }
                    }
                    updateSelectionUI();
                }, 100);
            });

        });
    });
}

function setupDesignReferenceHandlers(item, markerTypeCode) {
    const square = item.querySelector('.design-reference-square');
    const fileInput = item.querySelector('.design-reference-input');
    const deleteBtn = item.querySelector('.design-reference-delete');

    square.addEventListener('click', (e) => {
        if (e.target.classList.contains('design-reference-delete')) return;
        e.stopPropagation();
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleDesignReferenceUpload(file, markerTypeCode);
        }
        e.target.value = null;
    });
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete the design reference for ' + markerTypeCode + '?')) {
                handleDesignReferenceDelete(markerTypeCode);
            }
        });
    }
}

function updateEditModalOptions(selectElementId = 'edit-marker-type', isGroupEdit = false) {
    const select = document.getElementById(selectElementId);
    if (!select) return;
    
    const sortedMarkerTypeCodes = Object.keys(appState.markerTypes).sort((a, b) => 
        a.localeCompare(b, undefined, { numeric: true })
    );
    let optionsHtml = isGroupEdit ? '<option value="">-- Keep Individual Types --</option>' : '';
    optionsHtml += sortedMarkerTypeCodes.map(code => {
        const typeData = appState.markerTypes[code];
        return '<option value="' + code + '">' + typeData.code + ' - ' + typeData.name + '</option>';
    }).join('');
    select.innerHTML = optionsHtml;
}

// Canvas event setup functions
function setupCanvasEventListeners() {
    const mapContent = document.getElementById('map-content');
    const mapContainer = document.getElementById('map-container');
    if (!mapContent || !mapContainer) return;

    // Click events should be on the map content, not just the canvas
    mapContent.addEventListener('click', handleMapClick);
    mapContainer.addEventListener('wheel', handleZoom);
    mapContainer.addEventListener('mousedown', handleMouseDown);
    
    // Add document-level mouse listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Handle right-click to open edit modal
    mapContent.addEventListener('contextmenu', handleContextMenu);
    mapContainer.addEventListener('contextmenu', handleContextMenu);
    
    // Set initial cursor state
    mapContainer.style.cursor = 'grab';
    
    // Handle mouse leave to cancel panning
    mapContainer.addEventListener('mouseleave', () => { 
        if (appState.isPanning) {
            appState.isPanning = false; 
            mapContainer.style.cursor = 'grab';
        }
    });
    
    console.log('✅ Canvas event listeners attached');
}

function handleMapClick(e) {
    if (appState.hasMoved || appState.isPanning || appState.isSelecting || appState.isScraping || !appState.pdfDoc) return;
    if (appState.justFinishedSelecting) { appState.justFinishedSelecting = false; return; }
    
    // Check if click is on a dot element
    const dotElement = e.target.closest('.map-dot');
    if (dotElement) {
        const internalId = dotElement.dataset.dotId;
        if (e.shiftKey) { 
            toggleDotSelection(internalId); 
        } else { 
            if (appState.selectedDots.has(internalId) && appState.selectedDots.size === 1) {
                clearSelection();
            } else {
                clearSelection(); 
                selectDot(internalId); 
            }
        }
        updateSelectionUI();
        return;
    }
    
    if (e.target.closest('.tolerance-controls')) {
        return;
    }
    
    if (!e.shiftKey) {
        clearSearchHighlights();
        if (appState.selectedDots.size > 0) { 
            clearSelection(); 
            updateSelectionUI(); 
        } else {
            // Get the map container rect for coordinate calculation
            const mapContainer = document.getElementById('map-container');
            const rect = mapContainer.getBoundingClientRect();
            const mapTransform = appState.mapTransform;
            
            // Calculate coordinates relative to the map content
            const x = (e.clientX - rect.left - mapTransform.x) / mapTransform.scale;
            const y = (e.clientY - rect.top - mapTransform.y) / mapTransform.scale;
            
            if (!isCollision(x, y)) {
                addDot(x, y);
                UndoManager.capture('Add dot');
            }
        }
    }
}

function handleZoom(e) {
    e.preventDefault();
    const oldScale = appState.mapTransform.scale;
    const direction = e.deltaY < 0 ? 1 : -1;
    let newScale = oldScale * (1 + 0.1 * direction);
    newScale = Math.max(0.1, Math.min(newScale, 10));
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; 
    const mouseY = e.clientY - rect.top;
    appState.mapTransform.x = mouseX - (mouseX - appState.mapTransform.x) * (newScale / oldScale);
    appState.mapTransform.y = mouseY - (mouseY - appState.mapTransform.y) * (newScale / oldScale);
    appState.mapTransform.scale = newScale;
    applyMapTransform();
}

function handleMouseDown(e) {
    appState.hasMoved = false;
    appState.dragStart = { x: e.clientX, y: e.clientY };

    if (e.button === 1) { // Middle mouse button
        e.preventDefault();
        appState.isPanning = true;
        e.currentTarget.style.cursor = 'grabbing';
        
        // Set up document-wide listeners for drag
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    } else if (e.button === 2 && e.shiftKey) { // Right mouse button with Shift key - scraping
        e.preventDefault();
        appState.isScraping = true;
        
        // Check if Ctrl/Cmd is also pressed for OCR scraping
        if (e.ctrlKey || e.metaKey) {
            appState.isOCRScraping = true;
        }
        
        const mapContainer = document.getElementById('map-container');
        const rect = mapContainer.getBoundingClientRect();
        
        // Create scrape box
        appState.scrapeBox = document.createElement('div');
        appState.scrapeBox.className = appState.isOCRScraping ? 'scrape-box ocr-scrape' : 'scrape-box';
        appState.scrapeBox.style.position = 'absolute';
        appState.scrapeBox.style.left = (e.clientX - rect.left) + 'px';
        appState.scrapeBox.style.top = (e.clientY - rect.top) + 'px';
        appState.scrapeBox.style.width = '0px';
        appState.scrapeBox.style.height = '0px';
        
        mapContainer.appendChild(appState.scrapeBox);
        
        appState.scrapeStart = { 
            x: e.clientX - rect.left, 
            y: e.clientY - rect.top,
            clientX: e.clientX,
            clientY: e.clientY
        };
        
        // Scraping movement handled in handleMouseMove
        document.addEventListener('contextmenu', preventContextMenu, { capture: true });
    } else if (e.button === 0) { // Left mouse button
        const dotElement = e.target.closest('.map-dot');
        
        if (dotElement) {
            // Set as drag target - drag will start if mouse moves
            appState.dragTarget = dotElement;
        } else if (e.shiftKey) {
            // Shift+drag for selection box
            e.preventDefault();
            const mapContainer = document.getElementById('map-container');
            const rect = mapContainer.getBoundingClientRect();
            
            appState.isSelecting = true;
            appState.selectionStart = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                clientX: e.clientX,
                clientY: e.clientY
            };
            
            // Create selection box
            appState.selectionBox = document.createElement('div');
            appState.selectionBox.className = 'selection-box';
            appState.selectionBox.style.position = 'absolute';
            appState.selectionBox.style.left = appState.selectionStart.x + 'px';
            appState.selectionBox.style.top = appState.selectionStart.y + 'px';
            appState.selectionBox.style.width = '0px';
            appState.selectionBox.style.height = '0px';
            appState.selectionBox.style.border = '2px solid #00ff88';
            appState.selectionBox.style.backgroundColor = 'rgba(0, 255, 136, 0.1)';
            appState.selectionBox.style.pointerEvents = 'none';
            appState.selectionBox.style.zIndex = '999';
            
            mapContainer.appendChild(appState.selectionBox);
            
            // Selection box movement handled in handleMouseMove
        }
    }
}

function handleMouseMove(e) {
    // Check if we've moved enough to consider it movement
    if (!appState.hasMoved && (Math.abs(e.clientX - appState.dragStart.x) > 3 || Math.abs(e.clientY - appState.dragStart.y) > 3)) {
        appState.hasMoved = true;
    }

    // Track mouse position for paste
    const mapContainer = document.getElementById('map-container');
    const rect = mapContainer.getBoundingClientRect();
    const { x: mapX, y: mapY, scale } = appState.mapTransform;
    appState.lastMousePosition = {
        x: (e.clientX - rect.left - mapX) / scale,
        y: (e.clientY - rect.top - mapY) / scale
    };

    if (appState.isPanning) {
        appState.mapTransform.x += e.clientX - appState.dragStart.x;
        appState.mapTransform.y += e.clientY - appState.dragStart.y;
        applyMapTransform();
        appState.dragStart = { x: e.clientX, y: e.clientY };
        return;
    }

    if (!e.buttons) return;

    // Handle dot dragging
    if (appState.dragTarget && appState.hasMoved) {
        setDirtyState();
        const moveDeltaX = (e.clientX - appState.dragStart.x) / appState.mapTransform.scale;
        const moveDeltaY = (e.clientY - appState.dragStart.y) / appState.mapTransform.scale;
        const draggedInternalId = appState.dragTarget.dataset.dotId;
        const dotsToMove = appState.selectedDots.has(draggedInternalId) && appState.selectedDots.size > 1 
            ? appState.selectedDots 
            : [draggedInternalId];

        dotsToMove.forEach(internalId => {
            const dot = getCurrentPageDots().get(internalId);
            const dotElement = document.querySelector(`.map-dot[data-dot-id="${internalId}"]`);
            if (dot && dotElement) {
                dot.x += moveDeltaX;
                dot.y += moveDeltaY;
                
                // Calculate size to match createDotElement
                const effectiveMultiplier = appState.dotSize * 2;
                const size = 20 * effectiveMultiplier;
                const halfSize = size / 2;
                
                // Position the dot centered on the point (same as createDotElement)
                Object.assign(dotElement.style, { 
                    left: `${dot.x - halfSize}px`, 
                    top: `${dot.y - halfSize}px`,
                    transform: 'none' // Override CSS transform
                });
                dotElement.classList.add('dragging');
            }
        });
        appState.dragStart = { x: e.clientX, y: e.clientY };
    } else if (appState.isSelecting) {
        // Handle selection box update
        if (appState.selectionBox) {
            const mapContainer = document.getElementById('map-container');
            const rect = mapContainer.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;
            
            const left = Math.min(currentX, appState.selectionStart.x);
            const top = Math.min(currentY, appState.selectionStart.y);
            const width = Math.abs(currentX - appState.selectionStart.x);
            const height = Math.abs(currentY - appState.selectionStart.y);
            
            appState.selectionBox.style.left = left + 'px';
            appState.selectionBox.style.top = top + 'px';
            appState.selectionBox.style.width = width + 'px';
            appState.selectionBox.style.height = height + 'px';
        }
    } else if (appState.isScraping) {
        // Handle scrape box update
        if (appState.scrapeBox) {
            const mapContainer = document.getElementById('map-container');
            const rect = mapContainer.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;
            
            const left = Math.min(currentX, appState.scrapeStart.x);
            const top = Math.min(currentY, appState.scrapeStart.y);
            const width = Math.abs(currentX - appState.scrapeStart.x);
            const height = Math.abs(currentY - appState.scrapeStart.y);
            
            appState.scrapeBox.style.left = left + 'px';
            appState.scrapeBox.style.top = top + 'px';
            appState.scrapeBox.style.width = width + 'px';
            appState.scrapeBox.style.height = height + 'px';
        }
    }
}

function handleMouseUp(e) {
    const justFinishedScraping = appState.isScraping;
    
    if (appState.isPanning) {
        appState.isPanning = false;
        const mapContainer = document.getElementById('map-container');
        if (mapContainer) {
            mapContainer.style.cursor = 'grab';
        }
    }
    
    if (appState.dragTarget) {
        // Clean up dragging state
        document.querySelectorAll('.map-dot.dragging').forEach(dot => dot.classList.remove('dragging'));
        
        // Capture undo state if dot was actually moved
        if (appState.hasMoved) {
            UndoManager.capture('Move dot');
        }
        
        appState.dragTarget = null;
    }
    
    if (appState.isSelecting) {
        finishSelectionBox();
        appState.isSelecting = false;
    }
    
    if (appState.isScraping) {
        if (appState.isOCRScraping) {
            // Import and call finishOCRScrape from scrape.js
            import('./scrape.js').then(module => {
                module.finishOCRScrape();
            });
            appState.isOCRScraping = false;
        } else {
            // Import and call finishScrape from scrape.js
            import('./scrape.js').then(module => {
                module.finishScrape();
            });
        }
        
        appState.justFinishedScraping = true;
        setTimeout(() => {
            appState.justFinishedScraping = false;
        }, 100);
    }
}

function finishSelectionBox() {
    if (!appState.selectionBox) return;
    
    // Check if selection box is too small (likely just a click)
    const width = parseFloat(appState.selectionBox.style.width);
    const height = parseFloat(appState.selectionBox.style.height);
    
    if (width > 5 || height > 5) {
        // This was a real selection, not just a click
        // Get selection box bounds
        const boxRect = appState.selectionBox.getBoundingClientRect();
        const mapRect = document.getElementById('map-container').getBoundingClientRect();
        const { x: mapX, y: mapY, scale } = appState.mapTransform;
        
        // Convert to canvas coordinates
        const canvasLeft = (boxRect.left - mapRect.left - mapX) / scale;
        const canvasTop = (boxRect.top - mapRect.top - mapY) / scale;
        const canvasRight = (boxRect.right - mapRect.left - mapX) / scale;
        const canvasBottom = (boxRect.bottom - mapRect.top - mapY) / scale;
        
        // Clear previous selection if not holding shift
        const e = window.event || {};
        if (!e.shiftKey) {
            clearSelection();
        }
        
        // Select dots within the box
        const dots = getCurrentPageDots();
        dots.forEach((dot, internalId) => {
            if (dot.x >= canvasLeft && dot.x <= canvasRight &&
                dot.y >= canvasTop && dot.y <= canvasBottom) {
                selectDot(internalId);
            }
        });
        
        // Update UI
        updateSelectionUI();
        
        appState.justFinishedSelecting = true;
        
        // Reset flag after a short delay
        setTimeout(() => {
            appState.justFinishedSelecting = false;
        }, 100);
    }
    
    // Remove selection box
    appState.selectionBox.remove();
    appState.selectionBox = null;
}


function preventContextMenu(e) {
    if (appState.isScraping || appState.isTrainingScrape) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
}

function handleContextMenu(e) {
    e.preventDefault();
    
    if (appState.justFinishedScraping) {
        return;
    }
    
    const dotElement = e.target.closest('.map-dot');
    if (dotElement) {
        const internalId = dotElement.dataset.dotId;
        if (appState.selectedDots.has(internalId) && appState.selectedDots.size > 1) {
            openGroupEditModal();
        } else {
            clearSelection();
            selectDot(internalId);
            updateSelectionUI();
            openEditModal(internalId);
        }
    }
}


function clearSearchHighlights() {
    document.querySelectorAll('.search-highlight').forEach(el => el.classList.remove('search-highlight'));
}

function clearSelection() {
    appState.selectedDots.forEach(internalId => { deselectDot(internalId); });
    appState.selectedDots.clear();
    document.querySelectorAll('.location-item.selected, .grouped-location-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    updateSelectionUI();
}

function selectDot(internalId) {
    appState.selectedDots.add(internalId);
    const dotElement = document.querySelector('.map-dot[data-dot-id="' + internalId + '"]');
    if (dotElement) {
        dotElement.classList.add('selected');
        Object.assign(dotElement.style, {
            boxShadow: '0 0 15px #00ff88, 0 0 30px #00ff88',
            border: '2px solid #00ff88',
            zIndex: '200'
        });
    }
}

function deselectDot(internalId) {
    appState.selectedDots.delete(internalId);
    const dotElement = document.querySelector('.map-dot[data-dot-id="' + internalId + '"]');
    if (dotElement) {
        dotElement.classList.remove('selected');
        Object.assign(dotElement.style, { boxShadow: '', border: '', zIndex: '' });
    }
}

function toggleDotSelection(internalId) {
    if (appState.selectedDots.has(internalId)) { 
        deselectDot(internalId); 
    } else { 
        selectDot(internalId); 
    }
}

function updateSelectionUI() {
    updateListHighlighting();
}

function updateListHighlighting() {
    document.querySelectorAll('.location-item, .grouped-location-item').forEach(item => {
        const internalId = item.dataset.dotId;
        item.classList.toggle('selected', appState.selectedDots.has(internalId));
    });
}

function addDot(x, y, markerTypeCode, message, isCodeRequired = false) {
    const pageData = getCurrentPageData();
    const effectiveMarkerTypeCode = markerTypeCode || appState.activeMarkerType || Object.keys(appState.markerTypes)[0];
    
    if (!effectiveMarkerTypeCode) { 
        console.log("Cannot add dot: No sign types exist");
        return; 
    }
    
    // Get the sign type to inherit properties
    const markerTypeData = appState.markerTypes[effectiveMarkerTypeCode];
    
    const internalId = String(appState.nextInternalId).padStart(7, '0');
    
    let highestLocationNum = 0;
    for (const dot of pageData.dots.values()) {
        const num = parseInt(dot.locationNumber, 10);
        if (!isNaN(num) && num > highestLocationNum) {
            highestLocationNum = num;
        }
    }
    const locationNumber = String(highestLocationNum + 1).padStart(4, '0');
    
    const dot = { 
        internalId: internalId,
        locationNumber: locationNumber,
        x: x, 
        y: y, 
        markerType: effectiveMarkerTypeCode, 
        message: message || 'NEW LOCATION',
        message2: '', 
        isCodeRequired: isCodeRequired || (markerTypeData?.codeRequired || false),
        notes: '',
        installed: false,
        vinylBacker: markerTypeData?.defaultVinylBacker || false
    };

    pageData.dots.set(internalId, dot);
    pageData.nextLocationNumber = highestLocationNum + 2;
    appState.nextInternalId++;

    console.log('✅ Dot created:', dot);
    
    renderDotsForCurrentPage();
    updateAllSectionsForCurrentPage();
    setDirtyState();
}

function addDotToData(x, y, markerTypeCode, message, message2, isCodeRequired) {
    const dot = addDot(x, y, markerTypeCode, message, isCodeRequired);
    // Don't capture here - capture should happen after the dot is fully rendered
    return dot;
}

function isCollision(newX, newY) {
    const dots = getCurrentPageDots();
    const minDistance = (20 * appState.dotSize) + 1;
    for (const dot of dots.values()) {
        const distance = Math.sqrt(Math.pow(dot.x - newX, 2) + Math.pow(dot.y - newY, 2));
        if (distance < minDistance) return true;
    }
    return false;
}

function handleMarkerTypeCodeChange(input) {
    const newCode = input.value.trim();
    const originalCode = input.dataset.originalCode;
    
    if (!newCode || newCode === originalCode) {
        input.value = originalCode;
        return;
    }
    
    if (appState.markerTypes[newCode] && newCode !== originalCode) {
        alert('A marker type with this code already exists.');
        input.value = originalCode;
        return;
    }
    
    const typeData = appState.markerTypes[originalCode];
    delete appState.markerTypes[originalCode];
    typeData.code = newCode;
    appState.markerTypes[newCode] = typeData;
    
    for (const pageData of appState.dotsByPage.values()) {
        for (const dot of pageData.dots.values()) {
            if (dot.markerType === originalCode) {
                dot.markerType = newCode;
            }
        }
    }
    
    if (appState.activeMarkerType === originalCode) {
        appState.activeMarkerType = newCode;
    }
    
    input.dataset.originalCode = newCode;
    setDirtyState();
    updateAllSectionsForCurrentPage();
    renderDotsForCurrentPage();
}

function handleMarkerTypeNameChange(input) {
    const newName = input.value.trim();
    const originalName = input.dataset.originalName;
    const code = input.dataset.code;
    
    if (!newName) {
        input.value = originalName;
        return;
    }
    
    appState.markerTypes[code].name = newName;
    input.dataset.originalName = newName;
    setDirtyState();
    updateAllSectionsForCurrentPage();
}

function deleteMarkerType(markerTypeCode) {
    let dotsCount = 0;
    for (const pageData of appState.dotsByPage.values()) {
        for (const dot of pageData.dots.values()) {
            if (dot.markerType === markerTypeCode) {
                dotsCount++;
            }
        }
    }
    
    const typeData = appState.markerTypes[markerTypeCode];
    const confirmMessage = dotsCount > 0 
        ? 'Delete marker type "' + typeData.code + ' - ' + typeData.name + '" and ' + dotsCount + ' associated dots?'
        : 'Delete marker type "' + typeData.code + ' - ' + typeData.name + '"?';
    
    if (!confirm(confirmMessage)) return;
    
    for (const pageData of appState.dotsByPage.values()) {
        const dotsToRemove = [];
        for (const [id, dot] of pageData.dots.entries()) {
            if (dot.markerType === markerTypeCode) {
                dotsToRemove.push(id);
            }
        }
        dotsToRemove.forEach(id => pageData.dots.delete(id));
    }
    
    delete appState.markerTypes[markerTypeCode];
    
    if (appState.activeMarkerType === markerTypeCode) {
        const remainingTypes = Object.keys(appState.markerTypes);
        appState.activeMarkerType = remainingTypes.length > 0 ? remainingTypes[0] : null;
    }
    
    setDirtyState();
    updateAllSectionsForCurrentPage();
    renderDotsForCurrentPage();
}

function handleDesignReferenceUpload(file, markerTypeCode) {
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file (JPEG, PNG).');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        alert('Image file is too large. Please use an image smaller than 5MB.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        appState.markerTypes[markerTypeCode].designReference = e.target.result;
        setDirtyState();
        updateFilterCheckboxes();
    };
    reader.onerror = () => {
        alert('Failed to read the image file.');
    };
    reader.readAsDataURL(file);
}

function handleDesignReferenceDelete(markerTypeCode) {
    appState.markerTypes[markerTypeCode].designReference = null;
    setDirtyState();
    updateFilterCheckboxes();
}

function toggleMarkerTypeExpansion(markerTypeCode) {
    if (appState.expandedMarkerTypes.has(markerTypeCode)) {
        appState.expandedMarkerTypes.delete(markerTypeCode);
    } else {
        appState.expandedMarkerTypes.add(markerTypeCode);
    }
    updateLocationList();
}

async function changePage(pageNum) {
    if (pageNum < 1 || pageNum > appState.totalPages || pageNum === appState.currentPdfPage) return;
    
    const previousPage = appState.currentPdfPage;
    appState.currentPdfPage = pageNum;
    await renderPDFPage(pageNum);
    await renderDotsForCurrentPage();
    updateAllSectionsForCurrentPage();
    updatePageInfo();
    updatePageLabelInput();
    
    // Capture undo state for page navigation
    if (pageNum < previousPage) {
        UndoManager.capture('Previous page');
    } else {
        UndoManager.capture('Next page');
    }
}

function isDotVisible(internalId) {
    const dotElement = document.querySelector('.map-dot[data-dot-id="' + internalId + '"]');
    if (!dotElement) return false;
    
    const mapRect = document.getElementById('map-container').getBoundingClientRect();
    const dotRect = dotElement.getBoundingClientRect();
    
    return !(dotRect.right < mapRect.left || 
             dotRect.left > mapRect.right || 
             dotRect.bottom < mapRect.top || 
             dotRect.top > mapRect.bottom);
}

function addMarkerTypeEventListener() {
    const addBtn = document.querySelector('#add-marker-type-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            // Find next available code number
            let codeNum = 1;
            let newCode = `I.${codeNum}`;
            
            // Keep incrementing until we find an unused code
            while (appState.markerTypes[newCode]) {
                codeNum++;
                newCode = `I.${codeNum}`;
            }
            
            // Create new marker type with default values
            appState.markerTypes[newCode] = {
                code: newCode,
                name: 'Sign Type Name',
                color: '#F72020',
                textColor: '#FFFFFF',
                designReference: null
            };
            
            // Set as active if no active type
            if (!appState.activeMarkerType) {
                appState.activeMarkerType = newCode;
            }
            
            setDirtyState();
            updateFilterCheckboxes();
            updateEditModalOptions();
            
            // Focus the code input of the newly created marker type
            setTimeout(() => {
                const newCodeInput = document.querySelector(`input.marker-type-code-input[value="${newCode}"]`);
                if (newCodeInput) {
                    newCodeInput.focus();
                    newCodeInput.select();
                }
            }, 100);
        });
    }
}

function addPageNavigationEventListeners() {
    const prevBtn = document.querySelector('#prev-page');
    const nextBtn = document.querySelector('#next-page');
    const pageInput = document.querySelector('#page-label-input');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (appState.currentPdfPage > 1) {
                changePage(appState.currentPdfPage - 1);
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (appState.currentPdfPage < appState.totalPages) {
                changePage(appState.currentPdfPage + 1);
            }
        });
    }
    
    if (pageInput) {
        pageInput.addEventListener('change', (e) => {
            const label = e.target.value.trim();
            if (label) {
                appState.pageLabels.set(appState.currentPdfPage, label);
            } else {
                appState.pageLabels.delete(appState.currentPdfPage);
            }
            setDirtyState();
            updateAllSectionsForCurrentPage();
        });
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        if (e.key === 'PageUp' && appState.currentPdfPage > 1) {
            e.preventDefault();
            changePage(appState.currentPdfPage - 1);
        } else if (e.key === 'PageDown' && appState.currentPdfPage < appState.totalPages) {
            e.preventDefault();
            changePage(appState.currentPdfPage + 1);
        }
    });
}

function addViewToggleEventListeners() {
    const toggleViewBtn = document.querySelector('#toggle-view-btn');
    const sortToggleBtn = document.querySelector('#sort-toggle-btn');
    const allPagesCheckbox = document.querySelector('#all-pages-checkbox');
    
    if (toggleViewBtn) {
        toggleViewBtn.addEventListener('click', () => {
            appState.listViewMode = appState.listViewMode === 'flat' ? 'grouped' : 'flat';
            updateLocationList();
        });
    }
    
    if (sortToggleBtn) {
        sortToggleBtn.addEventListener('click', () => {
            appState.sortMode = appState.sortMode === 'location' ? 'name' : 'location';
            sortToggleBtn.textContent = appState.sortMode === 'location' ? 'BY LOC' : 'BY NAME';
            updateLocationList();
        });
    }
    
    if (allPagesCheckbox) {
        allPagesCheckbox.addEventListener('change', (e) => {
            appState.isAllPagesView = e.target.checked;
            updateLocationList();
        });
    }
}

function setupModalEventListeners() {
    // Edit Modal Event Listeners
    const editModal = document.getElementById('mapping-slayer-edit-modal');
    const updateDotBtn = document.getElementById('update-dot-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    const deleteDotBtn = document.getElementById('delete-dot-btn');
    
    if (updateDotBtn) {
        updateDotBtn.addEventListener('click', updateDot);
    }
    
    if (cancelModalBtn) {
        cancelModalBtn.addEventListener('click', closeEditModal);
    }
    
    if (deleteDotBtn) {
        deleteDotBtn.addEventListener('click', deleteDot);
    }
    
    // Group Edit Modal Event Listeners
    const groupEditModal = document.getElementById('mapping-slayer-group-edit-modal');
    const groupUpdateBtn = document.getElementById('group-update-btn');
    const groupCancelBtn = document.getElementById('group-cancel-btn');
    const groupDeleteBtn = document.getElementById('group-delete-btn');
    
    if (groupUpdateBtn) {
        groupUpdateBtn.addEventListener('click', groupUpdateDots);
    }
    
    if (groupCancelBtn) {
        groupCancelBtn.addEventListener('click', closeGroupEditModal);
    }
    
    if (groupDeleteBtn) {
        groupDeleteBtn.addEventListener('click', groupDeleteDots);
    }
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeEditModal();
        }
        if (e.target === groupEditModal) {
            closeGroupEditModal();
        }
    });
    
    // Close modals with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (isModalOpen()) {
                closeEditModal();
                closeGroupEditModal();
                closeRenumberModal();
            }
        }
    });
    
    // Add comprehensive keyboard shortcuts
    setupKeyboardShortcuts();
    
    // Renumber Modal Event Listeners
    const renumberModal = document.getElementById('mapping-slayer-renumber-modal');
    const cancelRenumberBtn = document.getElementById('cancel-renumber-btn');
    const renumberModalClose = renumberModal?.querySelector('.close');
    
    if (cancelRenumberBtn) {
        cancelRenumberBtn.addEventListener('click', closeRenumberModal);
    }
    
    if (renumberModalClose) {
        renumberModalClose.addEventListener('click', closeRenumberModal);
    }
    
    // Close renumber modal when clicking outside
    if (renumberModal) {
        window.addEventListener('click', (e) => {
            if (e.target === renumberModal) {
                closeRenumberModal();
            }
        });
    }
    
    // Automap Modal Event Listeners
    const automapModal = document.getElementById('automap-progress-modal');
    const cancelAutomapBtn = document.getElementById('cancel-automap-btn');
    const closeAutomapBtn = document.getElementById('close-automap-btn');
    
    if (cancelAutomapBtn) {
        cancelAutomapBtn.addEventListener('click', async () => {
            const { isAutomapCancelled } = await import('./automap.js');
            window.isAutomapCancelled = true; // Set the cancellation flag
            cancelAutomapBtn.disabled = true;
            cancelAutomapBtn.textContent = 'Cancelling...';
        });
    }
    
    if (closeAutomapBtn) {
        closeAutomapBtn.addEventListener('click', () => {
            if (automapModal) {
                automapModal.style.display = 'none';
            }
        });
    }
    
    // PDF Export Modal Event Listeners
    const pdfExportModal = document.getElementById('mapping-slayer-pdf-export-modal');
    const cancelPdfExportBtn = document.getElementById('cancel-pdf-export-btn');
    const pdfExportModalClose = pdfExportModal?.querySelector('.close');
    
    if (cancelPdfExportBtn) {
        cancelPdfExportBtn.addEventListener('click', () => {
            if (pdfExportModal) {
                pdfExportModal.style.display = 'none';
            }
        });
    }
    
    if (pdfExportModalClose) {
        pdfExportModalClose.addEventListener('click', () => {
            if (pdfExportModal) {
                pdfExportModal.style.display = 'none';
            }
        });
    }
    
    // Character Warning Modal Event Listeners
    const characterWarningModal = document.getElementById('character-warning-modal');
    const proceedCharacterChangesBtn = document.getElementById('proceed-character-changes-btn');
    const cancelCharacterChangesBtn = document.getElementById('cancel-character-changes-btn');
    
    if (proceedCharacterChangesBtn) {
        proceedCharacterChangesBtn.addEventListener('click', () => {
            if (window.characterWarningResolver) {
                window.characterWarningResolver(true);
                window.characterWarningResolver = null;
            }
            if (characterWarningModal) {
                characterWarningModal.style.display = 'none';
            }
        });
    }
    
    if (cancelCharacterChangesBtn) {
        cancelCharacterChangesBtn.addEventListener('click', () => {
            if (window.characterWarningResolver) {
                window.characterWarningResolver(false);
                window.characterWarningResolver = null;
            }
            if (characterWarningModal) {
                characterWarningModal.style.display = 'none';
            }
        });
    }
}

function addButtonEventListeners() {
    const toggleMessagesBtn = document.querySelector('#toggle-messages-btn');
    const toggleMessages2Btn = document.querySelector('#toggle-messages2-btn');
    const toggleLocationsBtn = document.querySelector('#toggle-locations-btn');
    const renumberBtn = document.querySelector('#renumber-btn');
    const findInput = document.querySelector('#find-input');
    const replaceInput = document.querySelector('#replace-input');
    const findAllBtn = document.querySelector('#find-all-btn');
    const replaceBtn = document.querySelector('#replace-btn');
    const copyBtn = document.querySelector('#copy-btn');
    const pasteBtn = document.querySelector('#paste-btn');
    const deleteBtn = document.querySelector('#delete-btn');
    const editSelectedBtn = document.querySelector('#edit-selected-btn');
    
    if (renumberBtn) {
        renumberBtn.addEventListener('click', () => {
            openRenumberModal();
        });
    }
    
    if (copyBtn) {
        copyBtn.addEventListener('click', copySelectedDots);
    }
    
    if (pasteBtn) {
        pasteBtn.addEventListener('click', pasteDots);
    }
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', deleteSelectedDots);
    }
    
    if (editSelectedBtn) {
        editSelectedBtn.addEventListener('click', () => {
            if (appState.selectedDots.size === 1) {
                const [internalId] = appState.selectedDots;
                openEditModal(internalId);
            } else if (appState.selectedDots.size > 1) {
                openGroupEditModal();
            }
        });
    }
    
    if (findInput) {
        findInput.addEventListener('input', handleFind);
        findInput.addEventListener('keydown', handleFindEnter);
    }
    
    if (replaceInput) {
        replaceInput.addEventListener('input', updateReplaceStatus);
        replaceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && replaceBtn && !replaceBtn.disabled) {
                e.preventDefault();
                performReplace();
            }
        });
    }
    
    if (findAllBtn) {
        findAllBtn.addEventListener('click', performFindAll);
    }
    
    if (replaceBtn) {
        replaceBtn.addEventListener('click', performReplace);
    }
    
    if (toggleMessagesBtn) {
        toggleMessagesBtn.addEventListener('click', () => {
            appState.messagesVisible = !appState.messagesVisible;
            toggleMessagesBtn.textContent = appState.messagesVisible ? 'HIDE MSG' : 'SHOW MSG';
            
            document.querySelectorAll('.map-dot-message').forEach(msg => {
                msg.classList.toggle('visible', appState.messagesVisible);
            });
        });
    }
    
    if (toggleMessages2Btn) {
        toggleMessages2Btn.addEventListener('click', () => {
            appState.messages2Visible = !appState.messages2Visible;
            toggleMessages2Btn.textContent = appState.messages2Visible ? 'HIDE MSG2' : 'SHOW MSG2';
            
            document.querySelectorAll('.map-dot-message2').forEach(msg => {
                msg.classList.toggle('visible', appState.messages2Visible);
            });
        });
    }
    
    if (toggleLocationsBtn) {
        toggleLocationsBtn.addEventListener('click', () => {
            appState.locationsVisible = !appState.locationsVisible;
            toggleLocationsBtn.textContent = appState.locationsVisible ? 'HIDE LOC' : 'SHOW LOC';
            
            document.querySelectorAll('.dot-number').forEach(num => {
                num.style.display = appState.locationsVisible ? '' : 'none';
            });
        });
    }
    
    const createPdfBtn = document.querySelector('#create-pdf-btn');
    const createScheduleBtn = document.querySelector('#create-schedule-btn');
    const exportFdfBtn = document.querySelector('#export-fdf-btn');
    
    if (createPdfBtn) {
        createPdfBtn.addEventListener('click', async () => {
            const { createAnnotatedPDF } = await import('./export.js');
            createAnnotatedPDF();
        });
    }
    
    if (createScheduleBtn) {
        createScheduleBtn.addEventListener('click', async () => {
            const { createMessageSchedule } = await import('./export.js');
            createMessageSchedule();
        });
    }
    
    if (exportFdfBtn) {
        exportFdfBtn.addEventListener('click', async () => {
            const { exportToBluebeam } = await import('./export.js');
            exportToBluebeam();
        });
    }
    
    const updateFromScheduleBtn = document.querySelector('#update-from-schedule-btn');
    const updateCsvInput = document.querySelector('#update-csv-input');
    
    if (updateFromScheduleBtn && updateCsvInput) {
        updateFromScheduleBtn.addEventListener('click', () => {
            updateCsvInput.click();
        });
        
        updateCsvInput.addEventListener('change', handleScheduleUpdate);
    }
    
    const automapBtn = document.querySelector('#single-automap-btn');
    if (automapBtn) {
        automapBtn.addEventListener('click', async () => {
            const { automapSingleLocation } = await import('./automap.js');
            automapSingleLocation();
        });
    }
    
    const automapTextInput = document.querySelector('#automap-text-input');
    if (automapTextInput) {
        automapTextInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter' && automapBtn && !automapBtn.disabled) {
                e.preventDefault();
                const { automapSingleLocation } = await import('./automap.js');
                automapSingleLocation();
            }
        });
    }
}

function openEditModal(internalId) {
    const dot = getCurrentPageDots().get(internalId); 
    if (!dot) return;
    appState.editingDot = internalId;
    updateEditModalOptions(); 
    document.getElementById('edit-marker-type').value = dot.markerType;
    document.getElementById('edit-location-number').value = dot.locationNumber;
    document.getElementById('edit-message').value = dot.message;
    document.getElementById('edit-message2').value = dot.message2 || '';
    document.getElementById('edit-code-required').checked = dot.isCodeRequired || false;
    document.getElementById('edit-installed').checked = dot.installed || false;
    document.getElementById('edit-vinyl-backer').checked = dot.vinylBacker || false;
    document.getElementById('edit-notes').value = dot.notes || '';
    
    const modal = document.getElementById('mapping-slayer-edit-modal');
    modal.style.display = 'block';
    
    // Log computed styles
    const computed = window.getComputedStyle(modal);
    console.log('=== MODAL SNIFFER ===');
    console.log('Modal element:', modal);
    console.log('Parent element:', modal.parentElement);
    console.log('Position:', computed.position);
    console.log('Width:', computed.width);
    console.log('Height:', computed.height);
    console.log('Top:', computed.top);
    console.log('Left:', computed.left);
    console.log('Background:', computed.background);
    console.log('Z-index:', computed.zIndex);
    console.log('Display:', computed.display);
    console.log('Box sizing:', computed.boxSizing);
    console.log('Overflow:', computed.overflow);
    
    // Check if modal is inside app-container
    let parent = modal.parentElement;
    while (parent) {
        if (parent.id === 'app-container' || parent.className.includes('app-container')) {
            console.log('WARNING: Modal is inside app-container!', parent);
            break;
        }
        parent = parent.parentElement;
    }
    
    // Check what stylesheets are affecting this element
    console.log('\n=== STYLE SOURCES ===');
    const sheets = document.styleSheets;
    for (let i = 0; i < sheets.length; i++) {
        try {
            const rules = sheets[i].cssRules || sheets[i].rules;
            for (let j = 0; j < rules.length; j++) {
                const rule = rules[j];
                if (rule.selectorText && modal.matches(rule.selectorText)) {
                    console.log('Matching rule:', rule.selectorText, 'from', sheets[i].href || 'inline');
                    console.log('Styles:', rule.style.cssText);
                }
            }
        } catch (e) {
            // Cross-origin stylesheets can't be read
        }
    }
    
    console.log('=== END SNIFFER ===');
}

function openGroupEditModal() {
    const selectedCount = appState.selectedDots.size;
    if (selectedCount < 2) return;

    document.getElementById('mapping-slayer-group-edit-count').textContent = selectedCount;
    updateEditModalOptions('group-edit-marker-type', true);
    document.getElementById('group-edit-message').value = '';
    document.getElementById('group-edit-message2').value = '';
    
    const selectedDots = Array.from(appState.selectedDots).map(id => getCurrentPageDots().get(id));

    const codeRequiredCheckbox = document.getElementById('group-edit-code-required');
    const allCodeRequired = selectedDots.every(dot => dot.isCodeRequired);
    const noneCodeRequired = selectedDots.every(dot => !dot.isCodeRequired);

    if (allCodeRequired) {
        codeRequiredCheckbox.checked = true;
        codeRequiredCheckbox.indeterminate = false;
    } else if (noneCodeRequired) {
        codeRequiredCheckbox.checked = false;
        codeRequiredCheckbox.indeterminate = false;
    } else {
        codeRequiredCheckbox.checked = false;
        codeRequiredCheckbox.indeterminate = true;
    }

    const installedCheckbox = document.getElementById('group-edit-installed');
    const allInstalled = selectedDots.every(dot => dot.installed);
    const noneInstalled = selectedDots.every(dot => !dot.installed);

    if (allInstalled) {
        installedCheckbox.checked = true;
        installedCheckbox.indeterminate = false;
    } else if (noneInstalled) {
        installedCheckbox.checked = false;
        installedCheckbox.indeterminate = false;
    } else {
        installedCheckbox.checked = false;
        installedCheckbox.indeterminate = true;
    }

    const vinylBackerCheckbox = document.getElementById('group-edit-vinyl-backer');
    const allVinylBacker = selectedDots.every(dot => dot.vinylBacker);
    const noneVinylBacker = selectedDots.every(dot => !dot.vinylBacker);

    if (allVinylBacker) {
        vinylBackerCheckbox.checked = true;
        vinylBackerCheckbox.indeterminate = false;
    } else if (noneVinylBacker) {
        vinylBackerCheckbox.checked = false;
        vinylBackerCheckbox.indeterminate = false;
    } else {
        vinylBackerCheckbox.checked = false;
        vinylBackerCheckbox.indeterminate = true;
    }

    document.getElementById('mapping-slayer-group-edit-modal').style.display = 'block';
}

function closeEditModal() {
    const modal = document.getElementById('mapping-slayer-edit-modal');
    if (modal) {
        modal.style.display = 'none';
        appState.editingDot = null;
    }
}

function closeGroupEditModal() {
    const modal = document.getElementById('mapping-slayer-group-edit-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function isModalOpen() {
    const modals = ['mapping-slayer-edit-modal', 'mapping-slayer-group-edit-modal', 'mapping-slayer-renumber-modal'];
    return modals.some(id => {
        const modal = document.getElementById(id);
        return modal && modal.style.display === 'block';
    });
}

function updateDot() {
    if (!appState.editingDot) return;
    
    const dot = getCurrentPageDots().get(appState.editingDot);
    if (!dot) return;
    
    dot.locationNumber = document.getElementById('edit-location-number').value;
    dot.message = document.getElementById('edit-message').value;
    dot.message2 = document.getElementById('edit-message2').value || '';
    dot.markerType = document.getElementById('edit-marker-type').value;
    dot.isCodeRequired = document.getElementById('edit-code-required').checked;
    dot.installed = document.getElementById('edit-installed').checked;
    dot.vinylBacker = document.getElementById('edit-vinyl-backer').checked;
    dot.notes = document.getElementById('edit-notes').value || '';
    
    setDirtyState();
    // Use single dot update for better performance
    const updated = updateSingleDot(appState.editingDot);
    if (!updated) {
        // Fallback to full re-render if single update fails
        renderDotsForCurrentPage();
    }
    updateAllSectionsForCurrentPage();
    closeEditModal();
    UndoManager.capture('Edit dot');
}

function deleteDot() {
    if (!appState.editingDot || !confirm('Delete this location?')) return;
    
    getCurrentPageData().dots.delete(appState.editingDot);
    setDirtyState();
    renderDotsForCurrentPage();
    updateAllSectionsForCurrentPage();
    closeEditModal();
    UndoManager.capture('Delete dot');
}

function groupUpdateDots() {
    const selectedDots = Array.from(appState.selectedDots);
    const message = document.getElementById('group-edit-message').value;
    const message2 = document.getElementById('group-edit-message2').value;
    const markerType = document.getElementById('group-edit-marker-type').value;
    const notes = document.getElementById('group-edit-notes').value;
    const codeRequiredCheckbox = document.getElementById('group-edit-code-required');
    const installedCheckbox = document.getElementById('group-edit-installed');
    const vinylBackerCheckbox = document.getElementById('group-edit-vinyl-backer');
    
    selectedDots.forEach(internalId => {
        const dot = getCurrentPageDots().get(internalId);
        if (!dot) return;
        
        if (message) dot.message = message;
        if (message2) dot.message2 = message2;
        if (markerType) dot.markerType = markerType;
        if (notes) dot.notes = notes;
        
        if (!codeRequiredCheckbox.indeterminate) {
            dot.isCodeRequired = codeRequiredCheckbox.checked;
        }
        if (!installedCheckbox.indeterminate) {
            dot.installed = installedCheckbox.checked;
        }
        if (!vinylBackerCheckbox.indeterminate) {
            dot.vinylBacker = vinylBackerCheckbox.checked;
        }
    });
    
    setDirtyState();
    renderDotsForCurrentPage();
    updateAllSectionsForCurrentPage();
    clearSelection();
    updateSelectionUI();
    closeGroupEditModal();
    UndoManager.capture('Edit multiple dots');
}

function groupDeleteDots() {
    const count = appState.selectedDots.size;
    if (!confirm('Delete ' + count + ' selected locations?')) return;
    
    appState.selectedDots.forEach(internalId => {
        getCurrentPageData().dots.delete(internalId);
    });
    
    setDirtyState();
    renderDotsForCurrentPage();
    updateAllSectionsForCurrentPage();
    clearSelection();
    updateSelectionUI();
    closeGroupEditModal();
    UndoManager.capture(`Delete ${count} dots`);
}

function openRenumberModal() {
    const modal = document.getElementById('mapping-slayer-renumber-modal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeRenumberModal() {
    const modal = document.getElementById('mapping-slayer-renumber-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function performRenumber(type) {
    let count = 0;
    let description = '';
    
    switch(type) {
        case 'page':
            count = renumberCurrentPage();
            description = 'Renumber current page';
            break;
        case 'page-by-type':
            count = renumberCurrentPageByMarkerType();
            description = 'Renumber current page by marker type';
            break;
        case 'all':
            count = renumberAllPages();
            description = 'Renumber all pages';
            break;
        case 'all-by-type':
            count = renumberAllPagesByMarkerType();
            description = 'Renumber all pages by marker type';
            break;
    }
    
    closeRenumberModal();
    
    renderDotsForCurrentPage();
    updateAllSectionsForCurrentPage();
    setDirtyState();
    
    // Capture undo state if any dots were renumbered
    if (count > 0) {
        UndoManager.capture(description);
    }
    
    showCSVStatus('Successfully renumbered ' + count + ' locations', true);
}

function renumberCurrentPage() {
    const pageData = getCurrentPageData();
    const dots = Array.from(pageData.dots.values());
    
    dots.sort((a, b) => {
        const yDiff = a.y - b.y;
        if (Math.abs(yDiff) < 30) { return a.x - b.x; }
        return yDiff;
    });
    
    dots.forEach((dot, index) => {
        dot.locationNumber = String(index + 1).padStart(4, '0');
    });
    
    pageData.nextLocationNumber = dots.length + 1;
    return dots.length;
}

function renumberCurrentPageByMarkerType() {
    const pageData = getCurrentPageData();
    const dots = Array.from(pageData.dots.values());
    const dotsByType = {};
    
    dots.forEach(dot => {
        if (!dotsByType[dot.markerType]) {
            dotsByType[dot.markerType] = [];
        }
        dotsByType[dot.markerType].push(dot);
    });
    
    const sortedMarkerTypes = Object.keys(dotsByType).sort((a, b) => 
        a.localeCompare(b, undefined, { numeric: true })
    );
    
    let highestNumber = 0;
    sortedMarkerTypes.forEach(markerType => {
        const typeDots = dotsByType[markerType];
        typeDots.sort((a, b) => {
            const yDiff = a.y - b.y;
            if (Math.abs(yDiff) < 30) { return a.x - b.x; }
            return yDiff;
        });
        
        typeDots.forEach((dot, index) => {
            dot.locationNumber = String(index + 1).padStart(4, '0');
            highestNumber = Math.max(highestNumber, index + 1);
        });
    });
    
    pageData.nextLocationNumber = highestNumber + 1;
    return dots.length;
}

function renumberAllPages() {
    let globalCounter = 1;
    let totalDots = 0;
    
    for (let pageNum = 1; pageNum <= appState.totalPages; pageNum++) {
        const pageData = getDotsForPage(pageNum);
        const dots = Array.from(pageData.values());
        
        dots.sort((a, b) => {
            const yDiff = a.y - b.y;
            if (Math.abs(yDiff) < 30) { return a.x - b.x; }
            return yDiff;
        });
        
        dots.forEach(dot => {
            dot.locationNumber = String(globalCounter).padStart(4, '0');
            globalCounter++;
        });
        
        totalDots += dots.length;
    }
    
    return totalDots;
}

function renumberAllPagesByMarkerType() {
    const allDotsByType = {};
    let totalDots = 0;
    
    // Collect all dots from all pages
    for (let pageNum = 1; pageNum <= appState.totalPages; pageNum++) {
        const pageData = getDotsForPage(pageNum);
        pageData.forEach(dot => {
            if (!allDotsByType[dot.markerType]) {
                allDotsByType[dot.markerType] = [];
            }
            allDotsByType[dot.markerType].push({ dot, pageNum });
            totalDots++;
        });
    }
    
    const sortedMarkerTypes = Object.keys(allDotsByType).sort((a, b) => 
        a.localeCompare(b, undefined, { numeric: true })
    );
    
    sortedMarkerTypes.forEach(markerType => {
        const dotInfos = allDotsByType[markerType];
        
        // Sort by page number first, then by position
        dotInfos.sort((a, b) => {
            if (a.pageNum !== b.pageNum) {
                return a.pageNum - b.pageNum;
            }
            const yDiff = a.dot.y - b.dot.y;
            if (Math.abs(yDiff) < 30) { return a.dot.x - b.dot.x; }
            return yDiff;
        });
        
        dotInfos.forEach((info, index) => {
            info.dot.locationNumber = String(index + 1).padStart(4, '0');
        });
    });
    
    return totalDots;
}

// Find and Replace Functions
function handleFind(e) {
    const query = e.target.value.toLowerCase().trim();
    const findCountEl = document.getElementById('find-count');
    const findInput = e.target;
    
    clearSearchHighlights();
    
    if (!query) { 
        findCountEl.textContent = ''; 
        findCountEl.style.display = 'none';
        findInput.classList.remove('has-results', 'no-results');
        appState.searchResults = []; 
        appState.currentSearchIndex = -1; 
        updateReplaceStatus(); 
        return; 
    }
    
    appState.searchResults = Array.from(getCurrentPageDots().values()).filter(dot => 
        dot.locationNumber.toLowerCase().includes(query) || 
        dot.message.toLowerCase().includes(query) ||
        (dot.message2 && dot.message2.toLowerCase().includes(query))
    );
    
    if (appState.searchResults.length > 0) { 
        appState.currentSearchIndex = 0; 
        findInput.classList.add('has-results');
        findInput.classList.remove('no-results');
        updateFindUI(); 
    } else { 
        appState.currentSearchIndex = -1; 
        findCountEl.textContent = '0 found';
        findCountEl.style.display = 'inline';
        findInput.classList.add('no-results');
        findInput.classList.remove('has-results');
    }
    updateReplaceStatus();
}

function handleFindEnter(e) {
    if (e.key === 'Enter' && appState.searchResults.length > 0) {
        e.preventDefault();
        appState.currentSearchIndex = (appState.currentSearchIndex + 1) % appState.searchResults.length;
        updateFindUI();
    }
}

function updateFindUI() {
    clearSearchHighlights();
    const findCountEl = document.getElementById('find-count');
    
    if (appState.searchResults.length > 0) {
        const dot = appState.searchResults[appState.currentSearchIndex];
        
        // Always center on the dot to bring it into viewport
        centerOnDot(dot.internalId);
        
        // Give viewport update time to render the dot, then highlight it
        setTimeout(() => {
            const dotElement = document.querySelector(`.map-dot[data-dot-id="${dot.internalId}"]`);
            if (dotElement) { 
                dotElement.classList.add('search-highlight'); 
            }
            
            // Also highlight in the list
            const listItem = document.querySelector(`.location-item[data-dot-id="${dot.internalId}"], .grouped-location-item[data-dot-id="${dot.internalId}"]`);
            if (listItem) {
                listItem.classList.add('search-highlight');
                listItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
        
        findCountEl.textContent = `${appState.currentSearchIndex + 1} of ${appState.searchResults.length} found`;
        findCountEl.style.display = 'inline';
    } else { 
        findCountEl.textContent = '0 found';
        findCountEl.style.display = 'inline';
    }
}

function performFindAll() {
    const findText = document.getElementById('find-input').value.toLowerCase();
    if (!findText) return;
    
    clearSelection();
    
    const dots = getCurrentPageDots();
    const matches = [];
    
    dots.forEach((dot, id) => {
        if (dot.message.toLowerCase().includes(findText) ||
            (dot.message2 && dot.message2.toLowerCase().includes(findText))) {
            matches.push(id);
            selectDot(id);
        }
    });
    
    updateSelectionUI();
    updateReplaceStatus();
    
    if (matches.length > 0) {
        showCSVStatus('Selected ' + matches.length + ' locations with matching text', true);
        // TODO: Implement zoomToFitSelectedDots when zoom functionality is complete
    } else {
        showCSVStatus('No locations found with matching text', false);
    }
}

function performReplace() {
    const findText = document.getElementById('find-input').value;
    const replaceText = document.getElementById('replace-input').value;
    
    if (!findText || appState.selectedDots.size === 0) return;
    
    let replacedCount = 0;
    const regex = new RegExp(escapeRegExp(findText), 'gi');
    
    appState.selectedDots.forEach(id => {
        const dot = getCurrentPageDots().get(id);
        if (!dot) return;
        
        const originalMessage = dot.message;
        const originalMessage2 = dot.message2 || '';
        
        if (regex.test(originalMessage)) {
            dot.message = originalMessage.replace(regex, replaceText);
            replacedCount++;
        }
        
        if (regex.test(originalMessage2)) {
            dot.message2 = originalMessage2.replace(regex, replaceText);
            if (originalMessage === dot.message) {
                replacedCount++;
            }
        }
    });
    
    if (replacedCount > 0) {
        setDirtyState();
        renderDotsForCurrentPage();
        updateAllSectionsForCurrentPage();
        document.getElementById('replace-input').value = '';
        showCSVStatus('Replaced text in ' + replacedCount + ' locations', true);
        UndoManager.capture(`Replace "${findText}" with "${replaceText}"`);
    }
    
    updateReplaceStatus();
}

function updateReplaceStatus() {
    const findInput = document.getElementById('find-input');
    const replaceBtn = document.getElementById('replace-btn');
    const findAllBtn = document.getElementById('find-all-btn');
    const statusDiv = document.getElementById('replace-status');
    
    const searchText = findInput.value.toLowerCase();
    
    if (!searchText) {
        statusDiv.innerHTML = '';
        if (findAllBtn) findAllBtn.disabled = true;
        if (replaceBtn) replaceBtn.disabled = true;
        return;
    }
    
    if (findAllBtn) findAllBtn.disabled = false;
    
    const dots = getCurrentPageDots();
    let totalMatches = 0;
    let selectedMatches = 0;
    
    dots.forEach((dot, id) => {
        if (dot.message.toLowerCase().includes(searchText) ||
            (dot.message2 && dot.message2.toLowerCase().includes(searchText))) {
            totalMatches++;
            if (appState.selectedDots.has(id)) {
                selectedMatches++;
            }
        }
    });
    
    if (appState.selectedDots.size === 0) {
        statusDiv.innerHTML = totalMatches + ' matches on this page';
        if (replaceBtn) replaceBtn.disabled = true;
    } else {
        statusDiv.innerHTML = appState.selectedDots.size + ' selected, ' + selectedMatches + ' with matches';
        if (replaceBtn) replaceBtn.disabled = selectedMatches === 0;
    }
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function zoomToFitDots(dotIds) {
    if (dotIds.length === 0) return;
    
    const dots = dotIds.map(id => getCurrentPageDots().get(id)).filter(dot => dot);
    if (dots.length === 0) return;
    
    // Calculate bounds of all dots
    let minX = dots[0].x, maxX = dots[0].x;
    let minY = dots[0].y, maxY = dots[0].y;
    
    dots.forEach(dot => {
        minX = Math.min(minX, dot.x);
        maxX = Math.max(maxX, dot.x);
        minY = Math.min(minY, dot.y);
        maxY = Math.max(maxY, dot.y);
    });
    
    // Add padding
    const padding = 100;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;
    
    // Calculate required scale and position
    const containerRect = document.getElementById('map-container').getBoundingClientRect();
    const scaleX = containerRect.width / (maxX - minX);
    const scaleY = containerRect.height / (maxY - minY);
    const scale = Math.min(scaleX, scaleY, 2); // Cap at 2x zoom
    
    // Center the bounds
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    appState.mapTransform.scale = scale;
    appState.mapTransform.x = (containerRect.width / 2) - (centerX * scale);
    appState.mapTransform.y = (containerRect.height / 2) - (centerY * scale);
    
    applyMapTransform();
}

function updateRecentSearches(searchTerm) {
    appState.recentSearches = appState.recentSearches.filter(s => s !== searchTerm);
    appState.recentSearches.unshift(searchTerm);
    if (appState.recentSearches.length > 10) {
        appState.recentSearches.pop();
    }
    updateAutomapControls();
    setDirtyState();
}

function updateAutomapControls() {
    const datalist = document.getElementById('recent-searches-datalist');
    if (datalist) {
        datalist.innerHTML = appState.recentSearches
            .map(search => '<option value="' + search + '"></option>')
            .join('');
    }
}

// Clipboard state
let clipboard = [];

function copySelectedDots() {
    if (appState.selectedDots.size !== 1) {
        showCSVStatus('Please select exactly one dot to copy', false);
        return;
    }
    
    clipboard = [];
    const dots = getCurrentPageDots();
    const [internalId] = appState.selectedDots;
    const dot = dots.get(internalId);
    
    if (dot) {
        clipboard = [{
            message: dot.message,
            message2: dot.message2 || '',
            markerType: dot.markerType,
            notes: dot.notes || '',
            installedVinylBacker: dot.installedVinylBacker || false,
            codeRequired: dot.codeRequired || false
        }];
        showCSVStatus('Copied 1 dot');
    }
}

function pasteDots() {
    if (clipboard.length === 0) {
        showCSVStatus('Nothing to paste', false);
        return;
    }
    
    const clipDot = clipboard[0];
    
    // Use last mouse position from appState
    const pasteX = appState.lastMousePosition.x;
    const pasteY = appState.lastMousePosition.y;
    
    if (!isCollision(pasteX, pasteY)) {
        clearSelection();
        
        // Create new dot with copied properties (but not location number)
        const newDot = addDotToData(pasteX, pasteY, clipDot.markerType, clipDot.message);
        
        // Update additional properties
        const dots = getCurrentPageDots();
        const createdDot = dots.get(newDot.internalId);
        if (createdDot) {
            createdDot.message2 = clipDot.message2;
            createdDot.notes = clipDot.notes;
            createdDot.installedVinylBacker = clipDot.installedVinylBacker;
            createdDot.codeRequired = clipDot.codeRequired;
        }
        
        selectDot(newDot.internalId);
        renderDotsForCurrentPage();
        updateAllSectionsForCurrentPage();
        updateSelectionUI();
        setDirtyState();
        
        showCSVStatus('Pasted 1 dot');
        UndoManager.capture('Paste dot');
    } else {
        showCSVStatus('Cannot paste - collision at cursor location', false);
    }
}

function pasteDotAtPosition(x, y) {
    if (clipboard.length === 0) {
        showCSVStatus('Nothing to paste', false);
        return;
    }
    
    const clipDot = clipboard[0];
    
    if (!isCollision(x, y)) {
        clearSelection();
        
        // Create new dot with copied properties (but not location number)
        const newDot = addDotToData(x, y, clipDot.markerType, clipDot.message);
        
        // Update additional properties
        const dots = getCurrentPageDots();
        const createdDot = dots.get(newDot.internalId);
        if (createdDot) {
            createdDot.message2 = clipDot.message2;
            createdDot.notes = clipDot.notes;
            createdDot.installedVinylBacker = clipDot.installedVinylBacker;
            createdDot.codeRequired = clipDot.codeRequired;
        }
        
        selectDot(newDot.internalId);
        renderDotsForCurrentPage();
        updateAllSectionsForCurrentPage();
        updateSelectionUI();
        setDirtyState();
        
        showCSVStatus('Pasted 1 dot');
        UndoManager.capture('Paste dot at position');
    } else {
        showCSVStatus('Cannot paste - collision at location', false);
    }
}

function selectAllDotsOnPage() {
    const dots = getCurrentPageDots();
    clearSelection();
    
    dots.forEach((dot, internalId) => {
        selectDot(internalId);
    });
    
    if (dots.size > 0) {
        showCSVStatus(`Selected ${dots.size} dots`);
    }
}

function deleteSelectedDots() {
    if (appState.selectedDots.size === 0) return;
    
    const count = appState.selectedDots.size;
    const dotsMap = getCurrentPageDots();
    
    appState.selectedDots.forEach(internalId => {
        dotsMap.delete(internalId);
        const dotElement = document.querySelector(`.map-dot[data-dot-id="${internalId}"]`);
        if (dotElement) {
            dotElement.remove();
        }
    });
    
    clearSelection();
    updateAllSectionsForCurrentPage();
    setDirtyState();
    
    showCSVStatus(`Deleted ${count} dot(s)`);
    UndoManager.capture(`Delete ${count} dot(s)`);
}

function moveSelectedDots(deltaX, deltaY) {
    if (appState.selectedDots.size === 0) return;
    
    const dots = getCurrentPageDots();
    const movedDots = [];
    
    // Check if all dots can be moved without collision
    let canMove = true;
    appState.selectedDots.forEach(internalId => {
        const dot = dots.get(internalId);
        if (dot) {
            const newX = dot.x + deltaX;
            const newY = dot.y + deltaY;
            
            // Check collision excluding selected dots
            const hasCollision = Array.from(dots.values()).some(otherDot => {
                if (appState.selectedDots.has(otherDot.internalId)) return false;
                const distance = Math.sqrt(Math.pow(newX - otherDot.x, 2) + Math.pow(newY - otherDot.y, 2));
                return distance < 10;
            });
            
            if (hasCollision) {
                canMove = false;
            }
        }
    });
    
    if (!canMove) {
        showCSVStatus('Cannot move - collision detected', false);
        return;
    }
    
    // Move all dots
    appState.selectedDots.forEach(internalId => {
        const dot = dots.get(internalId);
        if (dot) {
            dot.x += deltaX;
            dot.y += deltaY;
            
            // Update visual position
            const dotElement = document.querySelector(`.map-dot[data-dot-id="${internalId}"]`);
            if (dotElement) {
                const size = appState.dotSize * 12;
                const halfSize = size / 2;
                dotElement.style.left = `${dot.x - halfSize}px`;
                dotElement.style.top = `${dot.y - halfSize}px`;
            }
        }
    });
    
    setDirtyState();
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ignore if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        // Undo (Ctrl+Z or Cmd+Z)
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            const action = UndoManager.undo();
            if (action) {
                showCSVStatus(`Undo: ${action}`, true, 2000);
            }
        }
        // Redo (Ctrl+Y or Cmd+Y or Ctrl+Shift+Z or Cmd+Shift+Z)
        else if (((e.ctrlKey || e.metaKey) && e.key === 'y') || 
                 ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
            e.preventDefault();
            const action = UndoManager.redo();
            if (action) {
                showCSVStatus(`Redo: ${action}`, true, 2000);
            }
        }
        // Copy (Ctrl+C)
        else if (e.ctrlKey && e.key === 'c') {
            e.preventDefault();
            copySelectedDots();
        }
        // Paste (Ctrl+V)
        else if (e.ctrlKey && e.key === 'v') {
            e.preventDefault();
            pasteDots();
        }
        // Cut (Ctrl+X)
        else if (e.ctrlKey && e.key === 'x') {
            e.preventDefault();
            copySelectedDots();
            deleteSelectedDots();
        }
        // Delete
        else if (e.key === 'Delete') {
            e.preventDefault();
            deleteSelectedDots();
        }
        // Select All (Ctrl+A)
        else if (e.ctrlKey && e.key === 'a') {
            e.preventDefault();
            clearSelection();
            getCurrentPageDots().forEach((dot, internalId) => {
                selectDot(internalId);
            });
            updateSelectionUI();
        }
        // Escape to clear selection
        else if (e.key === 'Escape' && !isModalOpen()) {
            clearSelection();
        }
    });
}

// CSV Update functionality
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"' && inQuotes && nextChar === '"') {
            current += '"';
            i++; // Skip next quote
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

function generateErrorLog(skippedRows) {
    const timestamp = new Date().toLocaleString();
    let logContent = `MAPPING SLAYER - CSV UPDATE ERROR LOG\n`;
    logContent += `Generated on: ${timestamp}\n\n`;
    logContent += `Total Skipped Rows: ${skippedRows.length}\n\n`;
    
    skippedRows.forEach((row, index) => {
        logContent += `Row ${row.rowNumber}:\n`;
        logContent += `Reason: ${row.reason}\n`;
        logContent += `Data: ${JSON.stringify(row.data)}\n\n`;
    });
    
    const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `CSV_Update_Errors_${new Date().toISOString().slice(0,19).replace(/:/g, '')}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

async function handleScheduleUpdate(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const csvContent = event.target.result;
        const lines = csvContent.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
            showCSVStatus('❌ CSV file appears to be empty', false, 5000);
            return;
        }
        
        // Parse headers (case-insensitive)
        const headerLine = lines[0];
        const headers = parseCSVLine(headerLine).map(h => h.toUpperCase());
        
        // Check for required columns
        const requiredColumns = ['MARKER TYPE CODE', 'MARKER TYPE NAME', 'MESSAGE', 'LOCATION NUMBER', 'MAP PAGE'];
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));
        
        if (missingColumns.length > 0) {
            showCSVStatus(`❌ Missing required columns: ${missingColumns.join(', ')}`, false, 8000);
            return;
        }
        
        // Get column indices
        const columnIndices = {
            markerTypeCode: headers.indexOf('MARKER TYPE CODE'),
            markerTypeName: headers.indexOf('MARKER TYPE NAME'),
            message: headers.indexOf('MESSAGE'),
            message2: headers.indexOf('MESSAGE 2'),
            locationNumber: headers.indexOf('LOCATION NUMBER'),
            mapPage: headers.indexOf('MAP PAGE'),
            codeRequired: headers.indexOf('CODE REQUIRED'),
            vinylBacker: headers.indexOf('VINYL BACKER'),
            installed: headers.indexOf('INSTALLED'),
            notes: headers.indexOf('NOTES')
        };
        
        let updatedCount = 0;
        const skippedRows = [];
        
        // Process each data row
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = parseCSVLine(line);
            const rowNumber = i + 1;
            
            // Extract values
            const pageNum = parseInt(values[columnIndices.mapPage]);
            // Remove quotes and apostrophes from location number
            let locationNumber = values[columnIndices.locationNumber];
            if (locationNumber) {
                // Remove surrounding quotes first
                locationNumber = locationNumber.replace(/^["']|["']$/g, '');
                // Then remove any remaining apostrophes
                locationNumber = locationNumber.replace(/'/g, '');
            }
            const markerTypeCode = values[columnIndices.markerTypeCode];
            
            // Validate page number
            if (isNaN(pageNum) || pageNum < 1 || pageNum > appState.totalPages) {
                skippedRows.push({
                    rowNumber,
                    reason: `Invalid page number: ${values[columnIndices.mapPage]}`,
                    data: values
                });
                continue;
            }
            
            // Check if marker type exists
            if (!appState.markerTypes[markerTypeCode]) {
                skippedRows.push({
                    rowNumber,
                    reason: `Marker type not found: ${markerTypeCode}`,
                    data: values
                });
                continue;
            }
            
            // Find the dot
            const dotsOnPage = getDotsForPage(pageNum);
            let dotFound = false;
            
            for (const [internalId, dot] of dotsOnPage) {
                if (dot.locationNumber === locationNumber) {
                    // Update dot properties
                    dot.message = values[columnIndices.message] || '';
                    
                    if (columnIndices.message2 !== -1) {
                        dot.message2 = values[columnIndices.message2] || '';
                    }
                    
                    if (columnIndices.codeRequired !== -1) {
                        const codeRequiredValue = values[columnIndices.codeRequired]?.toUpperCase();
                        dot.isCodeRequired = codeRequiredValue === 'YES' || codeRequiredValue === 'TRUE';
                    }
                    
                    if (columnIndices.vinylBacker !== -1) {
                        const vinylBackerValue = values[columnIndices.vinylBacker]?.toUpperCase();
                        dot.vinylBacker = vinylBackerValue === 'YES' || vinylBackerValue === 'TRUE';
                    }
                    
                    if (columnIndices.installed !== -1) {
                        const installedValue = values[columnIndices.installed]?.toUpperCase();
                        dot.installed = installedValue === 'YES' || installedValue === 'TRUE';
                    }
                    
                    if (columnIndices.notes !== -1) {
                        dot.notes = values[columnIndices.notes] || '';
                    }
                    
                    updatedCount++;
                    dotFound = true;
                    break;
                }
            }
            
            if (!dotFound) {
                skippedRows.push({
                    rowNumber,
                    reason: `Location not found: ${locationNumber} on page ${pageNum}`,
                    data: values
                });
            }
        }
        
        // Show results
        if (updatedCount > 0) {
            setDirtyState();
            renderDotsForCurrentPage();
            updateAllSectionsForCurrentPage();
            UndoManager.capture('Import CSV update');
            
            if (skippedRows.length > 0) {
                showCSVStatus(`✅ Updated ${updatedCount} locations. ${skippedRows.length} rows skipped (see error log)`, true, 8000);
                generateErrorLog(skippedRows);
            } else {
                showCSVStatus(`✅ Successfully updated ${updatedCount} locations`, true, 5000);
            }
        } else {
            showCSVStatus('❌ No locations were updated', false, 5000);
            if (skippedRows.length > 0) {
                generateErrorLog(skippedRows);
            }
        }
    };
    
    reader.readAsText(file);
    e.target.value = ''; // Clear the input so the same file can be selected again
}

// Make functions available globally for onclick handlers
window.performRenumber = performRenumber;
window.performPDFExport = async (exportType) => {
    const { performPDFExport } = await import('./export.js');
    performPDFExport(exportType);
};

export {
    showCSVStatus,
    updatePageLabelInput,
    updatePageInfo,
    updateAllSectionsForCurrentPage,
    updateFilterCheckboxes,
    updateMapLegend,
    updateProjectLegend,
    getActiveFilters,
    applyFilters,
    updateLocationList,
    renderFlatLocationList,
    renderGroupedLocationList,
    updateEditModalOptions,
    setupCanvasEventListeners,
    clearSearchHighlights,
    clearSelection,
    selectDot,
    addDot,
    addDotToData,
    isCollision,
    handleMarkerTypeCodeChange,
    handleMarkerTypeNameChange,
    deleteMarkerType,
    handleDesignReferenceUpload,
    handleDesignReferenceDelete,
    toggleMarkerTypeExpansion,
    changePage,
    isDotVisible,
    addMarkerTypeEventListener,
    addPageNavigationEventListeners,
    addViewToggleEventListeners,
    addButtonEventListeners,
    setupModalEventListeners,
    openEditModal,
    openGroupEditModal,
    openRenumberModal,
    performRenumber,
    updateRecentSearches
};
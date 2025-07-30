// ui.js

let previewTimeout = null;

function showCSVStatus(message, isSuccess = true, duration = 5000) {
    const statusDiv = document.getElementById('csv-status');
    const contentDiv = document.getElementById('csv-status-content');
    contentDiv.textContent = message;
    statusDiv.className = `csv-status visible ${isSuccess ? 'success' : 'error'}`;
    setTimeout(() => statusDiv.classList.remove('visible'), duration);
}

function updateUndoUI() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    
    if (undoBtn && redoBtn) {
        undoBtn.disabled = UndoManager.index <= 0;
        redoBtn.disabled = UndoManager.index >= UndoManager.history.length - 1;
        
        if (UndoManager.index > 0) {
            undoBtn.setAttribute('title', `Undo: ${UndoManager.history[UndoManager.index].description}`);
        } else {
            undoBtn.setAttribute('title', 'Nothing to undo');
        }
        
        if (UndoManager.index < UndoManager.history.length - 1) {
            redoBtn.setAttribute('title', `Redo: ${UndoManager.history[UndoManager.index + 1].description}`);
        } else {
            redoBtn.setAttribute('title', 'Nothing to redo');
        }
    }
}

function updatePageLabelInput() {
    const labelInput = document.getElementById('page-label-input');
    const currentLabel = appState.pageLabels.get(appState.currentPdfPage) || '';
    labelInput.value = currentLabel;
}

function updatePageInfo() {
    if (!appState.pdfDoc) return;
    document.getElementById('page-info').textContent = `PAGE ${appState.currentPdfPage} OF ${appState.totalPages}`;
    document.getElementById('prev-page').disabled = appState.currentPdfPage <= 1;
    document.getElementById('next-page').disabled = appState.currentPdfPage >= appState.totalPages;
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
    const scrollPosition = container.scrollTop; // Store current scroll position

    container.innerHTML = '';
    const sortedMarkerTypeCodes = Object.keys(appState.markerTypes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

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
        
        item.innerHTML = `
            <input type="checkbox" data-marker-type-code="${markerTypeCode}" checked>
            <span class="checkbox-label">(${count})</span>
            <div class="marker-type-inputs">
                <input type="text" class="marker-type-code-input" placeholder="Enter code..." value="${typeData.code}" data-original-code="${typeData.code}">
                <input type="text" class="marker-type-name-input" placeholder="Enter name..." value="${typeData.name}" data-original-name="${typeData.name}" data-code="${typeData.code}">
            </div>
            <div class="design-reference-container">
                <div class="design-reference-square" data-marker-type="${markerTypeCode}">
                    <div class="design-reference-empty" style="display: ${typeData.designReference ? 'none' : 'flex'};">
                        <span class="upload-plus-icon">+</span>
                    </div>
                    <div class="design-reference-filled" style="display: ${typeData.designReference ? 'flex' : 'none'};">
                        <img class="design-reference-thumbnail" src="${typeData.designReference || ''}" alt="Design Reference">
                        <button class="design-reference-delete" type="button">&times;</button>
                    </div>
                </div>
                <input type="file" class="design-reference-input" accept="image/jpeg,image/jpg,image/png" style="display: none;" data-marker-type="${markerTypeCode}">
            </div>
            <div class="marker-type-controls">
                <div class="color-picker-wrapper" data-marker-type-code="${markerTypeCode}" data-color-type="dot"></div>
                <div class="color-picker-wrapper" data-marker-type-code="${markerTypeCode}" data-color-type="text"></div>
                <button class="delete-marker-type-btn" data-marker-type-code="${markerTypeCode}">×</button>
            </div>
`;
        container.appendChild(item);
        
        setupDesignReferenceHandlers(item, markerTypeCode);
        
        const codeInput = item.querySelector('.marker-type-code-input');
        codeInput.classList.add('dynamic-input');
        codeInput.style.flex = '0 0 auto';
        codeInput.style.minWidth = '5px';

        const nameInput = item.querySelector('.marker-type-name-input');
        nameInput.style.flex = '1 1 30px';
        nameInput.style.minWidth = '30px';

        resizeInput(codeInput);
        codeInput.addEventListener('input', () => resizeInput(codeInput));
        codeInput.addEventListener('focus', () => resizeInput(codeInput));
        codeInput.addEventListener('blur', () => resizeInput(codeInput));
        
        item.addEventListener('click', (e) => {
            if (e.target.closest('input, .pcr-app, .color-picker-wrapper, .delete-marker-type-btn, .design-reference-square')) return;
            e.preventDefault();
            appState.activeMarkerType = markerTypeCode;
            updateFilterCheckboxes();
        });

        item.querySelector('input[type="checkbox"]').addEventListener('change', applyFilters);

        const codeInputEvents = item.querySelector('.marker-type-code-input');
        codeInputEvents.addEventListener('change', (e) => handleMarkerTypeCodeChange(e.target));
        codeInputEvents.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
        codeInputEvents.addEventListener('input', (e) => {
            e.target.style.color = e.target.value.trim() ? 'white' : '#ccc';
        });

        const nameInputEvents = item.querySelector('.marker-type-name-input');
        nameInputEvents.addEventListener('change', (e) => handleMarkerTypeNameChange(e.target));
        nameInputEvents.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
        nameInputEvents.addEventListener('input', (e) => {
            e.target.style.color = e.target.value.trim() ? 'white' : '#aaa';
        });

        item.querySelector('.delete-marker-type-btn').addEventListener('click', () => deleteMarkerType(markerTypeCode));
        initializeColorPickers(item, markerTypeCode, typeData);
    });

    container.scrollTop = scrollPosition; // Restore the scroll position
}

function resizeInput(input) {
    const temp = document.createElement('span');
    temp.style.visibility = 'hidden';
    temp.style.position = 'absolute';
    temp.style.font = window.getComputedStyle(input).font;
    temp.style.padding = window.getComputedStyle(input).padding;
    temp.textContent = input.value || input.placeholder || 'A';
    document.body.appendChild(temp);
    
    const width = Math.max(5, temp.offsetWidth);
    input.style.width = width + 'px';
    
    document.body.removeChild(temp);
}

function initializeColorPickers(item, markerTypeCode, typeData) {
    item.querySelectorAll('.color-picker-wrapper').forEach(wrapper => {
        const colorType = wrapper.dataset.colorType;
        const initialColor = (colorType === 'dot') ? typeData.color : typeData.textColor;
        wrapper.style.backgroundColor = initialColor;

        const pickr = Pickr.create({
            el: wrapper, theme: 'classic', useAsButton: true, default: initialColor,
            components: { preview: true, opacity: false, hue: true, interaction: { hex: true, rgba: false, input: true, save: true, clear: false } }
        });

        pickr.on('change', (color) => { wrapper.style.backgroundColor = color.toHEXA().toString(); });
        pickr.on('save', (color) => {
            const newColor = color.toHEXA().toString();
            // Check if marker type still exists before updating
            if (appState.markerTypes && appState.markerTypes[markerTypeCode]) {
                if (colorType === 'dot') { 
                    appState.markerTypes[markerTypeCode].color = newColor; 
                } else { 
                    appState.markerTypes[markerTypeCode].textColor = newColor; 
                }
                wrapper.style.backgroundColor = newColor;
                setDirtyState();
                updateAllSectionsForCurrentPage();
                renderDotsForCurrentPage();
            }
            pickr.hide();
        });
        pickr.on('hide', () => {
            // Check if marker type still exists before reading color
            if (appState.markerTypes && appState.markerTypes[markerTypeCode]) {
                const currentColor = (colorType === 'dot') ? appState.markerTypes[markerTypeCode].color : appState.markerTypes[markerTypeCode].textColor;
                wrapper.style.backgroundColor = currentColor;
            }
        });
    });
}

function updateMapLegend() {
    const legend = document.getElementById('map-legend');
    const content = document.getElementById('map-legend-content');
    const usedMarkerTypeCodes = new Set(Array.from(getCurrentPageDots().values()).map(d => d.markerType));
    
    legend.classList.toggle('collapsed', appState.pageLegendCollapsed);

    if (usedMarkerTypeCodes.size === 0) {
        legend.classList.remove('visible');
        return;
    }
    legend.classList.add('visible');
    content.innerHTML = '';
    const sortedMarkerTypeCodes = Array.from(usedMarkerTypeCodes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    sortedMarkerTypeCodes.forEach(code => {
        const typeData = appState.markerTypes[code];
        if (!typeData) return; // Skip if marker type doesn't exist
        const count = Array.from(getCurrentPageDots().values()).filter(d => d.markerType === code).length;
        const item = document.createElement('div');
        item.className = 'map-legend-item';
        item.innerHTML = `<div class="map-legend-dot" style="background-color: ${typeData.color};"></div><span class="map-legend-text">${typeData.code} - ${typeData.name}</span><span class="map-legend-count">${count}</span>`;
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

    const sortedMarkerTypeCodes = Array.from(projectCounts.keys()).sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));

    sortedMarkerTypeCodes.forEach(code => {
    const typeData = appState.markerTypes[code];
    if (!typeData) return; // Skip if marker type doesn't exist
    const count = projectCounts.get(code);
    const item = document.createElement('div');
    item.className = 'map-legend-item';
    item.innerHTML = `<div class="map-legend-dot" style="background-color: ${typeData.color};"></div><span class="map-legend-text">${typeData.code} - ${typeData.name}</span><span class="map-legend-count">${count}</span>`;
    content.appendChild(item);
});
}

function getActiveFilters() {
    const container = document.getElementById('filter-checkboxes');
    return container.hasChildNodes() ? Array.from(container.querySelectorAll('input:checked')).map(cb => cb.dataset.markerTypeCode) : [];
}

function applyFilters() {
    const activeFilters = getActiveFilters();
    document.querySelectorAll('.map-dot').forEach(dotElement => {
        const dot = getCurrentPageDots().get(dotElement.dataset.dotId);
        dotElement.style.display = dot && activeFilters.includes(dot.markerType) ? 'flex' : 'none';
    });
    updateLocationList(); updateMapLegend();
}

function updateLocationList() {
    const container = document.getElementById('location-list');
    container.innerHTML = '';
    const listWrapper = document.getElementById('list-with-renumber');
    const emptyState = document.getElementById('empty-state');
    const activeFilters = getActiveFilters();
    let allDots = [];

    if (appState.isAllPagesView) {
        // Collect dots from all pages
        for (let pageNum = 1; pageNum <= appState.totalPages; pageNum++) {
            const dotsOnPage = Array.from(getDotsForPage(pageNum).values());
            const visibleDots = dotsOnPage
                .filter(dot => activeFilters.includes(dot.markerType))
                .map(dot => ({ ...dot, page: pageNum })); // Add page number to each dot
            allDots.push(...visibleDots);
        }
    } else {
        // Collect dots from the current page only
        allDots = Array.from(getCurrentPageDots().values()).filter(dot => activeFilters.includes(dot.markerType));
    }

    if (allDots.length === 0) {
        listWrapper.style.display = 'none';
        emptyState.style.display = 'block';
        if (appState.isAllPagesView) {
            emptyState.textContent = 'No dots match the current filter across all pages.';
        } else {
            emptyState.textContent = getCurrentPageDots().size > 0 ? 'No dots match the current filter.' : 'Click on the map to add your first location dot.';
        }
        return;
    }

    emptyState.style.display = 'none';
    listWrapper.style.display = 'block';
    document.getElementById('toggle-view-btn').textContent = appState.listViewMode === 'flat' ? 'FULL LIST' : 'MARKER TYPE';
    
    if (appState.listViewMode === 'grouped') {
        renderGroupedLocationList(allDots, container);
    } else {
        renderFlatLocationList(allDots, container);
    }
}

function renderFlatLocationList(allDots, container) {
    allDots.sort((a, b) => {
        const aSelected = appState.selectedDots.has(a.internalId);
        const bSelected = appState.selectedDots.has(b.internalId);
        if (aSelected && !bSelected) return -1;
        if (!aSelected && bSelected) return 1;
        // Primary sort by page number if in all pages view
        if (appState.isAllPagesView && a.page !== b.page) {
            return a.page - b.page;
        }
        // Secondary sort by location number or message based on sort mode
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
        // Add page data to the item for the click handler
        if (dot.page) {
            item.dataset.dotPage = dot.page;
        }
        if (appState.selectedDots.has(dot.internalId)) {
            item.classList.add('selected');
        }

        const badgeClass = dot.isCodeRequired ? 'marker-type-badge code-required-badge' : 'marker-type-badge';
        const badgeText = `${typeData.code} - ${typeData.name}`;
        const pagePrefix = appState.isAllPagesView ? `(P${dot.page}) ` : '';

        item.innerHTML = `<div class="location-header"><span class="location-number">${pagePrefix}${dot.locationNumber}</span><input type="text" class="location-message-input" value="${dot.message}" data-dot-id="${dot.internalId}"><span class="${badgeClass}" style="background-color:${typeData.color}; color: ${typeData.textColor};" title="${badgeText}">${badgeText}</span></div>`;
        container.appendChild(item);

        item.addEventListener('click', async (e) => {
            const dotPage = e.currentTarget.dataset.dotPage ? parseInt(e.currentTarget.dataset.dotPage, 10) : appState.currentPdfPage;
            if (dotPage !== appState.currentPdfPage) {
                await changePage(dotPage);
            }

            // Always center on the dot to ensure it's visible and in viewport
            centerOnDot(dot.internalId);
            
            // Give the viewport update a moment to render the dot
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

        messageInput.addEventListener('focus', () => {
            originalMessage = dot.message;
        });

        messageInput.addEventListener('input', (e) => {
            // Find the correct dot to update, even across pages
            const dotToUpdate = getDotsForPage(dot.page || appState.currentPdfPage).get(dot.internalId);
            if (dotToUpdate) {
                dotToUpdate.message = e.target.value;
                setDirtyState();
                renderDotsForCurrentPage();
            }
        });

        messageInput.addEventListener('change', (e) => {
            if (dot.message !== originalMessage) {
                UndoManager.capture('Edit message');
            }
        });

        messageInput.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.target.blur();
            }
        });

        item.addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            const dotPage = e.currentTarget.dataset.dotPage ? parseInt(e.currentTarget.dataset.dotPage, 10) : appState.currentPdfPage;
            if (dotPage !== appState.currentPdfPage) {
                await changePage(dotPage);
            }
            if (!isDotVisible(dot.internalId)) centerOnDot(dot.internalId);
            if (appState.selectedDots.has(dot.internalId) && appState.selectedDots.size > 1) {
                openGroupEditModal();
            } else {
                clearSelection();
                selectDot(dot.internalId);
                updateSelectionUI();
                openEditModal(dot.internalId);
            }
        });
    });
}

function renderGroupedLocationList(allDots, container) {
    const groupedDots = {};
    allDots.forEach(dot => {
        if (!groupedDots[dot.markerType]) groupedDots[dot.markerType] = [];
        groupedDots[dot.markerType].push(dot);
    });

    const sortedMarkerTypeCodes = Object.keys(groupedDots).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    sortedMarkerTypeCodes.forEach(markerTypeCode => {
        const dots = groupedDots[markerTypeCode];
        const typeData = appState.markerTypes[markerTypeCode];
        const isExpanded = appState.expandedMarkerTypes.has(markerTypeCode);
        const category = document.createElement('div');
        category.className = 'marker-type-category';
        category.style.borderLeftColor = typeData.color;
        const displayName = `${typeData.code} - ${typeData.name}`;
        category.innerHTML = `
            <div class="marker-type-category-header">
                <div class="marker-type-category-title"><span class="expand-icon ${isExpanded ? 'expanded' : ''}">▶</span>${displayName}</div>
                <span class="marker-type-category-count">${dots.length}</span>
            </div>
            <div class="marker-type-items ${isExpanded ? 'expanded' : ''}" id="items-${markerTypeCode.replace(/[^a-zA-Z0-9]/g, '-')}"></div>
        `;
        container.appendChild(category);
        category.querySelector('.marker-type-category-header').addEventListener('click', () => toggleMarkerTypeExpansion(markerTypeCode));

        const itemsContainer = category.querySelector('.marker-type-items');
        dots.sort((a, b) => {
            if (appState.isAllPagesView && a.page !== b.page) {
                return a.page - b.page;
            }
            if (appState.sortMode === 'location') {
                return a.locationNumber.localeCompare(b.locationNumber);
            } else {
                return a.message.localeCompare(b.message);
            }
        }).forEach(dot => {
            const item = document.createElement('div');
            item.className = 'grouped-location-item';
            item.dataset.dotId = dot.internalId;
            if (dot.page) {
                item.dataset.dotPage = dot.page;
            }
            if (appState.selectedDots.has(dot.internalId)) {
                item.classList.add('selected');
            }

            const pagePrefix = appState.isAllPagesView ? `(P${dot.page}) ` : '';
            item.innerHTML = `<div class="grouped-location-header"><span class="location-number">${pagePrefix}${dot.locationNumber}</span><span class="location-message">${dot.message}</span></div>`;
            itemsContainer.appendChild(item);

            item.addEventListener('click', async (e) => {
                const dotPage = e.currentTarget.dataset.dotPage ? parseInt(e.currentTarget.dataset.dotPage, 10) : appState.currentPdfPage;
                if (dotPage !== appState.currentPdfPage) {
                    await changePage(dotPage);
                }
                
                // Always center on the dot to ensure it's visible and in viewport
                centerOnDot(dot.internalId);
                
                // Give the viewport update a moment to render the dot
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

            item.addEventListener('contextmenu', async (e) => {
                e.preventDefault();
                const dotPage = e.currentTarget.dataset.dotPage ? parseInt(e.currentTarget.dataset.dotPage, 10) : appState.currentPdfPage;
                if (dotPage !== appState.currentPdfPage) {
                    await changePage(dotPage);
                }
                if (!isDotVisible(dot.internalId)) centerOnDot(dot.internalId);
                if (appState.selectedDots.has(dot.internalId) && appState.selectedDots.size > 1) {
                    openGroupEditModal();
                } else {
                    clearSelection();
                    selectDot(dot.internalId);
                    updateSelectionUI();
                    openEditModal(dot.internalId);
                }
            });
        });
    });
}

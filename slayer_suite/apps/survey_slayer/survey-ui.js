/**
 * survey-ui.js
 * UI management for Survey Slayer
 */

import { surveyState, getLocationsArray, getLocationPhotos } from './survey-state.js';

// DOM element cache
const dom = new Proxy({}, {
    get(target, prop) {
        if (target[prop]) return target[prop];
        
        const elementMappings = {
            // Tabs
            detailsTab: () => document.getElementById('details-tab'),
            locationsTab: () => document.getElementById('locations-tab'),
            photosTab: () => document.getElementById('photos-tab'),
            reportTab: () => document.getElementById('report-tab'),
            
            // Tab content
            detailsContent: () => document.getElementById('details-content'),
            locationsContent: () => document.getElementById('locations-content'),
            photosContent: () => document.getElementById('photos-content'),
            reportContent: () => document.getElementById('report-content'),
            
            // Details form
            projectNameInput: () => document.getElementById('project-name-input'),
            surveyDateInput: () => document.getElementById('survey-date-input'),
            surveyorInput: () => document.getElementById('surveyor-input'),
            clientInput: () => document.getElementById('client-input'),
            
            // Locations
            locationsList: () => document.getElementById('locations-list'),
            locationForm: () => document.getElementById('location-form'),
            addLocationBtn: () => document.getElementById('add-location-btn'),
            
            // Photos
            photoGrid: () => document.getElementById('photo-grid'),
            photoUploadBtn: () => document.getElementById('photo-upload-btn'),
            photoFileInput: () => document.getElementById('photo-file-input'),
            
            // Status
            locationCount: () => document.getElementById('location-count'),
            photoCount: () => document.getElementById('photo-count')
        };
        
        if (elementMappings[prop]) {
            target[prop] = elementMappings[prop]();
            return target[prop];
        }
        
        return null;
    }
});

/**
 * Initialize UI
 */
export function initializeUI(handlers) {
    setupTabNavigation();
    setupDetailsForm(handlers);
    setupLocationControls(handlers);
    setupPhotoControls(handlers);
    updateAllUI();
}

/**
 * Setup tab navigation
 */
function setupTabNavigation() {
    const tabs = ['details', 'locations', 'photos', 'report'];
    
    tabs.forEach(tabName => {
        const tabElement = document.getElementById(`${tabName}-tab`);
        if (tabElement) {
            tabElement.addEventListener('click', () => switchTab(tabName));
        }
    });
}

/**
 * Switch between tabs
 */
export function switchTab(tabName) {
    surveyState.selectedTab = tabName;
    
    // Update tab buttons
    ['details', 'locations', 'photos', 'report'].forEach(tab => {
        const tabBtn = document.getElementById(`${tab}-tab`);
        const content = document.getElementById(`${tab}-content`);
        
        if (tabBtn) {
            tabBtn.classList.toggle('active', tab === tabName);
        }
        if (content) {
            content.style.display = tab === tabName ? 'block' : 'none';
        }
    });
    
    // Update content based on tab
    switch (tabName) {
        case 'locations':
            updateLocationsList();
            break;
        case 'photos':
            updatePhotoGrid();
            break;
        case 'report':
            updateReportPreview();
            break;
    }
}

/**
 * Setup details form handlers
 */
function setupDetailsForm(handlers) {
    const inputs = ['projectName', 'surveyDate', 'surveyor', 'client'];
    
    inputs.forEach(field => {
        const input = dom[`${field}Input`];
        if (input) {
            input.addEventListener('change', (e) => {
                surveyState[field] = e.target.value;
                if (handlers.onDetailsChange) {
                    handlers.onDetailsChange(field, e.target.value);
                }
            });
        }
    });
}

/**
 * Setup location controls
 */
function setupLocationControls(handlers) {
    if (dom.addLocationBtn) {
        dom.addLocationBtn.addEventListener('click', () => {
            if (handlers.onAddLocation) {
                handlers.onAddLocation();
            }
        });
    }
}

/**
 * Setup photo controls
 */
function setupPhotoControls(handlers) {
    if (dom.photoUploadBtn && dom.photoFileInput) {
        dom.photoUploadBtn.addEventListener('click', () => {
            dom.photoFileInput.click();
        });
        
        dom.photoFileInput.addEventListener('change', (e) => {
            if (handlers.onPhotoUpload) {
                handlers.onPhotoUpload(e.target.files);
            }
        });
    }
}

/**
 * Update all UI elements
 */
export function updateAllUI() {
    updateDetailsForm();
    updateLocationsList();
    updatePhotoGrid();
    updateStatusBar();
}

/**
 * Update details form with current state
 */
export function updateDetailsForm() {
    if (dom.projectNameInput) dom.projectNameInput.value = surveyState.projectName || '';
    if (dom.surveyDateInput) dom.surveyDateInput.value = surveyState.surveyDate || '';
    if (dom.surveyorInput) dom.surveyorInput.value = surveyState.surveyor || '';
    if (dom.clientInput) dom.clientInput.value = surveyState.client || '';
}

/**
 * Update locations list
 */
export function updateLocationsList() {
    if (!dom.locationsList) return;
    
    const locations = getLocationsArray();
    
    if (locations.length === 0) {
        dom.locationsList.innerHTML = `
            <div class="empty-state">
                No locations added yet. Click the + button to add your first location.
            </div>
        `;
        return;
    }
    
    dom.locationsList.innerHTML = locations.map(location => `
        <div class="location-item ${location.id === surveyState.currentLocationId ? 'selected' : ''}" 
             data-location-id="${location.id}">
            <div class="location-header">
                <span class="location-name">${location.name}</span>
                <span class="location-type">${location.type.toUpperCase()}</span>
            </div>
            <div class="location-details">
                <span>Floor: ${location.floor || '-'}</span>
                <span>Zone: ${location.zone || '-'}</span>
                <span class="condition-badge condition-${location.condition}">${location.condition}</span>
            </div>
            <div class="location-stats">
                <span>${location.photoIds.length} photos</span>
                ${location.width && location.height ? `<span>${location.width}" × ${location.height}"</span>` : ''}
            </div>
        </div>
    `).join('');
    
    // Add click handlers
    dom.locationsList.querySelectorAll('.location-item').forEach(item => {
        item.addEventListener('click', () => {
            const locationId = item.dataset.locationId;
            selectLocation(locationId);
        });
    });
}

/**
 * Select a location
 */
export function selectLocation(locationId) {
    surveyState.currentLocationId = locationId;
    updateLocationsList();
    updateLocationForm();
}

/**
 * Update location form
 */
export function updateLocationForm() {
    if (!dom.locationForm) return;
    
    const location = surveyState.locations.get(surveyState.currentLocationId);
    if (!location) {
        dom.locationForm.style.display = 'none';
        return;
    }
    
    dom.locationForm.style.display = 'block';
    // TODO: Populate form fields with location data
}

/**
 * Update photo grid
 */
export function updatePhotoGrid() {
    if (!dom.photoGrid) return;
    
    const photos = Array.from(surveyState.photos.values());
    
    if (photos.length === 0) {
        dom.photoGrid.innerHTML = `
            <div class="empty-state">
                No photos uploaded yet. Click the Upload button to add photos.
            </div>
        `;
        return;
    }
    
    dom.photoGrid.innerHTML = photos.map(photo => `
        <div class="photo-item" data-photo-id="${photo.id}">
            <img src="${photo.thumbnail || photo.dataUrl}" alt="${photo.caption}">
            <div class="photo-overlay">
                <div class="photo-caption">${photo.caption || 'No caption'}</div>
                ${photo.locationId ? `<div class="photo-location">${surveyState.locations.get(photo.locationId)?.name || ''}</div>` : ''}
            </div>
        </div>
    `).join('');
}

/**
 * Update report preview
 */
export function updateReportPreview() {
    if (!dom.reportContent) return;
    
    const locations = getLocationsArray();
    const totalPhotos = surveyState.photos.size;
    
    dom.reportContent.innerHTML = `
        <div class="report-preview">
            <h2>Survey Report Preview</h2>
            
            <div class="report-section">
                <h3>Project Information</h3>
                <table class="report-table">
                    <tr><td>Project Name:</td><td>${surveyState.projectName || 'N/A'}</td></tr>
                    <tr><td>Survey Date:</td><td>${surveyState.surveyDate || 'N/A'}</td></tr>
                    <tr><td>Surveyor:</td><td>${surveyState.surveyor || 'N/A'}</td></tr>
                    <tr><td>Client:</td><td>${surveyState.client || 'N/A'}</td></tr>
                </table>
            </div>
            
            <div class="report-section">
                <h3>Summary</h3>
                <p>Total Locations: ${locations.length}</p>
                <p>Total Photos: ${totalPhotos}</p>
            </div>
            
            <div class="report-section">
                <h3>Locations</h3>
                ${locations.map(location => `
                    <div class="report-location">
                        <h4>${location.name}</h4>
                        <p>Type: ${location.type} | Floor: ${location.floor} | Condition: ${location.condition}</p>
                        ${location.notes ? `<p>Notes: ${location.notes}</p>` : ''}
                        <p>Photos: ${location.photoIds.length}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Update status bar
 */
export function updateStatusBar() {
    if (dom.locationCount) {
        dom.locationCount.textContent = surveyState.locations.size;
    }
    if (dom.photoCount) {
        dom.photoCount.textContent = surveyState.photos.size;
    }
}

/**
 * Show success message
 */
export function showSuccess(message) {
    // TODO: Implement toast notification
    console.log('Success:', message);
}

/**
 * Show error message
 */
export function showError(message) {
    // TODO: Implement toast notification
    console.error('Error:', message);
}
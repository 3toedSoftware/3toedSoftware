// apps/survey_slayer/survey-app.js
import SlayerAppBase from '../../core/slayer-app-base.js';
import { surveyState, createLocation, deleteLocation, updateLocation, serializeState, deserializeState, resetState } from './survey-state.js';
import * as UI from './survey-ui.js';
import { processPhotoUploads, deletePhoto } from './photo-handler.js';
import { saveManager } from '../../core/save-manager.js';

class SurveySlayerApp extends SlayerAppBase {
    constructor() {
        super('survey_slayer', 'SURVEY SLAYER', '1.0.0');
        this.eventHandlers = null;
        this.cssLoaded = false;
    }

    async activate() {
        // Load CSS if not already loaded
        if (!this.cssLoaded && this.isSuiteMode) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = './apps/survey_slayer/survey-slayer.css';
            link.id = 'survey-slayer-css';
            document.head.appendChild(link);
            this.cssLoaded = true;
        }
        
        // Call parent activate
        await super.activate();
    }

    async deactivate() {
        // Remove CSS when deactivating
        if (this.cssLoaded && this.isSuiteMode) {
            const link = document.getElementById('survey-slayer-css');
            if (link) {
                link.remove();
                this.cssLoaded = false;
            }
        }
        
        // Call parent deactivate
        await super.deactivate();
    }

    createAppContent() {
        const contentArea = this.getContentArea();
        
        contentArea.innerHTML = `
            <div class="survey-slayer-app">
                <!-- Left Panel -->
                <div class="left-panel">
                    <!-- Survey Templates -->
                    <div class="panel-section">
                        <div class="panel-header">
                            <span>SURVEY INFO</span>
                        </div>
                        <div class="panel-content">
                            <div class="status-info">
                                <div class="status-item">
                                    <span>Locations:</span>
                                    <span class="status-count" id="location-count">0</span>
                                </div>
                                <div class="status-item">
                                    <span>Photos:</span>
                                    <span class="status-count" id="photo-count">0</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Locations List -->
                    <div class="panel-section">
                        <div class="panel-header">
                            <span>LOCATIONS</span>
                            <button class="btn-add" id="add-location-btn">+</button>
                        </div>
                        <div class="panel-content">
                            <div class="locations-list" id="locations-list">
                                <div class="empty-state">
                                    No locations added yet. Click + to add a location.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Center Panel -->
                <div class="center-panel">
                    <div class="survey-workspace">
                        <!-- Tab Navigation -->
                        <div class="tab-navigation">
                            <button class="tab-btn active" id="details-tab">DETAILS</button>
                            <button class="tab-btn" id="locations-tab">LOCATIONS</button>
                            <button class="tab-btn" id="photos-tab">PHOTOS</button>
                            <button class="tab-btn" id="report-tab">REPORT</button>
                        </div>
                        
                        <!-- Tab Content -->
                        <div class="tab-content active" id="details-content">
                            <div class="survey-form">
                                <h2>Survey Details</h2>
                                
                                <div class="form-group">
                                    <label class="form-label" for="project-name-input">Project Name</label>
                                    <input type="text" class="form-input" id="project-name-input" placeholder="Enter project name">
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label" for="survey-date-input">Survey Date</label>
                                    <input type="date" class="form-input" id="survey-date-input">
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label" for="surveyor-input">Surveyor</label>
                                    <input type="text" class="form-input" id="surveyor-input" placeholder="Surveyor name">
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label" for="client-input">Client</label>
                                    <input type="text" class="form-input" id="client-input" placeholder="Client name">
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label" for="notes-input">General Notes</label>
                                    <textarea class="form-textarea" id="notes-input" placeholder="Enter any general notes about the survey"></textarea>
                                </div>
                            </div>
                        </div>
                        
                        <div class="tab-content" id="locations-content">
                            <div id="location-form" style="display: none;">
                                <!-- Location form will be populated dynamically -->
                            </div>
                        </div>
                        
                        <div class="tab-content" id="photos-content">
                            <div class="photo-upload-area" id="photo-upload-area">
                                <div class="upload-icon">📷</div>
                                <div class="upload-text">Drag photos here or click to upload</div>
                                <button class="btn btn-primary" id="photo-upload-btn">Upload Photos</button>
                                <input type="file" id="photo-file-input" multiple accept="image/*">
                            </div>
                            
                            <div class="photo-grid" id="photo-grid">
                                <!-- Photos will be displayed here -->
                            </div>
                        </div>
                        
                        <div class="tab-content" id="report-content">
                            <!-- Report preview will be generated here -->
                        </div>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="footer-controls">
                    <div class="control-group">
                        <button class="btn btn-secondary" id="template-btn">TEMPLATES</button>
                        <button class="btn btn-secondary" id="settings-btn">SETTINGS</button>
                    </div>
                    
                    <div class="control-group">
                        <button class="btn btn-primary" id="export-report-btn">EXPORT REPORT</button>
                        <button class="btn btn-secondary" id="preview-btn">PREVIEW</button>
                    </div>
                </div>
            </div>
        `;
    }

    async initialize(container, isSuiteMode) {
        await super.initialize(container, isSuiteMode);
        
        // Load Survey Slayer specific styles only in standalone mode
        if (!isSuiteMode) {
            await this.loadAppStyles();
        }
        
        // Initialize functionality
        await this.initializeSurveyFunctionality();
    }
    
    async activate() {
        // Load CSS when activated in suite mode
        if (this.isSuiteMode && !this.cssLoaded) {
            await this.loadAppStyles();
            this.cssLoaded = true;
        }
        
        await super.activate();
    }
    
    async deactivate() {
        // Remove CSS when deactivated in suite mode
        if (this.isSuiteMode && this.cssLoaded) {
            const cssLink = document.getElementById('survey-slayer-css');
            if (cssLink) {
                cssLink.remove();
            }
            this.cssLoaded = false;
        }
        
        await super.deactivate();
    }
    
    async loadAppStyles() {
        const link = document.createElement('link');
        link.id = 'survey-slayer-css';
        link.rel = 'stylesheet';
        link.href = './apps/survey_slayer/style.css';
        document.head.appendChild(link);
        
        // Wait for styles to load
        return new Promise((resolve) => {
            link.onload = resolve;
            link.onerror = () => {
                console.error('Failed to load Survey Slayer styles');
                resolve();
            };
        });
    }

    async initializeSurveyFunctionality() {
        console.log('📋 Initializing Survey Slayer functionality...');
        
        // Setup event handlers
        this.setupEventHandlers();
        
        // Initialize UI
        UI.initializeUI(this.eventHandlers);
        
        // Set initial survey date
        surveyState.surveyDate = new Date().toISOString().split('T')[0];
        UI.updateDetailsForm();
        
        console.log('✅ Survey Slayer functionality initialized');
    }

    setupEventHandlers() {
        this.eventHandlers = {
            onDetailsChange: (field, value) => {
                // Mark as unsaved
                saveManager.markUnsaved();
            },
            
            onAddLocation: () => {
                const location = createLocation({
                    name: `Location ${surveyState.locations.size + 1}`
                });
                surveyState.currentLocationId = location.id;
                UI.updateLocationsList();
                UI.updateStatusBar();
                UI.switchTab('locations');
                saveManager.markUnsaved();
            },
            
            onPhotoUpload: async (files) => {
                const results = await processPhotoUploads(files);
                
                const successful = results.filter(r => r.success).length;
                const failed = results.filter(r => !r.success).length;
                
                if (successful > 0) {
                    UI.updatePhotoGrid();
                    UI.updateStatusBar();
                    UI.showSuccess(`${successful} photo(s) uploaded successfully`);
                    saveManager.markUnsaved();
                }
                
                if (failed > 0) {
                    UI.showError(`${failed} photo(s) failed to upload`);
                }
            }
        };
        
        // Export Report button
        const exportBtn = this.container.querySelector('#export-report-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportReport());
        }
        
        // Preview button
        const previewBtn = this.container.querySelector('#preview-btn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                UI.switchTab('report');
            });
        }
        
        // Photo upload drag and drop
        const uploadArea = this.container.querySelector('#photo-upload-area');
        if (uploadArea) {
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('drag-over');
            });
            
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('drag-over');
            });
            
            uploadArea.addEventListener('drop', async (e) => {
                e.preventDefault();
                uploadArea.classList.remove('drag-over');
                
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 0) {
                    await this.eventHandlers.onPhotoUpload(files);
                }
            });
        }
    }

    exportReport() {
        // Generate report content
        const reportContent = this.generateReportHTML();
        
        // Create blob and download
        const blob = new Blob([reportContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${surveyState.projectName || 'survey'}_report_${surveyState.surveyDate}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        UI.showSuccess('Report exported successfully');
    }

    generateReportHTML() {
        const locations = Array.from(surveyState.locations.values());
        
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Survey Report - ${surveyState.projectName || 'Untitled'}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        h1 { color: #f07727; }
        h2 { color: #333; margin-top: 30px; border-bottom: 2px solid #f07727; padding-bottom: 5px; }
        h3 { color: #f07727; margin-top: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        td { padding: 8px; border-bottom: 1px solid #ddd; }
        td:first-child { font-weight: bold; width: 150px; }
        .location { background: #f8f8f8; padding: 15px; margin-bottom: 20px; border-left: 4px solid #f07727; }
        .photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-top: 10px; }
        .photo { width: 100%; height: auto; }
        @media print { body { margin: 20px; } }
    </style>
</head>
<body>
    <h1>Survey Report</h1>
    
    <h2>Project Information</h2>
    <table>
        <tr><td>Project Name:</td><td>${surveyState.projectName || 'N/A'}</td></tr>
        <tr><td>Survey Date:</td><td>${surveyState.surveyDate || 'N/A'}</td></tr>
        <tr><td>Surveyor:</td><td>${surveyState.surveyor || 'N/A'}</td></tr>
        <tr><td>Client:</td><td>${surveyState.client || 'N/A'}</td></tr>
    </table>
    
    <h2>Summary</h2>
    <p>Total Locations Surveyed: ${locations.length}</p>
    <p>Total Photos Captured: ${surveyState.photos.size}</p>
    
    <h2>Location Details</h2>
    ${locations.map(location => `
        <div class="location">
            <h3>${location.name}</h3>
            <table>
                <tr><td>Type:</td><td>${location.type}</td></tr>
                <tr><td>Floor:</td><td>${location.floor || 'N/A'}</td></tr>
                <tr><td>Zone:</td><td>${location.zone || 'N/A'}</td></tr>
                <tr><td>Condition:</td><td>${location.condition}</td></tr>
                ${location.width && location.height ? `<tr><td>Dimensions:</td><td>${location.width}" × ${location.height}"</td></tr>` : ''}
                ${location.mountingHeight ? `<tr><td>Mounting Height:</td><td>${location.mountingHeight}"</td></tr>` : ''}
                ${location.notes ? `<tr><td>Notes:</td><td>${location.notes}</td></tr>` : ''}
            </table>
            
            ${location.photoIds.length > 0 ? `
                <h4>Photos (${location.photoIds.length})</h4>
                <div class="photo-grid">
                    ${location.photoIds.map(photoId => {
                        const photo = surveyState.photos.get(photoId);
                        return photo ? `<img src="${photo.dataUrl}" alt="${photo.caption || 'Photo'}" class="photo">` : '';
                    }).join('')}
                </div>
            ` : ''}
        </div>
    `).join('')}
    
    <p style="margin-top: 40px; text-align: center; color: #999;">
        Generated on ${new Date().toLocaleDateString()} by Survey Slayer
    </p>
</body>
</html>
        `;
    }

    exportData() {
        return {
            version: this.version,
            surveyData: serializeState(),
            exported: new Date().toISOString()
        };
    }

    async importData(data) {
        if (!data || !data.surveyData) {
            console.log('📋 No survey data to import');
            return;
        }
        
        // Reset and restore state
        resetState();
        deserializeState(data.surveyData);
        
        // Update all UI
        UI.updateAllUI();
        
        console.log('📋 Survey data imported successfully');
    }

    async handleDataRequest(fromApp, query) {
        switch (query.type) {
            case 'get-locations':
                return { 
                    locations: Array.from(surveyState.locations.values())
                };
            case 'get-survey-info':
                return {
                    projectName: surveyState.projectName,
                    surveyDate: surveyState.surveyDate,
                    surveyor: surveyState.surveyor,
                    client: surveyState.client,
                    locationCount: surveyState.locations.size,
                    photoCount: surveyState.photos.size
                };
            default:
                return { error: 'Unknown query type' };
        }
    }
}

export default SurveySlayerApp;
/**
 * survey-state.js
 * State management for Survey Slayer
 */

// Initial state
export const surveyState = {
    // Current survey data
    surveyId: null,
    templateId: null,
    projectName: '',
    surveyDate: new Date().toISOString().split('T')[0],
    surveyor: '',
    client: '',
    
    // Locations being surveyed
    locations: new Map(), // Map of locationId -> location data
    currentLocationId: null,
    nextLocationId: 1,
    
    // Photos and attachments
    photos: new Map(), // Map of photoId -> photo data
    nextPhotoId: 1,
    
    // Survey observations
    observations: [],
    
    // Templates
    activeTemplate: null,
    customFields: [],
    
    // UI state
    selectedTab: 'details', // 'details', 'locations', 'photos', 'report'
    viewMode: 'form', // 'form', 'preview'
    
    // Settings
    autoSave: true,
    photoQuality: 0.8,
    maxPhotoSize: 2048, // max dimension in pixels
};

/**
 * Create a new location entry
 */
export function createLocation(data = {}) {
    const locationId = `loc_${surveyState.nextLocationId++}`;
    const location = {
        id: locationId,
        name: data.name || `Location ${surveyState.nextLocationId}`,
        type: data.type || 'sign', // 'sign', 'wall', 'door', 'window', 'other'
        floor: data.floor || '1',
        zone: data.zone || '',
        coordinates: data.coordinates || { x: 0, y: 0 },
        
        // Measurements
        height: data.height || '',
        width: data.width || '',
        mounting: data.mounting || 'wall', // 'wall', 'ceiling', 'floor', 'freestanding'
        mountingHeight: data.mountingHeight || '',
        
        // Condition
        condition: data.condition || 'good', // 'excellent', 'good', 'fair', 'poor'
        notes: data.notes || '',
        
        // Linked resources
        photoIds: [],
        
        // Metadata
        created: new Date().toISOString(),
        modified: new Date().toISOString()
    };
    
    surveyState.locations.set(locationId, location);
    return location;
}

/**
 * Create a new photo entry
 */
export function createPhoto(data = {}) {
    const photoId = `photo_${surveyState.nextPhotoId++}`;
    const photo = {
        id: photoId,
        locationId: data.locationId || null,
        filename: data.filename || '',
        dataUrl: data.dataUrl || '', // Base64 encoded image
        thumbnail: data.thumbnail || '', // Smaller base64 for list view
        
        // Metadata
        caption: data.caption || '',
        tags: data.tags || [],
        timestamp: data.timestamp || new Date().toISOString(),
        
        // EXIF data if available
        exif: data.exif || {}
    };
    
    surveyState.photos.set(photoId, photo);
    
    // Link to location if provided
    if (photo.locationId) {
        const location = surveyState.locations.get(photo.locationId);
        if (location) {
            location.photoIds.push(photoId);
            location.modified = new Date().toISOString();
        }
    }
    
    return photo;
}

/**
 * Update a location
 */
export function updateLocation(locationId, updates) {
    const location = surveyState.locations.get(locationId);
    if (!location) return null;
    
    Object.assign(location, updates, {
        modified: new Date().toISOString()
    });
    
    return location;
}

/**
 * Delete a location and its associated photos
 */
export function deleteLocation(locationId) {
    const location = surveyState.locations.get(locationId);
    if (!location) return false;
    
    // Delete associated photos
    location.photoIds.forEach(photoId => {
        surveyState.photos.delete(photoId);
    });
    
    // Delete the location
    surveyState.locations.delete(locationId);
    
    // Update current location if needed
    if (surveyState.currentLocationId === locationId) {
        const remainingLocations = Array.from(surveyState.locations.keys());
        surveyState.currentLocationId = remainingLocations[0] || null;
    }
    
    return true;
}

/**
 * Get all locations as an array
 */
export function getLocationsArray() {
    return Array.from(surveyState.locations.values());
}

/**
 * Get all photos for a specific location
 */
export function getLocationPhotos(locationId) {
    const location = surveyState.locations.get(locationId);
    if (!location) return [];
    
    return location.photoIds
        .map(photoId => surveyState.photos.get(photoId))
        .filter(photo => photo !== undefined);
}

/**
 * Reset state to defaults
 */
export function resetState() {
    surveyState.surveyId = null;
    surveyState.templateId = null;
    surveyState.projectName = '';
    surveyState.surveyDate = new Date().toISOString().split('T')[0];
    surveyState.surveyor = '';
    surveyState.client = '';
    surveyState.locations.clear();
    surveyState.currentLocationId = null;
    surveyState.nextLocationId = 1;
    surveyState.photos.clear();
    surveyState.nextPhotoId = 1;
    surveyState.observations = [];
    surveyState.activeTemplate = null;
    surveyState.customFields = [];
}

/**
 * Serialize state for saving
 */
export function serializeState() {
    return {
        surveyId: surveyState.surveyId,
        templateId: surveyState.templateId,
        projectName: surveyState.projectName,
        surveyDate: surveyState.surveyDate,
        surveyor: surveyState.surveyor,
        client: surveyState.client,
        locations: Array.from(surveyState.locations.entries()),
        currentLocationId: surveyState.currentLocationId,
        nextLocationId: surveyState.nextLocationId,
        photos: Array.from(surveyState.photos.entries()),
        nextPhotoId: surveyState.nextPhotoId,
        observations: surveyState.observations,
        activeTemplate: surveyState.activeTemplate,
        customFields: surveyState.customFields
    };
}

/**
 * Deserialize state from saved data
 */
export function deserializeState(data) {
    surveyState.surveyId = data.surveyId || null;
    surveyState.templateId = data.templateId || null;
    surveyState.projectName = data.projectName || '';
    surveyState.surveyDate = data.surveyDate || new Date().toISOString().split('T')[0];
    surveyState.surveyor = data.surveyor || '';
    surveyState.client = data.client || '';
    surveyState.locations = new Map(data.locations || []);
    surveyState.currentLocationId = data.currentLocationId || null;
    surveyState.nextLocationId = data.nextLocationId || 1;
    surveyState.photos = new Map(data.photos || []);
    surveyState.nextPhotoId = data.nextPhotoId || 1;
    surveyState.observations = data.observations || [];
    surveyState.activeTemplate = data.activeTemplate || null;
    surveyState.customFields = data.customFields || [];
}
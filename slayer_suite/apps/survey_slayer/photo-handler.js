/**
 * photo-handler.js
 * Photo upload and processing for Survey Slayer
 */

import { surveyState, createPhoto } from './survey-state.js';

/**
 * Process uploaded files
 */
export async function processPhotoUploads(files, locationId = null) {
    const results = [];
    
    for (const file of files) {
        if (!file.type.startsWith('image/')) {
            console.warn(`Skipping non-image file: ${file.name}`);
            continue;
        }
        
        try {
            const photoData = await processPhoto(file);
            photoData.locationId = locationId || surveyState.currentLocationId;
            
            const photo = createPhoto(photoData);
            results.push({ success: true, photo });
            
        } catch (error) {
            console.error(`Failed to process ${file.name}:`, error);
            results.push({ success: false, error: error.message, filename: file.name });
        }
    }
    
    return results;
}

/**
 * Process a single photo file
 */
async function processPhoto(file) {
    // Read file as data URL
    const dataUrl = await readFileAsDataURL(file);
    
    // Resize if needed
    const resizedData = await resizeImage(dataUrl, surveyState.maxPhotoSize);
    
    // Create thumbnail
    const thumbnail = await resizeImage(dataUrl, 300); // 300px thumbnail
    
    // Extract EXIF data if available
    const exif = await extractExifData(file);
    
    return {
        filename: file.name,
        dataUrl: resizedData,
        thumbnail: thumbnail,
        timestamp: new Date(file.lastModified).toISOString(),
        exif: exif
    };
}

/**
 * Read file as data URL
 */
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Resize image to max dimension
 */
async function resizeImage(dataUrl, maxSize) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            // Calculate new dimensions
            let { width, height } = img;
            
            if (width <= maxSize && height <= maxSize) {
                resolve(dataUrl); // No resize needed
                return;
            }
            
            if (width > height) {
                height = (height / width) * maxSize;
                width = maxSize;
            } else {
                width = (width / height) * maxSize;
                height = maxSize;
            }
            
            // Create canvas and resize
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Convert back to data URL with quality setting
            resolve(canvas.toDataURL('image/jpeg', surveyState.photoQuality));
        };
        
        img.src = dataUrl;
    });
}

/**
 * Extract EXIF data from image file
 */
async function extractExifData(file) {
    // Basic implementation - in production, use a library like exif-js
    try {
        // For now, just return basic file info
        return {
            fileName: file.name,
            fileSize: file.size,
            lastModified: new Date(file.lastModified).toISOString(),
            mimeType: file.type
        };
    } catch (error) {
        console.warn('Failed to extract EXIF data:', error);
        return {};
    }
}

/**
 * Delete a photo
 */
export function deletePhoto(photoId) {
    const photo = surveyState.photos.get(photoId);
    if (!photo) return false;
    
    // Remove from location if linked
    if (photo.locationId) {
        const location = surveyState.locations.get(photo.locationId);
        if (location) {
            location.photoIds = location.photoIds.filter(id => id !== photoId);
            location.modified = new Date().toISOString();
        }
    }
    
    // Delete the photo
    surveyState.photos.delete(photoId);
    return true;
}

/**
 * Link photo to location
 */
export function linkPhotoToLocation(photoId, locationId) {
    const photo = surveyState.photos.get(photoId);
    const location = surveyState.locations.get(locationId);
    
    if (!photo || !location) return false;
    
    // Remove from old location if needed
    if (photo.locationId && photo.locationId !== locationId) {
        const oldLocation = surveyState.locations.get(photo.locationId);
        if (oldLocation) {
            oldLocation.photoIds = oldLocation.photoIds.filter(id => id !== photoId);
        }
    }
    
    // Update photo
    photo.locationId = locationId;
    
    // Add to new location
    if (!location.photoIds.includes(photoId)) {
        location.photoIds.push(photoId);
        location.modified = new Date().toISOString();
    }
    
    return true;
}

/**
 * Update photo caption
 */
export function updatePhotoCaption(photoId, caption) {
    const photo = surveyState.photos.get(photoId);
    if (!photo) return false;
    
    photo.caption = caption;
    return true;
}

/**
 * Export photos for a location
 */
export function exportLocationPhotos(locationId) {
    const location = surveyState.locations.get(locationId);
    if (!location) return [];
    
    return location.photoIds
        .map(photoId => surveyState.photos.get(photoId))
        .filter(photo => photo !== undefined)
        .map(photo => ({
            id: photo.id,
            filename: photo.filename,
            caption: photo.caption,
            dataUrl: photo.dataUrl
        }));
}
/**
 * data-integration.js
 * Integration with Design Slayer and Mapping Slayer via AppBridge
 */

import { thumbnailState, updateDesignTemplates, updateLocationData } from './thumbnail-state.js';

/**
 * Fetch design templates from Design Slayer
 */
export async function fetchDesignTemplates() {
    if (!window.appBridge) {
        console.warn('AppBridge not available');
        return null;
    }

    try {
        const response = await window.appBridge.sendRequest('design_slayer', {
            type: 'get-templates'
        });

        if (response && response.templates) {
            // Transform Design Slayer data into our format
            const templates = response.templates.map(template => ({
                id: template.id,
                name: template.name || 'Untitled Design',
                layers: template.layers || [],
                width: template.width || 12, // Default 12 inches
                height: template.height || 6, // Default 6 inches
                backgroundColor: template.backgroundColor || '#ffffff',
                created: template.created,
                modified: template.modified
            }));

            updateDesignTemplates(templates);
            return templates;
        }

        // If no templates, try to get current design
        const currentDesign = await window.appBridge.sendRequest('design_slayer', {
            type: 'get-current-design'
        });

        if (currentDesign && currentDesign.design) {
            const design = {
                id: 'current',
                name: 'Current Design',
                layers: currentDesign.design.layers || [],
                width: currentDesign.design.width || 12,
                height: currentDesign.design.height || 6,
                backgroundColor: currentDesign.design.backgroundColor || '#ffffff'
            };

            updateDesignTemplates([design]);
            return [design];
        }

        return null;
    } catch (error) {
        console.error('Failed to fetch design templates:', error);
        return null;
    }
}

/**
 * Fetch location data from Mapping Slayer
 */
export async function fetchLocationData() {
    if (!window.appBridge) {
        console.warn('AppBridge not available');
        return null;
    }

    try {
        const response = await window.appBridge.sendRequest('mapping_slayer', {
            type: 'get-all-locations'
        });

        if (response && response.locations) {
            // Also get marker types if available
            if (response.markerTypes) {
                thumbnailState.markerTypes = response.markerTypes;
            }
            // Transform Mapping Slayer locations into our format
            const locations = response.locations.map(loc => ({
                id: loc.id || `loc_${loc.locationNumber}_${loc.pageNumber}`,
                locationNumber: loc.locationNumber,
                pageNumber: loc.pageNumber || 1,
                sheetName: loc.sheetName || `Page ${loc.pageNumber || 1}`,

                // Messages - map to message1 and message2 for production items
                message: loc.message || '',
                message2: loc.message2 || '',
                message1: loc.message || '', // Add message1 field for compatibility

                // Sign type from marker type
                signType: loc.markerType || 'default',
                signTypeCode: loc.markerType || '',
                signTypeName: loc.markerTypeInfo?.name || loc.markerType || 'Default',
                signTypeInfo: loc.markerTypeInfo || {},
                markerType: loc.markerType || 'default', // Preserve original markerType for DOT column color matching

                // Position
                x: loc.x,
                y: loc.y,

                // Additional data
                installed: loc.installed || false,
                notes: loc.notes || ''
            }));

            // Get page info if available
            const pageInfo = response.pageInfo || {};

            updateLocationData(locations, pageInfo);
            return locations;
        }

        return null;
    } catch (error) {
        console.error('Failed to fetch location data:', error);
        return null;
    }
}

/**
 * Sync all data from both apps
 */
export async function syncAllData() {
    const results = {
        designs: null,
        locations: null,
        success: false,
        error: null
    };

    try {
        // Fetch both in parallel
        const [designs, locations] = await Promise.all([
            fetchDesignTemplates(),
            fetchLocationData()
        ]);

        results.designs = designs;
        results.locations = locations;
        results.success = !!(designs || locations);
    } catch (error) {
        results.error = error.message;
        console.error('Sync failed:', error);
    }

    return results;
}

/**
 * Listen for updates from other apps
 */
export function setupDataListeners() {
    if (!window.appBridge) {
        console.warn('AppBridge not available for listeners');
        return;
    }

    // Listen for Design Slayer updates
    window.appBridge.on('design:updated', async data => {
        console.log('Design updated, fetching new data...');
        await fetchDesignTemplates();
    });

    window.appBridge.on('design:saved', async data => {
        console.log('Design saved, fetching new data...');
        await fetchDesignTemplates();
    });

    // Listen for Mapping Slayer updates
    window.appBridge.on('locations:updated', async data => {
        console.log('Locations updated, fetching new data...');
        await fetchLocationData();
    });

    window.appBridge.on('marker:added', async data => {
        console.log('New marker added, fetching new data...');
        await fetchLocationData();
    });

    window.appBridge.on('marker:updated', async data => {
        console.log('Marker updated, fetching new data...');
        await fetchLocationData();
    });

    window.appBridge.on('marker:deleted', async data => {
        console.log('Marker deleted, fetching new data...');
        await fetchLocationData();
    });

    // Listen for sign type updates
    window.appBridge.on('sign-type:created', async data => {
        console.log('Sign type created, fetching new data...');
        await fetchLocationData();
    });

    window.appBridge.on('sign-type:updated', async data => {
        console.log('Sign type updated, fetching new data...');
        await fetchLocationData();
    });

    window.appBridge.on('sign-type:deleted', async data => {
        console.log('Sign type deleted, fetching new data...');
        await fetchLocationData();
    });
}

/**
 * Get mock data for testing when other apps aren't available
 */
export function getMockData() {
    const mockDesigns = [
        {
            id: 'mock-1',
            name: 'Standard Room Sign',
            width: 8,
            height: 6,
            backgroundColor: '#003366',
            layers: [
                {
                    type: 'plate',
                    x: 0,
                    y: 0,
                    width: 8,
                    height: 6,
                    backgroundColor: '#003366'
                },
                {
                    type: 'primary-text',
                    x: 0.5,
                    y: 1,
                    width: 7,
                    height: 2,
                    text: '{message1}',
                    fontSize: 48,
                    fontColor: '#ffffff',
                    textAlign: 'center'
                },
                {
                    type: 'secondary-text',
                    x: 0.5,
                    y: 3.5,
                    width: 7,
                    height: 1.5,
                    text: '{message2}',
                    fontSize: 24,
                    fontColor: '#ffffff',
                    textAlign: 'center'
                }
            ]
        }
    ];

    // Mock marker types with colors
    thumbnailState.markerTypes = {
        'room-id': { code: 'room-id', name: 'Room ID', color: '#FF6B6B', textColor: '#FFFFFF' },
        office: { code: 'office', name: 'Office', color: '#4ECDC4', textColor: '#000000' },
        utility: { code: 'utility', name: 'Utility', color: '#95E77E', textColor: '#000000' },
        emergency: { code: 'emergency', name: 'Emergency', color: '#FFD93D', textColor: '#000000' },
        directional: {
            code: 'directional',
            name: 'Directional',
            color: '#A8E6CF',
            textColor: '#000000'
        }
    };

    const mockLocations = [];

    // Generate more mock data for testing scrolling
    const roomTypes = ['Conference Room', 'Office', 'Storage', 'Break Room', 'Lab', 'Meeting Room'];
    const markerTypes = Object.keys(thumbnailState.markerTypes);
    const floors = ['First Floor', 'Second Floor', 'Third Floor', 'Basement'];

    for (let i = 1; i <= 50; i++) {
        const floor = Math.floor((i - 1) / 15);
        const roomType = roomTypes[Math.floor(Math.random() * roomTypes.length)];
        const selectedMarkerType = markerTypes[Math.floor(Math.random() * markerTypes.length)];

        mockLocations.push({
            id: `loc_${i}_${floor + 1}`,
            locationNumber: 100 + i,
            pageNumber: floor + 1,
            sheetName: floors[floor] || 'Fourth Floor',
            message: `${roomType} ${String.fromCharCode(65 + (i % 26))}`,
            message2: i % 3 === 0 ? `Capacity: ${5 + Math.floor(Math.random() * 20)}` : '',
            message1: `${roomType} ${String.fromCharCode(65 + (i % 26))}`, // Add message1 for compatibility
            signType: selectedMarkerType,
            signTypeCode: selectedMarkerType,
            markerType: selectedMarkerType,
            x: 50 + (i % 10) * 50,
            y: 50 + Math.floor(i / 10) * 50,
            flags: {
                topLeft: i % 4 === 0,
                topRight: i % 6 === 0,
                bottomLeft: i % 5 === 0,
                bottomRight: i % 3 === 0
            },
            installed: i % 7 === 0,
            notes: i % 10 === 0 ? 'Check mounting height' : ''
        });
    }

    updateDesignTemplates(mockDesigns);
    updateLocationData(mockLocations);

    return { designs: mockDesigns, locations: mockLocations };
}

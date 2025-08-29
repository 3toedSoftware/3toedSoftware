// config.js - Configuration constants for Design Slayer
import { PIXELS_PER_MM } from './units.js';

// Scale factor
export const SCALE_FACTOR = PIXELS_PER_MM; // mm-based scaling (1 pixel = 1mm at zoom 1.0)

// Layer type definitions (all measurements in mm)
export const LAYER_DEFINITIONS = {
    plate: {
        name: 'Plate',
        color: '#666666',
        width: 203.2, // 8" = 203.2mm
        height: 203.2, // 8" = 203.2mm
        thickness: 3.175, // 0.125" = 3.175mm
        material: 'aluminum',
        isBase: true
    },
    'braille-text': {
        name: 'Braille Text',
        color: '#FF69B4',
        width: 127, // 5" = 127mm
        height: 25.4, // 1" = 25.4mm
        thickness: 1.5875, // 0.0625" = 1.5875mm
        material: 'raised',
        isBase: false,
        isText: true,
        isBraille: true,
        defaultText: '',
        defaultBrailleSourceText: 'Sample Text',
        defaultFont: 'Braille.ttf',
        defaultFontSize: 17.2, // Font size stays in pixels
        defaultTextAlign: 'center',
        defaultVerticalAlign: 'middle',
        defaultLineSpacing: 1.0,
        defaultKerning: 0,
        defaultTextColor: '#000000'
    },
    logo: {
        name: 'Logo',
        color: '#32CD32',
        width: 50.8, // 2" = 50.8mm
        height: 50.8, // 2" = 50.8mm
        thickness: 3.175, // 0.125" = 3.175mm
        material: 'acrylic',
        isBase: false
    },
    icon: {
        name: 'Icon',
        color: '#FF6347',
        width: 38.1, // 1.5" = 38.1mm
        height: 38.1, // 1.5" = 38.1mm
        thickness: 3.175, // 0.125" = 3.175mm
        material: 'acrylic',
        isBase: false
    },
    'paragraph-text': {
        name: 'Paragraph Text',
        color: '#4A90E2',
        width: 101.6, // 4" = 101.6mm
        height: 50.8, // 2" = 50.8mm
        thickness: 3.175, // 0.125" = 3.175mm
        material: 'acrylic',
        isBase: false,
        isText: true,
        isParagraphText: true,
        defaultText: 'Double-click to edit text',
        defaultFont: 'Arial',
        defaultFontSize: 24, // Font size stays in pixels
        defaultTextAlign: 'left',
        defaultVerticalAlign: 'top',
        defaultLineSpacing: 1.2,
        defaultKerning: 0,
        defaultTextColor: '#000000'
    }
};

// Snap presets (all values stored in mm)
export const SNAP_PRESETS = {
    inches: [
        { value: 1.5875, label: '1/16"' }, // 0.0625" = 1.5875mm
        { value: 3.175, label: '1/8"' }, // 0.125" = 3.175mm
        { value: 6.35, label: '1/4"' }, // 0.25" = 6.35mm
        { value: 9.525, label: '3/8"' }, // 0.375" = 9.525mm
        { value: 12.7, label: '1/2"' }, // 0.5" = 12.7mm
        { value: 15.875, label: '5/8"' }, // 0.625" = 15.875mm
        { value: 19.05, label: '3/4"' }, // 0.75" = 19.05mm
        { value: 22.225, label: '7/8"' }, // 0.875" = 22.225mm
        { value: 25.4, label: '1"' } // 1.0" = 25.4mm
    ],
    mm: [
        { value: 0.5, label: '0.5mm' },
        { value: 1, label: '1mm' },
        { value: 2, label: '2mm' },
        { value: 3, label: '3mm' },
        { value: 5, label: '5mm' },
        { value: 10, label: '10mm' },
        { value: 15, label: '15mm' },
        { value: 20, label: '20mm' },
        { value: 25, label: '25mm' }
    ]
};

// Viewport state defaults
export const DEFAULT_VIEWPORT_STATE = {
    x: 0,
    y: 0,
    zoom: 2 // Start at 2x zoom (displayed as 100%)
};

// Grid level definitions for dynamic grid sizing (spacing in mm)
export const GRID_LEVELS = [
    { minZoom: 0.1, maxZoom: 0.5, spacing: 100 }, // 100mm grid
    { minZoom: 0.5, maxZoom: 1.0, spacing: 50 }, // 50mm grid
    { minZoom: 1.0, maxZoom: 2.0, spacing: 25 }, // 25mm grid (~1")
    { minZoom: 2.0, maxZoom: 4.0, spacing: 10 }, // 10mm grid
    { minZoom: 4.0, maxZoom: 8.0, spacing: 5 }, // 5mm grid
    { minZoom: 8.0, maxZoom: 999, spacing: 2 } // 2mm grid
];

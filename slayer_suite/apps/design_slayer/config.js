// config.js - Configuration constants for Design Slayer

// Scale factors (pixels per inch at 1:2 scale)
export const SCALE_FACTOR = 20; // 20 pixels = 1 inch at 1:2 scale

// Layer type definitions
export const LAYER_DEFINITIONS = {
    'plate': {
        name: 'Plate',
        color: '#666666',
        width: 8,
        height: 8,
        thickness: 0.125,
        material: 'aluminum',
        isBase: true
    },
    'primary-text': {
        name: 'Primary Text',
        color: '#FFD700',
        width: 6,
        height: 1,
        thickness: 0.125,
        material: 'acrylic',
        isBase: false,
        isText: true,
        defaultText: 'placeholder',
        defaultFont: 'Arial',
        defaultFontSize: 48,
        defaultTextAlign: 'center',
        defaultVerticalAlign: 'middle',
        defaultLineSpacing: 1.2,
        defaultKerning: 0
    },
    'secondary-text': {
        name: 'Secondary Text',
        color: '#87CEEB',
        width: 4,
        height: 0.75,
        thickness: 0.125,
        material: 'acrylic',
        isBase: false,
        isText: true,
        defaultText: 'placeholder',
        defaultFont: 'Arial',
        defaultFontSize: 36,
        defaultTextAlign: 'center',
        defaultVerticalAlign: 'middle',
        defaultLineSpacing: 1.2,
        defaultKerning: 0
    },
    'braille-text': {
        name: 'Braille Text',
        color: '#FF69B4',
        width: 3,
        height: 0.239, // ADA standard height
        thickness: 0.0625,
        material: 'acrylic',
        isBase: false,
        isText: true,
        isBraille: true,
        defaultText: 'placeholder',
        defaultFont: 'SimBraille',
        defaultFontSize: 24,
        defaultTextAlign: 'left',
        defaultVerticalAlign: 'middle',
        defaultLineSpacing: 1.0,
        defaultKerning: 0
    },
    'logo': {
        name: 'Logo',
        color: '#32CD32',
        width: 2,
        height: 2,
        thickness: 0.125,
        material: 'acrylic',
        isBase: false
    },
    'icon': {
        name: 'Icon',
        color: '#FF6347',
        width: 1.5,
        height: 1.5,
        thickness: 0.125,
        material: 'acrylic',
        isBase: false
    },
    'paragraph-text': {
        name: 'Paragraph Text',
        color: '#4A90E2',
        width: 4,
        height: 2,
        thickness: 0.125,
        material: 'acrylic',
        isBase: false,
        isText: true,
        isParagraphText: true,
        defaultText: 'Click to edit text',
        defaultFont: 'Arial',
        defaultFontSize: 24,
        defaultTextAlign: 'left',
        defaultVerticalAlign: 'top',
        defaultLineSpacing: 1.2,
        defaultKerning: 0,
        defaultTextColor: '#000000'
    }
};

// Snap presets for different units
export const SNAP_PRESETS = {
    inches: [
        { value: 0.0625, label: '1/16"' },
        { value: 0.125, label: '1/8"' },
        { value: 0.25, label: '1/4"' },
        { value: 0.375, label: '3/8"' },
        { value: 0.5, label: '1/2"' },
        { value: 0.625, label: '5/8"' },
        { value: 0.75, label: '3/4"' },
        { value: 0.875, label: '7/8"' },
        { value: 1.0, label: '1"' }
    ],
    mm: [
        { value: 1, label: '1mm' },
        { value: 2, label: '2mm' },
        { value: 3, label: '3mm' },
        { value: 4, label: '4mm' },
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
    zoom: 1
};

// Grid level definitions for dynamic grid sizing
export const GRID_LEVELS = [
    { minZoom: 0.1, maxZoom: 0.5, spacing: 5 },    // 5 inch grid
    { minZoom: 0.5, maxZoom: 1.0, spacing: 2 },    // 2 inch grid
    { minZoom: 1.0, maxZoom: 2.0, spacing: 1 },    // 1 inch grid
    { minZoom: 2.0, maxZoom: 4.0, spacing: 0.5 },  // 0.5 inch grid
    { minZoom: 4.0, maxZoom: 8.0, spacing: 0.25 }, // 0.25 inch grid
    { minZoom: 8.0, maxZoom: 999, spacing: 0.125 } // 0.125 inch grid
];
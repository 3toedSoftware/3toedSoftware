/**
 * units.js
 * Unit conversion utilities for Design Slayer
 * All internal storage is in millimeters (mm)
 */

// Conversion constants
export const MM_PER_INCH = 25.4;
export const PIXELS_PER_MM = 0.533333; // Empirically determined value for 1:1 grid snapping
// This compensates for legacy coordinate system issues
// TODO: Clean up coordinate systems to use true 1.0 base-10 system

// Common imperial fractions for display
const INCH_FRACTIONS = [
    { decimal: 0.03125, display: '1/32' },
    { decimal: 0.0625, display: '1/16' },
    { decimal: 0.09375, display: '3/32' },
    { decimal: 0.125, display: '1/8' },
    { decimal: 0.15625, display: '5/32' },
    { decimal: 0.1875, display: '3/16' },
    { decimal: 0.21875, display: '7/32' },
    { decimal: 0.25, display: '1/4' },
    { decimal: 0.28125, display: '9/32' },
    { decimal: 0.3125, display: '5/16' },
    { decimal: 0.34375, display: '11/32' },
    { decimal: 0.375, display: '3/8' },
    { decimal: 0.40625, display: '13/32' },
    { decimal: 0.4375, display: '7/16' },
    { decimal: 0.46875, display: '15/32' },
    { decimal: 0.5, display: '1/2' },
    { decimal: 0.53125, display: '17/32' },
    { decimal: 0.5625, display: '9/16' },
    { decimal: 0.59375, display: '19/32' },
    { decimal: 0.625, display: '5/8' },
    { decimal: 0.65625, display: '21/32' },
    { decimal: 0.6875, display: '11/16' },
    { decimal: 0.71875, display: '23/32' },
    { decimal: 0.75, display: '3/4' },
    { decimal: 0.78125, display: '25/32' },
    { decimal: 0.8125, display: '13/16' },
    { decimal: 0.84375, display: '27/32' },
    { decimal: 0.875, display: '7/8' },
    { decimal: 0.90625, display: '29/32' },
    { decimal: 0.9375, display: '15/16' },
    { decimal: 0.96875, display: '31/32' }
];

/**
 * Convert millimeters to inches
 */
export function mmToInches(mm) {
    return mm / MM_PER_INCH;
}

/**
 * Convert inches to millimeters
 */
export function inchesToMm(inches) {
    return inches * MM_PER_INCH;
}

/**
 * Round mm to a clean value for storage (0.1mm precision)
 */
export function roundMm(mm) {
    return Math.round(mm * 10) / 10;
}

/**
 * Format mm value as inches with fractions
 * @param {number} mm - Value in millimeters
 * @param {number} precision - Fraction precision (16 or 32)
 * @returns {string} - Formatted string like '1 1/4"'
 */
export function formatAsInches(mm, precision = 32) {
    const totalInches = mmToInches(mm);
    const wholeInches = Math.floor(totalInches);
    const fractionalInches = totalInches - wholeInches;

    // Find closest fraction
    let closestFraction = null;
    let minDiff = 1;

    for (const fraction of INCH_FRACTIONS) {
        // Skip fractions that are too precise for requested precision
        if (precision === 16 && fraction.display.includes('32')) continue;

        const diff = Math.abs(fractionalInches - fraction.decimal);
        if (diff < minDiff) {
            minDiff = diff;
            closestFraction = fraction;
        }
    }

    // If very close to a whole number
    if (minDiff > 0.015625 && fractionalInches > 0.984375) {
        return `${wholeInches + 1}"`;
    }

    // If very close to zero
    if (fractionalInches < 0.015625) {
        return wholeInches === 0 ? '0"' : `${wholeInches}"`;
    }

    // Format with fraction
    if (wholeInches === 0) {
        return `${closestFraction.display}"`;
    } else {
        return `${wholeInches} ${closestFraction.display}"`;
    }
}

/**
 * Format mm value for display based on unit preference
 * @param {number} mm - Value in millimeters
 * @param {string} unit - 'mm' or 'inch'
 * @returns {string} - Formatted string
 */
export function formatMeasurement(mm, unit = 'mm') {
    if (unit === 'inch' || unit === 'inches') {
        return formatAsInches(mm);
    }

    // For metric, show in mm or cm depending on size
    if (mm >= 100) {
        const cm = mm / 10;
        return `${cm.toFixed(1)}cm`;
    }
    return `${mm.toFixed(1)}mm`;
}

/**
 * Parse user input to mm
 * Accepts: "25mm", "2.5cm", "1in", '1"', "1 1/2"
 * @param {string} input - User input string
 * @returns {number|null} - Value in mm or null if invalid
 */
export function parseToMm(input) {
    if (!input || typeof input !== 'string') return null;

    const trimmed = input.trim().toLowerCase();

    // Check for mm
    if (trimmed.endsWith('mm')) {
        const value = parseFloat(trimmed.replace('mm', ''));
        return isNaN(value) ? null : value;
    }

    // Check for cm
    if (trimmed.endsWith('cm')) {
        const value = parseFloat(trimmed.replace('cm', ''));
        return isNaN(value) ? null : value * 10;
    }

    // Check for inches (various formats)
    let inchValue = null;

    // Format: 1.5" or 1.5in
    if (trimmed.endsWith('"') || trimmed.endsWith('in')) {
        const cleaned = trimmed.replace('"', '').replace('in', '').trim();

        // Check for fraction format like "1 1/2"
        if (cleaned.includes(' ')) {
            const parts = cleaned.split(' ');
            if (parts.length === 2) {
                const whole = parseFloat(parts[0]);
                const fractionParts = parts[1].split('/');
                if (fractionParts.length === 2) {
                    const numerator = parseFloat(fractionParts[0]);
                    const denominator = parseFloat(fractionParts[1]);
                    if (
                        !isNaN(whole) &&
                        !isNaN(numerator) &&
                        !isNaN(denominator) &&
                        denominator !== 0
                    ) {
                        inchValue = whole + numerator / denominator;
                    }
                }
            }
        }
        // Check for fraction only like "1/2"
        else if (cleaned.includes('/')) {
            const fractionParts = cleaned.split('/');
            if (fractionParts.length === 2) {
                const numerator = parseFloat(fractionParts[0]);
                const denominator = parseFloat(fractionParts[1]);
                if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
                    inchValue = numerator / denominator;
                }
            }
        }
        // Regular decimal
        else {
            const value = parseFloat(cleaned);
            if (!isNaN(value)) {
                inchValue = value;
            }
        }
    }

    // If no unit specified, try to parse as a number (assume current unit)
    // This will be handled by the caller based on current unit setting

    if (inchValue !== null) {
        return inchesToMm(inchValue);
    }

    return null;
}

/**
 * Get snap interval in mm based on unit and zoom
 * @param {string} unit - 'mm' or 'inch'
 * @param {number} zoom - Current zoom level
 * @returns {number} - Snap interval in mm
 */
export function getSnapInterval(unit, zoom) {
    if (unit === 'inch' || unit === 'inches') {
        // Snap to fractions of an inch
        if (zoom < 0.5) return inchesToMm(0.25); // 1/4"
        if (zoom < 1) return inchesToMm(0.125); // 1/8"
        if (zoom < 2) return inchesToMm(0.0625); // 1/16"
        return inchesToMm(0.03125); // 1/32"
    } else {
        // Metric snapping
        if (zoom < 0.25) return 10; // 10mm
        if (zoom < 0.5) return 5; // 5mm
        if (zoom < 1) return 2; // 2mm
        if (zoom < 2) return 1; // 1mm
        return 0.5; // 0.5mm
    }
}

/**
 * Convert old inch-based coordinates to mm
 * @param {number} inches - Old coordinate in inches
 * @returns {number} - Coordinate in mm
 */
export function migrateInchesToMm(inches) {
    return roundMm(inchesToMm(inches));
}

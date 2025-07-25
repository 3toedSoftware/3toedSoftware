/**
 * text-renderer.js
 * Handles text measurement and positioning for proper alignment
 * Uses canvas for measurement but renders to DOM
 */

import { SCALE_FACTOR } from './config.js';
export { SCALE_FACTOR };

/**
 * Creates a hidden canvas for text measurement
 */
let measureCanvas = null;
let measureCtx = null;

function getMeasureContext() {
    if (!measureCanvas) {
        measureCanvas = document.createElement('canvas');
        measureCanvas.style.position = 'absolute';
        measureCanvas.style.visibility = 'hidden';
        measureCanvas.width = 1;
        measureCanvas.height = 1;
        document.body.appendChild(measureCanvas);
        measureCtx = measureCanvas.getContext('2d');
    }
    return measureCtx;
}

/**
 * Measures text and returns dimensions
 */
export function measureText(text, font, maxWidth) {
    const ctx = getMeasureContext();
    ctx.font = font;
    
    // Split text into words for wrapping
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    // Handle existing line breaks
    const paragraphs = text.split('\n');
    
    paragraphs.forEach((paragraph, pIndex) => {
        if (pIndex > 0) {
            // Add the previous line before starting new paragraph
            if (currentLine) {
                lines.push(currentLine);
                currentLine = '';
            }
        }
        
        const words = paragraph.split(' ');
        
        words.forEach(word => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        });
    });
    
    if (currentLine) {
        lines.push(currentLine);
    }
    
    // Calculate total height
    const lineHeight = parseInt(font) * 1.2; // Default line height
    const totalHeight = lines.length * lineHeight;
    
    return {
        lines,
        lineHeight,
        totalHeight,
        width: Math.min(maxWidth, ctx.measureText(text).width)
    };
}

/**
 * Renders text with proper alignment
 */
export function renderAlignedText(container, layer, definition) {
    const font = `${layer.fontSize || definition.defaultFontSize}px "${layer.font || definition.defaultFont}"`;
    const maxWidth = layer.width * SCALE_FACTOR;
    const maxHeight = layer.height * SCALE_FACTOR;
    
    // Measure the text
    const measurement = measureText(
        layer.text || definition.defaultText || '',
        font,
        maxWidth
    );
    
    // Adjust line height based on layer setting
    const lineHeight = (layer.fontSize || definition.defaultFontSize) * (layer.lineSpacing || definition.defaultLineSpacing || 1.2);
    const totalHeight = measurement.lines.length * lineHeight;
    
    // Create text container
    let textWrapper = container.querySelector('.text-wrapper');
    if (!textWrapper) {
        textWrapper = document.createElement('div');
        textWrapper.className = 'text-wrapper';
        container.appendChild(textWrapper);
    }
    
    // Calculate vertical position
    let top = 0;
    switch (layer.verticalAlign || 'middle') {
        case 'top':
            top = 0;
            break;
        case 'middle':
            top = (maxHeight - totalHeight) / 2;
            break;
        case 'bottom':
            top = maxHeight - totalHeight;
            break;
    }
    
    // Apply styles to wrapper
    textWrapper.style.cssText = `
        position: absolute;
        left: 0;
        right: 0;
        top: ${Math.max(0, top)}px;
        font: ${font};
        color: ${layer.textColor || '#000000'};
        line-height: ${lineHeight}px;
        letter-spacing: ${(layer.kerning || 0) / 10}px;
        text-align: ${layer.textAlign || 'center'};
        white-space: pre-wrap;
        word-wrap: break-word;
        overflow: hidden;
    `;
    
    // Set the text content
    textWrapper.textContent = measurement.lines.join('\n');
}

/**
 * Get exact baseline position for text
 * @param {string} text - The text to measure (uses first line if multiline)
 * @param {string} font - The font string (e.g., "24px Arial")
 * @returns {object} Baseline metrics
 */
export function getTextBaseline(text, font) {
    const ctx = getMeasureContext();
    ctx.font = font;
    ctx.textBaseline = 'alphabetic'; // Standard baseline
    
    // Use first line of text or a sample if empty
    const firstLine = (text || 'Ag').split('\n')[0] || 'Ag';
    const metrics = ctx.measureText(firstLine);
    
    return {
        ascent: metrics.actualBoundingBoxAscent || metrics.fontBoundingBoxAscent || parseInt(font) * 0.75,
        descent: metrics.actualBoundingBoxDescent || metrics.fontBoundingBoxDescent || parseInt(font) * 0.25,
        // The baseline is at 'ascent' pixels from the top of the text
    };
}

/**
 * Measure the actual height of a capital X
 * @param {number} fontSize - Font size in pixels
 * @param {string} fontFamily - Font family name
 * @returns {number} Actual height of capital X in pixels
 */
export function measureCapitalXHeight(fontSize, fontFamily) {
    const ctx = getMeasureContext();
    
    // Use a much larger size for measurement to get better precision
    const scale = 100;
    const measureSize = fontSize * scale;
    ctx.font = `${measureSize}px "${fontFamily}"`;
    ctx.textBaseline = 'alphabetic';
    
    const metrics = ctx.measureText('X');
    
    // Get actual bounds of the X character
    const ascent = metrics.actualBoundingBoxAscent || measureSize * 0.75;
    const descent = metrics.actualBoundingBoxDescent || 0;
    
    
    // Scale back down to the actual font size
    const totalHeight = (ascent + descent) / scale;
    
    // Total height of capital X
    return totalHeight;
}

/**
 * Calculate font size needed for a specific X-height
 * @param {number} desiredXHeightInches - Desired X-height in inches
 * @param {string} fontFamily - Font family name
 * @returns {number} Required font size in pixels
 */
export function calculateFontSizeForXHeight(desiredXHeightInches, fontFamily) {
    // Use a larger reference size for better precision
    const testSize = 10000;
    const ctx = getMeasureContext();
    ctx.font = `${testSize}px "${fontFamily}"`;
    ctx.textBaseline = 'alphabetic';
    
    const metrics = ctx.measureText('X');
    const ascent = metrics.actualBoundingBoxAscent || testSize * 0.75;
    const descent = metrics.actualBoundingBoxDescent || 0;
    const measuredHeight = ascent + descent;
    
    // Get the ratio of actual X height to font size
    const ratio = measuredHeight / testSize;
    
    // Calculate required font size
    const desiredXHeightPixels = desiredXHeightInches * SCALE_FACTOR;
    const requiredFontSize = desiredXHeightPixels / ratio;
    
    
    // Return exact size without rounding
    return requiredFontSize;
}

/**
 * Calculate the actual dimensions of text content
 * @param {string} text - The text content
 * @param {string} font - Font family
 * @param {number} fontSize - Font size in pixels
 * @param {number} lineSpacing - Line spacing multiplier
 * @returns {object} Object with width and height in inches
 */
export function calculateTextDimensions(text, font, fontSize, lineSpacing = 1.2) {
    if (!text || text.trim().length === 0) {
        return { width: 0, height: 0, lines: 0 };
    }
    
    const ctx = getMeasureContext();
    ctx.font = `${fontSize}px "${font}"`;
    
    // Split into lines and measure each
    const lines = text.split('\n');
    let maxWidth = 0;
    
    lines.forEach(line => {
        if (line.trim().length > 0) {
            const metrics = ctx.measureText(line);
            const width = metrics.width;
            if (width > maxWidth) {
                maxWidth = width;
            }
        }
    });
    
    // Calculate height based on X-height and line spacing
    const xHeightPixels = measureCapitalXHeight(fontSize, font);
    const lineHeight = fontSize * lineSpacing;
    
    // For single line, height is just X-height
    // For multiple lines, it's X-height + (line spacing * (lines - 1))
    const nonEmptyLines = lines.filter(line => line.trim().length > 0).length;
    let totalHeight;
    
    if (nonEmptyLines <= 1) {
        totalHeight = xHeightPixels;
    } else {
        // First line X-height + gaps between lines + last line X-height
        const gapHeight = lineHeight - fontSize;
        totalHeight = xHeightPixels + ((nonEmptyLines - 1) * lineHeight);
    }
    
    return {
        width: maxWidth / SCALE_FACTOR,  // Convert to inches
        height: totalHeight / SCALE_FACTOR,  // Convert to inches
        lines: nonEmptyLines
    };
}

/**
 * Cleanup function
 */
export function cleanup() {
    if (measureCanvas && measureCanvas.parentNode) {
        measureCanvas.parentNode.removeChild(measureCanvas);
        measureCanvas = null;
        measureCtx = null;
    }
}
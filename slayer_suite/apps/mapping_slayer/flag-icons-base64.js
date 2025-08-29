// flag-icons-base64.js - High-resolution flag icons for PDF export
// Dynamically converts any flag (emoji, symbol, or custom image) to high-res base64

/**
 * Cache for generated flag icons to avoid regenerating
 */
const flagIconCache = new Map();

/**
 * Dynamically generate a high-res PNG from any emoji/symbol
 * This creates a 512x512 canvas with the symbol centered
 * @param {string} symbol - Any emoji or unicode symbol
 * @param {string} color - Color for the symbol
 * @returns {Promise<string>} Base64 encoded PNG data URL
 */
export async function generateSymbolPNG(symbol, color = '#000000') {
    return new Promise(resolve => {
        const canvas = document.createElement('canvas');
        const size = 512; // High resolution for maximum clarity
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // White background for better visibility in PDFs
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);

        // Set up text rendering for emoji/symbols
        // Use system fonts that support emoji
        ctx.font = `${size * 0.65}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // For emoji, we don't change the color (they have their own colors)
        // For simple symbols like ✓, ✗, we can apply color
        const isSimpleSymbol = /^[✓✗✔✖×]$/.test(symbol);

        if (isSimpleSymbol) {
            ctx.fillStyle = color;
        } else {
            // For emoji, just render as-is
            ctx.fillStyle = '#000000';
        }

        // Render the symbol centered
        ctx.fillText(symbol, size / 2, size / 2);

        // Convert to base64
        canvas.toBlob(
            blob => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    resolve(reader.result);
                };
                reader.readAsDataURL(blob);
            },
            'image/png',
            1.0
        ); // Maximum quality
    });
}

/**
 * Get base64 PNG for a flag (symbol, emoji, or custom image)
 * @param {Object} flag - The flag object with symbol/customIcon
 * @param {string} position - Position of the flag (for coloring)
 * @returns {Promise<string|null>} Base64 data URL or null if no flag
 */
export async function getFlagIconBase64(flag, position = '') {
    if (!flag) {
        return null;
    }

    // Create cache key
    const cacheKey = `${flag.symbol || 'custom'}_${flag.customIcon || 'default'}_${position}`;

    // Check cache first
    if (flagIconCache.has(cacheKey)) {
        return flagIconCache.get(cacheKey);
    }

    let base64Data = null;

    // Handle custom uploaded icon
    if (flag.customIcon) {
        try {
            // If it's already base64
            if (flag.customIcon.startsWith('data:image')) {
                base64Data = flag.customIcon;
            } else if (flag.customIcon.startsWith('blob:') || flag.customIcon.startsWith('http')) {
                // Load and convert URL to base64
                const response = await fetch(flag.customIcon);
                const blob = await response.blob();

                // Create high-res version if needed
                const img = new Image();
                img.src = URL.createObjectURL(blob);

                await new Promise(resolve => {
                    img.onload = resolve;
                });

                // Upscale to high-res if image is small
                const targetSize = 512;
                const canvas = document.createElement('canvas');
                canvas.width = targetSize;
                canvas.height = targetSize;
                const ctx = canvas.getContext('2d');

                // White background
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, targetSize, targetSize);

                // Draw image centered and scaled
                const scale = Math.min(targetSize / img.width, targetSize / img.height) * 0.8;
                const width = img.width * scale;
                const height = img.height * scale;
                const x = (targetSize - width) / 2;
                const y = (targetSize - height) / 2;

                ctx.drawImage(img, x, y, width, height);

                // Convert to base64
                base64Data = canvas.toDataURL('image/png', 1.0);

                URL.revokeObjectURL(img.src);
            }
        } catch (error) {
            console.error('Failed to load custom flag icon:', error);
        }
    }

    // If no custom icon, generate from symbol
    if (!base64Data && flag.symbol) {
        // Position-based colors (matching current PDF export colors)
        let color = '#000000'; // Default black
        if (position === 'topLeft') color = '#FFD700'; // Gold
        if (position === 'topRight') color = '#00FF00'; // Green
        if (position === 'bottomLeft') color = '#0088FF'; // Blue
        if (position === 'bottomRight') color = '#FF0000'; // Red

        base64Data = await generateSymbolPNG(flag.symbol, color);
    }

    // Cache the result
    if (base64Data) {
        flagIconCache.set(cacheKey, base64Data);
    }

    return base64Data;
}

/**
 * Clear the flag icon cache (useful for memory management)
 */
export function clearFlagIconCache() {
    flagIconCache.clear();
}

/**
 * Get all unique flags from dots for pre-caching
 * @param {Array} dots - Array of dot objects
 * @returns {Map} Map of unique flag keys to flag configs
 */
export function collectUniqueFlags(dots) {
    const uniqueFlags = new Map();

    for (const dot of dots) {
        if (dot.flags) {
            const positions = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
            for (const position of positions) {
                if (dot.flags[position]) {
                    const flag = dot.flags[position];
                    const key = `${flag.symbol || 'custom'}_${flag.customIcon || 'default'}_${position}`;
                    if (!uniqueFlags.has(key)) {
                        uniqueFlags.set(key, { flag, position });
                    }
                }
            }
        }
    }

    return uniqueFlags;
}

/**
 * sign-renderer.js
 * Canvas-based sign thumbnail rendering
 */

import { thumbnailState } from './thumbnail-state.js';

/**
 * Render a sign thumbnail
 */
export async function renderSignThumbnail(productionItem, size = 200) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = size;
    canvas.height = size;
    
    // Get design if available
    const design = productionItem.designId 
        ? thumbnailState.designTemplates.get(productionItem.designId)
        : null;
    
    if (design) {
        // Render with design
        await renderDesignedSign(ctx, canvas, productionItem, design);
    } else {
        // Render placeholder
        renderPlaceholderSign(ctx, canvas, productionItem);
    }
    
    return canvas;
}

/**
 * Render a sign with design template
 */
async function renderDesignedSign(ctx, canvas, productionItem, design) {
    const { width: canvasWidth, height: canvasHeight } = canvas;
    
    // Calculate scale to fit design in canvas
    const designAspect = design.width / design.height;
    const canvasAspect = canvasWidth / canvasHeight;
    
    let scale, offsetX = 0, offsetY = 0;
    
    if (designAspect > canvasAspect) {
        // Design is wider
        scale = canvasWidth / design.width;
        offsetY = (canvasHeight - design.height * scale) / 2;
    } else {
        // Design is taller
        scale = canvasHeight / design.height;
        offsetX = (canvasWidth - design.width * scale) / 2;
    }
    
    // Add padding
    const padding = 10;
    scale *= (1 - padding * 2 / Math.min(canvasWidth, canvasHeight));
    offsetX += padding;
    offsetY += padding;
    
    // Clear and set background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Save context state
    ctx.save();
    
    // Apply transform
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    
    // Render layers
    if (design.layers && design.layers.length > 0) {
        design.layers.forEach(layer => {
            renderLayer(ctx, layer, productionItem);
        });
    } else {
        // If no layers, draw a simple rectangle
        ctx.fillStyle = design.backgroundColor || '#003366';
        ctx.fillRect(0, 0, design.width, design.height);
        
        // Add text
        ctx.fillStyle = '#ffffff';
        ctx.font = `${design.height * 0.15}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        if (productionItem.message1) {
            ctx.fillText(productionItem.message1, design.width / 2, design.height * 0.3);
        }
        
        if (productionItem.message2) {
            ctx.font = `${design.height * 0.1}px Arial`;
            ctx.fillText(productionItem.message2, design.width / 2, design.height * 0.6);
        }
    }
    
    // Draw border
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1 / scale;
    ctx.strokeRect(0, 0, design.width, design.height);
    
    // Restore context
    ctx.restore();
}

/**
 * Render a single layer
 */
function renderLayer(ctx, layer, productionItem) {
    ctx.save();
    
    switch (layer.type) {
        case 'plate':
            ctx.fillStyle = layer.backgroundColor || '#003366';
            ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
            break;
            
        case 'primary-text':
            renderTextLayer(ctx, layer, productionItem.message1 || layer.text);
            break;
            
        case 'secondary-text':
            renderTextLayer(ctx, layer, productionItem.message2 || layer.text);
            break;
            
        case 'braille-text':
            // Render dots pattern for braille
            ctx.fillStyle = layer.color || '#ffffff';
            const dotSize = layer.height * 0.1;
            const spacing = dotSize * 2;
            
            for (let i = 0; i < 6; i++) {
                for (let j = 0; j < 2; j++) {
                    if (Math.random() > 0.3) { // Random pattern for demo
                        ctx.beginPath();
                        ctx.arc(
                            layer.x + j * spacing + spacing,
                            layer.y + i * spacing + spacing,
                            dotSize,
                            0,
                            Math.PI * 2
                        );
                        ctx.fill();
                    }
                }
            }
            break;
            
        case 'logo':
        case 'icon':
            // Placeholder for logos/icons
            ctx.fillStyle = layer.color || '#f07727';
            ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
            ctx.fillStyle = '#ffffff';
            ctx.font = `${layer.height * 0.5}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('LOGO', layer.x + layer.width / 2, layer.y + layer.height / 2);
            break;
    }
    
    ctx.restore();
}

/**
 * Render text layer with proper formatting
 */
function renderTextLayer(ctx, layer, text) {
    if (!text) return;
    
    // Replace template variables
    text = text.replace(/{message1}/g, text)
               .replace(/{message2}/g, text);
    
    ctx.fillStyle = layer.fontColor || '#ffffff';
    ctx.font = `${layer.fontSize || 24}px ${layer.fontFamily || 'Arial'}`;
    ctx.textAlign = layer.textAlign || 'left';
    ctx.textBaseline = 'top';
    
    // Handle text wrapping if needed
    const words = text.split(' ');
    const lineHeight = (layer.fontSize || 24) * 1.2;
    let line = '';
    let y = layer.y;
    
    for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        
        if (testWidth > layer.width && i > 0) {
            // Adjust x position based on alignment
            let x = layer.x;
            if (layer.textAlign === 'center') x += layer.width / 2;
            else if (layer.textAlign === 'right') x += layer.width;
            
            ctx.fillText(line, x, y);
            line = words[i] + ' ';
            y += lineHeight;
            
            // Stop if we exceed layer height
            if (y + lineHeight > layer.y + layer.height) break;
        } else {
            line = testLine;
        }
    }
    
    // Draw last line
    if (line && y + lineHeight <= layer.y + layer.height) {
        let x = layer.x;
        if (layer.textAlign === 'center') x += layer.width / 2;
        else if (layer.textAlign === 'right') x += layer.width;
        
        ctx.fillText(line, x, y);
    }
}

/**
 * Render placeholder sign (no design)
 */
function renderPlaceholderSign(ctx, canvas, productionItem) {
    const { width, height } = canvas;
    const padding = 20;
    
    // Canvas background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);
    
    // Draw sign with light gray background
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(padding, padding, width - padding * 2, height - padding * 2);
    
    // Draw border
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, padding, width - padding * 2, height - padding * 2);
    
    // Draw text in black
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Calculate available text area
    const textAreaWidth = width - padding * 3;
    const textAreaHeight = height - padding * 3;
    
    // Message 1 (primary)
    if (productionItem.message1) {
        // Adjust font size based on message length
        const fontSize = Math.min(20, Math.max(12, textAreaWidth / productionItem.message1.length * 1.8));
        ctx.font = `bold ${fontSize}px Arial`;
        
        const lines = wrapText(ctx, productionItem.message1, textAreaWidth);
        const lineHeight = fontSize * 1.2;
        
        // Calculate vertical position
        let startY;
        if (productionItem.message2) {
            // If there's a second message, position message1 in upper portion
            startY = height * 0.4 - (lines.length * lineHeight) / 2;
        } else {
            // Center vertically if only one message
            startY = height / 2 - (lines.length * lineHeight) / 2;
        }
        
        lines.forEach((line, index) => {
            ctx.fillText(line, width / 2, startY + index * lineHeight);
        });
    }
    
    // Message 2 (secondary)
    if (productionItem.message2) {
        const fontSize = Math.min(14, Math.max(10, textAreaWidth / productionItem.message2.length * 1.5));
        ctx.font = `${fontSize}px Arial`;
        
        const lines = wrapText(ctx, productionItem.message2, textAreaWidth);
        const lineHeight = fontSize * 1.2;
        
        // Position in lower portion
        const startY = height * 0.7 - (lines.length * lineHeight) / 2;
        
        lines.forEach((line, index) => {
            ctx.fillText(line, width / 2, startY + index * lineHeight);
        });
    }
}

/**
 * Wrap text to fit width
 */
function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    
    if (currentLine) {
        lines.push(currentLine);
    }
    
    return lines;
}

/**
 * Render location number overlay
 */
function renderLocationNumber(ctx, canvas, locationNumber) {
    const size = 30;
    const padding = 5;
    
    // Background circle
    ctx.fillStyle = 'rgba(240, 119, 39, 0.9)';
    ctx.beginPath();
    ctx.arc(padding + size/2, padding + size/2, size/2, 0, Math.PI * 2);
    ctx.fill();
    
    // Number
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(locationNumber.toString(), padding + size/2, padding + size/2);
}

/**
 * Render detail icons in top-right
 */
function renderDetailIcons(ctx, canvas, productionItem) {
    const iconSize = 24;
    const padding = 8;
    const spacing = 4;
    let x = canvas.width - padding;
    
    // Draw icons from right to left
    const icons = [];
    
    if (productionItem.installed) {
        icons.push({ type: 'installed', symbol: '✓', bg: '#00b360' });
    }
    
    if (productionItem.vinylBacker) {
        icons.push({ type: 'vinyl', symbol: 'V', bg: '#4a90e2' });
    }
    
    if (productionItem.notes) {
        icons.push({ type: 'notes', symbol: '📝', bg: 'transparent' });
    }
    
    if (productionItem.codeRequired) {
        icons.push({ type: 'code', symbol: '⭐', bg: 'transparent' });
    }
    
    // Draw each icon
    icons.forEach((icon, index) => {
        const iconX = x - (iconSize + spacing) * index - iconSize;
        const iconY = padding;
        
        // Draw background for V and checkmark
        if (icon.bg !== 'transparent') {
            ctx.fillStyle = icon.bg;
            ctx.fillRect(iconX, iconY, iconSize, iconSize);
        }
        
        // Draw symbol
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        if (icon.type === 'vinyl' || icon.type === 'installed') {
            // White text on colored background
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${icon.type === 'vinyl' ? '16' : '18'}px Arial`;
        } else if (icon.type === 'code') {
            // Yellow star
            ctx.fillStyle = '#FFD700';
            ctx.font = '18px Arial';
        } else {
            // Notes emoji
            ctx.font = '16px Arial';
        }
        
        ctx.fillText(icon.symbol, iconX + iconSize/2, iconY + iconSize/2);
        ctx.restore();
    });
}

/**
 * Render sign type info at bottom center
 */
function renderSignTypeInfo(ctx, canvas, productionItem) {
    const padding = 10;
    const fontSize = 14;
    
    // Prepare text
    const signCode = productionItem.signTypeCode || productionItem.signType || '';
    const signName = productionItem.signTypeName || '';
    const text = signCode && signName ? `${signCode} ${signName}` : (signCode || signName);
    
    if (!text) return;
    
    // Set font and measure
    ctx.font = `bold ${fontSize}px Arial`;
    const metrics = ctx.measureText(text);
    
    // Position at bottom center
    const x = canvas.width / 2;
    const y = canvas.height - padding;
    
    // Draw text shadow for better visibility
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, x + 1, y + 1);
    
    // Draw main text in orange
    ctx.fillStyle = '#f07727';
    ctx.fillText(text, x, y);
}

/**
 * Generate data URL from canvas
 */
export function canvasToDataURL(canvas, format = 'png', quality = 0.9) {
    return canvas.toDataURL(`image/${format}`, quality);
}

/**
 * Download canvas as image
 */
export function downloadCanvasAsImage(canvas, filename, format = 'png') {
    const dataUrl = canvasToDataURL(canvas, format);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
/**
 * sign-renderer-svg.js
 * SVG-based sign thumbnail rendering for crisp, scalable thumbnails
 */

import { thumbnailState } from './thumbnail-state.js';

// Load SVG.js from CDN
const SVG =
    window.SVG ||
    (await import('https://cdn.jsdelivr.net/npm/@svgdotjs/svg.js@3.2.0/dist/svg.esm.js').then(
        m => m.SVG
    ));

// Load OpenType.js from CDN
const opentype =
    window.opentype ||
    (await import('https://cdn.jsdelivr.net/npm/opentype.js@1.3.4/dist/opentype.module.js').then(
        m => m.default
    ));

/**
 * SVG Sign Renderer Class
 */
export class SVGSignRenderer {
    constructor() {
        this.fontCache = new Map(); // Cache loaded fonts
        this.pathCache = new Map(); // Cache text-to-path results
        this.defaultFontPath = null; // Will be set when font is available
        this.defaultFont = null; // Will be loaded on first use
    }

    /**
     * Set the default font path for text rendering
     */
    setDefaultFont(fontPath) {
        this.defaultFontPath = fontPath;
        console.log(`Default font path set to: ${fontPath}`);
    }

    /**
     * Load a font file and cache it
     */
    async loadFont(fontPath = this.defaultFontPath) {
        if (!fontPath) {
            // No font path available, return null to use SVG text
            return null;
        }

        if (this.fontCache.has(fontPath)) {
            return this.fontCache.get(fontPath);
        }

        try {
            const font = await opentype.load(fontPath);
            this.fontCache.set(fontPath, font);
            return font;
        } catch (error) {
            console.warn(`Font loading not available yet: ${fontPath}`, error);
            // Return null to use SVG text as fallback
            return null;
        }
    }

    /**
     * Convert text to SVG path
     */
    async textToPath(text, options = {}) {
        const { fontSize = 24, fontPath = this.defaultFontPath, x = 0, y = 0 } = options;

        // Create cache key
        const cacheKey = `${fontPath}:${fontSize}:${text}`;

        // Check cache first
        if (this.pathCache.has(cacheKey)) {
            const cachedPath = this.pathCache.get(cacheKey);
            // Return a clone of the cached path positioned at x, y
            return this.positionPath(cachedPath, x, y);
        }

        // Load font
        const font = await this.loadFont(fontPath);
        if (!font) {
            // If font loading fails, return null (will use SVG text as fallback)
            return null;
        }

        // Generate path
        const path = font.getPath(text, 0, 0, fontSize);
        const svgPathData = path.toPathData();

        // Cache the path data
        this.pathCache.set(cacheKey, svgPathData);

        // Return positioned path
        return this.positionPath(svgPathData, x, y);
    }

    /**
     * Position a path at specific coordinates
     */
    positionPath(pathData, x, y) {
        if (x === 0 && y === 0) {
            return pathData;
        }
        // Add transform to position the path
        return {
            d: pathData,
            transform: `translate(${x}, ${y})`
        };
    }

    /**
     * Create SVG drawing surface for testing
     */
    createSVGDraw(size = 200) {
        return SVG().size(size, size).viewbox(0, 0, size, size);
    }

    /**
     * Main render function - creates SVG thumbnail
     */
    async renderSignThumbnail(productionItem, size = 200) {
        // Create SVG drawing surface
        const draw = this.createSVGDraw(size);

        // Get design template for the sign type
        let design = null;

        // First try to get template by sign type
        if (productionItem.signTypeCode || productionItem.signType) {
            const signTypeCode = productionItem.signTypeCode || productionItem.signType;

            // Check if we have a template for this sign type in local cache
            for (const [templateId, template] of thumbnailState.designTemplates.entries()) {
                if (template.signTypeCode === signTypeCode) {
                    design = template;
                    break;
                }
            }

            // If no template found locally, try to fetch from Design Slayer
            if (!design && window.thumbnailApp?.syncAdapter) {
                const fetchedTemplate =
                    await window.thumbnailApp.syncAdapter.fetchTemplateForSignType(signTypeCode);
                if (fetchedTemplate && fetchedTemplate.hasTemplate !== false) {
                    // Process and store the enhanced template
                    const processedTemplate = {
                        id: fetchedTemplate.id,
                        name: fetchedTemplate.name,
                        signTypeCode: fetchedTemplate.signTypeCode,
                        layers: window.thumbnailApp.syncAdapter.extractLayersFromTemplate(
                            fetchedTemplate
                        ),
                        width: fetchedTemplate.faceView?.canvas?.dimensions?.width || 12,
                        height: fetchedTemplate.faceView?.canvas?.dimensions?.height || 6,
                        backgroundColor: fetchedTemplate.faceView?.backgroundColor || '#ffffff',
                        // Enhanced properties from Design Slayer
                        fieldMappings: fetchedTemplate.fieldMappings || {},
                        renderingInstructions: fetchedTemplate.renderingInstructions || {},
                        availableFields: fetchedTemplate.availableFields || [],
                        source: fetchedTemplate.source || 'unknown'
                    };

                    thumbnailState.designTemplates.set(fetchedTemplate.id, processedTemplate);
                    design = processedTemplate;

                    console.log(
                        `🎨 Using template "${design.name}" for sign type ${signTypeCode} (source: ${design.source})`
                    );
                } else {
                    console.log(`📝 No template available for sign type: ${signTypeCode}`);
                    if (fetchedTemplate && fetchedTemplate.suggestion) {
                        console.log(`💡 ${fetchedTemplate.suggestion}`);
                    }
                }
            }
        }

        // If we have a design template, use it
        if (design && design.layers && design.layers.length > 0) {
            await this.renderFromTemplate(draw, design, productionItem, size);
        } else {
            // Otherwise, use intelligent generic design based on sign type
            await this.renderGenericSign(draw, productionItem, size);
        }

        // Return the SVG element
        return draw.node;
    }

    /**
     * Render sign from template with enhanced field mapping
     */
    async renderFromTemplate(draw, template, productionItem, size) {
        // Use rendering instructions if available for more precise rendering
        const instructions = template.renderingInstructions;
        const fieldMappings = template.fieldMappings || {};

        // Calculate template bounds to properly scale to fill thumbnail
        const templateBounds = this.calculateTemplateBounds(template);
        const scale = this.calculateOptimalScale(templateBounds, size);

        // Set background - preserve original colors instead of defaulting to white
        const backgroundColor = instructions?.backgroundColor || template.backgroundColor;
        if (backgroundColor && backgroundColor !== '#ffffff') {
            draw.rect(size, size).fill(backgroundColor);
        } else {
            // Use a subtle background for better contrast
            draw.rect(size, size).fill('#f8f8f8');
        }

        // Create a group for the entire sign with proper centering
        const signGroup = draw.group();

        // Apply scaling and centering transformation
        const offsetX = (size - templateBounds.width * scale) / 2 - templateBounds.minX * scale;
        const offsetY = (size - templateBounds.height * scale) / 2 - templateBounds.minY * scale;

        signGroup.transform({
            scale: scale,
            translateX: offsetX / scale,
            translateY: offsetY / scale
        });

        // Use rendering instructions if available, otherwise fall back to layers
        if (instructions && instructions.elements) {
            // Sort elements by z-index
            const sortedElements = [...instructions.elements].sort(
                (a, b) => (a.zIndex || 0) - (b.zIndex || 0)
            );

            // Render each element using enhanced instructions
            for (const element of sortedElements) {
                await this.renderElementFromInstructions(
                    signGroup,
                    element,
                    productionItem,
                    fieldMappings
                );
            }
        } else {
            // Fallback to original layer rendering with proper bounds
            const sortedLayers = [...template.layers].sort(
                (a, b) => (a.zIndex || 0) - (b.zIndex || 0)
            );

            // Render each layer
            for (const layer of sortedLayers) {
                await this.renderLayer(signGroup, layer, productionItem, templateBounds);
            }
        }
    }

    /**
     * Render an element using enhanced rendering instructions
     */
    async renderElementFromInstructions(group, element, productionItem, fieldMappings) {
        const { type, position, size, properties, zIndex } = element;

        switch (type) {
            case 'plate':
                group
                    .rect(size.width || 100, size.height || 100)
                    .move(position.x || 0, position.y || 0)
                    .fill(properties.color || '#003366')
                    .stroke({ width: 1, color: properties.strokeColor || '#000' });
                break;

            case 'paragraph-text':
            case 'braille-text':
            case 'text':
                await this.renderTextElementFromInstructions(
                    group,
                    element,
                    productionItem,
                    fieldMappings
                );
                break;

            case 'logo':
            case 'icon':
                this.renderGraphicElementFromInstructions(group, element);
                break;

            default:
                console.warn(`Unknown element type in rendering instructions: ${type}`);
                break;
        }
    }

    /**
     * Render text element using enhanced instructions and field mappings
     */
    async renderTextElementFromInstructions(group, element, productionItem, fieldMappings) {
        const { position, size, properties } = element;
        const fieldName = properties.fieldName;

        // Get text content using field mappings or direct field access
        let textContent = '';
        if (fieldName) {
            if (fieldMappings[fieldName]) {
                // Use field mapping information for better rendering
                const mapping = fieldMappings[fieldName];
                textContent = productionItem[fieldName] || '';
            } else {
                // Direct field access
                textContent = this.getTextContentForField(fieldName, productionItem);
            }
        } else if (properties.text) {
            // Static text or template with placeholders
            textContent = this.processTextPlaceholders(properties.text, productionItem);
        }

        if (!textContent) return;

        // Use enhanced properties from instructions
        const fontSize = properties.fontSize || 24;
        const fontColor = properties.fontColor || '#ffffff';
        const fontFamily = properties.fontFamily || 'Arial, sans-serif';
        const textAlign = properties.textAlign || 'left';

        // Try text-to-path conversion if font is available
        if (this.defaultFontPath) {
            const pathData = await this.textToPath(textContent, {
                fontSize: fontSize,
                x: position.x || 0,
                y: position.y || 0
            });

            if (pathData) {
                const path = group.path(typeof pathData === 'string' ? pathData : pathData.d);
                if (pathData.transform) {
                    path.transform(pathData.transform);
                }
                path.fill(fontColor).addClass('text-path').attr('data-field', fieldName);

                // Apply alignment
                if (textAlign === 'center' && size.width) {
                    const centerX = (position.x || 0) + size.width / 2;
                    path.cx(centerX);
                }
                return;
            }
        }

        // Fallback to SVG text
        const text = group
            .text(textContent)
            .move(position.x || 0, position.y || 0)
            .font({
                family: fontFamily,
                size: fontSize,
                anchor: textAlign === 'center' ? 'middle' : textAlign,
                weight: properties.fontWeight || 'normal'
            })
            .fill(fontColor)
            .addClass('text-svg')
            .attr('data-field', fieldName);

        // Apply alignment
        if (textAlign === 'center' && size.width) {
            const centerX = (position.x || 0) + size.width / 2;
            text.cx(centerX);
        }
    }

    /**
     * Get text content for a specific field
     */
    getTextContentForField(fieldName, productionItem) {
        // Handle common field name variations
        if (fieldName === 'message' || fieldName === 'message1') {
            return productionItem.message1 || productionItem.message || '';
        } else if (fieldName === 'message2') {
            return productionItem.message2 || '';
        } else if (fieldName === 'locationNumber') {
            return productionItem.locationNumber || '';
        } else {
            return productionItem[fieldName] || '';
        }
    }

    /**
     * Process text with placeholders (e.g., "{{message}}")
     */
    processTextPlaceholders(text, productionItem) {
        return text.replace(/\{\{(\w+)\}\}/g, (match, fieldName) => {
            return this.getTextContentForField(fieldName, productionItem);
        });
    }

    /**
     * Render graphic element from instructions
     */
    renderGraphicElementFromInstructions(group, element) {
        const { position, size, properties, type } = element;

        if (type === 'logo') {
            group
                .circle(size.width || 50)
                .move(position.x || 0, position.y || 0)
                .fill(properties.color || properties.backgroundColor || '#f07727')
                .addClass('logo');
        } else {
            group
                .rect(size.width || 50, size.height || 50)
                .move(position.x || 0, position.y || 0)
                .fill(properties.color || properties.backgroundColor || '#f07727')
                .addClass('icon');
        }
    }

    /**
     * Calculate the bounds of all elements in a template
     */
    calculateTemplateBounds(template) {
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;

        const layers = template.layers || [];
        if (layers.length === 0) {
            return { minX: 0, minY: 0, maxX: 100, maxY: 50, width: 100, height: 50 };
        }

        layers.forEach(layer => {
            if (layer.x !== undefined && layer.y !== undefined) {
                minX = Math.min(minX, layer.x);
                minY = Math.min(minY, layer.y);
                maxX = Math.max(maxX, layer.x + (layer.width || 0));
                maxY = Math.max(maxY, layer.y + (layer.height || 0));
            }
        });

        // If no valid bounds found, use template dimensions
        if (minX === Infinity) {
            const templateWidth = template.width || 100;
            const templateHeight = template.height || 50;
            return {
                minX: 0,
                minY: 0,
                maxX: templateWidth,
                maxY: templateHeight,
                width: templateWidth,
                height: templateHeight
            };
        }

        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Calculate optimal scale to fill thumbnail while maintaining aspect ratio
     */
    calculateOptimalScale(bounds, targetSize) {
        const padding = targetSize * 0.05; // 5% padding
        const availableSize = targetSize - padding * 2;

        const scaleX = availableSize / bounds.width;
        const scaleY = availableSize / bounds.height;

        // Use the smaller scale to ensure everything fits
        return Math.min(scaleX, scaleY);
    }

    /**
     * Render a single layer
     */
    async renderLayer(group, layer, productionItem, templateBounds) {
        switch (layer.type) {
            case 'plate':
                group
                    .rect(
                        layer.width || templateBounds.width,
                        layer.height || templateBounds.height
                    )
                    .move(layer.x || 0, layer.y || 0)
                    .fill(layer.backgroundColor || layer.color || '#003366')
                    .stroke({ width: 1, color: '#000' });
                break;

            case 'paragraph-text':
            case 'braille-text':
            case 'text':
                await this.renderTextLayer(group, layer, productionItem);
                break;

            case 'logo':
            case 'icon':
                this.renderGraphicLayer(group, layer);
                break;
        }
    }

    /**
     * Render text layer with text-to-path conversion
     */
    async renderTextLayer(group, layer, productionItem) {
        // Get the text content - handle both static text and field references
        let textContent = '';
        if (layer.text && layer.text.includes('{{')) {
            // Handle placeholder text like "{{message}}"
            textContent = this.processTextPlaceholders(layer.text, productionItem);
        } else if (layer.fieldName) {
            // Direct field reference
            textContent = this.getTextContentForField(layer.fieldName, productionItem);
        } else if (layer.text) {
            // Static text
            textContent = layer.text;
        }

        if (!textContent) return;

        // Preserve original colors from Design Slayer
        const textColor = layer.fontColor || layer.textColor || layer.color || '#000000';
        const fontSize = layer.fontSize || 16;
        const fontFamily = layer.fontFamily || layer.font || 'Arial, sans-serif';

        // Check if we have a font path configured for text-to-path
        if (!this.defaultFontPath) {
            // No font for text-to-path - use SVG text element instead
            const text = group
                .text(textContent)
                .move(layer.x || 0, layer.y || 0)
                .font({
                    family: fontFamily,
                    size: fontSize,
                    anchor: this.getTextAnchor(layer.textAlign),
                    weight: layer.fontWeight || 'normal'
                })
                .fill(textColor)
                .addClass('text-svg')
                .attr('data-field', layer.fieldName);

            // Apply proper text alignment
            this.applyTextAlignment(text, layer);

            // Add font warning banner at the top
            this.addFontWarningBanner(group.parent());
            return;
        }

        // Try to convert text to path
        const pathData = await this.textToPath(textContent, {
            fontSize: fontSize,
            x: layer.x || 0,
            y: layer.y || 0
        });

        if (pathData) {
            // Create path element
            const path = group.path(typeof pathData === 'string' ? pathData : pathData.d);

            if (pathData.transform) {
                path.transform(pathData.transform);
            }

            path.fill(textColor).addClass('text-path').attr('data-field', layer.fieldName);

            // Apply text alignment for paths
            this.applyTextAlignment(path, layer);
        } else {
            // Font loading failed - use SVG text as fallback
            const text = group
                .text(textContent)
                .move(layer.x || 0, layer.y || 0)
                .font({
                    family: fontFamily,
                    size: fontSize,
                    anchor: this.getTextAnchor(layer.textAlign),
                    weight: layer.fontWeight || 'normal'
                })
                .fill(textColor)
                .addClass('text-svg')
                .attr('data-field', layer.fieldName);

            // Apply proper text alignment
            this.applyTextAlignment(text, layer);

            // Add font warning banner
            this.addFontWarningBanner(group.parent());
        }
    }

    /**
     * Convert Design Slayer text alignment to SVG text anchor
     */
    getTextAnchor(textAlign) {
        switch (textAlign) {
            case 'center':
                return 'middle';
            case 'right':
                return 'end';
            case 'left':
            default:
                return 'start';
        }
    }

    /**
     * Apply text alignment to SVG text or path elements
     */
    applyTextAlignment(element, layer) {
        const textAlign = layer.textAlign || 'left';
        const verticalAlign = layer.verticalAlign || 'top';

        if (textAlign === 'center' && layer.width) {
            const centerX = (layer.x || 0) + layer.width / 2;
            element.cx(centerX);
        } else if (textAlign === 'right' && layer.width) {
            const rightX = (layer.x || 0) + layer.width;
            element.x(rightX);
        }

        // Handle vertical alignment
        if (verticalAlign === 'middle' && layer.height) {
            const centerY = (layer.y || 0) + layer.height / 2;
            element.cy(centerY);
        } else if (verticalAlign === 'bottom' && layer.height) {
            const bottomY = (layer.y || 0) + layer.height;
            element.y(bottomY);
        }
    }

    /**
     * Add font warning banner at top of sign
     */
    addFontWarningBanner(svg) {
        // Check if banner already exists
        if (svg.findOne('.font-warning-banner')) return;

        // Get SVG dimensions
        const viewbox = svg.viewbox();
        const width = viewbox.width;
        const bannerHeight = width * 0.08;

        // Create banner group at the top
        const bannerGroup = svg.group().addClass('font-warning-banner');

        // Red background banner
        bannerGroup.rect(width, bannerHeight).fill('#ff0000').opacity(0.9);

        // Warning text
        bannerGroup
            .text('FONT NOT FOUND')
            .move(width / 2, bannerHeight / 2)
            .font({
                family: 'monospace',
                size: bannerHeight * 0.6,
                anchor: 'middle',
                weight: 'bold'
            })
            .fill('#ffffff')
            .dy(-bannerHeight * 0.1); // Adjust vertical centering

        // Move banner to front
        bannerGroup.front();
    }

    /**
     * Render graphic layer (logo/icon)
     */
    renderGraphicLayer(group, layer) {
        // For now, render as a colored circle or rectangle
        if (layer.type === 'logo') {
            group
                .circle(layer.width || 50)
                .move(layer.x || 0, layer.y || 0)
                .fill(layer.backgroundColor || '#f07727')
                .addClass('logo');
        } else {
            group
                .rect(layer.width || 50, layer.height || 50)
                .move(layer.x || 0, layer.y || 0)
                .fill(layer.backgroundColor || '#f07727')
                .addClass('icon');
        }
    }

    /**
     * Render intelligent generic sign (no template) based on sign type characteristics
     */
    async renderGenericSign(draw, productionItem, size) {
        // Background
        draw.rect(size, size).fill('#f0f0f0');

        // Determine colors and layout based on marker type
        const markerType = productionItem.markerType || productionItem.signType || 'default';
        const signTypeCode = productionItem.signTypeCode || productionItem.signType;
        const colors = this.getMarkerTypeColors(markerType);
        const layout = this.getSignTypeLayout(signTypeCode, markerType);

        // Add template suggestion banner if we have sign type info
        if (signTypeCode) {
            this.addTemplateSuggestionBanner(draw, signTypeCode, size);
        }

        // Main sign plate with intelligent sizing
        const plateWidth = size * layout.plateWidthRatio;
        const plateHeight = size * layout.plateHeightRatio;
        const plateX = (size - plateWidth) / 2;
        const plateY = size * layout.plateYPosition;

        draw.rect(plateWidth, plateHeight)
            .move(plateX, plateY)
            .fill(colors.background)
            .stroke({ width: 2, color: colors.border })
            .radius(size * 0.02);

        // Add text
        const textColor = this.getContrastColor(colors.background);
        const fontSize = size * 0.08;
        let needsFontWarning = false;

        // Check if font is available for text-to-path
        if (!this.defaultFontPath) {
            // No font for text-to-path - use SVG text elements
            needsFontWarning = true;

            // Message 1
            if (productionItem.message1 || productionItem.message) {
                const text1 = productionItem.message1 || productionItem.message;
                draw.text(text1)
                    .move(size / 2, plateY + plateHeight * 0.35)
                    .font({
                        family: 'Arial, sans-serif',
                        size: fontSize,
                        anchor: 'middle',
                        weight: 'normal'
                    })
                    .fill(textColor);
            }

            // Message 2
            if (productionItem.message2) {
                draw.text(productionItem.message2)
                    .move(size / 2, plateY + plateHeight * 0.65)
                    .font({
                        family: 'Arial, sans-serif',
                        size: fontSize * 0.8,
                        anchor: 'middle',
                        weight: 'normal'
                    })
                    .fill(textColor);
            }
        } else {
            // Try text-to-path conversion
            // Message 1
            if (productionItem.message1 || productionItem.message) {
                const text1 = productionItem.message1 || productionItem.message;
                const pathData = await this.textToPath(text1, {
                    fontSize: fontSize,
                    x: size / 2,
                    y: plateY + plateHeight * 0.35
                });

                if (pathData) {
                    const path = draw.path(typeof pathData === 'string' ? pathData : pathData.d);
                    if (pathData.transform) {
                        path.transform(pathData.transform);
                    }
                    path.fill(textColor).cx(size / 2);
                } else {
                    // Font loading failed - use SVG text
                    needsFontWarning = true;
                    draw.text(text1)
                        .move(size / 2, plateY + plateHeight * 0.35)
                        .font({ family: 'Arial, sans-serif', size: fontSize, anchor: 'middle' })
                        .fill(textColor);
                }
            }

            // Message 2
            if (productionItem.message2) {
                const pathData = await this.textToPath(productionItem.message2, {
                    fontSize: fontSize * 0.8,
                    x: size / 2,
                    y: plateY + plateHeight * 0.65
                });

                if (pathData) {
                    const path = draw.path(typeof pathData === 'string' ? pathData : pathData.d);
                    if (pathData.transform) {
                        path.transform(pathData.transform);
                    }
                    path.fill(textColor).cx(size / 2);
                } else {
                    // Font loading failed - use SVG text
                    needsFontWarning = true;
                    draw.text(productionItem.message2)
                        .move(size / 2, plateY + plateHeight * 0.65)
                        .font({
                            family: 'Arial, sans-serif',
                            size: fontSize * 0.8,
                            anchor: 'middle'
                        })
                        .fill(textColor);
                }
            }
        }

        // Add location number in corner
        if (productionItem.locationNumber) {
            draw.text(productionItem.locationNumber)
                .move(size * 0.02, size * 0.02)
                .font({ family: 'Arial', size: size * 0.04 })
                .fill('#666');
        }

        // Add font warning banner if needed
        if (needsFontWarning) {
            this.addFontWarningBanner(draw);
        }
    }

    /**
     * Get colors for marker type
     */
    getMarkerTypeColors(markerType) {
        const colorMap = {
            'room-id': { background: '#003366', border: '#002244' },
            office: { background: '#4ECDC4', border: '#3BA99F' },
            utility: { background: '#95E77E', border: '#76B865' },
            emergency: { background: '#FFD93D', border: '#E6C230' },
            directional: { background: '#A8E6CF', border: '#8BC4AD' },
            default: { background: '#F07727', border: '#D85E15' }
        };

        return colorMap[markerType] || colorMap.default;
    }

    /**
     * Get intelligent layout for sign type
     */
    getSignTypeLayout(signTypeCode, markerType) {
        // Different sign types have different typical proportions and layouts
        const layouts = {
            'room-id': {
                plateWidthRatio: 0.85,
                plateHeightRatio: 0.4,
                plateYPosition: 0.3,
                textLayout: 'centered'
            },
            directional: {
                plateWidthRatio: 0.9,
                plateHeightRatio: 0.3,
                plateYPosition: 0.35,
                textLayout: 'left-aligned'
            },
            emergency: {
                plateWidthRatio: 0.8,
                plateHeightRatio: 0.35,
                plateYPosition: 0.32,
                textLayout: 'bold-centered'
            },
            default: {
                plateWidthRatio: 0.9,
                plateHeightRatio: 0.5,
                plateYPosition: 0.25,
                textLayout: 'centered'
            }
        };

        return layouts[markerType] || layouts.default;
    }

    /**
     * Add template suggestion banner to encourage template creation
     */
    addTemplateSuggestionBanner(svg, signTypeCode, size) {
        // Add a subtle banner suggesting template creation
        const bannerHeight = size * 0.12;
        const bannerGroup = svg.group().addClass('template-suggestion-banner');

        // Orange/yellow background banner at bottom
        bannerGroup
            .rect(size, bannerHeight)
            .move(0, size - bannerHeight)
            .fill('#FF8C00')
            .opacity(0.9);

        // Suggestion text
        bannerGroup
            .text(`Create template for "${signTypeCode}"`)
            .move(size / 2, size - bannerHeight / 2)
            .font({
                family: 'Arial, sans-serif',
                size: bannerHeight * 0.25,
                anchor: 'middle',
                weight: 'bold'
            })
            .fill('#ffffff')
            .dy(-bannerHeight * 0.05); // Adjust vertical centering

        // Add small icon
        const iconSize = bannerHeight * 0.4;
        bannerGroup
            .circle(iconSize)
            .move(size * 0.1, size - bannerHeight + (bannerHeight - iconSize) / 2)
            .fill('#ffffff')
            .opacity(0.8);

        bannerGroup
            .text('⚡')
            .move(size * 0.1 + iconSize / 2, size - bannerHeight / 2)
            .font({
                family: 'Arial, sans-serif',
                size: iconSize * 0.6,
                anchor: 'middle'
            })
            .fill('#FF8C00')
            .dy(-iconSize * 0.1);
    }

    /**
     * Get contrasting text color
     */
    getContrastColor(backgroundColor) {
        // Simple contrast calculation
        const rgb = this.hexToRgb(backgroundColor);
        if (!rgb) return '#000000';

        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        return brightness > 128 ? '#000000' : '#ffffff';
    }

    /**
     * Convert hex to RGB
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result
            ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            }
            : null;
    }

    /**
     * Clear caches (useful for memory management)
     */
    clearCaches() {
        this.pathCache.clear();
        // Keep font cache as fonts are expensive to load
    }
}

// Export singleton instance
export const svgSignRenderer = new SVGSignRenderer();

// Also export the render function for backward compatibility
export async function renderSignThumbnailSVG(productionItem, size = 200) {
    return svgSignRenderer.renderSignThumbnail(productionItem, size);
}

/**
 * Convert SVG element to data URL
 */
export function svgToDataURL(svgElement) {
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgElement);
    const encodedData = btoa(unescape(encodeURIComponent(svgString)));
    return `data:image/svg+xml;base64,${encodedData}`;
}

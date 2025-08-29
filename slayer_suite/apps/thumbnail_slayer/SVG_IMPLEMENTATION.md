# SVG Implementation Guide - Thumbnail Slayer

## Overview

This document details the SVG implementation for Thumbnail Slayer, focusing on creating crisp, scalable thumbnails that can be used for production.

## Current State (Canvas-based)

- Uses `sign-renderer.js` with Canvas 2D API
- Renders at fixed pixel size (blurry when scaled)
- No path export capability
- Text rendered as pixels

## Target State (SVG-based)

- SVG.js for rendering
- OpenType.js for text-to-path conversion
- Infinitely scalable without blur
- Export-ready paths for production

## Implementation Plan

### Phase 1: Setup and Basic Rendering

#### 1.1 Add Dependencies

```javascript
// Libraries to add:
// - svg.js (3.2.0) - SVG manipulation
// - opentype.js (1.3.4) - Text to path conversion

// Installation:
// npm install @svgdotjs/svg.js opentype.js
```

#### 1.2 Create New SVG Renderer

File: `apps/thumbnail_slayer/sign-renderer-svg.js`

```javascript
// Structure:
export class SVGSignRenderer {
    constructor() {
        this.fontCache = new Map(); // Cache loaded fonts
        this.pathCache = new Map(); // Cache text-to-path results
    }

    async renderSignThumbnail(item, container, size) {
        // 1. Create SVG canvas
        // 2. Draw background/plate
        // 3. Add text as paths
        // 4. Add graphics/logos
        // 5. Return SVG element
    }

    async loadFont(fontName) {
        // Load and cache OpenType font
    }

    async textToPath(text, font, size) {
        // Convert text to SVG path
    }
}
```

### Phase 2: Text-to-Path Implementation

#### Key Considerations

1. **Font Loading**
    - Store fonts in `/assets/fonts/`
    - Load with OpenType.js
    - Cache loaded fonts

2. **Path Conversion**

    ```javascript
    // Example approach:
    const font = await opentype.load('path/to/font.ttf');
    const path = font.getPath(text, x, y, fontSize);
    const svgPath = path.toPathData(); // SVG path string
    ```

3. **Text Positioning**
    - Maintain exact positioning from templates
    - Handle text-anchor (left, center, right)
    - Preserve line height and spacing

### Phase 3: Template Integration

#### Template Processing Flow

```javascript
// 1. Receive template from Design Slayer
if (template.svgTemplate) {
  // Use SVG template directly
  const svg = SVG(template.svgTemplate);
} else {
  // Convert canvas template to SVG
  const svg = convertCanvasTemplateToSVG(template);
}

// 2. Replace placeholders
svg.find('text').forEach(textElement => {
  const content = textElement.text();
  if (content.includes('{{message1}}')) {
    const path = await textToPath(item.message1, font, size);
    textElement.replace(SVG.path(path));
  }
});

// 3. Apply sign-specific data
updateSVGWithSignData(svg, item);
```

### Phase 4: Performance Optimization

#### Caching Strategy

```javascript
class PathCache {
    constructor() {
        this.cache = new Map();
        this.maxSize = 1000; // Limit cache size
    }

    getKey(text, fontName, fontSize) {
        return `${fontName}:${fontSize}:${text}`;
    }

    get(text, fontName, fontSize) {
        const key = this.getKey(text, fontName, fontSize);
        return this.cache.get(key);
    }

    set(text, fontName, fontSize, path) {
        const key = this.getKey(text, fontName, fontSize);

        // LRU eviction if needed
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, path);
    }
}
```

#### Viewport Optimization

- Only render visible thumbnails
- Use Intersection Observer
- Lazy load as user scrolls

### Phase 5: Export Capabilities

#### SVG Export

```javascript
function exportSVG(signItem) {
    const svg = renderSignToSVG(signItem);

    // Add metadata
    svg.attr('data-sign-id', signItem.id);
    svg.attr('data-location', signItem.locationNumber);

    // Clean for production
    svg.find('.preview-only').remove();

    return svg.svg(); // Returns SVG string
}
```

#### Path Extraction

```javascript
function extractPaths(svg) {
    return {
        outline: svg.find('#plate').first()?.toPath(),
        text: svg.find('.text-path').map(el => el.toPath()),
        graphics: svg.find('.graphic-path').map(el => el.toPath())
    };
}
```

## Testing Strategy

### Visual Tests

1. **Crispness Test**
    - Render at multiple zoom levels
    - Compare with canvas version
    - Check text clarity

2. **Accuracy Test**
    - Verify text positioning matches template
    - Check color accuracy
    - Validate dimensions

### Performance Tests

1. **Render Speed**
    - Target: <50ms per thumbnail
    - Test with 100+ signs
    - Measure initial and cached renders

2. **Memory Usage**
    - Monitor DOM node count
    - Check cache memory usage
    - Test cleanup on navigation

### Production Tests

1. **Path Validity**
    - Export paths and validate structure
    - Check for unclosed paths
    - Verify path simplification

## Rollback Plan

### Feature Flag Implementation

```javascript
// config.js
export const config = {
    renderer: 'svg', // 'canvas' | 'svg'
    enablePathCache: true,
    enableViewportOptimization: true
};

// sign-renderer-factory.js
export function createRenderer() {
    if (config.renderer === 'svg') {
        return new SVGSignRenderer();
    } else {
        return new CanvasSignRenderer();
    }
}
```

### Gradual Rollout

1. Add toggle in UI for testing
2. Default to canvas initially
3. Switch to SVG after validation
4. Remove canvas after stability period

## Known Challenges

### Font Licensing

- Ensure fonts allow path conversion
- Consider web font alternatives
- May need font subsetting

### Browser Differences

- Test across Chrome, Firefox, Safari
- Check SVG rendering consistency
- Validate path generation

### Performance Limits

- SVG slower with many elements
- DOM manipulation overhead
- Consider canvas fallback for complex scenes

## Success Metrics

### Must Have

- [ ] Thumbnails are crisp at all zoom levels
- [ ] Text converts accurately to paths
- [ ] All sign types render correctly
- [ ] Performance acceptable (<100ms render)

### Nice to Have

- [ ] Smaller file sizes than PNG exports
- [ ] Animated transitions
- [ ] Direct clipboard copy as SVG
- [ ] Batch export functionality

## Migration Checklist

### Before Starting

- [ ] Backup current implementation
- [ ] Set up feature flags
- [ ] Install dependencies
- [ ] Create test dataset

### During Implementation

- [ ] Create SVG renderer alongside canvas
- [ ] Implement text-to-path
- [ ] Add caching layer
- [ ] Create comparison view

### Before Launch

- [ ] Test all sign types
- [ ] Validate export formats
- [ ] Performance testing
- [ ] User acceptance testing

### After Launch

- [ ] Monitor performance metrics
- [ ] Gather user feedback
- [ ] Fix edge cases
- [ ] Remove canvas code (after stability)

## Code Examples

### Basic SVG Thumbnail

```javascript
import { SVG } from '@svgdotjs/svg.js';
import opentype from 'opentype.js';

async function createSVGThumbnail(item, size = 400) {
    // Create SVG canvas
    const draw = SVG().size(size, size);

    // Add background
    draw.rect(size, size).fill('#ffffff');

    // Add plate
    const plateSize = size * 0.8;
    const plate = draw
        .rect(plateSize, plateSize / 2)
        .fill('#003366')
        .move(size * 0.1, size * 0.25);

    // Load font
    const font = await opentype.load('/fonts/Arial.ttf');

    // Add text as path
    if (item.message1) {
        const textPath = font.getPath(
            item.message1,
            size / 2, // x position
            size * 0.4, // y position
            size / 10 // font size
        );

        draw.path(textPath.toPathData())
            .fill('#ffffff')
            .center(size / 2, size * 0.4);
    }

    return draw.node;
}
```

## Resources

- [SVG.js Documentation](https://svgjs.dev/docs/3.0/)
- [OpenType.js Documentation](https://opentype.js.org/)
- [SVG Path Specification](https://www.w3.org/TR/SVG/paths.html)
- [Web Fonts and Licensing](https://www.fontsquirrel.com/license)

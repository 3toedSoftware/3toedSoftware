# Mapping Slayer - Implementation & Fix Plan (Updated)

## Overview

This document outlines how to fix the current mapping_slayer implementation to match the original's functionality while maintaining integration with the Slayer Suite.

## Current Understanding

- Style.css exists in shared folder - no need to create
- MSLogo.svg has been added
- Header elements intentionally removed for unified suite header
- Find/Replace correctly moved to map area
- Save/Load handled by suite framework
- File name display intentionally removed

## Critical Issues to Fix

### 1. Terminology Inconsistency (HIGHEST PRIORITY)

The current version uses "signTypes" while original uses "markerTypes". This creates bugs throughout:

- State management expects different property names
- UI elements reference wrong variables
- Event handlers fail to update correct state
- Functions looking for wrong property names

**Decision**: Revert to "markerTypes" terminology to match original

**Files affected:**

- state.js (signTypes → markerTypes, activeSignType → activeMarkerType, etc.)
- ui.js (all references)
- mapping-app.js (all references)
- All other JS files with references

### 2. Missing State Properties

Current state.js is missing critical properties from original:

```javascript
// Missing from current implementation:
messagesVisible: false,
messages2Visible: false,
locationsVisible: true,
searchResults: [],
currentSearchIndex: -1,
replaceText: '',
replaceMatches: [],
editingDot: null,
pdfRenderTask: null,
sourcePdfBuffer: null,
// and several others
```

### 3. Feature Implementation Gaps

#### Automap System

- Search functionality not properly connected
- Progress modal missing implementation
- Recent searches not persisted
- Activity feed not updating

#### Export System

- PDF export chunking not implemented
- BAX export character sanitization missing
- CSV import/export broken
- Detail pages generation missing

#### Scraping System

- OCR integration missing
- Training mode UI not connected
- Tolerance controls not functioning
- Clustering algorithm not working

### 4. Event Handler Issues

Many event handlers are not properly connected or are looking for wrong element IDs due to ES6 conversion.

### 5. UI Functionality Problems

#### Missing Working Features:

- Dot collision detection
- Viewport virtualization for performance
- Undo/Redo system not connected
- Keyboard shortcuts not working
- Context menus missing

#### Broken Interactions:

- Multi-select box not working
- Drag and drop not functioning
- Zoom controls not smooth
- Pan functionality issues

## Implementation Steps

### Phase 1: Critical Terminology Fix (Day 1)

1. **Global find/replace signTypes → markerTypes**
    - state.js: all instances
    - ui.js: all instances
    - mapping-app.js: all instances
    - Any other files with references

2. **Fix all related property names:**
    - activeSignType → activeMarkerType
    - expandedSignTypes → expandedMarkerTypes
    - newProjectSignTypes → newProjectMarkerTypes
    - etc.

3. **Update all function names:**
    - updateSignTypesList → updateMarkerTypesList
    - addSignType → addMarkerType
    - etc.

### Phase 2: State Management Restoration (Day 1-2)

1. **Add all missing state properties**
2. **Ensure state initialization matches original**
3. **Fix state update flows**
4. **Connect state to UI updates properly**

### Phase 3: Core Functionality (Day 2-3)

1. **Fix event handlers and listeners**
2. **Restore viewport virtualization**
3. **Implement collision detection**
4. **Fix drag/pan/zoom interactions**
5. **Connect Undo/Redo system**

### Phase 4: Feature Restoration (Day 3-4)

1. **Automap functionality**
    - Text search in PDF
    - Clustering algorithm
    - Progress tracking
    - Recent searches

2. **Export systems**
    - PDF with detail pages
    - CSV import/export
    - BAX export with sanitization

3. **Scraping features**
    - Visual text selection
    - OCR mode
    - Training interface
    - Tolerance controls

### Phase 5: Polish & Testing (Day 4-5)

1. **Performance optimization**
2. **Browser compatibility testing**
3. **Edge case handling**
4. **Final bug fixes**

## Key Functions to Verify/Fix

### 1. Core Dot Management

```javascript
// These must work exactly like original:
addDot(x, y, markerType);
updateDot(dot, updates);
deleteDot(dot);
selectDot(dot);
checkCollision(x, y, excludeDot);
```

### 2. State Management

```javascript
// Proper state updates with UI sync:
updateMarkerType(code, updates);
setActiveMarkerType(code);
updateDotsByPage(pageNum, dots);
setDirtyState(isDirty);
```

### 3. Viewport Management

```javascript
// Performance-critical functions:
getVisibleDots();
renderVisibleDots();
updateViewport();
handleZoom(delta);
handlePan(dx, dy);
```

## Testing Checklist

### Basic Functionality

- [ ] PDF loads and displays correctly
- [ ] Can add dots of different marker types
- [ ] Dots show correct colors and labels
- [ ] Can select single dot
- [ ] Can multi-select dots
- [ ] Can edit dot properties
- [ ] Can delete dots
- [ ] Collision detection prevents overlap
- [ ] Undo/Redo works for all operations

### UI Interactions

- [ ] Left-click adds dot
- [ ] Right-click opens context menu
- [ ] Shift+drag creates selection box
- [ ] Middle-click+drag pans view
- [ ] Scroll wheel zooms properly
- [ ] Keyboard shortcuts work
- [ ] All modals open/close correctly
- [ ] Tooltips display on hover

### Advanced Features

- [ ] Automap finds text and places dots
- [ ] Scraping selects text regions
- [ ] OCR mode extracts text from images
- [ ] Training mode calculates tolerances
- [ ] Renumbering works (all 4 modes)
- [ ] Find/Replace functions correctly
- [ ] Location list updates properly
- [ ] Page navigation works

### Export/Import

- [ ] Save project creates .mslay file
- [ ] Load project restores all data
- [ ] Export PDF - current map with details
- [ ] Export PDF - current map only
- [ ] Export PDF - all maps
- [ ] Export to CSV works
- [ ] Import from CSV updates dots
- [ ] Export to BAX (with character sanitization)

### Performance

- [ ] 1000+ dots render smoothly
- [ ] Viewport virtualization active
- [ ] No memory leaks
- [ ] Zoom/pan responsive
- [ ] Large PDF files load quickly

## Success Criteria

The implementation is complete when:

1. All original features work identically
2. No console errors or warnings
3. Performance matches original
4. All interactions feel smooth
5. Integration with suite is seamless
6. Terminology is consistent throughout

## Notes

- Maintain ES6 module structure throughout
- Keep SlayerAppBase integration
- Use existing suite utilities where possible
- Don't recreate suite-level features (header, save/load, etc.)

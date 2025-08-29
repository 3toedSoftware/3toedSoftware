# Mapping Slayer Test Checklist

## Initial Setup

- [ ] Open index.html in browser
- [ ] Navigate to Mapping Slayer app
- [ ] Verify app loads without console errors

## PDF Loading

- [ ] Click upload area or drag & drop a PDF
- [ ] Verify PDF renders on canvas
- [ ] Check that page navigation shows correct page info

## Marker Types

- [ ] Check default "NEW" marker type exists
- [ ] Click "+" to add new marker type
- [ ] Edit marker type code and name
- [ ] Change marker type colors (both dot and text)
- [ ] Delete a marker type
- [ ] Verify active marker type is highlighted

## Dot Creation & Management

- [ ] Left-click on map to add dot
- [ ] Verify dot appears with correct marker type
- [ ] Right-click dot to open edit modal
- [ ] Edit dot properties (message, location number, etc.)
- [ ] Delete dot from edit modal
- [ ] Test multi-select with Shift+click and drag

## Navigation & View Controls

- [ ] Test page navigation (prev/next buttons)
- [ ] Add page labels
- [ ] Toggle message visibility (MSG, MSG2, LOC buttons)
- [ ] Test zoom with mouse wheel
- [ ] Test pan with middle-click drag
- [ ] Resize dots with DOT SIZE slider

## Lists & Filters

- [ ] Check location list updates when dots are added
- [ ] Toggle between flat and grouped view
- [ ] Sort by location vs name
- [ ] Test "All Pages" checkbox
- [ ] Uncheck marker type filters to hide dots
- [ ] Edit dot messages inline in list

## Search & Replace

- [ ] Use Find to search for text in messages
- [ ] Navigate through search results
- [ ] Test Replace functionality
- [ ] Verify Find All highlights all matches

## Automap

- [ ] Enter search text
- [ ] Select marker type
- [ ] Click "AUTOMAP IT!"
- [ ] Verify progress modal appears
- [ ] Check dots are created at text locations
- [ ] Test with "Exact Phrase" on/off

## Scraping

- [ ] Shift+right-drag to select text area
- [ ] Verify dots created from scraped text
- [ ] Adjust H/V tolerance values
- [ ] Test OCR mode (Ctrl+Shift+right-drag)

## Export Functions

- [ ] Create PDF - test all three modes:
    - Current Map with Details
    - Current Map Only
    - All Maps Only
- [ ] Create Message Schedule (CSV)
- [ ] Update from Message Schedule (CSV import)
- [ ] Export Revu Markups (BAX)

## Project Management

- [ ] Save project (.mslay file)
- [ ] Load saved project
- [ ] Verify all data restored correctly

## Advanced Features

- [ ] Test Undo/Redo (Ctrl+Z/Y)
- [ ] Renumber dots (all 4 modes)
- [ ] Copy/paste dots
- [ ] Test collision detection
- [ ] Verify legends update correctly

## Performance

- [ ] Add 100+ dots
- [ ] Test smooth pan/zoom
- [ ] Verify viewport virtualization working

## Edge Cases

- [ ] Load PDF with no text
- [ ] Test with very large PDF
- [ ] Add dots on all pages
- [ ] Test with special characters in messages

## Console Check

- [ ] No errors during normal operation
- [ ] Proper error messages for failures
- [ ] Performance warnings if any

## Known Issues to Verify Fixed

- [x] Terminology: signTypes → markerTypes
- [x] State properties added
- [x] Event listeners connected
- [x] Export functions available
- [x] Automap functionality
- [x] Tolerance inputs initialized

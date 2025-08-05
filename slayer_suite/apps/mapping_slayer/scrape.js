// scrape.js

import { appState, getCurrentPageDots, UndoManager } from './state.js';
import { showCSVStatus, addDotToData, isCollision, updateAllSectionsForCurrentPage } from './ui.js';
import { renderDotsForCurrentPage } from './map-controller.js';
import { clusterTextItems } from './automap.js';

function preventContextMenu(e) {
    if (appState.isScraping || appState.isTrainingScrape) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
}

function updateToleranceInputs() {
    const hInput = document.getElementById('h-tolerance-input');
    const vInput = document.getElementById('v-tolerance-input');
    
    if (hInput && vInput) {
        hInput.value = appState.scrapeHorizontalTolerance.toFixed(1);
        vInput.value = appState.scrapeVerticalTolerance.toFixed(1);
    }
}

function groupTextIntoLines(textItems) {
    if (textItems.length === 0) return [];
    
    const VERTICAL_TOLERANCE = 5; // pixels
    const lines = [];
    
    // Sort by Y position first - now using canvas coordinates
    const sortedItems = [...textItems].sort((a, b) => a.y - b.y);
    
    for (const item of sortedItems) {
        let addedToLine = false;
        
        // Try to add to existing line
        for (const line of lines) {
            const lineY = line[0].y;
            if (Math.abs(item.y - lineY) <= VERTICAL_TOLERANCE) {
                line.push(item);
                addedToLine = true;
                break;
            }
        }
        
        // Create new line if not added to existing one
        if (!addedToLine) {
            lines.push([item]);
        }
    }
    
    return lines;
}

async function finishScrape() {
    console.log('🔍 SCRAPE START: finishScrape() called');
    if (!appState.scrapeBox) return;

    showCSVStatus("Scraping, please wait...", true, 20000);

    try {
        const boxRect = appState.scrapeBox.getBoundingClientRect();
        const mapRect = document.getElementById('map-container').getBoundingClientRect();
        const { x: mapX, y: mapY, scale } = appState.mapTransform;
        const canvasX1 = (boxRect.left - mapRect.left - mapX) / scale; 
        const canvasY1 = (boxRect.top - mapRect.top - mapY) / scale;
        const canvasX2 = (boxRect.right - mapRect.left - mapX) / scale; 
        const canvasY2 = (boxRect.bottom - mapRect.top - mapY) / scale;
        const boxLeft = Math.min(canvasX1, canvasX2); 
        const boxTop = Math.min(canvasY1, canvasY2);
        const boxRight = Math.max(canvasX1, canvasX2); 
        const boxBottom = Math.max(canvasY1, canvasY2);
        
        // Remove scrape box immediately so user knows we're processing
        appState.scrapeBox.remove();
        appState.scrapeBox = null;
        appState.isScraping = false;
        document.removeEventListener('contextmenu', preventContextMenu);
        
        showCSVStatus("Loading page text...", true, 20000);
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const page = await appState.pdfDoc.getPage(appState.currentPdfPage);
        const viewport = page.getViewport({ scale: appState.pdfScale });
        const textContent = await page.getTextContent();
        
        showCSVStatus("Processing text items...", true, 20000);
        await new Promise(resolve => setTimeout(resolve, 10));
        
        const capturedTextItems = [];
        const BATCH_SIZE = 100;
        
        for (let i = 0; i < textContent.items.length; i += BATCH_SIZE) {
            const batch = textContent.items.slice(i, i + BATCH_SIZE);
            
            for (const item of batch) {
                const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
                if (x >= boxLeft && x <= boxRight && y >= boxTop && y <= boxBottom) {
                    const text = item.str.trim();
                    if (text.length > 0 && item.height > 0) {
                        capturedTextItems.push({
                            x: x, y: y, width: item.width * viewport.scale, height: item.height * viewport.scale, text: text
                        });
                    }
                }
            }
            
            if (i % BATCH_SIZE === 0) {
                const progress = Math.round((i / textContent.items.length) * 50);
                showCSVStatus(`Processing text items: ${i}/${textContent.items.length}`, true, 20000);
                await new Promise(resolve => setTimeout(resolve, 5));
            }
        }

        console.log('🔍 TEXT ITEMS: Found', capturedTextItems.length, 'text items');
        if (capturedTextItems.length > 0) {
            showCSVStatus("Clustering text...", true, 20000);
            await new Promise(resolve => setTimeout(resolve, 10));
            
            const clusters = clusterTextItems(capturedTextItems);
            console.log('🔍 CLUSTER SNIFFER: Found', clusters.length, 'clusters');
            console.log('🔍 Clusters:', clusters.map(c => c.text));
            
            showCSVStatus("Adding dots to data...", true, 20000);
            await new Promise(resolve => setTimeout(resolve, 10));

            if (clusters.length === 1) {
                console.log('🔍 SCRAPE SNIFFER: Single cluster detected');
                const cluster = clusters[0];
                const message = cluster.items.map(item => item.text).join(' ').trim();
                console.log('🔍 Message:', message);
                console.log('🔍 Checking collision at:', cluster.centerX, cluster.centerY);
                
                if (!isCollision(cluster.centerX, cluster.centerY)) {
                    console.log('🔍 No collision, proceeding with Command Pattern');
                    console.log('🔍 Dots before command:', getCurrentPageDots().size);
                    
                    // Use Command Pattern for single dot too
                    const { CommandUndoManager, AddDotCommand } = await import('./command-undo.js');
                    const { createDotObject } = await import('./ui.js');
                    
                    const dot = createDotObject(cluster.centerX, cluster.centerY, appState.activeMarkerType, message);
                    if (dot) {
                        const command = new AddDotCommand(appState.currentPdfPage, dot);
                        await CommandUndoManager.execute(command);
                    }
                    
                    console.log('🔍 Dots after command:', getCurrentPageDots().size);
                    showCSVStatus("Rendering dots...", true, 20000);
                    
                    await renderDotsForCurrentPage(true);
                    console.log('🔍 After renderDotsForCurrentPage, DOM dots:', document.querySelectorAll('.ms-map-dot').length);
                    
                    updateAllSectionsForCurrentPage();
                    console.log('🔍 After updateAllSectionsForCurrentPage, list items:', document.querySelectorAll('.ms-location-item, .ms-grouped-location-item').length);
                    
                    showCSVStatus(`✅ Scraped: "${message}"`, true, 3000);
                    console.log('🔍 Single dot scrape complete');
                } else {
                    console.log('🔍 Collision detected, skipping');
                    showCSVStatus("❌ Collision detected", false, 4000);
                }
            } else {
                const dotsToAdd = [];
                clusters.forEach(cluster => {
                    const message = cluster.items.map(item => item.text).join(' ').trim();
                    if (message.length > 0 && !isCollision(cluster.centerX, cluster.centerY)) {
                        dotsToAdd.push({
                            x: cluster.centerX, 
                            y: cluster.centerY, 
                            message: message
                        });
                    }
                });
                
                if (dotsToAdd.length > 0) {
                    // Use Command Pattern for multiple dots
                    const { CommandUndoManager, CompositeCommand, AddDotCommand } = await import('./command-undo.js');
                    const { createDotObject } = await import('./ui.js');
                    
                    const compositeCommand = new CompositeCommand(`Scrape ${dotsToAdd.length} locations`);
                    
                    dotsToAdd.forEach(dotInfo => {
                        const dot = createDotObject(dotInfo.x, dotInfo.y, appState.activeMarkerType, dotInfo.message);
                        if (dot) {
                            const addCommand = new AddDotCommand(appState.currentPdfPage, dot);
                            compositeCommand.add(addCommand);
                        }
                    });
                    
                    if (compositeCommand.commands.length > 0) {
                        await CommandUndoManager.execute(compositeCommand);
                    }
                    
                    showCSVStatus("Rendering dots...", true, 20000);
                    await renderDotsForCurrentPage(true);
                    updateAllSectionsForCurrentPage();
                    
                    showCSVStatus(`✅ Scraped ${dotsToAdd.length} locations`, true, 3000);
                } else if (clusters.length > 0) {
                    showCSVStatus("❌ No valid locations found (all collided)", false, 4000);
                } else {
                    showCSVStatus("❌ No text clusters found in selection", false, 4000);
                }
            }
        } else {
            showCSVStatus("❌ No Live Text Found", false, 4000);
        }
    } catch (error) {
        console.error("Scrape operation failed:", error);
        showCSVStatus("❌ An error occurred during scrape.", false, 4000);
    } finally {
        if (appState.scrapeBox) {
            appState.scrapeBox.remove();
            appState.scrapeBox = null;
        }
        appState.isScraping = false;
        document.removeEventListener('contextmenu', preventContextMenu);
    }
}

async function finishOCRScrape() {
    if (!appState.scrapeBox) return;

    const boxRect = appState.scrapeBox.getBoundingClientRect();
    appState.scrapeBox.remove();
    appState.scrapeBox = null;
    appState.isScraping = false;
    document.removeEventListener('contextmenu', preventContextMenu);

    showCSVStatus("Starting OCR Scan...", true, 20000);

    try {
        const mapRect = document.getElementById('map-container').getBoundingClientRect();
        const { x: mapX, y: mapY, scale } = appState.mapTransform;
        
        const canvasX1 = (boxRect.left - mapRect.left - mapX) / scale;
        const canvasY1 = (boxRect.top - mapRect.top - mapY) / scale;
        const canvasX2 = (boxRect.right - mapRect.left - mapX) / scale;
        const canvasY2 = (boxRect.bottom - mapRect.top - mapY) / scale;
        
        const canvas = document.getElementById('pdf-canvas');
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        const width = Math.abs(canvasX2 - canvasX1);
        const height = Math.abs(canvasY2 - canvasY1);
        tempCanvas.width = width;
        tempCanvas.height = height;
        
        tempCtx.drawImage(canvas, 
            Math.min(canvasX1, canvasX2), Math.min(canvasY1, canvasY2), width, height,
            0, 0, width, height
        );
        
        const { data: { text } } = await Tesseract.recognize(tempCanvas, 'eng', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    const progress = Math.round(m.progress * 100);
                    showCSVStatus(`OCR SCANNING: ${progress}%`, true, 20000);
                }
            }
        });
        
        const cleanText = text.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ');
        
        if (cleanText.length > 0) {
            const centerX = (Math.min(canvasX1, canvasX2) + width / 2);
            const centerY = (Math.min(canvasY1, canvasY2) + height / 2);
            
            if (!isCollision(centerX, centerY)) {
                addDotToData(centerX, centerY, appState.activeMarkerType, cleanText);
                await renderDotsForCurrentPage();
                updateAllSectionsForCurrentPage();
                // TODO: Convert to Command Pattern
                // UndoManager.capture('OCR scrape');
                showCSVStatus(`✅ OCR found: "${cleanText}"`, true, 5000);
            } else {
                showCSVStatus("❌ Collision detected", false, 4000);
            }
        } else {
            showCSVStatus("❌ OCR found no text", false, 4000);
        }
        
        tempCanvas.remove();
        
    } catch (error) {
        console.error('OCR failed:', error);
        showCSVStatus("❌ OCR processing failed", false, 4000);
    }
}

export { finishScrape, finishOCRScrape, updateToleranceInputs };

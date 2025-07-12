// scrape.js

function updateToleranceDisplay() {
    const display = document.getElementById('tolerance-display');
    const hElement = document.getElementById('h-tolerance');
    const vElement = document.getElementById('v-tolerance');
    
    if (display && hElement && vElement) {
        hElement.textContent = appState.scrapeHorizontalTolerance.toFixed(1);
        vElement.textContent = appState.scrapeVerticalTolerance.toFixed(1);
        display.style.display = 'flex';
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

function toggleTrainingMode(e) {
    if (e) {
        e.stopPropagation();
    }
    appState.isTrainingScrape = !appState.isTrainingScrape;
    const btn = document.getElementById('train-scrape-btn');
    btn.textContent = appState.isTrainingScrape ? 'TRAINING SCRAPE' : 'TRAIN SCRAPE';
    btn.classList.toggle('glowing', appState.isTrainingScrape);
    if (!appState.isTrainingScrape) {
        resetTrainingUI();
    }
}

function resetTrainingUI() {
    if (appState.trainingBigBox) {
        removeTrainingElements();
        appState.trainingBigBox = null;
        appState.trainingSmallBoxes = [];
    }
}

function removeTrainingElements() {
    document.querySelectorAll('.train-big-box, .train-small-box, .train-counter-btn, .train-cancel-btn').forEach(el => el.remove());
    appState.trainingCounterElement = null;
    appState.trainingCancelElement = null;
}

function startTrainingBigBox(e) {
    const rect = document.getElementById('map-container').getBoundingClientRect();
    appState.isScraping = true; 
    appState.scrapeStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const bigBox = document.createElement('div');
    bigBox.className = 'train-big-box';
    Object.assign(bigBox.style, { left: `${appState.scrapeStart.x}px`, top: `${appState.scrapeStart.y}px`, width: '0px', height: '0px' });
    document.getElementById('map-container').appendChild(bigBox);
    appState.scrapeBox = bigBox;
}

function updateTrainingBigBox(e) {
    if (!appState.scrapeBox) return;
    const rect = document.getElementById('map-container').getBoundingClientRect();
    const currentX = e.clientX - rect.left; 
    const currentY = e.clientY - rect.top;
    
    if (currentX < 0 || currentX > rect.width || currentY < 0 || currentY > rect.height) {
        appState.scrapeBox.remove();
        appState.scrapeBox = null;
        appState.isScraping = false;
        return;
    }
    
    const left = Math.min(appState.scrapeStart.x, currentX); 
    const top = Math.min(appState.scrapeStart.y, currentY);
    const width = Math.abs(currentX - appState.scrapeStart.x); 
    const height = Math.abs(currentY - appState.scrapeStart.y);
    Object.assign(appState.scrapeBox.style, { 
        left: `${left}px`, 
        top: `${top}px`, 
        width: `${width}px`, 
        height: `${height}px` 
    });
}

async function finishTrainingBigBox() {
    if (!appState.scrapeBox) return;
    
    const boxRect = appState.scrapeBox.getBoundingClientRect();
    const mapRect = document.getElementById('map-container').getBoundingClientRect();
    
    appState.trainingBigBox = {
        x1: boxRect.left - mapRect.left,
        y1: boxRect.top - mapRect.top,
        x2: boxRect.right - mapRect.left,
        y2: boxRect.bottom - mapRect.top
    };
    
    const counterBtn = document.createElement('div');
    counterBtn.className = 'train-counter-btn';
    counterBtn.textContent = '0/5';
    counterBtn.style.left = '0px';
    counterBtn.style.top = '-15px';
    appState.scrapeBox.appendChild(counterBtn);
    appState.trainingCounterElement = counterBtn;
    counterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleCounterClick();
    });

    const cancelBtn = document.createElement('div');
    cancelBtn.className = 'train-cancel-btn';
    cancelBtn.textContent = 'X';
    cancelBtn.style.top = '-15px';
    appState.scrapeBox.appendChild(cancelBtn);
    appState.trainingCancelElement = cancelBtn;
    cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTrainingMode();
        resetTrainingUI();
    });

    appState.scrapeBox = null;
    appState.isScraping = false;
}

function startTrainingSmallBox(e) {
    if (!appState.trainingBigBox) return;
    
    const rect = document.getElementById('map-container').getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    
    if (startX < appState.trainingBigBox.x1 || startX > appState.trainingBigBox.x2 ||
        startY < appState.trainingBigBox.y1 || startY > appState.trainingBigBox.y2) {
        return;
    }
    
    appState.isScraping = true; 
    appState.scrapeStart = { x: startX, y: startY };
    const smallBox = document.createElement('div');
    smallBox.className = 'train-small-box';
    Object.assign(smallBox.style, { left: `${startX}px`, top: `${startY}px`, width: '0px', height: '0px' });
    document.getElementById('map-container').appendChild(smallBox);
    appState.scrapeBox = smallBox;
}

function updateTrainingSmallBox(e) {
    if (!appState.scrapeBox) return;
    const rect = document.getElementById('map-container').getBoundingClientRect();
    let currentX = e.clientX - rect.left; 
    let currentY = e.clientY - rect.top;
    
    currentX = Math.max(appState.trainingBigBox.x1, Math.min(currentX, appState.trainingBigBox.x2));
    currentY = Math.max(appState.trainingBigBox.y1, Math.min(currentY, appState.trainingBigBox.y2));
    
    const left = Math.min(appState.scrapeStart.x, currentX); 
    const top = Math.min(appState.scrapeStart.y, currentY);
    const width = Math.abs(currentX - appState.scrapeStart.x); 
    const height = Math.abs(currentY - appState.scrapeStart.y);
    Object.assign(appState.scrapeBox.style, { 
        left: `${left}px`, 
        top: `${top}px`, 
        width: `${width}px`, 
        height: `${height}px` 
    });
}

async function finishTrainingSmallBox() {
    if (!appState.scrapeBox) return;
    
    const boxRect = appState.scrapeBox.getBoundingClientRect();
    const mapRect = document.getElementById('map-container').getBoundingClientRect();
    
    appState.trainingSmallBoxes.push({
        x1: boxRect.left - mapRect.left,
        y1: boxRect.top - mapRect.top,
        x2: boxRect.right - mapRect.left,
        y2: boxRect.bottom - mapRect.top
    });
    
    updateTrainingCounter();
    
    appState.scrapeBox = null;
    appState.isScraping = false;
}

function updateTrainingCounter() {
    const count = appState.trainingSmallBoxes.length;
    const counterEl = appState.trainingCounterElement;
    if (counterEl) {
        counterEl.textContent = `${count}/5`;
        if (count >= 5) {
            counterEl.classList.add('ready');
            counterEl.textContent = 'ACCEPT!';
            const bigBoxEl = document.querySelector('.train-big-box');
            if (bigBoxEl) {
                bigBoxEl.classList.add('glowing');
            }
        }
    }
}

async function handleCounterClick() {
    if (appState.trainingSmallBoxes.length < 5) return;
    
    showCSVStatus("Computing tolerances from training...", true);
    
    const tolerances = await computeTolerancesFromTraining();
    
    if (tolerances) {
        appState.scrapeHorizontalTolerance = tolerances.avgH;
        appState.scrapeVerticalTolerance = tolerances.avgV;
        setDirtyState();
        
        // Update the tolerance display
        updateToleranceDisplay();
        
        showCSVStatus(`Updated tolerances: H=${tolerances.avgH.toFixed(1)}, V=${tolerances.avgV.toFixed(1)}`, true);
    } else {
        showCSVStatus("No valid text found in training boxes.", false);
    }
    
    toggleTrainingMode();
    resetTrainingUI();
}

async function computeTolerancesFromTraining() {
    if (!appState.pdfDoc || !appState.trainingSmallBoxes.length) return null;
    
    const page = await appState.pdfDoc.getPage(appState.currentPdfPage);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: appState.pdfScale });
    
    let allMaxH = [];
    let allMaxV = [];
    let totalTextItemsFound = 0;
    
    // Convert all text items to canvas coordinates first (like regular scrape does)
    const formattedTextItems = textContent.items.map(item => {
        const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        return {
            x: x,
            y: y,
            width: item.width * viewport.scale,
            height: item.height * viewport.scale,
            text: item.str.trim(),
            originalItem: item
        };
    }).filter(item => item.text.length > 0);
    
    console.log(`Total formatted text items: ${formattedTextItems.length}`);
    console.log(`Map transform:`, appState.mapTransform);
    
    // Show some sample text items for debugging
    console.log(`Sample text items:`, formattedTextItems.slice(0, 5).map(item => ({
        text: item.text,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height
    })));
    
    for (let boxIndex = 0; boxIndex < appState.trainingSmallBoxes.length; boxIndex++) {
        const smallBox = appState.trainingSmallBoxes[boxIndex];
        
        // Convert training box coordinates from screen space to canvas space
        // Training boxes are stored in screen coordinates relative to map container
        // We need to convert them back to canvas coordinates
        const { x: mapX, y: mapY, scale } = appState.mapTransform;
        const canvasBox = {
            x1: (smallBox.x1 - mapX) / scale,
            y1: (smallBox.y1 - mapY) / scale,
            x2: (smallBox.x2 - mapX) / scale,
            y2: (smallBox.y2 - mapY) / scale
        };
        
        console.log(`Small box ${boxIndex + 1} screen coords: x1=${smallBox.x1}, y1=${smallBox.y1}, x2=${smallBox.x2}, y2=${smallBox.y2}`);
        console.log(`Small box ${boxIndex + 1} canvas coords: x1=${canvasBox.x1}, y1=${canvasBox.y1}, x2=${canvasBox.x2}, y2=${canvasBox.y2}`);
        
        const textInBox = formattedTextItems.filter(item => {
            const itemRight = item.x + item.width;
            const itemBottom = item.y + item.height;
            
            // Check if text item overlaps with the small box bounds (now using canvas coordinates)
            const overlaps = item.x < canvasBox.x2 && itemRight > canvasBox.x1 &&
                           item.y < canvasBox.y2 && itemBottom > canvasBox.y1;
            
            if (overlaps) {
                console.log(`  Found text "${item.text}" at x=${item.x}, y=${item.y}, w=${item.width}, h=${item.height}`);
            }
            
            return overlaps;
        });
        
        totalTextItemsFound += textInBox.length;
        console.log(`Small box ${boxIndex + 1} found ${textInBox.length} text items:`, textInBox.map(item => item.text));
        
        if (textInBox.length < 1) continue;
        
        // Group text items into lines using the canvas coordinates
        const lines = groupTextIntoLines(textInBox);
        console.log(`  Grouped into ${lines.length} lines`);
        
        // Calculate vertical gaps between lines
        if (lines.length > 1) {
            lines.sort((a, b) => a[0].y - b[0].y);
            for (let i = 1; i < lines.length; i++) {
                const gapV = Math.abs(lines[i][0].y - (lines[i-1][0].y + lines[i-1][0].height));
                if (gapV > 0) {
                    allMaxV.push(gapV);
                    console.log(`  Found vertical gap: ${gapV}`);
                }
            }
        }
        
        // Calculate horizontal gaps within lines
        for (const line of lines) {
            if (line.length > 1) {
                line.sort((a, b) => a.x - b.x);
                for (let j = 1; j < line.length; j++) {
                    const gapH = line[j].x - (line[j-1].x + line[j-1].width);
                    if (gapH > 0) {
                        allMaxH.push(gapH);
                        console.log(`  Found horizontal gap: ${gapH}`);
                    }
                }
            }
        }
    }
    
    console.log(`Total text items found: ${totalTextItemsFound}`);
    console.log(`Horizontal gaps found: ${allMaxH.length}`, allMaxH);
    console.log(`Vertical gaps found: ${allMaxV.length}`, allMaxV);
    
    if (!allMaxH.length && !allMaxV.length) return null;
    
    // Use defaults if one type of gap isn't found
    const avgH = allMaxH.length > 0 ? (allMaxH.reduce((a,b) => a+b, 0) / allMaxH.length) : 5;
    const avgV = allMaxV.length > 0 ? (allMaxV.reduce((a,b) => a+b, 0) / allMaxV.length) : 25;
    
    return { avgH, avgV };
}

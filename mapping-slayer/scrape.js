// scrape.js

function toggleTrainingMode(e) {
    e.stopPropagation();
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
    counterBtn.addEventListener('click', handleCounterClick);

    const cancelBtn = document.createElement('div');
    cancelBtn.className = 'train-cancel-btn';
    cancelBtn.textContent = 'X';
    cancelBtn.style.top = '-15px';
    appState.scrapeBox.appendChild(cancelBtn);
    appState.trainingCancelElement = cancelBtn;
    cancelBtn.addEventListener('click', () => {
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
            counterEl.textContent = 'PRESS ME WHEN READY!';
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
    
    for (const smallBox of appState.trainingSmallBoxes) {
        const textInBox = textContent.items.filter(item => {
            const [canvasX, canvasY] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
            const canvasXEnd = canvasX + (item.width * viewport.scale);
            const canvasYEnd = canvasY + (item.height * viewport.scale);
            return canvasX >= smallBox.x1 && canvasXEnd <= smallBox.x2 &&
                   canvasY >= smallBox.y1 && canvasYEnd <= smallBox.y2;
        });
        
        if (textInBox.length < 2) continue;
        
        const lines = groupTextIntoLines(textInBox);
        
        let maxV = 0;
        if (lines.length > 1) {
            lines.sort((a,b) => a[0].transform[5] - b[0].transform[5]);
            for (let i = 1; i < lines.length; i++) {
                const gapV = Math.abs(lines[i][0].transform[5] - lines[i-1][0].transform[5] - lines[i-1][0].height);
                maxV = Math.max(maxV, gapV);
            }
        }
        
        let maxH = 0;
        for (const line of lines) {
            if (line.length > 1) {
                line.sort((a,b) => a.transform[4] - b.transform[4]);
                for (let j = 1; j < line.length; j++) {
                    const gapH = line[j].transform[4] - (line[j-1].transform[4] + line[j-1].width);
                    maxH = Math.max(maxH, gapH);
                }
            }
        }
        
        if (maxH > 0) allMaxH.push(maxH * viewport.scale);
        if (maxV > 0) allMaxV.push(maxV * viewport.scale);
    }
    
    if (!allMaxH.length || !allMaxV.length) return null;
    
    const avgH = allMaxH.reduce((a,b) => a+b, 0) / allMaxH.length;
    const avgV = allMaxV.reduce((a,b) => a+b, 0) / allMaxV.length;
    
    return { avgH, avgV };
}

// automap.js

let isAutomapCancelled = false;

function showAutomapProgress(mainStatus, progressPercent) {
    const modal = document.getElementById('automap-progress-modal');
    const statusEl = document.getElementById('automap-main-status');
    const fillEl = document.getElementById('automap-progress-fill');

    modal.style.display = 'block';
    statusEl.textContent = mainStatus;
    fillEl.style.width = `${progressPercent}%`;
}

function addActivityFeedItem(message, type = 'info') { // type can be 'info', 'success', 'error'
    const feedEl = document.getElementById('automap-activity-feed');
    const item = document.createElement('div');
    item.className = `activity-feed-item ${type}`;
    item.textContent = message;
    
    feedEl.appendChild(item);

    feedEl.scrollTop = feedEl.scrollHeight;

    if (feedEl.children.length > 50) {
        feedEl.removeChild(feedEl.firstElementChild);
    }
}

function clearActivityFeed() {
    document.getElementById('automap-activity-feed').innerHTML = '';
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

function clusterTextItems(textItems) {
    if (textItems.length === 0) return [];
    
    const HORIZONTAL_TOLERANCE = appState.scrapeHorizontalTolerance;
    const VERTICAL_TOLERANCE = appState.scrapeVerticalTolerance;
    
    const sortedItems = [...textItems].sort((a, b) => a.y - b.y);
    
    const lines = [];
    let currentLine = [];
    
    for (const item of sortedItems) {
        if (currentLine.length === 0) {
            currentLine = [item];
        } else {
            const lastItem = currentLine[currentLine.length - 1];
            if (Math.abs(item.y - lastItem.y) <= VERTICAL_TOLERANCE) {
                currentLine.push(item);
            } else {
                lines.push(currentLine);
                currentLine = [item];
            }
        }
    }
    if (currentLine.length > 0) {
        lines.push(currentLine);
    }
    
    const clusters = [];
    
    for (const line of lines) {
        line.sort((a, b) => a.x - b.x);
        
        let currentCluster = [];
        
        for (const item of line) {
            if (currentCluster.length === 0) {
                currentCluster = [item];
            } else {
                const lastItem = currentCluster[currentCluster.length - 1];
                const gap = item.x - (lastItem.x + lastItem.width);
                
                if (gap <= HORIZONTAL_TOLERANCE) {
                    currentCluster.push(item);
                } else {
                    clusters.push(currentCluster);
                    currentCluster = [item];
                }
            }
        }
        if (currentCluster.length > 0) {
            clusters.push(currentCluster);
        }
    }
    
    const finalClusters = [];
    
    for (const cluster of clusters) {
        let merged = false;
        
        for (const existingCluster of finalClusters) {
            const clusterY = Math.min(...cluster.map(item => item.y));
            const existingY = Math.max(...existingCluster.map(item => item.y));
            const verticalGap = Math.abs(clusterY - existingY);
            
            if (verticalGap <= VERTICAL_TOLERANCE) {
                const clusterLeft = Math.min(...cluster.map(item => item.x));
                const clusterRight = Math.max(...cluster.map(item => item.x + item.width));
                const existingLeft = Math.min(...existingCluster.map(item => item.x));
                const existingRight = Math.max(...existingCluster.map(item => item.x + item.width));
                
                const horizontalGap = Math.max(0, Math.max(clusterLeft - existingRight, existingLeft - clusterRight));
                
                if (horizontalGap <= HORIZONTAL_TOLERANCE) {
                    existingCluster.push(...cluster);
                    merged = true;
                    break;
                }
            }
        }
        
        if (!merged) {
            finalClusters.push([...cluster]);
        }
    }
    
    return finalClusters.map(cluster => {
        const bounds = cluster.reduce((bbox, item) => ({
            left: Math.min(bbox.left, item.x),
            right: Math.max(bbox.right, item.x + item.width),
            top: Math.min(bbox.top, item.y),
            bottom: Math.max(bbox.bottom, item.y + item.height)
        }), {
            left: cluster[0].x,
            right: cluster[0].x + cluster[0].width,
            top: cluster[0].y,
            bottom: cluster[0].y + cluster[0].height
        });
        
        return {
            items: cluster,
            centerX: (bounds.left + bounds.right) / 2,
            centerY: bounds.top - 10,
            text: cluster.map(item => item.text).join(' ').trim()
        };
    }).filter(cluster => cluster.text.length > 0);
}

async function automapSingleLocation() {
    if (!appState.pdfDoc) {
        updateAutomapStatus('Please load a PDF file first.', true);
        return;
    }

    const textInput = document.getElementById('automap-text-input');
    const markerTypeSelect = document.getElementById('automap-marker-type-select');
    const exactMatchCheckbox = document.getElementById('automap-exact-phrase');
    const searchTerm = textInput.value.trim();
    const markerTypeCode = markerTypeSelect.value;

    if (!searchTerm) {
        updateAutomapStatus('Please enter text to find.', true);
        return;
    }
    if (!markerTypeCode) {
        updateAutomapStatus('Please select a marker type.', true);
        return;
    }
    
    isAutomapCancelled = false;
    const automapBtn = document.getElementById('single-automap-btn');
    const cancelBtn = document.getElementById('cancel-automap-btn');
    const closeBtn = document.getElementById('close-automap-btn');
    
    automapBtn.disabled = true;
    cancelBtn.style.display = 'inline-block';
    closeBtn.style.display = 'none';
    document.getElementById('automap-results').style.display = 'none';
    
    cancelBtn.onclick = () => {
        isAutomapCancelled = true;
        addActivityFeedItem('--- Operation Cancelled by User ---', 'error');
    };

    clearActivityFeed();
    showAutomapProgress("Preparing search...", 5);
    await sleep(200);

    try {
        if (isAutomapCancelled) throw new Error("Operation cancelled");
        showAutomapProgress("Loading page content...", 10);
        addActivityFeedItem(`Loading text from page ${appState.currentPdfPage}...`);
        
        const page = await appState.pdfDoc.getPage(appState.currentPdfPage);
        const viewport = page.getViewport({ scale: appState.pdfScale });
        const textContent = await page.getTextContent();
        
        await sleep(200);
        if (isAutomapCancelled) throw new Error("Operation cancelled");
        
        if (textContent.items.length === 0) {
            throw new Error("No live text found on this page.");
        }

        addActivityFeedItem(`Found ${textContent.items.length} text items to analyze.`);
        showAutomapProgress("Finding matches...", 20);
        await sleep(100);

        let matchesFound = 0;
        const dotsToAdd = [];
        const searchTermNormalized = searchTerm.replace(/\s+/g, ' ').toLowerCase();

        const textItems = textContent.items;
        
        const formattedTextItems = textItems.map(item => {
            const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
            return {
                x: x,
                y: y,
                width: item.width * viewport.scale,
                height: item.height * viewport.scale,
                text: item.str.trim()
            };
        });

        if (exactMatchCheckbox.checked) {
            addActivityFeedItem("Mode: Exact Phrase Matching");
            
            const matchingItems = formattedTextItems.filter(item => 
                item.text.toLowerCase().includes(searchTermNormalized)
            );
            
            if (matchingItems.length > 0) {
                const clusters = clusterTextItems(matchingItems);
                
                for (const cluster of clusters) {
                    if (isAutomapCancelled) throw new Error("Operation cancelled");
                    
                    const fullText = cluster.text.toLowerCase();
                    if (fullText.includes(searchTermNormalized)) {
                        if (!isCollision(cluster.centerX, cluster.centerY)) {
                            dotsToAdd.push({ x: cluster.centerX, y: cluster.centerY, message: searchTerm });
                            matchesFound++;
                            addActivityFeedItem(`Found match: '${searchTerm}'`, 'success');
                        } else {
                            addActivityFeedItem(`Collision detected for '${searchTerm}', skipping.`, 'error');
                        }
                    }
                    await sleep(10);
                }
            }

        } else { // Individual word matching
            addActivityFeedItem("Mode: Contains Text Matching");
            
            const matchingItems = formattedTextItems.filter(item => 
                item.text.toLowerCase().includes(searchTermNormalized)
            );
            
            const clusters = clusterTextItems(matchingItems);
            
            for (let i = 0; i < clusters.length; i++) {
                if (isAutomapCancelled) throw new Error("Operation cancelled");
                const cluster = clusters[i];
                
                if (!isCollision(cluster.centerX, cluster.centerY)) {
                    dotsToAdd.push({ x: cluster.centerX, y: cluster.centerY, message: cluster.text });
                    matchesFound++;
                    addActivityFeedItem(`Found match: '${cluster.text}'`, 'success');
                } else {
                    addActivityFeedItem(`Collision detected for '${cluster.text}', skipping.`, 'error');
                }
                
                if (i % 5 === 0) {
                    const progress = 20 + Math.round((i / clusters.length) * 60);
                    showAutomapProgress("Finding matches...", progress);
                    await sleep(1);
                }
            }
        }

        if (isAutomapCancelled) throw new Error("Operation cancelled");
        showAutomapProgress("Placing dots...", 90);
        addActivityFeedItem("Adding matched locations to the map...");
        await sleep(200);

        if (dotsToAdd.length > 0) {
            dotsToAdd.forEach(dotInfo => {
                addDot(dotInfo.x, dotInfo.y, markerTypeCode, dotInfo.message);
            });
            UndoManager.capture(`Automap: ${searchTerm}`);
            updateRecentSearches(searchTerm);
            textInput.value = '';
        }
        
        showAutomapProgress("Finalizing...", 100);
        await sleep(500);

        const resultsEl = document.getElementById('automap-results');
        resultsEl.style.display = 'block';
        if (matchesFound > 0) {
            showAutomapProgress(`Completed: Found ${matchesFound} match(es)!`, 100);
            resultsEl.innerHTML = `Successfully placed <strong>${matchesFound}</strong> dot(s) for "${searchTerm}".`;
        } else {
            showAutomapProgress(`Completed: No matches found.`, 100);
            resultsEl.innerHTML = `Could not find any occurrences of "${searchTerm}" on page ${appState.currentPdfPage}.`;
        }

    } catch (error) {
        showAutomapProgress("Error Occurred", 100);
        document.getElementById('automap-results').style.display = 'block';
        document.getElementById('automap-results').innerHTML = `<span style="color: #ff6b6b;">${error.message}</span>`;
        console.error("Automap failed:", error);
    } finally {
        automapBtn.disabled = false;
        cancelBtn.style.display = 'none';
        closeBtn.style.display = 'inline-block';
    }
}

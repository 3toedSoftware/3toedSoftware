/**
 * braille-translator-v2.js
 * Enhanced Braille translator using Web Worker for better performance and reliability
 */

// Worker instance and state
let brailleWorker = null;
let workerReady = false;
let workerError = null;
let pendingTranslations = new Map();
let translationIdCounter = 0;

// Callbacks waiting for worker to be ready
const readyCallbacks = [];

/**
 * Initialize the Braille translation worker
 */
export function initializeBrailleTranslator() {
    console.log('[BRAILLE V2] Initializing Braille translator with worker...');
    
    try {
        // Create worker from the same directory
        brailleWorker = new Worker('./apps/design_slayer/braille-worker.js');
        
        // Handle messages from worker
        brailleWorker.addEventListener('message', handleWorkerMessage);
        
        // Handle worker errors
        brailleWorker.addEventListener('error', (error) => {
            console.error('[BRAILLE V2] Worker error:', error);
            workerError = error.message || 'Worker failed to load';
            workerReady = false;
            
            // Reject all pending translations
            pendingTranslations.forEach((callbacks) => {
                callbacks.reject(new Error(workerError));
            });
            pendingTranslations.clear();
        });
        
    } catch (error) {
        console.error('[BRAILLE V2] Failed to create worker:', error);
        workerError = error.message;
        
        // Try fallback method
        initializeFallbackTranslator();
    }
}

/**
 * Handle messages from the worker
 */
function handleWorkerMessage(event) {
    const { type, id, success, error } = event.data;
    
    switch (type) {
        case 'initialized':
            if (success) {
                console.log('[BRAILLE V2] Worker initialized successfully');
                workerReady = true;
                workerError = null;
                
                // Call ready callbacks
                readyCallbacks.forEach(callback => callback());
                readyCallbacks.length = 0;
                
                // Update all Braille layers
                if (window.updateAllBrailleLayers) {
                    window.updateAllBrailleLayers();
                }
            } else {
                console.error('[BRAILLE V2] Worker initialization failed:', error);
                workerError = error;
                workerReady = false;
                initializeFallbackTranslator();
            }
            break;
            
        case 'translation':
            const callbacks = pendingTranslations.get(id);
            if (callbacks) {
                if (success) {
                    callbacks.resolve(event.data.brailleText);
                } else {
                    callbacks.reject(new Error(error));
                }
                pendingTranslations.delete(id);
            }
            break;
            
        case 'testResults':
            console.log('[BRAILLE V2] Test results:', event.data.results);
            event.data.results.forEach(result => {
                if (result.passed) {
                    console.log(`✓ "${result.input}" → "${result.actual}"`);
                } else {
                    console.error(`✗ "${result.input}" → "${result.actual}" (expected: "${result.expected}")`);
                }
            });
            break;
    }
}

/**
 * Fallback translator for environments without worker support
 */
function initializeFallbackTranslator() {
    console.log('[BRAILLE V2] Initializing fallback translator...');
    
    // Load liblouis directly in main thread (less performant)
    const script1 = document.createElement('script');
    script1.src = 'https://unpkg.com/liblouis-build@latest/build-no-tables.js';
    script1.onload = () => {
        const script2 = document.createElement('script');
        script2.src = 'https://unpkg.com/liblouis@0.4.0/easy-api.js';
        script2.onload = () => {
            if (window.liblouis) {
                try {
                    window.liblouis.enableOnDemandTableLoading('https://unpkg.com/liblouis-build@latest/tables/');
                    workerReady = true;
                    console.log('[BRAILLE V2] Fallback translator ready');
                    
                    // Call ready callbacks
                    readyCallbacks.forEach(callback => callback());
                    readyCallbacks.length = 0;
                    
                    // Update all Braille layers
                    if (window.updateAllBrailleLayers) {
                        window.updateAllBrailleLayers();
                    }
                } catch (e) {
                    console.error('[BRAILLE V2] Fallback initialization error:', e);
                    workerError = e.message;
                }
            }
        };
        document.head.appendChild(script2);
    };
    document.head.appendChild(script1);
}

/**
 * Wait for the translator to be ready
 */
function waitForReady() {
    return new Promise((resolve) => {
        if (workerReady) {
            resolve();
        } else {
            readyCallbacks.push(resolve);
        }
    });
}

/**
 * Translate text to Grade 2 Braille
 * @param {string} text - The text to translate
 * @returns {Promise<string>} The Braille translation
 */
export async function translateToGrade2Braille(text) {
    console.log('[BRAILLE V2] Translation requested for:', text);
    
    if (!text) {
        return '';
    }
    
    // Wait for translator to be ready
    await waitForReady();
    
    // If using worker
    if (brailleWorker && !workerError) {
        return new Promise((resolve, reject) => {
            const id = translationIdCounter++;
            pendingTranslations.set(id, { resolve, reject });
            
            brailleWorker.postMessage({
                type: 'translate',
                text: text,
                id: id
            });
        });
    }
    
    // Fallback: use direct translation
    if (window.liblouis) {
        try {
            const result = window.liblouis.translateString('unicode.dis,en-us-g2.ctb', text);
            console.log('[BRAILLE V2] Fallback translation result:', result);
            return result;
        } catch (error) {
            console.error('[BRAILLE V2] Fallback translation error:', error);
            return text; // Return original text on error
        }
    }
    
    // If nothing works, return original text
    console.error('[BRAILLE V2] No translation method available');
    return text;
}

/**
 * Run translation tests
 */
export function testBrailleTranslation() {
    if (brailleWorker && workerReady) {
        console.log('[BRAILLE V2] Running tests via worker...');
        brailleWorker.postMessage({ type: 'test' });
    } else if (window.liblouis) {
        console.log('[BRAILLE V2] Running tests via fallback...');
        const testCases = [
            { input: 'stair', expected: '/air' },
            { input: 'conference', expected: '3f};e' },
            { input: 'Sample Text', expected: ',sample ,text' }
        ];
        
        testCases.forEach(test => {
            try {
                const result = window.liblouis.translateString('unicode.dis,en-us-g2.ctb', test.input);
                const passed = result === test.expected;
                console.log(`${passed ? '✓' : '✗'} "${test.input}" → "${result}" (expected: "${test.expected}")`);
            } catch (e) {
                console.error(`✗ "${test.input}" - Error:`, e.message);
            }
        });
    } else {
        console.error('[BRAILLE V2] Cannot run tests - translator not ready');
    }
}

// Initialize on load
initializeBrailleTranslator();
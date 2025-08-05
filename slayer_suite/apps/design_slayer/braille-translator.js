/**
 * braille-translator.js
 * Translates English text to Grade 2 Braille using liblouis
 */

// Test function to verify liblouis is working
export function testBrailleTranslation() {
    console.log('[BRAILLE TEST] Starting Braille translation test...');
    
    // Wait for liblouis to be ready
    waitForLiblouis(() => {
        console.log('[BRAILLE TEST] liblouis is ready, running tests...');
        
        // Test translations
        const testCases = [
            { input: 'stair', expected: '/air' },
            { input: 'conference', expected: '3f};e' },
            { input: 'Sample Text', expected: ',sample ,text' }
        ];
        
        testCases.forEach(test => {
            try {
                const result = translateToGrade2Braille(test.input);
                console.log(`[BRAILLE TEST] "${test.input}" → "${result}" (expected: "${test.expected}")`);
                
                // Check if the result matches expected
                if (result === test.expected) {
                    console.log(`[BRAILLE TEST] ✓ PASS`);
                } else {
                    console.log(`[BRAILLE TEST] ✗ FAIL - Got "${result}" instead of "${test.expected}"`);
                }
            } catch (e) {
                console.error(`[BRAILLE TEST] Error translating "${test.input}":`, e);
            }
        });
        
        console.log('[BRAILLE TEST] Test complete!');
    });
    
    return true;
}

/**
 * Translates text to Grade 2 Braille using liblouis
 * @param {string} text - The text to translate
 * @returns {string} The Braille translation
 */
// Keep track of liblouis readiness
let liblouisReady = false;
const liblouisReadyCallbacks = [];

// Function to check if liblouis is ready
function checkLiblouisReady() {
    if (window.liblouis && window.liblouis.translateString) {
        liblouisReady = true;
        console.log('[BRAILLE SNIFFER] liblouis is ready!');
        // Call all waiting callbacks
        liblouisReadyCallbacks.forEach(callback => callback());
        liblouisReadyCallbacks.length = 0;
        return true;
    }
    return false;
}

// Start checking for liblouis periodically
const liblouisCheckInterval = setInterval(() => {
    if (checkLiblouisReady()) {
        clearInterval(liblouisCheckInterval);
        console.log('[BRAILLE SNIFFER] Stopped checking for liblouis - it\'s now ready');
    }
}, 100);

// Wait for liblouis to be ready
function waitForLiblouis(callback) {
    if (liblouisReady || checkLiblouisReady()) {
        callback();
    } else {
        liblouisReadyCallbacks.push(callback);
        // Keep checking
        setTimeout(() => waitForLiblouis(callback), 100);
    }
}

export function translateToGrade2Braille(text) {
    console.log('[BRAILLE SNIFFER] translateToGrade2Braille called with:', text);
    
    if (!text) {
        console.log('[BRAILLE SNIFFER] Empty text, returning empty string');
        return '';
    }
    
    // Check if liblouis is available
    console.log('[BRAILLE SNIFFER] Checking liblouis availability...');
    console.log('[BRAILLE SNIFFER] typeof liblouis:', typeof liblouis);
    console.log('[BRAILLE SNIFFER] window.liblouis:', window.liblouis);
    console.log('[BRAILLE SNIFFER] liblouisReady:', liblouisReady);
    
    if (!liblouisReady && !checkLiblouisReady()) {
        console.error('[BRAILLE SNIFFER] liblouis is not ready yet.');
        console.log('[BRAILLE SNIFFER] Returning original text as fallback');
        
        // Try to wait for it and re-render when ready
        waitForLiblouis(() => {
            console.log('[BRAILLE SNIFFER] liblouis is now ready, triggering re-render');
            // Trigger a re-render of all Braille layers
            if (window.updateAllBrailleLayers) {
                window.updateAllBrailleLayers();
            }
        });
        
        return text; // Return original text as fallback
    }
    
    console.log('[BRAILLE SNIFFER] liblouis is available, attempting translation...');
    
    try {
        // Use English US Grade 2 table
        // The unicode.dis table is included to get proper ASCII output instead of Unicode
        console.log('[BRAILLE SNIFFER] Using tables: unicode.dis,en-us-g2.ctb');
        
        const brailleText = liblouis.translateString(
            "unicode.dis,en-us-g2.ctb",
            text
        );
        
        console.log('[BRAILLE SNIFFER] Translation successful!');
        console.log(`[BRAILLE SNIFFER] Input: "${text}"`);
        console.log(`[BRAILLE SNIFFER] Output: "${brailleText}"`);
        console.log('[BRAILLE SNIFFER] Output char codes:', brailleText.split('').map(c => c.charCodeAt(0)));
        
        return brailleText;
    } catch (error) {
        console.error('[BRAILLE SNIFFER] Error translating to Braille:', error);
        console.error('[BRAILLE SNIFFER] Error details:', error.message, error.stack);
        console.log('[BRAILLE SNIFFER] Returning original text due to error');
        return text; // Return original text on error
    }
}

/**
 * Translates text to Grade 1 Braille using liblouis
 * @param {string} text - The text to translate
 * @returns {string} The Braille translation
 */
export function translateToGrade1Braille(text) {
    if (!text) return '';
    
    // Check if liblouis is available
    if (typeof liblouis === 'undefined' || !liblouis.translateString) {
        console.error('liblouis is not loaded. Please include liblouis scripts in HTML.');
        return text; // Return original text as fallback
    }
    
    try {
        // Use English US Grade 1 table
        const brailleText = liblouis.translateString(
            "unicode.dis,en-us-g1.ctb",
            text
        );
        
        return brailleText;
    } catch (error) {
        console.error('Error translating to Grade 1 Braille:', error);
        return text; // Return original text on error
    }
}

/**
 * Back-translates Braille to text using liblouis
 * @param {string} brailleText - The Braille text to translate back
 * @returns {string} The regular text
 */
export function backTranslateBraille(brailleText) {
    if (!brailleText) return '';
    
    // Check if liblouis is available
    if (typeof liblouis === 'undefined' || !liblouis.backTranslateString) {
        console.error('liblouis is not loaded. Please include liblouis scripts in HTML.');
        return brailleText; // Return original text as fallback
    }
    
    try {
        // Use English US Grade 2 table for back-translation
        const text = liblouis.backTranslateString(
            "unicode.dis,en-us-g2.ctb",
            brailleText
        );
        
        return text;
    } catch (error) {
        console.error('Error back-translating Braille:', error);
        return brailleText; // Return original text on error
    }
}
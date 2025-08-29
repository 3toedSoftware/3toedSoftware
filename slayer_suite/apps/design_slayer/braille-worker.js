/**
 * braille-worker.js
 * Web Worker for liblouis Braille translation
 * This runs in a separate thread to avoid blocking the main UI
 */

// Import liblouis scripts from local files
self.importScripts('./lib/liblouis/build-no-tables-utf16.js', './lib/liblouis/easy-api.js');

// Track initialization state
let isInitialized = false;
let initializationError = null;

// Initialize liblouis when worker starts
async function initializeLiblouis() {
    try {
        console.log('[BRAILLE WORKER] Initializing liblouis...');

        // Check if liblouis is available
        if (typeof liblouis === 'undefined') {
            throw new Error('liblouis is not defined after importing scripts');
        }

        // Enable on-demand table loading
        liblouis.enableOnDemandTableLoading('./lib/liblouis/tables/');
        console.log('[BRAILLE WORKER] Table loading enabled');

        // Test the translation to ensure tables load correctly
        const testResult = liblouis.translateString('unicode.dis,en-us-g2.ctb', 'test');
        console.log('[BRAILLE WORKER] Test translation successful:', testResult);

        isInitialized = true;
        console.log('[BRAILLE WORKER] liblouis initialized successfully');

        // Notify main thread that initialization is complete
        self.postMessage({
            type: 'initialized',
            success: true
        });
    } catch (error) {
        console.error('[BRAILLE WORKER] Initialization error:', error);
        initializationError = error.message;
        isInitialized = false;

        self.postMessage({
            type: 'initialized',
            success: false,
            error: error.message
        });
    }
}

// Convert Unicode Braille to ASCII for SimBraille font
function convertUnicodeBrailleToASCII(unicodeBraille) {
    // Map Unicode Braille patterns to ASCII characters for SimBraille
    const brailleMap = {
        '⠀': ' ', // blank
        '⠁': 'a', // dot 1
        '⠃': 'b', // dots 1,2
        '⠉': 'c', // dots 1,4
        '⠙': 'd', // dots 1,4,5
        '⠑': 'e', // dots 1,5
        '⠋': 'f', // dots 1,2,4
        '⠛': 'g', // dots 1,2,4,5
        '⠓': 'h', // dots 1,2,5
        '⠊': 'i', // dots 2,4
        '⠚': 'j', // dots 2,4,5
        '⠅': 'k', // dots 1,3
        '⠇': 'l', // dots 1,2,3
        '⠍': 'm', // dots 1,3,4
        '⠝': 'n', // dots 1,3,4,5
        '⠕': 'o', // dots 1,3,5
        '⠏': 'p', // dots 1,2,3,4
        '⠟': 'q', // dots 1,2,3,4,5
        '⠗': 'r', // dots 1,2,3,5
        '⠎': 's', // dots 2,3,4
        '⠞': 't', // dots 2,3,4,5
        '⠥': 'u', // dots 1,3,6
        '⠧': 'v', // dots 1,2,3,6
        '⠺': 'w', // dots 2,4,5,6
        '⠭': 'x', // dots 1,3,4,6
        '⠽': 'y', // dots 1,3,4,5,6
        '⠵': 'z', // dots 1,3,5,6
        '⠯': '&', // and
        '⠿': '=', // for
        '⠷': '(', // of
        '⠮': '!', // the
        '⠾': ')', // with
        '⠡': '*', // ch
        '⠱': '%', // sh
        '⠹': '?', // th
        '⠌': '/', // st
        '⠻': '}', // er
        '⠳': '\\', // ou
        '⠪': '[', // ow
        '⠬': '$', // ed
        '⠨': '<', // gh
        '⠠': ',', // capital indicator
        '⠼': '#', // number indicator
        '⠒': '3', // colon (also used in contractions)
        '⠢': ';', // semicolon (also used in contractions)
        '⠲': '4', // period
        '⠂': '1', // comma
        '⠦': '8', // opening quote
        '⠴': '8', // closing quote
        '⠖': '6', // exclamation
        '⠶': '5', // question mark
        '⠤': '-', // hyphen
        '⠰': '^' // letter indicator
    };

    let result = '';
    for (const char of unicodeBraille) {
        result += brailleMap[char] || char;
    }
    return result;
}

// Message handler
self.addEventListener('message', async event => {
    const { type, text, id } = event.data;

    switch (type) {
        case 'translate':
            if (!isInitialized) {
                self.postMessage({
                    type: 'translation',
                    id: id,
                    success: false,
                    error: 'liblouis not initialized: ' + (initializationError || 'unknown error'),
                    originalText: text
                });
                return;
            }

            try {
                console.log('[BRAILLE WORKER] Translating:', text);

                // Use Grade 2 English Braille translation
                // The key is to use 'ucBrl' mode for contracted braille
                const brailleText = liblouis.translateString('en-us-g2.ctb', text);

                // Debug: Let's see what tables are actually loaded
                console.log(
                    '[BRAILLE WORKER] Available tables:',
                    liblouis.getTable('en-us-g2.ctb')
                );
                console.log(
                    '[BRAILLE WORKER] Translation for "can":',
                    liblouis.translateString('en-us-g2.ctb', 'can')
                );
                console.log(
                    '[BRAILLE WORKER] Translation for "the":',
                    liblouis.translateString('en-us-g2.ctb', 'the')
                );

                // Try backward translation to see if contractions work
                console.log(
                    '[BRAILLE WORKER] Back translation of "c":',
                    liblouis.backTranslateString('en-us-g2.ctb', 'c')
                );

                // Convert Unicode Braille to ASCII for SimBraille font
                const asciiText = convertUnicodeBrailleToASCII(brailleText);

                console.log('[BRAILLE WORKER] Unicode output:', brailleText);
                console.log('[BRAILLE WORKER] ASCII output:', asciiText);

                // Debug: show character codes
                console.log(
                    '[BRAILLE WORKER] Unicode chars:',
                    brailleText
                        .split('')
                        .map(c => `${c} (U+${c.charCodeAt(0).toString(16).padStart(4, '0')})`)
                        .join(' ')
                );

                self.postMessage({
                    type: 'translation',
                    id: id,
                    success: true,
                    brailleText: asciiText,
                    originalText: text
                });
            } catch (error) {
                console.error('[BRAILLE WORKER] Translation error:', error);
                self.postMessage({
                    type: 'translation',
                    id: id,
                    success: false,
                    error: error.message,
                    originalText: text
                });
            }
            break;

        case 'backTranslate':
            if (!isInitialized) {
                self.postMessage({
                    type: 'backTranslation',
                    id: id,
                    success: false,
                    error: 'liblouis not initialized'
                });
                return;
            }

            try {
                const normalText = liblouis.backTranslateString('unicode.dis,en-us-g2.ctb', text);
                self.postMessage({
                    type: 'backTranslation',
                    id: id,
                    success: true,
                    normalText: normalText
                });
            } catch (error) {
                self.postMessage({
                    type: 'backTranslation',
                    id: id,
                    success: false,
                    error: error.message
                });
            }
            break;

        case 'test':
            {
                // Run test translations
                const testCases = [
                    { input: 'stair', expected: '/air' },
                    { input: 'conference', expected: '3f};e' },
                    { input: 'Sample Text', expected: ',sample ,text' },
                    { input: 'the', expected: '!' },
                    { input: 'and', expected: '&' },
                    { input: 'for', expected: '=' },
                    { input: 'of', expected: '(' },
                    { input: 'with', expected: ')' }
                ];

                const results = [];
                for (const test of testCases) {
                    try {
                        const unicodeResult = liblouis.translateString('en-us-g2.ctb', test.input);
                        const result = convertUnicodeBrailleToASCII(unicodeResult);
                        results.push({
                            input: test.input,
                            expected: test.expected,
                            actual: result,
                            passed: result === test.expected
                        });
                    } catch (error) {
                        results.push({
                            input: test.input,
                            expected: test.expected,
                            error: error.message,
                            passed: false
                        });
                    }
                }

                self.postMessage({
                    type: 'testResults',
                    results: results
                });
            }
            break;

        default:
            self.postMessage({
                type: 'error',
                error: 'Unknown message type: ' + type
            });
    }
});

// Initialize liblouis when worker loads
initializeLiblouis();

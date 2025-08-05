/**
 * 🐛 DEBUG BEAST - Quick Error Checker
 * 
 * A simplified version for quick console error detection
 * 
 * Instructions:
 * 1. Open http://127.0.0.1:8000 in your browser
 * 2. Open Developer Tools (F12) -> Console tab  
 * 3. Copy and paste this script and press Enter
 */

console.log('🐛 DEBUG BEAST: Quick Error Check Starting...');

// Capture existing console state
const existingErrors = [];
const existingWarnings = [];

// Override console methods
const originalError = console.error;
const originalWarn = console.warn;

console.error = function(...args) {
    existingErrors.push({
        time: new Date().toLocaleTimeString(),
        message: args.join(' ')
    });
    console.log(`🚨 ERROR DETECTED: ${args.join(' ')}`);
    originalError.apply(console, args);
};

console.warn = function(...args) {
    existingWarnings.push({
        time: new Date().toLocaleTimeString(), 
        message: args.join(' ')
    });
    console.log(`⚠️ WARNING DETECTED: ${args.join(' ')}`);
    originalWarn.apply(console, args);
};

// Test basic functionality
setTimeout(() => {
    console.log('🔍 Testing app switching...');
    
    if (typeof window.slayerSuite !== 'undefined') {
        console.log('✅ SlayerSuite found');
        
        // Quick test of each app
        const apps = ['mapping_slayer', 'design_slayer', 'thumbnail_slayer'];
        let appIndex = 0;
        
        const testNextApp = () => {
            if (appIndex < apps.length) {
                const appName = apps[appIndex];
                console.log(`🔄 Switching to ${appName}...`);
                
                window.slayerSuite.switchToApp(appName)
                    .then(() => {
                        console.log(`✅ ${appName} loaded successfully`);
                        appIndex++;
                        setTimeout(testNextApp, 1500);
                    })
                    .catch(error => {
                        console.log(`❌ ${appName} failed to load:`, error);
                        appIndex++;
                        setTimeout(testNextApp, 1500);
                    });
            } else {
                // Final report
                setTimeout(() => {
                    console.log('=====================================');
                    console.log('🐛 DEBUG BEAST: QUICK CHECK COMPLETE');
                    console.log('=====================================');
                    console.log(`Total Errors: ${existingErrors.length}`);
                    console.log(`Total Warnings: ${existingWarnings.length}`);
                    
                    if (existingErrors.length === 0 && existingWarnings.length === 0) {
                        console.log('🎉 NO CONSOLE ERRORS DETECTED!');
                        console.log('Your Slayer Suite appears to be running cleanly!');
                    } else {
                        console.log('📋 Issues detected:');
                        existingErrors.forEach((error, i) => {
                            console.log(`Error ${i+1} [${error.time}]: ${error.message}`);
                        });
                        existingWarnings.forEach((warning, i) => {
                            console.log(`Warning ${i+1} [${warning.time}]: ${warning.message}`);
                        });
                    }
                    
                    // Store results
                    window.quickErrorCheck = {
                        errors: existingErrors,
                        warnings: existingWarnings,
                        summary: `${existingErrors.length} errors, ${existingWarnings.length} warnings`
                    };
                    
                    console.log('Results saved to: window.quickErrorCheck');
                }, 1000);
            }
        };
        
        testNextApp();
        
    } else {
        console.log('❌ SlayerSuite not found - application may not have loaded properly');
    }
}, 2000);

console.log('Quick error monitoring active. Testing will begin in 2 seconds...');
// demo.js

// --- IMPORTANT: SET THE URL FOR YOUR DEMO PDF HERE ---
// This file must be publicly accessible.
const DEMO_PDF_URL = 'https://firebasestorage.googleapis.com/v0/b/sapper-ide.appspot.com/o/deletable%2Fmapping-slayer-demo.pdf?alt=media&token=a721735a-9391-4972-9ee6-455b57ee1c1e'; // Replace with your actual URL
// ----------------------------------------------------


/**
 * This function runs the application in demo mode.
 * It fetches a predefined PDF and initializes the app.
 */
async function runDemo() {
    // Show a loading message to the user
    const statusMessage = `Loading Demonstration Map...`;
    const mapFileNameEl = document.getElementById('map-file-name');
    if (mapFileNameEl) {
        mapFileNameEl.textContent = statusMessage;
    }
    showCSVStatus(statusMessage, true, 20000); // from ui.js

    try {
        // Fetch the demo PDF from the specified URL
        const response = await fetch(DEMO_PDF_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch demo file: ${response.statusText}`);
        }
        const demoPdfBuffer = await response.arrayBuffer();

        // Create a File object to pass to the existing loader
        const file = new File([demoPdfBuffer], "demo_map.pdf", { type: "application/pdf" });

        // Use the existing ProjectIO loader
        const result = await ProjectIO.load(file); // from project-io.js

        if (result && result.pdfDoc) {
            // Setup the application state for a new project
            appState.pdfDoc = result.pdfDoc;
            appState.sourcePdfBuffer = result.pdfBuffer;
            appState.totalPages = result.pdfDoc.numPages;
            
            initializeNewProjectMarkerTypes(); // from main.js
            
            // Enable all the main controls that were previously disabled
            document.getElementById('create-pdf-btn').disabled = false;
            document.getElementById('create-schedule-btn').disabled = false;
            document.getElementById('update-from-schedule-btn').disabled = false;
            document.getElementById('export-fdf-btn').disabled = false;
            document.getElementById('single-automap-btn').disabled = false;
            document.getElementById('automap-text-input').disabled = false;
            document.getElementById('automap-marker-type-select').disabled = false;

            // Start the main application logic
            runApplication(); // from main.js
            
            // Wait a moment for the app to initialize, then load the first page
            setTimeout(async () => {
                await changePage(1); // from main.js
                appState.isDirty = false;
                showCSVStatus('✅ Demo loaded successfully!', true, 5000);
            }, 100);

        } else {
            throw new Error("Failed to process the loaded demo PDF.");
        }

    } catch (error) {
        console.error("Failed to load demo:", error);
        if (mapFileNameEl) {
            mapFileNameEl.textContent = 'Error loading demo';
        }
        alert(`Could not load the demonstration file. Please check the console for details.`);
    }
}

// Start the demo as soon as the script loads.
runDemo();
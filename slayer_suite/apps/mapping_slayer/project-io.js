/**
 * project-io.js
 * This module handles all file input/output operations for the Mapping Slayer application.
 * It uses a custom binary format with the .mslay extension to store project data
 * and the original PDF together, removing the need for the 'pdf-lib' library for saving.
 */
const ProjectIO = {
    /**
     * Saves the current project state into a custom .mslay file.
     * The format is: [4-byte JSON length][JSON data][Original PDF data]
     * @param {object} projectDataToSave - An object containing all necessary data to save the project.
     * @returns {void} - Triggers a file download of the .mslay file.
     */
    save: async function(projectDataToSave) {
        const pdfBuffer = projectDataToSave.sourcePdfBuffer;
        if (!pdfBuffer || pdfBuffer.byteLength === 0) {
            alert('Cannot save. The source PDF buffer is missing or empty.');
            return;
        }

        const saveBtn = document.getElementById('save-project-btn');
        const originalBtnText = saveBtn.textContent;
        saveBtn.textContent = 'SAVING...';
        saveBtn.disabled = true;

        try {
            // 1. Create a clean copy of the data to be embedded in the JSON part of the file.
            const dataToEmbed = { ...projectDataToSave };
            // IMPORTANT: Delete the large buffer from the object that will be turned into text.
            delete dataToEmbed.sourcePdfBuffer;

            // 2. Convert the JSON data object to a UTF-8 encoded byte array.
            const jsonString = JSON.stringify(dataToEmbed);
            const jsonBytes = new TextEncoder().encode(jsonString);

            // 3. Create a 4-byte header containing the length of the JSON data.
            const header = new ArrayBuffer(4);
            new DataView(header).setUint32(0, jsonBytes.length, true); // true for little-endian

            // 4. Concatenate the header, JSON data, and the original PDF buffer into a single Blob.
            const blob = new Blob([header, jsonBytes, pdfBuffer]);

            // 5. Trigger a download of the new .mslay file.
            const link = document.createElement('a');
            const finalFileName = dataToEmbed.sourcePdfName.replace(/\.pdf$/i, '') + '.mslay';
            link.href = URL.createObjectURL(blob);
            link.download = finalFileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

        } catch (error) {
            console.error("Failed to save project:", error);
            alert("An error occurred while saving the project. Check the console for details.");
        } finally {
            saveBtn.textContent = originalBtnText;
            saveBtn.disabled = false;
        }
    },

    /**
     * Loads a given file, which can be a new .pdf or a .mslay project file.
     * It handles both types and returns the necessary data for the application.
     * @param {File} file - The file selected by the user.
     * @returns {Promise<object|null>} A promise that resolves to an object containing the loaded data.
     */
    load: async function(file) {
    try {
        const fileBuffer = await file.arrayBuffer();
        const fileName = file.name.toLowerCase();

            // --- Handle .mslay project files ---
            if (fileName.endsWith('.mslay')) {
                // 1. Read the 4-byte header to get the length of the JSON data.
                const jsonLength = new DataView(fileBuffer.slice(0, 4)).getUint32(0, true);

                // 2. Extract and parse the JSON data block.
                const jsonBytes = fileBuffer.slice(4, 4 + jsonLength);
                const jsonString = new TextDecoder().decode(jsonBytes);
                const projectData = JSON.parse(jsonString);

                // 3. The rest of the file is the original PDF buffer.
                const pdfBuffer = fileBuffer.slice(4 + jsonLength);

                if (pdfBuffer.byteLength === 0) {
                    throw new Error("The PDF file within the .mslay project is empty.");
                }

                // 4. Create a copy for pdf.js to prevent buffer consumption
                const pdfJsBuffer = pdfBuffer.slice(0);
                const loadingTask = pdfjsLib.getDocument(new Uint8Array(pdfJsBuffer));
                const pdfDocForRender = await loadingTask.promise;

                return {
                    isProject: true,
                    projectData: projectData,
                    pdfDoc: pdfDocForRender,
                    pdfBuffer: pdfBuffer // The original buffer for future saves
                };
            }
            // --- Handle new, plain PDF files ---
            else if (fileName.endsWith('.pdf')) {
                // Create a copy of the buffer for pdf.js to prevent it from being consumed
                const pdfJsBuffer = fileBuffer.slice(0);
            
                // Load the copy into pdf.js for rendering.
                const loadingTask = pdfjsLib.getDocument(new Uint8Array(pdfJsBuffer));
                const pdfDocForRender = await loadingTask.promise;

                // It's a fresh, standard PDF with no project data.
                return {
                    isProject: false,
                    pdfDoc: pdfDocForRender,
                    pdfBuffer: fileBuffer  // Return the original, unconsumed buffer
                };
            }
            // --- Handle unsupported file types ---
            else {
                 alert('Unsupported file type. Please upload a .pdf or .mslay file.');
                 return null;
            }

        } catch (error) {
            console.error('Error loading file in ProjectIO:', error);
            alert(`Failed to load file: ${error.message}`);
            return null; // Return null to indicate failure
        }
    }
};

export { ProjectIO };

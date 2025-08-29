// flag-ui.js - UI functionality for the flag customization system

import { appState } from './state.js';
import {
    FLAG_SYMBOLS,
    FLAG_POSITIONS,
    ALLOWED_ICON_TYPES,
    getDefaultFlagConfig,
    getNextSymbol,
    getPreviousSymbol,
    getSymbolInfo
} from './flag-config.js';
import { renderDotsForCurrentPage } from './map-controller.js';

let currentMarkerTypeForFlags = null;

// Initialize global flag configuration if it doesn't exist
export function initializeGlobalFlags() {
    if (!appState.globalFlagConfiguration) {
        appState.globalFlagConfiguration = getDefaultFlagConfig();
    }
    return appState.globalFlagConfiguration;
}

// DEPRECATED - kept for compatibility but returns global config
export function initializeMarkerTypeFlags(markerTypeCode) {
    // Now just returns the global configuration
    return initializeGlobalFlags();
}

// Open the flag customization modal
export function openFlagModal(markerTypeCode = null) {
    const modal = document.getElementById('flag-customization-modal');

    if (!modal) {
        console.error('Flag customization modal not found!');
        return;
    }

    // Initialize global flags if needed
    const flagConfig = initializeGlobalFlags();

    // Update each corner's configuration
    Object.keys(FLAG_POSITIONS).forEach(key => {
        const position = FLAG_POSITIONS[key];
        updateFlagCornerUI(position, flagConfig[position]);
    });

    // Show modal
    modal.style.display = 'flex';
}

// Close the flag modal
export function closeFlagModal() {
    const modal = document.getElementById('flag-customization-modal');
    modal.style.display = 'none';
    currentMarkerTypeForFlags = null;
}

// Update the UI for a specific flag corner
function updateFlagCornerUI(position, config) {
    // Update name input
    const nameInput = document.querySelector(`.ms-flag-name-input[data-position="${position}"]`);
    if (nameInput) {
        nameInput.value = config.name || '';
    }

    // Update symbol display
    const symbolDisplay = document.querySelector(
        `.ms-flag-symbol-display[data-position="${position}"]`
    );
    if (symbolDisplay) {
        const symbolInfo = getSymbolInfo(config.symbol);

        // Check if it's a custom icon (base64 data URL)
        if (symbolInfo && symbolInfo.isCustom) {
            symbolDisplay.innerHTML = `<img src="${symbolInfo.symbol}" alt="${symbolInfo.label}">`;
            symbolDisplay.classList.add('ms-flag-active');
        } else if (symbolInfo && symbolInfo.symbol) {
            symbolDisplay.textContent = symbolInfo.symbol;
            symbolDisplay.classList.add('ms-flag-active');
        } else {
            symbolDisplay.textContent = '';
            symbolDisplay.classList.remove('ms-flag-active');
        }
    }
}

// Handle symbol navigation
export function handleFlagSymbolNavigation(position, direction) {
    // No longer checking for current marker type since flags are global

    const flagConfig = appState.globalFlagConfiguration;
    if (!flagConfig || !flagConfig[position]) return;

    const currentSymbol = flagConfig[position].symbol;
    const newSymbol =
        direction === 'next' ? getNextSymbol(currentSymbol) : getPreviousSymbol(currentSymbol);

    flagConfig[position].symbol = newSymbol;
    updateFlagCornerUI(position, flagConfig[position]);
}

// Save flag configuration
export async function saveFlagConfiguration() {
    // No longer checking for current marker type since flags are global

    const flagConfig = appState.globalFlagConfiguration;
    if (!flagConfig) return;

    // Update names from inputs
    Object.keys(FLAG_POSITIONS).forEach(key => {
        const position = FLAG_POSITIONS[key];
        const nameInput = document.querySelector(
            `.ms-flag-name-input[data-position="${position}"]`
        );
        if (nameInput) {
            flagConfig[position].name = nameInput.value || `Flag ${key + 1}`;
        }
    });

    // Trigger update of all dots with this marker type
    updateAllDotsWithMarkerType(currentMarkerTypeForFlags);

    // Mark project as dirty since flag configuration changed
    const { setDirtyState } = await import('./state.js');
    setDirtyState();

    closeFlagModal();
}

// Apply flag configuration to all marker types
// DEPRECATED - no longer needed with global flags
export function applyFlagConfigToAll() {
    // This function is no longer needed since flags are global
    // Just save and close
    saveFlagConfiguration();
    closeFlagModal();
}

// Update all dots with a specific marker type
function updateAllDotsWithMarkerType(markerTypeCode) {
    renderDotsForCurrentPage();
}

// Update all dots
function updateAllDots() {
    renderDotsForCurrentPage();
}

// Resize image if it's too large
function resizeImage(dataUrl, maxSize, callback) {
    const img = new Image();
    img.onload = function () {
        // Calculate new dimensions (max 256x256 for icons)
        let width = img.width;
        let height = img.height;
        const maxDimension = 256;

        if (width > maxDimension || height > maxDimension) {
            if (width > height) {
                height = (height / width) * maxDimension;
                width = maxDimension;
            } else {
                width = (width / height) * maxDimension;
                height = maxDimension;
            }
        }

        // Create canvas and resize
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Try different quality levels to get under maxSize
        let quality = 0.9;
        let resizedDataUrl = canvas.toDataURL('image/jpeg', quality);

        // Reduce quality until file size is acceptable
        while (resizedDataUrl.length > maxSize && quality > 0.1) {
            quality -= 0.1;
            resizedDataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        // If still too large, reduce dimensions
        if (resizedDataUrl.length > maxSize) {
            canvas.width = width * 0.5;
            canvas.height = height * 0.5;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resizedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        }

        callback(resizedDataUrl);
    };
    img.src = dataUrl;
}

// Handle custom icon upload
export function handleCustomIconUpload(position, file) {
    if (!file) return;

    // Validate file type
    if (!ALLOWED_ICON_TYPES.includes(file.type)) {
        alert('Please upload a valid image file (PNG, JPG, SVG, GIF, or WebP)');
        return;
    }

    // Read file and process
    const reader = new FileReader();
    reader.onload = function (e) {
        const processIcon = dataUrl => {
            // Generate unique ID for the custom icon
            const iconId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const iconName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension

            // Add to custom icon library if not already there
            const existingIcon = appState.customIconLibrary.find(icon => icon.data === dataUrl);

            if (!existingIcon) {
                appState.customIconLibrary.push({
                    id: iconId,
                    name: iconName,
                    data: dataUrl
                });
            }

            // Set the symbol to the custom icon ID
            const flagConfig = appState.globalFlagConfiguration;
            if (flagConfig && flagConfig[position]) {
                flagConfig[position].symbol = existingIcon ? existingIcon.id : iconId;
                updateFlagCornerUI(position, flagConfig[position]);
            }
        };

        // Check if file needs resizing (>1MB when encoded)
        const dataUrl = e.target.result;
        const maxBase64Size = 1024 * 1024 * 1.37; // ~1MB (base64 is ~37% larger)

        if (dataUrl.length > maxBase64Size) {
            // Resize the image
            resizeImage(dataUrl, maxBase64Size, processIcon);
        } else {
            processIcon(dataUrl);
        }
    };
    reader.readAsDataURL(file);
}

// Initialize event listeners
export function initializeFlagUI() {
    // Close button
    const closeBtn = document.querySelector('#flag-customization-modal .ms-modal-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeFlagModal);
    }

    // Save button
    const saveBtn = document.getElementById('flag-save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveFlagConfiguration);
    }

    // Apply to all button - DEPRECATED with global flags
    // const applyAllBtn = document.getElementById('flag-apply-all-btn');
    // if (applyAllBtn) {
    //     applyAllBtn.addEventListener('click', applyFlagConfigToAll);
    // }

    // Symbol navigation buttons
    document.querySelectorAll('.ms-flag-prev-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const position = e.target.dataset.position;
            handleFlagSymbolNavigation(position, 'prev');
        });
    });

    document.querySelectorAll('.ms-flag-next-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const position = e.target.dataset.position;
            handleFlagSymbolNavigation(position, 'next');
        });
    });

    // Name input changes
    document.querySelectorAll('.ms-flag-name-input').forEach(input => {
        input.addEventListener('input', e => {
            // No longer checking for current marker type since flags are global
            const position = e.target.dataset.position;
            const flagConfig = appState.globalFlagConfiguration;
            if (flagConfig && flagConfig[position]) {
                flagConfig[position].name = e.target.value;
            }
        });
    });

    // Upload button clicks
    document.querySelectorAll('.ms-flag-upload-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const position = e.target.dataset.position;
            const fileInput = document.querySelector(
                `.ms-flag-upload-input[data-position="${position}"]`
            );
            if (fileInput) {
                fileInput.click();
            }
        });
    });

    // File input changes
    document.querySelectorAll('.ms-flag-upload-input').forEach(input => {
        input.addEventListener('change', e => {
            const position = e.target.dataset.position;
            const file = e.target.files[0];
            if (file) {
                handleCustomIconUpload(position, file);
            }
        });
    });

    // Click outside to close
    const modal = document.getElementById('flag-customization-modal');
    if (modal) {
        modal.addEventListener('click', e => {
            if (e.target === modal) {
                closeFlagModal();
            }
        });
    }
}

// Export functions for global access
window.openFlagModal = openFlagModal;
window.closeFlagModal = closeFlagModal;

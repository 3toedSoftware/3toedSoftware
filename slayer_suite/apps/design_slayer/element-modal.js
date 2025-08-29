// element-modal.js - Element Properties Modal functionality
import { state, updateState, updateElement } from './state.js';
import { LAYER_DEFINITIONS } from './config.js';

let currentEditingElement = null;

export function initializeElementModal() {
    const modal = document.getElementById('element-properties-modal');
    if (!modal) return;

    // Close modal handlers
    const closeBtn = modal.querySelector('.ds-close-modal');
    const cancelBtn = document.getElementById('modal-cancel-btn');
    const applyBtn = document.getElementById('modal-apply-btn');

    closeBtn?.addEventListener('click', closeModal);
    cancelBtn?.addEventListener('click', closeModal);
    applyBtn?.addEventListener('click', applyChanges);

    // Click outside to close
    modal.addEventListener('click', e => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // Setup texture upload handlers
    setupTextureUpload();

    // Setup alignment buttons
    setupAlignmentButtons();
}

function setupTextureUpload() {
    const square = document.getElementById('texture-upload-square');
    const fileInput = document.getElementById('texture-file-input');
    const deleteBtn = square?.querySelector('.ds-texture-delete');

    if (!square || !fileInput) return;

    square.addEventListener('click', e => {
        if (!e.target.classList.contains('ds-texture-delete')) {
            fileInput.click();
        }
    });

    fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
            handleTextureUpload(file);
        }
        e.target.value = null; // Reset input
    });

    deleteBtn?.addEventListener('click', e => {
        e.stopPropagation();
        clearTexture();
    });
}

function handleTextureUpload(file) {
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file (PNG, BMP, or JPEG).');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert('Image file is too large. Please use an image smaller than 5MB.');
        return;
    }

    const reader = new FileReader();

    reader.onload = e => {
        const dataUrl = e.target.result;
        displayTexture(dataUrl);
    };

    reader.onerror = () => {
        alert('Failed to read the image file.');
    };

    reader.readAsDataURL(file);
}

function displayTexture(dataUrl) {
    const square = document.getElementById('texture-upload-square');
    const emptyDiv = square?.querySelector('.ds-texture-empty');
    const filledDiv = square?.querySelector('.ds-texture-filled');
    const thumbnail = filledDiv?.querySelector('.ds-texture-thumbnail');

    if (emptyDiv && filledDiv && thumbnail) {
        thumbnail.src = dataUrl;
        emptyDiv.style.display = 'none';
        filledDiv.style.display = 'block';
    }
}

function clearTexture() {
    const square = document.getElementById('texture-upload-square');
    const emptyDiv = square?.querySelector('.ds-texture-empty');
    const filledDiv = square?.querySelector('.ds-texture-filled');
    const thumbnail = filledDiv?.querySelector('.ds-texture-thumbnail');

    if (emptyDiv && filledDiv && thumbnail) {
        thumbnail.src = '';
        emptyDiv.style.display = 'flex';
        filledDiv.style.display = 'none';
    }
}

function setupAlignmentButtons() {
    const buttons = document.querySelectorAll('.ds-align-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            // Clear all active states
            buttons.forEach(b => b.classList.remove('active'));
            // Set this button as active
            btn.classList.add('active');
        });
    });
}

export function openElementModal(element) {
    if (!element) return;

    currentEditingElement = element;
    const modal = document.getElementById('element-properties-modal');

    // Set modal title
    document.getElementById('element-modal-title').textContent =
        `${element.name || element.type} Properties`;

    // Populate basic properties
    document.getElementById('modal-element-name').value = element.name || '';
    document.getElementById('modal-element-type').textContent = element.type || '';
    document.getElementById('modal-element-depth').value = element.elementDepth || 1;

    // Populate material properties
    document.getElementById('modal-material-description').value = element.materialDescription || '';
    document.getElementById('modal-element-thickness').value = (element.thickness || 0).toFixed(1);

    // Handle texture
    if (element.textureReference) {
        displayTexture(element.textureReference);
    } else {
        clearTexture();
    }

    // Get layer definition
    const definition = LAYER_DEFINITIONS[element.type];

    // Handle dimensions section
    const dimensionsSection = document.getElementById('modal-dimensions-section');
    const textSection = document.getElementById('modal-text-section');

    if (definition?.isText) {
        // Hide dimensions for text elements
        dimensionsSection.style.display = 'none';
        textSection.style.display = 'block';

        // Populate text properties
        const fontSelect = document.getElementById('modal-element-font');
        // Generate font options inline
        const fonts = [
            'Arial',
            'Arial Black',
            'Helvetica',
            'Times New Roman',
            'Georgia',
            'Verdana',
            'Courier New'
        ];
        fontSelect.innerHTML = fonts
            .map(
                font =>
                    `<option value="${font}" ${font === (element.font || definition.defaultFont) ? 'selected' : ''}>${font}</option>`
            )
            .join('');
        fontSelect.value = element.font || definition.defaultFont;

        document.getElementById('modal-element-fontsize').value =
            element.fontSize || definition.defaultFontSize || 24;

        // Set alignment
        const alignButtons = textSection.querySelectorAll('.ds-align-btn');
        alignButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.align === (element.textAlign || 'left')) {
                btn.classList.add('active');
            }
        });
    } else {
        // Show dimensions for non-text elements
        dimensionsSection.style.display = 'block';
        textSection.style.display = 'none';

        document.getElementById('modal-element-width').value = (element.width || 100).toFixed(1);
        document.getElementById('modal-element-height').value = (element.height || 100).toFixed(1);
    }

    // Show modal
    modal.style.display = 'block';
}

function closeModal() {
    const modal = document.getElementById('element-properties-modal');
    modal.style.display = 'none';
    currentEditingElement = null;
}

function applyChanges() {
    if (!currentEditingElement) return;

    const updates = {};

    // Get basic properties
    updates.name = document.getElementById('modal-element-name').value;
    updates.elementDepth = parseInt(document.getElementById('modal-element-depth').value) || 1;

    // Get material properties
    updates.materialDescription = document.getElementById('modal-material-description').value;
    updates.thickness = parseFloat(document.getElementById('modal-element-thickness').value) || 0;

    // Get texture
    const thumbnail = document.querySelector('.ds-texture-thumbnail');
    if (thumbnail?.src && thumbnail.src.startsWith('data:')) {
        updates.textureReference = thumbnail.src;
    } else if (currentEditingElement.textureReference) {
        // Keep existing texture if not changed
        updates.textureReference = currentEditingElement.textureReference;
    } else {
        updates.textureReference = null;
    }

    // Get dimensions or text properties
    const definition = LAYER_DEFINITIONS[currentEditingElement.type];
    if (definition?.isText) {
        updates.font = document.getElementById('modal-element-font').value;
        updates.fontSize = parseFloat(document.getElementById('modal-element-fontsize').value);

        const activeAlignBtn = document.querySelector('.ds-align-btn.active');
        if (activeAlignBtn) {
            updates.textAlign = activeAlignBtn.dataset.align;
        }
    } else {
        updates.width = parseFloat(document.getElementById('modal-element-width').value) || 100;
        updates.height = parseFloat(document.getElementById('modal-element-height').value) || 100;
    }

    // Apply updates to element
    updateElement(currentEditingElement.id, updates);

    // Update UI - get the app instance to access event handlers
    const designApp = window.designSlayerApp;
    if (designApp && designApp.eventHandlers) {
        import('./ui.js').then(({ refreshElementList }) => {
            refreshElementList(designApp.eventHandlers);
        });
    }

    // Update canvas if element is on it
    if (currentEditingElement && currentEditingElement.onCanvas) {
        import('./design-svg.js').then(({ designSVG }) => {
            // Pass the updated element with all its properties
            const updatedElement = state.elementsList.find(
                el => el && el.id === currentEditingElement.id
            );
            if (updatedElement) {
                designSVG.updateElement(updatedElement);
            }
        });
    }

    // Mark as dirty
    updateState({ isDirty: true });

    // Close modal
    closeModal();
}

// Export function to setup right-click handlers
export function setupElementRightClick() {
    // Add right-click handler to element list items
    document.addEventListener('contextmenu', e => {
        // Don't interfere with other UI elements
        if (
            e.target.closest(
                '.property-input, .element-properties, .element-actions, button, select, input'
            )
        ) {
            return;
        }

        // Check if right-clicking on an element row
        const elementRow = e.target.closest('.element-row');
        if (elementRow) {
            e.preventDefault();
            const elementId = parseInt(elementRow.dataset.elementId);
            const element = state.elementsList.find(el => el.id === elementId);
            if (element) {
                openElementModal(element);
            }
            return;
        }

        // Check if right-clicking on a canvas element
        const svgElement = e.target.closest('[data-element-id]');
        if (svgElement && svgElement.closest('#face-viewport, #face-canvas')) {
            e.preventDefault();
            // Get element ID from the attribute
            const elementIdAttr = svgElement.getAttribute('data-element-id');
            const elementId = parseInt(elementIdAttr);
            const element = state.elementsList.find(el => el.id === elementId);
            if (element) {
                openElementModal(element);
            }
            return;
        }
    });
}

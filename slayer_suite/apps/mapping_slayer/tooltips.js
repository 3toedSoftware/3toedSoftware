// tooltips.js - Tooltip management for Mapping Slayer

const TooltipManager = {
    isEnabled: false,
    tooltips: [],
    activeTooltip: null,
    showTimeout: null,

    init() {
        this.createTooltipDefinitions();
        this.setupEventListeners();

        // Check if tooltips were previously enabled
        try {
            const savedState = sessionStorage.getItem('mapping-slayer-tooltips-enabled');
            if (savedState === 'true') {
                this.enable();
            }
        } catch (e) {
            // Ignore if sessionStorage not available
        }
    },

    createTooltipDefinitions() {
        this.tooltips = [
            // Header controls
            {
                selector: '#find-input',
                text: 'Search for location numbers or messages on the current page. Press Enter to cycle through results.',
                position: 'bottom'
            },
            {
                selector: '#replace-input',
                text: 'Enter replacement text. Will replace in selected locations only.',
                position: 'bottom'
            },
            {
                selector: '#find-all-btn',
                text: 'Select all locations that match the find text on the current page.',
                position: 'bottom'
            },
            {
                selector: '#replace-btn',
                text: 'Replace find text with replacement text in all selected locations.',
                position: 'bottom'
            },

            // Left panel - Marker Types
            {
                selector: '#add-marker-type-btn',
                text: 'Create a new marker type for categorizing your location dots. Each type has a unique code, name, and color.',
                position: 'right'
            },
            {
                selector: '.marker-type-code-input',
                text: 'Enter a short code for this marker type (e.g., "FD" for Fire Door). This appears on the dots.',
                position: 'right'
            },
            {
                selector: '.marker-type-name-input',
                text: 'Enter a descriptive name for this marker type (e.g., "Fire Door"). This appears in legends and exports.',
                position: 'right'
            },
            {
                selector: '.design-reference-square',
                text: 'Upload a reference image for this marker type. Images will appear in PDF exports and help with installation.',
                position: 'right'
            },
            {
                selector: '.color-picker-wrapper',
                text: 'Set the color for dots of this marker type.',
                position: 'right'
            },
            {
                selector: '.delete-marker-type-btn',
                text: 'Delete this marker type and all associated dots from the entire project.',
                position: 'right'
            },

            // Left panel - List section
            {
                selector: '#toggle-view-btn',
                text: 'Switch between a flat list of all locations and a grouped view organized by marker type.',
                position: 'right'
            },
            {
                selector: '#all-pages-checkbox',
                text: 'Show locations from all pages in the list, or just the current page.',
                position: 'right'
            },

            // Map controls
            {
                selector: '#help-btn',
                text: 'View all keyboard shortcuts and mouse controls for faster navigation.',
                position: 'bottom'
            },
            {
                selector: '#guide-btn',
                text: 'Open the complete user guide in a new tab. Contains detailed instructions for all features.',
                position: 'bottom'
            },
            {
                selector: '#toggle-messages-btn',
                text: 'Show or hide message 1 text on the map dots. Hiding them can reduce visual clutter.',
                position: 'bottom'
            },
            {
                selector: '#toggle-messages2-btn',
                text: 'Show or hide message 2 text on the map dots.',
                position: 'bottom'
            },
            {
                selector: '#toggle-locations-btn',
                text: 'Show or hide location numbers on the map dots.',
                position: 'bottom'
            },
            {
                selector: '#renumber-btn',
                text: 'Renumber location dots automatically based on their position or marker type grouping.',
                position: 'bottom'
            },
            // Tolerance controls
            {
                selector: '#h-tolerance-input',
                text: 'Horizontal tolerance for text scraping. Lower values group text more tightly.',
                position: 'right'
            },
            {
                selector: '#v-tolerance-input',
                text: 'Vertical tolerance for text scraping. Lower values create more rows.',
                position: 'right'
            },
            {
                selector: '.page-nav',
                text: 'Navigate between PDF pages. You can also use Page Up/Page Down keys.',
                position: 'top'
            },
            {
                selector: '#page-label-input',
                text: 'Enter a custom label for this page (e.g., "First Floor", "A-101"). Labels appear in exports and legends.',
                position: 'top'
            },

            // Footer controls - Automap
            {
                selector: '#automap-marker-type-select',
                text: 'Choose which marker type to use for automatically placed dots.',
                position: 'top'
            },
            {
                selector: '#automap-text-input',
                text: 'Enter text to find in the PDF. The system will automatically place dots on matching text.',
                position: 'top'
            },
            {
                selector: '#automap-exact-phrase',
                text: 'When checked, finds exact phrase matches. When unchecked, finds text containing your search term.',
                position: 'top'
            },
            {
                selector: '#single-automap-btn',
                text: 'Start the automatic mapping process. Only works with PDFs that have live text (not scanned images).',
                position: 'top'
            },

            // Footer controls - Size and export
            {
                selector: '#dot-size-slider',
                text: 'Adjust the size of all location dots on the map.',
                position: 'top'
            },
            {
                selector: '#create-pdf-btn',
                text: 'Export annotated PDF with location dots, legends, and optional detail pages for each location.',
                position: 'top'
            },
            {
                selector: '#create-schedule-btn',
                text: 'Export a CSV spreadsheet with all location data for use in other applications.',
                position: 'top'
            },
            {
                selector: '#update-from-schedule-btn',
                text: 'Import changes from a CSV file to update location messages and properties in bulk.',
                position: 'top'
            },
            {
                selector: '#export-fdf-btn',
                text: 'Export annotations in Bluebeam Revu BAX format for importing into Revu projects.',
                position: 'top'
            },

            // Left panel - List section toggle
            {
                selector: '#sort-toggle-btn',
                text: 'Toggle between sorting by location number or by marker type name.',
                position: 'right'
            },

            // Location list items
            {
                selector: '.location-item',
                text: 'Click to select and center on this location. Right-click to edit. Shift+click to select multiple.',
                position: 'right'
            },
            {
                selector: '.grouped-location-item',
                text: 'Click to select and center on this location. Right-click to edit. Shift+click to select multiple.',
                position: 'right'
            },
            {
                selector: '.location-message-input',
                text: 'Edit the message for this location. Changes are saved automatically.',
                position: 'right'
            },

            // Map dots
            {
                selector: '.ms-map-dot',
                text: 'Location dot. Click to select, drag to move. Hold Shift and click to select multiple. Right-click to edit.',
                position: 'top'
            }
        ];
    },

    setupEventListeners() {
        // Add event listeners for tooltip triggers
        document.addEventListener('mouseenter', this.handleMouseEnter.bind(this), true);
        document.addEventListener('mouseleave', this.handleMouseLeave.bind(this), true);
        document.addEventListener('click', this.handleClick.bind(this), true);
    },

    enable() {
        this.isEnabled = true;
        document.body.classList.add('ms-tooltips-enabled');

        // Save state
        try {
            sessionStorage.setItem('mapping-slayer-tooltips-enabled', 'true');
        } catch (e) {
            // Ignore if sessionStorage not available
        }

        this.updateToggleButton();
    },

    disable() {
        this.isEnabled = false;
        document.body.classList.remove('ms-tooltips-enabled');
        this.hideTooltip();

        // Save state
        try {
            sessionStorage.setItem('mapping-slayer-tooltips-enabled', 'false');
        } catch (e) {
            // Ignore if sessionStorage not available
        }

        this.updateToggleButton();
    },

    toggle() {
        if (this.isEnabled) {
            this.disable();
        } else {
            this.enable();
        }
    },

    updateToggleButton() {
        const button = document.getElementById('tooltips-btn');
        if (button) {
            button.textContent = this.isEnabled ? 'TOOL TIPS ON' : 'TOOL TIPS OFF';
            button.classList.toggle('ms-active', this.isEnabled);
        }
    },

    handleMouseEnter(e) {
        if (!this.isEnabled) return;

        // Ensure target is an Element
        if (!e.target || typeof e.target.closest !== 'function') return;

        // Check if the target or any parent matches a tooltip selector
        const element = e.target.closest(this.tooltips.map(t => t.selector).join(','));
        if (!element) return;

        // Find the matching tooltip definition
        const tooltip = this.tooltips.find(t => element.matches(t.selector));
        if (!tooltip) return;

        // Don't show tooltip if element is disabled
        if (element.disabled) return;

        // Don't show tooltip on input elements that are focused
        if (
            (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') &&
            element === document.activeElement
        ) {
            return;
        }

        // Delay before showing tooltip
        clearTimeout(this.showTimeout);
        this.showTimeout = setTimeout(() => {
            this.showTooltip(element, tooltip);
        }, 500);
    },

    handleMouseLeave(e) {
        if (!this.isEnabled) return;

        clearTimeout(this.showTimeout);

        // Ensure target is an Element
        if (!e.target || typeof e.target.closest !== 'function') return;

        // Only hide if we're leaving the element that has the tooltip
        const element = e.target.closest(this.tooltips.map(t => t.selector).join(','));
        if (element && this.activeTooltip && this.activeTooltip.element === element) {
            setTimeout(() => {
                this.hideTooltip();
            }, 100);
        }
    },

    handleClick(e) {
        if (!this.isEnabled) return;

        // Hide tooltip on click unless clicking the tooltip itself
        if (!e.target.closest('.ms-tooltip-popup')) {
            this.hideTooltip();
        }
    },

    showTooltip(element, tooltipDef) {
        if (!this.isEnabled) return;

        this.hideTooltip();

        const tooltip = document.createElement('div');
        tooltip.className = 'ms-tooltip-popup';
        tooltip.textContent = tooltipDef.text;
        document.body.appendChild(tooltip);

        this.positionTooltip(tooltip, element, tooltipDef.position);

        // Show with animation
        setTimeout(() => {
            tooltip.classList.add('ms-visible');
        }, 10);

        this.activeTooltip = {
            element: element,
            tooltip: tooltip
        };
    },

    positionTooltip(tooltip, element, position) {
        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const spacing = 8;

        let left, top;

        switch (position) {
            case 'top':
                left = rect.left + rect.width / 2 - tooltipRect.width / 2;
                top = rect.top - tooltipRect.height - spacing;
                tooltip.setAttribute('data-position', 'top');
                break;
            case 'bottom':
                left = rect.left + rect.width / 2 - tooltipRect.width / 2;
                top = rect.bottom + spacing;
                tooltip.setAttribute('data-position', 'bottom');
                break;
            case 'left':
                left = rect.left - tooltipRect.width - spacing;
                top = rect.top + rect.height / 2 - tooltipRect.height / 2;
                tooltip.setAttribute('data-position', 'left');
                break;
            case 'right':
                left = rect.right + spacing;
                top = rect.top + rect.height / 2 - tooltipRect.height / 2;
                tooltip.setAttribute('data-position', 'right');
                break;
            case 'center':
            default:
                left = rect.left + rect.width / 2 - tooltipRect.width / 2;
                top = rect.bottom + spacing;
                tooltip.setAttribute('data-position', 'bottom');
                break;
        }

        // Keep tooltip in viewport
        left = Math.max(10, Math.min(left, viewportWidth - tooltipRect.width - 10));
        top = Math.max(10, Math.min(top, viewportHeight - tooltipRect.height - 10));

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    },

    hideTooltip() {
        if (this.activeTooltip) {
            this.activeTooltip.tooltip.classList.remove('ms-visible');
            setTimeout(() => {
                if (this.activeTooltip && this.activeTooltip.tooltip.parentNode) {
                    this.activeTooltip.tooltip.remove();
                }
                this.activeTooltip = null;
            }, 200);
        }
    }
};

export { TooltipManager };

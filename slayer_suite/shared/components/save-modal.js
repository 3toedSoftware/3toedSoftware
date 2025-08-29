/**
 * Save Status Modal Component
 * Shows save/load status with app-specific details
 */

export class SaveModal {
    constructor() {
        this.modalElement = null;
        this.overlay = null;
    }

    /**
     * Create and show the save status modal
     * @param {Object} saveStatus - Status for each app
     * @param {Function} onConfirm - Callback when user confirms
     * @param {Function} onCancel - Callback when user cancels
     */
    show(saveStatus, onConfirm, onCancel) {
        this.createModal(saveStatus, onConfirm, onCancel);
        document.body.appendChild(this.overlay);
    }

    /**
     * Create the modal HTML
     */
    createModal(saveStatus, onConfirm, onCancel) {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        // Create modal
        this.modalElement = document.createElement('div');
        this.modalElement.style.cssText = `
            background: #333537;
            border: 1px solid #555;
            border-radius: 8px;
            padding: 30px;
            max-width: 500px;
            width: 90%;
            color: white;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        `;

        // Create content
        const hasIssues = Object.values(saveStatus).some(status => status !== 'saved');

        let html = `
            <h2 style="color: #f07727; margin-bottom: 20px;">
                ${hasIssues ? '⚠️ Save Status' : '✅ Save Complete'}
            </h2>
            <div style="margin-bottom: 20px;">
                ${
    hasIssues
        ? 'Some apps encountered issues while saving:'
        : 'All apps saved successfully!'
}
            </div>
            <div style="margin-bottom: 20px;">
        `;

        // Add app status list
        for (const [appName, status] of Object.entries(saveStatus)) {
            const displayName = this.formatAppName(appName);
            const icon = this.getStatusIcon(status);
            const color = this.getStatusColor(status);

            html += `
                <div style="display: flex; align-items: center; padding: 10px; 
                            background: #2a2a2a; margin-bottom: 5px; border-radius: 4px;">
                    <span style="font-size: 20px; margin-right: 10px;">${icon}</span>
                    <span style="flex: 1;">${displayName}</span>
                    <span style="color: ${color}; font-weight: bold;">
                        ${this.getStatusText(status)}
                    </span>
                </div>
            `;
        }

        html += `
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                ${
    hasIssues
        ? `
                    <button id="save-modal-cancel" style="
                        padding: 8px 20px;
                        background: #6c757d;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                    ">Cancel</button>
                `
        : ''
}
                <button id="save-modal-confirm" style="
                    padding: 8px 20px;
                    background: #f07727;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: bold;
                ">${hasIssues ? 'Save Anyway' : 'OK'}</button>
            </div>
        `;

        this.modalElement.innerHTML = html;
        this.overlay.appendChild(this.modalElement);

        // Add event listeners
        const confirmBtn = this.modalElement.querySelector('#save-modal-confirm');
        confirmBtn.addEventListener('click', () => {
            this.close();
            if (onConfirm) onConfirm();
        });

        const cancelBtn = this.modalElement.querySelector('#save-modal-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.close();
                if (onCancel) onCancel();
            });
        }

        // Close on overlay click
        this.overlay.addEventListener('click', e => {
            if (e.target === this.overlay) {
                this.close();
                if (onCancel) onCancel();
            }
        });
    }

    /**
     * Format app name for display
     */
    formatAppName(appName) {
        return appName
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Get icon for status
     */
    getStatusIcon(status) {
        switch (status) {
            case 'saved':
                return '✅';
            case 'preserved':
                return '📋';
            case 'failed':
                return '❌';
            default:
                return '❓';
        }
    }

    /**
     * Get color for status
     */
    getStatusColor(status) {
        switch (status) {
            case 'saved':
                return '#00b360';
            case 'preserved':
                return '#f07727';
            case 'failed':
                return '#dc3545';
            default:
                return '#6c757d';
        }
    }

    /**
     * Get text for status
     */
    getStatusText(status) {
        switch (status) {
            case 'saved':
                return 'Saved';
            case 'preserved':
                return 'Preserved (Previous Data)';
            case 'failed':
                return 'Failed';
            default:
                return 'Unknown';
        }
    }

    /**
     * Close the modal
     */
    close() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
            this.modalElement = null;
        }
    }
}

// Create singleton instance
export const saveModal = new SaveModal();

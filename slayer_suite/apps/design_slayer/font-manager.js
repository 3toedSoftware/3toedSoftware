// font-manager.js - Font management system for Design Slayer

export class FontManager {
    constructor() {
        this.uploadedFonts = new Map();
        this.loadSavedFonts();
    }
    
    // Get all uploaded fonts
    getUploadedFonts() {
        return Array.from(this.uploadedFonts.keys());
    }
    
    // Upload and process font files
    async uploadFonts(files) {
        const results = [];
        
        for (const file of files) {
            if (this.isValidFontFile(file)) {
                try {
                    const result = await this.processFont(file);
                    results.push({ success: true, font: result, file: file.name });
                } catch (error) {
                    results.push({ success: false, error: error.message, file: file.name });
                }
            } else {
                results.push({ success: false, error: 'Invalid font file type', file: file.name });
            }
        }
        
        this.saveFontsToStorage();
        return results;
    }
    
    // Validate font file
    isValidFontFile(file) {
        const validExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
        const validTypes = [
            'font/ttf', 'font/otf', 'font/woff', 'font/woff2',
            'application/font-ttf', 'application/font-otf',
            'application/font-woff', 'application/x-font-ttf',
            'application/x-font-truetype', 'application/x-font-opentype'
        ];
        
        const hasValidExtension = validExtensions.some(ext => 
            file.name.toLowerCase().endsWith(ext)
        );
        
        // Some systems don't provide proper MIME types for fonts
        return hasValidExtension || validTypes.includes(file.type);
    }
    
    // Process uploaded font file
    async processFont(file) {
        const fontName = file.name.replace(/\.[^/.]+$/, "");
        const base64 = await this.fileToBase64(file);
        const fontFormat = this.getFontFormat(file.name);
        
        // Create and inject CSS font-face rule
        const fontFaceRule = `
            @font-face {
                font-family: '${fontName}';
                src: url('${base64}') format('${fontFormat}');
                font-display: swap;
            }
        `;
        
        this.injectFontCSS(fontFaceRule);
        
        // Store font info
        const fontData = {
            name: fontName,
            data: base64,
            format: fontFormat,
            originalName: file.name,
            uploadDate: new Date().toISOString()
        };
        
        this.uploadedFonts.set(fontName, fontData);
        
        return fontData;
    }
    
    // Convert file to base64
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    // Get font format from filename
    getFontFormat(filename) {
        const ext = filename.toLowerCase().split('.').pop();
        const formatMap = {
            'woff2': 'woff2',
            'woff': 'woff',
            'ttf': 'truetype',
            'otf': 'opentype'
        };
        return formatMap[ext] || 'truetype';
    }
    
    // Inject CSS font-face rules
    injectFontCSS(cssRule) {
        let styleSheet = document.getElementById('design-slayer-uploaded-fonts');
        if (!styleSheet) {
            styleSheet = document.createElement('style');
            styleSheet.id = 'design-slayer-uploaded-fonts';
            document.head.appendChild(styleSheet);
        }
        styleSheet.textContent += cssRule;
    }
    
    // Remove uploaded font
    removeFont(fontName) {
        if (this.uploadedFonts.has(fontName)) {
            this.uploadedFonts.delete(fontName);
            this.saveFontsToStorage();
            this.rebuildFontCSS();
            return true;
        }
        return false;
    }
    
    // Rebuild all font CSS rules
    rebuildFontCSS() {
        const styleSheet = document.getElementById('design-slayer-uploaded-fonts');
        if (styleSheet) {
            styleSheet.textContent = '';
            this.uploadedFonts.forEach((data, name) => {
                const fontFaceRule = `
                    @font-face {
                        font-family: '${name}';
                        src: url('${data.data}') format('${data.format}');
                        font-display: swap;
                    }
                `;
                styleSheet.textContent += fontFaceRule;
            });
        }
    }
    
    // Save fonts to localStorage
    saveFontsToStorage() {
        try {
            const fontData = {};
            this.uploadedFonts.forEach((data, name) => {
                fontData[name] = data;
            });
            localStorage.setItem('designSlayerUploadedFonts', JSON.stringify(fontData));
        } catch (error) {
            console.error('Error saving fonts to storage:', error);
            // If storage is full, we might want to notify the user
            if (error.name === 'QuotaExceededError') {
                console.warn('Storage quota exceeded. Some fonts may not persist between sessions.');
            }
        }
    }
    
    // Load fonts from localStorage
    loadSavedFonts() {
        try {
            const saved = localStorage.getItem('designSlayerUploadedFonts');
            if (saved) {
                const fontData = JSON.parse(saved);
                Object.entries(fontData).forEach(([name, data]) => {
                    this.uploadedFonts.set(name, data);
                    
                    // Reinject CSS
                    const fontFaceRule = `
                        @font-face {
                            font-family: '${name}';
                            src: url('${data.data}') format('${data.format}');
                            font-display: swap;
                        }
                    `;
                    this.injectFontCSS(fontFaceRule);
                });
            }
        } catch (error) {
            console.error('Error loading saved fonts:', error);
        }
    }
    
    // Clear all uploaded fonts
    clearAllUploadedFonts() {
        this.uploadedFonts.clear();
        this.saveFontsToStorage();
        this.rebuildFontCSS();
    }
    
    // Check if a font exists
    hasFont(fontName) {
        return this.uploadedFonts.has(fontName);
    }
    
    // Get font statistics
    getFontStats() {
        return {
            uploadedFonts: this.uploadedFonts.size,
            totalSize: this.calculateTotalSize()
        };
    }
    
    // Calculate total size of uploaded fonts
    calculateTotalSize() {
        let totalSize = 0;
        this.uploadedFonts.forEach(fontData => {
            // Rough estimate of base64 size
            totalSize += fontData.data.length;
        });
        return totalSize;
    }
    
    // Check if a font is available (either system or uploaded)
    isFontAvailable(fontName) {
        // Check uploaded fonts first
        if (this.hasFont(fontName)) {
            return true;
        }
        
        // Check system fonts using canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const testString = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        
        // Test with a baseline font
        context.font = '72px monospace';
        const baselineWidth = context.measureText(testString).width;
        
        // Test with the requested font
        context.font = `72px "${fontName}", monospace`;
        const testWidth = context.measureText(testString).width;
        
        // If widths are different, the font is available
        return testWidth !== baselineWidth;
    }
    
    // Get the best available font from a list of preferences
    getBestAvailableFont(preferredFonts, fallback = 'Arial') {
        for (const font of preferredFonts) {
            if (this.isFontAvailable(font)) {
                return font;
            }
        }
        return fallback;
    }
}

// Create singleton instance
export const fontManager = new FontManager();
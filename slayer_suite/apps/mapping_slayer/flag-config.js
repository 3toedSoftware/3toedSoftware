// flag-config.js - Customizable flag system for Mapping Slayer

// Allowed file types for custom icons
export const ALLOWED_ICON_TYPES = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/svg+xml',
    'image/gif',
    'image/webp'
];
export const ALLOWED_ICON_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp'];

// Available symbols/emojis for flag indicators
export const FLAG_SYMBOLS = [
    { symbol: '', label: 'None', value: null },
    { symbol: '⭐', label: 'Star', value: 'star' },
    { symbol: '❗', label: 'Exclamation', value: 'exclamation' },
    { symbol: '❓', label: 'Question', value: 'question' },
    { symbol: '✓', label: 'Check', value: 'check' },
    { symbol: '✗', label: 'X Mark', value: 'x' },
    { symbol: '⚠️', label: 'Warning', value: 'warning' },
    { symbol: '🔒', label: 'Lock', value: 'lock' },
    { symbol: '🔑', label: 'Key', value: 'key' },
    { symbol: '🚩', label: 'Flag', value: 'flag' },
    { symbol: '📍', label: 'Pin', value: 'pin' },
    { symbol: '🔴', label: 'Red Circle', value: 'red-circle' },
    { symbol: '🟡', label: 'Yellow Circle', value: 'yellow-circle' },
    { symbol: '🟢', label: 'Green Circle', value: 'green-circle' },
    { symbol: '🔵', label: 'Blue Circle', value: 'blue-circle' },
    { symbol: '⬆️', label: 'Up Arrow', value: 'up-arrow' },
    { symbol: '⬇️', label: 'Down Arrow', value: 'down-arrow' },
    { symbol: '➡️', label: 'Right Arrow', value: 'right-arrow' },
    { symbol: '⬅️', label: 'Left Arrow', value: 'left-arrow' },
    { symbol: '🔧', label: 'Wrench', value: 'wrench' },
    { symbol: '⚡', label: 'Lightning', value: 'lightning' },
    { symbol: '💡', label: 'Light Bulb', value: 'bulb' },
    { symbol: '📌', label: 'Pushpin', value: 'pushpin' },
    { symbol: '🎯', label: 'Target', value: 'target' },
    { symbol: '🏁', label: 'Checkered Flag', value: 'checkered' }
];

// Flag positions
export const FLAG_POSITIONS = {
    TOP_LEFT: 'topLeft',
    TOP_RIGHT: 'topRight',
    BOTTOM_LEFT: 'bottomLeft',
    BOTTOM_RIGHT: 'bottomRight'
};

// Default flag configuration for a marker type
export function getDefaultFlagConfig() {
    return {
        [FLAG_POSITIONS.TOP_LEFT]: {
            name: 'Flag 1',
            symbol: null,
            customIcon: null, // Base64 or URL for custom icon
            enabled: true
        },
        [FLAG_POSITIONS.TOP_RIGHT]: {
            name: 'Flag 2',
            symbol: null,
            customIcon: null,
            enabled: true
        },
        [FLAG_POSITIONS.BOTTOM_LEFT]: {
            name: 'Flag 3',
            symbol: null,
            customIcon: null,
            enabled: true
        },
        [FLAG_POSITIONS.BOTTOM_RIGHT]: {
            name: 'Flag 4',
            symbol: null,
            customIcon: null,
            enabled: true
        }
    };
}

// Get the next symbol in the cycle for a given position
export function getNextSymbol(currentSymbol) {
    // Build combined list of symbols and custom icons
    const allSymbols = getAllSymbols();
    const currentIndex = allSymbols.findIndex(s => s.value === currentSymbol);
    const nextIndex = (currentIndex + 1) % allSymbols.length;
    return allSymbols[nextIndex].value;
}

// Get the previous symbol in the cycle
export function getPreviousSymbol(currentSymbol) {
    // Build combined list of symbols and custom icons
    const allSymbols = getAllSymbols();
    const currentIndex = allSymbols.findIndex(s => s.value === currentSymbol);
    const prevIndex = currentIndex <= 0 ? allSymbols.length - 1 : currentIndex - 1;
    return allSymbols[prevIndex].value;
}

// Get symbol display info
export function getSymbolInfo(symbolValue) {
    const allSymbols = getAllSymbols();
    return allSymbols.find(s => s.value === symbolValue) || allSymbols[0];
}

// Initialize flag values for a dot (now stores boolean values)
export function initializeDotFlags() {
    return {
        [FLAG_POSITIONS.TOP_LEFT]: false,
        [FLAG_POSITIONS.TOP_RIGHT]: false,
        [FLAG_POSITIONS.BOTTOM_LEFT]: false,
        [FLAG_POSITIONS.BOTTOM_RIGHT]: false
    };
}

// Migrate old dot properties to new flag system
export function migrateDotToFlags(dot) {
    if (!dot.flags) {
        dot.flags = initializeDotFlags();

        // Migration no longer needed - vinylBacker and isCodeRequired have been removed
        // Installed is kept as a separate property, not migrated to flags
    }
    return dot;
}

// Get all symbols including custom icons
export function getAllSymbols() {
    const symbols = [...FLAG_SYMBOLS];

    // Add custom icons from the library
    if (window.appState && window.appState.customIconLibrary) {
        window.appState.customIconLibrary.forEach(icon => {
            symbols.push({
                symbol: icon.data, // Base64 data URL
                label: icon.name,
                value: icon.id,
                isCustom: true
            });
        });
    }

    return symbols;
}

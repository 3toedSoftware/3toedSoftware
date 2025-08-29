/**
 * Save Worker
 * Background worker for serializing and compressing large project data
 */

// Import pako for compression in worker context
importScripts('https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js');

let isProcessing = false;

/**
 * Process data in chunks to avoid blocking
 */
async function processChunked(data, chunkSize = 50) {
    const items = Array.isArray(data) ? data : Object.entries(data);
    const result = Array.isArray(data) ? [] : {};
    const totalItems = items.length;

    for (let i = 0; i < totalItems; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);

        if (Array.isArray(data)) {
            result.push(...chunk);
        } else {
            chunk.forEach(([key, value]) => {
                result[key] = value;
            });
        }

        // Report progress
        const progress = Math.min(100, Math.floor(((i + chunkSize) / totalItems) * 100));
        self.postMessage({
            type: 'progress',
            progress: progress,
            phase: 'serializing',
            processed: Math.min(i + chunkSize, totalItems),
            total: totalItems
        });

        // Yield to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    return result;
}

/**
 * Compress data using pako
 */
function compressData(jsonStr) {
    try {
        // Convert string to Uint8Array
        const textEncoder = new TextEncoder();
        const uint8Array = textEncoder.encode(jsonStr);

        // Compress with pako
        const compressed = pako.gzip(uint8Array);

        // Convert to base64 for JSON storage
        const base64 = btoa(String.fromCharCode.apply(null, compressed));

        return {
            compressed: true,
            data: base64,
            originalSize: jsonStr.length,
            compressedSize: compressed.length,
            ratio: Math.round((1 - compressed.length / jsonStr.length) * 100)
        };
    } catch (error) {
        console.error('Compression failed:', error);
        return null;
    }
}

/**
 * Handle serialize request
 */
async function handleSerialize(data, options = {}) {
    const { chunkSize = 50, compress = true, includeProgress = true } = options;

    try {
        isProcessing = true;

        // Phase 1: Process data in chunks
        if (includeProgress) {
            self.postMessage({ type: 'progress', phase: 'preparing', progress: 0 });
        }

        const processedData = await processChunked(data, chunkSize);

        // Phase 2: Stringify
        if (includeProgress) {
            self.postMessage({ type: 'progress', phase: 'stringifying', progress: 50 });
        }

        const jsonStr = JSON.stringify(processedData, null, 2);

        // Phase 3: Compress if needed and size is large
        let result = { data: jsonStr, compressed: false };

        if (compress && jsonStr.length > 1024 * 1024) {
            // 1MB threshold
            if (includeProgress) {
                self.postMessage({ type: 'progress', phase: 'compressing', progress: 75 });
            }

            const compressed = compressData(jsonStr);
            if (compressed) {
                result = compressed;
                console.log(
                    `Compressed ${compressed.originalSize} bytes to ${compressed.compressedSize} bytes (${compressed.ratio}% reduction)`
                );
            }
        }

        if (includeProgress) {
            self.postMessage({ type: 'progress', phase: 'complete', progress: 100 });
        }

        isProcessing = false;
        return result;
    } catch (error) {
        isProcessing = false;
        throw error;
    }
}

/**
 * Handle deserialize request
 */
async function handleDeserialize(data, options = {}) {
    try {
        isProcessing = true;

        let jsonStr = data;

        // Decompress if needed
        if (data.compressed && data.data) {
            self.postMessage({ type: 'progress', phase: 'decompressing', progress: 25 });

            // Convert base64 to Uint8Array
            const binaryString = atob(data.data);
            const uint8Array = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                uint8Array[i] = binaryString.charCodeAt(i);
            }

            // Decompress with pako
            const decompressed = pako.ungzip(uint8Array);
            const textDecoder = new TextDecoder();
            jsonStr = textDecoder.decode(decompressed);
        }

        self.postMessage({ type: 'progress', phase: 'parsing', progress: 50 });

        // Parse JSON
        const parsed = JSON.parse(jsonStr);

        self.postMessage({ type: 'progress', phase: 'complete', progress: 100 });

        isProcessing = false;
        return parsed;
    } catch (error) {
        isProcessing = false;
        throw error;
    }
}

/**
 * Message handler
 */
self.onmessage = async function (e) {
    const { id, type, data, options } = e.data;

    if (isProcessing) {
        self.postMessage({
            id,
            error: 'Worker is busy processing another request'
        });
        return;
    }

    try {
        let result;

        switch (type) {
            case 'serialize':
                result = await handleSerialize(data, options);
                break;

            case 'deserialize':
                result = await handleDeserialize(data, options);
                break;

            case 'ping':
                result = { pong: true };
                break;

            default:
                throw new Error(`Unknown operation: ${type}`);
        }

        self.postMessage({ id, result });
    } catch (error) {
        self.postMessage({
            id,
            error: error.message,
            stack: error.stack
        });
    }
};

// apps/test-app/test-app.js
import SlayerAppBase from '../../core/slayer-app-base.js';

class TestApp extends SlayerAppBase {
    constructor() {
        super('test_app', 'TEST APP', '1.0.0');
        this.testData = {
            counter: 0,
            items: []
        };
    }

    createAppContent() {
        const contentArea = this.getContentArea();
        contentArea.innerHTML = `
            <div style="padding: 40px; text-align: center;">
                <h2 style="color: #f07727; margin-bottom: 30px;">Test App Content</h2>
                
                <div style="background: #333; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #ccc; margin-bottom: 15px;">Counter Test</h3>
                    <div style="font-size: 24px; color: #f07727; margin: 10px 0;" id="counter-display">0</div>
                    <button id="increment-btn" style="background: #f07727; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 5px;">
                        Increment
                    </button>
                    <button id="decrement-btn" style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 5px;">
                        Decrement
                    </button>
                </div>

                <div style="background: #333; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #ccc; margin-bottom: 15px;">Items Test</h3>
                    <input type="text" id="item-input" placeholder="Enter item name..." style="padding: 8px; border: 1px solid #555; background: #444; color: white; border-radius: 4px; margin-right: 10px;">
                    <button id="add-item-btn" style="background: #00b360; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        Add Item
                    </button>
                    <ul id="items-list" style="text-align: left; margin-top: 15px; color: #ccc;">
                        <!-- Items will appear here -->
                    </ul>
                </div>

                <div style="background: #333; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #ccc; margin-bottom: 15px;">Cross-App Communication Test</h3>
                    <button id="test-broadcast-btn" style="background: #dc3545; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 5px;">
                        Send Test Broadcast
                    </button>
                    <div id="broadcast-log" style="background: #2a2a2a; padding: 10px; border-radius: 4px; margin-top: 10px; font-family: monospace; font-size: 12px; color: #aaa; text-align: left; max-height: 100px; overflow-y: auto;">
                        Waiting for events...
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
        this.updateDisplay();
    }

    setupEventListeners() {
        // Counter buttons
        this.container.querySelector('#increment-btn').addEventListener('click', () => {
            this.testData.counter++;
            this.updateDisplay();
        });

        this.container.querySelector('#decrement-btn').addEventListener('click', () => {
            this.testData.counter--;
            this.updateDisplay();
        });

        // Add item functionality
        const addItem = () => {
            const input = this.container.querySelector('#item-input');
            const itemName = input.value.trim();
            if (itemName) {
                this.testData.items.push({
                    id: Date.now(),
                    name: itemName,
                    created: new Date().toLocaleTimeString()
                });
                input.value = '';
                this.updateDisplay();
            }
        };

        this.container.querySelector('#add-item-btn').addEventListener('click', addItem);
        this.container.querySelector('#item-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') addItem();
        });

        // Broadcast test
        this.container.querySelector('#test-broadcast-btn').addEventListener('click', () => {
            import('../../core/app-bridge.js').then(({ appBridge }) => {
                appBridge.broadcast('test:message', { 
                    message: 'Hello from Test App!', 
                    timestamp: new Date().toLocaleTimeString(),
                    counter: this.testData.counter 
                });
            });
        });

        // Listen for app bridge events
        import('../../core/app-bridge.js').then(({ appBridge }) => {
            appBridge.subscribe('test:message', (data) => {
                this.logBroadcast(`Received: ${data.message} (${data.timestamp})`);
            });

            appBridge.subscribe('app:activated', (data) => {
                this.logBroadcast(`App activated: ${data.appName}`);
            });
        });
    }

    updateDisplay() {
        // Update counter
        const counterDisplay = this.container.querySelector('#counter-display');
        if (counterDisplay) {
            counterDisplay.textContent = this.testData.counter;
        }

        // Update items list
        const itemsList = this.container.querySelector('#items-list');
        if (itemsList) {
            itemsList.innerHTML = this.testData.items.map(item => 
                `<li style="margin: 5px 0; padding: 5px; background: #3a3a3a; border-radius: 3px;">
                    ${item.name} <span style="color: #666; font-size: 11px;">(${item.created})</span>
                </li>`
            ).join('');
        }
    }

    logBroadcast(message) {
        const log = this.container.querySelector('#broadcast-log');
        if (log) {
            const timestamp = new Date().toLocaleTimeString();
            log.innerHTML += `<div>[${timestamp}] ${message}</div>`;
            log.scrollTop = log.scrollHeight;
        }
    }

    // Required lifecycle methods
    exportData() {
        return {
            version: this.version,
            testData: this.testData,
            exported: new Date().toISOString()
        };
    }

    async importData(data) {
        if (data && data.testData) {
            this.testData = data.testData;
            this.updateDisplay();
        }
    }

    async handleDataRequest(fromApp, query) {
        if (query.type === 'get-counter') {
            return { counter: this.testData.counter };
        } else if (query.type === 'get-items') {
            return { items: this.testData.items };
        }
        return { error: 'Unknown query type' };
    }
}

export default TestApp;
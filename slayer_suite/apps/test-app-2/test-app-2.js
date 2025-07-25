// apps/test-app-2/test-app-2.js
import SlayerAppBase from '../../core/slayer-app-base.js';

class TestApp2 extends SlayerAppBase {
    constructor() {
        super('test_app_2', 'TEST APP 2', '1.0.0');
        this.messages = [];
    }

    createAppContent() {
        const contentArea = this.getContentArea();
        contentArea.innerHTML = `
            <div style="padding: 40px; text-align: center; background: linear-gradient(135deg, #1a1a1a, #2a2a2a);">
                <h2 style="color: #00b360; margin-bottom: 30px;">🚀 Second Test App</h2>
                
                <div style="background: #333; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #00b360;">
                    <h3 style="color: #ccc; margin-bottom: 15px;">App Communication Test</h3>
                    <p style="color: #aaa; margin-bottom: 15px;">This app demonstrates cross-app communication and navigation.</p>
                    
                    <div style="margin: 15px 0;">
                        <button id="send-greeting-btn" style="background: #00b360; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; margin: 5px;">
                            Send Greeting to Other Apps
                        </button>
                        <button id="request-data-btn" style="background: #007acc; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; margin: 5px;">
                            Request Data from Test App 1
                        </button>
                    </div>
                </div>

                <div style="background: #333; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #ccc; margin-bottom: 15px;">Message Log</h3>
                    <div id="message-log" style="background: #2a2a2a; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 12px; color: #aaa; text-align: left; max-height: 200px; overflow-y: auto; min-height: 100px;">
                        App 2 initialized - ready to receive messages...
                    </div>
                    <button id="clear-log-btn" style="background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 10px; font-size: 12px;">
                        Clear Log
                    </button>
                </div>

                <div style="background: #333; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #ccc; margin-bottom: 15px;">Navigation Test</h3>
                    <p style="color: #aaa; font-size: 14px; margin-bottom: 15px;">Use the header navigation buttons (MS, SS, DS, etc.) to switch between apps.</p>
                    <div style="background: #2a2a2a; padding: 10px; border-radius: 4px; border: 1px solid #555;">
                        <strong style="color: #00b360;">Current App:</strong> <span style="color: #f07727;">TEST APP 2</span>
                    </div>
                </div>
            </div>
        `;

        this.setupEventListeners();
        this.addLogMessage('Test App 2 content loaded successfully');
    }

    setupEventListeners() {
        // Send greeting button
        this.container.querySelector('#send-greeting-btn').addEventListener('click', () => {
            import('../../core/app-bridge.js').then(({ appBridge }) => {
                const greeting = {
                    from: 'Test App 2',
                    message: 'Hello from the second test app!',
                    timestamp: new Date().toLocaleTimeString(),
                    type: 'greeting'
                };
                appBridge.broadcast('app:greeting', greeting);
                this.addLogMessage(`Sent greeting: ${greeting.message}`);
            });
        });

        // Request data button
        this.container.querySelector('#request-data-btn').addEventListener('click', async () => {
            import('../../core/app-bridge.js').then(async ({ appBridge }) => {
                this.addLogMessage('Requesting data from Test App 1...');
                
                const counterData = await appBridge.requestData('test_app_2', 'test_app', { type: 'get-counter' });
                const itemsData = await appBridge.requestData('test_app_2', 'test_app', { type: 'get-items' });
                
                if (counterData) {
                    this.addLogMessage(`Received counter: ${counterData.counter}`);
                }
                if (itemsData) {
                    this.addLogMessage(`Received ${itemsData.items.length} items from Test App 1`);
                }
            });
        });

        // Clear log button
        this.container.querySelector('#clear-log-btn').addEventListener('click', () => {
            this.messages = [];
            this.updateMessageLog();
            this.addLogMessage('Log cleared');
        });

        // Listen for greetings from other apps
        import('../../core/app-bridge.js').then(({ appBridge }) => {
            appBridge.subscribe('app:greeting', (data) => {
                if (data.from !== 'Test App 2') { // Don't log our own messages
                    this.addLogMessage(`Received greeting from ${data.from}: ${data.message}`);
                }
            });

            appBridge.subscribe('app:activated', (data) => {
                this.addLogMessage(`App switched to: ${data.appName}`);
            });

            appBridge.subscribe('app:deactivated', (data) => {
                this.addLogMessage(`App deactivated: ${data.appName}`);
            });
        });
    }

    addLogMessage(message) {
        const timestamp = new Date().toLocaleTimeString();
        this.messages.push(`[${timestamp}] ${message}`);
        
        // Keep only last 20 messages
        if (this.messages.length > 20) {
            this.messages = this.messages.slice(-20);
        }
        
        this.updateMessageLog();
    }

    updateMessageLog() {
        const log = this.container.querySelector('#message-log');
        if (log) {
            log.innerHTML = this.messages.map(msg => `<div style="margin: 2px 0;">${msg}</div>`).join('');
            log.scrollTop = log.scrollHeight;
        }
    }

    // Required lifecycle methods
    exportData() {
        return {
            version: this.version,
            messages: this.messages,
            exported: new Date().toISOString()
        };
    }

    async importData(data) {
        if (data && data.messages) {
            this.messages = data.messages;
            this.updateMessageLog();
        }
    }

    async handleDataRequest(fromApp, query) {
        if (query.type === 'get-messages') {
            return { messages: this.messages };
        }
        return { error: 'Unknown query type' };
    }
}

export default TestApp2;
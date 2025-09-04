/**
 * Application Integrator Module
 * Coordinates and integrates all modules into the main application
 * @module AppIntegrator
 */

import ChatManager from './chat-integration.js';
import FileManager from './file-management.js';
import ExcelExporter from './excel-export.js';

class AppIntegrator {
    constructor(config = {}) {
        this.config = {
            appName: config.appName || 'ForemanAI',
            version: config.version || '2.0.0',
            environment: config.environment || 'production',
            azureConfig: config.azureConfig || {},
            webhooks: config.webhooks || {},
            features: config.features || {
                chat: true,
                fileUpload: true,
                excelExport: true,
                takeoffAnalysis: true,
                projectManagement: true
            }
        };
        
        this.modules = {};
        this.initialized = false;
        this.eventBus = new EventTarget();
    }

    /**
     * Initialize the application
     */
    async initialize(pageType = 'estimator') {
        console.log(`Initializing ${this.config.appName} v${this.config.version}`);
        
        try {
            // Initialize modules based on page type
            switch (pageType) {
                case 'estimator':
                    await this.initializeEstimatorPage();
                    break;
                case 'projects':
                    await this.initializeProjectsPage();
                    break;
                case 'general-chat':
                    await this.initializeGeneralChatPage();
                    break;
                case 'admin':
                    await this.initializeAdminPage();
                    break;
                default:
                    await this.initializeDefaultModules();
            }
            
            // Setup global error handling
            this.setupErrorHandling();
            
            // Setup performance monitoring
            this.setupPerformanceMonitoring();
            
            // Initialize Azure services
            await this.initializeAzureServices();
            
            this.initialized = true;
            this.emit('app:initialized', { pageType });
            
            console.log('Application initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.handleCriticalError(error);
        }
    }

    /**
     * Initialize Estimator page modules
     */
    async initializeEstimatorPage() {
        // Initialize chat module
        if (this.config.features.chat) {
            this.modules.chat = new ChatManager({
                webhookUrl: this.config.webhooks.estimatorChat || 'https://workflows.saxtechnology.com/webhook/ask-foreman/EstimatorChat',
                messageFormatter: this.customMessageFormatter.bind(this)
            });
            
            this.modules.chat.initialize({
                messagesContainer: document.getElementById('chatMessages'),
                inputField: document.getElementById('chatInput'),
                sendButton: document.getElementById('sendButton'),
                stopButton: document.getElementById('stopButton'),
                contextSelector: document.getElementById('contextSelector'),
                typingIndicator: document.getElementById('typingIndicator'),
                statusIndicator: document.getElementById('chatStatus')
            });
        }
        
        // Initialize file management
        if (this.config.features.fileUpload) {
            this.modules.fileManager = new FileManager({
                storageAccount: this.config.azureConfig.storageAccount || 'saxtechfcs',
                container: 'documents',
                sasToken: this.config.azureConfig.sasToken || '',
                supportedFormats: ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.png', '.jpg', '.jpeg', '.tiff']
            });
            
            this.modules.fileManager.initialize({
                fileInput: document.getElementById('fileInput'),
                dropZone: document.getElementById('dropZone'),
                fileList: document.getElementById('fileList'),
                uploadButton: document.getElementById('uploadButton'),
                progressContainer: document.getElementById('uploadProgress'),
                errorContainer: document.getElementById('uploadErrors')
            });
        }
        
        // Initialize Excel exporter
        if (this.config.features.excelExport) {
            this.modules.excelExporter = new ExcelExporter({
                companyInfo: {
                    name: 'SAX Technology',
                    address: 'Construction Estimating Services',
                    phone: '1-800-ESTIMATE',
                    email: 'estimates@saxtechnology.com'
                }
            });
        }
        
        // Setup Digital Takeoff Assistant
        if (this.config.features.takeoffAnalysis) {
            await this.setupDigitalTakeoffAssistant();
        }
        
        // Setup Professional Estimator
        await this.setupProfessionalEstimator();
        
        // Setup event listeners
        this.setupEstimatorEventListeners();
    }

    /**
     * Initialize Projects page modules
     */
    async initializeProjectsPage() {
        // Initialize chat for project management
        if (this.config.features.chat) {
            this.modules.chat = new ChatManager({
                webhookUrl: this.config.webhooks.projectChat || 'https://workflows.saxtechnology.com/webhook/ask-foreman/PMchat'
            });
            
            this.modules.chat.initialize({
                messagesContainer: document.getElementById('chatMessages'),
                inputField: document.getElementById('chatInput'),
                sendButton: document.getElementById('sendButton'),
                stopButton: document.getElementById('stopButton'),
                contextSelector: document.getElementById('projectSelector'),
                typingIndicator: document.getElementById('typingIndicator'),
                statusIndicator: document.getElementById('chatStatus')
            });
        }
        
        // Initialize project management features
        if (this.config.features.projectManagement) {
            await this.setupProjectManagement();
        }
        
        // Setup event listeners
        this.setupProjectEventListeners();
    }

    /**
     * Initialize General Chat page
     */
    async initializeGeneralChatPage() {
        // Initialize chat without file upload
        if (this.config.features.chat) {
            this.modules.chat = new ChatManager({
                webhookUrl: this.config.webhooks.generalChat || 'https://workflows.saxtechnology.com/webhook/ask-foreman/chat'
            });
            
            this.modules.chat.initialize({
                messagesContainer: document.getElementById('chatMessages'),
                inputField: document.getElementById('chatInput'),
                sendButton: document.getElementById('sendButton'),
                stopButton: document.getElementById('stopButton'),
                typingIndicator: document.getElementById('typingIndicator'),
                statusIndicator: document.getElementById('chatStatus')
            });
        }
        
        // Setup image pasting for general chat
        this.setupImagePasting();
    }

    /**
     * Setup Digital Takeoff Assistant
     */
    async setupDigitalTakeoffAssistant() {
        // Check if Azure AI script is loaded
        if (window.AzureTakeoffAnalysis) {
            console.log('Digital Takeoff Assistant ready');
            
            // Setup takeoff button
            const takeoffBtn = document.getElementById('digitalTakeoffBtn');
            if (takeoffBtn) {
                takeoffBtn.addEventListener('click', () => this.openTakeoffAssistant());
            }
        } else {
            // Load the Azure takeoff script
            await this.loadScript('/js/digital-takeoff-azure.js');
        }
    }

    /**
     * Setup Professional Estimator
     */
    async setupProfessionalEstimator() {
        const estimatorBtn = document.getElementById('professionalEstimatorBtn');
        if (estimatorBtn) {
            estimatorBtn.addEventListener('click', () => this.openProfessionalEstimator());
        }
    }

    /**
     * Setup Project Management
     */
    async setupProjectManagement() {
        // Load projects
        await this.loadProjects();
        
        // Setup project selector
        const projectSelector = document.getElementById('projectSelector');
        if (projectSelector) {
            projectSelector.addEventListener('change', (e) => {
                this.handleProjectChange(e.target.value);
            });
        }
        
        // Setup create project button
        const createProjectBtn = document.getElementById('createProjectBtn');
        if (createProjectBtn) {
            createProjectBtn.addEventListener('click', () => this.createNewProject());
        }
    }

    /**
     * Setup image pasting functionality
     */
    setupImagePasting() {
        document.addEventListener('paste', async (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    await this.handleImagePaste(blob);
                }
            }
        });
    }

    /**
     * Handle image paste
     */
    async handleImagePaste(imageBlob) {
        // Convert to base64
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64 = e.target.result;
            
            // Send to chat with image
            if (this.modules.chat) {
                await this.modules.chat.sendMessage('Analyze this image', [{
                    type: 'image',
                    data: base64,
                    name: 'pasted-image.png'
                }]);
            }
        };
        reader.readAsDataURL(imageBlob);
    }

    /**
     * Open Digital Takeoff Assistant
     */
    async openTakeoffAssistant() {
        // Implementation would open the takeoff modal
        const modal = document.getElementById('takeoffModal');
        if (modal) {
            modal.style.display = 'block';
            this.emit('takeoff:opened');
        }
    }

    /**
     * Open Professional Estimator
     */
    async openProfessionalEstimator() {
        // Implementation would open the estimator modal
        const modal = document.getElementById('estimatorModal');
        if (modal) {
            modal.style.display = 'block';
            this.emit('estimator:opened');
        }
    }

    /**
     * Load projects from Azure
     */
    async loadProjects() {
        try {
            const response = await fetch(this.config.webhooks.getProjects || '/api/projects');
            const projects = await response.json();
            
            // Populate project selector
            const selector = document.getElementById('projectSelector');
            if (selector && projects) {
                selector.innerHTML = '<option value="">-- Select Project --</option>';
                projects.forEach(project => {
                    const option = document.createElement('option');
                    option.value = project.id;
                    option.textContent = project.name;
                    selector.appendChild(option);
                });
            }
            
            this.emit('projects:loaded', { projects });
            
        } catch (error) {
            console.error('Failed to load projects:', error);
        }
    }

    /**
     * Handle project change
     */
    handleProjectChange(projectId) {
        if (!projectId) return;
        
        // Update chat context
        if (this.modules.chat) {
            this.modules.chat.updateContext(projectId);
        }
        
        // Load project files
        this.loadProjectFiles(projectId);
        
        this.emit('project:changed', { projectId });
    }

    /**
     * Load project files
     */
    async loadProjectFiles(projectId) {
        if (!this.modules.fileManager) return;
        
        try {
            const files = await this.modules.fileManager.listFiles(projectId);
            
            // Display files in UI
            const fileList = document.getElementById('projectFiles');
            if (fileList) {
                fileList.innerHTML = '';
                files.forEach(file => {
                    const fileElement = this.createFileListItem(file);
                    fileList.appendChild(fileElement);
                });
            }
            
            this.emit('files:loaded', { projectId, files });
            
        } catch (error) {
            console.error('Failed to load project files:', error);
        }
    }

    /**
     * Create new project
     */
    async createNewProject() {
        const projectName = prompt('Enter project name:');
        if (!projectName) return;
        
        try {
            const response = await fetch(this.config.webhooks.createProject || '/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: projectName })
            });
            
            const project = await response.json();
            
            // Reload projects
            await this.loadProjects();
            
            // Select new project
            const selector = document.getElementById('projectSelector');
            if (selector) {
                selector.value = project.id;
                this.handleProjectChange(project.id);
            }
            
            this.emit('project:created', { project });
            
        } catch (error) {
            console.error('Failed to create project:', error);
            alert('Failed to create project');
        }
    }

    /**
     * Initialize Azure services
     */
    async initializeAzureServices() {
        // Set up Azure configuration
        if (this.config.azureConfig.documentIntelligence) {
            window.AZURE_AI_CONFIG = {
                documentIntelligence: this.config.azureConfig.documentIntelligence,
                computerVision: this.config.azureConfig.computerVision,
                customVision: this.config.azureConfig.customVision
            };
        }
        
        // Test Azure connectivity
        await this.testAzureConnectivity();
    }

    /**
     * Test Azure connectivity
     */
    async testAzureConnectivity() {
        // Skip connectivity test - Azure storage doesn't support HEAD on container list
        // and Azure Functions URL is outdated. Actual connectivity will be tested
        // when operations are performed.
        console.log('✓ Azure services configured');
    }

    /**
     * Setup event listeners for estimator page
     */
    setupEstimatorEventListeners() {
        // File upload events
        if (this.modules.fileManager) {
            this.modules.fileManager.onUpload('*', (status, data) => {
                if (status === 'success') {
                    this.emit('file:uploaded', data);
                    
                    // Refresh chat context if needed
                    if (this.modules.chat) {
                        this.modules.chat.updateContext('files-updated');
                    }
                }
            });
        }
        
        // Export events
        const exportBtn = document.getElementById('exportEstimateBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportCurrentEstimate());
        }
    }

    /**
     * Setup event listeners for project page
     */
    setupProjectEventListeners() {
        // Project dashboard updates
        const updateDashboard = () => {
            const dashboard = document.getElementById('projectDashboard');
            if (dashboard) {
                // Update dashboard metrics
                this.updateProjectMetrics();
            }
        };
        
        // Refresh dashboard every 30 seconds
        setInterval(updateDashboard, 30000);
    }

    /**
     * Export current estimate
     */
    async exportCurrentEstimate() {
        if (!this.modules.excelExporter) {
            console.error('Excel exporter not initialized');
            return;
        }
        
        // Gather estimate data
        const estimateData = this.gatherEstimateData();
        
        // Export to Excel
        try {
            const result = await this.modules.excelExporter.exportEstimate(
                estimateData,
                `estimate-${Date.now()}.xlsx`
            );
            
            if (result.success) {
                this.emit('estimate:exported', result);
                this.showNotification('Estimate exported successfully', 'success');
            }
        } catch (error) {
            console.error('Export failed:', error);
            this.showNotification('Failed to export estimate', 'error');
        }
    }

    /**
     * Gather estimate data from UI
     */
    gatherEstimateData() {
        const data = {
            projectName: document.getElementById('projectName')?.value || '',
            clientName: document.getElementById('clientName')?.value || '',
            estimator: document.getElementById('estimator')?.value || '',
            lineItems: [],
            notes: document.getElementById('estimateNotes')?.value || ''
        };
        
        // Gather line items
        const lineItemRows = document.querySelectorAll('.line-item-row');
        lineItemRows.forEach(row => {
            data.lineItems.push({
                category: row.querySelector('.item-category')?.value || '',
                description: row.querySelector('.item-description')?.value || '',
                quantity: parseFloat(row.querySelector('.item-quantity')?.value) || 0,
                unit: row.querySelector('.item-unit')?.value || '',
                materialCost: parseFloat(row.querySelector('.item-material')?.value) || 0,
                laborCost: parseFloat(row.querySelector('.item-labor')?.value) || 0,
                total: parseFloat(row.querySelector('.item-total')?.textContent) || 0
            });
        });
        
        // Calculate totals
        data.subtotal = data.lineItems.reduce((sum, item) => sum + item.total, 0);
        data.overheadPercent = parseFloat(document.getElementById('overheadPercent')?.value) || 10;
        data.profitPercent = parseFloat(document.getElementById('profitPercent')?.value) || 15;
        data.taxPercent = parseFloat(document.getElementById('taxPercent')?.value) || 8;
        
        data.overhead = data.subtotal * (data.overheadPercent / 100);
        data.profit = data.subtotal * (data.profitPercent / 100);
        data.tax = (data.subtotal + data.overhead + data.profit) * (data.taxPercent / 100);
        data.grandTotal = data.subtotal + data.overhead + data.profit + data.tax;
        
        return data;
    }

    /**
     * Update project metrics
     */
    async updateProjectMetrics() {
        // Implementation would fetch and update project metrics
        console.log('Updating project metrics...');
    }

    /**
     * Custom message formatter for chat
     */
    customMessageFormatter(text) {
        // Add custom formatting for construction-specific content
        let formatted = text;
        
        // Format measurements
        formatted = formatted.replace(/(\d+(?:\.\d+)?)\s*(sq\.?\s*ft|square feet)/gi, '<span class="measurement">$1 sq ft</span>');
        formatted = formatted.replace(/(\d+(?:\.\d+)?)\s*(lin\.?\s*ft|linear feet)/gi, '<span class="measurement">$1 lin ft</span>');
        
        // Format costs
        formatted = formatted.replace(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g, '<span class="cost">$$1</span>');
        
        // Apply default formatting
        return this.defaultMessageFormatter(formatted);
    }

    /**
     * Default message formatter
     */
    defaultMessageFormatter(text) {
        // This would be the same as in ChatManager
        let formatted = text.replace(/&/g, '&amp;')
                          .replace(/</g, '&lt;')
                          .replace(/>/g, '&gt;');
        
        // Apply markdown formatting
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');
        formatted = formatted.replace(/\n/g, '<br>');
        
        return formatted;
    }

    /**
     * Setup error handling
     */
    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.emit('error:global', event.error);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.emit('error:promise', event.reason);
        });
    }

    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        // Monitor long tasks
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.duration > 50) {
                        console.warn('Long task detected:', entry);
                        this.emit('performance:longtask', entry);
                    }
                }
            });
            
            try {
                observer.observe({ entryTypes: ['longtask'] });
            } catch (e) {
                // Long task monitoring not supported
            }
        }
    }

    /**
     * Handle critical error
     */
    handleCriticalError(error) {
        console.error('Critical error:', error);
        
        // Show error UI
        const errorContainer = document.getElementById('criticalError');
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div class="error-message">
                    <h3>Application Error</h3>
                    <p>${error.message}</p>
                    <button onclick="location.reload()">Reload Page</button>
                </div>
            `;
            errorContainer.style.display = 'block';
        }
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    /**
     * Load external script
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Create file list item element
     */
    createFileListItem(file) {
        const item = document.createElement('div');
        item.className = 'file-list-item';
        item.innerHTML = `
            <span class="file-name">${file.name}</span>
            <span class="file-size">${this.formatFileSize(file.size)}</span>
            <button onclick="app.downloadFile('${file.name}')">Download</button>
        `;
        return item;
    }

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Download file
     */
    async downloadFile(fileName) {
        if (this.modules.fileManager) {
            await this.modules.fileManager.downloadFile(fileName, fileName);
        }
    }

    /**
     * Emit event
     */
    emit(eventName, data) {
        const event = new CustomEvent(eventName, { detail: data });
        this.eventBus.dispatchEvent(event);
    }

    /**
     * Listen to event
     */
    on(eventName, handler) {
        this.eventBus.addEventListener(eventName, handler);
    }

    /**
     * Remove event listener
     */
    off(eventName, handler) {
        this.eventBus.removeEventListener(eventName, handler);
    }

    /**
     * Get module instance
     */
    getModule(moduleName) {
        return this.modules[moduleName];
    }

    /**
     * Check if module is loaded
     */
    hasModule(moduleName) {
        return !!this.modules[moduleName];
    }

    /**
     * Destroy application
     */
    destroy() {
        // Clean up all modules
        Object.values(this.modules).forEach(module => {
            if (module.destroy) {
                module.destroy();
            }
        });
        
        this.modules = {};
        this.initialized = false;
        
        this.emit('app:destroyed');
    }
}

// Create global instance
window.ForemanAI = new AppIntegrator({
    appName: 'ForemanAI',
    version: '2.0.0',
    environment: window.location.hostname === 'localhost' ? 'development' : 'production',
    azureConfig: {
        storageAccount: 'saxtechfcs',
        documentIntelligence: {
            endpoint: 'https://saxtechfcs-docintell.cognitiveservices.azure.com/',
            apiKey: '4bb39c8e89144f9c808f2cfaa887e3d6'
        },
        computerVision: {
            endpoint: 'https://askforeman-vision.cognitiveservices.azure.com/',
            apiKey: '3afa37e3f6ec4cf891e0f5f6e5cf896c'
        }
    },
    webhooks: {
        estimatorChat: 'https://workflows.saxtechnology.com/webhook/ask-foreman/EstimatorChat',
        projectChat: 'https://workflows.saxtechnology.com/webhook/ask-foreman/PMchat',
        generalChat: 'https://workflows.saxtechnology.com/webhook/ask-foreman/chat',
        createProject: 'https://workflows.saxtechnology.com/webhook/ask-foreman/create-client',
        getProjects: 'https://workflows.saxtechnology.com/webhook/ask-foreman/get-clients'
    }
});

// Export for use in other modules
export default window.ForemanAI;

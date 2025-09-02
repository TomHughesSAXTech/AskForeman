/**
 * Chat Image Handler for AskForeman
 * Handles image paste, drag-drop, file upload, and Azure Functions integration
 */

class ChatImageHandler {
    constructor() {
        // Azure Functions configuration (will be loaded from API)
        this.config = {
            functionBaseUrl: window.location.hostname === 'localhost' 
                ? 'http://localhost:7071/api' 
                : 'https://askforeman-functions.azurewebsites.net/api',
            functionKey: '', // Will be loaded from API
            endpoints: {
                analyzeImage: '/analyze-image',
                pdfChunker: '/pdf-chunker',
                knowledgeGraph: '/knowledge-graph',
                enhancedSearch: '/enhanced-search'
            }
        };

        // UI Elements
        this.chatInput = null;
        this.sendButton = null;
        this.attachButton = null;
        this.fileInput = null;
        this.imagePreviewArea = null;
        this.statusDiv = null;
        
        // State
        this.attachedFiles = [];
        this.isProcessing = false;
        this.currentClient = null;
        
        // Initialize
        this.init();
    }

    async init() {
        // Load configuration from API
        await this.loadConfiguration();
        
        // Get DOM elements
        this.chatInput = document.getElementById('chatInput');
        this.sendButton = document.getElementById('sendButton');
        this.attachButton = document.getElementById('attachButton');
        this.fileInput = document.getElementById('imageFileInput');
        this.imagePreviewArea = document.getElementById('imagePreviewArea');
        this.statusDiv = document.getElementById('statusDiv');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize client selector if exists
        this.initClientSelector();
        
        console.log('Chat Image Handler initialized');
    }

    async loadConfiguration() {
        try {
            // Try to load configuration from API endpoint
            const response = await fetch('/api/config');
            if (response.ok) {
                const config = await response.json();
                if (config.functionKey) {
                    this.config.functionKey = config.functionKey;
                    this.config.functionBaseUrl = config.functionBaseUrl || this.config.functionBaseUrl;
                    this.config.endpoints = config.endpoints || this.config.endpoints;
                    console.log('Configuration loaded from API');
                }
            }
        } catch (error) {
            console.log('Using default configuration');
        }
        
        // Fallback to window variable if available (for local development)
        if (!this.config.functionKey && window.AZURE_FUNCTION_KEY) {
            this.config.functionKey = window.AZURE_FUNCTION_KEY;
        }
    }

    setupEventListeners() {
        // Paste event for images
        document.addEventListener('paste', (e) => this.handlePaste(e));
        
        // Drag and drop events
        const dropZone = document.body;
        dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        dropZone.addEventListener('drop', (e) => this.handleDrop(e));
        
        // File input change
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }
        
        // Attach button click
        if (this.attachButton) {
            this.attachButton.addEventListener('click', () => {
                this.fileInput?.click();
            });
        }
        
        // Send button enhancement
        if (this.sendButton) {
            const originalClick = this.sendButton.onclick;
            this.sendButton.onclick = async (e) => {
                if (this.attachedFiles.length > 0) {
                    await this.processAttachedFiles();
                }
                if (originalClick) {
                    originalClick.call(this.sendButton, e);
                }
            };
        }
        
        // Enhanced search shortcut (Ctrl+K)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.openSearchModal();
            }
        });
    }

    // Handle paste events
    async handlePaste(e) {
        const items = e.clipboardData?.items;
        if (!items) return;
        
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    await this.addImageFile(file, 'pasted');
                }
            }
        }
    }

    // Handle drag over
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Add visual feedback
        document.body.classList.add('drag-over');
        
        // Show drop zone indicator
        if (!document.getElementById('dropIndicator')) {
            const indicator = document.createElement('div');
            indicator.id = 'dropIndicator';
            indicator.className = 'drop-indicator';
            indicator.innerHTML = `
                <div class="drop-message">
                    <span class="drop-icon">📁</span>
                    <p>Drop files here to attach</p>
                    <small>Images, PDFs, and drawings supported</small>
                </div>
            `;
            document.body.appendChild(indicator);
        }
    }

    // Handle drag leave
    handleDragLeave(e) {
        if (e.target === document.body || e.target === document.getElementById('dropIndicator')) {
            document.body.classList.remove('drag-over');
            const indicator = document.getElementById('dropIndicator');
            if (indicator) {
                indicator.remove();
            }
        }
    }

    // Handle drop
    async handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Remove visual feedback
        document.body.classList.remove('drag-over');
        const indicator = document.getElementById('dropIndicator');
        if (indicator) {
            indicator.remove();
        }
        
        const files = Array.from(e.dataTransfer.files);
        for (const file of files) {
            if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                await this.addImageFile(file, 'dropped');
            }
        }
    }

    // Handle file selection
    async handleFileSelect(e) {
        const files = Array.from(e.target.files);
        for (const file of files) {
            await this.addImageFile(file, 'selected');
        }
        // Reset input
        e.target.value = '';
    }

    // Add image file to preview
    async addImageFile(file, source) {
        // Validate file
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            this.showStatus(`File too large. Maximum size is 50MB.`, 'error');
            return;
        }
        
        // Create preview
        const previewId = `preview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const preview = await this.createPreview(file, previewId, source);
        
        // Add to attached files
        this.attachedFiles.push({
            id: previewId,
            file: file,
            source: source,
            preview: preview
        });
        
        // Show preview area
        if (this.imagePreviewArea) {
            this.imagePreviewArea.style.display = 'flex';
            this.imagePreviewArea.appendChild(preview);
        }
        
        // Auto-analyze if it's a pasted drawing
        if (source === 'pasted' && file.type.startsWith('image/')) {
            await this.analyzeDrawing(file, previewId);
        }
    }

    // Create preview element
    async createPreview(file, previewId, source) {
        const preview = document.createElement('div');
        preview.className = 'image-preview';
        preview.id = previewId;
        
        if (file.type.startsWith('image/')) {
            // Image preview
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.alt = file.name;
            preview.appendChild(img);
        } else if (file.type === 'application/pdf') {
            // PDF preview
            const pdfIcon = document.createElement('div');
            pdfIcon.className = 'file-icon pdf-icon';
            pdfIcon.innerHTML = `
                <span class="file-type">PDF</span>
                <span class="file-name">${file.name}</span>
                <span class="file-size">${this.formatFileSize(file.size)}</span>
            `;
            preview.appendChild(pdfIcon);
        }
        
        // Add remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-preview';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = () => this.removePreview(previewId);
        preview.appendChild(removeBtn);
        
        // Add source indicator
        if (source === 'pasted') {
            const indicator = document.createElement('span');
            indicator.className = 'source-indicator pasted';
            indicator.innerHTML = '📋 Pasted';
            preview.appendChild(indicator);
        }
        
        return preview;
    }

    // Remove preview
    removePreview(previewId) {
        // Remove from DOM
        const preview = document.getElementById(previewId);
        if (preview) {
            preview.remove();
        }
        
        // Remove from attached files
        this.attachedFiles = this.attachedFiles.filter(f => f.id !== previewId);
        
        // Hide preview area if empty
        if (this.attachedFiles.length === 0 && this.imagePreviewArea) {
            this.imagePreviewArea.style.display = 'none';
        }
    }

    // Analyze drawing with Azure Computer Vision
    async analyzeDrawing(file, previewId) {
        this.showStatus('Analyzing drawing...', 'info');
        
        try {
            // Convert file to base64 for sending as JSON
            const base64 = await this.fileToBase64(file);
            
            const response = await this.callAzureFunction('analyzeImage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imageData: base64,
                    filename: file.name,
                    mimeType: file.type
                })
            });
            
            if (response.success) {
                // Display analysis results
                this.displayAnalysisResults(response.analysis, previewId);
                this.showStatus('Drawing analyzed successfully', 'success');
            } else {
                throw new Error(response.error || 'Analysis failed');
            }
        } catch (error) {
            console.error('Drawing analysis error:', error);
            this.showStatus('Failed to analyze drawing', 'error');
        }
    }
    
    // Convert file to base64 string
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Display analysis results
    displayAnalysisResults(analysis, previewId) {
        const preview = document.getElementById(previewId);
        if (!preview) return;
        
        // Create results overlay
        const results = document.createElement('div');
        results.className = 'analysis-results';
        
        // Add detected text
        if (analysis.text && analysis.text.length > 0) {
            const textSection = document.createElement('div');
            textSection.className = 'result-section';
            textSection.innerHTML = `
                <h4>Detected Text:</h4>
                <p>${analysis.text.join(', ')}</p>
            `;
            results.appendChild(textSection);
        }
        
        // Add detected objects
        if (analysis.objects && analysis.objects.length > 0) {
            const objectsSection = document.createElement('div');
            objectsSection.className = 'result-section';
            objectsSection.innerHTML = `
                <h4>Detected Objects:</h4>
                <ul>${analysis.objects.map(obj => `<li>${obj.name} (${Math.round(obj.confidence * 100)}%)</li>`).join('')}</ul>
            `;
            results.appendChild(objectsSection);
        }
        
        // Add construction-specific analysis
        if (analysis.construction) {
            const constructionSection = document.createElement('div');
            constructionSection.className = 'result-section construction';
            constructionSection.innerHTML = `
                <h4>Construction Analysis:</h4>
                ${analysis.construction.materials ? `<p><strong>Materials:</strong> ${analysis.construction.materials.join(', ')}</p>` : ''}
                ${analysis.construction.rooms ? `<p><strong>Rooms:</strong> ${analysis.construction.rooms.join(', ')}</p>` : ''}
                ${analysis.construction.dimensions ? `<p><strong>Dimensions:</strong> ${analysis.construction.dimensions.join(', ')}</p>` : ''}
            `;
            results.appendChild(constructionSection);
        }
        
        preview.appendChild(results);
    }

    // Process attached files before sending
    async processAttachedFiles() {
        if (this.attachedFiles.length === 0) return;
        
        this.showStatus(`Processing ${this.attachedFiles.length} file(s)...`, 'info');
        
        for (const attachment of this.attachedFiles) {
            if (attachment.file.type === 'application/pdf') {
                // Process PDF
                await this.processPDF(attachment.file);
            } else if (attachment.file.type.startsWith('image/')) {
                // Process image
                await this.processImage(attachment.file);
            }
        }
        
        // Clear attachments after processing
        this.clearAttachments();
    }

    // Process PDF file
    async processPDF(file) {
        try {
            const formData = new FormData();
            formData.append('pdf', file);
            formData.append('clientName', this.currentClient || 'default');
            
            // Check file size for chunking
            if (file.size > 10 * 1024 * 1024) { // > 10MB
                // Use PDF chunker
                const response = await this.callAzureFunction('pdfChunker', {
                    method: 'POST',
                    body: formData
                });
                
                if (response.success) {
                    this.showStatus(`PDF split into ${response.chunks.length} chunks`, 'success');
                }
            } else {
                // Direct processing for smaller PDFs
                this.showStatus('Processing PDF...', 'info');
            }
        } catch (error) {
            console.error('PDF processing error:', error);
            this.showStatus('Failed to process PDF', 'error');
        }
    }

    // Process image file
    async processImage(file) {
        try {
            const formData = new FormData();
            formData.append('image', file);
            
            const response = await this.callAzureFunction('analyzeImage', {
                method: 'POST',
                body: formData
            });
            
            if (response.success) {
                this.showStatus('Image processed successfully', 'success');
            }
        } catch (error) {
            console.error('Image processing error:', error);
            this.showStatus('Failed to process image', 'error');
        }
    }

    // Clear all attachments
    clearAttachments() {
        this.attachedFiles = [];
        if (this.imagePreviewArea) {
            this.imagePreviewArea.innerHTML = '';
            this.imagePreviewArea.style.display = 'none';
        }
    }

    // Open enhanced search modal
    openSearchModal() {
        // Create search modal if it doesn't exist
        let modal = document.getElementById('searchModal');
        if (!modal) {
            modal = this.createSearchModal();
            document.body.appendChild(modal);
        }
        
        // Show modal
        modal.style.display = 'flex';
        const searchInput = modal.querySelector('#enhancedSearchInput');
        if (searchInput) {
            searchInput.focus();
        }
    }

    // Create search modal
    createSearchModal() {
        const modal = document.createElement('div');
        modal.id = 'searchModal';
        modal.className = 'search-modal';
        modal.innerHTML = `
            <div class="search-modal-content">
                <div class="search-header">
                    <h3>Enhanced Search</h3>
                    <button class="close-modal" onclick="this.closest('.search-modal').style.display='none'">×</button>
                </div>
                <div class="search-controls">
                    <input type="text" id="enhancedSearchInput" placeholder="Search across all clients and documents..." />
                    <select id="searchMode">
                        <option value="all-clients">All Clients</option>
                        <option value="single-client">Current Client Only</option>
                        <option value="knowledge-graph">Knowledge Graph</option>
                    </select>
                    <button id="enhancedSearchBtn">Search</button>
                </div>
                <div class="search-filters">
                    <label><input type="checkbox" id="filterDrawings" /> Drawings</label>
                    <label><input type="checkbox" id="filterPDFs" /> PDFs</label>
                    <label><input type="checkbox" id="filterRecent" /> Recent Only</label>
                </div>
                <div id="searchResults" class="search-results"></div>
            </div>
        `;
        
        // Add event listeners
        modal.querySelector('#enhancedSearchBtn').addEventListener('click', () => this.performEnhancedSearch());
        modal.querySelector('#enhancedSearchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performEnhancedSearch();
            }
        });
        
        return modal;
    }

    // Perform enhanced search
    async performEnhancedSearch() {
        const searchInput = document.getElementById('enhancedSearchInput');
        const searchMode = document.getElementById('searchMode');
        const resultsDiv = document.getElementById('searchResults');
        
        if (!searchInput.value.trim()) return;
        
        resultsDiv.innerHTML = '<div class="loading">Searching...</div>';
        
        try {
            const filters = {
                includeDrawings: document.getElementById('filterDrawings')?.checked,
                includePDFs: document.getElementById('filterPDFs')?.checked,
                recentOnly: document.getElementById('filterRecent')?.checked
            };
            
            const response = await this.callAzureFunction('enhancedSearch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: searchInput.value,
                    searchMode: searchMode.value,
                    clientName: this.currentClient,
                    filters: filters,
                    top: 20
                })
            });
            
            if (response.success) {
                this.displaySearchResults(response, resultsDiv);
            } else {
                throw new Error(response.error || 'Search failed');
            }
        } catch (error) {
            console.error('Search error:', error);
            resultsDiv.innerHTML = '<div class="error">Search failed. Please try again.</div>';
        }
    }

    // Display search results
    displaySearchResults(response, resultsDiv) {
        if (!response.results || response.results.length === 0) {
            resultsDiv.innerHTML = '<div class="no-results">No results found</div>';
            return;
        }
        
        let html = `
            <div class="results-summary">
                Found ${response.results.length} results across ${response.metadata.clientsCovered} client(s)
            </div>
        `;
        
        // Display patterns if available
        if (response.patterns && response.patterns.commonEntities.length > 0) {
            html += `
                <div class="patterns-section">
                    <h4>Common Patterns:</h4>
                    <div class="pattern-tags">
                        ${response.patterns.commonEntities.map(e => 
                            `<span class="tag">${e.value} (${e.count})</span>`
                        ).join('')}
                    </div>
                </div>
            `;
        }
        
        // Display results
        html += '<div class="results-list">';
        response.results.forEach(result => {
            html += `
                <div class="search-result">
                    <div class="result-header">
                        <span class="file-name">${result.fileName}</span>
                        <span class="client-name">${result.clientName}</span>
                    </div>
                    ${result.highlights ? `<div class="result-highlight">${result.highlights.content?.[0] || ''}</div>` : ''}
                    ${result.insight ? `<div class="result-insight">${result.insight}</div>` : ''}
                    ${result.crossClientConnectionCount > 0 ? 
                        `<div class="connections">🔗 ${result.crossClientConnectionCount} cross-client connections</div>` : ''}
                    <div class="result-actions">
                        <button onclick="window.chatImageHandler.openDocument('${result.id}')">Open</button>
                        <button onclick="window.chatImageHandler.addToContext('${result.id}')">Add to Context</button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        resultsDiv.innerHTML = html;
    }

    // Initialize client selector
    initClientSelector() {
        const clientSelect = document.getElementById('clientSelect');
        if (clientSelect) {
            clientSelect.addEventListener('change', (e) => {
                this.currentClient = e.target.value;
                console.log('Client selected:', this.currentClient);
            });
            this.currentClient = clientSelect.value;
        }
    }

    // Call Azure Function
    async callAzureFunction(endpoint, options = {}) {
        const url = `${this.config.functionBaseUrl}${this.config.endpoints[endpoint]}`;
        
        // Add function key if configured
        const urlWithKey = this.config.functionKey 
            ? `${url}?code=${this.config.functionKey}`
            : url;
        
        try {
            const response = await fetch(urlWithKey, {
                ...options,
                mode: 'cors'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Azure Function call failed: ${endpoint}`, error);
            throw error;
        }
    }

    // Show status message
    showStatus(message, type = 'info') {
        if (!this.statusDiv) {
            // Create status div if it doesn't exist
            this.statusDiv = document.createElement('div');
            this.statusDiv.id = 'statusDiv';
            this.statusDiv.className = 'status-message';
            document.body.appendChild(this.statusDiv);
        }
        
        this.statusDiv.textContent = message;
        this.statusDiv.className = `status-message ${type}`;
        this.statusDiv.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.statusDiv.style.display = 'none';
        }, 5000);
    }

    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    // Open document (placeholder for implementation)
    openDocument(documentId) {
        console.log('Opening document:', documentId);
        // Implement document opening logic
    }

    // Add document to context (placeholder for implementation)
    addToContext(documentId) {
        console.log('Adding to context:', documentId);
        // Implement context addition logic
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.chatImageHandler = new ChatImageHandler();
    });
} else {
    window.chatImageHandler = new ChatImageHandler();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatImageHandler;
}

/**
 * File Management Module
 * Handles file uploads, Azure Blob Storage integration, document processing
 * @module FileManagement
 */

export class FileManager {
    constructor(config = {}) {
        this.config = {
            storageAccount: config.storageAccount || 'saxtechfcs',
            container: config.container || 'documents',
            sasToken: config.sasToken || '',
            maxFileSize: config.maxFileSize || 100 * 1024 * 1024, // 100MB
            chunkSize: config.chunkSize || 5 * 1024 * 1024, // 5MB chunks
            supportedFormats: config.supportedFormats || [
                '.pdf', '.docx', '.doc', '.xlsx', '.xls', 
                '.png', '.jpg', '.jpeg', '.tiff', '.bmp'
            ],
            apiEndpoints: {
                convertDocument: config.convertEndpoint || 'https://saxtechfcs.azurewebsites.net/api/ConvertDocument',
                processChunks: config.chunksEndpoint || 'https://saxtechfcs.azurewebsites.net/api/ProcessChunks',
                deleteFile: config.deleteEndpoint || 'https://saxtechfcs.azurewebsites.net/api/DeleteFile'
            }
        };
        
        this.uploadQueue = [];
        this.activeUploads = new Map();
        this.fileCache = new Map();
        this.uploadCallbacks = new Map();
    }

    /**
     * Initialize file manager with UI elements
     */
    initialize(elements) {
        this.elements = {
            fileInput: elements.fileInput,
            dropZone: elements.dropZone,
            fileList: elements.fileList,
            uploadButton: elements.uploadButton,
            progressContainer: elements.progressContainer,
            errorContainer: elements.errorContainer
        };
        
        this.setupEventListeners();
        this.setupDragAndDrop();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (this.elements.fileInput) {
            this.elements.fileInput.addEventListener('change', (e) => {
                this.handleFileSelection(e.target.files);
            });
        }
        
        if (this.elements.uploadButton) {
            this.elements.uploadButton.addEventListener('click', () => {
                this.processUploadQueue();
            });
        }
    }

    /**
     * Setup drag and drop functionality
     */
    setupDragAndDrop() {
        if (!this.elements.dropZone) return;
        
        const dropZone = this.elements.dropZone;
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, this.preventDefaults, false);
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-over');
            }, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-over');
            }, false);
        });
        
        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            this.handleFileSelection(files);
        }, false);
    }

    /**
     * Prevent default drag behavior
     */
    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * Handle file selection
     */
    handleFileSelection(files) {
        const validFiles = [];
        const errors = [];
        
        for (const file of files) {
            const validation = this.validateFile(file);
            if (validation.valid) {
                validFiles.push(file);
            } else {
                errors.push(`${file.name}: ${validation.error}`);
            }
        }
        
        // Add valid files to queue
        validFiles.forEach(file => {
            this.addToUploadQueue(file);
        });
        
        // Display errors
        if (errors.length > 0) {
            this.displayErrors(errors);
        }
        
        // Update UI
        this.updateFileList();
    }

    /**
     * Validate file
     */
    validateFile(file) {
        // Check file size
        if (file.size > this.config.maxFileSize) {
            return {
                valid: false,
                error: `File too large (max ${this.formatFileSize(this.config.maxFileSize)})`
            };
        }
        
        // Check file type
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        if (!this.config.supportedFormats.includes(extension)) {
            return {
                valid: false,
                error: `Unsupported format (supported: ${this.config.supportedFormats.join(', ')})`
            };
        }
        
        // Check for duplicates
        if (this.isDuplicate(file)) {
            return {
                valid: false,
                error: 'File already uploaded or in queue'
            };
        }
        
        return { valid: true };
    }

    /**
     * Check if file is duplicate
     */
    isDuplicate(file) {
        const fileId = this.generateFileId(file);
        return this.fileCache.has(fileId) || 
               this.uploadQueue.some(f => this.generateFileId(f) === fileId);
    }

    /**
     * Generate unique file ID
     */
    generateFileId(file) {
        return `${file.name}-${file.size}-${file.lastModified}`;
    }

    /**
     * Add file to upload queue
     */
    addToUploadQueue(file) {
        const queueItem = {
            file: file,
            id: this.generateFileId(file),
            status: 'pending',
            progress: 0,
            error: null
        };
        
        this.uploadQueue.push(queueItem);
        return queueItem;
    }

    /**
     * Process upload queue
     */
    async processUploadQueue() {
        const pendingUploads = this.uploadQueue.filter(item => item.status === 'pending');
        
        if (pendingUploads.length === 0) {
            this.showNotification('No files to upload', 'info');
            return;
        }
        
        for (const item of pendingUploads) {
            await this.uploadFile(item);
        }
    }

    /**
     * Upload file to Azure Blob Storage
     */
    async uploadFile(queueItem) {
        const { file, id } = queueItem;
        
        try {
            queueItem.status = 'uploading';
            this.updateFileList();
            
            // Create progress callback
            const onProgress = (progress) => {
                queueItem.progress = progress;
                this.updateProgress(id, progress);
            };
            
            // Determine upload method based on file size
            let result;
            if (file.size > this.config.chunkSize) {
                result = await this.uploadLargeFile(file, onProgress);
            } else {
                result = await this.uploadSmallFile(file, onProgress);
            }
            
            // Process document if needed
            if (this.shouldProcessDocument(file)) {
                await this.processDocument(result.blobUrl, file.name);
            }
            
            queueItem.status = 'completed';
            queueItem.result = result;
            this.fileCache.set(id, result);
            
            // Trigger success callback
            this.triggerCallback(id, 'success', result);
            
        } catch (error) {
            queueItem.status = 'error';
            queueItem.error = error.message;
            
            // Trigger error callback
            this.triggerCallback(id, 'error', error);
            
            this.displayError(`Failed to upload ${file.name}: ${error.message}`);
        } finally {
            this.updateFileList();
        }
    }

    /**
     * Upload small file directly
     */
    async uploadSmallFile(file, onProgress) {
        const blobName = this.generateBlobName(file);
        const blobUrl = this.getBlobUrl(blobName);
        
        // Read file
        const arrayBuffer = await this.readFileAsArrayBuffer(file);
        
        // Upload to blob storage
        const response = await fetch(`${blobUrl}?${this.config.sasToken}`, {
            method: 'PUT',
            headers: {
                'x-ms-blob-type': 'BlockBlob',
                'Content-Type': file.type || 'application/octet-stream'
            },
            body: arrayBuffer
        });
        
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
        }
        
        onProgress(100);
        
        return {
            blobName: blobName,
            blobUrl: blobUrl,
            size: file.size,
            type: file.type,
            uploadedAt: new Date().toISOString()
        };
    }

    /**
     * Upload large file in chunks
     */
    async uploadLargeFile(file, onProgress) {
        const blobName = this.generateBlobName(file);
        const blobUrl = this.getBlobUrl(blobName);
        
        const chunks = Math.ceil(file.size / this.config.chunkSize);
        const blockIds = [];
        
        for (let i = 0; i < chunks; i++) {
            const start = i * this.config.chunkSize;
            const end = Math.min(start + this.config.chunkSize, file.size);
            const chunk = file.slice(start, end);
            
            const blockId = btoa(`block-${i.toString().padStart(6, '0')}`);
            blockIds.push(blockId);
            
            // Upload block
            await this.uploadBlock(blobUrl, blockId, chunk);
            
            // Update progress
            const progress = Math.round(((i + 1) / chunks) * 100);
            onProgress(progress);
        }
        
        // Commit blocks
        await this.commitBlocks(blobUrl, blockIds);
        
        return {
            blobName: blobName,
            blobUrl: blobUrl,
            size: file.size,
            type: file.type,
            uploadedAt: new Date().toISOString()
        };
    }

    /**
     * Upload a single block
     */
    async uploadBlock(blobUrl, blockId, chunk) {
        const response = await fetch(`${blobUrl}?comp=block&blockid=${blockId}&${this.config.sasToken}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/octet-stream'
            },
            body: chunk
        });
        
        if (!response.ok) {
            throw new Error(`Block upload failed: ${response.status}`);
        }
    }

    /**
     * Commit blocks to finalize blob
     */
    async commitBlocks(blobUrl, blockIds) {
        const blockListXml = this.generateBlockListXml(blockIds);
        
        const response = await fetch(`${blobUrl}?comp=blocklist&${this.config.sasToken}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/xml'
            },
            body: blockListXml
        });
        
        if (!response.ok) {
            throw new Error(`Block commit failed: ${response.status}`);
        }
    }

    /**
     * Generate block list XML
     */
    generateBlockListXml(blockIds) {
        const blocks = blockIds.map(id => `<Latest>${id}</Latest>`).join('');
        return `<?xml version="1.0" encoding="utf-8"?><BlockList>${blocks}</BlockList>`;
    }

    /**
     * Process document with Azure Functions
     */
    async processDocument(blobUrl, fileName) {
        const fileExtension = fileName.split('.').pop().toLowerCase();
        
        // Determine processing type
        if (['doc', 'docx', 'xls', 'xlsx'].includes(fileExtension)) {
            await this.convertDocument(blobUrl, fileName);
        }
        
        if (fileExtension === 'pdf') {
            await this.chunkPdf(blobUrl, fileName);
        }
    }

    /**
     * Convert document to PDF
     */
    async convertDocument(blobUrl, fileName) {
        const response = await fetch(this.config.apiEndpoints.convertDocument, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                blobUrl: blobUrl,
                fileName: fileName,
                sasToken: this.config.sasToken
            })
        });
        
        if (!response.ok) {
            throw new Error(`Document conversion failed: ${response.status}`);
        }
        
        return await response.json();
    }

    /**
     * Chunk PDF for processing
     */
    async chunkPdf(blobUrl, fileName) {
        const response = await fetch(this.config.apiEndpoints.processChunks, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                blobUrl: blobUrl,
                fileName: fileName,
                sasToken: this.config.sasToken
            })
        });
        
        if (!response.ok) {
            throw new Error(`PDF chunking failed: ${response.status}`);
        }
        
        return await response.json();
    }

    /**
     * Delete file from storage
     */
    async deleteFile(blobName) {
        const blobUrl = this.getBlobUrl(blobName);
        
        // Delete from Azure
        const response = await fetch(`${blobUrl}?${this.config.sasToken}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`Delete failed: ${response.status}`);
        }
        
        // Remove from cache
        const fileId = Array.from(this.fileCache.entries())
            .find(([_, value]) => value.blobName === blobName)?.[0];
        
        if (fileId) {
            this.fileCache.delete(fileId);
        }
        
        // Update UI
        this.updateFileList();
    }

    /**
     * List files from storage
     */
    async listFiles(prefix = '') {
        const listUrl = `https://${this.config.storageAccount}.blob.core.windows.net/${this.config.container}?restype=container&comp=list`;
        
        if (prefix) {
            listUrl += `&prefix=${encodeURIComponent(prefix)}`;
        }
        
        const response = await fetch(`${listUrl}&${this.config.sasToken}`);
        
        if (!response.ok) {
            throw new Error(`List files failed: ${response.status}`);
        }
        
        const text = await response.text();
        return this.parseFileList(text);
    }

    /**
     * Parse file list XML response
     */
    parseFileList(xmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'text/xml');
        const blobs = doc.querySelectorAll('Blob');
        
        return Array.from(blobs).map(blob => ({
            name: blob.querySelector('Name').textContent,
            url: blob.querySelector('Url')?.textContent,
            size: parseInt(blob.querySelector('Properties Content-Length')?.textContent || 0),
            lastModified: blob.querySelector('Properties Last-Modified')?.textContent,
            contentType: blob.querySelector('Properties Content-Type')?.textContent
        }));
    }

    /**
     * Download file from storage
     */
    async downloadFile(blobName, fileName) {
        const blobUrl = this.getBlobUrl(blobName);
        const response = await fetch(`${blobUrl}?${this.config.sasToken}`);
        
        if (!response.ok) {
            throw new Error(`Download failed: ${response.status}`);
        }
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        // Trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || blobName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    /**
     * Generate blob name
     */
    generateBlobName(file) {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        return `${timestamp}-${safeName}`;
    }

    /**
     * Get blob URL
     */
    getBlobUrl(blobName) {
        return `https://${this.config.storageAccount}.blob.core.windows.net/${this.config.container}/${blobName}`;
    }

    /**
     * Read file as array buffer
     */
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Should process document
     */
    shouldProcessDocument(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        return ['pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(extension);
    }

    /**
     * Update file list UI
     */
    updateFileList() {
        if (!this.elements.fileList) return;
        
        const container = this.elements.fileList;
        container.innerHTML = '';
        
        this.uploadQueue.forEach(item => {
            const fileElement = this.createFileElement(item);
            container.appendChild(fileElement);
        });
    }

    /**
     * Create file element for display
     */
    createFileElement(queueItem) {
        const div = document.createElement('div');
        div.className = `file-item ${queueItem.status}`;
        
        const info = document.createElement('div');
        info.className = 'file-info';
        info.innerHTML = `
            <span class="file-name">${queueItem.file.name}</span>
            <span class="file-size">${this.formatFileSize(queueItem.file.size)}</span>
            <span class="file-status">${queueItem.status}</span>
        `;
        
        div.appendChild(info);
        
        if (queueItem.status === 'uploading') {
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            progressBar.innerHTML = `
                <div class="progress-fill" style="width: ${queueItem.progress}%"></div>
                <span class="progress-text">${queueItem.progress}%</span>
            `;
            div.appendChild(progressBar);
        }
        
        if (queueItem.status === 'error') {
            const error = document.createElement('div');
            error.className = 'file-error';
            error.textContent = queueItem.error;
            div.appendChild(error);
        }
        
        if (queueItem.status === 'completed') {
            const actions = document.createElement('div');
            actions.className = 'file-actions';
            
            const downloadBtn = document.createElement('button');
            downloadBtn.textContent = 'Download';
            downloadBtn.onclick = () => this.downloadFile(queueItem.result.blobName, queueItem.file.name);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.onclick = () => this.deleteFile(queueItem.result.blobName);
            
            actions.appendChild(downloadBtn);
            actions.appendChild(deleteBtn);
            div.appendChild(actions);
        }
        
        return div;
    }

    /**
     * Update progress display
     */
    updateProgress(fileId, progress) {
        if (!this.elements.progressContainer) return;
        
        let progressElement = this.elements.progressContainer.querySelector(`[data-file-id="${fileId}"]`);
        
        if (!progressElement) {
            progressElement = document.createElement('div');
            progressElement.className = 'upload-progress';
            progressElement.dataset.fileId = fileId;
            this.elements.progressContainer.appendChild(progressElement);
        }
        
        progressElement.innerHTML = `
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <span class="progress-text">${progress}%</span>
        `;
        
        if (progress >= 100) {
            setTimeout(() => {
                progressElement.remove();
            }, 2000);
        }
    }

    /**
     * Display error
     */
    displayError(message) {
        if (!this.elements.errorContainer) {
            console.error(message);
            return;
        }
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        this.elements.errorContainer.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    /**
     * Display multiple errors
     */
    displayErrors(errors) {
        errors.forEach(error => this.displayError(error));
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
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Register upload callback
     */
    onUpload(fileId, callback) {
        if (!this.uploadCallbacks.has(fileId)) {
            this.uploadCallbacks.set(fileId, []);
        }
        this.uploadCallbacks.get(fileId).push(callback);
    }

    /**
     * Trigger upload callbacks
     */
    triggerCallback(fileId, status, data) {
        const callbacks = this.uploadCallbacks.get(fileId);
        if (callbacks) {
            callbacks.forEach(callback => callback(status, data));
        }
    }

    /**
     * Clear upload queue
     */
    clearQueue() {
        this.uploadQueue = [];
        this.updateFileList();
    }

    /**
     * Get upload statistics
     */
    getStatistics() {
        return {
            queued: this.uploadQueue.filter(i => i.status === 'pending').length,
            uploading: this.uploadQueue.filter(i => i.status === 'uploading').length,
            completed: this.uploadQueue.filter(i => i.status === 'completed').length,
            failed: this.uploadQueue.filter(i => i.status === 'error').length,
            totalSize: this.uploadQueue.reduce((sum, i) => sum + i.file.size, 0)
        };
    }
}

// Export for use in other modules
export default FileManager;

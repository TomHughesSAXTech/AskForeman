// Enhanced Chat Image Handler v2.0
// Integrates with Azure Computer Vision API for construction document analysis
// Supports paste, drag-drop, and file selection of images and PDFs

class ChatImageHandler {
    constructor() {
        this.attachedImages = [];
        this.azureFunctionUrl = 'https://askforeman-functions.azurewebsites.net/api/analyze-image';
        this.azureFunctionKey = ''; // Function key will be handled by function app settings
        this.maxImageSize = 20 * 1024 * 1024; // 20MB
        this.initializeHandlers();
    }

    initializeHandlers() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.previewArea = document.getElementById('imagePreviewArea');
        this.attachButton = document.getElementById('attachButton');
        this.imageFileInput = document.getElementById('imageFileInput');
        this.chatInput = document.getElementById('chatInput');
        this.sendButton = document.getElementById('sendButton');
        
        if (this.previewArea) {
            this.setupPasteHandler();
            this.setupDragDropHandler();
            this.setupFileButton();
            this.overrideSendMessage();
        }
    }

    // Setup paste event handler
    setupPasteHandler() {
        document.addEventListener('paste', async (e) => {
            // Check if we're in the chat area
            const inChatArea = document.activeElement === this.chatInput || 
                              document.activeElement.closest('.chat-input-container');
            if (!inChatArea) return;
            
            const items = e.clipboardData?.items;
            if (!items) return;
            
            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    if (blob) {
                        await this.handleImageFile(blob, 'pasted');
                    }
                }
            }
        });
    }

    // Setup drag and drop handler
    setupDragDropHandler() {
        const chatContainer = document.querySelector('.chat-container');
        if (!chatContainer) return;
        
        let dragCounter = 0;
        
        chatContainer.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            chatContainer.classList.add('drag-over');
        });
        
        chatContainer.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0) {
                chatContainer.classList.remove('drag-over');
            }
        });
        
        chatContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });
        
        chatContainer.addEventListener('drop', async (e) => {
            e.preventDefault();
            dragCounter = 0;
            chatContainer.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            for (let file of files) {
                if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                    await this.handleImageFile(file, 'dropped');
                }
            }
        });
    }

    // Setup file attachment button
    setupFileButton() {
        if (this.attachButton && this.imageFileInput) {
            this.attachButton.addEventListener('click', () => {
                this.imageFileInput.click();
            });
            
            this.imageFileInput.addEventListener('change', async (e) => {
                for (let file of e.target.files) {
                    if (file.type.startsWith('image/') || file.type === 'application/pdf') {
                        await this.handleImageFile(file, 'selected');
                    }
                }
                // Clear input so same files can be selected again
                this.imageFileInput.value = '';
            });
        }
    }

    // Handle image file
    async handleImageFile(file, source = 'unknown') {
        // Validate file size
        if (file.size > this.maxImageSize) {
            this.showError(`File "${file.name}" is too large. Maximum size is 20MB.`);
            return;
        }
        
        // Create and show preview
        const preview = await this.createImagePreview(file, source);
        this.previewArea.style.display = 'block';
        this.previewArea.appendChild(preview);
        
        // Store image data
        const imageData = {
            file: file,
            preview: preview,
            analysis: null,
            source: source,
            id: Date.now() + Math.random()
        };
        
        this.attachedImages.push(imageData);
        
        // Auto-analyze all images (not just construction drawings)
        await this.analyzeImage(imageData);
        
        this.updateAttachmentIndicator();
    }

    // Create image preview element
    async createImagePreview(file, source) {
        const previewContainer = document.createElement('div');
        previewContainer.className = 'image-preview-item';
        
        // Create thumbnail
        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            const url = URL.createObjectURL(file);
            img.src = url;
            img.onload = () => URL.revokeObjectURL(url);
            previewContainer.appendChild(img);
        } else {
            // For PDFs, show an icon
            const icon = document.createElement('div');
            icon.style.cssText = `
                width: 200px;
                height: 200px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #f0f0f0;
                font-size: 4rem;
            `;
            icon.textContent = '📄';
            previewContainer.appendChild(icon);
        }
        
        // Add file name label
        const nameLabel = document.createElement('div');
        nameLabel.style.cssText = `
            position: absolute;
            top: 5px;
            left: 5px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.7rem;
            max-width: 180px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        `;
        nameLabel.textContent = file.name;
        nameLabel.title = file.name;
        previewContainer.appendChild(nameLabel);
        
        // Add remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = () => this.removeImage(previewContainer);
        previewContainer.appendChild(removeBtn);
        
        // Add analysis status
        const statusDiv = document.createElement('div');
        statusDiv.className = 'analysis-status';
        const sourceIcon = source === 'pasted' ? '📋' : source === 'dropped' ? '📥' : '📎';
        statusDiv.textContent = `${sourceIcon} Ready`;
        previewContainer.appendChild(statusDiv);
        
        return previewContainer;
    }

    // Check if file is likely a construction drawing
    isConstructionDrawing(file) {
        const fileName = file.name.toLowerCase();
        const drawingKeywords = /plan|drawing|blueprint|diagram|schematic|elevation|section|detail|schedule/i;
        const constructionKeywords = /floor|roof|site|foundation|framing|structural|electrical|plumbing|hvac|mechanical/i;
        
        return drawingKeywords.test(fileName) || 
               constructionKeywords.test(fileName) || 
               file.type === 'application/pdf';
    }

    // Analyze image using Azure Computer Vision
    async analyzeImage(imageData) {
        const statusDiv = imageData.preview.querySelector('.analysis-status');
        if (!statusDiv) return;
        
        statusDiv.textContent = '🔄 Analyzing...';
        statusDiv.style.background = 'rgba(21, 101, 192, 0.9)';
        
        try {
            // Convert file to base64
            const base64Data = await this.fileToBase64(imageData.file);
            
            // Prepare request body
            const requestBody = {
                imageData: base64Data.split(',')[1], // Remove data URL prefix
                fileName: imageData.file.name,
                fileType: imageData.file.type,
                analysisType: 'construction'
            };
            
            // Call Azure Function (authentication handled by CORS/function settings)
            const response = await fetch(this.azureFunctionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Azure Function error response:', errorText);
                throw new Error(`Analysis failed: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.analysis) {
                imageData.analysis = result.analysis;
                
                // Update status
                const analysisType = result.analysis.type || 'document';
                statusDiv.textContent = `✅ ${this.formatAnalysisType(analysisType)}`;
                statusDiv.style.background = 'rgba(76, 175, 80, 0.9)';
                
                // Add analysis overlay
                this.addAnalysisOverlay(imageData.preview, result.analysis);
                
                return result.analysis;
            } else {
                throw new Error(result.details || 'Analysis failed');
            }
        } catch (error) {
            console.error('Image analysis error:', error);
            statusDiv.textContent = '❌ Failed';
            statusDiv.style.background = 'rgba(244, 67, 54, 0.9)';
            
            // Don't show error for every image, just log it
            console.log(`Analysis failed for ${imageData.file.name}: ${error.message}`);
        }
    }

    // Convert file to base64
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    // Format analysis type for display
    formatAnalysisType(type) {
        const typeMap = {
            'floor_plan': 'Floor Plan',
            'elevation': 'Elevation',
            'section': 'Section',
            'detail': 'Detail',
            'blueprint': 'Blueprint',
            'diagram': 'Diagram',
            'drawing': 'Drawing',
            'document': 'Document',
            'unknown': 'Image'
        };
        return typeMap[type] || type;
    }

    // Add analysis overlay to preview
    addAnalysisOverlay(previewElement, analysis) {
        // Remove existing overlay if any
        const existingOverlay = previewElement.querySelector('.analysis-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }
        
        const overlay = document.createElement('div');
        overlay.className = 'analysis-overlay';
        
        // Build analysis content
        let content = '<div style="font-size: 0.75rem;"><strong>🔍 Analysis:</strong><br><br>';
        
        // Document type
        if (analysis.type) {
            content += `<strong>Type:</strong> ${this.formatAnalysisType(analysis.type)}<br>`;
        }
        
        // Detected elements
        if (analysis.elements && analysis.elements.length > 0) {
            content += `<strong>Elements (${analysis.elements.length}):</strong><br>`;
            analysis.elements.slice(0, 3).forEach(el => {
                content += `• ${el.type}<br>`;
            });
            if (analysis.elements.length > 3) {
                content += `• +${analysis.elements.length - 3} more<br>`;
            }
        }
        
        // Measurements
        if (analysis.measurements && analysis.measurements.length > 0) {
            content += `<strong>Measurements:</strong><br>`;
            analysis.measurements.slice(0, 3).forEach(m => {
                content += `• ${m.value}<br>`;
            });
        }
        
        // Materials
        if (analysis.materials && analysis.materials.length > 0) {
            content += `<strong>Materials:</strong> ${analysis.materials.slice(0, 3).join(', ')}<br>`;
        }
        
        // Rooms (for floor plans)
        if (analysis.rooms && analysis.rooms.length > 0) {
            content += `<strong>Rooms:</strong> ${analysis.rooms.length} detected<br>`;
        }
        
        // Text preview
        if (analysis.text && analysis.text.trim()) {
            const textPreview = analysis.text.substring(0, 50).replace(/\n/g, ' ');
            content += `<strong>Text:</strong> "${textPreview}..."<br>`;
        }
        
        content += '</div>';
        overlay.innerHTML = content;
        
        previewElement.appendChild(overlay);
    }

    // Remove image from attachments
    removeImage(previewContainer) {
        const index = this.attachedImages.findIndex(img => img.preview === previewContainer);
        if (index > -1) {
            this.attachedImages.splice(index, 1);
            previewContainer.remove();
            
            if (this.attachedImages.length === 0) {
                this.previewArea.style.display = 'none';
            }
            
            this.updateAttachmentIndicator();
        }
    }

    // Update attachment indicator
    updateAttachmentIndicator() {
        if (this.attachButton) {
            if (this.attachedImages.length > 0) {
                this.attachButton.style.background = 'linear-gradient(135deg, var(--hi-vis-green), #64dd17)';
                this.attachButton.title = `${this.attachedImages.length} image(s) attached`;
            } else {
                this.attachButton.style.background = '';
                this.attachButton.title = 'Attach images or drawings';
            }
        }
    }

    // Override the send message function to handle images
    overrideSendMessage() {
        const originalSendMessage = window.sendMessage;
        
        window.sendMessage = async () => {
            const message = this.chatInput?.value?.trim();
            
            // If we have attached images, enhance the message
            if (this.attachedImages.length > 0) {
                let enhancedMessage = message || 'Please analyze the attached images.';
                
                // Add image analysis context to the message
                const analysisContext = this.buildAnalysisContext();
                if (analysisContext) {
                    enhancedMessage += '\n\n' + analysisContext;
                }
                
                // Update the chat input with enhanced message
                if (this.chatInput) {
                    this.chatInput.value = enhancedMessage;
                }
            }
            
            // Call the original send message function
            if (originalSendMessage) {
                await originalSendMessage();
            }
            
            // Clear attached images after sending
            if (this.attachedImages.length > 0) {
                this.clearAttachedImages();
            }
        };
    }

    // Build analysis context from attached images
    buildAnalysisContext() {
        if (this.attachedImages.length === 0) return '';
        
        let context = `[Attached ${this.attachedImages.length} image(s) with analysis]:\n`;
        
        this.attachedImages.forEach((img, index) => {
            context += `\n📎 Image ${index + 1}: ${img.file.name}`;
            
            if (img.analysis) {
                if (img.analysis.type) {
                    context += ` (Type: ${this.formatAnalysisType(img.analysis.type)})`;
                }
                
                // Add key findings
                const findings = [];
                
                if (img.analysis.elements && img.analysis.elements.length > 0) {
                    findings.push(`${img.analysis.elements.length} elements detected`);
                }
                
                if (img.analysis.measurements && img.analysis.measurements.length > 0) {
                    findings.push(`${img.analysis.measurements.length} measurements found`);
                }
                
                if (img.analysis.materials && img.analysis.materials.length > 0) {
                    findings.push(`Materials: ${img.analysis.materials.slice(0, 3).join(', ')}`);
                }
                
                if (img.analysis.rooms && img.analysis.rooms.length > 0) {
                    findings.push(`${img.analysis.rooms.length} rooms identified`);
                }
                
                if (img.analysis.text && img.analysis.text.trim()) {
                    const textPreview = img.analysis.text.substring(0, 100).replace(/\n/g, ' ');
                    findings.push(`Text extracted: "${textPreview}..."`);
                }
                
                if (findings.length > 0) {
                    context += '\n  Analysis: ' + findings.join(', ');
                }
            } else {
                context += ' (Not analyzed)';
            }
        });
        
        return context;
    }

    // Clear all attached images
    clearAttachedImages() {
        this.attachedImages = [];
        if (this.previewArea) {
            this.previewArea.innerHTML = '';
            this.previewArea.style.display = 'none';
        }
        this.updateAttachmentIndicator();
    }

    // Show error message
    showError(message) {
        // Try to use the global showError if available
        if (typeof window.showError === 'function') {
            window.showError(message);
        } else {
            console.error(message);
            // Create temporary error display
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #f44336;
                color: white;
                padding: 1rem;
                border-radius: 5px;
                z-index: 10000;
                max-width: 300px;
                animation: slideIn 0.3s ease-out;
            `;
            errorDiv.textContent = message;
            document.body.appendChild(errorDiv);
            setTimeout(() => errorDiv.remove(), 5000);
        }
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

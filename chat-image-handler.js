// Chat Image Handler - Frontend Component
// Enables pasting and analyzing images/drawings in chat

class ChatImageHandler {
    constructor() {
        this.initPasteHandler();
        this.initDragDropHandler();
        this.initFileButton();
    }

    // Initialize paste event handler
    initPasteHandler() {
        const chatInput = document.getElementById('chatInput');
        const chatContainer = document.querySelector('.chat-input-container');
        
        // Create image preview area
        this.createImagePreviewArea(chatContainer);
        
        // Handle paste event
        document.addEventListener('paste', async (e) => {
            // Check if we're in the chat area
            if (!document.activeElement.closest('.chat-input-container')) return;
            
            const items = e.clipboardData.items;
            
            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    await this.handleImageFile(blob);
                }
            }
        });
    }

    // Initialize drag and drop handler
    initDragDropHandler() {
        const chatContainer = document.querySelector('.chat-container');
        
        chatContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            chatContainer.classList.add('drag-over');
        });
        
        chatContainer.addEventListener('dragleave', (e) => {
            chatContainer.classList.remove('drag-over');
        });
        
        chatContainer.addEventListener('drop', async (e) => {
            e.preventDefault();
            chatContainer.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            for (let file of files) {
                if (file.type.startsWith('image/')) {
                    await this.handleImageFile(file);
                }
            }
        });
    }

    // Create image preview area
    createImagePreviewArea(container) {
        const previewArea = document.createElement('div');
        previewArea.id = 'imagePreviewArea';
        previewArea.className = 'image-preview-area';
        previewArea.style.cssText = `
            display: none;
            padding: 1rem;
            background: #f8f9fa;
            border: 2px dashed #0078d4;
            border-radius: 8px;
            margin-bottom: 1rem;
            position: relative;
        `;
        
        container.insertBefore(previewArea, container.firstChild);
        this.previewArea = previewArea;
    }

    // Add image attachment button
    initFileButton() {
        const chatInputRow = document.querySelector('.chat-input-row');
        
        // Create file input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'chatImageInput';
        fileInput.accept = 'image/*,.pdf,.dwg,.dxf';
        fileInput.style.display = 'none';
        fileInput.multiple = true;
        
        // Create button
        const imageButton = document.createElement('button');
        imageButton.className = 'image-attach-button';
        imageButton.innerHTML = '📎';
        imageButton.title = 'Attach images or drawings';
        imageButton.style.cssText = `
            background: linear-gradient(135deg, #0078d4, #005a9e);
            color: white;
            border: none;
            padding: 0.75rem;
            border-radius: 50%;
            cursor: pointer;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
        `;
        
        imageButton.onclick = () => fileInput.click();
        fileInput.onchange = async (e) => {
            for (let file of e.target.files) {
                await this.handleImageFile(file);
            }
        };
        
        // Insert before send button
        const sendButton = document.getElementById('sendButton');
        chatInputRow.insertBefore(imageButton, sendButton);
        chatInputRow.insertBefore(fileInput, sendButton);
    }

    // Handle image file
    async handleImageFile(file) {
        // Show preview
        const preview = await this.createImagePreview(file);
        this.previewArea.style.display = 'block';
        this.previewArea.appendChild(preview);
        
        // Store for sending with message
        if (!window.attachedImages) window.attachedImages = [];
        window.attachedImages.push({
            file: file,
            preview: preview,
            analysis: null
        });
        
        // Auto-analyze image if it's a drawing
        if (this.isDrawing(file)) {
            await this.analyzeDrawing(file, preview);
        }
    }

    // Create image preview element
    async createImagePreview(file) {
        const previewContainer = document.createElement('div');
        previewContainer.className = 'image-preview-item';
        previewContainer.style.cssText = `
            display: inline-block;
            margin: 0.5rem;
            position: relative;
            border: 2px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        
        const img = document.createElement('img');
        img.style.cssText = `
            max-width: 200px;
            max-height: 200px;
            display: block;
        `;
        
        // Create object URL for preview
        const url = URL.createObjectURL(file);
        img.src = url;
        
        // Add remove button
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '×';
        removeBtn.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            background: rgba(255,0,0,0.8);
            color: white;
            border: none;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            cursor: pointer;
            font-size: 18px;
            line-height: 1;
        `;
        
        removeBtn.onclick = () => {
            previewContainer.remove();
            const index = window.attachedImages.findIndex(i => i.preview === previewContainer);
            if (index > -1) window.attachedImages.splice(index, 1);
            if (window.attachedImages.length === 0) {
                this.previewArea.style.display = 'none';
            }
        };
        
        // Add analysis status
        const statusDiv = document.createElement('div');
        statusDiv.className = 'analysis-status';
        statusDiv.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 0.25rem;
            font-size: 0.75rem;
            text-align: center;
        `;
        statusDiv.textContent = 'Ready to analyze';
        
        previewContainer.appendChild(img);
        previewContainer.appendChild(removeBtn);
        previewContainer.appendChild(statusDiv);
        
        return previewContainer;
    }

    // Check if file is likely a drawing
    isDrawing(file) {
        const drawingExtensions = ['.dwg', '.dxf', '.pdf', '.png', '.jpg', '.jpeg'];
        const fileName = file.name.toLowerCase();
        const isDrawingExt = drawingExtensions.some(ext => fileName.endsWith(ext));
        const hasDrawingKeywords = /plan|drawing|blueprint|diagram|schematic|elevation|section/i.test(fileName);
        
        return isDrawingExt || hasDrawingKeywords;
    }

    // Analyze drawing using Azure Computer Vision or custom model
    async analyzeDrawing(file, previewElement) {
        const statusDiv = previewElement.querySelector('.analysis-status');
        statusDiv.textContent = 'Analyzing...';
        statusDiv.style.background = 'rgba(0,120,212,0.9)';
        
        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('analysisType', 'construction');
            
            const response = await fetch('https://workflows.saxtechnology.com/webhook/ask-foreman/analyze-image', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const analysis = await response.json();
                
                // Store analysis results
                const imageData = window.attachedImages.find(i => i.preview === previewElement);
                if (imageData) {
                    imageData.analysis = analysis;
                }
                
                // Update status
                statusDiv.textContent = `✓ ${analysis.type || 'Image'} analyzed`;
                statusDiv.style.background = 'rgba(0,128,0,0.9)';
                
                // Add analysis overlay
                this.addAnalysisOverlay(previewElement, analysis);
                
                return analysis;
            } else {
                throw new Error('Analysis failed');
            }
        } catch (error) {
            console.error('Image analysis error:', error);
            statusDiv.textContent = 'Analysis failed';
            statusDiv.style.background = 'rgba(255,0,0,0.9)';
        }
    }

    // Add analysis overlay to preview
    addAnalysisOverlay(previewElement, analysis) {
        const overlay = document.createElement('div');
        overlay.className = 'analysis-overlay';
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 25px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 0.5rem;
            display: none;
            overflow-y: auto;
            font-size: 0.8rem;
        `;
        
        // Build analysis content
        let content = '<strong>Analysis Results:</strong><br>';
        
        if (analysis.dimensions) {
            content += `Dimensions: ${analysis.dimensions.width} x ${analysis.dimensions.height}<br>`;
        }
        
        if (analysis.elements) {
            content += `Elements found: ${analysis.elements.length}<br>`;
            analysis.elements.slice(0, 3).forEach(el => {
                content += `• ${el.type}: ${el.description}<br>`;
            });
        }
        
        if (analysis.text) {
            content += `Text extracted: ${analysis.text.substring(0, 100)}...<br>`;
        }
        
        if (analysis.measurements) {
            content += `Measurements detected: ${analysis.measurements.length}<br>`;
        }
        
        overlay.innerHTML = content;
        
        // Toggle overlay on hover
        previewElement.addEventListener('mouseenter', () => {
            overlay.style.display = 'block';
        });
        
        previewElement.addEventListener('mouseleave', () => {
            overlay.style.display = 'none';
        });
        
        previewElement.appendChild(overlay);
    }

    // Enhanced send message with images
    async sendMessageWithImages(messageText) {
        if (!window.attachedImages || window.attachedImages.length === 0) {
            // Regular text message
            return await sendMessage(messageText);
        }
        
        // Prepare multipart message
        const formData = new FormData();
        formData.append('message', messageText);
        formData.append('client', chatContext);
        formData.append('hasImages', 'true');
        
        // Add each image and its analysis
        window.attachedImages.forEach((imgData, index) => {
            formData.append(`image_${index}`, imgData.file);
            if (imgData.analysis) {
                formData.append(`analysis_${index}`, JSON.stringify(imgData.analysis));
            }
        });
        
        try {
            const response = await fetch('https://workflows.saxtechnology.com/webhook/ask-foreman/chat-with-images', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                
                // Clear attached images
                window.attachedImages = [];
                this.previewArea.innerHTML = '';
                this.previewArea.style.display = 'none';
                
                return result;
            }
        } catch (error) {
            console.error('Error sending message with images:', error);
            throw error;
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chatImageHandler = new ChatImageHandler();
    
    // Override the send message function to handle images
    const originalSendMessage = window.sendMessage;
    window.sendMessage = async function() {
        const message = chatInput.value.trim();
        if (!message && (!window.attachedImages || window.attachedImages.length === 0)) return;
        
        // Add user message
        addMessage(message || 'Analyzing attached images...', 'user');
        
        // Clear input
        chatInput.value = '';
        
        // Show typing indicator
        typingIndicator.classList.add('active');
        
        try {
            // Send with images if attached
            const result = await window.chatImageHandler.sendMessageWithImages(message);
            
            // Hide typing indicator
            typingIndicator.classList.remove('active');
            
            // Add assistant response
            addMessage(result.response, 'assistant');
            
        } catch (error) {
            typingIndicator.classList.remove('active');
            addMessage('Error processing your request. Please try again.', 'assistant');
        }
    };
});

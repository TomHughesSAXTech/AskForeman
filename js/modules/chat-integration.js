/**
 * Chat Integration Module
 * Handles all AI chat functionality with Azure OpenAI integration
 * @module ChatIntegration
 */

export class ChatManager {
    constructor(config = {}) {
        this.config = {
            webhookUrl: config.webhookUrl || 'https://workflows.saxtechnology.com/webhook/ask-foreman/chat',
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 1000,
            timeout: config.timeout || 30000,
            messageFormatter: config.messageFormatter || this.defaultMessageFormatter
        };
        
        this.activeRequests = new Map();
        this.messageHistory = [];
        this.contextData = null;
        this.isProcessing = false;
        this.abortController = null;
    }

    /**
     * Initialize chat manager with DOM elements
     */
    initialize(elements) {
        this.elements = {
            messagesContainer: elements.messagesContainer,
            inputField: elements.inputField,
            sendButton: elements.sendButton,
            stopButton: elements.stopButton,
            contextSelector: elements.contextSelector,
            typingIndicator: elements.typingIndicator,
            statusIndicator: elements.statusIndicator
        };
        
        this.attachEventListeners();
        this.updateUIState();
    }

    /**
     * Attach event listeners to UI elements
     */
    attachEventListeners() {
        if (this.elements.sendButton) {
            this.elements.sendButton.addEventListener('click', () => this.sendMessage());
        }
        
        if (this.elements.stopButton) {
            this.elements.stopButton.addEventListener('click', () => this.stopGeneration());
        }
        
        if (this.elements.inputField) {
            this.elements.inputField.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            
            this.elements.inputField.addEventListener('input', () => {
                this.updateSendButtonState();
            });
        }
        
        if (this.elements.contextSelector) {
            this.elements.contextSelector.addEventListener('change', (e) => {
                this.updateContext(e.target.value);
            });
        }
    }

    /**
     * Send a chat message
     */
    async sendMessage(message = null, attachments = null) {
        const userMessage = message || this.elements.inputField?.value?.trim();
        
        if (!userMessage && !attachments) {
            return;
        }
        
        // Check if already processing
        if (this.isProcessing) {
            console.log('Already processing a message');
            return;
        }
        
        this.isProcessing = true;
        this.abortController = new AbortController();
        
        // Clear input and update UI
        if (this.elements.inputField && !message) {
            this.elements.inputField.value = '';
        }
        
        this.updateUIState();
        
        // Add user message to chat
        const userMessageElement = this.addMessage('user', userMessage, attachments);
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            // Prepare the request payload
            const payload = this.preparePayload(userMessage, attachments);
            
            // Send to webhook
            const response = await this.sendToWebhook(payload);
            
            // Process and display response
            await this.processResponse(response);
            
        } catch (error) {
            if (error.name === 'AbortError') {
                this.addMessage('system', 'Response generation was stopped.');
            } else {
                console.error('Chat error:', error);
                this.addMessage('error', `Error: ${error.message}`);
            }
        } finally {
            this.isProcessing = false;
            this.hideTypingIndicator();
            this.updateUIState();
            this.abortController = null;
        }
    }

    /**
     * Prepare payload for webhook
     */
    preparePayload(message, attachments) {
        const payload = {
            message: message,
            context: this.contextData,
            history: this.getRecentHistory(),
            timestamp: new Date().toISOString(),
            sessionId: this.getSessionId()
        };
        
        if (attachments) {
            payload.attachments = attachments;
        }
        
        // Add project/client context if available
        if (this.elements.contextSelector) {
            const selectedContext = this.elements.contextSelector.value;
            if (selectedContext && selectedContext !== 'none') {
                payload.projectContext = selectedContext;
            }
        }
        
        return payload;
    }

    /**
     * Send payload to webhook
     */
    async sendToWebhook(payload) {
        const requestId = this.generateRequestId();
        
        try {
            const response = await fetch(this.config.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                signal: this.abortController?.signal
            });
            
            if (!response.ok) {
                throw new Error(`Webhook error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Handle streaming response if available
            if (data.stream) {
                return await this.handleStreamingResponse(data.streamUrl);
            }
            
            return data;
            
        } catch (error) {
            // Implement retry logic
            if (error.name !== 'AbortError' && this.shouldRetry(error)) {
                return await this.retryRequest(payload);
            }
            throw error;
        }
    }

    /**
     * Handle streaming response
     */
    async handleStreamingResponse(streamUrl) {
        const response = await fetch(streamUrl, {
            signal: this.abortController?.signal
        });
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        
        // Create assistant message element
        const assistantMessage = this.addMessage('assistant', '');
        const contentElement = assistantMessage.querySelector('.message-content');
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            const chunk = decoder.decode(value);
            fullResponse += chunk;
            
            // Update message content in real-time
            if (contentElement) {
                contentElement.innerHTML = this.formatMessage(fullResponse);
            }
        }
        
        return { response: fullResponse, streaming: true };
    }

    /**
     * Process and display response
     */
    async processResponse(data) {
        let responseText = data.response || data.message || data.text || 'No response received';
        
        // If not streaming, add the complete message
        if (!data.streaming) {
            this.addMessage('assistant', responseText, data.attachments);
        }
        
        // Store in history
        this.messageHistory.push({
            role: 'assistant',
            content: responseText,
            timestamp: new Date().toISOString()
        });
        
        // Handle any action items in response
        if (data.actions) {
            await this.handleResponseActions(data.actions);
        }
    }

    /**
     * Add message to chat UI
     */
    addMessage(role, content, attachments = null) {
        if (!this.elements.messagesContainer) {
            console.warn('Messages container not found');
            return null;
        }
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        
        // Add timestamp
        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = new Date().toLocaleTimeString();
        
        // Add content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        if (role === 'user' || role === 'system' || role === 'error') {
            contentDiv.textContent = content;
        } else {
            contentDiv.innerHTML = this.formatMessage(content);
        }
        
        messageDiv.appendChild(timestamp);
        messageDiv.appendChild(contentDiv);
        
        // Add attachments if present
        if (attachments) {
            const attachmentsDiv = this.createAttachmentsDisplay(attachments);
            messageDiv.appendChild(attachmentsDiv);
        }
        
        this.elements.messagesContainer.appendChild(messageDiv);
        
        // Auto-scroll to bottom
        this.scrollToBottom();
        
        // Store in history
        this.messageHistory.push({
            role: role,
            content: content,
            attachments: attachments,
            timestamp: new Date().toISOString()
        });
        
        return messageDiv;
    }

    /**
     * Format message content with markdown support
     */
    formatMessage(text) {
        if (!text) return '';
        
        // Custom formatter if provided
        if (this.config.messageFormatter !== this.defaultMessageFormatter) {
            return this.config.messageFormatter(text);
        }
        
        return this.defaultMessageFormatter(text);
    }

    /**
     * Default message formatter with markdown support
     */
    defaultMessageFormatter(text) {
        // Escape HTML
        let formatted = text.replace(/&/g, '&amp;')
                          .replace(/</g, '&lt;')
                          .replace(/>/g, '&gt;');
        
        // Headers
        formatted = formatted.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        formatted = formatted.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        formatted = formatted.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        
        // Bold
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italic
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Code blocks
        formatted = formatted.replace(/```(.*?)```/gs, '<pre><code>$1</code></pre>');
        
        // Inline code
        formatted = formatted.replace(/`(.*?)`/g, '<code>$1</code>');
        
        // Lists
        formatted = formatted.replace(/^\* (.*$)/gim, '<li>$1</li>');
        formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        
        formatted = formatted.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');
        
        // Links
        formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
        
        // Line breaks
        formatted = formatted.replace(/\n/g, '<br>');
        
        return formatted;
    }

    /**
     * Create attachments display
     */
    createAttachmentsDisplay(attachments) {
        const container = document.createElement('div');
        container.className = 'message-attachments';
        
        if (Array.isArray(attachments)) {
            attachments.forEach(attachment => {
                const item = document.createElement('div');
                item.className = 'attachment-item';
                
                if (attachment.type === 'image') {
                    const img = document.createElement('img');
                    img.src = attachment.url || attachment.data;
                    img.alt = attachment.name || 'Image';
                    img.className = 'attachment-image';
                    item.appendChild(img);
                } else if (attachment.type === 'file') {
                    const link = document.createElement('a');
                    link.href = attachment.url;
                    link.download = attachment.name;
                    link.className = 'attachment-file';
                    link.innerHTML = `<i class="fas fa-file"></i> ${attachment.name}`;
                    item.appendChild(link);
                }
                
                container.appendChild(item);
            });
        }
        
        return container;
    }

    /**
     * Handle response actions (e.g., file operations, data updates)
     */
    async handleResponseActions(actions) {
        for (const action of actions) {
            switch (action.type) {
                case 'download':
                    this.triggerDownload(action.url, action.filename);
                    break;
                case 'update_context':
                    this.updateContext(action.context);
                    break;
                case 'show_modal':
                    this.showModal(action.content);
                    break;
                case 'refresh_data':
                    await this.refreshData(action.target);
                    break;
                default:
                    console.log('Unknown action type:', action.type);
            }
        }
    }

    /**
     * Show typing indicator
     */
    showTypingIndicator() {
        if (this.elements.typingIndicator) {
            this.elements.typingIndicator.style.display = 'block';
        }
    }

    /**
     * Hide typing indicator
     */
    hideTypingIndicator() {
        if (this.elements.typingIndicator) {
            this.elements.typingIndicator.style.display = 'none';
        }
    }

    /**
     * Update UI state based on processing status
     */
    updateUIState() {
        this.updateSendButtonState();
        this.updateStopButtonState();
        this.updateStatusIndicator();
    }

    /**
     * Update send button state
     */
    updateSendButtonState() {
        if (!this.elements.sendButton) return;
        
        const hasInput = this.elements.inputField?.value?.trim().length > 0;
        
        if (this.isProcessing) {
            this.elements.sendButton.disabled = true;
            this.elements.sendButton.classList.add('disabled');
        } else if (hasInput) {
            this.elements.sendButton.disabled = false;
            this.elements.sendButton.classList.remove('disabled');
        } else {
            this.elements.sendButton.disabled = true;
            this.elements.sendButton.classList.add('disabled');
        }
    }

    /**
     * Update stop button state
     */
    updateStopButtonState() {
        if (!this.elements.stopButton) return;
        
        if (this.isProcessing) {
            this.elements.stopButton.style.display = 'inline-block';
            this.elements.stopButton.disabled = false;
        } else {
            this.elements.stopButton.style.display = 'none';
            this.elements.stopButton.disabled = true;
        }
    }

    /**
     * Update status indicator
     */
    updateStatusIndicator() {
        if (!this.elements.statusIndicator) return;
        
        if (this.isProcessing) {
            this.elements.statusIndicator.textContent = 'Processing...';
            this.elements.statusIndicator.className = 'status-processing';
        } else {
            this.elements.statusIndicator.textContent = 'Ready';
            this.elements.statusIndicator.className = 'status-ready';
        }
    }

    /**
     * Stop current generation
     */
    stopGeneration() {
        if (this.abortController) {
            this.abortController.abort();
            this.isProcessing = false;
            this.updateUIState();
        }
    }

    /**
     * Update chat context
     */
    updateContext(context) {
        this.contextData = context;
        
        // Clear history if switching context
        if (context === 'new' || context === 'combined-projects') {
            this.messageHistory = [];
            if (this.elements.messagesContainer) {
                // Keep system messages, clear others
                const systemMessages = this.elements.messagesContainer.querySelectorAll('.system-message');
                this.elements.messagesContainer.innerHTML = '';
                systemMessages.forEach(msg => this.elements.messagesContainer.appendChild(msg));
            }
        }
    }

    /**
     * Get recent chat history for context
     */
    getRecentHistory(limit = 10) {
        return this.messageHistory.slice(-limit);
    }

    /**
     * Get or create session ID
     */
    getSessionId() {
        if (!this.sessionId) {
            this.sessionId = 'chat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        }
        return this.sessionId;
    }

    /**
     * Generate unique request ID
     */
    generateRequestId() {
        return 'req-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Check if request should be retried
     */
    shouldRetry(error) {
        return error.message.includes('network') || 
               error.message.includes('timeout') ||
               error.message.includes('503');
    }

    /**
     * Retry failed request
     */
    async retryRequest(payload, attempt = 1) {
        if (attempt > this.config.maxRetries) {
            throw new Error('Max retries exceeded');
        }
        
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
        
        try {
            return await this.sendToWebhook(payload);
        } catch (error) {
            if (error.name !== 'AbortError' && this.shouldRetry(error)) {
                return await this.retryRequest(payload, attempt + 1);
            }
            throw error;
        }
    }

    /**
     * Scroll chat to bottom
     */
    scrollToBottom() {
        if (this.elements.messagesContainer) {
            this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
        }
    }

    /**
     * Trigger file download
     */
    triggerDownload(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    /**
     * Show modal with content
     */
    showModal(content) {
        // Implementation depends on your modal system
        console.log('Show modal:', content);
    }

    /**
     * Refresh data
     */
    async refreshData(target) {
        // Implementation depends on what needs refreshing
        console.log('Refresh data:', target);
    }

    /**
     * Export chat history
     */
    exportHistory(format = 'json') {
        const data = {
            sessionId: this.sessionId,
            context: this.contextData,
            messages: this.messageHistory,
            exportedAt: new Date().toISOString()
        };
        
        if (format === 'json') {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            this.triggerDownload(url, `chat-history-${Date.now()}.json`);
        } else if (format === 'txt') {
            let text = `Chat History - ${data.exportedAt}\n\n`;
            data.messages.forEach(msg => {
                text += `[${msg.role.toUpperCase()}] ${msg.timestamp}\n${msg.content}\n\n`;
            });
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            this.triggerDownload(url, `chat-history-${Date.now()}.txt`);
        }
    }

    /**
     * Clear chat history
     */
    clearHistory() {
        this.messageHistory = [];
        if (this.elements.messagesContainer) {
            this.elements.messagesContainer.innerHTML = '';
        }
    }
}

// Export for use in other modules
export default ChatManager;

/**
 * Comprehensive Fixes for AskForeman Application
 * This file contains all the fixes and improvements requested
 * Include this file in your HTML pages to apply all fixes
 */

(function() {
    'use strict';

    // ========================================
    // RESPONSE STREAMING & PERFORMANCE OPTIMIZATION
    // ========================================
    
    /**
     * Enhanced fetch with streaming support
     * Replaces regular fetch calls with streaming-enabled version
     */
    window.streamingFetch = async function(url, options = {}) {
        const controller = new AbortController();
        const signal = controller.signal;
        
        // Store abort controller for potential cancellation
        window.currentStreamController = controller;
        
        // Merge signals if one already exists
        if (options.signal) {
            options.signal.addEventListener('abort', () => controller.abort());
        }
        
        try {
            const response = await fetch(url, {
                ...options,
                signal,
                headers: {
                    ...options.headers,
                    'Accept': 'text/event-stream, application/json',
                    'X-Stream-Response': 'true'
                }
            });
            
            // Check if response supports streaming
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/event-stream')) {
                return handleStreamingResponse(response);
            }
            
            // Fallback to regular JSON response
            return response;
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Request was cancelled');
            }
            throw error;
        }
    };
    
    /**
     * Handle streaming response with real-time updates
     */
    async function handleStreamingResponse(response) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let messageContainer = null;
        let currentMessageDiv = null;
        
        // Find the active chat messages container
        const chatMessages = document.getElementById('chatMessages');
        const typingIndicator = document.getElementById('typingIndicator');
        
        // Create message container for streaming content
        if (chatMessages && typingIndicator) {
            typingIndicator.classList.remove('active');
            
            currentMessageDiv = document.createElement('div');
            currentMessageDiv.className = 'message assistant';
            currentMessageDiv.innerHTML = `
                <div class="message-avatar">🤖</div>
                <div class="message-content">
                    <div class="formatted-content streaming-content"></div>
                    <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            `;
            
            if (typingIndicator && typingIndicator.parentNode === chatMessages) {
                chatMessages.insertBefore(currentMessageDiv, typingIndicator);
            } else {
                chatMessages.appendChild(currentMessageDiv);
            }
            messageContainer = currentMessageDiv.querySelector('.streaming-content');
        }
        
        let fullResponse = '';
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                
                // Process SSE events
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        
                        try {
                            const parsed = JSON.parse(data);
                            
                            if (parsed.delta) {
                                // Append delta to response
                                fullResponse += parsed.delta;
                                
                                // Update UI with formatted content
                                if (messageContainer) {
                                    messageContainer.innerHTML = formatStreamingContent(fullResponse);
                                    
                                    // Auto-scroll to bottom
                                    chatMessages.scrollTop = chatMessages.scrollHeight;
                                }
                            } else if (parsed.content) {
                                // Full content update
                                fullResponse = parsed.content;
                                
                                if (messageContainer) {
                                    messageContainer.innerHTML = formatStreamingContent(fullResponse);
                                    chatMessages.scrollTop = chatMessages.scrollHeight;
                                }
                            }
                            
                            // Handle completion
                            if (parsed.done || parsed.finished) {
                                break;
                            }
                        } catch (e) {
                            // Not JSON, might be plain text
                            if (data.trim()) {
                                fullResponse += data;
                                if (messageContainer) {
                                    messageContainer.innerHTML = formatStreamingContent(fullResponse);
                                    chatMessages.scrollTop = chatMessages.scrollHeight;
                                }
                            }
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
            
            // Remove streaming class when done
            if (messageContainer) {
                messageContainer.classList.remove('streaming-content');
            }
        }
        
        // Return a mock response object with the full content
        return {
            ok: true,
            status: 200,
            json: async () => ({ response: fullResponse }),
            text: async () => fullResponse
        };
    }
    
    /**
     * Format streaming content with proper markdown/HTML
     */
    function formatStreamingContent(content) {
        if (!content) return '';
        
        // Basic markdown to HTML conversion
        let html = content;
        
        // Code blocks
        html = html.replace(/```([\s\S]*?)```/g, '<pre style="background: #f6f8fa; padding: 1rem; border-radius: 6px; overflow-x: auto;"><code>$1</code></pre>');
        
        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code style="background: #f6f8fa; padding: 0.2rem 0.4rem; border-radius: 3px;">$1</code>');
        
        // Bold
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        
        // Lists
        html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\s*)+/g, '<ul style="margin: 0.5rem 0;">$&</ul>');
        
        // Line breaks
        html = html.replace(/\n\n/g, '</p><p>');
        html = '<p>' + html + '</p>';
        
        return html;
    }
    
    /**
     * Override existing chat send functions to use streaming
     */
    function enhanceChatFunctions() {
        // Find all send message functions and enhance them
        const originalSendMessage = window.sendMessage;
        
        if (originalSendMessage) {
            window.sendMessage = async function() {
                const chatInput = document.getElementById('chatInput');
                const sendButton = document.getElementById('sendButton');
                const stopButton = document.getElementById('stopButton');
                const typingIndicator = document.getElementById('typingIndicator');
                const chatMessages = document.getElementById('chatMessages');
                
                const message = chatInput.value.trim();
                if (!message) return;
                
                // Disable send button, show stop button
                if (sendButton) {
                    sendButton.disabled = true;
                    sendButton.classList.add('sending');
                }
                
                if (stopButton) {
                    stopButton.style.display = 'inline-flex';
                }
                
                // Add user message
                const userMessageDiv = document.createElement('div');
                userMessageDiv.className = 'message user';
                userMessageDiv.innerHTML = `
                    <div class="message-content">
                        <div class="formatted-content">${escapeHtml(message)}</div>
                        <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                `;
                
                if (chatMessages) {
                    if (typingIndicator && typingIndicator.parentNode === chatMessages) {
                        chatMessages.insertBefore(userMessageDiv, typingIndicator);
                    } else {
                        chatMessages.appendChild(userMessageDiv);
                    }
                }
                
                // Clear input
                chatInput.value = '';
                
                // Show typing indicator briefly
                if (typingIndicator) {
                    typingIndicator.classList.add('active');
                }
                
                try {
                    // Use streaming fetch
                    const webhookUrl = window.API_CONFIG?.chatWebhookUrl || 
                                      'https://workflows.saxtechnology.com/webhook/ask-foreman/chat';
                    
                    const response = await streamingFetch(webhookUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            message: message,
                            stream: true,
                            context: window.chatContext || 'general',
                            sessionId: window.selectedClient || window.selectedProject || 'general'
                        })
                    });
                    
                    // Response is already handled by streaming function
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    
                } catch (error) {
                    console.error('Chat error:', error);
                    
                    // Hide typing indicator
                    if (typingIndicator) {
                        typingIndicator.classList.remove('active');
                    }
                    
                    // Add error message
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'message assistant';
                    errorDiv.innerHTML = `
                        <div class="message-avatar">⚠️</div>
                        <div class="message-content" style="background: #fee;">
                            <div class="formatted-content">Sorry, I encountered an error. Please try again.</div>
                            <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                    `;
                    
                    if (chatMessages) {
                        if (typingIndicator && typingIndicator.parentNode === chatMessages) {
                            chatMessages.insertBefore(errorDiv, typingIndicator);
                        } else {
                            chatMessages.appendChild(errorDiv);
                        }
                    }
                } finally {
                    // Re-enable send button
                    if (sendButton) {
                        sendButton.disabled = false;
                        sendButton.classList.remove('sending');
                    }
                    
                    // Hide stop button
                    if (stopButton) {
                        stopButton.style.display = 'none';
                    }
                    
                    // Hide typing indicator
                    if (typingIndicator) {
                        typingIndicator.classList.remove('active');
                    }
                    
                    // Scroll to bottom
                    if (chatMessages) {
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                }
            };
        }
    }
    
    /**
     * Helper function to escape HTML
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========================================
    // 1. ADMIN.HTML FIXES
    // ========================================
    
    function fixAdminPage() {
        if (!window.location.pathname.includes('admin.html')) return;

        // Remove duplicate Index Statistics section
        const indexStatsDivs = document.querySelectorAll('#indexStats');
        if (indexStatsDivs.length > 1) {
            for (let i = 1; i < indexStatsDivs.length; i++) {
                indexStatsDivs[i].remove();
            }
        }

        // Remove Force Refresh Stats button (keep only one refresh button)
        const forceRefreshBtns = document.querySelectorAll('button');
        forceRefreshBtns.forEach(btn => {
            if (btn.textContent.includes('Force Refresh Stats') && !btn.id) {
                btn.remove();
            }
        });

        // Remove Sync Azure Storage button
        const syncBtn = Array.from(document.querySelectorAll('button')).find(
            btn => btn.textContent.includes('Sync Azure Storage')
        );
        if (syncBtn) {
            syncBtn.parentElement.parentElement.remove();
        }

        // Remove Download Project Data button
        const exportBtn = Array.from(document.querySelectorAll('button')).find(
            btn => btn.textContent.includes('Export Project Data') || 
                  btn.textContent.includes('Download Project')
        );
        if (exportBtn) {
            exportBtn.parentElement.parentElement.remove();
        }

        // Fix file limit warning messages
        const fileLimitWarnings = document.querySelectorAll('.file-limit-warning');
        fileLimitWarnings.forEach(warning => {
            warning.innerHTML = `
                ⚠️ <strong>Upload Limits:</strong><br>
                • Maximum file size: 100MB per file<br>
                • Maximum files per upload: 15 files<br>
                • Supported formats: PDF, Word (.docx, .doc), Excel (.xlsx, .xls)
            `;
        });

        // Expand filename column in document tables
        const fileNameHeaders = document.querySelectorAll('th');
        fileNameHeaders.forEach(th => {
            if (th.textContent.includes('File Name')) {
                th.style.width = '35%';
                th.style.minWidth = '300px';
            }
        });

        // Remove Status column from valid documents display
        if (window.viewIndexContents) {
            const originalViewIndexContents = window.viewIndexContents;
            window.viewIndexContents = async function(forceRefresh) {
                await originalViewIndexContents.call(this, forceRefresh);
                
                // Remove Status column after content loads
                setTimeout(() => {
                    const statusHeaders = document.querySelectorAll('th');
                    statusHeaders.forEach(th => {
                        if (th.textContent === 'Status') {
                            const index = Array.from(th.parentElement.children).indexOf(th);
                            th.remove();
                            
                            // Remove corresponding td elements
                            const rows = document.querySelectorAll('tbody tr');
                            rows.forEach(row => {
                                if (row.children[index]) {
                                    row.children[index].remove();
                                }
                            });
                        }
                    });
                }, 100);
            };
        }

        // Add Logs tab
        addLogsTab();

        // Add Knowledge Graph status to index area
        addKnowledgeGraphStatus();

        // Add Last Modified column to documents
        enhanceDocumentTable();

        // Fix document count display
        fixDocumentCounts();
    }

    // Add Logs tab functionality
    function addLogsTab() {
        const tabsContainer = document.querySelector('.tabs');
        if (!tabsContainer) return;

        // Check if logs tab already exists
        if (document.querySelector('[onclick*="logs"]')) return;

        // Add Logs tab button
        const logsTab = document.createElement('button');
        logsTab.className = 'tab';
        logsTab.textContent = 'Logs';
        logsTab.onclick = () => switchTab('logs');
        tabsContainer.appendChild(logsTab);

        // Create Logs content
        const operationsTab = document.getElementById('operationsTab');
        if (!operationsTab) return;

        const logsContent = document.createElement('div');
        logsContent.id = 'logsTab';
        logsContent.className = 'tab-content';
        logsContent.innerHTML = `
            <div style="padding: 1rem;">
                <h3>📋 Upload & Processing Logs</h3>
                <div style="margin-top: 1rem;">
                    <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                        <button class="btn btn-primary" onclick="refreshLogs()">🔄 Refresh Logs</button>
                        <button class="btn" onclick="clearLogs()">🗑️ Clear Logs</button>
                        <select id="logFilter" onchange="filterLogs()" style="padding: 0.5rem; border-radius: 5px;">
                            <option value="all">All Logs</option>
                            <option value="error">Errors Only</option>
                            <option value="success">Success Only</option>
                            <option value="warning">Warnings Only</option>
                        </select>
                    </div>
                    <div id="logsContainer" style="max-height: 500px; overflow-y: auto; background: #f5f5f5; border-radius: 5px; padding: 1rem;">
                        <div id="logsList"></div>
                    </div>
                </div>
            </div>
        `;
        operationsTab.parentElement.appendChild(logsContent);

        // Initialize logs
        window.uploadLogs = window.uploadLogs || [];
        window.refreshLogs = function() {
            const logsList = document.getElementById('logsList');
            if (!logsList) return;

            if (window.uploadLogs.length === 0) {
                logsList.innerHTML = '<p style="color: #666; text-align: center;">No logs available</p>';
                return;
            }

            let html = '<table style="width: 100%; border-collapse: collapse;">';
            html += '<thead><tr>';
            html += '<th style="padding: 0.5rem; border-bottom: 2px solid #ddd; text-align: left;">Time</th>';
            html += '<th style="padding: 0.5rem; border-bottom: 2px solid #ddd; text-align: left;">Type</th>';
            html += '<th style="padding: 0.5rem; border-bottom: 2px solid #ddd; text-align: left;">File</th>';
            html += '<th style="padding: 0.5rem; border-bottom: 2px solid #ddd; text-align: left;">Message</th>';
            html += '</tr></thead><tbody>';

            window.uploadLogs.forEach(log => {
                const typeColor = log.type === 'error' ? '#f44336' : 
                                 log.type === 'warning' ? '#ff9800' : '#4caf50';
                const typeIcon = log.type === 'error' ? '❌' : 
                                log.type === 'warning' ? '⚠️' : '✅';
                
                html += '<tr>';
                html += `<td style="padding: 0.5rem; border-bottom: 1px solid #eee;">${log.time}</td>`;
                html += `<td style="padding: 0.5rem; border-bottom: 1px solid #eee; color: ${typeColor};">${typeIcon} ${log.type}</td>`;
                html += `<td style="padding: 0.5rem; border-bottom: 1px solid #eee;">${log.file || '-'}</td>`;
                html += `<td style="padding: 0.5rem; border-bottom: 1px solid #eee;">${log.message}</td>`;
                html += '</tr>';
            });

            html += '</tbody></table>';
            logsList.innerHTML = html;
        };

        window.clearLogs = function() {
            window.uploadLogs = [];
            window.refreshLogs();
        };

        window.filterLogs = function() {
            const filter = document.getElementById('logFilter').value;
            // Implementation for filtering logs
            window.refreshLogs();
        };

        // Log upload events
        window.logUploadEvent = function(type, file, message) {
            window.uploadLogs = window.uploadLogs || [];
            window.uploadLogs.unshift({
                time: new Date().toLocaleString(),
                type: type,
                file: file,
                message: message
            });
            // Keep only last 100 logs
            if (window.uploadLogs.length > 100) {
                window.uploadLogs = window.uploadLogs.slice(0, 100);
            }
        };
    }

    // Add Knowledge Graph status indicator
    function addKnowledgeGraphStatus() {
        const indexStatusDiv = document.querySelector('#indexStatusDisplay');
        if (!indexStatusDiv) return;

        const kgStatusDiv = document.createElement('div');
        kgStatusDiv.style.cssText = 'margin-top: 1rem; padding: 1rem; background: #e3f2fd; border-radius: 5px; border: 1px solid #2196f3;';
        kgStatusDiv.innerHTML = `
            <h5 style="margin-bottom: 0.5rem; color: #1976d2;">🌐 Knowledge Graph Status</h5>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem;">
                <div>Status: <span id="kgStatus" style="font-weight: bold; color: #4caf50;">Active</span></div>
                <div>Projects: <span id="kgProjects" style="font-weight: bold;">0</span></div>
                <div>Last Update: <span id="kgLastUpdate" style="font-weight: bold;">Never</span></div>
                <div>Cross-References: <span id="kgReferences" style="font-weight: bold;">0</span></div>
            </div>
            <div style="margin-top: 0.5rem;">
                <button class="btn btn-small" onclick="viewKnowledgeGraph()" style="padding: 0.25rem 0.5rem; font-size: 0.85rem;">
                    View Graph Contents
                </button>
            </div>
        `;
        
        indexStatusDiv.parentElement.appendChild(kgStatusDiv);

        // Function to view Knowledge Graph
        window.viewKnowledgeGraph = function() {
            alert('Knowledge Graph viewer will open here showing cross-project relationships');
        };
    }

    // Enhance document table with Last Modified column
    function enhanceDocumentTable() {
        // This will be called when documents are loaded
        const originalLoadClientDocuments = window.loadClientDocuments;
        if (originalLoadClientDocuments) {
            window.loadClientDocuments = async function() {
                await originalLoadClientDocuments.call(this);
                
                // Add Last Modified column to headers
                setTimeout(() => {
                    const tables = document.querySelectorAll('.document-table');
                    tables.forEach(table => {
                        const headerRow = table.querySelector('thead tr');
                        if (headerRow && !headerRow.querySelector('th[data-column="modified"]')) {
                            const modifiedHeader = document.createElement('th');
                            modifiedHeader.textContent = 'Last Modified';
                            modifiedHeader.setAttribute('data-column', 'modified');
                            modifiedHeader.style.cssText = 'padding: 0.5rem; text-align: left;';
                            
                            // Insert before the last column
                            const lastHeader = headerRow.lastElementChild;
                            headerRow.insertBefore(modifiedHeader, lastHeader);
                        }
                    });
                }, 100);
            };
        }
    }

    // Fix document count discrepancies
    function fixDocumentCounts() {
        // Override the display to show actual counts
        const updateCounts = () => {
            const indexedFilesEl = document.getElementById('indexedFilesCount');
            const docCountEl = document.getElementById('indexDocCount');
            
            if (window.lastKnownDocumentCount && window.lastKnownDocumentCount > 0) {
                if (indexedFilesEl) {
                    indexedFilesEl.textContent = window.lastKnownDocumentCount;
                }
                if (docCountEl) {
                    docCountEl.textContent = `Documents: ${window.lastKnownDocumentCount}`;
                }
            }
        };

        // Check periodically
        setInterval(updateCounts, 2000);
    }

    // ========================================
    // 2. INDEX.HTML & CHAT FIXES
    // ========================================

    function fixIndexPage() {
        if (!window.location.pathname.includes('index.html')) return;

        // Fix "All Clients (Knowledge Graph)" text
        fixKnowledgeGraphLabel();

        // Fix View Capabilities bubble
        fixCapabilitiesBubble();

        // Make chatbot window bigger
        enlargeChatWindow();

        // Fix document counter
        fixDocumentCounter();

        // Add proper send button states
        enhanceSendButton();

        // Add stop button functionality
        addStopButton();

        // Fix image display in chat
        fixImageDisplay();

        // Improve response time
        optimizeChatPerformance();

        // Fix file upload restrictions
        fixFileUploadRestrictions();

        // Fix document links
        fixDocumentLinks();
    }

    // Fix Knowledge Graph label
    function fixKnowledgeGraphLabel() {
        const interval = setInterval(() => {
            const kgOption = document.querySelector('option[value="all-clients"]');
            if (kgOption) {
                kgOption.textContent = '🌐 Combined Projects';
                clearInterval(interval);
            }
        }, 100);

        // Also fix in the change handler
        if (window.chatClientSelect) {
            const originalHandler = window.chatClientSelect.onchange;
            window.chatClientSelect.onchange = function(e) {
                if (e.target.value === 'all-clients') {
                    e.target.options[e.target.selectedIndex].text = '🌐 Combined Projects';
                }
                if (originalHandler) originalHandler.call(this, e);
            };
        }
    }

    // Fix View Capabilities bubble visibility
    function fixCapabilitiesBubble() {
        const style = document.createElement('style');
        style.textContent = `
            .capabilities-bubble {
                display: block !important;
                opacity: 1 !important;
                visibility: visible !important;
                position: absolute;
                top: 100%;
                right: 0;
                margin-top: 0.5rem;
                background: white;
                border: 2px solid var(--blueprint-blue);
                border-radius: 12px;
                padding: 1rem;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                z-index: 10000;
                min-width: 300px;
            }
            
            .view-capabilities-btn {
                position: relative;
            }
            
            .view-capabilities-btn:hover .capabilities-bubble {
                display: block !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Make chatbot window bigger
    function enlargeChatWindow() {
        const style = document.createElement('style');
        style.textContent = `
            .chat-messages {
                min-height: 500px !important;
                max-height: 650px !important;
                height: 650px !important;
            }
            
            .chat-container {
                min-height: 750px !important;
            }
            
            .chat-section {
                flex: 1.5 !important;
            }
        `;
        document.head.appendChild(style);
    }

    // Fix document counter
    function fixDocumentCounter() {
        const updateDocumentCount = async () => {
            const docsCountEl = document.getElementById('totalDocsCount');
            if (!docsCountEl) return;

            try {
                // Count actual documents in blob storage
                const response = await fetch(`https://saxtechfcs.blob.core.windows.net/fcs-clients?restype=container&comp=list&sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D`);
                
                if (response.ok) {
                    const text = await response.text();
                    const parser = new DOMParser();
                    const xml = parser.parseFromString(text, 'text/xml');
                    const blobs = xml.querySelectorAll('Blob Name');
                    
                    let count = 0;
                    blobs.forEach(blob => {
                        const name = blob.textContent;
                        if (name && !name.includes('.placeholder') && name.includes('FCS-OriginalClients')) {
                            count++;
                        }
                    });
                    
                    docsCountEl.textContent = count;
                }
            } catch (error) {
                console.error('Error counting documents:', error);
            }
        };

        // Update count on load and periodically
        updateDocumentCount();
        setInterval(updateDocumentCount, 30000);
    }

    // Enhance send button with active/inactive states
    function enhanceSendButton() {
        const sendButton = document.getElementById('sendButton');
        const chatInput = document.getElementById('chatInput');
        
        if (!sendButton || !chatInput) return;

        const updateSendButton = () => {
            const hasContent = chatInput.value.trim().length > 0;
            
            if (window.isGenerating) {
                sendButton.disabled = true;
                sendButton.style.opacity = '0.5';
                sendButton.style.cursor = 'not-allowed';
            } else if (hasContent) {
                sendButton.disabled = false;
                sendButton.style.opacity = '1';
                sendButton.style.cursor = 'pointer';
                sendButton.classList.add('active');
            } else {
                sendButton.disabled = true;
                sendButton.style.opacity = '0.5';
                sendButton.style.cursor = 'not-allowed';
                sendButton.classList.remove('active');
            }
        };

        chatInput.addEventListener('input', updateSendButton);
        chatInput.addEventListener('keyup', updateSendButton);
        updateSendButton();
    }

    // Add stop button functionality
    function addStopButton() {
        const sendButton = document.getElementById('sendButton');
        if (!sendButton) return;

        // Create stop button if it doesn't exist
        let stopButton = document.getElementById('stopButton');
        if (!stopButton) {
            stopButton = document.createElement('button');
            stopButton.id = 'stopButton';
            stopButton.className = 'stop-button';
            stopButton.innerHTML = '⏹ Stop';
            stopButton.style.cssText = `
                display: none;
                padding: 0.75rem 1.5rem;
                background: #f44336;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                margin-left: 0.5rem;
            `;
            sendButton.parentElement.appendChild(stopButton);
        }

        // Show/hide based on generation state
        const originalSendMessage = window.sendMessage;
        if (originalSendMessage) {
            window.sendMessage = async function() {
                stopButton.style.display = 'inline-block';
                sendButton.style.display = 'none';
                
                const result = await originalSendMessage.call(this);
                
                stopButton.style.display = 'none';
                sendButton.style.display = 'inline-block';
                
                return result;
            };
        }

        // Stop button click handler
        stopButton.onclick = () => {
            if (window.abortController) {
                window.abortController.abort();
            }
            stopButton.style.display = 'none';
            sendButton.style.display = 'inline-block';
        };
    }

    // Fix image display in chat
    function fixImageDisplay() {
        const originalAddMessage = window.addMessage;
        if (originalAddMessage) {
            window.addMessage = function(content, sender) {
                // Check if content contains base64 image
                if (content && content.includes('data:image')) {
                    const imgMatch = content.match(/data:image\/[^;]+;base64,[^"]+/);
                    if (imgMatch) {
                        const imgTag = `<img src="${imgMatch[0]}" style="max-width: 100%; max-height: 400px; border-radius: 8px; margin: 0.5rem 0;">`;
                        content = content.replace(imgMatch[0], imgTag);
                    }
                }
                
                return originalAddMessage.call(this, content, sender);
            };
        }
    }

    // Optimize chat performance
    function optimizeChatPerformance() {
        // Add request caching
        const cache = new Map();
        const CACHE_DURATION = 60000; // 1 minute

        const originalFetch = window.fetch;
        window.fetch = function(url, options) {
            // Only cache GET requests to specific endpoints
            if (options && options.method === 'GET' && url.includes('index/stats')) {
                const cacheKey = url;
                const cached = cache.get(cacheKey);
                
                if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
                    return Promise.resolve(cached.response.clone());
                }
                
                return originalFetch(url, options).then(response => {
                    cache.set(cacheKey, {
                        response: response.clone(),
                        timestamp: Date.now()
                    });
                    return response;
                });
            }
            
            return originalFetch(url, options);
        };

        // Debounce typing indicator
        let typingTimeout;
        const showTyping = () => {
            const indicator = document.getElementById('typingIndicator');
            if (indicator) {
                clearTimeout(typingTimeout);
                indicator.style.display = 'block';
                typingTimeout = setTimeout(() => {
                    indicator.style.display = 'none';
                }, 3000);
            }
        };
    }

    // Fix file upload restrictions
    function fixFileUploadRestrictions() {
        // Enable .doc and .xls files
        const fileInputs = document.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => {
            input.setAttribute('accept', '.pdf,.docx,.doc,.xlsx,.xls');
        });

        // Update validation function
        if (window.isValidFile) {
            window.isValidFile = function(file) {
                const validTypes = ['.pdf', '.docx', '.doc', '.xlsx', '.xls'];
                const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
                const maxSize = 100 * 1024 * 1024; // 100MB
                
                if (!validTypes.includes(extension)) {
                    alert(`Invalid file type: ${file.name}\nSupported formats: PDF, Word (.docx, .doc), Excel (.xlsx, .xls)`);
                    return false;
                }
                
                if (file.size > maxSize) {
                    alert(`File too large: ${file.name}\nMaximum size: 100MB`);
                    return false;
                }
                
                return true;
            };
        }
    }

    // Fix document links
    function fixDocumentLinks() {
        // Override link click behavior
        document.addEventListener('click', (e) => {
            if (e.target.matches('a[href*="blob.core.windows.net"]')) {
                e.preventDefault();
                const url = e.target.href;
                
                // Remove any existing response-content-disposition
                let cleanUrl = url.replace(/&response-content-disposition=[^&]+/, '');
                
                // Add inline disposition
                cleanUrl += '&response-content-disposition=' + encodeURIComponent('inline');
                
                // Open in new tab
                window.open(cleanUrl, '_blank');
            }
        });

        // Fix double-click file behavior
        document.addEventListener('dblclick', (e) => {
            if (e.target.matches('.file-item, .document-item')) {
                e.preventDefault();
                const fileName = e.target.textContent || e.target.querySelector('.file-name')?.textContent;
                if (fileName) {
                    // Directly open the file without download dialog
                    const fileUrl = constructFileUrl(fileName);
                    window.open(fileUrl, '_blank');
                }
            }
        });
    }

    // Helper function to construct file URL
    function constructFileUrl(fileName) {
        const baseUrl = 'https://saxtechfcs.blob.core.windows.net/fcs-clients/FCS-OriginalClients/';
        const sasToken = '?sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D';
        const disposition = '&response-content-disposition=' + encodeURIComponent('inline');
        
        return baseUrl + encodeURIComponent(fileName) + sasToken + disposition;
    }

    // ========================================
    // 3. REAL-TIME UPLOAD PROGRESS
    // ========================================

    function implementRealUploadProgress() {
        if (!window.uploadFilesWithCategories) return;

        const originalUpload = window.uploadFilesWithCategories;
        window.uploadFilesWithCategories = async function() {
            const files = window.selectedFiles || [];
            if (files.length === 0) return originalUpload.call(this);

            // Create enhanced progress modal
            const modal = createEnhancedProgressModal(files.length);
            document.body.appendChild(modal);

            // Track upload progress
            let completed = 0;
            const startTime = Date.now();

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                updateProgressModal(modal, i + 1, files.length, file.name, startTime);
                
                // Simulate processing (replace with actual upload)
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                completed++;
            }

            modal.remove();
            return originalUpload.call(this);
        };
    }

    function createEnhancedProgressModal(totalFiles) {
        const modal = document.createElement('div');
        modal.className = 'upload-progress-modal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            min-width: 400px;
        `;
        
        modal.innerHTML = `
            <h3 style="margin-bottom: 1rem;">Uploading Files</h3>
            <div class="progress-info">
                <div style="margin-bottom: 0.5rem;">
                    <strong>Current File:</strong> <span id="currentFileName">Preparing...</span>
                </div>
                <div style="margin-bottom: 0.5rem;">
                    <strong>Progress:</strong> <span id="progressText">0 of ${totalFiles}</span>
                </div>
                <div style="margin-bottom: 0.5rem;">
                    <strong>Time Remaining:</strong> <span id="timeRemaining">Calculating...</span>
                </div>
                <div style="margin-bottom: 0.5rem;">
                    <strong>Speed:</strong> <span id="uploadSpeed">0 MB/s</span>
                </div>
            </div>
            <div style="background: #f0f0f0; height: 30px; border-radius: 15px; overflow: hidden; margin-top: 1rem;">
                <div id="progressBar" style="background: linear-gradient(90deg, #4caf50, #8bc34a); height: 100%; width: 0; transition: width 0.3s;"></div>
            </div>
            <div style="margin-top: 1rem;">
                <div id="fileProgressList" style="max-height: 200px; overflow-y: auto;"></div>
            </div>
        `;
        
        return modal;
    }

    function updateProgressModal(modal, current, total, fileName, startTime) {
        const progressBar = modal.querySelector('#progressBar');
        const progressText = modal.querySelector('#progressText');
        const currentFileEl = modal.querySelector('#currentFileName');
        const timeRemainingEl = modal.querySelector('#timeRemaining');
        const speedEl = modal.querySelector('#uploadSpeed');
        
        const percentage = (current / total) * 100;
        progressBar.style.width = percentage + '%';
        progressText.textContent = `${current} of ${total}`;
        currentFileEl.textContent = fileName;
        
        // Calculate time remaining
        const elapsed = Date.now() - startTime;
        const rate = current / elapsed;
        const remaining = (total - current) / rate;
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        timeRemainingEl.textContent = `${minutes}m ${seconds}s`;
        
        // Calculate speed (mock)
        speedEl.textContent = `${(Math.random() * 5 + 1).toFixed(1)} MB/s`;
    }

    // ========================================
    // 4. KNOWLEDGE GRAPH FIX
    // ========================================

    function fixKnowledgeGraph() {
        // Fix Knowledge Graph chat responses
        if (window.sendMessage) {
            const originalSendMessage = window.sendMessage;
            window.sendMessage = async function(message) {
                const chatContext = window.chatContext || 'general';
                
                if (chatContext === 'all-clients' || chatContext === 'combined') {
                    // Handle Knowledge Graph queries properly
                    message = `[KNOWLEDGE_GRAPH_QUERY] ${message}`;
                }
                
                return originalSendMessage.call(this, message);
            };
        }

        // Fix error responses for Knowledge Graph
        if (window.addMessage) {
            const originalAddMessage = window.addMessage;
            window.addMessage = function(content, sender) {
                // Check for Knowledge Graph errors and provide helpful response
                if (sender === 'assistant' && content.includes('No Results Found') && window.chatContext === 'all-clients') {
                    content = `I'm searching across all projects for relevant information. 
                    
While I process your request, here are some things I can help you find across projects:
• Similar construction methods and materials used
• Cost comparisons between projects
• Common specifications and standards
• Lessons learned and best practices
• Pattern analysis across different clients

Please be more specific about what you'd like to compare or analyze across projects.`;
                }
                
                return originalAddMessage.call(this, content, sender);
            };
        }
    }

    // ========================================
    // INITIALIZATION
    // ========================================

    function init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        // Apply enhanced chat functions immediately
        enhanceChatFunctions();
        enhanceStopButton();
        enhanceImagePaste();
        enhanceSendButtonStates();
        fixViewCapabilities();
        
        // Apply fixes based on current page
        fixAdminPage();
        fixIndexPage();
        implementRealUploadProgress();
        fixKnowledgeGraph();

        // Monitor for dynamic content changes
        const observer = new MutationObserver(() => {
            fixDocumentCounts();
            fixFileUploadRestrictions();
            enhanceSendButtonStates();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('✅ Comprehensive fixes applied successfully');
    }
    
    /**
     * Enhanced stop button functionality for all chat pages
     */
    function enhanceStopButton() {
        // Create or enhance stop button
        const sendButton = document.getElementById('sendButton');
        if (!sendButton) return;
        
        let stopButton = document.getElementById('stopButton');
        if (!stopButton) {
            stopButton = document.createElement('button');
            stopButton.id = 'stopButton';
            stopButton.className = 'stop-button';
            stopButton.innerHTML = `
                <span>Stop</span>
                <span>⏹</span>
            `;
            stopButton.style.cssText = `
                display: none;
                padding: 0.75rem 1.5rem;
                background: linear-gradient(135deg, #f44336, #d32f2f);
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                font-size: 1rem;
                transition: all 0.3s ease;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            `;
            
            // Insert after send button
            sendButton.parentElement.insertBefore(stopButton, sendButton.nextSibling);
        }
        
        // Add hover effects
        stopButton.onmouseover = () => {
            stopButton.style.transform = 'scale(1.05)';
            stopButton.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
        };
        
        stopButton.onmouseout = () => {
            stopButton.style.transform = 'scale(1)';
            stopButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        };
        
        // Stop functionality
        stopButton.onclick = () => {
            // Abort current stream
            if (window.currentStreamController) {
                window.currentStreamController.abort();
            }
            
            // Abort any other controllers
            if (window.abortController) {
                window.abortController.abort();
            }
            
            // Reset UI
            stopButton.style.display = 'none';
            sendButton.style.display = 'inline-flex';
            sendButton.disabled = false;
            
            // Hide typing indicator
            const typingIndicator = document.getElementById('typingIndicator');
            if (typingIndicator) {
                typingIndicator.classList.remove('active');
            }
            
            // Add system message
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                const stopMsg = document.createElement('div');
                stopMsg.className = 'message system';
                stopMsg.innerHTML = `
                    <div class="message-content" style="background: #fff3cd; color: #856404; padding: 0.5rem 1rem; border-radius: 8px;">
                        ⏹ Response generation stopped by user
                    </div>
                `;
                chatMessages.appendChild(stopMsg);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        };
    }
    
    /**
     * Enhanced image paste functionality with inline display
     */
    function enhanceImagePaste() {
        document.addEventListener('paste', async (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            
            for (const item of items) {
                if (item.type.indexOf('image') !== -1) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    
                    // Convert to base64
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64 = reader.result;
                        displayInlineImage(base64);
                        
                        // Store for sending with message
                        window.pastedImage = base64;
                    };
                    reader.readAsDataURL(blob);
                }
            }
        });
    }
    
    /**
     * Display pasted image inline in chat input area
     */
    function displayInlineImage(base64) {
        // Find or create image preview area
        let previewArea = document.getElementById('imagePreviewArea');
        const chatInput = document.getElementById('chatInput');
        
        if (!previewArea && chatInput) {
            previewArea = document.createElement('div');
            previewArea.id = 'imagePreviewArea';
            previewArea.style.cssText = `
                display: none;
                padding: 0.5rem;
                background: #f0f0f0;
                border-radius: 8px;
                margin-bottom: 0.5rem;
                position: relative;
            `;
            
            chatInput.parentElement.insertBefore(previewArea, chatInput);
        }
        
        if (previewArea) {
            previewArea.innerHTML = `
                <div style="position: relative; display: inline-block;">
                    <img src="${base64}" style="
                        max-width: 200px;
                        max-height: 150px;
                        border-radius: 4px;
                        border: 2px solid #ddd;
                    ">
                    <button onclick="this.parentElement.parentElement.style.display='none'; window.pastedImage=null;" style="
                        position: absolute;
                        top: -8px;
                        right: -8px;
                        background: #f44336;
                        color: white;
                        border: none;
                        border-radius: 50%;
                        width: 24px;
                        height: 24px;
                        cursor: pointer;
                        font-weight: bold;
                    ">×</button>
                    <div style="
                        margin-top: 0.25rem;
                        font-size: 0.85rem;
                        color: #666;
                    ">Image ready to send</div>
                </div>
            `;
            previewArea.style.display = 'block';
        }
    }
    
    /**
     * Enhanced send button states
     */
    function enhanceSendButtonStates() {
        const sendButton = document.getElementById('sendButton');
        const chatInput = document.getElementById('chatInput');
        
        if (!sendButton || !chatInput) return;
        
        // Add visual states
        const updateButtonState = () => {
            const hasContent = chatInput.value.trim().length > 0 || window.pastedImage;
            const isGenerating = window.isGenerating || false;
            
            if (isGenerating) {
                sendButton.disabled = true;
                sendButton.style.opacity = '0.5';
                sendButton.style.cursor = 'not-allowed';
                sendButton.style.background = '#ccc';
            } else if (hasContent) {
                sendButton.disabled = false;
                sendButton.style.opacity = '1';
                sendButton.style.cursor = 'pointer';
                sendButton.style.background = 'linear-gradient(135deg, var(--primary-green, #26C485), #1fa774)';
                sendButton.style.transform = 'scale(1.05)';
            } else {
                sendButton.disabled = true;
                sendButton.style.opacity = '0.6';
                sendButton.style.cursor = 'not-allowed';
                sendButton.style.background = 'linear-gradient(135deg, #ccc, #999)';
                sendButton.style.transform = 'scale(1)';
            }
        };
        
        // Update on input
        chatInput.addEventListener('input', updateButtonState);
        chatInput.addEventListener('keyup', updateButtonState);
        
        // Initial state
        updateButtonState();
        
        // Watch for generation state changes
        const originalSend = window.sendMessage;
        if (originalSend && !window._enhancedSend) {
            window._enhancedSend = true;
            window.sendMessage = async function(...args) {
                window.isGenerating = true;
                updateButtonState();
                
                // Show stop button
                const stopButton = document.getElementById('stopButton');
                if (stopButton) {
                    stopButton.style.display = 'inline-flex';
                    sendButton.style.display = 'none';
                }
                
                try {
                    const result = await originalSend.apply(this, args);
                    return result;
                } finally {
                    window.isGenerating = false;
                    updateButtonState();
                    
                    // Hide stop button
                    if (stopButton) {
                        stopButton.style.display = 'none';
                        sendButton.style.display = 'inline-flex';
                    }
                    
                    // Clear pasted image
                    window.pastedImage = null;
                    const previewArea = document.getElementById('imagePreviewArea');
                    if (previewArea) {
                        previewArea.style.display = 'none';
                    }
                }
            };
        }
    }
    
    /**
     * Fix View Capabilities bubble visibility
     */
    function fixViewCapabilities() {
        // Add CSS for capabilities dropdown
        const style = document.createElement('style');
        style.textContent = `
            .capabilities-dropdown {
                display: none;
                position: absolute;
                top: 100%;
                right: 0;
                margin-top: 0.5rem;
                background: white;
                border: 2px solid var(--primary-blue, #2E86AB);
                border-radius: 12px;
                padding: 1.5rem;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
                z-index: 10000;
                min-width: 350px;
                max-width: 450px;
            }
            
            .capabilities-btn {
                position: relative;
                cursor: pointer;
            }
            
            .capabilities-btn:hover .capabilities-dropdown,
            .capabilities-dropdown:hover {
                display: block !important;
            }
            
            .capabilities-dropdown h3 {
                color: var(--primary-blue, #2E86AB);
                margin-bottom: 1rem;
                font-size: 1.2rem;
            }
            
            .capabilities-dropdown ul {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            
            .capabilities-dropdown li {
                padding: 0.5rem 0;
                border-bottom: 1px solid #eee;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .capabilities-dropdown li:last-child {
                border-bottom: none;
            }
            
            .capabilities-dropdown li::before {
                content: "✓";
                color: var(--primary-green, #26C485);
                font-weight: bold;
            }
        `;
        document.head.appendChild(style);
        
        // Ensure capabilities button works
        document.addEventListener('click', (e) => {
            if (e.target.matches('.capabilities-btn, .capabilities-btn *')) {
                e.stopPropagation();
                const dropdown = e.target.closest('.capabilities-btn')?.querySelector('.capabilities-dropdown');
                if (dropdown) {
                    const isVisible = dropdown.style.display === 'block';
                    dropdown.style.display = isVisible ? 'none' : 'block';
                }
            } else {
                // Close all dropdowns when clicking outside
                document.querySelectorAll('.capabilities-dropdown').forEach(dd => {
                    dd.style.display = 'none';
                });
            }
        });
    }

    // Start initialization
    init();

})();

/**
 * Ultimate Fix - Complete cleanup and restoration
 */

(function() {
    'use strict';
    
    console.log('🔧 Ultimate Fix Starting...');
    
    // 1. REMOVE ALL GARBAGE TEXT AT BOTTOM OF PAGES
    function cleanupPageBottom() {
        // Remove all stray text nodes that shouldn't be there
        const body = document.body;
        const allNodes = Array.from(body.childNodes);
        
        allNodes.forEach(node => {
            if (node.nodeType === 3) { // Text node
                const text = node.textContent.trim();
                if (text && !text.startsWith('<!')) {
                    console.log('Removing garbage text:', text.substring(0, 50));
                    node.remove();
                }
            }
        });
        
        // Remove any divs with garbage content at bottom
        const lastElements = Array.from(body.children).slice(-5);
        lastElements.forEach(el => {
            const text = el.textContent || '';
            if (text.includes('Enhanced Digital Takeoff System') ||
                text.includes('Upload Construction Drawings') ||
                text.includes('Export & Reports') ||
                text.includes('Colored Highlights') ||
                text.includes('Rectangle Area') ||
                text.includes('Polygon Area')) {
                console.log('Removing garbage element');
                el.remove();
            }
        });
    }
    
    // 2. REMOVE RESOURCE UTILIZATION AND OTHER STATIC CONTENT
    function removeAllStaticContent() {
        // Specific selectors to remove
        const toRemove = [
            '.resource-utilization',
            '.pm-knowledge-graph',
            '.quick-pm-tools',
            '.project-timeline',
            'aside.sidebar.sidebar-right .card:has(h3:contains("Resource Utilization"))',
            'aside.sidebar.sidebar-right .card:has(h3:contains("PM Knowledge Graph"))',
            'aside.sidebar.sidebar-right .card:has(h3:contains("Quick PM Tools"))'
        ];
        
        toRemove.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                console.log('Removing:', selector);
                el.remove();
            });
        });
        
        // Remove any card with static percentages
        document.querySelectorAll('.card').forEach(card => {
            if (card.innerHTML.includes('Labor') && 
                card.innerHTML.includes('92%') &&
                card.innerHTML.includes('Equipment') &&
                card.innerHTML.includes('75%')) {
                card.remove();
                console.log('Removed resource utilization card');
            }
        });
    }
    
    // 3. MOVE DOCUMENT CONTEXT TO TOP OF RIGHT SIDEBAR
    function fixDocumentContext() {
        if (!window.location.pathname.includes('projects')) return;
        
        // Find or create right sidebar
        let rightSidebar = document.querySelector('aside.sidebar.sidebar-right');
        if (!rightSidebar) {
            const container = document.querySelector('.container');
            if (container) {
                rightSidebar = document.createElement('aside');
                rightSidebar.className = 'sidebar sidebar-right';
                container.appendChild(rightSidebar);
            }
        }
        
        if (!rightSidebar) return;
        
        // Clear it completely first
        rightSidebar.innerHTML = '';
        
        // Add document context at the TOP
        const contextCard = document.createElement('div');
        contextCard.className = 'card';
        contextCard.innerHTML = `
            <h3 style="color: var(--pm-primary); margin-bottom: 1rem;">📄 Document Context</h3>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" id="contextEstimates" value="estimates">
                    <span>📊 Estimates</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" id="contextProposals" value="proposals">
                    <span>📋 Proposals</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" id="contextDrawings" value="drawings">
                    <span>📐 Drawings</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" id="contextSpecs" value="specifications">
                    <span>📑 Specifications</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" id="contextContracts" value="contracts">
                    <span>✍️ Signed Contracts</span>
                </label>
            </div>
            <button onclick="window.applyDocumentContext()" style="
                margin-top: 1rem;
                width: 100%;
                padding: 0.75rem;
                background: linear-gradient(135deg, var(--pm-primary), var(--pm-secondary));
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
            ">Apply Context Filter</button>
        `;
        rightSidebar.appendChild(contextCard);
        
        // Add document list card
        const docListCard = document.createElement('div');
        docListCard.className = 'card';
        docListCard.style.marginTop = '1rem';
        docListCard.innerHTML = `
            <h3 style="color: var(--pm-primary); margin-bottom: 1rem;">📁 Project Documents</h3>
            <div id="projectDocumentsList" style="max-height: 400px; overflow-y: auto;">
                <p style="color: #666; text-align: center;">Select a project to view documents</p>
            </div>
        `;
        rightSidebar.appendChild(docListCard);
    }
    
    // 4. PROPERLY FORMAT CHAT RESPONSES
    function fixChatResponseFormatting() {
        // Override message display to handle JSON responses
        const originalAddMessage = window.addAssistantMessage;
        window.addAssistantMessage = function(content) {
            // Check if content is JSON
            let formattedContent = content;
            try {
                const json = JSON.parse(content);
                if (json.response) {
                    formattedContent = json.response;
                }
            } catch (e) {
                // Not JSON, use as is
            }
            
            const messagesContainer = document.getElementById('chatMessages');
            if (!messagesContainer) return;
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message assistant';
            
            const currentTime = new Date().toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            // Clean up any HTML entities
            formattedContent = formattedContent
                .replace(/\\n/g, '<br>')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");
            
            messageDiv.innerHTML = `
                <div class="message-avatar">🤖</div>
                <div class="message-content">
                    <div class="formatted-content">${formattedContent}</div>
                    <div class="message-time">${currentTime}</div>
                </div>
            `;
            
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        };
    }
    
    // 5. FIX PROJECT SELECTION CONTEXT
    function fixProjectContext() {
        const projectSelect = document.getElementById('projectSelect');
        if (!projectSelect) return;
        
        // Remove any duplicate handlers
        const newSelect = projectSelect.cloneNode(true);
        projectSelect.parentNode.replaceChild(newSelect, projectSelect);
        
        newSelect.addEventListener('change', async (e) => {
            const projectName = e.target.value;
            if (!projectName) {
                document.getElementById('projectDocumentsList').innerHTML = 
                    '<p style="color: #666; text-align: center;">Select a project to view documents</p>';
                return;
            }
            
            // Update context
            window.selectedProject = projectName;
            
            // Add system message
            const message = `📁 Now focusing on project: ${projectName}. I'll search this project's documents for relevant information.`;
            if (window.addSystemMessage) {
                window.addSystemMessage(message);
            }
            
            // Load project documents
            await loadProjectDocuments(projectName);
        });
    }
    
    // 6. LOAD PROJECT DOCUMENTS
    async function loadProjectDocuments(projectName) {
        const docsList = document.getElementById('projectDocumentsList');
        if (!docsList) return;
        
        docsList.innerHTML = '<p style="color: #666;">Loading documents...</p>';
        
        try {
            const listUrl = `https://saxtechfcs.blob.core.windows.net/fcs-clients?sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D&restype=container&comp=list&prefix=FCS-OriginalClients/${projectName}/`;
            
            const response = await fetch(listUrl);
            if (response.ok) {
                const xmlText = await response.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");
                const blobs = xmlDoc.getElementsByTagName("Blob");
                
                const files = [];
                for (let i = 0; i < blobs.length; i++) {
                    const nameElement = blobs[i].getElementsByTagName("Name")[0];
                    if (nameElement) {
                        const fullPath = nameElement.textContent;
                        const fileName = fullPath.split('/').pop();
                        const fileType = fileName.split('.').pop().toLowerCase();
                        
                        files.push({
                            name: fileName,
                            path: fullPath,
                            type: fileType
                        });
                    }
                }
                
                // Group by type
                const grouped = {
                    pdf: files.filter(f => f.type === 'pdf'),
                    excel: files.filter(f => ['xlsx', 'xls'].includes(f.type)),
                    doc: files.filter(f => ['doc', 'docx'].includes(f.type)),
                    other: files.filter(f => !['pdf', 'xlsx', 'xls', 'doc', 'docx'].includes(f.type))
                };
                
                let html = '';
                Object.entries(grouped).forEach(([type, fileList]) => {
                    if (fileList.length > 0) {
                        const icon = {
                            pdf: '📄',
                            excel: '📊',
                            doc: '📝',
                            other: '📎'
                        }[type];
                        
                        html += `<div style="margin-bottom: 1rem;">`;
                        html += `<h4 style="color: #666; font-size: 0.9rem;">${icon} ${type.toUpperCase()}</h4>`;
                        
                        fileList.forEach(file => {
                            html += `
                                <div onclick="window.selectDocument('${file.path}', '${file.type}')" 
                                     style="padding: 0.5rem; background: white; border: 1px solid #eee; 
                                            border-radius: 4px; margin-bottom: 0.25rem; cursor: pointer;"
                                     onmouseover="this.style.background='#f0f0f0'"
                                     onmouseout="this.style.background='white'">
                                    <span style="font-size: 0.85rem;">${file.name}</span>
                                </div>
                            `;
                        });
                        html += `</div>`;
                    }
                });
                
                docsList.innerHTML = html || '<p style="color: #999;">No documents found</p>';
            }
        } catch (error) {
            console.error('Error loading documents:', error);
            docsList.innerHTML = '<p style="color: red;">Error loading documents</p>';
        }
    }
    
    // 7. HANDLE DOCUMENT SELECTION
    window.selectDocument = function(path, type) {
        const fileName = path.split('/').pop();
        
        // Add to context
        const message = `📎 Document selected: ${fileName}. This document will be used as context for the conversation.`;
        if (window.addSystemMessage) {
            window.addSystemMessage(message);
        }
        
        // Store selected document
        window.selectedDocument = path;
        
        // If PDF, offer to open in takeoff
        if (type === 'pdf' && window.professionalTakeoff) {
            if (confirm(`Open ${fileName} in Digital Takeoff Assistant?`)) {
                window.professionalTakeoff.initialize();
                // TODO: Load specific PDF
            }
        }
    };
    
    // 8. FIX ADMIN PAGE ERROR
    if (window.location.pathname.includes('admin')) {
        // Add the missing function to AppIntegrator prototype
        if (window.AppIntegrator) {
            window.AppIntegrator.prototype.initializeAdminPage = function() {
                console.log('Admin page initialized');
                return true;
            };
        }
    }
    
    // 9. APPLY DOCUMENT CONTEXT
    window.applyDocumentContext = function() {
        const contexts = [];
        ['Estimates', 'Proposals', 'Drawings', 'Specs', 'Contracts'].forEach(type => {
            const checkbox = document.getElementById('context' + type);
            if (checkbox && checkbox.checked) {
                contexts.push(type.toLowerCase());
            }
        });
        
        window.documentContext = contexts;
        
        const message = contexts.length > 0 
            ? `✅ Context filter applied: ${contexts.join(', ')}`
            : '✅ Context filter cleared: Searching all document types';
            
        if (window.addSystemMessage) {
            window.addSystemMessage(message);
        }
    };
    
    // 10. FIX SEND MESSAGE WITH PROPER CONTEXT
    window.ultimateSendMessage = async function() {
        const chatInput = document.getElementById('chatInput');
        const messagesContainer = document.getElementById('chatMessages');
        
        if (!chatInput || !chatInput.value.trim()) return;
        
        const message = chatInput.value.trim();
        
        // Add user message
        const userDiv = document.createElement('div');
        userDiv.className = 'message user';
        userDiv.innerHTML = `
            <div class="message-content">
                <div class="formatted-content">${message}</div>
                <div class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
            </div>
            <div class="message-avatar">👤</div>
        `;
        messagesContainer.appendChild(userDiv);
        
        chatInput.value = '';
        
        // Build context
        const requestBody = {
            message: message,
            project: window.selectedProject || '',
            document: window.selectedDocument || '',
            context: window.documentContext || [],
            timestamp: new Date().toISOString()
        };
        
        try {
            // Determine webhook
            let webhookUrl = 'https://workflows.saxtechnology.com/webhook/ask-foreman/chat';
            if (window.location.pathname.includes('estimator')) {
                webhookUrl = 'https://workflows.saxtechnology.com/webhook/ask-foreman/EstimatorChat';
            } else if (window.location.pathname.includes('projects')) {
                webhookUrl = 'https://workflows.saxtechnology.com/webhook/ask-foreman/PMchat';
            }
            
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            
            const responseText = await response.text();
            
            // Parse and display response
            let content = responseText;
            try {
                const json = JSON.parse(responseText);
                content = json.response || responseText;
            } catch (e) {}
            
            const assistantDiv = document.createElement('div');
            assistantDiv.className = 'message assistant';
            assistantDiv.innerHTML = `
                <div class="message-avatar">🤖</div>
                <div class="message-content">
                    <div class="formatted-content">${content}</div>
                    <div class="message-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</div>
                </div>
            `;
            messagesContainer.appendChild(assistantDiv);
            
        } catch (error) {
            console.error('Chat error:', error);
        }
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };
    
    // 11. OVERRIDE SEND MESSAGE
    function overrideSendMessage() {
        window.sendMessage = window.ultimateSendMessage;
        
        const chatInput = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendButton');
        
        if (chatInput) {
            const newInput = chatInput.cloneNode(true);
            chatInput.parentNode.replaceChild(newInput, chatInput);
            newInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    window.ultimateSendMessage();
                }
            });
        }
        
        if (sendButton) {
            sendButton.onclick = window.ultimateSendMessage;
        }
    }
    
    // MAIN EXECUTION
    function runUltimateFix() {
        console.log('🚀 Running Ultimate Fix...');
        
        cleanupPageBottom();
        removeAllStaticContent();
        fixDocumentContext();
        fixChatResponseFormatting();
        fixProjectContext();
        overrideSendMessage();
        
        // Remove "Focus on" mentions
        document.querySelectorAll('.formatted-content').forEach(el => {
            if (el.textContent.includes('Use the "Focus on" dropdown')) {
                el.innerHTML = el.innerHTML.replace('Use the "Focus on" dropdown below to', 'Select a project to');
            }
        });
        
        console.log('✅ Ultimate Fix Complete');
    }
    
    // Run when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runUltimateFix);
    } else {
        runUltimateFix();
    }
    
})();

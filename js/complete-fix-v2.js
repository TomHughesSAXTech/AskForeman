/**
 * Complete Fix v2 - Removes all static content and fixes webhooks
 */

(function() {
    'use strict';
    
    console.log('🔧 Complete Fix v2 Starting...');
    
    // 1. FIX WEBHOOK URLS - Use the correct working ones
    window.WEBHOOK_CONFIG = {
        estimator: 'https://hook.us2.make.com/i2shrgx5xqp7wknt17rsh1oiie5v0br4',
        generalChat: 'https://hook.us2.make.com/i2shrgx5xqp7wknt17rsh1oiie5v0br4',
        projects: 'https://hook.us2.make.com/m7wp2byeo5lmsabsxhg1dmqgopqai4ss'
    };
    
    // 2. REMOVE ALL "FOCUS ON" DROPDOWNS
    function removeFocusDropdowns() {
        // Remove from estimator
        const estimatorFocus = document.querySelector('#chatContextSelect');
        if (estimatorFocus && estimatorFocus.parentElement) {
            const parent = estimatorFocus.parentElement;
            if (parent.querySelector('label')) {
                parent.querySelector('label').remove();
            }
            estimatorFocus.remove();
            console.log('✅ Removed Focus dropdown from estimator');
        }
        
        // Remove from projects
        const projectsFocus = document.querySelector('#chatProjectSelect');
        if (projectsFocus && projectsFocus.parentElement) {
            const parent = projectsFocus.parentElement;
            // Only remove if it's the "Focus on" dropdown, not project selection
            const label = parent.querySelector('label');
            if (label && label.textContent.includes('Focus on')) {
                parent.remove();
                console.log('✅ Removed Focus dropdown from projects');
            }
        }
        
        // Remove chat context selector divs
        document.querySelectorAll('.chat-context-selector').forEach(selector => {
            const label = selector.querySelector('label');
            if (label && label.textContent.includes('Focus on')) {
                selector.remove();
            }
        });
    }
    
    // 3. REMOVE ALL STATIC PROJECT CARDS AND SIDE PANELS
    function removeAllStaticContent() {
        // Remove static project status panel
        const staticPanels = document.querySelectorAll('.project-status, .key-milestones, .team-panel');
        staticPanels.forEach(panel => {
            // Check if it contains hardcoded data
            if (panel.innerHTML.includes('Foundation Complete') || 
                panel.innerHTML.includes('John Doe') || 
                panel.innerHTML.includes('On Track') ||
                panel.innerHTML.includes('$2.4M')) {
                panel.remove();
                console.log('✅ Removed static panel:', panel.className);
            }
        });
        
        // Remove static milestone items
        document.querySelectorAll('.milestone-item').forEach(item => {
            if (item.innerHTML.includes('Foundation Complete') || 
                item.innerHTML.includes('Structural Steel') ||
                item.innerHTML.includes('MEP Installation')) {
                item.remove();
            }
        });
        
        // Remove static team members
        document.querySelectorAll('.team-member').forEach(member => {
            if (member.innerHTML.includes('John Doe') || 
                member.innerHTML.includes('Sarah Miller') ||
                member.innerHTML.includes('Bob Chen')) {
                member.remove();
            }
        });
        
        // Clear and prepare for dynamic content
        const sidebarLeft = document.querySelector('aside.sidebar.sidebar-left');
        if (sidebarLeft) {
            // Keep only project selection
            const projectSelectCard = sidebarLeft.querySelector('.card:has(#projectSelect)');
            if (projectSelectCard) {
                // Clear everything else
                sidebarLeft.innerHTML = '';
                sidebarLeft.appendChild(projectSelectCard);
                
                // Add dynamic content area
                const dynamicArea = document.createElement('div');
                dynamicArea.id = 'dynamicProjectContent';
                dynamicArea.className = 'card';
                dynamicArea.style.marginTop = '1rem';
                dynamicArea.innerHTML = '<p style="color: #666; text-align: center;">Select a project to view details</p>';
                sidebarLeft.appendChild(dynamicArea);
                
                console.log('✅ Prepared dynamic content area');
            }
        }
        
        const sidebarRight = document.querySelector('aside.sidebar.sidebar-right');
        if (sidebarRight) {
            // Remove all static content
            const staticCards = sidebarRight.querySelectorAll('.card');
            staticCards.forEach(card => {
                if (card.innerHTML.includes('Gantt Chart') || 
                    card.innerHTML.includes('Resource Utilization') ||
                    card.innerHTML.includes('Quick PM Tools')) {
                    card.innerHTML = '';
                }
            });
        }
    }
    
    // 4. FIX CHAT SEND MESSAGE WITH CORRECT WEBHOOKS
    window.fixedSendMessage = async function() {
        const chatInput = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendButton');
        const typingIndicator = document.getElementById('typingIndicator');
        const messagesContainer = document.getElementById('chatMessages');
        
        if (!chatInput || !chatInput.value.trim()) return;
        
        const message = chatInput.value.trim();
        const selectedProject = document.getElementById('projectSelect')?.value || '';
        
        // Add user message
        const userMessageDiv = document.createElement('div');
        userMessageDiv.className = 'message user';
        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        userMessageDiv.innerHTML = `
            <div class="message-content">
                <div class="formatted-content">${message}</div>
                <div class="message-time">${currentTime}</div>
            </div>
            <div class="message-avatar">👤</div>
        `;
        messagesContainer.appendChild(userMessageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Clear input and disable
        chatInput.value = '';
        chatInput.disabled = true;
        if (sendButton) sendButton.disabled = true;
        
        // Show typing indicator
        if (typingIndicator) typingIndicator.style.display = 'flex';
        
        try {
            // Determine webhook based on page
            let webhookUrl = WEBHOOK_CONFIG.generalChat;
            if (window.location.pathname.includes('estimator')) {
                webhookUrl = WEBHOOK_CONFIG.estimator;
            } else if (window.location.pathname.includes('projects')) {
                webhookUrl = WEBHOOK_CONFIG.projects;
            }
            
            console.log('Sending to webhook:', webhookUrl);
            
            const requestBody = {
                message: message,
                timestamp: new Date().toISOString()
            };
            
            // Add project context if available
            if (selectedProject) {
                requestBody.project = selectedProject;
            }
            
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            let responseText = '';
            if (response.ok) {
                responseText = await response.text();
            } else {
                console.error('Webhook error:', response.status, response.statusText);
                responseText = `I apologize, but I encountered an error (${response.status}). Please try again.`;
            }
            
            // Hide typing indicator
            if (typingIndicator) typingIndicator.style.display = 'none';
            
            // Add assistant response
            const assistantDiv = document.createElement('div');
            assistantDiv.className = 'message assistant';
            assistantDiv.innerHTML = `
                <div class="message-avatar">🤖</div>
                <div class="message-content">
                    <div class="formatted-content">${responseText || 'I received your message and am processing it.'}</div>
                    <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            `;
            messagesContainer.appendChild(assistantDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
        } catch (error) {
            console.error('Chat error:', error);
            
            // Hide typing indicator
            if (typingIndicator) typingIndicator.style.display = 'none';
            
            // Add error message
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message assistant';
            errorDiv.innerHTML = `
                <div class="message-avatar">⚠️</div>
                <div class="message-content">
                    <div class="formatted-content">I apologize, but I'm having trouble connecting. The system is being updated. Please try again in a moment.</div>
                    <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            `;
            messagesContainer.appendChild(errorDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } finally {
            // Re-enable input
            chatInput.disabled = false;
            if (sendButton) sendButton.disabled = false;
            chatInput.focus();
        }
    };
    
    // 5. LOAD PROJECT DETAILS DYNAMICALLY
    window.loadProjectDetails = async function(projectName) {
        const dynamicArea = document.getElementById('dynamicProjectContent');
        if (!dynamicArea || !projectName) return;
        
        dynamicArea.innerHTML = '<p style="color: #666; text-align: center;">Loading project details...</p>';
        
        try {
            // List files in project folder
            const listUrl = `https://saxtechfcs.blob.core.windows.net/fcs-clients?sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D&restype=container&comp=list&prefix=FCS-OriginalClients/${projectName}/`;
            
            const response = await fetch(listUrl);
            if (response.ok) {
                const xmlText = await response.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");
                const blobs = xmlDoc.getElementsByTagName("Blob");
                
                let html = `
                    <h3 style="color: var(--pm-primary); margin-bottom: 1rem;">📁 ${projectName}</h3>
                    <div class="project-files" style="max-height: 400px; overflow-y: auto;">
                `;
                
                const files = [];
                for (let i = 0; i < blobs.length; i++) {
                    const nameElement = blobs[i].getElementsByTagName("Name")[0];
                    const sizeElement = blobs[i].getElementsByTagName("Properties")[0]?.getElementsByTagName("Content-Length")[0];
                    
                    if (nameElement) {
                        const fullPath = nameElement.textContent;
                        const fileName = fullPath.split('/').pop();
                        const fileSize = sizeElement ? parseInt(sizeElement.textContent) : 0;
                        
                        files.push({
                            name: fileName,
                            path: fullPath,
                            size: fileSize,
                            type: fileName.split('.').pop().toLowerCase()
                        });
                    }
                }
                
                // Group files by type
                const grouped = {
                    pdf: files.filter(f => f.type === 'pdf'),
                    excel: files.filter(f => ['xlsx', 'xls'].includes(f.type)),
                    doc: files.filter(f => ['doc', 'docx'].includes(f.type)),
                    other: files.filter(f => !['pdf', 'xlsx', 'xls', 'doc', 'docx'].includes(f.type))
                };
                
                // Display files by type
                Object.entries(grouped).forEach(([type, fileList]) => {
                    if (fileList.length > 0) {
                        const icon = {
                            pdf: '📄',
                            excel: '📊',
                            doc: '📝',
                            other: '📎'
                        }[type];
                        
                        html += `<div style="margin-bottom: 1rem;">`;
                        html += `<h4 style="color: #666; font-size: 0.9rem; margin-bottom: 0.5rem;">${icon} ${type.toUpperCase()} Files (${fileList.length})</h4>`;
                        
                        fileList.forEach(file => {
                            const sizeKB = (file.size / 1024).toFixed(1);
                            html += `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border: 1px solid #eee; border-radius: 4px; margin-bottom: 0.25rem; cursor: pointer;" 
                                     onmouseover="this.style.background='#f5f5f5'" 
                                     onmouseout="this.style.background='white'"
                                     onclick="window.handleFileClick('${file.path}', '${file.type}')">
                                    <span style="font-size: 0.9rem;">${file.name}</span>
                                    <span style="font-size: 0.8rem; color: #999;">${sizeKB} KB</span>
                                </div>
                            `;
                        });
                        html += `</div>`;
                    }
                });
                
                if (files.length === 0) {
                    html += '<p style="color: #999; text-align: center;">No files found in this project</p>';
                }
                
                html += '</div>';
                dynamicArea.innerHTML = html;
                
                console.log(`✅ Loaded ${files.length} files for project ${projectName}`);
            }
        } catch (error) {
            console.error('Error loading project details:', error);
            dynamicArea.innerHTML = '<p style="color: red; text-align: center;">Error loading project details</p>';
        }
    };
    
    // 6. HANDLE FILE OPERATIONS
    window.handleFileClick = function(filePath, fileType) {
        if (fileType === 'pdf') {
            // Open in takeoff tool if available
            if (window.professionalTakeoff) {
                window.professionalTakeoff.initialize();
                // TODO: Load specific PDF
            } else {
                alert(`Opening PDF: ${filePath}`);
            }
        } else {
            alert(`File operations for ${fileType} files are being implemented`);
        }
    };
    
    // 7. OVERRIDE SEND MESSAGE GLOBALLY
    function overrideSendMessage() {
        // Override the global sendMessage function
        window.sendMessage = window.fixedSendMessage;
        
        // Also fix enter key handlers
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            // Remove old handlers
            const newInput = chatInput.cloneNode(true);
            chatInput.parentNode.replaceChild(newInput, chatInput);
            
            // Add new handler
            newInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    window.fixedSendMessage();
                }
            });
        }
        
        // Fix send button
        const sendButton = document.getElementById('sendButton');
        if (sendButton) {
            const newButton = sendButton.cloneNode(true);
            sendButton.parentNode.replaceChild(newButton, sendButton);
            newButton.onclick = window.fixedSendMessage;
        }
        
        console.log('✅ Overrode sendMessage globally');
    }
    
    // 8. SETUP PROJECT SELECT HANDLER
    function setupProjectSelectHandler() {
        const projectSelect = document.getElementById('projectSelect');
        if (projectSelect) {
            projectSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    window.loadProjectDetails(e.target.value);
                } else {
                    const dynamicArea = document.getElementById('dynamicProjectContent');
                    if (dynamicArea) {
                        dynamicArea.innerHTML = '<p style="color: #666; text-align: center;">Select a project to view details</p>';
                    }
                }
            });
            
            // Load details if already selected
            if (projectSelect.value) {
                window.loadProjectDetails(projectSelect.value);
            }
        }
    }
    
    // MAIN EXECUTION
    function runCompleteFix() {
        console.log('🚀 Running Complete Fix v2...');
        
        // Execute all fixes
        removeFocusDropdowns();
        removeAllStaticContent();
        overrideSendMessage();
        setupProjectSelectHandler();
        
        console.log('✅ Complete Fix v2 finished');
    }
    
    // Wait for DOM and run
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runCompleteFix);
    } else {
        runCompleteFix();
    }
    
})();

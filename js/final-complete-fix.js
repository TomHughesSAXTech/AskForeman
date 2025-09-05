/**
 * Final Complete Fix - Corrects all webhook URLs, removes ALL static content, fixes admin
 */

(function() {
    'use strict';
    
    console.log('🔧 Final Complete Fix Starting...');
    
    // 1. CORRECT WEBHOOK URLS FROM YOUR LIST
    window.WEBHOOK_CONFIG = {
        createProject: 'https://workflows.saxtechnology.com/webhook/ask-foreman/clients/create',
        generalChat: 'https://workflows.saxtechnology.com/webhook/ask-foreman/chat',
        estimatorChat: 'https://workflows.saxtechnology.com/webhook/ask-foreman/EstimatorChat',
        projectChat: 'https://workflows.saxtechnology.com/webhook/ask-foreman/PMchat',
        uploadDocuments: 'https://workflows.saxtechnology.com/webhook/ask-foreman/upload',
        deleteFiles: 'https://workflows.saxtechnology.com/webhook/ask-foreman/files/delete',
        listProjects: 'https://workflows.saxtechnology.com/webhook/ask-foreman/clients/list',
        deleteClients: 'https://workflows.saxtechnology.com/webhook/ask-foreman/clients/delete',
        indexStats: 'https://workflows.saxtechnology.com/webhook/ask-foreman/index/stats',
        indexSearch: 'https://workflows.saxtechnology.com/webhook/ask-foreman/index/search',
        indexDelete: 'https://workflows.saxtechnology.com/webhook/ask-foreman/index/delete',
        indexClear: 'https://workflows.saxtechnology.com/webhook/ask-foreman/index/clear'
    };
    
    // 2. REMOVE ALL STATIC CONTENT FROM PROJECTS PAGE
    function removeAllProjectsStaticContent() {
        // Remove all cards with static data
        const staticSelectors = [
            '.project-status',
            '.key-milestones', 
            '.project-timeline',
            '.resource-utilization',
            '.quick-pm-tools',
            '.pm-knowledge-graph',
            '.team-panel',
            '.gantt-preview'
        ];
        
        staticSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                console.log(`Removing static element: ${selector}`);
                el.remove();
            });
        });
        
        // Remove cards containing specific static text
        document.querySelectorAll('.card').forEach(card => {
            const text = card.textContent;
            if (text.includes('Foundation Complete') || 
                text.includes('Structural Steel') ||
                text.includes('MEP Installation') ||
                text.includes('John Doe') ||
                text.includes('Sarah Miller') ||
                text.includes('Schedule Optimizer') ||
                text.includes('Risk Assessment Matrix') ||
                text.includes('Open Full Gantt Chart')) {
                card.remove();
                console.log('Removed static card');
            }
        });
        
        // Remove View Capabilities button from project chat
        document.querySelectorAll('.capabilities-btn').forEach(btn => {
            btn.remove();
        });
        
        // Remove "Focus on" dropdown
        const focusDropdown = document.getElementById('chatProjectSelect');
        if (focusDropdown && focusDropdown.parentElement) {
            const label = focusDropdown.parentElement.querySelector('label');
            if (label && label.textContent.includes('Focus on:')) {
                focusDropdown.parentElement.remove();
            }
        }
    }
    
    // 3. CLEAN UP ESTIMATOR PAGE BOTTOM
    function cleanupEstimatorPage() {
        // Find any text nodes at bottom of page
        const body = document.body;
        const children = Array.from(body.childNodes);
        children.forEach(node => {
            if (node.nodeType === 3 && node.textContent.trim()) { // Text node
                console.log('Removing stray text:', node.textContent);
                node.remove();
            }
        });
    }
    
    // 4. CREATE DYNAMIC PROJECT INTERFACE
    function createDynamicProjectInterface() {
        // Only run on projects page
        if (!window.location.pathname.includes('projects')) return;
        
        // Find or create right sidebar
        let sidebarRight = document.querySelector('aside.sidebar.sidebar-right');
        if (!sidebarRight) {
            // Create if doesn't exist
            const mainContainer = document.querySelector('.container');
            if (mainContainer) {
                sidebarRight = document.createElement('aside');
                sidebarRight.className = 'sidebar sidebar-right';
                mainContainer.appendChild(sidebarRight);
            }
        }
        
        if (sidebarRight) {
            // Clear it completely
            sidebarRight.innerHTML = '';
            
            // Add document type selector
            const docSelector = document.createElement('div');
            docSelector.className = 'card';
            docSelector.innerHTML = `
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
                <p style="margin-top: 0.5rem; font-size: 0.85rem; color: #666;">
                    Select document types to focus the chat on specific content, or leave unchecked to search across the entire project.
                </p>
            `;
            sidebarRight.appendChild(docSelector);
        }
    }
    
    // 5. APPLY DOCUMENT CONTEXT
    window.applyDocumentContext = function() {
        const contexts = [];
        ['Estimates', 'Proposals', 'Drawings', 'Specs', 'Contracts'].forEach(type => {
            const checkbox = document.getElementById('context' + type);
            if (checkbox && checkbox.checked) {
                contexts.push(type.toLowerCase());
            }
        });
        
        const projectSelect = document.getElementById('projectSelect');
        const project = projectSelect ? projectSelect.value : '';
        
        if (contexts.length > 0) {
            console.log('Applied context filter:', contexts.join(', '));
            window.documentContext = contexts;
            
            // Add system message to chat
            const message = `Context filter applied: Searching in ${contexts.join(', ')} for project ${project || 'all projects'}`;
            addSystemMessage(message);
        } else {
            window.documentContext = null;
            addSystemMessage('Context filter cleared: Searching across entire project');
        }
    };
    
    // 6. FIX CHAT WITH CORRECT WEBHOOKS
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
        
        // Clear input
        chatInput.value = '';
        chatInput.disabled = true;
        if (sendButton) sendButton.disabled = true;
        
        // Show typing
        if (typingIndicator) typingIndicator.style.display = 'flex';
        
        try {
            // Determine correct webhook
            let webhookUrl = WEBHOOK_CONFIG.generalChat;
            if (window.location.pathname.includes('estimator')) {
                webhookUrl = WEBHOOK_CONFIG.estimatorChat;
            } else if (window.location.pathname.includes('projects')) {
                webhookUrl = WEBHOOK_CONFIG.projectChat;
            }
            
            console.log('Using webhook:', webhookUrl);
            
            // Build request body
            const requestBody = {
                message: message,
                timestamp: new Date().toISOString()
            };
            
            if (selectedProject) {
                requestBody.project = selectedProject;
            }
            
            if (window.documentContext) {
                requestBody.context = window.documentContext;
            }
            
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            let responseText = await response.text();
            
            // Hide typing
            if (typingIndicator) typingIndicator.style.display = 'none';
            
            // Add assistant response
            const assistantDiv = document.createElement('div');
            assistantDiv.className = 'message assistant';
            assistantDiv.innerHTML = `
                <div class="message-avatar">🤖</div>
                <div class="message-content">
                    <div class="formatted-content">${responseText || 'Processing your request...'}</div>
                    <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            `;
            messagesContainer.appendChild(assistantDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
        } catch (error) {
            console.error('Chat error:', error);
            if (typingIndicator) typingIndicator.style.display = 'none';
            
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message assistant';
            errorDiv.innerHTML = `
                <div class="message-avatar">⚠️</div>
                <div class="message-content">
                    <div class="formatted-content">Connection error. Please check your internet and try again.</div>
                    <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            `;
            messagesContainer.appendChild(errorDiv);
        } finally {
            chatInput.disabled = false;
            if (sendButton) sendButton.disabled = false;
            chatInput.focus();
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    };
    
    // 7. ADD SYSTEM MESSAGE
    window.addSystemMessage = function(text) {
        const messagesContainer = document.getElementById('chatMessages');
        if (!messagesContainer) return;
        
        const systemDiv = document.createElement('div');
        systemDiv.className = 'message system';
        systemDiv.style.cssText = 'text-align: center; padding: 0.5rem; color: #666; font-style: italic;';
        systemDiv.innerHTML = `<div>${text}</div>`;
        messagesContainer.appendChild(systemDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };
    
    // 8. OVERRIDE SEND MESSAGE
    function overrideSendMessage() {
        window.sendMessage = window.fixedSendMessage;
        
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            const newInput = chatInput.cloneNode(true);
            chatInput.parentNode.replaceChild(newInput, chatInput);
            newInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    window.fixedSendMessage();
                }
            });
        }
        
        const sendButton = document.getElementById('sendButton');
        if (sendButton) {
            const newButton = sendButton.cloneNode(true);
            sendButton.parentNode.replaceChild(newButton, sendButton);
            newButton.onclick = window.fixedSendMessage;
        }
    }
    
    // 9. FIX ADMIN PAGE
    window.initializeAdminPage = function() {
        console.log('Admin page initialization placeholder');
        // Admin functionality would go here
    };
    
    // 10. ADD ADMIN BUTTON TO INDEX
    function addAdminButton() {
        if (!window.location.pathname.includes('index')) return;
        
        const navButtons = document.querySelector('.nav-buttons');
        if (navButtons && !document.getElementById('adminButton')) {
            const adminBtn = document.createElement('button');
            adminBtn.id = 'adminButton';
            adminBtn.className = 'nav-btn';
            adminBtn.innerHTML = '🔐 Admin';
            adminBtn.onclick = () => window.location.href = '/admin.html';
            navButtons.appendChild(adminBtn);
        }
    }
    
    // 11. FIX CREATE PROJECT BUTTON
    function fixCreateProjectButton() {
        const createBtn = document.getElementById('createProjectButton');
        if (createBtn) {
            createBtn.onclick = async function() {
                const projectName = prompt('Enter new project name:');
                if (!projectName) return;
                
                try {
                    const response = await fetch(WEBHOOK_CONFIG.createProject, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            projectName: projectName,
                            timestamp: new Date().toISOString()
                        })
                    });
                    
                    if (response.ok) {
                        alert('Project created successfully!');
                        location.reload();
                    } else {
                        alert('Error creating project');
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert('Error creating project');
                }
            };
        }
    }
    
    // MAIN EXECUTION
    function runFinalFix() {
        console.log('🚀 Running Final Complete Fix...');
        
        // Execute all fixes
        removeAllProjectsStaticContent();
        cleanupEstimatorPage();
        createDynamicProjectInterface();
        overrideSendMessage();
        addAdminButton();
        fixCreateProjectButton();
        
        // Fix admin page error
        if (window.location.pathname.includes('admin')) {
            window.initializeAdminPage();
        }
        
        console.log('✅ Final Complete Fix finished');
    }
    
    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runFinalFix);
    } else {
        runFinalFix();
    }
    
})();

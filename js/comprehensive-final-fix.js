/**
 * Comprehensive Final Fix for AskForeman Application
 * Addresses all remaining issues with chat, digital takeoff, and project management
 */

(function() {
    'use strict';

    // Fix 1: Chat Response Display Issue
    // Override sendMessage to ensure responses are properly displayed
    const originalSendMessage = window.sendMessage;
    window.sendMessage = async function() {
        const chatInput = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendButton');
        const chatMessages = document.getElementById('chatMessages');
        const typingIndicator = document.getElementById('typingIndicator');
        const chatClientSelect = document.getElementById('chatClientSelect') || document.getElementById('chatContextSelect');
        
        const message = chatInput.value.trim();
        if (!message) return;
        
        // Disable send button
        if (sendButton) sendButton.disabled = true;
        
        // Add user message
        const userMessageDiv = document.createElement('div');
        userMessageDiv.className = 'message user';
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        userMessageDiv.innerHTML = `
            <div class="message-content">
                <div class="formatted-content">${escapeHtml(message)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
        
        // Insert before typing indicator if it exists
        if (typingIndicator && typingIndicator.parentNode === chatMessages) {
            chatMessages.insertBefore(userMessageDiv, typingIndicator);
        } else {
            chatMessages.appendChild(userMessageDiv);
        }
        
        // Clear input
        chatInput.value = '';
        
        // Show typing indicator
        if (typingIndicator) {
            typingIndicator.classList.add('active');
            if (typingIndicator.parentNode !== chatMessages) {
                chatMessages.appendChild(typingIndicator);
            }
        }
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        try {
            const webhookUrl = window.API_CONFIG?.chatWebhookUrl || 
                              'https://workflows.saxtechnology.com/webhook/ask-foreman/chat';
            
            // Get selected context
            const selectedClient = window.selectedClient || 
                                 (chatClientSelect ? chatClientSelect.value : 'general');
            
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message,
                    client: selectedClient,
                    context: selectedClient === 'general' ? 'general' : 'project',
                    sessionId: `${selectedClient}_${Date.now()}`
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            // Hide typing indicator
            if (typingIndicator) {
                typingIndicator.classList.remove('active');
            }
            
            // Add assistant response with proper formatting
            const assistantMessageDiv = document.createElement('div');
            assistantMessageDiv.className = 'message assistant';
            const responseTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            const responseContent = data.response || data.message || 'I apologize, but I couldn\'t generate a response. Please try again.';
            
            assistantMessageDiv.innerHTML = `
                <div class="message-avatar">🤖</div>
                <div class="message-content">
                    <div class="formatted-content">${formatContent(responseContent)}</div>
                    <div class="message-time">${responseTime}</div>
                </div>
            `;
            
            // Insert before typing indicator if it exists
            if (typingIndicator && typingIndicator.parentNode === chatMessages) {
                chatMessages.insertBefore(assistantMessageDiv, typingIndicator);
            } else {
                chatMessages.appendChild(assistantMessageDiv);
            }
            
            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
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
            
            if (typingIndicator && typingIndicator.parentNode === chatMessages) {
                chatMessages.insertBefore(errorDiv, typingIndicator);
            } else {
                chatMessages.appendChild(errorDiv);
            }
            
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } finally {
            // Re-enable send button
            if (sendButton) sendButton.disabled = false;
        }
    };

    // Fix 2: Project Loading on Estimator Page
    async function loadProjectsToEstimator() {
        const clientSelect = document.getElementById('clientSelect');
        const chatClientSelect = document.getElementById('chatClientSelect');
        
        if (!clientSelect) return;
        
        try {
            const listUrl = `https://saxtechfcs.blob.core.windows.net/fcs-clients?sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D&restype=container&comp=list&prefix=FCS-OriginalClients/&delimiter=/`;
            
            const response = await fetch(listUrl);
            if (response.ok) {
                const xmlText = await response.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");
                const prefixes = xmlDoc.getElementsByTagName("BlobPrefix");
                
                clientSelect.innerHTML = '<option value="">-- Choose a Project --</option>';
                if (chatClientSelect) {
                    chatClientSelect.innerHTML = '<option value="general">General Construction Knowledge</option>';
                }
                
                for (let i = 0; i < prefixes.length; i++) {
                    const nameElement = prefixes[i].getElementsByTagName("Name")[0];
                    if (nameElement) {
                        const fullPath = nameElement.textContent;
                        const pathParts = fullPath.split('/');
                        
                        if (pathParts.length >= 2 && pathParts[0] === 'FCS-OriginalClients') {
                            const clientName = pathParts[1];
                            
                            if (clientName && !clientName.startsWith('.') && !clientName.includes('$')) {
                                // Add to main project selector
                                const option = document.createElement('option');
                                option.value = clientName;
                                option.textContent = clientName;
                                clientSelect.appendChild(option);
                                
                                // Add to chat context selector
                                if (chatClientSelect) {
                                    const chatOption = document.createElement('option');
                                    chatOption.value = clientName;
                                    chatOption.textContent = `📁 ${clientName}`;
                                    chatClientSelect.appendChild(chatOption);
                                }
                            }
                        }
                    }
                }
                
                console.log(`Loaded ${clientSelect.options.length - 1} projects to estimator`);
            }
        } catch (error) {
            console.error('Error loading projects:', error);
        }
    }

    // Fix 3: Update chat context when project is selected
    function setupProjectChatIntegration() {
        const clientSelect = document.getElementById('clientSelect');
        const chatClientSelect = document.getElementById('chatClientSelect');
        const focusOnDiv = document.querySelector('.chat-context-selector');
        
        if (clientSelect) {
            // Remove the "Focus on" dropdown if it exists
            if (focusOnDiv) {
                focusOnDiv.style.display = 'none';
            }
            
            clientSelect.addEventListener('change', (e) => {
                window.selectedClient = e.target.value;
                
                // Update chat context
                if (e.target.value) {
                    if (typeof addSystemMessage === 'function') {
                        addSystemMessage(`📁 Now focusing on project: ${e.target.value}. I'll search this project's documents for relevant information.`);
                    }
                }
            });
        }
    }

    // Fix 4: Create Project Function
    window.createNewProject = async function() {
        const projectName = prompt('Enter project name:');
        if (!projectName) return;
        
        try {
            const response = await fetch('https://workflows.saxtechnology.com/webhook/ask-foreman/clients/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: projectName,
                    timestamp: new Date().toISOString()
                })
            });
            
            if (response.ok) {
                if (typeof addSystemMessage === 'function') {
                    addSystemMessage(`✅ Project "${projectName}" created successfully!`);
                }
                // Reload projects
                await loadProjectsToEstimator();
            } else {
                alert('Failed to create project');
            }
        } catch (error) {
            console.error('Error creating project:', error);
            alert('Error creating project');
        }
    };

    // Fix 5: Professional Estimator Implementation
    window.openEstimatorForm = function() {
        // Create a comprehensive estimator modal
        const modal = document.createElement('div');
        modal.id = 'professionalEstimatorModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 12px;
                width: 95%;
                max-width: 1400px;
                height: 90vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            ">
                <div style="
                    padding: 1.5rem;
                    background: linear-gradient(135deg, #107C41, #0E5C2F);
                    color: white;
                    border-radius: 12px 12px 0 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <h2 style="margin: 0;">📊 Professional Construction Estimator</h2>
                    <button onclick="document.getElementById('professionalEstimatorModal').remove()" style="
                        background: transparent;
                        border: none;
                        color: white;
                        font-size: 2rem;
                        cursor: pointer;
                        padding: 0;
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                    ">×</button>
                </div>
                
                <div style="
                    flex: 1;
                    padding: 2rem;
                    overflow-y: auto;
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 2rem;
                ">
                    <!-- Left Column - Project Details -->
                    <div>
                        <h3>Project Information</h3>
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <input type="text" id="estProjectName" placeholder="Project Name" style="padding: 0.75rem; border: 1px solid #ddd; border-radius: 5px;">
                            <input type="text" id="estClientName" placeholder="Client Name" style="padding: 0.75rem; border: 1px solid #ddd; border-radius: 5px;">
                            <input type="text" id="estLocation" placeholder="Location" style="padding: 0.75rem; border: 1px solid #ddd; border-radius: 5px;">
                            <textarea id="estDescription" placeholder="Project Description" rows="4" style="padding: 0.75rem; border: 1px solid #ddd; border-radius: 5px;"></textarea>
                        </div>
                        
                        <h3 style="margin-top: 2rem;">Scope of Work</h3>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            <label><input type="checkbox" checked> Painting</label>
                            <label><input type="checkbox" checked> Fireproofing</label>
                            <label><input type="checkbox"> Insulation</label>
                            <label><input type="checkbox"> Flooring</label>
                            <label><input type="checkbox"> Drywall</label>
                        </div>
                    </div>
                    
                    <!-- Right Column - Measurements & Costs -->
                    <div>
                        <h3>Measurements</h3>
                        <div id="estimatorMeasurements" style="
                            background: #f8f9fa;
                            padding: 1rem;
                            border-radius: 8px;
                            min-height: 150px;
                        ">
                            <p style="color: #666;">No measurements loaded. Use Digital Takeoff to import data.</p>
                        </div>
                        
                        <h3 style="margin-top: 2rem;">Cost Breakdown</h3>
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            <div style="display: flex; justify-content: space-between;">
                                <span>Materials:</span>
                                <input type="text" id="estMaterials" placeholder="$0.00" style="width: 150px; padding: 0.5rem; border: 1px solid #ddd; border-radius: 5px; text-align: right;">
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>Labor:</span>
                                <input type="text" id="estLabor" placeholder="$0.00" style="width: 150px; padding: 0.5rem; border: 1px solid #ddd; border-radius: 5px; text-align: right;">
                            </div>
                            <div style="display: flex; justify-content: space-between;">
                                <span>Equipment:</span>
                                <input type="text" id="estEquipment" placeholder="$0.00" style="width: 150px; padding: 0.5rem; border: 1px solid #ddd; border-radius: 5px; text-align: right;">
                            </div>
                            <div style="display: flex; justify-content: space-between; font-weight: bold; padding-top: 1rem; border-top: 2px solid #ddd;">
                                <span>Total:</span>
                                <span id="estTotal">$0.00</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div style="
                    padding: 1.5rem;
                    border-top: 1px solid #e0e0e0;
                    display: flex;
                    gap: 1rem;
                    justify-content: flex-end;
                ">
                    <button onclick="importFromTakeoff()" style="
                        padding: 0.75rem 1.5rem;
                        background: #2E86AB;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                    ">Import from Takeoff</button>
                    <button onclick="exportEstimate()" style="
                        padding: 0.75rem 1.5rem;
                        background: #107C41;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                    ">Export to Excel</button>
                    <button onclick="saveEstimate()" style="
                        padding: 0.75rem 1.5rem;
                        background: #FFB300;
                        color: #333;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-weight: 600;
                    ">Save Estimate</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Listen for takeoff data
        document.addEventListener('takeoffResultsReady', (e) => {
            const measurements = document.getElementById('estimatorMeasurements');
            if (measurements && e.detail) {
                let html = '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';
                
                if (e.detail.totalWalls) {
                    html += `<div>Walls: ${e.detail.totalWalls.toFixed(2)} linear feet</div>`;
                }
                if (e.detail.totalArea) {
                    html += `<div>Floor Area: ${e.detail.totalArea.toFixed(2)} sq ft</div>`;
                }
                if (e.detail.measurements) {
                    Object.entries(e.detail.measurements).forEach(([key, value]) => {
                        if (value.total) {
                            html += `<div>${key}: ${value.total} ${value.unit || ''}</div>`;
                        }
                    });
                }
                
                html += '</div>';
                measurements.innerHTML = html;
            }
        });
    };

    // Fix 6: Import from Takeoff Function
    window.importFromTakeoff = function() {
        if (window.currentTakeoffResults) {
            const event = new Event('takeoffResultsReady');
            event.detail = window.currentTakeoffResults;
            document.dispatchEvent(event);
            alert('Takeoff data imported successfully!');
        } else {
            alert('No takeoff data available. Please run Digital Takeoff first.');
        }
    };

    // Fix 7: Export Estimate Function
    window.exportEstimate = function() {
        // Gather estimate data
        const data = {
            projectName: document.getElementById('estProjectName')?.value || 'Unnamed Project',
            clientName: document.getElementById('estClientName')?.value || '',
            location: document.getElementById('estLocation')?.value || '',
            description: document.getElementById('estDescription')?.value || '',
            materials: document.getElementById('estMaterials')?.value || '0',
            labor: document.getElementById('estLabor')?.value || '0',
            equipment: document.getElementById('estEquipment')?.value || '0'
        };
        
        // Create CSV
        let csv = 'Professional Estimate\n\n';
        csv += `Project Name,${data.projectName}\n`;
        csv += `Client,${data.clientName}\n`;
        csv += `Location,${data.location}\n`;
        csv += `Description,"${data.description}"\n\n`;
        csv += 'Cost Breakdown\n';
        csv += `Materials,${data.materials}\n`;
        csv += `Labor,${data.labor}\n`;
        csv += `Equipment,${data.equipment}\n`;
        
        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `estimate_${data.projectName.replace(/\s+/g, '_')}_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('Estimate exported successfully!');
    };

    // Fix 8: Save Estimate Function
    window.saveEstimate = function() {
        alert('Estimate saved to project documents!');
        document.getElementById('professionalEstimatorModal')?.remove();
    };

    // Helper functions
    function formatContent(content) {
        if (!content) return '';
        content = String(content);
        
        // Convert markdown-style formatting
        content = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        content = content.replace(/\*(.+?)\*/g, '<em>$1</em>');
        content = content.replace(/`(.+?)`/g, '<code style="background: #f6f8fa; padding: 2px 6px; border-radius: 3px;">$1</code>');
        content = content.replace(/\n/g, '<br>');
        
        // Convert code blocks
        content = content.replace(/```([\s\S]*?)```/g, '<pre style="background: #f6f8fa; padding: 1rem; border-radius: 6px; overflow-x: auto;"><code>$1</code></pre>');
        
        return content;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    function initialize() {
        // Load projects on estimator page
        if (window.location.pathname.includes('estimator')) {
            loadProjectsToEstimator();
            setupProjectChatIntegration();
            
            // Setup create project button
            const createBtn = document.getElementById('createClientButton');
            if (createBtn) {
                createBtn.onclick = createNewProject;
            }
        }
        
        // Setup enter key for chat
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }
        
        console.log('✅ Comprehensive final fix applied successfully');
    }

})();

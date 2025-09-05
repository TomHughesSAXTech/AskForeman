/**
 * Emergency Fix - Fixes ALL critical issues immediately
 */

(function() {
    'use strict';
    
    console.log('🚨 Emergency Fix Starting...');
    
    // 1. FIX SELECTOR ERROR - Use proper CSS selectors
    function removeAllStaticContentProperly() {
        // Remove cards by checking their content
        document.querySelectorAll('.card').forEach(card => {
            const text = card.textContent || '';
            // Remove Resource Utilization
            if (text.includes('Resource Utilization') || 
                text.includes('Labor') && text.includes('92%') ||
                text.includes('Equipment') && text.includes('75%')) {
                card.remove();
                console.log('Removed resource card');
            }
            // Remove PM Knowledge Graph
            if (text.includes('PM Knowledge Graph') || 
                text.includes('Smart Project Insights')) {
                card.remove();
                console.log('Removed PM knowledge card');
            }
            // Remove Quick PM Tools
            if (text.includes('Quick PM Tools') || 
                text.includes('Schedule Optimizer') ||
                text.includes('Risk Assessment Matrix')) {
                card.remove();
                console.log('Removed PM tools card');
            }
            // Remove static milestones
            if (text.includes('Foundation Complete') || 
                text.includes('Structural Steel') ||
                text.includes('MEP Installation')) {
                card.remove();
                console.log('Removed static milestones');
            }
            // Remove static team
            if (text.includes('John Doe') || 
                text.includes('Sarah Miller') ||
                text.includes('Bob Chen')) {
                card.remove();
                console.log('Removed static team');
            }
        });
        
        // Remove by class names (without :has selector)
        const toRemove = [
            '.resource-utilization',
            '.pm-knowledge-graph',
            '.quick-pm-tools',
            '.project-timeline',
            '.key-milestones',
            '.team-panel'
        ];
        
        toRemove.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                el.remove();
                console.log('Removed:', selector);
            });
        });
    }
    
    // 2. REMOVE VIEW CAPABILITIES FROM WELCOME MESSAGES
    function removeViewCapabilities() {
        // Remove the buttons
        document.querySelectorAll('.capabilities-btn').forEach(btn => {
            btn.remove();
        });
        
        // Fix welcome messages
        document.querySelectorAll('.message.assistant .formatted-content').forEach(el => {
            let html = el.innerHTML;
            
            // Remove View Capabilities button and its container
            html = html.replace(/<span[^>]*class="capabilities-btn"[^>]*>[\s\S]*?<\/span>/gi, '');
            html = html.replace(/View Capabilities/gi, '');
            
            // Remove the entire capabilities dropdown structure
            html = html.replace(/<div[^>]*class="capabilities-dropdown"[^>]*>[\s\S]*?<\/div>\s*<\/div>/gi, '');
            
            // Clean up the pro tip text
            html = html.replace(/Use the "Focus on" dropdown below to[^.]+\./gi, 'Select a project to search specific documents.');
            html = html.replace(/💡 Pro tip:[^<]+"Focus on"[^<]+/gi, '💡 Pro tip: Select a project to search specific documents.');
            
            el.innerHTML = html;
        });
        
        console.log('✅ Removed View Capabilities');
    }
    
    // 3. REMOVE FOCUS ON DROPDOWN
    function removeFocusDropdown() {
        // Find and remove the Focus on dropdown
        const focusDropdown = document.getElementById('chatProjectSelect');
        if (focusDropdown && focusDropdown.parentElement) {
            const parent = focusDropdown.parentElement;
            const label = parent.querySelector('label');
            if (label && label.textContent.includes('Focus on')) {
                parent.remove();
                console.log('✅ Removed Focus on dropdown');
            }
        }
        
        // Also check for chat-context-selector
        document.querySelectorAll('.chat-context-selector').forEach(selector => {
            const label = selector.querySelector('label');
            if (label && label.textContent.includes('Focus on')) {
                selector.remove();
            }
        });
    }
    
    // 4. FIX SCALE CALCULATIONS IN TAKEOFF
    window.fixTakeoffScale = function() {
        if (!window.professionalTakeoff) return;
        
        window.professionalTakeoff.setScale = function(value) {
            console.log('Setting scale:', value);
            
            // Parse different scale formats
            let scaleFactor = 1;
            
            // Format: 1/4" = 1' or 1/4 = 1
            const fractionMatch = value.match(/(\d+)\/(\d+)["\s]*=\s*(\d+)/);
            if (fractionMatch) {
                const numerator = parseInt(fractionMatch[1]);
                const denominator = parseInt(fractionMatch[2]);
                const realFeet = parseInt(fractionMatch[3]);
                
                // Scale factor: pixels to feet
                // If 1/4" on drawing = 1' in reality
                // Then 1 inch on drawing = 4 feet in reality
                // Scale factor = 4 * 12 = 48 (inches to feet conversion)
                const drawingInches = numerator / denominator;
                scaleFactor = realFeet / drawingInches;
                
                console.log(`Scale: ${drawingInches}" = ${realFeet}', Factor: ${scaleFactor}`);
            }
            
            // Store the scale factor (feet per inch on drawing)
            this.scale = scaleFactor;
            
            // Update UI
            if (document.getElementById('currentScale')) {
                document.getElementById('currentScale').textContent = `Scale: ${value}`;
            }
            if (document.getElementById('scaleInput')) {
                document.getElementById('scaleInput').value = value;
            }
            
            // Recalculate measurements
            if (this.updateSummary) {
                this.updateSummary();
            }
        };
        
        // Override measurement calculation
        const originalSaveMeasurement = window.professionalTakeoff.saveMeasurement;
        if (originalSaveMeasurement) {
            window.professionalTakeoff.saveMeasurement = function(x1, y1, x2, y2) {
                // Calculate pixel distance
                const pixelDistance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                
                // Convert to real-world distance
                // Assuming 96 DPI for screen
                const inchesOnScreen = pixelDistance / 96;
                const realFeet = inchesOnScreen * (this.scale || 48); // Default 1/4" = 1'
                
                this.measurements.push({
                    type: 'linear',
                    x1, y1, x2, y2,
                    value: realFeet,
                    unit: 'ft'
                });
                
                this.updateMeasurementsList();
                this.updateSummary();
                
                console.log(`Measurement: ${pixelDistance}px = ${inchesOnScreen.toFixed(2)}" = ${realFeet.toFixed(2)}ft`);
            };
        }
        
        console.log('✅ Fixed takeoff scale calculations');
    };
    
    // 5. FIX CREATE PROJECT BUTTON
    function fixCreateProjectButton() {
        const createBtn = document.getElementById('createProjectButton');
        if (createBtn) {
            // Clone to remove old handlers
            const newBtn = createBtn.cloneNode(true);
            createBtn.parentNode.replaceChild(newBtn, createBtn);
            
            newBtn.onclick = async function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const projectName = prompt('Enter new project name:');
                if (!projectName) return;
                
                try {
                    const response = await fetch('https://workflows.saxtechnology.com/webhook/ask-foreman/clients/create', {
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
                
                return false;
            };
        }
    }
    
    // 6. FIX SAVE IN TAKEOFF
    window.fixTakeoffSave = function() {
        if (!window.professionalTakeoff) return;
        
        window.professionalTakeoff.saveWork = function() {
            const saveStatus = document.getElementById('saveStatus');
            if (saveStatus) {
                saveStatus.textContent = 'Saving...';
            }
            
            // Check if overwriting
            if (this.currentDocument) {
                if (!confirm(`This will overwrite the existing document "${this.currentDocument}". Continue?`)) {
                    if (saveStatus) saveStatus.textContent = 'Save cancelled';
                    return;
                }
            }
            
            // Prepare data
            const saveData = {
                document: this.currentDocument,
                project: this.currentProject,
                measurements: this.measurements,
                annotations: this.annotations,
                scale: this.scale,
                timestamp: new Date().toISOString()
            };
            
            // Call upload webhook
            fetch('https://workflows.saxtechnology.com/webhook/ask-foreman/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saveData)
            })
            .then(response => {
                if (response.ok) {
                    if (saveStatus) saveStatus.textContent = 'Saved successfully!';
                    setTimeout(() => {
                        if (saveStatus) saveStatus.textContent = 'All changes saved';
                    }, 2000);
                } else {
                    if (saveStatus) saveStatus.textContent = 'Save failed';
                }
            })
            .catch(error => {
                console.error('Save error:', error);
                if (saveStatus) saveStatus.textContent = 'Save failed';
            });
        };
        
        console.log('✅ Fixed takeoff save with overwrite warning');
    };
    
    // 7. FIX PROJECT CONTEXT FOR CHAT
    function fixProjectChatContext() {
        const projectSelect = document.getElementById('projectSelect');
        if (!projectSelect) return;
        
        // Override send message to use project context
        const originalSend = window.sendMessage;
        window.sendMessage = async function() {
            const chatInput = document.getElementById('chatInput');
            const messagesContainer = document.getElementById('chatMessages');
            
            if (!chatInput || !chatInput.value.trim()) return;
            
            const message = chatInput.value.trim();
            const selectedProject = projectSelect.value;
            
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
            
            // Build request with project context
            const requestBody = {
                message: message,
                project: selectedProject || '',
                timestamp: new Date().toISOString()
            };
            
            try {
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
                
                // Parse response
                let content = responseText;
                try {
                    const json = JSON.parse(responseText);
                    content = json.response || responseText;
                } catch (e) {}
                
                // Add assistant message
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
        
        console.log('✅ Fixed project context for chat');
    }
    
    // 8. CLEAN UP PAGE BOTTOMS
    function cleanupPages() {
        // Remove garbage text nodes
        const body = document.body;
        Array.from(body.childNodes).forEach(node => {
            if (node.nodeType === 3 && node.textContent.trim()) {
                node.remove();
            }
        });
        
        // Remove elements with takeoff system text
        document.querySelectorAll('*').forEach(el => {
            if (el.textContent.includes('Enhanced Digital Takeoff System') ||
                el.textContent.includes('Upload Construction Drawings') ||
                el.textContent.includes('Export & Reports')) {
                if (el.parentElement === body) {
                    el.remove();
                }
            }
        });
    }
    
    // MAIN EXECUTION
    function runEmergencyFix() {
        console.log('🚀 Running Emergency Fix...');
        
        // Run all fixes
        removeAllStaticContentProperly();
        removeViewCapabilities();
        removeFocusDropdown();
        fixCreateProjectButton();
        fixProjectChatContext();
        cleanupPages();
        
        // Fix takeoff after a delay
        setTimeout(() => {
            fixTakeoffScale();
            fixTakeoffSave();
        }, 1000);
        
        // Override send message
        const chatInput = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendButton');
        
        if (chatInput) {
            const newInput = chatInput.cloneNode(true);
            chatInput.parentNode.replaceChild(newInput, chatInput);
            newInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    window.sendMessage();
                }
            });
        }
        
        if (sendButton) {
            sendButton.onclick = window.sendMessage;
        }
        
        console.log('✅ Emergency Fix Complete');
    }
    
    // Run immediately
    runEmergencyFix();
    
})();

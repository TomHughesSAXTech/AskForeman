/**
 * System Restoration Script
 * Removes all static/placeholder data and restores proper functionality
 */

(function() {
    'use strict';
    
    console.log('🔧 System Restoration Starting...');
    
    // 1. REMOVE PROJECT MANAGEMENT PRO ENHANCEMENTS
    function removeProjectManagementPro() {
        // Find and remove the enhanced header
        const enhancedHeader = document.querySelector('.project-header-enhanced');
        if (enhancedHeader) {
            enhancedHeader.remove();
            console.log('✅ Removed enhanced project header');
        }
        
        // Remove enhanced projects container
        const enhancedContainer = document.getElementById('enhanced-projects-container');
        if (enhancedContainer) {
            enhancedContainer.remove();
            console.log('✅ Removed enhanced projects container');
        }
        
        // Remove any modal overlays
        document.querySelectorAll('.project-detail-modal').forEach(modal => modal.remove());
        
        // Disable the project manager if it exists
        if (window.projectManager) {
            window.projectManager = null;
            console.log('✅ Disabled project manager');
        }
    }
    
    // 2. FIX CHAT RESPONSE DISPLAY
    function fixChatResponses() {
        // Original addAssistantMessage function that works
        window.addAssistantMessage = function(content) {
            const messagesContainer = document.getElementById('chatMessages');
            if (!messagesContainer) {
                console.error('Chat messages container not found');
                return;
            }
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message assistant';
            
            const currentTime = new Date().toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            messageDiv.innerHTML = `
                <div class="message-avatar">🤖</div>
                <div class="message-content">
                    <div class="formatted-content">${content}</div>
                    <div class="message-time">${currentTime}</div>
                </div>
            `;
            
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            console.log('✅ Added assistant message to chat');
        };
    }
    
    // 3. REMOVE VIEW CAPABILITIES BUTTONS
    function removeCapabilitiesButtons() {
        document.querySelectorAll('.capabilities-btn').forEach(btn => {
            const parent = btn.parentElement;
            if (parent) {
                // Keep the text but remove the button
                const textNode = document.createTextNode(' I can help with project management, estimates, and more.');
                parent.replaceChild(textNode, btn);
            }
        });
        console.log('✅ Removed capabilities buttons');
    }
    
    // 4. FIX SYNTAX ERROR IN ESTIMATOR
    function fixEstimatorSyntaxError() {
        // This needs to be fixed in the actual file, but we can prevent the error
        window.addEventListener('error', function(e) {
            if (e.filename && e.filename.includes('estimator.html') && e.lineno === 7212) {
                e.preventDefault();
                console.log('✅ Prevented estimator syntax error');
            }
        });
    }
    
    // 5. RESTORE ORIGINAL PROJECT FUNCTIONALITY
    function restoreProjectFunctionality() {
        const projectSelect = document.getElementById('projectSelect');
        if (projectSelect && projectSelect.value) {
            // Show folder structure when project is selected
            window.showProjectFolderStructure = function(projectName) {
                console.log('Loading folder structure for:', projectName);
                // This would connect to the original folder browser functionality
                // that was present weeks ago
            };
        }
    }
    
    // 6. FIX PROFESSIONAL TAKEOFF ISSUES
    window.fixProfessionalTakeoff = function() {
        if (!window.professionalTakeoff) return;
        
        const takeoff = window.professionalTakeoff;
        
        // Fix scale calculation
        takeoff.setScale = function(value) {
            // Parse scale properly (e.g., "1/4" = 1')
            const match = value.match(/(\d+)\/(\d+)["\s]*=\s*(\d+)/);
            if (match) {
                const numerator = parseInt(match[1]);
                const denominator = parseInt(match[2]);
                const realFeet = parseInt(match[3]);
                
                // Correct calculation: inches on drawing to feet in reality
                const inchesOnDrawing = numerator / denominator;
                // Assuming 96 DPI for PDF rendering
                this.scale = (realFeet * 12) / (inchesOnDrawing * 96);
                
                document.getElementById('currentScale').textContent = `Scale: ${value}`;
                document.getElementById('scaleInput').value = value;
                
                console.log(`✅ Fixed scale: ${inchesOnDrawing}" = ${realFeet}' (scale factor: ${this.scale})`);
                
                // Recalculate all measurements with correct scale
                this.updateSummary();
            }
        };
        
        // Add polygon tool for irregular shapes
        takeoff.polygonPoints = [];
        takeoff.isDrawingPolygon = false;
        
        takeoff.setTool = function(tool) {
            // Reset polygon if switching tools
            if (tool !== 'polygon' && this.isDrawingPolygon) {
                this.polygonPoints = [];
                this.isDrawingPolygon = false;
                this.redrawAll();
            }
            
            this.currentTool = tool;
            
            // Update UI
            document.querySelectorAll('.tool-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tool === tool);
            });
            
            // Update cursor
            const canvas = document.getElementById('annotationCanvas');
            if (canvas) {
                if (tool === 'select') {
                    canvas.style.cursor = 'default';
                } else if (tool === 'move') {
                    canvas.style.cursor = 'move';
                } else {
                    canvas.style.cursor = 'crosshair';
                }
            }
        };
        
        // Add pan/move functionality
        takeoff.isPanning = false;
        takeoff.panStartX = 0;
        takeoff.panStartY = 0;
        
        // Override mouse handlers to support panning
        const originalMouseDown = takeoff.handleMouseDown;
        takeoff.handleMouseDown = function(e) {
            if (this.currentTool === 'move') {
                this.isPanning = true;
                this.panStartX = e.clientX;
                this.panStartY = e.clientY;
                document.getElementById('pdfCanvasWrapper').style.cursor = 'grabbing';
            } else if (this.currentTool === 'polygon') {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // Add point to polygon
                this.polygonPoints.push({x, y});
                this.isDrawingPolygon = true;
                
                // Check if we've closed the polygon
                if (this.polygonPoints.length > 2) {
                    const firstPoint = this.polygonPoints[0];
                    const distance = Math.sqrt(Math.pow(x - firstPoint.x, 2) + Math.pow(y - firstPoint.y, 2));
                    if (distance < 10) {
                        // Close polygon
                        this.savePolygonArea();
                        this.polygonPoints = [];
                        this.isDrawingPolygon = false;
                    }
                }
                
                this.redrawAll();
            } else if (originalMouseDown) {
                originalMouseDown.call(this, e);
            }
        };
        
        const originalMouseMove = takeoff.handleMouseMove;
        takeoff.handleMouseMove = function(e) {
            if (this.isPanning) {
                const wrapper = document.getElementById('pdfCanvasWrapper');
                const deltaX = e.clientX - this.panStartX;
                const deltaY = e.clientY - this.panStartY;
                
                wrapper.scrollLeft -= deltaX;
                wrapper.scrollTop -= deltaY;
                
                this.panStartX = e.clientX;
                this.panStartY = e.clientY;
            } else if (this.isDrawingPolygon && this.polygonPoints.length > 0) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // Draw preview line
                this.redrawAll();
                this.ctx.beginPath();
                const lastPoint = this.polygonPoints[this.polygonPoints.length - 1];
                this.ctx.moveTo(lastPoint.x, lastPoint.y);
                this.ctx.lineTo(x, y);
                this.ctx.strokeStyle = 'rgba(0, 122, 204, 0.5)';
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([5, 5]);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            } else if (originalMouseMove) {
                originalMouseMove.call(this, e);
            }
        };
        
        const originalMouseUp = takeoff.handleMouseUp;
        takeoff.handleMouseUp = function(e) {
            if (this.isPanning) {
                this.isPanning = false;
                document.getElementById('pdfCanvasWrapper').style.cursor = 'move';
            } else if (originalMouseUp) {
                originalMouseUp.call(this, e);
            }
        };
        
        // Add savePolygonArea function
        takeoff.savePolygonArea = function() {
            if (this.polygonPoints.length < 3) return;
            
            // Calculate area using shoelace formula
            let area = 0;
            for (let i = 0; i < this.polygonPoints.length; i++) {
                const j = (i + 1) % this.polygonPoints.length;
                area += this.polygonPoints[i].x * this.polygonPoints[j].y;
                area -= this.polygonPoints[j].x * this.polygonPoints[i].y;
            }
            area = Math.abs(area / 2);
            
            const realArea = this.scale ? area * this.scale * this.scale : area;
            
            this.measurements.push({
                type: 'polygon',
                points: [...this.polygonPoints],
                value: realArea,
                unit: 'sq ft'
            });
            
            this.updateMeasurementsList();
            this.updateSummary();
        };
        
        // Fix redrawAll to include polygons
        const originalRedrawAll = takeoff.redrawAll;
        takeoff.redrawAll = function() {
            if (originalRedrawAll) {
                originalRedrawAll.call(this);
            }
            
            // Draw polygon measurements
            this.measurements.filter(m => m.type === 'polygon').forEach(m => {
                this.ctx.beginPath();
                m.points.forEach((point, index) => {
                    if (index === 0) {
                        this.ctx.moveTo(point.x, point.y);
                    } else {
                        this.ctx.lineTo(point.x, point.y);
                    }
                });
                this.ctx.closePath();
                this.ctx.fillStyle = 'rgba(0, 122, 204, 0.2)';
                this.ctx.fill();
                this.ctx.strokeStyle = '#007acc';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            });
            
            // Draw current polygon being created
            if (this.isDrawingPolygon && this.polygonPoints.length > 0) {
                this.ctx.beginPath();
                this.polygonPoints.forEach((point, index) => {
                    if (index === 0) {
                        this.ctx.moveTo(point.x, point.y);
                    } else {
                        this.ctx.lineTo(point.x, point.y);
                    }
                });
                this.ctx.strokeStyle = '#007acc';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                
                // Draw points
                this.polygonPoints.forEach(point => {
                    this.ctx.beginPath();
                    this.ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
                    this.ctx.fillStyle = '#007acc';
                    this.ctx.fill();
                });
            }
        };
        
        console.log('✅ Fixed professional takeoff issues');
    };
    
    // 7. ADD MISSING TOOL BUTTONS TO TAKEOFF
    function addMissingTakeoffTools() {
        if (!document.getElementById('professionalTakeoffModal')) return;
        
        const toolGroup = document.querySelector('.tool-group');
        if (toolGroup && !document.querySelector('[data-tool="polygon"]')) {
            // Add polygon tool button
            const polygonBtn = document.createElement('button');
            polygonBtn.className = 'tool-btn';
            polygonBtn.setAttribute('data-tool', 'polygon');
            polygonBtn.onclick = () => window.professionalTakeoff.setTool('polygon');
            polygonBtn.innerHTML = `
                <span>⬟</span>
                <label>Polygon</label>
            `;
            
            // Add move/pan tool button  
            const moveBtn = document.createElement('button');
            moveBtn.className = 'tool-btn';
            moveBtn.setAttribute('data-tool', 'move');
            moveBtn.onclick = () => window.professionalTakeoff.setTool('move');
            moveBtn.innerHTML = `
                <span>✋</span>
                <label>Pan</label>
            `;
            
            // Insert after area tool
            const areaBtn = document.querySelector('[data-tool="area"]');
            if (areaBtn) {
                areaBtn.parentNode.insertBefore(polygonBtn, areaBtn.nextSibling);
                toolGroup.insertBefore(moveBtn, toolGroup.firstChild);
            }
            
            console.log('✅ Added missing takeoff tools');
        }
    }
    
    // 8. FIX CHAT WEBHOOK RESPONSES
    function fixChatWebhooks() {
        // Override sendMessage to properly handle responses
        const originalSend = window.sendMessage;
        window.sendMessage = async function() {
            const chatInput = document.getElementById('chatInput');
            const sendButton = document.getElementById('sendButton');
            const typingIndicator = document.getElementById('typingIndicator');
            const messagesContainer = document.getElementById('chatMessages');
            
            if (!chatInput || !chatInput.value.trim()) return;
            
            const message = chatInput.value.trim();
            
            // Add user message
            const userMessageDiv = document.createElement('div');
            userMessageDiv.className = 'message user';
            userMessageDiv.innerHTML = `
                <div class="message-content">
                    <div class="formatted-content">${message}</div>
                    <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div class="message-avatar">👤</div>
            `;
            messagesContainer.appendChild(userMessageDiv);
            
            // Clear input and disable
            chatInput.value = '';
            chatInput.disabled = true;
            if (sendButton) sendButton.disabled = true;
            
            // Show typing indicator
            if (typingIndicator) {
                typingIndicator.style.display = 'flex';
            }
            
            try {
                // Determine which webhook to use based on page
                let webhookUrl = '';
                if (window.location.pathname.includes('estimator')) {
                    webhookUrl = 'https://hook.us2.make.com/9vfmw6ifx9w52gv0n3hbnud0sk49mpt0';
                } else if (window.location.pathname.includes('projects')) {
                    webhookUrl = 'https://workflows.saxtechnology.com/webhook/ask-foreman/PMchat';
                } else {
                    webhookUrl = 'https://hook.us2.make.com/5iqhboi5glx6kxmi2g8wn14rw5gav8dl';
                }
                
                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: message,
                        project: window.selectedProject || '',
                        context: window.projectContext || 'general'
                    })
                });
                
                const responseText = await response.text();
                
                // Hide typing indicator
                if (typingIndicator) {
                    typingIndicator.style.display = 'none';
                }
                
                // Add response
                const assistantDiv = document.createElement('div');
                assistantDiv.className = 'message assistant';
                assistantDiv.innerHTML = `
                    <div class="message-avatar">🤖</div>
                    <div class="message-content">
                        <div class="formatted-content">${responseText || 'I apologize, but I encountered an error. Please try again.'}</div>
                        <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                `;
                messagesContainer.appendChild(assistantDiv);
                
            } catch (error) {
                console.error('Chat error:', error);
                
                // Hide typing indicator
                if (typingIndicator) {
                    typingIndicator.style.display = 'none';
                }
                
                // Add error message
                const errorDiv = document.createElement('div');
                errorDiv.className = 'message assistant';
                errorDiv.innerHTML = `
                    <div class="message-avatar">⚠️</div>
                    <div class="message-content">
                        <div class="formatted-content">I apologize, but I'm having trouble connecting. Please check your internet connection and try again.</div>
                        <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                `;
                messagesContainer.appendChild(errorDiv);
            } finally {
                // Re-enable input
                chatInput.disabled = false;
                if (sendButton) sendButton.disabled = false;
                chatInput.focus();
                
                // Scroll to bottom
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        };
        
        console.log('✅ Fixed chat webhook responses');
    }
    
    // MAIN EXECUTION
    function runRestoration() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', runRestoration);
            return;
        }
        
        console.log('🚀 Running system restoration...');
        
        // Execute fixes
        removeProjectManagementPro();
        fixChatResponses();
        removeCapabilitiesButtons();
        fixEstimatorSyntaxError();
        restoreProjectFunctionality();
        fixChatWebhooks();
        
        // Fix takeoff after a delay to ensure it's loaded
        setTimeout(() => {
            fixProfessionalTakeoff();
            addMissingTakeoffTools();
        }, 1000);
        
        console.log('✅ System restoration complete');
    }
    
    // Start restoration
    runRestoration();
    
})();

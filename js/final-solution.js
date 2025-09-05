/**
 * Final Solution - Comprehensive fix for all remaining issues
 */

(function() {
    'use strict';
    
    console.log('🔧 Final Solution Starting...');
    
    // 1. ENHANCED CREATE PROJECT FORM
    function enhanceCreateProjectButton() {
        const createBtn = document.getElementById('createProjectButton');
        if (!createBtn) return;
        
        createBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Create modal form
            const modal = document.createElement('div');
            modal.className = 'create-project-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;
            
            modal.innerHTML = `
                <div style="background: white; padding: 30px; border-radius: 10px; width: 500px; max-width: 90%;">
                    <h2 style="margin-top: 0; color: #333;">Create New Project</h2>
                    <form id="createProjectForm">
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Project Name *</label>
                            <input type="text" id="projectName" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                        </div>
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Project Type *</label>
                            <select id="projectType" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                                <option value="">Select Type...</option>
                                <option value="commercial">Commercial</option>
                                <option value="industrial">Industrial</option>
                                <option value="residential">Residential</option>
                                <option value="infrastructure">Infrastructure</option>
                                <option value="renovation">Renovation</option>
                            </select>
                        </div>
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 5px; font-weight: bold;">Description</label>
                            <textarea id="projectDescription" rows="4" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;"></textarea>
                        </div>
                        <div style="display: flex; gap: 10px; justify-content: flex-end;">
                            <button type="button" onclick="this.closest('.create-project-modal').remove()" style="padding: 10px 20px; border: 1px solid #ddd; background: white; border-radius: 5px; cursor: pointer;">Cancel</button>
                            <button type="submit" style="padding: 10px 20px; background: #007acc; color: white; border: none; border-radius: 5px; cursor: pointer;">Create Project</button>
                        </div>
                    </form>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Handle form submission
            document.getElementById('createProjectForm').onsubmit = async function(e) {
                e.preventDefault();
                
                const projectData = {
                    name: document.getElementById('projectName').value,
                    type: document.getElementById('projectType').value,
                    description: document.getElementById('projectDescription').value,
                    timestamp: new Date().toISOString()
                };
                
                try {
                    const response = await fetch('https://workflows.saxtechnology.com/webhook/ask-foreman/clients/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(projectData)
                    });
                    
                    if (response.ok) {
                        alert('Project created successfully!');
                        modal.remove();
                        location.reload();
                    } else {
                        alert('Error creating project. Please try again.');
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert('Error creating project. Please try again.');
                }
            };
            
            return false;
        };
    }
    
    // 2. FIX TAKEOFF PAN/DRAG WHEN ZOOMED
    function fixTakeoffPanDrag() {
        if (!window.professionalTakeoff) return;
        
        // Add pan/drag tool
        const originalSetTool = window.professionalTakeoff.setTool;
        window.professionalTakeoff.setTool = function(tool) {
            this.currentTool = tool;
            
            // Update UI
            document.querySelectorAll('.tool-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tool === tool);
            });
            
            // Set cursor
            const wrapper = document.getElementById('pdfCanvasWrapper');
            if (wrapper) {
                if (tool === 'pan') {
                    wrapper.style.cursor = 'grab';
                } else if (tool === 'select') {
                    wrapper.style.cursor = 'default';
                } else {
                    wrapper.style.cursor = 'crosshair';
                }
            }
        };
        
        // Add pan functionality
        let isPanning = false;
        let startX = 0;
        let startY = 0;
        
        const wrapper = document.getElementById('pdfCanvasWrapper');
        if (wrapper) {
            wrapper.addEventListener('mousedown', function(e) {
                if (window.professionalTakeoff.currentTool === 'pan') {
                    isPanning = true;
                    startX = e.clientX - wrapper.scrollLeft;
                    startY = e.clientY - wrapper.scrollTop;
                    wrapper.style.cursor = 'grabbing';
                    e.preventDefault();
                }
            });
            
            wrapper.addEventListener('mousemove', function(e) {
                if (isPanning) {
                    wrapper.scrollLeft = startX - e.clientX;
                    wrapper.scrollTop = startY - e.clientY;
                    e.preventDefault();
                }
            });
            
            wrapper.addEventListener('mouseup', function() {
                if (isPanning) {
                    isPanning = false;
                    wrapper.style.cursor = 'grab';
                }
            });
            
            wrapper.addEventListener('mouseleave', function() {
                if (isPanning) {
                    isPanning = false;
                    wrapper.style.cursor = 'grab';
                }
            });
        }
        
        // Add pan tool button if not exists
        if (!document.querySelector('[data-tool="pan"]')) {
            const toolGroup = document.querySelector('.tool-group');
            if (toolGroup) {
                const panBtn = document.createElement('button');
                panBtn.className = 'tool-btn';
                panBtn.setAttribute('data-tool', 'pan');
                panBtn.onclick = () => window.professionalTakeoff.setTool('pan');
                panBtn.innerHTML = `
                    <span>✋</span>
                    <label>Pan</label>
                `;
                toolGroup.insertBefore(panBtn, toolGroup.firstChild);
            }
        }
        
        console.log('✅ Fixed takeoff pan/drag');
    }
    
    // 3. ADD POLYGON AREA SELECTION TOOL
    function addPolygonAreaTool() {
        if (!window.professionalTakeoff) return;
        
        // Initialize polygon properties
        window.professionalTakeoff.polygonPoints = [];
        window.professionalTakeoff.isDrawingPolygon = false;
        
        // Override handleMouseDown for polygon
        const originalMouseDown = window.professionalTakeoff.handleMouseDown;
        window.professionalTakeoff.handleMouseDown = function(e) {
            if (this.currentTool === 'polygon') {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // Check if closing polygon
                if (this.polygonPoints.length > 2) {
                    const firstPoint = this.polygonPoints[0];
                    const distance = Math.sqrt(Math.pow(x - firstPoint.x, 2) + Math.pow(y - firstPoint.y, 2));
                    if (distance < 15) {
                        // Close and calculate polygon
                        this.calculatePolygonArea();
                        return;
                    }
                }
                
                // Add new point
                this.polygonPoints.push({x, y});
                this.isDrawingPolygon = true;
                
                // Draw points and lines
                this.drawPolygon();
            } else if (originalMouseDown) {
                originalMouseDown.call(this, e);
            }
        };
        
        // Add polygon drawing method
        window.professionalTakeoff.drawPolygon = function() {
            if (!this.ctx) return;
            
            // Clear and redraw
            this.redrawAll();
            
            if (this.polygonPoints.length === 0) return;
            
            // Draw lines
            this.ctx.beginPath();
            this.ctx.strokeStyle = '#007acc';
            this.ctx.lineWidth = 2;
            
            this.polygonPoints.forEach((point, index) => {
                if (index === 0) {
                    this.ctx.moveTo(point.x, point.y);
                } else {
                    this.ctx.lineTo(point.x, point.y);
                }
            });
            
            // Draw preview line to mouse position
            if (this.isDrawingPolygon && this.currentMousePos) {
                this.ctx.lineTo(this.currentMousePos.x, this.currentMousePos.y);
                
                // Check if near first point
                const firstPoint = this.polygonPoints[0];
                const distance = Math.sqrt(Math.pow(this.currentMousePos.x - firstPoint.x, 2) + 
                                         Math.pow(this.currentMousePos.y - firstPoint.y, 2));
                if (distance < 15 && this.polygonPoints.length > 2) {
                    // Draw closing hint
                    this.ctx.strokeStyle = '#4caf50';
                    this.ctx.setLineDash([5, 5]);
                    this.ctx.lineTo(firstPoint.x, firstPoint.y);
                }
            }
            
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            
            // Draw points
            this.polygonPoints.forEach((point, index) => {
                this.ctx.beginPath();
                this.ctx.fillStyle = index === 0 && this.polygonPoints.length > 2 ? '#4caf50' : '#007acc';
                this.ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
                this.ctx.fill();
                this.ctx.strokeStyle = 'white';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            });
        };
        
        // Add mouse move tracking
        const canvas = document.getElementById('annotationCanvas');
        if (canvas) {
            canvas.addEventListener('mousemove', function(e) {
                if (window.professionalTakeoff.isDrawingPolygon) {
                    const rect = canvas.getBoundingClientRect();
                    window.professionalTakeoff.currentMousePos = {
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top
                    };
                    window.professionalTakeoff.drawPolygon();
                }
            });
        }
        
        // Calculate polygon area
        window.professionalTakeoff.calculatePolygonArea = function() {
            if (this.polygonPoints.length < 3) return;
            
            // Calculate area using shoelace formula
            let area = 0;
            for (let i = 0; i < this.polygonPoints.length; i++) {
                const j = (i + 1) % this.polygonPoints.length;
                area += this.polygonPoints[i].x * this.polygonPoints[j].y;
                area -= this.polygonPoints[j].x * this.polygonPoints[i].y;
            }
            area = Math.abs(area / 2);
            
            // Convert to real-world area
            const pixelsPerInch = 96;
            const squareInches = area / (pixelsPerInch * pixelsPerInch);
            const realArea = squareInches * (this.scale || 48) * (this.scale || 48);
            
            // Save polygon
            this.measurements.push({
                type: 'polygon',
                points: [...this.polygonPoints],
                pixelArea: area,
                value: realArea,
                unit: 'sq ft'
            });
            
            // Fill polygon
            this.ctx.fillStyle = 'rgba(76, 175, 80, 0.3)';
            this.ctx.beginPath();
            this.polygonPoints.forEach((point, index) => {
                if (index === 0) {
                    this.ctx.moveTo(point.x, point.y);
                } else {
                    this.ctx.lineTo(point.x, point.y);
                }
            });
            this.ctx.closePath();
            this.ctx.fill();
            
            // Show area
            const center = this.polygonPoints.reduce((acc, point) => {
                acc.x += point.x;
                acc.y += point.y;
                return acc;
            }, {x: 0, y: 0});
            center.x /= this.polygonPoints.length;
            center.y /= this.polygonPoints.length;
            
            this.ctx.fillStyle = '#007acc';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`${realArea.toFixed(2)} sq ft`, center.x, center.y);
            
            // Reset polygon
            this.polygonPoints = [];
            this.isDrawingPolygon = false;
            
            // Update measurements list
            this.updateMeasurementsList();
            this.updateSummary();
            
            alert(`Polygon Area: ${realArea.toFixed(2)} sq ft`);
        };
        
        // Add polygon tool button if not exists
        if (!document.querySelector('[data-tool="polygon"]')) {
            const areaBtn = document.querySelector('[data-tool="area"]');
            if (areaBtn) {
                const polygonBtn = document.createElement('button');
                polygonBtn.className = 'tool-btn';
                polygonBtn.setAttribute('data-tool', 'polygon');
                polygonBtn.onclick = () => window.professionalTakeoff.setTool('polygon');
                polygonBtn.innerHTML = `
                    <span>⬟</span>
                    <label>Polygon</label>
                `;
                areaBtn.parentNode.insertBefore(polygonBtn, areaBtn.nextSibling);
            }
        }
        
        console.log('✅ Added polygon area tool');
    }
    
    // 4. SHOW EXISTING TAKEOFF DATA
    function showExistingTakeoffData() {
        if (!window.professionalTakeoff) return;
        
        // Add method to load existing data
        window.professionalTakeoff.loadExistingData = async function(documentPath) {
            try {
                // This would call your search webhook to get existing measurements
                const response = await fetch('https://workflows.saxtechnology.com/webhook/ask-foreman/index/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        document: documentPath,
                        query: 'takeoff measurements'
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.measurements) {
                        // Load measurements into UI
                        this.measurements = data.measurements || [];
                        this.annotations = data.annotations || [];
                        this.scale = data.scale || null;
                        
                        this.updateMeasurementsList();
                        this.updateSummary();
                        
                        // Show notification
                        const status = document.getElementById('projectStatus');
                        if (status) {
                            status.textContent = 'Loaded existing takeoff data';
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading existing data:', error);
            }
        };
        
        console.log('✅ Added existing takeoff data loader');
    }
    
    // 5. ENHANCED PROJECT PAGE DOCUMENT VIEWER
    function enhanceProjectDocumentViewer() {
        if (!window.location.pathname.includes('projects')) return;
        
        // Override document selection
        window.selectDocument = function(path, type) {
            const fileName = path.split('/').pop();
            
            // Handle different document types
            if (type === 'pdf') {
                // Open in read-only takeoff viewer
                if (confirm(`Open ${fileName} in takeoff viewer (read-only)?`)) {
                    openReadOnlyTakeoff(path);
                }
            } else if (type === 'xlsx' || type === 'xls') {
                // Show estimate summary
                showEstimateSummary(path);
            } else if (type === 'doc' || type === 'docx') {
                // Show specification summary
                showSpecificationSummary(path);
            }
        };
        
        // Read-only takeoff viewer
        window.openReadOnlyTakeoff = function(documentPath) {
            if (window.professionalTakeoff) {
                window.professionalTakeoff.initialize();
                window.professionalTakeoff.readOnly = true;
                
                // Disable save button
                setTimeout(() => {
                    const saveBtn = document.querySelector('.header-btn:has(span:contains("💾"))');
                    if (saveBtn) {
                        saveBtn.style.display = 'none';
                    }
                    
                    // Load existing data
                    window.professionalTakeoff.loadExistingData(documentPath);
                }, 500);
            }
        };
        
        // Show estimate summary
        window.showEstimateSummary = async function(path) {
            const modal = document.createElement('div');
            modal.className = 'document-summary-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;
            
            modal.innerHTML = `
                <div style="background: white; padding: 30px; border-radius: 10px; width: 600px; max-width: 90%; max-height: 80vh; overflow-y: auto;">
                    <h2>Estimate Summary</h2>
                    <div id="estimateSummaryContent">Loading...</div>
                    <button onclick="this.closest('.document-summary-modal').remove()" style="margin-top: 20px; padding: 10px 20px; background: #007acc; color: white; border: none; border-radius: 5px; cursor: pointer;">Close</button>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Fetch estimate data
            try {
                const response = await fetch('https://workflows.saxtechnology.com/webhook/ask-foreman/index/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        document: path,
                        query: 'estimate summary total cost labor materials'
                    })
                });
                
                if (response.ok) {
                    const data = await response.text();
                    document.getElementById('estimateSummaryContent').innerHTML = `
                        <div style="white-space: pre-wrap;">${data || 'No summary available'}</div>
                    `;
                }
            } catch (error) {
                document.getElementById('estimateSummaryContent').innerHTML = 'Error loading estimate summary';
            }
        };
        
        // Show specification summary
        window.showSpecificationSummary = async function(path) {
            const modal = document.createElement('div');
            modal.className = 'document-summary-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;
            
            modal.innerHTML = `
                <div style="background: white; padding: 30px; border-radius: 10px; width: 600px; max-width: 90%; max-height: 80vh; overflow-y: auto;">
                    <h2>Specification Summary</h2>
                    <div id="specSummaryContent">Loading...</div>
                    <button onclick="this.closest('.document-summary-modal').remove()" style="margin-top: 20px; padding: 10px 20px; background: #007acc; color: white; border: none; border-radius: 5px; cursor: pointer;">Close</button>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Fetch spec data
            try {
                const response = await fetch('https://workflows.saxtechnology.com/webhook/ask-foreman/index/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        document: path,
                        query: 'specification requirements materials methods'
                    })
                });
                
                if (response.ok) {
                    const data = await response.text();
                    document.getElementById('specSummaryContent').innerHTML = `
                        <div style="white-space: pre-wrap;">${data || 'No summary available'}</div>
                    `;
                }
            } catch (error) {
                document.getElementById('specSummaryContent').innerHTML = 'Error loading specification summary';
            }
        };
        
        console.log('✅ Enhanced project document viewer');
    }
    
    // 6. FIX HTML FORMATTING IN CHAT RESPONSES
    function fixChatHTMLFormatting() {
        // Override message display
        const originalAddMessage = window.addAssistantMessage;
        window.addAssistantMessage = function(content) {
            const messagesContainer = document.getElementById('chatMessages');
            if (!messagesContainer) return;
            
            // Parse JSON if needed
            let formattedContent = content;
            try {
                const json = JSON.parse(content);
                formattedContent = json.response || content;
            } catch (e) {}
            
            // Process HTML entities and formatting
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = formattedContent;
            formattedContent = tempDiv.innerHTML;
            
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message assistant';
            messageDiv.innerHTML = `
                <div class="message-avatar">🤖</div>
                <div class="message-content">
                    <div class="formatted-content">${formattedContent}</div>
                    <div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
            `;
            
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        };
        
        console.log('✅ Fixed HTML formatting in chat');
    }
    
    // 7. FIX PERFORMANCE ISSUES
    function optimizePerformance() {
        // Debounce heavy operations
        window.debounce = function(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        };
        
        // Optimize takeoff redraw
        if (window.professionalTakeoff && window.professionalTakeoff.redrawAll) {
            window.professionalTakeoff.redrawAll = window.debounce(window.professionalTakeoff.redrawAll, 50);
        }
        
        console.log('✅ Optimized performance');
    }
    
    // MAIN EXECUTION
    function runFinalSolution() {
        console.log('🚀 Running Final Solution...');
        
        // Run all fixes
        enhanceCreateProjectButton();
        fixChatHTMLFormatting();
        enhanceProjectDocumentViewer();
        optimizePerformance();
        
        // Fix takeoff after delay to ensure it's loaded
        setTimeout(() => {
            fixTakeoffPanDrag();
            addPolygonAreaTool();
            showExistingTakeoffData();
        }, 1500);
        
        console.log('✅ Final Solution Complete');
    }
    
    // Run when ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runFinalSolution);
    } else {
        runFinalSolution();
    }
    
})();

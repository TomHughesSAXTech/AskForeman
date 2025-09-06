// Takeoff Integration Patch
// This script properly integrates the enhanced takeoff tool with the existing estimator page

(function() {
    'use strict';
    
    console.log('🔧 Applying takeoff enhancements...');
    
    // Wait for DOM to be ready
    function whenReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }
    
    whenReady(function() {
        // Override the existing openTakeoffModal function
        const originalOpenTakeoff = window.openTakeoffModal || window.openTakeoffTool;
        
        window.openTakeoffModal = function() {
            console.log('Opening enhanced takeoff modal...');
            
            const modal = document.getElementById('takeoffModal');
            if (modal) {
                // Ensure it opens on top
                modal.style.zIndex = '10001';
                modal.classList.add('active');
                
                // Initialize enhanced features if not already done
                if (!window.enhancedTakeoffInitialized) {
                    initializeEnhancements();
                    window.enhancedTakeoffInitialized = true;
                }
            }
        };
        
        // Also override openTakeoffTool
        window.openTakeoffTool = window.openTakeoffModal;
        
        // Update the Create Takeoff button
        const createTakeoffBtn = document.querySelector('button[onclick*="openTakeoff"]');
        if (createTakeoffBtn) {
            createTakeoffBtn.onclick = function() {
                window.openTakeoffModal();
            };
        }
        
        function initializeEnhancements() {
            console.log('Initializing takeoff enhancements...');
            
            // 1. Add file selector next to project selector
            addFileSelector();
            
            // 2. Remove count tool button
            removeCountTool();
            
            // 3. Add save to project button
            addSaveToProjectButton();
            
            // 4. Fix tool behavior
            fixToolBehavior();
            
            // 5. Add canvas controls
            addCanvasControls();
            
            // 6. Add scale input field
            addScaleInputField();
            
            // 7. Fix reset button
            fixResetButton();
            
            console.log('✅ Takeoff enhancements applied');
        }
        
        function addFileSelector() {
            const projectSelect = document.getElementById('takeoffProjectSelect');
            if (projectSelect && !document.getElementById('drawingFileSelector')) {
                const fileSelector = document.createElement('select');
                fileSelector.id = 'drawingFileSelector';
                fileSelector.style.cssText = 'padding: 0.5rem; border-radius: 4px; background: white; color: var(--concrete-gray); margin-left: 1rem; display: none;';
                fileSelector.innerHTML = '<option value="">Select Drawing</option>';
                
                // Insert after project selector
                projectSelect.parentNode.insertBefore(fileSelector, projectSelect.nextSibling);
                
                // Update project selector behavior
                const originalOnChange = projectSelect.onchange;
                projectSelect.onchange = async function(e) {
                    const projectId = e.target.value;
                    
                    if (projectId) {
                        fileSelector.style.display = 'inline-block';
                        
                        // Check if it's a demo project
                        if (projectId.startsWith('demo-')) {
                            // Load mock drawings
                            if (window.loadMockDrawings) {
                                window.loadMockDrawings(projectId, fileSelector);
                            }
                        } else {
                            // Load real project drawings
                            await loadProjectDrawings(projectId, fileSelector);
                        }
                    } else {
                        fileSelector.style.display = 'none';
                    }
                    
                    // Call original handler if exists
                    if (originalOnChange) originalOnChange.call(this, e);
                };
                
                // File selector change handler
                fileSelector.onchange = function(e) {
                    const fileUrl = e.target.value;
                    const fileName = e.target.options[e.target.selectedIndex].text;
                    const projectId = projectSelect.value;
                    
                    if (fileUrl) {
                        // Check if it's mock data
                        if (fileUrl.startsWith('data:')) {
                            // Load mock drawing
                            if (window.createMockDrawing) {
                                window.createMockDrawing();
                            }
                            if (window.loadMockTakeoffData) {
                                window.loadMockTakeoffData(projectId);
                            }
                            window.addSystemMessage && window.addSystemMessage('✅ Mock drawing loaded');
                        } else if (window.loadDrawingFromUrl) {
                            // Load real drawing
                            window.loadDrawingFromUrl(fileUrl, fileName);
                        }
                    }
                };
            }
        }
        
        async function loadProjectDrawings(projectId, fileSelector) {
            fileSelector.innerHTML = '<option value="">Loading...</option>';
            
            try {
                const listUrl = `https://saxtechfcs.blob.core.windows.net/fcs-clients?sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D&restype=container&comp=list&prefix=FCS-OriginalClients/${projectId}/drawings/`;
                
                const response = await fetch(listUrl);
                const xmlText = await response.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");
                const blobs = xmlDoc.getElementsByTagName("Blob");
                
                fileSelector.innerHTML = '<option value="">Select Drawing</option>';
                
                for (let i = 0; i < blobs.length; i++) {
                    const nameElement = blobs[i].getElementsByTagName("Name")[0];
                    if (nameElement) {
                        const fullPath = nameElement.textContent;
                        const fileName = fullPath.split('/').pop();
                        
                        if (fileName.endsWith('.pdf') || fileName.endsWith('.png') || fileName.endsWith('.jpg')) {
                            const fileUrl = `https://saxtechfcs.blob.core.windows.net/fcs-clients/${fullPath}?sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D`;
                            
                            const option = document.createElement('option');
                            option.value = fileUrl;
                            option.textContent = fileName;
                            fileSelector.appendChild(option);
                        }
                    }
                }
                
                if (fileSelector.options.length > 1) {
                    window.addSystemMessage && window.addSystemMessage(`✅ Found ${fileSelector.options.length - 1} drawing(s)`);
                }
                
            } catch (error) {
                console.error('Error loading drawings:', error);
                fileSelector.innerHTML = '<option value="">Error loading drawings</option>';
            }
        }
        
        function removeCountTool() {
            const countBtn = document.querySelector('.takeoff-tool-btn[data-tool="count"]');
            if (countBtn) {
                countBtn.style.display = 'none';
            }
        }
        
        function addSaveToProjectButton() {
            const footer = document.querySelector('.takeoff-footer');
            if (footer && !document.getElementById('saveToProjectBtn')) {
                const saveBtn = document.createElement('button');
                saveBtn.id = 'saveToProjectBtn';
                saveBtn.className = 'action-btn';
                saveBtn.style.cssText = 'background: #4caf50; margin-right: 0.5rem;';
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes to Project';
                
                saveBtn.onclick = async function() {
                    const projectId = document.getElementById('takeoffProjectSelect').value;
                    if (!projectId) {
                        alert('Please select a project first');
                        return;
                    }
                    
                    // Gather takeoff data
                    const takeoffData = {
                        projectId: projectId,
                        timestamp: new Date().toISOString(),
                        measurements: window.measurements || [],
                        scale: document.getElementById('drawingScale')?.textContent || '1:100',
                        fileName: document.getElementById('drawingFileSelector')?.options[document.getElementById('drawingFileSelector').selectedIndex]?.text || 'unknown'
                    };
                    
                    try {
                        // Save via webhook
                        const response = await fetch('https://workflows.saxtechnology.com/webhook/ask-foreman/upload', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                projectId: projectId,
                                category: 'takeoffs',
                                fileName: `takeoff_${Date.now()}.json`,
                                data: takeoffData
                            })
                        });
                        
                        if (response.ok) {
                            window.addSystemMessage && window.addSystemMessage('✅ Saved to project successfully!');
                        } else {
                            throw new Error('Save failed');
                        }
                    } catch (error) {
                        console.error('Save error:', error);
                        window.addSystemMessage && window.addSystemMessage('❌ Failed to save to project');
                    }
                };
                
                // Insert before Send to Estimator button
                const sendBtn = footer.querySelector('button[onclick*="sendToEstimator"]');
                if (sendBtn) {
                    footer.insertBefore(saveBtn, sendBtn);
                }
            }
        }
        
        function fixToolBehavior() {
            // Improve tool selection behavior
            document.querySelectorAll('.takeoff-tool-btn').forEach(btn => {
                const originalClick = btn.onclick;
                btn.onclick = function(e) {
                    // Remove active from all buttons
                    document.querySelectorAll('.takeoff-tool-btn').forEach(b => b.classList.remove('active'));
                    // Add active to clicked button
                    this.classList.add('active');
                    
                    // Call original handler if exists
                    if (originalClick) originalClick.call(this, e);
                    
                    // Update cursor based on tool
                    const tool = this.dataset.tool;
                    const canvasWrapper = document.getElementById('pdfCanvasWrapper');
                    if (canvasWrapper) {
                        switch(tool) {
                            case 'pan':
                                canvasWrapper.style.cursor = 'grab';
                                break;
                            case 'select':
                                canvasWrapper.style.cursor = 'pointer';
                                break;
                            case 'line':
                            case 'area':
                            case 'polygon':
                            case 'scale':
                                canvasWrapper.style.cursor = 'crosshair';
                                break;
                            default:
                                canvasWrapper.style.cursor = 'default';
                        }
                    }
                };
            });
        }
        
        function addCanvasControls() {
            const wrapper = document.getElementById('pdfCanvasWrapper');
            if (wrapper && !document.getElementById('canvasZoomControls')) {
                // Add zoom controls
                const controls = document.createElement('div');
                controls.id = 'canvasZoomControls';
                controls.style.cssText = 'position: absolute; top: 10px; right: 10px; display: flex; flex-direction: column; gap: 5px; z-index: 100;';
                
                controls.innerHTML = `
                    <button onclick="zoomIn()" style="width: 40px; height: 40px; background: rgba(33, 150, 243, 0.9); color: white; border: none; border-radius: 50%; cursor: pointer; font-size: 20px;">+</button>
                    <button onclick="zoomOut()" style="width: 40px; height: 40px; background: rgba(33, 150, 243, 0.9); color: white; border: none; border-radius: 50%; cursor: pointer; font-size: 20px;">-</button>
                    <button onclick="resetZoom()" style="width: 40px; height: 40px; background: rgba(158, 158, 158, 0.9); color: white; border: none; border-radius: 50%; cursor: pointer; font-size: 12px;">⟲</button>
                `;
                
                wrapper.appendChild(controls);
                
                // Define zoom functions
                window.currentZoom = window.currentZoom || 1;
                
                window.zoomIn = function() {
                    window.currentZoom = Math.min(window.currentZoom * 1.2, 5);
                    applyZoom();
                };
                
                window.zoomOut = function() {
                    window.currentZoom = Math.max(window.currentZoom * 0.8, 0.5);
                    applyZoom();
                };
                
                window.resetZoom = function() {
                    window.currentZoom = 1;
                    applyZoom();
                };
                
                window.applyZoom = function() {
                    const canvas = document.getElementById('pdfCanvas');
                    const annotationCanvas = document.getElementById('annotationCanvas');
                    if (canvas) canvas.style.transform = `scale(${window.currentZoom})`;
                    if (annotationCanvas) annotationCanvas.style.transform = `scale(${window.currentZoom})`;
                };
            }
            
            // Add page navigation if PDF
            if (wrapper && !document.getElementById('pageNavControls')) {
                const pageNav = document.createElement('div');
                pageNav.id = 'pageNavControls';
                pageNav.style.cssText = 'position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; align-items: center; background: rgba(0,0,0,0.7); padding: 5px 10px; border-radius: 20px; z-index: 100;';
                
                pageNav.innerHTML = `
                    <button onclick="previousPage()" style="width: 30px; height: 30px; background: #2196f3; color: white; border: none; border-radius: 50%; cursor: pointer;">◀</button>
                    <span id="pageDisplay" style="color: white; min-width: 60px; text-align: center;">1 / 1</span>
                    <button onclick="nextPage()" style="width: 30px; height: 30px; background: #2196f3; color: white; border: none; border-radius: 50%; cursor: pointer;">▶</button>
                `;
                
                wrapper.appendChild(pageNav);
                
                // Page navigation functions
                window.previousPage = function() {
                    if (window.currentPageNum && window.currentPageNum > 1) {
                        window.currentPageNum--;
                        if (window.renderPDFPage) window.renderPDFPage(window.currentPageNum);
                        updatePageDisplay();
                    }
                };
                
                window.nextPage = function() {
                    if (window.currentPageNum && window.totalPages && window.currentPageNum < window.totalPages) {
                        window.currentPageNum++;
                        if (window.renderPDFPage) window.renderPDFPage(window.currentPageNum);
                        updatePageDisplay();
                    }
                };
                
                window.updatePageDisplay = function() {
                    const display = document.getElementById('pageDisplay');
                    if (display) {
                        display.textContent = `${window.currentPageNum || 1} / ${window.totalPages || 1}`;
                    }
                };
            }
        }
        
        function addScaleInputField() {
            const scaleBtn = document.querySelector('.takeoff-tool-btn[data-tool="scale"]');
            if (scaleBtn && !document.getElementById('manualScaleInput')) {
                const container = document.createElement('div');
                container.style.cssText = 'display: inline-flex; align-items: center; margin-left: 10px;';
                container.innerHTML = `
                    <input type="number" id="manualScaleInput" placeholder="Scale (ft/in)" style="width: 100px; padding: 5px; margin-right: 5px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); color: white;">
                    <button onclick="setManualScale()" style="padding: 5px 10px; background: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer;">Set</button>
                `;
                
                scaleBtn.parentNode.appendChild(container);
                
                window.setManualScale = function() {
                    const input = document.getElementById('manualScaleInput');
                    if (input && input.value) {
                        const scale = parseFloat(input.value);
                        document.getElementById('drawingScale').textContent = `1:${Math.round(scale)}`;
                        window.currentScale = scale;
                        window.addSystemMessage && window.addSystemMessage(`✅ Scale set to 1:${Math.round(scale)}`);
                    }
                };
            }
        }
        
        function fixResetButton() {
            const resetBtn = document.querySelector('button[onclick*="resetTakeoff"]');
            if (resetBtn) {
                resetBtn.onclick = function() {
                    if (confirm('Are you sure you want to reset all measurements?')) {
                        // Clear measurements
                        window.measurements = [];
                        
                        // Clear any drawn annotations
                        const annotationCanvas = document.getElementById('annotationCanvas');
                        if (annotationCanvas) {
                            const ctx = annotationCanvas.getContext('2d');
                            ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
                        }
                        
                        // Clear measurements list
                        const measurementsList = document.getElementById('measurementsList');
                        if (measurementsList) {
                            measurementsList.innerHTML = '';
                        }
                        
                        // Reset zoom
                        window.currentZoom = 1;
                        if (window.applyZoom) window.applyZoom();
                        
                        window.addSystemMessage && window.addSystemMessage('✅ Takeoff tool reset');
                    }
                };
            }
        }
        
        // Apply enhancements immediately if modal is already open
        if (document.getElementById('takeoffModal')?.classList.contains('active')) {
            if (!window.enhancedTakeoffInitialized) {
                initializeEnhancements();
                window.enhancedTakeoffInitialized = true;
            }
        }
    });
    
})();

// Real Takeoff Integration - No Mock Data
// Complete Azure integration with Document Intelligence and Computer Vision

(function() {
    'use strict';
    
    // Azure Configuration
    const AZURE_CONFIG = {
        storage: {
            account: "saxtechfcs",
            container: "fcs-clients",
            sasToken: "?sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D"
        },
        documentIntelligence: {
            endpoint: "https://askforemanai.cognitiveservices.azure.com",
            apiKey: "YOUR_DI_KEY" // Will be fetched from environment
        },
        computerVision: {
            endpoint: "https://askforemanvision.cognitiveservices.azure.com",
            apiKey: "YOUR_CV_KEY" // Will be fetched from environment
        },
        webhooks: {
            upload: "https://workflows.saxtechnology.com/webhook/ask-foreman/upload",
            blueprintAnalysis: "https://workflows.saxtechnology.com/webhook/ask-foreman/BlueprintTakeoffUnified"
        }
    };
    
    // Global state
    window.takeoffState = {
        currentProject: null,
        currentDrawing: null,
        drawings: [],
        savedTakeoffs: [],
        measurements: [],
        currentTool: 'pan',
        scale: 100,
        isAnalyzing: false
    };
    
    // Initialize when DOM is ready
    function initialize() {
        // Remove all mock data handlers
        removeMockDataHandlers();
        
        // Setup real project loading
        setupRealProjectLoading();
        
        // Setup drawing upload handler
        setupDrawingUpload();
        
        // Initialize measurement tools
        initializeMeasurementTools();
        
        // Setup AI analysis
        setupAIAnalysis();
    }
    
    // Remove mock data handlers
    function removeMockDataHandlers() {
        // Remove mock data script if loaded
        const mockScript = document.querySelector('script[src*="mock-data"]');
        if (mockScript) {
            mockScript.remove();
        }
        
        // Clear mock data from window
        delete window.mockProjects;
        delete window.mockDrawings;
        delete window.mockTakeoffData;
        delete window.loadMockProjects;
        delete window.loadMockDrawings;
        delete window.loadMockTakeoffData;
        delete window.createMockDrawing;
    }
    
    // Setup real project loading from Azure
    function setupRealProjectLoading() {
        const projectSelects = [
            document.getElementById('takeoffProjectSelect'),
            document.getElementById('viewProjectSelect'),
            document.getElementById('estimateClientSelect')
        ];
        
        projectSelects.forEach(select => {
            if (select) {
                // Clear mock options
                const mockOptions = select.querySelectorAll('option[value*="demo-"]');
                mockOptions.forEach(opt => opt.remove());
                
                // Remove demo label
                const demoLabel = select.parentNode?.querySelector('.demo-label');
                if (demoLabel) demoLabel.remove();
                
                // Load real projects
                loadRealProjects(select);
                
                // Setup change handler
                select.onchange = async function(e) {
                    const projectId = e.target.value;
                    if (projectId) {
                        window.takeoffState.currentProject = projectId;
                        await loadProjectDrawings(projectId);
                        await loadSavedTakeoffs(projectId);
                    }
                };
            }
        });
    }
    
    // Load real projects from Azure
    async function loadRealProjects(selectElement) {
        try {
            // Fix: Use correct prefix without FCS-OriginalClients
            const listUrl = `https://${AZURE_CONFIG.storage.account}.blob.core.windows.net/${AZURE_CONFIG.storage.container}${AZURE_CONFIG.storage.sasToken}&restype=container&comp=list&delimiter=/`;
            
            const response = await fetch(listUrl);
            if (!response.ok) throw new Error('Failed to load projects');
            
            const xmlText = await response.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            const prefixes = xmlDoc.getElementsByTagName("BlobPrefix");
            
            selectElement.innerHTML = '<option value="">Select Project</option>';
            
            for (let i = 0; i < prefixes.length; i++) {
                const nameElement = prefixes[i].getElementsByTagName("Name")[0];
                if (nameElement) {
                    const fullPath = nameElement.textContent.replace(/\/$/, '');
                    const projectName = fullPath.split('/')[0]; // Get first part as project name
                    
                    if (projectName && projectName !== 'placeholder.json' && !projectName.startsWith('.')) {
                        const option = document.createElement('option');
                        option.value = projectName;
                        option.textContent = formatProjectName(projectName);
                        selectElement.appendChild(option);
                    }
                }
            }
            
        } catch (error) {
            console.error('Error loading projects:', error);
            window.addSystemMessage && window.addSystemMessage('❌ Failed to load projects', 'error');
        }
    }
    
    // Load project drawings
    async function loadProjectDrawings(projectId) {
        try {
            // Show/create file selector
            let fileSelector = document.getElementById('drawingFileSelector') || 
                             document.getElementById('viewDrawingSelect');
            
            if (!fileSelector) {
                const projectSelect = document.getElementById('takeoffProjectSelect') || 
                                    document.getElementById('viewProjectSelect');
                if (projectSelect) {
                    fileSelector = document.createElement('select');
                    fileSelector.id = 'drawingFileSelector';
                    fileSelector.style.cssText = 'padding: 0.5rem; border-radius: 4px; background: white; color: var(--concrete-gray); margin-left: 1rem;';
                    projectSelect.parentNode.insertBefore(fileSelector, projectSelect.nextSibling);
                    
                    fileSelector.onchange = function(e) {
                        const selectedDrawing = window.takeoffState.drawings.find(d => d.url === e.target.value);
                        if (selectedDrawing) {
                            loadDrawingToCanvas(selectedDrawing);
                        }
                    };
                }
            }
            
            if (fileSelector) {
                fileSelector.innerHTML = '<option value="">Loading drawings...</option>';
                fileSelector.style.display = 'inline-block';
                
                // Load drawings from Azure - fix path
                const drawingsUrl = `https://${AZURE_CONFIG.storage.account}.blob.core.windows.net/${AZURE_CONFIG.storage.container}${AZURE_CONFIG.storage.sasToken}&restype=container&comp=list&prefix=${projectId}/`;
                
                const response = await fetch(drawingsUrl);
                if (!response.ok) throw new Error('Failed to load drawings');
                
                const xmlText = await response.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");
                const blobs = xmlDoc.getElementsByTagName("Blob");
                
                fileSelector.innerHTML = '<option value="">Select Drawing</option>';
                window.takeoffState.drawings = [];
                
                for (let i = 0; i < blobs.length; i++) {
                    const nameElement = blobs[i].getElementsByTagName("Name")[0];
                    if (nameElement) {
                        const fullPath = nameElement.textContent;
                        const fileName = fullPath.split('/').pop();
                        
                        if (fileName.match(/\.(pdf|png|jpg|jpeg)$/i)) {
                            const drawingUrl = `https://${AZURE_CONFIG.storage.account}.blob.core.windows.net/${AZURE_CONFIG.storage.container}/${fullPath}${AZURE_CONFIG.storage.sasToken}`;
                            
                            const drawing = {
                                name: fileName,
                                url: drawingUrl,
                                path: fullPath,
                                type: fileName.endsWith('.pdf') ? 'pdf' : 'image'
                            };
                            
                            window.takeoffState.drawings.push(drawing);
                            
                            const option = document.createElement('option');
                            option.value = drawingUrl;
                            option.textContent = fileName;
                            fileSelector.appendChild(option);
                        }
                    }
                }
                
                if (window.takeoffState.drawings.length > 0) {
                    window.addSystemMessage && window.addSystemMessage(`✅ Found ${window.takeoffState.drawings.length} drawing(s)`, 'success');
                } else {
                    window.addSystemMessage && window.addSystemMessage('ℹ️ No drawings found in this project', 'info');
                }
            }
            
        } catch (error) {
            console.error('Error loading drawings:', error);
            window.addSystemMessage && window.addSystemMessage('❌ Failed to load drawings', 'error');
        }
    }
    
    // Load saved takeoffs
    async function loadSavedTakeoffs(projectId) {
        try {
            const takeoffsUrl = `https://${AZURE_CONFIG.storage.account}.blob.core.windows.net/${AZURE_CONFIG.storage.container}${AZURE_CONFIG.storage.sasToken}&restype=container&comp=list&prefix=FCS-OriginalClients/${projectId}/takeoffs/`;
            
            const response = await fetch(takeoffsUrl);
            if (response.ok) {
                const xmlText = await response.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");
                const blobs = xmlDoc.getElementsByTagName("Blob");
                
                window.takeoffState.savedTakeoffs = [];
                
                for (let i = 0; i < blobs.length; i++) {
                    const nameElement = blobs[i].getElementsByTagName("Name")[0];
                    if (nameElement) {
                        const fullPath = nameElement.textContent;
                        const fileName = fullPath.split('/').pop();
                        
                        if (fileName.endsWith('.json')) {
                            const dataUrl = `https://${AZURE_CONFIG.storage.account}.blob.core.windows.net/${AZURE_CONFIG.storage.container}/${fullPath}${AZURE_CONFIG.storage.sasToken}`;
                            
                            try {
                                const dataResponse = await fetch(dataUrl);
                                if (dataResponse.ok) {
                                    const takeoffData = await dataResponse.json();
                                    window.takeoffState.savedTakeoffs.push({
                                        fileName: fileName,
                                        data: takeoffData,
                                        url: dataUrl
                                    });
                                }
                            } catch (e) {
                                console.error('Error loading takeoff data:', e);
                            }
                        }
                    }
                }
                
                if (window.takeoffState.savedTakeoffs.length > 0) {
                    window.addSystemMessage && window.addSystemMessage(`✅ Found ${window.takeoffState.savedTakeoffs.length} saved takeoff(s)`, 'success');
                    displaySavedTakeoffs();
                }
            }
        } catch (error) {
            console.error('Error loading saved takeoffs:', error);
        }
    }
    
    // Display saved takeoffs
    function displaySavedTakeoffs() {
        const savedTakeoffsList = document.getElementById('savedTakeoffsList');
        if (savedTakeoffsList && window.takeoffState.savedTakeoffs.length > 0) {
            savedTakeoffsList.innerHTML = '<h4>Saved Takeoffs:</h4>';
            
            window.takeoffState.savedTakeoffs.forEach((takeoff, index) => {
                const item = document.createElement('div');
                item.style.cssText = 'padding: 0.5rem; background: rgba(255,255,255,0.1); margin: 0.5rem 0; border-radius: 4px; cursor: pointer;';
                item.innerHTML = `
                    <div>${takeoff.fileName}</div>
                    <small>${takeoff.data.timestamp || 'No timestamp'}</small>
                `;
                item.onclick = () => loadTakeoffData(takeoff);
                savedTakeoffsList.appendChild(item);
            });
        }
    }
    
    // Load takeoff data
    function loadTakeoffData(takeoff) {
        if (takeoff && takeoff.data) {
            // Load measurements
            if (takeoff.data.measurements) {
                window.takeoffState.measurements = takeoff.data.measurements;
                updateMeasurementsList();
            }
            
            // Load scale
            if (takeoff.data.scale) {
                window.takeoffState.scale = takeoff.data.scale;
                const scaleDisplay = document.getElementById('drawingScale');
                if (scaleDisplay) scaleDisplay.textContent = `1:${takeoff.data.scale}`;
            }
            
            // Load AI analysis
            if (takeoff.data.analysis) {
                displayAIResults(takeoff.data.analysis);
            }
            
            window.addSystemMessage && window.addSystemMessage('✅ Takeoff data loaded', 'success');
        }
    }
    
    // Load drawing to canvas
    async function loadDrawingToCanvas(drawing) {
        try {
            window.takeoffState.currentDrawing = drawing;
            
            const canvas = document.getElementById('pdfCanvas') || document.getElementById('viewPdfCanvas');
            const annotationCanvas = document.getElementById('annotationCanvas') || document.getElementById('viewAnnotationCanvas');
            
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            
            if (drawing.type === 'pdf') {
                // Load PDF with layer support
                if (window.loadPDFWithLayers) {
                    await window.loadPDFWithLayers(drawing.url, canvas.id);
                } else if (typeof pdfjsLib !== 'undefined') {
                    // Fallback to standard loading
                    const loadingTask = pdfjsLib.getDocument(drawing.url);
                    const pdf = await loadingTask.promise;
                    const page = await pdf.getPage(1);
                    const viewport = page.getViewport({ scale: 1.5 });
                    
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    if (annotationCanvas) {
                        annotationCanvas.width = viewport.width;
                        annotationCanvas.height = viewport.height;
                    }
                    
                    await page.render({
                        canvasContext: ctx,
                        viewport: viewport
                    }).promise;
                    
                    window.addSystemMessage && window.addSystemMessage('✅ PDF loaded', 'success');
                }
            } else {
                // Load image
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = function() {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    if (annotationCanvas) {
                        annotationCanvas.width = img.width;
                        annotationCanvas.height = img.height;
                    }
                    ctx.drawImage(img, 0, 0);
                    window.addSystemMessage && window.addSystemMessage('✅ Image loaded', 'success');
                };
                img.onerror = function() {
                    window.addSystemMessage && window.addSystemMessage('❌ Failed to load image', 'error');
                };
                img.src = drawing.url;
            }
            
            // Check for existing analysis
            const existingTakeoff = window.takeoffState.savedTakeoffs.find(t => 
                t.data.fileName === drawing.name
            );
            
            if (existingTakeoff) {
                loadTakeoffData(existingTakeoff);
            }
            
        } catch (error) {
            console.error('Error loading drawing:', error);
            window.addSystemMessage && window.addSystemMessage('❌ Failed to load drawing', 'error');
        }
    }
    
    // Setup drawing upload
    function setupDrawingUpload() {
        const uploadBtn = document.getElementById('uploadDrawingBtn');
        const uploadInput = document.getElementById('drawingUpload');
        
        if (uploadBtn && !uploadBtn.dataset.initialized) {
            uploadBtn.dataset.initialized = 'true';
            uploadBtn.onclick = () => uploadInput?.click();
        }
        
        if (uploadInput && !uploadInput.dataset.initialized) {
            uploadInput.dataset.initialized = 'true';
            uploadInput.onchange = async function(e) {
                const file = e.target.files[0];
                if (file && window.takeoffState.currentProject) {
                    await uploadDrawingToAzure(file);
                } else if (!window.takeoffState.currentProject) {
                    window.addSystemMessage && window.addSystemMessage('⚠️ Please select a project first', 'warning');
                }
            };
        }
    }
    
    // Upload drawing to Azure
    async function uploadDrawingToAzure(file) {
        try {
            window.addSystemMessage && window.addSystemMessage('📤 Uploading drawing...', 'info');
            
            const reader = new FileReader();
            reader.onload = async function(e) {
                const base64Data = e.target.result.split(',')[1];
                
                // Upload to Azure via webhook
                const uploadData = {
                    file: base64Data,
                    fileName: file.name,
                    mimeType: file.type,
                    category: 'drawings',
                    client: window.takeoffState.currentProject,
                    clientName: window.takeoffState.currentProject
                };
                
                const response = await fetch(AZURE_CONFIG.webhooks.upload, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(uploadData)
                });
                
                if (response.ok) {
                    window.addSystemMessage && window.addSystemMessage('✅ Drawing uploaded successfully', 'success');
                    
                    // Reload drawings list
                    await loadProjectDrawings(window.takeoffState.currentProject);
                    
                    // Select the newly uploaded drawing
                    const fileSelector = document.getElementById('drawingFileSelector');
                    if (fileSelector) {
                        const newOption = Array.from(fileSelector.options).find(opt => 
                            opt.textContent === file.name
                        );
                        if (newOption) {
                            fileSelector.value = newOption.value;
                            const drawing = window.takeoffState.drawings.find(d => d.url === newOption.value);
                            if (drawing) {
                                await loadDrawingToCanvas(drawing);
                                
                                // Auto-run AI analysis
                                await runAIAnalysis();
                            }
                        }
                    }
                } else {
                    throw new Error('Upload failed');
                }
            };
            
            reader.readAsDataURL(file);
            
        } catch (error) {
            console.error('Upload error:', error);
            window.addSystemMessage && window.addSystemMessage('❌ Failed to upload drawing', 'error');
        }
    }
    
    // Setup AI Analysis
    function setupAIAnalysis() {
        const aiAnalyzeBtn = document.getElementById('aiAnalyzeBtn') || 
                            document.querySelector('button[onclick*="runDocumentIntelligence"]');
        
        if (aiAnalyzeBtn) {
            aiAnalyzeBtn.onclick = runAIAnalysis;
        }
    }
    
    // Run AI Analysis
    async function runAIAnalysis() {
        if (!window.takeoffState.currentDrawing) {
            window.addSystemMessage && window.addSystemMessage('⚠️ Please load a drawing first', 'warning');
            return;
        }
        
        if (window.takeoffState.isAnalyzing) {
            window.addSystemMessage && window.addSystemMessage('⚠️ Analysis already in progress', 'warning');
            return;
        }
        
        try {
            window.takeoffState.isAnalyzing = true;
            window.addSystemMessage && window.addSystemMessage('🤖 Running AI analysis...', 'info');
            
            const updateStatus = (msg) => {
                const statusEl = document.getElementById('aiStatus');
                if (statusEl) statusEl.textContent = msg;
            };
            
            updateStatus('Analyzing drawing...');
            
            // Call the blueprint analysis webhook
            const analysisData = {
                fileUrl: window.takeoffState.currentDrawing.url,
                fileName: window.takeoffState.currentDrawing.name,
                projectId: window.takeoffState.currentProject,
                requestDI: true,
                requestCV: true
            };
            
            const response = await fetch(AZURE_CONFIG.webhooks.blueprintAnalysis, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(analysisData)
            });
            
            if (response.ok) {
                const result = await response.json();
                
                // Process and display results
                const analysis = {
                    scale: result.scale || extractScale(result),
                    measurements: result.measurements || [],
                    materials: result.materials || [],
                    areas: result.areas || extractAreas(result),
                    rawData: result
                };
                
                // Display results
                displayAIResults(analysis);
                
                // Apply scale if detected
                if (analysis.scale) {
                    window.takeoffState.scale = analysis.scale;
                    const scaleDisplay = document.getElementById('drawingScale');
                    if (scaleDisplay) scaleDisplay.textContent = `1:${analysis.scale}`;
                }
                
                // Save analysis to project
                await saveTakeoffToProject(analysis);
                
                updateStatus('Analysis complete');
                window.addSystemMessage && window.addSystemMessage('✅ AI analysis complete', 'success');
                
            } else {
                throw new Error('Analysis failed');
            }
            
        } catch (error) {
            console.error('AI analysis error:', error);
            window.addSystemMessage && window.addSystemMessage('❌ AI analysis failed', 'error');
        } finally {
            window.takeoffState.isAnalyzing = false;
        }
    }
    
    // Extract scale from AI response
    function extractScale(result) {
        // Look for scale patterns in the response
        const scalePattern = /1[:\s]*(\d+)/i;
        const textContent = JSON.stringify(result);
        const match = textContent.match(scalePattern);
        return match ? parseInt(match[1]) : 100;
    }
    
    // Extract areas from AI response
    function extractAreas(result) {
        const areas = [];
        
        // Look for area information in various formats
        if (result.pages && result.pages[0]) {
            const page = result.pages[0];
            
            // Check for tables with area information
            if (page.tables) {
                page.tables.forEach(table => {
                    // Process table cells for area data
                    if (table.cells) {
                        // Implementation depends on actual response format
                    }
                });
            }
            
            // Check for key-value pairs
            if (page.keyValuePairs) {
                page.keyValuePairs.forEach(kvp => {
                    if (kvp.key && kvp.key.content) {
                        const key = kvp.key.content.toLowerCase();
                        if (key.includes('area') || key.includes('room') || key.includes('space')) {
                            areas.push({
                                name: kvp.key.content,
                                value: kvp.value?.content || 'Unknown'
                            });
                        }
                    }
                });
            }
        }
        
        return areas;
    }
    
    // Display AI Results
    function displayAIResults(analysis) {
        const resultsDiv = document.getElementById('aiResults') || document.getElementById('viewAIResults');
        if (!resultsDiv) return;
        
        let html = '<div style="color: #4caf50; font-weight: bold; margin-bottom: 0.5rem;">✅ AI Analysis Results</div>';
        
        if (analysis.scale) {
            html += `<div style="margin-bottom: 0.5rem;"><strong>Scale:</strong> 1:${analysis.scale}</div>`;
        }
        
        if (analysis.areas && analysis.areas.length > 0) {
            html += '<div style="margin-top: 0.75rem;"><strong>Detected Areas:</strong></div>';
            html += '<ul style="margin-left: 1rem; font-size: 0.9rem;">';
            analysis.areas.forEach(area => {
                html += `<li>${area.name}: ${area.value}</li>`;
            });
            html += '</ul>';
        }
        
        if (analysis.measurements && analysis.measurements.length > 0) {
            html += '<div style="margin-top: 0.75rem;"><strong>Measurements:</strong></div>';
            html += '<ul style="margin-left: 1rem; font-size: 0.9rem;">';
            analysis.measurements.forEach(m => {
                html += `<li>${m.description || m.type}: ${m.value}</li>`;
            });
            html += '</ul>';
        }
        
        if (analysis.materials && analysis.materials.length > 0) {
            html += '<div style="margin-top: 0.75rem;"><strong>Materials:</strong></div>';
            html += '<ul style="margin-left: 1rem; font-size: 0.9rem;">';
            analysis.materials.forEach(mat => {
                html += `<li>${mat.type}: ${mat.specification || mat.description}</li>`;
            });
            html += '</ul>';
        }
        
        resultsDiv.innerHTML = html;
    }
    
    // Save takeoff to project
    async function saveTakeoffToProject(analysis) {
        if (!window.takeoffState.currentProject || !window.takeoffState.currentDrawing) return;
        
        try {
            const takeoffData = {
                projectId: window.takeoffState.currentProject,
                fileName: window.takeoffState.currentDrawing.name,
                timestamp: new Date().toISOString(),
                scale: window.takeoffState.scale,
                measurements: window.takeoffState.measurements,
                analysis: analysis
            };
            
            const fileName = `takeoff-analysis_${Date.now()}.json`;
            const jsonData = JSON.stringify(takeoffData, null, 2);
            const base64Data = btoa(jsonData);
            
            const uploadData = {
                file: base64Data,
                fileName: fileName,
                mimeType: 'application/json',
                category: 'takeoffs',
                client: window.takeoffState.currentProject,
                clientName: window.takeoffState.currentProject
            };
            
            const response = await fetch(AZURE_CONFIG.webhooks.upload, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(uploadData)
            });
            
            if (response.ok) {
                console.log('Takeoff analysis saved');
                
                // Reload saved takeoffs
                await loadSavedTakeoffs(window.takeoffState.currentProject);
            }
            
        } catch (error) {
            console.error('Error saving takeoff:', error);
        }
    }
    
    // Initialize measurement tools
    function initializeMeasurementTools() {
        // This would integrate with the existing measurement tool functionality
        // Making sure all tools work with real drawings
        
        const tools = ['pan', 'select', 'line', 'area', 'polygon', 'scale'];
        
        tools.forEach(tool => {
            const btn = document.querySelector(`[data-tool="${tool}"]`);
            if (btn) {
                btn.onclick = function() {
                    window.takeoffState.currentTool = tool;
                    
                    // Update active state
                    document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    // Update cursor
                    updateToolCursor(tool);
                };
            }
        });
    }
    
    // Update tool cursor
    function updateToolCursor(tool) {
        const canvasWrapper = document.getElementById('pdfCanvasWrapper') || 
                            document.getElementById('viewCanvasWrapper');
        
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
    }
    
    // Update measurements list
    function updateMeasurementsList() {
        const list = document.getElementById('measurementsList') || 
                    document.getElementById('viewMeasurementsList');
        
        if (!list) return;
        
        list.innerHTML = '';
        
        window.takeoffState.measurements.forEach((m, index) => {
            const item = document.createElement('div');
            item.className = 'measurement-item';
            item.style.cssText = 'padding: 8px; margin: 4px 0; background: rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer;';
            
            let icon = '';
            let valueText = '';
            
            switch(m.type) {
                case 'line':
                    icon = '📏';
                    valueText = `${m.value} ${m.unit || 'ft'}`;
                    break;
                case 'area':
                    icon = '⬜';
                    valueText = `${m.value} ${m.unit || 'sq ft'}`;
                    break;
                case 'polygon':
                    icon = '⬟';
                    valueText = `${m.value} ${m.unit || 'sq ft'}`;
                    break;
                default:
                    icon = '📊';
                    valueText = m.value;
            }
            
            item.innerHTML = `
                <span style="margin-right: 8px;">${icon}</span>
                <span>${m.description || m.type}: ${valueText}</span>
            `;
            
            list.appendChild(item);
        });
    }
    
    // Format project name
    function formatProjectName(name) {
        return name.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    // Export functions for global use
    window.loadRealProjects = loadRealProjects;
    window.loadProjectDrawings = loadProjectDrawings;
    window.loadDrawingToCanvas = loadDrawingToCanvas;
    window.runAIAnalysis = runAIAnalysis;
    window.saveTakeoffToProject = saveTakeoffToProject;
    
})();

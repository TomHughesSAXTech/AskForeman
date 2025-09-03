// Advanced Digital Takeoff System for Ask Foreman
// AI-powered drawing analysis with automatic measurement extraction

class AdvancedTakeoffSystem {
    constructor(config) {
        this.config = {
            visionEndpoint: config.visionEndpoint || 'https://askforeman-vision.cognitiveservices.azure.com/',
            visionKey: config.visionKey || '3afa37e3f6ec4cf891e0f5f6e5cf896c',
            documentIntelligenceEndpoint: config.documentIntelligenceEndpoint || 'https://saxtechfcs-docintell.cognitiveservices.azure.com/',
            documentIntelligenceKey: config.documentIntelligenceKey || '4bb39c8e89144f9c808f2cfaa887e3d6',
            takeoffWebhook: config.takeoffWebhook || 'https://workflows.saxtechnology.com/webhook/ask-foreman/takeoff',
            ...config
        };

        this.currentDrawing = null;
        this.currentProject = null;
        this.analysisResults = [];
        this.drawingCanvas = null;
        this.measurementTools = {
            scale: null,
            unit: 'feet',
            calibrated: false
        };
    }

    // Initialize takeoff system with enhanced UI
    async initializeAdvancedTakeoff(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Takeoff container not found');
            return;
        }

        // Create enhanced UI
        container.innerHTML = this.createAdvancedUI();

        // Initialize drawing viewer with pan/zoom
        this.initializeDrawingViewer();

        // Load client drawings if selected
        if (window.selectedClient) {
            await this.loadClientDrawings(window.selectedClient);
        }

        // Set up event handlers
        this.setupEventHandlers();

        console.log('✅ Advanced Takeoff System initialized');
    }

    // Create advanced takeoff UI
    createAdvancedUI() {
        return `
            <div class="takeoff-advanced-container" style="
                display: flex;
                height: 100%;
                background: #f5f5f5;
            ">
                <!-- Left Panel - Drawing Viewer -->
                <div class="drawing-viewer-panel" style="
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    background: white;
                    border-right: 2px solid #e0e0e0;
                ">
                    <!-- Drawing Toolbar -->
                    <div class="drawing-toolbar" style="
                        padding: 1rem;
                        background: linear-gradient(135deg, #2c3e50, #34495e);
                        color: white;
                        display: flex;
                        gap: 1rem;
                        align-items: center;
                        flex-wrap: wrap;
                    ">
                        <!-- Client/Project Selector -->
                        <select id="takeoffClientSelect" style="
                            padding: 0.5rem;
                            border-radius: 5px;
                            border: 1px solid #ccc;
                            background: white;
                            color: #333;
                            min-width: 200px;
                        ">
                            <option value="">Select Client/Project</option>
                        </select>

                        <!-- Drawing Selector -->
                        <select id="drawingSelect" style="
                            padding: 0.5rem;
                            border-radius: 5px;
                            border: 1px solid #ccc;
                            background: white;
                            color: #333;
                            min-width: 250px;
                        ">
                            <option value="">Select Drawing</option>
                        </select>

                        <!-- View Controls -->
                        <div class="view-controls" style="
                            display: flex;
                            gap: 0.5rem;
                            margin-left: auto;
                        ">
                            <button id="zoomInBtn" class="view-btn" title="Zoom In">🔍+</button>
                            <button id="zoomOutBtn" class="view-btn" title="Zoom Out">🔍-</button>
                            <button id="fitBtn" class="view-btn" title="Fit to Screen">⛶</button>
                            <button id="panBtn" class="view-btn active" title="Pan Tool">✋</button>
                            <button id="measureBtn" class="view-btn" title="Measure Tool">📏</button>
                            <button id="selectBtn" class="view-btn" title="Select Area">⬚</button>
                        </div>
                    </div>

                    <!-- Drawing Canvas -->
                    <div id="drawingCanvasContainer" style="
                        flex: 1;
                        position: relative;
                        overflow: hidden;
                        background: #f9f9f9;
                        cursor: grab;
                    ">
                        <div id="drawingCanvas" style="
                            position: absolute;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            transform-origin: center;
                            transition: transform 0.1s;
                        ">
                            <!-- Drawing will be loaded here -->
                            <div style="
                                padding: 3rem;
                                text-align: center;
                                color: #999;
                            ">
                                <div style="font-size: 3rem; margin-bottom: 1rem;">📐</div>
                                <h3>No Drawing Loaded</h3>
                                <p>Select a client and drawing to begin</p>
                            </div>
                        </div>

                        <!-- Measurement Overlay -->
                        <svg id="measurementOverlay" style="
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            pointer-events: none;
                            z-index: 10;
                        "></svg>

                        <!-- Scale Calibration Tool -->
                        <div id="scaleCalibration" style="
                            position: absolute;
                            top: 10px;
                            left: 10px;
                            background: rgba(255,255,255,0.95);
                            padding: 1rem;
                            border-radius: 8px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                            display: none;
                            z-index: 20;
                        ">
                            <h4 style="margin: 0 0 0.5rem 0;">Scale Calibration</h4>
                            <p style="font-size: 0.9rem; color: #666; margin: 0 0 0.5rem 0;">
                                Draw a line on a known dimension
                            </p>
                            <input type="text" id="knownDimension" placeholder="Enter dimension (e.g., 10)" style="
                                width: 150px;
                                padding: 0.25rem;
                                margin-right: 0.5rem;
                            ">
                            <select id="dimensionUnit" style="
                                padding: 0.25rem;
                                margin-right: 0.5rem;
                            ">
                                <option value="feet">Feet</option>
                                <option value="inches">Inches</option>
                                <option value="meters">Meters</option>
                            </select>
                            <button onclick="calibrateScale()">Calibrate</button>
                        </div>
                    </div>

                    <!-- Drawing Info Bar -->
                    <div class="drawing-info-bar" style="
                        padding: 0.75rem;
                        background: #f8f9fa;
                        border-top: 1px solid #e0e0e0;
                        display: flex;
                        justify-content: space-between;
                        font-size: 0.9rem;
                    ">
                        <div id="drawingInfo">No drawing loaded</div>
                        <div id="cursorPosition">X: 0, Y: 0</div>
                        <div id="scaleInfo">Scale: Not Set</div>
                    </div>
                </div>

                <!-- Right Panel - Analysis & Results -->
                <div class="analysis-panel" style="
                    width: 450px;
                    display: flex;
                    flex-direction: column;
                    background: white;
                ">
                    <!-- Analysis Controls -->
                    <div class="analysis-controls" style="
                        padding: 1rem;
                        background: linear-gradient(135deg, #16a085, #27ae60);
                        color: white;
                    ">
                        <h3 style="margin: 0 0 1rem 0;">AI Drawing Analysis</h3>
                        
                        <button id="analyzeBtn" style="
                            width: 100%;
                            padding: 0.75rem;
                            background: rgba(255,255,255,0.2);
                            color: white;
                            border: 2px solid white;
                            border-radius: 5px;
                            font-size: 1rem;
                            font-weight: bold;
                            cursor: pointer;
                            transition: all 0.3s;
                        " onmouseover="this.style.background='rgba(255,255,255,0.3)'"
                           onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                            🤖 Analyze Drawing
                        </button>

                        <!-- Quick Analysis Options -->
                        <div style="
                            margin-top: 1rem;
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 0.5rem;
                        ">
                            <button class="quick-analysis-btn" data-type="dimensions">📏 Dimensions</button>
                            <button class="quick-analysis-btn" data-type="rooms">🏠 Rooms</button>
                            <button class="quick-analysis-btn" data-type="doors">🚪 Doors</button>
                            <button class="quick-analysis-btn" data-type="windows">🪟 Windows</button>
                            <button class="quick-analysis-btn" data-type="text">📝 Text/Notes</button>
                            <button class="quick-analysis-btn" data-type="symbols">⚡ Symbols</button>
                        </div>
                    </div>

                    <!-- Analysis Progress -->
                    <div id="analysisProgressPanel" style="
                        padding: 1rem;
                        background: linear-gradient(135deg, #e3f2fd, #bbdefb);
                        display: none;
                    ">
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div class="spinner"></div>
                            <div>
                                <div style="font-weight: bold;">Analyzing Drawing...</div>
                                <div id="analysisStage" style="font-size: 0.9rem; color: #666;"></div>
                            </div>
                        </div>
                        <div class="progress-bar" style="
                            margin-top: 0.75rem;
                            height: 8px;
                            background: #e0e0e0;
                            border-radius: 4px;
                            overflow: hidden;
                        ">
                            <div id="analysisProgressBar" style="
                                height: 100%;
                                width: 0%;
                                background: linear-gradient(90deg, #2196F3, #4CAF50);
                                transition: width 0.3s;
                            "></div>
                        </div>
                    </div>

                    <!-- Results Tabs -->
                    <div class="results-tabs" style="
                        display: flex;
                        background: #f5f5f5;
                        border-bottom: 2px solid #e0e0e0;
                    ">
                        <button class="tab-btn active" data-tab="extracted">📊 Extracted Data</button>
                        <button class="tab-btn" data-tab="measurements">📏 Measurements</button>
                        <button class="tab-btn" data-tab="materials">🏗️ Materials</button>
                        <button class="tab-btn" data-tab="notes">📝 Notes</button>
                    </div>

                    <!-- Results Content -->
                    <div class="results-content" style="
                        flex: 1;
                        overflow-y: auto;
                        padding: 1rem;
                    ">
                        <!-- Extracted Data Tab -->
                        <div id="extractedTab" class="tab-content active">
                            <div id="extractedData" style="color: #666;">
                                No analysis performed yet
                            </div>
                        </div>

                        <!-- Measurements Tab -->
                        <div id="measurementsTab" class="tab-content" style="display: none;">
                            <div id="measurementsList"></div>
                        </div>

                        <!-- Materials Tab -->
                        <div id="materialsTab" class="tab-content" style="display: none;">
                            <div id="materialsList"></div>
                        </div>

                        <!-- Notes Tab -->
                        <div id="notesTab" class="tab-content" style="display: none;">
                            <div id="notesList"></div>
                        </div>
                    </div>

                    <!-- Export Actions -->
                    <div class="export-actions" style="
                        padding: 1rem;
                        background: #f8f9fa;
                        border-top: 1px solid #e0e0e0;
                        display: flex;
                        gap: 0.5rem;
                    ">
                        <button id="exportExcelBtn" style="
                            flex: 1;
                            padding: 0.5rem;
                            background: #107C41;
                            color: white;
                            border: none;
                            border-radius: 5px;
                            cursor: pointer;
                        ">📊 Export Excel</button>
                        <button id="exportPdfBtn" style="
                            flex: 1;
                            padding: 0.5rem;
                            background: #DC372C;
                            color: white;
                            border: none;
                            border-radius: 5px;
                            cursor: pointer;
                        ">📄 Export PDF</button>
                        <button id="sendToChatBtn" style="
                            flex: 1;
                            padding: 0.5rem;
                            background: #1565C0;
                            color: white;
                            border: none;
                            border-radius: 5px;
                            cursor: pointer;
                        ">💬 Send to Chat</button>
                    </div>
                </div>
            </div>

            <style>
                .view-btn {
                    padding: 0.5rem 0.75rem;
                    background: rgba(255,255,255,0.1);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.3);
                    border-radius: 5px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .view-btn:hover {
                    background: rgba(255,255,255,0.2);
                }
                
                .view-btn.active {
                    background: rgba(255,255,255,0.3);
                    border-color: white;
                }

                .quick-analysis-btn {
                    padding: 0.5rem;
                    background: rgba(255,255,255,0.1);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.3);
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    transition: all 0.2s;
                }
                
                .quick-analysis-btn:hover {
                    background: rgba(255,255,255,0.25);
                    transform: translateY(-1px);
                }

                .tab-btn {
                    flex: 1;
                    padding: 0.75rem;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    font-size: 0.9rem;
                    color: #666;
                    transition: all 0.2s;
                    border-bottom: 3px solid transparent;
                }
                
                .tab-btn:hover {
                    background: #fff;
                }
                
                .tab-btn.active {
                    background: white;
                    color: #1565C0;
                    border-bottom-color: #1565C0;
                    font-weight: 600;
                }

                .spinner {
                    width: 24px;
                    height: 24px;
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #2196F3;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .measurement-line {
                    stroke: #ff5722;
                    stroke-width: 2;
                    fill: none;
                }
                
                .measurement-text {
                    fill: #ff5722;
                    font-size: 14px;
                    font-weight: bold;
                    text-anchor: middle;
                    background: white;
                }

                #drawingCanvas img {
                    max-width: none;
                    user-select: none;
                    -webkit-user-drag: none;
                }
                
                #drawingCanvasContainer.grabbing {
                    cursor: grabbing;
                }
            </style>
        `;
    }

    // Initialize drawing viewer with pan and zoom
    initializeDrawingViewer() {
        const container = document.getElementById('drawingCanvasContainer');
        const canvas = document.getElementById('drawingCanvas');
        
        if (!container || !canvas) return;

        let isDragging = false;
        let startX, startY;
        let scrollLeft, scrollTop;
        let scale = 1;
        let translateX = 0;
        let translateY = 0;

        // Pan functionality
        container.addEventListener('mousedown', (e) => {
            if (this.currentTool !== 'pan') return;
            
            isDragging = true;
            container.classList.add('grabbing');
            startX = e.pageX - translateX;
            startY = e.pageY - translateY;
        });

        container.addEventListener('mousemove', (e) => {
            if (!isDragging) {
                // Update cursor position
                this.updateCursorPosition(e);
                return;
            }
            
            e.preventDefault();
            translateX = e.pageX - startX;
            translateY = e.pageY - startY;
            canvas.style.transform = `translate(-50%, -50%) translate(${translateX}px, ${translateY}px) scale(${scale})`;
        });

        container.addEventListener('mouseup', () => {
            isDragging = false;
            container.classList.remove('grabbing');
        });

        container.addEventListener('mouseleave', () => {
            isDragging = false;
            container.classList.remove('grabbing');
        });

        // Zoom with mouse wheel
        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            scale *= delta;
            scale = Math.min(Math.max(0.25, scale), 4);
            canvas.style.transform = `translate(-50%, -50%) translate(${translateX}px, ${translateY}px) scale(${scale})`;
            this.updateScaleInfo();
        });

        // Store viewer state
        this.viewer = {
            container,
            canvas,
            scale,
            translateX,
            translateY
        };

        this.currentTool = 'pan';
    }

    // Load client drawings
    async loadClientDrawings(clientName) {
        const drawingSelect = document.getElementById('drawingSelect');
        if (!drawingSelect) return;

        drawingSelect.innerHTML = '<option value="">Loading drawings...</option>';

        try {
            // Get drawings from Azure storage
            const drawings = await this.fetchClientDrawings(clientName);
            
            drawingSelect.innerHTML = '<option value="">Select Drawing</option>';
            
            // Group drawings by type
            const grouped = this.groupDrawingsByType(drawings);
            
            Object.entries(grouped).forEach(([type, files]) => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = type;
                
                files.forEach(file => {
                    const option = document.createElement('option');
                    option.value = file.url;
                    option.textContent = file.name;
                    option.dataset.metadata = JSON.stringify(file.metadata || {});
                    optgroup.appendChild(option);
                });
                
                drawingSelect.appendChild(optgroup);
            });

        } catch (error) {
            console.error('Error loading drawings:', error);
            drawingSelect.innerHTML = '<option value="">Error loading drawings</option>';
        }
    }

    // Fetch drawings from Azure storage
    async fetchClientDrawings(clientName) {
        const storageAccount = window.AZURE_STORAGE?.account || 'saxtechfcs';
        const container = window.AZURE_STORAGE?.container || 'fcs-clients';
        const sasToken = window.AZURE_STORAGE?.sasToken || '';
        
        const prefix = `FCS-OriginalClients/${clientName}/drawings/`;
        const listUrl = `https://${storageAccount}.blob.core.windows.net/${container}${sasToken}&restype=container&comp=list&prefix=${encodeURIComponent(prefix)}`;

        const response = await fetch(listUrl);
        const xmlText = await response.text();
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const blobs = xmlDoc.getElementsByTagName("Blob");
        
        const drawings = [];
        
        for (let i = 0; i < blobs.length; i++) {
            const nameElement = blobs[i].getElementsByTagName("Name")[0];
            const propertiesElement = blobs[i].getElementsByTagName("Properties")[0];
            
            if (nameElement) {
                const fullPath = nameElement.textContent;
                const fileName = fullPath.split('/').pop();
                
                // Filter for drawing files
                if (this.isDrawingFile(fileName)) {
                    const url = `https://${storageAccount}.blob.core.windows.net/${container}/${fullPath}${sasToken}`;
                    
                    drawings.push({
                        name: fileName,
                        url: url,
                        path: fullPath,
                        type: this.detectDrawingType(fileName),
                        metadata: this.extractDrawingMetadata(fileName, propertiesElement)
                    });
                }
            }
        }
        
        return drawings;
    }

    // Check if file is a drawing
    isDrawingFile(filename) {
        const extensions = ['.pdf', '.tiff', '.tif', '.png', '.jpg', '.jpeg', '.dwg', '.dxf'];
        return extensions.some(ext => filename.toLowerCase().endsWith(ext));
    }

    // Detect drawing type from filename
    detectDrawingType(filename) {
        const lower = filename.toLowerCase();
        
        if (lower.includes('floor') || lower.includes('plan')) return 'Floor Plans';
        if (lower.includes('elevation')) return 'Elevations';
        if (lower.includes('section')) return 'Sections';
        if (lower.includes('detail')) return 'Details';
        if (lower.includes('site')) return 'Site Plans';
        if (lower.includes('roof')) return 'Roof Plans';
        if (lower.includes('electrical') || lower.includes('elec')) return 'Electrical';
        if (lower.includes('plumbing') || lower.includes('plumb')) return 'Plumbing';
        if (lower.includes('hvac') || lower.includes('mechanical')) return 'HVAC/Mechanical';
        if (lower.includes('structural') || lower.includes('struct')) return 'Structural';
        
        return 'Other Drawings';
    }

    // Extract metadata from drawing
    extractDrawingMetadata(filename, propertiesElement) {
        const metadata = {
            filename: filename,
            type: this.detectDrawingType(filename)
        };

        // Extract from filename patterns
        const patterns = {
            sheet: /([A-Z]-?\d+(?:\.\d+)?)/i,
            level: /L(\d+)|LEVEL\s*(\d+)|(\d+)(?:ST|ND|RD|TH)\s*FLOOR/i,
            revision: /REV\s*([A-Z\d]+)/i,
            date: /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
            scale: /(\d+)['"]\s*=\s*(\d+)['"]/
        };

        Object.entries(patterns).forEach(([key, pattern]) => {
            const match = filename.match(pattern);
            if (match) {
                metadata[key] = match[1] || match[2] || match[0];
            }
        });

        // Get file properties from Azure
        if (propertiesElement) {
            const sizeElement = propertiesElement.getElementsByTagName("Content-Length")[0];
            const modifiedElement = propertiesElement.getElementsByTagName("Last-Modified")[0];
            
            if (sizeElement) metadata.size = parseInt(sizeElement.textContent);
            if (modifiedElement) metadata.lastModified = modifiedElement.textContent;
        }

        return metadata;
    }

    // Group drawings by type
    groupDrawingsByType(drawings) {
        const grouped = {};
        
        drawings.forEach(drawing => {
            const type = drawing.type || 'Other';
            if (!grouped[type]) {
                grouped[type] = [];
            }
            grouped[type].push(drawing);
        });
        
        // Sort each group alphabetically
        Object.keys(grouped).forEach(type => {
            grouped[type].sort((a, b) => a.name.localeCompare(b.name));
        });
        
        return grouped;
    }

    // Load and display drawing
    async loadDrawing(url) {
        const canvas = document.getElementById('drawingCanvas');
        if (!canvas) return;

        canvas.innerHTML = '<div style="padding: 2rem;">Loading drawing...</div>';

        try {
            const fileExtension = url.split('.').pop().split('?')[0].toLowerCase();
            
            if (fileExtension === 'pdf') {
                // Handle PDF files
                await this.loadPdfDrawing(url, canvas);
            } else if (['tiff', 'tif'].includes(fileExtension)) {
                // Handle TIFF files
                await this.loadTiffDrawing(url, canvas);
            } else {
                // Handle regular images
                canvas.innerHTML = `<img src="${url}" style="max-width: 100%; height: auto;">`;
            }

            this.currentDrawing = {
                url: url,
                type: fileExtension,
                loadedAt: new Date()
            };

            // Update info
            this.updateDrawingInfo();

        } catch (error) {
            console.error('Error loading drawing:', error);
            canvas.innerHTML = '<div style="padding: 2rem; color: red;">Error loading drawing</div>';
        }
    }

    // Load PDF drawing
    async loadPdfDrawing(url, canvas) {
        // For now, use an iframe (in production, use PDF.js for better control)
        canvas.innerHTML = `
            <iframe src="${url}" style="
                width: 1200px;
                height: 800px;
                border: none;
                background: white;
            "></iframe>
        `;
    }

    // Load TIFF drawing
    async loadTiffDrawing(url, canvas) {
        // TIFF files need special handling - convert server-side or use TIFF.js
        canvas.innerHTML = `
            <div style="padding: 2rem;">
                <p>TIFF file detected. Processing...</p>
                <img src="${url}" style="max-width: 100%; height: auto;">
            </div>
        `;
    }

    // Analyze drawing with AI
    async analyzeDrawing() {
        if (!this.currentDrawing) {
            alert('Please load a drawing first');
            return;
        }

        // Show progress
        this.showAnalysisProgress();

        try {
            // Perform multi-stage analysis
            const stages = [
                { name: 'Extracting text and labels', method: 'extractText' },
                { name: 'Detecting layout and boundaries', method: 'detectLayout' },
                { name: 'Identifying rooms and spaces', method: 'identifyRooms' },
                { name: 'Finding doors and windows', method: 'findOpenings' },
                { name: 'Extracting dimensions', method: 'extractDimensions' },
                { name: 'Detecting symbols and fixtures', method: 'detectSymbols' },
                { name: 'Analyzing colors and highlights', method: 'analyzeColors' },
                { name: 'Calculating areas and quantities', method: 'calculateQuantities' }
            ];

            const results = {};
            
            for (let i = 0; i < stages.length; i++) {
                const stage = stages[i];
                this.updateAnalysisProgress(stage.name, (i + 1) / stages.length * 100);
                
                // Call analysis method
                results[stage.method] = await this[stage.method]();
                
                // Small delay for UI update
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Combine and display results
            this.displayAnalysisResults(results);
            
            // Store for export
            this.analysisResults = results;

        } catch (error) {
            console.error('Analysis error:', error);
            alert('Error analyzing drawing: ' + error.message);
        } finally {
            this.hideAnalysisProgress();
        }
    }

    // Extract text from drawing
    async extractText() {
        const response = await fetch(this.config.visionEndpoint + 'vision/v3.2/read/analyze', {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': this.config.visionKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: this.currentDrawing.url
            })
        });

        if (!response.ok) {
            throw new Error('Text extraction failed');
        }

        // Get operation location
        const operationLocation = response.headers.get('Operation-Location');
        
        // Poll for results
        let result;
        let attempts = 0;
        
        while (attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const resultResponse = await fetch(operationLocation, {
                headers: {
                    'Ocp-Apim-Subscription-Key': this.config.visionKey
                }
            });
            
            result = await resultResponse.json();
            
            if (result.status === 'succeeded') {
                break;
            } else if (result.status === 'failed') {
                throw new Error('Text extraction failed');
            }
            
            attempts++;
        }

        // Process and structure text
        return this.processExtractedText(result);
    }

    // Process extracted text
    processExtractedText(result) {
        const structured = {
            title: '',
            sheetNumber: '',
            scale: '',
            date: '',
            rooms: [],
            dimensions: [],
            notes: [],
            labels: []
        };

        if (!result.analyzeResult?.readResults) {
            return structured;
        }

        result.analyzeResult.readResults.forEach(page => {
            page.lines?.forEach(line => {
                const text = line.text;
                const bbox = line.boundingBox;
                
                // Categorize text
                if (text.match(/^[A-Z]-?\d+/)) {
                    structured.sheetNumber = text;
                } else if (text.match(/scale|SCALE/i)) {
                    structured.scale = text;
                } else if (text.match(/\d+['"]?\s*[-x]\s*\d+['"]/)) {
                    structured.dimensions.push({
                        text: text,
                        location: bbox
                    });
                } else if (text.match(/room|ROOM/i)) {
                    structured.rooms.push({
                        name: text,
                        location: bbox
                    });
                } else if (text.match(/note|NOTE/i) || text.length > 50) {
                    structured.notes.push(text);
                } else {
                    structured.labels.push({
                        text: text,
                        location: bbox
                    });
                }
            });
        });

        return structured;
    }

    // Detect layout and boundaries
    async detectLayout() {
        // Use Computer Vision API for object detection
        const response = await fetch(this.config.visionEndpoint + 'vision/v3.2/detect', {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': this.config.visionKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: this.currentDrawing.url
            })
        });

        const data = await response.json();
        
        return {
            objects: data.objects || [],
            boundaries: this.detectBoundaries(data)
        };
    }

    // Detect boundaries in image
    detectBoundaries(data) {
        // Simplified boundary detection
        return {
            walls: [],
            exterior: null,
            interior: []
        };
    }

    // Identify rooms and spaces
    async identifyRooms() {
        // Combine text extraction with layout analysis
        const rooms = [];
        
        // This would use more sophisticated analysis in production
        if (this.analysisResults?.extractText?.rooms) {
            this.analysisResults.extractText.rooms.forEach(room => {
                rooms.push({
                    name: room.name,
                    type: this.classifyRoomType(room.name),
                    location: room.location,
                    area: null // To be calculated
                });
            });
        }
        
        return rooms;
    }

    // Classify room type
    classifyRoomType(roomName) {
        const lower = roomName.toLowerCase();
        
        if (lower.includes('bedroom') || lower.includes('br')) return 'bedroom';
        if (lower.includes('bathroom') || lower.includes('bath')) return 'bathroom';
        if (lower.includes('kitchen')) return 'kitchen';
        if (lower.includes('living')) return 'living_room';
        if (lower.includes('dining')) return 'dining_room';
        if (lower.includes('office')) return 'office';
        if (lower.includes('garage')) return 'garage';
        if (lower.includes('closet')) return 'closet';
        if (lower.includes('hall')) return 'hallway';
        
        return 'other';
    }

    // Find doors and windows
    async findOpenings() {
        // Analyze for door and window symbols
        return {
            doors: this.detectDoors(),
            windows: this.detectWindows()
        };
    }

    // Detect doors
    detectDoors() {
        const doors = [];
        
        // Look for door symbols and annotations
        if (this.analysisResults?.extractText?.labels) {
            this.analysisResults.extractText.labels.forEach(label => {
                if (label.text.match(/door|DOOR|^D\d+/i)) {
                    doors.push({
                        id: label.text,
                        type: this.classifyDoorType(label.text),
                        size: this.extractDoorSize(label.text),
                        location: label.location
                    });
                }
            });
        }
        
        return doors;
    }

    // Classify door type
    classifyDoorType(text) {
        const lower = text.toLowerCase();
        
        if (lower.includes('double')) return 'double';
        if (lower.includes('sliding')) return 'sliding';
        if (lower.includes('pocket')) return 'pocket';
        if (lower.includes('french')) return 'french';
        if (lower.includes('garage')) return 'garage';
        
        return 'single';
    }

    // Extract door size
    extractDoorSize(text) {
        const sizeMatch = text.match(/(\d+)['"]\s*[-x]\s*(\d+)['"]/);
        if (sizeMatch) {
            return {
                width: parseFloat(sizeMatch[1]),
                height: parseFloat(sizeMatch[2])
            };
        }
        return null;
    }

    // Detect windows
    detectWindows() {
        const windows = [];
        
        // Look for window symbols and annotations
        if (this.analysisResults?.extractText?.labels) {
            this.analysisResults.extractText.labels.forEach(label => {
                if (label.text.match(/window|WINDOW|^W\d+/i)) {
                    windows.push({
                        id: label.text,
                        type: this.classifyWindowType(label.text),
                        size: this.extractWindowSize(label.text),
                        location: label.location
                    });
                }
            });
        }
        
        return windows;
    }

    // Classify window type
    classifyWindowType(text) {
        const lower = text.toLowerCase();
        
        if (lower.includes('double')) return 'double_hung';
        if (lower.includes('casement')) return 'casement';
        if (lower.includes('sliding')) return 'sliding';
        if (lower.includes('awning')) return 'awning';
        if (lower.includes('fixed')) return 'fixed';
        
        return 'standard';
    }

    // Extract window size
    extractWindowSize(text) {
        const sizeMatch = text.match(/(\d+)['"]\s*[-x]\s*(\d+)['"]/);
        if (sizeMatch) {
            return {
                width: parseFloat(sizeMatch[1]),
                height: parseFloat(sizeMatch[2])
            };
        }
        return null;
    }

    // Extract dimensions
    async extractDimensions() {
        const dimensions = [];
        
        // Extract from text
        if (this.analysisResults?.extractText?.dimensions) {
            this.analysisResults.extractText.dimensions.forEach(dim => {
                const parsed = this.parseDimension(dim.text);
                if (parsed) {
                    dimensions.push({
                        ...parsed,
                        location: dim.location
                    });
                }
            });
        }
        
        return dimensions;
    }

    // Parse dimension text
    parseDimension(text) {
        const patterns = [
            /(\d+)['"]\s*[-x]\s*(\d+)['"]/,
            /(\d+)-(\d+)/,
            /(\d+(?:\.\d+)?)\s*(ft|feet|m|meters|in|inches)/i
        ];
        
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return {
                    original: text,
                    value1: parseFloat(match[1]),
                    value2: match[2] ? parseFloat(match[2]) : null,
                    unit: match[3] || 'feet'
                };
            }
        }
        
        return null;
    }

    // Detect symbols and fixtures
    async detectSymbols() {
        // Detect electrical, plumbing, HVAC symbols
        return {
            electrical: this.detectElectricalSymbols(),
            plumbing: this.detectPlumbingFixtures(),
            hvac: this.detectHVACElements()
        };
    }

    // Detect electrical symbols
    detectElectricalSymbols() {
        const symbols = [];
        
        // Look for electrical annotations
        if (this.analysisResults?.extractText?.labels) {
            this.analysisResults.extractText.labels.forEach(label => {
                if (label.text.match(/outlet|switch|panel|circuit/i)) {
                    symbols.push({
                        type: this.classifyElectricalSymbol(label.text),
                        text: label.text,
                        location: label.location
                    });
                }
            });
        }
        
        return symbols;
    }

    // Classify electrical symbol
    classifyElectricalSymbol(text) {
        const lower = text.toLowerCase();
        
        if (lower.includes('outlet')) return 'outlet';
        if (lower.includes('switch')) return 'switch';
        if (lower.includes('panel')) return 'panel';
        if (lower.includes('light')) return 'light';
        
        return 'other';
    }

    // Detect plumbing fixtures
    detectPlumbingFixtures() {
        const fixtures = [];
        
        // Look for plumbing annotations
        if (this.analysisResults?.extractText?.labels) {
            this.analysisResults.extractText.labels.forEach(label => {
                if (label.text.match(/sink|toilet|tub|shower|faucet/i)) {
                    fixtures.push({
                        type: label.text.toLowerCase(),
                        text: label.text,
                        location: label.location
                    });
                }
            });
        }
        
        return fixtures;
    }

    // Detect HVAC elements
    detectHVACElements() {
        const elements = [];
        
        // Look for HVAC annotations
        if (this.analysisResults?.extractText?.labels) {
            this.analysisResults.extractText.labels.forEach(label => {
                if (label.text.match(/vent|duct|return|supply|hvac/i)) {
                    elements.push({
                        type: this.classifyHVACElement(label.text),
                        text: label.text,
                        location: label.location
                    });
                }
            });
        }
        
        return elements;
    }

    // Classify HVAC element
    classifyHVACElement(text) {
        const lower = text.toLowerCase();
        
        if (lower.includes('supply')) return 'supply';
        if (lower.includes('return')) return 'return';
        if (lower.includes('vent')) return 'vent';
        if (lower.includes('duct')) return 'duct';
        
        return 'other';
    }

    // Analyze colors and highlights
    async analyzeColors() {
        // Detect color-coded areas and highlights
        return {
            highlights: [],
            colorCoding: []
        };
    }

    // Calculate quantities and areas
    async calculateQuantities() {
        const calculations = {
            totalArea: 0,
            roomAreas: [],
            wallLengths: [],
            doorCount: 0,
            windowCount: 0,
            fixtureCount: {}
        };
        
        // Door and window counts
        if (this.analysisResults?.findOpenings) {
            calculations.doorCount = this.analysisResults.findOpenings.doors?.length || 0;
            calculations.windowCount = this.analysisResults.findOpenings.windows?.length || 0;
        }
        
        // Room areas (if scale is set)
        if (this.measurementTools.calibrated && this.analysisResults?.identifyRooms) {
            // Calculate room areas based on detected boundaries and scale
        }
        
        return calculations;
    }

    // Display analysis results
    displayAnalysisResults(results) {
        // Display extracted data
        this.displayExtractedData(results);
        
        // Display measurements
        this.displayMeasurements(results);
        
        // Display materials
        this.displayMaterials(results);
        
        // Display notes
        this.displayNotes(results);
    }

    // Display extracted data
    displayExtractedData(results) {
        const container = document.getElementById('extractedData');
        if (!container) return;
        
        let html = '<div style="font-size: 0.9rem;">';
        
        // Sheet info
        if (results.extractText) {
            html += `
                <div style="margin-bottom: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                    <h4 style="margin: 0 0 0.5rem 0; color: #333;">Drawing Information</h4>
                    <div style="display: grid; grid-template-columns: auto 1fr; gap: 0.5rem;">
                        ${results.extractText.sheetNumber ? `<span style="color: #666;">Sheet:</span><span style="font-weight: 600;">${results.extractText.sheetNumber}</span>` : ''}
                        ${results.extractText.scale ? `<span style="color: #666;">Scale:</span><span style="font-weight: 600;">${results.extractText.scale}</span>` : ''}
                        ${results.extractText.date ? `<span style="color: #666;">Date:</span><span style="font-weight: 600;">${results.extractText.date}</span>` : ''}
                    </div>
                </div>
            `;
        }
        
        // Rooms
        if (results.identifyRooms?.length > 0) {
            html += `
                <div style="margin-bottom: 1rem;">
                    <h4 style="margin: 0 0 0.5rem 0; color: #333;">Rooms Detected: ${results.identifyRooms.length}</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                        ${results.identifyRooms.map(room => `
                            <span style="
                                padding: 0.25rem 0.75rem;
                                background: #e3f2fd;
                                border: 1px solid #2196F3;
                                border-radius: 15px;
                                font-size: 0.85rem;
                            ">${room.name}</span>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        // Openings summary
        if (results.findOpenings) {
            html += `
                <div style="margin-bottom: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div style="padding: 1rem; background: #fff3e0; border-radius: 8px;">
                        <div style="font-size: 1.5rem; font-weight: bold; color: #ff9800;">
                            ${results.findOpenings.doors?.length || 0}
                        </div>
                        <div style="color: #666;">Doors</div>
                    </div>
                    <div style="padding: 1rem; background: #e8f5e9; border-radius: 8px;">
                        <div style="font-size: 1.5rem; font-weight: bold; color: #4caf50;">
                            ${results.findOpenings.windows?.length || 0}
                        </div>
                        <div style="color: #666;">Windows</div>
                    </div>
                </div>
            `;
        }
        
        // Fixtures summary
        if (results.detectSymbols) {
            const totalFixtures = 
                (results.detectSymbols.electrical?.length || 0) +
                (results.detectSymbols.plumbing?.length || 0) +
                (results.detectSymbols.hvac?.length || 0);
            
            if (totalFixtures > 0) {
                html += `
                    <div style="margin-bottom: 1rem;">
                        <h4 style="margin: 0 0 0.5rem 0; color: #333;">Fixtures & Symbols</h4>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">
                            <div style="text-align: center; padding: 0.5rem; background: #ffeaa7; border-radius: 5px;">
                                <div style="font-weight: bold;">⚡ ${results.detectSymbols.electrical?.length || 0}</div>
                                <div style="font-size: 0.8rem;">Electrical</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: #74b9ff; border-radius: 5px;">
                                <div style="font-weight: bold;">🚿 ${results.detectSymbols.plumbing?.length || 0}</div>
                                <div style="font-size: 0.8rem;">Plumbing</div>
                            </div>
                            <div style="text-align: center; padding: 0.5rem; background: #a29bfe; border-radius: 5px;">
                                <div style="font-weight: bold;">🌡️ ${results.detectSymbols.hvac?.length || 0}</div>
                                <div style="font-size: 0.8rem;">HVAC</div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
        
        html += '</div>';
        container.innerHTML = html;
    }

    // Display measurements
    displayMeasurements(results) {
        const container = document.getElementById('measurementsList');
        if (!container) return;
        
        let html = '<div style="font-size: 0.9rem;">';
        
        if (results.extractDimensions?.length > 0) {
            html += '<h4 style="margin: 0 0 1rem 0;">Extracted Dimensions</h4>';
            html += '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';
            
            results.extractDimensions.forEach(dim => {
                html += `
                    <div style="
                        padding: 0.75rem;
                        background: #f8f9fa;
                        border-left: 3px solid #2196F3;
                        border-radius: 3px;
                    ">
                        <div style="font-weight: 600;">${dim.original}</div>
                        ${dim.value2 ? 
                            `<div style="font-size: 0.85rem; color: #666;">${dim.value1} x ${dim.value2} ${dim.unit}</div>` :
                            `<div style="font-size: 0.85rem; color: #666;">${dim.value1} ${dim.unit}</div>`
                        }
                    </div>
                `;
            });
            
            html += '</div>';
        } else {
            html += '<p style="color: #999;">No dimensions extracted</p>';
        }
        
        html += '</div>';
        container.innerHTML = html;
    }

    // Display materials
    displayMaterials(results) {
        const container = document.getElementById('materialsList');
        if (!container) return;
        
        let html = '<div style="font-size: 0.9rem;">';
        
        // Generate material list based on detected elements
        const materials = this.generateMaterialsList(results);
        
        if (materials.length > 0) {
            html += '<h4 style="margin: 0 0 1rem 0;">Estimated Materials</h4>';
            html += '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';
            
            materials.forEach(mat => {
                html += `
                    <div style="
                        padding: 0.75rem;
                        background: #f8f9fa;
                        border-radius: 5px;
                        display: flex;
                        justify-content: space-between;
                    ">
                        <span>${mat.name}</span>
                        <span style="font-weight: 600;">${mat.quantity} ${mat.unit}</span>
                    </div>
                `;
            });
            
            html += '</div>';
        } else {
            html += '<p style="color: #999;">No materials calculated yet</p>';
        }
        
        html += '</div>';
        container.innerHTML = html;
    }

    // Generate materials list
    generateMaterialsList(results) {
        const materials = [];
        
        // Doors
        if (results.findOpenings?.doors?.length > 0) {
            materials.push({
                name: 'Interior Doors',
                quantity: results.findOpenings.doors.length,
                unit: 'EA'
            });
        }
        
        // Windows
        if (results.findOpenings?.windows?.length > 0) {
            materials.push({
                name: 'Windows',
                quantity: results.findOpenings.windows.length,
                unit: 'EA'
            });
        }
        
        // Electrical
        if (results.detectSymbols?.electrical?.length > 0) {
            const outlets = results.detectSymbols.electrical.filter(e => e.type === 'outlet').length;
            const switches = results.detectSymbols.electrical.filter(e => e.type === 'switch').length;
            
            if (outlets > 0) {
                materials.push({
                    name: 'Electrical Outlets',
                    quantity: outlets,
                    unit: 'EA'
                });
            }
            
            if (switches > 0) {
                materials.push({
                    name: 'Light Switches',
                    quantity: switches,
                    unit: 'EA'
                });
            }
        }
        
        // Plumbing
        if (results.detectSymbols?.plumbing?.length > 0) {
            materials.push({
                name: 'Plumbing Fixtures',
                quantity: results.detectSymbols.plumbing.length,
                unit: 'EA'
            });
        }
        
        return materials;
    }

    // Display notes
    displayNotes(results) {
        const container = document.getElementById('notesList');
        if (!container) return;
        
        let html = '<div style="font-size: 0.9rem;">';
        
        if (results.extractText?.notes?.length > 0) {
            html += '<h4 style="margin: 0 0 1rem 0;">Drawing Notes</h4>';
            html += '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';
            
            results.extractText.notes.forEach((note, index) => {
                html += `
                    <div style="
                        padding: 0.75rem;
                        background: #fffbf0;
                        border: 1px solid #ffc107;
                        border-radius: 5px;
                    ">
                        <div style="font-weight: 600; margin-bottom: 0.25rem;">Note ${index + 1}</div>
                        <div style="font-size: 0.85rem; color: #666;">${note}</div>
                    </div>
                `;
            });
            
            html += '</div>';
        } else {
            html += '<p style="color: #999;">No notes found</p>';
        }
        
        html += '</div>';
        container.innerHTML = html;
    }

    // Show analysis progress
    showAnalysisProgress() {
        const panel = document.getElementById('analysisProgressPanel');
        if (panel) {
            panel.style.display = 'block';
        }
    }

    // Update analysis progress
    updateAnalysisProgress(stage, percent) {
        const stageElement = document.getElementById('analysisStage');
        const progressBar = document.getElementById('analysisProgressBar');
        
        if (stageElement) {
            stageElement.textContent = stage;
        }
        
        if (progressBar) {
            progressBar.style.width = percent + '%';
        }
    }

    // Hide analysis progress
    hideAnalysisProgress() {
        const panel = document.getElementById('analysisProgressPanel');
        if (panel) {
            panel.style.display = 'none';
        }
    }

    // Update cursor position
    updateCursorPosition(event) {
        const posElement = document.getElementById('cursorPosition');
        if (posElement) {
            const rect = event.target.getBoundingClientRect();
            const x = Math.round(event.clientX - rect.left);
            const y = Math.round(event.clientY - rect.top);
            posElement.textContent = `X: ${x}, Y: ${y}`;
        }
    }

    // Update drawing info
    updateDrawingInfo() {
        const infoElement = document.getElementById('drawingInfo');
        if (infoElement && this.currentDrawing) {
            const filename = this.currentDrawing.url.split('/').pop().split('?')[0];
            infoElement.textContent = `Loaded: ${filename}`;
        }
    }

    // Update scale info
    updateScaleInfo() {
        const scaleElement = document.getElementById('scaleInfo');
        if (scaleElement) {
            if (this.measurementTools.calibrated) {
                scaleElement.textContent = `Scale: ${this.measurementTools.scale} ${this.measurementTools.unit}/px`;
            } else {
                scaleElement.textContent = `Zoom: ${(this.viewer.scale * 100).toFixed(0)}%`;
            }
        }
    }

    // Setup event handlers
    setupEventHandlers() {
        // Client selector
        const clientSelect = document.getElementById('takeoffClientSelect');
        if (clientSelect) {
            // Populate from main client list
            if (window.availableClients) {
                window.availableClients.forEach(client => {
                    const option = document.createElement('option');
                    option.value = client.id;
                    option.textContent = client.name;
                    clientSelect.appendChild(option);
                });
            }
            
            clientSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.loadClientDrawings(e.target.value);
                }
            });
        }

        // Drawing selector
        const drawingSelect = document.getElementById('drawingSelect');
        if (drawingSelect) {
            drawingSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.loadDrawing(e.target.value);
                }
            });
        }

        // View controls
        document.getElementById('zoomInBtn')?.addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOutBtn')?.addEventListener('click', () => this.zoomOut());
        document.getElementById('fitBtn')?.addEventListener('click', () => this.fitToScreen());
        document.getElementById('panBtn')?.addEventListener('click', () => this.setTool('pan'));
        document.getElementById('measureBtn')?.addEventListener('click', () => this.setTool('measure'));
        document.getElementById('selectBtn')?.addEventListener('click', () => this.setTool('select'));

        // Analysis button
        document.getElementById('analyzeBtn')?.addEventListener('click', () => this.analyzeDrawing());

        // Quick analysis buttons
        document.querySelectorAll('.quick-analysis-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.dataset.type;
                this.quickAnalyze(type);
            });
        });

        // Tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Export buttons
        document.getElementById('exportExcelBtn')?.addEventListener('click', () => this.exportToExcel());
        document.getElementById('exportPdfBtn')?.addEventListener('click', () => this.exportToPdf());
        document.getElementById('sendToChatBtn')?.addEventListener('click', () => this.sendToChat());
    }

    // Zoom in
    zoomIn() {
        this.viewer.scale *= 1.2;
        this.viewer.scale = Math.min(4, this.viewer.scale);
        this.updateTransform();
    }

    // Zoom out
    zoomOut() {
        this.viewer.scale *= 0.8;
        this.viewer.scale = Math.max(0.25, this.viewer.scale);
        this.updateTransform();
    }

    // Fit to screen
    fitToScreen() {
        this.viewer.scale = 1;
        this.viewer.translateX = 0;
        this.viewer.translateY = 0;
        this.updateTransform();
    }

    // Update transform
    updateTransform() {
        if (this.viewer.canvas) {
            this.viewer.canvas.style.transform = 
                `translate(-50%, -50%) translate(${this.viewer.translateX}px, ${this.viewer.translateY}px) scale(${this.viewer.scale})`;
        }
        this.updateScaleInfo();
    }

    // Set tool
    setTool(tool) {
        this.currentTool = tool;
        
        // Update button states
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        if (tool === 'pan') {
            document.getElementById('panBtn')?.classList.add('active');
            this.viewer.container.style.cursor = 'grab';
        } else if (tool === 'measure') {
            document.getElementById('measureBtn')?.classList.add('active');
            this.viewer.container.style.cursor = 'crosshair';
        } else if (tool === 'select') {
            document.getElementById('selectBtn')?.classList.add('active');
            this.viewer.container.style.cursor = 'crosshair';
        }
    }

    // Quick analyze specific type
    async quickAnalyze(type) {
        // Run targeted analysis based on type
        this.showAnalysisProgress();
        
        try {
            let result;
            
            switch(type) {
                case 'dimensions':
                    this.updateAnalysisProgress('Extracting dimensions...', 50);
                    result = await this.extractDimensions();
                    break;
                case 'rooms':
                    this.updateAnalysisProgress('Identifying rooms...', 50);
                    result = await this.identifyRooms();
                    break;
                case 'doors':
                    this.updateAnalysisProgress('Finding doors...', 50);
                    result = await this.findOpenings();
                    break;
                case 'windows':
                    this.updateAnalysisProgress('Finding windows...', 50);
                    result = await this.findOpenings();
                    break;
                case 'text':
                    this.updateAnalysisProgress('Extracting text...', 50);
                    result = await this.extractText();
                    break;
                case 'symbols':
                    this.updateAnalysisProgress('Detecting symbols...', 50);
                    result = await this.detectSymbols();
                    break;
            }
            
            // Display focused results
            this.displayQuickAnalysisResults(type, result);
            
        } catch (error) {
            console.error('Quick analysis error:', error);
            alert('Error during analysis: ' + error.message);
        } finally {
            this.hideAnalysisProgress();
        }
    }

    // Display quick analysis results
    displayQuickAnalysisResults(type, result) {
        // Switch to appropriate tab and display results
        if (type === 'dimensions') {
            this.switchTab('measurements');
            this.displayMeasurements({ extractDimensions: result });
        } else {
            this.switchTab('extracted');
            // Display type-specific results
        }
    }

    // Switch tab
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });
        
        document.getElementById(tabName + 'Tab')?.style.display = 'block';
    }

    // Export to Excel
    exportToExcel() {
        if (!this.analysisResults) {
            alert('No analysis results to export');
            return;
        }
        
        // Create CSV content
        let csv = 'Digital Takeoff Analysis Report\n\n';
        
        // Add summary
        csv += 'Summary\n';
        csv += 'Drawing,Analysis Date,Doors,Windows,Rooms\n';
        csv += `"${this.currentDrawing?.url.split('/').pop() || 'Unknown'}",`;
        csv += `"${new Date().toLocaleString()}",`;
        csv += `${this.analysisResults.findOpenings?.doors?.length || 0},`;
        csv += `${this.analysisResults.findOpenings?.windows?.length || 0},`;
        csv += `${this.analysisResults.identifyRooms?.length || 0}\n\n`;
        
        // Add dimensions
        if (this.analysisResults.extractDimensions?.length > 0) {
            csv += 'Dimensions\n';
            csv += 'Text,Value1,Value2,Unit\n';
            this.analysisResults.extractDimensions.forEach(dim => {
                csv += `"${dim.original}",${dim.value1},${dim.value2 || ''},${dim.unit}\n`;
            });
            csv += '\n';
        }
        
        // Add rooms
        if (this.analysisResults.identifyRooms?.length > 0) {
            csv += 'Rooms\n';
            csv += 'Name,Type\n';
            this.analysisResults.identifyRooms.forEach(room => {
                csv += `"${room.name}",${room.type}\n`;
            });
            csv += '\n';
        }
        
        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `takeoff_analysis_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Export to PDF
    exportToPdf() {
        // This would use a library like jsPDF in production
        alert('PDF export coming soon - use Excel export for now');
    }

    // Send to chat
    sendToChat() {
        if (!this.analysisResults) {
            alert('No analysis results to send');
            return;
        }
        
        // Format results for chat
        let message = `📐 Digital Takeoff Analysis Results:\n\n`;
        
        if (this.analysisResults.identifyRooms?.length > 0) {
            message += `**Rooms Detected:** ${this.analysisResults.identifyRooms.length}\n`;
            message += this.analysisResults.identifyRooms.map(r => `• ${r.name}`).join('\n') + '\n\n';
        }
        
        if (this.analysisResults.findOpenings) {
            message += `**Openings:**\n`;
            message += `• Doors: ${this.analysisResults.findOpenings.doors?.length || 0}\n`;
            message += `• Windows: ${this.analysisResults.findOpenings.windows?.length || 0}\n\n`;
        }
        
        if (this.analysisResults.extractDimensions?.length > 0) {
            message += `**Key Dimensions:**\n`;
            this.analysisResults.extractDimensions.slice(0, 5).forEach(dim => {
                message += `• ${dim.original}\n`;
            });
        }
        
        // Send to chat
        if (window.chatInput) {
            window.chatInput.value = message;
            window.sendMessage();
        }
    }
}

// Export for use
window.AdvancedTakeoffSystem = AdvancedTakeoffSystem;

// Auto-initialize if config available
if (window.API_CONFIG) {
    window.takeoffSystem = new AdvancedTakeoffSystem(window.API_CONFIG);
    console.log('✅ Advanced Takeoff System initialized');
}

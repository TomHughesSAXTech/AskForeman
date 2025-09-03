// Enhanced Digital Takeoff Module with Advanced Drawing Analysis
// Integrates highlight detection, automatic measurements, and client-specific indexing

class EnhancedTakeoffModule {
    constructor() {
        this.currentClient = null;
        this.currentDrawings = [];
        this.analyzedData = [];
        this.measurementTools = {};
        this.highlightAnalyzer = null;
        this.initialized = false;
        
        // Configuration
        this.config = {
            visionEndpoint: 'https://askforeman-vision.cognitiveservices.azure.com/',
            visionKey: '3afa37e3f6ec4cf891e0f5f6e5cf896c',
            uploadWebhook: 'https://workflows.saxtechnology.com/webhook/ask-foreman/upload',
            searchWebhook: 'https://workflows.saxtechnology.com/webhook/ask-foreman/search'
        };

        // Drawing types and their characteristics
        this.drawingTypes = {
            floor_plan: {
                name: 'Floor Plan',
                defaultScale: '1/4" = 1\'',
                units: 'feet',
                categories: ['rooms', 'doors', 'windows', 'walls', 'dimensions']
            },
            elevation: {
                name: 'Elevation',
                defaultScale: '1/4" = 1\'',
                units: 'feet',
                categories: ['heights', 'materials', 'finishes', 'openings']
            },
            section: {
                name: 'Section',
                defaultScale: '1/2" = 1\'',
                units: 'feet',
                categories: ['structure', 'layers', 'heights', 'materials']
            },
            detail: {
                name: 'Detail',
                defaultScale: '1" = 1\'',
                units: 'inches',
                categories: ['connections', 'materials', 'dimensions', 'notes']
            },
            site_plan: {
                name: 'Site Plan',
                defaultScale: '1" = 20\'',
                units: 'feet',
                categories: ['property', 'utilities', 'landscaping', 'parking']
            }
        };

        this.initialize();
    }

    // Initialize the module
    async initialize() {
        console.log('Initializing Enhanced Takeoff Module...');
        
        // Initialize highlight analyzer
        this.highlightAnalyzer = new DrawingHighlightAnalyzer(this.config);
        
        // Load saved client data
        await this.loadSavedData();
        
        // Set up UI
        this.setupUI();
        
        // Initialize measurement tools
        this.initializeMeasurementTools();
        
        this.initialized = true;
        console.log('Enhanced Takeoff Module initialized');
    }

    // Set up the user interface
    setupUI() {
        // Create main container
        const container = document.createElement('div');
        container.id = 'enhanced-takeoff-container';
        container.className = 'takeoff-module';
        container.innerHTML = `
            <div class="takeoff-header">
                <h2>Enhanced Digital Takeoff System</h2>
                <div class="client-selector">
                    <label>Client:</label>
                    <select id="client-select">
                        <option value="">Select Client...</option>
                    </select>
                    <button id="new-client-btn" class="btn btn-secondary">New Client</button>
                </div>
            </div>
            
            <div class="takeoff-tabs">
                <button class="tab-btn active" data-tab="upload">Upload & Analyze</button>
                <button class="tab-btn" data-tab="viewer">Drawing Viewer</button>
                <button class="tab-btn" data-tab="measurements">Measurements</button>
                <button class="tab-btn" data-tab="highlights">Highlights Analysis</button>
                <button class="tab-btn" data-tab="export">Export & Reports</button>
            </div>
            
            <div class="tab-content">
                <div id="upload-tab" class="tab-pane active">
                    ${this.createUploadUI()}
                </div>
                <div id="viewer-tab" class="tab-pane">
                    ${this.createViewerUI()}
                </div>
                <div id="measurements-tab" class="tab-pane">
                    ${this.createMeasurementsUI()}
                </div>
                <div id="highlights-tab" class="tab-pane">
                    ${this.createHighlightsUI()}
                </div>
                <div id="export-tab" class="tab-pane">
                    ${this.createExportUI()}
                </div>
            </div>
            
            <div class="takeoff-status">
                <div id="status-message"></div>
                <div id="progress-bar" class="progress hidden">
                    <div class="progress-bar"></div>
                </div>
            </div>
        `;

        // Add to page
        const targetElement = document.getElementById('estimator-content') || document.body;
        targetElement.appendChild(container);

        // Set up event handlers
        this.setupEventHandlers();
        
        // Load client list
        this.loadClientList();
    }

    // Create upload UI
    createUploadUI() {
        return `
            <div class="upload-section">
                <h3>Upload Construction Drawings</h3>
                <div class="upload-area" id="drawing-upload-area">
                    <svg class="upload-icon" width="64" height="64" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    <p>Drag & drop drawings here or click to browse</p>
                    <input type="file" id="drawing-file-input" multiple accept="image/*,.pdf" hidden>
                </div>
                
                <div class="drawing-info">
                    <h4>Drawing Information</h4>
                    <div class="form-group">
                        <label>Drawing Type:</label>
                        <select id="drawing-type">
                            <option value="floor_plan">Floor Plan</option>
                            <option value="elevation">Elevation</option>
                            <option value="section">Section</option>
                            <option value="detail">Detail</option>
                            <option value="site_plan">Site Plan</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Building/Area:</label>
                        <input type="text" id="building-name" placeholder="e.g., Building A, First Floor">
                    </div>
                    <div class="form-group">
                        <label>Scale:</label>
                        <input type="text" id="drawing-scale" placeholder="e.g., 1/4&quot; = 1'">
                    </div>
                    <div class="form-group">
                        <label>Auto-Detect Features:</label>
                        <div class="checkbox-group">
                            <label><input type="checkbox" id="detect-highlights" checked> Colored Highlights</label>
                            <label><input type="checkbox" id="detect-dimensions" checked> Dimensions</label>
                            <label><input type="checkbox" id="detect-rooms" checked> Room Names</label>
                            <label><input type="checkbox" id="detect-notes" checked> Notes & Annotations</label>
                        </div>
                    </div>
                    <button id="analyze-drawing-btn" class="btn btn-primary" disabled>Analyze Drawing</button>
                </div>
                
                <div id="upload-results" class="results-section hidden">
                    <h4>Analysis Results</h4>
                    <div id="analysis-summary"></div>
                </div>
            </div>
        `;
    }

    // Create viewer UI
    createViewerUI() {
        return `
            <div class="viewer-section">
                <div class="viewer-toolbar">
                    <button class="tool-btn" data-tool="pan"><i class="icon-pan"></i> Pan</button>
                    <button class="tool-btn" data-tool="zoom"><i class="icon-zoom"></i> Zoom</button>
                    <button class="tool-btn" data-tool="measure"><i class="icon-measure"></i> Measure</button>
                    <button class="tool-btn" data-tool="area"><i class="icon-area"></i> Area</button>
                    <button class="tool-btn" data-tool="count"><i class="icon-count"></i> Count</button>
                    <button class="tool-btn" data-tool="annotate"><i class="icon-note"></i> Annotate</button>
                    <div class="zoom-controls">
                        <button id="zoom-in">+</button>
                        <input type="range" id="zoom-slider" min="10" max="500" value="100">
                        <button id="zoom-out">-</button>
                        <span id="zoom-level">100%</span>
                    </div>
                </div>
                
                <div class="viewer-container">
                    <div class="drawing-list">
                        <h4>Drawings</h4>
                        <div id="drawing-tree"></div>
                    </div>
                    <div class="drawing-canvas-container">
                        <canvas id="drawing-canvas"></canvas>
                        <div id="drawing-overlay"></div>
                    </div>
                    <div class="drawing-properties">
                        <h4>Properties</h4>
                        <div id="property-panel"></div>
                    </div>
                </div>
            </div>
        `;
    }

    // Create measurements UI
    createMeasurementsUI() {
        return `
            <div class="measurements-section">
                <h3>Measurements & Takeoff</h3>
                <div class="measurement-tools">
                    <div class="tool-group">
                        <h4>Linear Measurements</h4>
                        <button class="measure-btn" data-type="linear">Measure Distance</button>
                        <button class="measure-btn" data-type="perimeter">Measure Perimeter</button>
                    </div>
                    <div class="tool-group">
                        <h4>Area Measurements</h4>
                        <button class="measure-btn" data-type="rectangle">Rectangle Area</button>
                        <button class="measure-btn" data-type="polygon">Polygon Area</button>
                        <button class="measure-btn" data-type="circle">Circle Area</button>
                    </div>
                    <div class="tool-group">
                        <h4>Count Tools</h4>
                        <button class="measure-btn" data-type="count-items">Count Items</button>
                        <button class="measure-btn" data-type="count-symbols">Count Symbols</button>
                    </div>
                </div>
                
                <div class="measurement-list">
                    <h4>Recorded Measurements</h4>
                    <table id="measurement-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Value</th>
                                <th>Unit</th>
                                <th>Location</th>
                                <th>Notes</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
                
                <div class="measurement-summary">
                    <h4>Summary</h4>
                    <div id="measurement-totals"></div>
                </div>
            </div>
        `;
    }

    // Create highlights UI
    createHighlightsUI() {
        return `
            <div class="highlights-section">
                <h3>Highlights & Markups Analysis</h3>
                
                <div class="highlight-filters">
                    <h4>Filter by Color</h4>
                    <div class="color-filters">
                        <label><input type="checkbox" data-color="red" checked> Red Markups</label>
                        <label><input type="checkbox" data-color="yellow" checked> Yellow Highlights</label>
                        <label><input type="checkbox" data-color="purple" checked> Purple Highlights</label>
                        <label><input type="checkbox" data-color="blue" checked> Blue Markups</label>
                        <label><input type="checkbox" data-color="green" checked> Green Highlights</label>
                        <label><input type="checkbox" data-color="orange" checked> Orange Markups</label>
                    </div>
                </div>
                
                <div class="highlight-results">
                    <h4>Detected Highlights</h4>
                    <div id="highlight-grid" class="highlight-grid"></div>
                </div>
                
                <div class="highlight-details">
                    <h4>Highlight Details</h4>
                    <div id="highlight-detail-panel"></div>
                </div>
                
                <div class="highlight-actions">
                    <button id="export-highlights" class="btn btn-secondary">Export Highlight Report</button>
                    <button id="index-highlights" class="btn btn-primary">Index to Client Database</button>
                </div>
            </div>
        `;
    }

    // Create export UI
    createExportUI() {
        return `
            <div class="export-section">
                <h3>Export & Reports</h3>
                
                <div class="export-options">
                    <h4>Export Format</h4>
                    <div class="format-options">
                        <label><input type="radio" name="export-format" value="excel" checked> Excel Spreadsheet</label>
                        <label><input type="radio" name="export-format" value="pdf"> PDF Report</label>
                        <label><input type="radio" name="export-format" value="csv"> CSV File</label>
                        <label><input type="radio" name="export-format" value="json"> JSON Data</label>
                    </div>
                </div>
                
                <div class="report-options">
                    <h4>Include in Report</h4>
                    <div class="checkbox-group">
                        <label><input type="checkbox" name="report-content" value="measurements" checked> Measurements</label>
                        <label><input type="checkbox" name="report-content" value="highlights" checked> Highlights Analysis</label>
                        <label><input type="checkbox" name="report-content" value="annotations" checked> Annotations</label>
                        <label><input type="checkbox" name="report-content" value="quantities" checked> Quantity Takeoff</label>
                        <label><input type="checkbox" name="report-content" value="images" checked> Drawing Images</label>
                        <label><input type="checkbox" name="report-content" value="summary" checked> Executive Summary</label>
                    </div>
                </div>
                
                <div class="export-preview">
                    <h4>Report Preview</h4>
                    <div id="report-preview"></div>
                </div>
                
                <div class="export-actions">
                    <button id="generate-report" class="btn btn-primary">Generate Report</button>
                    <button id="send-report" class="btn btn-secondary">Email Report</button>
                </div>
            </div>
        `;
    }

    // Set up event handlers
    setupEventHandlers() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Client selection
        const clientSelect = document.getElementById('client-select');
        if (clientSelect) {
            clientSelect.addEventListener('change', (e) => {
                this.selectClient(e.target.value);
            });
        }

        // Drawing upload
        const uploadArea = document.getElementById('drawing-upload-area');
        const fileInput = document.getElementById('drawing-file-input');
        
        if (uploadArea && fileInput) {
            uploadArea.addEventListener('click', () => fileInput.click());
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                this.handleFiles(e.dataTransfer.files);
            });
            fileInput.addEventListener('change', (e) => {
                this.handleFiles(e.target.files);
            });
        }

        // Analyze button
        const analyzeBtn = document.getElementById('analyze-drawing-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => {
                this.analyzeCurrentDrawing();
            });
        }

        // Measurement tools
        document.querySelectorAll('.measure-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.activateMeasurementTool(e.target.dataset.type);
            });
        });

        // Export actions
        const generateReportBtn = document.getElementById('generate-report');
        if (generateReportBtn) {
            generateReportBtn.addEventListener('click', () => {
                this.generateReport();
            });
        }

        // Index highlights
        const indexBtn = document.getElementById('index-highlights');
        if (indexBtn) {
            indexBtn.addEventListener('click', () => {
                this.indexHighlights();
            });
        }

        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectTool(e.currentTarget.dataset.tool);
            });
        });

        // Zoom controls
        this.setupZoomControls();
    }

    // Set up zoom controls
    setupZoomControls() {
        const zoomSlider = document.getElementById('zoom-slider');
        const zoomIn = document.getElementById('zoom-in');
        const zoomOut = document.getElementById('zoom-out');
        const zoomLevel = document.getElementById('zoom-level');

        if (zoomSlider) {
            zoomSlider.addEventListener('input', (e) => {
                const zoom = e.target.value;
                this.setZoom(zoom);
                if (zoomLevel) zoomLevel.textContent = zoom + '%';
            });
        }

        if (zoomIn) {
            zoomIn.addEventListener('click', () => {
                const currentZoom = parseInt(zoomSlider.value);
                const newZoom = Math.min(500, currentZoom + 10);
                zoomSlider.value = newZoom;
                this.setZoom(newZoom);
                if (zoomLevel) zoomLevel.textContent = newZoom + '%';
            });
        }

        if (zoomOut) {
            zoomOut.addEventListener('click', () => {
                const currentZoom = parseInt(zoomSlider.value);
                const newZoom = Math.max(10, currentZoom - 10);
                zoomSlider.value = newZoom;
                this.setZoom(newZoom);
                if (zoomLevel) zoomLevel.textContent = newZoom + '%';
            });
        }
    }

    // Switch tabs
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabName}-tab`);
        });

        // Trigger tab-specific actions
        if (tabName === 'viewer' && this.currentDrawings.length > 0) {
            this.refreshCanvas();
        }
    }

    // Load client list
    async loadClientList() {
        try {
            // Get clients from local storage or API
            const clients = await this.getClients();
            
            const select = document.getElementById('client-select');
            if (select) {
                select.innerHTML = '<option value="">Select Client...</option>';
                clients.forEach(client => {
                    const option = document.createElement('option');
                    option.value = client.id;
                    option.textContent = client.name;
                    select.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading clients:', error);
        }
    }

    // Get clients
    async getClients() {
        // Try to get from local storage first
        const savedClients = localStorage.getItem('takeoff_clients');
        if (savedClients) {
            return JSON.parse(savedClients);
        }

        // Otherwise return default list
        return [
            { id: 'client_001', name: 'ABC Construction' },
            { id: 'client_002', name: 'XYZ Builders' },
            { id: 'client_003', name: 'Demo Company' }
        ];
    }

    // Select client
    async selectClient(clientId) {
        if (!clientId) {
            this.currentClient = null;
            return;
        }

        this.currentClient = clientId;
        console.log(`Selected client: ${clientId}`);
        
        // Load client's drawings
        await this.loadClientDrawings(clientId);
        
        // Update UI
        this.updateClientUI();
    }

    // Load client drawings
    async loadClientDrawings(clientId) {
        try {
            // Get from local storage or API
            const savedDrawings = localStorage.getItem(`drawings_${clientId}`);
            if (savedDrawings) {
                this.currentDrawings = JSON.parse(savedDrawings);
                this.updateDrawingList();
            }
        } catch (error) {
            console.error('Error loading client drawings:', error);
        }
    }

    // Update client UI
    updateClientUI() {
        // Update various UI elements based on selected client
        if (this.currentClient) {
            this.showStatus(`Client selected: ${this.currentClient}`);
            document.getElementById('analyze-drawing-btn').disabled = false;
        }
    }

    // Handle file uploads
    async handleFiles(files) {
        if (!this.currentClient) {
            alert('Please select a client first');
            return;
        }

        const fileArray = Array.from(files);
        
        for (const file of fileArray) {
            await this.processDrawingFile(file);
        }
    }

    // Process drawing file
    async processDrawingFile(file) {
        console.log(`Processing file: ${file.name}`);
        
        // Show progress
        this.showProgress(0, `Processing ${file.name}...`);

        try {
            // Convert to base64 for processing
            const base64 = await this.fileToBase64(file);
            
            // Create drawing object
            const drawing = {
                id: `drawing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                uploadDate: new Date().toISOString(),
                clientId: this.currentClient,
                base64: base64,
                type: document.getElementById('drawing-type')?.value || 'floor_plan',
                building: document.getElementById('building-name')?.value || '',
                scale: document.getElementById('drawing-scale')?.value || '',
                analyzed: false
            };

            // Add to current drawings
            this.currentDrawings.push(drawing);
            
            // Save to storage
            this.saveDrawings();
            
            // Update UI
            this.updateDrawingList();
            
            // Enable analyze button
            document.getElementById('analyze-drawing-btn').disabled = false;
            
            this.showStatus(`Drawing uploaded: ${file.name}`);
            this.hideProgress();
            
        } catch (error) {
            console.error('Error processing file:', error);
            this.showError(`Failed to process ${file.name}`);
            this.hideProgress();
        }
    }

    // File to base64
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Analyze current drawing
    async analyzeCurrentDrawing() {
        if (this.currentDrawings.length === 0) {
            alert('Please upload a drawing first');
            return;
        }

        const drawing = this.currentDrawings[this.currentDrawings.length - 1];
        
        if (drawing.analyzed) {
            console.log('Drawing already analyzed');
            return;
        }

        this.showProgress(0, 'Starting analysis...');

        try {
            // Upload to blob storage and get URL
            const imageUrl = await this.uploadToStorage(drawing);
            
            // Analyze with highlight analyzer
            this.showProgress(30, 'Detecting highlights and markups...');
            const highlightAnalysis = await this.highlightAnalyzer.analyzeDrawingHighlights(imageUrl);
            
            // Perform additional analysis
            this.showProgress(60, 'Extracting measurements and text...');
            const additionalAnalysis = await this.performAdditionalAnalysis(imageUrl, drawing);
            
            // Combine results
            const analysisResult = {
                ...highlightAnalysis,
                ...additionalAnalysis,
                drawingId: drawing.id,
                drawingType: drawing.type,
                clientId: this.currentClient
            };

            // Store results
            drawing.analysis = analysisResult;
            drawing.analyzed = true;
            
            // Save to storage
            this.saveDrawings();
            
            // Upload to client index
            if (document.getElementById('detect-highlights')?.checked) {
                this.showProgress(80, 'Indexing to client database...');
                await this.highlightAnalyzer.uploadToClientIndex(
                    analysisResult,
                    this.currentClient,
                    {
                        id: drawing.id,
                        fileName: drawing.fileName,
                        type: drawing.type,
                        url: imageUrl
                    }
                );
            }

            // Display results
            this.displayAnalysisResults(analysisResult);
            
            this.showProgress(100, 'Analysis complete!');
            setTimeout(() => this.hideProgress(), 2000);
            
        } catch (error) {
            console.error('Error analyzing drawing:', error);
            this.showError('Failed to analyze drawing');
            this.hideProgress();
        }
    }

    // Upload to storage (mock implementation)
    async uploadToStorage(drawing) {
        // In production, this would upload to Azure Blob Storage
        // For now, return the base64 as data URL
        return drawing.base64;
    }

    // Perform additional analysis
    async performAdditionalAnalysis(imageUrl, drawing) {
        const analysis = {
            dimensions: [],
            rooms: [],
            quantities: [],
            notes: []
        };

        // Extract based on selected options
        if (document.getElementById('detect-dimensions')?.checked) {
            analysis.dimensions = await this.extractDimensions(imageUrl);
        }

        if (document.getElementById('detect-rooms')?.checked) {
            analysis.rooms = await this.extractRoomNames(imageUrl);
        }

        if (document.getElementById('detect-notes')?.checked) {
            analysis.notes = await this.extractNotes(imageUrl);
        }

        return analysis;
    }

    // Extract dimensions (simplified)
    async extractDimensions(imageUrl) {
        // This would use OCR to find dimension patterns
        return [
            { text: "20'-0\"", location: { x: 100, y: 200 } },
            { text: "15'-6\"", location: { x: 300, y: 200 } }
        ];
    }

    // Extract room names (simplified)
    async extractRoomNames(imageUrl) {
        // This would use OCR to find room labels
        return [
            { name: "OFFICE", area: "150 SF", location: { x: 150, y: 250 } },
            { name: "CONFERENCE", area: "300 SF", location: { x: 400, y: 300 } }
        ];
    }

    // Extract notes (simplified)
    async extractNotes(imageUrl) {
        // This would use OCR to find note text
        return [
            { text: "VERIFY FIELD DIMENSIONS", type: "important" },
            { text: "SEE STRUCTURAL DRAWINGS", type: "reference" }
        ];
    }

    // Display analysis results
    displayAnalysisResults(results) {
        const container = document.getElementById('analysis-summary');
        if (!container) return;

        const summary = results.summary;
        
        container.innerHTML = `
            <div class="analysis-results">
                <div class="result-section">
                    <h5>Highlights Detected</h5>
                    <ul>
                        ${Object.entries(summary.colors).map(([color, data]) => 
                            `<li>${color}: ${data.count} regions (${data.totalArea} pixels)</li>`
                        ).join('')}
                    </ul>
                </div>
                <div class="result-section">
                    <h5>Annotations Found</h5>
                    <p>${summary.totalAnnotations} text annotations detected</p>
                </div>
                <div class="result-section">
                    <h5>Primary Purpose</h5>
                    <p>${summary.primaryPurpose}</p>
                </div>
            </div>
        `;

        document.getElementById('upload-results').classList.remove('hidden');
        
        // Also update highlights tab
        this.updateHighlightsDisplay(results.highlights);
    }

    // Update highlights display
    updateHighlightsDisplay(highlights) {
        const grid = document.getElementById('highlight-grid');
        if (!grid) return;

        grid.innerHTML = highlights.map(highlight => `
            <div class="highlight-card" data-id="${highlight.id}">
                <div class="highlight-color" style="background-color: ${this.getColorHex(highlight.color)}"></div>
                <div class="highlight-info">
                    <strong>${highlight.color}</strong>
                    <p>${highlight.meaning}</p>
                    <p>Area: ${highlight.area.percentage.toFixed(1)}%</p>
                    <p>${highlight.text.length} annotations</p>
                </div>
            </div>
        `).join('');

        // Add click handlers
        grid.querySelectorAll('.highlight-card').forEach(card => {
            card.addEventListener('click', () => {
                this.showHighlightDetails(card.dataset.id);
            });
        });
    }

    // Get color hex value
    getColorHex(colorName) {
        const colors = {
            'Red Markup': '#FF0000',
            'Yellow Highlight': '#FFFF00',
            'Purple/Magenta Highlight': '#FF00FF',
            'Blue Markup': '#0000FF',
            'Green Highlight': '#00FF00',
            'Orange Markup': '#FFA500'
        };
        return colors[colorName] || '#999999';
    }

    // Show highlight details
    showHighlightDetails(highlightId) {
        const drawing = this.currentDrawings.find(d => d.analyzed);
        if (!drawing) return;

        const highlight = drawing.analysis.highlights.find(h => h.id === highlightId);
        if (!highlight) return;

        const panel = document.getElementById('highlight-detail-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="highlight-detail">
                <h5>${highlight.color}</h5>
                <p><strong>Purpose:</strong> ${highlight.purpose?.specific || 'Unknown'}</p>
                <p><strong>Action:</strong> ${highlight.purpose?.action || 'Review'}</p>
                <p><strong>Area:</strong> ${highlight.area.pixels} pixels (${highlight.area.percentage.toFixed(1)}%)</p>
                
                <h6>Associated Text:</h6>
                <ul>
                    ${highlight.text.map(t => 
                        `<li>${t.content} (${t.category})</li>`
                    ).join('')}
                </ul>
                
                ${highlight.dimensions.length > 0 ? `
                    <h6>Dimensions:</h6>
                    <ul>
                        ${highlight.dimensions.map(d => 
                            `<li>${d.text}</li>`
                        ).join('')}
                    </ul>
                ` : ''}
                
                ${highlight.quantities.length > 0 ? `
                    <h6>Quantities:</h6>
                    <ul>
                        ${highlight.quantities.map(q => 
                            `<li>${q.value} ${q.unit}</li>`
                        ).join('')}
                    </ul>
                ` : ''}
            </div>
        `;
    }

    // Initialize measurement tools
    initializeMeasurementTools() {
        this.measurementTools = {
            linear: new LinearMeasurementTool(this),
            perimeter: new PerimeterMeasurementTool(this),
            rectangle: new RectangleAreaTool(this),
            polygon: new PolygonAreaTool(this),
            circle: new CircleAreaTool(this),
            'count-items': new CountItemsTool(this),
            'count-symbols': new CountSymbolsTool(this)
        };
    }

    // Activate measurement tool
    activateMeasurementTool(toolType) {
        const tool = this.measurementTools[toolType];
        if (tool) {
            // Deactivate all other tools
            Object.values(this.measurementTools).forEach(t => t.deactivate());
            
            // Activate selected tool
            tool.activate();
            
            this.showStatus(`${toolType} tool activated`);
        }
    }

    // Select tool
    selectTool(toolName) {
        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === toolName);
        });

        // Handle tool logic
        console.log(`Selected tool: ${toolName}`);
    }

    // Set zoom level
    setZoom(zoomLevel) {
        const canvas = document.getElementById('drawing-canvas');
        if (canvas) {
            const scale = zoomLevel / 100;
            canvas.style.transform = `scale(${scale})`;
        }
    }

    // Refresh canvas
    refreshCanvas() {
        const canvas = document.getElementById('drawing-canvas');
        if (!canvas || this.currentDrawings.length === 0) return;

        const ctx = canvas.getContext('2d');
        const drawing = this.currentDrawings[this.currentDrawings.length - 1];

        // Load and draw image
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            // Draw highlights if analyzed
            if (drawing.analyzed && drawing.analysis.highlights) {
                this.drawHighlights(ctx, drawing.analysis.highlights);
            }
        };
        img.src = drawing.base64;
    }

    // Draw highlights on canvas
    drawHighlights(ctx, highlights) {
        ctx.save();
        
        highlights.forEach(highlight => {
            const color = this.getColorHex(highlight.color);
            ctx.strokeStyle = color;
            ctx.fillStyle = color + '33'; // Add transparency
            ctx.lineWidth = 2;
            
            const box = highlight.boundingBox;
            ctx.fillRect(box.x, box.y, box.width, box.height);
            ctx.strokeRect(box.x, box.y, box.width, box.height);
        });
        
        ctx.restore();
    }

    // Update drawing list
    updateDrawingList() {
        const tree = document.getElementById('drawing-tree');
        if (!tree) return;

        // Group drawings by building/area
        const grouped = {};
        this.currentDrawings.forEach(drawing => {
            const building = drawing.building || 'Uncategorized';
            if (!grouped[building]) {
                grouped[building] = [];
            }
            grouped[building].push(drawing);
        });

        tree.innerHTML = Object.entries(grouped).map(([building, drawings]) => `
            <div class="drawing-group">
                <h5>${building}</h5>
                <ul>
                    ${drawings.map(d => `
                        <li class="drawing-item ${d.analyzed ? 'analyzed' : ''}" data-id="${d.id}">
                            ${d.fileName}
                            ${d.analyzed ? '<span class="badge">✓</span>' : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `).join('');

        // Add click handlers
        tree.querySelectorAll('.drawing-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectDrawing(item.dataset.id);
            });
        });
    }

    // Select drawing
    selectDrawing(drawingId) {
        const drawing = this.currentDrawings.find(d => d.id === drawingId);
        if (drawing) {
            // Update current drawing
            this.currentDrawing = drawing;
            
            // Refresh canvas
            this.refreshCanvas();
            
            // Update property panel
            this.updatePropertyPanel(drawing);
        }
    }

    // Update property panel
    updatePropertyPanel(drawing) {
        const panel = document.getElementById('property-panel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="property-list">
                <div class="property-item">
                    <label>File Name:</label>
                    <span>${drawing.fileName}</span>
                </div>
                <div class="property-item">
                    <label>Type:</label>
                    <span>${drawing.type}</span>
                </div>
                <div class="property-item">
                    <label>Building:</label>
                    <span>${drawing.building || 'N/A'}</span>
                </div>
                <div class="property-item">
                    <label>Scale:</label>
                    <span>${drawing.scale || 'N/A'}</span>
                </div>
                <div class="property-item">
                    <label>Upload Date:</label>
                    <span>${new Date(drawing.uploadDate).toLocaleDateString()}</span>
                </div>
                <div class="property-item">
                    <label>Status:</label>
                    <span>${drawing.analyzed ? 'Analyzed' : 'Not Analyzed'}</span>
                </div>
            </div>
        `;
    }

    // Generate report
    async generateReport() {
        this.showProgress(0, 'Generating report...');

        try {
            const format = document.querySelector('input[name="export-format"]:checked')?.value || 'excel';
            const includeOptions = Array.from(document.querySelectorAll('input[name="report-content"]:checked'))
                .map(cb => cb.value);

            const reportData = this.compileReportData(includeOptions);
            
            this.showProgress(50, 'Formatting report...');

            let report;
            switch (format) {
                case 'excel':
                    report = await this.generateExcelReport(reportData);
                    break;
                case 'pdf':
                    report = await this.generatePDFReport(reportData);
                    break;
                case 'csv':
                    report = this.generateCSVReport(reportData);
                    break;
                case 'json':
                    report = JSON.stringify(reportData, null, 2);
                    break;
            }

            this.showProgress(100, 'Report ready!');
            
            // Download report
            this.downloadReport(report, format);
            
            setTimeout(() => this.hideProgress(), 2000);

        } catch (error) {
            console.error('Error generating report:', error);
            this.showError('Failed to generate report');
            this.hideProgress();
        }
    }

    // Compile report data
    compileReportData(includeOptions) {
        const data = {
            client: this.currentClient,
            generatedAt: new Date().toISOString(),
            drawings: []
        };

        this.currentDrawings.forEach(drawing => {
            const drawingData = {
                fileName: drawing.fileName,
                type: drawing.type,
                building: drawing.building,
                scale: drawing.scale
            };

            if (drawing.analyzed) {
                if (includeOptions.includes('measurements')) {
                    drawingData.measurements = drawing.analysis.measurements || [];
                }
                if (includeOptions.includes('highlights')) {
                    drawingData.highlights = drawing.analysis.highlights || [];
                }
                if (includeOptions.includes('annotations')) {
                    drawingData.annotations = drawing.analysis.text || [];
                }
                if (includeOptions.includes('quantities')) {
                    drawingData.quantities = this.extractQuantities(drawing.analysis);
                }
            }

            data.drawings.push(drawingData);
        });

        if (includeOptions.includes('summary')) {
            data.summary = this.generateSummary(data);
        }

        return data;
    }

    // Extract quantities from analysis
    extractQuantities(analysis) {
        const quantities = [];
        
        if (analysis.measurements) {
            analysis.measurements.forEach(m => {
                m.quantities?.forEach(q => quantities.push(q));
            });
        }

        return quantities;
    }

    // Generate summary
    generateSummary(data) {
        return {
            totalDrawings: data.drawings.length,
            analyzedDrawings: data.drawings.filter(d => d.highlights).length,
            totalHighlights: data.drawings.reduce((sum, d) => 
                sum + (d.highlights?.length || 0), 0),
            totalAnnotations: data.drawings.reduce((sum, d) => 
                sum + (d.annotations?.length || 0), 0)
        };
    }

    // Generate Excel report (simplified)
    async generateExcelReport(data) {
        // In production, use a library like xlsx
        // For now, return CSV format
        return this.generateCSVReport(data);
    }

    // Generate PDF report (simplified)
    async generatePDFReport(data) {
        // In production, use a library like jsPDF
        // For now, return formatted text
        return JSON.stringify(data, null, 2);
    }

    // Generate CSV report
    generateCSVReport(data) {
        const rows = [];
        rows.push(['Enhanced Takeoff Report']);
        rows.push(['Client:', data.client]);
        rows.push(['Generated:', new Date(data.generatedAt).toLocaleString()]);
        rows.push([]);
        
        data.drawings.forEach(drawing => {
            rows.push(['Drawing:', drawing.fileName]);
            rows.push(['Type:', drawing.type]);
            
            if (drawing.highlights) {
                rows.push(['Highlights:']);
                drawing.highlights.forEach(h => {
                    rows.push(['', h.color, h.meaning, `${h.area.percentage}%`]);
                });
            }
            
            rows.push([]);
        });

        return rows.map(row => row.join(',')).join('\n');
    }

    // Download report
    downloadReport(content, format) {
        const mimeTypes = {
            excel: 'application/vnd.ms-excel',
            csv: 'text/csv',
            pdf: 'application/pdf',
            json: 'application/json'
        };

        const extensions = {
            excel: 'csv', // Using CSV for now
            csv: 'csv',
            pdf: 'txt', // Using text for now
            json: 'json'
        };

        const blob = new Blob([content], { type: mimeTypes[format] });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `takeoff_report_${Date.now()}.${extensions[format]}`;
        link.click();
        URL.revokeObjectURL(url);
    }

    // Index highlights to client database
    async indexHighlights() {
        const drawing = this.currentDrawings.find(d => d.analyzed);
        if (!drawing) {
            alert('No analyzed drawings to index');
            return;
        }

        this.showProgress(0, 'Indexing highlights...');

        try {
            await this.highlightAnalyzer.uploadToClientIndex(
                drawing.analysis,
                this.currentClient,
                {
                    id: drawing.id,
                    fileName: drawing.fileName,
                    type: drawing.type,
                    url: drawing.base64
                }
            );

            this.showProgress(100, 'Highlights indexed successfully!');
            setTimeout(() => this.hideProgress(), 2000);

        } catch (error) {
            console.error('Error indexing highlights:', error);
            this.showError('Failed to index highlights');
            this.hideProgress();
        }
    }

    // Save drawings to storage
    saveDrawings() {
        if (this.currentClient) {
            localStorage.setItem(`drawings_${this.currentClient}`, 
                JSON.stringify(this.currentDrawings));
        }
    }

    // Load saved data
    async loadSavedData() {
        // Load any saved state
        const savedState = localStorage.getItem('takeoff_state');
        if (savedState) {
            const state = JSON.parse(savedState);
            this.currentClient = state.currentClient;
            this.currentDrawings = state.drawings || [];
        }
    }

    // Show status message
    showStatus(message) {
        const statusEl = document.getElementById('status-message');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = 'status-success';
        }
    }

    // Show error message
    showError(message) {
        const statusEl = document.getElementById('status-message');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = 'status-error';
        }
    }

    // Show progress
    showProgress(percent, message) {
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) {
            progressBar.classList.remove('hidden');
            const bar = progressBar.querySelector('.progress-bar');
            if (bar) {
                bar.style.width = `${percent}%`;
            }
        }
        if (message) {
            this.showStatus(message);
        }
    }

    // Hide progress
    hideProgress() {
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) {
            progressBar.classList.add('hidden');
        }
    }
}

// Measurement tool base class
class MeasurementTool {
    constructor(takeoffModule) {
        this.module = takeoffModule;
        this.active = false;
        this.measurements = [];
    }

    activate() {
        this.active = true;
        this.setupEventListeners();
    }

    deactivate() {
        this.active = false;
        this.removeEventListeners();
    }

    setupEventListeners() {
        // Override in subclasses
    }

    removeEventListeners() {
        // Override in subclasses
    }

    addMeasurement(measurement) {
        this.measurements.push(measurement);
        this.updateMeasurementTable(measurement);
    }

    updateMeasurementTable(measurement) {
        const tbody = document.querySelector('#measurement-table tbody');
        if (tbody) {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${measurement.type}</td>
                <td>${measurement.value}</td>
                <td>${measurement.unit}</td>
                <td>${measurement.location || 'N/A'}</td>
                <td>${measurement.notes || ''}</td>
                <td>
                    <button class="btn-small" onclick="this.parentElement.parentElement.remove()">Delete</button>
                </td>
            `;
        }
    }
}

// Linear measurement tool
class LinearMeasurementTool extends MeasurementTool {
    constructor(takeoffModule) {
        super(takeoffModule);
        this.startPoint = null;
        this.endPoint = null;
    }

    setupEventListeners() {
        const canvas = document.getElementById('drawing-canvas');
        if (canvas) {
            canvas.addEventListener('click', this.handleClick.bind(this));
        }
    }

    handleClick(event) {
        if (!this.startPoint) {
            this.startPoint = { x: event.offsetX, y: event.offsetY };
        } else {
            this.endPoint = { x: event.offsetX, y: event.offsetY };
            this.calculateDistance();
            this.startPoint = null;
            this.endPoint = null;
        }
    }

    calculateDistance() {
        const dx = this.endPoint.x - this.startPoint.x;
        const dy = this.endPoint.y - this.startPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Convert pixels to real units based on scale
        const realDistance = this.convertToRealUnits(distance);
        
        this.addMeasurement({
            type: 'Linear',
            value: realDistance.toFixed(2),
            unit: 'feet',
            location: `(${this.startPoint.x},${this.startPoint.y}) to (${this.endPoint.x},${this.endPoint.y})`
        });
    }

    convertToRealUnits(pixels) {
        // Simplified conversion - would use actual scale in production
        return pixels / 10; // Assume 10 pixels = 1 foot
    }
}

// Additional tool classes would be implemented similarly...
class PerimeterMeasurementTool extends MeasurementTool {}
class RectangleAreaTool extends MeasurementTool {}
class PolygonAreaTool extends MeasurementTool {}
class CircleAreaTool extends MeasurementTool {}
class CountItemsTool extends MeasurementTool {}
class CountSymbolsTool extends MeasurementTool {}

// Initialize module when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.enhancedTakeoffModule = new EnhancedTakeoffModule();
    });
} else {
    window.enhancedTakeoffModule = new EnhancedTakeoffModule();
}

// Export for use
window.EnhancedTakeoffModule = EnhancedTakeoffModule;

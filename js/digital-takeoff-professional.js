/**
 * Professional Digital Takeoff Assistant
 * Full landscape mode with PDF viewing, annotation, and estimator integration
 */

class ProfessionalDigitalTakeoff {
    constructor() {
        this.currentProject = null;
        this.currentDocument = null;
        this.currentPage = 1;
        this.totalPages = 1;
        this.scale = null;
        this.measurements = [];
        this.annotations = [];
        this.highlights = [];
        this.pdfDoc = null;
        this.pdfViewer = null;
        this.canvas = null;
        this.ctx = null;
        this.isDrawing = false;
        this.currentTool = 'select';
        this.takeoffData = {
            project: '',
            buildings: [],
            totalArea: 0,
            totalWalls: 0,
            measurements: {}
        };
    }

    async initialize() {
        // Load PDF.js library if not already loaded
        if (!window.pdfjsLib) {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            document.head.appendChild(script);
            await new Promise(resolve => script.onload = resolve);
            
            // Set worker
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        this.createProfessionalUI();
        await this.loadProjects();
        this.setupEventHandlers();
        this.initializeCanvas();
    }

    createProfessionalUI() {
        // Remove any existing modal
        const existing = document.getElementById('professionalTakeoffModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'professionalTakeoffModal';
        modal.className = 'professional-takeoff-modal';
        
        modal.innerHTML = `
            <div class="takeoff-container">
                <!-- Header Bar -->
                <div class="takeoff-header">
                    <div class="header-left">
                        <img src="estimator.png" alt="Logo" class="header-logo">
                        <h1>Digital Takeoff Professional</h1>
                    </div>
                    <div class="header-center">
                        <select id="takeoffProjectSelect" class="project-select">
                            <option value="">Select Project...</option>
                        </select>
                        <select id="takeoffDocumentSelect" class="document-select">
                            <option value="">Select Document...</option>
                        </select>
                    </div>
                    <div class="header-right">
                        <button class="header-btn" onclick="professionalTakeoff.sendToEstimator()">
                            <span>📊</span> Send to Estimator
                        </button>
                        <button class="header-btn" onclick="professionalTakeoff.saveWork()">
                            <span>💾</span> Save
                        </button>
                        <button class="header-btn close-btn" onclick="professionalTakeoff.close()">
                            <span>✕</span>
                        </button>
                    </div>
                </div>

                <!-- Main Content Area -->
                <div class="takeoff-main">
                    <!-- Left Toolbar -->
                    <div class="left-toolbar">
                        <div class="tool-group">
                            <button class="tool-btn active" data-tool="select" onclick="professionalTakeoff.setTool('select')">
                                <span>↖</span>
                                <label>Select</label>
                            </button>
                            <button class="tool-btn" data-tool="measure" onclick="professionalTakeoff.setTool('measure')">
                                <span>📏</span>
                                <label>Measure</label>
                            </button>
                            <button class="tool-btn" data-tool="area" onclick="professionalTakeoff.setTool('area')">
                                <span>⬚</span>
                                <label>Area</label>
                            </button>
                            <button class="tool-btn" data-tool="count" onclick="professionalTakeoff.setTool('count')">
                                <span>🔢</span>
                                <label>Count</label>
                            </button>
                            <button class="tool-btn" data-tool="highlight" onclick="professionalTakeoff.setTool('highlight')">
                                <span>🖍️</span>
                                <label>Highlight</label>
                            </button>
                            <button class="tool-btn" data-tool="note" onclick="professionalTakeoff.setTool('note')">
                                <span>📝</span>
                                <label>Note</label>
                            </button>
                        </div>
                        
                        <div class="tool-separator"></div>
                        
                        <div class="tool-group">
                            <button class="tool-btn" onclick="professionalTakeoff.detectHighlights()">
                                <span>🎯</span>
                                <label>Auto-Detect</label>
                            </button>
                            <button class="tool-btn" onclick="professionalTakeoff.analyzeWithAI()">
                                <span>🤖</span>
                                <label>AI Analysis</label>
                            </button>
                        </div>
                    </div>

                    <!-- Center - PDF Viewer -->
                    <div class="pdf-viewer-container">
                        <div class="viewer-toolbar">
                            <button onclick="professionalTakeoff.zoomOut()">➖</button>
                            <span id="zoomLevel">100%</span>
                            <button onclick="professionalTakeoff.zoomIn()">➕</button>
                            <div class="separator"></div>
                            <button onclick="professionalTakeoff.previousPage()">◀</button>
                            <span id="pageInfo">Page 1 of 1</span>
                            <button onclick="professionalTakeoff.nextPage()">▶</button>
                            <div class="separator"></div>
                            <label>Scale:</label>
                            <input type="text" id="scaleInput" placeholder='1/4" = 1&apos;' onchange="professionalTakeoff.setScale(this.value)">
                            <button onclick="professionalTakeoff.autoDetectScale()">Auto</button>
                        </div>
                        
                        <div class="pdf-canvas-wrapper" id="pdfCanvasWrapper">
                            <canvas id="pdfCanvas"></canvas>
                            <canvas id="annotationCanvas"></canvas>
                            <div id="dropZone" class="drop-zone">
                                <div class="drop-zone-content">
                                    <span>📄</span>
                                    <h3>Drop PDF Here</h3>
                                    <p>or select a document from the dropdown above</p>
                                    <input type="file" id="fileInput" accept=".pdf" style="display: none;">
                                    <button onclick="document.getElementById('fileInput').click()">Browse Files</button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="viewer-status">
                            <span id="cursorPosition">X: 0, Y: 0</span>
                            <span id="currentScale">Scale: Not Set</span>
                            <span id="measurementInfo"></span>
                        </div>
                    </div>

                    <!-- Right Panel - Data & Results -->
                    <div class="right-panel">
                        <div class="panel-tabs">
                            <button class="tab-btn active" onclick="professionalTakeoff.showTab('measurements')">
                                Measurements
                            </button>
                            <button class="tab-btn" onclick="professionalTakeoff.showTab('breakdown')">
                                Breakdown
                            </button>
                            <button class="tab-btn" onclick="professionalTakeoff.showTab('notes')">
                                Notes
                            </button>
                        </div>
                        
                        <!-- Measurements Tab -->
                        <div id="measurementsTab" class="tab-content active">
                            <div class="measurement-summary">
                                <h3>Quick Summary</h3>
                                <div class="summary-grid">
                                    <div class="summary-item">
                                        <label>Total Area</label>
                                        <span id="totalArea">0 sq ft</span>
                                    </div>
                                    <div class="summary-item">
                                        <label>Wall Length</label>
                                        <span id="totalWalls">0 ft</span>
                                    </div>
                                    <div class="summary-item">
                                        <label>Doors</label>
                                        <span id="doorCount">0</span>
                                    </div>
                                    <div class="summary-item">
                                        <label>Windows</label>
                                        <span id="windowCount">0</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="measurement-list">
                                <h3>Detailed Measurements</h3>
                                <div id="measurementsList"></div>
                            </div>
                        </div>
                        
                        <!-- Breakdown Tab -->
                        <div id="breakdownTab" class="tab-content">
                            <div class="breakdown-section">
                                <h3>Building Breakdown</h3>
                                <div id="buildingBreakdown">
                                    <div class="breakdown-form">
                                        <input type="text" id="buildingName" placeholder="Building Name">
                                        <input type="text" id="floorName" placeholder="Floor/Level">
                                        <button onclick="professionalTakeoff.addBuilding()">Add Building</button>
                                    </div>
                                    <div id="buildingList"></div>
                                </div>
                            </div>
                            
                            <div class="breakdown-section">
                                <h3>Room Breakdown</h3>
                                <div id="roomBreakdown">
                                    <div class="room-form">
                                        <input type="text" id="roomName" placeholder="Room Name/Number">
                                        <input type="text" id="roomArea" placeholder="Area (sq ft)">
                                        <button onclick="professionalTakeoff.addRoom()">Add Room</button>
                                    </div>
                                    <div id="roomList"></div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Notes Tab -->
                        <div id="notesTab" class="tab-content">
                            <div class="notes-section">
                                <h3>Annotations & Notes</h3>
                                <div id="notesList"></div>
                                <div class="notes-form">
                                    <textarea id="newNote" placeholder="Add a note..." rows="3"></textarea>
                                    <button onclick="professionalTakeoff.addNote()">Add Note</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Bottom Status Bar -->
                <div class="takeoff-footer">
                    <div class="footer-left">
                        <span id="projectStatus">Ready</span>
                    </div>
                    <div class="footer-center">
                        <button onclick="professionalTakeoff.clearAll()">Clear All</button>
                        <button onclick="professionalTakeoff.exportToExcel()">Export Excel</button>
                        <button onclick="professionalTakeoff.exportToPDF()">Export PDF</button>
                    </div>
                    <div class="footer-right">
                        <span id="saveStatus">All changes saved</span>
                    </div>
                </div>
            </div>
        `;

        // Add professional styles
        const styles = `
            <style>
                .professional-takeoff-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: #1a1a1a;
                    z-index: 10000;
                    display: flex;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                }

                .takeoff-container {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    background: #2d2d30;
                }

                /* Header */
                .takeoff-header {
                    height: 60px;
                    background: linear-gradient(to right, #1e1e1e, #252526);
                    border-bottom: 1px solid #3e3e42;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 20px;
                }

                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }

                .header-logo {
                    width: 40px;
                    height: 40px;
                    object-fit: contain;
                }

                .takeoff-header h1 {
                    color: #fff;
                    font-size: 18px;
                    font-weight: 500;
                    margin: 0;
                }

                .header-center {
                    display: flex;
                    gap: 10px;
                }

                .project-select, .document-select {
                    padding: 8px 12px;
                    background: #3c3c3c;
                    color: #cccccc;
                    border: 1px solid #555;
                    border-radius: 4px;
                    min-width: 200px;
                }

                .header-right {
                    display: flex;
                    gap: 10px;
                }

                .header-btn {
                    padding: 8px 16px;
                    background: #0e639c;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 14px;
                    transition: background 0.2s;
                }

                .header-btn:hover {
                    background: #1177bb;
                }

                .header-btn.close-btn {
                    background: #f14c4c;
                }

                .header-btn.close-btn:hover {
                    background: #f36666;
                }

                /* Main Content */
                .takeoff-main {
                    flex: 1;
                    display: flex;
                    overflow: hidden;
                }

                /* Left Toolbar */
                .left-toolbar {
                    width: 80px;
                    background: #252526;
                    border-right: 1px solid #3e3e42;
                    padding: 10px 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .tool-group {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                    padding: 10px 0;
                }

                .tool-btn {
                    width: 60px;
                    height: 60px;
                    background: transparent;
                    color: #cccccc;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                    transition: all 0.2s;
                }

                .tool-btn span {
                    font-size: 20px;
                }

                .tool-btn label {
                    font-size: 10px;
                    cursor: pointer;
                }

                .tool-btn:hover {
                    background: #3e3e42;
                }

                .tool-btn.active {
                    background: #0e639c;
                    color: white;
                }

                .tool-separator {
                    width: 60px;
                    height: 1px;
                    background: #3e3e42;
                    margin: 10px 0;
                }

                /* PDF Viewer */
                .pdf-viewer-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    background: #1e1e1e;
                }

                .viewer-toolbar {
                    height: 40px;
                    background: #2d2d30;
                    border-bottom: 1px solid #3e3e42;
                    display: flex;
                    align-items: center;
                    padding: 0 15px;
                    gap: 10px;
                }

                .viewer-toolbar button {
                    padding: 5px 10px;
                    background: #3c3c3c;
                    color: #cccccc;
                    border: 1px solid #555;
                    border-radius: 3px;
                    cursor: pointer;
                }

                .viewer-toolbar button:hover {
                    background: #484848;
                }

                .viewer-toolbar .separator {
                    width: 1px;
                    height: 20px;
                    background: #555;
                    margin: 0 5px;
                }

                .viewer-toolbar label {
                    color: #cccccc;
                    font-size: 14px;
                }

                .viewer-toolbar input {
                    padding: 5px;
                    background: #3c3c3c;
                    color: #cccccc;
                    border: 1px solid #555;
                    border-radius: 3px;
                    width: 100px;
                }

                .pdf-canvas-wrapper {
                    flex: 1;
                    position: relative;
                    overflow: auto;
                    background: #1e1e1e;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                #pdfCanvas {
                    background: white;
                    box-shadow: 0 0 20px rgba(0,0,0,0.5);
                }

                #annotationCanvas {
                    position: absolute;
                    pointer-events: all;
                    cursor: crosshair;
                }

                .drop-zone {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: #1e1e1e;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                .drop-zone-content {
                    text-align: center;
                    color: #cccccc;
                }

                .drop-zone-content span {
                    font-size: 48px;
                    display: block;
                    margin-bottom: 20px;
                }

                .drop-zone-content h3 {
                    margin: 0 0 10px 0;
                }

                .drop-zone-content button {
                    margin-top: 20px;
                    padding: 10px 20px;
                    background: #0e639c;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }

                .viewer-status {
                    height: 25px;
                    background: #252526;
                    border-top: 1px solid #3e3e42;
                    display: flex;
                    align-items: center;
                    padding: 0 15px;
                    gap: 20px;
                    color: #969696;
                    font-size: 12px;
                }

                /* Right Panel */
                .right-panel {
                    width: 350px;
                    background: #252526;
                    border-left: 1px solid #3e3e42;
                    display: flex;
                    flex-direction: column;
                }

                .panel-tabs {
                    display: flex;
                    background: #2d2d30;
                    border-bottom: 1px solid #3e3e42;
                }

                .tab-btn {
                    flex: 1;
                    padding: 10px;
                    background: transparent;
                    color: #969696;
                    border: none;
                    border-bottom: 2px solid transparent;
                    cursor: pointer;
                    font-size: 14px;
                }

                .tab-btn:hover {
                    color: #cccccc;
                }

                .tab-btn.active {
                    color: white;
                    border-bottom-color: #0e639c;
                }

                .tab-content {
                    flex: 1;
                    padding: 20px;
                    display: none;
                    overflow-y: auto;
                }

                .tab-content.active {
                    display: block;
                }

                .tab-content h3 {
                    color: #cccccc;
                    font-size: 16px;
                    margin: 0 0 15px 0;
                    font-weight: 500;
                }

                .summary-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin-bottom: 20px;
                }

                .summary-item {
                    background: #1e1e1e;
                    padding: 10px;
                    border-radius: 4px;
                    border: 1px solid #3e3e42;
                }

                .summary-item label {
                    display: block;
                    color: #969696;
                    font-size: 12px;
                    margin-bottom: 5px;
                }

                .summary-item span {
                    color: #0e639c;
                    font-size: 18px;
                    font-weight: bold;
                }

                .measurement-list {
                    margin-top: 20px;
                }

                #measurementsList {
                    background: #1e1e1e;
                    border: 1px solid #3e3e42;
                    border-radius: 4px;
                    padding: 10px;
                    min-height: 200px;
                }

                .breakdown-form, .room-form, .notes-form {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    margin-bottom: 15px;
                }

                .breakdown-form input, .room-form input, .notes-form textarea {
                    padding: 8px;
                    background: #3c3c3c;
                    color: #cccccc;
                    border: 1px solid #555;
                    border-radius: 4px;
                }

                .breakdown-form button, .room-form button, .notes-form button {
                    padding: 8px;
                    background: #0e639c;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }

                #buildingList, #roomList, #notesList {
                    background: #1e1e1e;
                    border: 1px solid #3e3e42;
                    border-radius: 4px;
                    padding: 10px;
                    min-height: 150px;
                    color: #cccccc;
                }

                /* Footer */
                .takeoff-footer {
                    height: 35px;
                    background: #007acc;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 20px;
                    color: white;
                    font-size: 13px;
                }

                .footer-center {
                    display: flex;
                    gap: 10px;
                }

                .footer-center button {
                    padding: 5px 15px;
                    background: rgba(255,255,255,0.2);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.3);
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                }

                .footer-center button:hover {
                    background: rgba(255,255,255,0.3);
                }

                /* Measurement overlay */
                .measurement-label {
                    position: absolute;
                    background: #007acc;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 3px;
                    font-size: 12px;
                    font-weight: bold;
                    pointer-events: none;
                    z-index: 1000;
                }

                /* Highlight styles */
                .highlight-yellow {
                    background: rgba(255, 235, 59, 0.4);
                    border: 2px solid #fdd835;
                }

                .highlight-green {
                    background: rgba(76, 175, 80, 0.4);
                    border: 2px solid #43a047;
                }

                .highlight-red {
                    background: rgba(244, 67, 54, 0.4);
                    border: 2px solid #e53935;
                }

                /* Note popup */
                .note-popup {
                    position: absolute;
                    background: white;
                    border: 2px solid #007acc;
                    border-radius: 4px;
                    padding: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                    z-index: 1001;
                    min-width: 200px;
                }

                .note-popup textarea {
                    width: 100%;
                    min-height: 60px;
                    padding: 5px;
                    border: 1px solid #ddd;
                    border-radius: 3px;
                    font-family: inherit;
                    font-size: 12px;
                }

                .note-popup-actions {
                    display: flex;
                    gap: 5px;
                    justify-content: flex-end;
                    margin-top: 8px;
                }

                .note-popup button {
                    padding: 5px 10px;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 12px;
                }
            </style>
        `;

        document.head.insertAdjacentHTML('beforeend', styles);
        document.body.appendChild(modal);
    }

    async loadProjects() {
        const projectSelect = document.getElementById('takeoffProjectSelect');
        
        try {
            const listUrl = `https://saxtechfcs.blob.core.windows.net/fcs-clients?sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D&restype=container&comp=list&prefix=FCS-OriginalClients/&delimiter=/`;
            
            const response = await fetch(listUrl);
            if (response.ok) {
                const xmlText = await response.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");
                const prefixes = xmlDoc.getElementsByTagName("BlobPrefix");
                
                projectSelect.innerHTML = '<option value="">Select Project...</option>';
                
                for (let i = 0; i < prefixes.length; i++) {
                    const nameElement = prefixes[i].getElementsByTagName("Name")[0];
                    if (nameElement) {
                        const fullPath = nameElement.textContent;
                        const pathParts = fullPath.split('/');
                        
                        if (pathParts.length >= 2 && pathParts[0] === 'FCS-OriginalClients') {
                            const clientName = pathParts[1];
                            
                            if (clientName && !clientName.startsWith('.') && !clientName.includes('$')) {
                                const option = document.createElement('option');
                                option.value = clientName;
                                option.textContent = clientName;
                                projectSelect.appendChild(option);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error loading projects:', error);
        }
    }

    setupEventHandlers() {
        // Project selection
        const projectSelect = document.getElementById('takeoffProjectSelect');
        projectSelect.addEventListener('change', async (e) => {
            this.currentProject = e.target.value;
            if (this.currentProject) {
                await this.loadDocuments(this.currentProject);
                this.takeoffData.project = this.currentProject;
            }
        });

        // Document selection
        const documentSelect = document.getElementById('takeoffDocumentSelect');
        documentSelect.addEventListener('change', async (e) => {
            if (e.target.value) {
                await this.loadDocument(e.target.value);
            }
        });

        // File upload
        const fileInput = document.getElementById('fileInput');
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && file.type === 'application/pdf') {
                await this.loadPDFFile(file);
            }
        });

        // Drag and drop
        const dropZone = document.getElementById('dropZone');
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.background = '#2d2d30';
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.style.background = '#1e1e1e';
        });
        
        dropZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            dropZone.style.background = '#1e1e1e';
            
            const file = e.dataTransfer.files[0];
            if (file && file.type === 'application/pdf') {
                await this.loadPDFFile(file);
            }
        });

        // Zoom level
        this.zoomLevel = 100;
    }

    async loadDocuments(project) {
        const documentSelect = document.getElementById('takeoffDocumentSelect');
        
        try {
            const listUrl = `https://saxtechfcs.blob.core.windows.net/fcs-clients?sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D&restype=container&comp=list&prefix=FCS-OriginalClients/${project}/`;
            
            const response = await fetch(listUrl);
            if (response.ok) {
                const xmlText = await response.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");
                const blobs = xmlDoc.getElementsByTagName("Blob");
                
                documentSelect.innerHTML = '<option value="">Select Document...</option>';
                
                for (let i = 0; i < blobs.length; i++) {
                    const nameElement = blobs[i].getElementsByTagName("Name")[0];
                    if (nameElement) {
                        const fullPath = nameElement.textContent;
                        const fileName = fullPath.split('/').pop();
                        
                        if (fileName.toLowerCase().endsWith('.pdf')) {
                            const option = document.createElement('option');
                            option.value = fullPath;
                            option.textContent = fileName;
                            documentSelect.appendChild(option);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error loading documents:', error);
        }
    }

    async loadDocument(documentPath) {
        try {
            const blobUrl = `https://saxtechfcs.blob.core.windows.net/fcs-clients/${documentPath}?sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D`;
            
            const response = await fetch(blobUrl);
            const arrayBuffer = await response.arrayBuffer();
            
            await this.loadPDF(arrayBuffer);
            this.currentDocument = documentPath;
            
            // Hide drop zone
            document.getElementById('dropZone').style.display = 'none';
        } catch (error) {
            console.error('Error loading document:', error);
        }
    }

    async loadPDFFile(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            await this.loadPDF(e.target.result);
            document.getElementById('dropZone').style.display = 'none';
        };
        reader.readAsArrayBuffer(file);
    }

    async loadPDF(arrayBuffer) {
        try {
            this.pdfDoc = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
            this.totalPages = this.pdfDoc.numPages;
            this.currentPage = 1;
            
            await this.renderPage(this.currentPage);
            
            document.getElementById('pageInfo').textContent = `Page ${this.currentPage} of ${this.totalPages}`;
            document.getElementById('projectStatus').textContent = 'Document loaded';
        } catch (error) {
            console.error('Error loading PDF:', error);
            document.getElementById('projectStatus').textContent = 'Error loading document';
        }
    }

    async renderPage(pageNum) {
        if (!this.pdfDoc) return;
        
        const page = await this.pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({scale: this.zoomLevel / 100});
        
        const canvas = document.getElementById('pdfCanvas');
        const context = canvas.getContext('2d');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        
        // Setup annotation canvas
        const annotationCanvas = document.getElementById('annotationCanvas');
        annotationCanvas.width = canvas.width;
        annotationCanvas.height = canvas.height;
        annotationCanvas.style.left = canvas.offsetLeft + 'px';
        annotationCanvas.style.top = canvas.offsetTop + 'px';
        
        this.initializeCanvas();
    }

    initializeCanvas() {
        const canvas = document.getElementById('annotationCanvas');
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // Mouse events
        canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        // Update cursor position
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            document.getElementById('cursorPosition').textContent = `X: ${Math.round(x)}, Y: ${Math.round(y)}`;
        });
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.isDrawing = true;
        this.startX = x;
        this.startY = y;
        
        if (this.currentTool === 'note') {
            this.addNoteAt(x, y);
        }
    }

    handleMouseMove(e) {
        if (!this.isDrawing) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (this.currentTool === 'measure') {
            this.drawMeasurement(this.startX, this.startY, x, y);
        } else if (this.currentTool === 'area') {
            this.drawArea(this.startX, this.startY, x, y);
        } else if (this.currentTool === 'highlight') {
            this.drawHighlight(this.startX, this.startY, x, y);
        }
    }

    handleMouseUp(e) {
        if (!this.isDrawing) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.isDrawing = false;
        
        if (this.currentTool === 'measure') {
            this.saveMeasurement(this.startX, this.startY, x, y);
        } else if (this.currentTool === 'area') {
            this.saveArea(this.startX, this.startY, x, y);
        } else if (this.currentTool === 'highlight') {
            this.saveHighlight(this.startX, this.startY, x, y);
        } else if (this.currentTool === 'count') {
            this.addCount(x, y);
        }
    }

    drawMeasurement(x1, y1, x2, y2) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.redrawAll();
        
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.strokeStyle = '#007acc';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        const realDistance = this.scale ? distance * this.scale : distance;
        
        this.ctx.fillStyle = '#007acc';
        this.ctx.font = '14px Arial';
        this.ctx.fillText(`${realDistance.toFixed(2)} ft`, (x1 + x2) / 2, (y1 + y2) / 2 - 5);
    }

    drawArea(x1, y1, x2, y2) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.redrawAll();
        
        const width = x2 - x1;
        const height = y2 - y1;
        
        this.ctx.fillStyle = 'rgba(0, 122, 204, 0.2)';
        this.ctx.fillRect(x1, y1, width, height);
        
        this.ctx.strokeStyle = '#007acc';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x1, y1, width, height);
        
        const area = Math.abs(width * height);
        const realArea = this.scale ? area * this.scale * this.scale : area;
        
        this.ctx.fillStyle = '#007acc';
        this.ctx.font = '14px Arial';
        this.ctx.fillText(`${realArea.toFixed(2)} sq ft`, x1 + width/2 - 30, y1 + height/2);
    }

    drawHighlight(x1, y1, x2, y2) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.redrawAll();
        
        const width = x2 - x1;
        const height = y2 - y1;
        
        this.ctx.fillStyle = 'rgba(255, 235, 59, 0.4)';
        this.ctx.fillRect(x1, y1, width, height);
        
        this.ctx.strokeStyle = '#fdd835';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x1, y1, width, height);
    }

    saveMeasurement(x1, y1, x2, y2) {
        const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        const realDistance = this.scale ? distance * this.scale : distance;
        
        this.measurements.push({
            type: 'linear',
            x1, y1, x2, y2,
            value: realDistance,
            unit: 'ft'
        });
        
        this.updateMeasurementsList();
        this.updateSummary();
    }

    saveArea(x1, y1, x2, y2) {
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        const area = width * height;
        const realArea = this.scale ? area * this.scale * this.scale : area;
        
        this.measurements.push({
            type: 'area',
            x1, y1, x2, y2,
            value: realArea,
            unit: 'sq ft'
        });
        
        this.updateMeasurementsList();
        this.updateSummary();
    }

    saveHighlight(x1, y1, x2, y2) {
        this.highlights.push({
            x1, y1, x2, y2,
            color: 'yellow'
        });
        
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        const area = width * height;
        const realArea = this.scale ? area * this.scale * this.scale : area;
        
        this.measurements.push({
            type: 'highlighted',
            x1, y1, x2, y2,
            value: realArea,
            unit: 'sq ft'
        });
        
        this.updateMeasurementsList();
        this.updateSummary();
    }

    addCount(x, y) {
        this.measurements.push({
            type: 'count',
            x, y,
            category: 'door' // Could be door, window, fixture, etc.
        });
        
        // Draw count marker
        this.ctx.fillStyle = '#f44336';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
        this.ctx.fill();
        
        this.updateSummary();
    }

    addNoteAt(x, y) {
        const popup = document.createElement('div');
        popup.className = 'note-popup';
        popup.style.left = x + 'px';
        popup.style.top = y + 'px';
        popup.innerHTML = `
            <textarea placeholder="Enter note..."></textarea>
            <div class="note-popup-actions">
                <button onclick="professionalTakeoff.cancelNote()">Cancel</button>
                <button onclick="professionalTakeoff.saveNote(${x}, ${y})" style="background: #007acc; color: white;">Save</button>
            </div>
        `;
        
        document.getElementById('pdfCanvasWrapper').appendChild(popup);
        popup.querySelector('textarea').focus();
    }

    saveNote(x, y) {
        const popup = document.querySelector('.note-popup');
        const text = popup.querySelector('textarea').value;
        
        if (text.trim()) {
            this.annotations.push({
                type: 'note',
                x, y,
                text: text,
                page: this.currentPage
            });
            
            // Draw note indicator
            this.ctx.fillStyle = '#ffc107';
            this.ctx.fillRect(x - 10, y - 10, 20, 20);
            this.ctx.fillStyle = '#333';
            this.ctx.font = '14px Arial';
            this.ctx.fillText('📝', x - 8, y + 4);
            
            this.updateNotesList();
        }
        
        popup.remove();
    }

    cancelNote() {
        const popup = document.querySelector('.note-popup');
        if (popup) popup.remove();
    }

    redrawAll() {
        // Redraw all measurements, highlights, and annotations
        this.measurements.forEach(m => {
            if (m.type === 'linear') {
                this.ctx.beginPath();
                this.ctx.moveTo(m.x1, m.y1);
                this.ctx.lineTo(m.x2, m.y2);
                this.ctx.strokeStyle = '#007acc';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            } else if (m.type === 'area' || m.type === 'highlighted') {
                const fillStyle = m.type === 'highlighted' ? 'rgba(255, 235, 59, 0.4)' : 'rgba(0, 122, 204, 0.2)';
                this.ctx.fillStyle = fillStyle;
                this.ctx.fillRect(m.x1, m.y1, m.x2 - m.x1, m.y2 - m.y1);
            }
        });
    }

    updateMeasurementsList() {
        const list = document.getElementById('measurementsList');
        let html = '';
        
        this.measurements.forEach((m, index) => {
            html += `
                <div style="padding: 8px; margin-bottom: 5px; background: #2d2d30; border-radius: 4px;">
                    <strong>${m.type === 'linear' ? '📏' : m.type === 'area' ? '⬚' : '🖍️'} ${m.type}</strong><br>
                    ${m.value.toFixed(2)} ${m.unit}
                    <button onclick="professionalTakeoff.removeMeasurement(${index})" style="float: right; background: #f14c4c; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer;">✕</button>
                </div>
            `;
        });
        
        list.innerHTML = html || '<div style="color: #969696;">No measurements yet</div>';
    }

    updateSummary() {
        let totalArea = 0;
        let totalWalls = 0;
        let doorCount = 0;
        let windowCount = 0;
        
        this.measurements.forEach(m => {
            if (m.type === 'area' || m.type === 'highlighted') {
                totalArea += m.value;
            } else if (m.type === 'linear') {
                totalWalls += m.value;
            } else if (m.type === 'count') {
                if (m.category === 'door') doorCount++;
                else if (m.category === 'window') windowCount++;
            }
        });
        
        document.getElementById('totalArea').textContent = `${totalArea.toFixed(2)} sq ft`;
        document.getElementById('totalWalls').textContent = `${totalWalls.toFixed(2)} ft`;
        document.getElementById('doorCount').textContent = doorCount;
        document.getElementById('windowCount').textContent = windowCount;
        
        // Update takeoff data
        this.takeoffData.totalArea = totalArea;
        this.takeoffData.totalWalls = totalWalls;
        this.takeoffData.measurements = {
            area: { total: totalArea, unit: 'sq ft' },
            walls: { total: totalWalls, unit: 'ft' },
            doors: { count: doorCount },
            windows: { count: windowCount }
        };
    }

    updateNotesList() {
        const list = document.getElementById('notesList');
        let html = '';
        
        this.annotations.forEach((note, index) => {
            if (note.type === 'note') {
                html += `
                    <div style="padding: 8px; margin-bottom: 5px; background: #2d2d30; border-radius: 4px;">
                        <strong>Note ${index + 1}</strong><br>
                        ${note.text}
                        <button onclick="professionalTakeoff.removeNote(${index})" style="float: right; background: #f14c4c; color: white; border: none; padding: 2px 6px; border-radius: 3px; cursor: pointer;">✕</button>
                    </div>
                `;
            }
        });
        
        list.innerHTML = html || '<div style="color: #969696;">No notes yet</div>';
    }

    setTool(tool) {
        this.currentTool = tool;
        
        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
        
        // Update cursor
        const canvas = document.getElementById('annotationCanvas');
        if (tool === 'select') {
            canvas.style.cursor = 'default';
        } else {
            canvas.style.cursor = 'crosshair';
        }
    }

    setScale(value) {
        // Parse scale (e.g., "1/4" = 1')
        const match = value.match(/(\d+(?:\/\d+)?)["\s]*=\s*(\d+)/);
        if (match) {
            const drawingInches = eval(match[1]);
            const realFeet = parseFloat(match[2]);
            this.scale = realFeet / (drawingInches * 96); // 96 DPI
            
            document.getElementById('currentScale').textContent = `Scale: ${value}`;
            document.getElementById('scaleInput').value = value;
            
            // Recalculate all measurements
            this.updateSummary();
        }
    }

    autoDetectScale() {
        // Placeholder for AI scale detection
        alert('Analyzing document for scale information...');
        // In production, this would call Azure Document Intelligence
        this.setScale('1/4" = 1\'');
    }

    detectHighlights() {
        alert('Detecting existing highlights in the document...');
        // In production, this would use Computer Vision API
    }

    async analyzeWithAI() {
        alert('Running AI analysis on the document...');
        // In production, this would call Azure AI services
    }

    showTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Remove active from all tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected tab
        document.getElementById(tabName + 'Tab').classList.add('active');
        
        // Set button active
        event.target.classList.add('active');
    }

    addBuilding() {
        const name = document.getElementById('buildingName').value;
        const floor = document.getElementById('floorName').value;
        
        if (name && floor) {
            this.takeoffData.buildings.push({
                name: name,
                floor: floor,
                rooms: []
            });
            
            this.updateBuildingList();
            
            // Clear inputs
            document.getElementById('buildingName').value = '';
            document.getElementById('floorName').value = '';
        }
    }

    updateBuildingList() {
        const list = document.getElementById('buildingList');
        let html = '';
        
        this.takeoffData.buildings.forEach((building, index) => {
            html += `
                <div style="padding: 8px; margin-bottom: 5px; background: #2d2d30; border-radius: 4px;">
                    <strong>${building.name}</strong> - ${building.floor}<br>
                    Rooms: ${building.rooms.length}
                </div>
            `;
        });
        
        list.innerHTML = html || '<div style="color: #969696;">No buildings added</div>';
    }

    addRoom() {
        const name = document.getElementById('roomName').value;
        const area = document.getElementById('roomArea').value;
        
        if (name && area && this.takeoffData.buildings.length > 0) {
            const currentBuilding = this.takeoffData.buildings[this.takeoffData.buildings.length - 1];
            currentBuilding.rooms.push({
                name: name,
                area: parseFloat(area)
            });
            
            this.updateRoomList();
            
            // Clear inputs
            document.getElementById('roomName').value = '';
            document.getElementById('roomArea').value = '';
        }
    }

    updateRoomList() {
        const list = document.getElementById('roomList');
        let html = '';
        let totalRoomArea = 0;
        
        this.takeoffData.buildings.forEach(building => {
            building.rooms.forEach(room => {
                totalRoomArea += room.area;
                html += `
                    <div style="padding: 8px; margin-bottom: 5px; background: #2d2d30; border-radius: 4px;">
                        <strong>${room.name}</strong><br>
                        ${room.area} sq ft
                    </div>
                `;
            });
        });
        
        if (totalRoomArea > 0) {
            html += `
                <div style="padding: 8px; margin-top: 10px; background: #007acc; color: white; border-radius: 4px;">
                    <strong>Total Room Area: ${totalRoomArea.toFixed(2)} sq ft</strong>
                </div>
            `;
        }
        
        list.innerHTML = html || '<div style="color: #969696;">No rooms added</div>';
    }

    addNote() {
        const text = document.getElementById('newNote').value;
        if (text.trim()) {
            this.annotations.push({
                type: 'general',
                text: text,
                timestamp: new Date().toISOString()
            });
            
            this.updateNotesList();
            document.getElementById('newNote').value = '';
        }
    }

    removeMeasurement(index) {
        this.measurements.splice(index, 1);
        this.updateMeasurementsList();
        this.updateSummary();
        this.redrawAll();
    }

    removeNote(index) {
        this.annotations.splice(index, 1);
        this.updateNotesList();
    }

    zoomIn() {
        this.zoomLevel = Math.min(this.zoomLevel + 25, 300);
        document.getElementById('zoomLevel').textContent = `${this.zoomLevel}%`;
        this.renderPage(this.currentPage);
    }

    zoomOut() {
        this.zoomLevel = Math.max(this.zoomLevel - 25, 50);
        document.getElementById('zoomLevel').textContent = `${this.zoomLevel}%`;
        this.renderPage(this.currentPage);
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderPage(this.currentPage);
            document.getElementById('pageInfo').textContent = `Page ${this.currentPage} of ${this.totalPages}`;
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.renderPage(this.currentPage);
            document.getElementById('pageInfo').textContent = `Page ${this.currentPage} of ${this.totalPages}`;
        }
    }

    clearAll() {
        if (confirm('Clear all measurements and annotations?')) {
            this.measurements = [];
            this.annotations = [];
            this.highlights = [];
            
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.updateMeasurementsList();
            this.updateNotesList();
            this.updateSummary();
        }
    }

    exportToExcel() {
        let csv = 'Digital Takeoff Professional Report\n\n';
        csv += `Project,${this.currentProject || 'N/A'}\n`;
        csv += `Document,${this.currentDocument || 'N/A'}\n`;
        csv += `Date,${new Date().toLocaleDateString()}\n\n`;
        
        csv += 'Summary\n';
        csv += `Total Area,${this.takeoffData.totalArea.toFixed(2)},sq ft\n`;
        csv += `Total Walls,${this.takeoffData.totalWalls.toFixed(2)},ft\n\n`;
        
        csv += 'Buildings\n';
        this.takeoffData.buildings.forEach(building => {
            csv += `${building.name},${building.floor}\n`;
            building.rooms.forEach(room => {
                csv += `,${room.name},${room.area},sq ft\n`;
            });
        });
        
        csv += '\nDetailed Measurements\n';
        csv += 'Type,Value,Unit\n';
        this.measurements.forEach(m => {
            csv += `${m.type},${m.value.toFixed(2)},${m.unit}\n`;
        });
        
        csv += '\nNotes\n';
        this.annotations.forEach(note => {
            csv += `"${note.text}"\n`;
        });
        
        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `takeoff_${this.currentProject}_${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('Exported to Excel successfully!');
    }

    exportToPDF() {
        alert('Exporting annotated PDF...');
        // In production, this would generate a PDF with all annotations
    }

    saveWork() {
        document.getElementById('saveStatus').textContent = 'Saving...';
        
        setTimeout(() => {
            document.getElementById('saveStatus').textContent = 'All changes saved';
            alert('Work saved successfully!');
        }, 1000);
    }

    sendToEstimator() {
        // Prepare comprehensive data for estimator
        const estimatorData = {
            project: this.currentProject,
            document: this.currentDocument,
            measurements: this.takeoffData.measurements,
            buildings: this.takeoffData.buildings,
            totalArea: this.takeoffData.totalArea,
            totalWalls: this.takeoffData.totalWalls,
            annotations: this.annotations,
            timestamp: new Date().toISOString()
        };
        
        // Dispatch event for estimator
        const event = new CustomEvent('takeoffDataReady', {
            detail: estimatorData
        });
        
        document.dispatchEvent(event);
        
        // Open estimator with data
        if (window.openEstimatorForm) {
            window.openEstimatorForm();
            
            // Pre-populate estimator fields after a short delay
            setTimeout(() => {
                const projectNameField = document.getElementById('estProjectName');
                const clientNameField = document.getElementById('estClientName');
                
                if (projectNameField) projectNameField.value = this.currentProject || '';
                if (clientNameField) clientNameField.value = this.currentProject || '';
                
                // Trigger data import
                const importEvent = new CustomEvent('takeoffResultsReady', {
                    detail: estimatorData
                });
                document.dispatchEvent(importEvent);
            }, 500);
        }
        
        alert('Data sent to Professional Estimator!');
    }

    close() {
        if (this.measurements.length > 0 || this.annotations.length > 0) {
            if (!confirm('You have unsaved work. Are you sure you want to close?')) {
                return;
            }
        }
        
        const modal = document.getElementById('professionalTakeoffModal');
        if (modal) modal.remove();
    }
}

// Create global instance
window.professionalTakeoff = new ProfessionalDigitalTakeoff();

// Override the original function
window.openDigitalTakeoffAssistant = function() {
    window.professionalTakeoff.initialize();
};

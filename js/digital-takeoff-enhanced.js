/**
 * Enhanced Digital Takeoff Assistant with Annotation and Editing
 * Allows adding notes, highlights, and saving modified blueprints back to Azure
 */

// Import existing configuration
import('./digital-takeoff-complete.js');

// Enhanced configuration with PDF editing capabilities
const ENHANCED_TAKEOFF_CONFIG = {
  ...window.AZURE_TAKEOFF_CONFIG,
  pdfLib: 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
  fabricJs: 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js'
};

/**
 * Enhanced Digital Takeoff class with annotation capabilities
 */
class EnhancedDigitalTakeoff {
  constructor() {
    this.currentDocument = null;
    this.currentProject = null;
    this.canvas = null;
    this.annotations = [];
    this.measurements = [];
    this.highlightedAreas = [];
    this.scale = null;
    this.pdfDoc = null;
    this.currentPage = 1;
    this.totalPages = 1;
    this.isModified = false;
    
    // Load required libraries
    this.loadLibraries();
  }
  
  /**
   * Load required JavaScript libraries
   */
  async loadLibraries() {
    // Load PDF-lib for PDF manipulation
    if (!window.PDFLib) {
      const script1 = document.createElement('script');
      script1.src = ENHANCED_TAKEOFF_CONFIG.pdfLib;
      document.head.appendChild(script1);
      await new Promise(resolve => script1.onload = resolve);
    }
    
    // Load Fabric.js for canvas annotation
    if (!window.fabric) {
      const script2 = document.createElement('script');
      script2.src = ENHANCED_TAKEOFF_CONFIG.fabricJs;
      document.head.appendChild(script2);
      await new Promise(resolve => script2.onload = resolve);
    }
  }
  
  /**
   * Initialize the enhanced modal with annotation tools
   */
  async initializeEnhanced() {
    // Create enhanced modal structure
    const modal = document.createElement('div');
    modal.id = 'enhancedTakeoffModal';
    modal.className = 'enhanced-takeoff-modal';
    modal.innerHTML = `
      <div class="enhanced-modal-content">
        <div class="enhanced-header">
          <h2><span class="icon">📐</span> Digital Takeoff Assistant - Enhanced</h2>
          <div class="header-actions">
            <button id="saveModifications" class="btn-save" onclick="enhancedTakeoff.saveModifications()" style="display: none;">
              💾 Save Changes
            </button>
            <button class="close-btn" onclick="enhancedTakeoff.close()">×</button>
          </div>
        </div>
        
        <div class="enhanced-body">
          <div class="main-workspace">
            <!-- Left Panel - Document Viewer -->
            <div class="document-panel">
              <div class="toolbar">
                <div class="tool-group">
                  <button onclick="enhancedTakeoff.setTool('select')" class="tool-btn active" data-tool="select">
                    <span>👆</span> Select
                  </button>
                  <button onclick="enhancedTakeoff.setTool('highlight')" class="tool-btn" data-tool="highlight">
                    <span>🖍️</span> Highlight
                  </button>
                  <button onclick="enhancedTakeoff.setTool('measure')" class="tool-btn" data-tool="measure">
                    <span>📏</span> Measure
                  </button>
                  <button onclick="enhancedTakeoff.setTool('note')" class="tool-btn" data-tool="note">
                    <span>📝</span> Note
                  </button>
                  <button onclick="enhancedTakeoff.setTool('area')" class="tool-btn" data-tool="area">
                    <span>⬜</span> Area
                  </button>
                </div>
                
                <div class="tool-group">
                  <label>Scale:</label>
                  <input type="text" id="scaleInput" placeholder='1/4" = 1&apos;' onchange="enhancedTakeoff.updateScale(this.value)">
                  <button onclick="enhancedTakeoff.detectScale()" class="btn-secondary">
                    🔍 Auto-Detect
                  </button>
                </div>
                
                <div class="tool-group">
                  <button onclick="enhancedTakeoff.previousPage()" id="prevPage" disabled>◀</button>
                  <span id="pageInfo">Page 1 of 1</span>
                  <button onclick="enhancedTakeoff.nextPage()" id="nextPage" disabled>▶</button>
                </div>
              </div>
              
              <div class="canvas-container" id="canvasContainer">
                <canvas id="blueprintCanvas"></canvas>
              </div>
              
              <div class="status-bar">
                <span id="cursorPosition">X: 0, Y: 0</span>
                <span id="currentScale">Scale: Not Set</span>
                <span id="selectionInfo"></span>
              </div>
            </div>
            
            <!-- Right Panel - Information & Results -->
            <div class="info-panel">
              <!-- Project & Document Selection -->
              <div class="panel-section">
                <h3>Project & Document</h3>
                <select id="projectSelect" class="form-control" onchange="enhancedTakeoff.loadProjectDocuments(this.value)">
                  <option value="">Select project...</option>
                </select>
                <select id="documentSelect" class="form-control" onchange="enhancedTakeoff.loadDocument(this.value)">
                  <option value="">Select document...</option>
                </select>
                <input type="file" id="uploadFile" accept=".pdf,.png,.jpg,.jpeg,.tiff" style="display: none;" onchange="enhancedTakeoff.uploadDocument(this.files)">
                <button onclick="document.getElementById('uploadFile').click()" class="btn btn-primary">
                  📤 Upload New
                </button>
              </div>
              
              <!-- Detected Areas -->
              <div class="panel-section">
                <h3>Detected Areas</h3>
                <div id="detectedAreas" class="area-list">
                  <p class="empty-state">No areas detected yet</p>
                </div>
              </div>
              
              <!-- Highlighted Regions -->
              <div class="panel-section">
                <h3>Highlighted Regions</h3>
                <div id="highlightedRegions" class="highlight-list">
                  <p class="empty-state">No highlights found</p>
                </div>
                <button onclick="enhancedTakeoff.analyzeHighlights()" class="btn btn-secondary">
                  🎨 Analyze Highlights
                </button>
              </div>
              
              <!-- Notes & Annotations -->
              <div class="panel-section">
                <h3>Notes & Annotations</h3>
                <div id="annotationsList" class="annotation-list">
                  <p class="empty-state">No annotations yet</p>
                </div>
              </div>
              
              <!-- Measurements -->
              <div class="panel-section">
                <h3>Measurements</h3>
                <div id="measurementResults" class="measurement-list">
                  <div class="measurement-item">
                    <label>Total Wall Length:</label>
                    <span id="totalWalls">0 ft</span>
                  </div>
                  <div class="measurement-item">
                    <label>Total Floor Area:</label>
                    <span id="totalFloorArea">0 sq ft</span>
                  </div>
                  <div class="measurement-item">
                    <label>Selected Area:</label>
                    <span id="selectedArea">0 sq ft</span>
                  </div>
                </div>
              </div>
              
              <!-- Actions -->
              <div class="panel-section">
                <h3>Actions</h3>
                <div class="action-buttons">
                  <button onclick="enhancedTakeoff.runAIAnalysis()" class="btn btn-success">
                    🤖 AI Analysis
                  </button>
                  <button onclick="enhancedTakeoff.exportResults()" class="btn btn-primary">
                    📊 Export to Excel
                  </button>
                  <button onclick="enhancedTakeoff.saveToAzure()" class="btn btn-secondary">
                    ☁️ Save to Cloud
                  </button>
                  <button onclick="enhancedTakeoff.addToEstimate()" class="btn btn-secondary">
                    ➕ Add to Estimate
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add enhanced styles
    const styles = `
      <style>
        .enhanced-takeoff-modal {
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
        }
        
        .enhanced-modal-content {
          background: white;
          width: 95%;
          max-width: 1600px;
          height: 95vh;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        
        .enhanced-header {
          padding: 1rem 1.5rem;
          background: linear-gradient(135deg, #2E86AB, #26C485);
          color: white;
          border-radius: 12px 12px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .header-actions {
          display: flex;
          gap: 1rem;
          align-items: center;
        }
        
        .btn-save {
          padding: 0.5rem 1rem;
          background: #F6AE2D;
          color: #2F2F2F;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s;
        }
        
        .btn-save:hover {
          background: #F4A000;
        }
        
        .enhanced-body {
          flex: 1;
          overflow: hidden;
        }
        
        .main-workspace {
          display: grid;
          grid-template-columns: 1fr 400px;
          height: 100%;
        }
        
        .document-panel {
          display: flex;
          flex-direction: column;
          border-right: 1px solid #ddd;
        }
        
        .toolbar {
          padding: 1rem;
          background: #f8f9fa;
          border-bottom: 1px solid #ddd;
          display: flex;
          gap: 2rem;
          align-items: center;
          flex-wrap: wrap;
        }
        
        .tool-group {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }
        
        .tool-btn {
          padding: 0.5rem 0.75rem;
          background: white;
          border: 2px solid #ddd;
          border-radius: 5px;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }
        
        .tool-btn:hover {
          border-color: #2E86AB;
          background: #f0f8ff;
        }
        
        .tool-btn.active {
          border-color: #2E86AB;
          background: #2E86AB;
          color: white;
        }
        
        .canvas-container {
          flex: 1;
          background: #f5f5f5;
          position: relative;
          overflow: auto;
        }
        
        #blueprintCanvas {
          background: white;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        
        .status-bar {
          padding: 0.5rem 1rem;
          background: #333;
          color: white;
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
        }
        
        .info-panel {
          padding: 1.5rem;
          overflow-y: auto;
          background: #f8f9fa;
        }
        
        .panel-section {
          margin-bottom: 1.5rem;
          padding: 1rem;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .panel-section h3 {
          margin: 0 0 1rem 0;
          color: #333;
          font-size: 1.1rem;
          border-bottom: 2px solid #2E86AB;
          padding-bottom: 0.5rem;
        }
        
        .form-control {
          width: 100%;
          padding: 0.5rem;
          margin-bottom: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        
        .area-list, .highlight-list, .annotation-list {
          max-height: 200px;
          overflow-y: auto;
          margin-bottom: 1rem;
        }
        
        .area-item, .highlight-item, .annotation-item {
          padding: 0.75rem;
          margin-bottom: 0.5rem;
          background: #f8f9fa;
          border-left: 3px solid #2E86AB;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.3s;
        }
        
        .area-item:hover, .highlight-item:hover, .annotation-item:hover {
          background: #e9ecef;
          transform: translateX(5px);
        }
        
        .area-item.selected, .highlight-item.selected {
          background: #cfe2ff;
          border-left-color: #0066cc;
        }
        
        .empty-state {
          color: #999;
          text-align: center;
          padding: 1rem;
          font-style: italic;
        }
        
        .measurement-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .measurement-item {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem;
          background: #f8f9fa;
          border-radius: 4px;
        }
        
        .measurement-item label {
          font-weight: 600;
          color: #666;
        }
        
        .measurement-item span {
          font-weight: bold;
          color: #2E86AB;
        }
        
        .action-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
        }
        
        .btn {
          padding: 0.75rem 1rem;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s;
          text-align: center;
        }
        
        .btn-primary {
          background: #2E86AB;
          color: white;
        }
        
        .btn-primary:hover {
          background: #236B8E;
        }
        
        .btn-success {
          background: #26C485;
          color: white;
          grid-column: span 2;
        }
        
        .btn-success:hover {
          background: #1FAA6F;
        }
        
        .btn-secondary {
          background: #6C757D;
          color: white;
        }
        
        .btn-secondary:hover {
          background: #5A6268;
        }
        
        /* Annotation styles */
        .annotation-popup {
          position: absolute;
          background: white;
          border: 2px solid #2E86AB;
          border-radius: 8px;
          padding: 1rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          z-index: 1000;
          min-width: 250px;
        }
        
        .annotation-popup textarea {
          width: 100%;
          min-height: 60px;
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          margin-bottom: 0.5rem;
        }
        
        .annotation-popup-actions {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
        }
        
        .annotation-popup button {
          padding: 0.25rem 0.75rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
        }
        
        /* Highlight colors */
        .highlight-yellow { background: rgba(255, 235, 59, 0.4); }
        .highlight-green { background: rgba(76, 175, 80, 0.4); }
        .highlight-red { background: rgba(244, 67, 54, 0.4); }
        .highlight-blue { background: rgba(33, 150, 243, 0.4); }
        
        /* Measurement overlay */
        .measurement-overlay {
          position: absolute;
          pointer-events: none;
          background: rgba(46, 134, 171, 0.1);
          border: 2px solid #2E86AB;
        }
        
        .measurement-label {
          position: absolute;
          background: #2E86AB;
          color: white;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.85rem;
          font-weight: bold;
          white-space: nowrap;
        }
      </style>
    `;
    
    // Add to DOM
    document.head.insertAdjacentHTML('beforeend', styles);
    document.body.appendChild(modal);
    
    // Initialize canvas
    await this.initializeCanvas();
    
    // Load projects
    await this.loadProjects();
    
    // Set up event handlers
    this.setupEventHandlers();
  }
  
  /**
   * Initialize Fabric.js canvas for annotations
   */
  async initializeCanvas() {
    const container = document.getElementById('canvasContainer');
    const canvas = document.createElement('canvas');
    canvas.id = 'blueprintCanvas';
    container.appendChild(canvas);
    
    // Initialize Fabric.js canvas
    this.canvas = new fabric.Canvas('blueprintCanvas', {
      selection: true,
      preserveObjectStacking: true
    });
    
    // Set initial size
    this.resizeCanvas();
    
    // Handle window resize
    window.addEventListener('resize', () => this.resizeCanvas());
  }
  
  /**
   * Resize canvas to fit container
   */
  resizeCanvas() {
    const container = document.getElementById('canvasContainer');
    if (this.canvas && container) {
      this.canvas.setWidth(container.offsetWidth);
      this.canvas.setHeight(container.offsetHeight);
      this.canvas.renderAll();
    }
  }
  
  /**
   * Load projects from Azure
   */
  async loadProjects() {
    const projectSelect = document.getElementById('projectSelect');
    
    try {
      const listUrl = `https://${ENHANCED_TAKEOFF_CONFIG.storage.account}.blob.core.windows.net/${ENHANCED_TAKEOFF_CONFIG.storage.container}?${ENHANCED_TAKEOFF_CONFIG.storage.sasToken}&restype=container&comp=list&prefix=FCS-OriginalClients/&delimiter=/`;
      
      const response = await fetch(listUrl);
      if (response.ok) {
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const prefixes = xmlDoc.getElementsByTagName("BlobPrefix");
        
        projectSelect.innerHTML = '<option value="">Select project...</option>';
        
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
  
  /**
   * Load documents for selected project
   */
  async loadProjectDocuments(project) {
    if (!project) return;
    
    this.currentProject = project;
    const documentSelect = document.getElementById('documentSelect');
    
    try {
      const listUrl = `https://${ENHANCED_TAKEOFF_CONFIG.storage.account}.blob.core.windows.net/${ENHANCED_TAKEOFF_CONFIG.storage.container}?${ENHANCED_TAKEOFF_CONFIG.storage.sasToken}&restype=container&comp=list&prefix=FCS-OriginalClients/${project}/`;
      
      const response = await fetch(listUrl);
      if (response.ok) {
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const blobs = xmlDoc.getElementsByTagName("Blob");
        
        documentSelect.innerHTML = '<option value="">Select document...</option>';
        
        for (let i = 0; i < blobs.length; i++) {
          const nameElement = blobs[i].getElementsByTagName("Name")[0];
          if (nameElement) {
            const fullPath = nameElement.textContent;
            const fileName = fullPath.split('/').pop();
            
            if (fileName.match(/\.(pdf|png|jpg|jpeg|tiff|tif)$/i)) {
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
  
  /**
   * Load and display document
   */
  async loadDocument(documentPath) {
    if (!documentPath) return;
    
    this.currentDocument = documentPath;
    const blobUrl = `https://${ENHANCED_TAKEOFF_CONFIG.storage.account}.blob.core.windows.net/${ENHANCED_TAKEOFF_CONFIG.storage.container}/${documentPath}?${ENHANCED_TAKEOFF_CONFIG.storage.sasToken}`;
    
    try {
      const response = await fetch(blobUrl);
      const arrayBuffer = await response.arrayBuffer();
      
      if (documentPath.endsWith('.pdf')) {
        await this.loadPDF(arrayBuffer);
      } else {
        await this.loadImage(blobUrl);
      }
      
      // Auto-detect scale
      await this.detectScale();
      
      // Analyze for existing highlights
      await this.analyzeHighlights();
      
    } catch (error) {
      console.error('Error loading document:', error);
    }
  }
  
  /**
   * Load PDF document
   */
  async loadPDF(arrayBuffer) {
    const { PDFDocument } = window.PDFLib;
    
    this.pdfDoc = await PDFDocument.load(arrayBuffer);
    this.totalPages = this.pdfDoc.getPageCount();
    this.currentPage = 1;
    
    // Update page info
    document.getElementById('pageInfo').textContent = `Page ${this.currentPage} of ${this.totalPages}`;
    document.getElementById('prevPage').disabled = this.currentPage === 1;
    document.getElementById('nextPage').disabled = this.currentPage === this.totalPages;
    
    // Render first page
    await this.renderPDFPage(this.currentPage);
  }
  
  /**
   * Render PDF page to canvas
   */
  async renderPDFPage(pageNumber) {
    const page = this.pdfDoc.getPage(pageNumber - 1);
    const { width, height } = page.getSize();
    
    // Create temporary canvas for PDF rendering
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext('2d');
    
    // For now, we'll create a placeholder
    // In production, you'd use pdf.js for actual rendering
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#ddd';
    ctx.strokeRect(10, 10, width - 20, height - 20);
    ctx.fillStyle = '#666';
    ctx.font = '24px Arial';
    ctx.fillText(`PDF Page ${pageNumber}`, width/2 - 80, height/2);
    
    // Convert to Fabric.js image
    const imgUrl = tempCanvas.toDataURL();
    fabric.Image.fromURL(imgUrl, (img) => {
      this.canvas.clear();
      this.canvas.setBackgroundImage(img, this.canvas.renderAll.bind(this.canvas), {
        scaleX: this.canvas.width / img.width,
        scaleY: this.canvas.height / img.height
      });
      
      // Restore annotations for this page
      this.restoreAnnotations(pageNumber);
    });
  }
  
  /**
   * Load image document
   */
  async loadImage(imageUrl) {
    fabric.Image.fromURL(imageUrl, (img) => {
      this.canvas.clear();
      
      // Scale image to fit canvas
      const scale = Math.min(
        this.canvas.width / img.width,
        this.canvas.height / img.height
      );
      
      this.canvas.setBackgroundImage(img, this.canvas.renderAll.bind(this.canvas), {
        scaleX: scale,
        scaleY: scale,
        left: (this.canvas.width - img.width * scale) / 2,
        top: (this.canvas.height - img.height * scale) / 2
      });
    });
  }
  
  /**
   * Set active tool
   */
  setTool(tool) {
    // Update UI
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    
    // Configure canvas based on tool
    switch(tool) {
      case 'select':
        this.canvas.isDrawingMode = false;
        this.canvas.selection = true;
        this.canvas.defaultCursor = 'default';
        break;
        
      case 'highlight':
        this.canvas.isDrawingMode = false;
        this.canvas.selection = false;
        this.canvas.defaultCursor = 'crosshair';
        this.startHighlightMode();
        break;
        
      case 'measure':
        this.canvas.isDrawingMode = false;
        this.canvas.selection = false;
        this.canvas.defaultCursor = 'crosshair';
        this.startMeasureMode();
        break;
        
      case 'note':
        this.canvas.isDrawingMode = false;
        this.canvas.selection = false;
        this.canvas.defaultCursor = 'text';
        this.startNoteMode();
        break;
        
      case 'area':
        this.canvas.isDrawingMode = false;
        this.canvas.selection = false;
        this.canvas.defaultCursor = 'crosshair';
        this.startAreaMode();
        break;
    }
    
    this.currentTool = tool;
  }
  
  /**
   * Start highlight mode
   */
  startHighlightMode() {
    let isDrawing = false;
    let startX, startY;
    let rect = null;
    
    this.canvas.on('mouse:down', (e) => {
      if (this.currentTool !== 'highlight') return;
      
      isDrawing = true;
      const pointer = this.canvas.getPointer(e.e);
      startX = pointer.x;
      startY = pointer.y;
      
      rect = new fabric.Rect({
        left: startX,
        top: startY,
        width: 0,
        height: 0,
        fill: 'rgba(255, 235, 59, 0.4)',
        stroke: 'rgba(255, 235, 59, 0.8)',
        strokeWidth: 2,
        selectable: true,
        type: 'highlight',
        id: 'highlight_' + Date.now()
      });
      
      this.canvas.add(rect);
    });
    
    this.canvas.on('mouse:move', (e) => {
      if (!isDrawing || !rect) return;
      
      const pointer = this.canvas.getPointer(e.e);
      const width = pointer.x - startX;
      const height = pointer.y - startY;
      
      rect.set({
        width: Math.abs(width),
        height: Math.abs(height),
        left: width < 0 ? pointer.x : startX,
        top: height < 0 ? pointer.y : startY
      });
      
      this.canvas.renderAll();
    });
    
    this.canvas.on('mouse:up', () => {
      if (!isDrawing || !rect) return;
      
      isDrawing = false;
      
      // Calculate area if scale is set
      if (this.scale && rect.width > 5 && rect.height > 5) {
        const area = this.calculateArea(rect.width, rect.height);
        this.addHighlightedArea({
          id: rect.id,
          area: area,
          color: 'yellow',
          rect: rect
        });
      } else if (rect.width <= 5 || rect.height <= 5) {
        // Remove tiny highlights
        this.canvas.remove(rect);
      }
      
      rect = null;
      this.markAsModified();
    });
  }
  
  /**
   * Start measure mode
   */
  startMeasureMode() {
    let isDrawing = false;
    let startPoint = null;
    let line = null;
    let label = null;
    
    this.canvas.on('mouse:down', (e) => {
      if (this.currentTool !== 'measure') return;
      
      isDrawing = true;
      const pointer = this.canvas.getPointer(e.e);
      startPoint = pointer;
      
      line = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
        stroke: '#2E86AB',
        strokeWidth: 2,
        selectable: true,
        type: 'measurement'
      });
      
      this.canvas.add(line);
    });
    
    this.canvas.on('mouse:move', (e) => {
      if (!isDrawing || !line) return;
      
      const pointer = this.canvas.getPointer(e.e);
      line.set({ x2: pointer.x, y2: pointer.y });
      
      // Calculate distance
      const distance = Math.sqrt(
        Math.pow(pointer.x - startPoint.x, 2) + 
        Math.pow(pointer.y - startPoint.y, 2)
      );
      
      const realDistance = this.scale ? distance * this.scale : distance;
      
      // Update or create label
      if (label) {
        this.canvas.remove(label);
      }
      
      label = new fabric.Text(`${realDistance.toFixed(2)} ft`, {
        left: (startPoint.x + pointer.x) / 2,
        top: (startPoint.y + pointer.y) / 2 - 20,
        fontSize: 14,
        fill: '#2E86AB',
        backgroundColor: 'rgba(255,255,255,0.9)',
        selectable: false,
        type: 'measurement-label'
      });
      
      this.canvas.add(label);
      this.canvas.renderAll();
    });
    
    this.canvas.on('mouse:up', () => {
      if (!isDrawing) return;
      
      isDrawing = false;
      
      if (line && label) {
        // Group line and label
        const group = new fabric.Group([line, label], {
          selectable: true,
          type: 'measurement-group'
        });
        
        this.canvas.remove(line);
        this.canvas.remove(label);
        this.canvas.add(group);
        
        this.measurements.push({
          type: 'linear',
          value: parseFloat(label.text),
          unit: 'ft'
        });
        
        this.updateMeasurements();
      }
      
      line = null;
      label = null;
      this.markAsModified();
    });
  }
  
  /**
   * Start note mode
   */
  startNoteMode() {
    this.canvas.on('mouse:down', (e) => {
      if (this.currentTool !== 'note') return;
      
      const pointer = this.canvas.getPointer(e.e);
      this.showAnnotationPopup(pointer.x, pointer.y);
    });
  }
  
  /**
   * Show annotation popup
   */
  showAnnotationPopup(x, y) {
    // Remove any existing popup
    const existingPopup = document.querySelector('.annotation-popup');
    if (existingPopup) {
      existingPopup.remove();
    }
    
    // Create popup
    const popup = document.createElement('div');
    popup.className = 'annotation-popup';
    popup.style.left = x + 'px';
    popup.style.top = y + 'px';
    popup.innerHTML = `
      <textarea placeholder="Enter your note here..." autofocus></textarea>
      <div class="annotation-popup-actions">
        <button onclick="enhancedTakeoff.cancelAnnotation()">Cancel</button>
        <button onclick="enhancedTakeoff.saveAnnotation(${x}, ${y})" style="background: #2E86AB; color: white;">Save</button>
      </div>
    `;
    
    document.getElementById('canvasContainer').appendChild(popup);
    popup.querySelector('textarea').focus();
  }
  
  /**
   * Save annotation
   */
  saveAnnotation(x, y) {
    const popup = document.querySelector('.annotation-popup');
    const text = popup.querySelector('textarea').value;
    
    if (text.trim()) {
      // Create note icon on canvas
      const note = new fabric.Group([
        new fabric.Rect({
          width: 24,
          height: 24,
          fill: '#F6AE2D',
          stroke: '#333',
          strokeWidth: 1
        }),
        new fabric.Text('📝', {
          fontSize: 16,
          left: 4,
          top: 2
        })
      ], {
        left: x,
        top: y,
        selectable: true,
        type: 'note',
        noteText: text,
        id: 'note_' + Date.now()
      });
      
      this.canvas.add(note);
      
      // Add to annotations list
      this.annotations.push({
        id: note.id,
        text: text,
        x: x,
        y: y,
        page: this.currentPage
      });
      
      this.updateAnnotationsList();
      this.markAsModified();
    }
    
    popup.remove();
  }
  
  /**
   * Cancel annotation
   */
  cancelAnnotation() {
    const popup = document.querySelector('.annotation-popup');
    if (popup) popup.remove();
  }
  
  /**
   * Start area selection mode
   */
  startAreaMode() {
    let isDrawing = false;
    let startX, startY;
    let rect = null;
    
    this.canvas.on('mouse:down', (e) => {
      if (this.currentTool !== 'area') return;
      
      isDrawing = true;
      const pointer = this.canvas.getPointer(e.e);
      startX = pointer.x;
      startY = pointer.y;
      
      rect = new fabric.Rect({
        left: startX,
        top: startY,
        width: 0,
        height: 0,
        fill: 'rgba(46, 134, 171, 0.2)',
        stroke: '#2E86AB',
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        selectable: true,
        type: 'area',
        id: 'area_' + Date.now()
      });
      
      this.canvas.add(rect);
    });
    
    this.canvas.on('mouse:move', (e) => {
      if (!isDrawing || !rect) return;
      
      const pointer = this.canvas.getPointer(e.e);
      const width = pointer.x - startX;
      const height = pointer.y - startY;
      
      rect.set({
        width: Math.abs(width),
        height: Math.abs(height),
        left: width < 0 ? pointer.x : startX,
        top: height < 0 ? pointer.y : startY
      });
      
      // Update selected area display
      if (this.scale) {
        const area = this.calculateArea(Math.abs(width), Math.abs(height));
        document.getElementById('selectedArea').textContent = `${area.toFixed(2)} sq ft`;
      }
      
      this.canvas.renderAll();
    });
    
    this.canvas.on('mouse:up', () => {
      if (!isDrawing || !rect) return;
      
      isDrawing = false;
      
      if (rect.width > 5 && rect.height > 5) {
        const area = this.calculateArea(rect.width, rect.height);
        
        // Add label to area
        const label = new fabric.Text(`${area.toFixed(2)} sq ft`, {
          left: rect.left + rect.width / 2 - 30,
          top: rect.top + rect.height / 2 - 10,
          fontSize: 14,
          fill: '#2E86AB',
          backgroundColor: 'rgba(255,255,255,0.9)',
          selectable: false
        });
        
        const group = new fabric.Group([rect, label], {
          selectable: true,
          type: 'area-group',
          area: area
        });
        
        this.canvas.remove(rect);
        this.canvas.add(group);
        
        this.addDetectedArea({
          id: group.id,
          area: area,
          type: 'manual'
        });
      } else {
        this.canvas.remove(rect);
      }
      
      rect = null;
      this.markAsModified();
    });
  }
  
  /**
   * Calculate real area from pixel dimensions
   */
  calculateArea(pixelWidth, pixelHeight) {
    if (!this.scale) return 0;
    
    // Convert pixels to real dimensions based on scale
    const realWidth = pixelWidth * this.scale;
    const realHeight = pixelHeight * this.scale;
    
    return realWidth * realHeight;
  }
  
  /**
   * Update scale
   */
  updateScale(scaleStr) {
    // Parse scale string (e.g., "1/4" = 1')
    const match = scaleStr.match(/(\d+(?:\/\d+)?)["\s]*=\s*(\d+)/);
    
    if (match) {
      const drawingInches = eval(match[1]);
      const realFeet = parseFloat(match[2]);
      this.scale = realFeet / (drawingInches * 96); // 96 DPI
      
      document.getElementById('currentScale').textContent = `Scale: ${scaleStr}`;
      document.getElementById('scaleInput').value = scaleStr;
      
      // Recalculate all areas
      this.recalculateAllMeasurements();
    }
  }
  
  /**
   * Auto-detect scale from document
   */
  async detectScale() {
    // Run Azure Document Intelligence to find scale
    try {
      const result = await this.runDocumentAnalysis();
      
      if (result.scale) {
        this.updateScale(result.scale);
        return;
      }
    } catch (error) {
      console.error('Error detecting scale:', error);
    }
    
    // Default scale
    this.updateScale('1/4" = 1\'');
  }
  
  /**
   * Analyze for existing highlights
   */
  async analyzeHighlights() {
    // Clear existing highlights list
    this.highlightedAreas = [];
    
    try {
      // Run Computer Vision to detect colored regions
      const result = await this.runVisionAnalysis();
      
      if (result.colorRegions) {
        result.colorRegions.forEach(region => {
          if (region.color === 'yellow' || region.color === 'highlighter') {
            this.addHighlightedArea({
              id: 'detected_' + Date.now(),
              area: this.calculateArea(region.width, region.height),
              color: region.color,
              confidence: region.confidence,
              bounds: region.bounds
            });
          }
        });
      }
      
      this.updateHighlightsList();
      
    } catch (error) {
      console.error('Error analyzing highlights:', error);
    }
  }
  
  /**
   * Add detected area
   */
  addDetectedArea(area) {
    const areaList = document.getElementById('detectedAreas');
    
    // Remove empty state
    const emptyState = areaList.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    // Add area item
    const areaItem = document.createElement('div');
    areaItem.className = 'area-item';
    areaItem.dataset.id = area.id;
    areaItem.innerHTML = `
      <strong>Area ${this.measurements.filter(m => m.type === 'area').length + 1}</strong><br>
      <span>${area.area.toFixed(2)} sq ft</span>
      ${area.type === 'manual' ? '<span style="float: right; color: #666;">Manual</span>' : ''}
    `;
    
    areaItem.onclick = () => this.selectArea(area.id);
    areaList.appendChild(areaItem);
    
    // Update total
    this.updateTotalArea();
  }
  
  /**
   * Add highlighted area
   */
  addHighlightedArea(highlight) {
    this.highlightedAreas.push(highlight);
    this.updateHighlightsList();
    this.updateTotalArea();
  }
  
  /**
   * Update highlights list
   */
  updateHighlightsList() {
    const highlightList = document.getElementById('highlightedRegions');
    
    if (this.highlightedAreas.length === 0) {
      highlightList.innerHTML = '<p class="empty-state">No highlights found</p>';
      return;
    }
    
    highlightList.innerHTML = '';
    
    this.highlightedAreas.forEach((highlight, index) => {
      const item = document.createElement('div');
      item.className = 'highlight-item';
      item.dataset.id = highlight.id;
      item.innerHTML = `
        <strong>Highlight ${index + 1}</strong><br>
        <span>${highlight.area ? highlight.area.toFixed(2) + ' sq ft' : 'N/A'}</span>
        <span style="float: right; width: 20px; height: 20px; background: ${highlight.color}; border: 1px solid #333; display: inline-block;"></span>
      `;
      
      item.onclick = () => this.selectHighlight(highlight.id);
      highlightList.appendChild(item);
    });
  }
  
  /**
   * Update annotations list
   */
  updateAnnotationsList() {
    const annotationsList = document.getElementById('annotationsList');
    
    if (this.annotations.length === 0) {
      annotationsList.innerHTML = '<p class="empty-state">No annotations yet</p>';
      return;
    }
    
    annotationsList.innerHTML = '';
    
    this.annotations.forEach((annotation, index) => {
      const item = document.createElement('div');
      item.className = 'annotation-item';
      item.dataset.id = annotation.id;
      item.innerHTML = `
        <strong>Note ${index + 1}</strong><br>
        <span style="font-size: 0.9em; color: #666;">${annotation.text.substring(0, 50)}${annotation.text.length > 50 ? '...' : ''}</span>
      `;
      
      item.onclick = () => this.selectAnnotation(annotation.id);
      annotationsList.appendChild(item);
    });
  }
  
  /**
   * Update measurements display
   */
  updateMeasurements() {
    let totalWalls = 0;
    
    this.measurements.forEach(m => {
      if (m.type === 'linear') {
        totalWalls += m.value;
      }
    });
    
    document.getElementById('totalWalls').textContent = `${totalWalls.toFixed(2)} ft`;
    this.updateTotalArea();
  }
  
  /**
   * Update total area
   */
  updateTotalArea() {
    let totalArea = 0;
    
    // Add manually selected areas
    this.canvas.getObjects().forEach(obj => {
      if (obj.type === 'area-group' && obj.area) {
        totalArea += obj.area;
      }
    });
    
    // Add highlighted areas
    this.highlightedAreas.forEach(h => {
      if (h.area) totalArea += h.area;
    });
    
    document.getElementById('totalFloorArea').textContent = `${totalArea.toFixed(2)} sq ft`;
  }
  
  /**
   * Mark document as modified
   */
  markAsModified() {
    this.isModified = true;
    document.getElementById('saveModifications').style.display = 'inline-block';
  }
  
  /**
   * Save modifications to Azure
   */
  async saveModifications() {
    if (!this.isModified) return;
    
    try {
      // Export canvas as JSON
      const canvasData = this.canvas.toJSON(['id', 'type', 'noteText', 'area']);
      
      // Save annotations data
      const modificationsData = {
        project: this.currentProject,
        document: this.currentDocument,
        timestamp: new Date().toISOString(),
        scale: this.scale,
        annotations: this.annotations,
        measurements: this.measurements,
        highlightedAreas: this.highlightedAreas,
        canvasData: canvasData,
        currentPage: this.currentPage
      };
      
      // Generate modified document
      if (this.pdfDoc) {
        await this.saveModifiedPDF(modificationsData);
      } else {
        await this.saveModifiedImage(modificationsData);
      }
      
      // Update index
      await this.updateDocumentIndex(modificationsData);
      
      alert('Modifications saved successfully!');
      this.isModified = false;
      document.getElementById('saveModifications').style.display = 'none';
      
    } catch (error) {
      console.error('Error saving modifications:', error);
      alert('Error saving modifications. Please try again.');
    }
  }
  
  /**
   * Save modified PDF
   */
  async saveModifiedPDF(modificationsData) {
    const { PDFDocument, rgb, degrees } = window.PDFLib;
    
    // Get current page
    const page = this.pdfDoc.getPage(this.currentPage - 1);
    const { width, height } = page.getSize();
    
    // Add annotations to PDF
    this.annotations.forEach(annotation => {
      if (annotation.page === this.currentPage) {
        // Add text annotation
        page.drawText(annotation.text, {
          x: annotation.x,
          y: height - annotation.y,
          size: 12,
          color: rgb(0, 0, 0)
        });
        
        // Add note icon
        page.drawRectangle({
          x: annotation.x - 12,
          y: height - annotation.y - 12,
          width: 24,
          height: 24,
          color: rgb(0.965, 0.682, 0.176) // Yellow
        });
      }
    });
    
    // Add highlighted areas
    this.canvas.getObjects().forEach(obj => {
      if (obj.type === 'highlight') {
        page.drawRectangle({
          x: obj.left,
          y: height - obj.top - obj.height,
          width: obj.width,
          height: obj.height,
          color: rgb(1, 0.92, 0.23),
          opacity: 0.3
        });
      }
    });
    
    // Save modified PDF
    const pdfBytes = await this.pdfDoc.save();
    
    // Upload to Azure
    await this.uploadToAzure(pdfBytes, 'application/pdf', modificationsData);
  }
  
  /**
   * Save modified image
   */
  async saveModifiedImage(modificationsData) {
    // Export canvas as image
    const dataUrl = this.canvas.toDataURL('image/png');
    const blob = await fetch(dataUrl).then(res => res.blob());
    
    // Upload to Azure
    await this.uploadToAzure(blob, 'image/png', modificationsData);
  }
  
  /**
   * Upload modified document to Azure
   */
  async uploadToAzure(data, contentType, modificationsData) {
    const fileName = this.currentDocument.split('/').pop();
    const timestamp = Date.now();
    const modifiedFileName = fileName.replace(/(\.[^.]+)$/, `_modified_${timestamp}$1`);
    const blobPath = `FCS-OriginalClients/${this.currentProject}/Modified/${modifiedFileName}`;
    
    // Create SAS URL for upload
    const uploadUrl = `https://${ENHANCED_TAKEOFF_CONFIG.storage.account}.blob.core.windows.net/${ENHANCED_TAKEOFF_CONFIG.storage.container}/${blobPath}?${ENHANCED_TAKEOFF_CONFIG.storage.sasToken}`;
    
    // Upload file
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': contentType
      },
      body: data
    });
    
    if (!response.ok) {
      throw new Error('Failed to upload to Azure');
    }
    
    // Save metadata
    const metadataPath = blobPath.replace(/(\.[^.]+)$/, '_metadata.json');
    const metadataUrl = `https://${ENHANCED_TAKEOFF_CONFIG.storage.account}.blob.core.windows.net/${ENHANCED_TAKEOFF_CONFIG.storage.container}/${metadataPath}?${ENHANCED_TAKEOFF_CONFIG.storage.sasToken}`;
    
    await fetch(metadataUrl, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(modificationsData)
    });
  }
  
  /**
   * Update document index with new information
   */
  async updateDocumentIndex(modificationsData) {
    // Trigger webhook to update Azure Search index
    const indexUpdateUrl = 'https://workflows.saxtechnology.com/webhook/ask-foreman/update-index';
    
    await fetch(indexUpdateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        project: this.currentProject,
        document: this.currentDocument,
        modifications: {
          annotations: modificationsData.annotations.map(a => a.text).join(' '),
          totalArea: modificationsData.highlightedAreas.reduce((sum, h) => sum + (h.area || 0), 0),
          measurements: modificationsData.measurements,
          timestamp: modificationsData.timestamp
        }
      })
    });
  }
  
  /**
   * Run AI analysis
   */
  async runAIAnalysis() {
    try {
      // Show progress
      alert('Running AI analysis...');
      
      // Get current canvas as image
      const dataUrl = this.canvas.toDataURL('image/png');
      const blob = await fetch(dataUrl).then(res => res.blob());
      const arrayBuffer = await blob.arrayBuffer();
      
      // Run Document Intelligence
      const docResult = await this.runDocumentAnalysis(arrayBuffer);
      
      // Run Computer Vision
      const visionResult = await this.runVisionAnalysis(arrayBuffer);
      
      // Process results
      this.processAIResults(docResult, visionResult);
      
      alert('AI analysis complete!');
      
    } catch (error) {
      console.error('AI analysis error:', error);
      alert('Error running AI analysis');
    }
  }
  
  /**
   * Run Document Intelligence analysis
   */
  async runDocumentAnalysis(arrayBuffer) {
    const { endpoint, apiKey, apiVersion } = ENHANCED_TAKEOFF_CONFIG.documentIntelligence;
    
    const analyzeUrl = `${endpoint}formrecognizer/documentModels/prebuilt-layout:analyze?api-version=${apiVersion}`;
    
    const response = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/octet-stream'
      },
      body: arrayBuffer
    });
    
    if (!response.ok) {
      throw new Error(`Document Intelligence error: ${response.status}`);
    }
    
    const operationLocation = response.headers.get('Operation-Location');
    
    // Poll for results
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const resultResponse = await fetch(operationLocation, {
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey
        }
      });
      
      const result = await resultResponse.json();
      
      if (result.status === 'succeeded') {
        return result.analyzeResult;
      } else if (result.status === 'failed') {
        throw new Error('Analysis failed');
      }
    }
    
    throw new Error('Analysis timeout');
  }
  
  /**
   * Run Computer Vision analysis
   */
  async runVisionAnalysis(arrayBuffer) {
    const { endpoint, apiKey, apiVersion } = ENHANCED_TAKEOFF_CONFIG.computerVision;
    
    const analyzeUrl = `${endpoint}computervision/imageanalysis:analyze?api-version=${apiVersion}&features=read,objects,tags`;
    
    const response = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/octet-stream'
      },
      body: arrayBuffer
    });
    
    if (!response.ok) {
      throw new Error(`Computer Vision error: ${response.status}`);
    }
    
    return await response.json();
  }
  
  /**
   * Process AI results
   */
  processAIResults(docResult, visionResult) {
    // Extract measurements from text
    if (docResult && docResult.content) {
      const areaPattern = /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sf)/gi;
      const matches = docResult.content.match(areaPattern);
      
      if (matches) {
        matches.forEach(match => {
          const value = parseFloat(match.replace(/[^\d.]/g, ''));
          this.addDetectedArea({
            id: 'ai_' + Date.now(),
            area: value,
            type: 'ai-detected'
          });
        });
      }
    }
    
    // Detect objects
    if (visionResult && visionResult.objectsResult) {
      visionResult.objectsResult.values.forEach(obj => {
        // Add detected objects as annotations
        const annotation = {
          id: 'ai_note_' + Date.now(),
          text: `Detected: ${obj.tags[0].name}`,
          x: obj.boundingBox.x,
          y: obj.boundingBox.y,
          page: this.currentPage
        };
        
        this.annotations.push(annotation);
      });
      
      this.updateAnnotationsList();
    }
    
    this.markAsModified();
  }
  
  /**
   * Export results to Excel
   */
  exportResults() {
    // Create CSV content
    let csv = 'Enhanced Digital Takeoff Results\n';
    csv += `Project:,${this.currentProject}\n`;
    csv += `Document:,${this.currentDocument}\n`;
    csv += `Date:,${new Date().toLocaleDateString()}\n\n`;
    
    csv += 'Measurements\n';
    csv += 'Type,Value,Unit\n';
    
    // Add walls
    const totalWalls = this.measurements.filter(m => m.type === 'linear')
      .reduce((sum, m) => sum + m.value, 0);
    csv += `Total Walls,${totalWalls.toFixed(2)},linear feet\n`;
    
    // Add areas
    let totalArea = 0;
    this.canvas.getObjects().forEach(obj => {
      if (obj.type === 'area-group' && obj.area) {
        totalArea += obj.area;
      }
    });
    csv += `Total Area,${totalArea.toFixed(2)},sq ft\n`;
    
    // Add highlighted areas
    csv += '\nHighlighted Areas\n';
    csv += 'ID,Area (sq ft),Color\n';
    this.highlightedAreas.forEach(h => {
      csv += `${h.id},${h.area ? h.area.toFixed(2) : 'N/A'},${h.color}\n`;
    });
    
    // Add annotations
    csv += '\nAnnotations\n';
    csv += 'ID,Text,Page\n';
    this.annotations.forEach(a => {
      csv += `${a.id},"${a.text}",${a.page}\n`;
    });
    
    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `enhanced_takeoff_${this.currentProject}_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert('Results exported successfully!');
  }
  
  /**
   * Save results to Azure
   */
  async saveToAzure() {
    await this.saveModifications();
  }
  
  /**
   * Add results to estimate
   */
  addToEstimate() {
    const results = {
      project: this.currentProject,
      document: this.currentDocument,
      measurements: this.measurements,
      areas: this.highlightedAreas,
      annotations: this.annotations,
      totalWalls: this.measurements.filter(m => m.type === 'linear')
        .reduce((sum, m) => sum + m.value, 0),
      totalArea: this.highlightedAreas.reduce((sum, h) => sum + (h.area || 0), 0)
    };
    
    // Dispatch event for estimate integration
    const event = new CustomEvent('enhancedTakeoffComplete', {
      detail: results
    });
    
    document.dispatchEvent(event);
    
    alert('Results added to estimate!');
    this.close();
  }
  
  /**
   * Navigate to previous page
   */
  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderPDFPage(this.currentPage);
      document.getElementById('pageInfo').textContent = `Page ${this.currentPage} of ${this.totalPages}`;
      document.getElementById('prevPage').disabled = this.currentPage === 1;
      document.getElementById('nextPage').disabled = false;
    }
  }
  
  /**
   * Navigate to next page
   */
  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.renderPDFPage(this.currentPage);
      document.getElementById('pageInfo').textContent = `Page ${this.currentPage} of ${this.totalPages}`;
      document.getElementById('prevPage').disabled = false;
      document.getElementById('nextPage').disabled = this.currentPage === this.totalPages;
    }
  }
  
  /**
   * Restore annotations for current page
   */
  restoreAnnotations(pageNumber) {
    // Restore annotations for this page
    this.annotations.filter(a => a.page === pageNumber).forEach(annotation => {
      const note = new fabric.Group([
        new fabric.Rect({
          width: 24,
          height: 24,
          fill: '#F6AE2D',
          stroke: '#333',
          strokeWidth: 1
        }),
        new fabric.Text('📝', {
          fontSize: 16,
          left: 4,
          top: 2
        })
      ], {
        left: annotation.x,
        top: annotation.y,
        selectable: true,
        type: 'note',
        noteText: annotation.text,
        id: annotation.id
      });
      
      this.canvas.add(note);
    });
    
    this.canvas.renderAll();
  }
  
  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Update cursor position
    this.canvas.on('mouse:move', (e) => {
      const pointer = this.canvas.getPointer(e.e);
      document.getElementById('cursorPosition').textContent = 
        `X: ${Math.round(pointer.x)}, Y: ${Math.round(pointer.y)}`;
    });
    
    // Handle object selection
    this.canvas.on('selection:created', (e) => {
      const selected = e.selected[0];
      if (selected && selected.type === 'note') {
        // Show note content
        alert(`Note: ${selected.noteText}`);
      }
    });
    
    // Handle keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
      
      switch(e.key) {
        case 'Delete':
        case 'Backspace':
          // Delete selected objects
          const activeObjects = this.canvas.getActiveObjects();
          activeObjects.forEach(obj => this.canvas.remove(obj));
          this.canvas.discardActiveObject();
          this.canvas.renderAll();
          this.markAsModified();
          break;
          
        case 'Escape':
          // Cancel current tool
          this.setTool('select');
          break;
          
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.saveModifications();
          }
          break;
      }
    });
  }
  
  /**
   * Close the enhanced modal
   */
  close() {
    const modal = document.getElementById('enhancedTakeoffModal');
    if (modal) {
      if (this.isModified) {
        if (confirm('You have unsaved changes. Are you sure you want to close?')) {
          modal.remove();
        }
      } else {
        modal.remove();
      }
    }
  }
}

// Create global instance
window.enhancedTakeoff = new EnhancedDigitalTakeoff();

// Override the original function
window.initializeDigitalTakeoff = function() {
  window.enhancedTakeoff.initializeEnhanced();
};

// Enhanced Takeoff Tool Module
// Complete rewrite with all requested features and fixes

class EnhancedTakeoffTool {
  constructor(options = {}) {
    this.mode = options.mode || 'edit'; // 'edit' or 'view'
    this.container = options.container || 'takeoffModal';
    this.projectId = null;
    this.currentPDF = null;
    this.currentPageNum = 1;
    this.totalPages = 0;
    this.pdfScale = 1.5;
    this.drawingScale = null; // Will be auto-detected or manually set
    this.currentTool = 'pan';
    this.isDrawing = false;
    this.measurements = [];
    this.annotations = [];
    this.selectedMeasurement = null;
    this.polygonPoints = [];
    this.currentDrawing = null;
    this.drawingFiles = [];
    this.documentIntelligenceData = null;
    this.zoomLevel = 1;
    this.panOffset = { x: 0, y: 0 };
    
    // Canvas elements
    this.pdfCanvas = null;
    this.annotationCanvas = null;
    this.ctx = null;
    this.annotationCtx = null;
    
    // Azure configuration
    this.azureConfig = {
      account: "saxtechfcs",
      container: "fcs-clients",
      sasToken: "?sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D"
    };
    
    // Document Intelligence endpoints (will be fetched from environment)
    this.diEndpoint = null;
    this.cvEndpoint = null;
  }
  
  async initialize() {
    // Initialize PDF.js
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    
    // Get canvas elements
    this.pdfCanvas = document.getElementById('pdfCanvas');
    this.annotationCanvas = document.getElementById('annotationCanvas');
    
    if (this.pdfCanvas && this.annotationCanvas) {
      this.ctx = this.pdfCanvas.getContext('2d');
      this.annotationCtx = this.annotationCanvas.getContext('2d');
      
      // Setup event handlers
      this.setupCanvasEvents();
      this.setupToolButtons();
      
      // Load projects
      await this.loadProjects();
    }
    
    // Fetch Azure endpoints
    await this.fetchAzureEndpoints();
  }
  
  async fetchAzureEndpoints() {
    try {
      // Get Document Intelligence and Computer Vision endpoints from Azure Static Web App environment
      const response = await fetch('/.auth/me');
      if (response.ok) {
        // These would be configured in your Azure Static Web App configuration
        this.diEndpoint = process.env.AZURE_DI_ENDPOINT || 'https://your-di-resource.cognitiveservices.azure.com';
        this.cvEndpoint = process.env.AZURE_CV_ENDPOINT || 'https://your-cv-resource.cognitiveservices.azure.com';
      }
    } catch (error) {
      console.log('Using default endpoints');
    }
  }
  
  async loadProjects() {
    const projectSelect = document.getElementById('takeoffProjectSelect');
    if (!projectSelect) return;
    
    projectSelect.innerHTML = '<option value="">Select Project</option>';
    
    try {
      const listUrl = `https://${this.azureConfig.account}.blob.core.windows.net/${this.azureConfig.container}${this.azureConfig.sasToken}&restype=container&comp=list&prefix=FCS-OriginalClients/&delimiter=/`;
      const response = await fetch(listUrl);
      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
      const prefixes = xmlDoc.getElementsByTagName("BlobPrefix");
      
      for (let i = 0; i < prefixes.length; i++) {
        const nameElement = prefixes[i].getElementsByTagName("Name")[0];
        if (nameElement) {
          const fullPath = nameElement.textContent.replace(/\/$/, '');
          const projectName = fullPath.split('/')[1];
          
          if (projectName && projectName !== 'placeholder.json') {
            const option = document.createElement('option');
            option.value = projectName;
            option.textContent = this.formatProjectName(projectName);
            projectSelect.appendChild(option);
          }
        }
      }
      
      // Add change handler
      projectSelect.addEventListener('change', (e) => this.loadProjectDrawings(e.target.value));
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  }
  
  async loadProjectDrawings(projectId) {
    if (!projectId) return;
    
    this.projectId = projectId;
    this.drawingFiles = [];
    
    // Create file selector dropdown next to project selector
    let fileSelector = document.getElementById('drawingFileSelector');
    if (!fileSelector) {
      const projectSelect = document.getElementById('takeoffProjectSelect');
      fileSelector = document.createElement('select');
      fileSelector.id = 'drawingFileSelector';
      fileSelector.style.cssText = 'padding: 0.5rem; border-radius: 4px; background: white; color: var(--concrete-gray); margin-left: 1rem;';
      projectSelect.parentNode.insertBefore(fileSelector, projectSelect.nextSibling);
      
      fileSelector.addEventListener('change', (e) => {
        const selected = this.drawingFiles.find(f => f.url === e.target.value);
        if (selected) this.loadDrawingFile(selected);
      });
    }
    
    fileSelector.innerHTML = '<option value="">Select Drawing</option>';
    
    try {
      // Check for existing takeoff data first
      const takeoffUrl = `https://${this.azureConfig.account}.blob.core.windows.net/${this.azureConfig.container}${this.azureConfig.sasToken}&restype=container&comp=list&prefix=FCS-OriginalClients/${projectId}/takeoffs/`;
      const takeoffResponse = await fetch(takeoffUrl);
      
      if (takeoffResponse.ok) {
        const xmlText = await takeoffResponse.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const blobs = xmlDoc.getElementsByTagName("Blob");
        
        for (let i = 0; i < blobs.length; i++) {
          const nameElement = blobs[i].getElementsByTagName("Name")[0];
          if (nameElement) {
            const fileName = nameElement.textContent.split('/').pop();
            if (fileName.endsWith('.json')) {
              // Load takeoff data
              const dataUrl = `https://${this.azureConfig.account}.blob.core.windows.net/${this.azureConfig.container}/${nameElement.textContent}${this.azureConfig.sasToken}`;
              const response = await fetch(dataUrl);
              const takeoffData = await response.json();
              this.documentIntelligenceData = takeoffData;
              this.applyDocumentIntelligence(takeoffData);
            }
          }
        }
      }
      
      // Load drawing files
      const drawingsUrl = `https://${this.azureConfig.account}.blob.core.windows.net/${this.azureConfig.container}${this.azureConfig.sasToken}&restype=container&comp=list&prefix=FCS-OriginalClients/${projectId}/drawings/`;
      const response = await fetch(drawingsUrl);
      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
      const blobs = xmlDoc.getElementsByTagName("Blob");
      
      for (let i = 0; i < blobs.length; i++) {
        const nameElement = blobs[i].getElementsByTagName("Name")[0];
        if (nameElement) {
          const fileName = nameElement.textContent.split('/').pop();
          if (fileName.endsWith('.pdf') || fileName.endsWith('.png') || fileName.endsWith('.jpg')) {
            const fileUrl = `https://${this.azureConfig.account}.blob.core.windows.net/${this.azureConfig.container}/${nameElement.textContent}${this.azureConfig.sasToken}`;
            
            this.drawingFiles.push({
              name: fileName,
              url: fileUrl,
              path: nameElement.textContent
            });
            
            const option = document.createElement('option');
            option.value = fileUrl;
            option.textContent = fileName;
            fileSelector.appendChild(option);
          }
        }
      }
      
      // Auto-load first file if available
      if (this.drawingFiles.length > 0) {
        fileSelector.value = this.drawingFiles[0].url;
        await this.loadDrawingFile(this.drawingFiles[0]);
      }
      
      this.updateStatus(`Loaded ${this.drawingFiles.length} drawing(s)`, 'success');
      
    } catch (error) {
      console.error('Error loading project drawings:', error);
      this.updateStatus('Error loading drawings', 'error');
    }
  }
  
  async loadDrawingFile(file) {
    this.currentDrawing = file;
    
    if (file.name.endsWith('.pdf')) {
      await this.loadPDF(file.url);
    } else {
      await this.loadImage(file.url);
    }
    
    // If we have DI data for this file, apply it
    if (this.documentIntelligenceData && this.documentIntelligenceData.fileName === file.name) {
      this.applyDocumentIntelligence(this.documentIntelligenceData);
    }
  }
  
  async loadPDF(url) {
    try {
      const loadingTask = pdfjsLib.getDocument(url);
      this.currentPDF = await loadingTask.promise;
      this.totalPages = this.currentPDF.numPages;
      this.currentPageNum = 1;
      
      await this.renderPDFPage(this.currentPageNum);
      this.updatePageInfo();
      
    } catch (error) {
      console.error('Error loading PDF:', error);
      this.updateStatus('Error loading PDF', 'error');
    }
  }
  
  async renderPDFPage(pageNum) {
    if (!this.currentPDF) return;
    
    const page = await this.currentPDF.getPage(pageNum);
    const viewport = page.getViewport({ scale: this.pdfScale });
    
    this.pdfCanvas.height = viewport.height;
    this.pdfCanvas.width = viewport.width;
    this.annotationCanvas.height = viewport.height;
    this.annotationCanvas.width = viewport.width;
    
    const renderContext = {
      canvasContext: this.ctx,
      viewport: viewport
    };
    
    await page.render(renderContext).promise;
    
    // Redraw annotations
    this.redrawAnnotations();
  }
  
  async loadImage(url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      this.pdfCanvas.width = img.width;
      this.pdfCanvas.height = img.height;
      this.annotationCanvas.width = img.width;
      this.annotationCanvas.height = img.height;
      
      this.ctx.drawImage(img, 0, 0);
      this.redrawAnnotations();
    };
    
    img.src = url;
  }
  
  setupCanvasEvents() {
    const wrapper = document.getElementById('pdfCanvasWrapper');
    if (!wrapper) return;
    
    // Mouse events for drawing
    this.annotationCanvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.annotationCanvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.annotationCanvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.annotationCanvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
    
    // Wheel for zoom
    wrapper.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
  }
  
  handleMouseDown(e) {
    const rect = this.annotationCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.zoomLevel;
    const y = (e.clientY - rect.top) / this.zoomLevel;
    
    if (this.currentTool === 'pan') {
      this.isPanning = true;
      this.panStart = { x: e.clientX - this.panOffset.x, y: e.clientY - this.panOffset.y };
      
    } else if (this.currentTool === 'select') {
      // Check if clicking on a measurement to select it
      this.selectMeasurement(x, y);
      
    } else if (this.currentTool === 'line') {
      if (!this.isDrawing) {
        this.isDrawing = true;
        this.startPoint = { x, y };
      }
      
    } else if (this.currentTool === 'area') {
      if (!this.isDrawing) {
        this.isDrawing = true;
        this.startPoint = { x, y };
      }
      
    } else if (this.currentTool === 'polygon') {
      this.polygonPoints.push({ x, y });
      if (this.polygonPoints.length === 1) {
        this.isDrawing = true;
      }
      this.redrawAnnotations();
      this.drawTempPolygon();
      
    } else if (this.currentTool === 'scale') {
      if (!this.scalePoint1) {
        this.scalePoint1 = { x, y };
        this.updateStatus('Click second point for scale reference', 'info');
      } else {
        this.scalePoint2 = { x, y };
        this.setScaleFromPoints();
      }
    }
  }
  
  handleMouseMove(e) {
    const rect = this.annotationCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.zoomLevel;
    const y = (e.clientY - rect.top) / this.zoomLevel;
    
    if (this.isPanning && this.currentTool === 'pan') {
      this.panOffset = {
        x: e.clientX - this.panStart.x,
        y: e.clientY - this.panStart.y
      };
      this.applyTransform();
      
    } else if (this.isDrawing) {
      this.redrawAnnotations();
      
      if (this.currentTool === 'line') {
        this.drawTempLine(this.startPoint, { x, y });
        
      } else if (this.currentTool === 'area') {
        this.drawTempRectangle(this.startPoint, { x, y });
        
      } else if (this.currentTool === 'polygon' && this.polygonPoints.length > 0) {
        this.drawTempPolygon({ x, y });
      }
    }
  }
  
  handleMouseUp(e) {
    const rect = this.annotationCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / this.zoomLevel;
    const y = (e.clientY - rect.top) / this.zoomLevel;
    
    if (this.currentTool === 'pan') {
      this.isPanning = false;
      
    } else if (this.currentTool === 'line' && this.isDrawing) {
      this.addLineMeasurement(this.startPoint, { x, y });
      this.isDrawing = false;
      
    } else if (this.currentTool === 'area' && this.isDrawing) {
      this.addAreaMeasurement(this.startPoint, { x, y });
      this.isDrawing = false;
    }
  }
  
  handleDoubleClick(e) {
    if (this.currentTool === 'polygon' && this.polygonPoints.length >= 3) {
      // Close polygon
      this.addPolygonMeasurement(this.polygonPoints);
      this.polygonPoints = [];
      this.isDrawing = false;
    }
  }
  
  handleWheel(e) {
    e.preventDefault();
    
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    this.zoomLevel = Math.min(Math.max(0.5, this.zoomLevel * delta), 5);
    this.applyTransform();
  }
  
  handleKeyboard(e) {
    if (e.key === 'Delete' && this.selectedMeasurement) {
      this.deleteMeasurement(this.selectedMeasurement);
    } else if (e.key === 'Escape') {
      if (this.currentTool === 'polygon') {
        this.polygonPoints = [];
        this.isDrawing = false;
        this.redrawAnnotations();
      }
    }
  }
  
  applyTransform() {
    const transform = `scale(${this.zoomLevel}) translate(${this.panOffset.x}px, ${this.panOffset.y}px)`;
    this.pdfCanvas.style.transform = transform;
    this.annotationCanvas.style.transform = transform;
  }
  
  selectMeasurement(x, y) {
    // Find measurement near click point
    const tolerance = 10;
    
    for (let m of this.measurements) {
      if (m.type === 'line') {
        if (this.isPointNearLine(x, y, m.start, m.end, tolerance)) {
          this.selectedMeasurement = m;
          this.highlightMeasurement(m);
          return;
        }
      } else if (m.type === 'area') {
        if (this.isPointInRectangle(x, y, m.start, m.end)) {
          this.selectedMeasurement = m;
          this.highlightMeasurement(m);
          return;
        }
      } else if (m.type === 'polygon') {
        if (this.isPointInPolygon(x, y, m.points)) {
          this.selectedMeasurement = m;
          this.highlightMeasurement(m);
          return;
        }
      }
    }
    
    this.selectedMeasurement = null;
    this.redrawAnnotations();
  }
  
  deleteMeasurement(measurement) {
    const index = this.measurements.indexOf(measurement);
    if (index > -1) {
      this.measurements.splice(index, 1);
      this.selectedMeasurement = null;
      this.redrawAnnotations();
      this.updateMeasurementsList();
    }
  }
  
  addLineMeasurement(start, end) {
    const distance = this.calculateDistance(start, end);
    const measurement = {
      id: Date.now(),
      type: 'line',
      start,
      end,
      value: distance,
      timestamp: new Date().toISOString()
    };
    
    this.measurements.push(measurement);
    this.redrawAnnotations();
    this.updateMeasurementsList();
  }
  
  addAreaMeasurement(start, end) {
    const area = this.calculateArea(start, end);
    const measurement = {
      id: Date.now(),
      type: 'area',
      start,
      end,
      value: area,
      timestamp: new Date().toISOString()
    };
    
    this.measurements.push(measurement);
    this.redrawAnnotations();
    this.updateMeasurementsList();
  }
  
  addPolygonMeasurement(points) {
    const area = this.calculatePolygonArea(points);
    const measurement = {
      id: Date.now(),
      type: 'polygon',
      points: [...points],
      value: area,
      timestamp: new Date().toISOString()
    };
    
    this.measurements.push(measurement);
    this.redrawAnnotations();
    this.updateMeasurementsList();
  }
  
  calculateDistance(p1, p2) {
    const pixelDistance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    
    if (this.drawingScale) {
      return (pixelDistance * this.drawingScale) / 96; // Assuming 96 DPI
    }
    return pixelDistance;
  }
  
  calculateArea(p1, p2) {
    const width = Math.abs(p2.x - p1.x);
    const height = Math.abs(p2.y - p1.y);
    const pixelArea = width * height;
    
    if (this.drawingScale) {
      const scaledWidth = (width * this.drawingScale) / 96;
      const scaledHeight = (height * this.drawingScale) / 96;
      return scaledWidth * scaledHeight;
    }
    return pixelArea;
  }
  
  calculatePolygonArea(points) {
    if (points.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    area = Math.abs(area) / 2;
    
    if (this.drawingScale) {
      const scaleFactor = this.drawingScale / 96;
      return area * scaleFactor * scaleFactor;
    }
    return area;
  }
  
  setScaleFromPoints() {
    const pixelDistance = this.calculateDistance(this.scalePoint1, this.scalePoint2);
    const realDistance = prompt('Enter the real-world distance (in feet):', '10');
    
    if (realDistance && !isNaN(realDistance)) {
      this.drawingScale = (parseFloat(realDistance) * 96) / pixelDistance;
      document.getElementById('drawingScale').textContent = `1:${Math.round(this.drawingScale)}`;
      
      // Recalculate all measurements with new scale
      this.measurements.forEach(m => {
        if (m.type === 'line') {
          m.value = this.calculateDistance(m.start, m.end);
        } else if (m.type === 'area') {
          m.value = this.calculateArea(m.start, m.end);
        } else if (m.type === 'polygon') {
          m.value = this.calculatePolygonArea(m.points);
        }
      });
      
      this.updateMeasurementsList();
      this.updateStatus(`Scale set: 1:${Math.round(this.drawingScale)}`, 'success');
    }
    
    this.scalePoint1 = null;
    this.scalePoint2 = null;
  }
  
  redrawAnnotations() {
    this.annotationCtx.clearRect(0, 0, this.annotationCanvas.width, this.annotationCanvas.height);
    
    // Draw all measurements
    this.measurements.forEach(m => {
      const isSelected = m === this.selectedMeasurement;
      
      if (m.type === 'line') {
        this.drawLine(m.start, m.end, isSelected);
        this.drawMeasurementLabel(m);
        
      } else if (m.type === 'area') {
        this.drawRectangle(m.start, m.end, isSelected);
        this.drawMeasurementLabel(m);
        
      } else if (m.type === 'polygon') {
        this.drawPolygon(m.points, isSelected);
        this.drawMeasurementLabel(m);
      }
    });
  }
  
  drawLine(start, end, isSelected = false) {
    this.annotationCtx.strokeStyle = isSelected ? '#ff0000' : '#76ff03';
    this.annotationCtx.lineWidth = isSelected ? 3 : 2;
    this.annotationCtx.beginPath();
    this.annotationCtx.moveTo(start.x, start.y);
    this.annotationCtx.lineTo(end.x, end.y);
    this.annotationCtx.stroke();
    
    // Draw endpoints
    this.annotationCtx.fillStyle = isSelected ? '#ff0000' : '#76ff03';
    [start, end].forEach(point => {
      this.annotationCtx.beginPath();
      this.annotationCtx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
      this.annotationCtx.fill();
    });
  }
  
  drawTempLine(start, end) {
    this.drawLine(start, end);
    
    // Show distance while drawing
    const distance = this.calculateDistance(start, end);
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    this.annotationCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.annotationCtx.fillRect(midX - 40, midY - 12, 80, 24);
    this.annotationCtx.fillStyle = '#ffffff';
    this.annotationCtx.font = '12px Arial';
    this.annotationCtx.textAlign = 'center';
    this.annotationCtx.fillText(`${distance.toFixed(1)} ft`, midX, midY + 4);
  }
  
  drawRectangle(start, end, isSelected = false) {
    const width = end.x - start.x;
    const height = end.y - start.y;
    
    this.annotationCtx.strokeStyle = isSelected ? '#ff0000' : '#76ff03';
    this.annotationCtx.lineWidth = isSelected ? 3 : 2;
    this.annotationCtx.strokeRect(start.x, start.y, width, height);
    
    this.annotationCtx.fillStyle = isSelected ? 'rgba(255, 0, 0, 0.2)' : 'rgba(118, 255, 3, 0.2)';
    this.annotationCtx.fillRect(start.x, start.y, width, height);
  }
  
  drawTempRectangle(start, end) {
    this.drawRectangle(start, end);
    
    // Show area while drawing
    const area = this.calculateArea(start, end);
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    this.annotationCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.annotationCtx.fillRect(midX - 50, midY - 12, 100, 24);
    this.annotationCtx.fillStyle = '#ffffff';
    this.annotationCtx.font = '12px Arial';
    this.annotationCtx.textAlign = 'center';
    this.annotationCtx.fillText(`${area.toFixed(1)} sq ft`, midX, midY + 4);
  }
  
  drawPolygon(points, isSelected = false) {
    if (points.length < 2) return;
    
    this.annotationCtx.strokeStyle = isSelected ? '#ff0000' : '#76ff03';
    this.annotationCtx.lineWidth = isSelected ? 3 : 2;
    this.annotationCtx.fillStyle = isSelected ? 'rgba(255, 0, 0, 0.2)' : 'rgba(118, 255, 3, 0.2)';
    
    this.annotationCtx.beginPath();
    this.annotationCtx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.annotationCtx.lineTo(points[i].x, points[i].y);
    }
    this.annotationCtx.closePath();
    this.annotationCtx.fill();
    this.annotationCtx.stroke();
    
    // Draw vertices
    this.annotationCtx.fillStyle = isSelected ? '#ff0000' : '#76ff03';
    points.forEach(point => {
      this.annotationCtx.beginPath();
      this.annotationCtx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
      this.annotationCtx.fill();
    });
  }
  
  drawTempPolygon(currentMousePos = null) {
    if (this.polygonPoints.length === 0) return;
    
    // Draw existing segments
    this.annotationCtx.strokeStyle = '#76ff03';
    this.annotationCtx.lineWidth = 2;
    this.annotationCtx.beginPath();
    this.annotationCtx.moveTo(this.polygonPoints[0].x, this.polygonPoints[0].y);
    
    for (let i = 1; i < this.polygonPoints.length; i++) {
      this.annotationCtx.lineTo(this.polygonPoints[i].x, this.polygonPoints[i].y);
    }
    
    // Draw line to current mouse position
    if (currentMousePos) {
      this.annotationCtx.lineTo(currentMousePos.x, currentMousePos.y);
      
      // Draw dotted line back to start
      this.annotationCtx.setLineDash([5, 5]);
      this.annotationCtx.lineTo(this.polygonPoints[0].x, this.polygonPoints[0].y);
      this.annotationCtx.setLineDash([]);
    }
    
    this.annotationCtx.stroke();
    
    // Draw vertices
    this.annotationCtx.fillStyle = '#76ff03';
    this.polygonPoints.forEach(point => {
      this.annotationCtx.beginPath();
      this.annotationCtx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
      this.annotationCtx.fill();
    });
    
    // Show area if we have at least 3 points
    if (this.polygonPoints.length >= 2 && currentMousePos) {
      const tempPoints = [...this.polygonPoints, currentMousePos];
      const area = this.calculatePolygonArea(tempPoints);
      
      // Calculate centroid for label placement
      let centerX = tempPoints.reduce((sum, p) => sum + p.x, 0) / tempPoints.length;
      let centerY = tempPoints.reduce((sum, p) => sum + p.y, 0) / tempPoints.length;
      
      this.annotationCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.annotationCtx.fillRect(centerX - 50, centerY - 12, 100, 24);
      this.annotationCtx.fillStyle = '#ffffff';
      this.annotationCtx.font = '12px Arial';
      this.annotationCtx.textAlign = 'center';
      this.annotationCtx.fillText(`${area.toFixed(1)} sq ft`, centerX, centerY + 4);
    }
  }
  
  drawMeasurementLabel(measurement) {
    let x, y, text;
    
    if (measurement.type === 'line') {
      x = (measurement.start.x + measurement.end.x) / 2;
      y = (measurement.start.y + measurement.end.y) / 2;
      text = `${measurement.value.toFixed(1)} ft`;
      
    } else if (measurement.type === 'area') {
      x = (measurement.start.x + measurement.end.x) / 2;
      y = (measurement.start.y + measurement.end.y) / 2;
      text = `${measurement.value.toFixed(1)} sq ft`;
      
    } else if (measurement.type === 'polygon') {
      x = measurement.points.reduce((sum, p) => sum + p.x, 0) / measurement.points.length;
      y = measurement.points.reduce((sum, p) => sum + p.y, 0) / measurement.points.length;
      text = `${measurement.value.toFixed(1)} sq ft`;
    }
    
    // Draw background
    const textWidth = this.annotationCtx.measureText(text).width;
    this.annotationCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.annotationCtx.fillRect(x - textWidth/2 - 5, y - 12, textWidth + 10, 24);
    
    // Draw text
    this.annotationCtx.fillStyle = '#ffffff';
    this.annotationCtx.font = '12px Arial';
    this.annotationCtx.textAlign = 'center';
    this.annotationCtx.fillText(text, x, y + 4);
  }
  
  highlightMeasurement(measurement) {
    this.redrawAnnotations();
  }
  
  updateMeasurementsList() {
    const list = document.getElementById('measurementsList');
    if (!list) return;
    
    list.innerHTML = '';
    
    this.measurements.forEach((m, index) => {
      const item = document.createElement('div');
      item.className = 'measurement-item';
      item.style.cssText = 'padding: 8px; margin: 4px 0; background: rgba(255,255,255,0.1); border-radius: 4px; display: flex; justify-content: space-between; align-items: center;';
      
      let typeIcon = '';
      let value = '';
      
      if (m.type === 'line') {
        typeIcon = '📏';
        value = `${m.value.toFixed(1)} ft`;
      } else if (m.type === 'area') {
        typeIcon = '⬜';
        value = `${m.value.toFixed(1)} sq ft`;
      } else if (m.type === 'polygon') {
        typeIcon = '⬟';
        value = `${m.value.toFixed(1)} sq ft`;
      }
      
      item.innerHTML = `
        <div>
          <span style="margin-right: 8px;">${typeIcon}</span>
          <span>${value}</span>
        </div>
        <button onclick="window.takeoffTool.deleteMeasurementById(${m.id})" style="background: #ff4444; color: white; border: none; padding: 2px 8px; border-radius: 3px; cursor: pointer;">✕</button>
      `;
      
      item.addEventListener('click', () => {
        this.selectedMeasurement = m;
        this.highlightMeasurement(m);
      });
      
      list.appendChild(item);
    });
  }
  
  deleteMeasurementById(id) {
    const measurement = this.measurements.find(m => m.id === id);
    if (measurement) {
      this.deleteMeasurement(measurement);
    }
  }
  
  async applyDocumentIntelligence(data) {
    if (!data) return;
    
    // Apply scale if detected
    if (data.scale) {
      this.drawingScale = data.scale;
      const scaleInput = document.getElementById('scaleInput');
      if (scaleInput) {
        scaleInput.value = data.scale;
      }
      document.getElementById('drawingScale').textContent = `1:${Math.round(data.scale)}`;
    }
    
    // Display extracted information
    const aiResults = document.getElementById('aiResults');
    if (aiResults && data.analysis) {
      let html = '<div style="color: #4caf50; font-weight: bold;">✓ Document Intelligence Applied</div>';
      
      if (data.analysis.scale) {
        html += `<div>Scale: ${data.analysis.scale}</div>`;
      }
      
      if (data.analysis.measurements && data.analysis.measurements.length > 0) {
        html += '<div style="margin-top: 10px;"><strong>Detected Measurements:</strong></div>';
        data.analysis.measurements.forEach(m => {
          html += `<div style="margin-left: 10px;">• ${m.description}: ${m.value}</div>`;
        });
      }
      
      if (data.analysis.materials && data.analysis.materials.length > 0) {
        html += '<div style="margin-top: 10px;"><strong>Materials:</strong></div>';
        data.analysis.materials.forEach(m => {
          html += `<div style="margin-left: 10px;">• ${m}</div>`;
        });
      }
      
      if (data.analysis.areas && data.analysis.areas.length > 0) {
        html += '<div style="margin-top: 10px;"><strong>Areas/Rooms:</strong></div>';
        data.analysis.areas.forEach(a => {
          html += `<div style="margin-left: 10px;">• ${a.name}: ${a.area} sq ft</div>`;
        });
      }
      
      aiResults.innerHTML = html;
    }
  }
  
  async runDocumentIntelligence() {
    if (!this.currentDrawing) {
      this.updateStatus('Please load a drawing first', 'error');
      return;
    }
    
    if (this.mode === 'view') {
      this.updateStatus('Analysis not available in view mode', 'info');
      return;
    }
    
    this.updateStatus('Running Document Intelligence analysis...', 'info');
    
    try {
      // Call the Azure function that processes blueprints
      const response = await fetch('https://workflows.saxtechnology.com/webhook/ask-foreman/BlueprintTakeoffUnified', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileUrl: this.currentDrawing.url,
          fileName: this.currentDrawing.name,
          projectId: this.projectId,
          requestDI: true,
          requestCV: true
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        this.documentIntelligenceData = result;
        this.applyDocumentIntelligence(result);
        
        // Save to project if not in view mode
        if (this.mode === 'edit') {
          await this.saveToProject(result);
        }
        
        this.updateStatus('Analysis complete', 'success');
      } else {
        throw new Error('Analysis failed');
      }
    } catch (error) {
      console.error('Document Intelligence error:', error);
      this.updateStatus('Analysis failed', 'error');
    }
  }
  
  async saveToProject(data = null) {
    if (this.mode === 'view') return;
    
    const saveData = data || {
      fileName: this.currentDrawing?.name,
      measurements: this.measurements,
      scale: this.drawingScale,
      timestamp: new Date().toISOString()
    };
    
    try {
      const response = await fetch('https://workflows.saxtechnology.com/webhook/ask-foreman/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId: this.projectId,
          category: 'takeoffs',
          fileName: `takeoff_${Date.now()}.json`,
          data: saveData
        })
      });
      
      if (response.ok) {
        this.updateStatus('Saved to project', 'success');
      }
    } catch (error) {
      console.error('Save error:', error);
      this.updateStatus('Save failed', 'error');
    }
  }
  
  sendToEstimator() {
    const data = {
      measurements: this.measurements,
      scale: this.drawingScale,
      fileName: this.currentDrawing?.name,
      documentIntelligence: this.documentIntelligenceData
    };
    
    // Send data to estimator
    if (window.receiveFromTakeoff) {
      window.receiveFromTakeoff(data);
    }
    
    // Close takeoff modal and bring estimator to front
    document.getElementById('takeoffModal').classList.remove('active');
    document.getElementById('estimateModal').classList.add('active');
    document.getElementById('estimateModal').style.zIndex = '10001';
  }
  
  setupToolButtons() {
    // Remove count tool button
    const countBtn = document.querySelector('[data-tool="count"]');
    if (countBtn) countBtn.remove();
    
    // Setup remaining tool buttons
    document.querySelectorAll('.takeoff-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.takeoff-tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTool = btn.dataset.tool;
        this.updateCursor();
        
        // Reset polygon if switching tools
        if (this.currentTool !== 'polygon') {
          this.polygonPoints = [];
          this.isDrawing = false;
          this.redrawAnnotations();
        }
      });
    });
    
    // Add scale input field
    this.addScaleInput();
    
    // Add canvas controls
    this.addCanvasControls();
    
    // Setup page navigation
    this.setupPageNavigation();
  }
  
  addScaleInput() {
    const scaleBtn = document.querySelector('[data-tool="scale"]');
    if (scaleBtn) {
      const scaleContainer = document.createElement('div');
      scaleContainer.style.cssText = 'display: inline-flex; align-items: center; margin-left: 10px;';
      scaleContainer.innerHTML = `
        <input type="number" id="scaleInput" placeholder="Scale (ft/in)" style="width: 100px; padding: 5px; margin-right: 5px;">
        <button onclick="window.takeoffTool.setManualScale()" style="padding: 5px 10px; background: #4caf50; color: white; border: none; border-radius: 3px; cursor: pointer;">Set</button>
      `;
      scaleBtn.parentNode.appendChild(scaleContainer);
    }
  }
  
  setManualScale() {
    const input = document.getElementById('scaleInput');
    if (input && input.value) {
      this.drawingScale = parseFloat(input.value);
      document.getElementById('drawingScale').textContent = `1:${Math.round(this.drawingScale)}`;
      
      // Recalculate all measurements
      this.measurements.forEach(m => {
        if (m.type === 'line') {
          m.value = this.calculateDistance(m.start, m.end);
        } else if (m.type === 'area') {
          m.value = this.calculateArea(m.start, m.end);
        } else if (m.type === 'polygon') {
          m.value = this.calculatePolygonArea(m.points);
        }
      });
      
      this.updateMeasurementsList();
      this.updateStatus(`Scale set manually: 1:${Math.round(this.drawingScale)}`, 'success');
    }
  }
  
  addCanvasControls() {
    const wrapper = document.getElementById('pdfCanvasWrapper');
    if (!wrapper) return;
    
    // Add controls overlay
    const controls = document.createElement('div');
    controls.className = 'canvas-controls';
    controls.style.cssText = 'position: absolute; top: 10px; right: 10px; display: flex; flex-direction: column; gap: 5px; z-index: 100;';
    
    controls.innerHTML = `
      <button onclick="window.takeoffTool.zoomIn()" style="width: 40px; height: 40px; background: rgba(33, 150, 243, 0.9); color: white; border: none; border-radius: 50%; cursor: pointer; font-size: 20px;">+</button>
      <button onclick="window.takeoffTool.zoomOut()" style="width: 40px; height: 40px; background: rgba(33, 150, 243, 0.9); color: white; border: none; border-radius: 50%; cursor: pointer; font-size: 20px;">-</button>
      <button onclick="window.takeoffTool.resetZoom()" style="width: 40px; height: 40px; background: rgba(158, 158, 158, 0.9); color: white; border: none; border-radius: 50%; cursor: pointer; font-size: 12px;">⟲</button>
    `;
    
    wrapper.appendChild(controls);
  }
  
  setupPageNavigation() {
    const wrapper = document.getElementById('pdfCanvasWrapper');
    if (!wrapper) return;
    
    const pageControls = document.createElement('div');
    pageControls.className = 'page-controls';
    pageControls.style.cssText = 'position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; align-items: center; background: rgba(0,0,0,0.7); padding: 5px 10px; border-radius: 20px; z-index: 100;';
    
    pageControls.innerHTML = `
      <button onclick="window.takeoffTool.previousPage()" style="width: 30px; height: 30px; background: #2196f3; color: white; border: none; border-radius: 50%; cursor: pointer;">◀</button>
      <span id="pageDisplay" style="color: white; min-width: 60px; text-align: center;">1 / 1</span>
      <button onclick="window.takeoffTool.nextPage()" style="width: 30px; height: 30px; background: #2196f3; color: white; border: none; border-radius: 50%; cursor: pointer;">▶</button>
    `;
    
    wrapper.appendChild(pageControls);
  }
  
  zoomIn() {
    this.zoomLevel = Math.min(this.zoomLevel * 1.2, 5);
    this.applyTransform();
  }
  
  zoomOut() {
    this.zoomLevel = Math.max(this.zoomLevel * 0.8, 0.5);
    this.applyTransform();
  }
  
  resetZoom() {
    this.zoomLevel = 1;
    this.panOffset = { x: 0, y: 0 };
    this.applyTransform();
  }
  
  async previousPage() {
    if (this.currentPDF && this.currentPageNum > 1) {
      this.currentPageNum--;
      await this.renderPDFPage(this.currentPageNum);
      this.updatePageInfo();
    }
  }
  
  async nextPage() {
    if (this.currentPDF && this.currentPageNum < this.totalPages) {
      this.currentPageNum++;
      await this.renderPDFPage(this.currentPageNum);
      this.updatePageInfo();
    }
  }
  
  updatePageInfo() {
    const pageDisplay = document.getElementById('pageDisplay');
    if (pageDisplay) {
      pageDisplay.textContent = `${this.currentPageNum} / ${this.totalPages}`;
    }
    
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
      pageInfo.textContent = `${this.currentPageNum} of ${this.totalPages}`;
    }
  }
  
  updateStatus(message, type = 'info') {
    const statusElement = document.getElementById('aiStatus');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.style.color = type === 'error' ? '#f44336' : 
                                  type === 'success' ? '#4caf50' : 
                                  type === 'info' ? '#2196f3' : '#888';
    }
    
    // Also add as system message if available
    if (window.addSystemMessage) {
      const icon = type === 'error' ? '❌' : 
                   type === 'success' ? '✅' : 
                   type === 'info' ? 'ℹ️' : '📋';
      window.addSystemMessage(`${icon} ${message}`);
    }
  }
  
  updateCursor() {
    const wrapper = document.getElementById('pdfCanvasWrapper');
    if (!wrapper) return;
    
    switch (this.currentTool) {
      case 'pan':
        wrapper.style.cursor = 'grab';
        break;
      case 'select':
        wrapper.style.cursor = 'pointer';
        break;
      case 'line':
      case 'area':
      case 'polygon':
        wrapper.style.cursor = 'crosshair';
        break;
      case 'scale':
        wrapper.style.cursor = 'crosshair';
        break;
      default:
        wrapper.style.cursor = 'default';
    }
  }
  
  formatProjectName(name) {
    return name.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }
  
  // Utility functions for point/shape detection
  isPointNearLine(px, py, lineStart, lineEnd, tolerance) {
    const A = px - lineStart.x;
    const B = py - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
      param = dot / lenSq;
    }
    
    let xx, yy;
    
    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }
    
    const dx = px - xx;
    const dy = py - yy;
    
    return Math.sqrt(dx * dx + dy * dy) <= tolerance;
  }
  
  isPointInRectangle(px, py, rectStart, rectEnd) {
    const minX = Math.min(rectStart.x, rectEnd.x);
    const maxX = Math.max(rectStart.x, rectEnd.x);
    const minY = Math.min(rectStart.y, rectEnd.y);
    const maxY = Math.max(rectStart.y, rectEnd.y);
    
    return px >= minX && px <= maxX && py >= minY && py <= maxY;
  }
  
  isPointInPolygon(px, py, polygon) {
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      
      const intersect = ((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      
      if (intersect) inside = !inside;
    }
    
    return inside;
  }
}

// Initialize when needed
window.EnhancedTakeoffTool = EnhancedTakeoffTool;

// Create global instance for estimator page
if (window.location.pathname.includes('estimator')) {
  window.takeoffTool = new EnhancedTakeoffTool({ mode: 'edit' });
}

// Create view-only instance for projects page
if (window.location.pathname.includes('projects')) {
  window.takeoffToolViewer = new EnhancedTakeoffTool({ mode: 'view' });
}

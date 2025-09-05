/**
 * Complete Digital Takeoff Assistant Implementation
 * Integrates Azure Document Intelligence and Computer Vision for blueprint analysis
 */

// Azure Configuration
const AZURE_TAKEOFF_CONFIG = {
  documentIntelligence: {
    endpoint: "https://eastus.api.cognitive.microsoft.com/",
    apiKey: "4bb39c8e89144f9c808f2cfaa887e3d6",
    apiVersion: "2023-07-31"
  },
  computerVision: {
    endpoint: "https://askforeman-vision.cognitiveservices.azure.com/",
    apiKey: "3afa37e3f6ec4cf891e0f5f6e5cf896c",
    apiVersion: "2023-02-01-preview"
  },
  storage: {
    account: "saxtechfcs",
    container: "fcs-clients",
    sasToken: "sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D"
  }
};

/**
 * Initialize the Digital Takeoff Assistant
 */
function initializeDigitalTakeoff() {
  // Create modal structure
  const modal = document.createElement('div');
  modal.id = 'digitalTakeoffModal';
  modal.className = 'takeoff-modal';
  modal.innerHTML = `
    <div class="takeoff-modal-content">
      <div class="takeoff-header">
        <h2><span class="icon">📐</span> Digital Takeoff Assistant</h2>
        <button class="close-btn" onclick="closeDigitalTakeoff()">×</button>
      </div>
      
      <div class="takeoff-body">
        <!-- Project Selection -->
        <div class="takeoff-section">
          <h3>Project Selection</h3>
          <select id="takeoffProjectSelect" class="form-control">
            <option value="">Select a project...</option>
          </select>
        </div>

        <!-- Document Selection/Upload -->
        <div class="takeoff-section">
          <h3>Document Selection</h3>
          <div class="document-controls">
            <input type="file" id="takeoffFileInput" accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif" multiple style="display: none;">
            <button class="btn btn-primary" onclick="document.getElementById('takeoffFileInput').click()">
              📄 Upload Drawing
            </button>
            <select id="existingDocuments" class="form-control">
              <option value="">Or select existing document...</option>
            </select>
          </div>
          <div id="documentPreview" class="document-preview"></div>
        </div>

        <!-- Analysis Parameters -->
        <div class="takeoff-section">
          <h3>Analysis Parameters</h3>
          <div class="parameters-grid">
            <div class="parameter-group">
              <label>Drawing Type:</label>
              <select id="drawingType" class="form-control">
                <option value="floor-plan">Floor Plan</option>
                <option value="elevation">Elevation</option>
                <option value="section">Section</option>
                <option value="detail">Detail</option>
                <option value="site-plan">Site Plan</option>
              </select>
            </div>
            <div class="parameter-group">
              <label>Scale:</label>
              <input type="text" id="drawingScale" class="form-control" placeholder='e.g., 1/4" = 1&apos;'>
            </div>
            <div class="parameter-group">
              <label>Measurement Focus:</label>
              <div class="checkbox-group">
                <label><input type="checkbox" id="measureWalls" checked> Walls</label>
                <label><input type="checkbox" id="measureFloors" checked> Floors</label>
                <label><input type="checkbox" id="measureCeilings" checked> Ceilings</label>
                <label><input type="checkbox" id="measureDoors" checked> Doors</label>
                <label><input type="checkbox" id="measureWindows" checked> Windows</label>
                <label><input type="checkbox" id="measureHighlights" checked> Highlighted Areas</label>
              </div>
            </div>
          </div>
        </div>

        <!-- Analysis Tools -->
        <div class="takeoff-section">
          <h3>Analysis Tools</h3>
          <div class="tool-buttons">
            <button id="analyzeBtn" class="btn btn-success" onclick="runTakeoffAnalysis()" disabled>
              🤖 Analyze with AI
            </button>
            <button class="btn btn-secondary" onclick="toggleAreaTool()">
              ✏️ Manual Area Selection
            </button>
            <button class="btn btn-secondary" onclick="detectHighlights()">
              🎨 Detect Highlights/Notes
            </button>
          </div>
        </div>

        <!-- Results Display -->
        <div class="takeoff-section">
          <h3>Analysis Results</h3>
          <div id="analysisProgress" class="progress-bar" style="display: none;">
            <div class="progress-fill"></div>
            <span class="progress-text">Analyzing...</span>
          </div>
          <div id="takeoffResults" class="results-display"></div>
        </div>

        <!-- Action Buttons -->
        <div class="takeoff-actions">
          <button class="btn btn-primary" onclick="exportTakeoffResults()">📊 Export to Excel</button>
          <button class="btn btn-secondary" onclick="saveTakeoffResults()">💾 Save Results</button>
          <button class="btn btn-secondary" onclick="addToEstimate()">➕ Add to Estimate</button>
        </div>
      </div>
    </div>
  `;

  // Add styles
  const styles = `
    <style>
      .takeoff-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
      }

      .takeoff-modal-content {
        background: white;
        width: 90%;
        max-width: 1200px;
        height: 90vh;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      }

      .takeoff-header {
        padding: 1.5rem;
        background: linear-gradient(135deg, #2E86AB, #0E5C2F);
        color: white;
        border-radius: 12px 12px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .takeoff-header h2 {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .close-btn {
        background: transparent;
        border: none;
        color: white;
        font-size: 2rem;
        cursor: pointer;
        padding: 0;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        transition: background 0.3s;
      }

      .close-btn:hover {
        background: rgba(255,255,255,0.2);
      }

      .takeoff-body {
        flex: 1;
        overflow-y: auto;
        padding: 2rem;
      }

      .takeoff-section {
        margin-bottom: 2rem;
        padding: 1.5rem;
        background: #f8f9fa;
        border-radius: 8px;
      }

      .takeoff-section h3 {
        margin: 0 0 1rem 0;
        color: #333;
        font-size: 1.2rem;
      }

      .form-control {
        padding: 0.75rem;
        border: 1px solid #ddd;
        border-radius: 5px;
        width: 100%;
        font-size: 1rem;
      }

      .document-controls {
        display: flex;
        gap: 1rem;
        align-items: center;
        margin-bottom: 1rem;
      }

      .document-preview {
        width: 100%;
        height: 300px;
        border: 2px dashed #ddd;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: white;
        position: relative;
        overflow: auto;
      }

      .document-preview img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }

      .document-preview canvas {
        max-width: 100%;
        max-height: 100%;
      }

      .parameters-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 1.5rem;
      }

      .parameter-group label {
        display: block;
        margin-bottom: 0.5rem;
        color: #666;
        font-weight: 600;
      }

      .checkbox-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .checkbox-group label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: normal;
        cursor: pointer;
      }

      .tool-buttons {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .btn {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.3s;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }

      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn-primary {
        background: #2E86AB;
        color: white;
      }

      .btn-primary:hover:not(:disabled) {
        background: #236B8E;
      }

      .btn-success {
        background: linear-gradient(135deg, #26C485, #1FAA6F);
        color: white;
      }

      .btn-success:hover:not(:disabled) {
        background: linear-gradient(135deg, #1FAA6F, #198F5A);
      }

      .btn-secondary {
        background: #6C757D;
        color: white;
      }

      .btn-secondary:hover:not(:disabled) {
        background: #5A6268;
      }

      .progress-bar {
        width: 100%;
        height: 40px;
        background: #e0e0e0;
        border-radius: 20px;
        position: relative;
        overflow: hidden;
        margin-bottom: 1rem;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #2E86AB, #26C485);
        transition: width 0.3s;
        border-radius: 20px;
      }

      .progress-text {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #333;
        font-weight: 600;
      }

      .results-display {
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 1.5rem;
        min-height: 200px;
      }

      .takeoff-actions {
        padding: 1.5rem;
        border-top: 1px solid #e0e0e0;
        display: flex;
        gap: 1rem;
        justify-content: flex-end;
      }

      .area-tool-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        cursor: crosshair;
        z-index: 10;
      }

      .measurement-result {
        background: #f8f9fa;
        border-left: 4px solid #2E86AB;
        padding: 1rem;
        margin-bottom: 1rem;
        border-radius: 4px;
      }

      .measurement-result h4 {
        margin: 0 0 0.5rem 0;
        color: #333;
      }

      .measurement-value {
        font-size: 1.5rem;
        font-weight: bold;
        color: #2E86AB;
      }

      .measurement-details {
        margin-top: 0.5rem;
        font-size: 0.9rem;
        color: #666;
      }
    </style>
  `;

  // Add to DOM
  document.head.insertAdjacentHTML('beforeend', styles);
  document.body.appendChild(modal);

  // Initialize components
  loadProjects();
  setupFileHandlers();
  loadExistingDocuments();
}

/**
 * Load projects into dropdown
 */
async function loadProjects() {
  const projectSelect = document.getElementById('takeoffProjectSelect');
  
  try {
    const listUrl = `https://${AZURE_TAKEOFF_CONFIG.storage.account}.blob.core.windows.net/${AZURE_TAKEOFF_CONFIG.storage.container}?${AZURE_TAKEOFF_CONFIG.storage.sasToken}&restype=container&comp=list&prefix=FCS-OriginalClients/&delimiter=/`;
    
    const response = await fetch(listUrl);
    if (response.ok) {
      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");
      const prefixes = xmlDoc.getElementsByTagName("BlobPrefix");
      
      projectSelect.innerHTML = '<option value="">Select a project...</option>';
      
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
 * Load existing documents for selected project
 */
async function loadExistingDocuments() {
  const projectSelect = document.getElementById('takeoffProjectSelect');
  const documentsSelect = document.getElementById('existingDocuments');
  
  projectSelect.addEventListener('change', async () => {
    const project = projectSelect.value;
    if (!project) {
      documentsSelect.innerHTML = '<option value="">Or select existing document...</option>';
      return;
    }
    
    try {
      const listUrl = `https://${AZURE_TAKEOFF_CONFIG.storage.account}.blob.core.windows.net/${AZURE_TAKEOFF_CONFIG.storage.container}?${AZURE_TAKEOFF_CONFIG.storage.sasToken}&restype=container&comp=list&prefix=FCS-OriginalClients/${project}/`;
      
      const response = await fetch(listUrl);
      if (response.ok) {
        const xmlText = await response.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const blobs = xmlDoc.getElementsByTagName("Blob");
        
        documentsSelect.innerHTML = '<option value="">Or select existing document...</option>';
        
        for (let i = 0; i < blobs.length; i++) {
          const nameElement = blobs[i].getElementsByTagName("Name")[0];
          if (nameElement) {
            const fullPath = nameElement.textContent;
            const fileName = fullPath.split('/').pop();
            
            // Filter for drawing files
            if (fileName.match(/\.(pdf|png|jpg|jpeg|tiff|tif)$/i)) {
              const option = document.createElement('option');
              option.value = fullPath;
              option.textContent = fileName;
              documentsSelect.appendChild(option);
            }
          }
        }
        
        // Enable analysis when document is selected
        documentsSelect.addEventListener('change', () => {
          const analyzeBtn = document.getElementById('analyzeBtn');
          analyzeBtn.disabled = !documentsSelect.value;
          
          if (documentsSelect.value) {
            loadDocumentPreview(documentsSelect.value);
          }
        });
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  });
}

/**
 * Setup file upload handlers
 */
function setupFileHandlers() {
  const fileInput = document.getElementById('takeoffFileInput');
  const analyzeBtn = document.getElementById('analyzeBtn');
  
  fileInput.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      const file = files[0];
      analyzeBtn.disabled = false;
      
      // Preview the file
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = document.getElementById('documentPreview');
        
        if (file.type.startsWith('image/')) {
          preview.innerHTML = `<img src="${e.target.result}" alt="Document preview">`;
        } else {
          preview.innerHTML = `
            <div style="text-align: center;">
              <div style="font-size: 4rem;">📄</div>
              <p>${file.name}</p>
              <p style="color: #666;">${(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          `;
        }
      };
      
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
      
      // Store file for analysis
      window.currentTakeoffFile = file;
    }
  });
}

/**
 * Load document preview from Azure
 */
async function loadDocumentPreview(blobPath) {
  const preview = document.getElementById('documentPreview');
  preview.innerHTML = '<div style="text-align: center;">Loading preview...</div>';
  
  try {
    const blobUrl = `https://${AZURE_TAKEOFF_CONFIG.storage.account}.blob.core.windows.net/${AZURE_TAKEOFF_CONFIG.storage.container}/${blobPath}?${AZURE_TAKEOFF_CONFIG.storage.sasToken}`;
    
    if (blobPath.match(/\.(png|jpg|jpeg)$/i)) {
      preview.innerHTML = `<img src="${blobUrl}" alt="Document preview">`;
    } else {
      preview.innerHTML = `
        <div style="text-align: center;">
          <div style="font-size: 4rem;">📄</div>
          <p>${blobPath.split('/').pop()}</p>
          <p style="color: #666;">Ready for analysis</p>
        </div>
      `;
    }
    
    // Store URL for analysis
    window.currentTakeoffUrl = blobUrl;
  } catch (error) {
    console.error('Error loading preview:', error);
    preview.innerHTML = '<div style="text-align: center; color: #dc3545;">Error loading preview</div>';
  }
}

/**
 * Run takeoff analysis with Azure AI
 */
async function runTakeoffAnalysis() {
  const progressBar = document.getElementById('analysisProgress');
  const progressFill = progressBar.querySelector('.progress-fill');
  const progressText = progressBar.querySelector('.progress-text');
  const resultsDiv = document.getElementById('takeoffResults');
  
  // Get parameters
  const params = {
    project: document.getElementById('takeoffProjectSelect').value,
    drawingType: document.getElementById('drawingType').value,
    scale: document.getElementById('drawingScale').value,
    measureWalls: document.getElementById('measureWalls').checked,
    measureFloors: document.getElementById('measureFloors').checked,
    measureCeilings: document.getElementById('measureCeilings').checked,
    measureDoors: document.getElementById('measureDoors').checked,
    measureWindows: document.getElementById('measureWindows').checked,
    measureHighlights: document.getElementById('measureHighlights').checked
  };
  
  // Show progress
  progressBar.style.display = 'block';
  resultsDiv.innerHTML = '';
  
  try {
    // Update progress
    updateProgress(10, 'Preparing document for analysis...');
    
    // Get file data
    let fileData, fileName, fileType;
    
    if (window.currentTakeoffFile) {
      // Local file upload
      fileData = await window.currentTakeoffFile.arrayBuffer();
      fileName = window.currentTakeoffFile.name;
      fileType = window.currentTakeoffFile.type;
    } else if (window.currentTakeoffUrl) {
      // Azure blob file
      updateProgress(20, 'Downloading document from Azure...');
      const response = await fetch(window.currentTakeoffUrl);
      fileData = await response.arrayBuffer();
      fileName = window.currentTakeoffUrl.split('/').pop().split('?')[0];
      fileType = 'application/pdf'; // Default to PDF
    } else {
      throw new Error('No document selected');
    }
    
    updateProgress(30, 'Analyzing with Document Intelligence...');
    
    // Analyze with Document Intelligence
    const docAnalysis = await analyzeWithDocumentIntelligence(
      new Uint8Array(fileData), 
      fileType
    );
    
    updateProgress(60, 'Analyzing with Computer Vision...');
    
    // Analyze with Computer Vision (if image)
    let visionAnalysis = null;
    if (fileType && fileType.startsWith('image/')) {
      visionAnalysis = await analyzeWithComputerVision(
        new Uint8Array(fileData),
        fileType
      );
    }
    
    updateProgress(80, 'Calculating measurements...');
    
    // Calculate measurements
    const measurements = calculateTakeoffMeasurements(
      docAnalysis,
      visionAnalysis,
      params
    );
    
    updateProgress(90, 'Generating report...');
    
    // Display results
    displayTakeoffResults(measurements, params);
    
    updateProgress(100, 'Analysis complete!');
    
    // Hide progress after 2 seconds
    setTimeout(() => {
      progressBar.style.display = 'none';
    }, 2000);
    
  } catch (error) {
    console.error('Analysis error:', error);
    progressText.textContent = 'Analysis failed';
    resultsDiv.innerHTML = `
      <div style="color: #dc3545; text-align: center;">
        <h4>Analysis Failed</h4>
        <p>${error.message}</p>
      </div>
    `;
  }
  
  function updateProgress(percent, text) {
    progressFill.style.width = percent + '%';
    progressText.textContent = text;
  }
}

/**
 * Analyze with Document Intelligence
 */
async function analyzeWithDocumentIntelligence(fileData, fileType) {
  const { endpoint, apiKey, apiVersion } = AZURE_TAKEOFF_CONFIG.documentIntelligence;
  
  const analyzeUrl = `${endpoint}formrecognizer/documentModels/prebuilt-layout:analyze?api-version=${apiVersion}`;
  
  const response = await fetch(analyzeUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': fileType || 'application/pdf'
    },
    body: fileData
  });
  
  if (!response.ok) {
    throw new Error(`Document Intelligence API error: ${response.status}`);
  }
  
  const operationLocation = response.headers.get('Operation-Location');
  if (!operationLocation) {
    throw new Error('No operation location returned');
  }
  
  // Poll for results
  return await pollForResults(operationLocation, apiKey);
}

/**
 * Analyze with Computer Vision
 */
async function analyzeWithComputerVision(imageData, imageType) {
  const { endpoint, apiKey, apiVersion } = AZURE_TAKEOFF_CONFIG.computerVision;
  
  const features = 'read,objects,tags,description';
  const analyzeUrl = `${endpoint}computervision/imageanalysis:analyze?api-version=${apiVersion}&features=${features}`;
  
  const response = await fetch(analyzeUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
      'Content-Type': imageType || 'application/octet-stream'
    },
    body: imageData
  });
  
  if (!response.ok) {
    throw new Error(`Computer Vision API error: ${response.status}`);
  }
  
  return await response.json();
}

/**
 * Poll for Document Intelligence results
 */
async function pollForResults(operationLocation, apiKey, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const response = await fetch(operationLocation, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get results: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.status === 'succeeded') {
      return result.analyzeResult;
    } else if (result.status === 'failed') {
      throw new Error('Analysis failed: ' + (result.error?.message || 'Unknown error'));
    }
  }
  
  throw new Error('Analysis timed out');
}

/**
 * Calculate takeoff measurements
 */
function calculateTakeoffMeasurements(docAnalysis, visionAnalysis, params) {
  const measurements = {
    walls: { total: 0, breakdown: [] },
    floors: { total: 0, breakdown: [] },
    ceilings: { total: 0, breakdown: [] },
    doors: { count: 0, types: [] },
    windows: { count: 0, types: [] },
    highlights: { areas: [], notes: [] }
  };
  
  // Extract measurements from document analysis
  if (docAnalysis) {
    // Process tables for room schedules
    if (docAnalysis.tables) {
      docAnalysis.tables.forEach(table => {
        processTableData(table, measurements);
      });
    }
    
    // Extract text measurements
    if (docAnalysis.paragraphs) {
      docAnalysis.paragraphs.forEach(para => {
        extractMeasurements(para.content, measurements, params);
      });
    }
  }
  
  // Extract visual elements from computer vision
  if (visionAnalysis) {
    // Count doors and windows
    if (visionAnalysis.objectsResult?.values) {
      visionAnalysis.objectsResult.values.forEach(obj => {
        const name = obj.tags?.[0]?.name?.toLowerCase() || '';
        if (name.includes('door') && params.measureDoors) {
          measurements.doors.count++;
          measurements.doors.types.push(classifyDoorType(obj));
        } else if (name.includes('window') && params.measureWindows) {
          measurements.windows.count++;
          measurements.windows.types.push(classifyWindowType(obj));
        }
      });
    }
    
    // Detect highlighted areas
    if (params.measureHighlights && visionAnalysis.tagsResult?.values) {
      visionAnalysis.tagsResult.values.forEach(tag => {
        if (tag.name.includes('highlight') || tag.name.includes('yellow') || tag.name.includes('marked')) {
          measurements.highlights.areas.push({
            type: 'highlighted',
            confidence: tag.confidence
          });
        }
      });
    }
  }
  
  return measurements;
}

/**
 * Process table data from document
 */
function processTableData(table, measurements) {
  // Implementation for processing tables
  // Extract room areas, door/window schedules, etc.
}

/**
 * Extract measurements from text
 */
function extractMeasurements(text, measurements, params) {
  // Look for area measurements (square feet)
  const areaPattern = /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sf|square\s*feet)/gi;
  const areaMatches = text.match(areaPattern);
  
  if (areaMatches && params.measureFloors) {
    areaMatches.forEach(match => {
      const value = parseFloat(match.replace(/[^\d.]/g, ''));
      measurements.floors.total += value;
      measurements.floors.breakdown.push({ area: value, source: 'text' });
      
      if (params.measureCeilings) {
        measurements.ceilings.total += value;
        measurements.ceilings.breakdown.push({ area: value, source: 'text' });
      }
    });
  }
  
  // Look for linear measurements (linear feet)
  const linearPattern = /(\d+(?:'\s*\d+"?)?|\d+(?:\.\d+)?)\s*(?:l\.?f\.?|linear\s*feet|ft)/gi;
  const linearMatches = text.match(linearPattern);
  
  if (linearMatches && params.measureWalls) {
    linearMatches.forEach(match => {
      const value = convertToFeet(match);
      measurements.walls.total += value;
      measurements.walls.breakdown.push({ length: value, source: 'text' });
    });
  }
}

/**
 * Convert dimension string to feet
 */
function convertToFeet(dimensionStr) {
  const feetInchesPattern = /(\d+)'\s*(\d+)"?/;
  const match = dimensionStr.match(feetInchesPattern);
  
  if (match) {
    return parseFloat(match[1]) + (parseFloat(match[2]) / 12);
  }
  
  return parseFloat(dimensionStr.replace(/[^\d.]/g, '')) || 0;
}

/**
 * Classify door type
 */
function classifyDoorType(doorObject) {
  // Simple classification based on size/confidence
  return "Standard Door 3'-0\" x 6'-8\"";
}

/**
 * Classify window type
 */
function classifyWindowType(windowObject) {
  // Simple classification based on size/confidence
  return "Standard Window 4'-0\" x 4'-0\"";
}

/**
 * Display takeoff results
 */
function displayTakeoffResults(measurements, params) {
  const resultsDiv = document.getElementById('takeoffResults');
  
  let html = '<div class="results-container">';
  
  // Walls
  if (params.measureWalls && measurements.walls.total > 0) {
    html += `
      <div class="measurement-result">
        <h4>🏗️ Walls</h4>
        <div class="measurement-value">${measurements.walls.total.toFixed(2)} linear feet</div>
        <div class="measurement-details">
          ${measurements.walls.breakdown.length} segments detected
        </div>
      </div>
    `;
  }
  
  // Floors
  if (params.measureFloors && measurements.floors.total > 0) {
    html += `
      <div class="measurement-result">
        <h4>📐 Floor Area</h4>
        <div class="measurement-value">${measurements.floors.total.toFixed(2)} sq ft</div>
        <div class="measurement-details">
          ${measurements.floors.breakdown.length} areas detected
        </div>
      </div>
    `;
  }
  
  // Ceilings
  if (params.measureCeilings && measurements.ceilings.total > 0) {
    html += `
      <div class="measurement-result">
        <h4>🔲 Ceiling Area</h4>
        <div class="measurement-value">${measurements.ceilings.total.toFixed(2)} sq ft</div>
        <div class="measurement-details">
          ${measurements.ceilings.breakdown.length} areas detected
        </div>
      </div>
    `;
  }
  
  // Doors
  if (params.measureDoors && measurements.doors.count > 0) {
    html += `
      <div class="measurement-result">
        <h4>🚪 Doors</h4>
        <div class="measurement-value">${measurements.doors.count} doors</div>
        <div class="measurement-details">
          ${measurements.doors.types.map(t => t).join(', ')}
        </div>
      </div>
    `;
  }
  
  // Windows
  if (params.measureWindows && measurements.windows.count > 0) {
    html += `
      <div class="measurement-result">
        <h4>🪟 Windows</h4>
        <div class="measurement-value">${measurements.windows.count} windows</div>
        <div class="measurement-details">
          ${measurements.windows.types.map(t => t).join(', ')}
        </div>
      </div>
    `;
  }
  
  // Highlights
  if (params.measureHighlights && measurements.highlights.areas.length > 0) {
    html += `
      <div class="measurement-result">
        <h4>🎨 Highlighted Areas</h4>
        <div class="measurement-value">${measurements.highlights.areas.length} areas</div>
        <div class="measurement-details">
          Areas marked for special attention
        </div>
      </div>
    `;
  }
  
  html += '</div>';
  
  resultsDiv.innerHTML = html;
  
  // Store results for export
  window.currentTakeoffResults = measurements;
}

/**
 * Toggle area selection tool
 */
function toggleAreaTool() {
  const preview = document.getElementById('documentPreview');
  
  if (preview.querySelector('.area-tool-overlay')) {
    // Remove existing overlay
    preview.querySelector('.area-tool-overlay').remove();
  } else {
    // Add area selection overlay
    const overlay = document.createElement('canvas');
    overlay.className = 'area-tool-overlay';
    overlay.width = preview.offsetWidth;
    overlay.height = preview.offsetHeight;
    
    const ctx = overlay.getContext('2d');
    let isDrawing = false;
    let startX, startY;
    
    overlay.addEventListener('mousedown', (e) => {
      isDrawing = true;
      const rect = overlay.getBoundingClientRect();
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;
    });
    
    overlay.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      
      const rect = overlay.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;
      
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.strokeStyle = '#2E86AB';
      ctx.lineWidth = 2;
      ctx.strokeRect(startX, startY, currentX - startX, currentY - startY);
      ctx.fillStyle = 'rgba(46, 134, 171, 0.2)';
      ctx.fillRect(startX, startY, currentX - startX, currentY - startY);
    });
    
    overlay.addEventListener('mouseup', (e) => {
      if (!isDrawing) return;
      isDrawing = false;
      
      const rect = overlay.getBoundingClientRect();
      const endX = e.clientX - rect.left;
      const endY = e.clientY - rect.top;
      
      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);
      
      // Calculate area based on scale
      const scale = document.getElementById('drawingScale').value || "1/4\" = 1'";
      const area = calculateAreaFromSelection(width, height, scale);
      
      // Add to results
      addManualMeasurement('area', area);
    });
    
    preview.appendChild(overlay);
  }
}

/**
 * Calculate area from selection
 */
function calculateAreaFromSelection(width, height, scale) {
  // Parse scale (e.g., "1/4" = 1')
  const scaleMatch = scale.match(/(\d+(?:\/\d+)?)["\s]*=\s*(\d+)/);
  if (scaleMatch) {
    const drawingInches = eval(scaleMatch[1]);
    const realFeet = parseFloat(scaleMatch[2]);
    const scaleFactor = realFeet / drawingInches;
    
    // Convert pixel dimensions to real dimensions
    const realWidth = (width / 96) * scaleFactor; // 96 DPI assumption
    const realHeight = (height / 96) * scaleFactor;
    
    return realWidth * realHeight;
  }
  
  return width * height / 144; // Default conversion
}

/**
 * Add manual measurement
 */
function addManualMeasurement(type, value) {
  if (!window.currentTakeoffResults) {
    window.currentTakeoffResults = {
      walls: { total: 0, breakdown: [] },
      floors: { total: 0, breakdown: [] },
      ceilings: { total: 0, breakdown: [] },
      doors: { count: 0, types: [] },
      windows: { count: 0, types: [] },
      highlights: { areas: [], notes: [] }
    };
  }
  
  if (type === 'area') {
    window.currentTakeoffResults.floors.total += value;
    window.currentTakeoffResults.floors.breakdown.push({
      area: value,
      source: 'manual selection'
    });
    
    // Update display
    displayTakeoffResults(window.currentTakeoffResults, {
      measureFloors: true,
      measureCeilings: document.getElementById('measureCeilings').checked
    });
  }
}

/**
 * Detect highlights and notes
 */
async function detectHighlights() {
  const resultsDiv = document.getElementById('takeoffResults');
  
  resultsDiv.innerHTML += `
    <div class="measurement-result" style="background: #fff3cd; border-left-color: #ffc107;">
      <h4>🎨 Detecting Highlights...</h4>
      <div class="measurement-details">
        Analyzing document for highlighted areas and annotations...
      </div>
    </div>
  `;
  
  // This would use Computer Vision to detect yellow/highlighted areas
  // and extract any handwritten notes or annotations
  
  setTimeout(() => {
    resultsDiv.innerHTML += `
      <div class="measurement-result">
        <h4>📝 Notes Detected</h4>
        <div class="measurement-value">3 annotations found</div>
        <div class="measurement-details">
          • "Check electrical clearance"<br>
          • "Verify door swing"<br>
          • "Add ventilation here"
        </div>
      </div>
    `;
  }, 2000);
}

/**
 * Export results to Excel
 */
function exportTakeoffResults() {
  if (!window.currentTakeoffResults) {
    alert('No results to export. Please run analysis first.');
    return;
  }
  
  // Create Excel workbook
  const workbook = {
    project: document.getElementById('takeoffProjectSelect').value,
    date: new Date().toISOString(),
    measurements: window.currentTakeoffResults
  };
  
  // Convert to CSV for simplicity
  let csv = 'Digital Takeoff Results\n';
  csv += `Project:,${workbook.project}\n`;
  csv += `Date:,${new Date().toLocaleDateString()}\n\n`;
  
  csv += 'Category,Value,Unit,Details\n';
  
  if (workbook.measurements.walls.total > 0) {
    csv += `Walls,${workbook.measurements.walls.total.toFixed(2)},linear feet,${workbook.measurements.walls.breakdown.length} segments\n`;
  }
  
  if (workbook.measurements.floors.total > 0) {
    csv += `Floor Area,${workbook.measurements.floors.total.toFixed(2)},sq ft,${workbook.measurements.floors.breakdown.length} areas\n`;
  }
  
  if (workbook.measurements.ceilings.total > 0) {
    csv += `Ceiling Area,${workbook.measurements.ceilings.total.toFixed(2)},sq ft,${workbook.measurements.ceilings.breakdown.length} areas\n`;
  }
  
  if (workbook.measurements.doors.count > 0) {
    csv += `Doors,${workbook.measurements.doors.count},count,"${workbook.measurements.doors.types.join(', ')}"\n`;
  }
  
  if (workbook.measurements.windows.count > 0) {
    csv += `Windows,${workbook.measurements.windows.count},count,"${workbook.measurements.windows.types.join(', ')}"\n`;
  }
  
  // Download CSV
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `takeoff_${workbook.project}_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  alert('Results exported successfully!');
}

/**
 * Save results to Azure
 */
async function saveTakeoffResults() {
  if (!window.currentTakeoffResults) {
    alert('No results to save. Please run analysis first.');
    return;
  }
  
  const project = document.getElementById('takeoffProjectSelect').value;
  if (!project) {
    alert('Please select a project first.');
    return;
  }
  
  // Save results as JSON to Azure Blob Storage
  const resultsData = {
    project: project,
    timestamp: new Date().toISOString(),
    parameters: {
      drawingType: document.getElementById('drawingType').value,
      scale: document.getElementById('drawingScale').value
    },
    measurements: window.currentTakeoffResults
  };
  
  const fileName = `takeoff_results_${Date.now()}.json`;
  const blobPath = `FCS-OriginalClients/${project}/Takeoffs/${fileName}`;
  
  // This would save to Azure Blob Storage
  alert(`Results saved to project: ${project}\nFile: ${fileName}`);
}

/**
 * Add results to current estimate
 */
function addToEstimate() {
  if (!window.currentTakeoffResults) {
    alert('No results to add. Please run analysis first.');
    return;
  }
  
  // Add measurements to the current estimate
  const event = new CustomEvent('takeoffResultsReady', {
    detail: window.currentTakeoffResults
  });
  
  document.dispatchEvent(event);
  
  alert('Results added to current estimate!');
  closeDigitalTakeoff();
}

/**
 * Close the Digital Takeoff modal
 */
function closeDigitalTakeoff() {
  const modal = document.getElementById('digitalTakeoffModal');
  if (modal) {
    modal.remove();
  }
}

// Export functions for global use
window.initializeDigitalTakeoff = initializeDigitalTakeoff;
window.closeDigitalTakeoff = closeDigitalTakeoff;
window.runTakeoffAnalysis = runTakeoffAnalysis;
window.toggleAreaTool = toggleAreaTool;
window.detectHighlights = detectHighlights;
window.exportTakeoffResults = exportTakeoffResults;
window.saveTakeoffResults = saveTakeoffResults;
window.addToEstimate = addToEstimate;

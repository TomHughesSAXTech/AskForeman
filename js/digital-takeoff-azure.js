/**
 * Digital Takeoff Assistant with Azure AI Integration
 * Uses real Azure Computer Vision and Document Intelligence APIs
 */

// Azure AI Configuration (uses keys from estimator.html)
const TAKEOFF_AI_CONFIG = {
  documentIntelligence: {
    endpoint: "https://saxtechfcs-docintell.cognitiveservices.azure.com/",
    apiKey: "4bb39c8e89144f9c808f2cfaa887e3d6",
    apiVersion: "2023-07-31"
  },
  computerVision: {
    endpoint: "https://askforeman-vision.cognitiveservices.azure.com/",
    apiKey: "3afa37e3f6ec4cf891e0f5f6e5cf896c",
    apiVersion: "2023-02-01-preview"
  }
};

/**
 * Analyze drawing with Azure Document Intelligence
 * Extracts text, tables, and layout information
 */
async function analyzeWithDocumentIntelligence(fileData, fileType) {
  const { endpoint, apiKey, apiVersion } = TAKEOFF_AI_CONFIG.documentIntelligence;
  
  // Use the prebuilt layout model for architectural drawings
  const analyzeUrl = `${endpoint}formrecognizer/documentModels/prebuilt-layout:analyze?api-version=${apiVersion}`;
  
  try {
    // Start analysis
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
    
    // Get the operation location from headers
    const operationLocation = response.headers.get('Operation-Location');
    if (!operationLocation) {
      throw new Error('No operation location returned');
    }
    
    // Poll for results
    const result = await pollForResults(operationLocation, apiKey);
    return extractLayoutInfo(result);
    
  } catch (error) {
    console.error('Document Intelligence error:', error);
    throw error;
  }
}

/**
 * Analyze image with Azure Computer Vision
 * Detects objects, reads text, and analyzes image content
 */
async function analyzeWithComputerVision(imageData, imageType) {
  const { endpoint, apiKey, apiVersion } = TAKEOFF_AI_CONFIG.computerVision;
  
  // Use multiple features for comprehensive analysis
  const features = 'read,objects,tags,description';
  const analyzeUrl = `${endpoint}computervision/imageanalysis:analyze?api-version=${apiVersion}&features=${features}`;
  
  try {
    const response = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': imageType || 'application/octet-stream'
      },
      body: imageData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Computer Vision API error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    return extractVisionInfo(result);
    
  } catch (error) {
    console.error('Computer Vision error:', error);
    throw error;
  }
}

/**
 * Poll for Document Intelligence results
 */
async function pollForResults(operationLocation, apiKey, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    
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
    
    // Still running, continue polling
  }
  
  throw new Error('Analysis timed out');
}

/**
 * Extract layout information from Document Intelligence results
 */
function extractLayoutInfo(analyzeResult) {
  const extracted = {
    text: '',
    tables: [],
    dimensions: [],
    roomLabels: [],
    measurements: [],
    scale: null
  };
  
  // Extract all text
  if (analyzeResult.content) {
    extracted.text = analyzeResult.content;
  }
  
  // Extract tables (often contain room schedules, door/window schedules)
  if (analyzeResult.tables) {
    analyzeResult.tables.forEach(table => {
      const tableData = {
        rows: table.rowCount,
        columns: table.columnCount,
        cells: []
      };
      
      table.cells.forEach(cell => {
        tableData.cells.push({
          row: cell.rowIndex,
          column: cell.columnIndex,
          content: cell.content,
          kind: cell.kind // columnHeader, rowHeader, content
        });
      });
      
      extracted.tables.push(tableData);
    });
  }
  
  // Extract key-value pairs (often contain project info, scale, etc.)
  if (analyzeResult.keyValuePairs) {
    analyzeResult.keyValuePairs.forEach(kvp => {
      const key = kvp.key?.content?.toLowerCase() || '';
      const value = kvp.value?.content || '';
      
      // Look for scale information
      if (key.includes('scale') || value.match(/\d+['"]\s*=\s*\d+['"]/)) {
        extracted.scale = value;
      }
      
      // Look for dimensions
      if (value.match(/\d+['-]\d+["]/) || value.match(/\d+\.\d+/)) {
        extracted.dimensions.push({
          key: kvp.key?.content,
          value: value,
          confidence: kvp.confidence
        });
      }
    });
  }
  
  // Extract paragraphs and look for room labels
  if (analyzeResult.paragraphs) {
    analyzeResult.paragraphs.forEach(paragraph => {
      const text = paragraph.content;
      
      // Look for room identifiers
      if (text.match(/room\s+\d+/i) || text.match(/rm\s+\d+/i)) {
        extracted.roomLabels.push({
          text: text,
          boundingBox: paragraph.boundingRegions?.[0]?.polygon
        });
      }
      
      // Look for measurements
      const measurementPattern = /(\d+['-]\d+["']?|\d+\.\d+\s*(ft|m|sf|sq\s*ft))/gi;
      const measurements = text.match(measurementPattern);
      if (measurements) {
        measurements.forEach(m => {
          extracted.measurements.push({
            value: m,
            context: text,
            boundingBox: paragraph.boundingRegions?.[0]?.polygon
          });
        });
      }
    });
  }
  
  return extracted;
}

/**
 * Extract vision information from Computer Vision results
 */
function extractVisionInfo(visionResult) {
  const extracted = {
    objects: [],
    text: [],
    tags: [],
    description: ''
  };
  
  // Extract detected objects (doors, windows, fixtures, etc.)
  if (visionResult.objectsResult?.values) {
    visionResult.objectsResult.values.forEach(obj => {
      extracted.objects.push({
        name: obj.tags?.[0]?.name || 'unknown',
        confidence: obj.tags?.[0]?.confidence || 0,
        boundingBox: obj.boundingBox
      });
    });
  }
  
  // Extract read text (OCR)
  if (visionResult.readResult?.blocks) {
    visionResult.readResult.blocks.forEach(block => {
      block.lines?.forEach(line => {
        extracted.text.push({
          text: line.text,
          boundingBox: line.boundingPolygon
        });
      });
    });
  }
  
  // Extract tags (general image content)
  if (visionResult.tagsResult?.values) {
    visionResult.tagsResult.values.forEach(tag => {
      if (tag.confidence > 0.7) {
        extracted.tags.push({
          name: tag.name,
          confidence: tag.confidence
        });
      }
    });
  }
  
  // Extract description
  if (visionResult.captionResult?.text) {
    extracted.description = visionResult.captionResult.text;
  }
  
  return extracted;
}

/**
 * Calculate measurements from extracted data
 */
function calculateMeasurements(layoutInfo, visionInfo, parameters) {
  const measurements = {
    walls: { total: 0, breakdown: [], unit: 'linear feet' },
    floors: { total: 0, breakdown: [], unit: 'square feet' },
    ceilings: { total: 0, breakdown: [], unit: 'square feet' },
    doors: { total: 0, types: [], unit: 'count' },
    windows: { total: 0, types: [], unit: 'count' },
    fixtures: { total: 0, types: [], unit: 'count' }
  };
  
  // Parse scale if provided
  let scaleFactor = 1;
  if (layoutInfo.scale) {
    const scaleMatch = layoutInfo.scale.match(/(\d+(?:\/\d+)?)['"]\s*=\s*(\d+)['"]?/);
    if (scaleMatch) {
      const drawingSize = eval(scaleMatch[1]); // e.g., "1/4" becomes 0.25
      const realSize = parseFloat(scaleMatch[2]);
      scaleFactor = realSize / drawingSize;
    }
  }
  
  // Process room labels and associated measurements
  const rooms = new Map();
  
  layoutInfo.roomLabels.forEach(room => {
    const roomName = room.text;
    if (!rooms.has(roomName)) {
      rooms.set(roomName, {
        dimensions: [],
        area: 0,
        perimeter: 0
      });
    }
  });
  
  // Process measurements
  layoutInfo.measurements.forEach(m => {
    const value = parseFloat(m.value.replace(/[^\d.]/g, ''));
    
    // Determine if it's a dimension or area based on context
    if (m.value.includes('sf') || m.value.includes('sq')) {
      // It's an area measurement
      if (parameters.measureFloors) {
        measurements.floors.total += value;
        measurements.floors.breakdown.push({
          room: extractRoomFromContext(m.context),
          value: value
        });
      }
      if (parameters.measureCeilings) {
        measurements.ceilings.total = measurements.floors.total;
        measurements.ceilings.breakdown = [...measurements.floors.breakdown];
      }
    } else if (m.value.includes("'") || m.value.includes('"')) {
      // It's a linear measurement
      if (parameters.measureWalls) {
        const linearFeet = convertToFeet(m.value);
        measurements.walls.total += linearFeet;
        measurements.walls.breakdown.push({
          room: extractRoomFromContext(m.context),
          value: linearFeet
        });
      }
    }
  });
  
  // Process detected objects
  const doorTypes = new Map();
  const windowTypes = new Map();
  const fixtureTypes = new Map();
  
  visionInfo.objects.forEach(obj => {
    const name = obj.name.toLowerCase();
    
    if (name.includes('door') && parameters.measureDoors) {
      const type = classifyDoor(obj);
      doorTypes.set(type, (doorTypes.get(type) || 0) + 1);
      measurements.doors.total++;
    } else if (name.includes('window') && parameters.measureWindows) {
      const type = classifyWindow(obj);
      windowTypes.set(type, (windowTypes.get(type) || 0) + 1);
      measurements.windows.total++;
    } else if ((name.includes('fixture') || name.includes('hvac') || name.includes('electrical')) && parameters.measureFixtures) {
      fixtureTypes.set(name, (fixtureTypes.get(name) || 0) + 1);
      measurements.fixtures.total++;
    }
  });
  
  // Convert maps to arrays
  doorTypes.forEach((count, type) => {
    measurements.doors.types.push({ type, count });
  });
  
  windowTypes.forEach((count, type) => {
    measurements.windows.types.push({ type, count });
  });
  
  fixtureTypes.forEach((count, type) => {
    measurements.fixtures.types.push({ type, count });
  });
  
  // Process tables for additional information
  layoutInfo.tables.forEach(table => {
    // Look for door/window schedules
    const headers = table.cells.filter(c => c.kind === 'columnHeader').map(c => c.content.toLowerCase());
    
    if (headers.some(h => h.includes('door') || h.includes('opening'))) {
      // Process door schedule
      processDoorSchedule(table, measurements.doors);
    } else if (headers.some(h => h.includes('window'))) {
      // Process window schedule
      processWindowSchedule(table, measurements.windows);
    } else if (headers.some(h => h.includes('room') && h.includes('area'))) {
      // Process room schedule
      processRoomSchedule(table, measurements);
    }
  });
  
  return measurements;
}

/**
 * Helper functions for measurement calculations
 */
function convertToFeet(dimensionStr) {
  const match = dimensionStr.match(/(\d+)['-](\d+)["']?/);
  if (match) {
    return parseFloat(match[1]) + (parseFloat(match[2]) / 12);
  }
  return parseFloat(dimensionStr) || 0;
}

function extractRoomFromContext(context) {
  const roomMatch = context.match(/(room|rm)\s+(\d+\w*)/i);
  if (roomMatch) {
    return `Room ${roomMatch[2]}`;
  }
  
  // Try to find other room identifiers
  const patterns = [
    /(\w+\s+office)/i,
    /(\w+\s+conference)/i,
    /(corridor|hallway)/i,
    /(lobby|reception)/i,
    /(bathroom|restroom)/i,
    /(kitchen|break\s*room)/i
  ];
  
  for (const pattern of patterns) {
    const match = context.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return 'Unspecified';
}

function classifyDoor(doorObject) {
  // Estimate door size based on bounding box if available
  if (doorObject.boundingBox) {
    const width = doorObject.boundingBox.w;
    const height = doorObject.boundingBox.h;
    const aspectRatio = width / height;
    
    if (aspectRatio > 1.5) {
      return "Double Door 6'-0\" x 7'-0\"";
    } else if (height > width * 2) {
      return "Single Door 3'-0\" x 7'-0\"";
    }
  }
  
  return "Standard Door 3'-0\" x 6'-8\"";
}

function classifyWindow(windowObject) {
  // Estimate window size based on bounding box if available
  if (windowObject.boundingBox) {
    const width = windowObject.boundingBox.w;
    const height = windowObject.boundingBox.h;
    
    if (width > height * 1.5) {
      return "Wide Window 6'-0\" x 4'-0\"";
    } else if (height > width) {
      return "Tall Window 3'-0\" x 5'-0\"";
    }
  }
  
  return "Standard Window 4'-0\" x 4'-0\"";
}

function processDoorSchedule(table, doorMeasurements) {
  // Find relevant columns
  const headers = table.cells.filter(c => c.kind === 'columnHeader');
  const sizeCol = headers.findIndex(h => h.content.toLowerCase().includes('size') || h.content.toLowerCase().includes('dim'));
  const qtyCol = headers.findIndex(h => h.content.toLowerCase().includes('qty') || h.content.toLowerCase().includes('count'));
  const typeCol = headers.findIndex(h => h.content.toLowerCase().includes('type') || h.content.toLowerCase().includes('mark'));
  
  // Process data rows
  const dataRows = new Map();
  
  table.cells.filter(c => c.kind === 'content').forEach(cell => {
    if (!dataRows.has(cell.row)) {
      dataRows.set(cell.row, {});
    }
    dataRows.get(cell.row)[cell.column] = cell.content;
  });
  
  // Extract door information
  dataRows.forEach(row => {
    const size = row[sizeCol] || 'Unknown';
    const qty = parseInt(row[qtyCol]) || 1;
    const type = row[typeCol] || size;
    
    // Update door measurements
    const existingType = doorMeasurements.types.find(t => t.type === type);
    if (existingType) {
      existingType.count += qty;
    } else {
      doorMeasurements.types.push({ type, count: qty });
    }
    doorMeasurements.total += qty;
  });
}

function processWindowSchedule(table, windowMeasurements) {
  // Similar to door schedule processing
  processDoorSchedule(table, windowMeasurements);
}

function processRoomSchedule(table, measurements) {
  // Find relevant columns
  const headers = table.cells.filter(c => c.kind === 'columnHeader');
  const roomCol = headers.findIndex(h => h.content.toLowerCase().includes('room') || h.content.toLowerCase().includes('space'));
  const areaCol = headers.findIndex(h => h.content.toLowerCase().includes('area') || h.content.toLowerCase().includes('sf'));
  
  // Process data rows
  const dataRows = new Map();
  
  table.cells.filter(c => c.kind === 'content').forEach(cell => {
    if (!dataRows.has(cell.row)) {
      dataRows.set(cell.row, {});
    }
    dataRows.get(cell.row)[cell.column] = cell.content;
  });
  
  // Extract room areas
  dataRows.forEach(row => {
    const roomName = row[roomCol] || 'Unknown';
    const area = parseFloat(row[areaCol]?.replace(/[^\d.]/g, '')) || 0;
    
    if (area > 0) {
      measurements.floors.breakdown.push({ room: roomName, value: area });
      measurements.floors.total += area;
      
      measurements.ceilings.breakdown.push({ room: roomName, value: area });
      measurements.ceilings.total += area;
    }
  });
}

/**
 * Main analysis function that combines both APIs
 */
async function performCompleteTakeoffAnalysis(fileData, fileName, fileType, parameters, progressCallback) {
  const results = {
    summary: {
      fileName: fileName,
      analyzedAt: new Date().toISOString(),
      building: parameters.building || 'Unknown',
      floor: parameters.floor || 'Unknown',
      drawingType: parameters.drawingType,
      scale: parameters.scale || 'Unknown'
    },
    measurements: {},
    details: [],
    confidence: 0,
    errors: []
  };
  
  try {
    // Step 1: Document Intelligence Analysis (for PDFs and documents)
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      progressCallback?.('Analyzing document layout with Azure Document Intelligence...', 20);
      
      try {
        const layoutInfo = await analyzeWithDocumentIntelligence(fileData, fileType);
        results.layoutAnalysis = layoutInfo;
        
        if (layoutInfo.scale) {
          results.summary.scale = layoutInfo.scale;
        }
        
        progressCallback?.('Document layout extracted successfully', 40);
      } catch (error) {
        results.errors.push(`Document Intelligence: ${error.message}`);
        console.error('Document Intelligence failed:', error);
      }
    }
    
    // Step 2: Computer Vision Analysis (for images and visual elements)
    progressCallback?.('Analyzing visual elements with Azure Computer Vision...', 60);
    
    try {
      // Convert PDF pages to images if needed
      let imageData = fileData;
      let imageType = fileType;
      
      if (fileType === 'application/pdf') {
        // For PDFs, we'd need to extract pages as images
        // This would require a PDF rendering library
        // For now, we'll skip vision analysis for PDFs
        progressCallback?.('Skipping visual analysis for PDF (image conversion needed)', 70);
      } else {
        const visionInfo = await analyzeWithComputerVision(imageData, imageType);
        results.visionAnalysis = visionInfo;
        progressCallback?.('Visual analysis complete', 80);
      }
    } catch (error) {
      results.errors.push(`Computer Vision: ${error.message}`);
      console.error('Computer Vision failed:', error);
    }
    
    // Step 3: Calculate measurements from combined analysis
    progressCallback?.('Calculating measurements and generating report...', 90);
    
    if (results.layoutAnalysis || results.visionAnalysis) {
      results.measurements = calculateMeasurements(
        results.layoutAnalysis || { text: '', tables: [], dimensions: [], roomLabels: [], measurements: [], scale: null },
        results.visionAnalysis || { objects: [], text: [], tags: [], description: '' },
        parameters
      );
      
      // Calculate paint requirements if specified
      if (parameters.wallFinish && results.measurements.walls?.total > 0) {
        results.paintRequirements = calculatePaintRequirements(
          results.measurements,
          parameters
        );
      }
      
      // Calculate confidence score
      results.confidence = calculateConfidenceScore(results);
    }
    
    progressCallback?.('Analysis complete!', 100);
    
  } catch (error) {
    results.errors.push(`General error: ${error.message}`);
    console.error('Takeoff analysis error:', error);
  }
  
  return results;
}

/**
 * Calculate paint requirements based on measurements
 */
function calculatePaintRequirements(measurements, parameters) {
  const requirements = {
    wallFinish: parameters.wallFinish,
    ceilingFinish: parameters.ceilingFinish,
    floorFinish: parameters.floorFinish,
    coats: parseInt(parameters.coatsRequired) || 2
  };
  
  // Wall paint calculation
  if (measurements.walls?.total > 0 && parameters.wallFinish) {
    const wallHeight = 10; // Assume 10 feet if not specified
    const wallArea = measurements.walls.total * wallHeight;
    
    // Subtract door and window areas
    const doorArea = measurements.doors.total * 21; // Average door is 3x7 = 21 sq ft
    const windowArea = measurements.windows.total * 15; // Average window is 15 sq ft
    const paintableArea = wallArea - doorArea - windowArea;
    
    const coveragePerGallon = 350; // Industry standard
    requirements.wallGallons = Math.ceil((paintableArea * requirements.coats) / coveragePerGallon);
    requirements.wallArea = paintableArea;
  }
  
  // Ceiling paint calculation
  if (measurements.ceilings?.total > 0 && parameters.ceilingFinish) {
    const coveragePerGallon = 400; // Ceiling paint typically covers more
    requirements.ceilingGallons = Math.ceil((measurements.ceilings.total * requirements.coats) / coveragePerGallon);
    requirements.ceilingArea = measurements.ceilings.total;
  }
  
  // Floor coating calculation
  if (measurements.floors?.total > 0 && parameters.floorFinish) {
    let coveragePerGallon = 200; // Default for epoxy
    
    if (parameters.floorFinish === 'sealed-concrete') {
      coveragePerGallon = 300;
    } else if (parameters.floorFinish === 'polished-concrete') {
      coveragePerGallon = 400;
    }
    
    requirements.floorGallons = Math.ceil((measurements.floors.total * requirements.coats) / coveragePerGallon);
    requirements.floorArea = measurements.floors.total;
  }
  
  // Calculate total material cost estimate
  const costs = {
    wallPaint: (requirements.wallGallons || 0) * 35,
    ceilingPaint: (requirements.ceilingGallons || 0) * 30,
    floorCoating: (requirements.floorGallons || 0) * 55
  };
  
  requirements.estimatedMaterialCost = costs.wallPaint + costs.ceilingPaint + costs.floorCoating;
  requirements.costBreakdown = costs;
  
  return requirements;
}

/**
 * Calculate confidence score for the analysis
 */
function calculateConfidenceScore(results) {
  let score = 0;
  let factors = 0;
  
  // Check if we have layout analysis
  if (results.layoutAnalysis) {
    if (results.layoutAnalysis.scale) score += 20;
    if (results.layoutAnalysis.tables.length > 0) score += 15;
    if (results.layoutAnalysis.roomLabels.length > 0) score += 15;
    if (results.layoutAnalysis.measurements.length > 0) score += 20;
    factors += 70;
  }
  
  // Check if we have vision analysis
  if (results.visionAnalysis) {
    if (results.visionAnalysis.objects.length > 0) score += 10;
    if (results.visionAnalysis.text.length > 0) score += 10;
    if (results.visionAnalysis.description) score += 10;
    factors += 30;
  }
  
  // Calculate percentage
  return factors > 0 ? Math.round((score / factors) * 100) : 0;
}

// Export functions for use in other scripts
window.AzureTakeoffAnalysis = {
  performCompleteTakeoffAnalysis,
  analyzeWithDocumentIntelligence,
  analyzeWithComputerVision,
  calculateMeasurements,
  calculatePaintRequirements
};

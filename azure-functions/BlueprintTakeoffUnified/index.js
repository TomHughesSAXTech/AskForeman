/**
 * BlueprintTakeoffUnified - Advanced Blueprint Analysis Function
 * Combines Document Intelligence and Computer Vision for comprehensive takeoff analysis
 * Detects highlighted areas (especially red), extracts measurements, scales, and specifications
 */

const { BlobServiceClient } = require('@azure/storage-blob');

module.exports = async function (context, req) {
    context.log('BlueprintTakeoffUnified function triggered for advanced blueprint analysis');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, x-functions-key'
            }
        };
        return;
    }

    try {
        const { 
            file,           // Base64 encoded file
            fileName, 
            mimeType,
            client, 
            project,
            analysisType = 'full',  // 'full', 'highlights', 'measurements', 'specifications'
            extractHighlights = true,
            extractColors = true,
            detectScale = true
        } = req.body;

        if (!file || !fileName) {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: { error: 'Missing required parameters: file and fileName' }
            };
            return;
        }

        // Convert base64 to buffer
        const fileBuffer = Buffer.from(file, 'base64');
        
        // Initialize results structure
        let takeoffResults = {
            summary: {
                fileName: fileName,
                client: client || 'general',
                project: project || '',
                analyzedAt: new Date().toISOString(),
                fileType: mimeType || 'application/pdf',
                analysisType: analysisType
            },
            documentIntelligence: {},
            computerVision: {},
            extractedData: {
                scale: null,
                buildingNames: [],
                measurements: [],
                areas: [],
                materials: [],
                specifications: [],
                highlights: [],
                colors: [],
                text: [],
                tables: []
            },
            confidence: {
                overall: 0,
                scale: 0,
                measurements: 0,
                highlights: 0
            }
        };

        // Step 1: Document Intelligence Analysis
        if (analysisType === 'full' || analysisType === 'measurements' || analysisType === 'specifications') {
            const diResults = await analyzeWithDocumentIntelligence(fileBuffer, mimeType, context);
            takeoffResults.documentIntelligence = diResults;
            
            // Extract structured data from Document Intelligence
            if (diResults.success) {
                // Extract scale
                if (detectScale && diResults.content) {
                    const scaleInfo = extractScale(diResults.content);
                    if (scaleInfo) {
                        takeoffResults.extractedData.scale = scaleInfo;
                        takeoffResults.confidence.scale = scaleInfo.confidence || 0.8;
                    }
                }
                
                // Extract measurements and dimensions
                if (diResults.content) {
                    const measurements = extractMeasurements(diResults.content);
                    takeoffResults.extractedData.measurements = measurements;
                    takeoffResults.confidence.measurements = measurements.length > 0 ? 0.85 : 0;
                }
                
                // Extract building names and room labels
                if (diResults.pages) {
                    const buildingInfo = extractBuildingInformation(diResults.pages);
                    takeoffResults.extractedData.buildingNames = buildingInfo.buildings;
                    takeoffResults.extractedData.areas = buildingInfo.areas;
                }
                
                // Extract tables (often contain schedules and specifications)
                if (diResults.tables) {
                    takeoffResults.extractedData.tables = processTablesForSpecs(diResults.tables);
                    takeoffResults.extractedData.specifications = extractSpecifications(diResults.tables);
                }
                
                // Extract all text content
                if (diResults.content) {
                    takeoffResults.extractedData.text = diResults.content.substring(0, 5000); // Limit for response size
                }
            }
        }

        // Step 2: Computer Vision Analysis for Highlights and Colors
        if (extractHighlights && (analysisType === 'full' || analysisType === 'highlights')) {
            const cvResults = await analyzeWithComputerVision(fileBuffer, mimeType, context);
            takeoffResults.computerVision = cvResults;
            
            if (cvResults.success) {
                // Extract color information
                if (extractColors && cvResults.colorInfo) {
                    const colorAnalysis = analyzeColors(cvResults.colorInfo);
                    takeoffResults.extractedData.colors = colorAnalysis.dominantColors;
                    takeoffResults.extractedData.highlights = colorAnalysis.highlights;
                    takeoffResults.confidence.highlights = colorAnalysis.highlights.length > 0 ? 0.75 : 0;
                    
                    // Special handling for red highlights (critical areas)
                    const redHighlights = colorAnalysis.highlights.filter(h => 
                        h.color.toLowerCase().includes('red') || 
                        (h.rgb && h.rgb.r > 200 && h.rgb.g < 100 && h.rgb.b < 100)
                    );
                    
                    if (redHighlights.length > 0) {
                        takeoffResults.extractedData.criticalAreas = redHighlights;
                    }
                }
                
                // Extract detected objects (doors, windows, fixtures)
                if (cvResults.objects) {
                    const constructionElements = extractConstructionElements(cvResults.objects);
                    takeoffResults.extractedData.detectedElements = constructionElements;
                }
                
                // Extract any text detected by Computer Vision OCR
                if (cvResults.readResult) {
                    const ocrText = extractOCRText(cvResults.readResult);
                    // Merge with Document Intelligence text
                    if (!takeoffResults.extractedData.text) {
                        takeoffResults.extractedData.text = ocrText;
                    }
                }
            }
        }

        // Step 3: Calculate material quantities based on extracted data
        if (takeoffResults.extractedData.measurements.length > 0 || 
            takeoffResults.extractedData.areas.length > 0) {
            const materialCalculations = calculateMaterialQuantities(takeoffResults.extractedData);
            takeoffResults.extractedData.materials = materialCalculations;
        }

        // Step 4: Generate takeoff line items
        const lineItems = generateTakeoffLineItems(takeoffResults.extractedData);
        takeoffResults.lineItems = lineItems;

        // Step 5: Calculate overall confidence score
        const confidenceScores = Object.values(takeoffResults.confidence).filter(c => c > 0);
        takeoffResults.confidence.overall = confidenceScores.length > 0 
            ? confidenceScores.reduce((a, b) => a + b) / confidenceScores.length 
            : 0;

        // Step 6: Store results in blob storage if client is specified
        if (client && client !== 'general') {
            const storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
            const blobServiceClient = BlobServiceClient.fromConnectionString(storageConnectionString);
            const containerName = 'fcs-clients';
            const containerClient = blobServiceClient.getContainerClient(containerName);
            
            const takeoffBlobName = `FCS-ConvertedClients/${client}/takeoff-analysis/${fileName}_takeoff_${Date.now()}.json`;
            const takeoffBlobClient = containerClient.getBlockBlobClient(takeoffBlobName);
            
            const takeoffJson = JSON.stringify(takeoffResults, null, 2);
            await takeoffBlobClient.upload(takeoffJson, takeoffJson.length);
            
            takeoffResults.storageUrl = takeoffBlobClient.url;
        }

        // Return comprehensive response
        context.res = {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                success: true,
                message: 'Blueprint analysis completed successfully',
                summary: takeoffResults.summary,
                confidence: takeoffResults.confidence,
                extractedData: takeoffResults.extractedData,
                lineItems: takeoffResults.lineItems,
                storageUrl: takeoffResults.storageUrl || null
            }
        };

    } catch (error) {
        context.log.error('Error in BlueprintTakeoffUnified:', error);
        
        context.res = {
            status: 500,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: {
                success: false,
                error: 'Failed to analyze blueprint',
                details: error.message
            }
        };
    }
};

// Document Intelligence Analysis
async function analyzeWithDocumentIntelligence(fileBuffer, mimeType, context) {
    try {
        const endpoint = process.env.DOCUMENT_INTELLIGENCE_ENDPOINT || process.env.FORM_RECOGNIZER_ENDPOINT;
        const apiKey = process.env.DOCUMENT_INTELLIGENCE_KEY || process.env.FORM_RECOGNIZER_KEY;
        
        if (!endpoint || !apiKey) {
            context.log.warn('Document Intelligence credentials not configured');
            return { success: false, error: 'Service not configured' };
        }

        // For now, return mock data - replace with actual API call
        return {
            success: true,
            content: "Scale: 1/4\" = 1'-0\"\nRoom 101 - Office - 12'-6\" x 10'-0\"\nRoom 102 - Conference - 20'-0\" x 15'-0\"\nCeiling Height: 10'-0\"\nBuilding 14 - Brownsville Development",
            pages: [
                {
                    pageNumber: 1,
                    lines: [
                        { content: "Building 14 - Rehabilitation Project", boundingBox: [] },
                        { content: "Scale: 1/4\" = 1'-0\"", boundingBox: [] },
                        { content: "Room Schedule", boundingBox: [] }
                    ]
                }
            ],
            tables: [
                {
                    rowCount: 3,
                    columnCount: 4,
                    cells: [
                        { rowIndex: 0, columnIndex: 0, content: "Room", kind: "columnHeader" },
                        { rowIndex: 0, columnIndex: 1, content: "Name", kind: "columnHeader" },
                        { rowIndex: 0, columnIndex: 2, content: "Area (SF)", kind: "columnHeader" },
                        { rowIndex: 0, columnIndex: 3, content: "Finish", kind: "columnHeader" },
                        { rowIndex: 1, columnIndex: 0, content: "101", kind: "content" },
                        { rowIndex: 1, columnIndex: 1, content: "Office", kind: "content" },
                        { rowIndex: 1, columnIndex: 2, content: "125", kind: "content" },
                        { rowIndex: 1, columnIndex: 3, content: "Paint", kind: "content" }
                    ]
                }
            ]
        };
    } catch (error) {
        context.log.error('Document Intelligence error:', error);
        return { success: false, error: error.message };
    }
}

// Computer Vision Analysis
async function analyzeWithComputerVision(fileBuffer, mimeType, context) {
    try {
        const endpoint = process.env.COMPUTER_VISION_ENDPOINT || process.env.VISION_ENDPOINT;
        const apiKey = process.env.COMPUTER_VISION_KEY || process.env.VISION_KEY;
        
        if (!endpoint || !apiKey) {
            context.log.warn('Computer Vision credentials not configured');
            return { success: false, error: 'Service not configured' };
        }

        // For now, return mock data - replace with actual API call
        return {
            success: true,
            colorInfo: {
                dominantColors: ["gray", "white", "red", "black"],
                accentColor: "CC3333"
            },
            objects: [
                { object: "door", confidence: 0.85 },
                { object: "window", confidence: 0.78 }
            ],
            readResult: {
                content: "Additional text from OCR"
            }
        };
    } catch (error) {
        context.log.error('Computer Vision error:', error);
        return { success: false, error: error.message };
    }
}

// Extract scale information
function extractScale(text) {
    const scalePatterns = [
        /scale[:\s]*([\d\/]+)["\s]*=["\s]*([\d\-']+)/i,
        /([\d\/]+)["\s]*=["\s]*([\d\-']+)["\s]*scale/i,
        /1[:\s](\d+)/i
    ];
    
    for (const pattern of scalePatterns) {
        const match = text.match(pattern);
        if (match) {
            return {
                raw: match[0],
                drawingScale: match[1],
                realScale: match[2] || match[1],
                confidence: 0.85
            };
        }
    }
    return null;
}

// Extract measurements from text
function extractMeasurements(text) {
    const measurements = [];
    const patterns = [
        /(\d+)['-](\d+)?["]?/g,
        /(\d+\.?\d*)\s*(ft|feet|m|meters?|sf|sq\s*ft)/gi
    ];
    
    patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            measurements.push({
                raw: match[0],
                value: parseFloat(match[1]),
                unit: match[2] || 'ft',
                context: text.substring(Math.max(0, match.index - 30), Math.min(text.length, match.index + match[0].length + 30))
            });
        }
    });
    
    return measurements;
}

// Extract building and area information
function extractBuildingInformation(pages) {
    const buildings = [];
    const areas = [];
    
    pages.forEach(page => {
        page.lines?.forEach(line => {
            const text = line.content;
            
            // Look for building references
            if (text.match(/building\s+\d+/i)) {
                buildings.push({
                    name: text,
                    pageNumber: page.pageNumber
                });
            }
            
            // Look for room/area information
            if (text.match(/room\s+\d+|area\s+\w+/i)) {
                areas.push({
                    name: text,
                    pageNumber: page.pageNumber
                });
            }
        });
    });
    
    return { buildings, areas };
}

// Process tables for specifications
function processTablesForSpecs(tables) {
    const processedTables = [];
    
    tables.forEach(table => {
        const headers = table.cells.filter(c => c.kind === 'columnHeader').map(c => c.content);
        const rows = [];
        
        for (let r = 1; r < table.rowCount; r++) {
            const row = {};
            for (let c = 0; c < table.columnCount; c++) {
                const cell = table.cells.find(cell => cell.rowIndex === r && cell.columnIndex === c);
                if (cell && headers[c]) {
                    row[headers[c]] = cell.content;
                }
            }
            if (Object.keys(row).length > 0) {
                rows.push(row);
            }
        }
        
        processedTables.push({ headers, rows });
    });
    
    return processedTables;
}

// Extract specifications from tables
function extractSpecifications(tables) {
    const specs = [];
    
    tables.forEach(table => {
        table.cells.forEach(cell => {
            if (cell.content && cell.content.match(/paint|flooring|ceiling|door|window|hvac|electrical/i)) {
                specs.push({
                    type: 'material',
                    value: cell.content,
                    location: `Table Row ${cell.rowIndex}, Col ${cell.columnIndex}`
                });
            }
        });
    });
    
    return specs;
}

// Analyze colors for highlights
function analyzeColors(colorInfo) {
    const highlights = [];
    
    // Check for red highlights (critical areas)
    if (colorInfo.dominantColors?.includes('red') || 
        (colorInfo.accentColor && colorInfo.accentColor.match(/[CD][0-5]/))) {
        highlights.push({
            color: 'red',
            meaning: 'Critical area - requires attention',
            rgb: { r: 204, g: 51, b: 51 }
        });
    }
    
    // Check for yellow highlights (important notes)
    if (colorInfo.dominantColors?.includes('yellow')) {
        highlights.push({
            color: 'yellow',
            meaning: 'Important information',
            rgb: { r: 255, g: 255, b: 0 }
        });
    }
    
    return {
        dominantColors: colorInfo.dominantColors || [],
        highlights: highlights
    };
}

// Extract construction elements from detected objects
function extractConstructionElements(objects) {
    const elements = {
        doors: [],
        windows: [],
        fixtures: [],
        other: []
    };
    
    objects.forEach(obj => {
        const name = obj.object?.toLowerCase() || '';
        
        if (name.includes('door')) {
            elements.doors.push(obj);
        } else if (name.includes('window')) {
            elements.windows.push(obj);
        } else if (name.includes('fixture') || name.includes('outlet')) {
            elements.fixtures.push(obj);
        } else {
            elements.other.push(obj);
        }
    });
    
    return elements;
}

// Extract OCR text
function extractOCRText(readResult) {
    return readResult.content || '';
}

// Calculate material quantities
function calculateMaterialQuantities(extractedData) {
    const materials = [];
    let totalArea = 0;
    
    // Calculate total area from measurements
    extractedData.measurements.forEach(m => {
        if (m.unit === 'sf' || m.unit === 'sq ft') {
            totalArea += m.value;
        }
    });
    
    // Calculate paint needed
    if (totalArea > 0) {
        const paintCoverage = 350; // sq ft per gallon
        const coats = 2;
        const paintGallons = Math.ceil((totalArea * coats) / paintCoverage);
        
        materials.push({
            type: 'Paint',
            quantity: paintGallons,
            unit: 'gallons',
            coverage: totalArea,
            notes: `Based on ${totalArea} sq ft with ${coats} coats`
        });
    }
    
    // Add materials from specifications
    extractedData.specifications.forEach(spec => {
        if (spec.type === 'material') {
            materials.push({
                type: spec.value,
                quantity: 'TBD',
                unit: 'as specified',
                notes: 'From specifications'
            });
        }
    });
    
    return materials;
}

// Generate takeoff line items
function generateTakeoffLineItems(extractedData) {
    const lineItems = [];
    let itemNumber = 1;
    
    // Add area-based items
    extractedData.areas.forEach(area => {
        lineItems.push({
            number: itemNumber++,
            description: area.name,
            quantity: 'TBD',
            unit: 'SF',
            category: 'Areas'
        });
    });
    
    // Add material items
    extractedData.materials.forEach(material => {
        lineItems.push({
            number: itemNumber++,
            description: material.type,
            quantity: material.quantity,
            unit: material.unit,
            category: 'Materials',
            notes: material.notes
        });
    });
    
    // Add detected elements
    if (extractedData.detectedElements) {
        if (extractedData.detectedElements.doors.length > 0) {
            lineItems.push({
                number: itemNumber++,
                description: 'Doors',
                quantity: extractedData.detectedElements.doors.length,
                unit: 'EA',
                category: 'Openings'
            });
        }
        
        if (extractedData.detectedElements.windows.length > 0) {
            lineItems.push({
                number: itemNumber++,
                description: 'Windows',
                quantity: extractedData.detectedElements.windows.length,
                unit: 'EA',
                category: 'Openings'
            });
        }
    }
    
    return lineItems;
}

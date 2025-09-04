/**
 * ConvertDocumentJsonTakeoff - Construction Takeoff Analysis Function
 * Specialized for analyzing construction drawings and generating takeoff data
 * Uses Computer Vision for image analysis and Document Intelligence for layout extraction
 */

const { BlobServiceClient } = require('@azure/storage-blob');
const { DocumentAnalysisClient, AzureKeyCredential } = require('@azure/ai-form-recognizer');
const { ComputerVisionClient } = require('@azure/cognitiveservices-computervision');
const { ApiKeyCredentials } = require('@azure/ms-rest-js');

module.exports = async function (context, req) {
    context.log('ConvertDocumentJsonTakeoff function triggered for construction takeoff analysis');

    try {
        const { 
            blobUrl, 
            fileName, 
            category, 
            client, 
            metadata,
            takeoffParameters 
        } = req.body;

        if (!blobUrl || !fileName) {
            context.res = {
                status: 400,
                body: { error: 'Missing required parameters: blobUrl and fileName' }
            };
            return;
        }

        // Initialize services
        const documentEndpoint = process.env.DOCUMENT_INTELLIGENCE_ENDPOINT;
        const documentKey = process.env.DOCUMENT_INTELLIGENCE_KEY;
        const visionEndpoint = process.env.COMPUTER_VISION_ENDPOINT;
        const visionKey = process.env.COMPUTER_VISION_KEY;
        const storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        
        // Document Intelligence client
        const documentClient = new DocumentAnalysisClient(
            documentEndpoint,
            new AzureKeyCredential(documentKey)
        );
        
        // Computer Vision client
        const visionCredentials = new ApiKeyCredentials({ 
            inHeader: { 'Ocp-Apim-Subscription-Key': visionKey } 
        });
        const visionClient = new ComputerVisionClient(visionCredentials, visionEndpoint);
        
        // Blob Storage client
        const blobServiceClient = BlobServiceClient.fromConnectionString(storageConnectionString);

        // Determine if this is a drawing file
        const fileExtension = fileName.split('.').pop().toLowerCase();
        const isDrawing = ['pdf', 'tiff', 'tif', 'png', 'jpg', 'jpeg'].includes(fileExtension);
        
        let takeoffResults = {
            summary: {
                fileName: fileName,
                client: client,
                category: category,
                analyzedAt: new Date().toISOString(),
                drawingType: takeoffParameters?.drawingType || 'floor-plan',
                scale: takeoffParameters?.scale || '',
                building: takeoffParameters?.building || '',
                floor: takeoffParameters?.floor || ''
            },
            results: {
                calculations: {},
                rooms: [],
                dimensions: [],
                symbols: [],
                text: []
            }
        };

        if (isDrawing) {
            // Step 1: Extract layout and text with Document Intelligence
            context.log('Analyzing drawing layout with Document Intelligence...');
            
            const layoutPoller = await documentClient.beginAnalyzeDocumentFromUrl(
                'prebuilt-layout',
                blobUrl
            );
            const layoutResult = await layoutPoller.pollUntilDone();
            
            // Extract dimensions and measurements from text
            const extractedText = layoutResult.content || '';
            const dimensions = extractDimensions(extractedText);
            const roomLabels = extractRoomLabels(layoutResult);
            
            takeoffResults.results.text = layoutResult.pages?.map(page => ({
                pageNumber: page.pageNumber,
                content: page.lines?.map(line => line.content).join(' ') || '',
                dimensions: extractDimensionsFromPage(page)
            })) || [];
            
            // Step 2: Analyze visual elements with Computer Vision
            context.log('Analyzing visual elements with Computer Vision...');
            
            const visionAnalysis = await visionClient.analyzeImageInStream(
                blobUrl,
                {
                    visualFeatures: ['Objects', 'Tags', 'Description'],
                    details: ['Landmarks']
                }
            );
            
            // Step 3: Specific construction element detection
            const constructionElements = await detectConstructionElements(
                layoutResult,
                visionAnalysis,
                takeoffParameters
            );
            
            // Step 4: Calculate quantities based on parameters
            const calculations = calculateTakeoffQuantities(
                dimensions,
                roomLabels,
                constructionElements,
                takeoffParameters
            );
            
            takeoffResults.results.calculations = calculations;
            takeoffResults.results.rooms = roomLabels;
            takeoffResults.results.dimensions = dimensions;
            takeoffResults.results.symbols = constructionElements.symbols || [];
            
            // Step 5: Generate material list
            const materials = generateMaterialsList(calculations, takeoffParameters);
            takeoffResults.results.materials = materials;
            
            // Step 6: Generate line items for estimate
            const lineItems = generateLineItems(calculations, takeoffParameters);
            takeoffResults.results.lineItems = lineItems;
            
            // Add confidence score
            takeoffResults.summary.confidence = calculateConfidenceScore(
                layoutResult,
                visionAnalysis,
                dimensions.length,
                roomLabels.length
            );
            
            // Add recommendations
            takeoffResults.summary.recommendations = generateRecommendations(
                takeoffResults.summary.confidence,
                dimensions.length,
                roomLabels.length
            );
        }

        // Store the analysis results
        const containerName = 'fcs-clients';
        const containerClient = blobServiceClient.getContainerClient(containerName);
        
        // Save takeoff analysis
        const takeoffBlobName = `FCS-ConvertedClients/${client}/takeoff-analysis/${fileName}_takeoff.json`;
        const takeoffBlobClient = containerClient.getBlockBlobClient(takeoffBlobName);
        
        const takeoffJson = JSON.stringify(takeoffResults, null, 2);
        await takeoffBlobClient.upload(takeoffJson, takeoffJson.length);
        
        // Also save processed document data
        const processedBlobName = `FCS-ConvertedClients/${client}/${category}/${fileName}.json`;
        const processedBlobClient = containerClient.getBlockBlobClient(processedBlobName);
        
        const processedJson = JSON.stringify({
            originalFile: fileName,
            blobUrl: blobUrl,
            category: category,
            client: client,
            processedAt: new Date().toISOString(),
            metadata: metadata,
            takeoffAnalysis: takeoffResults
        }, null, 2);
        
        await processedBlobClient.upload(processedJson, processedJson.length);

        // Return comprehensive response for n8n
        context.res = {
            status: 200,
            body: {
                success: true,
                message: 'Construction takeoff analysis completed',
                takeoffUrl: takeoffBlobClient.url,
                processedUrl: processedBlobClient.url,
                summary: takeoffResults.summary,
                calculations: takeoffResults.results.calculations,
                materials: takeoffResults.results.materials,
                lineItems: takeoffResults.results.lineItems,
                confidence: takeoffResults.summary.confidence,
                recommendations: takeoffResults.summary.recommendations
            }
        };

    } catch (error) {
        context.log.error('Error in takeoff analysis:', error);
        
        context.res = {
            status: 500,
            body: {
                error: 'Failed to analyze drawing for takeoff',
                details: error.message
            }
        };
    }
};

// Helper function to extract dimensions from text
function extractDimensions(text) {
    const dimensions = [];
    // Pattern for feet and inches (e.g., 12'-6", 10'8", 15 ft)
    const patterns = [
        /(\d+)[''][\s-]?(\d+)?[""]?/g,
        /(\d+\.?\d*)\s*(ft|feet|foot|m|meter|metres?)/gi,
        /(\d+)\s*x\s*(\d+)/g
    ];
    
    patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            dimensions.push({
                raw: match[0],
                value: parseFloat(match[1]),
                unit: match[2] || 'ft',
                context: text.substring(Math.max(0, match.index - 20), Math.min(text.length, match.index + match[0].length + 20))
            });
        }
    });
    
    return dimensions;
}

// Extract room labels from layout analysis
function extractRoomLabels(layoutResult) {
    const rooms = [];
    const roomPatterns = [
        /room\s*(\d+[a-z]?)/gi,
        /(bedroom|bathroom|kitchen|living|dining|office|closet|garage|hallway|corridor)/gi,
        /(\d{3,4}[a-z]?)\s*-?\s*([\w\s]+room)/gi
    ];
    
    layoutResult.pages?.forEach(page => {
        page.lines?.forEach(line => {
            roomPatterns.forEach(pattern => {
                const match = pattern.exec(line.content);
                if (match) {
                    rooms.push({
                        label: match[0],
                        number: match[1] || '',
                        type: match[2] || 'general',
                        boundingBox: line.boundingRegions?.[0]?.boundingBox,
                        pageNumber: page.pageNumber
                    });
                }
            });
        });
    });
    
    return rooms;
}

// Extract dimensions from a specific page
function extractDimensionsFromPage(page) {
    const dimensions = [];
    page.lines?.forEach(line => {
        const extracted = extractDimensions(line.content);
        if (extracted.length > 0) {
            dimensions.push(...extracted.map(dim => ({
                ...dim,
                boundingBox: line.boundingRegions?.[0]?.boundingBox
            })));
        }
    });
    return dimensions;
}

// Detect construction-specific elements
async function detectConstructionElements(layoutResult, visionAnalysis, parameters) {
    const elements = {
        doors: [],
        windows: [],
        walls: [],
        symbols: [],
        fixtures: []
    };
    
    // Look for door/window symbols in text
    const doorWindowPatterns = [
        /\b(door|dr)\b/gi,
        /\b(window|wdw|win)\b/gi,
        /\b(\d+)['"]\s*[xX]\s*(\d+)['"]/g // Size patterns
    ];
    
    layoutResult.pages?.forEach(page => {
        page.lines?.forEach(line => {
            const text = line.content.toLowerCase();
            if (text.includes('door') || text.includes('dr')) {
                elements.doors.push({
                    text: line.content,
                    location: line.boundingRegions?.[0]?.boundingBox
                });
            }
            if (text.includes('window') || text.includes('wdw')) {
                elements.windows.push({
                    text: line.content,
                    location: line.boundingRegions?.[0]?.boundingBox
                });
            }
        });
    });
    
    // Use vision tags for additional detection
    visionAnalysis.tags?.forEach(tag => {
        if (['door', 'window', 'wall', 'room', 'floor'].includes(tag.name.toLowerCase())) {
            elements.symbols.push({
                type: tag.name,
                confidence: tag.confidence
            });
        }
    });
    
    return elements;
}

// Calculate takeoff quantities
function calculateTakeoffQuantities(dimensions, rooms, elements, parameters) {
    const calculations = {
        totalArea: 0,
        totalPerimeter: 0,
        paintableArea: 0,
        totalFloorArea: 0,
        ceilingArea: 0,
        totalWallLength: 0,
        doors: { count: 0, totalArea: 0 },
        windows: { count: 0, totalArea: 0 },
        roomCount: rooms.length
    };
    
    // Parse dimensions to calculate areas
    const areaDimensions = dimensions.filter(d => d.raw.includes('x'));
    areaDimensions.forEach(dim => {
        const match = /(\d+)\s*x\s*(\d+)/.exec(dim.raw);
        if (match) {
            const area = parseFloat(match[1]) * parseFloat(match[2]);
            calculations.totalFloorArea += area;
        }
    });
    
    // Use room count to estimate if no direct measurements
    if (calculations.totalFloorArea === 0 && rooms.length > 0) {
        // Estimate 150 sq ft per room as default
        calculations.totalFloorArea = rooms.length * 150;
    }
    
    // Calculate ceiling area (same as floor area)
    calculations.ceilingArea = calculations.totalFloorArea;
    
    // Estimate wall area based on floor area and assumed ceiling height
    const ceilingHeight = parameters?.ceilingHeight || 10; // Default 10 ft
    const perimeterFactor = 4 * Math.sqrt(calculations.totalFloorArea);
    calculations.totalWallLength = perimeterFactor;
    
    // Calculate paintable wall area
    const wallArea = perimeterFactor * ceilingHeight;
    calculations.doors.count = elements.doors?.length || 0;
    calculations.windows.count = elements.windows?.length || 0;
    
    // Standard door size: 3' x 7' = 21 sq ft
    // Standard window size: 3' x 4' = 12 sq ft
    calculations.doors.totalArea = calculations.doors.count * 21;
    calculations.windows.totalArea = calculations.windows.count * 12;
    
    // Paintable area = wall area - doors - windows
    calculations.paintableArea = Math.max(0, wallArea - calculations.doors.totalArea - calculations.windows.totalArea);
    
    // Total area for summary
    calculations.totalArea = calculations.totalFloorArea;
    calculations.totalPerimeter = perimeterFactor;
    
    return calculations;
}

// Generate materials list
function generateMaterialsList(calculations, parameters) {
    const materials = [];
    
    // Paint calculations
    if (parameters?.measureWalls) {
        const paintCoverage = 350; // sq ft per gallon
        const coats = parameters.coatsRequired || 2;
        const paintGallons = Math.ceil((calculations.paintableArea * coats) / paintCoverage);
        
        materials.push({
            type: 'Interior Paint - ' + (parameters.wallFinish || 'Standard'),
            quantity: paintGallons,
            unit: 'GAL',
            coverage: calculations.paintableArea,
            estimatedCost: paintGallons * 35
        });
        
        // Primer if needed
        if (coats > 1) {
            const primerGallons = Math.ceil(calculations.paintableArea / 400);
            materials.push({
                type: 'Primer',
                quantity: primerGallons,
                unit: 'GAL',
                coverage: calculations.paintableArea,
                estimatedCost: primerGallons * 25
            });
        }
    }
    
    // Flooring materials
    if (parameters?.measureFloors && calculations.totalFloorArea > 0) {
        const wastePercent = 10;
        const floorRequired = calculations.totalFloorArea * (1 + wastePercent / 100);
        
        materials.push({
            type: 'Flooring - ' + (parameters.floorFinish || 'Vinyl'),
            quantity: Math.ceil(floorRequired),
            unit: 'SF',
            coverage: calculations.totalFloorArea,
            estimatedCost: floorRequired * 2.50
        });
    }
    
    return materials;
}

// Generate line items for estimate
function generateLineItems(calculations, parameters) {
    const lineItems = [];
    let itemNumber = 1;
    
    // Wall painting
    if (calculations.paintableArea > 0) {
        lineItems.push({
            item: itemNumber++,
            description: `Wall Painting - ${parameters?.wallFinish || 'Standard'} (${calculations.paintableArea.toFixed(0)} SF)`,
            category: 'finishes',
            quantity: calculations.paintableArea,
            unit: 'SF',
            materialCost: 0.35,
            laborCost: 0.65,
            totalCost: calculations.paintableArea * 1.00
        });
    }
    
    // Ceiling painting
    if (calculations.ceilingArea > 0 && parameters?.measureCeilings) {
        lineItems.push({
            item: itemNumber++,
            description: `Ceiling Painting - ${parameters?.ceilingFinish || 'Flat White'} (${calculations.ceilingArea.toFixed(0)} SF)`,
            category: 'finishes',
            quantity: calculations.ceilingArea,
            unit: 'SF',
            materialCost: 0.30,
            laborCost: 0.55,
            totalCost: calculations.ceilingArea * 0.85
        });
    }
    
    // Floor finishing
    if (calculations.totalFloorArea > 0 && parameters?.measureFloors) {
        lineItems.push({
            item: itemNumber++,
            description: `Floor Finishing - ${parameters?.floorFinish || 'Vinyl'} (${calculations.totalFloorArea.toFixed(0)} SF)`,
            category: 'flooring',
            quantity: calculations.totalFloorArea,
            unit: 'SF',
            materialCost: 2.50,
            laborCost: 1.50,
            totalCost: calculations.totalFloorArea * 4.00
        });
    }
    
    // Doors
    if (calculations.doors.count > 0) {
        lineItems.push({
            item: itemNumber++,
            description: `Door Hardware & Installation (${calculations.doors.count} doors)`,
            category: 'carpentry',
            quantity: calculations.doors.count,
            unit: 'EA',
            materialCost: 85,
            laborCost: 125,
            totalCost: calculations.doors.count * 210
        });
    }
    
    return lineItems;
}

// Calculate confidence score
function calculateConfidenceScore(layoutResult, visionAnalysis, dimensionCount, roomCount) {
    let score = 0;
    let factors = 0;
    
    // Text extraction confidence
    if (layoutResult.content && layoutResult.content.length > 100) {
        score += 25;
        factors++;
    }
    
    // Dimension detection
    if (dimensionCount > 5) {
        score += 25;
        factors++;
    } else if (dimensionCount > 0) {
        score += 15;
        factors++;
    }
    
    // Room detection
    if (roomCount > 3) {
        score += 25;
        factors++;
    } else if (roomCount > 0) {
        score += 15;
        factors++;
    }
    
    // Vision analysis quality
    if (visionAnalysis.tags && visionAnalysis.tags.length > 5) {
        score += 25;
        factors++;
    }
    
    return factors > 0 ? Math.round(score / factors) : 0;
}

// Generate recommendations
function generateRecommendations(confidence, dimensionCount, roomCount) {
    const recommendations = [];
    
    if (confidence < 50) {
        recommendations.push({
            type: 'warning',
            message: 'Low confidence score. Manual verification recommended.'
        });
    }
    
    if (dimensionCount < 3) {
        recommendations.push({
            type: 'improvement',
            message: 'Few dimensions detected. Consider uploading higher resolution drawings.'
        });
    }
    
    if (roomCount === 0) {
        recommendations.push({
            type: 'info',
            message: 'No room labels detected. Room identification may be incomplete.'
        });
    }
    
    if (confidence > 75) {
        recommendations.push({
            type: 'success',
            message: 'High confidence analysis. Results are ready for estimate generation.'
        });
    }
    
    return recommendations;
}

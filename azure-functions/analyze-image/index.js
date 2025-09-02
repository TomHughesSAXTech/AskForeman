// Azure Function: Analyze Image
// Processes pasted images and drawings to extract construction data

const { ComputerVisionClient } = require('@azure/cognitiveservices-computervision');
const { ApiKeyCredentials } = require('@azure/ms-rest-js');
// const sharp = require('sharp'); // Removed - causes issues in Azure Functions
const FormData = require('form-data');

module.exports = async function (context, req) {
    context.log('Image analysis function triggered');

    try {
        // Get image from request - handle both Buffer and raw binary data
        let imageBuffer;
        
        // Check if req.body is already a Buffer
        if (Buffer.isBuffer(req.body)) {
            imageBuffer = req.body;
        } else if (req.body && req.body.type === 'Buffer' && req.body.data) {
            // Handle JSON-serialized Buffer
            imageBuffer = Buffer.from(req.body.data);
        } else if (req.body) {
            // Handle raw binary data or ArrayBuffer
            imageBuffer = Buffer.from(req.body);
        } else if (req.rawBody) {
            // Some Azure Functions provide rawBody
            imageBuffer = req.rawBody;
        } else {
            throw new Error('No image data received in request');
        }
        
        context.log(`Received image buffer of size: ${imageBuffer.length} bytes`);
        const analysisType = req.query.analysisType || 'construction';

        // Initialize Computer Vision client
        const computerVisionKey = process.env.COMPUTER_VISION_KEY;
        const computerVisionEndpoint = process.env.COMPUTER_VISION_ENDPOINT;
        
        // Validate credentials
        if (!computerVisionKey || !computerVisionEndpoint) {
            throw new Error(
                `Missing Computer Vision credentials. Key: ${computerVisionKey ? 'Present' : 'Missing'}, ` +
                `Endpoint: ${computerVisionEndpoint ? 'Present' : 'Missing'}`
            );
        }
        
        context.log(`Using Computer Vision endpoint: ${computerVisionEndpoint}`);
        
        const cognitiveServiceCredentials = new ApiKeyCredentials({
            inHeader: {
                'Ocp-Apim-Subscription-Key': computerVisionKey
            }
        });
        
        const client = new ComputerVisionClient(
            cognitiveServiceCredentials,
            computerVisionEndpoint
        );

        // Analyze image
        let analysis;
        try {
            const features = [
                'Categories',
                'Description',
                'Objects',
                'Tags'
                // 'Read'  // OCR for text extraction - removed as it might cause issues
            ];

            // Pass buffer directly to the API
            analysis = await client.analyzeImageInStream(
                imageBuffer,
                { visualFeatures: features }
            );
        } catch (visionError) {
            context.log.error('Computer Vision API error:', visionError);
            // Try simpler analysis without advanced features
            try {
                // Pass buffer directly to the API for fallback
                analysis = await client.analyzeImageInStream(
                    imageBuffer,
                    { visualFeatures: ['Description', 'Tags'] }
                );
            } catch (fallbackError) {
                throw new Error(`Computer Vision API failed: ${fallbackError.message}`);
            }
        }

        // Process construction-specific analysis
        let constructionData = {
            type: 'unknown',
            elements: [],
            measurements: [],
            text: '',
            dimensions: null,
            materials: [],
            rooms: []
        };

        // Extract text from image
        if (analysis.read) {
            const textResults = await extractTextFromImage(client, imageBuffer);
            constructionData.text = textResults.text;
            constructionData.measurements = extractMeasurements(textResults.text);
        }

        // Identify construction elements
        if (analysis.objects) {
            constructionData.elements = analysis.objects.map(obj => ({
                type: translateToConstructionTerm(obj.object),
                confidence: obj.confidence,
                location: obj.rectangle,
                description: obj.object
            }));
        }

        // Determine drawing type based on tags and description
        if (analysis.tags) {
            constructionData.type = determineDrawingType(analysis.tags);
        }

        // Extract dimensions if it's a floor plan
        if (constructionData.type === 'floor_plan' || constructionData.type === 'blueprint') {
            constructionData.dimensions = await extractDimensions(imageBuffer);
            constructionData.rooms = extractRoomInfo(constructionData.text, analysis.objects);
        }

        // Identify materials from text and tags
        constructionData.materials = extractMaterials(
            constructionData.text,
            analysis.tags
        );

        // Enhanced analysis for specific construction drawing types
        if (analysisType === 'construction') {
            constructionData = await enhancedConstructionAnalysis(
                imageBuffer,
                constructionData,
                analysis
            );
        }

        context.res = {
            status: 200,
            body: {
                success: true,
                analysis: constructionData,
                raw: {
                    description: analysis.description,
                    categories: analysis.categories,
                    tags: analysis.tags
                },
                message: 'Image analyzed successfully'
            }
        };

    } catch (error) {
        context.log.error('Image analysis error:', error);
        context.res = {
            status: 500,
            body: {
                error: 'Failed to analyze image',
                details: error.message
            }
        };
    }
};

// Extract text from image using OCR
async function extractTextFromImage(client, imageBuffer) {
    try {
        // Pass buffer directly to the OCR API
        const result = await client.readInStream(imageBuffer);
        const operation = result.operationLocation.split('/').slice(-1)[0];
        
        // Wait for OCR to complete
        let readResult;
        do {
            await new Promise(resolve => setTimeout(resolve, 1000));
            readResult = await client.getReadResult(operation);
        } while (readResult.status !== 'succeeded');

        // Extract text
        let fullText = '';
        const lines = [];
        
        for (const page of readResult.analyzeResult.readResults) {
            for (const line of page.lines) {
                fullText += line.text + '\n';
                lines.push({
                    text: line.text,
                    boundingBox: line.boundingBox
                });
            }
        }

        return {
            text: fullText,
            lines: lines
        };
    } catch (error) {
        console.error('OCR error:', error);
        return { text: '', lines: [] };
    }
}

// Extract measurements from text
function extractMeasurements(text) {
    const measurements = [];
    const patterns = [
        /(\d+(?:\.\d+)?)\s*(?:ft|feet|')/gi,
        /(\d+(?:\.\d+)?)\s*(?:in|inches|")/gi,
        /(\d+(?:\.\d+)?)\s*(?:m|meters?)/gi,
        /(\d+(?:\.\d+)?)\s*(?:cm|centimeters?)/gi,
        /(\d+(?:\.\d+)?)\s*(?:mm|millimeters?)/gi,
        /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/gi,
        /(\d+(?:\.\d+)?)\s*(?:sf|sq\.?\s*ft)/gi
    ];

    patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            measurements.push({
                value: match[0],
                location: match.index
            });
        }
    });

    return measurements;
}

// Translate object detection terms to construction terms
function translateToConstructionTerm(objectName) {
    const translations = {
        'door': 'door',
        'window': 'window',
        'wall': 'wall',
        'stairs': 'staircase',
        'room': 'room',
        'table': 'fixture',
        'sink': 'plumbing_fixture',
        'toilet': 'plumbing_fixture',
        'column': 'structural_column',
        'beam': 'structural_beam'
    };

    return translations[objectName.toLowerCase()] || objectName;
}

// Determine drawing type based on tags
function determineDrawingType(tags) {
    const tagNames = tags.map(t => t.name.toLowerCase());
    
    if (tagNames.some(t => t.includes('floor') || t.includes('plan'))) {
        return 'floor_plan';
    }
    if (tagNames.some(t => t.includes('elevation'))) {
        return 'elevation';
    }
    if (tagNames.some(t => t.includes('section'))) {
        return 'section';
    }
    if (tagNames.some(t => t.includes('blueprint'))) {
        return 'blueprint';
    }
    if (tagNames.some(t => t.includes('diagram'))) {
        return 'diagram';
    }
    if (tagNames.some(t => t.includes('detail'))) {
        return 'detail';
    }
    
    return 'drawing';
}

// Extract dimensions from image
async function extractDimensions(imageBuffer) {
    // Sharp is not available in Azure Functions, return buffer size as approximation
    return {
        bufferSize: imageBuffer.length,
        // Can't get actual dimensions without image processing library
        width: null,
        height: null,
        aspectRatio: null
    };
}

// Extract room information
function extractRoomInfo(text, objects) {
    const rooms = [];
    const roomPatterns = [
        /(?:bedroom|bed\s*room|br)/gi,
        /(?:bathroom|bath\s*room|bath)/gi,
        /(?:kitchen|kit)/gi,
        /(?:living\s*room|living)/gi,
        /(?:dining\s*room|dining)/gi,
        /(?:office)/gi,
        /(?:garage)/gi,
        /(?:closet|clo)/gi,
        /(?:hallway|hall)/gi,
        /(?:foyer|entry)/gi
    ];

    roomPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            rooms.push({
                type: match[0].toLowerCase().replace(/\s+/g, '_'),
                name: match[0],
                location: match.index
            });
        }
    });

    return rooms;
}

// Extract materials from text and tags
function extractMaterials(text, tags) {
    const materials = new Set();
    const materialKeywords = [
        'concrete', 'steel', 'wood', 'timber', 'glass', 'brick',
        'drywall', 'gypsum', 'metal', 'aluminum', 'vinyl',
        'tile', 'carpet', 'hardwood', 'laminate', 'stone',
        'marble', 'granite', 'ceramic', 'porcelain', 'paint'
    ];

    // Check text for materials
    materialKeywords.forEach(material => {
        if (text.toLowerCase().includes(material)) {
            materials.add(material);
        }
    });

    // Check tags for materials
    tags.forEach(tag => {
        materialKeywords.forEach(material => {
            if (tag.name.toLowerCase().includes(material)) {
                materials.add(material);
            }
        });
    });

    return Array.from(materials);
}

// Enhanced construction-specific analysis
async function enhancedConstructionAnalysis(imageBuffer, baseData, visionAnalysis) {
    // Additional processing for construction drawings
    
    // Check for scale indicators
    if (baseData.text.match(/scale\s*:\s*\d+/i)) {
        const scaleMatch = baseData.text.match(/scale\s*:\s*(\d+(?:\/\d+)?)/i);
        if (scaleMatch) {
            baseData.scale = scaleMatch[1];
        }
    }

    // Extract title block information
    const titleBlockInfo = extractTitleBlock(baseData.text);
    if (titleBlockInfo) {
        baseData.titleBlock = titleBlockInfo;
    }

    // Identify drawing number
    const drawingNumber = extractDrawingNumber(baseData.text);
    if (drawingNumber) {
        baseData.drawingNumber = drawingNumber;
    }

    // Extract revision information
    const revisions = extractRevisions(baseData.text);
    if (revisions.length > 0) {
        baseData.revisions = revisions;
    }

    // Count elements
    if (baseData.type === 'floor_plan') {
        baseData.elementCounts = {
            doors: countElements(baseData.elements, 'door'),
            windows: countElements(baseData.elements, 'window'),
            rooms: baseData.rooms.length,
            fixtures: countElements(baseData.elements, 'fixture')
        };
    }

    return baseData;
}

// Extract title block information
function extractTitleBlock(text) {
    const titleBlock = {};
    
    // Project name
    const projectMatch = text.match(/project\s*:\s*([^\n]+)/i);
    if (projectMatch) titleBlock.project = projectMatch[1].trim();
    
    // Architect/Engineer
    const architectMatch = text.match(/architect\s*:\s*([^\n]+)/i);
    if (architectMatch) titleBlock.architect = architectMatch[1].trim();
    
    // Date
    const dateMatch = text.match(/date\s*:\s*([^\n]+)/i);
    if (dateMatch) titleBlock.date = dateMatch[1].trim();
    
    // Sheet
    const sheetMatch = text.match(/sheet\s*:\s*([^\n]+)/i);
    if (sheetMatch) titleBlock.sheet = sheetMatch[1].trim();
    
    return Object.keys(titleBlock).length > 0 ? titleBlock : null;
}

// Extract drawing number
function extractDrawingNumber(text) {
    const patterns = [
        /drawing\s*(?:no|number|#)\s*:\s*([A-Z0-9\-\.]+)/i,
        /dwg\s*(?:no|number|#)\s*:\s*([A-Z0-9\-\.]+)/i,
        /sheet\s*([A-Z]\d+(?:\.\d+)?)/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[1];
    }
    
    return null;
}

// Extract revision information
function extractRevisions(text) {
    const revisions = [];
    const revPattern = /rev(?:ision)?\s*([A-Z0-9]+)\s*-?\s*([^\n]+)/gi;
    
    let match;
    while ((match = revPattern.exec(text)) !== null) {
        revisions.push({
            number: match[1],
            description: match[2].trim()
        });
    }
    
    return revisions;
}

// Count specific element types
function countElements(elements, type) {
    return elements.filter(el => el.type === type).length;
}

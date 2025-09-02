// Azure Function: Analyze Image
// Processes pasted images and drawings to extract construction data

const axios = require('axios');

module.exports = async function (context, req) {
    context.log('Image analysis function triggered');

    try {
        // Get image from request - handle both Buffer and raw binary/base64 data
        let imageBuffer;
        
        // Debug logging
        context.log('Request body type:', typeof req.body);
        context.log('Request body is Buffer:', Buffer.isBuffer(req.body));
        context.log('Request rawBody type:', typeof req.rawBody);
        context.log('Request rawBody is Buffer:', Buffer.isBuffer(req.rawBody));
        
        // Check if req.body is already a Buffer
        if (Buffer.isBuffer(req.body)) {
            context.log('Using req.body as Buffer');
            imageBuffer = req.body;
        } else if (req.body && req.body.type === 'Buffer' && req.body.data) {
            // Handle JSON-serialized Buffer
            context.log('Using JSON-serialized Buffer');
            imageBuffer = Buffer.from(req.body.data);
        } else if (req.body && typeof req.body === 'string') {
            // Handle base64-encoded string (Azure Functions often converts binary to base64)
            context.log('Decoding base64 string from req.body');
            imageBuffer = Buffer.from(req.body, 'base64');
        } else if (req.body) {
            // Handle raw binary data or ArrayBuffer
            context.log('Converting req.body to Buffer');
            imageBuffer = Buffer.from(req.body);
        } else if (req.rawBody) {
            // Some Azure Functions provide rawBody
            if (typeof req.rawBody === 'string') {
                context.log('Decoding base64 string from req.rawBody');
                imageBuffer = Buffer.from(req.rawBody, 'base64');
            } else {
                context.log('Using req.rawBody as-is');
                imageBuffer = req.rawBody;
            }
        } else {
            throw new Error('No image data received in request');
        }
        
        context.log(`Received image buffer of size: ${imageBuffer.length} bytes`);
        
        // Check if the buffer looks like a valid image
        const first4Bytes = imageBuffer.slice(0, 4).toString('hex');
        context.log(`First 4 bytes of buffer (hex): ${first4Bytes}`);
        
        // Common image signatures:
        // JPEG: ffd8ff
        // PNG: 89504e47
        // GIF: 47494638
        if (first4Bytes.startsWith('ffd8')) {
            context.log('Image appears to be JPEG');
        } else if (first4Bytes.startsWith('8950')) {
            context.log('Image appears to be PNG');
        } else if (first4Bytes.startsWith('4749')) {
            context.log('Image appears to be GIF');
        } else {
            context.log('Warning: Buffer does not have a recognized image signature');
        }
        const analysisType = req.query.analysisType || 'construction';

        // Get Computer Vision credentials
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
        
        // Analyze image using REST API
        let analysis;
        try {
            // Define visual features to analyze
            const features = ['Categories', 'Description', 'Objects', 'Tags'].join(',');
            
            // Make REST API call to Computer Vision
            const analyzeUrl = `${computerVisionEndpoint}vision/v3.2/analyze?visualFeatures=${features}`;
            
            const response = await axios.post(analyzeUrl, imageBuffer, {
                headers: {
                    'Ocp-Apim-Subscription-Key': computerVisionKey,
                    'Content-Type': 'application/octet-stream'
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });
            
            analysis = response.data;
            context.log('Image analysis successful');
            
        } catch (visionError) {
            context.log.error('Computer Vision API error:', visionError.response?.data || visionError.message);
            
            // Try simpler analysis without advanced features
            try {
                const simpleFeatures = ['Description', 'Tags'].join(',');
                const analyzeUrl = `${computerVisionEndpoint}vision/v3.2/analyze?visualFeatures=${simpleFeatures}`;
                
                const response = await axios.post(analyzeUrl, imageBuffer, {
                    headers: {
                        'Ocp-Apim-Subscription-Key': computerVisionKey,
                        'Content-Type': 'application/octet-stream'
                    },
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                });
                
                analysis = response.data;
                context.log('Fallback analysis successful');
                
            } catch (fallbackError) {
                const errorMessage = fallbackError.response?.data?.error?.message || fallbackError.message;
                throw new Error(`Computer Vision API failed: ${errorMessage}`);
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

        // Extract text from image using OCR if needed
        // Note: OCR is a separate API call, only do it if we need text extraction
        if (analysisType === 'construction' || analysisType === 'ocr') {
            const textResults = await extractTextFromImage(computerVisionEndpoint, computerVisionKey, imageBuffer, context);
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

// Extract text from image using OCR REST API
async function extractTextFromImage(endpoint, apiKey, imageBuffer, context) {
    try {
        const axios = require('axios');
        
        // Submit image for OCR processing
        const readUrl = `${endpoint}vision/v3.2/read/analyze`;
        
        const submitResponse = await axios.post(readUrl, imageBuffer, {
            headers: {
                'Ocp-Apim-Subscription-Key': apiKey,
                'Content-Type': 'application/octet-stream'
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });
        
        // Get the operation location from response headers
        const operationLocation = submitResponse.headers['operation-location'];
        if (!operationLocation) {
            throw new Error('No operation location returned from OCR API');
        }
        
        context.log('OCR operation started, waiting for results...');
        
        // Poll for OCR results
        let result;
        let attempts = 0;
        const maxAttempts = 10;
        
        do {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const resultResponse = await axios.get(operationLocation, {
                headers: {
                    'Ocp-Apim-Subscription-Key': apiKey
                }
            });
            
            result = resultResponse.data;
            attempts++;
            
        } while (result.status === 'running' && attempts < maxAttempts);
        
        if (result.status !== 'succeeded') {
            throw new Error(`OCR failed with status: ${result.status}`);
        }
        
        // Extract text from results
        let fullText = '';
        const lines = [];
        
        if (result.analyzeResult && result.analyzeResult.readResults) {
            for (const page of result.analyzeResult.readResults) {
                for (const line of page.lines) {
                    fullText += line.text + '\n';
                    lines.push({
                        text: line.text,
                        boundingBox: line.boundingBox
                    });
                }
            }
        }
        
        context.log(`OCR extracted ${lines.length} lines of text`);
        
        return {
            text: fullText,
            lines: lines
        };
    } catch (error) {
        console.error('OCR error:', error.message);
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

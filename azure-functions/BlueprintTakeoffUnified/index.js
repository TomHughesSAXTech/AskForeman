const { ComputerVisionClient } = require('@azure/cognitiveservices-computervision');
const { ApiKeyCredentials } = require('@azure/ms-rest-js');
const { DocumentAnalysisClient, AzureKeyCredential } = require('@azure/ai-form-recognizer');
const { BlobServiceClient } = require('@azure/storage-blob');
const crypto = require('crypto');

// Initialize clients
const computerVisionKey = process.env.COMPUTER_VISION_KEY;
const computerVisionEndpoint = process.env.COMPUTER_VISION_ENDPOINT;
const formRecognizerKey = process.env.FORM_RECOGNIZER_KEY || process.env.DOCUMENT_INTELLIGENCE_KEY;
const formRecognizerEndpoint = process.env.FORM_RECOGNIZER_ENDPOINT || process.env.DOCUMENT_INTELLIGENCE_ENDPOINT;
const storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

const computerVisionClient = computerVisionKey && computerVisionEndpoint ? 
    new ComputerVisionClient(
        new ApiKeyCredentials({ inHeader: { 'Ocp-Apim-Subscription-Key': computerVisionKey } }),
        computerVisionEndpoint
    ) : null;

const documentAnalysisClient = formRecognizerKey && formRecognizerEndpoint ?
    new DocumentAnalysisClient(formRecognizerEndpoint, new AzureKeyCredential(formRecognizerKey)) : null;

const blobServiceClient = BlobServiceClient.fromConnectionString(storageConnectionString);

module.exports = async function (context, req) {
    context.log('BlueprintTakeoffUnified function processing blueprint/construction document');
    
    try {
        // Parse request body
        const requestBody = req.body;
        
        if (!requestBody || !requestBody.fileName) {
            context.res = {
                status: 400,
                body: { success: false, error: 'fileName is required' }
            };
            return;
        }

        const {
            fileName,
            file: base64File,
            mimeType = 'application/pdf',
            category = 'blueprints',
            client = 'general',
            clientName = 'General',
            extractDimensions = true,
            extractMeasurements = true,
            extractMaterials = true,
            extractRoomNumbers = true,
            extractSpecifications = true,
            enableOCR = true,
            processingType = 'blueprint'
        } = requestBody;

        // Decode base64 file
        let fileBuffer;
        try {
            fileBuffer = Buffer.from(base64File, 'base64');
        } catch (error) {
            context.res = {
                status: 400,
                body: { success: false, error: 'Invalid base64 file content' }
            };
            return;
        }

        context.log(`Processing blueprint: ${fileName} (${fileBuffer.length} bytes)`);

        // Initialize results
        const results = {
            success: true,
            fileName,
            client,
            clientName,
            category,
            processingType,
            fileSize: fileBuffer.length,
            extractedData: {}
        };

        // Step 1: Computer Vision Analysis for images/blueprints
        if (computerVisionClient && (mimeType.startsWith('image/') || enableOCR)) {
            try {
                context.log('Running Computer Vision analysis...');
                
                // Upload to temporary blob for Computer Vision
                const containerClient = blobServiceClient.getContainerClient('temp-processing');
                await containerClient.createIfNotExists();
                
                const tempBlobName = `temp/${crypto.randomBytes(16).toString('hex')}-${fileName}`;
                const blockBlobClient = containerClient.getBlockBlobClient(tempBlobName);
                await blockBlobClient.upload(fileBuffer, fileBuffer.length);
                
                // Generate SAS URL for Computer Vision
                const blobUrl = blockBlobClient.url;
                
                // Analyze image with Computer Vision
                const visualFeatures = ['Categories', 'Tags', 'Description', 'Objects', 'ImageType'];
                const details = ['Landmarks', 'Celebrities'];
                
                const analysis = await computerVisionClient.analyzeImage(blobUrl, {
                    visualFeatures,
                    details
                });
                
                // Extract OCR text if enabled
                if (enableOCR) {
                    const ocrResult = await computerVisionClient.recognizePrintedText(false, blobUrl);
                    const ocrText = extractOCRText(ocrResult);
                    results.extractedData.ocrText = ocrText;
                    
                    // Extract blueprint-specific data from OCR text
                    if (extractDimensions) {
                        results.extractedData.dimensions = extractDimensionsFromText(ocrText);
                    }
                    if (extractMeasurements) {
                        results.extractedData.measurements = extractMeasurementsFromText(ocrText);
                    }
                    if (extractMaterials) {
                        results.extractedData.materials = extractMaterialsFromText(ocrText);
                    }
                    if (extractRoomNumbers) {
                        results.extractedData.roomNumbers = extractRoomNumbersFromText(ocrText);
                    }
                    if (extractSpecifications) {
                        results.extractedData.specifications = extractSpecificationsFromText(ocrText);
                    }
                }
                
                // Add Computer Vision analysis results
                results.extractedData.visualAnalysis = {
                    tags: analysis.tags,
                    description: analysis.description,
                    objects: analysis.objects,
                    categories: analysis.categories
                };
                
                // Clean up temp blob
                await blockBlobClient.delete();
                
            } catch (error) {
                context.log.error('Computer Vision analysis failed:', error);
                results.computerVisionError = error.message;
            }
        }

        // Step 2: Document Intelligence (Form Recognizer) for PDFs
        if (documentAnalysisClient && mimeType === 'application/pdf') {
            try {
                context.log('Running Document Intelligence analysis...');
                
                // Upload to temporary blob for Form Recognizer
                const containerClient = blobServiceClient.getContainerClient('temp-processing');
                await containerClient.createIfNotExists();
                
                const tempBlobName = `temp/${crypto.randomBytes(16).toString('hex')}.pdf`;
                const blockBlobClient = containerClient.getBlockBlobClient(tempBlobName);
                await blockBlobClient.upload(fileBuffer, fileBuffer.length);
                
                const blobUrl = blockBlobClient.url;
                
                // Use layout model for blueprints to get tables, figures, and structure
                const poller = await documentAnalysisClient.beginAnalyzeDocumentFromUrl(
                    'prebuilt-layout',
                    blobUrl
                );
                
                const result = await poller.pollUntilDone();
                
                // Extract structured data
                const extractedTables = [];
                const extractedText = [];
                const extractedFigures = [];
                
                // Extract pages and text
                if (result.pages) {
                    for (const page of result.pages) {
                        if (page.lines) {
                            for (const line of page.lines) {
                                extractedText.push(line.content);
                            }
                        }
                    }
                }
                
                // Extract tables
                if (result.tables) {
                    for (const table of result.tables) {
                        const tableData = {
                            rowCount: table.rowCount,
                            columnCount: table.columnCount,
                            cells: []
                        };
                        
                        for (const cell of table.cells) {
                            tableData.cells.push({
                                rowIndex: cell.rowIndex,
                                columnIndex: cell.columnIndex,
                                content: cell.content,
                                isHeader: cell.kind === 'columnHeader' || cell.kind === 'rowHeader'
                            });
                        }
                        
                        extractedTables.push(tableData);
                    }
                }
                
                // Extract figures/drawings
                if (result.figures) {
                    for (const figure of result.figures) {
                        extractedFigures.push({
                            caption: figure.caption?.content || '',
                            pageNumber: figure.pageNumber
                        });
                    }
                }
                
                // Combine text for analysis
                const fullText = extractedText.join('\n');
                
                // Extract blueprint-specific data from Document Intelligence text
                if (extractDimensions && !results.extractedData.dimensions) {
                    results.extractedData.dimensions = extractDimensionsFromText(fullText);
                }
                if (extractMeasurements && !results.extractedData.measurements) {
                    results.extractedData.measurements = extractMeasurementsFromText(fullText);
                }
                if (extractMaterials && !results.extractedData.materials) {
                    results.extractedData.materials = extractMaterialsFromText(fullText);
                }
                if (extractRoomNumbers && !results.extractedData.roomNumbers) {
                    results.extractedData.roomNumbers = extractRoomNumbersFromText(fullText);
                }
                if (extractSpecifications && !results.extractedData.specifications) {
                    results.extractedData.specifications = extractSpecificationsFromText(fullText);
                }
                
                // Add Document Intelligence results
                results.extractedData.documentAnalysis = {
                    pageCount: result.pages?.length || 0,
                    tableCount: extractedTables.length,
                    figureCount: extractedFigures.length,
                    tables: extractedTables,
                    figures: extractedFigures,
                    extractedText: fullText.substring(0, 1000) + (fullText.length > 1000 ? '...' : '')
                };
                
                // Clean up temp blob
                await blockBlobClient.delete();
                
            } catch (error) {
                context.log.error('Document Intelligence analysis failed:', error);
                results.documentIntelligenceError = error.message;
            }
        }

        // Step 3: Store processed data in blob storage
        const containerClient = blobServiceClient.getContainerClient('fcs-clients');
        await containerClient.createIfNotExists();
        
        // Store original file
        const originalPath = `FCS-OriginalClients/${client}/${category}/${fileName}`;
        const originalBlob = containerClient.getBlockBlobClient(originalPath);
        await originalBlob.upload(fileBuffer, fileBuffer.length);
        
        // Store extracted data
        const extractedDataPath = `FCS-ProcessedBlueprints/${client}/${category}/${fileName}.json`;
        const extractedBlob = containerClient.getBlockBlobClient(extractedDataPath);
        await extractedBlob.upload(
            JSON.stringify(results.extractedData, null, 2),
            Buffer.byteLength(JSON.stringify(results.extractedData))
        );
        
        results.originalPath = originalPath;
        results.extractedDataPath = extractedDataPath;
        
        // Add summary statistics
        results.summary = {
            dimensionsFound: results.extractedData.dimensions?.length || 0,
            measurementsFound: results.extractedData.measurements?.length || 0,
            materialsFound: results.extractedData.materials?.length || 0,
            roomNumbersFound: results.extractedData.roomNumbers?.length || 0,
            specificationsFound: results.extractedData.specifications?.length || 0,
            tablesExtracted: results.extractedData.documentAnalysis?.tableCount || 0,
            figuresExtracted: results.extractedData.documentAnalysis?.figureCount || 0
        };
        
        context.log('Blueprint processing completed successfully');
        
        context.res = {
            status: 200,
            body: results
        };
        
    } catch (error) {
        context.log.error('Error in BlueprintTakeoffUnified:', error);
        context.res = {
            status: 500,
            body: {
                success: false,
                error: error.message || 'Internal server error'
            }
        };
    }
};

// Helper function to extract text from OCR result
function extractOCRText(ocrResult) {
    let text = '';
    if (ocrResult.regions) {
        for (const region of ocrResult.regions) {
            for (const line of region.lines || []) {
                for (const word of line.words || []) {
                    text += word.text + ' ';
                }
                text += '\n';
            }
        }
    }
    return text.trim();
}

// Extract dimensions (e.g., "12' x 24'", "3.5m x 7.2m", "100mm")
function extractDimensionsFromText(text) {
    const dimensions = [];
    const patterns = [
        /(\d+(?:\.\d+)?)\s*['"']?\s*x\s*(\d+(?:\.\d+)?)\s*['"']?/gi,
        /(\d+(?:\.\d+)?)\s*(ft|feet|m|mm|cm|in|inch|inches)\s*x\s*(\d+(?:\.\d+)?)\s*(ft|feet|m|mm|cm|in|inch|inches)/gi,
        /(\d+(?:\.\d+)?)\s*['"]\s*=\s*(\d+(?:\.\d+)?)\s*['"]/gi,
        /(\d+(?:\.\d+)?)\s*(meters?|feet|ft|mm|cm)/gi
    ];
    
    for (const pattern of patterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            dimensions.push(match[0]);
        }
    }
    
    return [...new Set(dimensions)]; // Remove duplicates
}

// Extract measurements and scales
function extractMeasurementsFromText(text) {
    const measurements = [];
    const patterns = [
        /scale\s*:\s*(\d+:\d+|\d+"\s*=\s*\d+')/gi,
        /(\d+(?:\.\d+)?)\s*sq\.?\s*(ft|feet|m|meters?)/gi,
        /(\d+(?:\.\d+)?)\s*(square|sq)\s+(feet|ft|meters?|m)/gi,
        /area\s*:\s*(\d+(?:\.\d+)?)/gi
    ];
    
    for (const pattern of patterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            measurements.push(match[0]);
        }
    }
    
    return [...new Set(measurements)];
}

// Extract materials
function extractMaterialsFromText(text) {
    const materials = [];
    const materialKeywords = [
        'steel', 'concrete', 'wood', 'glass', 'aluminum', 'copper', 'brass',
        'pvc', 'vinyl', 'tile', 'carpet', 'drywall', 'gypsum', 'insulation',
        'plywood', 'mdf', 'osb', 'laminate', 'granite', 'marble', 'quartz',
        'brick', 'stone', 'stucco', 'siding', 'shingle', 'membrane', 'foam',
        'fiberglass', 'rebar', 'mesh', 'paint', 'primer', 'sealant', 'adhesive',
        'HM', 'S.S.', 'GWB', 'CMU', 'CLT', 'STC', 'GFRC'
    ];
    
    const textLower = text.toLowerCase();
    for (const material of materialKeywords) {
        if (textLower.includes(material.toLowerCase())) {
            // Try to get context around the material
            const pattern = new RegExp(`\\b[^.]*${material}[^.]*\\b`, 'gi');
            const matches = text.match(pattern);
            if (matches) {
                materials.push(...matches.slice(0, 3)); // Limit to 3 instances per material
            }
        }
    }
    
    return [...new Set(materials)];
}

// Extract room numbers
function extractRoomNumbersFromText(text) {
    const roomNumbers = [];
    const patterns = [
        /room\s*#?\s*(\d+[A-Z]?)/gi,
        /rm\s*#?\s*(\d+[A-Z]?)/gi,
        /unit\s*#?\s*(\d+[A-Z]?)/gi,
        /suite\s*#?\s*(\d+[A-Z]?)/gi,
        /apartment\s*#?\s*(\d+[A-Z]?)/gi,
        /apt\s*#?\s*(\d+[A-Z]?)/gi,
        /space\s*#?\s*(\d+[A-Z]?)/gi,
        /\b([A-Z]\d{2,4})\b/g, // Pattern like A101, B202
        /\b(\d{3,4}[A-Z]?)\b/g // Pattern like 101, 202A
    ];
    
    for (const pattern of patterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            roomNumbers.push(match[1] || match[0]);
        }
    }
    
    return [...new Set(roomNumbers)];
}

// Extract specifications
function extractSpecificationsFromText(text) {
    const specifications = [];
    const specPatterns = [
        /spec\s*#?\s*(\d+)/gi,
        /specification\s*#?\s*(\d+)/gi,
        /detail\s*#?\s*([A-Z]\d+)/gi,
        /section\s*#?\s*(\d+)/gi,
        /([A-Z]\d+)\s+(head|jamb|sill|detail)/gi,
        /type\s+([A-Z]\d?)/gi,
        /schedule\s+([A-Z]\d?)/gi,
        /drawing\s*#?\s*([A-Z]?\d+)/gi
    ];
    
    for (const pattern of specPatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            specifications.push(match[0]);
        }
    }
    
    return [...new Set(specifications)];
}

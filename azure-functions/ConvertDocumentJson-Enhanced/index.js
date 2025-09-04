/**
 * ConvertDocumentJson - Enhanced Industry-Agnostic Document Processor
 * Uses both Computer Vision and Document Intelligence for comprehensive analysis
 * Configurable for any industry through analysis parameters
 */

const { BlobServiceClient } = require('@azure/storage-blob');
const { DocumentAnalysisClient, AzureKeyCredential } = require('@azure/ai-form-recognizer');
const { ComputerVisionClient } = require('@azure/cognitiveservices-computervision');
const { ApiKeyCredentials } = require('@azure/ms-rest-js');

module.exports = async function (context, req) {
    context.log('Enhanced ConvertDocumentJson function triggered');

    try {
        const { 
            blobUrl, 
            fileName, 
            category, 
            client, 
            metadata,
            analysisMode = 'auto',  // 'auto', 'text', 'visual', 'comprehensive'
            industryType = 'general', // 'construction', 'medical', 'legal', 'financial', 'engineering', 'general'
            extractionOptions = {}
        } = req.body;

        if (!blobUrl || !fileName) {
            context.res = {
                status: 400,
                body: { error: 'Missing required parameters: blobUrl and fileName' }
            };
            return;
        }

        // Initialize all AI services
        const services = await initializeServices();
        
        // Determine file type and best analysis approach
        const fileExtension = fileName.split('.').pop().toLowerCase();
        const analysisApproach = determineAnalysisApproach(fileExtension, analysisMode, industryType);
        
        let analysisResults = {
            documentInfo: {
                fileName: fileName,
                fileType: fileExtension,
                client: client,
                category: category,
                industryType: industryType,
                processedAt: new Date().toISOString()
            },
            extractedData: {}
        };

        // Execute analysis based on determined approach
        if (analysisApproach.useDocumentIntelligence) {
            const docIntelligenceResults = await analyzeWithDocumentIntelligence(
                services.documentClient,
                blobUrl,
                industryType,
                extractionOptions
            );
            analysisResults.extractedData.documentIntelligence = docIntelligenceResults;
        }

        if (analysisApproach.useComputerVision) {
            const visionResults = await analyzeWithComputerVision(
                services.visionClient,
                blobUrl,
                industryType,
                extractionOptions
            );
            analysisResults.extractedData.computerVision = visionResults;
        }

        // Apply industry-specific processing
        if (industryType !== 'general') {
            analysisResults.industrySpecific = await applyIndustrySpecificAnalysis(
                analysisResults.extractedData,
                industryType,
                extractionOptions
            );
        }

        // Generate structured output based on industry needs
        analysisResults.structuredOutput = generateStructuredOutput(
            analysisResults,
            industryType,
            extractionOptions
        );

        // Calculate confidence and quality metrics
        analysisResults.qualityMetrics = calculateQualityMetrics(analysisResults);

        // Store processed results
        const storageResult = await storeAnalysisResults(
            services.blobServiceClient,
            analysisResults,
            client,
            category,
            fileName
        );

        // Return comprehensive response
        context.res = {
            status: 200,
            body: {
                success: true,
                message: 'Document analyzed successfully',
                storageUrl: storageResult.url,
                documentInfo: analysisResults.documentInfo,
                structuredOutput: analysisResults.structuredOutput,
                qualityMetrics: analysisResults.qualityMetrics,
                industrySpecific: analysisResults.industrySpecific,
                extractedPreview: getPreview(analysisResults)
            }
        };

    } catch (error) {
        context.log.error('Error in enhanced document processing:', error);
        
        context.res = {
            status: 500,
            body: {
                error: 'Failed to process document',
                details: error.message
            }
        };
    }
};

// Initialize all AI services
async function initializeServices() {
    return {
        documentClient: new DocumentAnalysisClient(
            process.env.DOCUMENT_INTELLIGENCE_ENDPOINT,
            new AzureKeyCredential(process.env.DOCUMENT_INTELLIGENCE_KEY)
        ),
        visionClient: new ComputerVisionClient(
            new ApiKeyCredentials({ 
                inHeader: { 'Ocp-Apim-Subscription-Key': process.env.COMPUTER_VISION_KEY } 
            }),
            process.env.COMPUTER_VISION_ENDPOINT
        ),
        blobServiceClient: BlobServiceClient.fromConnectionString(
            process.env.AZURE_STORAGE_CONNECTION_STRING
        )
    };
}

// Determine the best analysis approach
function determineAnalysisApproach(fileExtension, analysisMode, industryType) {
    const approach = {
        useDocumentIntelligence: false,
        useComputerVision: false,
        model: 'prebuilt-layout'
    };

    // File type based decisions
    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif'];
    const documentTypes = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
    
    if (analysisMode === 'auto') {
        if (documentTypes.includes(fileExtension)) {
            approach.useDocumentIntelligence = true;
            // Also use Computer Vision for PDFs with images/diagrams
            if (fileExtension === 'pdf') {
                approach.useComputerVision = true;
            }
        } else if (imageTypes.includes(fileExtension)) {
            approach.useComputerVision = true;
            approach.useDocumentIntelligence = true; // For OCR
        }
    } else if (analysisMode === 'comprehensive') {
        approach.useDocumentIntelligence = true;
        approach.useComputerVision = true;
    } else if (analysisMode === 'text') {
        approach.useDocumentIntelligence = true;
    } else if (analysisMode === 'visual') {
        approach.useComputerVision = true;
    }

    // Industry-specific model selection
    if (industryType === 'financial') {
        approach.model = 'prebuilt-invoice';
    } else if (industryType === 'legal') {
        approach.model = 'prebuilt-contract';
    } else if (industryType === 'medical') {
        approach.model = 'prebuilt-healthInsuranceCard.us';
    }

    return approach;
}

// Analyze with Document Intelligence
async function analyzeWithDocumentIntelligence(documentClient, blobUrl, industryType, options) {
    const model = options.documentModel || 'prebuilt-layout';
    
    const poller = await documentClient.beginAnalyzeDocumentFromUrl(model, blobUrl);
    const result = await poller.pollUntilDone();
    
    return {
        content: result.content || '',
        pages: result.pages?.map(page => ({
            pageNumber: page.pageNumber,
            width: page.width,
            height: page.height,
            angle: page.angle,
            lines: page.lines?.map(line => ({
                content: line.content,
                boundingBox: line.boundingRegions?.[0]?.boundingBox,
                spans: line.spans
            })) || [],
            words: page.words?.map(word => ({
                content: word.content,
                confidence: word.confidence,
                boundingBox: word.boundingRegions?.[0]?.boundingBox
            })) || [],
            selectionMarks: page.selectionMarks || []
        })) || [],
        tables: result.tables?.map(table => ({
            rowCount: table.rowCount,
            columnCount: table.columnCount,
            boundingRegions: table.boundingRegions,
            cells: table.cells?.map(cell => ({
                content: cell.content,
                rowIndex: cell.rowIndex,
                columnIndex: cell.columnIndex,
                rowSpan: cell.rowSpan || 1,
                columnSpan: cell.columnSpan || 1,
                kind: cell.kind
            })) || []
        })) || [],
        keyValuePairs: result.keyValuePairs || [],
        entities: result.entities || [],
        styles: result.styles || [],
        languages: result.languages || []
    };
}

// Analyze with Computer Vision
async function analyzeWithComputerVision(visionClient, blobUrl, industryType, options) {
    // Perform multiple vision analyses
    const features = options.visionFeatures || [
        'Categories',
        'Tags',
        'Description',
        'Objects',
        'Brands',
        'Adult',
        'Color',
        'ImageType',
        'Faces'
    ];
    
    const analysis = await visionClient.analyzeImage(blobUrl, {
        visualFeatures: features,
        details: ['Landmarks', 'Celebrities'],
        language: options.language || 'en'
    });
    
    // Perform OCR if text detection is needed
    let ocrResults = null;
    if (options.performOCR !== false) {
        try {
            const ocr = await visionClient.recognizePrintedText(true, blobUrl);
            ocrResults = {
                language: ocr.language,
                orientation: ocr.orientation,
                regions: ocr.regions?.map(region => ({
                    boundingBox: region.boundingBox,
                    lines: region.lines?.map(line => ({
                        boundingBox: line.boundingBox,
                        words: line.words?.map(word => ({
                            text: word.text,
                            boundingBox: word.boundingBox
                        })) || []
                    })) || []
                })) || []
            };
        } catch (ocrError) {
            // OCR might fail for non-text images
            context.log('OCR not applicable or failed:', ocrError.message);
        }
    }
    
    return {
        description: analysis.description,
        tags: analysis.tags,
        categories: analysis.categories,
        objects: analysis.objects,
        brands: analysis.brands,
        faces: analysis.faces,
        color: analysis.color,
        imageType: analysis.imageType,
        adult: analysis.adult,
        metadata: analysis.metadata,
        ocr: ocrResults
    };
}

// Apply industry-specific analysis
async function applyIndustrySpecificAnalysis(extractedData, industryType, options) {
    const industryResults = {};
    
    switch (industryType) {
        case 'construction':
            industryResults.measurements = extractConstructionMeasurements(extractedData);
            industryResults.materials = identifyConstructionMaterials(extractedData);
            industryResults.safety = identifySafetyRequirements(extractedData);
            break;
            
        case 'medical':
            industryResults.patientInfo = extractPatientInformation(extractedData);
            industryResults.diagnoses = extractDiagnoses(extractedData);
            industryResults.medications = extractMedications(extractedData);
            break;
            
        case 'legal':
            industryResults.parties = extractLegalParties(extractedData);
            industryResults.dates = extractLegalDates(extractedData);
            industryResults.clauses = extractLegalClauses(extractedData);
            break;
            
        case 'financial':
            industryResults.amounts = extractFinancialAmounts(extractedData);
            industryResults.accounts = extractAccountNumbers(extractedData);
            industryResults.transactions = extractTransactions(extractedData);
            break;
            
        case 'engineering':
            industryResults.specifications = extractEngineeringSpecs(extractedData);
            industryResults.tolerances = extractTolerances(extractedData);
            industryResults.components = extractComponents(extractedData);
            break;
    }
    
    return industryResults;
}

// Generate structured output
function generateStructuredOutput(analysisResults, industryType, options) {
    const structured = {
        summary: generateSummary(analysisResults),
        keyData: extractKeyData(analysisResults, industryType),
        entities: consolidateEntities(analysisResults),
        relationships: identifyRelationships(analysisResults)
    };
    
    // Add custom fields if specified
    if (options.customFields) {
        structured.custom = extractCustomFields(analysisResults, options.customFields);
    }
    
    return structured;
}

// Calculate quality metrics
function calculateQualityMetrics(analysisResults) {
    const metrics = {
        textConfidence: 0,
        completeness: 0,
        clarity: 0,
        dataQuality: 0
    };
    
    // Calculate text confidence from OCR/Document Intelligence
    if (analysisResults.extractedData.documentIntelligence) {
        const words = analysisResults.extractedData.documentIntelligence.pages
            ?.flatMap(p => p.words || []) || [];
        if (words.length > 0) {
            metrics.textConfidence = words.reduce((sum, w) => sum + (w.confidence || 0), 0) / words.length;
        }
    }
    
    // Calculate completeness based on extracted fields
    const expectedFields = ['content', 'tables', 'entities'];
    const extractedFields = Object.keys(analysisResults.extractedData.documentIntelligence || {});
    metrics.completeness = extractedFields.filter(f => expectedFields.includes(f)).length / expectedFields.length;
    
    // Calculate clarity from vision analysis
    if (analysisResults.extractedData.computerVision) {
        const visionData = analysisResults.extractedData.computerVision;
        metrics.clarity = visionData.description?.captions?.[0]?.confidence || 0;
    }
    
    // Overall data quality score
    metrics.dataQuality = (metrics.textConfidence + metrics.completeness + metrics.clarity) / 3;
    
    return metrics;
}

// Store analysis results
async function storeAnalysisResults(blobServiceClient, analysisResults, client, category, fileName) {
    const containerName = 'fcs-clients';
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    const blobName = `FCS-ConvertedClients/${client}/${category}/${fileName}_analysis.json`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    const jsonData = JSON.stringify(analysisResults, null, 2);
    await blockBlobClient.upload(jsonData, jsonData.length);
    
    return {
        url: blockBlobClient.url,
        blobName: blobName
    };
}

// Get preview of extracted content
function getPreview(analysisResults) {
    const preview = {
        textSnippet: '',
        tableCount: 0,
        entityCount: 0,
        pageCount: 0
    };
    
    if (analysisResults.extractedData.documentIntelligence) {
        const docData = analysisResults.extractedData.documentIntelligence;
        preview.textSnippet = (docData.content || '').substring(0, 500);
        preview.tableCount = docData.tables?.length || 0;
        preview.entityCount = docData.entities?.length || 0;
        preview.pageCount = docData.pages?.length || 0;
    }
    
    return preview;
}

// Industry-specific helper functions (examples)
function extractConstructionMeasurements(data) {
    const measurements = [];
    const measurementPattern = /(\d+(?:\.\d+)?)\s*(ft|feet|m|meter|sq|sf|lf|cy|yd|yards?)/gi;
    
    const text = data.documentIntelligence?.content || '';
    let match;
    while ((match = measurementPattern.exec(text)) !== null) {
        measurements.push({
            value: parseFloat(match[1]),
            unit: match[2],
            context: text.substring(Math.max(0, match.index - 30), Math.min(text.length, match.index + match[0].length + 30))
        });
    }
    
    return measurements;
}

function identifyConstructionMaterials(data) {
    const materials = [];
    const materialKeywords = ['concrete', 'steel', 'wood', 'lumber', 'drywall', 'paint', 'tile', 'carpet', 'glass', 'aluminum', 'copper', 'pvc'];
    
    const text = (data.documentIntelligence?.content || '').toLowerCase();
    materialKeywords.forEach(material => {
        if (text.includes(material)) {
            materials.push({
                type: material,
                mentions: (text.match(new RegExp(material, 'gi')) || []).length
            });
        }
    });
    
    return materials;
}

function identifySafetyRequirements(data) {
    const safetyTerms = ['safety', 'hazard', 'ppe', 'osha', 'warning', 'caution', 'danger', 'protection'];
    const requirements = [];
    
    const text = (data.documentIntelligence?.content || '').toLowerCase();
    safetyTerms.forEach(term => {
        const regex = new RegExp(`[^.]*${term}[^.]*\\.`, 'gi');
        const matches = text.match(regex) || [];
        matches.forEach(match => {
            requirements.push({
                type: term,
                requirement: match.trim()
            });
        });
    });
    
    return requirements;
}

// Placeholder functions for other industries
function extractPatientInformation(data) { return {}; }
function extractDiagnoses(data) { return []; }
function extractMedications(data) { return []; }
function extractLegalParties(data) { return []; }
function extractLegalDates(data) { return []; }
function extractLegalClauses(data) { return []; }
function extractFinancialAmounts(data) { return []; }
function extractAccountNumbers(data) { return []; }
function extractTransactions(data) { return []; }
function extractEngineeringSpecs(data) { return []; }
function extractTolerances(data) { return []; }
function extractComponents(data) { return []; }
function generateSummary(results) { return ''; }
function extractKeyData(results, industryType) { return {}; }
function consolidateEntities(results) { return []; }
function identifyRelationships(results) { return []; }
function extractCustomFields(results, fields) { return {}; }

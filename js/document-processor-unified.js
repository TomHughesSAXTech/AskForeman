/**
 * Unified Document Processor
 * Handles both regular document uploads and takeoff analysis results
 * Integrates with n8n workflows for seamless data processing
 */

class UnifiedDocumentProcessor {
    constructor(config) {
        this.config = {
            webhookUrl: config.uploadWebhookUrl || 'https://workflows.saxtechnology.com/webhook/ask-foreman/upload',
            azureStorage: config.azureStorage || {},
            azureAI: config.azureAI || {},
            maxWebhookSize: 50 * 1024 * 1024, // 50MB limit for webhook
            ...config
        };
        
        this.processingQueue = [];
        this.currentTakeoffData = null;
    }

    /**
     * Process any type of document - regular upload or takeoff analysis
     */
    async processDocument(file, metadata = {}) {
        try {
            // Determine document type and processing path
            const documentType = this.determineDocumentType(file, metadata);
            
            // Add to processing queue
            const queueItem = {
                file: file,
                metadata: metadata,
                type: documentType,
                status: 'pending',
                timestamp: new Date().toISOString()
            };
            
            this.processingQueue.push(queueItem);
            
            // Process based on type
            let result;
            switch (documentType) {
                case 'takeoff-drawing':
                    result = await this.processTakeoffDrawing(file, metadata);
                    break;
                    
                case 'analyzed-takeoff':
                    result = await this.processAnalyzedTakeoff(metadata);
                    break;
                    
                case 'estimate-document':
                    result = await this.processEstimateDocument(file, metadata);
                    break;
                    
                case 'standard-document':
                default:
                    result = await this.processStandardDocument(file, metadata);
                    break;
            }
            
            // Update queue status
            queueItem.status = 'completed';
            queueItem.result = result;
            
            return result;
            
        } catch (error) {
            console.error('Document processing error:', error);
            throw error;
        }
    }

    /**
     * Determine the type of document being processed
     */
    determineDocumentType(file, metadata) {
        // Check if this is a takeoff analysis result (no file, just data)
        if (!file && metadata.takeoffResults) {
            return 'analyzed-takeoff';
        }
        
        // Check if this is a drawing for takeoff analysis
        if (metadata.category === 'drawings' && metadata.forTakeoff) {
            return 'takeoff-drawing';
        }
        
        // Check if this is an estimate document
        if (metadata.category === 'estimates' || metadata.fromEstimator) {
            return 'estimate-document';
        }
        
        // Default to standard document
        return 'standard-document';
    }

    /**
     * Process a drawing for takeoff analysis
     */
    async processTakeoffDrawing(file, metadata) {
        console.log('Processing drawing for takeoff analysis:', file.name);
        
        // Store the drawing for AI analysis
        this.currentTakeoffData = {
            drawing: file,
            metadata: metadata,
            timestamp: new Date().toISOString()
        };
        
        // If AI analyzer is available, use it
        if (window.DrawingAnalyzerAI && this.config.azureAI) {
            const analyzer = new window.DrawingAnalyzerAI(this.config.azureAI);
            
            // Read file as array buffer for AI analysis
            const arrayBuffer = await this.fileToArrayBuffer(file);
            
            // Perform AI analysis
            const analysis = await analyzer.analyzeDrawing(
                arrayBuffer,
                file.name,
                metadata.parameters || {}
            );
            
            // Process the analyzed results
            return await this.processAnalyzedTakeoff({
                takeoffResults: analysis,
                originalFile: file,
                ...metadata
            });
        } else {
            // Fallback to standard upload with takeoff flag
            return await this.processStandardDocument(file, {
                ...metadata,
                requiresTakeoffAnalysis: true
            });
        }
    }

    /**
     * Process analyzed takeoff results and prepare for n8n
     */
    async processAnalyzedTakeoff(metadata) {
        const takeoffData = metadata.takeoffResults;
        
        // Convert takeoff results to a format n8n can process
        const documentJSON = {
            type: 'takeoff-analysis',
            timestamp: new Date().toISOString(),
            client: metadata.client || 'general',
            project: metadata.project || '',
            
            // Drawing information
            drawing: {
                name: metadata.originalFile?.name || takeoffData.summary?.drawingName || 'Unknown',
                type: takeoffData.summary?.drawingType || 'floor-plan',
                scale: takeoffData.summary?.scale || '',
                building: takeoffData.summary?.building || '',
                floor: takeoffData.summary?.floor || '',
            },
            
            // Extracted measurements
            measurements: this.formatMeasurements(takeoffData.results?.calculations || {}),
            
            // Room information
            rooms: this.formatRooms(takeoffData.results?.rooms || []),
            
            // Calculated quantities
            quantities: this.calculateQuantities(takeoffData),
            
            // Material requirements
            materials: this.calculateMaterials(takeoffData),
            
            // Line items for estimate
            lineItems: this.generateLineItems(takeoffData),
            
            // AI confidence and metadata
            aiMetadata: {
                confidence: takeoffData.summary?.confidence || 0,
                processingTime: takeoffData.summary?.processingTime || 0,
                azureRequestId: takeoffData.summary?.requestId || '',
                recommendations: takeoffData.summary?.recommendations || []
            },
            
            // Raw data for reference
            rawAnalysis: takeoffData
        };
        
        // Send to n8n webhook for processing
        return await this.sendToN8N(documentJSON, 'takeoff-analysis');
    }

    /**
     * Format measurements for structured data
     */
    formatMeasurements(calculations) {
        return {
            areas: {
                total: calculations.totalArea || 0,
                floor: calculations.totalFloorArea || 0,
                wall: calculations.paintableArea || 0,
                ceiling: calculations.ceilingArea || 0,
                units: 'square_feet'
            },
            linear: {
                wallLength: calculations.totalWallLength || 0,
                perimeter: calculations.totalPerimeter || 0,
                units: 'feet'
            },
            counts: {
                doors: calculations.doors?.count || 0,
                windows: calculations.windows?.count || 0,
                rooms: calculations.roomCount || 0,
                fixtures: calculations.fixtures?.count || 0
            },
            volumes: {
                total: calculations.totalVolume || 0,
                units: 'cubic_feet'
            }
        };
    }

    /**
     * Format room information
     */
    formatRooms(rooms) {
        return rooms.map(room => ({
            id: room.id || `room_${Math.random().toString(36).substr(2, 9)}`,
            name: room.name || room.label || 'Unnamed',
            number: room.number || '',
            area: room.area || 0,
            perimeter: room.perimeter || 0,
            height: room.height || 10, // Default 10ft ceiling
            type: room.type || 'general',
            finishes: {
                walls: room.wallFinish || '',
                floor: room.floorFinish || '',
                ceiling: room.ceilingFinish || ''
            }
        }));
    }

    /**
     * Calculate quantities from takeoff data
     */
    calculateQuantities(takeoffData) {
        const calc = takeoffData.results?.calculations || {};
        const params = takeoffData.parameters || {};
        
        const quantities = {
            painting: {
                wallArea: calc.paintableArea || 0,
                ceilingArea: calc.ceilingArea || 0,
                coats: params.coatsRequired || 2,
                paintGallons: 0,
                primerGallons: 0
            },
            flooring: {
                area: calc.totalFloorArea || 0,
                waste: 10, // 10% waste factor
                totalRequired: 0
            },
            drywall: {
                area: calc.drywallArea || 0,
                sheets: 0 // 4x8 sheets
            }
        };
        
        // Calculate paint requirements
        const paintCoverage = 350; // sq ft per gallon
        const primerCoverage = 400; // sq ft per gallon
        
        quantities.painting.paintGallons = Math.ceil(
            (quantities.painting.wallArea + quantities.painting.ceilingArea) * 
            quantities.painting.coats / paintCoverage
        );
        
        quantities.painting.primerGallons = Math.ceil(
            (quantities.painting.wallArea + quantities.painting.ceilingArea) / 
            primerCoverage
        );
        
        // Calculate flooring with waste
        quantities.flooring.totalRequired = Math.ceil(
            quantities.flooring.area * (1 + quantities.flooring.waste / 100)
        );
        
        // Calculate drywall sheets (32 sq ft per 4x8 sheet)
        quantities.drywall.sheets = Math.ceil(quantities.drywall.area / 32);
        
        return quantities;
    }

    /**
     * Calculate material requirements
     */
    calculateMaterials(takeoffData) {
        const quantities = this.calculateQuantities(takeoffData);
        const materials = [];
        
        // Paint materials
        if (quantities.painting.paintGallons > 0) {
            materials.push({
                type: 'Interior Paint',
                quantity: quantities.painting.paintGallons,
                unit: 'GAL',
                unitCost: 35,
                totalCost: quantities.painting.paintGallons * 35,
                category: 'finishes'
            });
        }
        
        if (quantities.painting.primerGallons > 0) {
            materials.push({
                type: 'Primer',
                quantity: quantities.painting.primerGallons,
                unit: 'GAL',
                unitCost: 25,
                totalCost: quantities.painting.primerGallons * 25,
                category: 'finishes'
            });
        }
        
        // Flooring materials
        if (quantities.flooring.totalRequired > 0) {
            const floorType = takeoffData.parameters?.floorFinish || 'vinyl';
            const floorCosts = {
                'vinyl': 2.50,
                'carpet': 1.75,
                'hardwood': 5.50,
                'tile': 3.50,
                'epoxy': 1.25,
                'polished-concrete': 2.00
            };
            
            materials.push({
                type: `Flooring - ${floorType}`,
                quantity: quantities.flooring.totalRequired,
                unit: 'SF',
                unitCost: floorCosts[floorType] || 2.50,
                totalCost: quantities.flooring.totalRequired * (floorCosts[floorType] || 2.50),
                category: 'flooring'
            });
        }
        
        // Add other materials based on counts
        const calc = takeoffData.results?.calculations || {};
        
        if (calc.doors?.count > 0) {
            materials.push({
                type: 'Door Hardware Sets',
                quantity: calc.doors.count,
                unit: 'EA',
                unitCost: 85,
                totalCost: calc.doors.count * 85,
                category: 'hardware'
            });
        }
        
        if (calc.windows?.count > 0) {
            materials.push({
                type: 'Window Treatment',
                quantity: calc.windows.count,
                unit: 'EA',
                unitCost: 45,
                totalCost: calc.windows.count * 45,
                category: 'finishes'
            });
        }
        
        return materials;
    }

    /**
     * Generate line items for estimate
     */
    generateLineItems(takeoffData) {
        const lineItems = [];
        const calc = takeoffData.results?.calculations || {};
        const params = takeoffData.parameters || {};
        
        // Wall painting
        if (calc.paintableArea > 0) {
            lineItems.push({
                item: lineItems.length + 1,
                description: `Wall Painting - ${params.wallFinish || 'Standard'} (${calc.paintableArea.toFixed(0)} SF)`,
                category: 'finishes',
                quantity: calc.paintableArea,
                unit: 'SF',
                materialCost: 0.35,
                laborCost: 0.65,
                totalCost: calc.paintableArea * 1.00,
                source: 'takeoff-analysis'
            });
        }
        
        // Ceiling painting
        if (calc.ceilingArea > 0) {
            lineItems.push({
                item: lineItems.length + 1,
                description: `Ceiling Painting - ${params.ceilingFinish || 'Flat White'} (${calc.ceilingArea.toFixed(0)} SF)`,
                category: 'finishes',
                quantity: calc.ceilingArea,
                unit: 'SF',
                materialCost: 0.30,
                laborCost: 0.55,
                totalCost: calc.ceilingArea * 0.85,
                source: 'takeoff-analysis'
            });
        }
        
        // Floor finishing
        if (calc.totalFloorArea > 0) {
            const floorType = params.floorFinish || 'Standard';
            lineItems.push({
                item: lineItems.length + 1,
                description: `Floor Finishing - ${floorType} (${calc.totalFloorArea.toFixed(0)} SF)`,
                category: 'flooring',
                quantity: calc.totalFloorArea,
                unit: 'SF',
                materialCost: 2.50,
                laborCost: 1.50,
                totalCost: calc.totalFloorArea * 4.00,
                source: 'takeoff-analysis'
            });
        }
        
        // Door installation
        if (calc.doors?.count > 0) {
            lineItems.push({
                item: lineItems.length + 1,
                description: `Door Hardware & Installation (${calc.doors.count} doors)`,
                category: 'carpentry',
                quantity: calc.doors.count,
                unit: 'EA',
                materialCost: 85,
                laborCost: 125,
                totalCost: calc.doors.count * 210,
                source: 'takeoff-analysis'
            });
        }
        
        // Window treatment
        if (calc.windows?.count > 0) {
            lineItems.push({
                item: lineItems.length + 1,
                description: `Window Treatment/Finishing (${calc.windows.count} windows)`,
                category: 'finishes',
                quantity: calc.windows.count,
                unit: 'EA',
                materialCost: 45,
                laborCost: 35,
                totalCost: calc.windows.count * 80,
                source: 'takeoff-analysis'
            });
        }
        
        return lineItems;
    }

    /**
     * Process estimate document
     */
    async processEstimateDocument(file, metadata) {
        // Convert estimate to structured format
        const estimateData = {
            type: 'estimate',
            projectName: metadata.projectName || '',
            clientName: metadata.clientName || metadata.client || '',
            estimateDate: metadata.estimateDate || new Date().toISOString(),
            estimator: metadata.estimatorName || '',
            lineItems: metadata.lineItems || [],
            totals: metadata.totals || {},
            notes: metadata.notes || '',
            fromTakeoff: metadata.fromTakeoff || false
        };
        
        // Send to n8n for processing
        return await this.sendToN8N(estimateData, 'estimate');
    }

    /**
     * Process standard document
     */
    async processStandardDocument(file, metadata) {
        const fileSize = file.size;
        
        // Check file size for routing
        if (fileSize > this.config.maxWebhookSize) {
            return await this.processLargeFile(file, metadata);
        } else {
            return await this.processSmallFile(file, metadata);
        }
    }

    /**
     * Process small files via webhook
     */
    async processSmallFile(file, metadata) {
        const base64 = await this.fileToBase64(file);
        
        const payload = {
            file: base64,
            fileName: file.name,
            mimeType: file.type || 'application/pdf',
            category: metadata.category || 'documents',
            client: metadata.client || 'general',
            clientName: metadata.clientName || metadata.client || 'General',
            metadata: metadata
        };
        
        return await this.sendToN8N(payload, 'document-upload');
    }

    /**
     * Process large files via Azure
     */
    async processLargeFile(file, metadata) {
        // Upload to Azure first
        const blobPath = `FCS-OriginalClients/${metadata.client || 'general'}/${metadata.category || 'documents'}/${file.name}`;
        const uploadUrl = `https://${this.config.azureStorage.account}.blob.core.windows.net/${this.config.azureStorage.container}/${encodeURIComponent(blobPath)}${this.config.azureStorage.sasToken}`;
        
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'x-ms-blob-type': 'BlockBlob',
                'Content-Type': file.type || 'application/octet-stream'
            },
            body: file
        });
        
        if (!uploadResponse.ok) {
            throw new Error(`Azure upload failed: ${uploadResponse.status}`);
        }
        
        // Notify n8n about the uploaded file
        const payload = {
            action: 'process-large-file',
            blobPath: blobPath,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || 'application/pdf',
            category: metadata.category || 'documents',
            client: metadata.client || 'general',
            metadata: metadata
        };
        
        return await this.sendToN8N(payload, 'large-file-notification');
    }

    /**
     * Send data to n8n webhook
     */
    async sendToN8N(data, processType) {
        const payload = {
            ...data,
            processType: processType,
            timestamp: new Date().toISOString(),
            source: 'unified-document-processor'
        };
        
        const response = await fetch(this.config.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`n8n webhook failed: ${response.status}`);
        }
        
        return await response.json();
    }

    /**
     * Convert file to base64
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Convert file to array buffer
     */
    fileToArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Get processing status
     */
    getProcessingStatus() {
        return {
            queue: this.processingQueue,
            pending: this.processingQueue.filter(item => item.status === 'pending').length,
            completed: this.processingQueue.filter(item => item.status === 'completed').length,
            failed: this.processingQueue.filter(item => item.status === 'failed').length
        };
    }
}

// Export for use
window.UnifiedDocumentProcessor = UnifiedDocumentProcessor;

// Auto-initialize if config is available
if (window.API_CONFIG) {
    window.documentProcessor = new UnifiedDocumentProcessor({
        uploadWebhookUrl: window.API_CONFIG.uploadWebhookUrl,
        azureStorage: window.AZURE_STORAGE,
        azureAI: window.AZURE_AI_CONFIG
    });
}

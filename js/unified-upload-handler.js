// Unified Upload Handler - Routes documents through proper Azure Functions
// Handles: Blob storage, Vector indexing, Embeddings, Knowledge graph

(function() {
    'use strict';
    
    // Configuration - will be updated from API
    let CONFIG = {
        functionAppUrl: 'https://saxtech-docprocessor.azurewebsites.net/api',
        functionKey: '', // Will be fetched from config API
        blobStorage: {
            account: 'saxtechfcs',
            container: 'fcs-clients',
            sasToken: '?sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D'
        },
        webhooks: {
            upload: 'https://workflows.saxtechnology.com/webhook/ask-foreman/upload',
            index: 'https://workflows.saxtechnology.com/webhook/ask-foreman/index',
            embeddings: 'https://workflows.saxtechnology.com/webhook/ask-foreman/embeddings'
        }
    };
    
    // Enhanced upload function that handles all processing steps
    window.uploadDocumentWithProcessing = async function(file, metadata = {}) {
        try {
            console.log('Starting unified document upload:', file.name);
            
            // Step 1: Read file as base64
            const base64Data = await readFileAsBase64(file);
            
            // Step 2: Determine if this is a blueprint/drawing
            const isBlueprint = checkIfBlueprint(file.name, metadata.category);
            
            // Step 3: Prepare upload data
            const uploadData = {
                file: base64Data,
                fileName: file.name,
                mimeType: file.type || 'application/pdf',
                category: metadata.category || 'general',
                client: metadata.client || 'general',
                clientName: metadata.clientName || 'General',
                processingType: isBlueprint ? 'blueprint' : 'document',
                extractDimensions: isBlueprint,
                extractMeasurements: isBlueprint,
                extractRoomNumbers: isBlueprint,
                extractMaterials: isBlueprint,
                extractSpecifications: isBlueprint,
                // Add metadata for indexing
                metadata: {
                    uploadDate: new Date().toISOString(),
                    fileSize: file.size,
                    originalName: file.name,
                    category: metadata.category,
                    client: metadata.client,
                    processingType: isBlueprint ? 'blueprint' : 'document'
                }
            };
            
            // Step 4: Send to Azure Function for processing
            const functionUrl = isBlueprint ? 
                `${CONFIG.functionAppUrl}/BlueprintTakeoffUnified` : 
                `${CONFIG.functionAppUrl}/ConvertDocumentJson`;
            
            console.log(`Sending to Azure Function: ${functionUrl}`);
            
            const functionResponse = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-functions-key': CONFIG.functionKey
                },
                body: JSON.stringify(uploadData)
            });
            
            if (!functionResponse.ok) {
                // If Azure Function fails, try n8n webhook as fallback
                console.warn('Azure Function failed, trying webhook fallback');
                return await uploadViaWebhook(uploadData);
            }
            
            const result = await functionResponse.json();
            console.log('Azure Function processing result:', result);
            
            // Step 5: Upload to Blob Storage
            const blobUrl = await uploadToBlobStorage(file, metadata);
            result.blobUrl = blobUrl;
            
            // Step 6: Index the document
            await indexDocument(result, metadata);
            
            // Step 7: Generate embeddings
            await generateEmbeddings(result, metadata);
            
            // Step 8: Update knowledge graph if needed
            if (metadata.updateKnowledgeGraph) {
                await updateKnowledgeGraph(result, metadata);
            }
            
            console.log('Document upload and processing complete:', result);
            return result;
            
        } catch (error) {
            console.error('Error in unified upload handler:', error);
            throw error;
        }
    };
    
    // Helper function to read file as base64
    function readFileAsBase64(file) {
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
    
    // Check if file is a blueprint/drawing
    function checkIfBlueprint(fileName, category) {
        const blueprintKeywords = ['blueprint', 'drawing', 'plan', 'schematic', 
                                  'diagram', 'dwg', 'dxf', 'cad', 'floorplan', 
                                  'elevation', 'section', 'detail'];
        const lowerFileName = fileName.toLowerCase();
        const lowerCategory = (category || '').toLowerCase();
        
        return blueprintKeywords.some(keyword => 
            lowerFileName.includes(keyword) || lowerCategory.includes(keyword)
        );
    }
    
    // Upload to Azure Blob Storage
    async function uploadToBlobStorage(file, metadata) {
        const { account, container, sasToken } = CONFIG.blobStorage;
        const blobName = `${metadata.client || 'general'}/${metadata.category || 'documents'}/${Date.now()}_${file.name}`;
        const url = `https://${account}.blob.core.windows.net/${container}/${blobName}${sasToken}`;
        
        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'x-ms-blob-type': 'BlockBlob',
                    'Content-Type': file.type || 'application/octet-stream'
                },
                body: file
            });
            
            if (response.ok) {
                console.log('File uploaded to blob storage:', blobName);
                return url.split('?')[0]; // Return URL without SAS token
            } else {
                throw new Error(`Blob upload failed: ${response.status}`);
            }
        } catch (error) {
            console.error('Blob storage upload error:', error);
            throw error;
        }
    }
    
    // Fallback upload via webhook
    async function uploadViaWebhook(uploadData) {
        const response = await fetch(CONFIG.webhooks.upload, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(uploadData)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload webhook failed: ${errorText}`);
        }
        
        return await response.json();
    }
    
    // Index document in Azure Cognitive Search
    async function indexDocument(documentData, metadata) {
        try {
            const indexData = {
                id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                fileName: documentData.fileName || metadata.fileName,
                content: documentData.extractedText || '',
                category: metadata.category,
                client: metadata.client,
                uploadDate: new Date().toISOString(),
                blobUrl: documentData.blobUrl,
                metadata: JSON.stringify(documentData.metadata || {}),
                processingType: documentData.processingType,
                // Add extracted blueprint data if available
                dimensions: documentData.dimensions || null,
                measurements: documentData.measurements || null,
                materials: documentData.materials || null,
                specifications: documentData.specifications || null
            };
            
            const response = await fetch(CONFIG.webhooks.index, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(indexData)
            });
            
            if (response.ok) {
                console.log('Document indexed successfully');
            } else {
                console.warn('Indexing failed, but continuing:', await response.text());
            }
        } catch (error) {
            console.error('Error indexing document:', error);
            // Don't throw - indexing failure shouldn't stop the upload
        }
    }
    
    // Generate embeddings for vector search
    async function generateEmbeddings(documentData, metadata) {
        try {
            const embeddingData = {
                documentId: documentData.id || `doc_${Date.now()}`,
                content: documentData.extractedText || '',
                fileName: documentData.fileName,
                metadata: metadata
            };
            
            const response = await fetch(CONFIG.webhooks.embeddings, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(embeddingData)
            });
            
            if (response.ok) {
                console.log('Embeddings generated successfully');
            } else {
                console.warn('Embedding generation failed:', await response.text());
            }
        } catch (error) {
            console.error('Error generating embeddings:', error);
            // Don't throw - embedding failure shouldn't stop the upload
        }
    }
    
    // Update knowledge graph
    async function updateKnowledgeGraph(documentData, metadata) {
        try {
            const graphData = {
                documentId: documentData.id,
                entities: documentData.entities || [],
                relationships: documentData.relationships || [],
                metadata: metadata
            };
            
            const response = await fetch(`${CONFIG.functionAppUrl}/KnowledgeGraph`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-functions-key': CONFIG.functionKey
                },
                body: JSON.stringify(graphData)
            });
            
            if (response.ok) {
                console.log('Knowledge graph updated successfully');
            } else {
                console.warn('Knowledge graph update failed:', await response.text());
            }
        } catch (error) {
            console.error('Error updating knowledge graph:', error);
            // Don't throw - graph update failure shouldn't stop the upload
        }
    }
    
    // Override the existing processFile function to use unified handler
    if (typeof window.processFile === 'function') {
        const originalProcessFile = window.processFile;
        window.processFile = async function(file, category) {
            console.log('Using unified upload handler for:', file.name);
            
            const metadata = {
                category: category,
                client: window.selectedClient || 'general',
                clientName: window.selectedClient || 'General',
                updateKnowledgeGraph: true
            };
            
            try {
                const result = await uploadDocumentWithProcessing(file, metadata);
                
                // Call original success handling if needed
                if (window.addSystemMessage) {
                    window.addSystemMessage(`✅ Uploaded and processed: ${file.name}`);
                }
                
                return result;
            } catch (error) {
                console.error('Upload failed:', error);
                
                // Fallback to original function
                console.log('Falling back to original upload function');
                return originalProcessFile.call(this, file, category);
            }
        };
    }
    
    // Fetch configuration from API
    async function loadConfiguration() {
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                const apiConfig = await response.json();
                CONFIG.functionAppUrl = apiConfig.docProcessorUrl || CONFIG.functionAppUrl;
                CONFIG.functionKey = apiConfig.docProcessorKey || apiConfig.functionKey || '';
                console.log('Configuration loaded from API');
            }
        } catch (error) {
            console.warn('Failed to load config from API, using defaults:', error);
        }
    }
    
    // Load configuration on startup
    loadConfiguration();
    
    console.log('✅ Unified upload handler loaded - documents will be processed through Azure Functions');
})();

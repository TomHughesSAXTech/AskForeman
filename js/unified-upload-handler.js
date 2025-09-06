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
            
            // Check file size for chunking (5MB threshold for PDFs)
            const needsChunking = file.type === 'application/pdf' && file.size > 5 * 1024 * 1024;
            
            if (needsChunking) {
                console.log('Large PDF detected, using chunking process');
                return await processLargePDF(file, metadata);
            }
            
            // Validate file type
            if (!isValidFileType(file)) {
                throw new Error(`Unsupported file type: ${file.type || file.name}`);
            }
            
            // Step 1: Read file as base64
            const base64Data = await readFileAsBase64(file);
            
            // Step 2: Check for duplicates via hash
            const fileHash = await calculateFileHash(base64Data);
            const isDuplicate = await checkDuplicate(fileHash, metadata);
            
            if (isDuplicate) {
                console.log('Duplicate file detected, linking to existing document');
                return await handleDuplicate(isDuplicate, metadata);
            }
            
            // Step 3: Determine if this is a blueprint/drawing
            const isBlueprint = checkIfBlueprint(file.name, metadata.category);
            
            // Step 4: Prepare upload data with all necessary fields
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
                fileHash: fileHash,
                fileExtension: getFileExtension(file.name),
                enableOCR: shouldEnableOCR(file),
                generateEmbeddings: true,
                updateVectorIndex: true,
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
            
            // Step 5: Send to Azure Function for processing
            const functionUrl = determineAzureFunction(file, isBlueprint);
            
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
            
            // Step 6: Upload to Blob Storage (with deduplication)
            const blobUrl = await uploadToBlobStorage(file, metadata, fileHash);
            result.blobUrl = blobUrl;
            result.fileHash = fileHash;
            
            // Step 7: Index the document in Azure Cognitive Search
            await indexDocument(result, metadata);
            
            // Step 8: Generate and store embeddings for vector search
            const embeddings = await generateEmbeddings(result, metadata);
            result.embeddings = embeddings;
            
            // Step 9: Update vector index with embeddings
            if (embeddings && embeddings.success) {
                await updateVectorIndex(result, embeddings.vectors);
            }
            
            // Step 10: Update knowledge graph if needed
            if (metadata.updateKnowledgeGraph !== false) {
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
    
    // Validate file type
    function isValidFileType(file) {
        const validTypes = [
            'application/pdf',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/csv',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'image/png',
            'image/jpeg',
            'image/jpg',
            'image/gif',
            'image/bmp',
            'image/tiff'
        ];
        
        const validExtensions = [
            '.pdf', '.xls', '.xlsx', '.csv', '.txt', '.doc', '.docx',
            '.ppt', '.pptx', '.png', '.jpg', '.jpeg', '.gif', '.bmp',
            '.tiff', '.dwg', '.dxf'
        ];
        
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        return validTypes.includes(file.type) || validExtensions.includes(extension);
    }
    
    // Get file extension
    function getFileExtension(fileName) {
        return fileName.split('.').pop().toLowerCase();
    }
    
    // Determine if OCR should be enabled
    function shouldEnableOCR(file) {
        const ocrTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp', 'image/tiff'];
        return ocrTypes.includes(file.type) || file.type === 'application/pdf';
    }
    
    // Determine which Azure Function to use
    function determineAzureFunction(file, isBlueprint) {
        if (isBlueprint) {
            return `${CONFIG.functionAppUrl}/BlueprintTakeoffUnified`;
        }
        
        // Large PDFs use special processor
        if (file.type === 'application/pdf' && file.size > 5 * 1024 * 1024) {
            return `${CONFIG.functionAppUrl}/ProcessLargePDF`;
        }
        
        // Everything else uses ConvertDocumentJson
        return `${CONFIG.functionAppUrl}/ConvertDocumentJson`;
    }
    
    // Calculate file hash for deduplication
    async function calculateFileHash(base64Data) {
        try {
            const msgBuffer = new TextEncoder().encode(base64Data);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex;
        } catch (error) {
            console.warn('Could not calculate file hash:', error);
            return null;
        }
    }
    
    // Check for duplicate files
    async function checkDuplicate(fileHash, metadata) {
        if (!fileHash) return false;
        
        try {
            // Query Azure Cognitive Search for existing hash
            const searchUrl = `${CONFIG.webhooks.search || '/api/search'}`;
            const response = await fetch(searchUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    search: fileHash,
                    searchFields: 'fileHash',
                    select: 'id,fileName,blobUrl,client'
                })
            });
            
            if (response.ok) {
                const results = await response.json();
                return results.value && results.value.length > 0 ? results.value[0] : false;
            }
        } catch (error) {
            console.warn('Duplicate check failed:', error);
        }
        return false;
    }
    
    // Handle duplicate file
    async function handleDuplicate(existingDoc, metadata) {
        console.log('Handling duplicate, creating reference to existing document');
        
        // Create a reference/link instead of re-uploading
        const reference = {
            ...existingDoc,
            linkedClient: metadata.client,
            linkedCategory: metadata.category,
            linkedDate: new Date().toISOString(),
            isDuplicate: true
        };
        
        // Update index with the new reference
        await indexDocument(reference, metadata);
        
        return reference;
    }
    
    // Process large PDF with chunking
    async function processLargePDF(file, metadata) {
        console.log('Processing large PDF with chunking:', file.name);
        
        const base64Data = await readFileAsBase64(file);
        const fileHash = await calculateFileHash(base64Data);
        
        const chunkData = {
            file: base64Data,
            fileName: file.name,
            mimeType: 'application/pdf',
            client: metadata.client || 'general',
            category: metadata.category || 'documents',
            fileHash: fileHash,
            chunkSize: 2, // Pages per chunk
            generateEmbeddings: true,
            metadata: {
                ...metadata,
                originalSize: file.size,
                processingType: 'large-pdf-chunked'
            }
        };
        
        // Send to ProcessLargePDF function
        const response = await fetch(`${CONFIG.functionAppUrl}/ProcessLargePDF`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-functions-key': CONFIG.functionKey
            },
            body: JSON.stringify(chunkData)
        });
        
        if (!response.ok) {
            throw new Error(`Large PDF processing failed: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Process each chunk for embeddings
        if (result.chunks && result.chunks.length > 0) {
            for (const chunk of result.chunks) {
                await generateEmbeddings(chunk, metadata);
            }
        }
        
        return result;
    }
    
    // Upload to Azure Blob Storage with deduplication
    async function uploadToBlobStorage(file, metadata, fileHash) {
        const { account, container, sasToken } = CONFIG.blobStorage;
        // Include hash in blob name for deduplication
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const blobName = `${metadata.client || 'general'}/${metadata.category || 'documents'}/${Date.now()}_${fileHash ? fileHash.substring(0, 8) + '_' : ''}${sanitizedFileName}`;
        const url = `https://${account}.blob.core.windows.net/${container}/${blobName}${sasToken}`;
        
        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                'x-ms-blob-type': 'BlockBlob',
                'Content-Type': file.type || 'application/octet-stream',
                'x-ms-meta-filehash': fileHash || '',
                'x-ms-meta-client': metadata.client || 'general',
                'x-ms-meta-category': metadata.category || 'documents'
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
    
    // Generate embeddings for vector search with enhanced error handling
    async function generateEmbeddings(documentData, metadata) {
        try {
            const textContent = documentData.extractedText || documentData.content || '';
            
            if (!textContent || textContent.length < 10) {
                console.warn('Insufficient text content for embeddings');
                return { success: false, reason: 'Insufficient content' };
            }
            
            // Chunk text if too long (max 8000 tokens ~ 32000 characters)
            const maxChunkSize = 30000;
            const chunks = [];
            
            if (textContent.length > maxChunkSize) {
                for (let i = 0; i < textContent.length; i += maxChunkSize) {
                    chunks.push(textContent.substring(i, i + maxChunkSize));
                }
            } else {
                chunks.push(textContent);
            }
            
            const embeddingResults = [];
            
            for (let i = 0; i < chunks.length; i++) {
                const embeddingData = {
                    documentId: `${documentData.id || `doc_${Date.now()}`}_chunk_${i}`,
                    content: chunks[i],
                    fileName: documentData.fileName,
                    chunkIndex: i,
                    totalChunks: chunks.length,
                    metadata: {
                        ...metadata,
                        fileHash: documentData.fileHash,
                        processingDate: new Date().toISOString()
                    }
                };
                
                const response = await fetch(CONFIG.webhooks.embeddings || '/api/embeddings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(embeddingData)
                });
                
                if (response.ok) {
                    const result = await response.json();
                    embeddingResults.push(result);
                    console.log(`Embeddings generated for chunk ${i + 1}/${chunks.length}`);
                } else {
                    const errorText = await response.text();
                    console.warn(`Embedding generation failed for chunk ${i + 1}:`, errorText);
                    
                    // Try Azure OpenAI directly as fallback
                    const fallbackResult = await generateEmbeddingsViaAzureOpenAI(embeddingData);
                    if (fallbackResult) {
                        embeddingResults.push(fallbackResult);
                    }
                }
            }
            
            return {
                success: embeddingResults.length > 0,
                vectors: embeddingResults,
                chunks: chunks.length
            };
            
        } catch (error) {
            console.error('Error generating embeddings:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Fallback: Generate embeddings via Azure OpenAI directly
    async function generateEmbeddingsViaAzureOpenAI(embeddingData) {
        try {
            // This would need Azure OpenAI credentials configured
            const response = await fetch('/api/azure-openai-embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: embeddingData.content,
                    model: 'text-embedding-ada-002'
                })
            });
            
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Azure OpenAI fallback failed:', error);
        }
        return null;
    }
    
    // Update vector index with embeddings
    async function updateVectorIndex(documentData, vectors) {
        try {
            const indexData = {
                documentId: documentData.id,
                fileName: documentData.fileName,
                vectors: vectors,
                metadata: {
                    client: documentData.client,
                    category: documentData.category,
                    fileHash: documentData.fileHash,
                    timestamp: new Date().toISOString()
                }
            };
            
            const response = await fetch('/api/vector-index/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(indexData)
            });
            
            if (response.ok) {
                console.log('Vector index updated successfully');
            } else {
                console.warn('Vector index update failed:', await response.text());
            }
        } catch (error) {
            console.error('Error updating vector index:', error);
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

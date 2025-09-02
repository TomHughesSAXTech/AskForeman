// Azure Function: PDF Chunker
// Handles large PDFs by splitting them into manageable chunks

const { PDFDocument } = require('pdf-lib');
const { BlobServiceClient } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');

module.exports = async function (context, req) {
    context.log('PDF Chunker function triggered');

    try {
        const {
            fileUrl,
            fileName,
            clientName,
            category,
            maxChunkSizeMB = 10,  // Default 10MB chunks
            pagesPerChunk = 50     // Alternative: chunk by page count
        } = req.body;

        // Download the PDF from Azure Blob Storage
        const pdfBuffer = await downloadPdfFromBlob(fileUrl);
        
        // Check file size
        const fileSizeMB = pdfBuffer.length / (1024 * 1024);
        context.log(`Processing PDF: ${fileName}, Size: ${fileSizeMB.toFixed(2)}MB`);

        // Only chunk if file is larger than threshold
        if (fileSizeMB <= maxChunkSizeMB) {
            context.res = {
                status: 200,
                body: {
                    success: true,
                    chunked: false,
                    message: 'File is small enough, no chunking needed',
                    originalSize: fileSizeMB
                }
            };
            return;
        }

        // Load the PDF document
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const totalPages = pdfDoc.getPageCount();
        
        context.log(`Total pages in PDF: ${totalPages}`);

        // Calculate optimal chunk strategy
        const chunkStrategy = calculateChunkStrategy(
            fileSizeMB,
            totalPages,
            maxChunkSizeMB,
            pagesPerChunk
        );

        // Create chunks
        const chunks = await createPdfChunks(
            pdfDoc,
            chunkStrategy.pagesPerChunk,
            fileName
        );

        // Upload chunks to Azure Blob Storage
        const uploadedChunks = await uploadChunks(
            chunks,
            clientName,
            category,
            fileName
        );

        // Create metadata for chunk tracking
        const chunkMetadata = {
            id: uuidv4(),
            originalFileName: fileName,
            originalSizeMB: fileSizeMB,
            totalPages: totalPages,
            chunkCount: chunks.length,
            pagesPerChunk: chunkStrategy.pagesPerChunk,
            chunkSizeMB: chunkStrategy.estimatedChunkSizeMB,
            chunks: uploadedChunks,
            clientName: clientName,
            category: category,
            createdAt: new Date().toISOString(),
            reassemblyInstructions: {
                order: uploadedChunks.map(c => c.chunkNumber),
                method: 'sequential_pages'
            }
        };

        // Store metadata
        await storeChunkMetadata(chunkMetadata, clientName, fileName);

        // Trigger indexing for each chunk
        await triggerChunkIndexing(uploadedChunks, chunkMetadata);

        context.res = {
            status: 200,
            body: {
                success: true,
                chunked: true,
                metadata: chunkMetadata,
                message: `PDF successfully chunked into ${chunks.length} parts`
            }
        };

    } catch (error) {
        context.log.error('PDF chunking error:', error);
        context.res = {
            status: 500,
            body: {
                error: 'Failed to chunk PDF',
                details: error.message
            }
        };
    }
};

// Download PDF from Azure Blob Storage
async function downloadPdfFromBlob(fileUrl) {
    try {
        const response = await fetch(fileUrl);
        if (!response.ok) {
            throw new Error(`Failed to download PDF: ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer);
    } catch (error) {
        console.error('Download error:', error);
        throw error;
    }
}

// Calculate optimal chunk strategy
function calculateChunkStrategy(fileSizeMB, totalPages, maxChunkSizeMB, defaultPagesPerChunk) {
    // Estimate average page size
    const avgPageSizeMB = fileSizeMB / totalPages;
    
    // Calculate pages per chunk based on size limit
    let pagesPerChunk = Math.floor(maxChunkSizeMB / avgPageSizeMB);
    
    // Ensure reasonable chunk size
    pagesPerChunk = Math.max(10, Math.min(pagesPerChunk, 100));
    
    // Use default if calculated value seems off
    if (pagesPerChunk > defaultPagesPerChunk * 2) {
        pagesPerChunk = defaultPagesPerChunk;
    }
    
    const estimatedChunkSizeMB = avgPageSizeMB * pagesPerChunk;
    const estimatedChunkCount = Math.ceil(totalPages / pagesPerChunk);
    
    return {
        pagesPerChunk,
        estimatedChunkSizeMB,
        estimatedChunkCount,
        avgPageSizeMB
    };
}

// Create PDF chunks
async function createPdfChunks(pdfDoc, pagesPerChunk, originalFileName) {
    const chunks = [];
    const totalPages = pdfDoc.getPageCount();
    let chunkNumber = 1;
    
    for (let startPage = 0; startPage < totalPages; startPage += pagesPerChunk) {
        const endPage = Math.min(startPage + pagesPerChunk, totalPages);
        
        // Create new PDF document for this chunk
        const chunkDoc = await PDFDocument.create();
        
        // Copy pages to chunk
        const pagesToCopy = [];
        for (let i = startPage; i < endPage; i++) {
            pagesToCopy.push(i);
        }
        
        const copiedPages = await chunkDoc.copyPages(pdfDoc, pagesToCopy);
        copiedPages.forEach(page => chunkDoc.addPage(page));
        
        // Add metadata to chunk
        chunkDoc.setTitle(`${originalFileName} - Part ${chunkNumber}`);
        chunkDoc.setSubject(`Chunk ${chunkNumber} of ${Math.ceil(totalPages / pagesPerChunk)}`);
        chunkDoc.setKeywords(['chunk', `part-${chunkNumber}`, originalFileName]);
        
        // Save chunk
        const chunkBytes = await chunkDoc.save();
        
        chunks.push({
            chunkNumber,
            startPage: startPage + 1,  // 1-indexed for display
            endPage,
            pageCount: endPage - startPage,
            data: Buffer.from(chunkBytes),
            sizeMB: chunkBytes.length / (1024 * 1024)
        });
        
        chunkNumber++;
    }
    
    return chunks;
}

// Upload chunks to Azure Blob Storage
async function uploadChunks(chunks, clientName, category, originalFileName) {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = 'fcs-clients';
    
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    const uploadedChunks = [];
    const baseFileName = originalFileName.replace('.pdf', '');
    
    for (const chunk of chunks) {
        const chunkFileName = `${baseFileName}_chunk_${chunk.chunkNumber.toString().padStart(3, '0')}.pdf`;
        const blobPath = `FCS-ConvertedClients/${clientName}/chunks/${category}/${chunkFileName}`;
        
        const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
        
        await blockBlobClient.upload(chunk.data, chunk.data.length, {
            blobHTTPHeaders: {
                blobContentType: 'application/pdf'
            },
            metadata: {
                originalFile: originalFileName,
                chunkNumber: chunk.chunkNumber.toString(),
                startPage: chunk.startPage.toString(),
                endPage: chunk.endPage.toString(),
                pageCount: chunk.pageCount.toString()
            }
        });
        
        uploadedChunks.push({
            chunkNumber: chunk.chunkNumber,
            fileName: chunkFileName,
            blobPath: blobPath,
            url: blockBlobClient.url,
            startPage: chunk.startPage,
            endPage: chunk.endPage,
            pageCount: chunk.pageCount,
            sizeMB: chunk.sizeMB
        });
    }
    
    return uploadedChunks;
}

// Store chunk metadata
async function storeChunkMetadata(metadata, clientName, originalFileName) {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = 'fcs-clients';
    
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    const metadataFileName = `${originalFileName.replace('.pdf', '')}_chunks.json`;
    const blobPath = `FCS-ConvertedClients/${clientName}/metadata/chunks/${metadataFileName}`;
    
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    
    await blockBlobClient.upload(
        JSON.stringify(metadata, null, 2),
        JSON.stringify(metadata).length,
        {
            blobHTTPHeaders: {
                blobContentType: 'application/json'
            }
        }
    );
    
    return blockBlobClient.url;
}

// Trigger indexing for each chunk
async function triggerChunkIndexing(chunks, metadata) {
    const indexingWebhook = process.env.INDEXING_WEBHOOK_URL || 
        'https://workflows.saxtechnology.com/webhook/ask-foreman/index-chunk';
    
    const indexingPromises = chunks.map(async (chunk) => {
        try {
            const response = await fetch(indexingWebhook, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chunkInfo: chunk,
                    parentMetadata: {
                        id: metadata.id,
                        originalFileName: metadata.originalFileName,
                        clientName: metadata.clientName,
                        category: metadata.category,
                        totalChunks: metadata.chunkCount
                    }
                })
            });
            
            if (!response.ok) {
                console.error(`Failed to trigger indexing for chunk ${chunk.chunkNumber}`);
            }
            
            return response.json();
        } catch (error) {
            console.error(`Indexing error for chunk ${chunk.chunkNumber}:`, error);
            return null;
        }
    });
    
    return await Promise.all(indexingPromises);
}

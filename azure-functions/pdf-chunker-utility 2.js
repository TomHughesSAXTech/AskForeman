// PDF Chunking Utility for Azure Document Intelligence
// Splits large PDFs into smaller chunks for processing

const PDFDocument = require('pdf-lib').PDFDocument;
const fs = require('fs').promises;
const path = require('path');

/**
 * Split a large PDF into smaller chunks
 * @param {Buffer} pdfBuffer - The PDF file buffer
 * @param {number} maxPages - Maximum pages per chunk (default: 100)
 * @param {number} maxSizeMB - Maximum size per chunk in MB (default: 50)
 * @returns {Array<Buffer>} Array of PDF chunk buffers
 */
async function splitPDFIntoChunks(pdfBuffer, maxPages = 100, maxSizeMB = 50) {
    try {
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        const totalPages = pdfDoc.getPageCount();
        const chunks = [];
        
        console.log(`Processing PDF with ${totalPages} pages`);
        
        // If PDF is small enough, return as is
        const sizeMB = pdfBuffer.length / (1024 * 1024);
        if (totalPages <= maxPages && sizeMB <= maxSizeMB) {
            console.log('PDF is within limits, no chunking needed');
            return [pdfBuffer];
        }
        
        // Calculate optimal chunk size
        const pagesPerChunk = Math.min(maxPages, Math.ceil(totalPages / Math.ceil(sizeMB / maxSizeMB)));
        const numberOfChunks = Math.ceil(totalPages / pagesPerChunk);
        
        console.log(`Splitting into ${numberOfChunks} chunks of ~${pagesPerChunk} pages each`);
        
        for (let i = 0; i < numberOfChunks; i++) {
            const startPage = i * pagesPerChunk;
            const endPage = Math.min((i + 1) * pagesPerChunk, totalPages);
            
            // Create new PDF with subset of pages
            const newPdf = await PDFDocument.create();
            const pages = await newPdf.copyPages(
                pdfDoc,
                Array.from({ length: endPage - startPage }, (_, idx) => startPage + idx)
            );
            
            pages.forEach(page => newPdf.addPage(page));
            
            const chunkBuffer = await newPdf.save();
            const chunkSizeMB = chunkBuffer.length / (1024 * 1024);
            
            console.log(`Chunk ${i + 1}: Pages ${startPage + 1}-${endPage}, Size: ${chunkSizeMB.toFixed(2)}MB`);
            
            // If chunk is still too large, recursively split it
            if (chunkSizeMB > maxSizeMB && (endPage - startPage) > 1) {
                console.log(`Chunk ${i + 1} is too large, splitting further...`);
                const subChunks = await splitPDFIntoChunks(
                    chunkBuffer,
                    Math.floor(pagesPerChunk / 2),
                    maxSizeMB
                );
                chunks.push(...subChunks);
            } else {
                chunks.push(chunkBuffer);
            }
        }
        
        return chunks;
    } catch (error) {
        console.error('Error splitting PDF:', error);
        throw error;
    }
}

/**
 * Process large PDFs for Azure Document Intelligence
 * @param {string} filePath - Path to the PDF file
 * @param {Function} processChunk - Function to process each chunk
 * @returns {Array} Combined results from all chunks
 */
async function processLargePDF(filePath, processChunk) {
    try {
        const pdfBuffer = await fs.readFile(filePath);
        const fileName = path.basename(filePath, '.pdf');
        
        // Check file size
        const fileSizeMB = pdfBuffer.length / (1024 * 1024);
        console.log(`Processing ${fileName}, Size: ${fileSizeMB.toFixed(2)}MB`);
        
        // Split into chunks if needed
        const chunks = await splitPDFIntoChunks(pdfBuffer);
        
        // Process each chunk
        const results = [];
        for (let i = 0; i < chunks.length; i++) {
            console.log(`Processing chunk ${i + 1}/${chunks.length}...`);
            
            try {
                const chunkResult = await processChunk(chunks[i], {
                    chunkIndex: i,
                    totalChunks: chunks.length,
                    originalFileName: fileName
                });
                
                results.push({
                    chunkIndex: i,
                    success: true,
                    data: chunkResult
                });
            } catch (chunkError) {
                console.error(`Error processing chunk ${i + 1}:`, chunkError.message);
                results.push({
                    chunkIndex: i,
                    success: false,
                    error: chunkError.message
                });
            }
            
            // Add delay between chunks to avoid rate limiting
            if (i < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        return results;
    } catch (error) {
        console.error('Error processing large PDF:', error);
        throw error;
    }
}

/**
 * Optimize PDF for Azure processing
 * @param {Buffer} pdfBuffer - The PDF buffer
 * @returns {Buffer} Optimized PDF buffer
 */
async function optimizePDFForAzure(pdfBuffer) {
    try {
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        
        // Remove unnecessary metadata
        pdfDoc.setTitle('');
        pdfDoc.setAuthor('');
        pdfDoc.setSubject('');
        pdfDoc.setKeywords([]);
        pdfDoc.setProducer('');
        pdfDoc.setCreator('');
        
        // Save with compression
        const optimizedBuffer = await pdfDoc.save({
            useObjectStreams: false,  // Better compatibility
            addDefaultPage: false,
            objectsPerTick: 50  // Optimize memory usage
        });
        
        const originalSizeMB = pdfBuffer.length / (1024 * 1024);
        const optimizedSizeMB = optimizedBuffer.length / (1024 * 1024);
        
        console.log(`Optimized PDF from ${originalSizeMB.toFixed(2)}MB to ${optimizedSizeMB.toFixed(2)}MB`);
        
        return optimizedBuffer;
    } catch (error) {
        console.error('Error optimizing PDF:', error);
        return pdfBuffer;  // Return original if optimization fails
    }
}

/**
 * Extract text from PDF chunks and combine
 * @param {Array} chunkResults - Results from processing chunks
 * @returns {Object} Combined extracted content
 */
function combineChunkResults(chunkResults) {
    const combined = {
        content: '',
        pages: [],
        metadata: {
            totalChunks: chunkResults.length,
            successfulChunks: 0,
            failedChunks: 0,
            processingErrors: []
        }
    };
    
    chunkResults.forEach(result => {
        if (result.success) {
            combined.metadata.successfulChunks++;
            
            if (result.data.content) {
                combined.content += result.data.content + '\n\n';
            }
            
            if (result.data.pages) {
                combined.pages.push(...result.data.pages);
            }
        } else {
            combined.metadata.failedChunks++;
            combined.metadata.processingErrors.push({
                chunk: result.chunkIndex,
                error: result.error
            });
        }
    });
    
    return combined;
}

module.exports = {
    splitPDFIntoChunks,
    processLargePDF,
    optimizePDFForAzure,
    combineChunkResults
};

/**
 * BACKUP - Original ConvertDocumentJson Function
 * Created: ${new Date().toISOString()}
 * 
 * This is a backup of your original ConvertDocumentJson function
 * before modifications for Computer Vision integration
 */

const { BlobServiceClient } = require('@azure/storage-blob');
const { DocumentAnalysisClient, AzureKeyCredential } = require('@azure/ai-form-recognizer');

module.exports = async function (context, req) {
    context.log('ConvertDocumentJson function triggered');

    try {
        const { blobUrl, fileName, category, client, metadata } = req.body;

        if (!blobUrl || !fileName) {
            context.res = {
                status: 400,
                body: { error: 'Missing required parameters: blobUrl and fileName' }
            };
            return;
        }

        // Initialize Document Intelligence client
        const endpoint = process.env.DOCUMENT_INTELLIGENCE_ENDPOINT;
        const apiKey = process.env.DOCUMENT_INTELLIGENCE_KEY;
        
        const documentClient = new DocumentAnalysisClient(
            endpoint,
            new AzureKeyCredential(apiKey)
        );

        // Initialize Blob Storage client
        const storageConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        const blobServiceClient = BlobServiceClient.fromConnectionString(storageConnectionString);

        // Process document based on type
        const fileExtension = fileName.split('.').pop().toLowerCase();
        let processedData = {};

        if (fileExtension === 'pdf') {
            // Analyze PDF with Document Intelligence
            const poller = await documentClient.beginAnalyzeDocumentFromUrl(
                'prebuilt-layout',
                blobUrl
            );
            
            const result = await poller.pollUntilDone();
            
            // Extract text, tables, and layout
            processedData = {
                content: result.content || '',
                pages: result.pages?.map(page => ({
                    pageNumber: page.pageNumber,
                    width: page.width,
                    height: page.height,
                    lines: page.lines?.map(line => ({
                        content: line.content,
                        boundingBox: line.boundingRegions?.[0]?.boundingBox
                    })) || [],
                    words: page.words?.map(word => ({
                        content: word.content,
                        confidence: word.confidence,
                        boundingBox: word.boundingRegions?.[0]?.boundingBox
                    })) || []
                })) || [],
                tables: result.tables?.map(table => ({
                    rowCount: table.rowCount,
                    columnCount: table.columnCount,
                    cells: table.cells?.map(cell => ({
                        content: cell.content,
                        rowIndex: cell.rowIndex,
                        columnIndex: cell.columnIndex,
                        rowSpan: cell.rowSpan || 1,
                        columnSpan: cell.columnSpan || 1
                    })) || []
                })) || []
            };
        } else if (['doc', 'docx', 'xls', 'xlsx'].includes(fileExtension)) {
            // For Office documents, convert to PDF first (if needed)
            // Then process with Document Intelligence
            processedData = {
                content: 'Office document processing placeholder',
                requiresConversion: true
            };
        } else {
            // For other file types
            processedData = {
                content: 'File stored successfully',
                fileType: fileExtension
            };
        }

        // Store processed data in blob storage
        const containerName = 'fcs-clients';
        const containerClient = blobServiceClient.getContainerClient(containerName);
        
        // Save to converted folder
        const convertedBlobName = `FCS-ConvertedClients/${client}/${category}/${fileName}.json`;
        const blockBlobClient = containerClient.getBlockBlobClient(convertedBlobName);
        
        const jsonData = JSON.stringify({
            originalFile: fileName,
            blobUrl: blobUrl,
            category: category,
            client: client,
            processedAt: new Date().toISOString(),
            metadata: metadata,
            extractedData: processedData
        }, null, 2);
        
        await blockBlobClient.upload(jsonData, jsonData.length);

        // Return success response
        context.res = {
            status: 200,
            body: {
                success: true,
                message: 'Document processed successfully',
                convertedBlobUrl: blockBlobClient.url,
                extractedContent: processedData.content?.substring(0, 500), // Preview
                pageCount: processedData.pages?.length || 0,
                tableCount: processedData.tables?.length || 0
            }
        };

    } catch (error) {
        context.log.error('Error processing document:', error);
        
        context.res = {
            status: 500,
            body: {
                error: 'Failed to process document',
                details: error.message
            }
        };
    }
};

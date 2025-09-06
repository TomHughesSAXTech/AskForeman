const axios = require('axios');

// Environment variables
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || "https://saxtechopenai.openai.azure.com/";
const AZURE_OPENAI_KEY = process.env.AZURE_OPENAI_KEY;
const EMBEDDING_DEPLOYMENT = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || "text-embedding-ada-002";
const SEARCH_ENDPOINT = process.env.SEARCH_ENDPOINT || "https://fcssearchservice.search.windows.net";
const SEARCH_API_KEY = process.env.SEARCH_API_KEY;
const SEARCH_INDEX_NAME = process.env.SEARCH_INDEX_NAME || "fcs-construction-docs-index-v2";
const FUNCTION_KEY = process.env.AZURE_FUNCTION_KEY;

module.exports = async function (context, req) {
    context.log('ProcessDocumentWithEmbeddings function triggered');

    try {
        const requestBody = req.body;
        
        // Determine which existing function to call
        const isBlueprint = (
            requestBody.processingType === 'blueprint' ||
            (requestBody.category && requestBody.category.toLowerCase() === 'drawings') ||
            (requestBody.fileName && ['blueprint', 'drawing', 'plan', 'dwg', 'dxf'].some(keyword => 
                requestBody.fileName.toLowerCase().includes(keyword)))
        );
        
        // Call the appropriate existing function
        const functionUrl = isBlueprint 
            ? "https://saxtech-docprocessor.azurewebsites.net/api/BlueprintTakeoffUnified"
            : "https://saxtech-docprocessor.azurewebsites.net/api/ConvertDocumentJson";
        
        const headers = {
            "Content-Type": "application/json"
        };
        if (FUNCTION_KEY) {
            headers["x-functions-key"] = FUNCTION_KEY;
        }
        
        // Call existing function
        context.log(`Calling existing function: ${functionUrl}`);
        const response = await axios.post(functionUrl, requestBody, { headers });
        
        if (response.status !== 200) {
            context.log.error(`Existing function failed: ${response.status} - ${response.data}`);
            context.res = {
                status: response.status,
                body: `Document processing failed: ${response.data}`
            };
            return;
        }
        
        const result = response.data;
        
        // Extract content for embedding
        const content = (
            result.ExtractedData?.ExtractedText ||
            result.extractedText ||
            result.content ||
            result.StandardProcessingResult ||
            ""
        );
        
        if (!content) {
            context.log.warn("No content extracted for embedding generation");
            result.embeddingStatus = "No content to embed";
        } else {
            // Generate embeddings
            const embeddings = await generateEmbeddings(context, content);
            
            if (embeddings) {
                // Prepare document ID for search index
                const docId = generateDocumentId(requestBody);
                
                // Update search index with content and embeddings
                await updateSearchIndex(context, docId, requestBody, content, embeddings);
                
                result.embeddingStatus = "Generated and stored";
                result.embeddingDimensions = embeddings.length;
                result.documentId = docId;
                
                context.log(`Successfully generated ${embeddings.length} dimensional embedding for ${docId}`);
            } else {
                result.embeddingStatus = "Generation failed";
                context.log.error("Failed to generate embeddings");
            }
        }
        
        context.res = {
            status: 200,
            body: result,
            headers: {
                "Content-Type": "application/json"
            }
        };
        
    } catch (error) {
        context.log.error(`Error in ProcessDocumentWithEmbeddings: ${error.message}`);
        context.res = {
            status: 500,
            body: { error: error.message },
            headers: {
                "Content-Type": "application/json"
            }
        };
    }
};

async function generateEmbeddings(context, text) {
    try {
        // Truncate if too long
        if (text.length > 30000) {
            text = text.substring(0, 30000);
        }
        
        const url = `${AZURE_OPENAI_ENDPOINT}openai/deployments/${EMBEDDING_DEPLOYMENT}/embeddings?api-version=2023-05-15`;
        const headers = {
            "Content-Type": "application/json",
            "api-key": AZURE_OPENAI_KEY
        };
        const payload = {
            input: text
        };
        
        const response = await axios.post(url, payload, { headers });
        
        if (response.status === 200) {
            return response.data.data[0].embedding;
        } else {
            context.log.error(`OpenAI embedding error: ${response.status} - ${response.data}`);
            return null;
        }
    } catch (error) {
        context.log.error(`Error generating embeddings: ${error.message}`);
        return null;
    }
}

async function updateSearchIndex(context, docId, metadata, content, embeddings) {
    try {
        const url = `${SEARCH_ENDPOINT}/indexes/${SEARCH_INDEX_NAME}/docs/index?api-version=2021-04-30-Preview`;
        const headers = {
            "Content-Type": "application/json",
            "api-key": SEARCH_API_KEY
        };
        
        const document = {
            value: [{
                "@search.action": "mergeOrUpload",
                id: docId,
                fileName: metadata.fileName,
                client: metadata.client,
                category: metadata.category,
                content: content,
                contentVector: embeddings,
                uploadDate: metadata.metadata?.uploadDate || new Date().toISOString(),
                fileSize: metadata.metadata?.fileSize,
                processingType: metadata.processingType
            }]
        };
        
        const response = await axios.post(url, document, { headers });
        
        if ([200, 201].includes(response.status)) {
            context.log(`Successfully updated search index for ${docId}`);
            return true;
        } else {
            context.log.error(`Search index update failed: ${response.status} - ${response.data}`);
            return false;
        }
    } catch (error) {
        context.log.error(`Error updating search index: ${error.message}`);
        return false;
    }
}

function generateDocumentId(metadata) {
    const crypto = require('crypto');
    
    const client = metadata.client || "unknown";
    const filename = metadata.fileName || "unknown";
    const category = metadata.category || "general";
    
    // Clean filename for ID
    const cleanFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
    
    // Generate unique ID
    let docId = `${client}_${cleanFilename}_${Date.now()}`;
    
    // Ensure it's not too long
    if (docId.length > 128) {
        const hash = crypto.createHash('md5').update(docId).digest('hex');
        docId = docId.substring(0, 120) + "_" + hash.substring(0, 7);
    }
    
    return docId;
}

// Azure Function: Knowledge Graph Indexer (Simplified)
// Extracts entities and relationships from documents for cross-client insights

const { CosmosClient } = require('@azure/cosmos');
const { SearchClient, AzureKeyCredential: SearchKeyCredential } = require('@azure/search-documents');
const { OpenAIClient, AzureKeyCredential: OpenAIKeyCredential } = require('@azure/openai');

module.exports = async function (context, req) {
    context.log('Knowledge Graph Indexer triggered');

    try {
        const {
            documentContent,
            documentId,
            clientName,
            category,
            fileName
        } = req.body;

        if (!documentContent || !clientName || !fileName) {
            context.res = {
                status: 400,
                body: {
                    error: 'Missing required fields: documentContent, clientName, fileName'
                }
            };
            return;
        }

        // Initialize Azure OpenAI client
        const openaiClient = new OpenAIClient(
            process.env.AZURE_OPENAI_ENDPOINT,
            new OpenAIKeyCredential(process.env.AZURE_OPENAI_KEY)
        );

        // Extract entities from document
        const entities = await extractEntities(documentContent, openaiClient, context);
        
        // Store in Cosmos DB if configured
        let graphStored = false;
        if (process.env.COSMOS_GRAPH_ENDPOINT && process.env.COSMOS_GRAPH_KEY) {
            try {
                await storeInCosmosDB(entities, documentId, clientName, fileName, context);
                graphStored = true;
            } catch (error) {
                context.log.warn('Failed to store in Cosmos DB:', error.message);
            }
        }

        // Update search index with entity metadata
        await updateSearchIndex(documentId, clientName, fileName, category, entities, context);

        context.res = {
            status: 200,
            body: {
                success: true,
                entities: entities.length,
                entityTypes: [...new Set(entities.map(e => e.type))],
                graphStored: graphStored,
                message: 'Document successfully processed for knowledge graph'
            }
        };

    } catch (error) {
        context.log.error('Knowledge Graph error:', error);
        context.res = {
            status: 500,
            body: {
                error: 'Failed to process knowledge graph',
                details: error.message
            }
        };
    }
};

// Extract entities from document content using Azure OpenAI
async function extractEntities(content, openaiClient, context) {
    const entities = [];
    
    try {
        // Limit content to avoid token limits
        const contentToAnalyze = content.substring(0, 8000);
        
        const messages = [
            {
                role: "system",
                content: `You are an expert construction document analyzer. Extract all relevant entities from the document. Focus on:
                - Contractors and subcontractors
                - Materials and products
                - Room names and numbers
                - Equipment and fixtures
                - Costs and quantities
                - Dates and deadlines
                - Building systems (HVAC, electrical, plumbing)
                - Specifications and standards
                - Personnel and contacts
                
                Return a JSON object with an "entities" array. Each entity should have:
                {
                    "type": "entity_type",
                    "value": "entity_value",
                    "context": "brief surrounding context"
                }`
            },
            {
                role: "user",
                content: contentToAnalyze
            }
        ];

        const result = await openaiClient.getChatCompletions(
            "gpt-4.1-mini",  // deployment name - Updated to match your deployment
            messages,
            {
                temperature: 0.3,
                maxTokens: 2000,
                responseFormat: { type: "json_object" }
            }
        );

        const extractedData = JSON.parse(result.choices[0].message.content);
        
        // Process extracted entities
        for (const entity of extractedData.entities || []) {
            entities.push({
                type: entity.type || 'unknown',
                value: entity.value || '',
                context: entity.context || '',
                extractedAt: new Date().toISOString()
            });
        }

        // Also extract pattern-based entities
        const patternEntities = extractPatternBasedEntities(content);
        entities.push(...patternEntities);

    } catch (error) {
        context.log.error('Entity extraction error:', error);
        // Return pattern-based entities as fallback
        return extractPatternBasedEntities(content);
    }

    return entities;
}

// Extract pattern-based entities (costs, dates, room numbers)
function extractPatternBasedEntities(content) {
    const entities = [];
    
    // Extract costs
    const costPattern = /\$[\d,]+(?:\.\d{2})?/g;
    let match;
    while ((match = costPattern.exec(content)) !== null) {
        entities.push({
            type: 'cost',
            value: match[0],
            context: content.substring(Math.max(0, match.index - 50), Math.min(content.length, match.index + 50)),
            extractedAt: new Date().toISOString()
        });
    }
    
    // Extract room numbers
    const roomPattern = /(?:Room|Rm\.?)\s*(\d+[A-Z]?)/gi;
    while ((match = roomPattern.exec(content)) !== null) {
        entities.push({
            type: 'room',
            value: match[1],
            context: content.substring(Math.max(0, match.index - 30), Math.min(content.length, match.index + 30)),
            extractedAt: new Date().toISOString()
        });
    }
    
    // Extract dates
    const datePattern = /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+ \d{1,2},? \d{4})\b/g;
    while ((match = datePattern.exec(content)) !== null) {
        entities.push({
            type: 'date',
            value: match[0],
            context: content.substring(Math.max(0, match.index - 40), Math.min(content.length, match.index + 40)),
            extractedAt: new Date().toISOString()
        });
    }
    
    return entities;
}

// Store entities in Cosmos DB
async function storeInCosmosDB(entities, documentId, clientName, fileName, context) {
    const endpoint = process.env.COSMOS_GRAPH_ENDPOINT;
    const key = process.env.COSMOS_GRAPH_KEY;
    
    const client = new CosmosClient({ endpoint, key });
    const database = client.database('ConstructionKnowledgeGraph');
    const container = database.container('Documents');
    
    // Store document metadata
    const documentData = {
        id: documentId || `doc_${clientName}_${Date.now()}`,
        type: 'document',
        fileName: fileName,
        clientName: clientName,
        entityCount: entities.length,
        entityTypes: [...new Set(entities.map(e => e.type))],
        createdAt: new Date().toISOString(),
        partitionKey: clientName
    };
    
    await container.items.create(documentData);
    
    // Store entities
    const entitiesContainer = database.container('Entities');
    for (const entity of entities) {
        const entityData = {
            id: `${documentId}_${entity.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            documentId: documentId,
            clientName: clientName,
            ...entity,
            partitionKey: entity.type
        };
        
        await entitiesContainer.items.create(entityData);
    }
    
    context.log(`Stored ${entities.length} entities in Cosmos DB`);
}

// Update Azure Cognitive Search index
async function updateSearchIndex(documentId, clientName, fileName, category, entities, context) {
    const searchEndpoint = process.env.AZURE_SEARCH_ENDPOINT;
    const searchKey = process.env.AZURE_SEARCH_KEY;
    const indexName = process.env.AZURE_SEARCH_INDEX || 'fcs-construction-docs-index-v2';
    
    const searchClient = new SearchClient(
        searchEndpoint,
        indexName,
        new SearchKeyCredential(searchKey)
    );
    
    // Create a unique ID for the search document
    const searchDocId = documentId || `${clientName}_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}_kg`;
    
    // Prepare document for indexing
    const searchDocument = {
        id: searchDocId,
        fileName: fileName,
        client: clientName,  // Note: using 'client' to match existing schema
        category: category || 'knowledge-graph',
        content: entities.map(e => `${e.type}: ${e.value}`).join(' '),  // Searchable content
        entityTypes: [...new Set(entities.map(e => e.type))],
        entityValues: entities.map(e => e.value),
        entityCount: entities.length,
        lastUpdated: new Date().toISOString()
    };
    
    try {
        await searchClient.mergeOrUploadDocuments([searchDocument]);
        context.log(`Updated search index with document ${searchDocId}`);
    } catch (error) {
        context.log.error('Failed to update search index:', error);
        throw error;
    }
}

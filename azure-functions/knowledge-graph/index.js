// Azure Function: Knowledge Graph Indexer
// Extracts entities and relationships from documents for cross-client insights

const { CosmosClient } = require('@azure/cosmos');
const { SearchClient, AzureKeyCredential } = require('@azure/search-documents');
const OpenAI = require('openai');

module.exports = async function (context, req) {
    context.log('Knowledge Graph Indexer triggered');

    try {
        const {
            documentContent,
            documentMetadata,
            clientName,
            category,
            fileName,
            extractionMode = 'full'  // 'full' or 'incremental'
        } = req.body;

        // Initialize OpenAI for entity extraction
        const openai = new OpenAI({
            apiKey: process.env.AZURE_OPENAI_KEY,
            baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}openai/deployments/gpt-4o-mini`,
            defaultQuery: { 'api-version': '2024-02-15-preview' },
            defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_KEY }
        });

        // Extract entities from document
        const entities = await extractEntities(
            documentContent,
            documentMetadata,
            openai,
            context
        );

        // Extract relationships between entities
        const relationships = await extractRelationships(
            entities,
            documentContent,
            openai,
            context
        );

        // Store in Cosmos DB Graph
        const graphData = await storeInGraphDatabase(
            entities,
            relationships,
            documentMetadata,
            clientName,
            context
        );

        // Create cross-references
        const crossReferences = await createCrossReferences(
            entities,
            clientName,
            context
        );

        // Update search index with graph metadata
        await updateSearchIndex(
            documentMetadata,
            entities,
            relationships,
            crossReferences,
            context
        );

        // Find similar documents across clients
        const similarities = await findSimilarDocuments(
            entities,
            clientName,
            context
        );

        context.res = {
            status: 200,
            body: {
                success: true,
                entities: entities.length,
                relationships: relationships.length,
                crossReferences: crossReferences.length,
                similarities: similarities.length,
                graphId: graphData.id,
                message: 'Document successfully added to knowledge graph'
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

// Extract entities from document content
async function extractEntities(content, metadata, openai, context) {
    const entities = [];
    
    try {
        // Use GPT to extract construction-specific entities
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are an expert construction document analyzer. Extract all relevant entities from the following document content. Focus on:
                    - Contractors and subcontractors
                    - Materials and products
                    - Room names and numbers
                    - Equipment and fixtures
                    - Costs and quantities
                    - Dates and deadlines
                    - Building systems (HVAC, electrical, plumbing)
                    - Specifications and standards
                    - Personnel and contacts
                    
                    Return a JSON array of entities with this structure:
                    {
                        "type": "entity_type",
                        "value": "entity_value",
                        "context": "surrounding context",
                        "confidence": 0.0-1.0,
                        "attributes": {}
                    }`
                },
                {
                    role: "user",
                    content: content.substring(0, 8000)  // Limit for token constraints
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
            max_tokens: 2000
        });

        const extractedData = JSON.parse(completion.choices[0].message.content);
        
        // Process and enrich entities
        for (const entity of extractedData.entities || []) {
            entities.push({
                id: generateEntityId(entity),
                type: entity.type,
                value: entity.value,
                context: entity.context,
                confidence: entity.confidence || 0.8,
                attributes: entity.attributes || {},
                documentId: metadata.id,
                clientName: metadata.clientName,
                category: metadata.category,
                extractedAt: new Date().toISOString()
            });
        }

        // Extract additional entities using pattern matching
        const patternEntities = extractPatternBasedEntities(content);
        entities.push(...patternEntities);

    } catch (error) {
        context.log.error('Entity extraction error:', error);
    }

    return entities;
}

// Extract relationships between entities
async function extractRelationships(entities, content, openai, context) {
    const relationships = [];
    
    try {
        // Group entities by type for relationship analysis
        const entityGroups = groupEntitiesByType(entities);
        
        // Use GPT to identify relationships
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Analyze the following entities and identify relationships between them. Focus on construction-relevant relationships like:
                    - Contractor performs work
                    - Material used in room
                    - Equipment installed by contractor
                    - Cost associated with item
                    - Specification applies to material
                    
                    Return JSON with structure:
                    {
                        "relationships": [
                            {
                                "source": "entity_id",
                                "target": "entity_id",
                                "type": "relationship_type",
                                "strength": 0.0-1.0
                            }
                        ]
                    }`
                },
                {
                    role: "user",
                    content: JSON.stringify({
                        entities: entities.slice(0, 50),  // Limit for processing
                        contextSnippet: content.substring(0, 2000)
                    })
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
            max_tokens: 1500
        });

        const relationshipData = JSON.parse(completion.choices[0].message.content);
        
        for (const rel of relationshipData.relationships || []) {
            relationships.push({
                id: generateRelationshipId(rel),
                sourceId: rel.source,
                targetId: rel.target,
                type: rel.type,
                strength: rel.strength || 0.7,
                bidirectional: rel.bidirectional || false,
                createdAt: new Date().toISOString()
            });
        }

        // Add implicit relationships based on patterns
        const implicitRelationships = findImplicitRelationships(entities);
        relationships.push(...implicitRelationships);

    } catch (error) {
        context.log.error('Relationship extraction error:', error);
    }

    return relationships;
}

// Store in Cosmos DB Graph (Gremlin API)
async function storeInGraphDatabase(entities, relationships, metadata, clientName, context) {
    const endpoint = process.env.COSMOS_GRAPH_ENDPOINT;
    const key = process.env.COSMOS_GRAPH_KEY;
    const database = 'ConstructionKnowledgeGraph';
    const container = 'Documents';
    
    const client = new CosmosClient({ endpoint, key });
    const { container: graphContainer } = client
        .database(database)
        .container(container);
    
    // Create document vertex
    const documentVertex = {
        id: metadata.id,
        label: 'document',
        type: 'document',
        fileName: metadata.fileName,
        clientName: clientName,
        category: metadata.category,
        createdAt: new Date().toISOString(),
        partitionKey: clientName
    };
    
    await graphContainer.items.create(documentVertex);
    
    // Create entity vertices
    for (const entity of entities) {
        const entityVertex = {
            id: entity.id,
            label: 'entity',
            type: entity.type,
            value: entity.value,
            documentId: metadata.id,
            clientName: clientName,
            partitionKey: entity.type  // Partition by entity type for efficient queries
        };
        
        await graphContainer.items.create(entityVertex);
    }
    
    // Create relationship edges
    for (const relationship of relationships) {
        const edge = {
            id: relationship.id,
            label: relationship.type,
            _sink: relationship.targetId,
            _source: relationship.sourceId,
            strength: relationship.strength,
            partitionKey: relationship.type
        };
        
        await graphContainer.items.create(edge);
    }
    
    return documentVertex;
}

// Create cross-references across clients
async function createCrossReferences(entities, currentClient, context) {
    const crossReferences = [];
    
    // Connect to Cosmos DB to find similar entities
    const endpoint = process.env.COSMOS_GRAPH_ENDPOINT;
    const key = process.env.COSMOS_GRAPH_KEY;
    const database = 'ConstructionKnowledgeGraph';
    const container = 'Entities';
    
    const client = new CosmosClient({ endpoint, key });
    const { container: entityContainer } = client
        .database(database)
        .container(container);
    
    for (const entity of entities) {
        // Query for similar entities across all clients
        const querySpec = {
            query: `SELECT * FROM c WHERE c.type = @type AND c.value = @value AND c.clientName != @client`,
            parameters: [
                { name: "@type", value: entity.type },
                { name: "@value", value: entity.value },
                { name: "@client", value: currentClient }
            ]
        };
        
        const { resources: similarEntities } = await entityContainer.items
            .query(querySpec)
            .fetchAll();
        
        for (const similar of similarEntities) {
            crossReferences.push({
                id: `xref_${entity.id}_${similar.id}`,
                sourceEntity: entity.id,
                sourceClient: currentClient,
                targetEntity: similar.id,
                targetClient: similar.clientName,
                similarity: calculateSimilarity(entity, similar),
                type: 'cross_client_match',
                createdAt: new Date().toISOString()
            });
        }
    }
    
    return crossReferences;
}

// Update Azure Cognitive Search index
async function updateSearchIndex(metadata, entities, relationships, crossReferences, context) {
    const searchEndpoint = process.env.AZURE_SEARCH_ENDPOINT || process.env.SEARCH_ENDPOINT;
    const searchKey = process.env.AZURE_SEARCH_KEY || process.env.SEARCH_API_KEY;
    const indexName = process.env.AZURE_SEARCH_INDEX || 'fcs-construction-docs-index-v2';
    
    const searchClient = new SearchClient(
        searchEndpoint,
        indexName,
        new AzureKeyCredential(searchKey)
    );
    
    // Prepare document for indexing
    const searchDocument = {
        id: metadata.id,
        fileName: metadata.fileName,
        clientName: metadata.clientName,
        category: metadata.category,
        entities: entities.map(e => ({
            type: e.type,
            value: e.value,
            confidence: e.confidence
        })),
        entityTypes: [...new Set(entities.map(e => e.type))],
        entityValues: entities.map(e => e.value),
        relationships: relationships.map(r => r.type),
        crossClientConnections: crossReferences.map(x => x.targetClient),
        graphMetadata: {
            entityCount: entities.length,
            relationshipCount: relationships.length,
            crossReferenceCount: crossReferences.length
        },
        lastUpdated: new Date().toISOString()
    };
    
    await searchClient.uploadDocuments([searchDocument]);
}

// Find similar documents across clients
async function findSimilarDocuments(entities, currentClient, context) {
    const similarities = [];
    
    const searchEndpoint = process.env.AZURE_SEARCH_ENDPOINT || process.env.SEARCH_ENDPOINT;
    const searchKey = process.env.AZURE_SEARCH_KEY || process.env.SEARCH_API_KEY;
    const indexName = process.env.AZURE_SEARCH_INDEX || 'fcs-construction-docs-index-v2';
    
    const searchClient = new SearchClient(
        searchEndpoint,
        indexName,
        new AzureKeyCredential(searchKey)
    );
    
    // Build search query based on entities
    const entityValues = entities.map(e => e.value).slice(0, 10);  // Top 10 entities
    const searchQuery = entityValues.join(' OR ');
    
    const searchResults = await searchClient.search(searchQuery, {
        filter: `clientName ne '${currentClient}'`,
        select: ['id', 'fileName', 'clientName', 'entityValues'],
        top: 10
    });
    
    for await (const result of searchResults.results) {
        const similarity = calculateDocumentSimilarity(entities, result.document.entityValues);
        
        if (similarity > 0.3) {  // Threshold for relevance
            similarities.push({
                documentId: result.document.id,
                fileName: result.document.fileName,
                clientName: result.document.clientName,
                similarity: similarity,
                matchedEntities: findMatchedEntities(entities, result.document.entityValues)
            });
        }
    }
    
    return similarities;
}

// Helper function to extract pattern-based entities
function extractPatternBasedEntities(content) {
    const entities = [];
    
    // Extract costs
    const costPattern = /\$[\d,]+(?:\.\d{2})?/g;
    let match;
    while ((match = costPattern.exec(content)) !== null) {
        entities.push({
            id: generateEntityId({ type: 'cost', value: match[0] }),
            type: 'cost',
            value: match[0],
            context: content.substring(Math.max(0, match.index - 50), Math.min(content.length, match.index + 50)),
            confidence: 0.9
        });
    }
    
    // Extract room numbers
    const roomPattern = /(?:Room|Rm\.?)\s*(\d+[A-Z]?)/gi;
    while ((match = roomPattern.exec(content)) !== null) {
        entities.push({
            id: generateEntityId({ type: 'room', value: match[1] }),
            type: 'room',
            value: match[1],
            context: content.substring(Math.max(0, match.index - 30), Math.min(content.length, match.index + 30)),
            confidence: 0.85
        });
    }
    
    // Extract dates
    const datePattern = /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+ \d{1,2},? \d{4})\b/g;
    while ((match = datePattern.exec(content)) !== null) {
        entities.push({
            id: generateEntityId({ type: 'date', value: match[0] }),
            type: 'date',
            value: match[0],
            context: content.substring(Math.max(0, match.index - 40), Math.min(content.length, match.index + 40)),
            confidence: 0.8
        });
    }
    
    return entities;
}

// Helper function to group entities by type
function groupEntitiesByType(entities) {
    return entities.reduce((groups, entity) => {
        if (!groups[entity.type]) {
            groups[entity.type] = [];
        }
        groups[entity.type].push(entity);
        return groups;
    }, {});
}

// Helper function to find implicit relationships
function findImplicitRelationships(entities) {
    const relationships = [];
    const entityGroups = groupEntitiesByType(entities);
    
    // Connect costs to nearby items
    if (entityGroups.cost && entityGroups.material) {
        for (const cost of entityGroups.cost) {
            for (const material of entityGroups.material) {
                if (Math.abs(cost.context.indexOf(material.value)) < 100) {
                    relationships.push({
                        id: generateRelationshipId({ source: cost.id, target: material.id }),
                        sourceId: cost.id,
                        targetId: material.id,
                        type: 'cost_for_material',
                        strength: 0.7
                    });
                }
            }
        }
    }
    
    // Connect rooms to contractors
    if (entityGroups.room && entityGroups.contractor) {
        for (const room of entityGroups.room) {
            for (const contractor of entityGroups.contractor) {
                if (room.context.includes(contractor.value)) {
                    relationships.push({
                        id: generateRelationshipId({ source: contractor.id, target: room.id }),
                        sourceId: contractor.id,
                        targetId: room.id,
                        type: 'works_in',
                        strength: 0.8
                    });
                }
            }
        }
    }
    
    return relationships;
}

// Helper function to generate entity ID
function generateEntityId(entity) {
    return `entity_${entity.type}_${entity.value.replace(/\s+/g, '_').toLowerCase()}`;
}

// Helper function to generate relationship ID
function generateRelationshipId(rel) {
    return `rel_${rel.source || rel.sourceId}_${rel.target || rel.targetId}_${Date.now()}`;
}

// Helper function to calculate similarity between entities
function calculateSimilarity(entity1, entity2) {
    if (entity1.type !== entity2.type) return 0;
    
    // Exact match
    if (entity1.value === entity2.value) return 1.0;
    
    // Fuzzy match for similar values
    const similarity = stringSimilarity(entity1.value, entity2.value);
    
    return similarity;
}

// Helper function to calculate document similarity
function calculateDocumentSimilarity(entities1, entityValues2) {
    const values1 = new Set(entities1.map(e => e.value.toLowerCase()));
    const values2 = new Set(entityValues2.map(v => v.toLowerCase()));
    
    const intersection = new Set([...values1].filter(x => values2.has(x)));
    const union = new Set([...values1, ...values2]);
    
    return intersection.size / union.size;  // Jaccard similarity
}

// Helper function to find matched entities
function findMatchedEntities(entities1, entityValues2) {
    const values2Lower = entityValues2.map(v => v.toLowerCase());
    return entities1
        .filter(e => values2Lower.includes(e.value.toLowerCase()))
        .map(e => e.value);
}

// Helper function for string similarity
function stringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

// Levenshtein distance calculation
function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}

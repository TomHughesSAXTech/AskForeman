// Azure Function: Enhanced Search
// Handles cross-client search with knowledge graph integration

const { SearchClient, AzureKeyCredential } = require('@azure/search-documents');
const { CosmosClient } = require('@azure/cosmos');
const OpenAI = require('openai');

module.exports = async function (context, req) {
    context.log('Enhanced Search function triggered');

    try {
        const {
            query,
            searchMode = 'all-clients',  // 'all-clients', 'single-client', 'knowledge-graph'
            clientName,
            filters = {},
            top = 20,
            skip = 0
        } = req.body;

        let searchResults;
        
        if (searchMode === 'all-clients') {
            // Cross-client search with knowledge graph
            searchResults = await performCrossClientSearch(
                query,
                filters,
                top,
                skip,
                context
            );
        } else if (searchMode === 'knowledge-graph') {
            // Pure knowledge graph traversal
            searchResults = await performGraphSearch(
                query,
                filters,
                top,
                context
            );
        } else {
            // Traditional single-client search
            searchResults = await performSingleClientSearch(
                query,
                clientName,
                filters,
                top,
                skip,
                context
            );
        }

        // Enhance results with insights
        const enhancedResults = await enhanceResultsWithInsights(
            searchResults,
            query,
            searchMode,
            context
        );

        // Generate cross-client patterns
        const patterns = await identifyPatterns(
            enhancedResults,
            context
        );

        context.res = {
            status: 200,
            body: {
                success: true,
                query: query,
                mode: searchMode,
                results: enhancedResults,
                patterns: patterns,
                metadata: {
                    totalResults: enhancedResults.length,
                    clientsCovered: [...new Set(enhancedResults.map(r => r.clientName))].length,
                    hasMoreResults: enhancedResults.length === top
                }
            }
        };

    } catch (error) {
        context.log.error('Enhanced search error:', error);
        context.res = {
            status: 500,
            body: {
                error: 'Search failed',
                details: error.message
            }
        };
    }
};

// Perform cross-client search with knowledge graph
async function performCrossClientSearch(query, filters, top, skip, context) {
    const searchEndpoint = process.env.SEARCH_ENDPOINT;
    const searchKey = process.env.SEARCH_API_KEY;
    const indexName = 'construction-docs-index';
    const graphIndexName = 'construction-knowledge-graph';
    
    // Search main index
    const mainSearchClient = new SearchClient(
        searchEndpoint,
        indexName,
        new AzureKeyCredential(searchKey)
    );
    
    // Search knowledge graph index
    const graphSearchClient = new SearchClient(
        searchEndpoint,
        graphIndexName,
        new AzureKeyCredential(searchKey)
    );
    
    // Build filter string
    let filterString = buildFilterString(filters, true);  // true = include all clients
    
    // Perform parallel searches
    const [mainResults, graphResults] = await Promise.all([
        searchMainIndex(mainSearchClient, query, filterString, top * 2, skip),
        searchGraphIndex(graphSearchClient, query, filterString, top)
    ]);
    
    // Merge and rank results
    const mergedResults = await mergeAndRankResults(
        mainResults,
        graphResults,
        query,
        context
    );
    
    // Apply knowledge graph connections
    const connectedResults = await applyGraphConnections(
        mergedResults,
        context
    );
    
    return connectedResults.slice(0, top);
}

// Perform knowledge graph traversal search
async function performGraphSearch(query, filters, top, context) {
    const endpoint = process.env.COSMOS_GRAPH_ENDPOINT;
    const key = process.env.COSMOS_GRAPH_KEY;
    const database = 'ConstructionKnowledgeGraph';
    const container = 'Documents';
    
    const client = new CosmosClient({ endpoint, key });
    const { container: graphContainer } = client
        .database(database)
        .container(container);
    
    // Parse query to identify entities
    const entities = await extractQueryEntities(query, context);
    
    // Build Gremlin query for graph traversal
    const gremlinQuery = buildGremlinQuery(entities, filters);
    
    // Execute graph query
    const { resources: graphNodes } = await graphContainer.items
        .query(gremlinQuery)
        .fetchAll();
    
    // Expand graph results with connected documents
    const expandedResults = await expandGraphResults(
        graphNodes,
        context
    );
    
    // Rank by relevance and connections
    const rankedResults = rankGraphResults(
        expandedResults,
        query,
        entities
    );
    
    return rankedResults.slice(0, top);
}

// Perform traditional single-client search
async function performSingleClientSearch(query, clientName, filters, top, skip, context) {
    const searchEndpoint = process.env.SEARCH_ENDPOINT;
    const searchKey = process.env.SEARCH_API_KEY;
    const indexName = 'construction-docs-index';
    
    const searchClient = new SearchClient(
        searchEndpoint,
        indexName,
        new AzureKeyCredential(searchKey)
    );
    
    // Build filter string for single client
    let filterString = `clientName eq '${clientName}'`;
    if (Object.keys(filters).length > 0) {
        filterString += ' and ' + buildFilterString(filters, false);
    }
    
    // Perform search
    const results = await searchMainIndex(
        searchClient,
        query,
        filterString,
        top,
        skip
    );
    
    return results;
}

// Search main index
async function searchMainIndex(searchClient, query, filterString, top, skip) {
    const searchOptions = {
        filter: filterString,
        top: top,
        skip: skip,
        includeTotalCount: true,
        searchMode: 'all',
        queryType: 'full',
        searchFields: ['content', 'fileName', 'category'],
        select: [
            'id',
            'fileName',
            'clientName',
            'category',
            'content',
            'lastModified',
            'fileSize'
        ],
        highlightFields: 'content',
        highlightPreTag: '<mark>',
        highlightPostTag: '</mark>'
    };
    
    const searchResults = await searchClient.search(query, searchOptions);
    
    const results = [];
    for await (const result of searchResults.results) {
        results.push({
            ...result.document,
            score: result.score,
            highlights: result.highlights
        });
    }
    
    return results;
}

// Search knowledge graph index
async function searchGraphIndex(searchClient, query, filterString, top) {
    const searchOptions = {
        filter: filterString,
        top: top,
        searchMode: 'all',
        searchFields: ['entityValues', 'fileName'],
        select: [
            'id',
            'fileName',
            'clientName',
            'entities',
            'relationships',
            'crossClientConnections',
            'graphMetadata'
        ]
    };
    
    const searchResults = await searchClient.search(query, searchOptions);
    
    const results = [];
    for await (const result of searchResults.results) {
        results.push({
            ...result.document,
            score: result.score,
            isGraphResult: true
        });
    }
    
    return results;
}

// Merge and rank results from multiple sources
async function mergeAndRankResults(mainResults, graphResults, query, context) {
    const mergedMap = new Map();
    
    // Add main results
    mainResults.forEach(result => {
        mergedMap.set(result.id, {
            ...result,
            sources: ['main'],
            combinedScore: result.score
        });
    });
    
    // Merge graph results
    graphResults.forEach(result => {
        if (mergedMap.has(result.id)) {
            const existing = mergedMap.get(result.id);
            existing.sources.push('graph');
            existing.combinedScore += result.score * 1.2;  // Boost graph results
            existing.graphMetadata = result.graphMetadata;
            existing.entities = result.entities;
            existing.relationships = result.relationships;
        } else {
            mergedMap.set(result.id, {
                ...result,
                sources: ['graph'],
                combinedScore: result.score * 1.2
            });
        }
    });
    
    // Convert to array and sort by combined score
    const mergedArray = Array.from(mergedMap.values());
    mergedArray.sort((a, b) => b.combinedScore - a.combinedScore);
    
    return mergedArray;
}

// Apply knowledge graph connections to results
async function applyGraphConnections(results, context) {
    const endpoint = process.env.COSMOS_GRAPH_ENDPOINT;
    const key = process.env.COSMOS_GRAPH_KEY;
    const database = 'ConstructionKnowledgeGraph';
    const container = 'Documents';
    
    const client = new CosmosClient({ endpoint, key });
    const { container: graphContainer } = client
        .database(database)
        .container(container);
    
    // Enhance each result with graph connections
    for (const result of results) {
        // Query for connected documents
        const querySpec = {
            query: `SELECT * FROM c WHERE c.documentId = @docId OR ARRAY_CONTAINS(c.connectedDocuments, @docId)`,
            parameters: [
                { name: "@docId", value: result.id }
            ]
        };
        
        const { resources: connections } = await graphContainer.items
            .query(querySpec)
            .fetchAll();
        
        result.connections = connections.map(conn => ({
            documentId: conn.id,
            clientName: conn.clientName,
            connectionType: conn.connectionType,
            strength: conn.strength
        }));
        
        // Count cross-client connections
        result.crossClientConnectionCount = connections.filter(
            conn => conn.clientName !== result.clientName
        ).length;
    }
    
    return results;
}

// Extract entities from query
async function extractQueryEntities(query, context) {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
    
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `Extract construction-related entities from the search query. Return JSON array of entities with type and value.`
                },
                {
                    role: "user",
                    content: query
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
            max_tokens: 500
        });
        
        const data = JSON.parse(completion.choices[0].message.content);
        return data.entities || [];
    } catch (error) {
        context.log.error('Entity extraction error:', error);
        return [];
    }
}

// Build Gremlin query for graph traversal
function buildGremlinQuery(entities, filters) {
    let query = `g.V()`;
    
    // Add entity filters
    if (entities.length > 0) {
        const entityFilters = entities.map(e => 
            `has('value', '${e.value}')`
        ).join('.or()');
        query += `.where(${entityFilters})`;
    }
    
    // Add custom filters
    Object.entries(filters).forEach(([key, value]) => {
        query += `.has('${key}', '${value}')`;
    });
    
    // Traverse connected nodes
    query += `.out().limit(50)`;
    
    return query;
}

// Expand graph results with document details
async function expandGraphResults(graphNodes, context) {
    const searchEndpoint = process.env.SEARCH_ENDPOINT;
    const searchKey = process.env.SEARCH_API_KEY;
    const indexName = 'construction-docs-index';
    
    const searchClient = new SearchClient(
        searchEndpoint,
        indexName,
        new AzureKeyCredential(searchKey)
    );
    
    const expandedResults = [];
    
    for (const node of graphNodes) {
        if (node.type === 'document') {
            // Fetch full document details
            const document = await searchClient.getDocument(node.id);
            expandedResults.push({
                ...document,
                graphNode: node,
                connectionStrength: node.connectionStrength || 1.0
            });
        }
    }
    
    return expandedResults;
}

// Rank graph results by relevance
function rankGraphResults(results, query, entities) {
    return results.map(result => {
        let score = 0;
        
        // Score based on entity matches
        const matchedEntities = entities.filter(e => 
            result.graphNode?.value?.includes(e.value) ||
            result.content?.includes(e.value)
        );
        score += matchedEntities.length * 10;
        
        // Score based on connection strength
        score += (result.connectionStrength || 0) * 5;
        
        // Score based on cross-client connections
        score += (result.crossClientConnectionCount || 0) * 2;
        
        return {
            ...result,
            relevanceScore: score
        };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// Enhance results with AI insights
async function enhanceResultsWithInsights(results, query, searchMode, context) {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
    
    // Group results by client for pattern analysis
    const resultsByClient = groupResultsByClient(results);
    
    // Generate insights for top results
    const topResults = results.slice(0, 5);
    
    for (const result of topResults) {
        try {
            // Generate insight based on search mode
            let insightPrompt = '';
            
            if (searchMode === 'all-clients') {
                insightPrompt = `Based on this construction document from ${result.clientName}, identify any patterns or insights that could apply to other projects. Focus on costs, methods, or specifications.`;
            } else if (searchMode === 'knowledge-graph') {
                insightPrompt = `Analyze the connections between this document and related entities. What insights can be drawn from these relationships?`;
            } else {
                insightPrompt = `Provide a brief summary of how this document relates to the query: "${query}"`;
            }
            
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: insightPrompt
                    },
                    {
                        role: "user",
                        content: result.content?.substring(0, 2000) || result.fileName
                    }
                ],
                temperature: 0.5,
                max_tokens: 150
            });
            
            result.insight = completion.choices[0].message.content;
        } catch (error) {
            context.log.warn('Insight generation error:', error);
            result.insight = null;
        }
    }
    
    return results;
}

// Identify patterns across results
async function identifyPatterns(results, context) {
    const patterns = {
        commonEntities: [],
        priceRanges: {},
        methodologies: [],
        specifications: [],
        clientTrends: {}
    };
    
    // Extract common entities
    const entityCounts = {};
    results.forEach(result => {
        if (result.entities) {
            result.entities.forEach(entity => {
                const key = `${entity.type}:${entity.value}`;
                entityCounts[key] = (entityCounts[key] || 0) + 1;
            });
        }
    });
    
    // Find most common entities
    patterns.commonEntities = Object.entries(entityCounts)
        .filter(([_, count]) => count > 1)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([key, count]) => {
            const [type, value] = key.split(':');
            return { type, value, count };
        });
    
    // Extract price patterns
    const prices = [];
    results.forEach(result => {
        const priceMatches = (result.content || '').match(/\$[\d,]+(?:\.\d{2})?/g) || [];
        priceMatches.forEach(price => {
            const numericValue = parseFloat(price.replace(/[$,]/g, ''));
            if (numericValue) prices.push(numericValue);
        });
    });
    
    if (prices.length > 0) {
        patterns.priceRanges = {
            min: Math.min(...prices),
            max: Math.max(...prices),
            average: prices.reduce((a, b) => a + b, 0) / prices.length,
            median: calculateMedian(prices)
        };
    }
    
    // Identify client trends
    const clientGroups = groupResultsByClient(results);
    Object.entries(clientGroups).forEach(([client, clientResults]) => {
        patterns.clientTrends[client] = {
            documentCount: clientResults.length,
            categories: [...new Set(clientResults.map(r => r.category))],
            avgScore: clientResults.reduce((sum, r) => sum + (r.score || 0), 0) / clientResults.length
        };
    });
    
    return patterns;
}

// Helper function to build filter string
function buildFilterString(filters, includeAllClients) {
    const filterParts = [];
    
    Object.entries(filters).forEach(([key, value]) => {
        if (key === 'category' && value) {
            filterParts.push(`category eq '${value}'`);
        } else if (key === 'dateRange' && value) {
            if (value.start) {
                filterParts.push(`lastModified ge ${value.start}`);
            }
            if (value.end) {
                filterParts.push(`lastModified le ${value.end}`);
            }
        } else if (key === 'fileSize' && value) {
            if (value.min) {
                filterParts.push(`fileSize ge ${value.min}`);
            }
            if (value.max) {
                filterParts.push(`fileSize le ${value.max}`);
            }
        }
    });
    
    return filterParts.join(' and ');
}

// Helper function to group results by client
function groupResultsByClient(results) {
    return results.reduce((groups, result) => {
        const client = result.clientName || 'unknown';
        if (!groups[client]) {
            groups[client] = [];
        }
        groups[client].push(result);
        return groups;
    }, {});
}

// Helper function to calculate median
function calculateMedian(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    
    return sorted[middle];
}

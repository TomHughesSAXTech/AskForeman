/**
 * Direct Search Module - Bypasses n8n for faster search
 * Directly calls Azure Cognitive Search API
 */

(function() {
    'use strict';

    // Configuration
    const SEARCH_CONFIG = {
        endpoint: 'https://fcssearchservice.search.windows.net',
        indexName: 'fcs-construction-docs-index-v2',
        apiVersion: '2023-11-01',
        semanticConfig: 'construction-semantic-config'
    };

    // Cache for search API key (fetched from config endpoint)
    let searchApiKey = null;

    /**
     * Initialize direct search
     */
    async function initialize() {
        try {
            // Get search API key from config
            const configResponse = await fetch('/api/config');
            if (configResponse.ok) {
                const config = await configResponse.json();
                searchApiKey = config.searchApiKey || config.functionKey;
                console.log('✅ Direct search initialized');
                return true;
            }
        } catch (error) {
            console.error('Failed to initialize direct search:', error);
        }
        return false;
    }

    /**
     * Perform direct search against Azure Cognitive Search
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Search results
     */
    async function search(options = {}) {
        const {
            query = '',
            client = null,
            projectName = null,
            category = null,
            searchType = 'simple', // 'simple', 'semantic', 'hybrid'
            top = 10,
            skip = 0,
            facets = [],
            orderBy = null
        } = options;

        // Build search request
        const searchRequest = {
            search: query,
            top: top,
            skip: skip,
            count: true,
            searchMode: 'all'
        };

        // Add filters
        const filters = [];
        if (client) filters.push(`client eq '${client}'`);
        if (projectName) filters.push(`projectName eq '${projectName}'`);
        if (category) filters.push(`category eq '${category}'`);
        
        if (filters.length > 0) {
            searchRequest.filter = filters.join(' and ');
        }

        // Configure search type
        if (searchType === 'semantic') {
            searchRequest.queryType = 'semantic';
            searchRequest.semanticConfiguration = SEARCH_CONFIG.semanticConfig;
            searchRequest.captions = 'extractive|highlight-true';
            searchRequest.answers = 'extractive|count-3';
        } else if (searchType === 'hybrid' && window.generateEmbedding) {
            // Generate embedding for vector search
            const embedding = await window.generateEmbedding(query);
            if (embedding) {
                searchRequest.vectorQueries = [{
                    kind: 'vector',
                    vector: embedding,
                    fields: 'contentVector',
                    k: 5
                }];
            }
        }

        // Add facets
        if (facets.length > 0) {
            searchRequest.facets = facets;
        }

        // Add ordering
        if (orderBy) {
            searchRequest.orderby = orderBy;
        }

        // Select fields to return (including blueprint fields)
        searchRequest.select = [
            'id', 'fileName', 'client', 'projectName', 'category',
            'content', 'uploadedAt', 'blobPath', 'metadata',
            'documentType', 'pageCount', 'tags',
            // Blueprint-specific fields
            'dimensions', 'materials', 'specifications', 'roomNumbers',
            'measurements', 'drawingScale', 'sheetNumber', 'drawingType',
            'revision', 'standardsCodes', 'fireRatings', 'structuralMembers',
            'ocrConfidence', 'hasHandwrittenText'
        ].join(',');

        // Perform search
        const url = `${SEARCH_CONFIG.endpoint}/indexes/${SEARCH_CONFIG.indexName}/docs/search?api-version=${SEARCH_CONFIG.apiVersion}`;
        
        const startTime = performance.now();
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': searchApiKey
                },
                body: JSON.stringify(searchRequest)
            });

            const endTime = performance.now();
            const searchTime = ((endTime - startTime) / 1000).toFixed(2);

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`);
            }

            const results = await response.json();
            
            // Process results
            const processedResults = {
                documents: results.value || [],
                count: results['@odata.count'] || 0,
                facets: results['@search.facets'] || {},
                answers: results['@search.answers'] || [],
                searchTime: searchTime,
                nextPageParameters: results['@search.nextPageParameters'] || null
            };

            // Add semantic information if available
            if (searchType === 'semantic') {
                processedResults.documents = processedResults.documents.map(doc => ({
                    ...doc,
                    rerankerScore: doc['@search.rerankerScore'],
                    captions: doc['@search.captions'],
                    highlights: doc['@search.highlights']
                }));
            }

            console.log(`✅ Search completed in ${searchTime}s - ${processedResults.count} results`);
            return processedResults;

        } catch (error) {
            console.error('Search error:', error);
            throw error;
        }
    }

    /**
     * Search with automatic retries and fallback
     */
    async function searchWithFallback(options) {
        try {
            // Try direct search first
            if (!searchApiKey) {
                await initialize();
            }
            
            if (searchApiKey) {
                return await search(options);
            }
        } catch (error) {
            console.warn('Direct search failed, falling back to webhook:', error);
        }

        // Fallback to webhook if direct search fails
        return searchViaWebhook(options);
    }

    /**
     * Fallback search via webhook (slower)
     */
    async function searchViaWebhook(options) {
        const webhookUrl = 'https://workflows.saxtechnology.com/webhook/ask-foreman/index/search';
        
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: options.query,
                client: options.client,
                filters: {
                    projectName: options.projectName,
                    category: options.category
                },
                top: options.top
            })
        });

        if (!response.ok) {
            throw new Error('Webhook search failed');
        }

        return await response.json();
    }

    /**
     * Quick search suggestions (autocomplete)
     */
    async function suggest(prefix, options = {}) {
        const {
            client = null,
            fuzzy = true,
            top = 5
        } = options;

        const suggestRequest = {
            search: prefix,
            suggesterName: 'sg',
            fuzzy: fuzzy,
            top: top
        };

        if (client) {
            suggestRequest.filter = `client eq '${client}'`;
        }

        const url = `${SEARCH_CONFIG.endpoint}/indexes/${SEARCH_CONFIG.indexName}/docs/suggest?api-version=${SEARCH_CONFIG.apiVersion}`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': searchApiKey
                },
                body: JSON.stringify(suggestRequest)
            });

            if (response.ok) {
                const results = await response.json();
                return results.value || [];
            }
        } catch (error) {
            console.error('Suggest error:', error);
        }

        return [];
    }

    /**
     * Get document by ID
     */
    async function getDocument(documentId) {
        const url = `${SEARCH_CONFIG.endpoint}/indexes/${SEARCH_CONFIG.indexName}/docs/${documentId}?api-version=${SEARCH_CONFIG.apiVersion}`;
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'api-key': searchApiKey
                }
            });

            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Get document error:', error);
        }

        return null;
    }

    /**
     * Blueprint-specific search functions
     */
    async function searchBlueprints(options = {}) {
        const blueprintOptions = {
            ...options,
            searchFields: 'fileName,sheetNumber,drawingType,materials,specifications,dimensions',
            facets: ['drawingType,count:10', 'materials,count:20', 'standardsCodes,count:10']
        };
        
        // Add drawing/blueprint category filter
        const filters = [];
        if (options.filter) filters.push(options.filter);
        filters.push("(category eq 'drawings' or category eq 'blueprints' or drawingType ne null)");
        blueprintOptions.filter = filters.join(' and ');
        
        return search(blueprintOptions);
    }
    
    async function searchByMaterial(material, options = {}) {
        return search({
            ...options,
            query: '*',
            filter: `materials/any(m: m eq '${material}')`
        });
    }
    
    async function searchBySheetNumber(sheetNumber, options = {}) {
        return search({
            ...options,
            query: sheetNumber,
            searchFields: 'sheetNumber,fileName'
        });
    }
    
    async function searchByDrawingType(drawingType, options = {}) {
        return search({
            ...options,
            query: '*',
            filter: `drawingType eq '${drawingType}'`
        });
    }
    
    async function searchByStandard(standardCode, options = {}) {
        return search({
            ...options,
            query: standardCode,
            searchFields: 'standardsCodes,specifications'
        });
    }
    
    async function searchHandwrittenDocs(options = {}) {
        return search({
            ...options,
            query: '*',
            filter: 'hasHandwrittenText eq true',
            orderBy: 'ocrConfidence desc'
        });
    }

    /**
     * Export search functions to window
     */
    window.DirectSearch = {
        initialize,
        search,
        searchWithFallback,
        suggest,
        getDocument,
        
        // Convenience methods
        quickSearch: (query, client) => search({ query, client, searchType: 'simple', top: 10 }),
        semanticSearch: (query, client) => search({ query, client, searchType: 'semantic', top: 10 }),
        projectSearch: (projectName) => search({ projectName, searchType: 'simple', top: 100 }),
        
        // Blueprint-specific methods
        searchBlueprints,
        searchByMaterial,
        searchBySheetNumber,
        searchByDrawingType,
        searchByStandard,
        searchHandwrittenDocs,
        
        // Blueprint filters
        getDrawingTypes: async () => {
            const results = await search({
                query: '*',
                facets: ['drawingType,count:50'],
                top: 0
            });
            return results.facets.drawingType || [];
        },
        
        getMaterials: async () => {
            const results = await search({
                query: '*',
                facets: ['materials,count:100'],
                top: 0
            });
            return results.facets.materials || [];
        },
        
        // Performance test
        testPerformance: async () => {
            console.log('Testing search performance...');
            const tests = [
                { query: 'steel', searchType: 'simple' },
                { query: 'construction specifications', searchType: 'semantic' },
                { query: '*', client: 'Milo', searchType: 'simple' }
            ];
            
            for (const test of tests) {
                const startTime = performance.now();
                const results = await search(test);
                const endTime = performance.now();
                console.log(`${test.searchType} search for "${test.query}": ${((endTime - startTime) / 1000).toFixed(2)}s - ${results.count} results`);
            }
        }
    };

    // Auto-initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();

// n8n Code Node for Client Document Search with Azure AI Search
// This code should be placed in an n8n Code node in your workflow

// Get input parameters
const searchQuery = $input.first().json.query || '';
const clientFilter = $input.first().json.client || 'all';
const searchType = $input.first().json.searchType || 'semantic';
const documentTypes = $input.first().json.documentTypes || ['all'];
const limit = $input.first().json.limit || 20;
const includeContext = $input.first().json.includeContext || true;

// Azure Cognitive Search Configuration
const AZURE_SEARCH_ENDPOINT = 'https://askforeman-search.search.windows.net';
const AZURE_SEARCH_KEY = '29f2P9tLxdEGxJj2LV8gB9H5buHqXXxaAzSeCKwabc';
const INDEX_NAME = 'fcs-construction-docs-index-v2';

// Function to build search request
function buildSearchRequest() {
    const searchRequest = {
        search: searchQuery,
        searchMode: 'all',
        queryType: searchType === 'semantic' ? 'semantic' : 'simple',
        count: true,
        top: limit,
        select: [
            'id',
            'content',
            'metadata_client',
            'metadata_category',
            'metadata_filename',
            'metadata_lastmodified',
            'metadata_storage_path',
            'metadata_content_type'
        ].join(','),
        highlightFields: 'content',
        highlight: true
    };
    
    // Add filters
    const filters = [];
    
    // Client filter
    if (clientFilter && clientFilter !== 'all') {
        filters.push(`metadata_client eq '${clientFilter}'`);
    }
    
    // Document type filter
    if (documentTypes && !documentTypes.includes('all')) {
        const typeFilters = documentTypes.map(type => `metadata_category eq '${type}'`);
        if (typeFilters.length > 0) {
            filters.push(`(${typeFilters.join(' or ')})`);
        }
    }
    
    // Combine filters
    if (filters.length > 0) {
        searchRequest.filter = filters.join(' and ');
    }
    
    // Add semantic configuration if available
    if (searchType === 'semantic') {
        searchRequest.semanticConfiguration = 'default';
        searchRequest.captions = 'extractive';
        searchRequest.answers = 'extractive|count-3';
    }
    
    // Add vector search if query embeddings are available
    if (searchType === 'vector' || searchType === 'hybrid') {
        // This would need embeddings generation
        searchRequest.vectors = [{
            value: generateEmbeddings(searchQuery),
            fields: 'content_vector',
            k: limit
        }];
    }
    
    return searchRequest;
}

// Function to generate embeddings (placeholder - would use OpenAI in production)
function generateEmbeddings(text) {
    // In production, this would call OpenAI API to generate embeddings
    // For now, return mock embeddings
    return Array(1536).fill(0).map(() => Math.random());
}

// Function to perform the search
async function performSearch() {
    try {
        const searchUrl = `${AZURE_SEARCH_ENDPOINT}/indexes/${INDEX_NAME}/docs/search?api-version=2023-11-01`;
        const searchRequest = buildSearchRequest();
        
        const response = await $http.request({
            method: 'POST',
            url: searchUrl,
            headers: {
                'api-key': AZURE_SEARCH_KEY,
                'Content-Type': 'application/json'
            },
            body: searchRequest
        });
        
        if (response.status !== 200) {
            throw new Error(`Azure Search returned status ${response.status}`);
        }
        
        return processSearchResults(response.data);
        
    } catch (error) {
        console.error('Search error:', error);
        return {
            success: false,
            error: error.message,
            results: []
        };
    }
}

// Function to process search results
function processSearchResults(data) {
    if (!data || !data.value) {
        return {
            success: false,
            query: searchQuery,
            totalResults: 0,
            results: []
        };
    }
    
    const processedResults = {
        success: true,
        query: searchQuery,
        totalResults: data['@odata.count'] || 0,
        searchType: searchType,
        filters: {
            client: clientFilter,
            documentTypes: documentTypes
        },
        results: [],
        facets: data['@search.facets'] || {},
        answers: data['@search.answers'] || []
    };
    
    // Process each result
    processedResults.results = data.value.map(item => {
        const result = {
            id: item.id,
            score: item['@search.score'] || 0,
            rerankerScore: item['@search.rerankerScore'] || null,
            content: item.content || '',
            highlights: item['@search.highlights']?.content || [],
            captions: item['@search.captions'] || [],
            metadata: {
                client: item.metadata_client || 'unknown',
                category: item.metadata_category || 'unknown',
                filename: item.metadata_filename || 'unknown',
                lastModified: item.metadata_lastmodified || null,
                storagePath: item.metadata_storage_path || '',
                contentType: item.metadata_content_type || 'unknown'
            }
        };
        
        // Extract key information from content
        result.extractedInfo = extractKeyInformation(result.content);
        
        // Generate Azure Blob URL for direct access
        if (result.metadata.storagePath) {
            result.documentUrl = generateBlobUrl(result.metadata.storagePath);
        }
        
        // Add context if requested
        if (includeContext) {
            result.context = generateContext(result);
        }
        
        return result;
    });
    
    // Group results by client/category for better organization
    processedResults.grouped = groupResults(processedResults.results);
    
    // Extract insights from results
    processedResults.insights = extractInsights(processedResults.results);
    
    // Generate suggestions for refinement
    processedResults.suggestions = generateSearchSuggestions(processedResults);
    
    return processedResults;
}

// Function to extract key information from content
function extractKeyInformation(content) {
    const extracted = {
        dimensions: [],
        rooms: [],
        materials: [],
        costs: [],
        specifications: [],
        dates: [],
        quantities: []
    };
    
    if (!content) return extracted;
    
    // Extract dimensions (e.g., "10' x 12'", "100 sq ft")
    const dimensionPattern = /(\d+(?:\.\d+)?)\s*['"]?\s*x\s*(\d+(?:\.\d+)?)\s*['"]?/gi;
    let match;
    while ((match = dimensionPattern.exec(content)) !== null) {
        extracted.dimensions.push({
            text: match[0],
            width: parseFloat(match[1]),
            height: parseFloat(match[2])
        });
    }
    
    // Extract room names
    const roomPattern = /\b(bedroom|bathroom|kitchen|living room|dining room|office|garage|basement|attic|closet|hallway|foyer|laundry)\b/gi;
    const rooms = content.match(roomPattern) || [];
    extracted.rooms = [...new Set(rooms.map(r => r.toLowerCase()))];
    
    // Extract material mentions
    const materialPattern = /\b(concrete|steel|wood|drywall|tile|carpet|vinyl|granite|marble|laminate|paint|primer|insulation)\b/gi;
    const materials = content.match(materialPattern) || [];
    extracted.materials = [...new Set(materials.map(m => m.toLowerCase()))];
    
    // Extract costs/prices
    const costPattern = /\$[\d,]+(?:\.\d{2})?/g;
    const costs = content.match(costPattern) || [];
    extracted.costs = costs.map(c => ({
        text: c,
        value: parseFloat(c.replace(/[$,]/g, ''))
    }));
    
    // Extract specifications
    const specPattern = /\b(ASTM|ANSI|IEEE|ISO|NFPA|OSHA)\s*[A-Z0-9\-\.]+/gi;
    extracted.specifications = content.match(specPattern) || [];
    
    // Extract dates
    const datePattern = /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\w+ \d{1,2},? \d{4})\b/g;
    extracted.dates = content.match(datePattern) || [];
    
    // Extract quantities
    const quantityPattern = /(\d+(?:\.\d+)?)\s*(EA|each|pcs|pieces|units?|boxes?|cases?|gallons?|tons?|yards?|feet|ft|inches|in|meters?|m)\b/gi;
    while ((match = quantityPattern.exec(content)) !== null) {
        extracted.quantities.push({
            text: match[0],
            value: parseFloat(match[1]),
            unit: match[2]
        });
    }
    
    return extracted;
}

// Function to generate Azure Blob URL
function generateBlobUrl(storagePath) {
    const storageAccount = 'saxtechfcs';
    const container = 'fcs-clients';
    const sasToken = '?sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D';
    
    // Clean up the path
    let cleanPath = storagePath;
    if (cleanPath.startsWith('/')) {
        cleanPath = cleanPath.substring(1);
    }
    
    return `https://${storageAccount}.blob.core.windows.net/${container}/${cleanPath}${sasToken}`;
}

// Function to generate context
function generateContext(result) {
    const context = {
        summary: '',
        relatedTerms: [],
        category: result.metadata.category,
        client: result.metadata.client
    };
    
    // Generate summary from highlights or content
    if (result.highlights && result.highlights.length > 0) {
        context.summary = result.highlights[0].replace(/<[^>]*>/g, '').substring(0, 200) + '...';
    } else if (result.captions && result.captions.length > 0) {
        context.summary = result.captions[0].text || '';
    } else {
        context.summary = result.content.substring(0, 200) + '...';
    }
    
    // Extract related terms from content
    const importantTerms = [];
    if (result.extractedInfo.rooms.length > 0) {
        importantTerms.push(...result.extractedInfo.rooms);
    }
    if (result.extractedInfo.materials.length > 0) {
        importantTerms.push(...result.extractedInfo.materials.slice(0, 3));
    }
    if (result.extractedInfo.specifications.length > 0) {
        importantTerms.push(...result.extractedInfo.specifications.slice(0, 2));
    }
    
    context.relatedTerms = importantTerms;
    
    return context;
}

// Function to group results
function groupResults(results) {
    const grouped = {
        byClient: {},
        byCategory: {},
        byDate: {}
    };
    
    results.forEach(result => {
        // Group by client
        const client = result.metadata.client;
        if (!grouped.byClient[client]) {
            grouped.byClient[client] = [];
        }
        grouped.byClient[client].push(result);
        
        // Group by category
        const category = result.metadata.category;
        if (!grouped.byCategory[category]) {
            grouped.byCategory[category] = [];
        }
        grouped.byCategory[category].push(result);
        
        // Group by date (month/year)
        if (result.metadata.lastModified) {
            const date = new Date(result.metadata.lastModified);
            const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!grouped.byDate[monthYear]) {
                grouped.byDate[monthYear] = [];
            }
            grouped.byDate[monthYear].push(result);
        }
    });
    
    return grouped;
}

// Function to extract insights
function extractInsights(results) {
    const insights = {
        dominantCategories: {},
        commonMaterials: {},
        priceRanges: {},
        specifications: [],
        timelineSpan: null
    };
    
    // Count categories
    results.forEach(result => {
        const category = result.metadata.category;
        insights.dominantCategories[category] = (insights.dominantCategories[category] || 0) + 1;
    });
    
    // Aggregate materials
    results.forEach(result => {
        result.extractedInfo.materials.forEach(material => {
            insights.commonMaterials[material] = (insights.commonMaterials[material] || 0) + 1;
        });
    });
    
    // Collect all costs
    const allCosts = [];
    results.forEach(result => {
        result.extractedInfo.costs.forEach(cost => {
            allCosts.push(cost.value);
        });
    });
    
    if (allCosts.length > 0) {
        insights.priceRanges = {
            min: Math.min(...allCosts),
            max: Math.max(...allCosts),
            average: allCosts.reduce((a, b) => a + b, 0) / allCosts.length
        };
    }
    
    // Collect unique specifications
    const specs = new Set();
    results.forEach(result => {
        result.extractedInfo.specifications.forEach(spec => {
            specs.add(spec);
        });
    });
    insights.specifications = Array.from(specs);
    
    // Calculate timeline span
    const dates = results
        .map(r => r.metadata.lastModified)
        .filter(d => d)
        .map(d => new Date(d));
    
    if (dates.length > 0) {
        insights.timelineSpan = {
            earliest: new Date(Math.min(...dates)),
            latest: new Date(Math.max(...dates))
        };
    }
    
    return insights;
}

// Function to generate search suggestions
function generateSearchSuggestions(results) {
    const suggestions = [];
    
    // Based on insights
    if (results.insights.commonMaterials) {
        const topMaterial = Object.entries(results.insights.commonMaterials)
            .sort((a, b) => b[1] - a[1])[0];
        if (topMaterial) {
            suggestions.push(`${searchQuery} ${topMaterial[0]} specifications`);
        }
    }
    
    // Based on categories found
    if (results.insights.dominantCategories) {
        const categories = Object.keys(results.insights.dominantCategories);
        if (!categories.includes('estimates')) {
            suggestions.push(`${searchQuery} cost estimate`);
        }
        if (!categories.includes('drawings')) {
            suggestions.push(`${searchQuery} drawings plans`);
        }
    }
    
    // Add date-based suggestion
    suggestions.push(`${searchQuery} ${new Date().getFullYear()}`);
    
    // Add specification search
    if (results.insights.specifications.length === 0) {
        suggestions.push(`${searchQuery} specifications requirements`);
    }
    
    return suggestions.slice(0, 5);
}

// Main execution
const searchResults = await performSearch();

// Return the results
return searchResults;

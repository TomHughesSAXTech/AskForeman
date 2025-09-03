// n8n Code Node for Google Search Integration
// This code should be placed in an n8n Code node in your workflow

// Get input parameters
const query = $input.first().json.query || '';
const searchType = $input.first().json.searchType || 'web';
const options = $input.first().json.options || {};
const filters = $input.first().json.filters || {};
const context = $input.first().json.context || {};

// Google Custom Search API Configuration
const GOOGLE_API_KEY = 'AIzaSyDqVtTe9TxW0p5J_IkFk0DT5L5OjLGEFX0'; // Your Google API Key
const SEARCH_ENGINE_ID = '012345678901234567890:abcdefghijk'; // Your Custom Search Engine ID

// Function to enhance query for construction context
function enhanceQueryForConstruction(query) {
    const constructionTerms = [
        'construction', 'building', 'contractor', 'specification',
        'estimate', 'project', 'material', 'installation'
    ];
    
    const queryLower = query.toLowerCase();
    const hasConstructionContext = constructionTerms.some(term => 
        queryLower.includes(term)
    );
    
    if (!hasConstructionContext && context.industry === 'construction') {
        return `construction ${query}`;
    }
    
    return query;
}

// Function to build Google Search URL
function buildSearchUrl(query, options) {
    const baseUrl = 'https://www.googleapis.com/customsearch/v1';
    const params = new URLSearchParams({
        key: GOOGLE_API_KEY,
        cx: SEARCH_ENGINE_ID,
        q: enhanceQueryForConstruction(query),
        num: options.numResults || 10,
        start: options.startIndex || 1,
        safe: options.safeSearch || 'active',
        gl: options.country || 'us',
        hl: options.language || 'en'
    });
    
    // Add date restriction if specified
    if (options.dateRestrict) {
        params.append('dateRestrict', options.dateRestrict);
    }
    
    // Add site search if specified
    if (options.siteSearch) {
        params.append('siteSearch', options.siteSearch);
    }
    
    // Add file type if specified
    if (options.fileType) {
        params.append('fileType', options.fileType);
    }
    
    // Add search type (image, video, etc.)
    if (searchType === 'image') {
        params.append('searchType', 'image');
    }
    
    return `${baseUrl}?${params.toString()}`;
}

// Function to perform the search
async function performGoogleSearch() {
    try {
        const searchUrl = buildSearchUrl(query, options);
        
        // Make the API request
        const response = await $http.get(searchUrl);
        
        if (response.status !== 200) {
            throw new Error(`Google Search API returned status ${response.status}`);
        }
        
        const data = response.data;
        
        // Process and enhance results
        const enhancedResults = processSearchResults(data);
        
        return enhancedResults;
        
    } catch (error) {
        console.error('Google Search Error:', error);
        
        // Return error response
        return {
            success: false,
            error: error.message,
            query: query,
            results: []
        };
    }
}

// Function to process search results
function processSearchResults(data) {
    if (!data || !data.items) {
        return {
            success: false,
            query: query,
            totalResults: 0,
            results: []
        };
    }
    
    const processedResults = {
        success: true,
        query: query,
        totalResults: data.searchInformation?.totalResults || 0,
        searchTime: data.searchInformation?.searchTime || 0,
        results: []
    };
    
    // Process each result
    processedResults.results = data.items.map(item => {
        const result = {
            title: item.title,
            link: item.link,
            displayLink: item.displayLink,
            snippet: item.snippet,
            htmlSnippet: item.htmlSnippet,
            formattedUrl: item.formattedUrl,
            fileType: detectFileType(item.link),
            contentType: detectContentType(item),
            credibility: assessCredibility(item),
            metadata: {}
        };
        
        // Extract metadata if available
        if (item.pagemap) {
            result.metadata = {
                images: item.pagemap.cse_image || [],
                thumbnails: item.pagemap.cse_thumbnail || [],
                metatags: item.pagemap.metatags?.[0] || {},
                organization: item.pagemap.organization?.[0] || null,
                article: item.pagemap.article?.[0] || null
            };
            
            // Extract date if available
            result.date = extractDate(item);
        }
        
        return result;
    });
    
    // Add categories
    processedResults.categories = categorizeResults(processedResults.results);
    
    // Add suggestions for refining search
    processedResults.suggestions = generateSuggestions(query, processedResults.results);
    
    // Sort by relevance
    processedResults.results = sortByRelevance(processedResults.results, query);
    
    return processedResults;
}

// Function to detect file type
function detectFileType(url) {
    const extensions = {
        pdf: 'PDF Document',
        doc: 'Word Document',
        docx: 'Word Document',
        xls: 'Excel Spreadsheet',
        xlsx: 'Excel Spreadsheet',
        ppt: 'PowerPoint',
        pptx: 'PowerPoint',
        dwg: 'CAD Drawing',
        dxf: 'CAD Drawing',
        rvt: 'Revit Model',
        skp: 'SketchUp Model'
    };
    
    const match = url.match(/\.([a-z0-9]+)(?:\?|$)/i);
    if (match) {
        const ext = match[1].toLowerCase();
        return extensions[ext] || 'Web Page';
    }
    
    return 'Web Page';
}

// Function to detect content type
function detectContentType(item) {
    const snippet = (item.snippet || '').toLowerCase();
    const title = (item.title || '').toLowerCase();
    
    if (snippet.includes('specification') || title.includes('spec')) {
        return 'specification';
    } else if (snippet.includes('safety') || snippet.includes('osha')) {
        return 'safety';
    } else if (snippet.includes('cost') || snippet.includes('price')) {
        return 'cost_data';
    } else if (snippet.includes('code') || snippet.includes('standard')) {
        return 'code_standard';
    } else if (snippet.includes('guide') || snippet.includes('tutorial')) {
        return 'guide';
    } else if (snippet.includes('news') || item.pagemap?.article) {
        return 'news';
    } else if (snippet.includes('calculator') || snippet.includes('tool')) {
        return 'tool';
    }
    
    return 'general';
}

// Function to assess credibility
function assessCredibility(item) {
    const trustedDomains = {
        'icc-safe.org': 10,
        'ashrae.org': 10,
        'nfpa.org': 10,
        'osha.gov': 10,
        'ansi.org': 10,
        'astm.org': 10,
        'usgbc.org': 9,
        'energystar.gov': 9,
        'aia.org': 9,
        'agc.org': 8,
        'enr.com': 8,
        'constructiondive.com': 7
    };
    
    let score = 5; // Default score
    
    const domain = item.displayLink || '';
    
    // Check for trusted domains
    for (const [trusted, credScore] of Object.entries(trustedDomains)) {
        if (domain.includes(trusted)) {
            score = Math.max(score, credScore);
            break;
        }
    }
    
    // Boost for government sites
    if (domain.endsWith('.gov')) {
        score = Math.max(score, 9);
    }
    
    // Boost for educational sites
    if (domain.endsWith('.edu')) {
        score = Math.max(score, 8);
    }
    
    // Boost for org sites
    if (domain.endsWith('.org')) {
        score = Math.max(score, 6);
    }
    
    // Boost for HTTPS
    if (item.link?.startsWith('https://')) {
        score += 0.5;
    }
    
    return Math.min(10, score);
}

// Function to extract date
function extractDate(item) {
    if (item.pagemap?.metatags?.[0]) {
        const meta = item.pagemap.metatags[0];
        const dateFields = [
            'article:published_time',
            'datePublished',
            'date',
            'DC.date',
            'publish_date'
        ];
        
        for (const field of dateFields) {
            if (meta[field]) {
                try {
                    return new Date(meta[field]).toISOString();
                } catch (e) {
                    // Invalid date
                }
            }
        }
    }
    
    // Try to extract from snippet
    const dateMatch = item.snippet?.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4}|\w+ \d{1,2}, \d{4})\b/);
    if (dateMatch) {
        try {
            return new Date(dateMatch[1]).toISOString();
        } catch (e) {
            // Invalid date
        }
    }
    
    return null;
}

// Function to categorize results
function categorizeResults(results) {
    const categories = {};
    
    results.forEach(result => {
        const type = result.contentType || 'general';
        if (!categories[type]) {
            categories[type] = [];
        }
        categories[type].push(result);
    });
    
    return categories;
}

// Function to generate suggestions
function generateSuggestions(query, results) {
    const suggestions = [];
    const categories = categorizeResults(results);
    
    // Suggest missing categories
    if (!categories.specification) {
        suggestions.push(`${query} specifications`);
    }
    if (!categories.cost_data) {
        suggestions.push(`${query} cost estimate`);
    }
    if (!categories.safety) {
        suggestions.push(`${query} safety guidelines`);
    }
    
    // Add year-based suggestion
    const currentYear = new Date().getFullYear();
    if (!query.includes(currentYear.toString())) {
        suggestions.push(`${query} ${currentYear}`);
    }
    
    // Add location-based suggestion if not present
    if (!query.match(/\b(USA|United States|America)\b/i)) {
        suggestions.push(`${query} USA`);
    }
    
    return suggestions.slice(0, 5);
}

// Function to sort by relevance
function sortByRelevance(results, query) {
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    return results.map(result => {
        let score = result.credibility || 0;
        
        // Check title matches
        const titleLower = (result.title || '').toLowerCase();
        queryTerms.forEach(term => {
            if (titleLower.includes(term)) score += 2;
        });
        
        // Check snippet matches
        const snippetLower = (result.snippet || '').toLowerCase();
        queryTerms.forEach(term => {
            if (snippetLower.includes(term)) score += 1;
        });
        
        // Boost for file types
        if (result.fileType === 'PDF Document') score += 1;
        if (result.fileType === 'CAD Drawing') score += 2;
        
        // Boost for specific content types
        if (result.contentType === 'specification') score += 1.5;
        if (result.contentType === 'code_standard') score += 1.5;
        
        // Boost for recent content
        if (result.date) {
            const age = (Date.now() - new Date(result.date)) / (1000 * 60 * 60 * 24);
            if (age < 30) score += 1;
            if (age < 7) score += 1;
        }
        
        result.relevanceScore = score;
        return result;
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// Main execution
const searchResults = await performGoogleSearch();

// Return the results
return searchResults;

// Google Search Integration for Ask Foreman
// Provides external web search capabilities for construction industry research

class GoogleSearchIntegration {
    constructor(config) {
        this.config = {
            searchWebhook: config.googleSearchWebhook || 'https://workflows.saxtechnology.com/webhook/ask-foreman/tools/google-search',
            customSearchAPI: config.customSearchAPI || null,
            searchEngineId: config.searchEngineId || null,
            maxResults: config.maxResults || 10,
            ...config
        };

        this.searchHistory = [];
        this.cache = new Map();
    }

    // Perform construction-focused web search
    async searchWeb(query, options = {}) {
        const searchRequest = {
            query: this.enhanceQueryForConstruction(query),
            options: {
                numResults: options.limit || this.config.maxResults,
                searchType: options.searchType || 'web',
                dateRestrict: options.dateRestrict || null,
                siteSearch: options.siteSearch || null,
                fileType: options.fileType || null,
                language: options.language || 'en',
                safeSearch: 'active'
            },
            filters: {
                includeImages: options.includeImages || false,
                includeVideos: options.includeVideos || false,
                includePDFs: options.includePDFs || true,
                includeNews: options.includeNews || false
            },
            context: {
                industry: 'construction',
                focus: options.focus || 'general',
                project: options.projectContext || null
            }
        };

        try {
            // Check cache
            const cacheKey = JSON.stringify(searchRequest);
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < 3600000) { // 1 hour cache
                    return cached.data;
                }
            }

            const response = await fetch(this.config.searchWebhook, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(searchRequest)
            });

            if (!response.ok) {
                throw new Error(`Google search failed: ${response.status}`);
            }

            const results = await response.json();
            const enhanced = this.enhanceSearchResults(results, query);

            // Cache results
            this.cache.set(cacheKey, {
                data: enhanced,
                timestamp: Date.now()
            });

            // Track search
            this.searchHistory.push({
                query: query,
                timestamp: Date.now(),
                resultCount: enhanced.results?.length || 0
            });

            return enhanced;

        } catch (error) {
            console.error('Google search error:', error);
            return this.getOfflineResults(query);
        }
    }

    // Search for construction standards and codes
    async searchBuildingCodes(topic, options = {}) {
        const codeSearch = {
            query: `${topic} building code standard regulation ${options.location || ''}`,
            sources: [
                'site:icc-safe.org',
                'site:ashrae.org',
                'site:nfpa.org',
                'site:osha.gov',
                'site:ansi.org',
                'site:astm.org'
            ].join(' OR '),
            options: {
                ...options,
                focus: 'codes_standards'
            }
        };

        return this.searchWeb(`${codeSearch.query} ${codeSearch.sources}`, codeSearch.options);
    }

    // Search for construction materials and suppliers
    async searchMaterials(materials, options = {}) {
        const materialSearch = {
            query: materials.join(' OR '),
            additionalTerms: [
                'specifications',
                'datasheet',
                'supplier',
                'pricing',
                'availability',
                options.location || ''
            ].filter(t => t).join(' '),
            options: {
                ...options,
                focus: 'materials',
                includePDFs: true
            }
        };

        return this.searchWeb(
            `construction materials ${materialSearch.query} ${materialSearch.additionalTerms}`,
            materialSearch.options
        );
    }

    // Search for construction methods and best practices
    async searchConstructionMethods(method, options = {}) {
        const methodSearch = {
            query: `${method} construction method technique best practice`,
            additionalTerms: [
                'installation guide',
                'procedure',
                'safety',
                'efficiency',
                'case study'
            ].join(' '),
            options: {
                ...options,
                focus: 'methods',
                includeVideos: true
            }
        };

        return this.searchWeb(
            `${methodSearch.query} ${methodSearch.additionalTerms}`,
            methodSearch.options
        );
    }

    // Search for cost data and pricing information
    async searchCostData(item, options = {}) {
        const costSearch = {
            query: `${item} construction cost price estimate ${options.year || new Date().getFullYear()}`,
            sources: [
                'RSMeans',
                'construction cost database',
                'pricing guide',
                options.location ? `${options.location} construction costs` : ''
            ].filter(s => s).join(' '),
            options: {
                ...options,
                focus: 'costs',
                dateRestrict: options.dateRestrict || 'y1' // Last year
            }
        };

        return this.searchWeb(
            `${costSearch.query} ${costSearch.sources}`,
            costSearch.options
        );
    }

    // Search for safety information and OSHA guidelines
    async searchSafetyInfo(topic, options = {}) {
        const safetySearch = {
            query: `${topic} construction safety OSHA guidelines hazard prevention`,
            sources: [
                'site:osha.gov',
                'site:cdc.gov/niosh',
                'safety data sheet',
                'toolbox talk'
            ].join(' '),
            options: {
                ...options,
                focus: 'safety'
            }
        };

        return this.searchWeb(
            `${safetySearch.query} ${safetySearch.sources}`,
            safetySearch.options
        );
    }

    // Search for product specifications and technical data
    async searchProductSpecs(product, manufacturer = null, options = {}) {
        const specSearch = {
            query: `${product} ${manufacturer || ''} specifications technical data sheet`,
            fileTypes: ['pdf', 'doc', 'docx'],
            options: {
                ...options,
                focus: 'specifications',
                fileType: 'pdf'
            }
        };

        return this.searchWeb(specSearch.query, specSearch.options);
    }

    // Search for construction calculators and tools
    async searchCalculatorTools(toolType, options = {}) {
        const toolSearch = {
            query: `${toolType} construction calculator tool online free`,
            additionalTerms: [
                'estimator',
                'formula',
                'computation',
                'converter'
            ].join(' '),
            options: {
                ...options,
                focus: 'tools'
            }
        };

        return this.searchWeb(
            `${toolSearch.query} ${toolSearch.additionalTerms}`,
            toolSearch.options
        );
    }

    // Search for construction industry news and updates
    async searchIndustryNews(topic = 'construction', options = {}) {
        const newsSearch = {
            query: `${topic} construction industry news trends updates`,
            sources: [
                'Engineering News-Record',
                'Construction Dive',
                'Builder Magazine',
                'Construction Executive'
            ].join(' '),
            options: {
                ...options,
                focus: 'news',
                includeNews: true,
                dateRestrict: options.dateRestrict || 'd7' // Last week
            }
        };

        return this.searchWeb(
            `${newsSearch.query} ${newsSearch.sources}`,
            newsSearch.options
        );
    }

    // Search for green building and sustainability information
    async searchGreenBuilding(topic, options = {}) {
        const greenSearch = {
            query: `${topic} green building LEED sustainable construction energy efficient`,
            sources: [
                'site:usgbc.org',
                'site:energystar.gov',
                'sustainable materials',
                'environmental impact'
            ].join(' '),
            options: {
                ...options,
                focus: 'sustainability'
            }
        };

        return this.searchWeb(
            `${greenSearch.query} ${greenSearch.sources}`,
            greenSearch.options
        );
    }

    // Enhance query for construction context
    enhanceQueryForConstruction(query) {
        // Add construction-specific terms if not already present
        const constructionTerms = [
            'construction', 'building', 'contractor', 'specification',
            'estimate', 'project', 'material', 'installation'
        ];

        const queryLower = query.toLowerCase();
        const hasConstructionContext = constructionTerms.some(term => 
            queryLower.includes(term)
        );

        if (!hasConstructionContext) {
            // Add construction context
            return `construction ${query}`;
        }

        return query;
    }

    // Enhance search results with additional metadata
    enhanceSearchResults(results, originalQuery) {
        if (!results || !results.items) {
            return { results: [], query: originalQuery };
        }

        const enhanced = {
            query: originalQuery,
            totalResults: results.searchInformation?.totalResults || 0,
            searchTime: results.searchInformation?.searchTime || 0,
            results: results.items.map(item => this.enhanceResult(item)),
            suggestions: this.generateSuggestions(results, originalQuery),
            relatedSearches: results.queries?.related || []
        };

        // Categorize results
        enhanced.categories = this.categorizeResults(enhanced.results);

        // Add relevance scoring
        enhanced.results = this.scoreRelevance(enhanced.results, originalQuery);

        return enhanced;
    }

    // Enhance individual search result
    enhanceResult(item) {
        const enhanced = {
            title: item.title,
            link: item.link,
            displayLink: item.displayLink,
            snippet: item.snippet,
            htmlSnippet: item.htmlSnippet,
            formattedUrl: item.formattedUrl
        };

        // Extract metadata
        if (item.pagemap) {
            enhanced.metadata = {
                images: item.pagemap.cse_image || [],
                thumbnails: item.pagemap.cse_thumbnail || [],
                metatags: item.pagemap.metatags?.[0] || {},
                organization: item.pagemap.organization?.[0] || null,
                article: item.pagemap.article?.[0] || null
            };
        }

        // Detect file type
        enhanced.fileType = this.detectFileType(item.link);

        // Detect content type
        enhanced.contentType = this.detectContentType(item);

        // Extract date if available
        enhanced.date = this.extractDate(item);

        // Add source credibility score
        enhanced.credibility = this.assessCredibility(item);

        return enhanced;
    }

    // Detect file type from URL
    detectFileType(url) {
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

    // Detect content type from result
    detectContentType(item) {
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

    // Extract date from result
    extractDate(item) {
        // Try metatags
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
                    return new Date(meta[field]).toISOString();
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

    // Assess source credibility
    assessCredibility(item) {
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
            'constructiondive.com': 7,
            '.gov': 9,
            '.edu': 8,
            '.org': 6
        };

        let score = 5; // Default score

        const domain = item.displayLink || '';
        
        for (const [trusted, credScore] of Object.entries(trustedDomains)) {
            if (domain.includes(trusted)) {
                score = Math.max(score, credScore);
            }
        }

        // Boost for HTTPS
        if (item.link?.startsWith('https://')) {
            score += 0.5;
        }

        // Boost for recent content
        if (item.date) {
            const age = (Date.now() - new Date(item.date)) / (1000 * 60 * 60 * 24);
            if (age < 365) score += 0.5;
            if (age < 90) score += 0.5;
        }

        return Math.min(10, score);
    }

    // Categorize search results
    categorizeResults(results) {
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

    // Score relevance of results
    scoreRelevance(results, query) {
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

            return {
                ...result,
                relevanceScore: score
            };
        }).sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    // Generate search suggestions
    generateSuggestions(results, query) {
        const suggestions = [];

        // Based on results categories
        const categories = Object.keys(this.categorizeResults(results.items || []));
        
        if (!categories.includes('specification')) {
            suggestions.push(`${query} specifications`);
        }
        if (!categories.includes('cost_data')) {
            suggestions.push(`${query} cost estimate`);
        }
        if (!categories.includes('safety')) {
            suggestions.push(`${query} safety guidelines`);
        }

        // Add location-based suggestion
        suggestions.push(`${query} [your location]`);

        // Add year-based suggestion
        const currentYear = new Date().getFullYear();
        suggestions.push(`${query} ${currentYear}`);

        return suggestions.slice(0, 5);
    }

    // Get offline/cached results
    getOfflineResults(query) {
        // Search through cache for similar queries
        const similar = [];
        
        this.cache.forEach((value, key) => {
            const cachedQuery = JSON.parse(key).query;
            if (cachedQuery.includes(query) || query.includes(cachedQuery)) {
                similar.push(value.data);
            }
        });

        if (similar.length > 0) {
            return {
                results: similar[0].results || [],
                query: query,
                offline: true,
                message: 'Showing cached results - network unavailable'
            };
        }

        return {
            results: [],
            query: query,
            offline: true,
            message: 'No results available offline'
        };
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
    }

    // Get search history
    getSearchHistory() {
        return this.searchHistory.slice(-20);
    }
}

// Export for use
window.GoogleSearchIntegration = GoogleSearchIntegration;

// Auto-initialize if config available
if (window.API_CONFIG && window.API_CONFIG.googleSearchWebhook) {
    window.googleSearch = new GoogleSearchIntegration(window.API_CONFIG);
    console.log('✅ Google Search Integration initialized');
}

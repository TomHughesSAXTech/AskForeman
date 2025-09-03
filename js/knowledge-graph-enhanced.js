// Enhanced Knowledge Graph Integration for Ask Foreman
// Provides intelligent search, cross-project analysis, and pattern recognition

class KnowledgeGraphEnhanced {
    constructor(config) {
        this.config = {
            webhookUrl: config.knowledgeGraphWebhook || 'https://workflows.saxtechnology.com/webhook/ask-foreman/knowledge-graph',
            searchEndpoint: config.searchEndpoint || 'https://workflows.saxtechnology.com/webhook/ask-foreman/search/semantic',
            aiSearchEndpoint: config.aiSearchEndpoint || 'https://workflows.saxtechnology.com/webhook/ask-foreman/search/ai-enhanced',
            ...config
        };
        
        this.cache = new Map();
        this.searchHistory = [];
        this.projectConnections = new Map();
    }

    // Enhanced semantic search across all projects
    async searchAcrossProjects(query, options = {}) {
        const searchParams = {
            query: query,
            searchType: options.searchType || 'semantic',
            includeProjects: options.includeProjects || 'all',
            filters: {
                documentTypes: options.documentTypes || ['all'],
                dateRange: options.dateRange || null,
                categories: options.categories || ['drawings', 'estimates', 'proposals', 'specs', 'contracts'],
                minRelevance: options.minRelevance || 0.7
            },
            analysis: {
                findSimilar: options.findSimilar !== false,
                compareMetrics: options.compareMetrics !== false,
                identifyPatterns: options.identifyPatterns !== false,
                extractCosts: options.extractCosts !== false
            },
            limit: options.limit || 50,
            includeContext: true,
            enhanceWithAI: true
        };

        try {
            // Check cache first
            const cacheKey = JSON.stringify(searchParams);
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < 300000) { // 5 minute cache
                    return cached.data;
                }
            }

            const response = await fetch(this.config.aiSearchEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(searchParams)
            });

            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`);
            }

            const results = await response.json();
            
            // Process and enhance results
            const enhancedResults = await this.enhanceSearchResults(results, query);
            
            // Cache the results
            this.cache.set(cacheKey, {
                data: enhancedResults,
                timestamp: Date.now()
            });

            // Track search history
            this.searchHistory.push({
                query: query,
                timestamp: Date.now(),
                resultCount: enhancedResults.results?.length || 0
            });

            return enhancedResults;

        } catch (error) {
            console.error('Knowledge Graph search error:', error);
            // Fallback to basic search if AI-enhanced fails
            return this.basicSearch(query, options);
        }
    }

    // Find similar projects and solutions
    async findSimilarProjects(projectData, options = {}) {
        const searchParams = {
            action: 'find_similar',
            projectData: {
                type: projectData.type || 'unknown',
                size: projectData.size || null,
                budget: projectData.budget || null,
                specifications: projectData.specifications || [],
                materials: projectData.materials || [],
                location: projectData.location || null,
                client: projectData.client || null
            },
            comparisons: {
                costAnalysis: options.includeCosts !== false,
                materialsComparison: options.compareMaterials !== false,
                timelineAnalysis: options.includeTimelines !== false,
                methodsComparison: options.compareMethods !== false
            },
            limit: options.limit || 10
        };

        try {
            const response = await fetch(this.config.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(searchParams)
            });

            if (!response.ok) {
                throw new Error(`Similar projects search failed: ${response.status}`);
            }

            const similar = await response.json();
            
            // Build project connections map
            this.updateProjectConnections(projectData, similar);
            
            return this.formatSimilarProjects(similar);

        } catch (error) {
            console.error('Error finding similar projects:', error);
            return { projects: [], insights: [] };
        }
    }

    // Compare specifications across projects
    async compareSpecifications(specs, projects = 'all') {
        const comparison = {
            action: 'compare_specifications',
            specifications: Array.isArray(specs) ? specs : [specs],
            projects: projects,
            analysis: {
                materials: true,
                methods: true,
                costs: true,
                compliance: true,
                alternatives: true
            }
        };

        try {
            const response = await fetch(this.config.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(comparison)
            });

            const data = await response.json();
            return this.formatSpecificationComparison(data);

        } catch (error) {
            console.error('Error comparing specifications:', error);
            return null;
        }
    }

    // Extract cost patterns and trends
    async analyzeCostPatterns(options = {}) {
        const analysis = {
            action: 'analyze_costs',
            timeframe: options.timeframe || 'all',
            categories: options.categories || ['materials', 'labor', 'equipment', 'subcontractor'],
            groupBy: options.groupBy || 'project_type',
            metrics: {
                averages: true,
                trends: true,
                outliers: true,
                predictions: options.includePredictions !== false
            }
        };

        try {
            const response = await fetch(this.config.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(analysis)
            });

            const data = await response.json();
            return this.formatCostAnalysis(data);

        } catch (error) {
            console.error('Error analyzing cost patterns:', error);
            return null;
        }
    }

    // Find alternative solutions from past projects
    async findAlternatives(requirement, context = {}) {
        const search = {
            action: 'find_alternatives',
            requirement: requirement,
            context: {
                projectType: context.projectType || null,
                budget: context.budget || null,
                constraints: context.constraints || [],
                preferences: context.preferences || []
            },
            analysis: {
                costBenefit: true,
                feasibility: true,
                precedents: true,
                recommendations: true
            }
        };

        try {
            const response = await fetch(this.config.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(search)
            });

            const data = await response.json();
            return this.formatAlternatives(data);

        } catch (error) {
            console.error('Error finding alternatives:', error);
            return { alternatives: [], recommendations: [] };
        }
    }

    // Smart document correlation
    async correlateDocuments(documentId, scope = 'all') {
        const correlation = {
            action: 'correlate_documents',
            documentId: documentId,
            scope: scope,
            analysis: {
                references: true,
                dependencies: true,
                conflicts: true,
                updates: true,
                related: true
            }
        };

        try {
            const response = await fetch(this.config.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(correlation)
            });

            const data = await response.json();
            return this.formatDocumentCorrelations(data);

        } catch (error) {
            console.error('Error correlating documents:', error);
            return null;
        }
    }

    // Enhance search results with AI insights
    async enhanceSearchResults(results, query) {
        if (!results || !results.results) return results;

        const enhanced = {
            ...results,
            query: query,
            timestamp: Date.now(),
            insights: [],
            patterns: [],
            recommendations: []
        };

        // Group results by project
        const projectGroups = this.groupByProject(results.results);
        
        // Identify patterns
        enhanced.patterns = this.identifyPatterns(projectGroups, query);
        
        // Generate insights
        enhanced.insights = this.generateInsights(results.results, query);
        
        // Add recommendations
        enhanced.recommendations = await this.generateRecommendations(results.results, query);

        // Sort by relevance with AI boost
        enhanced.results = this.smartSort(results.results, query);

        return enhanced;
    }

    // Group search results by project
    groupByProject(results) {
        const groups = new Map();
        
        results.forEach(result => {
            const project = result.metadata?.client || result.metadata?.project || 'unknown';
            if (!groups.has(project)) {
                groups.set(project, []);
            }
            groups.get(project).push(result);
        });

        return groups;
    }

    // Identify patterns in search results
    identifyPatterns(projectGroups, query) {
        const patterns = [];

        // Common specifications pattern
        const specs = new Map();
        projectGroups.forEach((docs, project) => {
            docs.forEach(doc => {
                if (doc.metadata?.specifications) {
                    doc.metadata.specifications.forEach(spec => {
                        specs.set(spec, (specs.get(spec) || 0) + 1);
                    });
                }
            });
        });

        // Find frequently used specs
        specs.forEach((count, spec) => {
            if (count >= 3) {
                patterns.push({
                    type: 'common_specification',
                    value: spec,
                    frequency: count,
                    confidence: count / projectGroups.size
                });
            }
        });

        // Cost patterns
        const costs = [];
        projectGroups.forEach((docs, project) => {
            docs.forEach(doc => {
                if (doc.metadata?.cost) {
                    costs.push(doc.metadata.cost);
                }
            });
        });

        if (costs.length > 2) {
            const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;
            const stdDev = Math.sqrt(costs.reduce((sq, n) => sq + Math.pow(n - avgCost, 2), 0) / costs.length);
            
            patterns.push({
                type: 'cost_pattern',
                average: avgCost,
                standardDeviation: stdDev,
                range: {
                    min: Math.min(...costs),
                    max: Math.max(...costs)
                }
            });
        }

        return patterns;
    }

    // Generate insights from search results
    generateInsights(results, query) {
        const insights = [];

        // Document type distribution
        const types = new Map();
        results.forEach(r => {
            const type = r.metadata?.documentType || 'unknown';
            types.set(type, (types.get(type) || 0) + 1);
        });

        if (types.size > 1) {
            insights.push({
                type: 'document_distribution',
                message: `Found information across ${types.size} document types`,
                details: Array.from(types.entries()).map(([type, count]) => ({
                    type, count, percentage: (count / results.length * 100).toFixed(1)
                }))
            });
        }

        // Time-based insights
        const dates = results
            .map(r => r.metadata?.date || r.metadata?.lastModified)
            .filter(d => d)
            .map(d => new Date(d));

        if (dates.length > 0) {
            const newest = new Date(Math.max(...dates));
            const oldest = new Date(Math.min(...dates));
            
            insights.push({
                type: 'temporal_range',
                message: `Documents span from ${oldest.toLocaleDateString()} to ${newest.toLocaleDateString()}`,
                details: {
                    oldest: oldest.toISOString(),
                    newest: newest.toISOString(),
                    span: Math.floor((newest - oldest) / (1000 * 60 * 60 * 24)) + ' days'
                }
            });
        }

        return insights;
    }

    // Generate AI-powered recommendations
    async generateRecommendations(results, query) {
        const recommendations = [];

        // Check for missing information
        const hasDrawings = results.some(r => r.metadata?.documentType === 'drawings');
        const hasEstimates = results.some(r => r.metadata?.documentType === 'estimates');
        const hasSpecs = results.some(r => r.metadata?.documentType === 'specs');

        if (!hasDrawings && (hasEstimates || hasSpecs)) {
            recommendations.push({
                type: 'missing_document',
                priority: 'high',
                message: 'Consider reviewing architectural drawings for complete picture',
                action: 'search_drawings'
            });
        }

        // Cost optimization opportunities
        const costs = results
            .map(r => r.metadata?.cost)
            .filter(c => c);

        if (costs.length >= 3) {
            const avg = costs.reduce((a, b) => a + b, 0) / costs.length;
            const min = Math.min(...costs);
            
            if ((avg - min) / avg > 0.15) {
                recommendations.push({
                    type: 'cost_optimization',
                    priority: 'medium',
                    message: `Potential cost savings identified: ${((avg - min) / avg * 100).toFixed(1)}% reduction possible`,
                    action: 'analyze_cost_variance'
                });
            }
        }

        return recommendations;
    }

    // Smart sorting with relevance boosting
    smartSort(results, query) {
        const queryTerms = query.toLowerCase().split(/\s+/);
        
        return results.sort((a, b) => {
            // Base score from search relevance
            let scoreA = a.score || a.relevance || 0;
            let scoreB = b.score || b.relevance || 0;

            // Boost for exact matches in title
            queryTerms.forEach(term => {
                if (a.title?.toLowerCase().includes(term)) scoreA += 0.2;
                if (b.title?.toLowerCase().includes(term)) scoreB += 0.2;
            });

            // Boost for recent documents
            const dateA = new Date(a.metadata?.lastModified || 0);
            const dateB = new Date(b.metadata?.lastModified || 0);
            const daysSinceA = (Date.now() - dateA) / (1000 * 60 * 60 * 24);
            const daysSinceB = (Date.now() - dateB) / (1000 * 60 * 60 * 24);

            if (daysSinceA < 30) scoreA += 0.1;
            if (daysSinceB < 30) scoreB += 0.1;

            // Boost for frequently accessed
            if (a.metadata?.accessCount > 10) scoreA += 0.05;
            if (b.metadata?.accessCount > 10) scoreB += 0.05;

            return scoreB - scoreA;
        });
    }

    // Update project connections map
    updateProjectConnections(sourceProject, similarProjects) {
        if (!this.projectConnections.has(sourceProject.client)) {
            this.projectConnections.set(sourceProject.client, new Set());
        }

        similarProjects.forEach(project => {
            this.projectConnections.get(sourceProject.client).add(project.client);
        });
    }

    // Format similar projects results
    formatSimilarProjects(data) {
        if (!data || !data.projects) return { projects: [], insights: [] };

        return {
            projects: data.projects.map(p => ({
                ...p,
                similarity: (p.similarity * 100).toFixed(1) + '%',
                highlights: this.extractHighlights(p),
                differences: this.extractDifferences(p)
            })),
            insights: data.insights || [],
            recommendations: data.recommendations || []
        };
    }

    // Format specification comparison
    formatSpecificationComparison(data) {
        if (!data) return null;

        return {
            specifications: data.specifications,
            commonElements: data.common || [],
            differences: data.differences || [],
            alternatives: data.alternatives || [],
            costComparison: data.costs || null,
            recommendations: data.recommendations || []
        };
    }

    // Format cost analysis
    formatCostAnalysis(data) {
        if (!data) return null;

        return {
            summary: {
                averageCost: data.average || 0,
                medianCost: data.median || 0,
                trend: data.trend || 'stable',
                outliers: data.outliers || []
            },
            byCategory: data.categories || {},
            byProject: data.projects || {},
            predictions: data.predictions || null,
            insights: data.insights || []
        };
    }

    // Format alternatives
    formatAlternatives(data) {
        if (!data) return { alternatives: [], recommendations: [] };

        return {
            alternatives: (data.alternatives || []).map(alt => ({
                ...alt,
                costDifference: alt.costDiff ? `${alt.costDiff > 0 ? '+' : ''}${(alt.costDiff * 100).toFixed(1)}%` : null,
                feasibilityScore: alt.feasibility ? (alt.feasibility * 100).toFixed(0) + '%' : null
            })),
            recommendations: data.recommendations || [],
            precedents: data.precedents || []
        };
    }

    // Format document correlations
    formatDocumentCorrelations(data) {
        if (!data) return null;

        return {
            document: data.source,
            references: data.references || [],
            referencedBy: data.referencedBy || [],
            dependencies: data.dependencies || [],
            conflicts: data.conflicts || [],
            updates: data.updates || [],
            related: data.related || []
        };
    }

    // Extract highlights from similar project
    extractHighlights(project) {
        const highlights = [];

        if (project.cost && project.costDifference < -0.1) {
            highlights.push(`Cost ${Math.abs(project.costDifference * 100).toFixed(1)}% lower`);
        }
        
        if (project.duration && project.durationDifference < -0.1) {
            highlights.push(`Completed ${Math.abs(project.durationDifference * 100).toFixed(1)}% faster`);
        }

        if (project.specifications?.length > 5) {
            highlights.push(`${project.specifications.length} matching specifications`);
        }

        return highlights;
    }

    // Extract differences from similar project
    extractDifferences(project) {
        const differences = [];

        if (project.type !== project.sourceType) {
            differences.push(`Different project type: ${project.type}`);
        }

        if (project.sizeDifference && Math.abs(project.sizeDifference) > 0.2) {
            differences.push(`Size difference: ${(project.sizeDifference * 100).toFixed(1)}%`);
        }

        if (project.location !== project.sourceLocation) {
            differences.push(`Different location: ${project.location}`);
        }

        return differences;
    }

    // Basic fallback search
    async basicSearch(query, options) {
        try {
            const response = await fetch(this.config.searchEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: query,
                    limit: options.limit || 20,
                    filters: options.filters || {}
                })
            });

            if (!response.ok) {
                throw new Error(`Basic search failed: ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            console.error('Basic search error:', error);
            return { results: [], error: error.message };
        }
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
    }

    // Get search history
    getSearchHistory() {
        return this.searchHistory.slice(-20); // Last 20 searches
    }

    // Get project connections graph
    getProjectConnections() {
        const connections = [];
        
        this.projectConnections.forEach((connected, source) => {
            connected.forEach(target => {
                connections.push({ source, target });
            });
        });

        return connections;
    }
}

// Export for use in main application
window.KnowledgeGraphEnhanced = KnowledgeGraphEnhanced;

// Auto-initialize if config is available
if (window.API_CONFIG && window.API_CONFIG.knowledgeGraphWebhook) {
    window.knowledgeGraph = new KnowledgeGraphEnhanced(window.API_CONFIG);
    console.log('✅ Enhanced Knowledge Graph initialized');
}

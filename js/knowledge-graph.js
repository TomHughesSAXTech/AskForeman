// Knowledge Graph Integration Module
// Provides entity extraction and knowledge graph functionality for AskForeman

class KnowledgeGraphManager {
    constructor() {
        this.functionUrl = 'https://saxtech-functionapps.azurewebsites.net/api/knowledge-graph';
        this.functionKey = 'uaW4r7LbFbXOvMiJIg5AzFCsF6lRMRtLcJFxRDBovQzKAzFuL2Ohlg==';
        this.entities = [];
        this.isProcessing = false;
    }

    // Extract entities from document content
    async extractEntities(documentContent, clientName = 'general', fileName = 'document.txt') {
        if (this.isProcessing) {
            console.log('Entity extraction already in progress');
            return null;
        }

        this.isProcessing = true;
        
        try {
            const response = await fetch(`${this.functionUrl}?code=${this.functionKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    documentContent,
                    clientName,
                    fileName,
                    category: 'chat-extraction'
                })
            });

            // Set a timeout for the response
            const timeoutPromise = new Promise((resolve) => 
                setTimeout(() => resolve({ timeout: true }), 8000)
            );

            const result = await Promise.race([
                response.json(),
                timeoutPromise
            ]);

            if (result.timeout || !result.success) {
                // Fall back to local extraction
                return this.extractEntitiesLocal(documentContent);
            }

            this.entities = result.entities || [];
            return {
                success: true,
                entities: result.entities,
                entityTypes: result.entityTypes,
                entityCount: result.entities
            };

        } catch (error) {
            console.error('Knowledge Graph extraction error:', error);
            // Fall back to local extraction
            return this.extractEntitiesLocal(documentContent);
        } finally {
            this.isProcessing = false;
        }
    }

    // Local entity extraction as fallback
    extractEntitiesLocal(content) {
        const entities = [];
        
        // Extract costs
        const costPattern = /\$[\d,]+(?:\.\d{2})?/g;
        let match;
        while ((match = costPattern.exec(content)) !== null) {
            entities.push({
                type: 'cost',
                value: match[0],
                context: this.getContext(content, match.index)
            });
        }
        
        // Extract rooms/locations
        const roomPattern = /(?:Room|Rm\.?|Suite|Floor|Building|Wing|Unit)\s*[\w\d-]+/gi;
        while ((match = roomPattern.exec(content)) !== null) {
            entities.push({
                type: 'location',
                value: match[0],
                context: this.getContext(content, match.index)
            });
        }
        
        // Extract dates
        const datePatterns = [
            /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/gi,
            /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
            /\b\d{4}-\d{2}-\d{2}\b/g
        ];
        
        datePatterns.forEach(pattern => {
            while ((match = pattern.exec(content)) !== null) {
                entities.push({
                    type: 'date',
                    value: match[0],
                    context: this.getContext(content, match.index)
                });
            }
        });
        
        // Extract contractors/companies
        const contractorPattern = /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Contractors?|Electric|Plumbing|Construction|Services|Inc\.?|LLC|Corp|Company|Group)/g;
        while ((match = contractorPattern.exec(content)) !== null) {
            entities.push({
                type: 'contractor',
                value: match[0],
                context: this.getContext(content, match.index)
            });
        }
        
        // Extract materials/equipment
        const materialPatterns = [
            /(?:Carrier|Trane|Lennox|Rheem|Kohler|Moen|Delta)\s+[\w\s-]+/gi,
            /\d+(?:-ton|-amp|-gallon|-inch|")\s+[\w\s]+/gi,
            /(?:copper|PVC|steel|aluminum|concrete|drywall|insulation)\s+[\w\s]+/gi
        ];
        
        materialPatterns.forEach(pattern => {
            while ((match = pattern.exec(content)) !== null) {
                if (!entities.find(e => e.value === match[0])) {
                    entities.push({
                        type: 'material',
                        value: match[0],
                        context: this.getContext(content, match.index)
                    });
                }
            }
        });
        
        // Extract phone numbers
        const phonePattern = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
        while ((match = phonePattern.exec(content)) !== null) {
            entities.push({
                type: 'contact',
                value: match[0],
                context: this.getContext(content, match.index)
            });
        }
        
        // Extract email addresses
        const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        while ((match = emailPattern.exec(content)) !== null) {
            entities.push({
                type: 'email',
                value: match[0],
                context: this.getContext(content, match.index)
            });
        }

        // Remove duplicates
        const uniqueEntities = this.removeDuplicateEntities(entities);
        this.entities = uniqueEntities;

        return {
            success: true,
            entities: uniqueEntities.length,
            entityTypes: [...new Set(uniqueEntities.map(e => e.type))],
            entityList: uniqueEntities
        };
    }

    // Get context around a match
    getContext(content, index, contextLength = 50) {
        const start = Math.max(0, index - contextLength);
        const end = Math.min(content.length, index + contextLength);
        return content.substring(start, end).trim();
    }

    // Remove duplicate entities
    removeDuplicateEntities(entities) {
        const seen = new Set();
        return entities.filter(entity => {
            const key = `${entity.type}:${entity.value.toLowerCase()}`;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    // Format entities for display
    formatEntitiesForDisplay() {
        if (!this.entities || this.entities.length === 0) {
            return '<p style="color: #666;">No entities extracted yet.</p>';
        }

        const entityGroups = {};
        this.entities.forEach(entity => {
            if (!entityGroups[entity.type]) {
                entityGroups[entity.type] = [];
            }
            entityGroups[entity.type].push(entity);
        });

        let html = '<div class="knowledge-graph-entities">';
        
        for (const [type, entities] of Object.entries(entityGroups)) {
            html += `
                <div class="entity-group" style="margin-bottom: 20px;">
                    <h4 style="color: #667eea; margin-bottom: 10px; text-transform: capitalize;">
                        ${type}s (${entities.length})
                    </h4>
                    <div class="entity-list" style="display: flex; flex-wrap: wrap; gap: 10px;">
            `;
            
            entities.forEach(entity => {
                html += `
                    <div class="entity-item" style="
                        background: #f7fafc;
                        border: 1px solid #e2e8f0;
                        padding: 8px 12px;
                        border-radius: 6px;
                        font-size: 14px;
                        cursor: pointer;
                        transition: all 0.2s;
                    " onmouseover="this.style.borderColor='#667eea'" onmouseout="this.style.borderColor='#e2e8f0'">
                        <strong>${entity.value}</strong>
                    </div>
                `;
            });
            
            html += '</div></div>';
        }
        
        html += '</div>';
        return html;
    }

    // Create a knowledge graph query from entities
    createKnowledgeQuery() {
        if (!this.entities || this.entities.length === 0) {
            return '';
        }

        // Group entities by type for intelligent query construction
        const contractors = this.entities.filter(e => e.type === 'contractor').map(e => e.value);
        const materials = this.entities.filter(e => e.type === 'material').map(e => e.value);
        const costs = this.entities.filter(e => e.type === 'cost').map(e => e.value);
        const locations = this.entities.filter(e => e.type === 'location').map(e => e.value);

        let query = '';
        
        if (contractors.length > 0) {
            query += `contractors: ${contractors.slice(0, 3).join(', ')} `;
        }
        if (materials.length > 0) {
            query += `materials: ${materials.slice(0, 3).join(', ')} `;
        }
        if (costs.length > 0) {
            query += `budget: ${costs[0]} `;
        }
        if (locations.length > 0) {
            query += `location: ${locations[0]} `;
        }

        return query.trim();
    }

    // Generate insights from extracted entities
    generateInsights() {
        if (!this.entities || this.entities.length === 0) {
            return null;
        }

        const insights = [];
        
        // Cost insights
        const costs = this.entities.filter(e => e.type === 'cost');
        if (costs.length > 0) {
            const totalEstimate = costs.reduce((sum, cost) => {
                const value = parseFloat(cost.value.replace(/[$,]/g, ''));
                return sum + (isNaN(value) ? 0 : value);
            }, 0);
            
            if (totalEstimate > 0) {
                insights.push({
                    type: 'financial',
                    message: `Total estimated costs: $${totalEstimate.toLocaleString()}`,
                    icon: '💰'
                });
            }
        }

        // Contractor insights
        const contractors = this.entities.filter(e => e.type === 'contractor');
        if (contractors.length > 0) {
            insights.push({
                type: 'vendors',
                message: `${contractors.length} contractor${contractors.length > 1 ? 's' : ''} identified`,
                icon: '👷'
            });
        }

        // Timeline insights
        const dates = this.entities.filter(e => e.type === 'date');
        if (dates.length > 0) {
            insights.push({
                type: 'timeline',
                message: `${dates.length} important date${dates.length > 1 ? 's' : ''} found`,
                icon: '📅'
            });
        }

        // Location insights
        const locations = this.entities.filter(e => e.type === 'location');
        if (locations.length > 0) {
            insights.push({
                type: 'locations',
                message: `${locations.length} location${locations.length > 1 ? 's' : ''} referenced`,
                icon: '📍'
            });
        }

        return insights;
    }

    // Check if knowledge graph is available
    async checkAvailability() {
        try {
            const response = await fetch(`${this.functionUrl}?code=${this.functionKey}`, {
                method: 'GET',
                signal: AbortSignal.timeout(3000)
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}

// Export for use in main application
window.KnowledgeGraphManager = KnowledgeGraphManager;

// Initialize on load if needed
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.knowledgeGraph = new KnowledgeGraphManager();
    });
} else {
    window.knowledgeGraph = new KnowledgeGraphManager();
}

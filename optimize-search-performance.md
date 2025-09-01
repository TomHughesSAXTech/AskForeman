# Optimizing Azure Cognitive Search Performance

## Current Issues
Your search might be slow due to:
1. Large document sizes with full content being searched
2. No caching of search results
3. Inefficient query patterns
4. Missing search optimizations in Azure

## Quick Wins - Implement These Now

### 1. Add Search Caching Layer
Create a simple caching mechanism to avoid repeated searches:

```javascript
// Add to your index.html or admin.html
const searchCache = new Map();
const CACHE_DURATION = 60000; // 1 minute cache

async function cachedSearch(query, client = null) {
    const cacheKey = `${query}_${client || 'all'}`;
    const cached = searchCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('Using cached search results');
        return cached.data;
    }
    
    // Perform actual search
    const results = await performSearch(query, client);
    
    // Cache the results
    searchCache.set(cacheKey, {
        data: results,
        timestamp: Date.now()
    });
    
    return results;
}

// Clear cache when documents are uploaded/deleted
function clearSearchCache() {
    searchCache.clear();
}
```

### 2. Optimize Search Queries
Use more efficient search parameters:

```javascript
async function performSearch(query, client = null) {
    const searchBody = {
        search: query,
        searchMode: 'any', // Faster than 'all'
        top: 50, // Limit initial results
        skip: 0,
        count: true,
        // Only select fields you need - reduces payload size
        select: 'id,fileName,client,category,uploadedAt',
        // Add search highlights for better UX
        highlight: 'content',
        highlightPreTag: '<mark>',
        highlightPostTag: '</mark>',
        // Use scoring profiles if configured
        scoringProfile: 'defaultScoringProfile'
    };
    
    if (client) {
        searchBody.filter = `client eq '${client}'`;
    }
    
    return await fetch(searchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchBody)
    });
}
```

### 3. Implement Pagination
Don't load all results at once:

```javascript
class SearchPaginator {
    constructor(pageSize = 20) {
        this.pageSize = pageSize;
        this.currentPage = 0;
        this.totalResults = 0;
    }
    
    async search(query, client = null) {
        const skip = this.currentPage * this.pageSize;
        
        const searchBody = {
            search: query,
            top: this.pageSize,
            skip: skip,
            count: true,
            select: 'id,fileName,client,category,uploadedAt',
            filter: client ? `client eq '${client}'` : null
        };
        
        const response = await fetch(searchUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(searchBody)
        });
        
        const data = await response.json();
        this.totalResults = data['@odata.count'];
        
        return {
            results: data.value,
            hasMore: skip + this.pageSize < this.totalResults,
            totalPages: Math.ceil(this.totalResults / this.pageSize)
        };
    }
    
    nextPage() {
        this.currentPage++;
    }
    
    previousPage() {
        if (this.currentPage > 0) this.currentPage--;
    }
}
```

### 4. Use Typeahead/Suggestions
Implement faster autocomplete using Azure's suggest API:

```javascript
async function getSearchSuggestions(text) {
    const suggestBody = {
        search: text,
        suggesterName: 'sg', // You'll need to create this in Azure
        top: 5,
        select: 'fileName,client'
    };
    
    const response = await fetch(suggestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(suggestBody)
    });
    
    return await response.json();
}
```

## Azure Search Index Optimizations

### 1. Create a Suggester
Add this to your index definition to enable fast autocomplete:

```json
{
    "suggesters": [
        {
            "name": "sg",
            "searchMode": "analyzingInfixMatching",
            "sourceFields": ["fileName", "content"]
        }
    ]
}
```

### 2. Add Scoring Profiles
Create scoring profiles to boost relevant results:

```json
{
    "scoringProfiles": [
        {
            "name": "defaultScoringProfile",
            "text": {
                "weights": {
                    "fileName": 2.0,
                    "category": 1.5,
                    "content": 1.0
                }
            },
            "functions": [
                {
                    "type": "freshness",
                    "fieldName": "uploadedAt",
                    "boost": 1.5,
                    "interpolation": "linear",
                    "freshness": {
                        "boostingDuration": "P30D"
                    }
                }
            ]
        }
    ]
}
```

### 3. Optimize Field Attributes
Update your index fields for better performance:

```json
{
    "fields": [
        {
            "name": "id",
            "type": "Edm.String",
            "key": true,
            "searchable": false,  // IDs don't need to be searchable
            "filterable": true,
            "sortable": false,
            "facetable": false,
            "retrievable": true
        },
        {
            "name": "fileName",
            "type": "Edm.String",
            "searchable": true,
            "filterable": true,
            "sortable": true,
            "facetable": false,  // Disable if not using facets
            "retrievable": true,
            "analyzer": "standard.lucene"
        },
        {
            "name": "content",
            "type": "Edm.String",
            "searchable": true,
            "filterable": false,  // Content shouldn't be filterable
            "sortable": false,
            "facetable": false,
            "retrievable": true,  // Set false if content is large
            "analyzer": "en.microsoft"  // Better for English text
        },
        {
            "name": "contentSummary",
            "type": "Edm.String",
            "searchable": false,
            "retrievable": true  // Store first 500 chars for preview
        }
    ]
}
```

## Implementing Search Performance Monitoring

Add this to track search performance:

```javascript
class SearchPerformanceMonitor {
    constructor() {
        this.metrics = [];
    }
    
    async measureSearch(searchFunction, ...args) {
        const startTime = performance.now();
        
        try {
            const result = await searchFunction(...args);
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            this.metrics.push({
                timestamp: new Date(),
                duration: duration,
                query: args[0],
                resultCount: result.value?.length || 0
            });
            
            // Log slow queries
            if (duration > 1000) {
                console.warn(`Slow search detected: ${duration}ms for query "${args[0]}"`);
            }
            
            // Keep only last 100 metrics
            if (this.metrics.length > 100) {
                this.metrics.shift();
            }
            
            return result;
        } catch (error) {
            console.error('Search failed:', error);
            throw error;
        }
    }
    
    getAverageSearchTime() {
        if (this.metrics.length === 0) return 0;
        const sum = this.metrics.reduce((acc, m) => acc + m.duration, 0);
        return sum / this.metrics.length;
    }
    
    getSlowestQueries(count = 5) {
        return [...this.metrics]
            .sort((a, b) => b.duration - a.duration)
            .slice(0, count);
    }
}

// Usage
const searchMonitor = new SearchPerformanceMonitor();

async function searchWithMonitoring(query, client) {
    return await searchMonitor.measureSearch(performSearch, query, client);
}
```

## Quick Implementation Script

Here's a script to update your search implementation:

```bash
#!/bin/bash

# Update Azure Search index with optimizations
cat > update-search-index.sh << 'EOF'
#!/bin/bash

SEARCH_SERVICE="fcssearchservice"
INDEX_NAME="fcs-construction-docs-index-v2"
API_KEY="UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv"

# Add suggester to index
curl -X PUT \
  "https://${SEARCH_SERVICE}.search.windows.net/indexes/${INDEX_NAME}?api-version=2021-04-30-Preview" \
  -H "Content-Type: application/json" \
  -H "api-key: ${API_KEY}" \
  -d '{
    "suggesters": [
      {
        "name": "sg",
        "searchMode": "analyzingInfixMatching", 
        "sourceFields": ["fileName", "content"]
      }
    ]
  }'

echo "Search index updated with performance optimizations"
EOF

chmod +x update-search-index.sh
```

## Immediate Actions to Take

1. **Add Result Caching** (5 min)
   - Implement the cache code above in your frontend
   - This alone can reduce search times by 80% for repeated queries

2. **Limit Selected Fields** (2 min)
   - Update your search queries to only select needed fields
   - Don't retrieve full content unless displaying it

3. **Implement Pagination** (10 min)
   - Load 20-50 results initially
   - Load more on demand

4. **Add Search Debouncing** (5 min)
   ```javascript
   let searchTimeout;
   function debounceSearch(query) {
       clearTimeout(searchTimeout);
       searchTimeout = setTimeout(() => {
           performSearch(query);
       }, 300); // Wait 300ms after typing stops
   }
   ```

5. **Preload Common Searches** (5 min)
   ```javascript
   // Preload common searches on page load
   window.addEventListener('load', () => {
       // Warm up cache with common queries
       cachedSearch('*', currentClient); // All docs for client
       cachedSearch('drawing', currentClient);
       cachedSearch('estimate', currentClient);
   });
   ```

## Expected Performance Improvements

After implementing these optimizations:
- **Initial search**: 200-500ms (from 1-3 seconds)
- **Cached searches**: <50ms (instant)
- **Autocomplete**: <100ms
- **Page navigation**: <200ms
- **Overall UX**: 5-10x faster perceived performance

## Testing Performance

Use this to test your improvements:

```javascript
async function testSearchPerformance() {
    const queries = [
        'construction',
        'drawing',
        'estimate',
        'floor plan',
        'electrical'
    ];
    
    console.log('Testing search performance...');
    
    for (const query of queries) {
        const start = performance.now();
        await performSearch(query);
        const duration = performance.now() - start;
        console.log(`Query "${query}": ${duration.toFixed(2)}ms`);
    }
}
```

## Next Steps

1. Monitor actual search performance in production
2. Identify most common/slow queries
3. Consider upgrading Azure Search tier if needed
4. Implement semantic search for better relevance
5. Add CDN for static assets to improve overall app performance

/**
 * Blueprint Search UI Component
 * Enhanced search interface for construction blueprints with new OCR capabilities
 */

(function() {
    'use strict';

    class BlueprintSearchUI {
        constructor(containerId) {
            this.container = document.getElementById(containerId);
            this.searchResults = [];
            this.currentFilters = {};
            this.init();
        }

        async init() {
            // Wait for DirectSearch to be available
            if (!window.DirectSearch) {
                console.warn('DirectSearch not available, waiting...');
                setTimeout(() => this.init(), 1000);
                return;
            }

            await window.DirectSearch.initialize();
            this.render();
            this.attachEventListeners();
            await this.loadFilters();
        }

        render() {
            this.container.innerHTML = `
                <div class="blueprint-search-container">
                    <div class="search-header">
                        <h2>🔍 Blueprint & Drawing Search</h2>
                        <div class="search-stats" id="searchStats"></div>
                    </div>
                    
                    <div class="search-controls">
                        <div class="search-bar">
                            <input type="text" id="blueprintSearchInput" 
                                   placeholder="Search by sheet number, material, specification, or dimension..." 
                                   class="search-input">
                            <button id="blueprintSearchBtn" class="search-btn">Search</button>
                            <button id="advancedToggleBtn" class="toggle-btn">Advanced ▼</button>
                        </div>
                        
                        <div id="advancedOptions" class="advanced-options" style="display: none;">
                            <div class="filter-group">
                                <label>Drawing Type:</label>
                                <select id="drawingTypeFilter">
                                    <option value="">All Types</option>
                                </select>
                            </div>
                            
                            <div class="filter-group">
                                <label>Material:</label>
                                <select id="materialFilter">
                                    <option value="">All Materials</option>
                                </select>
                            </div>
                            
                            <div class="filter-group">
                                <label>Sheet Number:</label>
                                <input type="text" id="sheetNumberInput" placeholder="e.g., A101">
                            </div>
                            
                            <div class="filter-group">
                                <label>Standard/Code:</label>
                                <input type="text" id="standardCodeInput" placeholder="e.g., ASTM A615">
                            </div>
                            
                            <div class="filter-group">
                                <label>Fire Rating:</label>
                                <input type="text" id="fireRatingInput" placeholder="e.g., 2-hr">
                            </div>
                            
                            <div class="filter-group">
                                <label>
                                    <input type="checkbox" id="handwrittenOnly">
                                    Handwritten Annotations Only
                                </label>
                            </div>
                            
                            <div class="filter-group">
                                <label>
                                    <input type="checkbox" id="highConfidenceOnly">
                                    High OCR Confidence Only (>0.7)
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="quick-filters" id="quickFilters">
                        <button class="quick-filter-btn" data-filter="structural">Structural</button>
                        <button class="quick-filter-btn" data-filter="architectural">Architectural</button>
                        <button class="quick-filter-btn" data-filter="mechanical">Mechanical</button>
                        <button class="quick-filter-btn" data-filter="electrical">Electrical</button>
                        <button class="quick-filter-btn" data-filter="steel">Steel</button>
                        <button class="quick-filter-btn" data-filter="concrete">Concrete</button>
                        <button class="quick-filter-btn" data-filter="fire-rated">Fire Rated</button>
                    </div>
                    
                    <div class="results-container">
                        <div id="resultsHeader" class="results-header" style="display: none;">
                            <span id="resultCount"></span>
                            <span id="searchTime"></span>
                        </div>
                        <div id="searchResults" class="search-results"></div>
                    </div>
                </div>
                
                <style>
                    .blueprint-search-container {
                        max-width: 1200px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    
                    .search-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 20px;
                    }
                    
                    .search-header h2 {
                        margin: 0;
                        color: #333;
                    }
                    
                    .search-bar {
                        display: flex;
                        gap: 10px;
                        margin-bottom: 15px;
                    }
                    
                    .search-input {
                        flex: 1;
                        padding: 12px;
                        font-size: 16px;
                        border: 2px solid #ddd;
                        border-radius: 8px;
                    }
                    
                    .search-btn, .toggle-btn {
                        padding: 12px 24px;
                        background: #007bff;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 16px;
                    }
                    
                    .toggle-btn {
                        background: #6c757d;
                    }
                    
                    .search-btn:hover {
                        background: #0056b3;
                    }
                    
                    .advanced-options {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 15px;
                        padding: 20px;
                        background: #f8f9fa;
                        border-radius: 8px;
                        margin-bottom: 20px;
                    }
                    
                    .filter-group {
                        display: flex;
                        flex-direction: column;
                        gap: 5px;
                    }
                    
                    .filter-group label {
                        font-size: 14px;
                        font-weight: 600;
                        color: #666;
                    }
                    
                    .filter-group input, .filter-group select {
                        padding: 8px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                    }
                    
                    .quick-filters {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 10px;
                        margin-bottom: 20px;
                    }
                    
                    .quick-filter-btn {
                        padding: 8px 16px;
                        background: #e9ecef;
                        border: 1px solid #dee2e6;
                        border-radius: 20px;
                        cursor: pointer;
                        transition: all 0.3s;
                    }
                    
                    .quick-filter-btn:hover {
                        background: #007bff;
                        color: white;
                    }
                    
                    .quick-filter-btn.active {
                        background: #007bff;
                        color: white;
                    }
                    
                    .results-header {
                        display: flex;
                        justify-content: space-between;
                        padding: 10px;
                        background: #f1f3f5;
                        border-radius: 4px;
                        margin-bottom: 10px;
                    }
                    
                    .search-results {
                        display: grid;
                        gap: 15px;
                    }
                    
                    .result-card {
                        padding: 20px;
                        background: white;
                        border: 1px solid #e1e4e8;
                        border-radius: 8px;
                        transition: box-shadow 0.3s;
                    }
                    
                    .result-card:hover {
                        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    }
                    
                    .result-title {
                        font-size: 18px;
                        font-weight: 600;
                        color: #0366d6;
                        margin-bottom: 10px;
                    }
                    
                    .result-metadata {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 15px;
                        margin: 10px 0;
                        font-size: 14px;
                        color: #666;
                    }
                    
                    .metadata-item {
                        display: flex;
                        align-items: center;
                        gap: 5px;
                    }
                    
                    .result-badges {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 8px;
                        margin: 10px 0;
                    }
                    
                    .badge {
                        padding: 4px 8px;
                        background: #e3f2fd;
                        color: #1976d2;
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: 600;
                    }
                    
                    .badge.material {
                        background: #e8f5e9;
                        color: #2e7d32;
                    }
                    
                    .badge.dimension {
                        background: #fff3e0;
                        color: #f57c00;
                    }
                    
                    .badge.standard {
                        background: #fce4ec;
                        color: #c2185b;
                    }
                    
                    .badge.handwritten {
                        background: #f3e5f5;
                        color: #7b1fa2;
                    }
                    
                    .ocr-confidence {
                        display: inline-block;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: bold;
                    }
                    
                    .confidence-high {
                        background: #d4edda;
                        color: #155724;
                    }
                    
                    .confidence-medium {
                        background: #fff3cd;
                        color: #856404;
                    }
                    
                    .confidence-low {
                        background: #f8d7da;
                        color: #721c24;
                    }
                </style>
            `;
        }

        attachEventListeners() {
            // Search button
            document.getElementById('blueprintSearchBtn').addEventListener('click', () => this.performSearch());
            
            // Enter key in search input
            document.getElementById('blueprintSearchInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.performSearch();
            });
            
            // Advanced toggle
            document.getElementById('advancedToggleBtn').addEventListener('click', () => {
                const advanced = document.getElementById('advancedOptions');
                const btn = document.getElementById('advancedToggleBtn');
                if (advanced.style.display === 'none') {
                    advanced.style.display = 'grid';
                    btn.textContent = 'Advanced ▲';
                } else {
                    advanced.style.display = 'none';
                    btn.textContent = 'Advanced ▼';
                }
            });
            
            // Quick filters
            document.querySelectorAll('.quick-filter-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleQuickFilter(e));
            });
        }

        async loadFilters() {
            try {
                // Load drawing types
                const drawingTypes = await window.DirectSearch.getDrawingTypes();
                const drawingTypeSelect = document.getElementById('drawingTypeFilter');
                drawingTypes.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type.value;
                    option.textContent = `${type.value} (${type.count})`;
                    drawingTypeSelect.appendChild(option);
                });
                
                // Load materials (top 20)
                const materials = await window.DirectSearch.getMaterials();
                const materialSelect = document.getElementById('materialFilter');
                materials.slice(0, 20).forEach(material => {
                    const option = document.createElement('option');
                    option.value = material.value;
                    option.textContent = `${material.value} (${material.count})`;
                    materialSelect.appendChild(option);
                });
            } catch (error) {
                console.error('Failed to load filters:', error);
            }
        }

        async handleQuickFilter(event) {
            const btn = event.target;
            const filter = btn.dataset.filter;
            
            // Toggle active state
            btn.classList.toggle('active');
            
            // Build search based on filter
            let searchOptions = {};
            
            switch(filter) {
                case 'structural':
                case 'architectural':
                case 'mechanical':
                case 'electrical':
                    searchOptions = { drawingType: filter.charAt(0).toUpperCase() + filter.slice(1) };
                    break;
                case 'steel':
                case 'concrete':
                    searchOptions = { material: filter };
                    break;
                case 'fire-rated':
                    searchOptions = { fireRating: '2-hr' };
                    break;
            }
            
            await this.performSearch(searchOptions);
        }

        async performSearch(quickOptions = {}) {
            const query = document.getElementById('blueprintSearchInput').value;
            const drawingType = quickOptions.drawingType || document.getElementById('drawingTypeFilter').value;
            const material = quickOptions.material || document.getElementById('materialFilter').value;
            const sheetNumber = document.getElementById('sheetNumberInput').value;
            const standardCode = document.getElementById('standardCodeInput').value;
            const fireRating = quickOptions.fireRating || document.getElementById('fireRatingInput').value;
            const handwrittenOnly = document.getElementById('handwrittenOnly').checked;
            const highConfidenceOnly = document.getElementById('highConfidenceOnly').checked;
            
            // Build filters
            const filters = [];
            if (drawingType) filters.push(`drawingType eq '${drawingType}'`);
            if (material) filters.push(`materials/any(m: m eq '${material}')`);
            if (fireRating) filters.push(`fireRatings/any(f: search.in(f, '${fireRating}'))`);
            if (handwrittenOnly) filters.push('hasHandwrittenText eq true');
            if (highConfidenceOnly) filters.push('ocrConfidence gt 0.7');
            
            // Build search query
            let searchQuery = query;
            if (sheetNumber) searchQuery = `${searchQuery} ${sheetNumber}`.trim();
            if (standardCode) searchQuery = `${searchQuery} ${standardCode}`.trim();
            
            try {
                // Show loading
                document.getElementById('searchResults').innerHTML = '<div class="loading">Searching blueprints...</div>';
                
                // Perform search
                const results = await window.DirectSearch.search({
                    query: searchQuery || '*',
                    filter: filters.length > 0 ? filters.join(' and ') : null,
                    searchType: 'semantic',
                    top: 20,
                    facets: ['drawingType,count:10', 'materials,count:20']
                });
                
                this.displayResults(results);
                
            } catch (error) {
                console.error('Search failed:', error);
                document.getElementById('searchResults').innerHTML = 
                    '<div class="error">Search failed. Please try again.</div>';
            }
        }

        displayResults(results) {
            const resultsContainer = document.getElementById('searchResults');
            const resultsHeader = document.getElementById('resultsHeader');
            const resultCount = document.getElementById('resultCount');
            const searchTime = document.getElementById('searchTime');
            
            // Update header
            resultsHeader.style.display = 'flex';
            resultCount.textContent = `Found ${results.count} documents`;
            searchTime.textContent = `Search time: ${results.searchTime}s`;
            
            // Display results
            if (results.documents.length === 0) {
                resultsContainer.innerHTML = '<div class="no-results">No blueprints found matching your criteria.</div>';
                return;
            }
            
            resultsContainer.innerHTML = results.documents.map(doc => this.renderResultCard(doc)).join('');
        }

        renderResultCard(doc) {
            const confidenceClass = doc.ocrConfidence > 0.7 ? 'confidence-high' : 
                                   doc.ocrConfidence > 0.4 ? 'confidence-medium' : 'confidence-low';
            
            return `
                <div class="result-card">
                    <div class="result-title">${doc.fileName || 'Untitled Document'}</div>
                    
                    <div class="result-metadata">
                        ${doc.sheetNumber ? `<span class="metadata-item">📄 Sheet: ${doc.sheetNumber}</span>` : ''}
                        ${doc.drawingType ? `<span class="metadata-item">📐 Type: ${doc.drawingType}</span>` : ''}
                        ${doc.drawingScale ? `<span class="metadata-item">📏 Scale: ${doc.drawingScale}</span>` : ''}
                        ${doc.revision ? `<span class="metadata-item">🔄 Rev: ${doc.revision}</span>` : ''}
                        ${doc.ocrConfidence ? `<span class="metadata-item">OCR: <span class="ocr-confidence ${confidenceClass}">${(doc.ocrConfidence * 100).toFixed(0)}%</span></span>` : ''}
                    </div>
                    
                    <div class="result-badges">
                        ${doc.hasHandwrittenText ? '<span class="badge handwritten">✍️ Handwritten</span>' : ''}
                        ${(doc.materials || []).slice(0, 5).map(m => `<span class="badge material">${m}</span>`).join('')}
                        ${(doc.dimensions || []).slice(0, 3).map(d => `<span class="badge dimension">${d}</span>`).join('')}
                        ${(doc.standardsCodes || []).slice(0, 3).map(s => `<span class="badge standard">${s}</span>`).join('')}
                    </div>
                    
                    ${doc['@search.captions'] ? `
                        <div class="result-caption">
                            ${doc['@search.captions'][0].text}
                        </div>
                    ` : ''}
                    
                    <div class="result-actions">
                        <button onclick="window.open('${doc.blobPath}', '_blank')" class="action-btn">
                            📥 Download
                        </button>
                    </div>
                </div>
            `;
        }
    }

    // Export to window
    window.BlueprintSearchUI = BlueprintSearchUI;

    // Auto-initialize if container exists
    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('blueprintSearchContainer')) {
            new BlueprintSearchUI('blueprintSearchContainer');
        }
    });

})();

// Mock Data Loader for Testing
// This script adds mock projects and drawings for testing the takeoff tool

(function() {
    'use strict';
    
    // Mock projects data
    window.mockProjects = [
        { id: 'demo-office-building', name: 'Demo Office Building', client: 'ABC Corp' },
        { id: 'demo-warehouse', name: 'Demo Warehouse', client: 'XYZ Industries' },
        { id: 'demo-retail-store', name: 'Demo Retail Store', client: 'Shop Co' }
    ];
    
    // Mock drawings data
    window.mockDrawings = {
        'demo-office-building': [
            { name: 'Floor_Plan_Level_1.pdf', url: 'data:application/pdf;base64,mock', type: 'pdf' },
            { name: 'Floor_Plan_Level_2.pdf', url: 'data:application/pdf;base64,mock', type: 'pdf' },
            { name: 'Elevations.pdf', url: 'data:application/pdf;base64,mock', type: 'pdf' },
            { name: 'Site_Plan.jpg', url: 'data:image/jpeg;base64,mock', type: 'image' }
        ],
        'demo-warehouse': [
            { name: 'Warehouse_Layout.pdf', url: 'data:application/pdf;base64,mock', type: 'pdf' },
            { name: 'Loading_Dock_Details.pdf', url: 'data:application/pdf;base64,mock', type: 'pdf' },
            { name: 'Structural_Grid.png', url: 'data:image/png;base64,mock', type: 'image' }
        ],
        'demo-retail-store': [
            { name: 'Store_Layout.pdf', url: 'data:application/pdf;base64,mock', type: 'pdf' },
            { name: 'Storefront_Elevation.pdf', url: 'data:application/pdf;base64,mock', type: 'pdf' },
            { name: 'Fixture_Plan.jpg', url: 'data:image/jpeg;base64,mock', type: 'image' }
        ]
    };
    
    // Mock takeoff data for projects
    window.mockTakeoffData = {
        'demo-office-building': {
            scale: '1:100',
            units: 'Feet',
            measurements: [
                { id: 1, type: 'line', value: 45.5, description: 'Wall Length North' },
                { id: 2, type: 'line', value: 32.0, description: 'Wall Length East' },
                { id: 3, type: 'area', value: 1456.0, description: 'Office Area' },
                { id: 4, type: 'polygon', value: 2340.5, description: 'Conference Room' }
            ],
            aiAnalysis: {
                detectedAreas: [
                    { name: 'Main Office', area: '1456 sq ft', dimensions: '45 x 32' },
                    { name: 'Conference Room', area: '2340 sq ft', dimensions: '60 x 39' },
                    { name: 'Reception', area: '450 sq ft', dimensions: '30 x 15' }
                ],
                materials: [
                    { type: 'Drywall', spec: '5/8" Type X', coverage: '4500 sq ft' },
                    { type: 'Carpet', spec: 'Commercial Grade', coverage: '3200 sq ft' },
                    { type: 'Ceiling Tiles', spec: '2x4 Acoustic', coverage: '4200 sq ft' }
                ]
            }
        },
        'demo-warehouse': {
            scale: '1:200',
            units: 'Feet',
            measurements: [
                { id: 1, type: 'line', value: 200.0, description: 'Building Length' },
                { id: 2, type: 'line', value: 150.0, description: 'Building Width' },
                { id: 3, type: 'area', value: 30000.0, description: 'Total Floor Area' }
            ],
            aiAnalysis: {
                detectedAreas: [
                    { name: 'Main Storage', area: '25000 sq ft', dimensions: '200 x 125' },
                    { name: 'Loading Area', area: '3000 sq ft', dimensions: '60 x 50' },
                    { name: 'Office Space', area: '2000 sq ft', dimensions: '50 x 40' }
                ],
                materials: [
                    { type: 'Concrete Slab', spec: '6" Reinforced', coverage: '30000 sq ft' },
                    { type: 'Metal Roofing', spec: 'Standing Seam', coverage: '31000 sq ft' },
                    { type: 'Steel Framing', spec: 'W-Beams', coverage: 'Structural' }
                ]
            }
        }
    };
    
    // Function to load mock projects into selector
    window.loadMockProjects = function() {
        const projectSelects = [
            document.getElementById('takeoffProjectSelect'),
            document.getElementById('viewProjectSelect'),
            document.getElementById('estimateClientSelect')
        ];
        
        projectSelects.forEach(select => {
            if (select && !select.dataset.mockLoaded) {
                // Clear existing options
                select.innerHTML = '<option value="">Select Project</option>';
                
                // Add mock projects
                window.mockProjects.forEach(project => {
                    const option = document.createElement('option');
                    option.value = project.id;
                    option.textContent = project.name;
                    option.dataset.client = project.client;
                    select.appendChild(option);
                });
                
                select.dataset.mockLoaded = 'true';
                
                // Add demo indicator
                const demoLabel = document.createElement('span');
                demoLabel.style.cssText = 'margin-left: 10px; color: #4caf50; font-size: 0.9em;';
                demoLabel.textContent = '(Demo Mode)';
                if (select.parentNode && !select.parentNode.querySelector('.demo-label')) {
                    demoLabel.className = 'demo-label';
                    select.parentNode.appendChild(demoLabel);
                }
            }
        });
    };
    
    // Function to load mock drawings for a project
    window.loadMockDrawings = function(projectId, fileSelector) {
        if (!fileSelector) return;
        
        const drawings = window.mockDrawings[projectId] || [];
        
        fileSelector.innerHTML = '<option value="">Select Drawing</option>';
        fileSelector.style.display = drawings.length > 0 ? 'inline-block' : 'none';
        
        drawings.forEach(drawing => {
            const option = document.createElement('option');
            option.value = drawing.url;
            option.textContent = drawing.name;
            option.dataset.type = drawing.type;
            fileSelector.appendChild(option);
        });
        
        if (drawings.length > 0) {
            window.addSystemMessage && window.addSystemMessage(`✅ Found ${drawings.length} demo drawing(s)`);
        }
    };
    
    // Function to load mock takeoff data
    window.loadMockTakeoffData = function(projectId) {
        const data = window.mockTakeoffData[projectId];
        if (!data) return null;
        
        // Update UI with mock data
        const scaleElement = document.getElementById('drawingScale');
        if (scaleElement) scaleElement.textContent = data.scale;
        
        const unitsElement = document.getElementById('units') || document.getElementById('drawingUnits');
        if (unitsElement) unitsElement.textContent = data.units;
        
        // Load measurements
        window.measurements = data.measurements || [];
        updateMeasurementsList();
        
        // Load AI analysis
        if (data.aiAnalysis) {
            displayMockAIResults(data.aiAnalysis);
        }
        
        return data;
    };
    
    // Function to display mock AI results
    function displayMockAIResults(analysis) {
        const resultsDiv = document.getElementById('aiResults') || document.getElementById('viewAIResults');
        if (!resultsDiv) return;
        
        let html = '<div style="color: #4caf50; margin-bottom: 0.5rem;">✅ Analysis Complete (Demo)</div>';
        
        // Detected areas
        html += '<div style="margin-top: 0.75rem;"><strong>Detected Areas:</strong></div>';
        html += '<ul style="margin-left: 1rem; font-size: 0.9rem;">';
        analysis.detectedAreas.forEach(area => {
            html += `<li>${area.name}: ${area.area} (${area.dimensions})</li>`;
        });
        html += '</ul>';
        
        // Materials
        html += '<div style="margin-top: 0.75rem;"><strong>Materials Detected:</strong></div>';
        html += '<ul style="margin-left: 1rem; font-size: 0.9rem;">';
        analysis.materials.forEach(mat => {
            html += `<li>${mat.type} (${mat.spec}): ${mat.coverage}</li>`;
        });
        html += '</ul>';
        
        resultsDiv.innerHTML = html;
    }
    
    // Function to update measurements list
    function updateMeasurementsList() {
        const list = document.getElementById('measurementsList') || document.getElementById('viewMeasurementsList');
        if (!list || !window.measurements) return;
        
        list.innerHTML = '';
        
        window.measurements.forEach(m => {
            const item = document.createElement('div');
            item.className = 'measurement-item';
            item.style.cssText = 'padding: 8px; margin: 4px 0; background: rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer;';
            
            let icon = '';
            let valueText = '';
            
            switch(m.type) {
                case 'line':
                    icon = '📏';
                    valueText = `${m.value.toFixed(1)} ft`;
                    break;
                case 'area':
                    icon = '⬜';
                    valueText = `${m.value.toFixed(1)} sq ft`;
                    break;
                case 'polygon':
                    icon = '⬟';
                    valueText = `${m.value.toFixed(1)} sq ft`;
                    break;
            }
            
            item.innerHTML = `
                <span style="margin-right: 8px;">${icon}</span>
                <span>${m.description}: ${valueText}</span>
            `;
            
            list.appendChild(item);
        });
    }
    
    // Function to create mock canvas drawing
    window.createMockDrawing = function() {
        const canvas = document.getElementById('pdfCanvas') || document.getElementById('viewPdfCanvas');
        const annotationCanvas = document.getElementById('annotationCanvas') || document.getElementById('viewAnnotationCanvas');
        
        if (canvas) {
            const ctx = canvas.getContext('2d');
            
            // Set canvas size
            canvas.width = 800;
            canvas.height = 600;
            
            // Draw mock blueprint background
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw grid
            ctx.strokeStyle = '#e0e0e0';
            ctx.lineWidth = 1;
            for (let x = 0; x < canvas.width; x += 50) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }
            for (let y = 0; y < canvas.height; y += 50) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
                ctx.stroke();
            }
            
            // Draw mock floor plan
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            
            // Outer walls
            ctx.strokeRect(100, 100, 600, 400);
            
            // Interior walls
            ctx.beginPath();
            ctx.moveTo(300, 100);
            ctx.lineTo(300, 300);
            ctx.moveTo(300, 300);
            ctx.lineTo(500, 300);
            ctx.moveTo(500, 300);
            ctx.lineTo(500, 500);
            ctx.stroke();
            
            // Add room labels
            ctx.fillStyle = '#333';
            ctx.font = '14px Arial';
            ctx.fillText('OFFICE 1', 180, 200);
            ctx.fillText('OFFICE 2', 380, 200);
            ctx.fillText('CONFERENCE', 180, 400);
            ctx.fillText('RECEPTION', 580, 300);
            
            // Add dimensions
            ctx.font = '12px Arial';
            ctx.fillStyle = '#666';
            ctx.fillText('30\'', 190, 95);
            ctx.fillText('20\'', 390, 95);
            ctx.fillText('40\'', 95, 300);
        }
        
        if (annotationCanvas) {
            annotationCanvas.width = canvas.width;
            annotationCanvas.height = canvas.height;
        }
    };
    
    // Auto-load mock data when DOM is ready
    function initMockData() {
        console.log('📊 Loading mock data for testing...');
        
        // Load mock projects
        window.loadMockProjects();
        
        // Override project selector handlers to use mock data
        const projectSelects = [
            document.getElementById('takeoffProjectSelect'),
            document.getElementById('viewProjectSelect')
        ];
        
        projectSelects.forEach(select => {
            if (select) {
                const originalOnChange = select.onchange;
                select.onchange = async function(e) {
                    const projectId = e.target.value;
                    
                    if (projectId && projectId.startsWith('demo-')) {
                        // Load mock drawings
                        const fileSelector = document.getElementById('drawingFileSelector') || 
                                           document.getElementById('viewDrawingSelect');
                        if (fileSelector) {
                            window.loadMockDrawings(projectId, fileSelector);
                            
                            // Auto-select first drawing for demo
                            if (fileSelector.options.length > 1) {
                                fileSelector.selectedIndex = 1;
                                
                                // Create mock drawing on canvas
                                setTimeout(() => {
                                    window.createMockDrawing();
                                    window.loadMockTakeoffData(projectId);
                                }, 100);
                            }
                        }
                    } else if (originalOnChange) {
                        // Call original handler for real projects
                        originalOnChange.call(this, e);
                    }
                };
            }
        });
        
        console.log('✅ Mock data loaded successfully');
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMockData);
    } else {
        initMockData();
    }
    
    // Make functions globally available
    window.initMockData = initMockData;
    
})();

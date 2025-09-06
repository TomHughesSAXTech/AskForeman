// Dynamic Building Management for Estimator
// Complete integration with projects and takeoffs

(function() {
    'use strict';
    
    // Global state for buildings
    window.estimatorState = window.estimatorState || {
        buildings: [
            {
                id: 'building-1',
                name: 'Building 1',
                materials: {},
                laborHours: 0,
                totalCost: 0,
                takeoffData: null
            }
        ],
        currentBuilding: 'building-1',
        maxBuildings: 10
    };
    
    // Initialize when DOM is ready
    function initialize() {
        // Setup building tabs
        setupBuildingTabs();
        
        // Setup add/remove building controls
        setupBuildingControls();
        
        // Setup project integration
        setupProjectIntegration();
        
        // Initialize first building only on estimator page
        if (document.getElementById('estimatorForm')) {
            activateBuilding('building-1');
        }
    }
    
    // Setup building tabs
    function setupBuildingTabs() {
        const buildingTabs = document.getElementById('buildingTabs');
        if (!buildingTabs) {
            // Create tabs container if missing
            const estimatorContainer = document.querySelector('.estimator-tool');
            if (estimatorContainer) {
                const tabsContainer = document.createElement('div');
                tabsContainer.id = 'buildingTabs';
                tabsContainer.className = 'building-tabs';
                tabsContainer.style.cssText = `
                    display: flex;
                    gap: 0.5rem;
                    padding: 1rem;
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                    margin-bottom: 1rem;
                    align-items: center;
                `;
                
                // Insert after header or at top
                const header = estimatorContainer.querySelector('h2, h3');
                if (header) {
                    header.insertAdjacentElement('afterend', tabsContainer);
                } else {
                    estimatorContainer.insertBefore(tabsContainer, estimatorContainer.firstChild);
                }
                
                renderBuildingTabs();
            }
        } else {
            renderBuildingTabs();
        }
    }
    
    // Render building tabs
    function renderBuildingTabs() {
        const buildingTabs = document.getElementById('buildingTabs');
        if (!buildingTabs) return;
        
        buildingTabs.innerHTML = '';
        
        // Add tabs for each building
        window.estimatorState.buildings.forEach((building, index) => {
            const tab = document.createElement('button');
            tab.className = 'building-tab';
            tab.dataset.buildingId = building.id;
            tab.style.cssText = `
                padding: 0.5rem 1rem;
                background: ${building.id === window.estimatorState.currentBuilding ? 'var(--primary-orange)' : 'rgba(255,255,255,0.1)'};
                color: ${building.id === window.estimatorState.currentBuilding ? 'white' : 'var(--light-gray)'};
                border: none;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.3s ease;
                position: relative;
            `;
            
            // Building name (editable)
            const nameSpan = document.createElement('span');
            nameSpan.contentEditable = 'true';
            nameSpan.textContent = building.name;
            nameSpan.style.cssText = 'outline: none; padding: 0 4px;';
            nameSpan.onblur = function() {
                building.name = this.textContent.trim() || `Building ${index + 1}`;
                this.textContent = building.name;
                saveEstimatorState();
            };
            nameSpan.onkeydown = function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.blur();
                }
            };
            
            tab.appendChild(nameSpan);
            
            // Remove button (if more than one building)
            if (window.estimatorState.buildings.length > 1) {
                const removeBtn = document.createElement('span');
                removeBtn.innerHTML = '×';
                removeBtn.style.cssText = `
                    margin-left: 0.5rem;
                    color: #ff6b6b;
                    font-size: 1.2rem;
                    cursor: pointer;
                    opacity: 0.7;
                `;
                removeBtn.onclick = function(e) {
                    e.stopPropagation();
                    removeBuilding(building.id);
                };
                tab.appendChild(removeBtn);
            }
            
            // Click to activate
            tab.onclick = function(e) {
                if (e.target === nameSpan) return;
                activateBuilding(building.id);
            };
            
            buildingTabs.appendChild(tab);
        });
        
        // Add new building button
        if (window.estimatorState.buildings.length < window.estimatorState.maxBuildings) {
            const addBtn = document.createElement('button');
            addBtn.className = 'add-building-btn';
            addBtn.innerHTML = '+ Add Building';
            addBtn.style.cssText = `
                padding: 0.5rem 1rem;
                background: var(--primary-green);
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.3s ease;
            `;
            addBtn.onclick = addBuilding;
            buildingTabs.appendChild(addBtn);
        }
        
        // Import from takeoff button
        const importBtn = document.createElement('button');
        importBtn.className = 'import-takeoff-btn';
        importBtn.innerHTML = '📥 Import from Takeoff';
        importBtn.style.cssText = `
            padding: 0.5rem 1rem;
            background: var(--concrete-gray);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-left: auto;
        `;
        importBtn.onclick = importFromTakeoff;
        buildingTabs.appendChild(importBtn);
    }
    
    // Add new building
    function addBuilding() {
        const buildingNumber = window.estimatorState.buildings.length + 1;
        const newBuilding = {
            id: `building-${buildingNumber}`,
            name: `Building ${buildingNumber}`,
            materials: {},
            laborHours: 0,
            totalCost: 0,
            takeoffData: null
        };
        
        window.estimatorState.buildings.push(newBuilding);
        
        // Activate the new building
        window.estimatorState.currentBuilding = newBuilding.id;
        
        // Re-render tabs
        renderBuildingTabs();
        
        // Clear current form for new building
        clearEstimatorForm();
        
        window.addSystemMessage && window.addSystemMessage(`✅ Added ${newBuilding.name}`, 'success');
        
        saveEstimatorState();
    }
    
    // Remove building
    function removeBuilding(buildingId) {
        if (window.estimatorState.buildings.length <= 1) {
            window.addSystemMessage && window.addSystemMessage('⚠️ Cannot remove the last building', 'warning');
            return;
        }
        
        const index = window.estimatorState.buildings.findIndex(b => b.id === buildingId);
        if (index > -1) {
            const buildingName = window.estimatorState.buildings[index].name;
            
            if (confirm(`Remove ${buildingName}? This cannot be undone.`)) {
                window.estimatorState.buildings.splice(index, 1);
                
                // If removing current building, switch to first
                if (window.estimatorState.currentBuilding === buildingId) {
                    window.estimatorState.currentBuilding = window.estimatorState.buildings[0].id;
                    activateBuilding(window.estimatorState.buildings[0].id);
                }
                
                renderBuildingTabs();
                window.addSystemMessage && window.addSystemMessage(`✅ Removed ${buildingName}`, 'success');
                
                saveEstimatorState();
            }
        }
    }
    
    // Activate building
    function activateBuilding(buildingId) {
        const building = window.estimatorState.buildings.find(b => b.id === buildingId);
        if (!building) return;
        
        // Save current building data before switching
        saveCurrentBuildingData();
        
        // Update current building
        window.estimatorState.currentBuilding = buildingId;
        
        // Load building data into form
        loadBuildingData(building);
        
        // Update tabs visual state
        document.querySelectorAll('.building-tab').forEach(tab => {
            if (tab.dataset.buildingId === buildingId) {
                tab.style.background = 'var(--primary-orange)';
                tab.style.color = 'white';
            } else {
                tab.style.background = 'rgba(255,255,255,0.1)';
                tab.style.color = 'var(--light-gray)';
            }
        });
        
        // Only show message on estimator page
        if (document.getElementById('estimatorForm')) {
            window.addSystemMessage && window.addSystemMessage(`🏢 Switched to ${building.name}`, 'info');
        }
    }
    
    // Save current building data
    function saveCurrentBuildingData() {
        const currentBuilding = window.estimatorState.buildings.find(
            b => b.id === window.estimatorState.currentBuilding
        );
        
        if (!currentBuilding) return;
        
        // Collect material rows
        const materialRows = document.querySelectorAll('.material-row');
        currentBuilding.materials = {};
        
        materialRows.forEach((row, index) => {
            const category = row.querySelector('select[name*="category"]')?.value || '';
            const material = row.querySelector('input[name*="material"]')?.value || '';
            const quantity = parseFloat(row.querySelector('input[name*="quantity"]')?.value) || 0;
            const unit = row.querySelector('select[name*="unit"]')?.value || '';
            const unitCost = parseFloat(row.querySelector('input[name*="unitCost"]')?.value) || 0;
            
            if (material) {
                currentBuilding.materials[`material-${index}`] = {
                    category,
                    material,
                    quantity,
                    unit,
                    unitCost,
                    totalCost: quantity * unitCost
                };
            }
        });
        
        // Save labor hours
        const laborInput = document.getElementById('totalLaborHours');
        if (laborInput) {
            currentBuilding.laborHours = parseFloat(laborInput.value) || 0;
        }
        
        // Calculate total cost
        currentBuilding.totalCost = Object.values(currentBuilding.materials)
            .reduce((sum, mat) => sum + mat.totalCost, 0);
        
        saveEstimatorState();
    }
    
    // Load building data
    function loadBuildingData(building) {
        // Clear existing rows
        const materialsList = document.getElementById('materialsList');
        if (materialsList) {
            materialsList.innerHTML = '';
            
            // Add material rows from building data
            if (building.materials && Object.keys(building.materials).length > 0) {
                Object.values(building.materials).forEach(mat => {
                    addMaterialRow(mat);
                });
            } else {
                // Add one empty row
                addMaterialRow();
            }
        }
        
        // Load labor hours
        const laborInput = document.getElementById('totalLaborHours');
        if (laborInput) {
            laborInput.value = building.laborHours || 0;
        }
        
        // Update totals
        updateEstimateTotals();
        
        // Load takeoff data if available
        if (building.takeoffData) {
            displayTakeoffInfo(building.takeoffData);
        }
    }
    
    // Clear estimator form
    function clearEstimatorForm() {
        const materialsList = document.getElementById('materialsList');
        if (materialsList) {
            materialsList.innerHTML = '';
            addMaterialRow(); // Add one empty row
        }
        
        const laborInput = document.getElementById('totalLaborHours');
        if (laborInput) {
            laborInput.value = 0;
        }
        
        updateEstimateTotals();
    }
    
    // Add material row
    function addMaterialRow(materialData = null) {
        const materialsList = document.getElementById('materialsList');
        if (!materialsList) return;
        
        const rowIndex = materialsList.children.length;
        const row = document.createElement('div');
        row.className = 'material-row';
        row.style.cssText = 'display: flex; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center;';
        
        row.innerHTML = `
            <select name="category-${rowIndex}" style="padding: 0.5rem; border-radius: 4px; background: white; color: var(--concrete-gray);">
                <option value="">Category</option>
                <option value="structural" ${materialData?.category === 'structural' ? 'selected' : ''}>Structural</option>
                <option value="roofing" ${materialData?.category === 'roofing' ? 'selected' : ''}>Roofing</option>
                <option value="electrical" ${materialData?.category === 'electrical' ? 'selected' : ''}>Electrical</option>
                <option value="plumbing" ${materialData?.category === 'plumbing' ? 'selected' : ''}>Plumbing</option>
                <option value="hvac" ${materialData?.category === 'hvac' ? 'selected' : ''}>HVAC</option>
                <option value="finishes" ${materialData?.category === 'finishes' ? 'selected' : ''}>Finishes</option>
                <option value="other" ${materialData?.category === 'other' ? 'selected' : ''}>Other</option>
            </select>
            <input type="text" name="material-${rowIndex}" placeholder="Material" 
                   value="${materialData?.material || ''}"
                   style="flex: 2; padding: 0.5rem; border-radius: 4px; border: 1px solid #ddd;">
            <input type="number" name="quantity-${rowIndex}" placeholder="Qty" 
                   value="${materialData?.quantity || ''}"
                   style="width: 80px; padding: 0.5rem; border-radius: 4px; border: 1px solid #ddd;">
            <select name="unit-${rowIndex}" style="padding: 0.5rem; border-radius: 4px; background: white; color: var(--concrete-gray);">
                <option value="ea" ${materialData?.unit === 'ea' ? 'selected' : ''}>ea</option>
                <option value="sf" ${materialData?.unit === 'sf' ? 'selected' : ''}>sq ft</option>
                <option value="lf" ${materialData?.unit === 'lf' ? 'selected' : ''}>lin ft</option>
                <option value="cy" ${materialData?.unit === 'cy' ? 'selected' : ''}>cu yd</option>
                <option value="ton" ${materialData?.unit === 'ton' ? 'selected' : ''}>ton</option>
            </select>
            <input type="number" name="unitCost-${rowIndex}" placeholder="$/unit" 
                   value="${materialData?.unitCost || ''}"
                   style="width: 100px; padding: 0.5rem; border-radius: 4px; border: 1px solid #ddd;">
            <button onclick="this.parentElement.remove(); updateEstimateTotals();" 
                    style="padding: 0.5rem; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer;">
                ×
            </button>
        `;
        
        materialsList.appendChild(row);
        
        // Add change listeners
        row.querySelectorAll('input, select').forEach(input => {
            input.onchange = () => {
                saveCurrentBuildingData();
                updateEstimateTotals();
            };
        });
    }
    
    // Import from takeoff
    async function importFromTakeoff() {
        // Check if we have takeoff data
        if (!window.takeoffState || !window.takeoffState.savedTakeoffs || window.takeoffState.savedTakeoffs.length === 0) {
            window.addSystemMessage && window.addSystemMessage('⚠️ No takeoff data available. Please complete a takeoff first.', 'warning');
            return;
        }
        
        // Show selection dialog
        const takeoffSelect = prompt(
            'Select takeoff to import:\n' + 
            window.takeoffState.savedTakeoffs.map((t, i) => `${i + 1}. ${t.fileName}`).join('\n')
        );
        
        if (takeoffSelect) {
            const index = parseInt(takeoffSelect) - 1;
            const selectedTakeoff = window.takeoffState.savedTakeoffs[index];
            
            if (selectedTakeoff) {
                importTakeoffData(selectedTakeoff);
            }
        }
    }
    
    // Import takeoff data
    function importTakeoffData(takeoff) {
        const currentBuilding = window.estimatorState.buildings.find(
            b => b.id === window.estimatorState.currentBuilding
        );
        
        if (!currentBuilding) return;
        
        // Store takeoff reference
        currentBuilding.takeoffData = takeoff;
        
        // Clear existing materials
        currentBuilding.materials = {};
        const materialsList = document.getElementById('materialsList');
        if (materialsList) {
            materialsList.innerHTML = '';
        }
        
        // Import measurements as materials
        if (takeoff.data.measurements) {
            takeoff.data.measurements.forEach((measurement, index) => {
                const materialData = {
                    category: determineCategory(measurement),
                    material: measurement.description || measurement.type,
                    quantity: parseFloat(measurement.value) || 0,
                    unit: measurement.unit || 'ea',
                    unitCost: 0 // To be filled by user
                };
                
                currentBuilding.materials[`material-${index}`] = materialData;
                addMaterialRow(materialData);
            });
        }
        
        // Import AI analysis if available
        if (takeoff.data.analysis) {
            // Import areas
            if (takeoff.data.analysis.areas) {
                takeoff.data.analysis.areas.forEach((area, index) => {
                    const materialData = {
                        category: 'finishes',
                        material: area.name,
                        quantity: parseFloat(area.value) || 0,
                        unit: 'sf',
                        unitCost: 0
                    };
                    
                    const matIndex = Object.keys(currentBuilding.materials).length;
                    currentBuilding.materials[`material-${matIndex}`] = materialData;
                    addMaterialRow(materialData);
                });
            }
            
            // Import materials
            if (takeoff.data.analysis.materials) {
                takeoff.data.analysis.materials.forEach((mat, index) => {
                    const materialData = {
                        category: determineCategory(mat),
                        material: mat.type,
                        quantity: 0, // To be filled by user
                        unit: 'ea',
                        unitCost: 0
                    };
                    
                    const matIndex = Object.keys(currentBuilding.materials).length;
                    currentBuilding.materials[`material-${matIndex}`] = materialData;
                    addMaterialRow(materialData);
                });
            }
        }
        
        // Display takeoff info
        displayTakeoffInfo(takeoff);
        
        window.addSystemMessage && window.addSystemMessage('✅ Takeoff data imported', 'success');
        
        saveEstimatorState();
        updateEstimateTotals();
    }
    
    // Determine category from measurement/material
    function determineCategory(item) {
        const text = (item.description || item.type || '').toLowerCase();
        
        if (text.includes('roof')) return 'roofing';
        if (text.includes('wall') || text.includes('frame') || text.includes('beam')) return 'structural';
        if (text.includes('electric') || text.includes('wire')) return 'electrical';
        if (text.includes('plumb') || text.includes('pipe')) return 'plumbing';
        if (text.includes('hvac') || text.includes('duct')) return 'hvac';
        if (text.includes('floor') || text.includes('paint') || text.includes('finish')) return 'finishes';
        
        return 'other';
    }
    
    // Display takeoff info
    function displayTakeoffInfo(takeoff) {
        let infoDiv = document.getElementById('takeoffInfo');
        if (!infoDiv) {
            const estimatorContainer = document.querySelector('.estimator-tool');
            if (estimatorContainer) {
                infoDiv = document.createElement('div');
                infoDiv.id = 'takeoffInfo';
                infoDiv.style.cssText = `
                    background: rgba(76, 175, 80, 0.1);
                    border: 1px solid var(--primary-green);
                    border-radius: 8px;
                    padding: 1rem;
                    margin: 1rem 0;
                `;
                
                const buildingTabs = document.getElementById('buildingTabs');
                if (buildingTabs) {
                    buildingTabs.insertAdjacentElement('afterend', infoDiv);
                }
            }
        }
        
        if (infoDiv) {
            infoDiv.innerHTML = `
                <div style="color: var(--primary-green); font-weight: bold; margin-bottom: 0.5rem;">
                    📊 Imported from Takeoff
                </div>
                <div style="font-size: 0.9rem;">
                    <strong>File:</strong> ${takeoff.fileName}<br>
                    <strong>Project:</strong> ${takeoff.data.projectId || 'Unknown'}<br>
                    <strong>Scale:</strong> 1:${takeoff.data.scale || 'Unknown'}<br>
                    <strong>Measurements:</strong> ${takeoff.data.measurements?.length || 0} items
                </div>
            `;
        }
    }
    
    // Update estimate totals
    function updateEstimateTotals() {
        const currentBuilding = window.estimatorState.buildings.find(
            b => b.id === window.estimatorState.currentBuilding
        );
        
        if (!currentBuilding) return;
        
        let materialTotal = 0;
        let laborTotal = 0;
        
        // Calculate material costs
        document.querySelectorAll('.material-row').forEach(row => {
            const quantity = parseFloat(row.querySelector('input[name*="quantity"]')?.value) || 0;
            const unitCost = parseFloat(row.querySelector('input[name*="unitCost"]')?.value) || 0;
            materialTotal += quantity * unitCost;
        });
        
        // Calculate labor cost
        const laborHours = parseFloat(document.getElementById('totalLaborHours')?.value) || 0;
        const laborRate = 75; // Default hourly rate
        laborTotal = laborHours * laborRate;
        
        // Update display
        const materialCostEl = document.getElementById('materialCost');
        const laborCostEl = document.getElementById('laborCost');
        const totalCostEl = document.getElementById('totalProjectCost');
        
        if (materialCostEl) materialCostEl.textContent = `$${materialTotal.toFixed(2)}`;
        if (laborCostEl) laborCostEl.textContent = `$${laborTotal.toFixed(2)}`;
        if (totalCostEl) totalCostEl.textContent = `$${(materialTotal + laborTotal).toFixed(2)}`;
        
        // Update building totals
        currentBuilding.totalCost = materialTotal + laborTotal;
        
        // Update grand total for all buildings
        updateGrandTotal();
    }
    
    // Update grand total
    function updateGrandTotal() {
        const grandTotal = window.estimatorState.buildings.reduce(
            (sum, building) => sum + (building.totalCost || 0), 0
        );
        
        let grandTotalEl = document.getElementById('grandTotalCost');
        if (!grandTotalEl) {
            // Create grand total display
            const totalSection = document.getElementById('totalProjectCost')?.parentElement;
            if (totalSection) {
                const grandTotalDiv = document.createElement('div');
                grandTotalDiv.style.cssText = `
                    margin-top: 1rem;
                    padding-top: 1rem;
                    border-top: 2px solid var(--primary-orange);
                    font-size: 1.2rem;
                    font-weight: bold;
                    color: var(--primary-orange);
                `;
                grandTotalDiv.innerHTML = `
                    All Buildings Total: <span id="grandTotalCost">$0.00</span>
                `;
                totalSection.appendChild(grandTotalDiv);
                grandTotalEl = document.getElementById('grandTotalCost');
            }
        }
        
        if (grandTotalEl) {
            grandTotalEl.textContent = `$${grandTotal.toFixed(2)}`;
        }
    }
    
    // Setup building controls
    function setupBuildingControls() {
        // Add material row button
        const addMaterialBtn = document.getElementById('addMaterialBtn');
        if (addMaterialBtn && !addMaterialBtn.dataset.initialized) {
            addMaterialBtn.dataset.initialized = 'true';
            addMaterialBtn.onclick = () => addMaterialRow();
        }
        
        // Auto-save on changes
        document.querySelectorAll('#estimatorForm input, #estimatorForm select').forEach(input => {
            input.addEventListener('change', () => {
                saveCurrentBuildingData();
                updateEstimateTotals();
            });
        });
    }
    
    // Setup project integration
    function setupProjectIntegration() {
        const projectSelect = document.getElementById('estimateClientSelect');
        if (projectSelect) {
            projectSelect.onchange = async function() {
                const projectId = this.value;
                if (projectId && window.loadProjectDrawings) {
                    // Load project drawings and takeoffs
                    await window.loadProjectDrawings(projectId);
                    await window.loadSavedTakeoffs(projectId);
                    
                    // Enable import button if takeoffs available
                    const importBtn = document.querySelector('.import-takeoff-btn');
                    if (importBtn) {
                        importBtn.disabled = !window.takeoffState?.savedTakeoffs?.length;
                    }
                }
            };
        }
    }
    
    // Save estimator state
    function saveEstimatorState() {
        try {
            localStorage.setItem('estimatorState', JSON.stringify(window.estimatorState));
        } catch (e) {
            console.error('Failed to save estimator state:', e);
        }
    }
    
    // Load estimator state
    function loadEstimatorState() {
        try {
            const saved = localStorage.getItem('estimatorState');
            if (saved) {
                window.estimatorState = JSON.parse(saved);
                
                // Validate state
                if (!window.estimatorState.buildings || window.estimatorState.buildings.length === 0) {
                    window.estimatorState.buildings = [{
                        id: 'building-1',
                        name: 'Building 1',
                        materials: {},
                        laborHours: 0,
                        totalCost: 0,
                        takeoffData: null
                    }];
                    window.estimatorState.currentBuilding = 'building-1';
                }
            }
        } catch (e) {
            console.error('Failed to load estimator state:', e);
        }
    }
    
    // Initialize when DOM is ready - only on estimator page
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (document.getElementById('estimatorForm') || document.querySelector('.estimator-tool')) {
                loadEstimatorState();
                initialize();
            }
        });
    } else {
        if (document.getElementById('estimatorForm') || document.querySelector('.estimator-tool')) {
            loadEstimatorState();
            initialize();
        }
    }
    
    // Export functions
    window.addBuilding = addBuilding;
    window.removeBuilding = removeBuilding;
    window.activateBuilding = activateBuilding;
    window.importFromTakeoff = importFromTakeoff;
    window.updateEstimateTotals = updateEstimateTotals;
    window.addMaterialRow = addMaterialRow;
    
})();

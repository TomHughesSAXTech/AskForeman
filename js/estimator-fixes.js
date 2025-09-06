// Estimator Fixes and Integration Script
// This script fixes all issues in the estimator page and integrates the enhanced takeoff tool

(function() {
    'use strict';
    
    // Fix 1: Remove PDF export and fix Excel export
    function fixExportButtons() {
        // Remove PDF export button if it exists
        const pdfExportBtn = document.querySelector('button[onclick*="exportToPDF"]');
        if (pdfExportBtn) {
            pdfExportBtn.remove();
        }
        
        // Also check for any other PDF export buttons
        document.querySelectorAll('button').forEach(btn => {
            if (btn.textContent.includes('PDF') || btn.onclick?.toString().includes('exportToPDF')) {
                btn.remove();
            }
        })
        
        // Fix Excel export function
        window.exportToExcel = function() {
            const estimate = window.currentEstimate || {};
            const project = estimate.project || {};
            const sections = estimate.sections || [];
            
            // Create workbook
            const wb = XLSX.utils.book_new();
            
            // Create summary sheet
            const summaryData = [
                ['ASK Foreman Cost Estimate'],
                [''],
                ['Project Information'],
                ['Project Name:', project.name || ''],
                ['Address:', project.address || ''],
                ['Client:', project.client || ''],
                ['Date:', new Date().toLocaleDateString()],
                [''],
                ['Cost Summary'],
                ['Subtotal:', formatCurrency(estimate.subtotal || 0)],
                ['Tax:', formatCurrency(estimate.tax || 0)],
                ['Total:', formatCurrency(estimate.total || 0)]
            ];
            
            const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
            
            // Create detailed estimate sheet
            const detailData = [['Section', 'Item', 'Quantity', 'Unit', 'Unit Cost', 'Total Cost']];
            
            sections.forEach(section => {
                // Add section header
                detailData.push([section.name, '', '', '', '', formatCurrency(section.total || 0)]);
                
                // Add line items
                if (section.items && section.items.length > 0) {
                    section.items.forEach(item => {
                        detailData.push([
                            '',
                            item.description,
                            item.quantity,
                            item.unit,
                            formatCurrency(item.unitCost),
                            formatCurrency(item.totalCost)
                        ]);
                    });
                }
            });
            
            // Add totals
            detailData.push(['', '', '', '', '', '']);
            detailData.push(['', '', '', '', 'Subtotal:', formatCurrency(estimate.subtotal || 0)]);
            detailData.push(['', '', '', '', 'Tax:', formatCurrency(estimate.tax || 0)]);
            detailData.push(['', '', '', '', 'Total:', formatCurrency(estimate.total || 0)]);
            
            const detailSheet = XLSX.utils.aoa_to_sheet(detailData);
            XLSX.utils.book_append_sheet(wb, detailSheet, 'Detailed Estimate');
            
            // Save the file
            const fileName = `Estimate_${project.name || 'Unnamed'}_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
            
            // Show success message
            addSystemMessage('✅ Estimate exported to Excel successfully');
        };
    }
    
    // Fix 2: Add support for multiple buildings
    function enableMultipleBuildings() {
        window.buildings = window.buildings || [];
        window.currentBuildingIndex = 0;
        
        // Add building selector UI
        const buildingControls = document.createElement('div');
        buildingControls.id = 'buildingControls';
        buildingControls.style.cssText = `
            padding: 1rem;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 1rem;
        `;
        
        buildingControls.innerHTML = `
            <label style="color: var(--foreman-orange); font-weight: bold;">Building:</label>
            <select id="buildingSelector" style="padding: 0.5rem; border-radius: 4px; flex: 1;">
                <option value="0">Building 1</option>
            </select>
            <button onclick="addNewBuilding()" style="padding: 0.5rem 1rem; background: var(--foreman-orange); color: white; border: none; border-radius: 4px; cursor: pointer;">
                <i class="fas fa-plus"></i> Add Building
            </button>
            <button onclick="duplicateBuilding()" style="padding: 0.5rem 1rem; background: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                <i class="fas fa-copy"></i> Duplicate
            </button>
            <button onclick="removeBuilding()" style="padding: 0.5rem 1rem; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">
                <i class="fas fa-trash"></i> Remove
            </button>
        `;
        
        // Insert building controls into the estimate form
        // Try multiple possible locations
        let insertLocation = document.querySelector('.estimate-form') || 
                           document.querySelector('.estimate-body') || 
                           document.querySelector('#projectInfo');
        
        if (insertLocation && !document.getElementById('buildingControls')) {
            // If it's the project info section, insert after it
            if (insertLocation.id === 'projectInfo') {
                insertLocation.parentNode.insertBefore(buildingControls, insertLocation.nextSibling);
            } else {
                insertLocation.insertBefore(buildingControls, insertLocation.firstChild);
            }
        }
        
        // Building management functions
        window.addNewBuilding = function() {
            const buildingNumber = window.buildings.length + 1;
            const newBuilding = {
                id: Date.now(),
                name: `Building ${buildingNumber}`,
                sections: [],
                subtotal: 0,
                tax: 0,
                total: 0
            };
            
            window.buildings.push(newBuilding);
            updateBuildingSelector();
            selectBuilding(window.buildings.length - 1);
            
            addSystemMessage(`✅ Added ${newBuilding.name}`);
        };
        
        window.duplicateBuilding = function() {
            if (window.buildings.length === 0) {
                addSystemMessage('⚠️ No building to duplicate');
                return;
            }
            
            const currentBuilding = window.buildings[window.currentBuildingIndex];
            const duplicatedBuilding = JSON.parse(JSON.stringify(currentBuilding));
            duplicatedBuilding.id = Date.now();
            duplicatedBuilding.name = `${currentBuilding.name} (Copy)`;
            
            window.buildings.push(duplicatedBuilding);
            updateBuildingSelector();
            selectBuilding(window.buildings.length - 1);
            
            addSystemMessage(`✅ Duplicated ${currentBuilding.name}`);
        };
        
        window.removeBuilding = function() {
            if (window.buildings.length <= 1) {
                addSystemMessage('⚠️ Cannot remove the last building');
                return;
            }
            
            const buildingName = window.buildings[window.currentBuildingIndex].name;
            
            if (confirm(`Are you sure you want to remove ${buildingName}?`)) {
                window.buildings.splice(window.currentBuildingIndex, 1);
                
                if (window.currentBuildingIndex >= window.buildings.length) {
                    window.currentBuildingIndex = window.buildings.length - 1;
                }
                
                updateBuildingSelector();
                selectBuilding(window.currentBuildingIndex);
                
                addSystemMessage(`✅ Removed ${buildingName}`);
            }
        };
        
        window.selectBuilding = function(index) {
            window.currentBuildingIndex = index;
            
            // Save current building data before switching
            if (window.currentEstimate) {
                window.buildings[window.currentBuildingIndex] = window.currentEstimate;
            }
            
            // Load selected building data
            if (window.buildings[index]) {
                window.currentEstimate = window.buildings[index];
                // Trigger UI update
                if (window.updateEstimateDisplay) {
                    window.updateEstimateDisplay();
                }
            }
        };
        
        window.updateBuildingSelector = function() {
            const selector = document.getElementById('buildingSelector');
            if (!selector) return;
            
            selector.innerHTML = '';
            window.buildings.forEach((building, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = building.name;
                selector.appendChild(option);
            });
            
            selector.value = window.currentBuildingIndex;
        };
        
        // Initialize with one building if none exist
        if (window.buildings.length === 0) {
            window.addNewBuilding();
        }
        
        // Add building selector change handler
        const selector = document.getElementById('buildingSelector');
        if (selector) {
            selector.addEventListener('change', (e) => {
                selectBuilding(parseInt(e.target.value));
            });
        }
    }
    
    // Fix 3: Fix takeoff modal z-index issue
    function fixTakeoffModalZIndex() {
        // Ensure takeoff modal opens on top
        const originalOpenTakeoff = window.openTakeoffTool;
        window.openTakeoffTool = function() {
            // Call original function if it exists
            if (originalOpenTakeoff) {
                originalOpenTakeoff();
            }
            
            // Set proper z-index to ensure it's on top
            const takeoffModal = document.getElementById('takeoffModal');
            if (takeoffModal) {
                takeoffModal.style.zIndex = '10001';
                takeoffModal.classList.add('active');
                
                // Hide other modals
                document.querySelectorAll('.modal').forEach(modal => {
                    if (modal.id !== 'takeoffModal') {
                        modal.style.zIndex = '9999';
                    }
                });
            }
            
            // Initialize enhanced takeoff tool if not already done
            if (!window.takeoffTool) {
                window.takeoffTool = new EnhancedTakeoffTool({ mode: 'edit' });
                window.takeoffTool.initialize();
            }
        };
        
        // Update create takeoff button
        const createTakeoffBtn = document.querySelector('[onclick*="openTakeoffTool"]');
        if (createTakeoffBtn) {
            createTakeoffBtn.onclick = function() {
                window.openTakeoffTool();
            };
        }
    }
    
    // Fix 4: Add "Save Changes to Project" button
    function addSaveChangesButton() {
        const takeoffFooter = document.querySelector('.takeoff-footer');
        if (takeoffFooter) {
            // Add save button if it doesn't exist
            if (!document.getElementById('saveTakeoffChanges')) {
                const saveButton = document.createElement('button');
                saveButton.id = 'saveTakeoffChanges';
                saveButton.className = 'action-btn primary';
                saveButton.innerHTML = '<i class="fas fa-save"></i> Save Changes to Project';
                saveButton.style.cssText = 'background: #4caf50; margin-right: 0.5rem;';
                
                saveButton.onclick = async function() {
                    if (window.takeoffTool) {
                        await window.takeoffTool.saveToProject();
                        addSystemMessage('✅ Takeoff data saved to project');
                    }
                };
                
                // Insert before the "Send to Estimator" button
                const sendBtn = takeoffFooter.querySelector('[onclick*="sendToEstimator"]');
                if (sendBtn) {
                    takeoffFooter.insertBefore(saveButton, sendBtn);
                }
            }
        }
    }
    
    // Fix 5: Update reset button functionality
    function fixResetButton() {
        window.resetTakeoffTool = function() {
            if (confirm('Are you sure you want to reset all measurements and annotations?')) {
                if (window.takeoffTool) {
                    // Clear all measurements
                    window.takeoffTool.measurements = [];
                    window.takeoffTool.annotations = [];
                    window.takeoffTool.selectedMeasurement = null;
                    window.takeoffTool.polygonPoints = [];
                    
                    // Reset zoom and pan
                    window.takeoffTool.zoomLevel = 1;
                    window.takeoffTool.panOffset = { x: 0, y: 0 };
                    
                    // Redraw canvas
                    window.takeoffTool.redrawAnnotations();
                    window.takeoffTool.updateMeasurementsList();
                    window.takeoffTool.applyTransform();
                    
                    addSystemMessage('✅ Takeoff tool reset');
                }
            }
        };
    }
    
    // Helper function to format currency
    function formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    }
    
    // Helper function to add system messages
    function addSystemMessage(message) {
        // Check if there's a message container
        let messageContainer = document.getElementById('systemMessages');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'systemMessages';
            messageContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10002;
                max-width: 300px;
            `;
            document.body.appendChild(messageContainer);
        }
        
        const messageEl = document.createElement('div');
        messageEl.style.cssText = `
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 0.5rem;
            animation: slideIn 0.3s ease;
        `;
        messageEl.textContent = message;
        
        messageContainer.appendChild(messageEl);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            messageEl.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => messageEl.remove(), 300);
        }, 3000);
    }
    
    // Add animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        /* Ensure proper z-index hierarchy */
        #takeoffModal.active {
            z-index: 10001 !important;
        }
        
        #estimateModal.active {
            z-index: 10000 !important;
        }
        
        .modal {
            z-index: 9999;
        }
    `;
    document.head.appendChild(style);
    
    // Initialize all fixes when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeFixes);
    } else {
        initializeFixes();
    }
    
    function initializeFixes() {
        fixExportButtons();
        enableMultipleBuildings();
        fixTakeoffModalZIndex();
        addSaveChangesButton();
        fixResetButton();
        
        // Make addSystemMessage globally available
        window.addSystemMessage = addSystemMessage;
        
        console.log('✅ Estimator fixes applied successfully');
    }
    
})();

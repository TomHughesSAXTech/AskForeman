// PDF Layer Handler - Full support for Optional Content Groups (OCGs)
// Essential for construction blueprints with multiple layers

(function() {
    'use strict';
    
    // Global PDF state
    window.pdfLayerState = {
        currentPDF: null,
        currentPage: null,
        layers: [],
        visibleLayers: new Set(),
        scale: 1.5,
        rotation: 0
    };
    
    // Enhanced PDF loading with layer support
    window.loadPDFWithLayers = async function(url, canvasId = 'pdfCanvas') {
        try {
            const canvas = document.getElementById(canvasId);
            if (!canvas) {
                console.error('Canvas not found:', canvasId);
                return;
            }
            
            // Configure PDF.js for better layer support
            if (typeof pdfjsLib !== 'undefined') {
                // Enable all optional content
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                
                // Load the PDF with advanced options
                const loadingTask = pdfjsLib.getDocument({
                    url: url,
                    enableXfa: true,
                    useSystemFonts: true,
                    disableAutoFetch: false,
                    disableStream: false,
                    isEvalSupported: true
                });
                
                const pdf = await loadingTask.promise;
                window.pdfLayerState.currentPDF = pdf;
                
                // Get optional content config (layers)
                const optionalContentConfig = await pdf.getOptionalContentConfig();
                
                // Extract all layers/groups
                window.pdfLayerState.layers = [];
                if (optionalContentConfig) {
                    const groups = optionalContentConfig.getGroups();
                    if (groups) {
                        for (let [id, group] of groups) {
                            const layerInfo = {
                                id: id,
                                name: group.name || `Layer ${id}`,
                                visible: group.visible !== false,
                                type: group.type || 'unknown',
                                intent: group.intent || 'View'
                            };
                            
                            window.pdfLayerState.layers.push(layerInfo);
                            
                            // Track visible layers
                            if (layerInfo.visible) {
                                window.pdfLayerState.visibleLayers.add(id);
                            }
                        }
                    }
                }
                
                // Create layer controls
                createLayerControls();
                
                // Render first page with layers
                await renderPDFPage(1);
                
                // Store layer information for AI analysis
                window.pdfLayerMetadata = {
                    totalLayers: window.pdfLayerState.layers.length,
                    layerNames: window.pdfLayerState.layers.map(l => l.name),
                    documentInfo: await pdf.getMetadata()
                };
                
                // Notify success
                if (window.addSystemMessage) {
                    window.addSystemMessage(`✅ PDF loaded with ${window.pdfLayerState.layers.length} layers`, 'success');
                }
                
                return pdf;
                
            } else {
                throw new Error('PDF.js library not loaded');
            }
            
        } catch (error) {
            console.error('Error loading PDF with layers:', error);
            
            // Fallback to standard loading if layer extraction fails
            if (error.message.includes('Optional content')) {
                return await fallbackPDFLoad(url, canvasId);
            }
            
            if (window.addSystemMessage) {
                window.addSystemMessage('❌ Failed to load PDF layers', 'error');
            }
        }
    };
    
    // Render PDF page with layer visibility
    async function renderPDFPage(pageNum) {
        if (!window.pdfLayerState.currentPDF) return;
        
        try {
            const pdf = window.pdfLayerState.currentPDF;
            const page = await pdf.getPage(pageNum);
            window.pdfLayerState.currentPage = page;
            
            const canvas = document.getElementById('pdfCanvas') || document.getElementById('viewPdfCanvas');
            const ctx = canvas.getContext('2d', {
                alpha: true,
                willReadFrequently: true
            });
            
            // Calculate viewport
            const viewport = page.getViewport({ 
                scale: window.pdfLayerState.scale,
                rotation: window.pdfLayerState.rotation
            });
            
            // Set canvas dimensions
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            // Also update annotation canvas if exists
            const annotationCanvas = document.getElementById('annotationCanvas') || document.getElementById('viewAnnotationCanvas');
            if (annotationCanvas) {
                annotationCanvas.width = viewport.width;
                annotationCanvas.height = viewport.height;
            }
            
            // Create custom optional content config with visible layers
            const optionalContentConfig = window.pdfLayerState.layers.length > 0 ? {
                getGroup: (id) => {
                    const layer = window.pdfLayerState.layers.find(l => l.id === id);
                    return layer || null;
                },
                isVisible: (group) => {
                    if (typeof group === 'string') {
                        return window.pdfLayerState.visibleLayers.has(group);
                    }
                    return group ? window.pdfLayerState.visibleLayers.has(group.id) : true;
                }
            } : null;
            
            // Render with layer visibility
            const renderContext = {
                canvasContext: ctx,
                viewport: viewport,
                optionalContentConfigPromise: optionalContentConfig ? 
                    Promise.resolve(optionalContentConfig) : 
                    pdf.getOptionalContentConfig(),
                annotationMode: pdfjsLib.AnnotationMode.ENABLE,
                renderForms: true,
                renderTextLayer: false,
                renderAnnotationLayer: true
            };
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Render the page
            await page.render(renderContext).promise;
            
            // Extract text for each visible layer if needed
            if (window.pdfLayerState.layers.length > 0) {
                await extractLayerText(page);
            }
            
        } catch (error) {
            console.error('Error rendering PDF page:', error);
        }
    }
    
    // Fallback PDF loading without layer support
    async function fallbackPDFLoad(url, canvasId) {
        try {
            const canvas = document.getElementById(canvasId);
            const ctx = canvas.getContext('2d');
            
            // Load with basic settings
            const loadingTask = pdfjsLib.getDocument(url);
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            
            const viewport = page.getViewport({ scale: 1.5 });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            await page.render({
                canvasContext: ctx,
                viewport: viewport
            }).promise;
            
            if (window.addSystemMessage) {
                window.addSystemMessage('⚠️ PDF loaded without layer support', 'warning');
            }
            
            return pdf;
            
        } catch (error) {
            console.error('Fallback PDF load failed:', error);
            throw error;
        }
    }
    
    // Create layer control panel
    function createLayerControls() {
        // Remove existing controls
        const existingPanel = document.getElementById('layerControlPanel');
        if (existingPanel) {
            existingPanel.remove();
        }
        
        // Don't create if no layers
        if (window.pdfLayerState.layers.length === 0) return;
        
        // Create panel
        const panel = document.createElement('div');
        panel.id = 'layerControlPanel';
        panel.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(30, 30, 30, 0.95);
            border: 1px solid var(--primary-orange);
            border-radius: 8px;
            padding: 1rem;
            max-height: 400px;
            overflow-y: auto;
            z-index: 1000;
            min-width: 250px;
        `;
        
        // Add title
        const title = document.createElement('h4');
        title.textContent = '📐 Drawing Layers';
        title.style.cssText = 'color: var(--primary-orange); margin: 0 0 0.5rem 0;';
        panel.appendChild(title);
        
        // Add layer toggles
        window.pdfLayerState.layers.forEach(layer => {
            const layerDiv = document.createElement('div');
            layerDiv.style.cssText = 'margin: 0.5rem 0; display: flex; align-items: center;';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `layer-${layer.id}`;
            checkbox.checked = layer.visible;
            checkbox.style.cssText = 'margin-right: 0.5rem;';
            
            checkbox.onchange = async function() {
                if (this.checked) {
                    window.pdfLayerState.visibleLayers.add(layer.id);
                } else {
                    window.pdfLayerState.visibleLayers.delete(layer.id);
                }
                layer.visible = this.checked;
                
                // Re-render with updated layers
                await renderPDFPage(window.pdfLayerState.currentPage?.pageNumber || 1);
            };
            
            const label = document.createElement('label');
            label.htmlFor = `layer-${layer.id}`;
            label.textContent = layer.name;
            label.style.cssText = 'color: white; cursor: pointer; flex: 1;';
            
            // Add layer type indicator
            const typeIndicator = document.createElement('span');
            typeIndicator.style.cssText = 'margin-left: 0.5rem; font-size: 0.8rem; color: #888;';
            
            // Identify layer type from name
            const layerType = identifyLayerType(layer.name);
            typeIndicator.textContent = layerType.icon;
            typeIndicator.title = layerType.description;
            
            layerDiv.appendChild(checkbox);
            layerDiv.appendChild(label);
            layerDiv.appendChild(typeIndicator);
            
            panel.appendChild(layerDiv);
        });
        
        // Add control buttons
        const buttonDiv = document.createElement('div');
        buttonDiv.style.cssText = 'margin-top: 1rem; display: flex; gap: 0.5rem;';
        
        const showAllBtn = document.createElement('button');
        showAllBtn.textContent = 'Show All';
        showAllBtn.style.cssText = 'flex: 1; padding: 0.25rem; background: var(--primary-green); color: white; border: none; border-radius: 4px; cursor: pointer;';
        showAllBtn.onclick = () => toggleAllLayers(true);
        
        const hideAllBtn = document.createElement('button');
        hideAllBtn.textContent = 'Hide All';
        hideAllBtn.style.cssText = 'flex: 1; padding: 0.25rem; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer;';
        hideAllBtn.onclick = () => toggleAllLayers(false);
        
        buttonDiv.appendChild(showAllBtn);
        buttonDiv.appendChild(hideAllBtn);
        panel.appendChild(buttonDiv);
        
        // Add collapse button
        const collapseBtn = document.createElement('button');
        collapseBtn.textContent = '−';
        collapseBtn.style.cssText = 'position: absolute; top: 10px; right: 10px; background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer;';
        collapseBtn.onclick = function() {
            const content = panel.querySelectorAll('div');
            const isCollapsed = panel.style.height === '40px';
            
            if (isCollapsed) {
                panel.style.height = 'auto';
                content.forEach(div => div.style.display = 'flex');
                this.textContent = '−';
            } else {
                panel.style.height = '40px';
                content.forEach(div => div.style.display = 'none');
                this.textContent = '+';
            }
        };
        panel.appendChild(collapseBtn);
        
        // Add to canvas container
        const canvasWrapper = document.getElementById('pdfCanvasWrapper') || 
                            document.getElementById('viewCanvasWrapper') ||
                            document.querySelector('.canvas-container');
        
        if (canvasWrapper) {
            canvasWrapper.style.position = 'relative';
            canvasWrapper.appendChild(panel);
        }
    }
    
    // Identify layer type from name
    function identifyLayerType(name) {
        const lowerName = name.toLowerCase();
        
        if (lowerName.includes('electric') || lowerName.includes('power')) {
            return { icon: '⚡', description: 'Electrical' };
        } else if (lowerName.includes('plumb') || lowerName.includes('water') || lowerName.includes('pipe')) {
            return { icon: '🚰', description: 'Plumbing' };
        } else if (lowerName.includes('hvac') || lowerName.includes('mechanical') || lowerName.includes('duct')) {
            return { icon: '🌡️', description: 'HVAC/Mechanical' };
        } else if (lowerName.includes('struct') || lowerName.includes('frame') || lowerName.includes('foundation')) {
            return { icon: '🏗️', description: 'Structural' };
        } else if (lowerName.includes('architect') || lowerName.includes('floor') || lowerName.includes('plan')) {
            return { icon: '📐', description: 'Architectural' };
        } else if (lowerName.includes('dimension') || lowerName.includes('measure')) {
            return { icon: '📏', description: 'Dimensions' };
        } else if (lowerName.includes('text') || lowerName.includes('note') || lowerName.includes('annotation')) {
            return { icon: '📝', description: 'Annotations' };
        } else if (lowerName.includes('grid') || lowerName.includes('axis')) {
            return { icon: '⊞', description: 'Grid/Axis' };
        } else if (lowerName.includes('site') || lowerName.includes('landscape')) {
            return { icon: '🌳', description: 'Site/Landscape' };
        } else if (lowerName.includes('roof')) {
            return { icon: '🏠', description: 'Roofing' };
        } else {
            return { icon: '📄', description: 'General' };
        }
    }
    
    // Toggle all layers
    async function toggleAllLayers(visible) {
        window.pdfLayerState.layers.forEach(layer => {
            layer.visible = visible;
            const checkbox = document.getElementById(`layer-${layer.id}`);
            if (checkbox) checkbox.checked = visible;
            
            if (visible) {
                window.pdfLayerState.visibleLayers.add(layer.id);
            } else {
                window.pdfLayerState.visibleLayers.delete(layer.id);
            }
        });
        
        // Re-render
        await renderPDFPage(window.pdfLayerState.currentPage?.pageNumber || 1);
    }
    
    // Extract text content from visible layers
    async function extractLayerText(page) {
        try {
            const textContent = await page.getTextContent();
            const layerText = {};
            
            textContent.items.forEach(item => {
                // Group text by approximate layer/position
                const key = `${Math.round(item.transform[5] / 10)}`;
                if (!layerText[key]) {
                    layerText[key] = [];
                }
                layerText[key].push(item.str);
            });
            
            // Store for AI analysis
            window.pdfLayerText = layerText;
            
        } catch (error) {
            console.error('Error extracting layer text:', error);
        }
    }
    
    // Get layer information for AI analysis
    window.getLayerInfoForAI = function() {
        return {
            layers: window.pdfLayerState.layers.map(l => ({
                name: l.name,
                visible: l.visible,
                type: identifyLayerType(l.name).description
            })),
            visibleLayers: Array.from(window.pdfLayerState.visibleLayers),
            metadata: window.pdfLayerMetadata,
            extractedText: window.pdfLayerText
        };
    };
    
    // Export visible layers as image
    window.exportVisibleLayers = function() {
        const canvas = document.getElementById('pdfCanvas') || document.getElementById('viewPdfCanvas');
        if (canvas) {
            canvas.toBlob(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `layers-export-${Date.now()}.png`;
                a.click();
                URL.revokeObjectURL(url);
            });
        }
    };
    
    // Initialize PDF.js with better configuration
    function initializePDFJS() {
        if (typeof pdfjsLib !== 'undefined') {
            // Set worker
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            
            // Configure for better performance
            pdfjsLib.disableWorker = false;
            pdfjsLib.disableRange = false;
            pdfjsLib.disableStream = false;
            pdfjsLib.disableAutoFetch = false;
            
            // Override the existing PDF loading if present
            if (window.loadDrawingToCanvas) {
                const originalLoad = window.loadDrawingToCanvas;
                window.loadDrawingToCanvas = async function(drawing) {
                    if (drawing && drawing.type === 'pdf') {
                        return await window.loadPDFWithLayers(drawing.url);
                    } else {
                        return await originalLoad(drawing);
                    }
                };
            }
        }
    }
    
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePDFJS);
    } else {
        initializePDFJS();
    }
    
    // Export functions
    window.renderPDFPage = renderPDFPage;
    window.toggleAllLayers = toggleAllLayers;
    
})();

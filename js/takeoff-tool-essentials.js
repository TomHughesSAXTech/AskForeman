// Essential Takeoff Tool Functions - Minimal restoration
(function() {
    'use strict';
    
    // Only initialize on pages with takeoff tool
    if (!document.getElementById('takeoffTool') && !document.getElementById('pdfCanvas')) {
        return;
    }
    
    // Essential tool state
    window.takeoffTools = window.takeoffTools || {
        currentTool: 'pan',
        isDrawing: false,
        measurements: [],
        scale: 1,
        currentDrawing: null
    };
    
    // Initialize canvas and tools
    function initializeCanvas() {
        const canvas = document.getElementById('pdfCanvas') || document.getElementById('viewPdfCanvas');
        const annotationCanvas = document.getElementById('annotationCanvas') || document.getElementById('viewAnnotationCanvas');
        
        if (!canvas || !annotationCanvas) return;
        
        // Setup canvas events
        annotationCanvas.addEventListener('mousedown', handleMouseDown);
        annotationCanvas.addEventListener('mousemove', handleMouseMove);
        annotationCanvas.addEventListener('mouseup', handleMouseUp);
        
        // Setup tool buttons
        document.querySelectorAll('[data-tool]').forEach(btn => {
            btn.addEventListener('click', function() {
                const tool = this.dataset.tool;
                window.takeoffTools.currentTool = tool;
                
                // Update active state
                document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                // Update cursor
                updateCursor(tool);
            });
        });
    }
    
    // Mouse event handlers
    function handleMouseDown(e) {
        if (window.takeoffTools.currentTool === 'pan') return;
        
        window.takeoffTools.isDrawing = true;
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        window.takeoffTools.startPoint = { x, y };
        window.takeoffTools.currentPoints = [{ x, y }];
    }
    
    function handleMouseMove(e) {
        if (!window.takeoffTools.isDrawing) return;
        
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const ctx = e.target.getContext('2d');
        
        // Clear and redraw
        ctx.clearRect(0, 0, e.target.width, e.target.height);
        redrawMeasurements(ctx);
        
        // Draw current shape
        ctx.strokeStyle = '#ff6b35';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        switch(window.takeoffTools.currentTool) {
            case 'line':
                ctx.moveTo(window.takeoffTools.startPoint.x, window.takeoffTools.startPoint.y);
                ctx.lineTo(x, y);
                break;
            case 'area':
                const width = x - window.takeoffTools.startPoint.x;
                const height = y - window.takeoffTools.startPoint.y;
                ctx.rect(window.takeoffTools.startPoint.x, window.takeoffTools.startPoint.y, width, height);
                break;
            case 'polygon':
                window.takeoffTools.currentPoints.push({ x, y });
                ctx.moveTo(window.takeoffTools.currentPoints[0].x, window.takeoffTools.currentPoints[0].y);
                for (let i = 1; i < window.takeoffTools.currentPoints.length; i++) {
                    ctx.lineTo(window.takeoffTools.currentPoints[i].x, window.takeoffTools.currentPoints[i].y);
                }
                break;
        }
        
        ctx.stroke();
    }
    
    function handleMouseUp(e) {
        if (!window.takeoffTools.isDrawing) return;
        
        window.takeoffTools.isDrawing = false;
        
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Create measurement
        let measurement = {
            type: window.takeoffTools.currentTool,
            startPoint: window.takeoffTools.startPoint,
            endPoint: { x, y },
            value: 0,
            unit: 'ft'
        };
        
        // Calculate value based on tool
        switch(window.takeoffTools.currentTool) {
            case 'line':
                const distance = Math.sqrt(
                    Math.pow(x - window.takeoffTools.startPoint.x, 2) + 
                    Math.pow(y - window.takeoffTools.startPoint.y, 2)
                );
                measurement.value = (distance / window.takeoffTools.scale).toFixed(2);
                break;
            case 'area':
                const width = Math.abs(x - window.takeoffTools.startPoint.x);
                const height = Math.abs(y - window.takeoffTools.startPoint.y);
                measurement.value = ((width * height) / (window.takeoffTools.scale * window.takeoffTools.scale)).toFixed(2);
                measurement.unit = 'sq ft';
                break;
            case 'polygon':
                measurement.points = window.takeoffTools.currentPoints;
                measurement.value = calculatePolygonArea(window.takeoffTools.currentPoints);
                measurement.unit = 'sq ft';
                break;
        }
        
        // Add to measurements
        window.takeoffTools.measurements.push(measurement);
        
        // Update UI
        updateMeasurementsList();
        
        // Redraw all
        const ctx = e.target.getContext('2d');
        redrawMeasurements(ctx);
    }
    
    // Redraw all measurements
    function redrawMeasurements(ctx) {
        ctx.strokeStyle = '#4caf50';
        ctx.lineWidth = 2;
        
        window.takeoffTools.measurements.forEach(m => {
            ctx.beginPath();
            
            switch(m.type) {
                case 'line':
                    ctx.moveTo(m.startPoint.x, m.startPoint.y);
                    ctx.lineTo(m.endPoint.x, m.endPoint.y);
                    break;
                case 'area':
                    const width = m.endPoint.x - m.startPoint.x;
                    const height = m.endPoint.y - m.startPoint.y;
                    ctx.rect(m.startPoint.x, m.startPoint.y, width, height);
                    break;
                case 'polygon':
                    if (m.points && m.points.length > 0) {
                        ctx.moveTo(m.points[0].x, m.points[0].y);
                        for (let i = 1; i < m.points.length; i++) {
                            ctx.lineTo(m.points[i].x, m.points[i].y);
                        }
                        ctx.closePath();
                    }
                    break;
            }
            
            ctx.stroke();
            
            // Draw label
            ctx.fillStyle = '#4caf50';
            ctx.font = '14px Arial';
            const labelX = m.type === 'polygon' ? m.points[0].x : m.startPoint.x;
            const labelY = m.type === 'polygon' ? m.points[0].y - 10 : m.startPoint.y - 10;
            ctx.fillText(`${m.value} ${m.unit}`, labelX, labelY);
        });
    }
    
    // Calculate polygon area
    function calculatePolygonArea(points) {
        if (points.length < 3) return 0;
        
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        
        area = Math.abs(area / 2);
        return (area / (window.takeoffTools.scale * window.takeoffTools.scale)).toFixed(2);
    }
    
    // Update measurements list
    function updateMeasurementsList() {
        const list = document.getElementById('measurementsList') || document.getElementById('viewMeasurementsList');
        if (!list) return;
        
        list.innerHTML = '';
        
        window.takeoffTools.measurements.forEach((m, index) => {
            const item = document.createElement('div');
            item.className = 'measurement-item';
            item.style.cssText = 'padding: 8px; margin: 4px 0; background: rgba(255,255,255,0.1); border-radius: 4px;';
            
            let icon = '';
            switch(m.type) {
                case 'line': icon = '📏'; break;
                case 'area': icon = '⬜'; break;
                case 'polygon': icon = '⬟'; break;
                default: icon = '📊';
            }
            
            item.innerHTML = `
                <span style="margin-right: 8px;">${icon}</span>
                <span>${m.type}: ${m.value} ${m.unit}</span>
                <button onclick="window.removeMeasurement(${index})" style="float: right; background: #ff6b6b; color: white; border: none; padding: 2px 8px; border-radius: 4px; cursor: pointer;">×</button>
            `;
            
            list.appendChild(item);
        });
    }
    
    // Remove measurement
    window.removeMeasurement = function(index) {
        window.takeoffTools.measurements.splice(index, 1);
        updateMeasurementsList();
        
        const canvas = document.getElementById('annotationCanvas') || document.getElementById('viewAnnotationCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            redrawMeasurements(ctx);
        }
    };
    
    // Clear all measurements
    window.clearMeasurements = function() {
        window.takeoffTools.measurements = [];
        updateMeasurementsList();
        
        const canvas = document.getElementById('annotationCanvas') || document.getElementById('viewAnnotationCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };
    
    // Update cursor
    function updateCursor(tool) {
        const canvasWrapper = document.getElementById('pdfCanvasWrapper') || document.getElementById('viewCanvasWrapper');
        if (!canvasWrapper) return;
        
        switch(tool) {
            case 'pan':
                canvasWrapper.style.cursor = 'grab';
                break;
            case 'select':
                canvasWrapper.style.cursor = 'pointer';
                break;
            case 'line':
            case 'area':
            case 'polygon':
            case 'scale':
                canvasWrapper.style.cursor = 'crosshair';
                break;
            default:
                canvasWrapper.style.cursor = 'default';
        }
    }
    
    // Set scale
    window.setDrawingScale = function() {
        const scaleInput = prompt('Enter drawing scale (e.g., 100 for 1:100):', window.takeoffTools.scale);
        if (scaleInput && !isNaN(scaleInput)) {
            window.takeoffTools.scale = parseFloat(scaleInput);
            const scaleDisplay = document.getElementById('drawingScale');
            if (scaleDisplay) {
                scaleDisplay.textContent = `1:${window.takeoffTools.scale}`;
            }
        }
    };
    
    // Export measurements
    window.exportMeasurements = function() {
        const data = {
            projectId: window.takeoffState?.currentProject || 'unknown',
            drawingName: window.takeoffState?.currentDrawing?.name || 'unknown',
            scale: window.takeoffTools.scale,
            measurements: window.takeoffTools.measurements,
            timestamp: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `takeoff-measurements-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };
    
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeCanvas);
    } else {
        initializeCanvas();
    }
    
})();

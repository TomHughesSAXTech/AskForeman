/**
 * Enhanced Drawing Analyzer with Azure AI Integration
 * Uses Computer Vision and Document Intelligence for actual OCR and measurement extraction
 */

class DrawingAnalyzerAI {
    constructor(config) {
        this.config = config;
        this.currentAnalysis = null;
        this.extractedData = null;
    }

    /**
     * Analyze a drawing using Azure Computer Vision and Document Intelligence
     */
    async analyzeDrawing(fileData, fileName, parameters) {
        console.log('🤖 Starting AI drawing analysis for:', fileName);
        
        const analysis = {
            fileName: fileName,
            timestamp: new Date().toISOString(),
            parameters: parameters,
            results: {
                text: [],
                tables: [],
                measurements: {},
                symbols: [],
                rooms: [],
                dimensions: []
            }
        };

        try {
            // Step 1: Perform OCR with Computer Vision
            if (this.config.computerVision) {
                const ocrResults = await this.performOCR(fileData);
                analysis.results.text = ocrResults.text || [];
                analysis.results.boundingBoxes = ocrResults.boundingBoxes || [];
            }

            // Step 2: Extract layout with Document Intelligence
            if (this.config.documentIntelligence) {
                const layoutResults = await this.extractLayout(fileData);
                analysis.results.tables = layoutResults.tables || [];
                analysis.results.layout = layoutResults.layout || {};
            }

            // Step 3: Extract measurements from text
            analysis.results.measurements = this.extractMeasurements(analysis.results.text);

            // Step 4: Identify room information
            analysis.results.rooms = this.extractRoomInfo(analysis.results.text);

            // Step 5: Extract dimensions
            analysis.results.dimensions = this.extractDimensions(analysis.results.text);

            // Step 6: Calculate areas and quantities
            analysis.results.calculations = this.calculateQuantities(
                analysis.results.measurements,
                analysis.results.rooms,
                parameters
            );

            // Step 7: Generate takeoff summary
            analysis.summary = this.generateTakeoffSummary(analysis.results, parameters);

            this.currentAnalysis = analysis;
            return analysis;

        } catch (error) {
            console.error('Error analyzing drawing:', error);
            throw error;
        }
    }

    /**
     * Perform OCR using Azure Computer Vision
     */
    async performOCR(fileData) {
        const endpoint = this.config.computerVision.endpoint;
        const apiKey = this.config.computerVision.apiKey;
        const apiVersion = this.config.computerVision.apiVersion;

        // Convert file data to blob if needed
        let blob;
        if (fileData instanceof ArrayBuffer) {
            blob = new Blob([fileData], { type: 'application/octet-stream' });
        } else if (fileData instanceof Blob) {
            blob = fileData;
        } else {
            blob = new Blob([fileData], { type: 'application/octet-stream' });
        }

        const url = `${endpoint}vision/v${apiVersion}/read/analyze`;
        
        try {
            // Submit for analysis
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': apiKey,
                    'Content-Type': 'application/octet-stream'
                },
                body: blob
            });

            if (!response.ok) {
                throw new Error(`OCR failed: ${response.status} ${response.statusText}`);
            }

            // Get the operation location for results
            const operationLocation = response.headers.get('Operation-Location');
            if (!operationLocation) {
                throw new Error('No operation location returned');
            }

            // Poll for results
            const result = await this.pollForResults(operationLocation, apiKey);
            
            // Extract text and bounding boxes
            const extractedData = {
                text: [],
                boundingBoxes: [],
                lines: []
            };

            if (result.analyzeResult && result.analyzeResult.readResults) {
                result.analyzeResult.readResults.forEach(page => {
                    page.lines.forEach(line => {
                        extractedData.text.push(line.text);
                        extractedData.lines.push({
                            text: line.text,
                            boundingBox: line.boundingBox,
                            words: line.words
                        });
                    });
                });
            }

            return extractedData;

        } catch (error) {
            console.error('OCR Error:', error);
            // Return empty results on error
            return { text: [], boundingBoxes: [], lines: [] };
        }
    }

    /**
     * Poll for OCR results
     */
    async pollForResults(operationLocation, apiKey, maxAttempts = 10) {
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            
            const response = await fetch(operationLocation, {
                headers: {
                    'Ocp-Apim-Subscription-Key': apiKey
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to get results: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.status === 'succeeded') {
                return result;
            } else if (result.status === 'failed') {
                throw new Error('Analysis failed');
            }
            
            attempts++;
        }
        
        throw new Error('Timeout waiting for results');
    }

    /**
     * Extract layout using Document Intelligence
     */
    async extractLayout(fileData) {
        const endpoint = this.config.documentIntelligence.endpoint;
        const apiKey = this.config.documentIntelligence.apiKey;
        const apiVersion = this.config.documentIntelligence.apiVersion;

        // Convert file data to blob
        let blob;
        if (fileData instanceof ArrayBuffer) {
            blob = new Blob([fileData], { type: 'application/pdf' });
        } else {
            blob = fileData;
        }

        const url = `${endpoint}formrecognizer/documentModels/prebuilt-layout:analyze?api-version=${apiVersion}`;

        try {
            // Submit document for analysis
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Ocp-Apim-Subscription-Key': apiKey,
                    'Content-Type': 'application/octet-stream'
                },
                body: blob
            });

            if (!response.ok) {
                throw new Error(`Layout extraction failed: ${response.status}`);
            }

            // Get operation location
            const operationLocation = response.headers.get('Operation-Location');
            
            // Poll for results
            const result = await this.pollForLayoutResults(operationLocation, apiKey);
            
            // Extract tables and layout
            const layoutData = {
                tables: [],
                layout: {},
                keyValuePairs: []
            };

            if (result.analyzeResult) {
                // Extract tables
                if (result.analyzeResult.tables) {
                    layoutData.tables = result.analyzeResult.tables.map(table => ({
                        rowCount: table.rowCount,
                        columnCount: table.columnCount,
                        cells: table.cells,
                        boundingRegions: table.boundingRegions
                    }));
                }

                // Extract key-value pairs
                if (result.analyzeResult.keyValuePairs) {
                    layoutData.keyValuePairs = result.analyzeResult.keyValuePairs.map(kvp => ({
                        key: kvp.key?.content,
                        value: kvp.value?.content,
                        confidence: kvp.confidence
                    }));
                }

                // Extract layout structure
                layoutData.layout = {
                    pageCount: result.analyzeResult.pages?.length || 0,
                    paragraphs: result.analyzeResult.paragraphs || [],
                    sections: result.analyzeResult.sections || []
                };
            }

            return layoutData;

        } catch (error) {
            console.error('Layout extraction error:', error);
            return { tables: [], layout: {}, keyValuePairs: [] };
        }
    }

    /**
     * Poll for layout results
     */
    async pollForLayoutResults(operationLocation, apiKey, maxAttempts = 15) {
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            
            const response = await fetch(operationLocation, {
                headers: {
                    'Ocp-Apim-Subscription-Key': apiKey
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to get layout results: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.status === 'succeeded') {
                return result;
            } else if (result.status === 'failed') {
                throw new Error('Layout analysis failed');
            }
            
            attempts++;
        }
        
        throw new Error('Timeout waiting for layout results');
    }

    /**
     * Extract measurements from OCR text
     */
    extractMeasurements(textArray) {
        const measurements = {
            linear: [],
            area: [],
            dimensions: [],
            scales: []
        };

        // Patterns for different measurement types
        const patterns = {
            // Linear measurements: 10'-6", 10.5', 10ft, 10m, etc.
            linear: /(\d+(?:['-]\d+(?:[""])?)?|\d+\.\d+)\s*(?:feet|ft|'|meters?|m|mm|cm|inches?|in|")/gi,
            // Area measurements: 100 SF, 100 sq ft, 100m2, etc.
            area: /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:sq\.?\s*ft\.?|sf|square\s*feet|m2|sq\.?\s*m\.?|square\s*meters?)/gi,
            // Dimensions: 10x20, 10'x20', 10'-6" x 20'-0"
            dimensions: /(\d+(?:['-]\d+(?:[""])?)?|\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:['-]\d+(?:[""])?)?|\d+(?:\.\d+)?)/g,
            // Scale notations: 1/4" = 1', 1:100, etc.
            scale: /(\d+(?:\/\d+)?)\s*[":=]\s*(\d+)['-]?|1\s*:\s*(\d+)/gi
        };

        textArray.forEach(text => {
            // Extract linear measurements
            let match;
            while ((match = patterns.linear.exec(text)) !== null) {
                measurements.linear.push({
                    value: match[1],
                    unit: match[2] || 'ft',
                    text: match[0],
                    context: text
                });
            }

            // Extract area measurements
            patterns.area.lastIndex = 0;
            while ((match = patterns.area.exec(text)) !== null) {
                measurements.area.push({
                    value: parseFloat(match[1].replace(/,/g, '')),
                    unit: match[2],
                    text: match[0],
                    context: text
                });
            }

            // Extract dimensions
            patterns.dimensions.lastIndex = 0;
            while ((match = patterns.dimensions.exec(text)) !== null) {
                measurements.dimensions.push({
                    width: match[1],
                    height: match[2],
                    text: match[0],
                    context: text
                });
            }

            // Extract scales
            patterns.scale.lastIndex = 0;
            while ((match = patterns.scale.exec(text)) !== null) {
                measurements.scales.push({
                    scale: match[0],
                    ratio: match[3] || `${match[1]}:${match[2]}`,
                    context: text
                });
            }
        });

        return measurements;
    }

    /**
     * Extract room information from text
     */
    extractRoomInfo(textArray) {
        const rooms = [];
        const roomPatterns = [
            /(?:room|rm\.?)\s*#?\s*(\w+)/gi,
            /(?:office|conference|kitchen|bathroom|bedroom|living|dining|lobby|corridor|hallway)\s*(?:#?\s*\w+)?/gi,
            /\b([A-Z]-?\d{2,4}[A-Z]?)\b/g // Pattern for room codes like A-101, B201, etc.
        ];

        textArray.forEach(text => {
            roomPatterns.forEach(pattern => {
                let match;
                pattern.lastIndex = 0;
                while ((match = pattern.exec(text)) !== null) {
                    const roomName = match[0].trim();
                    
                    // Check if this room is already in the list
                    if (!rooms.find(r => r.name.toLowerCase() === roomName.toLowerCase())) {
                        rooms.push({
                            name: roomName,
                            number: match[1] || roomName,
                            context: text,
                            measurements: []
                        });
                    }
                }
            });
        });

        // Try to associate measurements with rooms
        rooms.forEach(room => {
            textArray.forEach(text => {
                if (text.toLowerCase().includes(room.name.toLowerCase())) {
                    // Look for measurements in the same text
                    const areaMatch = text.match(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:sq\.?\s*ft\.?|sf)/i);
                    if (areaMatch) {
                        room.area = parseFloat(areaMatch[1].replace(/,/g, ''));
                    }

                    const dimensionMatch = text.match(/(\d+(?:['-]\d+)?)\s*[xX×]\s*(\d+(?:['-]\d+)?)/);
                    if (dimensionMatch) {
                        room.dimensions = {
                            width: dimensionMatch[1],
                            length: dimensionMatch[2]
                        };
                    }
                }
            });
        });

        return rooms;
    }

    /**
     * Extract dimension lines and callouts
     */
    extractDimensions(textArray) {
        const dimensions = [];
        
        // Look for dimension callouts
        textArray.forEach(text => {
            // Pattern for typical dimension callouts
            const dimPattern = /(\d+)['-](\d+)(?:["])?/g;
            let match;
            
            while ((match = dimPattern.exec(text)) !== null) {
                const feet = parseInt(match[1]);
                const inches = parseInt(match[2]);
                const totalInches = (feet * 12) + inches;
                
                dimensions.push({
                    text: match[0],
                    feet: feet,
                    inches: inches,
                    totalInches: totalInches,
                    context: text
                });
            }
        });

        return dimensions;
    }

    /**
     * Calculate quantities based on extracted data
     */
    calculateQuantities(measurements, rooms, parameters) {
        const calculations = {
            totalWallLength: 0,
            totalFloorArea: 0,
            totalCeilingArea: 0,
            paintableArea: 0,
            doors: { count: 0, types: [] },
            windows: { count: 0, types: [] },
            materials: []
        };

        // Calculate wall lengths
        if (measurements.linear.length > 0) {
            measurements.linear.forEach(m => {
                const value = this.convertToFeet(m.value, m.unit);
                if (value > 0 && value < 1000) { // Sanity check
                    calculations.totalWallLength += value;
                }
            });
        }

        // Calculate floor/ceiling areas
        if (rooms.length > 0) {
            rooms.forEach(room => {
                if (room.area) {
                    calculations.totalFloorArea += room.area;
                    calculations.totalCeilingArea += room.area;
                } else if (room.dimensions) {
                    const width = this.convertToFeet(room.dimensions.width, 'ft');
                    const length = this.convertToFeet(room.dimensions.length, 'ft');
                    const area = width * length;
                    calculations.totalFloorArea += area;
                    calculations.totalCeilingArea += area;
                    room.area = area; // Store calculated area
                }
            });
        } else if (measurements.area.length > 0) {
            // Use area measurements if no room data
            measurements.area.forEach(m => {
                calculations.totalFloorArea += m.value;
                calculations.totalCeilingArea += m.value;
            });
        }

        // Calculate paintable wall area (assuming 10' ceiling height if not specified)
        const ceilingHeight = parameters.ceilingHeight || 10;
        calculations.paintableArea = calculations.totalWallLength * ceilingHeight;

        // Look for door/window counts in text
        const doorCount = this.countOccurrences(measurements, /door/i);
        const windowCount = this.countOccurrences(measurements, /window/i);
        
        calculations.doors.count = doorCount || parameters.doorCount || 0;
        calculations.windows.count = windowCount || parameters.windowCount || 0;

        // Deduct door/window areas from paintable area
        const avgDoorArea = 21; // 3' x 7' standard door
        const avgWindowArea = 20; // 4' x 5' standard window
        calculations.paintableArea -= (calculations.doors.count * avgDoorArea);
        calculations.paintableArea -= (calculations.windows.count * avgWindowArea);

        // Calculate material requirements
        if (parameters.wallFinish) {
            const paintCoverage = 350; // sq ft per gallon
            const coats = parseInt(parameters.coatsRequired) || 2;
            const paintGallons = Math.ceil((calculations.paintableArea * coats) / paintCoverage);
            
            calculations.materials.push({
                type: 'Paint - ' + parameters.wallFinish,
                quantity: paintGallons,
                unit: 'gallons',
                coverage: calculations.paintableArea,
                estimatedCost: paintGallons * 35
            });
        }

        if (parameters.floorFinish) {
            calculations.materials.push({
                type: 'Floor Finish - ' + parameters.floorFinish,
                quantity: calculations.totalFloorArea,
                unit: 'sq ft',
                estimatedCost: calculations.totalFloorArea * 2.5
            });
        }

        return calculations;
    }

    /**
     * Convert measurement to feet
     */
    convertToFeet(value, unit) {
        // Parse feet-inches notation
        if (typeof value === 'string' && value.includes("'")) {
            const parts = value.split(/['-]/);
            const feet = parseFloat(parts[0]) || 0;
            const inches = parseFloat(parts[1]) || 0;
            return feet + (inches / 12);
        }

        const numValue = parseFloat(value);
        if (isNaN(numValue)) return 0;

        // Convert based on unit
        switch (unit?.toLowerCase()) {
            case 'm':
            case 'meter':
            case 'meters':
                return numValue * 3.28084;
            case 'cm':
            case 'centimeter':
            case 'centimeters':
                return numValue * 0.0328084;
            case 'mm':
            case 'millimeter':
            case 'millimeters':
                return numValue * 0.00328084;
            case 'in':
            case 'inch':
            case 'inches':
            case '"':
                return numValue / 12;
            default:
                return numValue; // Assume feet
        }
    }

    /**
     * Count occurrences of a pattern
     */
    countOccurrences(measurements, pattern) {
        let count = 0;
        const allText = JSON.stringify(measurements);
        const matches = allText.match(new RegExp(pattern, 'gi'));
        return matches ? matches.length : 0;
    }

    /**
     * Generate takeoff summary
     */
    generateTakeoffSummary(results, parameters) {
        const summary = {
            timestamp: new Date().toISOString(),
            parameters: parameters,
            extractedText: {
                total: results.text.length,
                rooms: results.rooms.length,
                measurements: {
                    linear: results.measurements.linear.length,
                    area: results.measurements.area.length,
                    dimensions: results.measurements.dimensions.length
                }
            },
            calculations: results.calculations,
            confidence: this.calculateConfidence(results),
            recommendations: this.generateRecommendations(results, parameters)
        };

        return summary;
    }

    /**
     * Calculate confidence score
     */
    calculateConfidence(results) {
        let confidence = 0;
        let factors = 0;

        // Text extraction
        if (results.text.length > 0) {
            confidence += 25;
            factors++;
        }

        // Measurements found
        if (results.measurements.linear.length > 0 || results.measurements.area.length > 0) {
            confidence += 25;
            factors++;
        }

        // Rooms identified
        if (results.rooms.length > 0) {
            confidence += 25;
            factors++;
        }

        // Calculations completed
        if (results.calculations && results.calculations.totalFloorArea > 0) {
            confidence += 25;
            factors++;
        }

        return factors > 0 ? Math.round(confidence / factors) : 0;
    }

    /**
     * Generate recommendations based on analysis
     */
    generateRecommendations(results, parameters) {
        const recommendations = [];

        // Check for missing scale
        if (!results.measurements.scales || results.measurements.scales.length === 0) {
            recommendations.push({
                type: 'warning',
                message: 'No scale detected in drawing. Please verify measurements manually.',
                action: 'Specify drawing scale in parameters'
            });
        }

        // Check for low room count
        if (results.rooms.length === 0) {
            recommendations.push({
                type: 'info',
                message: 'No room labels detected. Consider manual room identification.',
                action: 'Review and label rooms manually'
            });
        }

        // Check measurement consistency
        if (results.measurements.linear.length > 0 && results.calculations.totalWallLength === 0) {
            recommendations.push({
                type: 'warning',
                message: 'Linear measurements found but wall length calculation failed.',
                action: 'Verify measurement extraction'
            });
        }

        // Material recommendations
        if (parameters.wallFinish && results.calculations.paintableArea > 0) {
            const sqFtPerDay = 1500; // Average painter productivity
            const daysRequired = Math.ceil(results.calculations.paintableArea / sqFtPerDay);
            recommendations.push({
                type: 'info',
                message: `Estimated ${daysRequired} labor days for painting based on ${results.calculations.paintableArea.toFixed(0)} sq ft of paintable area.`,
                action: 'Adjust based on crew size and complexity'
            });
        }

        return recommendations;
    }

    /**
     * Export results to structured format
     */
    exportResults(format = 'json') {
        if (!this.currentAnalysis) {
            throw new Error('No analysis results available');
        }

        if (format === 'json') {
            return JSON.stringify(this.currentAnalysis, null, 2);
        } else if (format === 'csv') {
            return this.convertToCSV(this.currentAnalysis);
        } else if (format === 'excel') {
            return this.prepareExcelData(this.currentAnalysis);
        }

        return this.currentAnalysis;
    }

    /**
     * Convert analysis to CSV format
     */
    convertToCSV(analysis) {
        let csv = 'AI Drawing Analysis Report\n\n';
        
        // Summary section
        csv += 'Summary\n';
        csv += `File,${analysis.fileName}\n`;
        csv += `Analyzed,${new Date(analysis.timestamp).toLocaleString()}\n`;
        csv += `Confidence,${analysis.summary.confidence}%\n\n`;

        // Rooms section
        if (analysis.results.rooms.length > 0) {
            csv += 'Rooms\n';
            csv += 'Name,Area (sq ft),Width,Length\n';
            analysis.results.rooms.forEach(room => {
                csv += `${room.name},${room.area || ''},${room.dimensions?.width || ''},${room.dimensions?.length || ''}\n`;
            });
            csv += '\n';
        }

        // Measurements section
        if (analysis.results.calculations) {
            csv += 'Calculated Quantities\n';
            csv += `Total Wall Length,${analysis.results.calculations.totalWallLength.toFixed(2)} ft\n`;
            csv += `Total Floor Area,${analysis.results.calculations.totalFloorArea.toFixed(2)} sq ft\n`;
            csv += `Total Ceiling Area,${analysis.results.calculations.totalCeilingArea.toFixed(2)} sq ft\n`;
            csv += `Paintable Wall Area,${analysis.results.calculations.paintableArea.toFixed(2)} sq ft\n`;
            csv += `Door Count,${analysis.results.calculations.doors.count}\n`;
            csv += `Window Count,${analysis.results.calculations.windows.count}\n\n`;
        }

        // Materials section
        if (analysis.results.calculations?.materials?.length > 0) {
            csv += 'Material Requirements\n';
            csv += 'Type,Quantity,Unit,Est. Cost\n';
            analysis.results.calculations.materials.forEach(mat => {
                csv += `${mat.type},${mat.quantity},${mat.unit},$${mat.estimatedCost.toFixed(2)}\n`;
            });
            csv += '\n';
        }

        // Recommendations
        if (analysis.summary.recommendations?.length > 0) {
            csv += 'Recommendations\n';
            analysis.summary.recommendations.forEach(rec => {
                csv += `${rec.type},${rec.message},${rec.action}\n`;
            });
        }

        return csv;
    }

    /**
     * Prepare data for Excel export
     */
    prepareExcelData(analysis) {
        return {
            summary: {
                fileName: analysis.fileName,
                timestamp: analysis.timestamp,
                confidence: analysis.summary.confidence
            },
            rooms: analysis.results.rooms,
            measurements: analysis.results.measurements,
            calculations: analysis.results.calculations,
            materials: analysis.results.calculations?.materials || [],
            recommendations: analysis.summary.recommendations
        };
    }
}

// Export for use in other modules
window.DrawingAnalyzerAI = DrawingAnalyzerAI;

export default DrawingAnalyzerAI;

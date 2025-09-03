// Advanced Drawing Highlight and Markup Analyzer
// Detects and processes colored highlights, red markings, and annotations in construction drawings

class DrawingHighlightAnalyzer {
    constructor(config) {
        this.config = {
            visionEndpoint: config.visionEndpoint || 'https://askforeman-vision.cognitiveservices.azure.com/',
            visionKey: config.visionKey || '3afa37e3f6ec4cf891e0f5f6e5cf896c',
            ...config
        };

        // Define color detection thresholds for construction markups
        this.colorProfiles = {
            red: {
                name: 'Red Markup',
                hsv: { hMin: 0, hMax: 10, sMin: 50, sMax: 100, vMin: 30, vMax: 100 },
                rgb: { rMin: 150, rMax: 255, gMin: 0, gMax: 100, bMin: 0, bMax: 100 },
                meaning: 'Critical areas, demolition, problems, or important notes'
            },
            yellow: {
                name: 'Yellow Highlight',
                hsv: { hMin: 50, hMax: 70, sMin: 30, sMax: 100, vMin: 50, vMax: 100 },
                rgb: { rMin: 200, rMax: 255, gMin: 200, gMax: 255, bMin: 0, bMax: 150 },
                meaning: 'Important information, dimensions, or areas of interest'
            },
            purple: {
                name: 'Purple/Magenta Highlight',
                hsv: { hMin: 280, hMax: 320, sMin: 30, sMax: 100, vMin: 30, vMax: 100 },
                rgb: { rMin: 150, rMax: 255, gMin: 0, gMax: 150, bMin: 150, bMax: 255 },
                meaning: 'Special requirements, MEP coordination, or scope boundaries'
            },
            blue: {
                name: 'Blue Markup',
                hsv: { hMin: 200, hMax: 240, sMin: 30, sMax: 100, vMin: 30, vMax: 100 },
                rgb: { rMin: 0, rMax: 100, gMin: 0, gMax: 150, bMin: 150, bMax: 255 },
                meaning: 'New work, additions, or proposed changes'
            },
            green: {
                name: 'Green Highlight',
                hsv: { hMin: 100, hMax: 140, sMin: 30, sMax: 100, vMin: 30, vMax: 100 },
                rgb: { rMin: 0, rMax: 150, gMin: 150, gMax: 255, bMin: 0, bMax: 150 },
                meaning: 'Completed work, approved areas, or safety zones'
            },
            orange: {
                name: 'Orange Markup',
                hsv: { hMin: 20, hMax: 40, sMin: 50, sMax: 100, vMin: 50, vMax: 100 },
                rgb: { rMin: 200, rMax: 255, gMin: 100, gMax: 180, bMin: 0, bMax: 100 },
                meaning: 'Caution areas, temporary work, or phase boundaries'
            }
        };

        this.detectedHighlights = [];
        this.analyzedRegions = [];
        this.extractedAnnotations = [];
    }

    // Main analysis function
    async analyzeDrawingHighlights(imageUrl, options = {}) {
        console.log('Starting highlight analysis for drawing...');

        try {
            // Step 1: Detect colored regions using Computer Vision API
            const colorAnalysis = await this.analyzeColors(imageUrl);
            
            // Step 2: Extract text and annotations in highlighted areas
            const textAnalysis = await this.extractHighlightedText(imageUrl);
            
            // Step 3: Detect geometric shapes and boundaries
            const shapeAnalysis = await this.detectShapesAndBoundaries(imageUrl);
            
            // Step 4: Correlate highlights with drawing elements
            const correlatedData = await this.correlateHighlightsWithElements(
                colorAnalysis,
                textAnalysis,
                shapeAnalysis
            );
            
            // Step 5: Calculate areas and measurements
            const measurements = await this.calculateHighlightedAreas(correlatedData);
            
            // Step 6: Generate structured output
            const structuredResult = this.generateStructuredOutput({
                colors: colorAnalysis,
                text: textAnalysis,
                shapes: shapeAnalysis,
                correlations: correlatedData,
                measurements: measurements
            });

            return structuredResult;

        } catch (error) {
            console.error('Error analyzing drawing highlights:', error);
            throw error;
        }
    }

    // Analyze colors in the drawing
    async analyzeColors(imageUrl) {
        const response = await fetch(this.config.visionEndpoint + 'vision/v3.2/analyze', {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': this.config.visionKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: imageUrl,
                visualFeatures: 'Color,Objects,ImageType',
                details: 'Landmarks'
            })
        });

        const data = await response.json();
        
        // Process color data
        const colorRegions = await this.processColorData(data, imageUrl);
        
        return colorRegions;
    }

    // Process color data to identify highlighted regions
    async processColorData(visionData, imageUrl) {
        const regions = [];
        
        // Get dominant colors
        const dominantColors = visionData.color?.dominantColors || [];
        
        // Analyze image for specific color regions
        const imageAnalysis = await this.performDetailedColorAnalysis(imageUrl);
        
        // Map colors to construction markup meanings
        imageAnalysis.regions.forEach(region => {
            const colorType = this.identifyColorType(region.color);
            if (colorType) {
                regions.push({
                    id: `region_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    color: colorType.name,
                    meaning: colorType.meaning,
                    boundingBox: region.boundingBox,
                    pixelArea: region.pixelArea,
                    percentOfDrawing: region.percentOfImage,
                    averageColor: region.color,
                    intensity: region.intensity
                });
            }
        });

        return regions;
    }

    // Perform detailed color analysis using image processing
    async performDetailedColorAnalysis(imageUrl) {
        // This would typically use Canvas API or server-side image processing
        // For now, returning structured mock data based on typical drawing markups
        
        const mockRegions = {
            regions: [
                {
                    color: { r: 255, g: 0, b: 0 },
                    boundingBox: { x: 100, y: 200, width: 300, height: 150 },
                    pixelArea: 45000,
                    percentOfImage: 5.2,
                    intensity: 0.8
                },
                {
                    color: { r: 255, g: 255, b: 0 },
                    boundingBox: { x: 500, y: 300, width: 200, height: 100 },
                    pixelArea: 20000,
                    percentOfImage: 2.3,
                    intensity: 0.6
                },
                {
                    color: { r: 200, g: 100, b: 200 },
                    boundingBox: { x: 300, y: 450, width: 400, height: 200 },
                    pixelArea: 80000,
                    percentOfImage: 9.2,
                    intensity: 0.7
                }
            ]
        };

        // In production, this would analyze the actual image pixels
        return mockRegions;
    }

    // Identify color type based on RGB values
    identifyColorType(color) {
        for (const [key, profile] of Object.entries(this.colorProfiles)) {
            if (this.colorMatches(color, profile.rgb)) {
                return profile;
            }
        }
        return null;
    }

    // Check if color matches a profile
    colorMatches(color, range) {
        return color.r >= range.rMin && color.r <= range.rMax &&
               color.g >= range.gMin && color.g <= range.gMax &&
               color.b >= range.bMin && color.b <= range.bMax;
    }

    // Extract text from highlighted areas
    async extractHighlightedText(imageUrl) {
        const response = await fetch(this.config.visionEndpoint + 'vision/v3.2/read/analyze', {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': this.config.visionKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: imageUrl
            })
        });

        const operationLocation = response.headers.get('Operation-Location');
        
        // Poll for results
        let result = await this.pollForReadResults(operationLocation);
        
        // Process text to find highlighted annotations
        return this.processHighlightedText(result);
    }

    // Poll for OCR results
    async pollForReadResults(operationLocation) {
        let attempts = 0;
        while (attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const response = await fetch(operationLocation, {
                headers: {
                    'Ocp-Apim-Subscription-Key': this.config.visionKey
                }
            });
            
            const result = await response.json();
            
            if (result.status === 'succeeded') {
                return result;
            } else if (result.status === 'failed') {
                throw new Error('Text extraction failed');
            }
            
            attempts++;
        }
        throw new Error('Text extraction timeout');
    }

    // Process highlighted text
    processHighlightedText(ocrResult) {
        const highlightedText = [];
        
        if (!ocrResult.analyzeResult?.readResults) {
            return highlightedText;
        }

        ocrResult.analyzeResult.readResults.forEach(page => {
            page.lines?.forEach(line => {
                // Check if text is in a highlighted region
                const inHighlight = this.isTextInHighlight(line.boundingBox);
                
                if (inHighlight || this.isImportantAnnotation(line.text)) {
                    highlightedText.push({
                        text: line.text,
                        boundingBox: line.boundingBox,
                        confidence: line.confidence || 1,
                        highlightColor: inHighlight?.color || null,
                        category: this.categorizeText(line.text),
                        isHandwritten: line.appearance?.style?.name === 'handwriting'
                    });
                }
            });
        });

        return highlightedText;
    }

    // Check if text is within a highlighted region
    isTextInHighlight(textBoundingBox) {
        for (const region of this.detectedHighlights) {
            if (this.boundingBoxOverlap(textBoundingBox, region.boundingBox)) {
                return region;
            }
        }
        return null;
    }

    // Check if text is an important annotation
    isImportantAnnotation(text) {
        const importantPatterns = [
            /^(NOTE|NOTES?):/i,
            /^(E|EX|EXIST|EXISTING)/i,
            /^(N|NEW)/i,
            /^(DEMO|DEMOLISH)/i,
            /^(TYP|TYPICAL)/i,
            /^(REF|REFER|REFERENCE)/i,
            /^(SEE|REFER TO)/i,
            /\d+'-\d+"/,  // Dimensions
            /\d+\s*(SF|SQ\s*FT|LF|LINEAR)/i,  // Areas and lengths
            /(VERIFY|CONFIRM|FIELD)/i
        ];

        return importantPatterns.some(pattern => pattern.test(text));
    }

    // Categorize text content
    categorizeText(text) {
        const categories = {
            dimension: /\d+'-\d+"|[\d.]+\s*(ft|feet|in|inches|m|meters)/i,
            area: /\d+\s*(SF|SQ\s*FT|square\s*feet)/i,
            note: /^(NOTE|NOTES?):/i,
            reference: /^(SEE|REFER|REF)/i,
            existing: /^(E|EX|EXIST|EXISTING)/i,
            new: /^(N|NEW)/i,
            demolition: /^(DEMO|DEMOLISH|REMOVE)/i,
            typical: /^(TYP|TYPICAL)/i,
            room: /(ROOM|RM|OFFICE|CONF|CONFERENCE|BATH|KITCHEN|LOBBY)/i,
            mep: /(HVAC|ELEC|ELECTRICAL|PLUMB|PLUMBING|MECH|MECHANICAL)/i
        };

        for (const [category, pattern] of Object.entries(categories)) {
            if (pattern.test(text)) {
                return category;
            }
        }

        return 'general';
    }

    // Detect shapes and boundaries
    async detectShapesAndBoundaries(imageUrl) {
        // Use Computer Vision API to detect objects and shapes
        const response = await fetch(this.config.visionEndpoint + 'vision/v3.2/detect', {
            method: 'POST',
            headers: {
                'Ocp-Apim-Subscription-Key': this.config.visionKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: imageUrl
            })
        });

        const data = await response.json();
        
        // Process detected objects to identify highlighted shapes
        return this.processShapes(data);
    }

    // Process detected shapes
    processShapes(detectionData) {
        const shapes = [];
        
        if (detectionData.objects) {
            detectionData.objects.forEach(obj => {
                shapes.push({
                    type: this.identifyShapeType(obj),
                    boundingBox: obj.rectangle,
                    confidence: obj.confidence,
                    area: this.calculateArea(obj.rectangle)
                });
            });
        }

        // Add detected rectangles and polygons
        if (detectionData.metadata?.width && detectionData.metadata?.height) {
            this.imageMetadata = {
                width: detectionData.metadata.width,
                height: detectionData.metadata.height
            };
        }

        return shapes;
    }

    // Identify shape type
    identifyShapeType(object) {
        const rect = object.rectangle;
        const aspectRatio = rect.w / rect.h;
        
        if (Math.abs(aspectRatio - 1) < 0.1) {
            return 'square';
        } else if (aspectRatio > 2 || aspectRatio < 0.5) {
            return 'rectangle_elongated';
        } else {
            return 'rectangle';
        }
    }

    // Calculate area of a rectangle
    calculateArea(rectangle) {
        return rectangle.w * rectangle.h;
    }

    // Check if bounding boxes overlap
    boundingBoxOverlap(box1, box2) {
        // Convert array format to object if needed
        const b1 = this.normalizeBoundingBox(box1);
        const b2 = this.normalizeBoundingBox(box2);
        
        return !(b1.right < b2.left || 
                 b2.right < b1.left || 
                 b1.bottom < b2.top || 
                 b2.bottom < b1.top);
    }

    // Normalize bounding box format
    normalizeBoundingBox(box) {
        if (Array.isArray(box) && box.length === 8) {
            // Convert from [x1,y1,x2,y2,x3,y3,x4,y4] to {left,top,right,bottom}
            return {
                left: Math.min(box[0], box[6]),
                top: Math.min(box[1], box[3]),
                right: Math.max(box[2], box[4]),
                bottom: Math.max(box[5], box[7])
            };
        } else if (box.x !== undefined) {
            return {
                left: box.x,
                top: box.y,
                right: box.x + box.width,
                bottom: box.y + box.height
            };
        }
        return box;
    }

    // Correlate highlights with drawing elements
    async correlateHighlightsWithElements(colors, text, shapes) {
        const correlations = [];
        
        // For each colored region
        colors.forEach(colorRegion => {
            const correlation = {
                region: colorRegion,
                associatedText: [],
                associatedShapes: [],
                elements: [],
                purpose: null
            };
            
            // Find text within this region
            text.forEach(textItem => {
                if (this.boundingBoxOverlap(colorRegion.boundingBox, textItem.boundingBox)) {
                    correlation.associatedText.push(textItem);
                }
            });
            
            // Find shapes within this region
            shapes.forEach(shape => {
                if (this.boundingBoxOverlap(colorRegion.boundingBox, shape.boundingBox)) {
                    correlation.associatedShapes.push(shape);
                }
            });
            
            // Determine purpose based on color and content
            correlation.purpose = this.determinePurpose(correlation);
            
            correlations.push(correlation);
        });
        
        return correlations;
    }

    // Determine the purpose of a highlighted region
    determinePurpose(correlation) {
        const region = correlation.region;
        const texts = correlation.associatedText;
        
        // Analyze based on color
        let purpose = {
            primary: region.meaning,
            specific: null,
            action: null
        };
        
        // Analyze based on text content
        if (texts.length > 0) {
            const textCategories = texts.map(t => t.category);
            
            if (textCategories.includes('demolition')) {
                purpose.specific = 'Demolition area';
                purpose.action = 'Remove existing';
            } else if (textCategories.includes('new')) {
                purpose.specific = 'New construction';
                purpose.action = 'Install new';
            } else if (textCategories.includes('dimension')) {
                purpose.specific = 'Dimensional callout';
                purpose.action = 'Verify dimensions';
            } else if (textCategories.includes('note')) {
                purpose.specific = 'Important note';
                purpose.action = 'Review requirements';
            } else if (textCategories.includes('mep')) {
                purpose.specific = 'MEP coordination';
                purpose.action = 'Coordinate with trades';
            }
        }
        
        return purpose;
    }

    // Calculate highlighted areas with scale
    async calculateHighlightedAreas(correlatedData) {
        const measurements = [];
        
        for (const correlation of correlatedData) {
            const region = correlation.region;
            
            // Extract scale from associated text if available
            const scale = this.extractScale(correlation.associatedText);
            
            // Calculate real-world area if scale is known
            let realArea = null;
            if (scale && this.imageMetadata) {
                const pixelsPerFoot = scale.pixelsPerUnit;
                const areaInPixels = region.pixelArea;
                realArea = areaInPixels / (pixelsPerFoot * pixelsPerFoot);
            }
            
            measurements.push({
                regionId: region.id,
                color: region.color,
                pixelArea: region.pixelArea,
                percentOfDrawing: region.percentOfDrawing,
                realArea: realArea,
                unit: scale?.unit || 'pixels',
                scale: scale,
                dimensions: this.extractDimensions(correlation.associatedText),
                quantities: this.extractQuantities(correlation.associatedText)
            });
        }
        
        return measurements;
    }

    // Extract scale from text
    extractScale(textItems) {
        for (const item of textItems) {
            const scaleMatch = item.text.match(/(\d+)['"]\s*=\s*(\d+)['"]/);
            if (scaleMatch) {
                return {
                    drawingUnit: parseFloat(scaleMatch[1]),
                    realUnit: parseFloat(scaleMatch[2]),
                    unit: 'feet',
                    pixelsPerUnit: null // Would need calibration
                };
            }
        }
        return null;
    }

    // Extract dimensions from text
    extractDimensions(textItems) {
        const dimensions = [];
        
        textItems.forEach(item => {
            const dimMatch = item.text.match(/(\d+)'-(\d+)"/);
            if (dimMatch) {
                dimensions.push({
                    text: item.text,
                    feet: parseInt(dimMatch[1]),
                    inches: parseInt(dimMatch[2]),
                    totalInches: parseInt(dimMatch[1]) * 12 + parseInt(dimMatch[2])
                });
            }
        });
        
        return dimensions;
    }

    // Extract quantities from text
    extractQuantities(textItems) {
        const quantities = [];
        
        textItems.forEach(item => {
            const patterns = [
                { regex: /(\d+)\s*(SF|SQ\s*FT)/i, unit: 'square feet' },
                { regex: /(\d+)\s*(LF|LINEAR\s*FEET)/i, unit: 'linear feet' },
                { regex: /(\d+)\s*(EA|EACH)/i, unit: 'each' },
                { regex: /(\d+)\s*(GAL|GALLONS?)/i, unit: 'gallons' }
            ];
            
            patterns.forEach(pattern => {
                const match = item.text.match(pattern.regex);
                if (match) {
                    quantities.push({
                        value: parseFloat(match[1]),
                        unit: pattern.unit,
                        text: item.text
                    });
                }
            });
        });
        
        return quantities;
    }

    // Generate structured output for storage and search
    generateStructuredOutput(analysisData) {
        const output = {
            timestamp: new Date().toISOString(),
            summary: {
                totalHighlightedRegions: analysisData.colors.length,
                totalAnnotations: analysisData.text.length,
                colors: this.summarizeColors(analysisData.colors),
                primaryPurpose: this.determinePrimaryPurpose(analysisData.correlations)
            },
            highlights: analysisData.correlations.map(correlation => ({
                id: correlation.region.id,
                color: correlation.region.color,
                meaning: correlation.region.meaning,
                purpose: correlation.purpose,
                boundingBox: correlation.region.boundingBox,
                area: {
                    pixels: correlation.region.pixelArea,
                    percentage: correlation.region.percentOfDrawing,
                    realWorld: this.findMeasurement(correlation.region.id, analysisData.measurements)?.realArea
                },
                text: correlation.associatedText.map(t => ({
                    content: t.text,
                    category: t.category,
                    isHandwritten: t.isHandwritten
                })),
                shapes: correlation.associatedShapes.map(s => ({
                    type: s.type,
                    area: s.area
                })),
                quantities: this.findMeasurement(correlation.region.id, analysisData.measurements)?.quantities || [],
                dimensions: this.findMeasurement(correlation.region.id, analysisData.measurements)?.dimensions || []
            })),
            searchableContent: this.generateSearchableContent(analysisData),
            indexableData: this.prepareForIndexing(analysisData)
        };

        return output;
    }

    // Summarize colors found
    summarizeColors(colorRegions) {
        const summary = {};
        colorRegions.forEach(region => {
            if (!summary[region.color]) {
                summary[region.color] = {
                    count: 0,
                    totalArea: 0,
                    meaning: region.meaning
                };
            }
            summary[region.color].count++;
            summary[region.color].totalArea += region.pixelArea;
        });
        return summary;
    }

    // Determine primary purpose of highlights
    determinePrimaryPurpose(correlations) {
        const purposes = correlations.map(c => c.purpose?.specific).filter(p => p);
        
        // Count occurrences
        const counts = {};
        purposes.forEach(p => {
            counts[p] = (counts[p] || 0) + 1;
        });
        
        // Find most common
        let maxCount = 0;
        let primaryPurpose = 'General markup';
        
        for (const [purpose, count] of Object.entries(counts)) {
            if (count > maxCount) {
                maxCount = count;
                primaryPurpose = purpose;
            }
        }
        
        return primaryPurpose;
    }

    // Find measurement for a region
    findMeasurement(regionId, measurements) {
        return measurements.find(m => m.regionId === regionId);
    }

    // Generate searchable content
    generateSearchableContent(analysisData) {
        const content = [];
        
        // Add all text content
        analysisData.text.forEach(t => {
            content.push(t.text);
        });
        
        // Add descriptions of highlighted areas
        analysisData.correlations.forEach(c => {
            const desc = `${c.region.color} highlighted area containing ${c.associatedText.length} annotations`;
            content.push(desc);
            
            if (c.purpose?.specific) {
                content.push(`Purpose: ${c.purpose.specific}`);
            }
        });
        
        // Add measurements
        analysisData.measurements.forEach(m => {
            if (m.realArea) {
                content.push(`Area: ${m.realArea.toFixed(2)} ${m.unit}`);
            }
            m.dimensions.forEach(d => {
                content.push(`Dimension: ${d.text}`);
            });
            m.quantities.forEach(q => {
                content.push(`Quantity: ${q.value} ${q.unit}`);
            });
        });
        
        return content.join(' | ');
    }

    // Prepare data for indexing
    prepareForIndexing(analysisData) {
        return {
            documentType: 'drawing_markup',
            highlights: analysisData.colors.map(c => ({
                color: c.color,
                area: c.pixelArea,
                meaning: c.meaning
            })),
            annotations: analysisData.text.map(t => ({
                text: t.text,
                category: t.category
            })),
            measurements: analysisData.measurements.map(m => ({
                area: m.realArea,
                unit: m.unit,
                quantities: m.quantities
            })),
            metadata: {
                analyzedAt: new Date().toISOString(),
                totalRegions: analysisData.colors.length,
                totalAnnotations: analysisData.text.length
            }
        };
    }

    // Upload analyzed data to client index
    async uploadToClientIndex(analysisResult, clientId, drawingInfo) {
        const uploadData = {
            client: clientId,
            documentId: drawingInfo.id || `drawing_${Date.now()}`,
            fileName: drawingInfo.fileName,
            category: 'drawing_analysis',
            content: analysisResult.searchableContent,
            highlights: analysisResult.highlights,
            metadata: {
                ...analysisResult.summary,
                drawingType: drawingInfo.type || 'floor_plan',
                analyzedAt: analysisResult.timestamp,
                originalDrawing: drawingInfo.url
            },
            indexData: analysisResult.indexableData
        };

        // Use existing upload webhook
        const response = await fetch('https://workflows.saxtechnology.com/webhook/ask-foreman/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(uploadData)
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
        }

        return await response.json();
    }
}

// Export for use
window.DrawingHighlightAnalyzer = DrawingHighlightAnalyzer;

/**
 * Excel Export Module
 * Handles comprehensive Excel export functionality for takeoff results and estimates
 * @module ExcelExport
 */

export class ExcelExporter {
    constructor(config = {}) {
        this.config = {
            defaultSheetName: config.defaultSheetName || 'Estimate',
            companyInfo: config.companyInfo || {
                name: 'SAX Technology',
                address: 'Construction Estimating Services',
                phone: '',
                email: ''
            },
            styles: config.styles || this.getDefaultStyles(),
            templates: config.templates || {}
        };
        
        // Check if SheetJS (xlsx) is available
        this.xlsxAvailable = typeof XLSX !== 'undefined';
        
        if (!this.xlsxAvailable) {
            console.warn('SheetJS library not loaded. Excel export functionality limited.');
            this.loadSheetJS();
        }
    }

    /**
     * Load SheetJS library dynamically
     */
    async loadSheetJS() {
        try {
            const script = document.createElement('script');
            script.src = 'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js';
            script.onload = () => {
                this.xlsxAvailable = true;
                console.log('SheetJS loaded successfully');
            };
            document.head.appendChild(script);
        } catch (error) {
            console.error('Failed to load SheetJS:', error);
        }
    }

    /**
     * Get default styles for Excel
     */
    getDefaultStyles() {
        return {
            header: {
                font: { bold: true, size: 14, color: { rgb: "FFFFFF" } },
                fill: { fgColor: { rgb: "2E86AB" } },
                alignment: { horizontal: "center", vertical: "center" }
            },
            subHeader: {
                font: { bold: true, size: 12 },
                fill: { fgColor: { rgb: "F6AE2D" } },
                alignment: { horizontal: "left" }
            },
            title: {
                font: { bold: true, size: 16 },
                alignment: { horizontal: "center" }
            },
            currency: {
                numFmt: "$#,##0.00"
            },
            percentage: {
                numFmt: "0.00%"
            },
            date: {
                numFmt: "mm/dd/yyyy"
            },
            border: {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" }
            }
        };
    }

    /**
     * Export takeoff results to Excel
     */
    async exportTakeoffResults(takeoffData, fileName = 'takeoff-results.xlsx') {
        if (!this.xlsxAvailable) {
            console.error('SheetJS not available. Cannot export to Excel.');
            return this.exportAsCSV(takeoffData, fileName.replace('.xlsx', '.csv'));
        }

        try {
            const workbook = XLSX.utils.book_new();
            
            // Add summary sheet
            this.addSummarySheet(workbook, takeoffData);
            
            // Add measurements sheet
            this.addMeasurementsSheet(workbook, takeoffData);
            
            // Add materials sheet
            if (takeoffData.paintRequirements) {
                this.addMaterialsSheet(workbook, takeoffData);
            }
            
            // Add rooms breakdown sheet
            if (takeoffData.rooms && takeoffData.rooms.length > 0) {
                this.addRoomsSheet(workbook, takeoffData);
            }
            
            // Add cost breakdown sheet
            if (takeoffData.costs) {
                this.addCostSheet(workbook, takeoffData);
            }
            
            // Add notes sheet
            this.addNotesSheet(workbook, takeoffData);
            
            // Apply styles
            this.applyWorkbookStyles(workbook);
            
            // Save the file
            XLSX.writeFile(workbook, fileName);
            
            return { success: true, fileName };
            
        } catch (error) {
            console.error('Excel export error:', error);
            throw error;
        }
    }

    /**
     * Export estimate to Excel
     */
    async exportEstimate(estimateData, fileName = 'estimate.xlsx') {
        if (!this.xlsxAvailable) {
            console.error('SheetJS not available. Cannot export to Excel.');
            return this.exportAsCSV(estimateData, fileName.replace('.xlsx', '.csv'));
        }

        try {
            const workbook = XLSX.utils.book_new();
            
            // Add cover sheet
            this.addCoverSheet(workbook, estimateData);
            
            // Add line items sheet
            this.addLineItemsSheet(workbook, estimateData);
            
            // Add labor breakdown
            if (estimateData.labor) {
                this.addLaborSheet(workbook, estimateData);
            }
            
            // Add materials breakdown
            if (estimateData.materials) {
                this.addMaterialsBreakdownSheet(workbook, estimateData);
            }
            
            // Add equipment sheet
            if (estimateData.equipment) {
                this.addEquipmentSheet(workbook, estimateData);
            }
            
            // Add summary sheet
            this.addEstimateSummarySheet(workbook, estimateData);
            
            // Add terms and conditions
            this.addTermsSheet(workbook, estimateData);
            
            // Apply styles
            this.applyWorkbookStyles(workbook);
            
            // Save the file
            XLSX.writeFile(workbook, fileName);
            
            return { success: true, fileName };
            
        } catch (error) {
            console.error('Excel export error:', error);
            throw error;
        }
    }

    /**
     * Add summary sheet to workbook
     */
    addSummarySheet(workbook, data) {
        const summaryData = [
            ['Digital Takeoff Summary Report'],
            [],
            ['Project Information'],
            ['Building:', data.summary?.building || 'N/A'],
            ['Floor:', data.summary?.floor || 'N/A'],
            ['Drawing Type:', data.summary?.drawingType || 'N/A'],
            ['Scale:', data.summary?.scale || 'N/A'],
            ['Analysis Date:', new Date().toLocaleDateString()],
            [],
            ['Key Metrics'],
            ['Total Wall Area:', `${data.measurements?.walls?.total || 0} linear feet`],
            ['Total Floor Area:', `${data.measurements?.floors?.total || 0} sq ft`],
            ['Total Ceiling Area:', `${data.measurements?.ceilings?.total || 0} sq ft`],
            ['Door Count:', data.measurements?.doors?.total || 0],
            ['Window Count:', data.measurements?.windows?.total || 0],
            ['Fixture Count:', data.measurements?.fixtures?.total || 0],
            [],
            ['Confidence Score:', `${data.confidence || 0}%`]
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(summaryData);
        
        // Set column widths
        ws['!cols'] = [
            { wch: 25 },
            { wch: 30 },
            { wch: 20 },
            { wch: 20 }
        ];
        
        // Merge cells for title
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }
        ];
        
        XLSX.utils.book_append_sheet(workbook, ws, 'Summary');
    }

    /**
     * Add measurements sheet
     */
    addMeasurementsSheet(workbook, data) {
        const headers = ['Category', 'Total', 'Unit', 'Details'];
        const rows = [];
        
        if (data.measurements) {
            // Walls
            if (data.measurements.walls) {
                rows.push([
                    'Walls',
                    data.measurements.walls.total,
                    data.measurements.walls.unit,
                    data.measurements.walls.breakdown?.map(b => `${b.room}: ${b.value}`).join(', ') || ''
                ]);
            }
            
            // Floors
            if (data.measurements.floors) {
                rows.push([
                    'Floors',
                    data.measurements.floors.total,
                    data.measurements.floors.unit,
                    data.measurements.floors.breakdown?.map(b => `${b.room}: ${b.value}`).join(', ') || ''
                ]);
            }
            
            // Ceilings
            if (data.measurements.ceilings) {
                rows.push([
                    'Ceilings',
                    data.measurements.ceilings.total,
                    data.measurements.ceilings.unit,
                    data.measurements.ceilings.breakdown?.map(b => `${b.room}: ${b.value}`).join(', ') || ''
                ]);
            }
            
            // Doors
            if (data.measurements.doors) {
                rows.push([
                    'Doors',
                    data.measurements.doors.total,
                    data.measurements.doors.unit,
                    data.measurements.doors.types?.map(t => `${t.type}: ${t.count}`).join(', ') || ''
                ]);
            }
            
            // Windows
            if (data.measurements.windows) {
                rows.push([
                    'Windows',
                    data.measurements.windows.total,
                    data.measurements.windows.unit,
                    data.measurements.windows.types?.map(t => `${t.type}: ${t.count}`).join(', ') || ''
                ]);
            }
            
            // Fixtures
            if (data.measurements.fixtures) {
                rows.push([
                    'Fixtures',
                    data.measurements.fixtures.total,
                    data.measurements.fixtures.unit,
                    data.measurements.fixtures.types?.map(t => `${t.type}: ${t.count}`).join(', ') || ''
                ]);
            }
        }
        
        const wsData = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        // Set column widths
        ws['!cols'] = [
            { wch: 15 },
            { wch: 15 },
            { wch: 15 },
            { wch: 50 }
        ];
        
        XLSX.utils.book_append_sheet(workbook, ws, 'Measurements');
    }

    /**
     * Add materials sheet
     */
    addMaterialsSheet(workbook, data) {
        const paintReq = data.paintRequirements;
        
        const materialsData = [
            ['Materials Requirements'],
            [],
            ['Surface', 'Finish Type', 'Area (sq ft)', 'Coats', 'Gallons Required', 'Est. Cost'],
            []
        ];
        
        if (paintReq.wallGallons) {
            materialsData.push([
                'Walls',
                paintReq.wallFinish,
                paintReq.wallArea,
                paintReq.coats,
                paintReq.wallGallons,
                `$${(paintReq.costBreakdown?.wallPaint || 0).toFixed(2)}`
            ]);
        }
        
        if (paintReq.ceilingGallons) {
            materialsData.push([
                'Ceilings',
                paintReq.ceilingFinish,
                paintReq.ceilingArea,
                paintReq.coats,
                paintReq.ceilingGallons,
                `$${(paintReq.costBreakdown?.ceilingPaint || 0).toFixed(2)}`
            ]);
        }
        
        if (paintReq.floorGallons) {
            materialsData.push([
                'Floors',
                paintReq.floorFinish,
                paintReq.floorArea,
                paintReq.coats,
                paintReq.floorGallons,
                `$${(paintReq.costBreakdown?.floorCoating || 0).toFixed(2)}`
            ]);
        }
        
        materialsData.push([]);
        materialsData.push([
            'Total Material Cost:',
            '',
            '',
            '',
            '',
            `$${(paintReq.estimatedMaterialCost || 0).toFixed(2)}`
        ]);
        
        const ws = XLSX.utils.aoa_to_sheet(materialsData);
        
        ws['!cols'] = [
            { wch: 15 },
            { wch: 20 },
            { wch: 15 },
            { wch: 10 },
            { wch: 18 },
            { wch: 15 }
        ];
        
        XLSX.utils.book_append_sheet(workbook, ws, 'Materials');
    }

    /**
     * Add rooms breakdown sheet
     */
    addRoomsSheet(workbook, data) {
        const headers = ['Room', 'Floor Area (sq ft)', 'Wall Area (sq ft)', 'Ceiling Area (sq ft)', 'Doors', 'Windows'];
        const rows = [];
        
        data.rooms.forEach(room => {
            rows.push([
                room.name,
                room.floorArea || 0,
                room.wallArea || 0,
                room.ceilingArea || 0,
                room.doors || 0,
                room.windows || 0
            ]);
        });
        
        // Add totals row
        rows.push([]);
        rows.push([
            'TOTALS',
            rows.reduce((sum, r) => sum + (r[1] || 0), 0),
            rows.reduce((sum, r) => sum + (r[2] || 0), 0),
            rows.reduce((sum, r) => sum + (r[3] || 0), 0),
            rows.reduce((sum, r) => sum + (r[4] || 0), 0),
            rows.reduce((sum, r) => sum + (r[5] || 0), 0)
        ]);
        
        const wsData = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        ws['!cols'] = [
            { wch: 25 },
            { wch: 18 },
            { wch: 18 },
            { wch: 18 },
            { wch: 10 },
            { wch: 10 }
        ];
        
        XLSX.utils.book_append_sheet(workbook, ws, 'Rooms');
    }

    /**
     * Add cover sheet for estimate
     */
    addCoverSheet(workbook, data) {
        const coverData = [
            [this.config.companyInfo.name],
            [this.config.companyInfo.address],
            [this.config.companyInfo.phone],
            [this.config.companyInfo.email],
            [],
            ['CONSTRUCTION ESTIMATE'],
            [],
            ['Project:', data.projectName || 'Unnamed Project'],
            ['Client:', data.clientName || 'N/A'],
            ['Date:', new Date().toLocaleDateString()],
            ['Estimator:', data.estimator || 'N/A'],
            ['Estimate #:', data.estimateNumber || this.generateEstimateNumber()],
            [],
            ['Total Estimate:', `$${(data.grandTotal || 0).toFixed(2)}`]
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(coverData);
        
        ws['!cols'] = [
            { wch: 20 },
            { wch: 40 }
        ];
        
        // Merge cells for company name and title
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
            { s: { r: 5, c: 0 }, e: { r: 5, c: 1 } }
        ];
        
        XLSX.utils.book_append_sheet(workbook, ws, 'Cover');
    }

    /**
     * Add line items sheet
     */
    addLineItemsSheet(workbook, data) {
        const headers = ['#', 'Category', 'Description', 'Quantity', 'Unit', 'Material Cost', 'Labor Cost', 'Total'];
        const rows = [];
        
        data.lineItems?.forEach((item, index) => {
            rows.push([
                index + 1,
                item.category,
                item.description,
                item.quantity,
                item.unit,
                item.materialCost || 0,
                item.laborCost || 0,
                item.total || 0
            ]);
        });
        
        // Add subtotals
        rows.push([]);
        rows.push([
            '',
            '',
            'Subtotal:',
            '',
            '',
            data.materialSubtotal || 0,
            data.laborSubtotal || 0,
            data.subtotal || 0
        ]);
        
        // Add markups
        if (data.overhead) {
            rows.push([
                '',
                '',
                `Overhead (${data.overheadPercent}%):`,
                '',
                '',
                '',
                '',
                data.overhead
            ]);
        }
        
        if (data.profit) {
            rows.push([
                '',
                '',
                `Profit (${data.profitPercent}%):`,
                '',
                '',
                '',
                '',
                data.profit
            ]);
        }
        
        if (data.tax) {
            rows.push([
                '',
                '',
                `Tax (${data.taxPercent}%):`,
                '',
                '',
                '',
                '',
                data.tax
            ]);
        }
        
        // Add grand total
        rows.push([]);
        rows.push([
            '',
            '',
            'GRAND TOTAL:',
            '',
            '',
            '',
            '',
            data.grandTotal || 0
        ]);
        
        const wsData = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        ws['!cols'] = [
            { wch: 5 },
            { wch: 15 },
            { wch: 35 },
            { wch: 10 },
            { wch: 10 },
            { wch: 15 },
            { wch: 15 },
            { wch: 15 }
        ];
        
        XLSX.utils.book_append_sheet(workbook, ws, 'Line Items');
    }

    /**
     * Add notes sheet
     */
    addNotesSheet(workbook, data) {
        const notesData = [
            ['Notes and Assumptions'],
            [],
            ['Analysis Notes:'],
            ...(data.notes || []).map(note => [note])
        ];
        
        if (data.errors && data.errors.length > 0) {
            notesData.push([]);
            notesData.push(['Analysis Warnings:']);
            data.errors.forEach(error => {
                notesData.push([error]);
            });
        }
        
        if (data.assumptions) {
            notesData.push([]);
            notesData.push(['Assumptions:']);
            data.assumptions.forEach(assumption => {
                notesData.push([assumption]);
            });
        }
        
        if (data.exclusions) {
            notesData.push([]);
            notesData.push(['Exclusions:']);
            data.exclusions.forEach(exclusion => {
                notesData.push([exclusion]);
            });
        }
        
        const ws = XLSX.utils.aoa_to_sheet(notesData);
        
        ws['!cols'] = [
            { wch: 100 }
        ];
        
        XLSX.utils.book_append_sheet(workbook, ws, 'Notes');
    }

    /**
     * Add terms and conditions sheet
     */
    addTermsSheet(workbook, data) {
        const termsData = [
            ['Terms and Conditions'],
            [],
            ['Payment Terms:', data.paymentTerms || 'Net 30'],
            ['Valid Until:', data.validUntil || this.getValidUntilDate()],
            [],
            ['Standard Terms:'],
            ['1. This estimate is valid for 30 days from the date of issue.'],
            ['2. Prices are subject to change based on material availability.'],
            ['3. Additional work not specified in this estimate will be billed separately.'],
            ['4. Payment terms are net 30 days from invoice date.'],
            ['5. A 50% deposit is required before work commences.'],
            [],
            ['Acceptance:'],
            ['By signing below, you accept the terms and conditions of this estimate.'],
            [],
            ['_______________________     _______________________'],
            ['Client Signature                    Date'],
            [],
            ['_______________________     _______________________'],
            ['Company Representative           Date']
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(termsData);
        
        ws['!cols'] = [
            { wch: 80 }
        ];
        
        XLSX.utils.book_append_sheet(workbook, ws, 'Terms');
    }

    /**
     * Apply styles to workbook
     */
    applyWorkbookStyles(workbook) {
        // This would require more advanced styling with xlsx-style or similar
        // For now, basic formatting is applied through column widths and merges
        console.log('Styles applied to workbook');
    }

    /**
     * Export as CSV fallback
     */
    exportAsCSV(data, fileName) {
        let csv = '';
        
        // Add headers
        csv += 'Category,Value\n';
        
        // Add data
        const flattenObject = (obj, prefix = '') => {
            Object.keys(obj).forEach(key => {
                const value = obj[key];
                const newKey = prefix ? `${prefix}_${key}` : key;
                
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    flattenObject(value, newKey);
                } else if (Array.isArray(value)) {
                    csv += `"${newKey}","${value.join(', ')}"\n`;
                } else {
                    csv += `"${newKey}","${value}"\n`;
                }
            });
        };
        
        flattenObject(data);
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return { success: true, fileName, format: 'csv' };
    }

    /**
     * Generate estimate number
     */
    generateEstimateNumber() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `EST-${year}${month}${day}-${random}`;
    }

    /**
     * Get valid until date (30 days from now)
     */
    getValidUntilDate() {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date.toLocaleDateString();
    }

    /**
     * Create workbook from template
     */
    createFromTemplate(templateName, data) {
        const template = this.config.templates[templateName];
        
        if (!template) {
            throw new Error(`Template ${templateName} not found`);
        }
        
        // Apply template structure to data
        const workbook = XLSX.utils.book_new();
        
        template.sheets.forEach(sheetConfig => {
            const sheetData = this.processTemplateSheet(sheetConfig, data);
            const ws = XLSX.utils.aoa_to_sheet(sheetData);
            
            if (sheetConfig.columnWidths) {
                ws['!cols'] = sheetConfig.columnWidths;
            }
            
            if (sheetConfig.merges) {
                ws['!merges'] = sheetConfig.merges;
            }
            
            XLSX.utils.book_append_sheet(workbook, ws, sheetConfig.name);
        });
        
        return workbook;
    }

    /**
     * Process template sheet
     */
    processTemplateSheet(sheetConfig, data) {
        const result = [];
        
        sheetConfig.rows.forEach(row => {
            const processedRow = [];
            
            row.forEach(cell => {
                if (typeof cell === 'string' && cell.startsWith('{{') && cell.endsWith('}}')) {
                    // Replace with data
                    const path = cell.slice(2, -2).trim();
                    const value = this.getValueByPath(data, path);
                    processedRow.push(value);
                } else {
                    processedRow.push(cell);
                }
            });
            
            result.push(processedRow);
        });
        
        return result;
    }

    /**
     * Get value by path from object
     */
    getValueByPath(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj) || '';
    }

    /**
     * Export multiple sheets as separate files
     */
    async exportMultipleFiles(datasets, filePrefix = 'export') {
        const results = [];
        
        for (let i = 0; i < datasets.length; i++) {
            const data = datasets[i];
            const fileName = `${filePrefix}-${i + 1}.xlsx`;
            
            try {
                const result = await this.exportTakeoffResults(data, fileName);
                results.push(result);
            } catch (error) {
                results.push({ success: false, fileName, error: error.message });
            }
        }
        
        return results;
    }
}

// Export for use in other modules
export default ExcelExporter;

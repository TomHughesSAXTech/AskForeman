// Azure Function: Document Generator
// Generates PDF, Excel, and Word documents from chat context

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const ExcelJS = require('exceljs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel } = require('docx');
const { BlobServiceClient } = require('@azure/storage-blob');

module.exports = async function (context, req) {
    context.log('Document Generator function triggered');

    const { 
        format,           // 'pdf', 'excel', 'docx'
        documentType,     // 'estimate', 'report', 'schedule', 'takeoff'
        data,            // Structured data from chat
        clientName,
        projectName,
        metadata
    } = req.body;

    try {
        let document;
        let mimeType;
        let fileName;

        switch (format) {
            case 'pdf':
                document = await generatePDF(data, documentType, metadata);
                mimeType = 'application/pdf';
                fileName = `${projectName}_${documentType}_${Date.now()}.pdf`;
                break;
            
            case 'excel':
                document = await generateExcel(data, documentType, metadata);
                mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                fileName = `${projectName}_${documentType}_${Date.now()}.xlsx`;
                break;
            
            case 'docx':
                document = await generateWord(data, documentType, metadata);
                mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                fileName = `${projectName}_${documentType}_${Date.now()}.docx`;
                break;
            
            default:
                throw new Error(`Unsupported format: ${format}`);
        }

        // Upload to Azure Blob Storage
        const blobUrl = await uploadToBlob(document, fileName, clientName, mimeType);

        context.res = {
            status: 200,
            body: {
                success: true,
                fileName,
                blobUrl,
                format,
                documentType,
                message: `${format.toUpperCase()} document generated successfully`
            }
        };

    } catch (error) {
        context.log.error('Document generation error:', error);
        context.res = {
            status: 500,
            body: {
                error: error.message
            }
        };
    }
};

// PDF Generation
async function generatePDF(data, documentType, metadata) {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Add pages based on document type
    if (documentType === 'estimate') {
        await generateEstimatePDF(pdfDoc, data, font, boldFont, metadata);
    } else if (documentType === 'takeoff') {
        await generateTakeoffPDF(pdfDoc, data, font, boldFont, metadata);
    } else if (documentType === 'report') {
        await generateReportPDF(pdfDoc, data, font, boldFont, metadata);
    }
    
    return await pdfDoc.save();
}

async function generateEstimatePDF(pdfDoc, data, font, boldFont, metadata) {
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    let yPosition = height - 50;
    
    // Header
    page.drawText('CONSTRUCTION COST ESTIMATE', {
        x: 50,
        y: yPosition,
        size: 20,
        font: boldFont,
        color: rgb(0, 0, 0),
    });
    
    yPosition -= 30;
    page.drawText(`Project: ${metadata.projectName}`, {
        x: 50,
        y: yPosition,
        size: 12,
        font: font,
    });
    
    yPosition -= 20;
    page.drawText(`Date: ${new Date().toLocaleDateString()}`, {
        x: 50,
        y: yPosition,
        size: 10,
        font: font,
    });
    
    // Line items
    yPosition -= 40;
    const headers = ['Item', 'Quantity', 'Unit', 'Unit Price', 'Total'];
    const columnWidths = [200, 60, 50, 80, 80];
    let xPosition = 50;
    
    // Draw headers
    headers.forEach((header, index) => {
        page.drawText(header, {
            x: xPosition,
            y: yPosition,
            size: 10,
            font: boldFont,
        });
        xPosition += columnWidths[index];
    });
    
    // Draw line items
    yPosition -= 20;
    let totalCost = 0;
    
    data.lineItems?.forEach(item => {
        xPosition = 50;
        
        page.drawText(item.description || '', {
            x: xPosition,
            y: yPosition,
            size: 9,
            font: font,
        });
        xPosition += columnWidths[0];
        
        page.drawText(String(item.quantity || 0), {
            x: xPosition,
            y: yPosition,
            size: 9,
            font: font,
        });
        xPosition += columnWidths[1];
        
        page.drawText(item.unit || '', {
            x: xPosition,
            y: yPosition,
            size: 9,
            font: font,
        });
        xPosition += columnWidths[2];
        
        page.drawText(`$${(item.unitPrice || 0).toFixed(2)}`, {
            x: xPosition,
            y: yPosition,
            size: 9,
            font: font,
        });
        xPosition += columnWidths[3];
        
        const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
        totalCost += lineTotal;
        
        page.drawText(`$${lineTotal.toFixed(2)}`, {
            x: xPosition,
            y: yPosition,
            size: 9,
            font: font,
        });
        
        yPosition -= 15;
        
        // Add new page if needed
        if (yPosition < 100) {
            const newPage = pdfDoc.addPage();
            yPosition = newPage.getSize().height - 50;
        }
    });
    
    // Total
    yPosition -= 20;
    page.drawText('TOTAL:', {
        x: 350,
        y: yPosition,
        size: 12,
        font: boldFont,
    });
    
    page.drawText(`$${totalCost.toFixed(2)}`, {
        x: 450,
        y: yPosition,
        size: 12,
        font: boldFont,
        color: rgb(0, 0.5, 0),
    });
}

// Excel Generation
async function generateExcel(data, documentType, metadata) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Ask Foreman AI';
    workbook.created = new Date();
    
    if (documentType === 'estimate') {
        await generateEstimateExcel(workbook, data, metadata);
    } else if (documentType === 'takeoff') {
        await generateTakeoffExcel(workbook, data, metadata);
    } else if (documentType === 'schedule') {
        await generateScheduleExcel(workbook, data, metadata);
    }
    
    return await workbook.xlsx.writeBuffer();
}

async function generateEstimateExcel(workbook, data, metadata) {
    const worksheet = workbook.addWorksheet('Cost Estimate');
    
    // Add header
    worksheet.mergeCells('A1:E1');
    worksheet.getCell('A1').value = 'CONSTRUCTION COST ESTIMATE';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    
    worksheet.getCell('A2').value = `Project: ${metadata.projectName}`;
    worksheet.getCell('A3').value = `Date: ${new Date().toLocaleDateString()}`;
    worksheet.getCell('A4').value = `Prepared by: Ask Foreman AI`;
    
    // Add column headers
    worksheet.addRow([]); // Empty row
    const headerRow = worksheet.addRow(['Item Description', 'Quantity', 'Unit', 'Unit Price', 'Total']);
    headerRow.font = { bold: true };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
    };
    
    // Add data
    let totalCost = 0;
    data.lineItems?.forEach(item => {
        const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
        totalCost += lineTotal;
        
        const row = worksheet.addRow([
            item.description,
            item.quantity,
            item.unit,
            item.unitPrice,
            lineTotal
        ]);
        
        // Format currency cells
        row.getCell(4).numFmt = '$#,##0.00';
        row.getCell(5).numFmt = '$#,##0.00';
    });
    
    // Add total row
    const totalRow = worksheet.addRow(['', '', '', 'TOTAL:', totalCost]);
    totalRow.font = { bold: true };
    totalRow.getCell(5).numFmt = '$#,##0.00';
    totalRow.getCell(5).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF90EE90' }
    };
    
    // Set column widths
    worksheet.columns = [
        { width: 40 },
        { width: 12 },
        { width: 10 },
        { width: 15 },
        { width: 15 }
    ];
    
    // Add borders
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber >= 6) {
            row.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        }
    });
}

// Word Document Generation
async function generateWord(data, documentType, metadata) {
    const doc = new Document({
        sections: []
    });
    
    if (documentType === 'report') {
        await generateReportWord(doc, data, metadata);
    } else if (documentType === 'specification') {
        await generateSpecificationWord(doc, data, metadata);
    }
    
    return await Packer.toBuffer(doc);
}

async function generateReportWord(doc, data, metadata) {
    doc.addSection({
        properties: {},
        children: [
            new Paragraph({
                text: metadata.title || 'Construction Report',
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
                text: `Project: ${metadata.projectName}`,
                heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({
                text: `Date: ${new Date().toLocaleDateString()}`,
            }),
            new Paragraph({
                text: '',
            }),
            ...generateWordContent(data)
        ],
    });
}

function generateWordContent(data) {
    const content = [];
    
    // Add sections based on data structure
    if (data.sections) {
        data.sections.forEach(section => {
            content.push(
                new Paragraph({
                    text: section.title,
                    heading: HeadingLevel.HEADING_2,
                })
            );
            
            if (section.content) {
                content.push(
                    new Paragraph({
                        text: section.content,
                    })
                );
            }
            
            if (section.items) {
                section.items.forEach(item => {
                    content.push(
                        new Paragraph({
                            text: `• ${item}`,
                            bullet: {
                                level: 0
                            }
                        })
                    );
                });
            }
        });
    }
    
    return content;
}

// Upload to Azure Blob Storage
async function uploadToBlob(buffer, fileName, clientName, mimeType) {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = 'fcs-clients';
    
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    
    // Upload to generated documents folder
    const blobPath = `FCS-GeneratedDocs/${clientName}/${fileName}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    
    await blockBlobClient.upload(buffer, buffer.length, {
        blobHTTPHeaders: {
            blobContentType: mimeType
        }
    });
    
    return blockBlobClient.url;
}

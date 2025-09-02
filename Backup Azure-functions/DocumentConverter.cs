using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Presentation;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using System.Linq;
using Microsoft.Extensions.Logging;

namespace SAXTech.DocConverter
{
    public class DocumentConverter
    {
        private readonly ILogger _logger;

        public DocumentConverter(ILogger logger = null)
        {
            _logger = logger;
        }

        /// <summary>
        /// Extract text from various document types
        /// </summary>
        public async Task<string> ExtractTextAsync(byte[] content, string fileName, string mimeType = null)
        {
            var extension = Path.GetExtension(fileName)?.ToLowerInvariant() ?? "";
            
            try
            {
                return extension switch
                {
                    ".pdf" => await ExtractPdfTextAsync(content),
                    ".docx" or ".doc" => await ExtractWordTextAsync(content),
                    ".xlsx" or ".xls" => await ExtractExcelTextAsync(content),
                    ".pptx" or ".ppt" => await ExtractPowerPointTextAsync(content),
                    ".txt" or ".md" or ".csv" => Encoding.UTF8.GetString(content),
                    _ => await ExtractPlainTextAsync(content)
                };
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, $"Failed to extract text from {fileName}");
                // Fallback to plain text extraction
                return await ExtractPlainTextAsync(content);
            }
        }

        /// <summary>
        /// Extract text from PDF files
        /// </summary>
        private async Task<string> ExtractPdfTextAsync(byte[] content)
        {
            var text = new StringBuilder();
            
            using (var ms = new MemoryStream(content))
            using (var pdfReader = new PdfReader(ms))
            using (var pdfDocument = new PdfDocument(pdfReader))
            {
                for (int i = 1; i <= pdfDocument.GetNumberOfPages(); i++)
                {
                    var page = pdfDocument.GetPage(i);
                    var pageText = PdfTextExtractor.GetTextFromPage(page);
                    
                    if (!string.IsNullOrWhiteSpace(pageText))
                    {
                        text.AppendLine($"--- Page {i} ---");
                        text.AppendLine(pageText);
                        text.AppendLine();
                    }
                }
            }
            
            return text.ToString();
        }

        /// <summary>
        /// Extract text from Word documents
        /// </summary>
        private async Task<string> ExtractWordTextAsync(byte[] content)
        {
            var text = new StringBuilder();
            
            using (var ms = new MemoryStream(content))
            using (var wordDoc = WordprocessingDocument.Open(ms, false))
            {
                var body = wordDoc.MainDocumentPart?.Document?.Body;
                
                if (body != null)
                {
                    // Extract paragraphs
                    foreach (var paragraph in body.Descendants<Paragraph>())
                    {
                        var paragraphText = paragraph.InnerText?.Trim();
                        if (!string.IsNullOrWhiteSpace(paragraphText))
                        {
                            text.AppendLine(paragraphText);
                        }
                    }
                    
                    // Extract tables
                    foreach (var table in body.Descendants<Table>())
                    {
                        foreach (var row in table.Descendants<TableRow>())
                        {
                            var cells = row.Descendants<TableCell>()
                                .Select(c => c.InnerText?.Trim())
                                .Where(t => !string.IsNullOrWhiteSpace(t));
                            
                            if (cells.Any())
                            {
                                text.AppendLine(string.Join(" | ", cells));
                            }
                        }
                        text.AppendLine();
                    }
                }
                
                // Also check headers and footers
                foreach (var headerPart in wordDoc.MainDocumentPart.HeaderParts)
                {
                    var headerText = headerPart.Header?.InnerText?.Trim();
                    if (!string.IsNullOrWhiteSpace(headerText))
                    {
                        text.AppendLine($"Header: {headerText}");
                    }
                }
            }
            
            return text.ToString();
        }

        /// <summary>
        /// Extract text from Excel spreadsheets
        /// </summary>
        private async Task<string> ExtractExcelTextAsync(byte[] content)
        {
            var text = new StringBuilder();
            
            using (var ms = new MemoryStream(content))
            using (var spreadsheet = SpreadsheetDocument.Open(ms, false))
            {
                var workbookPart = spreadsheet.WorkbookPart;
                var sheets = workbookPart.Workbook.Descendants<Sheet>();
                
                foreach (var sheet in sheets)
                {
                    text.AppendLine($"=== Sheet: {sheet.Name} ===");
                    
                    var worksheetPart = (WorksheetPart)workbookPart.GetPartById(sheet.Id);
                    var sheetData = worksheetPart.Worksheet.Elements<SheetData>().FirstOrDefault();
                    
                    if (sheetData != null)
                    {
                        foreach (var row in sheetData.Elements<Row>())
                        {
                            var cellValues = new List<string>();
                            
                            foreach (var cell in row.Elements<Cell>())
                            {
                                var cellValue = GetCellValue(cell, workbookPart);
                                if (!string.IsNullOrWhiteSpace(cellValue))
                                {
                                    cellValues.Add(cellValue);
                                }
                            }
                            
                            if (cellValues.Any())
                            {
                                text.AppendLine(string.Join(" | ", cellValues));
                            }
                        }
                    }
                    
                    text.AppendLine();
                }
            }
            
            return text.ToString();
        }

        /// <summary>
        /// Helper method to get cell value from Excel
        /// </summary>
        private string GetCellValue(Cell cell, WorkbookPart workbookPart)
        {
            if (cell.CellValue == null)
                return string.Empty;
            
            string value = cell.CellValue.InnerText;
            
            // If the cell contains a string, look it up in the shared string table
            if (cell.DataType != null && cell.DataType.Value == CellValues.SharedString)
            {
                var stringTable = workbookPart.GetPartsOfType<SharedStringTablePart>().FirstOrDefault();
                if (stringTable != null)
                {
                    value = stringTable.SharedStringTable.ElementAt(int.Parse(value)).InnerText;
                }
            }
            
            return value;
        }

        /// <summary>
        /// Extract text from PowerPoint presentations
        /// </summary>
        private async Task<string> ExtractPowerPointTextAsync(byte[] content)
        {
            var text = new StringBuilder();
            
            using (var ms = new MemoryStream(content))
            using (var presentation = PresentationDocument.Open(ms, false))
            {
                var presentationPart = presentation.PresentationPart;
                var slideIds = presentationPart.Presentation.SlideIdList.Elements<SlideId>();
                
                int slideNumber = 1;
                foreach (var slideId in slideIds)
                {
                    var slidePart = (SlidePart)presentationPart.GetPartById(slideId.RelationshipId);
                    
                    text.AppendLine($"--- Slide {slideNumber} ---");
                    
                    // Extract text from all shapes
                    var texts = slidePart.Slide.Descendants<DocumentFormat.OpenXml.Drawing.Text>();
                    foreach (var slideText in texts)
                    {
                        var textContent = slideText.Text?.Trim();
                        if (!string.IsNullOrWhiteSpace(textContent))
                        {
                            text.AppendLine(textContent);
                        }
                    }
                    
                    // Extract text from tables
                    var tables = slidePart.Slide.Descendants<DocumentFormat.OpenXml.Drawing.Table>();
                    foreach (var table in tables)
                    {
                        foreach (var row in table.Descendants<DocumentFormat.OpenXml.Drawing.TableRow>())
                        {
                            var cells = row.Descendants<DocumentFormat.OpenXml.Drawing.TableCell>()
                                .Select(c => c.InnerText?.Trim())
                                .Where(t => !string.IsNullOrWhiteSpace(t));
                            
                            if (cells.Any())
                            {
                                text.AppendLine(string.Join(" | ", cells));
                            }
                        }
                    }
                    
                    text.AppendLine();
                    slideNumber++;
                }
            }
            
            return text.ToString();
        }

        /// <summary>
        /// Fallback plain text extraction
        /// </summary>
        private async Task<string> ExtractPlainTextAsync(byte[] content)
        {
            // Try different encodings
            var encodings = new[] { Encoding.UTF8, Encoding.Unicode, Encoding.ASCII, Encoding.Default };
            
            foreach (var encoding in encodings)
            {
                try
                {
                    var text = encoding.GetString(content);
                    if (!string.IsNullOrWhiteSpace(text) && !text.Contains("\ufffd")) // Check for replacement character
                    {
                        return text;
                    }
                }
                catch
                {
                    // Try next encoding
                }
            }
            
            // Last resort: return UTF8 with replacement characters
            return Encoding.UTF8.GetString(content);
        }
    }
}

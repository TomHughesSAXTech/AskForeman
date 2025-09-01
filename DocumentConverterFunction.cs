using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Azure.Storage.Blobs;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using DocumentFormat.OpenXml.Spreadsheet;
using iTextSharp.text.pdf;
using iTextSharp.text.pdf.parser;
using System.Text;
using System.Linq;
using DocumentFormat.OpenXml.Presentation;

public static class DocumentConverterHTTP
{
    [FunctionName("DocumentConverterHTTP")]
    public static async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = null)] HttpRequest req,
        ILogger log)
    {
        log.LogInformation("Document converter function triggered");

        try
        {
            // Parse request body
            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            dynamic data = JsonConvert.DeserializeObject(requestBody);
            
            string blobUrl = data?.BlobUrl;
            string fileName = data?.FileName;
            string client = data?.Client;
            string category = data?.Category;

            // Validate required parameters
            if (string.IsNullOrEmpty(blobUrl) || string.IsNullOrEmpty(fileName))
            {
                log.LogError("Missing required parameters: BlobUrl or FileName");
                return new BadRequestObjectResult(new 
                { 
                    success = false, 
                    error = "BlobUrl and FileName are required" 
                });
            }

            log.LogInformation($"Processing file: {fileName} from {blobUrl}");

            // Download the blob
            BlobClient blobClient = new BlobClient(new Uri(blobUrl));
            var response = await blobClient.DownloadAsync();
            
            using (var memoryStream = new MemoryStream())
            {
                await response.Value.Content.CopyToAsync(memoryStream);
                memoryStream.Position = 0;

                // Extract text based on file type
                string extractedText = "";
                string fileExtension = Path.GetExtension(fileName).ToLower();
                
                log.LogInformation($"File extension: {fileExtension}");

                switch (fileExtension)
                {
                    case ".pdf":
                        extractedText = ExtractTextFromPdf(memoryStream, log);
                        break;
                    
                    case ".docx":
                        extractedText = ExtractTextFromDocx(memoryStream, log);
                        break;
                    
                    case ".doc":
                        extractedText = ExtractTextFromDoc(memoryStream, log);
                        break;
                    
                    case ".xlsx":
                    case ".xls":
                        extractedText = ExtractTextFromExcel(memoryStream, fileExtension, log);
                        break;
                    
                    case ".pptx":
                        extractedText = ExtractTextFromPowerPoint(memoryStream, log);
                        break;
                    
                    case ".txt":
                        extractedText = ExtractTextFromTxt(memoryStream, log);
                        break;
                    
                    default:
                        log.LogWarning($"Unsupported file type: {fileExtension}");
                        extractedText = $"Unsupported file type: {fileExtension}. Only PDF, DOCX, DOC, XLSX, XLS, PPTX, and TXT files are supported.";
                        break;
                }

                // Create the response
                var result = new
                {
                    success = true,
                    fileName = fileName,
                    client = client,
                    category = category,
                    fileType = fileExtension,
                    content = extractedText,
                    extractedLength = extractedText.Length,
                    processedAt = DateTime.UtcNow.ToString("o")
                };

                log.LogInformation($"Successfully processed {fileName}, extracted {extractedText.Length} characters");
                return new OkObjectResult(result);
            }
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Error processing document");
            return new StatusCodeResult(StatusCodes.Status500InternalServerError);
        }
    }

    private static string ExtractTextFromPdf(Stream stream, ILogger log)
    {
        try
        {
            StringBuilder text = new StringBuilder();
            using (PdfReader reader = new PdfReader(stream))
            {
                for (int page = 1; page <= reader.NumberOfPages; page++)
                {
                    text.Append(PdfTextExtractor.GetTextFromPage(reader, page));
                    text.Append("\n");
                }
            }
            return text.ToString();
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Error extracting text from PDF");
            return "Error extracting PDF content: " + ex.Message;
        }
    }

    private static string ExtractTextFromDocx(Stream stream, ILogger log)
    {
        try
        {
            StringBuilder text = new StringBuilder();
            using (WordprocessingDocument doc = WordprocessingDocument.Open(stream, false))
            {
                var body = doc.MainDocumentPart.Document.Body;
                foreach (var paragraph in body.Elements<Paragraph>())
                {
                    text.AppendLine(paragraph.InnerText);
                }
                
                // Also extract text from tables
                foreach (var table in body.Elements<Table>())
                {
                    foreach (var row in table.Elements<TableRow>())
                    {
                        foreach (var cell in row.Elements<TableCell>())
                        {
                            text.Append(cell.InnerText + "\t");
                        }
                        text.AppendLine();
                    }
                }
            }
            return text.ToString();
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Error extracting text from DOCX");
            return "Error extracting DOCX content: " + ex.Message;
        }
    }

    private static string ExtractTextFromDoc(Stream stream, ILogger log)
    {
        try
        {
            // For older .doc files, you might need to use a different library like NPOI
            // This is a simplified version - you may need Microsoft.Office.Interop.Word or NPOI
            log.LogWarning("DOC format requires additional libraries. Attempting basic extraction.");
            
            // Try to read as DOCX first (some .doc files are actually .docx)
            try
            {
                return ExtractTextFromDocx(stream, log);
            }
            catch
            {
                // If that fails, return a message
                return "Legacy DOC format detected. Please convert to DOCX for full text extraction.";
            }
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Error extracting text from DOC");
            return "Error extracting DOC content: " + ex.Message;
        }
    }

    private static string ExtractTextFromExcel(Stream stream, string extension, ILogger log)
    {
        try
        {
            StringBuilder text = new StringBuilder();
            using (SpreadsheetDocument document = SpreadsheetDocument.Open(stream, false))
            {
                WorkbookPart workbookPart = document.WorkbookPart;
                SharedStringTablePart sharedStringPart = workbookPart.GetPartsOfType<SharedStringTablePart>().FirstOrDefault();
                
                foreach (WorksheetPart worksheetPart in workbookPart.WorksheetParts)
                {
                    Worksheet worksheet = worksheetPart.Worksheet;
                    SheetData sheetData = worksheet.GetFirstChild<SheetData>();
                    
                    foreach (Row row in sheetData.Elements<Row>())
                    {
                        foreach (Cell cell in row.Elements<Cell>())
                        {
                            string cellValue = GetCellValue(cell, sharedStringPart);
                            text.Append(cellValue + "\t");
                        }
                        text.AppendLine();
                    }
                    text.AppendLine(); // Separate sheets
                }
            }
            return text.ToString();
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Error extracting text from Excel");
            return "Error extracting Excel content: " + ex.Message;
        }
    }

    private static string GetCellValue(Cell cell, SharedStringTablePart sharedStringPart)
    {
        if (cell.CellValue == null)
            return string.Empty;

        string value = cell.CellValue.InnerText;

        if (cell.DataType != null && cell.DataType.Value == CellValues.SharedString)
        {
            if (sharedStringPart != null)
            {
                return sharedStringPart.SharedStringTable.ChildElements[int.Parse(value)].InnerText;
            }
        }

        return value;
    }

    private static string ExtractTextFromPowerPoint(Stream stream, ILogger log)
    {
        try
        {
            StringBuilder text = new StringBuilder();
            using (PresentationDocument document = PresentationDocument.Open(stream, false))
            {
                PresentationPart presentationPart = document.PresentationPart;
                
                if (presentationPart != null && presentationPart.Presentation != null)
                {
                    Presentation presentation = presentationPart.Presentation;
                    
                    if (presentation.SlideIdList != null)
                    {
                        foreach (var slideId in presentation.SlideIdList.Elements<SlideId>())
                        {
                            SlidePart slidePart = presentationPart.GetPartById(slideId.RelationshipId) as SlidePart;
                            if (slidePart != null)
                            {
                                // Extract text from slide
                                var slide = slidePart.Slide;
                                if (slide != null)
                                {
                                    foreach (var paragraph in slide.Descendants<DocumentFormat.OpenXml.Drawing.Paragraph>())
                                    {
                                        foreach (var text_run in paragraph.Descendants<DocumentFormat.OpenXml.Drawing.Text>())
                                        {
                                            text.AppendLine(text_run.Text);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return text.ToString();
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Error extracting text from PowerPoint");
            return "Error extracting PowerPoint content: " + ex.Message;
        }
    }

    private static string ExtractTextFromTxt(Stream stream, ILogger log)
    {
        try
        {
            using (StreamReader reader = new StreamReader(stream))
            {
                return reader.ReadToEnd();
            }
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Error extracting text from TXT");
            return "Error extracting TXT content: " + ex.Message;
        }
    }
}

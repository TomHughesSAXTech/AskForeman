using System;
using System.IO;
using System.Net;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Azure.Storage.Blobs;
using Azure.Search.Documents;
using Azure.Search.Documents.Models;
using Azure.AI.OpenAI;
using Azure.AI.FormRecognizer.DocumentAnalysis;
using Azure;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Security.Cryptography;
using Newtonsoft.Json;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Presentation;
using Word = DocumentFormat.OpenXml.Wordprocessing;
using Excel = DocumentFormat.OpenXml.Spreadsheet;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;

namespace SAXTech.FunctionApps
{
    public class ConvertDocument
    {
        private readonly ILogger<ConvertDocument> _logger;
        private readonly string _documentIntelligenceEndpoint;
        private readonly string _documentIntelligenceKey;
        private readonly bool _enableOCR;

        public ConvertDocument(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<ConvertDocument>();
            _documentIntelligenceEndpoint = Environment.GetEnvironmentVariable("DOCUMENT_INTELLIGENCE_ENDPOINT");
            _documentIntelligenceKey = Environment.GetEnvironmentVariable("DOCUMENT_INTELLIGENCE_KEY");
            _enableOCR = Environment.GetEnvironmentVariable("FEATURE_ENABLE_OCR")?.ToLower() == "true";
        }

        [Function("ConvertDocument")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Function, "post")] HttpRequestData req)
        {
            _logger.LogInformation("Processing document conversion request");

            try
            {
                // Parse multipart form data
                var formData = await ParseMultipartForm(req);
                
                if (formData.File == null)
                {
                    return await CreateErrorResponse(req, "No file uploaded", HttpStatusCode.BadRequest);
                }

                // Extract text with OCR support
                var extractedText = await ExtractTextWithOCRSupport(
                    formData.File.Content, 
                    formData.File.FileName,
                    formData.UseOCR
                );

                if (string.IsNullOrEmpty(extractedText))
                {
                    _logger.LogWarning($"No text extracted from {formData.File.FileName}");
                    
                    // Try OCR as fallback for PDFs
                    if (formData.File.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) && _enableOCR)
                    {
                        _logger.LogInformation("Attempting OCR extraction as fallback");
                        extractedText = await ExtractWithDocumentIntelligence(formData.File.Content);
                    }
                    
                    if (string.IsNullOrEmpty(extractedText))
                    {
                        return await CreateErrorResponse(req, "Could not extract text from document", HttpStatusCode.BadRequest);
                    }
                }

                // Process and index the document
                var result = await ProcessDocument(
                    formData.File.Content,
                    formData.File.FileName,
                    extractedText,
                    formData.Client,
                    formData.Category
                );

                // Create success response
                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(result);
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing document");
                return await CreateErrorResponse(req, "Internal server error", HttpStatusCode.InternalServerError);
            }
        }

        private async Task<string> ExtractTextWithOCRSupport(byte[] content, string fileName, bool useOCR)
        {
            var extension = Path.GetExtension(fileName)?.ToLowerInvariant() ?? "";
            
            // Check if OCR is requested for scanned documents
            if (useOCR && _enableOCR && (extension == ".pdf" || IsImageFile(extension)))
            {
                _logger.LogInformation($"Using Document Intelligence OCR for {fileName}");
                return await ExtractWithDocumentIntelligence(content);
            }

            // Standard extraction based on file type
            return extension switch
            {
                ".pdf" => await ExtractPdfText(content),
                ".docx" or ".doc" => await ExtractWordText(content),
                ".xlsx" or ".xls" => await ExtractExcelText(content),
                ".pptx" or ".ppt" => await ExtractPowerPointText(content),
                ".txt" or ".md" or ".csv" => Encoding.UTF8.GetString(content),
                _ when IsImageFile(extension) && _enableOCR => await ExtractWithDocumentIntelligence(content),
                _ => ExtractPlainText(content)
            };
        }

        private async Task<string> ExtractWithDocumentIntelligence(byte[] content)
        {
            if (string.IsNullOrEmpty(_documentIntelligenceEndpoint) || string.IsNullOrEmpty(_documentIntelligenceKey))
            {
                _logger.LogWarning("Document Intelligence not configured");
                return string.Empty;
            }

            try
            {
                var client = new DocumentAnalysisClient(
                    new Uri(_documentIntelligenceEndpoint),
                    new AzureKeyCredential(_documentIntelligenceKey)
                );

                using var stream = new MemoryStream(content);
                
                // Use prebuilt-read model (included in free tier - 500 pages/month)
                var operation = await client.AnalyzeDocumentAsync(
                    WaitUntil.Completed,
                    "prebuilt-read",
                    stream
                );

                var result = operation.Value;
                var textBuilder = new StringBuilder();

                foreach (var page in result.Pages)
                {
                    textBuilder.AppendLine($"--- Page {page.PageNumber} ---");
                    
                    if (page.Lines != null)
                    {
                        foreach (var line in page.Lines)
                        {
                            textBuilder.AppendLine(line.Content);
                        }
                    }
                    
                    textBuilder.AppendLine();
                }

                // Extract tables if present
                if (result.Tables != null && result.Tables.Count > 0)
                {
                    textBuilder.AppendLine("--- Tables ---");
                    foreach (var table in result.Tables)
                    {
                        for (int i = 0; i < table.RowCount; i++)
                        {
                            var rowCells = table.Cells
                                .Where(c => c.RowIndex == i)
                                .OrderBy(c => c.ColumnIndex)
                                .Select(c => c.Content);
                            textBuilder.AppendLine(string.Join(" | ", rowCells));
                        }
                        textBuilder.AppendLine();
                    }
                }

                var extractedText = textBuilder.ToString();
                _logger.LogInformation($"OCR extracted {extractedText.Length} characters");
                return extractedText;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Document Intelligence OCR failed");
                return string.Empty;
            }
        }

        private async Task<string> ExtractPdfText(byte[] content)
        {
            var text = new StringBuilder();
            
            try
            {
                using var ms = new MemoryStream(content);
                using var pdfReader = new PdfReader(ms);
                using var pdfDocument = new PdfDocument(pdfReader);
                
                for (int i = 1; i <= pdfDocument.GetNumberOfPages(); i++)
                {
                    try
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
                    catch (Exception ex)
                    {
                        _logger.LogWarning($"Failed to extract text from PDF page {i}: {ex.Message}");
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "PDF extraction failed");
            }
            
            return text.ToString();
        }

        private async Task<string> ExtractWordText(byte[] content)
        {
            var text = new StringBuilder();
            
            try
            {
                using var ms = new MemoryStream(content);
                using var wordDoc = WordprocessingDocument.Open(ms, false);
                
                var body = wordDoc.MainDocumentPart?.Document?.Body;
                if (body != null)
                {
                    foreach (var paragraph in body.Descendants<Word.Paragraph>())
                    {
                        var paragraphText = paragraph.InnerText?.Trim();
                        if (!string.IsNullOrWhiteSpace(paragraphText))
                        {
                            text.AppendLine(paragraphText);
                        }
                    }
                    
                    foreach (var table in body.Descendants<Word.Table>())
                    {
                        foreach (var row in table.Descendants<Word.TableRow>())
                        {
                            var cells = row.Descendants<Word.TableCell>()
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
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Word extraction failed");
            }
            
            return text.ToString();
        }

        private async Task<string> ExtractExcelText(byte[] content)
        {
            var text = new StringBuilder();
            
            try
            {
                using var ms = new MemoryStream(content);
                using var spreadsheet = SpreadsheetDocument.Open(ms, false);
                
                var workbookPart = spreadsheet.WorkbookPart;
                var sheets = workbookPart.Workbook.Descendants<Excel.Sheet>();
                
                foreach (var sheet in sheets)
                {
                    text.AppendLine($"=== Sheet: {sheet.Name} ===");
                    
                    var worksheetPart = (WorksheetPart)workbookPart.GetPartById(sheet.Id!);
                    var sheetData = worksheetPart.Worksheet.Elements<Excel.SheetData>().FirstOrDefault();
                    
                    if (sheetData != null)
                    {
                        foreach (var row in sheetData.Elements<Excel.Row>())
                        {
                            var cellValues = new List<string>();
                            
                            foreach (var cell in row.Elements<Excel.Cell>())
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
            catch (Exception ex)
            {
                _logger.LogError(ex, "Excel extraction failed");
            }
            
            return text.ToString();
        }

        private string GetCellValue(Excel.Cell cell, WorkbookPart workbookPart)
        {
            if (cell.CellValue == null) return string.Empty;
            
            string value = cell.CellValue.InnerText;
            
            if (cell.DataType != null && cell.DataType.Value == Excel.CellValues.SharedString)
            {
                var stringTable = workbookPart.GetPartsOfType<SharedStringTablePart>().FirstOrDefault();
                if (stringTable != null)
                {
                    value = stringTable.SharedStringTable.ElementAt(int.Parse(value)).InnerText;
                }
            }
            
            return value;
        }

        private async Task<string> ExtractPowerPointText(byte[] content)
        {
            var text = new StringBuilder();
            
            try
            {
                using var ms = new MemoryStream(content);
                using var presentation = PresentationDocument.Open(ms, false);
                
                var presentationPart = presentation.PresentationPart;
                var slideIds = presentationPart.Presentation.SlideIdList.Elements<SlideId>();
                
                int slideNumber = 1;
                foreach (var slideId in slideIds)
                {
                    var slidePart = (SlidePart)presentationPart.GetPartById(slideId.RelationshipId);
                    
                    text.AppendLine($"--- Slide {slideNumber} ---");
                    
                    var texts = slidePart.Slide.Descendants<DocumentFormat.OpenXml.Drawing.Text>();
                    foreach (var slideText in texts)
                    {
                        var textContent = slideText.Text?.Trim();
                        if (!string.IsNullOrWhiteSpace(textContent))
                        {
                            text.AppendLine(textContent);
                        }
                    }
                    
                    text.AppendLine();
                    slideNumber++;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "PowerPoint extraction failed");
            }
            
            return text.ToString();
        }

        private string ExtractPlainText(byte[] content)
        {
            var encodings = new[] { Encoding.UTF8, Encoding.Unicode, Encoding.ASCII, Encoding.Default };
            
            foreach (var encoding in encodings)
            {
                try
                {
                    var text = encoding.GetString(content);
                    if (!string.IsNullOrWhiteSpace(text) && !text.Contains("\ufffd"))
                    {
                        return text;
                    }
                }
                catch { }
            }
            
            return Encoding.UTF8.GetString(content);
        }

        private async Task<DocumentProcessResult> ProcessDocument(
            byte[] content, 
            string fileName, 
            string extractedText,
            string client,
            string category)
        {
            var documentId = GenerateDocumentId(client, fileName);
            
            // Store in blob storage
            var blobUrl = await StoreInBlobStorage(content, client, category, fileName);
            
            // Generate embeddings
            var embeddings = await GenerateEmbeddings(extractedText);
            
            // Chunk document
            var chunks = ChunkDocument(extractedText, 4000);
            
            // Index in search
            await IndexInCognitiveSearch(
                documentId, fileName, extractedText, chunks, 
                embeddings, client, category, blobUrl
            );
            
            return new DocumentProcessResult
            {
                Success = true,
                Message = "Document processed successfully",
                DocumentId = documentId,
                FileName = fileName,
                Client = client,
                Category = category,
                TextLength = extractedText.Length,
                ChunkCount = chunks.Count,
                BlobUrl = blobUrl,
                OcrUsed = _enableOCR
            };
        }

        private async Task<float[]> GenerateEmbeddings(string text)
        {
            try
            {
                var openAiEndpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT");
                var openAiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_KEY");
                var deploymentName = Environment.GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT_NAME") ?? "text-embedding-ada-002";
                
                var client = new OpenAIClient(
                    new Uri(openAiEndpoint),
                    new AzureKeyCredential(openAiKey)
                );

                // Truncate if too long
                if (text.Length > 32000) text = text.Substring(0, 32000);

                var response = await client.GetEmbeddingsAsync(
                    new EmbeddingsOptions(deploymentName, new[] { text })
                );

                return response.Value.Data[0].Embedding.ToArray();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to generate embeddings");
                return new float[1536]; // Default size for ada-002
            }
        }

        private List<string> ChunkDocument(string text, int chunkSize)
        {
            var chunks = new List<string>();
            
            if (text.Length <= chunkSize)
            {
                chunks.Add(text);
                return chunks;
            }

            var words = text.Split(' ');
            var currentChunk = new StringBuilder();
            
            foreach (var word in words)
            {
                if (currentChunk.Length + word.Length + 1 > chunkSize)
                {
                    if (currentChunk.Length > 0)
                    {
                        chunks.Add(currentChunk.ToString());
                        currentChunk.Clear();
                    }
                }
                
                if (currentChunk.Length > 0)
                    currentChunk.Append(' ');
                currentChunk.Append(word);
            }
            
            if (currentChunk.Length > 0)
            {
                chunks.Add(currentChunk.ToString());
            }
            
            return chunks;
        }

        private async Task<string> StoreInBlobStorage(byte[] content, string client, string category, string fileName)
        {
            try
            {
                var connectionString = Environment.GetEnvironmentVariable("AzureWebJobsStorage");
                var blobServiceClient = new BlobServiceClient(connectionString);
                var containerName = $"{client.ToLower()}-documents";
                var containerClient = blobServiceClient.GetBlobContainerClient(containerName);
                
                await containerClient.CreateIfNotExistsAsync();
                
                var blobName = $"{category}/{DateTime.UtcNow:yyyy-MM-dd}/{fileName}";
                var blobClient = containerClient.GetBlobClient(blobName);
                
                using var ms = new MemoryStream(content);
                await blobClient.UploadAsync(ms, overwrite: true);
                
                return blobClient.Uri.ToString();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to store in blob storage");
                return null;
            }
        }

        private async Task IndexInCognitiveSearch(
            string documentId, string fileName, string content,
            List<string> chunks, float[] embeddings,
            string client, string category, string blobUrl)
        {
            try
            {
                var searchEndpoint = Environment.GetEnvironmentVariable("SEARCH_SERVICE_ENDPOINT");
                var searchKey = Environment.GetEnvironmentVariable("SEARCH_API_KEY");
                var indexName = Environment.GetEnvironmentVariable("AZURE_SEARCH_INDEX_NAME") ?? "fcs-construction-docs-index-v2";
                
                var searchClient = new SearchClient(
                    new Uri(searchEndpoint),
                    indexName,
                    new AzureKeyCredential(searchKey)
                );

                var documents = new List<SearchDocument>();
                
                // Main document
                var mainDoc = new SearchDocument
                {
                    ["id"] = documentId,
                    ["source_id"] = documentId,
                    ["title"] = fileName,
                    ["content"] = content,
                    ["client"] = client,
                    ["category"] = category,
                    ["blob_url"] = blobUrl,
                    ["upload_date"] = DateTime.UtcNow,
                    ["file_name"] = fileName,
                    ["content_vector"] = embeddings,
                    ["chunk_id"] = "0",
                    ["parent_id"] = documentId
                };
                documents.Add(mainDoc);

                // Chunk documents
                for (int i = 1; i < chunks.Count; i++)
                {
                    var chunkDoc = new SearchDocument
                    {
                        ["id"] = $"{documentId}_chunk_{i}",
                        ["source_id"] = documentId,
                        ["title"] = $"{fileName} - Part {i + 1}",
                        ["content"] = chunks[i],
                        ["client"] = client,
                        ["category"] = category,
                        ["blob_url"] = blobUrl,
                        ["upload_date"] = DateTime.UtcNow,
                        ["file_name"] = fileName,
                        ["chunk_id"] = i.ToString(),
                        ["parent_id"] = documentId
                    };
                    
                    if (chunks[i].Length > 100)
                    {
                        var chunkEmbeddings = await GenerateEmbeddings(chunks[i]);
                        chunkDoc["content_vector"] = chunkEmbeddings;
                    }
                    
                    documents.Add(chunkDoc);
                }

                await searchClient.MergeOrUploadDocumentsAsync(documents);
                _logger.LogInformation($"Indexed {documents.Count} documents for {fileName}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to index in Cognitive Search");
                throw;
            }
        }

        private string GenerateDocumentId(string client, string fileName)
        {
            var input = $"{client}_{fileName}_{DateTime.UtcNow.Ticks}";
            using var sha256 = SHA256.Create();
            var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(input));
            return Convert.ToBase64String(hash)
                .Replace("/", "_")
                .Replace("+", "-")
                .Replace("=", "")
                .Substring(0, 32);
        }

        private bool IsImageFile(string extension)
        {
            return new[] { ".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".gif" }.Contains(extension);
        }

        private async Task<FormData> ParseMultipartForm(HttpRequestData req)
        {
            // Simple form parsing - in production use a proper multipart parser
            var formData = new FormData();
            
            // This is simplified - you'd need proper multipart parsing here
            // For now, assuming the form data structure
            var body = await new StreamReader(req.Body).ReadToEndAsync();
            
            // Parse client, category, and file from form data
            // This would need proper implementation
            formData.Client = "default";
            formData.Category = "general";
            formData.UseOCR = false;
            
            return formData;
        }

        private async Task<HttpResponseData> CreateErrorResponse(HttpRequestData req, string message, HttpStatusCode statusCode)
        {
            var response = req.CreateResponse(statusCode);
            await response.WriteAsJsonAsync(new { error = message });
            return response;
        }

        private class FormData
        {
            public FileUpload File { get; set; }
            public string Client { get; set; }
            public string Category { get; set; }
            public bool UseOCR { get; set; }
        }

        private class FileUpload
        {
            public string FileName { get; set; }
            public byte[] Content { get; set; }
        }

        private class DocumentProcessResult
        {
            public bool Success { get; set; }
            public string Message { get; set; }
            public string DocumentId { get; set; }
            public string FileName { get; set; }
            public string Client { get; set; }
            public string Category { get; set; }
            public int TextLength { get; set; }
            public int ChunkCount { get; set; }
            public string BlobUrl { get; set; }
            public bool OcrUsed { get; set; }
        }
    }
}

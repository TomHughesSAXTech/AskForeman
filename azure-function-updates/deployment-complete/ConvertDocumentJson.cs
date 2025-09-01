using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Azure.Storage.Blobs;
using Azure.Search.Documents;
using Azure.Search.Documents.Models;
using Azure.AI.OpenAI;
using Azure;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Presentation;
using Word = DocumentFormat.OpenXml.Wordprocessing;
using Excel = DocumentFormat.OpenXml.Spreadsheet;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using System.Security.Cryptography;
using Newtonsoft.Json;

namespace SAXTech.DocConverter
{
    public class ConvertDocumentJson
    {
        private readonly string searchServiceEndpoint;
        private readonly string searchApiKey;
        private readonly string openAiEndpoint;
        private readonly string openAiKey;
        private readonly string openAiDeploymentName;
        private readonly string searchIndexName;
        private readonly string storageConnectionString;
        
        public ConvertDocumentJson()
        {
            // Use STORAGE_CONNECTION_STRING for saxtechfcs storage account
            storageConnectionString = Environment.GetEnvironmentVariable("STORAGE_CONNECTION_STRING") 
                ?? Environment.GetEnvironmentVariable("AzureWebJobsStorage");
            
            searchServiceEndpoint = Environment.GetEnvironmentVariable("SEARCH_SERVICE_ENDPOINT") 
                ?? "https://fcssearchservice.search.windows.net";
            searchApiKey = Environment.GetEnvironmentVariable("SEARCH_API_KEY") 
                ?? Environment.GetEnvironmentVariable("SEARCH_ADMIN_KEY")
                ?? "UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv";
            openAiEndpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT");
            openAiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_KEY");
            openAiDeploymentName = Environment.GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT_NAME") ?? "text-embedding-ada-002";
            searchIndexName = Environment.GetEnvironmentVariable("AZURE_SEARCH_INDEX_NAME") ?? "fcs-construction-docs-index-v2";
        }

        [FunctionName("ConvertDocumentJson")]
        public async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Function, "post", Route = null)] HttpRequest req,
            ILogger log)
        {
            log.LogInformation("ConvertDocumentJson function processing request.");

            try
            {
                // Read JSON body
                string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                dynamic data = JsonConvert.DeserializeObject(requestBody);
                
                // Extract parameters
                string fileBase64 = data?.file;
                string fileName = data?.fileName ?? "document.pdf";
                string clientName = data?.client ?? "general";
                string category = data?.category ?? "uncategorized";
                string mimeType = data?.mimeType ?? "application/pdf";
                
                if (string.IsNullOrEmpty(fileBase64))
                {
                    return new BadRequestObjectResult("No file data provided");
                }
                
                if (string.IsNullOrEmpty(clientName))
                {
                    return new BadRequestObjectResult("Client name is required");
                }

                // Convert base64 to bytes
                byte[] fileContent = Convert.FromBase64String(fileBase64);
                
                log.LogInformation($"Processing file: {fileName} ({fileContent.Length} bytes) for client: {clientName}");

                // Generate unique document ID
                var documentId = GenerateDocumentId(clientName, fileName);
                
                // Extract text based on file type
                string extractedText = await ExtractTextFromDocument(fileContent, fileName, mimeType, log);
                
                if (string.IsNullOrEmpty(extractedText))
                {
                    log.LogWarning($"No text extracted from file: {fileName}");
                    extractedText = "No text content could be extracted from this document.";
                }

                // Store original file in blob storage
                var originalBlobUrl = await StoreFileInBlobStorage(
                    fileContent, 
                    clientName, 
                    category, 
                    fileName, 
                    "FCS-OriginalClients", 
                    log
                );
                
                // Generate embeddings for vector search (if OpenAI is configured)
                float[] embeddings = null;
                if (!string.IsNullOrEmpty(openAiEndpoint) && !string.IsNullOrEmpty(openAiKey))
                {
                    try
                    {
                        embeddings = await GenerateEmbeddings(extractedText, log);
                    }
                    catch (Exception ex)
                    {
                        log.LogWarning($"Failed to generate embeddings: {ex.Message}");
                        // Continue without embeddings
                    }
                }
                
                // Chunk the document if it's large
                var chunks = ChunkDocument(extractedText, 4000);
                
                // Create converted document with extracted text and metadata
                var convertedDoc = new
                {
                    id = documentId,
                    fileName = fileName,
                    client = clientName,
                    category = category,
                    extractedText = extractedText,
                    chunks = chunks,
                    fileSize = fileContent.Length,
                    mimeType = mimeType,
                    processedAt = DateTime.UtcNow,
                    originalBlobUrl = originalBlobUrl,
                    textLength = extractedText.Length,
                    chunkCount = chunks.Count,
                    hasEmbeddings = embeddings != null
                };
                
                // Store converted document as JSONL
                var convertedContent = JsonConvert.SerializeObject(convertedDoc);
                var convertedFileName = fileName + ".jsonl";
                var convertedBlobUrl = await StoreProcessedFile(
                    convertedContent, 
                    clientName, 
                    category, 
                    convertedFileName, 
                    log
                );
                
                // Index document in Azure Cognitive Search
                try
                {
                    // First, try to delete any existing document with the same ID
                    // This ensures we replace rather than duplicate
                    await DeleteExistingFromIndex(documentId, clientName, category, fileName, log);
                    
                    await IndexDocument(
                        documentId,
                        fileName,
                        extractedText,
                        chunks,
                        embeddings,
                        clientName,
                        category,
                        originalBlobUrl,
                        log
                    );
                    log.LogInformation($"Document indexed successfully: {documentId}");
                }
                catch (Exception ex)
                {
                    log.LogWarning($"Failed to index document: {ex.Message}");
                    // Continue - document is stored even if indexing fails
                }

                return new OkObjectResult(new
                {
                    success = true,
                    message = "Document processed successfully",
                    documentId = documentId,
                    fileName = fileName,
                    client = clientName,
                    category = category,
                    fileSize = fileContent.Length,
                    textLength = extractedText.Length,
                    chunkCount = chunks.Count,
                    originalBlobUrl = originalBlobUrl,
                    convertedBlobUrl = convertedBlobUrl,
                    indexed = true,
                    hasEmbeddings = embeddings != null,
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Error processing document");
                return new ObjectResult(new { error = ex.Message })
                {
                    StatusCode = StatusCodes.Status500InternalServerError
                };
            }
        }

        private async Task<string> ExtractTextFromDocument(byte[] content, string fileName, string mimeType, ILogger log)
        {
            var extension = Path.GetExtension(fileName)?.ToLowerInvariant() ?? "";
            
            try
            {
                return extension switch
                {
                    ".pdf" => await ExtractPdfText(content, log),
                    ".docx" or ".doc" => await ExtractWordText(content, log),
                    ".xlsx" or ".xls" => await ExtractExcelText(content, log),
                    ".pptx" or ".ppt" => await ExtractPowerPointText(content, log),
                    ".txt" or ".md" or ".csv" => Encoding.UTF8.GetString(content),
                    _ => ExtractPlainText(content)
                };
            }
            catch (Exception ex)
            {
                log.LogError(ex, $"Failed to extract text from {fileName}");
                return ExtractPlainText(content);
            }
        }

        private async Task<string> ExtractPdfText(byte[] content, ILogger log)
        {
            var text = new StringBuilder();
            
            using (var ms = new MemoryStream(content))
            using (var pdfReader = new PdfReader(ms))
            using (var pdfDocument = new PdfDocument(pdfReader))
            {
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
                        log.LogWarning($"Failed to extract text from PDF page {i}: {ex.Message}");
                    }
                }
            }
            
            return text.ToString();
        }

        private async Task<string> ExtractWordText(byte[] content, ILogger log)
        {
            var text = new StringBuilder();
            
            using (var ms = new MemoryStream(content))
            using (var wordDoc = WordprocessingDocument.Open(ms, false))
            {
                var body = wordDoc.MainDocumentPart?.Document?.Body;
                if (body != null)
                {
                    foreach (var paragraph in body.Elements<Word.Paragraph>())
                    {
                        text.AppendLine(paragraph.InnerText);
                    }
                    
                    // Also extract text from tables
                    foreach (var table in body.Elements<Word.Table>())
                    {
                        foreach (var row in table.Elements<Word.TableRow>())
                        {
                            foreach (var cell in row.Elements<Word.TableCell>())
                            {
                                text.Append(cell.InnerText + "\t");
                            }
                            text.AppendLine();
                        }
                    }
                }
            }
            
            return text.ToString();
        }

        private async Task<string> ExtractExcelText(byte[] content, ILogger log)
        {
            var text = new StringBuilder();
            
            using (var ms = new MemoryStream(content))
            using (var spreadsheetDoc = SpreadsheetDocument.Open(ms, false))
            {
                var workbookPart = spreadsheetDoc.WorkbookPart;
                var sheets = workbookPart.Workbook.GetFirstChild<Excel.Sheets>().Elements<Excel.Sheet>();
                
                foreach (var sheet in sheets)
                {
                    text.AppendLine($"Sheet: {sheet.Name}");
                    
                    var worksheetPart = (WorksheetPart)workbookPart.GetPartById(sheet.Id);
                    var sheetData = worksheetPart.Worksheet.GetFirstChild<Excel.SheetData>();
                    
                    foreach (var row in sheetData.Elements<Excel.Row>())
                    {
                        foreach (var cell in row.Elements<Excel.Cell>())
                        {
                            var cellValue = GetCellValue(cell, workbookPart);
                            text.Append(cellValue + "\t");
                        }
                        text.AppendLine();
                    }
                    text.AppendLine();
                }
            }
            
            return text.ToString();
        }

        private string GetCellValue(Excel.Cell cell, WorkbookPart workbookPart)
        {
            if (cell.CellValue == null) return "";
            
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

        private async Task<string> ExtractPowerPointText(byte[] content, ILogger log)
        {
            var text = new StringBuilder();
            
            using (var ms = new MemoryStream(content))
            using (var presentationDoc = PresentationDocument.Open(ms, false))
            {
                var presentationPart = presentationDoc.PresentationPart;
                var presentation = presentationPart.Presentation;
                
                var slideIds = presentation.SlideIdList.Elements<SlideId>();
                int slideNumber = 1;
                
                foreach (var slideId in slideIds)
                {
                    var slidePart = (SlidePart)presentationPart.GetPartById(slideId.RelationshipId);
                    text.AppendLine($"--- Slide {slideNumber++} ---");
                    
                    // Extract text from all text elements in the slide
                    var texts = slidePart.Slide.Descendants<DocumentFormat.OpenXml.Drawing.Text>();
                    foreach (var t in texts)
                    {
                        text.AppendLine(t.Text);
                    }
                    text.AppendLine();
                }
            }
            
            return text.ToString();
        }

        private string ExtractPlainText(byte[] content)
        {
            try
            {
                // Try UTF-8 first
                return Encoding.UTF8.GetString(content);
            }
            catch
            {
                try
                {
                    // Fallback to ASCII
                    return Encoding.ASCII.GetString(content);
                }
                catch
                {
                    return "Unable to extract text from this file format.";
                }
            }
        }

        private async Task<float[]> GenerateEmbeddings(string text, ILogger log)
        {
            try
            {
                var client = new OpenAIClient(new Uri(openAiEndpoint), new AzureKeyCredential(openAiKey));
                
                // Truncate text if too long for embedding model
                var truncatedText = text.Length > 8000 ? text.Substring(0, 8000) : text;
                
                var options = new EmbeddingsOptions(openAiDeploymentName, new[] { truncatedText });
                var response = await client.GetEmbeddingsAsync(options);
                
                return response.Value.Data[0].Embedding.ToArray();
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Failed to generate embeddings");
                throw;
            }
        }

        private List<string> ChunkDocument(string text, int chunkSize)
        {
            var chunks = new List<string>();
            
            if (string.IsNullOrEmpty(text))
                return chunks;
            
            // Split by paragraphs first
            var paragraphs = text.Split(new[] { "\r\n\r\n", "\n\n" }, StringSplitOptions.RemoveEmptyEntries);
            var currentChunk = new StringBuilder();
            
            foreach (var paragraph in paragraphs)
            {
                if (currentChunk.Length + paragraph.Length > chunkSize)
                {
                    if (currentChunk.Length > 0)
                    {
                        chunks.Add(currentChunk.ToString());
                        currentChunk.Clear();
                    }
                }
                
                if (paragraph.Length > chunkSize)
                {
                    // Split large paragraphs
                    var words = paragraph.Split(' ');
                    foreach (var word in words)
                    {
                        if (currentChunk.Length + word.Length + 1 > chunkSize)
                        {
                            chunks.Add(currentChunk.ToString());
                            currentChunk.Clear();
                        }
                        
                        if (currentChunk.Length > 0)
                            currentChunk.Append(" ");
                        currentChunk.Append(word);
                    }
                }
                else
                {
                    if (currentChunk.Length > 0)
                        currentChunk.Append("\n\n");
                    currentChunk.Append(paragraph);
                }
            }
            
            if (currentChunk.Length > 0)
                chunks.Add(currentChunk.ToString());
            
            return chunks;
        }

        private async Task DeleteExistingFromIndex(string documentId, string clientName, string category, string fileName, ILogger log)
        {
            try
            {
                var searchClient = new SearchClient(
                    new Uri(searchServiceEndpoint),
                    searchIndexName,
                    new AzureKeyCredential(searchApiKey)
                );
                
                // Try to delete by ID first (most efficient)
                try
                {
                    await searchClient.DeleteDocumentsAsync("id", new[] { documentId });
                    log.LogInformation($"Deleted existing document with ID: {documentId}");
                }
                catch
                {
                    // Document might not exist, which is fine
                }
                
                // Also search for any documents with same client/category/fileName combination
                // This handles legacy documents that might have different ID formats
                var filter = $"client eq '{clientName}' and category eq '{category}'";
                var searchOptions = new SearchOptions
                {
                    Filter = filter,
                    Size = 100,
                    Select = { "id", "fileName" }
                };
                
                var searchResults = await searchClient.SearchAsync<SearchDocument>("*", searchOptions);
                var documentsToDelete = new List<string>();
                
                await foreach (var result in searchResults.Value.GetResultsAsync())
                {
                    var doc = result.Document;
                    if (doc.TryGetValue("fileName", out var docFileName) && 
                        docFileName?.ToString() == fileName &&
                        doc.TryGetValue("id", out var docId))
                    {
                        var idToDelete = docId.ToString();
                        if (idToDelete != documentId) // Don't re-delete the same ID
                        {
                            documentsToDelete.Add(idToDelete);
                        }
                    }
                }
                
                if (documentsToDelete.Any())
                {
                    await searchClient.DeleteDocumentsAsync("id", documentsToDelete);
                    log.LogInformation($"Deleted {documentsToDelete.Count} existing document(s) with same fileName: {fileName}");
                }
            }
            catch (Exception ex)
            {
                log.LogWarning($"Error checking for existing documents: {ex.Message}");
                // Continue with indexing even if deletion fails
            }
        }
        
        private async Task IndexDocument(
            string documentId,
            string fileName,
            string content,
            List<string> chunks,
            float[] embeddings,
            string clientName,
            string category,
            string blobUrl,
            ILogger log)
        {
            var searchClient = new SearchClient(
                new Uri(searchServiceEndpoint),
                searchIndexName,
                new AzureKeyCredential(searchApiKey)
            );

            var document = new
            {
                id = documentId,
                content = content,
                contentVector = embeddings,
                fileName = fileName,
                client = clientName,
                category = category,
                blobPath = blobUrl,
                uploadedAt = DateTime.UtcNow,
                mimeType = "application/pdf",
                metadata = JsonConvert.SerializeObject(new
                {
                    chunks = chunks.Count,
                    textLength = content.Length,
                    hasEmbeddings = embeddings != null
                })
            };

            var batch = IndexDocumentsBatch.Create(
                IndexDocumentsAction.MergeOrUpload(document)
            );

            await searchClient.IndexDocumentsAsync(batch);
        }

        private string GenerateDocumentId(string clientName, string fileName)
        {
            // Generate consistent ID based on client and fileName (no timestamp)
            // This ensures the same file always gets the same ID for deduplication
            
            // Sanitize client name and file name for Azure Search requirements
            // Azure Search only allows letters, digits, underscore (_), dash (-), or equal sign (=)
            var sanitizedClient = System.Text.RegularExpressions.Regex.Replace(clientName, @"[^a-zA-Z0-9_\-=]", "_");
            var sanitizedFileName = System.Text.RegularExpressions.Regex.Replace(fileName, @"[^a-zA-Z0-9_\-=]", "_");
            
            var hash = Convert.ToBase64String(
                SHA256.Create().ComputeHash(
                    Encoding.UTF8.GetBytes($"{clientName}_{fileName}")
                )
            ).Replace("/", "_").Replace("+", "-").Replace("=", "").Substring(0, 16);
            
            return $"{sanitizedClient}_{sanitizedFileName}_{hash}";
        }

        private async Task<string> StoreFileInBlobStorage(byte[] content, string clientName, string category, string fileName, string containerPrefix, ILogger log)
        {
            try
            {
                var blobServiceClient = new BlobServiceClient(storageConnectionString);
                var containerClient = blobServiceClient.GetBlobContainerClient("fcs-clients");
                await containerClient.CreateIfNotExistsAsync();
                
                var blobPath = $"{containerPrefix}/{clientName}/{category}/{fileName}";
                var blobClient = containerClient.GetBlobClient(blobPath);
                
                using (var ms = new MemoryStream(content))
                {
                    await blobClient.UploadAsync(ms, overwrite: true);
                }
                
                log.LogInformation($"File uploaded to blob storage: {blobPath}");
                return blobClient.Uri.ToString();
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Failed to upload to blob storage");
                throw;
            }
        }

        private async Task<string> StoreProcessedFile(string content, string clientName, string category, string fileName, ILogger log)
        {
            try
            {
                var contentBytes = Encoding.UTF8.GetBytes(content);
                var blobServiceClient = new BlobServiceClient(storageConnectionString);
                var containerClient = blobServiceClient.GetBlobContainerClient("fcs-clients");
                await containerClient.CreateIfNotExistsAsync();
                
                var blobPath = $"FCS-ConvertedClients/{clientName}/{category}/{fileName}";
                var blobClient = containerClient.GetBlobClient(blobPath);
                
                using (var ms = new MemoryStream(contentBytes))
                {
                    await blobClient.UploadAsync(ms, overwrite: true);
                }
                
                log.LogInformation($"Converted file uploaded to blob storage: {blobPath}");
                return blobClient.Uri.ToString();
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Failed to upload converted file to blob storage");
                throw;
            }
        }
    }
}

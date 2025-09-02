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
    public class ConvertDocument
    {
        private readonly string searchServiceEndpoint;
        private readonly string searchApiKey;
        private readonly string openAiEndpoint;
        private readonly string openAiKey;
        private readonly string openAiDeploymentName;
        private readonly string searchIndexName;
        private readonly string storageConnectionString;
        
        public ConvertDocument()
        {
            searchServiceEndpoint = Environment.GetEnvironmentVariable("SEARCH_SERVICE_ENDPOINT");
            searchApiKey = Environment.GetEnvironmentVariable("SEARCH_API_KEY");
            openAiEndpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT");
            openAiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_KEY");
            openAiDeploymentName = Environment.GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT_NAME") ?? "text-embedding-ada-002";
            searchIndexName = Environment.GetEnvironmentVariable("AZURE_SEARCH_INDEX_NAME") ?? "fcs-construction-docs-index-v2";
            storageConnectionString = Environment.GetEnvironmentVariable("AzureWebJobsStorage");
        }

        [FunctionName("ConvertDocument")]
        public async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Function, "post", Route = null)] HttpRequest req,
            ILogger log)
        {
            log.LogInformation("ConvertDocument function processing request.");

            try
            {
                // Parse multipart form data
                var formdata = await req.ReadFormAsync();
                
                if (req.Form.Files.Count == 0)
                {
                    return new BadRequestObjectResult("No file uploaded");
                }

                var file = req.Form.Files[0];
                var clientName = formdata["client"].ToString();
                var category = formdata["category"].ToString();
                
                if (string.IsNullOrEmpty(clientName))
                {
                    return new BadRequestObjectResult("Client name is required");
                }

                // Read file content
                byte[] fileContent;
                using (var ms = new MemoryStream())
                {
                    await file.CopyToAsync(ms);
                    fileContent = ms.ToArray();
                }

                // Generate unique document ID
                var documentId = GenerateDocumentId(clientName, file.FileName);
                
                // Extract text based on file type
                string extractedText = await ExtractTextFromDocument(fileContent, file.FileName, file.ContentType, log);
                
                if (string.IsNullOrEmpty(extractedText))
                {
                    log.LogWarning($"No text extracted from file: {file.FileName}");
                    return new BadRequestObjectResult("Could not extract text from the document");
                }

                // Store original file in blob storage
                var blobUrl = await StoreFileInBlobStorage(fileContent, clientName, category, file.FileName, log);
                
                // Generate embeddings for vector search
                var embeddings = await GenerateEmbeddings(extractedText, log);
                
                // Chunk the document if it's large
                var chunks = ChunkDocument(extractedText, 4000);
                
                // Index document in Azure Cognitive Search
                await IndexDocument(
                    documentId,
                    file.FileName,
                    extractedText,
                    chunks,
                    embeddings,
                    clientName,
                    category,
                    blobUrl,
                    log
                );

                return new OkObjectResult(new
                {
                    success = true,
                    message = "Document processed successfully",
                    documentId = documentId,
                    fileName = file.FileName,
                    client = clientName,
                    category = category,
                    textLength = extractedText.Length,
                    chunkCount = chunks.Count,
                    blobUrl = blobUrl
                });
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Error processing document");
                return new StatusCodeResult(StatusCodes.Status500InternalServerError);
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
                    // Extract paragraphs
                    foreach (var paragraph in body.Descendants<Word.Paragraph>())
                    {
                        var paragraphText = paragraph.InnerText?.Trim();
                        if (!string.IsNullOrWhiteSpace(paragraphText))
                        {
                            text.AppendLine(paragraphText);
                        }
                    }
                    
                    // Extract tables
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
            
            return text.ToString();
        }

        private async Task<string> ExtractExcelText(byte[] content, ILogger log)
        {
            var text = new StringBuilder();
            
            using (var ms = new MemoryStream(content))
            using (var spreadsheet = SpreadsheetDocument.Open(ms, false))
            {
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
            
            return text.ToString();
        }

        private string GetCellValue(Excel.Cell cell, WorkbookPart workbookPart)
        {
            if (cell.CellValue == null)
                return string.Empty;
            
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
            using (var presentation = PresentationDocument.Open(ms, false))
            {
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
                catch
                {
                    continue;
                }
            }
            
            return Encoding.UTF8.GetString(content);
        }

        private async Task<float[]> GenerateEmbeddings(string text, ILogger log)
        {
            try
            {
                var client = new OpenAIClient(
                    new Uri(openAiEndpoint),
                    new AzureKeyCredential(openAiKey)
                );

                // Truncate text if too long for embedding model
                var maxTokens = 8000;
                if (text.Length > maxTokens * 4) // Rough estimate: 1 token ≈ 4 characters
                {
                    text = text.Substring(0, maxTokens * 4);
                }

                var response = await client.GetEmbeddingsAsync(
                    new EmbeddingsOptions(openAiDeploymentName, new[] { text })
                );

                return response.Value.Data[0].Embedding.ToArray();
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Failed to generate embeddings");
                // Return empty embeddings as fallback
                return new float[1536]; // Default dimension for ada-002
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

        private async Task<string> StoreFileInBlobStorage(byte[] content, string client, string category, string fileName, ILogger log)
        {
            try
            {
                var blobServiceClient = new BlobServiceClient(storageConnectionString);
                var containerName = $"{client.ToLower()}-documents";
                var containerClient = blobServiceClient.GetBlobContainerClient(containerName);
                
                await containerClient.CreateIfNotExistsAsync();
                
                var blobName = $"{category}/{DateTime.UtcNow:yyyy-MM-dd}/{fileName}";
                var blobClient = containerClient.GetBlobClient(blobName);
                
                using (var ms = new MemoryStream(content))
                {
                    await blobClient.UploadAsync(ms, overwrite: true);
                }
                
                return blobClient.Uri.ToString();
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Failed to store file in blob storage");
                return null;
            }
        }

        private async Task IndexDocument(
            string documentId,
            string fileName,
            string content,
            List<string> chunks,
            float[] embeddings,
            string client,
            string category,
            string blobUrl,
            ILogger log)
        {
            try
            {
                var searchClient = new SearchClient(
                    new Uri(searchServiceEndpoint),
                    searchIndexName,
                    new AzureKeyCredential(searchApiKey)
                );

                var documents = new List<SearchDocument>();
                
                // Create main document
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

                // Create chunk documents if needed
                for (int i = 0; i < chunks.Count; i++)
                {
                    if (i == 0) continue; // Skip first chunk as it's the main document
                    
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
                    
                    // Generate embeddings for chunk if needed
                    if (chunks[i].Length > 100) // Only for substantial chunks
                    {
                        var chunkEmbeddings = await GenerateEmbeddings(chunks[i], log);
                        chunkDoc["content_vector"] = chunkEmbeddings;
                    }
                    
                    documents.Add(chunkDoc);
                }

                // Upload documents to search index
                var response = await searchClient.MergeOrUploadDocumentsAsync(documents);
                
                log.LogInformation($"Indexed {documents.Count} documents for {fileName}");
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Failed to index document in Azure Cognitive Search");
                throw;
            }
        }

        private string GenerateDocumentId(string client, string fileName)
        {
            var input = $"{client}_{fileName}_{DateTime.UtcNow.Ticks}";
            using (var sha256 = SHA256.Create())
            {
                var hash = sha256.ComputeHash(Encoding.UTF8.GetBytes(input));
                return Convert.ToBase64String(hash)
                    .Replace("/", "_")
                    .Replace("+", "-")
                    .Replace("=", "")
                    .Substring(0, 32);
            }
        }
    }
}

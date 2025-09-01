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
using Azure.AI.FormRecognizer.DocumentAnalysis;
using Azure.Search.Documents;
using Azure.Search.Documents.Indexes;
using Azure;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace SAXTech.Functions
{
    public static class ConvertDocumentFunction
    {
        private static readonly string StorageConnectionString = Environment.GetEnvironmentVariable("AzureWebJobsStorage");
        private static readonly string SearchEndpoint = Environment.GetEnvironmentVariable("SearchEndpoint") ?? "https://fcssearchservice.search.windows.net";
        private static readonly string SearchApiKey = Environment.GetEnvironmentVariable("SearchApiKey") ?? "UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv";
        private static readonly string SearchIndexName = Environment.GetEnvironmentVariable("SearchIndexName") ?? "fcs-construction-docs-index-v2";
        private static readonly string DocumentIntelligenceEndpoint = Environment.GetEnvironmentVariable("DocumentIntelligenceEndpoint") ?? "https://eastus.api.cognitive.microsoft.com/";
        private static readonly string DocumentIntelligenceKey = Environment.GetEnvironmentVariable("DocumentIntelligenceKey");

        [FunctionName("ConvertDocument")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Function, "post", Route = null)] HttpRequest req,
            ILogger log)
        {
            log.LogInformation("ConvertDocument function triggered");

            try
            {
                // Parse request body
                string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                var data = JsonConvert.DeserializeObject<ConvertDocumentRequest>(requestBody);

                if (data == null || string.IsNullOrEmpty(data.BlobUrl))
                {
                    return new BadRequestObjectResult(new { error = "BlobUrl is required" });
                }

                log.LogInformation($"Processing document: {data.FileName} for client: {data.Client}");

                // Initialize blob client
                var blobClient = new BlobClient(new Uri(data.BlobUrl));
                
                // Download the document
                var downloadResponse = await blobClient.DownloadAsync();
                var documentStream = downloadResponse.Value.Content;

                // Process with Azure Document Intelligence (Form Recognizer)
                string extractedText = "";
                var documentMetadata = new Dictionary<string, object>();

                if (!string.IsNullOrEmpty(DocumentIntelligenceKey))
                {
                    try
                    {
                        var credential = new AzureKeyCredential(DocumentIntelligenceKey);
                        var client = new DocumentAnalysisClient(new Uri(DocumentIntelligenceEndpoint), credential);

                        // Analyze the document
                        var operation = await client.AnalyzeDocumentAsync(
                            WaitUntil.Completed,
                            "prebuilt-document",
                            documentStream);

                        var result = operation.Value;

                        // Extract text content
                        var textBuilder = new StringBuilder();
                        textBuilder.AppendLine("=== DOCUMENT ANALYSIS ===");
                        textBuilder.AppendLine($"Document: {data.FileName}");
                        textBuilder.AppendLine($"Client: {data.Client}");
                        textBuilder.AppendLine($"Category: {data.Category}");
                        textBuilder.AppendLine($"Processed: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC");
                        textBuilder.AppendLine();
                        textBuilder.AppendLine("=== EXTRACTED TEXT CONTENT ===");

                        // Extract content from pages
                        foreach (var page in result.Pages)
                        {
                            textBuilder.AppendLine($"--- Page {page.PageNumber} ---");
                            
                            // Extract lines of text
                            if (page.Lines != null)
                            {
                                foreach (var line in page.Lines)
                                {
                                    textBuilder.AppendLine(line.Content);
                                }
                            }

                            // Extract tables if present
                            if (result.Tables != null && result.Tables.Any())
                            {
                                var pageTables = result.Tables.Where(t => t.BoundingRegions.Any(br => br.PageNumber == page.PageNumber));
                                foreach (var table in pageTables)
                                {
                                    textBuilder.AppendLine("\n[TABLE]");
                                    for (int row = 0; row < table.RowCount; row++)
                                    {
                                        var rowCells = table.Cells.Where(c => c.RowIndex == row).OrderBy(c => c.ColumnIndex);
                                        var rowContent = string.Join(" | ", rowCells.Select(c => c.Content));
                                        textBuilder.AppendLine(rowContent);
                                    }
                                    textBuilder.AppendLine("[/TABLE]\n");
                                }
                            }

                            textBuilder.AppendLine();
                        }

                        // Add key-value pairs if found
                        if (result.KeyValuePairs != null && result.KeyValuePairs.Any())
                        {
                            textBuilder.AppendLine("=== KEY-VALUE PAIRS ===");
                            foreach (var kvp in result.KeyValuePairs)
                            {
                                if (kvp.Key != null && kvp.Value != null)
                                {
                                    textBuilder.AppendLine($"{kvp.Key.Content}: {kvp.Value.Content}");
                                    documentMetadata[kvp.Key.Content] = kvp.Value.Content;
                                }
                            }
                            textBuilder.AppendLine();
                        }

                        extractedText = textBuilder.ToString();
                        log.LogInformation($"Successfully extracted {extractedText.Length} characters from document");
                    }
                    catch (Exception ex)
                    {
                        log.LogError(ex, "Error processing with Document Intelligence, falling back to basic extraction");
                        extractedText = $"Document: {data.FileName}\nClient: {data.Client}\nCategory: {data.Category}\nProcessing failed - original document stored";
                    }
                }
                else
                {
                    // Fallback if Document Intelligence is not configured
                    extractedText = $"=== DOCUMENT METADATA ===\nDocument: {data.FileName}\nClient: {data.Client}\nCategory: {data.Category}\nUploaded: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss} UTC\n\nDocument Intelligence not configured - original document stored for future processing.";
                    log.LogWarning("Document Intelligence API key not configured");
                }

                // Create JSONL content for the converted container
                var jsonlContent = new StringBuilder();
                
                // Line 1: Document metadata
                var metadataLine = new
                {
                    fileName = data.FileName,
                    client = data.Client,
                    category = data.Category,
                    originalPath = data.OriginalPath,
                    convertedPath = data.ConvertedPath,
                    processedAt = DateTime.UtcNow,
                    extractedMetadata = documentMetadata,
                    type = "metadata"
                };
                jsonlContent.AppendLine(JsonConvert.SerializeObject(metadataLine));

                // Line 2: Extracted content
                var contentLine = new
                {
                    fileName = data.FileName,
                    client = data.Client,
                    content = extractedText,
                    type = "content"
                };
                jsonlContent.AppendLine(JsonConvert.SerializeObject(contentLine));

                // Upload JSONL to converted container
                if (!string.IsNullOrEmpty(data.ConvertedPath))
                {
                    try
                    {
                        var containerClient = new BlobContainerClient(StorageConnectionString, "fcs-clients");
                        var convertedBlobClient = containerClient.GetBlobClient(data.ConvertedPath);
                        
                        using (var stream = new MemoryStream(Encoding.UTF8.GetBytes(jsonlContent.ToString())))
                        {
                            await convertedBlobClient.UploadAsync(stream, overwrite: true);
                        }
                        
                        log.LogInformation($"Uploaded JSONL to: {data.ConvertedPath}");
                    }
                    catch (Exception ex)
                    {
                        log.LogError(ex, "Failed to upload JSONL to converted container");
                    }
                }

                // Update search index
                try
                {
                    var searchClient = new SearchClient(
                        new Uri(SearchEndpoint),
                        SearchIndexName,
                        new AzureKeyCredential(SearchApiKey));

                    // Generate document ID
                    var documentId = $"{data.Client}_{data.Category}_{data.FileName}"
                        .Replace(" ", "_")
                        .Replace(".", "_")
                        .ToLowerInvariant();

                    var searchDocument = new
                    {
                        id = documentId,
                        content = extractedText,
                        client = data.Client,
                        category = data.Category,
                        fileName = data.FileName,
                        blobPath = data.OriginalPath,
                        convertedPath = data.ConvertedPath,
                        uploadedAt = DateTime.UtcNow,
                        mimeType = GetMimeType(data.FileName),
                        metadata = JsonConvert.SerializeObject(documentMetadata)
                    };

                    var batch = IndexDocumentsBatch.Create(
                        IndexDocumentsAction.MergeOrUpload(searchDocument));

                    var indexResult = await searchClient.IndexDocumentsAsync(batch);
                    
                    log.LogInformation($"Document indexed successfully: {documentId}");
                }
                catch (Exception ex)
                {
                    log.LogError(ex, "Failed to update search index");
                }

                // Return success response
                return new OkObjectResult(new
                {
                    success = true,
                    message = "Document processed successfully",
                    fileName = data.FileName,
                    client = data.Client,
                    category = data.Category,
                    extractedTextLength = extractedText.Length,
                    content = extractedText,
                    processedAt = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Error processing document");
                return new StatusCodeResult(StatusCodes.Status500InternalServerError);
            }
        }

        [FunctionName("DeleteDocument")]
        public static async Task<IActionResult> DeleteDocument(
            [HttpTrigger(AuthorizationLevel.Function, "post", "delete", Route = null)] HttpRequest req,
            ILogger log)
        {
            log.LogInformation("DeleteDocument function triggered");

            try
            {
                string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                var data = JsonConvert.DeserializeObject<DeleteDocumentRequest>(requestBody);

                if (data == null || (string.IsNullOrEmpty(data.FilePath) && string.IsNullOrEmpty(data.Client)))
                {
                    return new BadRequestObjectResult(new { error = "Either FilePath or Client must be provided" });
                }

                var deletedBlobs = new List<string>();
                var deletedIndexDocs = new List<string>();

                // Initialize blob container client
                var containerClient = new BlobContainerClient(StorageConnectionString, "fcs-clients");

                // Delete specific file or entire client
                if (!string.IsNullOrEmpty(data.FilePath))
                {
                    // Delete specific file
                    log.LogInformation($"Deleting file: {data.FilePath}");

                    // Delete from original container
                    try
                    {
                        var originalBlob = containerClient.GetBlobClient(data.FilePath);
                        var deleteResponse = await originalBlob.DeleteIfExistsAsync();
                        if (deleteResponse.Value)
                        {
                            deletedBlobs.Add(data.FilePath);
                        }
                    }
                    catch (Exception ex)
                    {
                        log.LogWarning(ex, $"Failed to delete original file: {data.FilePath}");
                    }

                    // Delete from converted container
                    var convertedPath = data.FilePath.Replace("FCS-OriginalClients", "FCS-ConvertedClients")
                        .Replace(".pdf", ".jsonl")
                        .Replace(".docx", ".jsonl")
                        .Replace(".doc", ".jsonl")
                        .Replace(".xlsx", ".jsonl")
                        .Replace(".xls", ".jsonl");

                    try
                    {
                        var convertedBlob = containerClient.GetBlobClient(convertedPath);
                        var deleteResponse = await convertedBlob.DeleteIfExistsAsync();
                        if (deleteResponse.Value)
                        {
                            deletedBlobs.Add(convertedPath);
                        }
                    }
                    catch (Exception ex)
                    {
                        log.LogWarning(ex, $"Failed to delete converted file: {convertedPath}");
                    }

                    // Delete from search index
                    try
                    {
                        var searchClient = new SearchClient(
                            new Uri(SearchEndpoint),
                            SearchIndexName,
                            new AzureKeyCredential(SearchApiKey));

                        // Generate document ID from file path
                        var pathParts = data.FilePath.Split('/');
                        if (pathParts.Length >= 4)
                        {
                            var client = pathParts[1];
                            var category = pathParts[2];
                            var fileName = pathParts[pathParts.Length - 1];
                            
                            var documentId = $"{client}_{category}_{fileName}"
                                .Replace(" ", "_")
                                .Replace(".", "_")
                                .ToLowerInvariant();

                            var batch = IndexDocumentsBatch.Create(
                                IndexDocumentsAction.Delete("id", documentId));

                            await searchClient.IndexDocumentsAsync(batch);
                            deletedIndexDocs.Add(documentId);
                        }
                    }
                    catch (Exception ex)
                    {
                        log.LogWarning(ex, "Failed to delete from search index");
                    }
                }
                else if (!string.IsNullOrEmpty(data.Client))
                {
                    // Delete entire client
                    log.LogInformation($"Deleting all files for client: {data.Client}");

                    // Delete all blobs for the client
                    var prefixes = new[]
                    {
                        $"FCS-OriginalClients/{data.Client}/",
                        $"FCS-ConvertedClients/{data.Client}/"
                    };

                    foreach (var prefix in prefixes)
                    {
                        await foreach (var blobItem in containerClient.GetBlobsAsync(prefix: prefix))
                        {
                            try
                            {
                                var blobClient = containerClient.GetBlobClient(blobItem.Name);
                                await blobClient.DeleteIfExistsAsync();
                                deletedBlobs.Add(blobItem.Name);
                            }
                            catch (Exception ex)
                            {
                                log.LogWarning(ex, $"Failed to delete blob: {blobItem.Name}");
                            }
                        }
                    }

                    // Delete all documents from search index for this client
                    try
                    {
                        var searchClient = new SearchClient(
                            new Uri(SearchEndpoint),
                            SearchIndexName,
                            new AzureKeyCredential(SearchApiKey));

                        // Search for all documents with this client
                        var searchOptions = new SearchOptions
                        {
                            Filter = $"client eq '{data.Client}'",
                            Select = { "id" },
                            Size = 1000
                        };

                        var searchResults = await searchClient.SearchAsync<SearchDocument>("*", searchOptions);
                        
                        var batch = new List<IndexDocumentsAction<SearchDocument>>();
                        await foreach (var result in searchResults.Value.GetResultsAsync())
                        {
                            var docId = result.Document["id"].ToString();
                            batch.Add(IndexDocumentsAction.Delete("id", docId));
                            deletedIndexDocs.Add(docId);
                        }

                        if (batch.Any())
                        {
                            await searchClient.IndexDocumentsAsync(IndexDocumentsBatch.Create(batch.ToArray()));
                        }
                    }
                    catch (Exception ex)
                    {
                        log.LogError(ex, "Failed to delete documents from search index");
                    }
                }

                return new OkObjectResult(new
                {
                    success = true,
                    message = "Deletion completed",
                    deletedBlobs = deletedBlobs.Count,
                    deletedIndexDocs = deletedIndexDocs.Count,
                    details = new
                    {
                        blobs = deletedBlobs,
                        indexDocuments = deletedIndexDocs
                    }
                });
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Error in DeleteDocument function");
                return new StatusCodeResult(StatusCodes.Status500InternalServerError);
            }
        }

        private static string GetMimeType(string fileName)
        {
            var extension = Path.GetExtension(fileName)?.ToLowerInvariant();
            return extension switch
            {
                ".pdf" => "application/pdf",
                ".doc" => "application/msword",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".xls" => "application/vnd.ms-excel",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".txt" => "text/plain",
                _ => "application/octet-stream"
            };
        }
    }

    public class ConvertDocumentRequest
    {
        public string BlobUrl { get; set; }
        public string FileName { get; set; }
        public string Client { get; set; }
        public string Category { get; set; }
        public string OriginalPath { get; set; }
        public string ConvertedPath { get; set; }
    }

    public class DeleteDocumentRequest
    {
        public string FilePath { get; set; }
        public string Client { get; set; }
        public string FileName { get; set; }
        public string Category { get; set; }
    }

    public class SearchDocument : Dictionary<string, object> { }
}

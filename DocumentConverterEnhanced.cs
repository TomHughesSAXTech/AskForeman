using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Azure.Storage.Blobs;
using Azure.Search.Documents;
using Azure.Search.Documents.Models;
using Azure.AI.OpenAI;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using DocumentFormat.OpenXml.Spreadsheet;
using iTextSharp.text.pdf;
using iTextSharp.text.pdf.parser;

public static class DocumentConverterEnhanced
{
    // Configuration - these should be in environment variables
    private static readonly string SearchServiceEndpoint = Environment.GetEnvironmentVariable("SEARCH_SERVICE_ENDPOINT");
    private static readonly string SearchApiKey = Environment.GetEnvironmentVariable("SEARCH_API_KEY");
    private static readonly string SearchIndexName = "fcs-construction-docs-index-v2";
    private static readonly string OpenAIApiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
    private static readonly string StorageConnectionString = Environment.GetEnvironmentVariable("STORAGE_CONNECTION_STRING");
    
    // Chunking configuration
    private const int ChunkSize = 2000; // Characters per chunk
    private const int ChunkOverlap = 200; // Overlap between chunks
    private const int MaxChunks = 100; // Maximum chunks per document

    [FunctionName("ConvertDocument")]
    public static async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = null)] HttpRequest req,
        ILogger log)
    {
        log.LogInformation("Enhanced Document Converter triggered");

        try
        {
            // Parse request
            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            var request = JsonConvert.DeserializeObject<DocumentRequest>(requestBody);
            
            // Validate request
            if (string.IsNullOrEmpty(request?.BlobUrl) || string.IsNullOrEmpty(request?.FileName))
            {
                return new BadRequestObjectResult(new { 
                    success = false, 
                    error = "BlobUrl and FileName are required" 
                });
            }

            log.LogInformation($"Processing: {request.FileName} for client: {request.Client}");

            // Check for duplicates
            var isDuplicate = await CheckForDuplicate(request, log);
            if (isDuplicate)
            {
                log.LogWarning($"Duplicate document detected: {request.FileName}");
                return new OkObjectResult(new {
                    success = false,
                    message = "Document already exists",
                    isDuplicate = true
                });
            }

            // Download and extract text
            var extractedText = await DownloadAndExtractText(request.BlobUrl, request.FileName, log);
            
            // Process document into chunks
            var chunks = CreateChunks(extractedText, request, log);
            
            // Generate embeddings for each chunk
            var chunksWithEmbeddings = await GenerateEmbeddings(chunks, log);
            
            // Create JSONL content
            var jsonlContent = CreateJsonlContent(chunksWithEmbeddings, request);
            
            // Upload JSONL to blob storage
            var convertedBlobUrl = await UploadConvertedDocument(jsonlContent, request, log);
            
            // Index documents in Azure Cognitive Search
            var indexResult = await IndexDocuments(chunksWithEmbeddings, log);
            
            // Return success response
            return new OkObjectResult(new
            {
                success = true,
                fileName = request.FileName,
                client = request.Client,
                category = request.Category,
                chunks = chunks.Count,
                totalCharacters = extractedText.Length,
                convertedBlobUrl = convertedBlobUrl,
                indexed = indexResult,
                processedAt = DateTime.UtcNow.ToString("o")
            });
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Error processing document");
            return new StatusCodeResult(StatusCodes.Status500InternalServerError);
        }
    }

    private static async Task<bool> CheckForDuplicate(DocumentRequest request, ILogger log)
    {
        try
        {
            var searchClient = new SearchClient(
                new Uri(SearchServiceEndpoint),
                SearchIndexName,
                new Azure.AzureKeyCredential(SearchApiKey));

            // Create a unique document hash
            var documentHash = GenerateDocumentHash(request);
            
            // Search for existing document with same hash
            var searchOptions = new SearchOptions
            {
                Filter = $"documentHash eq '{documentHash}' or (fileName eq '{request.FileName}' and client eq '{request.Client}')",
                Size = 1,
                IncludeTotalCount = true
            };

            var response = await searchClient.SearchAsync<SearchDocument>("*", searchOptions);
            await foreach (var result in response.Value.GetResultsAsync())
            {
                return true; // Duplicate found
            }

            return false;
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Error checking for duplicates");
            return false; // Continue processing if duplicate check fails
        }
    }

    private static string GenerateDocumentHash(DocumentRequest request)
    {
        using (var sha256 = SHA256.Create())
        {
            var input = $"{request.Client}|{request.Category}|{request.FileName}|{request.FileSize}";
            var hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(input));
            return Convert.ToBase64String(hashBytes);
        }
    }

    private static async Task<string> DownloadAndExtractText(string blobUrl, string fileName, ILogger log)
    {
        var blobClient = new BlobClient(new Uri(blobUrl));
        var response = await blobClient.DownloadAsync();
        
        using (var memoryStream = new MemoryStream())
        {
            await response.Value.Content.CopyToAsync(memoryStream);
            memoryStream.Position = 0;

            var fileExtension = Path.GetExtension(fileName).ToLower();
            
            return fileExtension switch
            {
                ".pdf" => ExtractTextFromPdf(memoryStream, log),
                ".docx" => ExtractTextFromDocx(memoryStream, log),
                ".xlsx" or ".xls" => ExtractTextFromExcel(memoryStream, log),
                ".txt" => ExtractTextFromTxt(memoryStream, log),
                _ => throw new NotSupportedException($"File type {fileExtension} not supported")
            };
        }
    }

    private static List<DocumentChunk> CreateChunks(string text, DocumentRequest request, ILogger log)
    {
        var chunks = new List<DocumentChunk>();
        var documentId = GenerateDocumentId(request);
        
        // Clean and normalize text
        text = text.Replace("\r\n", "\n").Replace("\r", "\n");
        
        // Split into sentences for better chunking
        var sentences = text.Split(new[] { ". ", ".\n", "! ", "!\n", "? ", "?\n" }, 
            StringSplitOptions.RemoveEmptyEntries);
        
        var currentChunk = new StringBuilder();
        var chunkIndex = 0;
        
        foreach (var sentence in sentences)
        {
            var cleanSentence = sentence.Trim();
            if (string.IsNullOrWhiteSpace(cleanSentence)) continue;
            
            // Add sentence delimiter back
            cleanSentence += ". ";
            
            if (currentChunk.Length + cleanSentence.Length > ChunkSize)
            {
                if (currentChunk.Length > 0)
                {
                    chunks.Add(new DocumentChunk
                    {
                        Id = $"{documentId}_chunk_{chunkIndex}",
                        ParentDocumentId = documentId,
                        ChunkIndex = chunkIndex,
                        Content = currentChunk.ToString().Trim(),
                        Client = request.Client,
                        Category = request.Category,
                        FileName = request.FileName
                    });
                    
                    chunkIndex++;
                    
                    // Start new chunk with overlap
                    var overlap = GetOverlapText(currentChunk.ToString(), ChunkOverlap);
                    currentChunk.Clear();
                    currentChunk.Append(overlap);
                }
            }
            
            currentChunk.Append(cleanSentence);
            
            if (chunks.Count >= MaxChunks)
            {
                log.LogWarning($"Document {request.FileName} exceeded max chunks ({MaxChunks})");
                break;
            }
        }
        
        // Add final chunk
        if (currentChunk.Length > 0)
        {
            chunks.Add(new DocumentChunk
            {
                Id = $"{documentId}_chunk_{chunkIndex}",
                ParentDocumentId = documentId,
                ChunkIndex = chunkIndex,
                Content = currentChunk.ToString().Trim(),
                Client = request.Client,
                Category = request.Category,
                FileName = request.FileName
            });
        }
        
        log.LogInformation($"Created {chunks.Count} chunks for {request.FileName}");
        return chunks;
    }

    private static string GetOverlapText(string text, int overlapSize)
    {
        if (text.Length <= overlapSize)
            return text;
        
        // Try to find a sentence boundary for cleaner overlap
        var lastPeriod = text.LastIndexOf(". ", text.Length - 1, Math.Min(overlapSize, text.Length));
        if (lastPeriod > 0)
            return text.Substring(lastPeriod + 2);
        
        return text.Substring(Math.Max(0, text.Length - overlapSize));
    }

    private static async Task<List<DocumentChunk>> GenerateEmbeddings(List<DocumentChunk> chunks, ILogger log)
    {
        try
        {
            var client = new OpenAIClient(OpenAIApiKey);
            
            foreach (var chunk in chunks)
            {
                try
                {
                    var embeddings = await client.GetEmbeddingsAsync(
                        "text-embedding-ada-002", 
                        new EmbeddingsOptions(chunk.Content));
                    
                    chunk.ContentVector = embeddings.Value.Data[0].Embedding.ToArray();
                }
                catch (Exception ex)
                {
                    log.LogWarning(ex, $"Failed to generate embedding for chunk {chunk.Id}");
                    // Continue without embeddings if it fails
                }
            }
        }
        catch (Exception ex)
        {
            log.LogWarning(ex, "Failed to generate embeddings, continuing without them");
        }
        
        return chunks;
    }

    private static string CreateJsonlContent(List<DocumentChunk> chunks, DocumentRequest request)
    {
        var jsonlLines = new List<string>();
        
        // Add document metadata
        jsonlLines.Add(JsonConvert.SerializeObject(new
        {
            type = "document_metadata",
            documentId = GenerateDocumentId(request),
            fileName = request.FileName,
            client = request.Client,
            category = request.Category,
            uploadedAt = DateTime.UtcNow.ToString("o"),
            totalChunks = chunks.Count,
            documentHash = GenerateDocumentHash(request)
        }));
        
        // Add each chunk
        foreach (var chunk in chunks)
        {
            jsonlLines.Add(JsonConvert.SerializeObject(new
            {
                type = "document_chunk",
                id = chunk.Id,
                parentDocumentId = chunk.ParentDocumentId,
                chunkIndex = chunk.ChunkIndex,
                content = chunk.Content,
                contentVector = chunk.ContentVector,
                client = chunk.Client,
                category = chunk.Category,
                fileName = chunk.FileName
            }));
        }
        
        return string.Join("\n", jsonlLines);
    }

    private static async Task<string> UploadConvertedDocument(string jsonlContent, DocumentRequest request, ILogger log)
    {
        try
        {
            var blobServiceClient = new BlobServiceClient(StorageConnectionString);
            var containerClient = blobServiceClient.GetBlobContainerClient("fcs-clients");
            
            // Create path: FCS-ConvertedClients/clientname/category/filename.jsonl
            var safeName = request.FileName.Replace(" ", "_").Replace(".pdf", "").Replace(".docx", "");
            var blobPath = $"FCS-ConvertedClients/{request.Client}/{request.Category}/{safeName}.jsonl";
            
            var blobClient = containerClient.GetBlobClient(blobPath);
            
            using (var stream = new MemoryStream(Encoding.UTF8.GetBytes(jsonlContent)))
            {
                await blobClient.UploadAsync(stream, overwrite: true);
            }
            
            log.LogInformation($"Uploaded JSONL to: {blobPath}");
            return blobClient.Uri.ToString();
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Failed to upload converted document");
            throw;
        }
    }

    private static async Task<bool> IndexDocuments(List<DocumentChunk> chunks, ILogger log)
    {
        try
        {
            var searchClient = new SearchClient(
                new Uri(SearchServiceEndpoint),
                SearchIndexName,
                new Azure.AzureKeyCredential(SearchApiKey));
            
            var documents = chunks.Select(chunk => new SearchDocument
            {
                ["id"] = chunk.Id,
                ["content"] = chunk.Content,
                ["contentVector"] = chunk.ContentVector,
                ["client"] = chunk.Client,
                ["category"] = chunk.Category,
                ["fileName"] = chunk.FileName,
                ["parentDocumentId"] = chunk.ParentDocumentId,
                ["chunkIndex"] = chunk.ChunkIndex,
                ["uploadedAt"] = DateTime.UtcNow
            }).ToList();
            
            var batch = IndexDocumentsBatch.Upload(documents);
            var result = await searchClient.IndexDocumentsAsync(batch);
            
            log.LogInformation($"Indexed {result.Value.Results.Count} documents successfully");
            return true;
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Failed to index documents");
            return false;
        }
    }

    private static string GenerateDocumentId(DocumentRequest request)
    {
        return $"{request.Client}_{request.Category}_{Path.GetFileNameWithoutExtension(request.FileName)}"
            .Replace(" ", "_")
            .Replace("-", "_")
            .ToLower();
    }

    // Text extraction methods (simplified versions - reuse from original)
    private static string ExtractTextFromPdf(Stream stream, ILogger log)
    {
        var text = new StringBuilder();
        using (var reader = new PdfReader(stream))
        {
            for (int page = 1; page <= reader.NumberOfPages; page++)
            {
                text.AppendLine($"--- Page {page} ---");
                text.AppendLine(PdfTextExtractor.GetTextFromPage(reader, page));
            }
        }
        return text.ToString();
    }

    private static string ExtractTextFromDocx(Stream stream, ILogger log)
    {
        var text = new StringBuilder();
        using (var doc = WordprocessingDocument.Open(stream, false))
        {
            var body = doc.MainDocumentPart.Document.Body;
            foreach (var element in body.Elements())
            {
                text.AppendLine(element.InnerText);
            }
        }
        return text.ToString();
    }

    private static string ExtractTextFromExcel(Stream stream, ILogger log)
    {
        var text = new StringBuilder();
        using (var document = SpreadsheetDocument.Open(stream, false))
        {
            var workbookPart = document.WorkbookPart;
            var sharedStringPart = workbookPart.GetPartsOfType<SharedStringTablePart>().FirstOrDefault();
            
            foreach (var worksheetPart in workbookPart.WorksheetParts)
            {
                var sheetData = worksheetPart.Worksheet.GetFirstChild<SheetData>();
                foreach (var row in sheetData.Elements<Row>())
                {
                    foreach (var cell in row.Elements<Cell>())
                    {
                        text.Append(GetCellValue(cell, sharedStringPart) + "\t");
                    }
                    text.AppendLine();
                }
            }
        }
        return text.ToString();
    }

    private static string GetCellValue(Cell cell, SharedStringTablePart sharedStringPart)
    {
        if (cell.CellValue == null) return string.Empty;
        
        var value = cell.CellValue.InnerText;
        if (cell.DataType?.Value == CellValues.SharedString && sharedStringPart != null)
        {
            return sharedStringPart.SharedStringTable.ChildElements[int.Parse(value)].InnerText;
        }
        return value;
    }

    private static string ExtractTextFromTxt(Stream stream, ILogger log)
    {
        using (var reader = new StreamReader(stream))
        {
            return reader.ReadToEnd();
        }
    }
}

// Request and response models
public class DocumentRequest
{
    public string BlobUrl { get; set; }
    public string FileName { get; set; }
    public string Client { get; set; }
    public string Category { get; set; }
    public long FileSize { get; set; }
}

public class DocumentChunk
{
    public string Id { get; set; }
    public string ParentDocumentId { get; set; }
    public int ChunkIndex { get; set; }
    public string Content { get; set; }
    public float[] ContentVector { get; set; }
    public string Client { get; set; }
    public string Category { get; set; }
    public string FileName { get; set; }
}

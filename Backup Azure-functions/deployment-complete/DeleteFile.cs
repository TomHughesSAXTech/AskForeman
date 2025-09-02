using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Azure.Storage.Blobs;
using Azure.Search.Documents;
using Azure.Search.Documents.Models;
using Azure;
using Newtonsoft.Json;

namespace SAXTech.DocConverter
{
    public class DeleteFile
    {
        private readonly string searchServiceEndpoint;
        private readonly string searchApiKey;
        private readonly string searchIndexName;
        private readonly string storageConnectionString;

        public DeleteFile()
        {
            searchServiceEndpoint = Environment.GetEnvironmentVariable("SEARCH_SERVICE_ENDPOINT") 
                ?? "https://fcssearchservice.search.windows.net";
            searchApiKey = Environment.GetEnvironmentVariable("SEARCH_API_KEY") 
                ?? Environment.GetEnvironmentVariable("SEARCH_ADMIN_KEY")
                ?? "UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv";
            searchIndexName = Environment.GetEnvironmentVariable("AZURE_SEARCH_INDEX_NAME") ?? "fcs-construction-docs-index-v2";
            storageConnectionString = Environment.GetEnvironmentVariable("STORAGE_CONNECTION_STRING")
                ?? Environment.GetEnvironmentVariable("AZURE_STORAGE_CONNECTION_STRING")
                ?? Environment.GetEnvironmentVariable("AzureWebJobsStorage");
        }

        [FunctionName("DeleteFile")]
        public async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Function, "post", "delete", Route = null)] HttpRequest req,
            ILogger log)
        {
            log.LogInformation("DeleteFile function processing request.");

            try
            {
                // Get file info from request
                string requestBody = await req.ReadAsStringAsync();
                dynamic data = JsonConvert.DeserializeObject(requestBody);
                string client = data?.client;
                string category = data?.category;
                string fileName = data?.fileName;

                if (string.IsNullOrEmpty(client) || string.IsNullOrEmpty(category) || string.IsNullOrEmpty(fileName))
                {
                    return new BadRequestObjectResult(new
                    {
                        success = false,
                        message = "client, category, and fileName are required"
                    });
                }

                log.LogInformation($"Deleting file: {fileName} for client {client} in category {category}");

                // 1. Delete blobs (original and converted)
                var blobServiceClient = new BlobServiceClient(storageConnectionString);
                var containerClient = blobServiceClient.GetBlobContainerClient("fcs-clients");

                var originalPath = $"FCS-OriginalClients/{client}/{category}/{fileName}";
                var convertedPath = $"FCS-ConvertedClients/{client}/{category}/{fileName}.jsonl";
                
                log.LogInformation($"Attempting to delete original: {originalPath}");
                log.LogInformation($"Attempting to delete converted: {convertedPath}");

                int blobsDeleted = 0;
                var originalDeleted = await containerClient.DeleteBlobIfExistsAsync(originalPath);
                if (originalDeleted.Value)
                {
                    blobsDeleted++;
                    log.LogInformation($"Deleted original blob: {originalPath}");
                }
                else
                {
                    log.LogWarning($"Original blob not found: {originalPath}");
                }
                
                var convertedDeleted = await containerClient.DeleteBlobIfExistsAsync(convertedPath);
                if (convertedDeleted.Value)
                {
                    blobsDeleted++;
                    log.LogInformation($"Deleted converted blob: {convertedPath}");
                }
                else
                {
                    log.LogWarning($"Converted blob not found: {convertedPath}");
                }

                // 2. Delete from search index
                // Since fileName is not filterable, we need to search by client and category,
                // then filter by fileName in memory
                var searchClient = new SearchClient(
                    new Uri(searchServiceEndpoint),
                    searchIndexName,
                    new AzureKeyCredential(searchApiKey)
                );

                var searchOptions = new SearchOptions
                {
                    Filter = $"client eq '{client}' and category eq '{category}'",
                    Size = 1000,
                    Select = { "id", "fileName" }
                };

                var searchResults = await searchClient.SearchAsync<SearchDocument>("*", searchOptions);
                var documentsToDelete = new System.Collections.Generic.List<SearchDocument>();

                await foreach (var result in searchResults.Value.GetResultsAsync())
                {
                    // Check if this document's fileName matches what we're trying to delete
                    if (result.Document.TryGetValue("fileName", out var docFileName) && 
                        docFileName?.ToString() == fileName)
                    {
                        documentsToDelete.Add(new SearchDocument { ["id"] = result.Document["id"] });
                        log.LogInformation($"Found document to delete from index: {result.Document["id"]}");
                    }
                }

                int indexDeleted = 0;
                if (documentsToDelete.Count > 0)
                {
                    var deleteResult = await searchClient.DeleteDocumentsAsync(documentsToDelete);
                    indexDeleted = documentsToDelete.Count;
                    log.LogInformation($"Deleted {indexDeleted} documents from search index");
                }
                else
                {
                    log.LogWarning($"No documents found in index for {fileName}");
                }

                return new OkObjectResult(new
                {
                    success = true,
                    message = "File deleted from storage and index",
                    client,
                    category,
                    fileName,
                    deletedBlobs = blobsDeleted,
                    deletedIndexDocuments = indexDeleted
                });
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Error deleting file");
                return new ObjectResult(new
                {
                    success = false,
                    message = "Error deleting file",
                    error = ex.Message
                })
                {
                    StatusCode = StatusCodes.Status500InternalServerError
                };
            }
        }
    }
}

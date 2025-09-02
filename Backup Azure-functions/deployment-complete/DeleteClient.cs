using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Search.Documents;
using Azure.Search.Documents.Models;
using Azure;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json;

namespace SAXTech.DocConverter
{
    public class DeleteClient
    {
        private readonly string searchServiceEndpoint;
        private readonly string searchApiKey;
        private readonly string searchIndexName;
        private readonly string storageConnectionString;
        
        public DeleteClient()
        {
            searchServiceEndpoint = Environment.GetEnvironmentVariable("SEARCH_SERVICE_ENDPOINT");
            searchApiKey = Environment.GetEnvironmentVariable("SEARCH_API_KEY");
            searchIndexName = Environment.GetEnvironmentVariable("AZURE_SEARCH_INDEX_NAME") ?? "fcs-construction-docs-index-v2";
            storageConnectionString = Environment.GetEnvironmentVariable("STORAGE_CONNECTION_STRING") 
                ?? Environment.GetEnvironmentVariable("AZURE_STORAGE_CONNECTION_STRING")
                ?? Environment.GetEnvironmentVariable("AzureWebJobsStorage");
        }

        [FunctionName("DeleteClient")]
        public async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Function, "post", "delete", Route = null)] HttpRequest req,
            ILogger log)
        {
            log.LogInformation("DeleteClient function processing request.");

            try
            {
                // Get client name from request
                string requestBody = await req.ReadAsStringAsync();
                dynamic data = JsonConvert.DeserializeObject(requestBody);
                string clientName = data?.client ?? data?.clientName;

                if (string.IsNullOrEmpty(clientName))
                {
                    return new BadRequestObjectResult(new 
                    { 
                        success = false, 
                        message = "Client name is required" 
                    });
                }

                log.LogInformation($"Deleting all data for client: {clientName}");

                // Track deletion results
                var results = new
                {
                    blobsDeleted = 0,
                    indexDocumentsDeleted = 0,
                    errors = new List<string>()
                };

                // 1. Delete from blob storage
                var blobResults = await DeleteClientBlobs(clientName, log);
                results = results with { blobsDeleted = blobResults.deletedCount };
                
                // 2. Delete from search index
                var indexResults = await DeleteClientFromIndex(clientName, log);
                results = results with { indexDocumentsDeleted = indexResults.deletedCount };

                log.LogInformation($"Client deletion complete. Blobs: {results.blobsDeleted}, Index docs: {results.indexDocumentsDeleted}");

                return new OkObjectResult(new
                {
                    success = true,
                    message = $"Successfully deleted client {clientName}",
                    client = clientName,
                    deletedBlobs = results.blobsDeleted,
                    deletedIndexDocuments = results.indexDocumentsDeleted,
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Error deleting client");
                return new ObjectResult(new 
                { 
                    success = false, 
                    message = "Error deleting client", 
                    error = ex.Message 
                })
                {
                    StatusCode = StatusCodes.Status500InternalServerError
                };
            }
        }

        private async Task<(int deletedCount, List<string> errors)> DeleteClientBlobs(string clientName, ILogger log)
        {
            var deletedCount = 0;
            var errors = new List<string>();

            try
            {
                var blobServiceClient = new BlobServiceClient(storageConnectionString);
                var containerName = "fcs-clients";
                var containerClient = blobServiceClient.GetBlobContainerClient(containerName);

                if (!await containerClient.ExistsAsync())
                {
                    log.LogWarning($"Container {containerName} does not exist");
                    return (0, errors);
                }

                // Delete from FCS-OriginalClients
                var originalPrefix = $"FCS-OriginalClients/{clientName}/";
                await foreach (var blobItem in containerClient.GetBlobsAsync(prefix: originalPrefix))
                {
                    try
                    {
                        var blobClient = containerClient.GetBlobClient(blobItem.Name);
                        await blobClient.DeleteIfExistsAsync();
                        deletedCount++;
                        log.LogInformation($"Deleted blob: {blobItem.Name}");
                    }
                    catch (Exception ex)
                    {
                        var error = $"Failed to delete blob {blobItem.Name}: {ex.Message}";
                        errors.Add(error);
                        log.LogError(ex, error);
                    }
                }

                // Delete from FCS-ConvertedClients
                var convertedPrefix = $"FCS-ConvertedClients/{clientName}/";
                await foreach (var blobItem in containerClient.GetBlobsAsync(prefix: convertedPrefix))
                {
                    try
                    {
                        var blobClient = containerClient.GetBlobClient(blobItem.Name);
                        await blobClient.DeleteIfExistsAsync();
                        deletedCount++;
                        log.LogInformation($"Deleted blob: {blobItem.Name}");
                    }
                    catch (Exception ex)
                    {
                        var error = $"Failed to delete blob {blobItem.Name}: {ex.Message}";
                        errors.Add(error);
                        log.LogError(ex, error);
                    }
                }

                log.LogInformation($"Deleted {deletedCount} blobs for client {clientName}");
            }
            catch (Exception ex)
            {
                log.LogError(ex, $"Error accessing blob storage for client {clientName}");
                errors.Add($"Blob storage error: {ex.Message}");
            }

            return (deletedCount, errors);
        }

        private async Task<(int deletedCount, List<string> errors)> DeleteClientFromIndex(string clientName, ILogger log)
        {
            var deletedCount = 0;
            var errors = new List<string>();

            try
            {
                var searchClient = new SearchClient(
                    new Uri(searchServiceEndpoint),
                    searchIndexName,
                    new AzureKeyCredential(searchApiKey)
                );

                // Search for all documents for this client
                var searchOptions = new SearchOptions
                {
                    Filter = $"client eq '{clientName}'",
                    Size = 1000, // Maximum batch size
                    Select = { "id" }
                };

                var searchResults = await searchClient.SearchAsync<SearchDocument>("*", searchOptions);
                var documentsToDelete = new List<SearchDocument>();

                await foreach (var result in searchResults.Value.GetResultsAsync())
                {
                    documentsToDelete.Add(new SearchDocument
                    {
                        ["id"] = result.Document["id"]
                    });
                }

                if (documentsToDelete.Any())
                {
                    // Delete documents in batches
                    var deleteOptions = new IndexDocumentsOptions { ThrowOnAnyError = false };
                    var response = await searchClient.DeleteDocumentsAsync(documentsToDelete, deleteOptions);
                    
                    deletedCount = documentsToDelete.Count;
                    log.LogInformation($"Deleted {deletedCount} documents from search index for client {clientName}");
                }
                else
                {
                    log.LogInformation($"No documents found in search index for client {clientName}");
                }
            }
            catch (Exception ex)
            {
                log.LogError(ex, $"Error deleting from search index for client {clientName}");
                errors.Add($"Search index error: {ex.Message}");
            }

            return (deletedCount, errors);
        }
    }
}

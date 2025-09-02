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
            searchServiceEndpoint = Environment.GetEnvironmentVariable("SEARCH_SERVICE_ENDPOINT");
            searchApiKey = Environment.GetEnvironmentVariable("SEARCH_API_KEY");
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
                var convertedPath = $"FCS-ConvertedClients/{client}/{category}/{System.IO.Path.GetFileNameWithoutExtension(fileName)}.jsonl";

                int blobsDeleted = 0;
                await containerClient.DeleteBlobIfExistsAsync(originalPath);
                blobsDeleted++;
                await containerClient.DeleteBlobIfExistsAsync(convertedPath);
                blobsDeleted++;

                // 2. Delete from search index by fileName/client/category
                var searchClient = new SearchClient(
                    new Uri(searchServiceEndpoint),
                    searchIndexName,
                    new AzureKeyCredential(searchApiKey)
                );

                var searchOptions = new SearchOptions
                {
                    Filter = $"client eq '{client}' and category eq '{category}' and fileName eq '{fileName}'",
                    Size = 1000,
                    Select = { "id" }
                };

                var searchResults = await searchClient.SearchAsync<SearchDocument>("*", searchOptions);
                var documentsToDelete = new System.Collections.Generic.List<SearchDocument>();

                await foreach (var result in searchResults.Value.GetResultsAsync())
                {
                    documentsToDelete.Add(new SearchDocument { ["id"] = result.Document["id"] });
                }

                int indexDeleted = 0;
                if (documentsToDelete.Count > 0)
                {
                    await searchClient.DeleteDocumentsAsync(documentsToDelete);
                    indexDeleted = documentsToDelete.Count;
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

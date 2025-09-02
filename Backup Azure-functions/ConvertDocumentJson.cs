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
using Newtonsoft.Json;

namespace SAXTech.DocConverter
{
    public class ConvertDocumentJson
    {
        private readonly string storageConnectionString;
        
        public ConvertDocumentJson()
        {
            storageConnectionString = Environment.GetEnvironmentVariable("AzureWebJobsStorage");
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

                // Store in blob storage
                var blobUrl = await StoreFileInBlobStorage(fileContent, clientName, category, fileName, log);
                
                // Store in search index (simplified for now)
                var documentId = $"{clientName}_{category}_{fileName}_{DateTime.UtcNow.Ticks}";
                
                return new OkObjectResult(new
                {
                    success = true,
                    message = "Document processed successfully",
                    documentId = documentId,
                    fileName = fileName,
                    client = clientName,
                    category = category,
                    fileSize = fileContent.Length,
                    blobUrl = blobUrl,
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

        private async Task<string> StoreFileInBlobStorage(byte[] content, string clientName, string category, string fileName, ILogger log)
        {
            try
            {
                // Create blob service client
                var blobServiceClient = new BlobServiceClient(storageConnectionString);
                
                // Get container reference (using fcs-clients container)
                var containerClient = blobServiceClient.GetBlobContainerClient("fcs-clients");
                await containerClient.CreateIfNotExistsAsync();
                
                // Create blob path: FCS-OriginalClients/[client]/[category]/[filename]
                var blobPath = $"FCS-OriginalClients/{clientName}/{category}/{fileName}";
                
                // Get blob client
                var blobClient = containerClient.GetBlobClient(blobPath);
                
                // Upload file
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
    }
}

# SAXTech AskForeman Document Converter Deployment Guide

## Overview
This guide covers the complete setup of the document processing pipeline with:
- Duplicate detection
- Document chunking for large files
- Vectorization for semantic search
- JSONL format storage in Azure Blob Storage
- Azure Cognitive Search indexing

## Architecture

```
Upload Webhook → Prepare File → Upload to Blob → Convert Document → 
→ Chunk & Vectorize → Upload JSONL → Index in Search
```

### Storage Structure
- **Original Documents**: `/fcs-clients/FCS-OriginalClients/{client}/{category}/{filename}`
- **Converted JSONL**: `/fcs-clients/FCS-ConvertedClients/{client}/{category}/{filename}.jsonl`

## Prerequisites

1. **Azure Resources**:
   - Azure Storage Account with `fcs-clients` container
   - Azure Cognitive Search Service
   - Azure Function App (Consumption or Premium plan)
   - OpenAI API access (for embeddings)

2. **Development Tools**:
   - .NET 6.0 SDK
   - Azure Functions Core Tools v4
   - Visual Studio Code or Visual Studio

## Step 1: Configure Azure Resources

### 1.1 Azure Storage Account
```bash
# Create storage account if not exists
az storage account create \
  --name saxtechfcs \
  --resource-group saxtech-rg \
  --location eastus \
  --sku Standard_LRS

# Create container
az storage container create \
  --name fcs-clients \
  --account-name saxtechfcs \
  --public-access off

# Get connection string
az storage account show-connection-string \
  --name saxtechfcs \
  --resource-group saxtech-rg
```

### 1.2 Azure Cognitive Search
```bash
# Create search service if not exists
az search service create \
  --name fcssearchservice \
  --resource-group saxtech-rg \
  --sku standard \
  --location eastus

# Get admin key
az search admin-key show \
  --service-name fcssearchservice \
  --resource-group saxtech-rg
```

### 1.3 Create/Update Search Index
```json
{
  "name": "fcs-construction-docs-index-v2",
  "fields": [
    {"name": "id", "type": "Edm.String", "key": true, "searchable": false},
    {"name": "content", "type": "Edm.String", "searchable": true, "analyzer": "standard.lucene"},
    {"name": "contentVector", "type": "Collection(Edm.Single)", "searchable": true, "dimensions": 1536},
    {"name": "client", "type": "Edm.String", "searchable": true, "filterable": true, "facetable": true},
    {"name": "category", "type": "Edm.String", "searchable": true, "filterable": true, "facetable": true},
    {"name": "fileName", "type": "Edm.String", "searchable": true, "filterable": true},
    {"name": "parentDocumentId", "type": "Edm.String", "filterable": true},
    {"name": "chunkIndex", "type": "Edm.Int32", "filterable": true, "sortable": true},
    {"name": "uploadedAt", "type": "Edm.DateTimeOffset", "filterable": true, "sortable": true},
    {"name": "blobPath", "type": "Edm.String", "searchable": false},
    {"name": "mimeType", "type": "Edm.String", "filterable": true},
    {"name": "convertedPath", "type": "Edm.String", "searchable": false},
    {"name": "metadata", "type": "Edm.String", "searchable": false},
    {"name": "documentHash", "type": "Edm.String", "filterable": true}
  ],
  "vectorSearch": {
    "algorithms": [
      {
        "name": "hnsw",
        "kind": "hnsw",
        "hnswParameters": {
          "metric": "cosine",
          "m": 4,
          "efConstruction": 400,
          "efSearch": 500
        }
      }
    ],
    "profiles": [
      {
        "name": "vector-profile",
        "algorithm": "hnsw"
      }
    ]
  }
}
```

## Step 2: Deploy Azure Function

### 2.1 Build the Function App
```bash
cd /Users/tom/Desktop/WARP/SAXTech-AskForeman-Site

# Restore packages
dotnet restore

# Build
dotnet build --configuration Release

# Test locally (optional)
func start
```

### 2.2 Configure App Settings
```bash
# Set environment variables in Azure Function App
az functionapp config appsettings set \
  --name saxtech-docconverter \
  --resource-group saxtech-rg \
  --settings \
    "SEARCH_SERVICE_ENDPOINT=https://fcssearchservice.search.windows.net" \
    "SEARCH_API_KEY=<your-search-api-key>" \
    "OPENAI_API_KEY=<your-openai-api-key>" \
    "STORAGE_CONNECTION_STRING=<your-storage-connection-string>"
```

### 2.3 Deploy to Azure
```bash
# Create Function App if not exists
az functionapp create \
  --resource-group saxtech-rg \
  --consumption-plan-location eastus \
  --runtime dotnet \
  --runtime-version 6 \
  --functions-version 4 \
  --name saxtech-docconverter \
  --storage-account saxtechfcs

# Deploy the function
func azure functionapp publish saxtech-docconverter
```

## Step 3: Update n8n Workflow

### 3.1 Environment Variables
Add these to your n8n environment:
```bash
AZURE_BLOB_SAS_TOKEN=sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=<your-sig>
AZURE_SEARCH_API_KEY=<your-api-key>
AZURE_FUNCTION_CODE=<your-function-code>
AZURE_FUNCTION_KEY=<your-function-key>
```

### 3.2 Import Updated Workflow
1. Open n8n
2. Create new workflow
3. Import `n8n-workflow-sanitized.json`
4. Update credentials in each node

## Step 4: Testing

### 4.1 Test Document Upload
```bash
# Test with sample PDF
curl -X POST https://workflows.saxtechnology.com/webhook/ask-foreman/upload \
  -H "Content-Type: application/json" \
  -d '{
    "file": "<base64-encoded-pdf>",
    "fileName": "test-document.pdf",
    "client": "TestClient",
    "category": "drawings"
  }'
```

### 4.2 Verify Processing
1. Check Azure Storage for original file in `FCS-OriginalClients/TestClient/drawings/`
2. Check for JSONL in `FCS-ConvertedClients/TestClient/drawings/`
3. Search in Azure Cognitive Search:
```bash
curl -X POST "https://fcssearchservice.search.windows.net/indexes/fcs-construction-docs-index-v2/docs/search?api-version=2023-11-01" \
  -H "api-key: <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "search": "*",
    "filter": "client eq '\''TestClient'\''",
    "select": "id,fileName,chunkIndex"
  }'
```

## Step 5: Monitor & Troubleshoot

### 5.1 Function App Logs
```bash
# Stream logs
az webapp log tail \
  --name saxtech-docconverter \
  --resource-group saxtech-rg
```

### 5.2 Application Insights
```bash
# Enable Application Insights
az monitor app-insights component create \
  --app saxtech-docconverter-insights \
  --location eastus \
  --resource-group saxtech-rg

# Connect to Function App
az functionapp config appsettings set \
  --name saxtech-docconverter \
  --resource-group saxtech-rg \
  --settings "APPINSIGHTS_INSTRUMENTATIONKEY=<instrumentation-key>"
```

## Key Features Implemented

### 1. Duplicate Detection
- Generates SHA256 hash of document metadata
- Checks Azure Search before processing
- Prevents redundant processing

### 2. Document Chunking
- Splits large documents into 2000-character chunks
- 200-character overlap for context
- Maximum 100 chunks per document

### 3. Vectorization
- Uses OpenAI text-embedding-ada-002
- 1536-dimensional vectors
- Enables semantic search

### 4. JSONL Storage
- Metadata on first line
- Each chunk on separate line
- Efficient for streaming processing

### 5. Search Index Structure
- Parent-child relationship for chunks
- Vector search enabled
- Faceted search on client/category

## Performance Optimization

### 1. Batch Processing
- Process multiple chunks in parallel
- Batch index operations

### 2. Caching
- Cache OpenAI client
- Reuse search client connections

### 3. Error Handling
- Retry logic for transient failures
- Continue processing on partial failures
- Detailed logging for troubleshooting

## Security Best Practices

1. **Never commit secrets** - Use environment variables
2. **Use Managed Identities** where possible
3. **Rotate SAS tokens** regularly
4. **Enable HTTPS only** for all endpoints
5. **Implement rate limiting** on webhooks

## Maintenance

### Weekly Tasks
- Review function logs for errors
- Check storage usage
- Monitor search index size

### Monthly Tasks
- Update SAS tokens
- Review and optimize search queries
- Clean up orphaned documents

### Quarterly Tasks
- Update dependencies
- Review and optimize chunking strategy
- Performance analysis

## Support

For issues or questions:
1. Check Function App logs
2. Review Application Insights
3. Verify Azure resource configurations
4. Test with simple documents first

## Next Steps

1. **Add OCR support** for scanned PDFs
2. **Implement language detection**
3. **Add support for more file types**
4. **Implement incremental indexing**
5. **Add document versioning**

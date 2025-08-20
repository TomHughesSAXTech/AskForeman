# Ask Foreman Deployment Guide

## Prerequisites
- Azure Storage Account with two containers:
  - `fcs-clients` (for raw documents)
  - `fcs-convertedclients` (for processed data)
- SAS tokens with read/write/delete permissions for both containers
- N8N workflows set up for webhooks
- Azure Function App for document processing (optional but recommended)

## Step 1: Update Azure Storage Configuration

1. **Verify your containers exist:**
   - Log into Azure Portal
   - Navigate to your storage account (`saxtechfcs`)
   - Ensure both containers exist:
     - `fcs-clients`
     - `fcs-convertedclients`

2. **Update SAS tokens if needed:**
   - The current SAS token in the code expires in 2030
   - If you need a new one, generate it with these permissions:
     - Read, Write, Delete, List
     - Container and Object resource types
     - For both containers

## Step 2: Deploy the HTML Files

### Option A: Direct Upload to Azure Static Web Apps or Storage
1. Upload both files to your hosting location:
   - `index.html` (main application)
   - `admin.html` (admin panel)
   - `ForemanAI.png` (logo image)

### Option B: If using Azure Static Web Apps
```bash
# From the /tmp/AskForeman directory
swa deploy --app-name your-app-name
```

### Option C: If hosting on Azure Storage Static Website
```bash
# Upload to $web container
az storage blob upload-batch \
  --account-name saxtechfcs \
  --destination '$web' \
  --source /tmp/AskForeman \
  --pattern "*.html"
```

## Step 3: Update N8N Webhooks

Your N8N workflows need to handle these endpoints:

### 1. Client Creation Webhook
**Endpoint:** `https://workflows.saxtechnology.com/webhook/ask-foreman/clients/create`

**Expected Request:**
```json
{
  "clientName": "Client Name",
  "projectName": "Client Name",  // Same as clientName for compatibility
  "projectType": "Commercial",
  "projectDescription": "Description text"
}
```

**N8N Workflow Should:**
1. Receive the webhook
2. Optionally create additional resources
3. Return success response

### 2. Document Processing Webhook
**Endpoint:** `https://workflows.saxtechnology.com/webhook/ask-foreman/process`

**Expected Request:** FormData with:
- `file`: The uploaded file
- `category`: Category name (drawings, estimates, etc.)
- `client`: Client name
- `action`: Optional, "reindex" for reindexing

**N8N Workflow Should:**
1. Receive the file
2. Save to `fcs-clients/FCS-OriginalClients/[client]/[category]/`
3. Trigger Azure Function for processing
4. Return success response

## Step 4: Set Up Azure Function for Document Processing

Create an Azure Function that:

1. **Triggers on blob upload to `fcs-clients`**
2. **Processes the document:**
   ```python
   import azure.functions as func
   from azure.storage.blob import BlobServiceClient
   import json
   import os
   
   def main(myblob: func.InputStream):
       # Parse the blob path
       blob_path = myblob.name
       # Expected format: FCS-OriginalClients/ClientName/Category/filename.pdf
       
       parts = blob_path.split('/')
       if len(parts) >= 4 and parts[0] == 'FCS-OriginalClients':
           client_name = parts[1]
           category = parts[2]
           filename = parts[3]
           
           # Process the document
           processed_content = convert_document(myblob)
           
           # Save to converted container
           save_to_converted_container(
               client_name,
               category,
               filename,
               processed_content
           )
           
           # Update metadata
           update_client_metadata(client_name)
   ```

3. **Saves processed data to `fcs-convertedclients`:**
   - Converted text to `[ClientName]/converted/`
   - Metadata to `[ClientName]/metadata/`
   - Chunks to `[ClientName]/chunks/`
   - Embeddings to `[ClientName]/embeddings/`

## Step 5: Configure Azure Cognitive Search

1. **Create an index pointing to `fcs-convertedclients`:**
   ```json
   {
     "name": "construction-docs-index",
     "fields": [
       {"name": "id", "type": "Edm.String", "key": true},
       {"name": "content", "type": "Edm.String", "searchable": true},
       {"name": "client", "type": "Edm.String", "filterable": true},
       {"name": "category", "type": "Edm.String", "filterable": true},
       {"name": "filename", "type": "Edm.String", "searchable": true},
       {"name": "metadata", "type": "Edm.String"},
       {"name": "embedding", "type": "Collection(Edm.Single)", "dimensions": 1536}
     ]
   }
   ```

2. **Create an indexer for the `fcs-convertedclients` container:**
   ```json
   {
     "name": "construction-docs-indexer",
     "dataSourceName": "fcs-convertedclients-datasource",
     "targetIndexName": "construction-docs-index",
     "schedule": {"interval": "PT5M"}
   }
   ```

## Step 6: Test the System

1. **Test Client Creation:**
   - Open the application
   - Click "Create New Client"
   - Enter client details
   - Verify folders are created in both containers

2. **Test Document Upload:**
   - Select a client
   - Upload documents
   - Verify they appear in `fcs-clients`
   - Check if processed data appears in `fcs-convertedclients`

3. **Test Search/Chat:**
   - Select a client in the chat dropdown
   - Ask questions about uploaded documents
   - Verify responses are contextual

## Step 7: Monitor and Maintain

1. **Check Azure Storage Metrics:**
   - Monitor storage usage
   - Review access logs
   - Check for failed uploads

2. **Monitor N8N Workflows:**
   - Check webhook execution logs
   - Review error rates
   - Monitor response times

3. **Review Azure Function Logs:**
   - Check Application Insights
   - Monitor processing times
   - Review error logs

## Troubleshooting

### Issue: Folders not created in fcs-convertedclients
**Solution:** Check SAS token permissions for the fcs-convertedclients container

### Issue: Documents not being processed
**Solution:** Verify Azure Function is triggered and has proper permissions

### Issue: Search not returning results
**Solution:** Check if indexer is running and data exists in fcs-convertedclients

### Issue: CORS errors
**Solution:** Add your domain to CORS settings in Azure Storage Account:
```bash
az storage cors add \
  --account-name saxtechfcs \
  --services b \
  --methods GET POST PUT DELETE \
  --origins "https://your-domain.com" \
  --allowed-headers "*" \
  --exposed-headers "*"
```

## Security Considerations

1. **Rotate SAS tokens regularly**
2. **Use HTTPS only**
3. **Implement rate limiting on webhooks**
4. **Add authentication if needed**
5. **Monitor for unusual access patterns**

## Next Steps

1. **Add Authentication:**
   - Implement Azure AD authentication
   - Add user management

2. **Enhance Processing:**
   - Add OCR for scanned documents
   - Implement better chunking strategies
   - Add document classification

3. **Improve Search:**
   - Implement semantic search
   - Add faceted search
   - Enhance relevance tuning

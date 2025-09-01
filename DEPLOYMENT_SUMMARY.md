# Ask Foreman - Deployment and Fix Summary

## Overview
This document summarizes the fixes applied to the Ask Foreman RAG system to resolve upload, conversion, and deletion issues.

## Key Issues Identified and Fixed

### 1. **Blob Path Routing Issues**
- **Problem**: Files were being uploaded to incorrect paths (`client/category/` instead of `FCS-OriginalClients/client/category/`)
- **Solution**: Fixed path generation in n8n workflow to use correct Azure blob container structure

### 2. **Document Conversion Pipeline**
- **Problem**: Documents weren't being properly converted and indexed
- **Solution**: 
  - Created proper Azure Function (`ConvertDocument`) that:
    - Downloads files from blob storage
    - Processes with Azure Document Intelligence
    - Creates JSONL format for converted content
    - Updates search index with proper client field

### 3. **Search Index Client Field**
- **Problem**: Documents in search index had missing or incorrect `client` field
- **Solution**: Ensured all index operations properly set the `client` field from the upload metadata

### 4. **Delete Operations**
- **Problem**: Delete operations weren't removing files from all three locations (original, converted, index)
- **Solution**: Implemented comprehensive delete workflow that removes from:
  - FCS-OriginalClients container
  - FCS-ConvertedClients container  
  - Search index

## Files Created/Modified

### n8n Workflow
- `n8n-workflow-complete-fix.json` - Complete fixed workflow with proper routing

### Azure Function
- `ConvertDocumentFunction.cs` - Document conversion and deletion functions

### Key Components Fixed

1. **Upload Flow**:
   ```
   Upload Webhook → Prepare File Data → Upload to Original → Call Azure Function → 
   Index Document → Prepare Converted Data → Upload Converted JSONL → Success Response
   ```

2. **Delete Flow**:
   ```
   Delete Webhook → Extract Parameters → Delete Original/Converted/Index (parallel) → 
   Consolidate Results → Success Response
   ```

## Deployment Instructions

### 1. Import n8n Workflow
1. Open n8n admin interface
2. Import `n8n-workflow-complete-fix.json`
3. Verify all webhook URLs and credentials

### 2. Deploy Azure Function
1. Create new Function App or use existing `SAXTech-DocConverter`
2. Deploy `ConvertDocumentFunction.cs`
3. Set environment variables:
   - `AzureWebJobsStorage`: Storage connection string
   - `SearchApiKey`: Cognitive Search API key
   - `DocumentIntelligenceKey`: Document Intelligence API key (optional)

### 3. Update Admin UI
The admin.html already has correct webhook URLs pointing to:
- Upload: `https://workflows.saxtechnology.com/webhook/ask-foreman/upload`
- Delete: `https://workflows.saxtechnology.com/webhook/ask-foreman/files/delete`
- Delete Client: `https://workflows.saxtechnology.com/webhook/ask-foreman/clients/delete`

## Azure Resources Configuration

### Storage Account: `saxtechfcs`
- Container: `fcs-clients`
- Folder Structure:
  ```
  FCS-OriginalClients/
    └── {client_name}/
        ├── drawings/
        ├── estimates/
        ├── proposals/
        ├── specs/
        └── signed-contracts/
  
  FCS-ConvertedClients/
    └── {client_name}/
        └── {category}/
            └── {filename}.jsonl
  ```

### Cognitive Search: `fcssearchservice`
- Index: `fcs-construction-docs-index-v2`
- Required fields:
  - `id` (key)
  - `client` (filterable, searchable)
  - `category` (filterable, searchable)
  - `fileName` (searchable)
  - `content` (searchable)
  - `blobPath`
  - `convertedPath`
  - `uploadedAt`

## Testing Checklist

- [ ] Upload a PDF file through admin panel
- [ ] Verify file appears in `FCS-OriginalClients/{client}/{category}/`
- [ ] Verify JSONL created in `FCS-ConvertedClients/{client}/{category}/`
- [ ] Verify document indexed with correct `client` field
- [ ] Test search functionality in main app
- [ ] Delete a single file - verify removal from all three locations
- [ ] Delete entire client - verify all files removed

## Multi-Client Template Setup

To deploy for a new client:

1. **Create new storage container** (optional, can reuse)
2. **Update n8n workflow credentials**:
   - Storage account SAS token
   - Search service details
   - Function app URLs
3. **Deploy static site** with updated API endpoints
4. **Configure Azure Function** environment variables

## Important URLs

- Admin Panel: https://askforeman.saxtechnology.com/admin.html
- Main App: https://askforeman.saxtechnology.com/
- n8n Workflows: https://workflows.saxtechnology.com/
- Azure Function: https://saxtech-docconverter.azurewebsites.net/

## Security Notes

- Admin password: `FCS2025!` (should be changed)
- All API keys should be stored in Azure Key Vault
- Function apps should use Managed Identity where possible
- SAS tokens should have minimum required permissions

## Monitoring

- Check Application Insights for function execution logs
- Monitor n8n execution history for webhook failures
- Review search index statistics regularly
- Set up alerts for failed uploads/conversions

## Next Steps

1. Implement deduplication at blob level (SHA-256 hashing)
2. Add progress indicators for large file uploads
3. Implement chunking for documents > 10MB
4. Add vector embeddings for semantic search
5. Create PowerShell script for bulk reindexing

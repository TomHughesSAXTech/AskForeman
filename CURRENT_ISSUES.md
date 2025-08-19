# Current Issues and Fixes Needed

## 1. N8N Document Processing Error
**Error:** "BlobUrl and FileName are required"

**Issue:** The N8N webhook for converting documents to text expects `BlobUrl` and `FileName` parameters but is not receiving them.

**Location:** This likely happens when documents are uploaded through the admin panel or when reindexing.

**Fix Needed:** 
- The webhook call needs to send the correct parameters
- Check the N8N workflow configuration to understand the expected format
- The parameters should be:
  ```json
  {
    "BlobUrl": "https://saxtechfcs.blob.core.windows.net/fcs-clients/path/to/file.pdf",
    "FileName": "file.pdf"
  }
  ```

## 2. Delete Client Not Working
**Symptoms:**
- Shows "success" message but doesn't actually delete
- Client list doesn't refresh
- Files remain in Azure Blob Storage

**Possible Causes:**
1. Azure Function isn't correctly implementing the delete operation
2. The function might be returning success even when delete fails
3. CORS was blocking the request (now fixed)

**Fix Needed:**
- Check Azure Function implementation for the delete endpoint
- Ensure it's actually deleting all blobs in the client folder
- Add proper error handling and logging

## 3. Duplicate Client Folders with Different Capitalization
**Symptoms:**
- Creating "b" and "B" as separate folders
- Inconsistent capitalization between frontend and blob storage

**Root Cause:**
- Azure Blob Storage is case-sensitive for folder names
- Frontend might be lowercasing the client name in some places

**Fix Needed in index.html:**
- Ensure consistent capitalization when creating client folders
- Don't lowercase the folder name when creating in Azure
- The folder name should match exactly what the user enters

## 4. CORS Configuration (Partially Fixed)
**Status:** Instructions provided, needs to be configured in Azure Portal

**Required CORS Settings:**

### For Azure Function App (saxtech-functionapps2):
- Allowed origins: `https://askforeman.saxtechnology.com`
- This will fix the delete client operation

### For Azure Blob Storage (saxtechfcs):
- Allowed origins: `https://askforeman.saxtechnology.com`
- Allowed methods: GET, HEAD, PUT, DELETE, OPTIONS
- Allowed headers: *
- This will fix file uploads from the admin panel

## Immediate Actions Required:

1. **Configure CORS in Azure Portal** (5 minutes)
   - Go to Function App → CORS → Add origin
   - Go to Storage Account → CORS → Add rule

2. **Fix N8N Workflow** (10 minutes)
   - Check the "Convert Document to Text" HTTP Request node
   - Ensure it's receiving BlobUrl and FileName parameters
   - Update the webhook call in the frontend if needed

3. **Review Azure Function Delete Code** (15 minutes)
   - Check the delete client function implementation
   - Ensure it's actually deleting blobs
   - Add proper error handling

4. **Fix Client Name Capitalization** (10 minutes)
   - Review index.html createClient function
   - Ensure folder names maintain their original capitalization
   - Don't use toLowerCase() on folder names

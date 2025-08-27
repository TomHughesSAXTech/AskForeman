# Real Delete Client Workflow Guide

## 🎯 **Import `n8n-delete-client-workflow-real.json`**

This version **actually deletes** files from your Azure Blob Storage.

## ⚠️ **WARNING: This Really Deletes Data!**

Unlike the simulation version, this workflow will:
- ✅ **DELETE actual files** from Azure Blob Storage
- ✅ **Remove client folders** and all contents  
- ✅ **Clean up placeholder files** and metadata
- ❌ **Cannot be undone** - make sure you want to delete the client!

## 🔧 **How It Works**

1. **Webhook receives** delete request with clientId/clientName
2. **Prepares blob paths** for deletion (all client files)
3. **Makes DELETE requests** to Azure Blob Storage API
4. **Processes results** and counts successful/failed deletions
5. **Returns detailed response** with deletion status

## 📋 **What Gets Deleted**

For a client named "test", it deletes:
- `FCS-OriginalClients/test/.placeholder`
- `FCS-OriginalClients/test/drawings/.placeholder`
- `FCS-OriginalClients/test/estimates/.placeholder`
- `FCS-OriginalClients/test/proposals/.placeholder`
- `FCS-OriginalClients/test/specs/.placeholder`
- `FCS-OriginalClients/test/signed-contracts/.placeholder`
- `FCS-OriginalClients/test/.metadata/client.json`

## 🚀 **Response Format**

```json
{
  "status": "success",
  "operation": "DELETE_CLIENT",
  "clientId": "test", 
  "clientName": "test",
  "deletedCount": 7,
  "failedCount": 0,
  "message": "Client \"test\" has been successfully deleted from storage",
  "timestamp": "2025-08-27T03:17:45.123Z",
  "details": [
    {
      "path": "FCS-OriginalClients/test/.placeholder",
      "status": "deleted",
      "statusCode": 202,
      "timestamp": "2025-08-27T03:17:45.123Z"
    }
  ]
}
```

## ⚙️ **Customization**

To delete additional files/folders:

1. **Edit "Prepare Delete Data" node**
2. **Add more paths** to the `blobPaths` array:
   ```javascript
   blobPaths: [
     // Existing paths...
     `processed-documents/${clientName}/`,
     `search-indexes/${clientName}/`,
     `custom-folder/${clientName}/`
   ]
   ```

## 🛡️ **Safety Features**

- ✅ **Status codes checked** - only considers 202/404 as success
- ✅ **Detailed logging** - logs every deletion attempt
- ✅ **Error handling** - continues even if some deletions fail
- ✅ **Result counting** - tells you exactly what was deleted

## 🔄 **Admin Panel Integration**

Your admin panel will:
- ✅ **Show confirmation dialog** before deletion
- ✅ **Display success/failure** messages
- ✅ **Auto-refresh** client list after deletion
- ✅ **Show detailed results** in logs

## 🧪 **Testing**

**Test with a dummy client first:**

```bash
curl -X POST "https://workflows.saxtechnology.com/webhook/ask-foreman/clients/delete" \
-H "Content-Type: application/json" \
-d '{"clientId": "test-delete-me", "clientName": "test-delete-me"}'
```

## 📁 **File Versions**

- **`n8n-delete-client-workflow-fixed.json`** - Simulates deletion (safe for testing)
- **`n8n-delete-client-workflow-real.json`** - Actually deletes files ⚠️

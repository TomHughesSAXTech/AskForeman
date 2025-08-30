# Ask Foreman - Issues and Solutions

## Issue 1: Files Don't Overwrite When Uploading Same Document

### Current Behavior:
When uploading a file with the same name, it creates duplicates instead of overwriting.

### Solution:
The issue is likely in the n8n workflow. The front-end already sends the correct headers for overwriting (`x-ms-blob-overwrite: 'true'`), but the n8n workflow needs to:

1. In your n8n "Upload File to Blob" node, ensure you're setting:
   - **Overwrite**: `true`
   - **x-ms-blob-overwrite** header: `true`

2. For the converted files in FCS-ConvertedClients, also ensure overwrite is enabled.

## Issue 2: Search Doesn't Return Updated Document Information Immediately

### Current Behavior:
After adding/removing/changing documents, the search doesn't immediately reflect the changes.

### Solution:
This is due to Azure Cognitive Search indexing delay. There are several approaches:

1. **Add an info message to users** (Quick fix - already implemented in the UI):
   ```javascript
   addSystemMessage("⏳ Note: It may take 2-3 minutes for new documents to be searchable while the index updates.");
   ```

2. **In your n8n workflow**, after document upload/deletion:
   - Add a "Run Indexer" node that triggers Azure Search indexer
   - Use the Azure Cognitive Search API to run the indexer on-demand:
   ```
   POST https://[search-service].search.windows.net/indexers/[indexer-name]/run?api-version=2020-06-30
   ```

3. **Configure your Azure Search Indexer** for more frequent runs:
   - Go to Azure Portal → Your Search Service → Indexers
   - Edit the schedule to run every 5 minutes instead of hourly

## Issue 3: File Links in Chat Not Working

### Current Behavior:
When the AI provides links to files, they're not clickable or don't work properly.

### Solution:
The issue is that the AI is returning Azure Blob Storage URLs, but they need the SAS token appended. 

### Fix in index.html:

```javascript
// Enhanced message formatting function
function formatMessageContent(content) {
  if (!content) return '';
  
  // ... existing code ...
  
  // Handle Azure Blob Storage links specifically
  // Look for blob.core.windows.net URLs without SAS tokens
  const blobUrlRegex = /(https:\/\/saxtechfcs\.blob\.core\.windows\.net\/[^\s<>"]+?)(?![?&])/g;
  content = content.replace(blobUrlRegex, (match) => {
    // Check if URL already has query parameters
    if (match.includes('?')) {
      return `<a href="${match}" target="_blank" rel="noopener noreferrer">📄 View Document</a>`;
    } else {
      // Append SAS token for authentication
      const authenticatedUrl = match + AZURE_STORAGE.sasToken;
      const fileName = match.split('/').pop();
      return `<a href="${authenticatedUrl}" target="_blank" rel="noopener noreferrer">📄 ${decodeURIComponent(fileName)}</a>`;
    }
  });
  
  // ... rest of existing code ...
}
```

### Additional Enhancement for Better File Links:

In your n8n workflow's chat response node, when returning file references:

1. **Format file links properly**:
   ```javascript
   // In n8n workflow when constructing response with file links
   const fileUrl = `https://saxtechfcs.blob.core.windows.net/fcs-clients/FCS-OriginalClients/${clientName}/${category}/${fileName}`;
   const linkText = `[📄 ${fileName}](${fileUrl})`;
   ```

2. **Or return structured data** that the front-end can format:
   ```json
   {
     "response": "Here's the document you requested:",
     "files": [
       {
         "name": "estimate.pdf",
         "path": "FCS-OriginalClients/ClientA/estimates/estimate.pdf",
         "url": "https://saxtechfcs.blob.core.windows.net/..."
       }
     ]
   }
   ```

## Quick Implementation:

To quickly fix issue #3, update the `formatMessageContent` function in index.html:

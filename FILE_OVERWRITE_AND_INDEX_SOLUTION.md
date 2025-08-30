# File Overwrite and Instant Index Solutions

## Issue 1: File Overwrite Not Working

### Current Problem
When uploading files with the same name, Azure Blob Storage creates duplicates instead of overwriting, even though the `x-ms-blob-overwrite: 'true'` header is set in the front-end.

### Root Cause
The issue is likely in the n8n workflow where files are uploaded to Azure. The workflow needs to:
1. Check if a file exists before uploading
2. Properly set overwrite headers in the Azure Blob Storage upload node
3. Handle version control if needed

### Solution Approaches

#### Approach A: Client-Side Duplicate Detection (Recommended)
Add duplicate detection before upload to give users control:

```javascript
// Check for existing files before upload
async function checkForDuplicates(files, clientName, category) {
  const duplicates = [];
  
  for (const file of files) {
    const exists = await checkFileExists(clientName, category, file.name);
    if (exists) {
      duplicates.push(file.name);
    }
  }
  
  if (duplicates.length > 0) {
    return await showDuplicateDialog(duplicates);
  }
  
  return 'proceed';
}

async function checkFileExists(clientName, category, fileName) {
  const blobPath = `FCS-OriginalClients/${clientName}/${category}/${fileName}`;
  const checkUrl = `https://saxtechfcs.blob.core.windows.net/fcs-clients/${blobPath}?sp=racwdl&st=2025-08-08T05:00:57Z&se=2030-08-08T13:15:57Z&spr=https&sv=2024-11-04&sr=c&sig=lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2%2FrnIg%3D`;
  
  try {
    const response = await fetch(checkUrl, {
      method: 'HEAD'
    });
    return response.ok;
  } catch {
    return false;
  }
}

function showDuplicateDialog(duplicates) {
  return new Promise((resolve) => {
    const modal = createModal({
      title: 'Duplicate Files Detected',
      message: `The following files already exist:\n${duplicates.join('\n')}\n\nWhat would you like to do?`,
      buttons: [
        { text: 'Overwrite All', value: 'overwrite' },
        { text: 'Keep Both (Rename)', value: 'rename' },
        { text: 'Skip Duplicates', value: 'skip' },
        { text: 'Cancel', value: 'cancel' }
      ],
      onSelect: (value) => resolve(value)
    });
  });
}
```

#### Approach B: N8N Workflow Fix
The n8n workflow needs these modifications:

1. **HTTP Request Node for File Upload:**
```json
{
  "method": "PUT",
  "url": "https://{{ $json.storageAccount }}.blob.core.windows.net/{{ $json.container }}/{{ $json.path }}{{ $json.sasToken }}",
  "headers": {
    "x-ms-blob-type": "BlockBlob",
    "x-ms-blob-overwrite": "true",
    "x-ms-blob-cache-control": "no-cache",
    "Content-Type": "{{ $binary.file.mimeType }}"
  },
  "sendBinaryData": true,
  "binaryPropertyName": "file"
}
```

2. **Add Pre-Upload Check Node:**
```javascript
// N8N Function Node to check and handle duplicates
const blobPath = `FCS-OriginalClients/${items[0].json.client}/${items[0].json.category}/${items[0].json.fileName}`;

// Check if file exists
const checkUrl = `https://saxtechfcs.blob.core.windows.net/fcs-clients/${blobPath}?comp=metadata`;

try {
  const response = await $http.head(checkUrl, {
    headers: {
      'x-ms-version': '2020-10-02'
    }
  });
  
  if (response.status === 200) {
    // File exists - add overwrite flag
    items[0].json.overwrite = true;
    items[0].json.existingFile = true;
  }
} catch (error) {
  // File doesn't exist
  items[0].json.overwrite = false;
  items[0].json.existingFile = false;
}

return items;
```

## Issue 2: Instant Index Updates

### Current Problem
After document changes, the Azure Cognitive Search index doesn't update immediately, causing search results to be stale.

### Solution: Trigger Immediate Indexer Run

#### Implementation Steps:

1. **Add Index Management Functions:**

```javascript
// Configuration for Azure Cognitive Search
const AZURE_SEARCH = {
  endpoint: 'https://your-search-service.search.windows.net',
  apiKey: 'your-admin-key', // Store securely
  indexerName: 'construction-docs-indexer',
  indexName: 'construction-docs-index'
};

// Function to trigger indexer run
async function triggerIndexerRun() {
  const url = `${AZURE_SEARCH.endpoint}/indexers/${AZURE_SEARCH.indexerName}/run?api-version=2020-06-30`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': AZURE_SEARCH.apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok || response.status === 202) {
      return { success: true, message: 'Indexer run started' };
    } else {
      throw new Error(`Indexer trigger failed: ${response.status}`);
    }
  } catch (error) {
    console.error('Error triggering indexer:', error);
    return { success: false, error: error.message };
  }
}

// Function to check indexer status
async function checkIndexerStatus() {
  const url = `${AZURE_SEARCH.endpoint}/indexers/${AZURE_SEARCH.indexerName}/status?api-version=2020-06-30`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'api-key': AZURE_SEARCH.apiKey
      }
    });
    
    const data = await response.json();
    return {
      status: data.status,
      lastRun: data.lastResult,
      isRunning: data.status === 'running'
    };
  } catch (error) {
    console.error('Error checking indexer status:', error);
    return null;
  }
}

// Function to wait for indexer completion
async function waitForIndexerCompletion(maxWaitTime = 30000) {
  const startTime = Date.now();
  const checkInterval = 2000; // Check every 2 seconds
  
  while (Date.now() - startTime < maxWaitTime) {
    const status = await checkIndexerStatus();
    
    if (status && !status.isRunning) {
      return { completed: true, status };
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  return { completed: false, timeout: true };
}
```

2. **Integrate with File Operations:**

```javascript
// Enhanced processFile function with indexing
async function processFileWithIndexing(file, category) {
  // Step 1: Upload file
  const uploadResult = await uploadFile(file, category);
  
  if (!uploadResult.success) {
    throw new Error('Upload failed');
  }
  
  // Step 2: Trigger indexer
  showIndexingStatus('Updating search index...');
  const indexResult = await triggerIndexerRun();
  
  if (indexResult.success) {
    // Step 3: Wait for completion (with timeout)
    const completion = await waitForIndexerCompletion(15000);
    
    if (completion.completed) {
      showIndexingStatus('Index updated successfully!', 'success');
    } else {
      showIndexingStatus('Index is updating in background...', 'warning');
    }
  } else {
    showIndexingStatus('Index update queued for next scheduled run', 'info');
  }
  
  return uploadResult;
}

// UI feedback for indexing status
function showIndexingStatus(message, type = 'info') {
  const statusDiv = document.getElementById('indexingStatus') || createIndexingStatusDiv();
  
  statusDiv.className = `indexing-status ${type}`;
  statusDiv.innerHTML = `
    <div class="status-icon">${getStatusIcon(type)}</div>
    <div class="status-message">${message}</div>
  `;
  
  statusDiv.style.display = 'flex';
  
  if (type === 'success') {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 5000);
  }
}

function createIndexingStatusDiv() {
  const div = document.createElement('div');
  div.id = 'indexingStatus';
  div.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    background: white;
    border: 2px solid var(--blueprint-blue);
    border-radius: 8px;
    padding: 1rem;
    display: none;
    align-items: center;
    gap: 0.5rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 9998;
    animation: slideIn 0.3s ease-out;
  `;
  document.body.appendChild(div);
  return div;
}
```

3. **N8N Webhook Enhancement:**

Add this to your n8n workflow after file upload/delete operations:

```javascript
// N8N Function Node - Trigger Indexer
const searchEndpoint = 'https://your-search-service.search.windows.net';
const apiKey = $credentials.azureSearch.apiKey;
const indexerName = 'construction-docs-indexer';

// Trigger indexer run
const response = await $http.post(
  `${searchEndpoint}/indexers/${indexerName}/run?api-version=2020-06-30`,
  {},
  {
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json'
    }
  }
);

// Return status
items[0].json.indexerTriggered = response.status === 202;
items[0].json.indexMessage = response.status === 202 
  ? 'Search index update initiated' 
  : 'Index update scheduled for next run';

return items;
```

## Issue 3: Better User Experience

### Add Real-time Feedback

```javascript
// Enhanced upload with progress and status
async function uploadWithFullFeedback(files, category, client) {
  const uploadStatus = {
    total: files.length,
    completed: 0,
    failed: 0,
    duplicates: 0
  };
  
  // Check for duplicates first
  const duplicateCheck = await checkForDuplicates(files, client, category);
  
  if (duplicateCheck === 'cancel') {
    return;
  }
  
  // Show upload progress UI
  showUploadProgress(uploadStatus);
  
  for (const file of files) {
    try {
      // Upload with overwrite handling
      const result = await uploadFileWithOverwrite(file, category, client, duplicateCheck);
      
      if (result.overwritten) {
        uploadStatus.duplicates++;
      }
      
      uploadStatus.completed++;
      updateUploadProgress(uploadStatus);
      
    } catch (error) {
      uploadStatus.failed++;
      console.error(`Failed to upload ${file.name}:`, error);
    }
  }
  
  // Trigger index update once for all files
  if (uploadStatus.completed > 0) {
    await triggerIndexerRun();
    showIndexingStatus('Search index is updating...', 'info');
  }
  
  // Show final status
  showUploadSummary(uploadStatus);
}
```

## Configuration Updates Needed

### 1. Azure Cognitive Search Settings
- Set indexer to "On Demand" mode instead of scheduled
- Configure incremental change tracking
- Enable soft delete detection

### 2. N8N Workflow Updates
- Add overwrite handling nodes
- Add indexer trigger nodes
- Implement proper error handling

### 3. Front-end Updates
- Add duplicate detection UI
- Add indexing status indicators
- Improve upload feedback

## Testing Checklist

- [ ] Upload new file - should succeed
- [ ] Upload duplicate file - should show options dialog
- [ ] Choose overwrite - file should be replaced
- [ ] Choose rename - file should be saved with new name
- [ ] Delete file - should be removed from storage and index
- [ ] Check search after upload - results should appear within 30 seconds
- [ ] Check search after delete - results should be removed within 30 seconds
- [ ] Upload multiple files - batch operations should work
- [ ] Network error handling - should show appropriate messages

## Security Considerations

1. **API Key Storage**: Never store Azure Search admin keys in client-side code
2. **Use Webhooks**: Route all Azure Search operations through your n8n webhook
3. **Rate Limiting**: Implement throttling for indexer triggers
4. **Access Control**: Validate user permissions before operations

## Implementation Priority

1. **Phase 1**: Fix file overwrite in n8n workflow
2. **Phase 2**: Add client-side duplicate detection
3. **Phase 3**: Implement instant indexing triggers
4. **Phase 4**: Add comprehensive UI feedback
5. **Phase 5**: Optimize batch operations

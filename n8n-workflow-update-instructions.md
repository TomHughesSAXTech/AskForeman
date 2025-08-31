# n8n Workflow Update Instructions

## How to Fix the Client Field Issue in n8n

### 1. Open Your n8n Workflow
- Go to https://workflows.saxtechnology.com
- Open the "SAXTech Foreman AI" workflow
- Find the node named **"Prepare Search Index1"** (it's a Code node)

### 2. Replace the Code
- Click on the "Prepare Search Index1" node to open it
- Select ALL the existing JavaScript code in the editor
- Delete it completely
- Copy the ENTIRE code from the file `n8n-prepare-search-index-fixed.js`
- Paste it into the n8n code editor

### 3. What This Fix Does
The updated code ensures that:
- ✅ The `client` field is ALWAYS set (never null or empty)
- ✅ It checks multiple sources for client info in priority order:
  1. `clientName` field (from form data)
  2. `client` field
  3. Extracts from blob storage path
  4. Extracts from converted path
  5. Uses folder/project name as fallback
  6. Last resort: creates traceable "unknown-client-{timestamp}"
- ✅ Creates proper unique document IDs
- ✅ Handles errors gracefully without losing documents

### 4. Save and Test
1. Click "Save" on the node
2. Click "Save" on the workflow
3. Test with a new document upload to verify the client field is properly set

### 5. Clean Up Existing Bad Documents
After updating the workflow, use the Admin Panel to:
1. Go to System Operations tab
2. Click "View Index Contents"
3. Click "Select Problematic" to select documents with missing client info
4. Click "Delete Selected" to remove them
5. Re-upload any important documents that were affected

## Key Changes Made

### Before (Problem):
```javascript
const client = item.json.client || '';
// This resulted in empty/null client fields
```

### After (Fixed):
```javascript
// Multiple fallbacks to ensure client is always set
let clientValue = null;

// Check multiple sources in priority order
if (item.json.clientName && item.json.clientName !== '') {
  clientValue = item.json.clientName;
} 
// ... multiple other checks ...

// Always ensure we have a valid value
if (!clientValue) {
  clientValue = `unknown-client-${Date.now()}`;
}
```

## Testing the Fix

### Test Upload Flow:
1. Select a client in the main app
2. Upload a document
3. Check the Admin Panel index viewer
4. Verify the document shows with the correct client name (not "Unknown")

### Test Deletion:
1. Try deleting a client from the Admin Panel
2. Verify all associated documents are removed from the index

### Test Search Filtering:
1. Use the chat with a specific client selected
2. Verify it only searches that client's documents

## Troubleshooting

If documents still show with "Unknown" client after the update:
1. Check the n8n execution logs for the workflow
2. Look for console.log output showing which client source was used
3. Verify the form is sending `clientName` field in the upload
4. Check that the workflow saved correctly

## Important Notes

- This fix ensures backwards compatibility with existing documents
- JSONL files will properly inherit the client from their source documents
- The cleanup in Admin Panel will only remove truly problematic documents
- Client-info.json files are preserved as they contain useful metadata

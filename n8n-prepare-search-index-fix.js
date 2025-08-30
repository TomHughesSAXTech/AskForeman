// Fixed Prepare Search Index1 node - ensures fileName is properly included
// Index document in Azure Search with intelligent update detection

const uploadData = $json;

// Get the actual converted content from earlier in the pipeline
const conversionNode = $node["Process Conversion"]?.json || 
                       $node["Upload JSONL"]?.json || 
                       $node["Upload Converted JSONL"]?.json || {};
const convertedContent = conversionNode.jsonlContent || conversionNode.convertedContent || '';

// Safely get client name - check multiple sources in the pipeline
let clientValue = uploadData.client || 
                  uploadData.clientName || 
                  conversionNode.client || 
                  conversionNode.clientName ||
                  $node["Prepare File Data"]?.json?.client ||
                  $node["Prepare File Data"]?.json?.clientName ||
                  $node["Pass Through Data"]?.json?.client ||
                  $node["Pass Through Data"]?.json?.clientName ||
                  $node["Preserve Upload Data"]?.json?.client ||
                  $node["Preserve Upload Data"]?.json?.clientName ||
                  'noclient';
clientValue = clientValue.replace(/^[_-]+/, '').trim() || 'noclient';

let category = uploadData.category || uploadData.categoryFolder || 'general';
category = category.replace(/^[_-]+/, '').trim() || 'general';

// CRITICAL FIX: Get the fileName from multiple possible sources
let fileName = uploadData.fileName || 
               uploadData.uniqueFileName || 
               uploadData.originalFileName ||
               $node["Prepare File Data"]?.json?.fileName ||
               $node["Prepare File Data"]?.json?.uniqueFileName ||
               $node["Prepare File Data"]?.json?.originalFileName ||
               'file';

// Remove timestamp from fileName for display (but keep full name for blob path)
const fileNameForDisplay = fileName.replace(/_\d{13}/, '').replace(/_\d{8}_\d{6}/, '');

console.log('File names found:', {
  original: fileName,
  display: fileNameForDisplay,
  fromUploadData: uploadData.fileName,
  fromUniqueFileName: uploadData.uniqueFileName
});

fileName = fileName.replace(/^[_-]+/, '').trim() || 'file';

// Log what we found for debugging
console.log('Client value found:', clientValue);
console.log('Category:', category);
console.log('File name for index:', fileNameForDisplay);
console.log('Full file name:', fileName);
console.log('Content length:', convertedContent ? convertedContent.length : 0);

// Generate a deterministic ID based on client, category, and filename
// This ensures the same file always gets the same ID (enabling updates)
const baseId = `${clientValue}_${category}_${fileNameForDisplay}`
  .replace(/[^a-zA-Z0-9_-]/g, '_')
  .replace(/^[_-]+/, '')
  .replace(/_{2,}/g, '_')
  .toLowerCase()
  .substring(0, 100);

// Create a simple hash of the path for uniqueness without crypto module
const pathString = `${clientValue}/${category}/${fileNameForDisplay}`;
let hash = 0;
for (let i = 0; i < pathString.length; i++) {
  const char = pathString.charCodeAt(i);
  hash = ((hash << 5) - hash) + char;
  hash = hash & hash; // Convert to 32bit integer
}
const pathHash = Math.abs(hash).toString(36).substring(0, 8);

let documentId = `${baseId}_${pathHash}`;

// Final safety check
if (!documentId || documentId.startsWith('_')) {
  documentId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

console.log('Document ID for indexing:', documentId);
console.log('This ID will be consistent for the same file path');

// Create search document with mergeOrUpload action (handles both create and update automatically)
const searchDocument = {
  "@search.action": "mergeOrUpload", // This automatically handles create vs update
  "id": documentId,
  "client": clientValue === 'noclient' ? '' : clientValue,
  "category": category === 'general' ? '' : category,
  "fileName": fileNameForDisplay, // USE THE DISPLAY NAME WITHOUT TIMESTAMP
  "blobPath": uploadData.originalFilePath || uploadData.convertedFilePath || '',
  "content": convertedContent,
  "uploadedAt": uploadData.uploadedAt || new Date().toISOString(),
  "mimeType": uploadData.mimeType || 'application/octet-stream',
  "convertedPath": uploadData.convertedFilePath || uploadData.convertedPath || ''
};

// Add metadata if available
if (uploadData.metadata) {
  searchDocument.metadata = typeof uploadData.metadata === 'string' 
    ? uploadData.metadata 
    : JSON.stringify(uploadData.metadata);
}

// Add contentVector if we have embeddings
if (uploadData.contentVector || uploadData.embeddings) {
  searchDocument.contentVector = uploadData.contentVector || uploadData.embeddings;
}

// Remove null/undefined/empty fields (except content which can be empty)
// BUT KEEP fileName even if it seems empty
Object.keys(searchDocument).forEach(key => {
  if (key !== 'content' && key !== '@search.action' && key !== 'id' && key !== 'fileName') {
    if (searchDocument[key] === null || searchDocument[key] === undefined || searchDocument[key] === '') {
      delete searchDocument[key];
    }
  }
});

console.log('Search document prepared');
console.log('Action: mergeOrUpload (creates new or updates existing)');
console.log('Fields:', Object.keys(searchDocument).join(', '));
console.log('Client field value:', searchDocument.client || '[empty]');
console.log('FileName field value:', searchDocument.fileName || '[empty]');

return [{
  json: {
    ...uploadData,
    searchDocument: searchDocument,
    indexPayload: {
      "value": [searchDocument]
    },
    documentId: documentId,
    indexOperation: 'mergeOrUpload',
    fileNameInIndex: searchDocument.fileName // Pass this through for verification
  }
}];

// Fixed code for n8n "Prepare Search Index1" node
// This ensures the client field is always properly set from the upload data

// Get all input items
const items = $input.all();
const outputItems = [];

for (const item of items) {
  try {
    // Extract client information from multiple possible sources
    // Priority order: clientName > client > folder path extraction
    let clientValue = null;
    
    // 1. First check clientName field (from form data)
    if (item.json.clientName && item.json.clientName !== '') {
      clientValue = item.json.clientName;
      console.log('Client from clientName field:', clientValue);
    }
    // 2. Then check client field
    else if (item.json.client && item.json.client !== '') {
      clientValue = item.json.client;
      console.log('Client from client field:', clientValue);
    }
    // 3. Try to extract from blobPath if available
    else if (item.json.blobPath) {
      const pathMatch = item.json.blobPath.match(/FCS-(?:Original|Converted)Clients\/([^\/]+)\//);
      if (pathMatch && pathMatch[1]) {
        clientValue = pathMatch[1];
        console.log('Client extracted from blobPath:', clientValue);
      }
    }
    // 4. Try to extract from convertedPath
    else if (item.json.convertedPath) {
      const pathMatch = item.json.convertedPath.match(/FCS-(?:Original|Converted)Clients\/([^\/]+)\//);
      if (pathMatch && pathMatch[1]) {
        clientValue = pathMatch[1];
        console.log('Client extracted from convertedPath:', clientValue);
      }
    }
    // 5. Try fileName if it contains path info
    else if (item.json.fileName && item.json.fileName.includes('/')) {
      const pathParts = item.json.fileName.split('/');
      if (pathParts.length > 2 && pathParts[0] === 'FCS-OriginalClients') {
        clientValue = pathParts[1];
        console.log('Client extracted from fileName path:', clientValue);
      }
    }
    
    // Final validation - ensure we have a valid client value
    if (!clientValue || clientValue === '' || clientValue === 'undefined' || clientValue === 'null') {
      // Log warning but don't fail - use a fallback
      console.warn('Warning: No valid client found for document:', item.json.fileName);
      
      // Try one more time with any available data
      if (item.json.folderName) {
        clientValue = item.json.folderName;
      } else if (item.json.projectName) {
        clientValue = item.json.projectName;
      } else {
        // Last resort - use "unknown-client" with timestamp to make it traceable
        clientValue = `unknown-client-${Date.now()}`;
        console.error('Using fallback client value:', clientValue);
      }
    }
    
    // Create the document ID - ensure it's unique and valid
    let docId = '';
    const fileName = item.json.fileName || 'unknown-file';
    const category = item.json.category || 'documents';
    
    // Clean the client value for use in ID (remove special characters)
    const cleanClient = clientValue.toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    
    // Clean the filename for use in ID
    const cleanFileName = fileName.toLowerCase()
      .replace(/\.[^.]+$/, '') // Remove extension
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    
    // Generate unique ID
    docId = `${cleanClient}_${category}_${cleanFileName}_${Math.random().toString(36).substr(2, 6)}`;
    
    // Prepare the search document with all fields properly set
    const searchDoc = {
      id: docId,
      content: item.json.content || '',
      contentVector: item.json.contentVector || [],
      client: clientValue, // This is now guaranteed to have a value
      category: category,
      fileName: fileName,
      uploadedAt: item.json.uploadedAt || new Date().toISOString(),
      blobPath: item.json.blobPath || null,
      mimeType: item.json.mimeType || 'application/octet-stream',
      convertedPath: item.json.convertedPath || null,
      metadata: item.json.metadata || null
    };
    
    // Log the final document for debugging
    console.log('Prepared search document:', {
      id: searchDoc.id,
      client: searchDoc.client,
      fileName: searchDoc.fileName,
      category: searchDoc.category
    });
    
    // Add to output
    outputItems.push({
      json: searchDoc,
      binary: item.binary
    });
    
  } catch (error) {
    console.error('Error processing item:', error);
    console.error('Item data:', JSON.stringify(item.json, null, 2));
    
    // Even on error, try to create a minimal valid document
    const fallbackDoc = {
      id: `error_doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      content: item.json.content || 'Error processing document',
      contentVector: [],
      client: item.json.clientName || item.json.client || 'error-client',
      category: item.json.category || 'documents',
      fileName: item.json.fileName || 'error-file',
      uploadedAt: new Date().toISOString(),
      blobPath: null,
      mimeType: 'text/plain',
      convertedPath: null,
      metadata: { error: error.message }
    };
    
    outputItems.push({
      json: fallbackDoc,
      binary: item.binary
    });
  }
}

// Return all processed items
return outputItems;

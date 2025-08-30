// DIAGNOSTIC VERSION - Fixed for n8n output format
// This will help us see exactly what's being searched and what's returned

const chatInput = $json.chatInput || $json.query || $json.text || $json.message || '';
const client = $json.client || 'general';
const queryLower = (chatInput || '').toLowerCase();

console.log('=== DIAGNOSTIC START ===');
console.log('Chat Input:', chatInput);
console.log('Client:', client);
console.log('Query Lower:', queryLower);
console.log('Full input JSON:', JSON.stringify($json, null, 2));

// Check if this is asking for documents
if (queryLower.includes('doc') || queryLower.includes('what') || queryLower.includes('have')) {
  console.log('Document listing request detected');
  
  const searchService = 'fcssearchservice';
  const indexName = 'fcs-construction-docs-index-v2';
  const apiVersion = '2023-11-01';
  const adminKey = 'UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv';
  
  try {
    // First, try a wildcard search with client filter
    let searchRequest = {
      search: "*",
      queryType: "simple",
      filter: `client eq '${client}'`,
      top: 50,
      select: "id,client,category,fileName,content,uploadedAt,blobPath",
      count: true
    };
    
    console.log('Search Request WITH filter:', JSON.stringify(searchRequest, null, 2));
    
    const searchUrl = `https://${searchService}.search.windows.net/indexes/${indexName}/docs/search?api-version=${apiVersion}`;
    
    let response = await this.helpers.httpRequest({
      method: 'POST',
      url: searchUrl,
      headers: {
        'api-key': adminKey,
        'Content-Type': 'application/json'
      },
      body: searchRequest,
      json: true
    });
    
    console.log('Response WITH filter - Count:', response['@odata.count']);
    console.log('Response WITH filter - Results:', JSON.stringify(response.value, null, 2));
    
    if (response.value && response.value.length > 0) {
      // Found documents with filter
      const results = response.value;
      let responseText = `## Documents found for client "${client}":\n\n`;
      
      results.forEach((doc, index) => {
        console.log(`Document ${index + 1}:`, {
          id: doc.id,
          client: doc.client,
          category: doc.category,
          fileName: doc.fileName
        });
        
        const fileName = doc.fileName || 'Unknown filename';
        const category = doc.category || 'unknown category';
        responseText += `${index + 1}. **${fileName}** (Category: ${category})\n`;
        responseText += `   - Client: ${doc.client || 'not specified'}\n`;
        responseText += `   - ID: ${doc.id}\n\n`;
      });
      
      // Return in n8n format
      return {
        response: responseText,
        documents: results,
        count: response['@odata.count']
      };
    } else {
      // No results with filter, try without filter to see if documents exist at all
      console.log('No results with client filter, trying without filter...');
      
      searchRequest = {
        search: "*",
        queryType: "simple",
        top: 10,
        select: "id,client,category,fileName,uploadedAt",
        count: true
      };
      
      console.log('Search Request WITHOUT filter:', JSON.stringify(searchRequest, null, 2));
      
      response = await this.helpers.httpRequest({
        method: 'POST',
        url: searchUrl,
        headers: {
          'api-key': adminKey,
          'Content-Type': 'application/json'
        },
        body: searchRequest,
        json: true
      });
      
      console.log('Response WITHOUT filter - Count:', response['@odata.count']);
      console.log('Response WITHOUT filter - First 3 results:', JSON.stringify(response.value?.slice(0, 3), null, 2));
      
      if (response.value && response.value.length > 0) {
        // There are documents but not for this client
        const clients = [...new Set(response.value.map(d => d.client))];
        console.log('Available clients in index:', clients);
        
        const diagnosticMsg = `No documents found for client "${client}".\n\nDocuments exist for these clients: ${clients.join(', ')}\n\nDiagnostic info:\n- Total documents in index: ${response['@odata.count']}\n- Searched client: "${client}"\n- Available clients: ${clients.join(', ')}`;
        
        return {
          response: diagnosticMsg,
          documents: [],
          availableClients: clients,
          totalInIndex: response['@odata.count']
        };
      } else {
        return {
          response: `No documents found in the entire index. The index appears to be empty.`,
          documents: [],
          count: 0
        };
      }
    }
    
  } catch (error) {
    console.error('Search error:', error);
    const errorMsg = `Error during search: ${error.message}\n\nDiagnostic info:\n- Client: ${client}\n- Error details: ${JSON.stringify(error, null, 2)}`;
    
    return {
      response: errorMsg,
      error: true,
      errorDetails: error
    };
  }
} else {
  // For non-document queries, return simple message
  return {
    response: `Query type not recognized. Please ask "what documents do you have?" to list available documents.`,
    queryType: 'unknown'
  };
}

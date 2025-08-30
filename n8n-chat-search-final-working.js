// FINAL WORKING VERSION - Chat Search with proper document display
// Handles document listings and content retrieval

const chatInput = $json.chatInput || $json.query || $json.text || $json.message || '';
const client = $json.client || 'general';
const queryLower = (chatInput || '').toLowerCase();

console.log('Chat Search Input:', { chatInput, client });

// Azure Search Configuration
const searchService = 'fcssearchservice';
const indexName = 'fcs-construction-docs-index-v2';
const apiVersion = '2023-11-01';
const adminKey = 'UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv';

// Check if this is asking for document list
if (queryLower.includes('doc') || queryLower.includes('what') || queryLower.includes('have') || queryLower.includes('list')) {
  console.log('Document listing request detected for client:', client);
  
  try {
    // Search for all documents for this client
    const searchRequest = {
      search: "*",
      queryType: "simple",
      filter: `client eq '${client}'`,
      top: 50,
      select: "id,client,category,fileName,uploadedAt,blobPath,content",
      count: true
    };
    
    const searchUrl = `https://${searchService}.search.windows.net/indexes/${indexName}/docs/search?api-version=${apiVersion}`;
    
    const response = await this.helpers.httpRequest({
      method: 'POST',
      url: searchUrl,
      headers: {
        'api-key': adminKey,
        'Content-Type': 'application/json'
      },
      body: searchRequest,
      json: true
    });
    
    const results = response.value || [];
    const count = response['@odata.count'] || results.length;
    
    console.log(`Found ${count} documents for client: ${client}`);
    
    if (results.length === 0) {
      return `No documents found for client "${client}". Please upload documents for this client first.`;
    }
    
    // Group documents by category
    const docsByCategory = {};
    results.forEach(doc => {
      const category = doc.category || 'general';
      if (!docsByCategory[category]) {
        docsByCategory[category] = [];
      }
      docsByCategory[category].push(doc);
    });
    
    // Build response
    let responseText = `## Available Documents for ${client}\n\n`;
    responseText += `Found ${count} document(s) in your system.\n\n`;
    
    Object.keys(docsByCategory).sort().forEach(category => {
      if (docsByCategory[category].length > 0) {
        responseText += `### ${category.charAt(0).toUpperCase() + category.slice(1)}:\n`;
        
        docsByCategory[category].forEach((doc, index) => {
          const fileName = doc.fileName || 'Unnamed document';
          const uploadDate = doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'Unknown date';
          const hasContent = doc.content && doc.content.length > 0;
          
          responseText += `${index + 1}. **${fileName}**\n`;
          responseText += `   - Uploaded: ${uploadDate}\n`;
          responseText += `   - Status: ${hasContent ? '✅ Content available' : '⚠️ Content not indexed'}\n`;
          
          // If content exists, show a preview
          if (hasContent && doc.content.length > 100) {
            const preview = doc.content.substring(0, 200).replace(/\r?\n/g, ' ').trim();
            responseText += `   - Preview: "${preview}..."\n`;
          }
          responseText += '\n';
        });
      }
    });
    
    responseText += `---\n`;
    responseText += `💡 Ask me specific questions about these documents, or request details from any particular document.`;
    
    return responseText;
    
  } catch (error) {
    console.error('Document search error:', error);
    return `Error retrieving documents: ${error.message}. Please try again.`;
  }
}

// Handle specific document content requests
if (queryLower.includes('open') || queryLower.includes('show') || queryLower.includes('extract') || queryLower.includes('content')) {
  console.log('Content extraction request detected');
  
  try {
    // Search for documents with content
    const searchRequest = {
      search: "*",
      queryType: "simple",
      filter: `client eq '${client}'`,
      top: 10,
      select: "id,fileName,content,category",
      count: true
    };
    
    const searchUrl = `https://${searchService}.search.windows.net/indexes/${indexName}/docs/search?api-version=${apiVersion}`;
    
    const response = await this.helpers.httpRequest({
      method: 'POST',
      url: searchUrl,
      headers: {
        'api-key': adminKey,
        'Content-Type': 'application/json'
      },
      body: searchRequest,
      json: true
    });
    
    const results = response.value || [];
    
    if (results.length === 0) {
      return `No documents found for client "${client}".`;
    }
    
    // Find documents with content
    const docsWithContent = results.filter(doc => doc.content && doc.content.length > 0);
    
    if (docsWithContent.length === 0) {
      return `Documents are available for "${client}" but content has not been extracted yet. The indexing process may still be running.`;
    }
    
    // Return content from first document with content
    const doc = docsWithContent[0];
    const contentPreview = doc.content.substring(0, 2000).replace(/\r?\n/g, '\n');
    
    let responseText = `## Document Content: ${doc.fileName}\n\n`;
    responseText += `### Content Extract:\n\n`;
    responseText += contentPreview;
    
    if (doc.content.length > 2000) {
      responseText += `\n\n... [Document continues - ${doc.content.length} total characters]\n`;
      responseText += `\n💡 Ask me specific questions about this document to get targeted information.`;
    }
    
    return responseText;
    
  } catch (error) {
    console.error('Content extraction error:', error);
    return `Error extracting content: ${error.message}`;
  }
}

// Handle general queries - search within document content
if (chatInput && chatInput.trim() !== '') {
  console.log('General search query:', chatInput);
  
  try {
    const searchRequest = {
      search: chatInput,
      queryType: "simple",
      searchMode: "any",
      filter: client !== 'general' ? `client eq '${client}'` : null,
      top: 5,
      select: "fileName,category,content",
      highlight: "content",
      highlightPreTag: "**",
      highlightPostTag: "**",
      count: true
    };
    
    // Remove null filter if not needed
    if (!searchRequest.filter) {
      delete searchRequest.filter;
    }
    
    const searchUrl = `https://${searchService}.search.windows.net/indexes/${indexName}/docs/search?api-version=${apiVersion}`;
    
    const response = await this.helpers.httpRequest({
      method: 'POST',
      url: searchUrl,
      headers: {
        'api-key': adminKey,
        'Content-Type': 'application/json'
      },
      body: searchRequest,
      json: true
    });
    
    const results = response.value || [];
    const count = response['@odata.count'] || results.length;
    
    if (results.length === 0) {
      return `No results found for "${chatInput}" in ${client !== 'general' ? `client "${client}"` : 'any documents'}. Try different search terms or check if documents have been uploaded.`;
    }
    
    // Format search results
    let responseText = `## Search Results for: "${chatInput}"\n\n`;
    responseText += `Found ${count} relevant result(s)${client !== 'general' ? ` in ${client} documents` : ''}.\n\n`;
    
    results.forEach((result, index) => {
      responseText += `### ${index + 1}. ${result.fileName || 'Unknown document'}\n`;
      responseText += `Category: ${result.category || 'general'}\n\n`;
      
      // Show highlighted content if available
      if (result['@search.highlights'] && result['@search.highlights'].content) {
        responseText += `**Relevant excerpts:**\n`;
        result['@search.highlights'].content.slice(0, 3).forEach(highlight => {
          const cleaned = highlight.replace(/\r?\n/g, ' ').trim();
          responseText += `• ${cleaned}\n`;
        });
      } else if (result.content) {
        // Show regular excerpt if no highlights
        const excerpt = result.content.substring(0, 300).replace(/\r?\n/g, ' ').trim();
        responseText += `**Excerpt:** ${excerpt}...\n`;
      }
      responseText += '\n---\n\n';
    });
    
    return responseText;
    
  } catch (error) {
    console.error('Search error:', error);
    return `Error searching documents: ${error.message}`;
  }
}

// Default response for unrecognized queries
return `I can help you search through construction documents. Try asking:\n• "What documents do you have?"\n• "Show me the content"\n• Or search for specific terms like "windows", "upgrade", "procedure", etc.`;

// COMPREHENSIVE Client Search Tool - WITH FULL CONTENT EXTRACTION
// Handles all types of queries: listings, full content, searches
// Includes all the original comprehensive search features

const chatInput = $json.chatInput || $json.query || $json.text || $json.message || '';
const client = $json.client || 'general';
const queryLower = (chatInput || '').toLowerCase();

console.log('Client Search Input:', { chatInput, client, queryLower });

// Helper function to create inline PDF URLs (if needed for your UI)
function createInlinePDFUrl(clientName, category, fileName) {
  const baseUrl = 'https://saxtechfcs.blob.core.windows.net/fcs-clients';
  const path = `FCS-OriginalClients/${clientName}/${category}/${fileName}`;
  
  const sasParams = new URLSearchParams({
    'sp': 'racwdl',
    'st': '2025-08-08T05:00:57Z',
    'se': '2030-08-08T13:15:57Z',
    'spr': 'https',
    'sv': '2024-11-04',
    'sr': 'c',
    'sig': 'lJKK9jDZ59pJSNkKSgwaQIrCdBaJzx4XPzgEB2/rnIg='
  });
  
  const encodedPath = encodeURI(path);
  return `${baseUrl}/${encodedPath}?${sasParams.toString()}`;
}

// Azure Search Configuration
const searchService = 'fcssearchservice';
const indexName = 'fcs-construction-docs-index-v2';
const apiVersion = '2023-11-01';
const adminKey = 'UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv';

// Check if asking for document list
const isListRequest = queryLower.includes('what') || 
                     queryLower.includes('doc') || 
                     queryLower.includes('have') || 
                     queryLower.includes('list') ||
                     queryLower.includes('available');

if (isListRequest) {
  console.log('🔍 DETECTED DOCUMENT LIST REQUEST');
  
  try {
    // Get ALL documents for this client, including content
    const searchRequest = {
      search: "*",
      queryType: "simple",
      filter: `client eq '${client}'`,
      top: 100, // Get more results
      select: "id,client,category,fileName,content,uploadedAt,blobPath",
      count: true
    };

    console.log('List Request:', JSON.stringify(searchRequest, null, 2));

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
    
    // Filter out documents without proper filenames (orphaned/deleted docs)
    const validResults = results.filter(doc => 
      doc.fileName && 
      doc.fileName !== 'Unknown file' && 
      doc.fileName !== 'file' &&
      doc.fileName.trim() !== ''
    );
    
    if (validResults.length === 0) {
      return `No valid documents found for client "${client}". Please upload documents for this client.`;
    }

    // Group documents by category
    const docsByCategory = {};
    validResults.forEach(doc => {
      const category = doc.category || 'general';
      if (!docsByCategory[category]) {
        docsByCategory[category] = [];
      }
      docsByCategory[category].push(doc);
    });

    let responseText = `## Available Documents for Client: ${client}\n\n`;
    responseText += `Found ${validResults.length} document(s) in your system.\n\n`;
    
    Object.keys(docsByCategory).sort().forEach(category => {
      if (docsByCategory[category].length > 0) {
        responseText += `### ${category.charAt(0).toUpperCase() + category.slice(1)}:\n`;
        
        docsByCategory[category].forEach((doc, index) => {
          const fileName = doc.fileName;
          const hasContent = doc.content && doc.content.length > 0;
          const uploadDate = doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : '';
          
          responseText += `${index + 1}. **${fileName}**\n`;
          if (uploadDate) {
            responseText += `   - Uploaded: ${uploadDate}\n`;
          }
          responseText += `   - Status: ${hasContent ? '✅ Ready' : '⚠️ Processing'}\n`;
          
          // Show content preview if available
          if (hasContent) {
            const preview = doc.content.substring(0, 150).replace(/[\r\n]+/g, ' ').trim();
            responseText += `   - Preview: "${preview}..."\n`;
          }
          responseText += `\n`;
        });
      }
    });

    responseText += `---\n`;
    responseText += `💡 You can ask me to:\n`;
    responseText += `• Show the full content of any document\n`;
    responseText += `• Search for specific information\n`;
    responseText += `• Extract particular sections or details`;
    
    return responseText;
    
  } catch (error) {
    console.error('Document list error:', error);
    return `Error retrieving document list: ${error.message}`;
  }
}

// Handle requests for FULL CONTENT of a specific document
const wantsFullContent = queryLower.includes('all of it') || 
                        queryLower.includes('everything') ||
                        queryLower.includes('full') ||
                        queryLower.includes('entire') ||
                        queryLower.includes('complete') ||
                        queryLower.includes('tell me what') ||
                        queryLower.includes('show me') ||
                        queryLower.includes('content');

if (wantsFullContent || queryLower.includes('windows 11') || queryLower.includes('win11')) {
  console.log('FULL CONTENT REQUEST DETECTED');
  
  try {
    // Search for the specific document or get all docs with content
    let searchQuery = "*";
    
    // If they mentioned a specific document
    if (queryLower.includes('windows 11') || queryLower.includes('win11')) {
      searchQuery = "Windows 11 OR Win11 OR upgrade";
    }
    
    const searchRequest = {
      search: searchQuery,
      queryType: "simple",
      filter: `client eq '${client}'`,
      top: 10,
      select: "id,fileName,content,category,uploadedAt",
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
    
    // Find documents with actual content
    const docsWithContent = results.filter(doc => 
      doc.content && 
      doc.content.length > 0 && 
      doc.fileName && 
      doc.fileName !== 'Unknown file'
    );
    
    if (docsWithContent.length === 0) {
      return `No documents with extractable content found for "${client}". The documents may still be processing.`;
    }
    
    // Get the most relevant document
    const doc = docsWithContent[0];
    
    // Return FULL content formatted nicely
    let responseText = `# Document: ${doc.fileName}\n\n`;
    responseText += `**Client:** ${client}\n`;
    responseText += `**Category:** ${doc.category || 'general'}\n`;
    responseText += `**Content Length:** ${doc.content.length} characters\n\n`;
    responseText += `---\n\n`;
    responseText += `## Full Document Content:\n\n`;
    
    // Clean up the content for better display
    const cleanContent = doc.content
      .replace(/=== DOCUMENT ANALYSIS ===/g, '### Document Analysis')
      .replace(/=== EXTRACTED TEXT CONTENT ===/g, '### Extracted Content')
      .replace(/--- Page \d+ ---/g, (match) => `\n${match}\n`)
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
    
    // If content is very long, provide it in chunks
    if (cleanContent.length > 4000) {
      const firstPart = cleanContent.substring(0, 3500);
      responseText += firstPart;
      responseText += `\n\n... [Content continues - ${cleanContent.length - 3500} more characters]\n\n`;
      responseText += `💡 The document contains additional content. Ask me specific questions to get targeted information from the rest of the document.`;
    } else {
      responseText += cleanContent;
    }
    
    return responseText;
    
  } catch (error) {
    console.error('Content extraction error:', error);
    return `Error extracting document content: ${error.message}`;
  }
}

// Handle SPECIFIC SEARCH QUERIES within documents
if (chatInput && chatInput.trim() !== '') {
  console.log('SPECIFIC SEARCH QUERY:', chatInput);
  
  try {
    const searchRequest = {
      search: chatInput,
      queryType: "simple",
      searchMode: "any",
      filter: client !== 'general' ? `client eq '${client}'` : null,
      top: 10,
      select: "fileName,category,content",
      highlight: "content",
      highlightPreTag: "**",
      highlightPostTag: "**",
      count: true
    };
    
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
    
    // Filter out invalid results
    const validResults = results.filter(r => r.fileName && r.fileName !== 'Unknown file');
    
    if (validResults.length === 0) {
      return `No results found for "${chatInput}" in ${client !== 'general' ? `client "${client}" documents` : 'any documents'}. Try different search terms.`;
    }
    
    let responseText = `## Search Results: "${chatInput}"\n\n`;
    responseText += `Found ${validResults.length} relevant result(s).\n\n`;
    
    validResults.forEach((result, index) => {
      responseText += `### ${index + 1}. From ${result.fileName}\n`;
      responseText += `Category: ${result.category || 'general'}\n\n`;
      
      // Show highlighted matches or relevant excerpts
      if (result['@search.highlights'] && result['@search.highlights'].content) {
        responseText += `**Relevant sections:**\n`;
        result['@search.highlights'].content.slice(0, 5).forEach(highlight => {
          const cleaned = highlight.replace(/[\r\n]+/g, ' ').trim();
          if (cleaned.length > 50) {
            responseText += `• ${cleaned}\n`;
          }
        });
      } else if (result.content) {
        // Find relevant excerpt around the search term
        const lowerContent = result.content.toLowerCase();
        const searchTerms = chatInput.toLowerCase().split(' ');
        let excerptStart = 0;
        
        for (const term of searchTerms) {
          const index = lowerContent.indexOf(term);
          if (index !== -1) {
            excerptStart = Math.max(0, index - 100);
            break;
          }
        }
        
        const excerpt = result.content.substring(excerptStart, excerptStart + 400).replace(/[\r\n]+/g, ' ').trim();
        responseText += `**Excerpt:** ...${excerpt}...\n`;
      }
      
      responseText += `\n---\n\n`;
    });
    
    responseText += `💡 Need more details? Ask me to show the full content of any specific document.`;
    
    return responseText;
    
  } catch (error) {
    console.error('Search error:', error);
    return `Error searching documents: ${error.message}`;
  }
}

// Default response
return `I can help you with construction documents for "${client}". Try:\n• "What documents do you have?" - to list all documents\n• "Show me the Windows 11 document" - to see specific content\n• "Tell me about [topic]" - to search for specific information\n• "All of it" or "full content" - to see complete document content`;

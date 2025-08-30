// COMPREHENSIVE Client Search Tool - AUTO CONTENT VERSION
// Automatically shows document content when listing documents

const chatInput = $json.chatInput || $json.query || $json.text || $json.message || '';
const client = $json.client || 'general';
const queryLower = (chatInput || '').toLowerCase();

console.log('Client Search Input:', { chatInput, client, queryLower });

// Azure Search Configuration
const searchService = 'fcssearchservice';
const indexName = 'fcs-construction-docs-index-v2';
const apiVersion = '2023-11-01';
const adminKey = 'UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv';

// Check if asking about documents (list request but with automatic content display)
const isDocumentQuery = queryLower.includes('what') || 
                       queryLower.includes('doc') || 
                       queryLower.includes('have') || 
                       queryLower.includes('list') ||
                       queryLower.includes('available') ||
                       queryLower.includes('show');

if (isDocumentQuery) {
  console.log('🔍 DOCUMENT QUERY - Will show content automatically');
  
  try {
    // Get ALL documents for this client, INCLUDING FULL CONTENT
    const searchRequest = {
      search: "*",
      queryType: "simple",
      filter: `client eq '${client}'`,
      top: 100,
      select: "id,client,category,fileName,content,uploadedAt,blobPath",
      count: true
    };

    console.log('Search Request:', JSON.stringify(searchRequest, null, 2));

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
    
    // Filter out invalid documents
    const validResults = results.filter(doc => 
      doc.fileName && 
      doc.fileName !== 'Unknown file' && 
      doc.fileName !== 'file' &&
      doc.fileName.trim() !== ''
    );
    
    if (validResults.length === 0) {
      return `No documents found for client "${client}". Please upload documents for this client.`;
    }

    // Build comprehensive response with FULL CONTENT
    let responseText = `# Documents for ${client}\n\n`;
    responseText += `Found ${validResults.length} document(s) with the following content:\n\n`;
    responseText += `---\n\n`;
    
    // Show each document with its FULL CONTENT
    validResults.forEach((doc, index) => {
      const fileName = doc.fileName;
      const category = doc.category || 'general';
      const hasContent = doc.content && doc.content.length > 0;
      
      responseText += `## ${index + 1}. ${fileName}\n`;
      responseText += `**Category:** ${category}\n`;
      
      if (doc.uploadedAt) {
        const uploadDate = new Date(doc.uploadedAt).toLocaleDateString();
        responseText += `**Uploaded:** ${uploadDate}\n`;
      }
      
      responseText += `\n`;
      
      // SHOW THE ACTUAL CONTENT
      if (hasContent) {
        responseText += `### Document Content:\n\n`;
        
        // Clean and format the content
        const cleanContent = doc.content
          .replace(/=== DOCUMENT ANALYSIS ===/g, '#### Document Analysis')
          .replace(/=== EXTRACTED TEXT CONTENT ===/g, '#### Extracted Content')
          .replace(/=== CONSTRUCTION DOCUMENT ANALYSIS ===/g, '#### Construction Analysis')
          .replace(/=== METADATA ===/g, '#### Metadata')
          .replace(/--- Page (\d+) ---/g, '\n**Page $1**\n')
          .replace(/\r\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        
        // Show full content or truncate if very long
        if (cleanContent.length > 8000) {
          // For very long documents, show substantial content but truncate
          responseText += cleanContent.substring(0, 7500);
          responseText += `\n\n... [${cleanContent.length - 7500} more characters]\n\n`;
          responseText += `💡 **Note:** This document contains additional content. Ask specific questions to explore particular sections.\n`;
        } else {
          // Show complete content for reasonably sized documents
          responseText += cleanContent;
        }
      } else {
        responseText += `⚠️ *Content is still being processed or is not available*\n`;
      }
      
      responseText += `\n---\n\n`;
    });

    responseText += `\n## How can I help?\n`;
    responseText += `Now that I have the document content, you can:\n`;
    responseText += `• Ask specific questions about the Windows 11 upgrade process\n`;
    responseText += `• Request summaries of specific sections\n`;
    responseText += `• Get step-by-step procedures\n`;
    responseText += `• Find troubleshooting information\n`;
    
    return responseText;
    
  } catch (error) {
    console.error('Document search error:', error);
    return `Error retrieving documents: ${error.message}`;
  }
}

// Handle specific content requests (when asking for "all of it", "everything", etc.)
const wantsAllContent = queryLower.includes('all of it') || 
                       queryLower.includes('everything') ||
                       queryLower.includes('full') ||
                       queryLower.includes('entire') ||
                       queryLower.includes('complete') ||
                       queryLower.includes('tell me what');

if (wantsAllContent) {
  console.log('FULL CONTENT REQUEST');
  
  try {
    const searchRequest = {
      search: "*",
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
    const docsWithContent = results.filter(doc => 
      doc.content && 
      doc.content.length > 0 && 
      doc.fileName && 
      doc.fileName !== 'Unknown file'
    );
    
    if (docsWithContent.length === 0) {
      return `No documents with content found for "${client}".`;
    }
    
    let responseText = `# Complete Document Content\n\n`;
    
    docsWithContent.forEach((doc, index) => {
      if (index > 0) responseText += `\n---\n\n`;
      
      responseText += `## ${doc.fileName}\n\n`;
      
      const cleanContent = doc.content
        .replace(/=== /g, '### ')
        .replace(/--- Page/g, '\n**Page')
        .replace(/\r\n/g, '\n')
        .trim();
      
      responseText += cleanContent;
    });
    
    return responseText;
    
  } catch (error) {
    console.error('Content extraction error:', error);
    return `Error extracting content: ${error.message}`;
  }
}

// Handle SPECIFIC SEARCH QUERIES
if (chatInput && chatInput.trim() !== '') {
  console.log('SPECIFIC SEARCH:', chatInput);
  
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
    
    if (results.length === 0) {
      return `No results found for "${chatInput}" in ${client !== 'general' ? `client "${client}" documents` : 'any documents'}.`;
    }
    
    let responseText = `# Search Results: "${chatInput}"\n\n`;
    responseText += `Found ${count} relevant result(s).\n\n`;
    
    results.forEach((result, index) => {
      responseText += `## ${index + 1}. From ${result.fileName || 'Unknown'}\n`;
      
      if (result['@search.highlights'] && result['@search.highlights'].content) {
        responseText += `**Relevant sections:**\n`;
        result['@search.highlights'].content.slice(0, 5).forEach(highlight => {
          const cleaned = highlight.replace(/[\r\n]+/g, ' ').trim();
          if (cleaned.length > 50) {
            responseText += `• ${cleaned}\n`;
          }
        });
      } else if (result.content) {
        // Show relevant excerpt
        const excerpt = result.content.substring(0, 500).replace(/[\r\n]+/g, ' ').trim();
        responseText += `**Excerpt:** ${excerpt}...\n`;
      }
      
      responseText += `\n`;
    });
    
    return responseText;
    
  } catch (error) {
    console.error('Search error:', error);
    return `Error searching: ${error.message}`;
  }
}

// Default response
return `I can help you with documents for "${client}". Try:\n• "What documents do you have?" - to see all content\n• "Search for [topic]" - to find specific information\n• Ask any specific question about your documents`;

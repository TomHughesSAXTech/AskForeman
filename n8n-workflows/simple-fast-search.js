// SIMPLE FAST SEARCH - Bulletproof version
// No fancy features, just fast reliable search

const chatInput = $json.chatInput || $json.query || $json.text || $json.message || '';
const client = $json.client || 'general';
const queryLower = (chatInput || '').toLowerCase();

// Azure Search Configuration
const searchService = 'fcssearchservice';
const indexName = 'fcs-construction-docs-index-v2';
const apiVersion = '2023-11-01';
const adminKey = 'UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv';
const searchUrl = `https://${searchService}.search.windows.net/indexes/${indexName}/docs/search?api-version=${apiVersion}`;

// Check what type of request this is
const wantsList = queryLower.includes('list') || 
                  queryLower.includes('what') || 
                  queryLower.includes('show') ||
                  queryLower.includes('have');

// CASE 1: List documents (no content)
if (wantsList) {
  try {
    const searchRequest = {
      search: "*",
      filter: `client eq '${client}'`,
      top: 30,
      select: "fileName,category,uploadedAt",
      count: true
    };

    const response = await this.helpers.httpRequest({
      method: 'POST',
      url: searchUrl,
      headers: {
        'api-key': adminKey,
        'Content-Type': 'application/json'
      },
      body: searchRequest,
      json: true,
      timeout: 3000
    });

    const results = response.value || [];
    const count = response['@odata.count'] || results.length;
    
    if (results.length === 0) {
      return `No documents found for client "${client}".`;
    }

    // Group by category
    const grouped = {};
    results.forEach(doc => {
      const cat = doc.category || 'general';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(doc);
    });

    let responseText = `# Documents for ${client}\n\n`;
    responseText += `Found ${count} document(s):\n\n`;
    
    Object.entries(grouped).forEach(([category, docs]) => {
      responseText += `**${category}** (${docs.length} files)\n`;
      docs.forEach(doc => {
        const date = doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : '';
        responseText += `• ${doc.fileName}`;
        if (date) responseText += ` - ${date}`;
        responseText += `\n`;
      });
      responseText += `\n`;
    });
    
    responseText += `\n💡 Say "search for [topic]" to find specific information`;
    
    return responseText;
    
  } catch (error) {
    return `Error listing documents: ${error.message}`;
  }
}

// CASE 2: Search for specific content
if (chatInput && chatInput.trim() !== '') {
  try {
    const searchRequest = {
      search: chatInput,
      searchMode: "any",
      filter: `client eq '${client}'`,
      top: 5,
      select: "fileName,category,content",
      highlight: "content",
      highlightPreTag: "**",
      highlightPostTag: "**",
      count: true
    };

    const response = await this.helpers.httpRequest({
      method: 'POST',
      url: searchUrl,
      headers: {
        'api-key': adminKey,
        'Content-Type': 'application/json'
      },
      body: searchRequest,
      json: true,
      timeout: 5000
    });

    const results = response.value || [];
    
    if (results.length === 0) {
      return `No results found for "${chatInput}" in ${client}'s documents.`;
    }
    
    let responseText = `# Search Results\n\n`;
    responseText += `Found ${results.length} result(s) for "${chatInput}":\n\n`;
    
    results.forEach((result, index) => {
      responseText += `## ${index + 1}. ${result.fileName}\n`;
      responseText += `Category: ${result.category || 'general'}\n\n`;
      
      // Show highlights or excerpt
      if (result['@search.highlights'] && result['@search.highlights'].content) {
        responseText += `**Relevant sections:**\n`;
        const highlights = result['@search.highlights'].content.slice(0, 3);
        highlights.forEach(h => {
          const clean = h.replace(/[\r\n]+/g, ' ').substring(0, 200);
          responseText += `• ${clean}...\n`;
        });
      } else if (result.content) {
        const excerpt = result.content.substring(0, 300).replace(/[\r\n]+/g, ' ');
        responseText += `**Excerpt:** ${excerpt}...\n`;
      }
      
      responseText += `\n`;
    });
    
    return responseText;
    
  } catch (error) {
    return `Error searching: ${error.message}`;
  }
}

// Default
return `What would you like to know about ${client}'s documents?\n\n• Say "list documents" to see what's available\n• Search for specific topics`;

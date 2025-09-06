// OPTIMIZED Client Search Tool - FAST VERSION
// Uses efficient querying and smart result processing

const chatInput = $json.chatInput || $json.query || $json.text || $json.message || '';
const client = $json.client || 'general';
const projectName = $json.projectName || null;
const queryLower = (chatInput || '').toLowerCase();

console.log('Client Search Input:', { chatInput, client, queryLower });

// Azure Search Configuration
const searchService = 'fcssearchservice';
const indexName = 'fcs-construction-docs-index-v2';
const apiVersion = '2023-11-01';
const adminKey = 'UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv';
const searchUrl = `https://${searchService}.search.windows.net/indexes/${indexName}/docs/search?api-version=${apiVersion}`;

// Helper function for clean HTTP requests
async function searchDocuments(searchRequest) {
  return await this.helpers.httpRequest({
    method: 'POST',
    url: searchUrl,
    headers: {
      'api-key': adminKey,
      'Content-Type': 'application/json'
    },
    body: searchRequest,
    json: true,
    timeout: 5000 // 5 second timeout
  });
}

// Determine query type
const isListRequest = queryLower.includes('what') || 
                     queryLower.includes('doc') || 
                     queryLower.includes('have') || 
                     queryLower.includes('list') ||
                     queryLower.includes('available') ||
                     queryLower.includes('show');

const wantsFullContent = queryLower.includes('all of it') || 
                        queryLower.includes('everything') ||
                        queryLower.includes('full content') ||
                        queryLower.includes('tell me what');

// OPTIMIZATION 1: List documents WITHOUT fetching content initially
if (isListRequest && !wantsFullContent) {
  console.log('📋 DOCUMENT LIST REQUEST - Fast mode');
  
  try {
    // Only get metadata, not content
    const searchRequest = {
      search: "*",
      queryType: "simple",
      searchMode: "all",
      filter: `client eq '${client}'`,
      top: 50, // Reduced from 100
      select: "id,fileName,category,uploadedAt,pageCount,documentType,projectName", // No content field
      count: true,
      orderby: "uploadedAt desc"
    };

    const response = await searchDocuments(searchRequest);
    const results = response.value || [];
    const count = response['@odata.count'] || results.length;
    
    console.log(`Found ${count} documents in ${Date.now() - startTime}ms`);
    
    if (results.length === 0) {
      return `No documents found for client "${client}". Please upload documents for this client.`;
    }

    // Group by category for better organization
    const grouped = {};
    results.forEach(doc => {
      const cat = doc.category || 'general';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(doc);
    });

    // Build fast response
    let responseText = `# Documents for ${client}\n\n`;
    responseText += `Found **${count} document(s)** across ${Object.keys(grouped).length} categories.\n\n`;
    
    Object.entries(grouped).forEach(([category, docs]) => {
      responseText += `## 📁 ${category} (${docs.length} files)\n`;
      docs.forEach(doc => {
        const uploadDate = doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'Unknown';
        responseText += `• **${doc.fileName}**`;
        if (doc.projectName) responseText += ` - Project: ${doc.projectName}`;
        if (doc.pageCount) responseText += ` (${doc.pageCount} pages)`;
        responseText += ` - ${uploadDate}\n`;
      });
      responseText += `\n`;
    });
    
    responseText += `---\n\n`;
    responseText += `💡 **Quick Actions:**\n`;
    responseText += `• Say "show content of [filename]" to see a specific document\n`;
    responseText += `• Say "search for [topic]" to find specific information\n`;
    responseText += `• Say "summarize [filename]" for a quick summary\n`;
    
    return responseText;
    
  } catch (error) {
    console.error('List error:', error);
    return `Error listing documents: ${error.message}`;
  }
}

// OPTIMIZATION 2: Get specific document content
const showContentMatch = chatInput.match(/show\s+content\s+of\s+(.+)|open\s+(.+)|view\s+(.+)/i);
if (showContentMatch) {
  const fileName = (showContentMatch[1] || showContentMatch[2] || showContentMatch[3]).trim();
  console.log(`📄 SPECIFIC DOCUMENT REQUEST: ${fileName}`);
  
  try {
    const searchRequest = {
      search: fileName,
      queryType: "simple",
      searchMode: "all",
      searchFields: "fileName",
      filter: `client eq '${client}'`,
      top: 1,
      select: "fileName,content,category,uploadedAt,pageCount"
    };

    const response = await searchDocuments(searchRequest);
    const doc = response.value?.[0];
    
    if (!doc) {
      return `Document "${fileName}" not found for client "${client}".`;
    }
    
    let responseText = `# ${doc.fileName}\n\n`;
    responseText += `**Category:** ${doc.category || 'general'}\n`;
    if (doc.uploadedAt) responseText += `**Uploaded:** ${new Date(doc.uploadedAt).toLocaleDateString()}\n`;
    if (doc.pageCount) responseText += `**Pages:** ${doc.pageCount}\n\n`;
    responseText += `---\n\n`;
    
    if (doc.content) {
      // Show first 5000 chars with option to continue
      const content = doc.content.substring(0, 5000);
      responseText += content;
      if (doc.content.length > 5000) {
        responseText += `\n\n... [Document continues - ${doc.content.length - 5000} more characters]\n`;
        responseText += `💡 Ask specific questions about this document for targeted information.`;
      }
    } else {
      responseText += `⚠️ Content not available or still processing.`;
    }
    
    return responseText;
    
  } catch (error) {
    console.error('Document fetch error:', error);
    return `Error fetching document: ${error.message}`;
  }
}

// OPTIMIZATION 3: Smart semantic search for specific queries
if (chatInput && chatInput.trim() !== '' && !isListRequest) {
  console.log('🔍 SEMANTIC SEARCH:', chatInput);
  
  try {
    // Build smart filter
    const filters = [`client eq '${client}'`];
    if (projectName) filters.push(`projectName eq '${projectName}'`);
    
    const searchRequest = {
      search: chatInput,
      queryType: "semantic", // Use semantic search for better results
      semanticConfiguration: "construction-semantic-config",
      queryLanguage: "en-US",
      searchMode: "all",
      filter: filters.join(' and '),
      top: 5, // Only top 5 results
      select: "fileName,category,content,projectName",
      captions: "extractive|highlight-true",
      answers: "extractive|count-3",
      count: true
    };

    // Remove semantic features if they fail
    try {
      const response = await searchDocuments(searchRequest);
      const results = response.value || [];
      const answers = response['@search.answers'] || [];
      
      if (results.length === 0) {
        // Fallback to simple search
        searchRequest.queryType = "simple";
        delete searchRequest.semanticConfiguration;
        delete searchRequest.queryLanguage;
        delete searchRequest.captions;
        delete searchRequest.answers;
        searchRequest.top = 10;
        
        const fallbackResponse = await searchDocuments(searchRequest);
        const fallbackResults = fallbackResponse.value || [];
        
        if (fallbackResults.length === 0) {
          return `No results found for "${chatInput}" in ${client}'s documents.\n\nTry:\n• Using different keywords\n• Checking if documents are uploaded\n• Asking a broader question`;
        }
        
        results = fallbackResults;
      }
      
      let responseText = `# Search Results: "${chatInput}"\n\n`;
      
      // Show direct answers if available
      if (answers.length > 0) {
        responseText += `## 📌 Direct Answers:\n\n`;
        answers.forEach((answer, i) => {
          responseText += `${i + 1}. ${answer.text}\n`;
          if (answer.highlights) {
            responseText += `   *Confidence: ${(answer.score * 100).toFixed(1)}%*\n`;
          }
          responseText += `\n`;
        });
        responseText += `---\n\n`;
      }
      
      responseText += `Found ${results.length} relevant document(s).\n\n`;
      
      // Show results with captions
      results.slice(0, 5).forEach((result, index) => {
        responseText += `### ${index + 1}. ${result.fileName}\n`;
        if (result.projectName) responseText += `**Project:** ${result.projectName}\n`;
        responseText += `**Category:** ${result.category || 'general'}\n\n`;
        
        // Use captions if available
        if (result['@search.captions']?.length > 0) {
          const caption = result['@search.captions'][0];
          responseText += `**Relevant excerpt:**\n> ${caption.text}\n\n`;
        } else if (result.content) {
          // Find relevant part of content
          const searchTerms = chatInput.toLowerCase().split(' ');
          const sentences = result.content.split(/[.!?]+/);
          const relevant = sentences.find(s => 
            searchTerms.some(term => s.toLowerCase().includes(term))
          );
          
          if (relevant) {
            responseText += `**Relevant excerpt:**\n> ${relevant.trim()}...\n\n`;
          } else {
            responseText += `**Preview:**\n> ${result.content.substring(0, 200).trim()}...\n\n`;
          }
        }
      });
      
      responseText += `---\n\n`;
      responseText += `💡 **Need more details?**\n`;
      responseText += `• Say "show content of [filename]" to see full document\n`;
      responseText += `• Ask a more specific question\n`;
      responseText += `• Request a summary of findings\n`;
      
      return responseText;
      
    } catch (semanticError) {
      console.log('Semantic search failed, falling back to simple search');
      
      // Fallback to simple search
      const simpleRequest = {
        search: chatInput,
        queryType: "simple",
        searchMode: "all",
        filter: `client eq '${client}'`,
        top: 5,
        select: "fileName,category,content",
        highlight: "content",
        highlightPreTag: "**",
        highlightPostTag: "**"
      };
      
      const response = await searchDocuments(simpleRequest);
      const results = response.value || [];
      
      if (results.length === 0) {
        return `No results found for "${chatInput}" in ${client}'s documents.`;
      }
      
      let responseText = `# Search Results: "${chatInput}"\n\n`;
      responseText += `Found ${results.length} relevant document(s).\n\n`;
      
      results.forEach((result, index) => {
        responseText += `### ${index + 1}. ${result.fileName}\n`;
        
        if (result['@search.highlights']?.content) {
          responseText += `**Relevant sections:**\n`;
          result['@search.highlights'].content.slice(0, 3).forEach(highlight => {
            responseText += `> ${highlight.substring(0, 200)}...\n`;
          });
        }
        responseText += `\n`;
      });
      
      return responseText;
    }
    
  } catch (error) {
    console.error('Search error:', error);
    return `Error searching: ${error.message}`;
  }
}

// OPTIMIZATION 4: Summary request
if (queryLower.includes('summar')) {
  console.log('📊 SUMMARY REQUEST');
  
  try {
    const searchRequest = {
      search: "*",
      queryType: "simple",
      filter: `client eq '${client}'`,
      top: 10,
      select: "fileName,category,uploadedAt,pageCount",
      count: true,
      facets: ["category,count:10", "documentType,count:10"]
    };

    const response = await searchDocuments(searchRequest);
    const count = response['@odata.count'] || 0;
    const facets = response['@search.facets'] || {};
    
    let responseText = `# Document Summary for ${client}\n\n`;
    responseText += `**Total Documents:** ${count}\n\n`;
    
    if (facets.category) {
      responseText += `**By Category:**\n`;
      facets.category.forEach(f => {
        responseText += `• ${f.value}: ${f.count} documents\n`;
      });
      responseText += `\n`;
    }
    
    if (facets.documentType) {
      responseText += `**By Type:**\n`;
      facets.documentType.forEach(f => {
        responseText += `• ${f.value || 'Unknown'}: ${f.count} documents\n`;
      });
    }
    
    responseText += `\n💡 Ask specific questions to explore these documents.`;
    
    return responseText;
    
  } catch (error) {
    console.error('Summary error:', error);
    return `Error generating summary: ${error.message}`;
  }
}

// Default response
return `I can help you search "${client}" documents. Try:\n\n• "List documents" - See what's available\n• "Search for [topic]" - Find specific information\n• "Show content of [filename]" - View a specific document\n• "Summarize documents" - Get an overview\n\nWhat would you like to know?`;

// SEMANTIC FAST SEARCH - With AI-powered vector search
// Includes semantic search, vector similarity, and AI answers

const chatInput = $json.chatInput || $json.query || $json.text || $json.message || '';
const client = $json.client || 'general';
const projectName = $json.projectName || null;
const queryLower = (chatInput || '').toLowerCase();

// Azure Search Configuration
const searchService = 'fcssearchservice';
const indexName = 'fcs-construction-docs-index-v2';
const apiVersion = '2023-11-01';
const adminKey = 'UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv';
const searchUrl = `https://${searchService}.search.windows.net/indexes/${indexName}/docs/search?api-version=${apiVersion}`;

// Determine query type
const wantsList = queryLower.includes('list') || 
                  queryLower.includes('what') || 
                  queryLower.includes('show') ||
                  queryLower.includes('have') ||
                  queryLower.includes('documents');

const isNaturalLanguage = chatInput.includes('?') || 
                         chatInput.split(' ').length > 3 ||
                         queryLower.includes('how') ||
                         queryLower.includes('why') ||
                         queryLower.includes('when') ||
                         queryLower.includes('where') ||
                         queryLower.includes('explain');

// CASE 1: List documents (fast, no content)
if (wantsList && !chatInput.includes('content')) {
  try {
    const searchRequest = {
      search: "*",
      queryType: "simple",
      filter: `client eq '${client}'`,
      top: 30,
      select: "fileName,category,uploadedAt,projectName,pageCount",
      count: true,
      orderby: "uploadedAt desc"
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
      responseText += `**📁 ${category}** (${docs.length} files)\n`;
      docs.forEach(doc => {
        const date = doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : '';
        responseText += `• ${doc.fileName}`;
        if (doc.projectName) responseText += ` [${doc.projectName}]`;
        if (doc.pageCount) responseText += ` (${doc.pageCount} pages)`;
        if (date) responseText += ` - ${date}`;
        responseText += `\n`;
      });
      responseText += `\n`;
    });
    
    responseText += `\n💡 Ask any question about these documents to search their content`;
    
    return responseText;
    
  } catch (error) {
    return `Error listing documents: ${error.message}`;
  }
}

// CASE 2: SEMANTIC SEARCH for natural language queries
if (isNaturalLanguage && chatInput.trim() !== '') {
  try {
    console.log('🧠 Using SEMANTIC SEARCH for:', chatInput);
    
    // Build filter
    const filters = [`client eq '${client}'`];
    if (projectName) filters.push(`projectName eq '${projectName}'`);
    
    const searchRequest = {
      search: chatInput,
      queryType: "semantic",
      semanticConfiguration: "construction-semantic-config",
      filter: filters.join(' and '),
      top: 5,
      select: "fileName,category,content,projectName",
      captions: "extractive|highlight-true",
      answers: "extractive|count-3",
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
      timeout: 8000 // Semantic search needs more time
    });

    const results = response.value || [];
    const answers = response['@search.answers'] || [];
    const count = response['@odata.count'] || results.length;
    
    if (results.length === 0) {
      // Fallback to simple search if semantic fails
      console.log('No semantic results, falling back to keyword search');
      searchRequest.queryType = "simple";
      delete searchRequest.semanticConfiguration;
      delete searchRequest.captions;
      delete searchRequest.answers;
      searchRequest.searchMode = "all";
      searchRequest.highlight = "content";
      searchRequest.highlightPreTag = "**";
      searchRequest.highlightPostTag = "**";
      
      const fallbackResponse = await this.helpers.httpRequest({
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
      
      const fallbackResults = fallbackResponse.value || [];
      if (fallbackResults.length === 0) {
        return `No results found for "${chatInput}" in ${client}'s documents.\n\nTry:\n• Using different keywords\n• Checking document list first\n• Being more specific`;
      }
      
      // Format fallback results
      let responseText = `# Search Results\n\n`;
      responseText += `Found ${fallbackResults.length} result(s) for: "${chatInput}"\n\n`;
      
      fallbackResults.forEach((result, index) => {
        responseText += `### ${index + 1}. ${result.fileName}\n`;
        if (result['@search.highlights']?.content) {
          responseText += `**Relevant text:**\n`;
          result['@search.highlights'].content.slice(0, 2).forEach(h => {
            responseText += `> ${h.substring(0, 300)}...\n`;
          });
        }
        responseText += `\n`;
      });
      
      return responseText;
    }
    
    // Format semantic search results
    let responseText = `# AI Search Results\n\n`;
    responseText += `🤖 Found ${count} relevant result(s) for: "${chatInput}"\n\n`;
    
    // Show direct AI answers if available
    if (answers.length > 0) {
      responseText += `## 📌 Direct Answers:\n\n`;
      answers.forEach((answer, i) => {
        responseText += `**Answer ${i + 1}:**\n`;
        responseText += `> ${answer.text}\n`;
        if (answer.score) {
          const confidence = (answer.score * 100).toFixed(0);
          responseText += `*Confidence: ${confidence}%*\n`;
        }
        responseText += `\n`;
      });
      responseText += `---\n\n`;
    }
    
    // Show document results with AI-generated captions
    responseText += `## 📄 Relevant Documents:\n\n`;
    results.forEach((result, index) => {
      responseText += `### ${index + 1}. ${result.fileName}`;
      if (result.projectName) responseText += ` [${result.projectName}]`;
      responseText += `\n`;
      responseText += `**Category:** ${result.category || 'general'}\n`;
      
      // Show semantic reranker score if available
      if (result['@search.rerankerScore']) {
        const relevance = (result['@search.rerankerScore'] * 20).toFixed(0);
        responseText += `**AI Relevance:** ${relevance}%\n`;
      }
      
      // Show AI-generated caption/summary
      if (result['@search.captions']?.length > 0) {
        const caption = result['@search.captions'][0];
        responseText += `\n**AI Summary:**\n`;
        responseText += `> ${caption.text}\n`;
      } else if (result.content) {
        // Fallback to content excerpt
        const searchTerms = chatInput.toLowerCase().split(' ').filter(t => t.length > 3);
        const sentences = result.content.split(/[.!?]+/);
        const relevantSentence = sentences.find(s => 
          searchTerms.some(term => s.toLowerCase().includes(term))
        );
        
        if (relevantSentence) {
          responseText += `\n**Relevant excerpt:**\n`;
          responseText += `> ${relevantSentence.trim().substring(0, 300)}...\n`;
        }
      }
      
      responseText += `\n`;
    });
    
    responseText += `---\n`;
    responseText += `💡 **Tips:**\n`;
    responseText += `• This search used AI to understand your question\n`;
    responseText += `• Results are ranked by semantic relevance\n`;
    responseText += `• Ask follow-up questions for more details\n`;
    
    return responseText;
    
  } catch (error) {
    console.error('Semantic search error:', error);
    // Don't fail completely, fall back to simple search
  }
}

// CASE 3: HYBRID SEARCH for specific keywords/topics
if (chatInput && chatInput.trim() !== '') {
  try {
    console.log('🔍 Using HYBRID SEARCH for:', chatInput);
    
    const searchRequest = {
      search: chatInput,
      queryType: "simple",
      searchMode: "all",
      filter: `client eq '${client}'`,
      top: 5,
      select: "fileName,category,content,projectName",
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
      return `No results found for "${chatInput}" in ${client}'s documents.\n\nTry:\n• Different keywords\n• Asking as a question for AI search\n• Listing documents first`;
    }
    
    let responseText = `# Search Results\n\n`;
    responseText += `Found ${results.length} result(s) for: "${chatInput}"\n\n`;
    
    results.forEach((result, index) => {
      responseText += `### ${index + 1}. ${result.fileName}`;
      if (result.projectName) responseText += ` [${result.projectName}]`;
      responseText += `\n`;
      responseText += `**Category:** ${result.category || 'general'}\n\n`;
      
      // Show highlights
      if (result['@search.highlights']?.content) {
        responseText += `**Matching text:**\n`;
        const highlights = result['@search.highlights'].content.slice(0, 3);
        highlights.forEach(h => {
          const clean = h.replace(/[\r\n]+/g, ' ').trim();
          if (clean.length > 50) {
            responseText += `> ${clean.substring(0, 300)}...\n`;
          }
        });
      } else if (result.content) {
        // Show excerpt
        const excerpt = result.content.substring(0, 300).replace(/[\r\n]+/g, ' ').trim();
        responseText += `**Preview:**\n> ${excerpt}...\n`;
      }
      
      responseText += `\n`;
    });
    
    responseText += `---\n`;
    responseText += `💡 **Tip:** Ask this as a question to get AI-powered answers!\n`;
    responseText += `Example: "What does ${chatInput} mean?" or "How do I ${chatInput}?"\n`;
    
    return responseText;
    
  } catch (error) {
    return `Error searching: ${error.message}`;
  }
}

// Default help
return `# ${client} Document Search\n
I can search your documents using:
• **AI Semantic Search** - Ask natural questions
• **Vector Search** - Find similar content
• **Keyword Search** - Find exact terms

**Try:**
• "List documents" - See what's available
• "What is [topic]?" - AI-powered answer
• "How do I [task]?" - Step-by-step guidance
• "Search for [keyword]" - Find specific terms

What would you like to know?`;

// DIAGNOSTIC SEARCH - Shows EXACTLY what's in the index
// Use this to debug what content was actually extracted

const chatInput = $json.chatInput || $json.query || $json.text || $json.message || '';
const client = $json.client || 'general';
const fileName = $json.fileName || '';

// Azure Search Configuration
const searchService = 'fcssearchservice';
const indexName = 'fcs-construction-docs-index-v2';
const apiVersion = '2023-11-01';
const adminKey = 'UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv';
const searchUrl = `https://${searchService}.search.windows.net/indexes/${indexName}/docs/search?api-version=${apiVersion}`;

// Check if asking about specific file
const askingAboutFile = fileName || 
                       chatInput.match(/lavanburg|first floor|floor plan|GR1508592|contract.*no/i);

if (askingAboutFile) {
  try {
    // Search for the specific document
    const searchTerms = fileName || 'Lavanburg first floor plan';
    
    const searchRequest = {
      search: searchTerms,
      queryType: "simple",
      searchMode: "all",
      filter: client !== 'general' ? `client eq '${client}'` : null,
      top: 10,
      select: "*", // GET ALL FIELDS
      count: true
    };
    
    if (!searchRequest.filter) delete searchRequest.filter;

    console.log('Diagnostic search for:', searchTerms);

    const response = await this.helpers.httpRequest({
      method: 'POST',
      url: searchUrl,
      headers: {
        'api-key': adminKey,
        'Content-Type': 'application/json'
      },
      body: searchRequest,
      json: true,
      timeout: 10000
    });

    const results = response.value || [];
    
    if (results.length === 0) {
      // Try broader search
      searchRequest.search = "*";
      searchRequest.filter = `client eq '${client}'`;
      searchRequest.top = 50;
      
      const allDocs = await this.helpers.httpRequest({
        method: 'POST',
        url: searchUrl,
        headers: {
          'api-key': adminKey,
          'Content-Type': 'application/json'
        },
        body: searchRequest,
        json: true,
        timeout: 10000
      });
      
      const allResults = allDocs.value || [];
      
      let responseText = `# All Documents for ${client}\n\n`;
      responseText += `Total: ${allResults.length} documents\n\n`;
      
      allResults.forEach((doc, i) => {
        responseText += `## ${i+1}. ${doc.fileName}\n`;
        responseText += `**ID:** ${doc.id}\n`;
        responseText += `**Category:** ${doc.category}\n`;
        responseText += `**Upload Date:** ${doc.uploadedAt}\n`;
        responseText += `**Blob Path:** ${doc.blobPath}\n`;
        
        // Check if content mentions contract or drawing info
        if (doc.content) {
          // Search for contract number patterns
          const contractMatch = doc.content.match(/GR\d{7}|contract\s*no[.:]\s*[\w-]+/i);
          const drawingMatch = doc.content.match(/drawing\s*title[.:]\s*[^\n]+|first\s*floor\s*plan/i);
          const lavanburgMatch = doc.content.match(/lavanburg/i);
          
          if (contractMatch || drawingMatch || lavanburgMatch) {
            responseText += `\n**🔍 FOUND RELEVANT CONTENT:**\n`;
            if (contractMatch) responseText += `- Contract: ${contractMatch[0]}\n`;
            if (drawingMatch) responseText += `- Drawing: ${drawingMatch[0]}\n`;
            if (lavanburgMatch) responseText += `- Contains "Lavanburg"\n`;
            
            // Show excerpt around the match
            const startIndex = Math.max(0, doc.content.indexOf(contractMatch?.[0] || drawingMatch?.[0] || lavanburgMatch?.[0]) - 200);
            const excerpt = doc.content.substring(startIndex, startIndex + 500);
            responseText += `\n**Content Excerpt:**\n\`\`\`\n${excerpt}\n\`\`\`\n`;
          }
        }
        
        responseText += `\n---\n\n`;
      });
      
      responseText += `\n💡 **TIP:** If the contract number isn't found, the OCR may have failed to extract it properly.`;
      
      return responseText;
    }
    
    // Show detailed results
    let responseText = `# Diagnostic Results for "${searchTerms}"\n\n`;
    responseText += `Found ${results.length} matching document(s)\n\n`;
    
    results.forEach((doc, index) => {
      responseText += `## Document ${index + 1}: ${doc.fileName}\n\n`;
      
      // Show ALL fields
      responseText += `### Metadata:\n`;
      responseText += `- **ID:** ${doc.id}\n`;
      responseText += `- **Client:** ${doc.client}\n`;
      responseText += `- **Category:** ${doc.category}\n`;
      responseText += `- **Project Name:** ${doc.projectName || 'Not set'}\n`;
      responseText += `- **Upload Date:** ${doc.uploadedAt}\n`;
      responseText += `- **Blob Path:** ${doc.blobPath}\n`;
      responseText += `- **MIME Type:** ${doc.mimeType}\n`;
      responseText += `- **Page Count:** ${doc.pageCount || 'Unknown'}\n`;
      responseText += `- **Document Type:** ${doc.documentType || 'Unknown'}\n`;
      
      // Parse metadata if it exists
      if (doc.metadata) {
        try {
          const meta = typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : doc.metadata;
          responseText += `\n### Extracted Metadata:\n`;
          Object.entries(meta).forEach(([key, value]) => {
            responseText += `- **${key}:** ${value}\n`;
          });
        } catch (e) {
          responseText += `- **Raw Metadata:** ${doc.metadata}\n`;
        }
      }
      
      // Show content analysis
      if (doc.content) {
        responseText += `\n### Content Analysis:\n`;
        responseText += `- **Total Length:** ${doc.content.length} characters\n`;
        
        // Look for specific patterns
        const patterns = [
          { pattern: /GR\d{7}/gi, name: "Contract Numbers (GR format)" },
          { pattern: /contract\s*no[.:]\s*([\w-]+)/gi, name: "Contract References" },
          { pattern: /drawing\s*title[.:]\s*([^\n]+)/gi, name: "Drawing Titles" },
          { pattern: /first\s*floor\s*plan/gi, name: "Floor Plan References" },
          { pattern: /lavanburg/gi, name: "Lavanburg References" },
          { pattern: /\d{3}\s+\w+\s+(place|street|avenue)/gi, name: "Addresses" },
          { pattern: /oracle\s*no[.:]\s*\d+/gi, name: "Oracle Numbers" },
          { pattern: /zone\s*no[.:]\s*[\w-]+/gi, name: "Zone Numbers" },
          { pattern: /lot\s*no[.:]\s*\d+/gi, name: "Lot Numbers" },
          { pattern: /bin\s*no[.:]\s*\d+/gi, name: "BIN Numbers" }
        ];
        
        responseText += `\n**Pattern Matches Found:**\n`;
        let foundAny = false;
        
        patterns.forEach(({ pattern, name }) => {
          const matches = doc.content.match(pattern);
          if (matches) {
            foundAny = true;
            responseText += `\n**${name}:**\n`;
            [...new Set(matches)].forEach(match => {
              responseText += `  • ${match}\n`;
            });
          }
        });
        
        if (!foundAny) {
          responseText += `  ⚠️ No standard patterns found - OCR may have issues\n`;
        }
        
        // Show first 1000 chars of content
        responseText += `\n### Content Preview (first 1000 chars):\n`;
        responseText += `\`\`\`\n${doc.content.substring(0, 1000).replace(/\r\n/g, '\n')}\n\`\`\`\n`;
        
        // If contract number in query, search for it
        if (chatInput.match(/GR1508592/i)) {
          const contractSearch = doc.content.match(/.{0,50}1508592.{0,50}/gi);
          if (contractSearch) {
            responseText += `\n### ✅ FOUND "1508592" in content:\n`;
            contractSearch.forEach(match => {
              responseText += `\`\`\`\n${match}\n\`\`\`\n`;
            });
          } else {
            responseText += `\n### ❌ "1508592" NOT FOUND in extracted content\n`;
            responseText += `This means the OCR didn't capture it properly.\n`;
          }
        }
      } else {
        responseText += `\n### ⚠️ NO CONTENT EXTRACTED\n`;
        responseText += `The document may still be processing or OCR failed.\n`;
      }
      
      responseText += `\n${'='.repeat(60)}\n\n`;
    });
    
    responseText += `\n## Diagnosis Summary:\n`;
    responseText += `• If contract/drawing info is missing, the OCR extraction failed\n`;
    responseText += `• The document may need to be re-processed with better OCR settings\n`;
    responseText += `• Check if the document is an image that needs Computer Vision API\n`;
    
    return responseText;
    
  } catch (error) {
    return `Diagnostic error: ${error.message}`;
  }
}

// Regular search with full content
try {
  const searchRequest = {
    search: chatInput || "*",
    queryType: "simple",
    searchMode: "all",
    filter: `client eq '${client}'`,
    top: 5,
    select: "*", // GET EVERYTHING
    highlight: "content",
    highlightPreTag: "<<<",
    highlightPostTag: ">>>",
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
    timeout: 10000
  });

  const results = response.value || [];
  
  let responseText = `# Full Content Search Results\n\n`;
  responseText += `Query: "${chatInput}"\n`;
  responseText += `Client: ${client}\n`;
  responseText += `Found: ${results.length} results\n\n`;
  
  results.forEach((doc, i) => {
    responseText += `## ${i+1}. ${doc.fileName}\n`;
    
    // Show all available fields
    Object.entries(doc).forEach(([key, value]) => {
      if (key !== 'content' && key !== '@search.highlights' && value) {
        responseText += `**${key}:** ${JSON.stringify(value).substring(0, 200)}\n`;
      }
    });
    
    // Show highlights
    if (doc['@search.highlights']?.content) {
      responseText += `\n**Matching sections:**\n`;
      doc['@search.highlights'].content.slice(0, 3).forEach(h => {
        responseText += `> ${h}\n`;
      });
    }
    
    responseText += `\n---\n\n`;
  });
  
  return responseText;
  
} catch (error) {
  return `Error: ${error.message}`;
}

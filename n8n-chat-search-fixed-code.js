// COMPREHENSIVE Client Search Tool - FIXED CLIENT VARIABLE SCOPE
// Handles all types of queries: drawings, PDFs, documents, searches, etc.
// Ensures ALL responses use inline PDF viewer format

const chatInput = $json.chatInput || $json.query || $json.text || '';
const client = $json.client || 'Amsterdam';
const queryLower = (chatInput || '').toLowerCase();

console.log('Client Search Input:', { chatInput, client, queryLower });

// Helper function to create inline PDF URLs
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

// UNIVERSAL PDF/DOCUMENT HANDLER - handles ALL queries with PDF viewer support
const searchService = 'fcssearchservice';
const indexName = 'fcs-construction-docs-index-v2';
const apiVersion = '2023-11-01';
const adminKey = 'UsSBLISH5UsbNGeUkBeCa1YZJ0SJPfRJwXBrAWY7kSAzSeABQBCv';

// Check if this is a request for document listings (links, PDFs, drawings, etc.)
const isListRequest = queryLower.includes('link') || 
                     queryLower.includes('drawing') || 
                     queryLower.includes('pdf') ||
                     queryLower.includes('doc') ||  // Added "doc" for document queries
                     queryLower.includes('what') ||  // Added for "what docs" queries
                     (queryLower.includes('give') && queryLower.includes('me')) ||
                     (queryLower.includes('show') && queryLower.includes('me')) ||
                     queryLower.includes('have') || 
                     queryLower.includes('available') || 
                     queryLower.includes('list');

if (isListRequest) {
  console.log('🔍 DETECTED DOCUMENT LIST REQUEST - using PDF viewer format');
  
  try {
    let searchQuery = "*";
    let categoryFilter = "";
    
    // Determine category based on query
    if (queryLower.includes('drawing')) {
      categoryFilter = " and category eq 'drawings'";
    } else if (queryLower.includes('proposal')) {
      categoryFilter = " and category eq 'proposals'";
    } else if (queryLower.includes('spec')) {
      categoryFilter = " and category eq 'specs'";
    } else if (queryLower.includes('estimate')) {
      categoryFilter = " and category eq 'estimates'";
    }
    
    const searchRequest = {
      search: searchQuery,
      queryType: "simple",
      filter: `client eq '${client}'${categoryFilter}`,
      top: 50,
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

    console.log('Search Response Count:', response['@odata.count']);
    const results = response.value || [];
    
    if (results.length === 0) {
      return `No documents found for client "${client}". Please make sure documents have been uploaded and indexed for this client.`;
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

    let responseText = `## Available Documents for Client: ${client}\n\n`;
    responseText += `Found ${results.length} document(s) in your system.\n\n`;
    
    Object.keys(docsByCategory).forEach(category => {
      if (docsByCategory[category].length > 0) {
        responseText += `### ${category.charAt(0).toUpperCase() + category.slice(1)}:\n`;
        
        docsByCategory[category].forEach((doc, index) => {
          const fileName = doc.fileName || 'Unknown file';
          
          // Display all files, not just PDFs
          responseText += `${index + 1}. **${fileName}**\n`;
          
          if (fileName.toLowerCase().endsWith('.pdf')) {
            const pdfUrl = createInlinePDFUrl(client, category, fileName);
            const shortFileName = fileName.length > 60 ? fileName.substring(0, 57) + '...' : fileName;
            responseText += `   [VIEWER:${pdfUrl}|${shortFileName}|${category}-${index+1}|${category}|${category}]\n`;
          }
        });
        responseText += `\n`;
      }
    });

    responseText += `---\n\nIf you want me to extract detailed information or specific data from any of these documents, please specify the document name or topic.`;
    
    return responseText;
    
  } catch (error) {
    console.error('Document list search error:', error);
    return `Error retrieving document list: ${error.message}`;
  }
}

// REGULAR DOCUMENT SEARCH with PDF viewer support for search results
if (!chatInput || chatInput.trim() === '') {
  return 'I need a search query to search through your construction documents. Please provide what you\'d like to search for.';
}

try {
  let processedQuery = chatInput;
  let searchStrategy = 'standard';
  
  const queryLowerSearch = chatInput.toLowerCase();
  
  if (queryLowerSearch.includes('paint') || queryLowerSearch.includes('coating') || 
      queryLowerSearch.includes('pt-1') || queryLowerSearch.includes('pt-2') || 
      queryLowerSearch.includes('accent') || queryLowerSearch.includes('color')) {
    searchStrategy = 'paint';
    processedQuery = enhancePaintQuery(chatInput);
  }
  else if (queryLowerSearch.includes('floor') || queryLowerSearch.includes('sealer') || 
           queryLowerSearch.includes('resinous') || queryLowerSearch.includes('flooring')) {
    searchStrategy = 'floor';
    processedQuery = enhanceFloorQuery(chatInput);
  }
  else if (queryLowerSearch.includes('quantity') || queryLowerSearch.includes('qty') || 
           queryLowerSearch.includes('gallon') || queryLowerSearch.includes('square') || 
           queryLowerSearch.includes('linear')) {
    searchStrategy = 'quantity';
    processedQuery = enhanceQuantityQuery(chatInput);
  }
  else if (queryLowerSearch.includes('scope') || queryLowerSearch.includes('exclude') || 
           queryLowerSearch.includes('include')) {
    searchStrategy = 'scope';
    processedQuery = enhanceScopeQuery(chatInput);
  }
  else if (queryLowerSearch.includes('room') || queryLowerSearch.includes('wall') || 
           queryLowerSearch.includes('ceiling') || queryLowerSearch.includes('floor')) {
    searchStrategy = 'location';
    processedQuery = enhanceLocationQuery(chatInput);
  }
  else if (queryLowerSearch.includes('spec') || queryLowerSearch.includes('submittal') || 
           queryLowerSearch.includes('manufacturer') || queryLowerSearch.includes('product')) {
    searchStrategy = 'specification';
    processedQuery = enhanceSpecificationQuery(chatInput);
  }
  else if (queryLowerSearch.includes('door') || queryLowerSearch.includes('frame') || 
           queryLowerSearch.includes('hm') || queryLowerSearch.includes('wd')) {
    searchStrategy = 'door';
    processedQuery = enhanceDoorQuery(chatInput);
  }
  
  console.log(`Search strategy: ${searchStrategy}, Enhanced query: ${processedQuery}`);
  
  const searchRequest = {
    search: processedQuery,
    queryType: searchStrategy === 'specification' ? "semantic" : "simple",
    searchMode: "any",
    top: 15,
    select: "client,fileName,category,content,uploadedAt,blobPath",
    highlight: "content",
    highlightPreTag: "**",
    highlightPostTag: "**",
    count: true
  };

  if (client && client !== 'general' && client.trim() !== '') {
    searchRequest.filter = `client eq '${client}'`;
    console.log(`Adding client filter: ${client}`);
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
  const totalResults = response['@odata.count'] || results.length;

  console.log(`Found ${totalResults} results for query: "${chatInput}"`);

  if (results.length === 0) {
    return `I searched through your construction documents for "${chatInput}" but didn't find any matching results. Try using different keywords or check if the documents have been uploaded.`;
  }

  // Pass client to the formatting function
  return formatComprehensiveResults(results, chatInput, totalResults, searchStrategy, client);

} catch (error) {
  console.error('Comprehensive Document Search error:', error);
  return `I encountered an error while searching: ${error.message}. Please try again.`;
}

// Enhanced formatComprehensiveResults with PDF viewer support - NOW WITH CLIENT PARAMETER
function formatComprehensiveResults(results, originalQuery, totalResults, searchStrategy, clientName) {
  let response = `## Comprehensive Analysis for: "${originalQuery}"\n\n`;
  response += `Found ${totalResults} relevant documents. Here's a detailed analysis:\n\n`;
  
  const categorizedResults = categorizeResults(results);
  
  if (searchStrategy === 'paint') {
    response += formatPaintResults(results, categorizedResults);
  } else if (searchStrategy === 'floor') {
    response += formatFloorResults(results, categorizedResults);
  } else if (searchStrategy === 'quantity') {
    response += formatQuantityResults(results, categorizedResults);
  } else if (searchStrategy === 'scope') {
    response += formatScopeResults(results, categorizedResults);
  } else if (searchStrategy === 'specification') {
    response += formatSpecificationResults(results, categorizedResults);
  } else {
    response += formatGeneralResults(results, categorizedResults, originalQuery);
  }
  
  // Add PDF viewers for source documents - NOW USING PASSED clientName
  response += "\n## Source Documents with Previews:\n";
  const uniqueDocs = new Set();
  let docCount = 0;
  results.forEach(result => {
    const fileName = result.fileName || 'Unknown';
    const category = result.category || 'general';
    const docRef = `${fileName} (${category})`;
    
    if (!uniqueDocs.has(docRef) && docCount < 8) { // Limit to 8 documents
      uniqueDocs.add(docRef);
      docCount++;
      
      if (fileName.toLowerCase().endsWith('.pdf')) {
        // Use the result's client field OR the passed clientName
        const docClient = result.client || clientName;
        const pdfUrl = createInlinePDFUrl(docClient, category, fileName);
        const shortFileName = fileName.length > 50 ? fileName.substring(0, 47) + '...' : fileName;
        response += `**${shortFileName}** (${category})\n`;
        response += `[VIEWER:${pdfUrl}|${shortFileName}|Search-${docCount}|${category}|${category}]\n\n`;
      } else {
        response += `- ${docRef}\n`;
      }
    }
  });
  
  return response;
}

// All helper functions remain the same - just include them as they were
function enhancePaintQuery(query) {
  const queryLower = query.toLowerCase();
  if (queryLower.includes('pt-1') || queryLower.includes('pt-2')) {
    return `"PT-1" OR "PT-2" OR "paint type" OR "coating system" OR "paint schedule"`;
  } else if (queryLower.includes('accent')) {
    return `"accent paint" OR "accent wall" OR "accent color" OR "feature wall"`;
  } else if (queryLower.includes('quantity') || queryLower.includes('gallon')) {
    return `"gallons" OR "quantity" OR "coverage" OR "square feet" OR "paint quantity"`;
  }
  return `(${query}) OR "painting scope" OR "paint specification" OR "coating system"`;
}

function enhanceFloorQuery(query) {
  return `(${query}) OR "floor sealer" OR "floor coating" OR "resinous flooring" OR "epoxy floor" OR "floor finish" OR "097050"`;
}

function enhanceQuantityQuery(query) {
  return `(${query}) OR "square feet" OR "linear feet" OR "gallons" OR "coverage" OR "quantity" OR "takeoff" OR "measurement"`;
}

function enhanceScopeQuery(query) {
  return `(${query}) OR "scope of work" OR "included" OR "excluded" OR "exclusions" OR "clarifications" OR "not included"`;
}

function enhanceLocationQuery(query) {
  const queryLower = query.toLowerCase();
  if (queryLower.includes('room')) {
    const roomMatch = query.match(/room\s+(\w+)/i);
    if (roomMatch) {
      return `"room ${roomMatch[1]}" OR "RM ${roomMatch[1]}" OR "${roomMatch[1]}"`;
    }
  }
  return `(${query}) OR "room schedule" OR "finish schedule" OR "floor plan" OR "room finishes"`;
}

function enhanceSpecificationQuery(query) {
  return `(${query}) OR "specification" OR "spec section" OR "submittal" OR "approved" OR "manufacturer" OR "product data"`;
}

function enhanceDoorQuery(query) {
  return `(${query}) OR "door schedule" OR "door frame" OR "hollow metal" OR "HM" OR "wood door" OR "WD" OR "painted door"`;
}

function categorizeResults(results) {
  const categories = {
    proposals: [],
    specifications: [],
    drawings: [],
    submittals: [],
    estimates: [],
    other: []
  };
  
  results.forEach(result => {
    const category = result.category || 'other';
    if (categories[category]) {
      categories[category].push(result);
    } else {
      categories.other.push(result);
    }
  });
  
  return categories;
}

// Include all the other helper functions as they were...
// (I'm truncating here for brevity, but include all the format* and extract* functions unchanged)

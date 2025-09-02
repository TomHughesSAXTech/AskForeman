// Diagnostic n8n Google Search Node Code
// This version helps identify what properties are available in the input

try {
  // First, let's see what's actually in $json
  console.log("Available properties in $json:", Object.keys($json));
  console.log("Full $json object:", JSON.stringify($json, null, 2));
  
  // Try multiple possible property names
  const possibleQueryFields = [
    'query',
    'question', 
    'message',
    'text',
    'input',
    'search',
    'searchQuery',
    'search_query',
    'q',
    'prompt',
    'user_input',
    'userInput',
    'content',
    'body',
    'data'
  ];
  
  let query = '';
  let foundField = '';
  
  // Check each possible field
  for (const field of possibleQueryFields) {
    if ($json[field]) {
      query = $json[field];
      foundField = field;
      console.log(`Found query in field '${field}': ${query}`);
      break;
    }
  }
  
  // If still no query, check if $json itself is a string
  if (!query && typeof $json === 'string') {
    query = $json;
    foundField = 'root (string)';
    console.log(`Found query as root string: ${query}`);
  }
  
  // If still no query, check for nested structures
  if (!query) {
    // Check if there's a nested object with the query
    if ($json.body && typeof $json.body === 'object') {
      for (const field of possibleQueryFields) {
        if ($json.body[field]) {
          query = $json.body[field];
          foundField = `body.${field}`;
          console.log(`Found query in nested field 'body.${field}': ${query}`);
          break;
        }
      }
    }
    
    // Check if there's a data object
    if ($json.data && typeof $json.data === 'object') {
      for (const field of possibleQueryFields) {
        if ($json.data[field]) {
          query = $json.data[field];
          foundField = `data.${field}`;
          console.log(`Found query in nested field 'data.${field}': ${query}`);
          break;
        }
      }
    }
  }
  
  // If we still don't have a query, return diagnostic info
  if (!query || query.trim() === '') {
    return `DIAGNOSTIC INFO:\n\n` +
           `No query found. Here's what I received:\n\n` +
           `Input type: ${typeof $json}\n` +
           `Input properties: ${Object.keys($json).join(', ') || 'none'}\n` +
           `Full input:\n${JSON.stringify($json, null, 2)}\n\n` +
           `Please check your n8n workflow and ensure the search query is being passed correctly.\n` +
           `Common property names: query, question, message, text, input, search`;
  }

  // If we found a query, proceed with the search
  console.log(`Using query from field '${foundField}': ${query}`);
  
  const lowerQuery = query.toLowerCase();
  let enhancedQuery = query;

  // Query enhancement logic
  if (lowerQuery.includes('time') || lowerQuery.includes('current') || lowerQuery.includes('now')) {
    enhancedQuery = 'current time now';
    console.log(`Time query detected, enhanced to: ${enhancedQuery}`);
  } else if (lowerQuery.includes('amazon') || lowerQuery.includes('buy') || lowerQuery.includes('purchase') || lowerQuery.includes('product')) {
    const cleanQuery = query.replace(/amazon/gi, '').trim();
    enhancedQuery = `${cleanQuery} site:amazon.com -inurl:s?k -inurl:search`;
    console.log(`Amazon query detected, enhanced to: ${enhancedQuery}`);
  } else if (lowerQuery.includes('osha') || lowerQuery.match(/1926\.\d+/)) {
    enhancedQuery = `${query} site:osha.gov regulations`;
    console.log(`OSHA query detected, enhanced to: ${enhancedQuery}`);
  } else if (lowerQuery.includes('code') || lowerQuery.includes('section') || lowerQuery.includes('standard')) {
    enhancedQuery = `${query} building construction code standard`;
    console.log(`Code query detected, enhanced to: ${enhancedQuery}`);
  } else {
    console.log(`No enhancement applied, using original query`);
  }

  console.log(`Final enhanced search query: ${enhancedQuery}`);

  const azureFunctionUrl = 'https://saxtech-functionapps.azurewebsites.net/api/search/google';
  const functionKey = 's04tYcQlk7M1vDa-7DX5VU3WLVIFaVAzOKWNeLZIPXdRAzFu0DGnsg==';
  
  const params = new URLSearchParams({
    'code': functionKey,
    'q': enhancedQuery,
    'limit': '5'
  });
  
  const fullUrl = `${azureFunctionUrl}?${params.toString()}`;
  
  console.log(`Calling Azure Function: ${azureFunctionUrl}`);
  
  const response = await this.helpers.httpRequest({
    method: 'GET',
    url: fullUrl,
    headers: {
      'Accept': 'application/json'
    },
    json: true,
    timeout: 10000
  });

  if (response && response.success === false) {
    console.error('Azure Function returned error:', response.error);
    return `Search service error: ${response.error || 'Unknown error'}. Please try again.`;
  }

  if (!response || !response.results || response.results.length === 0) {
    return `No search results found for "${query}". Try using different search terms.`;
  }

  let searchResults = `Based on current web search results for "${query}":\n\n`;

  response.results.forEach((item, index) => {
    let cleanUrl = item.link || item.url || '';
    cleanUrl = cleanUrl.replace(/[)\]}\.,;!?\s]+$/, '');
    cleanUrl = cleanUrl.replace(/&[^&=]*$/, '');
    while (cleanUrl.match(/[)\]}\.,;!?\s]$/)) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    cleanUrl = cleanUrl.trim();

    searchResults += `**${index + 1}. ${item.title}**\n\n`;
    searchResults += `${item.snippet || item.description || ''}\n\n`;
    searchResults += `📎 **Source:** ${cleanUrl}\n\n`;
    searchResults += "---\n\n";
  });

  // Add debug info at the end
  searchResults += `\n[Debug: Query found in field '${foundField}']`;

  return searchResults;

} catch (error) {
  console.error('Search error:', error);
  
  if (error.message && error.message.includes('404')) {
    return `Search service not found. Please check the Azure Function URL configuration. Error: ${error.message}`;
  } else if (error.message && error.message.includes('timeout')) {
    return `Search request timed out. Please try again. Error: ${error.message}`;
  } else {
    return `Search failed: ${error.message || 'Unknown error'}. Please try again in a moment.`;
  }
}

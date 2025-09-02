// FINAL Fixed n8n Google Search Node Code
// This version handles the capitalized field names from Azure Function

try {
  // Get the search query from various possible input fields
  const query = $json.chatInput || $json.query || $json.question || $json.message || '';
  
  if (!query || query.trim() === '') {
    return "No search query provided. Please include a search query.";
  }

  const lowerQuery = query.toLowerCase();
  let enhancedQuery = query;

  // Query enhancement logic
  if (lowerQuery.includes('time') || lowerQuery.includes('current') || lowerQuery.includes('now')) {
    enhancedQuery = 'current time now';
    console.log(`Time query detected, enhanced to: ${enhancedQuery}`);
  } else if (lowerQuery.includes('amazon') || lowerQuery.includes('buy') || lowerQuery.includes('purchase') || lowerQuery.includes('product')) {
    // Remove "amazon" from query to avoid getting search page results
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

  // Azure Function URL and authentication
  const azureFunctionUrl = 'https://saxtech-functionapps.azurewebsites.net/api/search/google';
  const functionKey = 's04tYcQlk7M1vDa-7DX5VU3WLVIFaVAzOKWNeLZIPXdRAzFu0DGnsg==';
  
  // Build URL with query parameters manually (URLSearchParams not available in n8n)
  const params = [
    `code=${encodeURIComponent(functionKey)}`,
    `q=${encodeURIComponent(enhancedQuery)}`,
    `limit=5`
  ].join('&');
  
  const fullUrl = `${azureFunctionUrl}?${params}`;
  
  console.log(`Calling Azure Function: ${azureFunctionUrl}`);
  console.log(`Full URL: ${fullUrl}`);
  
  const response = await this.helpers.httpRequest({
    method: 'GET',
    url: fullUrl,
    headers: {
      'Accept': 'application/json'
    },
    json: true,
    timeout: 10000 // 10 second timeout
  });

  console.log('Response received:', JSON.stringify(response).substring(0, 200));

  // Check if the response indicates an error
  if (response && response.success === false) {
    console.error('Azure Function returned error:', response.error);
    return `Search service error: ${response.error || 'Unknown error'}. Please try again.`;
  }

  // Handle the response structure from your Azure Function
  if (!response || !response.results || response.results.length === 0) {
    return `No search results found for "${query}". Try using different search terms.`;
  }

  let searchResults = "Based on current web search results:\n\n";

  response.results.forEach((item, index) => {
    // IMPORTANT: Azure Function returns capitalized field names
    const title = item.Title || item.title || 'No title';
    const snippet = item.Snippet || item.snippet || item.Description || item.description || '';
    const link = item.Link || item.link || item.url || '';
    
    console.log(`Result ${index + 1}: Title="${title}", Link="${link}"`);
    
    // Clean the URL
    let cleanUrl = link;
    if (cleanUrl) {
      // Remove any trailing punctuation characters that could break URLs
      cleanUrl = cleanUrl.replace(/[)\]}\.,;!?\s]+$/, '');
      
      // Remove incomplete query parameters at the end
      cleanUrl = cleanUrl.replace(/&[^&=]*$/, '');
      
      // Ensure URL doesn't end with punctuation by checking again
      while (cleanUrl.match(/[)\]}\.,;!?\s]$/)) {
        cleanUrl = cleanUrl.slice(0, -1);
      }
      
      // Trim any remaining whitespace
      cleanUrl = cleanUrl.trim();
    }

    searchResults += `**${index + 1}. ${title}**\n\n`;
    if (snippet) {
      searchResults += `${snippet}\n\n`;
    }
    if (cleanUrl) {
      searchResults += `📎 **Source:** ${cleanUrl}\n\n`;
    }
    searchResults += "---\n\n";
  });

  // Return just the string for n8n compatibility
  return searchResults;

} catch (error) {
  console.error('Search error:', error);
  console.error('Error stack:', error.stack);
  
  // More detailed error handling
  if (error.message && error.message.includes('404')) {
    return `Search service not found. Please check the Azure Function URL configuration. Error: ${error.message}`;
  } else if (error.message && error.message.includes('timeout')) {
    return `Search request timed out. Please try again. Error: ${error.message}`;
  } else {
    return `Search failed: ${error.message || 'Unknown error'}. Please try again in a moment.`;
  }
}

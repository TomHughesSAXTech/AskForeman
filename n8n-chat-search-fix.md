# n8n Chat Workflow Fix: Azure Search Client Filtering

## Problem
Documents are being indexed successfully with the correct client name ("tom"), but the chat system can't find them when querying. The chat is returning "Unknown file" even though the document exists in the index.

## Root Cause
The Azure Search query in your n8n chat workflow is not properly filtering by client, or the search is not returning the proper metadata in the response.

## Solution: Fix the Azure Search Query Node in Chat Workflow

### Find Your "Search Documents" or "Query Azure Search" Node

Look for the node in your chat workflow that queries Azure Cognitive Search. It should be after receiving the chat message and before generating the AI response.

### Update the Search Query Code

Replace the search query code with this fixed version:

```javascript
// Enhanced Azure Search query with proper client filtering
const chatData = $json;
const userMessage = chatData.message || '';
const clientFilter = chatData.client || 'general';
const sessionId = chatData.sessionId || 'default';

// Build the search query
let searchQuery = {
  search: userMessage,
  searchMode: "any",
  queryType: "simple",
  top: 5,
  select: "id,client,category,fileName,content,blobPath,uploadedAt",
  count: true,
  includeTotalCount: true
};

// Add client filter if not "general"
if (clientFilter && clientFilter !== 'general') {
  searchQuery.filter = `client eq '${clientFilter}'`;
  console.log(`Filtering search results for client: ${clientFilter}`);
} else {
  console.log('No client filter applied - searching all documents');
}

// Log the query for debugging
console.log('Search query:', JSON.stringify(searchQuery, null, 2));

return {
  searchPayload: searchQuery,
  clientContext: clientFilter,
  userQuery: userMessage,
  // Pass through other data
  ...chatData
};
```

### Alternative: Semantic Search Query

If you're using semantic search, use this version:

```javascript
// Semantic search with client filtering
const chatData = $json;
const userMessage = chatData.message || '';
const clientFilter = chatData.client || 'general';

// Build semantic search query
let searchRequest = {
  search: userMessage,
  queryType: "semantic",
  semanticConfiguration: "default", // or your config name
  queryLanguage: "en-US",
  top: 5,
  select: "id,client,category,fileName,content,blobPath,uploadedAt",
  count: true
};

// Add filter for client
if (clientFilter && clientFilter !== 'general') {
  searchRequest.filter = `client eq '${clientFilter}'`;
  console.log(`Applying client filter: ${clientFilter}`);
}

// Add vector search if you have embeddings
if ($node["Generate Embeddings"]?.json?.embedding) {
  searchRequest.vectors = [{
    value: $node["Generate Embeddings"].json.embedding,
    fields: "contentVector",
    k: 5
  }];
  searchRequest.queryType = "hybrid"; // Use hybrid for vector + text
}

console.log('Semantic search request:', {
  query: userMessage,
  client: clientFilter,
  hasVector: !!searchRequest.vectors
});

return {
  searchPayload: searchRequest,
  clientContext: clientFilter,
  userQuery: userMessage,
  ...chatData
};
```

### Fix the HTTP Request Node

In your "Azure Search HTTP Request" node, ensure it's configured correctly:

**URL:**
```
https://fcssearchservice.search.windows.net/indexes/fcs-construction-docs-index-v2/docs/search?api-version=2023-11-01
```

**Method:** POST

**Headers:**
```json
{
  "Content-Type": "application/json",
  "api-key": "{{ $credentials.azureSearchApiKey }}"
}
```

**Body:**
```json
{{ $json.searchPayload }}
```

### Process Search Results Node

Add or update the node that processes search results:

```javascript
// Process Azure Search results for chat context
const searchResponse = $node["Azure Search HTTP Request"].json;
const clientContext = $json.clientContext || 'general';

// Extract documents from search results
const documents = searchResponse.value || [];
const totalCount = searchResponse['@odata.count'] || documents.length;

console.log(`Found ${totalCount} documents for client: ${clientContext}`);

// Format documents for chat context
const formattedDocs = documents.map(doc => {
  return {
    id: doc.id,
    fileName: doc.fileName || 'Unknown file',
    client: doc.client || clientContext,
    category: doc.category || 'general',
    content: doc.content || '',
    uploadedAt: doc.uploadedAt,
    relevance: doc['@search.score'] || 0
  };
});

// Log what we found
if (formattedDocs.length > 0) {
  console.log('Documents found:', formattedDocs.map(d => ({
    fileName: d.fileName,
    client: d.client,
    relevance: d.relevance
  })));
} else {
  console.log('No documents found for query');
}

// Build context for AI
const contextDocuments = formattedDocs
  .slice(0, 3) // Top 3 most relevant
  .map(doc => `File: ${doc.fileName}\nCategory: ${doc.category}\nContent: ${doc.content.substring(0, 2000)}`)
  .join('\n\n---\n\n');

return {
  documents: formattedDocs,
  documentCount: totalCount,
  hasDocuments: formattedDocs.length > 0,
  context: contextDocuments || 'No relevant documents found.',
  clientContext: clientContext,
  // Pass through original data
  ...$json
};
```

### Update Your AI Response Generation

In the node where you generate the AI response (OpenAI, Claude, etc.), make sure to include the document context:

```javascript
// Prepare AI prompt with document context
const searchResults = $node["Process Search Results"].json;
const userMessage = searchResults.userQuery || $json.message;
const clientName = searchResults.clientContext || 'general';
const documentContext = searchResults.context || '';
const hasDocuments = searchResults.hasDocuments || false;

let systemPrompt = `You are a construction AI assistant helping with project "${clientName}".`;

if (hasDocuments) {
  systemPrompt += `\n\nRelevant documents from the project:\n${documentContext}`;
} else if (clientName !== 'general') {
  systemPrompt += `\n\nNo documents found for client "${clientName}". The client may not have uploaded documents yet.`;
}

const messages = [
  {
    role: "system",
    content: systemPrompt
  },
  {
    role: "user", 
    content: userMessage
  }
];

return {
  messages: messages,
  temperature: 0.7,
  max_tokens: 1000,
  // Include metadata for response
  metadata: {
    client: clientName,
    documentsFound: searchResults.documentCount || 0,
    documentList: searchResults.documents?.map(d => d.fileName) || []
  }
};
```

## Debugging Steps

1. **Check if documents are in the index:**
   - Use Azure Portal to query the search index directly
   - Look for documents with client="tom"

2. **Add logging to your n8n workflow:**
   - Log the search query being sent
   - Log the search response received
   - Log the processed documents

3. **Verify the index schema:**
   - Ensure "client" field is filterable in your index
   - Check that "client" field is being populated correctly

## Quick Test

After applying these fixes:
1. Upload a document for client "tom"
2. Select "Tom" in the chat dropdown
3. Ask "what documents do you have?"
4. The response should list the actual document names instead of "Unknown file"

## If Still Not Working

Check these common issues:

1. **Index field configuration:**
   - The "client" field must be marked as "filterable" in your Azure Search index
   - If not, you'll need to recreate the index with proper field attributes

2. **Case sensitivity:**
   - Azure Search filters are case-sensitive by default
   - Ensure the client name case matches exactly (e.g., "tom" vs "Tom")

3. **Data freshness:**
   - Azure Search has a slight delay (usually < 1 minute) for new documents
   - Wait a moment after uploading before querying

4. **Search service tier:**
   - Free tier has limitations on filtering
   - Ensure your search service supports the features you're using
